/**
 * GPU frame timer (EXT_disjoint_timer_query_webgl2). Measures how long the
 * GPU spends on our rendering, independent of the display's refresh rate and
 * of hiccups on the main thread. Results arrive a frame or two late.
 * Not every browser exposes it (Safari doesn't); `available` says so.
 */
export class GpuTimer {
  constructor(renderer) {
    this.gl = renderer.getContext();
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending = [];
    this.active = null;
    this.samples = [];
  }

  get available() {
    return !!this.ext;
  }

  begin() {
    if (!this.ext || this.active || this.pending.length > 3) return;
    const q = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end() {
    if (!this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** Collect finished measurements; returns them (ms) and forgets them. */
  take() {
    const { gl, ext } = this;
    if (!ext) return [];
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) this.samples.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
      this.pending.shift();
    }
    const out = this.samples;
    this.samples = [];
    return out;
  }
}

/** Defaults for the quality switches (the debug panel can change them; scale, the 画质 menu too). */
export const QUALITY_DEFAULTS = {
  scale: 'auto', // 'auto' or a fraction of the highest resolution (the screen's own, up to 2× — World.maxPixelRatio)
  // 'auto': on a fast display (120 / 144 Hz…) every n-th refresh, near 60 a
  // second, evenly paced (rendering at the full rate the GPU fell behind and
  // the motion stuttered); 0 = as fast as the display refreshes; or a number
  fpsCap: 'auto',
  shadows: true,
  bloom: true, // night glow and the haze while day turns to night
  msaa: true,
  reveal: true, // the opposite-time-of-day effect
  ribbons: true,
  ribbonShadow: false, // ribbon shadows force a shadow redraw every frame
  grain: true, // paper grain and vignette
};

/**
 * The quality switches changed on this device (by the 画质 menu or the debug
 * panel), kept per address: only what differs from the defaults.
 */
const STORE = 'youxizhi-quality';
export function loadQuality() {
  try {
    const q = JSON.parse(localStorage.getItem(STORE) || '{}');
    return q && typeof q === 'object' ? q : {};
  } catch {
    return {};
  }
}
export function saveQuality(q) {
  const changed = {};
  for (const k of Object.keys(QUALITY_DEFAULTS)) if (q[k] !== QUALITY_DEFAULTS[k]) changed[k] = q[k];
  try {
    if (Object.keys(changed).length) localStorage.setItem(STORE, JSON.stringify(changed));
    else localStorage.removeItem(STORE);
  } catch {
    /* storage unavailable */
  }
}
