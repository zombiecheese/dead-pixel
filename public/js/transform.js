/* Dead Pixel: transforms that keep pixel art crisp. RotSprite (Xenowing's method): the art is enlarged 8x with
   Scale2x three times, which rounds diagonals the way an artist would, then rotated or scaled by nearest-neighbour
   sampling of that big image back at the original pixel size. Works on value arrays (packed RGBA or palette
   indices), so an indexed image stays on its palette. */
(function (root) {
  'use strict';
  const DP = root.DP || (root.DP = {});
  const X = (DP.Transform = {});

  /** Scale2x (EPX) on a value array. */
  X.scale2x = function (vals, w, h) {
    const W = w * 2, out = new vals.constructor(W * h * 2);
    const at = (x, y) => vals[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const E = at(x, y), B = at(x, y - 1), D = at(x - 1, y), F = at(x + 1, y), H = at(x, y + 1);
      let e0 = E, e1 = E, e2 = E, e3 = E;
      if (B !== H && D !== F) {
        e0 = D === B ? D : E; e1 = B === F ? F : E;
        e2 = D === H ? D : E; e3 = H === F ? F : E;
      }
      const o = y * 2 * W + x * 2;
      out[o] = e0; out[o + 1] = e1; out[o + W] = e2; out[o + W + 1] = e3;
    }
    return out;
  };
  X.scale8x = function (vals, w, h) {
    let v = vals, cw = w, ch = h;
    for (let k = 0; k < 3; k++) { v = X.scale2x(v, cw, ch); cw *= 2; ch *= 2; }
    return v;
  };

  /**
   * RotSprite: rotates (degrees, clockwise on screen) and scales a value array about (cx, cy) in pixels, into an
   * output the same size. clear: the empty value. Pixels that land outside stay clear.
   */
  X.rotsprite = function (vals, w, h, degrees, scaleX, scaleY, cx, cy, clear) {
    scaleX = scaleX || 1; scaleY = scaleY || scaleX;
    const big = X.scale8x(vals, w, h), BW = w * 8, BH = h * 8;
    const out = new vals.constructor(w * h).fill(clear);
    const a = (-degrees * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    cx = cx === undefined ? w / 2 : cx; cy = cy === undefined ? h / 2 : cy;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const sx = (dx * cos - dy * sin) / scaleX + cx, sy = (dx * sin + dy * cos) / scaleY + cy;
      const bx = Math.floor(sx * 8), by = Math.floor(sy * 8);
      if (bx < 0 || by < 0 || bx >= BW || by >= BH) continue;
      out[y * w + x] = big[by * BW + bx];
    }
    return out;
  };
  /** Nearest-neighbour scale to a new size (for whole-number scales this is exact). */
  X.nearest = function (vals, w, h, nw, nh, clear) {
    const out = new vals.constructor(nw * nh).fill(clear);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) out[y * nw + x] = vals[Math.floor((y * h) / nh) * w + Math.floor((x * w) / nw)];
    return out;
  };
  X.flipH = function (vals, w, h) { const o = new vals.constructor(vals.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = vals[y * w + (w - 1 - x)]; return o; };
  X.flipV = function (vals, w, h) { const o = new vals.constructor(vals.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = vals[(h - 1 - y) * w + x]; return o; };
  /** Rotate 90 degrees clockwise: returns {vals, w, h}. */
  X.rot90 = function (vals, w, h) { const o = new vals.constructor(vals.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[x * h + (h - 1 - y)] = vals[y * w + x]; return { vals: o, w: h, h: w }; };
})(typeof window !== 'undefined' ? window : globalThis);
