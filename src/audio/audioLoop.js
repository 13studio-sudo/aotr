// =====================================================================
// AOTR — audioLoop.js
// Crossfaded looping playback. Two AudioBufferSources overlap with a
// linear gain ramp for a seamless loop. An AnalyserNode taps frequency
// data for the visual bass-pulse on the track.
//
// v0.0.27 fixes:
//   • Progress callback now animates even when Content-Length is missing
//     (chunked transfer, gzipped responses on GitHub Pages). Previously
//     the bar stayed at 0% until the entire file downloaded, looking
//     like a hang on slow connections.
//   • 30 s AbortController timeout on the initial fetch so a stalled
//     network surfaces as an error instead of an infinite wait.
//   • Safari fallback when response.body streaming is unavailable.
// =====================================================================

import { STATE } from '../config.js';

const CROSSFADE_SEC      = 0.4;        // overlap duration between loop iterations
const FETCH_TIMEOUT_MS   = 30_000;
const ESTIMATED_SIZE     = 1_500_000;  // ≈ size of funky_fusion_bass.m4a; only used
                                       // when Content-Length is missing.

export class AudioLoop {
  constructor() {
    this.ctx                  = null;
    this.buffer               = null;
    this.master               = null;
    this.analyser             = null;
    this._freqData            = null;
    this._sources             = [];
    this._stopRequested       = false;
    this._generation          = 0;       // bumped on each start; stale timeouts ignored
    this._pendingArrayBuffer  = null;
    this.playing              = false;
  }

  ensureCtx() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctor();
    return this.ctx;
  }

  async fetchAssets(audioUrl, onProgress) {
    const ctrl  = new AbortController();
    const timer = setTimeout(
      () => ctrl.abort(new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms`)),
      FETCH_TIMEOUT_MS,
    );

    try {
      const res = await fetch(audioUrl, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${audioUrl}`);

      const contentLen = parseInt(res.headers.get('content-length') || '0', 10);
      const knownSize  = contentLen > 0;
      const total      = knownSize ? contentLen : ESTIMATED_SIZE;

      // Safari fallback: some older versions don't expose a streaming reader.
      // Fall back to one-shot arrayBuffer with a coarse progress signal.
      if (!res.body || typeof res.body.getReader !== 'function') {
        onProgress?.(0.3);
        this._pendingArrayBuffer = await res.arrayBuffer();
        onProgress?.(1.0);
        return;
      }

      const reader   = res.body.getReader();
      const chunks   = [];
      let   received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        // When we know the real size, report exact progress.
        // When we don't, cap streaming progress at 95% so the final
        // 100% reflects actual completion.
        const pct = knownSize
          ? Math.min(1, received / total)
          : Math.min(0.95, received / total);
        onProgress?.(pct);
      }

      this._pendingArrayBuffer = await new Blob(chunks).arrayBuffer();
      onProgress?.(1.0);
    } finally {
      clearTimeout(timer);
    }
  }

  async ensureDecoded() {
    if (this.buffer) return this.buffer;
    if (!this._pendingArrayBuffer) {
      throw new Error('ensureDecoded called before fetchAssets');
    }
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (_) {}
    }
    // Wrap decodeAudioData to support both callback and promise styles, and
    // enforce a hard timeout — some browsers drop the promise silently on
    // malformed inputs.
    this.buffer = await new Promise((resolve, reject) => {
      let settled = false;
      const ok   = (b)   => { if (!settled) { settled = true; resolve(b); } };
      const fail = (err) => { if (!settled) { settled = true; reject(err); } };
      try {
        const ret = ctx.decodeAudioData(this._pendingArrayBuffer, ok, fail);
        if (ret && typeof ret.then === 'function') ret.then(ok, fail);
      } catch (e) { fail(e); }
      setTimeout(() => fail(new Error('decodeAudioData timeout')), 15_000);
    });
    this._pendingArrayBuffer = null;
    return this.buffer;
  }

  start() {
    this.stop();
    if (!this.buffer) {
      console.warn('[AudioLoop] start() called before decoded');
      return;
    }
    const ctx = this.ensureCtx();
    this._generation++;                  // invalidate any stale timeouts

    this.master = ctx.createGain();
    this.master.gain.value = STATE.musicVolume;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.7;
    this._freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this._stopRequested = false;
    this._sources       = [];
    this.playing        = true;

    this._scheduleIteration(ctx.currentTime + 0.05, this._generation);
  }

  _scheduleIteration(startAt, gen) {
    if (this._stopRequested || !this.buffer) return;
    if (gen !== this._generation) return;        // stale callback from old run
    const ctx = this.ctx;
    const dur = this.buffer.duration;

    const srcGain = ctx.createGain();
    srcGain.connect(this.master);
    const source = ctx.createBufferSource();
    source.buffer = this.buffer;
    source.connect(srcGain);

    // First iteration plays at full gain immediately; subsequent ones fade in.
    const isFirst = this._sources.length === 0;
    if (isFirst) {
      srcGain.gain.setValueAtTime(1.0, startAt);
    } else {
      srcGain.gain.setValueAtTime(0.0, startAt);
      srcGain.gain.linearRampToValueAtTime(1.0, startAt + CROSSFADE_SEC);
    }
    // Fade out at the tail
    srcGain.gain.setValueAtTime(1.0, startAt + dur - CROSSFADE_SEC);
    srcGain.gain.linearRampToValueAtTime(0.0, startAt + dur);

    source.start(startAt);
    source.stop(startAt + dur + 0.02);

    const entry = { source, srcGain };
    this._sources.push(entry);
    source.onended = () => {
      try { srcGain.disconnect(); } catch (_) {}
      const i = this._sources.indexOf(entry);
      if (i >= 0) this._sources.splice(i, 1);
    };

    const nextStart = startAt + dur - CROSSFADE_SEC;
    const delayMs   = Math.max(0, (nextStart - ctx.currentTime - 0.5) * 1000);
    setTimeout(() => this._scheduleIteration(nextStart, gen), delayMs);
  }

  applyVolume() {
    if (this.master) this.master.gain.value = STATE.musicVolume;
  }

  stop() {
    this.playing        = false;
    this._stopRequested = true;
    this._sources.forEach(({ source, srcGain }) => {
      try { source.stop();        } catch (_) {}
      try { source.disconnect();  } catch (_) {}
      try { srcGain.disconnect(); } catch (_) {}
    });
    this._sources = [];
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (_) {}
      this.analyser  = null;
      this._freqData = null;
    }
    if (this.master) {
      try { this.master.disconnect(); } catch (_) {}
      this.master = null;
    }
  }

  // Returns 0..1 normalized bass level for the visual pulse.
  getBassLevel() {
    if (!this.analyser || !this._freqData) return 0;
    this.analyser.getByteFrequencyData(this._freqData);
    const N        = this._freqData.length;
    const bassBins = Math.max(2, Math.floor(N * 0.12));
    let sum = 0;
    for (let i = 0; i < bassBins; i++) sum += this._freqData[i];
    return (sum / bassBins) / 255;
  }

  // Back-compat: jumpSfx wiring reads `audioLoop.gain` for the routing node.
  get gain() { return this.master; }
}
