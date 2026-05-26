# AOTR — Art of the Race

**v0.0.27**

An endless rhythm-driving run on a 3D Möbius band. Three.js + Vanilla JS +
Web Audio, packaged with Vite. Plays in a browser on desktop or phone.

The car accelerates continuously, "notes" (boxes) spawn ahead of you in
lanes, and you swap lanes or jump to thread through them. The run ends
when you hit a note or fall off the edge of the strip. Score is a pure
function of the speed multiplier and is displayed in the top-left.

---

## Quick Start

```bash
npm install
npm run dev
```

Open the URL Vite prints (default: `http://localhost:5173`).

```bash
npm run build      # → ./dist
npm run preview    # serve dist/ locally
```

---

## Controls

### Desktop
| Action            | Input                                  |
|-------------------|----------------------------------------|
| Steer (lane)      | `←` / `→` arrow keys (inverted; see below) |
| Boost             | Hold `W` or `Space`                    |
| Jump              | Release `W` / `Space`                  |

Holding the boost key and then releasing it both stops the boost **and**
fires a jump in the same gesture. Quick taps therefore act as pure jumps
with a brief speed bump.

### Mobile
| Action            | Input                                  |
|-------------------|----------------------------------------|
| Steer (lane)      | Tilt phone left/right (gyro)           |
| Boost             | Touch and hold anywhere on screen      |
| Jump              | Release the touch                      |

On first launch the game asks for gyroscope permission via a "TILT TO
STEER" overlay. iOS 13+ requires the permission to come from a real user
gesture, which the overlay's "ALLOW" button supplies.

### Inverted steering
The arrow-key polarity is intentionally inverted: `←` increases lane
index, `→` decreases. Gyro tilt is inverted to match. The reasoning is
that the camera is mounted on the car, so tilting your view right (or
pressing `→`) should feel like the world swings *toward* the left of
the cockpit.

### Debug HUD
Press the backtick key (`` ` ``) at any time to toggle a live state
overlay (FPS, speed multiplier, audio status, GPU stats, log feed).

---

## Dev Panel

Click the hamburger icon at top-left to open. Tabs:

- **GAME** — lane count, start speed, accel-per-second, jump duration.
  `RESET` restores defaults, `SAVE` persists to `localStorage`, `NEW GAME`
  restarts in-place with current values.
- **THEME** — color/alpha/width for the four channels (wireframe, strings,
  background, text). Changes apply live.
- **AUDIO** — music volume.
- **FX** — jump SFX preset (BOING / WOOP / HOP), Synthwave palette toggle,
  universe-backdrop toggle.

Settings under `GAME` are persisted to `aotr.settings.v1` in
`localStorage` only when you press `SAVE`. Theme tweaks are session-only.

---

## Console Hooks

Once the page is loaded, paste in the DevTools console:

```js
performance.now()         // sanity check
```

The debug HUD (`` ` ``) is the primary live-state surface. There is no
global `window.AOTR` object in v0.0.27 — the lifecycle is internal.

---

## Project Structure

```
aotr/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── songs/funky_fusion_bass.m4a    (the loop)
│   └── svg/aotr-logo.svg, speedometer.svg
├── src/
│   ├── main.js                        (entry: state machine + bootstrap)
│   ├── config.js                      (STATE, DEFAULTS, persistence)
│   ├── theme.js                       (4-channel theme pub/sub)
│   ├── scene/
│   │   ├── track.js                   (Möbius geometry, lane lines)
│   │   ├── notes.js                   (note manager + collisions)
│   │   ├── car.js                     (square-only F1 mesh)
│   │   └── lighting.js                (starfield + orbit grid)
│   ├── game/
│   │   ├── player.js                  (player state, jump, lane shift)
│   │   ├── camera.js                  (chase camera + shake)
│   │   └── input.js                   (keyboard, touch, gyro)
│   ├── audio/
│   │   ├── audioLoop.js               (crossfaded looping playback)
│   │   └── jumpSfx.js                 (3 synthesized SFX)
│   └── ui/
│       ├── layout.css                 (responsive 4-strip layout)
│       ├── devPanel.js                (dev controls)
│       ├── screens.js                 (loading / gameover / gyro overlays)
│       ├── hud.js                     (live score)
│       ├── debugHud.js                (live state HUD, ` toggle)
│       └── logo.js                    (inline SVG injection)
└── .github/workflows/deploy.yml       (GitHub Pages CI)
```

---

## Changelog

### v0.0.27
- **Fixed**: loading screen freeze at 0%. The progress bar now animates
  even when the server omits `Content-Length` (chunked transfer, gzip
  on GitHub Pages); previously the bar stayed at 0% until the entire
  audio file had downloaded, looking like a hang on slow connections.
- **Added**: 30-second `AbortController` timeout on the asset fetch and
  a Safari fallback for missing body streaming. Stalled networks now
  surface a "LOAD FAILED — TAP TO RETRY" message instead of waiting
  forever.
- **Removed**: dead code — `src/utils/responsive.js`, the inert
  `THREE.AmbientLight` in `lighting.js`, and the stale `attachObsidian`
  proxy in `main.js`.
- **Cleaned**: `theme.js` channel pub/sub collapsed into a small
  `makeChannel` helper. `car.js` body parts converted from twelve
  near-identical `addPart` blocks to a single data-driven loop.
  `track.js` lane-line construction tightened.
- **Improved**: asset/decode failures now show an actionable retry
  prompt instead of leaving the loading overlay frozen.

### v0.0.26 and earlier
This codebase began life as a multi-car F1 racing prototype on a Möbius
strip (v0.0.1 — see the original README). Across the ~25 intermediate
versions it pivoted to the current endless rhythm-runner. The Möbius
geometry, square-only car aesthetic, and dev-panel-driven theming are
the surviving lineage.

---

## Limitations

- One audio loop (`funky_fusion_bass.m4a`); no track selection.
- No leaderboard; top score is shown only on the current run's game-over
  screen.
- No accessibility audit. High-flash settings (Synthwave + bass pulse)
  may not be suitable for photosensitive users.

---

## License

The audio file `funky_fusion_bass.m4a` is included with this prototype.
All other source is original to AOTR.
