/* Dead Pixel: drawing. Pixel values are numbers: in RGB mode a packed 0xRRGGBBAA (0 = clear), in indexed mode a
   palette index (-1 = clear). Strokes paint on a copy of the cel and become one undo step. */
(function (root) {
  'use strict';
  const DP = root.DP || (root.DP = {});
  const T = (DP.Tools = {});

  T.pack = (c) => (((c[0] & 255) << 24) | ((c[1] & 255) << 16) | ((c[2] & 255) << 8) | (c[3] & 255)) >>> 0;
  T.unpack = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  T.CLEAR_RGB = 0;

  /** Reads/writes one cel's data as numbers. */
  T.getVal = function (doc, data, i) {
    if (doc.mode === 'indexed') return data[i];
    const j = i * 4;
    if (data[j + 3] === 0) return 0;
    return ((data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3]) >>> 0;
  };
  T.setVal = function (doc, data, i, v) {
    if (doc.mode === 'indexed') { data[i] = v; return; }
    const j = i * 4;
    data[j] = (v >>> 24) & 255; data[j + 1] = (v >>> 16) & 255; data[j + 2] = (v >>> 8) & 255; data[j + 3] = v & 255;
  };
  T.clearVal = (doc) => (doc.mode === 'indexed' ? -1 : 0);
  T.isClear = (doc, v) => (doc.mode === 'indexed' ? v < 0 : (v & 255) === 0);
  /** A value as RGBA (for luminance and display). */
  T.rgbaOf = function (doc, v) {
    if (doc.mode === 'indexed') return v >= 0 && v < doc.palette.length ? doc.palette[v] : [0, 0, 0, 0];
    return T.unpack(v);
  };

  // ------------------------------------------------------------- dither patterns ("dithering shaders")
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  T.DITHERS = {
    'checker 50%': (x, y) => ((x + y) & 1) === 0,
    'dots 25%': (x, y) => (x & 1) === 0 && (y & 1) === 0,
    'dots 75%': (x, y) => !((x & 1) === 1 && (y & 1) === 1),
    'sparse 12%': (x, y) => (x & 3) === 0 && (y & 1) === 0 && (((y >> 1) + (x >> 2)) & 1) === 0 || ((x & 3) === 2 && (y & 3) === 2),
    'crisscross': (x, y) => ((x + y) & 3) === 0 || ((x - y) & 3) === 0,
    'diagonal lines': (x, y) => ((x + y) & 3) === 0,
    'horizontal lines': (x, y) => (y & 1) === 0,
    'vertical lines': (x) => (x & 1) === 0,
    'bayer 4x4 (level)': (x, y, level) => level * 16 > B4[(y & 3) * 4 + (x & 3)] + 0.5,
  };

  // ------------------------------------------------------------- brushes
  /** Offsets for a size-n brush. */
  T.brushOffsets = function (size, shape) {
    const out = [], r = size / 2, o = Math.floor((size - 1) / 2);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (shape === 'circle' && size > 2) { const dx = x + 0.5 - r, dy = y + 0.5 - r; if (dx * dx + dy * dy > r * r + 0.3) continue; }
      out.push([x - o, y - o]);
    }
    return out;
  };

  // ------------------------------------------------------------- stroke
  /**
   * One edit of one cel. app gives: doc, selection ({mask} or null), tiled ('none'|'x'|'y'|'both'),
   * symmetry ({x, y, cx, cy}).
   */
  class Stroke {
    constructor(app, layerId, frame) {
      const doc = (this.doc = app.doc);
      this.app = app; this.layerId = layerId; this.frame = frame;
      this.key = layerId + '/' + frame;
      this.celId = doc.cels[this.key] || null;
      this.before = this.celId ? doc.celData[this.celId].data : null;
      this.data = this.before ? this.before.slice() : doc.newData();
      if (!this.celId) { this.celId = DP.newId(); doc.celData[this.celId] = { data: this.data }; doc.cels[this.key] = this.celId; this.created = true; }
      else doc.celData[this.celId].data = this.data;
      this.orig = new Map();      // first value seen at a pixel this stroke (pixel perfect, shading once)
      this.path = [];             // pixel-perfect path: [{x, y, pix:[i...]}]
      this.changed = false;
    }
    idx(x, y) {
      const d = this.doc, t = this.app.tiled;
      if (t === 'x' || t === 'both') x = ((x % d.w) + d.w) % d.w;
      if (t === 'y' || t === 'both') y = ((y % d.h) + d.h) % d.h;
      if (x < 0 || y < 0 || x >= d.w || y >= d.h) return -1;
      const i = y * d.w + x;
      const sel = this.app.selection;
      if (sel && !sel.mask[i]) return -1;
      return i;
    }
    get(i) { return T.getVal(this.doc, this.data, i); }
    set(i, v) {
      if (!this.orig.has(i)) this.orig.set(i, this.get(i));
      T.setVal(this.doc, this.data, i, v); this.changed = true;
    }
    /** Resets the working copy to the cel as it was (shape tools redraw on every move). */
    reset() {
      if (this.before) this.data.set(this.before); else this.data.fill(this.doc.mode === 'indexed' ? -1 : 0);
      this.orig.clear(); this.path.length = 0;
    }
    /** Points mirrored by the symmetry settings. */
    mirrored(x, y) {
      const s = this.app.symmetry, pts = [[x, y]];
      if (!s) return pts;
      if (s.x) pts.push([Math.round(2 * s.cx - 1 - x), y]);
      if (s.y) pts.slice().forEach(([px, py]) => pts.push([px, Math.round(2 * s.cy - 1 - py)]));
      return pts;
    }
    commit(history, label) {
      const doc = this.doc;
      if (!this.changed) {
        if (this.created) { delete doc.cels[this.key]; delete doc.celData[this.celId]; }
        else doc.celData[this.celId].data = this.before;
        return false;
      }
      const id = this.celId, key = this.key, before = this.before, after = this.data, created = this.created;
      history.push({
        label, refs: [before, after],
        undo: () => { if (created) { delete doc.cels[key]; delete doc.celData[id]; } else doc.celData[id] = { data: before }; doc.touch(); },
        redo: () => { doc.celData[id] = { data: after }; doc.cels[key] = id; doc.touch(); },
      });
      doc.touch();
      return true;
    }
    cancel() {
      const doc = this.doc;
      if (this.created) { delete doc.cels[this.key]; delete doc.celData[this.celId]; }
      else doc.celData[this.celId].data = this.before;
      doc.touch();
    }
  }
  T.Stroke = Stroke;

  /** Bresenham line points. */
  T.line = function (x0, y0, x1, y1) {
    const pts = [];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      pts.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return pts;
  };
  /** Pixels of an ellipse in a box (Zingl's algorithm). filled: horizontal spans. */
  T.ellipse = function (x0, y0, x1, y1, filled) {
    const pts = [];
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    let a = Math.abs(x1 - x0), b = Math.abs(y1 - y0), b1 = b & 1;
    let dx = 4 * (1 - a) * b * b, dy = 4 * (b1 + 1) * a * a, err = dx + dy + b1 * a * a, e2;
    y0 += (b + 1) >> 1; y1 = y0 - b1;
    a *= 8 * a; b1 = 8 * b * b;
    const span = (xa, xb, y) => { if (filled) for (let x = xa; x <= xb; x++) pts.push([x, y]); else { pts.push([xa, y]); pts.push([xb, y]); } };
    do {
      span(x0, x1, y0); span(x0, x1, y1);
      e2 = 2 * err;
      if (e2 <= dy) { y0++; y1--; err += dy += a; }
      if (e2 >= dx || 2 * err > dy) { x0++; x1--; err += dx += b1; }
    } while (x0 <= x1);
    while (y0 - y1 < b) { pts.push([x0 - 1, y0]); pts.push([x1 + 1, y0++]); pts.push([x0 - 1, y1]); pts.push([x1 + 1, y1--]); }
    return pts;
  };
  T.rect = function (x0, y0, x1, y1, filled) {
    const pts = [];
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (filled || y === y0 || y === y1 || x === x0 || x === x1) pts.push([x, y]);
    return pts;
  };

  /**
   * Paints one brush dab at a pixel (with symmetry), as the ink says. ink: {kind:'simple'|'shading'|'dither',
   * value, alt (secondary), ramp:[values] (shading, dark to light), dir (+1 lighter, -1 darker), pattern, level,
   * fillAlt}. brush: {offsets} or {custom:{w,h,vals}, ownColours}. Returns pixel indices touched.
   */
  T.dab = function (stroke, x, y, brush, ink) {
    const touched = [];
    for (const [px, py] of stroke.mirrored(x, y)) {
      if (brush.custom) {
        const c = brush.custom, ox = px - Math.floor(c.w / 2), oy = py - Math.floor(c.h / 2);
        for (let yy = 0; yy < c.h; yy++) for (let xx = 0; xx < c.w; xx++) {
          const v = c.vals[yy * c.w + xx];
          if (T.isClear(stroke.doc, v)) continue;
          const i = stroke.idx(ox + xx, oy + yy); if (i < 0) continue;
          paintPixel(stroke, i, ox + xx, oy + yy, brush.ownColours ? Object.assign({}, ink, { kind: ink.kind === 'simple' ? 'simple' : ink.kind, value: v }) : ink);
          touched.push(i);
        }
        continue;
      }
      for (const [dx, dy] of brush.offsets) {
        const i = stroke.idx(px + dx, py + dy); if (i < 0) continue;
        paintPixel(stroke, i, px + dx, py + dy, ink); touched.push(i);
      }
    }
    return touched;
  };
  function paintPixel(stroke, i, x, y, ink) {
    if (ink.kind === 'shading') {
      if (stroke.orig.has(i)) return;                // once per stroke
      const cur = stroke.get(i), ramp = ink.ramp, k = ramp.indexOf(cur);
      if (k < 0) return;
      const n = Math.max(0, Math.min(ramp.length - 1, k + ink.dir));
      if (n !== k) stroke.set(i, ramp[n]); else stroke.orig.set(i, cur);
      return;
    }
    if (ink.kind === 'dither') {
      const f = T.DITHERS[ink.pattern] || T.DITHERS['checker 50%'];
      if (f(((x % 1024) + 1024) % 1024, ((y % 1024) + 1024) % 1024, ink.level)) stroke.set(i, ink.value);
      else if (ink.fillAlt) stroke.set(i, ink.alt);
      return;
    }
    stroke.set(i, ink.value);
  }

  /**
   * Freehand: adds a point to the stroke, joined to the last. Pixel perfect (1px brushes): when the path turns an
   * L-shaped corner (a, b, c with a and c diagonal neighbours and b touching both), b is put back as it was.
   */
  T.freehand = function (stroke, x, y, brush, ink, pixelPerfect) {
    const last = stroke.path[stroke.path.length - 1];
    const pts = last ? T.line(last.x, last.y, x, y).slice(1) : [[x, y]];
    for (const [px, py] of pts) {
      const pix = T.dab(stroke, px, py, brush, ink);
      stroke.path.push({ x: px, y: py, pix });
      if (!pixelPerfect) continue;
      const p = stroke.path, n = p.length;
      if (n < 3) continue;
      const a = p[n - 3], b = p[n - 2], c = p[n - 1];
      const diag = Math.abs(a.x - c.x) === 1 && Math.abs(a.y - c.y) === 1;
      const touch = (u, v) => Math.abs(u.x - v.x) + Math.abs(u.y - v.y) === 1;
      if (diag && touch(a, b) && touch(b, c)) {
        const keep = new Set(a.pix.concat(c.pix));
        for (const i of b.pix) if (!keep.has(i) && stroke.orig.has(i)) { T.setVal(stroke.doc, stroke.data, i, stroke.orig.get(i)); stroke.orig.delete(i); }
        p.splice(n - 2, 1);
      }
    }
  };

  /** Flood fill from a pixel: contiguous (4-way) or every matching pixel. Respects the selection and tiled wrap. */
  T.fill = function (stroke, x, y, ink, contiguous) {
    const doc = stroke.doc, start = stroke.idx(x, y);
    if (start < 0) return;
    const target = stroke.get(start);
    const w = doc.w, h = doc.h, sel = stroke.app.selection;
    const seen = new Uint8Array(w * h);
    const hits = [];
    if (!contiguous) {
      for (let i = 0; i < w * h; i++) if ((!sel || sel.mask[i]) && stroke.get(i) === target) hits.push(i);
    } else {
      const stack = [start]; seen[start] = 1;
      const wrapX = stroke.app.tiled === 'x' || stroke.app.tiled === 'both', wrapY = stroke.app.tiled === 'y' || stroke.app.tiled === 'both';
      while (stack.length) {
        const i = stack.pop(); hits.push(i);
        const cx = i % w, cy = (i / w) | 0;
        const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (let [nx, ny] of nb) {
          if (wrapX) nx = (nx + w) % w; if (wrapY) ny = (ny + h) % h;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (seen[j] || (sel && !sel.mask[j]) || stroke.get(j) !== target) continue;
          seen[j] = 1; stack.push(j);
        }
      }
    }
    for (const i of hits) paintPixel(stroke, i, i % w, (i / w) | 0, ink);
    return hits;
  };

  /** The region a gradient fills: the selection, else the contiguous colour under the start. */
  T.region = function (app, layerData, x, y) {
    const doc = app.doc, n = doc.w * doc.h;
    if (app.selection) return app.selection.mask;
    const mask = new Uint8Array(n);
    if (x < 0 || y < 0 || x >= doc.w || y >= doc.h) return mask;
    const target = T.getVal(doc, layerData, y * doc.w + x);
    const stack = [y * doc.w + x]; mask[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop(), cx = i % doc.w, cy = (i / doc.w) | 0;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= doc.w || ny >= doc.h) continue;
        const j = ny * doc.w + nx;
        if (mask[j] || T.getVal(doc, layerData, j) !== target) continue;
        mask[j] = 1; stack.push(j);
      }
    }
    return mask;
  };
  /** A banded gradient from (x0,y0) to (x1,y1) over a mask, in steps of the given values; dither 0..1 between bands. */
  T.gradient = function (stroke, mask, x0, y0, x1, y1, values, dither, radial) {
    const doc = stroke.doc, w = doc.w, n = values.length;
    const dx = x1 - x0, dy = y1 - y0, len2 = Math.max(1, dx * dx + dy * dy), len = Math.sqrt(len2);
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const x = i % w, y = (i / w) | 0;
      let t = radial ? Math.hypot(x + 0.5 - x0, y + 0.5 - y0) / len : ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / len2;
      t = Math.max(0, Math.min(1, t)) * (n - 1);
      let k = Math.floor(t);
      const f = t - k;
      if (dither > 0) { if (f > 0.5 - dither / 2 && B4[(y & 3) * 4 + (x & 3)] / 16 < (f - (0.5 - dither / 2)) / Math.max(0.001, dither)) k++; }
      else if (f >= 0.5) k++;
      const j = stroke.idx(x, y); if (j < 0) continue;
      stroke.set(j, values[Math.min(n - 1, k)]);
    }
  };

  // ------------------------------------------------------------- selections
  T.selectRect = function (doc, x0, y0, x1, y1, base, op) {
    const mask = base && op !== 'replace' ? base.slice() : new Uint8Array(doc.w * doc.h);
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0];
    for (let y = Math.max(0, y0); y <= Math.min(doc.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(doc.w - 1, x1); x++) mask[y * doc.w + x] = op === 'subtract' ? 0 : 1;
    return mask;
  };
  T.selectPolygon = function (doc, pts, base, op) {
    const mask = base && op !== 'replace' ? base.slice() : new Uint8Array(doc.w * doc.h);
    for (let y = 0; y < doc.h; y++) for (let x = 0; x < doc.w; x++) {
      let inside = false; const px = x + 0.5, py = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
      }
      if (inside) mask[y * doc.w + x] = op === 'subtract' ? 0 : 1;
    }
    return mask;
  };
  T.selectWand = function (doc, data, x, y, base, op, contiguous) {
    const mask = base && op !== 'replace' ? base.slice() : new Uint8Array(doc.w * doc.h);
    if (x < 0 || y < 0 || x >= doc.w || y >= doc.h) return mask;
    const target = T.getVal(doc, data, y * doc.w + x), set = op === 'subtract' ? 0 : 1;
    if (!contiguous) { for (let i = 0; i < doc.w * doc.h; i++) if (T.getVal(doc, data, i) === target) mask[i] = set; return mask; }
    const seen = new Uint8Array(doc.w * doc.h), stack = [y * doc.w + x]; seen[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop(); mask[i] = set;
      const cx = i % doc.w, cy = (i / doc.w) | 0;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= doc.w || ny >= doc.h) continue;
        const j = ny * doc.w + nx;
        if (seen[j] || T.getVal(doc, data, j) !== target) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    return mask;
  };
  T.maskBounds = function (doc, mask) {
    let x0 = doc.w, y0 = doc.h, x1 = -1, y1 = -1;
    for (let i = 0; i < mask.length; i++) if (mask[i]) { const x = i % doc.w, y = (i / doc.w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  /** Copies the selected pixels of a cel: {w, h, x, y, vals} (unselected pixels clear). */
  T.copy = function (doc, data, mask) {
    const b = mask ? T.maskBounds(doc, mask) : { x: 0, y: 0, w: doc.w, h: doc.h };
    if (!b) return null;
    const vals = (doc.mode === 'indexed' ? new Int32Array(b.w * b.h).fill(-1) : new Uint32Array(b.w * b.h));
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const i = (b.y + y) * doc.w + b.x + x;
      if (mask && !mask[i]) continue;
      vals[y * b.w + x] = data ? T.getVal(doc, data, i) : T.clearVal(doc);
    }
    return { w: b.w, h: b.h, x: b.x, y: b.y, vals, mode: doc.mode, palette: doc.palette.map((c) => c.slice()) };
  };
  /** Clip values converted to another document's colour mode. */
  T.convertClip = function (doc, clip) {
    if (clip.mode === doc.mode) return clip;
    const vals = doc.mode === 'indexed' ? new Int32Array(clip.vals.length).fill(-1) : new Uint32Array(clip.vals.length);
    for (let i = 0; i < vals.length; i++) {
      const v = clip.vals[i];
      if (clip.mode === 'indexed') { if (v >= 0) vals[i] = T.pack(clip.palette[v] || [0, 0, 0, 0]); }
      else if ((v & 255) >= 128) vals[i] = DP.nearest(doc.palette, T.unpack(v));
    }
    return Object.assign({}, clip, { vals, mode: doc.mode });
  };
})(typeof window !== 'undefined' ? window : globalThis);
