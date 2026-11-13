/* Dead Pixel: core model. Colours, palettes, the document (layers, frames, cels, tags), compositing with blend
   modes, and undo history. Plain script (no modules) so the app runs from file:// as well as from the server. */
(function (root) {
  'use strict';
  const DP = root.DP || (root.DP = {});
  DP.VERSION = '1.0.0'; // keep in step with package.json and the release tag (docs/ROADMAP.md)

  // ---------------------------------------------------------------- colour
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  DP.clamp = clamp;

  DP.hexToRgba = function (h) {
    h = String(h).trim().replace(/^#/, '').replace(/^0x/i, '');
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null;
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  };
  DP.rgbaToHex = function (c, withAlpha) {
    const p = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
    return '#' + p(c[0]) + p(c[1]) + p(c[2]) + (withAlpha && c[3] !== 255 ? p(c[3]) : '');
  };
  DP.lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

  DP.rgbToHsv = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
  };
  DP.hsvToRgb = function (h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };
  DP.rgbToHsl = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, s, l];
  };

  /** Perceptual-ish distance ("redmean"), good enough for matching against small palettes. */
  DP.colourDist = function (a, b) {
    const rm = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    const da = (a[3] === undefined ? 255 : a[3]) - (b[3] === undefined ? 255 : b[3]);
    return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db + 3 * da * da;
  };
  /** Index of the palette entry nearest to a colour. */
  DP.nearest = function (pal, c) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const d = DP.colourDist(pal[i], c);
      if (d < bd) { bd = d; best = i; if (!d) break; }
    }
    return best;
  };

  // ---------------------------------------------------------------- palettes
  const hexList = (s) => s.trim().split(/\s+/).map(DP.hexToRgba);
  DP.PRESETS = {
    'DB16': hexList('140c1c 442434 30346d 4e4a4e 854c30 346524 d04648 757161 597dce d27d2c 8595a1 6daa2c d2aa99 6dc2ca dad45e deeed6'),
    'DB32': hexList('000000 222034 45283c 663931 8f563b df7126 d9a066 eec39a fbf236 99e550 6abe30 37946e 4b692f 524b24 323c39 3f3f74 306082 5b6ee1 639bff 5fcde4 cbdbfc ffffff 9badb7 847e87 696a6a 595652 76428a ac3232 d95763 d77bba 8f974a 8a6f30'),
    'Game Boy (green)': hexList('0f380f 306230 8bac0f 9bbc0f'),
    'Game Boy (grey)': hexList('000000 555555 aaaaaa ffffff'),
    'EGA 16': hexList('000000 0000aa 00aa00 00aaaa aa0000 aa00aa aa5500 aaaaaa 555555 5555ff 55ff55 55ffff ff5555 ff55ff ffff55 ffffff'),
    'CGA mode 4': hexList('000000 55ffff ff55ff ffffff'),
    'Greyscale 8': hexList('000000 242424 494949 6d6d6d 929292 b6b6b6 dbdbdb ffffff'),
  };
  /** The room palettes, filled in by palettes-game.js. */
  DP.GAME_PALETTES = DP.GAME_PALETTES || {};
  DP.allPresets = function () {
    const out = {};
    for (const k in DP.GAME_PALETTES) out['Room: ' + k] = DP.GAME_PALETTES[k].map(DP.hexToRgba);
    for (const k in DP.PRESETS) out[k] = DP.PRESETS[k];
    return out;
  };

  /** Median-cut extraction of up to n colours from RGBA pixels (transparent pixels ignored). */
  DP.extractPalette = function (rgba, n) {
    const seen = new Map();
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] < 128) continue;
      const k = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    const cols = [...seen.entries()].map(([k, c]) => ({ r: (k >> 16) & 255, g: (k >> 8) & 255, b: k & 255, c }));
    if (cols.length <= n) return cols.sort((a, b) => DP.lum([a.r, a.g, a.b]) - DP.lum([b.r, b.g, b.b])).map((p) => [p.r, p.g, p.b, 255]);
    let boxes = [cols];
    while (boxes.length < n) {
      let bi = -1, br = -1, bch = 'r';
      boxes.forEach((box, i) => {
        if (box.length < 2) return;
        for (const ch of ['r', 'g', 'b']) {
          let lo = 255, hi = 0;
          for (const p of box) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; }
          if (hi - lo > br) { br = hi - lo; bi = i; bch = ch; }
        }
      });
      if (bi < 0) break;
      const box = boxes[bi].sort((a, b) => a[bch] - b[bch]);
      let total = 0; for (const p of box) total += p.c;
      let acc = 0, cut = 1;
      for (let i = 0; i < box.length - 1; i++) { acc += box[i].c; if (acc >= total / 2) { cut = i + 1; break; } }
      boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
    }
    return boxes.map((box) => {
      let r = 0, g = 0, b = 0, t = 0;
      for (const p of box) { r += p.r * p.c; g += p.g * p.c; b += p.b * p.c; t += p.c; }
      return [Math.round(r / t), Math.round(g / t), Math.round(b / t), 255];
    }).sort((a, b) => DP.lum(a) - DP.lum(b));
  };

  /** A colour's tint/shade/tone rows and a hue-shifted ramp (lighter warms towards yellow, darker cools towards blue). */
  DP.matrix = function (c, steps) {
    steps = steps || 7;
    const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)).concat(255);
    const row = (target) => Array.from({ length: steps }, (_, i) => mix(c, target, (i + 1) / (steps + 1)));
    const [h, s, v] = DP.rgbToHsv(c[0], c[1], c[2]);
    const ramp = [];
    const half = Math.floor(steps / 2);
    for (let i = -half; i <= half; i++) {
      const t = i / (half + 1);
      // Towards yellow (60) when lighter, towards blue (240) when darker, the classic pixel-art ramp
      const target = t > 0 ? 60 : 240;
      let dh = ((target - h + 540) % 360) - 180;
      const nh = h + dh * Math.abs(t) * 0.35;
      const ns = clamp(s * (1 - 0.25 * t) + (t < 0 ? 0.1 * -t : 0), 0, 1);
      const nv = clamp(v + t * (t > 0 ? 1 - v : v) * 0.9, 0, 1);
      ramp.push(DP.hsvToRgb(nh, ns, nv).concat(255));
    }
    return {
      tints: row([255, 255, 255]),
      shades: row([0, 0, 0]),
      tones: row([128, 128, 128]),
      ramp,
    };
  };
  /** n colours from a to b; hueShift bends the middle like a hand-built ramp. */
  DP.ramp = function (a, b, n, hueShift) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      if (!hueShift) { out.push([0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)).concat(255)); continue; }
      const ha = DP.rgbToHsv(a[0], a[1], a[2]), hb = DP.rgbToHsv(b[0], b[1], b[2]);
      let dh = ((hb[0] - ha[0] + 540) % 360) - 180;
      const bow = Math.sin(Math.PI * t) * 0.15;
      out.push(DP.hsvToRgb(ha[0] + dh * t, clamp(ha[1] + (hb[1] - ha[1]) * t + bow, 0, 1), ha[2] + (hb[2] - ha[2]) * t).concat(255));
    }
    return out;
  };

  // ---------------------------------------------------------------- blend modes (W3C compositing)
  const sep = {
    normal: (b, s) => s,
    multiply: (b, s) => b * s,
    screen: (b, s) => b + s - b * s,
    overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
    darken: (b, s) => Math.min(b, s),
    lighten: (b, s) => Math.max(b, s),
    'color-dodge': (b, s) => (b === 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s))),
    'color-burn': (b, s) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s)),
    'hard-light': (b, s) => (s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
    'soft-light': (b, s) => {
      if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
      const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
      return b + (2 * s - 1) * (d - b);
    },
    difference: (b, s) => Math.abs(b - s),
    exclusion: (b, s) => b + s - 2 * b * s,
    addition: (b, s) => Math.min(1, b + s),
    subtract: (b, s) => Math.max(0, b - s),
    divide: (b, s) => (s <= 0 ? 1 : Math.min(1, b / s)),
  };
  const L = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const clipC = (c) => {
    const l = L(c), n = Math.min(c[0], c[1], c[2]), x = Math.max(c[0], c[1], c[2]);
    if (n < 0) c = c.map((v) => l + ((v - l) * l) / (l - n));
    if (x > 1) c = c.map((v) => l + ((v - l) * (1 - l)) / (x - l));
    return c;
  };
  const setLum = (c, l) => { const d = l - L(c); return clipC([c[0] + d, c[1] + d, c[2] + d]); };
  const sat = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
  const setSat = (c, s) => {
    const idx = [0, 1, 2].sort((i, j) => c[i] - c[j]);
    const out = [0, 0, 0];
    const mn = c[idx[0]], md = c[idx[1]], mx = c[idx[2]];
    if (mx > mn) { out[idx[1]] = ((md - mn) * s) / (mx - mn); out[idx[2]] = s; }
    return out;
  };
  const nonsep = {
    hue: (b, s) => setLum(setSat(s, sat(b)), L(b)),
    saturation: (b, s) => setLum(setSat(b, sat(s)), L(b)),
    color: (b, s) => setLum(s, L(b)),
    luminosity: (b, s) => setLum(b, L(s)),
  };
  DP.BLEND_MODES = Object.keys(sep).concat(Object.keys(nonsep));

  /** Blends src (0-255 rgba, alpha already scaled by opacity) over dst at index i, in place. */
  function blendPixel(dst, i, sr, sg, sb, sa, mode) {
    if (sa <= 0) return;
    const ba = dst[i + 3] / 255;
    const as = sa / 255;
    if (mode === 'normal' || ba === 0) {
      const ao = as + ba * (1 - as);
      dst[i] = (sr * as + dst[i] * ba * (1 - as)) / ao;
      dst[i + 1] = (sg * as + dst[i + 1] * ba * (1 - as)) / ao;
      dst[i + 2] = (sb * as + dst[i + 2] * ba * (1 - as)) / ao;
      dst[i + 3] = ao * 255;
      return;
    }
    const cb = [dst[i] / 255, dst[i + 1] / 255, dst[i + 2] / 255], cs = [sr / 255, sg / 255, sb / 255];
    let mixed;
    if (sep[mode]) { const f = sep[mode]; mixed = [f(cb[0], cs[0]), f(cb[1], cs[1]), f(cb[2], cs[2])]; }
    else mixed = nonsep[mode](cb, cs);
    const ao = as + ba * (1 - as);
    for (let k = 0; k < 3; k++) {
      const cr = (1 - ba) * cs[k] + ba * mixed[k];
      dst[i + k] = ((as * cr + ba * cb[k] * (1 - as)) / ao) * 255;
    }
    dst[i + 3] = ao * 255;
  }
  DP.blendPixel = blendPixel;

  // ---------------------------------------------------------------- document
  let uid = 1;
  DP.newId = () => 'i' + (Date.now().toString(36)) + (uid++).toString(36);

  class Doc {
    constructor(w, h, mode) {
      this.w = w; this.h = h;
      this.mode = mode || 'rgb';               // 'rgb' or 'indexed'
      this.name = 'Untitled';
      this.palette = DP.PRESETS.DB32.map((c) => c.slice());
      this.layers = [];                        // bottom first; {id,name,kind,parent,visible,locked,opacity,blend,collapsed}
      this.frames = [{ duration: 100 }];
      this.cels = {};                          // 'layerId/frame' -> cel id (shared ids = linked cels)
      this.celData = {};                       // cel id -> {data} (Uint8ClampedArray rgba, or Int16Array index, -1 clear)
      this.tags = [];                          // {name, from, to, colour, dir: 'forward'|'reverse'|'pingpong'}
      this.indexedBlendSnap = true;            // indexed mode: blended results land back on the palette
      this.lighting = DP.Lighting ? DP.Lighting.defaults() : null;
      this.grid = { w: 16, h: 16, show: false };
      this.sources = {};                       // cel id -> {name, x, y, w, h}: the Unity sprite a cel came from (import)
      this.pivot = null;                       // [x, y] canvas pivot of imported sprites (the feet), or null
      this.version = 0;
    }

    static blank(w, h, mode) {
      const d = new Doc(w, h, mode);
      d.addLayer('Layer 1', 'layer');
      return d;
    }

    touch() { this.version++; }
    pixelsLen() { return this.w * this.h; }
    newData() { return this.mode === 'indexed' ? new Int16Array(this.w * this.h).fill(-1) : new Uint8ClampedArray(this.w * this.h * 4); }

    layer(id) { return this.layers.find((l) => l.id === id) || null; }
    children(parentId) { return this.layers.filter((l) => (l.parent || null) === (parentId || null)); }
    /** Visible to the composite: the layer and every group above it are shown. */
    shown(l) { while (l) { if (!l.visible) return false; l = l.parent ? this.layer(l.parent) : null; } return true; }
    depth(l) { let d = 0; while (l && l.parent) { d++; l = this.layer(l.parent); } return d; }

    addLayer(name, kind, opts) {
      const l = Object.assign({ id: DP.newId(), name, kind: kind || 'layer', parent: null, visible: true, locked: false, opacity: 255, blend: 'normal', collapsed: false }, opts || {});
      if (l.kind === 'background') {
        l.parent = null;
        this.layers.unshift(l);
        for (let f = 0; f < this.frames.length; f++) {
          const id = DP.newId(); const data = this.newData();
          this.fillOpaque(data);
          this.celData[id] = { data }; this.cels[l.id + '/' + f] = id;
        }
      } else this.layers.push(l);
      return l;
    }
    fillOpaque(data) {
      if (this.mode === 'indexed') data.fill(0);
      else for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255; }
    }

    celId(layerId, f) { return this.cels[layerId + '/' + f] || null; }
    cel(layerId, f) { const id = this.celId(layerId, f); return id ? this.celData[id] : null; }
    /** Is this cel shared with another frame? */
    linked(layerId, f) {
      const id = this.celId(layerId, f); if (!id) return false;
      for (let g = 0; g < this.frames.length; g++) if (g !== f && this.cels[layerId + '/' + g] === id) return true;
      return false;
    }

    /** RGBA of one pixel of a cel's data. */
    rgbaAt(data, i, out) {
      if (this.mode === 'indexed') {
        const k = data[i];
        if (k < 0 || k >= this.palette.length) { out[0] = out[1] = out[2] = out[3] = 0; return out; }
        const c = this.palette[k]; out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = c[3]; return out;
      }
      const j = i * 4; out[0] = data[j]; out[1] = data[j + 1]; out[2] = data[j + 2]; out[3] = data[j + 3]; return out;
    }
    /** A cel as RGBA. */
    celRgba(data) {
      if (this.mode !== 'indexed') return data;
      const out = new Uint8ClampedArray(this.w * this.h * 4), pal = this.palette;
      for (let i = 0; i < data.length; i++) {
        const k = data[i]; if (k < 0 || k >= pal.length) continue;
        const c = pal[k], j = i * 4; out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; out[j + 3] = c[3];
      }
      return out;
    }

    /**
     * The frame flattened to RGBA. opts.only: one layer id; opts.hide: set of layer ids; opts.override: {layerId: data}
     * to show a layer's working data (a floating paste) instead of its cel.
     */
    composite(f, opts) {
      opts = opts || {};
      const out = new Uint8ClampedArray(this.w * this.h * 4);
      this._compositeInto(out, null, f, opts);
      if (this.mode === 'indexed' && this.indexedBlendSnap && this._needsSnap) this.snapToPalette(out);
      return out;
    }
    _compositeInto(out, parentId, f, opts) {
      if (parentId === null) this._needsSnap = false;
      for (const l of this.children(parentId)) {
        if (!l.visible && !(opts.only === l.id)) continue;
        if (opts.hide && opts.hide.has(l.id)) continue;
        if (l.kind === 'group') {
          const tmp = new Uint8ClampedArray(this.w * this.h * 4);
          this._compositeInto(tmp, l.id, f, opts);
          this._blendBuffer(out, tmp, l);
          continue;
        }
        if (opts.only && opts.only !== l.id) continue;
        let data = opts.override && opts.override[l.id];
        if (!data) { const c = this.cel(l.id, f); if (!c) continue; data = c.data; }
        this._blendBuffer(out, this.celRgba(data), l);
      }
    }
    _blendBuffer(out, src, l) {
      const op = l.opacity / 255, mode = l.blend || 'normal';
      if (mode !== 'normal' || op < 1) this._needsSnap = true;
      for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3] * op;
        if (a <= 0) continue;
        blendPixel(out, i, src[i], src[i + 1], src[i + 2], a, mode);
      }
    }
    /** Puts blended colours back onto the palette (indexed blending). */
    snapToPalette(rgba) {
      const cache = new Map(), pal = this.palette;
      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 3] === 0) continue;
        const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
        let k = cache.get(key);
        if (k === undefined) { k = DP.nearest(pal, [rgba[i], rgba[i + 1], rgba[i + 2], 255]); cache.set(key, k); }
        const c = pal[k]; rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2];
        rgba[i + 3] = rgba[i + 3] >= 128 ? 255 : 0;
      }
    }

    // ------------- structure
    addFrame(at, copyFrom) {
      at = at === undefined ? this.frames.length : at;
      const dur = copyFrom !== undefined && this.frames[copyFrom] ? this.frames[copyFrom].duration : (this.frames[at - 1] || this.frames[0] || { duration: 100 }).duration;
      this.shiftFrames(at, 1);
      this.frames.splice(at, 0, { duration: dur });
      for (const l of this.layers) {
        if (l.kind === 'group') continue;
        const src = copyFrom !== undefined ? this.celId(l.id, copyFrom >= at ? copyFrom + 1 : copyFrom) : null;
        if (src) {
          const id = DP.newId(); this.celData[id] = { data: this.celData[src].data.slice() }; this.cels[l.id + '/' + at] = id;
        } else if (l.kind === 'background') {
          const id = DP.newId(); const data = this.newData(); this.fillOpaque(data);
          this.celData[id] = { data }; this.cels[l.id + '/' + at] = id;
        }
      }
      for (const t of this.tags) { if (t.from >= at) t.from++; if (t.to >= at) t.to++; }
      return at;
    }
    /** Moves the cel keys of frames >= at by delta. */
    shiftFrames(at, delta) {
      const next = {};
      for (const k in this.cels) {
        const s = k.lastIndexOf('/'), f = +k.slice(s + 1);
        next[f >= at ? k.slice(0, s + 1) + (f + delta) : k] = this.cels[k];
      }
      this.cels = next;
    }
    removeFrame(f) {
      if (this.frames.length <= 1) return false;
      for (const l of this.layers) delete this.cels[l.id + '/' + f];
      this.shiftFrames(f + 1, -1);
      this.frames.splice(f, 1);
      this.tags = this.tags.filter((t) => !(t.from === f && t.to === f));
      for (const t of this.tags) { if (t.from > f) t.from--; if (t.to >= f) t.to--; t.to = Math.max(t.from, t.to); }
      this.gc();
      return true;
    }
    moveFrame(f, to) {
      if (to < 0 || to >= this.frames.length || to === f) return;
      const keyed = {};
      for (const l of this.layers) keyed[l.id] = this.layers.map(() => 0) && Array.from({ length: this.frames.length }, (_, g) => this.cels[l.id + '/' + g]);
      const order = this.frames.map((_, i) => i);
      order.splice(to, 0, order.splice(f, 1)[0]);
      this.frames = order.map((i) => this.frames[i]);
      this.cels = {};
      for (const id in keyed) order.forEach((src, dst) => { if (keyed[id][src]) this.cels[id + '/' + dst] = keyed[id][src]; });
    }
    removeLayer(id) {
      const l = this.layer(id); if (!l) return;
      for (const c of this.children(id)) this.removeLayer(c.id);
      for (let f = 0; f < this.frames.length; f++) delete this.cels[id + '/' + f];
      this.layers = this.layers.filter((x) => x.id !== id);
      this.gc();
    }
    /** Moves a layer one step among its siblings (+1 up, -1 down). The background stays at the bottom. */
    moveLayer(id, dir) {
      const l = this.layer(id); if (!l || l.kind === 'background') return;
      const sibs = this.children(l.parent);
      const i = sibs.indexOf(l), j = i + dir;
      if (j < 0 || j >= sibs.length || sibs[j].kind === 'background') return;
      const a = this.layers.indexOf(l), b = this.layers.indexOf(sibs[j]);
      this.layers[a] = sibs[j]; this.layers[b] = l;
    }
    duplicateLayer(id) {
      const l = this.layer(id); if (!l || l.kind === 'group') return null;
      const n = Object.assign({}, l, { id: DP.newId(), name: l.name + ' copy', kind: l.kind === 'background' ? 'layer' : l.kind });
      this.layers.splice(this.layers.indexOf(l) + 1, 0, n);
      const map = {};
      for (let f = 0; f < this.frames.length; f++) {
        const c = this.celId(id, f); if (!c) continue;
        if (!map[c]) { map[c] = DP.newId(); this.celData[map[c]] = { data: this.celData[c].data.slice() }; }
        this.cels[n.id + '/' + f] = map[c];
      }
      return n;
    }
    /** Merges a layer into the one below (same parent), every frame. */
    mergeDown(id) {
      const l = this.layer(id); if (!l || l.kind === 'group') return false;
      const sibs = this.children(l.parent), below = sibs[sibs.indexOf(l) - 1];
      if (!below || below.kind === 'group') return false;
      for (let f = 0; f < this.frames.length; f++) {
        const top = this.cel(l.id, f); if (!top) continue;
        const bid = this.celId(below.id, f);
        const base = bid ? this.celRgba(this.celData[bid].data).slice() : new Uint8ClampedArray(this.w * this.h * 4);
        if (below.opacity < 255 || below.blend !== 'normal') { /* the lower layer's own settings stay */ }
        const tmp = { opacity: l.opacity, blend: l.blend };
        this._blendBuffer(base, this.celRgba(top.data), tmp);
        const nid = DP.newId();
        this.celData[nid] = { data: this.mode === 'indexed' ? this.toIndexed(base) : base };
        this.cels[below.id + '/' + f] = nid;
      }
      this.removeLayer(l.id);
      return true;
    }
    /** RGBA to palette indices (nearest; alpha below 128 is clear). */
    toIndexed(rgba, dither) {
      const out = new Int16Array(this.w * this.h).fill(-1), cache = new Map(), pal = this.palette;
      for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
        if (rgba[i + 3] < 128) continue;
        let r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        if (dither) {
          const x = p % this.w, y = (p / this.w) | 0;
          const t = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * dither * 48;
          r = clamp(r + t, 0, 255); g = clamp(g + t, 0, 255); b = clamp(b + t, 0, 255);
        }
        const key = (r << 16) | (g << 8) | b;
        let k = cache.get(key);
        if (k === undefined) { k = DP.nearest(pal, [r, g, b, 255]); cache.set(key, k); }
        out[p] = k;
      }
      return out;
    }
    /** Switches colour mode. Converting to indexed matches every pixel to the palette (optionally dithered). */
    setMode(mode, dither) {
      if (mode === this.mode) return;
      const datas = Object.values(this.celData);
      if (mode === 'indexed') { this.mode = 'rgb'; for (const c of datas) c.data = (this.mode = 'rgb', this.toIndexed(c.data, dither)); }
      else for (const c of datas) c.data = this.celRgba(c.data);
      this.mode = mode;
    }
    /** Drops cel data nothing points at any more. */
    gc() {
      const used = new Set(Object.values(this.cels));
      for (const id in this.celData) if (!used.has(id)) delete this.celData[id];
    }
    resize(w, h, ax, ay) {
      // ax, ay: anchor 0 (left/top), 0.5 (centre), 1 (right/bottom)
      this._reframe(w, h, Math.round((w - this.w) * (ax || 0)), Math.round((h - this.h) * (ay || 0)));
    }
    /** Crops (or grows) the canvas to the rect x, y, w, h of the current canvas. */
    cropTo(x, y, w, h) { this._reframe(w, h, -x, -y); }
    /** Bounds of every drawn pixel on every cel, or null when the sprite is empty. */
    contentBounds() {
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      const idx = this.mode === 'indexed';
      for (const id in this.celData) {
        const d = this.celData[id].data;
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
          const i = y * this.w + x;
          if (idx ? d[i] < 0 : !d[i * 4 + 3]) continue;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    _reframe(w, h, ox, oy) {
      const lost = new Set(); // cels that had drawn pixels cut off
      for (const id in this.celData) {
        const src = this.celData[id].data, idx = this.mode === 'indexed';
        const dst = idx ? new Int16Array(w * h).fill(-1) : new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < this.h; y++) {
          const ny = y + oy;
          for (let x = 0; x < this.w; x++) {
            const nx = x + ox;
            if (ny < 0 || ny >= h || nx < 0 || nx >= w) { if (idx ? src[y * this.w + x] >= 0 : src[(y * this.w + x) * 4 + 3]) lost.add(id); continue; }
            if (idx) dst[ny * w + nx] = src[y * this.w + x];
            else { const a = (y * this.w + x) * 4, b = (ny * w + nx) * 4; dst[b] = src[a]; dst[b + 1] = src[a + 1]; dst[b + 2] = src[a + 2]; dst[b + 3] = src[a + 3]; }
          }
        }
        this.celData[id].data = dst;
      }
      this.w = w; this.h = h;
      const out = {};
      for (const id in this.sources) { const r = this.sources[id]; out[id] = { name: r.name, x: r.x + ox, y: r.y + oy, w: r.w, h: r.h }; if (r.cut || lost.has(id)) out[id].cut = true; }
      this.sources = out;
      if (this.pivot) this.pivot = [this.pivot[0] + ox, this.pivot[1] + oy];
    }
    /** Moves the imported-sprite rects and pivot along with the pixels (new objects, so undo snapshots stay intact). */
    mapSources(fr, fp) {
      const out = {};
      for (const id in this.sources) out[id] = fr(this.sources[id]);
      this.sources = out;
      if (this.pivot) this.pivot = fp(this.pivot);
    }
    /** Scales every cel by a whole factor (nearest neighbour). */
    scale(k) {
      const w = this.w * k, h = this.h * k, idx = this.mode === 'indexed';
      for (const id in this.celData) {
        const src = this.celData[id].data;
        const dst = idx ? new Int16Array(w * h) : new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const s = ((y / k) | 0) * this.w + ((x / k) | 0), d = y * w + x;
          if (idx) dst[d] = src[s]; else { dst[d * 4] = src[s * 4]; dst[d * 4 + 1] = src[s * 4 + 1]; dst[d * 4 + 2] = src[s * 4 + 2]; dst[d * 4 + 3] = src[s * 4 + 3]; }
        }
        this.celData[id].data = dst;
      }
      this.w = w; this.h = h;
      this.mapSources((r) => Object.assign({}, r, { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k }), (p) => [p[0] * k, p[1] * k]);
    }

    // ------------- palette edits that keep an indexed image looking the same
    /** Reorders the palette: order[newIndex] = oldIndex. */
    reorderPalette(order) {
      const inv = new Int16Array(order.length);
      order.forEach((old, i) => { inv[old] = i; });
      this.palette = order.map((i) => this.palette[i]);
      if (this.mode === 'indexed') for (const id in this.celData) {
        const d = this.celData[id].data.slice();
        for (let i = 0; i < d.length; i++) if (d[i] >= 0 && d[i] < inv.length) d[i] = inv[d[i]];
        this.celData[id].data = d;
      }
    }
    removePaletteEntries(indices) {
      const drop = new Set(indices);
      const keep = this.palette.map((_, i) => i).filter((i) => !drop.has(i));
      if (!keep.length) return;
      const remaining = keep.map((i) => this.palette[i]);
      if (this.mode === 'indexed') {
        const map = new Int16Array(this.palette.length);
        this.palette.forEach((c, i) => { map[i] = drop.has(i) ? DP.nearest(remaining, c) : keep.indexOf(i); });
        for (const id in this.celData) {
          const d = this.celData[id].data.slice();
          for (let i = 0; i < d.length; i++) if (d[i] >= 0) d[i] = d[i] < map.length ? map[d[i]] : -1;
          this.celData[id].data = d;
        }
      }
      this.palette = remaining;
    }

    // ------------- undo snapshots (cel arrays are never changed after they're committed, so refs are safe)
    snapshot() {
      const cd = {};
      for (const id in this.celData) cd[id] = this.celData[id].data;
      return {
        w: this.w, h: this.h, mode: this.mode, name: this.name,
        palette: this.palette.map((c) => c.slice()),
        layers: this.layers.map((l) => Object.assign({}, l)),
        frames: this.frames.map((f) => Object.assign({}, f)),
        cels: Object.assign({}, this.cels), celData: cd,
        tags: this.tags.map((t) => Object.assign({}, t)),
        lighting: JSON.parse(JSON.stringify(this.lighting || null)),
        grid: Object.assign({}, this.grid), indexedBlendSnap: this.indexedBlendSnap,
        sources: Object.assign({}, this.sources), pivot: this.pivot,
      };
    }
    restore(s) {
      this.w = s.w; this.h = s.h; this.mode = s.mode; this.name = s.name;
      this.palette = s.palette.map((c) => c.slice());
      this.layers = s.layers.map((l) => Object.assign({}, l));
      this.frames = s.frames.map((f) => Object.assign({}, f));
      this.cels = Object.assign({}, s.cels);
      this.celData = {};
      for (const id in s.celData) this.celData[id] = { data: s.celData[id] };
      this.tags = s.tags.map((t) => Object.assign({}, t));
      this.lighting = JSON.parse(JSON.stringify(s.lighting));
      this.grid = Object.assign({}, s.grid); this.indexedBlendSnap = s.indexedBlendSnap;
      this.sources = Object.assign({}, s.sources || {}); this.pivot = s.pivot || null;
      this.touch();
    }
  }
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  DP.BAYER4 = BAYER4;
  DP.Doc = Doc;

  /**
   * A 1 px outline around drawn pixels. vals: cel values (see Tools.getVal); mode 'outside' adds it on clear pixels
   * next to drawn ones, 'inside' recolours drawn pixels next to clear ones. eight: corners count too.
   * mask (optional): only pixels next to masked drawn pixels (outside) or masked pixels (inside) change.
   */
  DP.outline = function (vals, w, h, isClear, value, mode, eight, mask) {
    const out = vals.slice();
    const N = eight ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] : [[0, -1], [-1, 0], [1, 0], [0, 1]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, clear = isClear(vals[i]);
      if (mode === 'outside' ? !clear : clear) continue;
      if (mode === 'inside' && mask && !mask[i]) continue;
      for (const [dx, dy] of N) {
        const X = x + dx, Y = y + dy, j = Y * w + X;
        const nClear = X < 0 || Y < 0 || X >= w || Y >= h || isClear(vals[j]);
        if (mode === 'outside' ? (!nClear && (!mask || mask[j])) : nClear) { out[i] = value; break; }
      }
    }
    return out;
  };


  // ---------------------------------------------------------------- history
  /* Undo is capped by memory, not step count. Each entry lists the pixel arrays it keeps alive (`refs`).
     Cel arrays are never changed once committed and are shared between snapshots, so each array is
     counted once however many entries hold it. The oldest steps go first when the cap is passed. */
  const MB = 1024 * 1024;
  class History {
    constructor(limitMB) {
      this.undoStack = []; this.redoStack = []; this.onChange = null;
      this.held = new Map(); this.bytes = 0;
      this.limitBytes = (limitMB || 256) * MB;
    }
    get limitMB() { return this.limitBytes / MB; }
    setLimitMB(mb) { this.limitBytes = Math.max(1, +mb || 256) * MB; this.trim(); if (this.onChange) this.onChange(); }
    hold(e, d) {
      for (const a of e.refs || []) {
        if (!a || !a.byteLength) continue;
        const n = (this.held.get(a) || 0) + d;
        if (n > 0) { if (!this.held.has(a)) this.bytes += a.byteLength; this.held.set(a, n); }
        else { this.held.delete(a); this.bytes -= a.byteLength; }
      }
    }
    trim() { while (this.bytes > this.limitBytes && this.undoStack.length > 1) this.hold(this.undoStack.shift(), -1); }
    push(entry) {
      for (const e of this.redoStack) this.hold(e, -1);
      this.redoStack.length = 0;
      this.undoStack.push(entry); this.hold(entry, 1);
      this.trim();
      if (this.onChange) this.onChange();
    }
    undo() { const e = this.undoStack.pop(); if (!e) return null; e.undo(); this.redoStack.push(e); if (this.onChange) this.onChange(); return e; }
    redo() { const e = this.redoStack.pop(); if (!e) return null; e.redo(); this.undoStack.push(e); if (this.onChange) this.onChange(); return e; }
    clear() { this.undoStack.length = 0; this.redoStack.length = 0; this.held.clear(); this.bytes = 0; if (this.onChange) this.onChange(); }
  }
  DP.History = History;

  /** An undo entry that swaps whole-document snapshots, with the cel arrays it keeps alive. */
  DP.snapEntry = function (doc, label, before, after) {
    const refs = Object.values(before.celData).concat(Object.values(after.celData));
    return { label, refs, undo: () => doc.restore(before), redo: () => doc.restore(after) };
  };

  /** Runs a structural change as one undoable step (whole-document snapshot before and after). */
  DP.mutate = function (doc, history, label, fn) {
    const before = doc.snapshot();
    const result = fn();
    if (result === false) return false;
    doc.gc();
    const after = doc.snapshot();
    doc.touch();
    history.push(DP.snapEntry(doc, label, before, after));
    return result;
  };
})(typeof window !== 'undefined' ? window : globalThis);
