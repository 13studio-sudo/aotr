// =====================================================================
// AOTR — logo.js
// Loads the AOTR logo SVG and inlines it into every .aotr-logo container.
// Inline (rather than <img>) so the orange fill can be styled per-context
// and the SVG inherits drop-shadow filters.
// =====================================================================

let _logoMarkup = null;

async function loadLogo() {
  if (_logoMarkup) return _logoMarkup;
  try {
    const r = await fetch('./svg/aotr-logo.svg', { cache: 'force-cache' });
    if (!r.ok) throw new Error('Failed to fetch logo');
    let svg = await r.text();
    // Strip XML declaration (browsers don't like it inline)
    svg = svg.replace(/<\?xml[^?]*\?>\s*/i, '');
    _logoMarkup = svg;
    return svg;
  } catch (err) {
    console.warn('[AOTR] logo failed to load, falling back to text:', err);
    _logoMarkup = '<span style="font-family:Antonio,sans-serif;font-weight:700;font-size:96px;color:#ff7a3d;">AOTR</span>';
    return _logoMarkup;
  }
}

export async function injectLogos() {
  const html = await loadLogo();
  document.querySelectorAll('.aotr-logo').forEach(el => {
    if (!el.dataset.injected) {
      el.innerHTML = html;
      el.dataset.injected = 'true';
    }
  });
}
