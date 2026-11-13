/* Dead Pixel: 2D lighting, matching a Unity C# runtime:
   - LightMapGenerator (LightMaps.cs): a light map per sprite, RG = surface direction, B = light mask, A = coverage,
     made the Pixel Art Lighter's way (clusters, silhouette dome + brightness height, faceted normals, outline fix,
     cavity-darkened mask). Same presets and numbers as the C#.
   - SurfaceBuffer.Facing, FxCanvas.Banded / Pool, and RoomFxSim's light pass (ambient grade, banded darkness,
     lamp pools on the multiply layer plus a glow share on the additive layer, KeepTheColours limits).
   The exported light map PNG is byte-compatible with the runtime's own light maps. */
(function (root) {
  'use strict';
  const DP = root.DP || (root.DP = {});
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const PRESETS = {
    Character: { Shape: 1.0, Bright: 0.8, Strength: 1.6, Darkest: 0.45, Lightest: 1, Cavity: 0.3, Cap: 5, Facets: 8, Body: 1.2, BodyCap: 6 },
    Object: { Shape: 0.8, Bright: 1.0, Strength: 1.5, Darkest: 0.4, Lightest: 1, Cavity: 0.4, Cap: 4, Facets: 8, Body: 0.6, BodyCap: 4 },
    Architecture: { Shape: 0.35, Bright: 1.6, Strength: 1.4, Darkest: 0.35, Lightest: 1, Cavity: 0.5, Cap: 3, Facets: 8, Body: 0, BodyCap: 0 },
  };
  const PLANES = {
    Floor: [0, 0.8, 0.6], Ceiling: [0, -0.8, 0.6], LeftWall: [0.75, 0, 0.66], RightWall: [-0.75, 0, 0.66],
  };

  function clusters(src, alpha, w, h) {
    const label = new Int32Array(w * h).fill(-1);
    const stack = [];
    let count = 0;
    for (let start = 0; start < label.length; start++) {
      if (label[start] >= 0 || !alpha[start]) continue;
      const r0 = src[start * 4], g0 = src[start * 4 + 1], b0 = src[start * 4 + 2];
      label[start] = count; stack.push(start);
      while (stack.length) {
        const i = stack.pop(), x = i % w, y = (i / w) | 0;
        for (let k = 0; k < 4; k++) {
          const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (label[j] >= 0 || !alpha[j]) continue;
          if (Math.abs(src[j * 4] - r0) + Math.abs(src[j * 4 + 1] - g0) + Math.abs(src[j * 4 + 2] - b0) > 10) continue;
          label[j] = count; stack.push(j);
        }
      }
      count++;
    }
    return { label, count };
  }
  function edgeDistance(label, alpha, w, h, cap) {
    const d = new Float32Array(w * h);
    let inside = Uint8Array.from(alpha);
    const lab = Int32Array.from(label);
    for (let k = 0; k < cap; k++) {
      const same = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!inside[i]) continue;
        const l = lab[i];
        const ok = x > 0 && x < w - 1 && y > 0 && y < h - 1 && lab[i - 1] === l && lab[i + 1] === l && lab[i - w] === l && lab[i + w] === l;
        if (ok) { same[i] = 1; d[i] += 1; }
      }
      for (let i = 0; i < same.length; i++) if (!same[i]) lab[i] = -2;
      inside = same;
    }
    return d;
  }
  function blur(a, w, h, passes) {
    let cur = Float32Array.from(a), next = new Float32Array(a.length);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const l = cur[y * w + Math.max(0, x - 1)], r = cur[y * w + Math.min(w - 1, x + 1)];
        const u = cur[Math.min(h - 1, y + 1) * w + x], dn = cur[Math.max(0, y - 1) * w + x];
        next[i] = (l + r + u + dn + 2 * cur[i]) / 6;
      }
      const t = cur; cur = next; next = t;
    }
    return cur;
  }
  function neighbour(outline, alpha, w, h, x, y) {
    if (x + 1 < w && alpha[y * w + x + 1] && !outline[y * w + x + 1]) return y * w + x + 1;
    if (x > 0 && alpha[y * w + x - 1] && !outline[y * w + x - 1]) return y * w + x - 1;
    if (y + 1 < h && alpha[(y + 1) * w + x] && !outline[(y + 1) * w + x]) return (y + 1) * w + x;
    if (y > 0 && alpha[(y - 1) * w + x] && !outline[(y - 1) * w + x]) return (y - 1) * w + x;
    return -1;
  }
  const round = (v) => Math.round(v); // Mathf.RoundToInt rounds halves to even; the difference is one level at most

  /** LightMapGenerator.Generate on pixels with row 0 at the BOTTOM (Unity's order). plane(x, y) -> [x,y,z] or null. */
  function generateBottomUp(src, w, h, presetName, plane) {
    const s = PRESETS[presetName] || PRESETS.Character;
    const n = w * h;
    const alpha = new Uint8Array(n), lum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      alpha[i] = src[i * 4 + 3] > 8 ? 1 : 0;
      lum[i] = (0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]) / 255;
    }
    const { label, count } = clusters(src, alpha, w, h);
    const dome = edgeDistance(label, alpha, w, h, s.Cap);
    const soft = blur(lum, w, h, 1);
    const height = new Float32Array(n);
    let body = null;
    if (s.Body > 0) { const cov = new Int32Array(n); for (let i = 0; i < n; i++) cov[i] = alpha[i] ? 0 : -1; body = edgeDistance(cov, alpha, w, h, s.BodyCap); }
    for (let i = 0; i < n; i++) {
      if (!alpha[i]) continue;
      let hgt = s.Shape * Math.sqrt(clamp01(dome[i] / s.Cap)) + s.Bright * soft[i];
      if (body) hgt += s.Body * Math.sqrt(clamp01(body[i] / s.BodyCap));
      height[i] = hgt;
    }
    const nx = new Float32Array(n), ny = new Float32Array(n);
    const step = (Math.PI * 2) / s.Facets;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!alpha[i]) continue;
      const gx = (height[y * w + Math.min(w - 1, x + 1)] - height[y * w + Math.max(0, x - 1)]) * 0.5;
      const gy = (height[Math.min(h - 1, y + 1) * w + x] - height[Math.max(0, y - 1) * w + x]) * 0.5;
      const vx = -gx * s.Strength, vy = -gy * s.Strength;
      let tilt = Math.sqrt(vx * vx + vy * vy);
      const a = Math.round(Math.atan2(vy, vx) / step) * step;
      tilt = tilt < 0.08 ? 0 : tilt < 0.35 ? 0.45 : 0.9;
      nx[i] = Math.cos(a) * tilt; ny[i] = Math.sin(a) * tilt;
    }
    const sumX = new Float32Array(count), sumY = new Float32Array(count), size = new Int32Array(count);
    for (let i = 0; i < n; i++) if (label[i] >= 0) { sumX[label[i]] += nx[i]; sumY[label[i]] += ny[i]; size[label[i]]++; }
    for (let i = 0; i < n; i++) {
      const c = label[i];
      if (c < 0 || size[c] >= 6) continue;
      nx[i] = sumX[c] / size[c]; ny[i] = sumY[c] / size[c];
    }
    const outline = new Uint8Array(n);
    for (let i = 0; i < n; i++) outline[i] = alpha[i] && lum[i] < 0.12 ? 1 : 0;
    for (let pass = 0; pass < 2; pass++)
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!outline[i]) continue;
        const j = neighbour(outline, alpha, w, h, x, y);
        if (j < 0) continue;
        nx[i] = nx[j]; ny[i] = ny[j]; outline[i] = 0;
      }
    const cavity = blur(lum, w, h, 3);
    const map = new Uint8ClampedArray(n * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      if (!alpha[i]) { map[o] = 128; map[o + 1] = 128; map[o + 2] = 0; map[o + 3] = 0; continue; }
      let N = [nx[i], ny[i], Math.sqrt(Math.min(1, Math.max(0.05, 1 - nx[i] * nx[i] - ny[i] * ny[i])))];
      const p = plane ? plane(x, y) : null;
      if (p) N = [p[0] + N[0] * 0.55, p[1] + N[1] * 0.55, p[2]];
      const len = Math.hypot(N[0], N[1], N[2]) || 1;
      N = [N[0] / len, N[1] / len, N[2] / len];
      let mask = s.Darkest + (s.Lightest - s.Darkest) * clamp01(lum[i] * 1.6);
      if (lum[i] < 0.15) mask -= s.Cavity * clamp01((0.15 - cavity[i]) / 0.15);
      mask = clamp01(mask);
      map[o] = round(clamp01(N[0] * 0.5 + 0.5) * 255);
      map[o + 1] = round(clamp01(N[1] * 0.5 + 0.5) * 255);
      map[o + 2] = round(mask * 255);
      map[o + 3] = 255;
    }
    return map;
  }

  function flipRows(rgba, w, h) {
    const out = new Uint8ClampedArray(rgba.length), row = w * 4;
    for (let y = 0; y < h; y++) out.set(rgba.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    return out;
  }

  /**
   * A room's planes, for the Architecture preset. spec (row 0 at the TOP, like the editor):
   *  {kind:'ground', floorLine}  everything below floorLine is floor;
   *  {kind:'box', x0, y0, x1, y1}  a one-point box: the back wall's rectangle, floor/ceiling/side walls run from its
   *  corners to the picture's corners.
   */
  function planeFn(spec, w, h) {
    if (!spec || spec.kind === 'none' || !spec.kind) return null;
    if (spec.kind === 'ground') return (x, yb) => ((h - 1 - yb) >= spec.floorLine ? PLANES.Floor : null);
    const { x0, y0, x1, y1 } = spec;
    return (x, yb) => {
      const y = h - 1 - yb, px = x + 0.5, py = y + 0.5;
      const dl = px < x0 ? (x0 - px) / Math.max(1, x0) : 0;
      const dr = px > x1 ? (px - x1) / Math.max(1, w - x1) : 0;
      const dt = py < y0 ? (y0 - py) / Math.max(1, y0) : 0;
      const db = py > y1 ? (py - y1) / Math.max(1, h - y1) : 0;
      const m = Math.max(dl, dr, dt, db);
      if (m === 0) return null;            // the back wall, square on: the art's own shapes
      if (m === db) return PLANES.Floor;
      if (m === dt) return spec.ceiling === false ? null : PLANES.Ceiling;
      if (m === dl) return PLANES.LeftWall;
      return PLANES.RightWall;
    };
  }

  /** Light map for RGBA pixels with row 0 at the top. Returns RGBA, row 0 at the top (as saved in a PNG). */
  function generate(rgba, w, h, preset, planes) {
    const bottomUp = flipRows(rgba, w, h);
    const map = generateBottomUp(bottomUp, w, h, preset, planeFn(planes, w, h));
    return flipRows(map, w, h);
  }

  // ------------------------------------------------------------------ FxCanvas
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dither = (x, y, level) => level * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5;
  const B2 = [0, 2, 3, 1];
  /**
   * How a light level is put on the pixels. 'banded' is FxCanvas.Banded (flat steps, a thin checker
   * seam where they meet); the rest are looks to try: 'smooth' (FxCanvas.Smooth), 'hard' (flat steps, no seam),
   * 'dither' (steps with a full 4x4 ordered dither between them), 'checker' (2x2 ordered dither), 'noise' (stable
   * per-pixel noise dither).
   */
  function banded(x, y, level, steps, style) {
    steps = steps || 4;
    if (style === true || style === 'smooth') return clamp01(level);
    const scaled = clamp01(level) * steps;
    let low = Math.floor(scaled);
    const f = scaled - low;
    if (style === 'hard') { if (f >= 0.5) low += 1; return Math.min(steps, low) / steps; }
    if (style === 'dither') { if (dither(x, y, f)) low += 1; return Math.min(steps, low) / steps; }
    if (style === 'checker') { if (f * 4 > B2[(y & 1) * 2 + (x & 1)] + 0.5) low += 1; return Math.min(steps, low) / steps; }
    if (style === 'noise') { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; if (f > ((n >>> 0) % 1000) / 1000) low += 1; return Math.min(steps, low) / steps; }
    const Seam = 0.2;
    if (f > 0.5 + Seam) low += 1;
    else if (f > 0.5 - Seam) {
      const t = (f - (0.5 - Seam)) / (2 * Seam);
      const lvl = t < 0.34 ? 0.25 : t < 0.67 ? 0.5 : 0.75;
      if (dither(x, y, lvl)) low += 1;
    }
    return Math.min(steps, low) / steps;
  }
  const STYLES = [['banded', 'Game: bands, dithered seams'], ['hard', 'Hard bands'], ['dither', 'Ordered dither (4x4)'], ['checker', 'Checker dither (2x2)'], ['noise', 'Noise dither'], ['smooth', 'Smooth']];

  class Layer {
    constructor(w, h, fill) { this.w = w; this.h = h; this.p = new Float32Array(w * h * 3).fill(fill); }
    mul(x, y, r, g, b) { const i = (y * this.w + x) * 3; this.p[i] *= r; this.p[i + 1] *= g; this.p[i + 2] *= b; }
    add(x, y, c, a) { const i = (y * this.w + x) * 3; this.p[i] = Math.min(1, this.p[i] + c[0] * a); this.p[i + 1] = Math.min(1, this.p[i + 1] + c[1] * a); this.p[i + 2] = Math.min(1, this.p[i + 2] + c[2] * a); }
    lift(x, y, a) { const i = (y * this.w + x) * 3; for (let k = 0; k < 3; k++) this.p[i + k] += (1 - this.p[i + k]) * clamp01(a); }
    liftTo(x, y, c, a) { const i = (y * this.w + x) * 3; const t = clamp01(a); for (let k = 0; k < 3; k++) { const d = this.p[i + k]; this.p[i + k] = Math.max(d, d + (c[k] - d) * t); } }
  }

  /** SurfaceBuffer.Facing for a light map (row 0 top). */
  function facing(map, w, x, y, lx, ly, height, strength) {
    const i = (y * w + x) * 4;
    if (!map || map[i + 3] < 128) return 1;
    const nx = map[i] / 127.5 - 1, ny = map[i + 1] / 127.5 - 1;
    const nz = Math.sqrt(Math.max(0.0025, 1 - nx * nx - ny * ny));
    const dx = lx - (x + 0.5), dy = y + 0.5 - ly, dz = Math.max(1, height);
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const ndl = Math.max(0, (nx * dx + ny * dy + nz * dz) / len);
    const lit = Math.min(1, ndl * (map[i + 2] / 255) * 1.2);
    return 1 + (lit - 1) * strength;
  }

  function pool(layer, cx, cy, radius, flatten, c, intensity, mode, map, height, strength, smooth, steps) {
    const W = layer.w, H = layer.h;
    const r = Math.ceil(radius), ry = Math.ceil(radius * flatten);
    for (let y = Math.max(0, Math.trunc(cy) - ry); y <= Math.min(H - 1, Math.trunc(cy) + ry); y++)
      for (let x = Math.max(0, Math.trunc(cx) - r); x <= Math.min(W - 1, Math.trunc(cx) + r); x++) {
        const dx = (x - cx) / radius, dy = (y - cy) / (radius * Math.max(0.05, flatten));
        const d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const f = map ? facing(map, W, x, y, cx, cy, height, strength) : 1;
        const level = banded(x, y, (1 - d) * intensity * f, steps || 5, smooth);
        if (level <= 0) continue;
        if (mode === 0) layer.add(x, y, c, level);
        else if (mode === 1) layer.lift(x, y, level);
        else if (mode === 3) layer.liftTo(x, y, c, level);
        else layer.mul(x, y, 1 + (c[0] - 1) * level, 1 + (c[1] - 1) * level, 1 + (c[2] - 1) * level);
      }
  }

  // Unity's Mathf.PerlinNoise stand-in (0..1)
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function grad(hh, x, y) { const g = hh & 3; return (g & 1 ? -x : x) + (g & 2 ? -y : y); }
  const PERM = (() => { const p = []; let s = 1337; for (let i = 0; i < 256; i++) p.push(i); for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } return p.concat(p); })();
  function perlin(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y), a = PERM[X] + Y, b = PERM[X + 1] + Y;
    const l1 = grad(PERM[a], x, y) + u * (grad(PERM[b], x - 1, y) - grad(PERM[a], x, y));
    const l2 = grad(PERM[a + 1], x, y - 1) + u * (grad(PERM[b + 1], x - 1, y - 1) - grad(PERM[a + 1], x, y - 1));
    return clamp01((l1 + v * (l2 - l1)) * 0.5 + 0.5);
  }
  function hash(name) { let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return h % 100; }
  /** RoomFxSim.FlickerAt. */
  function flickerAt(kind, name, t) {
    const seed = hash(name);
    const rep = (v, m) => v - Math.floor(v / m) * m;
    switch (kind) {
      case 'Lamp': return perlin(t * 3 + seed, 0.3) > 0.15 ? 1 : 0.55;
      case 'Fluoro': return rep(t * 0.7 + seed, 7) < 0.25 ? (rep(t * 30, 1) < 0.5 ? 0.2 : 1) : 1;
      case 'Candle': return 0.8 + 0.2 * perlin(t * 6 + seed, 1.7);
      case 'Neon': return rep(t * 0.31 + seed, 5) < 0.4 ? 0.15 : 1;
      case 'Beacon': { const toward = Math.cos(t * 0.9 + seed); return 0.25 + 0.75 * Math.pow(Math.max(0, toward), 10); }
      default: return 1;
    }
  }

  const AmbientChroma = 0.75, GlowShare = 0.35, MinLight = 0.16, MaxGlow = 0.4;
  function graded(c) {
    const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    return [0, 1, 2].map((k) => clamp01(l + (c[k] - l) * AmbientChroma));
  }
  function brightest(c) { const m = Math.max(0.001, c[0], c[1], c[2]); return [c[0] / m, c[1] / m, c[2] / m]; }

  /**
   * The light pass over RGBA art (row 0 top). settings: DP.Lighting.defaults() shape. map: the art's light
   * map (or null: lit flat). t: seconds, for flicker. view: 'lit' | 'light' (the light alone on mid grey).
   * Returns RGBA (alpha kept from the art).
   */
  function render(rgba, w, h, map, settings, t, view) {
    const S = settings, smooth = S.style || (S.smooth ? 'smooth' : 'banded'), poolSteps = S.steps || 5, darkSteps = S.steps ? Math.round(S.steps * 12 / 5) : 12, strength = S.useMap ? S.strength : 0;
    const mul = new Layer(w, h, 1), add = new Layer(w, h, 0);
    const amb = graded(S.ambient.map((v) => v / 255));
    if (amb[0] !== 1 || amb[1] !== 1 || amb[2] !== 1) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mul.mul(x, y, amb[0], amb[1], amb[2]);
    if (S.darkness > 0) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sky = S.skyFalloff ? clamp01(1 - y / (h * 0.55)) : 0;
      const level = banded(x, y, S.darkness * (0.5 + 0.5 * sky), darkSteps, smooth);
      if (level > 0) mul.mul(x, y, 1 - level * 0.78, 1 - level * 0.78, 1 - level * 0.66);
    }
    for (const L of S.lights) {
      if (L.off) continue;
      const col = L.colour.map((v) => v / 255);
      const f = L.intensity * flickerAt(L.flicker, L.name, t || 0);
      if (L.shadow) { pool(mul, L.x, L.y, L.radius, L.flatten, col, f, 2, null, 0, 0, smooth, poolSteps); continue; }
      const height = L.height >= 0 ? L.height : Math.max(12, L.radius * 0.4);
      const m = S.useMap ? map : null;
      pool(mul, L.x, L.y, L.radius, L.flatten, brightest(col), Math.min(1, f * 2.2), 3, m, height, strength, smooth, poolSteps);
      pool(add, L.x, L.y, L.radius, L.flatten, col, f * GlowShare, 0, m, height, strength, smooth, poolSteps);
    }
    // KeepTheColours
    const floor = Math.round(MinLight * 255) / 255, top = Math.min(255, Math.round(MaxGlow * 255)) / 255;
    for (let i = 0; i < mul.p.length; i += 3) {
      if (mul.p[i] < floor || mul.p[i + 1] < floor || mul.p[i + 2] < floor) for (let k = 0; k < 3; k++) mul.p[i + k] = Math.max(mul.p[i + k], floor);
      if (add.p[i] > top || add.p[i + 1] > top || add.p[i + 2] > top) for (let k = 0; k < 3; k++) add.p[i + k] = Math.min(add.p[i + k], top);
    }
    const out = new Uint8ClampedArray(w * h * 4);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const j = p * 3;
      if (view === 'light') {
        for (let k = 0; k < 3; k++) out[i + k] = (0.5 * mul.p[j + k] + add.p[j + k]) * 255;
        out[i + 3] = 255; continue;
      }
      for (let k = 0; k < 3; k++) out[i + k] = (rgba[i + k] / 255 * mul.p[j + k] + add.p[j + k]) * 255;
      out[i + 3] = rgba[i + 3];
    }
    return out;
  }

  /** Light-map views for checking a map: 'normal' (as a normal map) or 'mask' (greyscale). */
  function mapView(map, w, h, which) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < out.length; i += 4) {
      if (map[i + 3] < 128) continue;
      if (which === 'mask') { out[i] = out[i + 1] = out[i + 2] = map[i + 2]; }
      else {
        const nx = map[i] / 127.5 - 1, ny = map[i + 1] / 127.5 - 1, nz = Math.sqrt(Math.max(0.0025, 1 - nx * nx - ny * ny));
        out[i] = map[i]; out[i + 1] = map[i + 1]; out[i + 2] = (nz * 0.5 + 0.5) * 255;
      }
      out[i + 3] = 255;
    }
    return out;
  }

  function defaults() {
    return {
      preset: 'Character',
      planes: { kind: 'none', floorLine: 120, x0: 80, y0: 30, x1: 240, y1: 120, ceiling: true },
      useMap: true, strength: 1, style: 'banded', steps: 5, skyFalloff: false,
      ambient: [140, 150, 190], darkness: 0.35,
      lights: [
        { name: 'Lamp', x: 0, y: 0, radius: 60, flatten: 1, colour: [255, 191, 102], intensity: 0.6, height: -1, flicker: 'Steady', shadow: false, placed: false },
      ],
    };
  }

  /**
   * Room moods (rooms converted with mood profiles carry them in lighting.moods): one room's looks, the
   * four times of day and the alternate world (Undertow). Applying one sets the ambient colour and the darkness, switches the lamps that
   * only burn when the mood has its lamps on (light.lamp) and the lights that belong to one side (light.layer:
   * 'surface' | 'undertow'), and shows the Surface or the Undertow layers (layers named Undertow… or Surface…, with or without PowerQuest's Prop prefix).
   * Returns the mood, or null if the document has none by that name.
   */
  const UNDER = /^(Prop)?Undertow/, SURF = /^(Prop)?Surface/; // PowerQuest names a room's props PropXxx
  function applyMood(doc, name) {
    const L = doc.lighting, mood = L && (L.moods || []).find((m) => m.name === name);
    if (!mood) return null;
    L.mood = name;
    L.ambient = mood.ambient.slice(0, 3);
    L.darkness = mood.darkness;
    const under = !!mood.undertow;
    for (const l of L.lights) {
      if (l.lamp === undefined && !l.layer) continue; // a lamp the artist added: left as it is
      l.off = (l.lamp === true && !mood.lampsOn) || (l.layer === 'surface' && under) || (l.layer === 'undertow' && !under);
    }
    if ((doc.layers || []).some((l) => UNDER.test(l.name)))
      for (const l of doc.layers) {
        if (UNDER.test(l.name)) l.visible = under;
        else if (SURF.test(l.name)) l.visible = !under;
      }
    return mood;
  }
  /** A mood's weather in words (Dead Pixel doesn't draw the weather: the engine's effects layers do). */
  function weatherText(mood) {
    const w = mood && mood.weather; if (!w) return '';
    const bits = [];
    if (w.rain) bits.push('rain ' + Math.round(w.rain * 100) + '%');
    if (w.drizzle) bits.push('drizzle ' + Math.round(w.drizzle * 100) + '%');
    if (w.snow) bits.push('snow ' + Math.round(w.snow * 100) + '%');
    if (w.wind) bits.push('wind ' + (w.wind > 0 ? 'to the right ' : 'to the left ') + Math.round(Math.abs(w.wind) * 100) + '%');
    if (w.fogBanks) bits.push(w.fogBanks + (w.fogBanks === 1 ? ' fog bank' : ' fog banks'));
    if (w.leaves) bits.push(w.leaves + ' leaves or motes');
    if (w.lightningEvery) bits.push('lightning about every ' + w.lightningEvery + ' s');
    if (w.haze) bits.push('depth haze ' + Math.round(w.haze * 100) + '%');
    return bits.length ? bits.join(', ') : 'clear and still';
  }

  DP.Lighting = { STYLES, PRESETS, PLANES, generate, generateBottomUp, render, mapView, banded, defaults, flickerAt, applyMood, weatherText, FLICKERS: ['Steady', 'Lamp', 'Fluoro', 'Candle', 'Neon', 'Beacon'] };
})(typeof window !== 'undefined' ? window : globalThis);
