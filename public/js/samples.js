/* Dead Pixel: sample projects, drawn in code so they ship with the app and show off its features. Each one is a
   normal document; doc.view holds hints the editor applies when it opens a sample (tiled mode, onion skin, the
   lighting preview, the tag to loop, brushes). Open them from File > Samples. */
(function (root) {
  'use strict';
  const DP = root.DP || (root.DP = {});
  const T = DP.Tools;
  const S = (DP.Samples = {});

  // ------------------------------------------------------------------ drawing helpers
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /** A document helper bound to one doc. */
  function kit(d) {
    const val = (hex) => {
      const c = DP.hexToRgba(hex);
      if (d.mode !== 'indexed') return T.pack(c);
      let k = d.palette.findIndex((p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]);
      if (k < 0) { d.palette.push(c); k = d.palette.length - 1; }
      return k;
    };
    const data = (layer, f) => {
      const key = layer.id + '/' + f;
      let id = d.cels[key];
      if (!id) { id = DP.newId(); d.celData[id] = { data: d.newData() }; d.cels[key] = id; }
      return d.celData[id].data;
    };
    const put = (layer, f, pts, hex) => {
      const a = data(layer, f), v = typeof hex === 'number' ? hex : val(hex);
      for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < d.w && y < d.h) T.setVal(d, a, y * d.w + x, v);
    };
    const mask = (m) => { const pts = []; for (let i = 0; i < m.length; i++) if (m[i]) pts.push([i % d.w, (i / d.w) | 0]); return pts; };
    return {
      val, data, put,
      rect: (l, f, x0, y0, x1, y1, hex) => put(l, f, T.rect(x0, y0, x1, y1, true), hex),
      box: (l, f, x0, y0, x1, y1, hex) => put(l, f, T.rect(x0, y0, x1, y1, false), hex),
      ell: (l, f, x0, y0, x1, y1, hex) => put(l, f, T.ellipse(x0, y0, x1, y1, true), hex),
      ring: (l, f, x0, y0, x1, y1, hex) => put(l, f, T.ellipse(x0, y0, x1, y1, false), hex),
      line: (l, f, x0, y0, x1, y1, hex) => put(l, f, T.line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)), hex),
      poly: (l, f, pts, hex) => put(l, f, mask(T.selectPolygon(d, pts, null, 'replace')), hex),
      px: (l, f, x, y, hex) => put(l, f, [[x, y]], hex),
      /** Copies frame a's cel of a layer to frame b (a real copy). */
      copy: (l, a, b) => { const src = data(l, a); const dst = data(l, b); dst.set(src); },
      /** Points frames at one shared cel: a linked cel. */
      link: (l, from, to) => { const id = d.cels[l.id + '/' + from]; for (let f = from + 1; f <= to; f++) d.cels[l.id + '/' + f] = id; },
    };
  }
  function frames(d, n, ms) { d.frames = Array.from({ length: n }, () => ({ duration: ms })); }

  // ------------------------------------------------------------------ 1. walk cycle
  /** A side-on teenager walking: indexed palette, a group of body-part layers, a multiply shadow, Walk and Idle tags. */
  S.walk = function () {
    const d = new DP.Doc(32, 48, 'indexed');
    d.name = 'walk-cycle';
    d.palette = ['#16131c', '#2b2533', '#4a3b4f', '#a8664b', '#e0a07a', '#f2c8a0', '#141018', '#3a3348', '#1f2a4f', '#2f3f72', '#4a62a8', '#26314a', '#3a4a6a', '#56688c', '#2b2b2b', '#cfcfcf', '#7a7a8a', '#d23b3b'].map(DP.hexToRgba);
    const k = kit(d);
    const shadow = d.addLayer('Shadow', 'layer', { blend: 'multiply', opacity: 150 });
    const g = d.addLayer('Kid', 'group');
    const backLeg = d.addLayer('Back leg', 'layer', { parent: g.id });
    const backArm = d.addLayer('Back arm', 'layer', { parent: g.id });
    const body = d.addLayer('Body', 'layer', { parent: g.id });
    const head = d.addLayer('Head', 'layer', { parent: g.id });
    const frontLeg = d.addLayer('Front leg', 'layer', { parent: g.id });
    const frontArm = d.addLayer('Front arm', 'layer', { parent: g.id });
    const badge = d.addLayer('Badge (linked)', 'layer', { parent: g.id });
    frames(d, 12, 110);
    const stride = [5, 3, 0, -3, -5, -3, 0, 3];
    const lift = [0, 0, 2, 1, 0, 0, 0, 0];      // the front foot lifts as it passes under the body
    const liftB = [0, 0, 0, 0, 0, 0, 2, 1];
    const bob = [0, -1, -1, 0, 0, -1, -1, 0];
    const drawLeg = (layer, f, hipX, hipY, footX, footY, dark) => {
      const col = dark ? '#26314a' : '#3a4a6a', hi = dark ? '#3a4a6a' : '#56688c';
      const kneeX = Math.round((hipX + footX) / 2 + (footX > hipX ? -1 : 1) * 0), kneeY = Math.round((hipY + footY) / 2);
      for (const dx of [0, 1, 2]) { k.line(layer, f, hipX + dx, hipY, kneeX + dx, kneeY, col); k.line(layer, f, kneeX + dx, kneeY, footX + dx, footY - 2, col); }
      k.line(layer, f, hipX + 2, hipY, kneeX + 2, kneeY, hi);
      k.rect(layer, f, footX - 1, footY - 1, footX + 4, footY, dark ? '#16131c' : '#2b2b2b');
      k.px(layer, f, footX + 4, footY, '#cfcfcf');
    };
    const drawArm = (layer, f, sx, sy, hx, hy, dark) => {
      const col = dark ? '#1f2a4f' : '#2f3f72';
      for (const dx of [0, 1]) k.line(layer, f, sx + dx, sy, hx + dx, hy, col);
      k.rect(layer, f, hx, hy, hx + 1, hy + 1, dark ? '#a8664b' : '#e0a07a');
    };
    const drawUpper = (f, by) => {
      // hoodie
      k.ell(body, f, 10, 18 + by, 21, 34 + by, '#2f3f72');
      k.rect(body, f, 10, 24 + by, 21, 33 + by, '#2f3f72');
      k.rect(body, f, 18, 21 + by, 20, 32 + by, '#4a62a8');
      k.rect(body, f, 10, 28 + by, 12, 33 + by, '#1f2a4f');
      k.line(body, f, 11, 33 + by, 20, 33 + by, '#1f2a4f');
      k.rect(body, f, 10, 34 + by, 21, 34 + by, '#26314a');
      // head: black hair swept over one eye
      k.ell(head, f, 11, 5 + by, 21, 17 + by, '#e0a07a');
      k.rect(head, f, 19, 10 + by, 21, 15 + by, '#f2c8a0');
      k.ell(head, f, 9, 3 + by, 20, 13 + by, '#141018');
      k.rect(head, f, 9, 8 + by, 13, 18 + by, '#141018');
      k.line(head, f, 19, 6 + by, 22, 11 + by, '#141018');
      k.line(head, f, 14, 5 + by, 18, 5 + by, '#3a3348');
      k.px(head, f, 21, 15 + by, '#a8664b');
      k.rect(head, f, 14, 17 + by, 18, 18 + by, '#a8664b');
    };
    for (let f = 0; f < 8; f++) {
      const by = bob[f];
      k.ell(shadow, f, 7, 44, 25, 47, '#7a7a8a');
      drawLeg(backLeg, f, 14, 33 + by, 14 - stride[f], 45 - liftB[f], true);
      drawArm(backArm, f, 13, 22 + by, 13 + Math.round(stride[f] * 0.7), 31 + by, true);
      drawUpper(f, by);
      drawLeg(frontLeg, f, 15, 33 + by, 14 + stride[f], 45 - lift[f], false);
      drawArm(frontArm, f, 15, 22 + by, 15 - Math.round(stride[f] * 0.8), 31 + by, false);
    }
    // Idle: four frames, breathing, played ping-pong
    for (let i = 0; i < 4; i++) {
      const f = 8 + i, by = [0, 0, -1, -1][i];
      d.frames[f].duration = 220;
      k.ell(shadow, f, 7, 44, 25, 47, '#7a7a8a');
      drawLeg(backLeg, f, 13, 33, 12, 45, true);
      drawArm(backArm, f, 13, 22 + by, 12, 31, true);
      drawUpper(f, by);
      drawLeg(frontLeg, f, 16, 33, 17, 45, false);
      drawArm(frontArm, f, 15, 22 + by, 16, 31 + by, false);
    }
    // A patch on the hoodie: drawn once, linked across all the walk frames (edit one, they all change)
    k.rect(badge, 0, 16, 26, 17, 27, '#d23b3b');
    k.link(badge, 0, 7);
    d.tags.push({ name: 'Walk', from: 0, to: 7, colour: '#ffbf66', dir: 'forward' }, { name: 'Idle', from: 8, to: 11, colour: '#7fd3a0', dir: 'pingpong' });
    d.lighting.preset = 'Character';
    d.lighting.ambient = [150, 150, 190]; d.lighting.darkness = 0.4;
    d.lighting.lights = [{ name: 'Street lamp', x: 28, y: 4, radius: 46, flatten: 1, colour: [255, 191, 102], intensity: 0.7, height: -1, flicker: 'Steady', shadow: false, placed: true }];
    d.view = { onion: true, loopTag: 0, preview: true, note: 'Indexed: double-click a hoodie swatch and recolour it; every frame changes. The red patch is a linked cel.' };
    d.gc();
    return d;
  };

  // ------------------------------------------------------------------ 2. lit room
  /** A bedroom at night at 320×180, lit by the lighting: room planes, a flickering lamp, a TV, moonlight. */
  S.room = function () {
    const W = 320, H = 180, d = new DP.Doc(W, H, 'rgb');
    d.name = 'lit-room';
    d.palette = DP.allPresets()['Room: Bedroom'] ? DP.allPresets()['Room: Bedroom'].map((c) => c.slice()) : DP.PRESETS.DB32.map((c) => c.slice());
    const k = kit(d), r = rng(7);
    const bg = d.addLayer('Room', 'background');
    const props = d.addLayer('Furniture', 'group');
    const bed = d.addLayer('Bed and desk', 'layer', { parent: props.id });
    const tv = d.addLayer('TV', 'layer', { parent: props.id });
    const screen = d.addLayer('TV static', 'layer', { parent: props.id });
    const fan = d.addLayer('Ceiling fan (RotSprite)', 'layer');
    const glow = d.addLayer('Window glow', 'layer', { blend: 'screen', opacity: 110 });
    frames(d, 4, 90);
    const bx0 = 70, by0 = 34, bx1 = 250, by1 = 120;      // the back wall
    const drawRoom = (f) => {
      k.rect(bg, f, 0, 0, W - 1, H - 1, '#252740');
      k.poly(bg, f, [[0, 0], [W, 0], [bx1, by0], [bx0, by0]], '#1b1a2c');                 // ceiling
      k.poly(bg, f, [[0, 0], [bx0, by0], [bx0, by1], [0, H]], '#2e3a68');                 // left wall
      k.poly(bg, f, [[W, 0], [W, H], [bx1, by1], [bx1, by0]], '#2a3460');                 // right wall
      k.rect(bg, f, bx0, by0, bx1, by1, '#343f71');                                       // back wall
      k.poly(bg, f, [[0, H], [bx0, by1], [bx1, by1], [W, H]], '#4d382e');                 // floor
      for (let i = -6; i <= 6; i++) k.line(bg, f, 160 + i * 15, by1, 160 + i * 52, H, '#3e2c24');   // boards run to the vanishing point
      for (const y of [128, 140, 156]) k.line(bg, f, 0, y, W, y, '#3e2c24');
      k.poly(bg, f, [[0, H], [bx0, by1], [bx0, by1 + 2], [0, H]], '#5c4e33');
      k.line(bg, f, bx0, by1, bx1, by1, '#252740');                                       // skirting
      k.line(bg, f, bx0, by0, bx1, by0, '#252740');
      k.line(bg, f, 0, 0, bx0, by0, '#252740'); k.line(bg, f, W - 1, 0, bx1, by0, '#252740');
      k.line(bg, f, 0, H - 1, bx0, by1, '#252740'); k.line(bg, f, W - 1, H - 1, bx1, by1, '#252740');
      // window with the night and the moon
      k.rect(bg, f, 104, 48, 152, 88, '#0e2e74');
      k.ell(bg, f, 134, 54, 143, 63, '#e0edff');
      k.ell(bg, f, 137, 53, 145, 61, '#0e2e74');
      for (const [x, y] of [[110, 52], [118, 70], [146, 80], [125, 58], [112, 82]]) k.px(bg, f, x, y, '#a0a9bb');
      k.box(bg, f, 103, 47, 153, 89, '#c4c8bd'); k.line(bg, f, 128, 47, 128, 89, '#c4c8bd'); k.line(bg, f, 103, 68, 153, 68, '#c4c8bd');
      // poster
      k.rect(bg, f, 176, 46, 200, 78, '#4f1d24'); k.rect(bg, f, 179, 50, 197, 66, '#a8a33b'); k.rect(bg, f, 181, 69, 195, 71, '#c6cac1');
    };
    for (let f = 0; f < 4; f++) {
      drawRoom(f);
      // bed on the left, desk with lamp at the back
      k.poly(bed, f, [[20, 150], [96, 128], [96, 140], [24, 168]], '#5c4e33');
      k.poly(bed, f, [[20, 136], [96, 116], [96, 128], [20, 150]], '#bbbfb4');
      k.poly(bed, f, [[40, 140], [96, 120], [96, 130], [44, 152]], '#265bcd');
      k.rect(bed, f, 196, 92, 238, 96, '#7e752e'); k.rect(bed, f, 198, 97, 200, 118, '#5c4e33'); k.rect(bed, f, 234, 97, 236, 118, '#5c4e33');
      k.rect(bed, f, 222, 84, 224, 91, '#2f242c'); k.poly(bed, f, [[216, 84], [230, 84], [227, 76], [219, 76]], '#e0edff');
      // TV on a crate, right
      k.rect(tv, f, 262, 134, 300, 156, '#4d382e');
      k.rect(tv, f, 264, 108, 298, 134, '#2c2128'); k.box(tv, f, 264, 108, 298, 134, '#0f0c13');
      k.line(tv, f, 276, 108, 270, 100, '#9098ab'); k.line(tv, f, 286, 108, 292, 100, '#9098ab');
      // static: a fresh scatter each frame (4-frame loop, tagged)
      for (let y = 112; y <= 130; y++) for (let x = 268; x <= 294; x++) {
        const v = r();
        k.px(screen, f, x, y, v < 0.35 ? '#9098ab' : v < 0.7 ? '#c6cac1' : v < 0.85 ? '#e0edff' : '#303b6b');
      }
    }
    // ceiling fan: one drawing, turned with RotSprite for each frame (a quarter turn repeats, so 4 frames loop)
    const fw = 40, blade = new Uint32Array(fw * fw);
    const bk = (x0, y0, x1, y1, hex) => { const v = T.pack(DP.hexToRgba(hex)); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blade[y * fw + x] = v; };
    bk(2, 18, 37, 21, '#9098ab'); bk(18, 2, 21, 37, '#9098ab'); bk(2, 18, 37, 18, '#c6cac1'); bk(18, 2, 18, 37, '#c6cac1'); bk(16, 16, 23, 23, '#2f242c');
    for (let f = 0; f < 4; f++) {
      const turned = DP.Transform.rotsprite(blade, fw, fw, f * 22.5, 1, 1, fw / 2, fw / 2, 0);
      const a = k.data(fan, f);
      for (let y = 0; y < fw; y++) for (let x = 0; x < fw; x++) {
        const v = turned[y * fw + x]; if (!v) continue;
        const X = 140 + x, Y = 6 + Math.round(y * 0.45);                                  // squashed: seen from below at an angle
        if (X < W && Y < H) T.setVal(d, a, Y * W + X, v);
      }
      k.line(fan, f, 160, 0, 160, 14, '#2f242c');
    }
    // moonlight on the floor through the window, on a screen-blend layer
    k.link(glow, 0, 0);
    k.poly(glow, 0, [[104, 128], [152, 128], [176, 160], [96, 160]], '#3a467d');
    k.link(glow, 0, 3);
    d.tags.push({ name: 'TV static', from: 0, to: 3, colour: '#9d8bff', dir: 'forward' });
    const L = d.lighting;
    L.preset = 'Architecture'; L.planes = { kind: 'box', floorLine: 120, x0: bx0, y0: by0, x1: bx1, y1: by1, ceiling: true };
    L.ambient = [110, 120, 190]; L.darkness = 0.62; L.skyFalloff = false;
    L.lights = [
      { name: 'Desk lamp', x: 223, y: 86, radius: 90, flatten: 0.8, colour: [255, 191, 102], intensity: 0.75, height: -1, flicker: 'Lamp', shadow: false, placed: true },
      { name: 'TV', x: 281, y: 121, radius: 70, flatten: 0.7, colour: [170, 200, 255], intensity: 0.55, height: 20, flicker: 'Fluoro', shadow: false, placed: true },
      { name: 'Moonlight', x: 128, y: 120, radius: 60, flatten: 0.45, colour: [150, 170, 255], intensity: 0.4, height: 40, flicker: 'Steady', shadow: false, placed: true },
      { name: 'Under the bed', x: 60, y: 160, radius: 40, flatten: 0.35, colour: [40, 30, 60], intensity: 0.6, height: -1, flicker: 'Steady', shadow: true, placed: true },
    ];
    d.view = { preview: true, lightPreview: true, loopTag: 0, note: 'Lighting: Light panel > Render style, and drag lamps with the light tool (K).' };
    d.gc();
    return d;
  };

  // ------------------------------------------------------------------ 3. seamless tile
  /** A 32x32 brick tile that repeats: tiled mode on, mortar shaded with a dither pattern, moss in multiply, a brush. */
  S.tile = function () {
    const d = new DP.Doc(32, 32, 'rgb');
    d.name = 'brick-tile';
    d.palette = ['#1e1a22', '#3b2a2a', '#5a3530', '#7b4433', '#9b5a3c', '#b8764e', '#8a8478', '#a7a294', '#c9c3b2', '#3f5a32', '#5f7f3e', '#2a2430'].map(DP.hexToRgba);
    const k = kit(d), r = rng(3);
    const mortar = d.addLayer('Mortar', 'layer');
    const bricks = d.addLayer('Bricks', 'layer');
    const moss = d.addLayer('Moss', 'layer', { blend: 'multiply', opacity: 200 });
    // mortar with a crisscross dither shading (the "dithering shader")
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) k.px(mortar, 0, x, y, T.DITHERS.crisscross(x, y) ? '#8a8478' : '#a7a294');
    // two rows of bricks, offset; the half bricks wrap across the edge so it tiles
    const brick = (x0, y0, w) => {
      const tone = ['#7b4433', '#9b5a3c', '#5a3530'][(r() * 3) | 0];
      for (let y = y0 + 1; y < y0 + 15; y++) for (let x = x0 + 1; x < x0 + w; x++) k.px(bricks, 0, (x + 32) % 32, y, tone);
      for (let x = x0 + 1; x < x0 + w; x++) k.px(bricks, 0, (x + 32) % 32, y0 + 1, '#b8764e');
      for (let y = y0 + 1; y < y0 + 15; y++) k.px(bricks, 0, (x0 + w - 1 + 32) % 32, y, '#3b2a2a');
      for (let x = x0 + 1; x < x0 + w; x++) k.px(bricks, 0, (x + 32) % 32, y0 + 14, '#3b2a2a');
      for (let i = 0; i < 3; i++) k.px(bricks, 0, (x0 + 3 + ((r() * (w - 5)) | 0)) % 32, y0 + 4 + ((r() * 8) | 0), '#3b2a2a');
    };
    brick(0, 0, 16); brick(16, 0, 16); brick(-8, 16, 16); brick(8, 16, 16); brick(24, 16, 16);
    // moss creeping along the mortar lines
    for (let x = 0; x < 32; x++) if (r() < 0.6) k.px(moss, 0, x, 15 + ((r() * 2) | 0), '#5f7f3e');
    for (let x = 0; x < 32; x += 1) if (r() < 0.35) k.px(moss, 0, x, 31, '#3f5a32');
    d.grid = { w: 32, h: 32, show: true };
    d.lighting.preset = 'Architecture'; d.lighting.darkness = 0.2;
    d.lighting.lights = [{ name: 'Torch', x: 6, y: 6, radius: 40, flatten: 1, colour: [255, 200, 140], intensity: 0.6, height: 12, flicker: 'Candle', shadow: false, placed: true }];
    // a rivet brush to stamp with
    const rivet = { w: 3, h: 3, x: 0, y: 0, mode: 'rgb', palette: [], vals: new Uint32Array([0, T.pack([201, 195, 178, 255]), 0, T.pack([201, 195, 178, 255]), T.pack([138, 132, 120, 255]), T.pack([42, 36, 48, 255]), 0, T.pack([42, 36, 48, 255]), 0]) };
    d.view = { tiled: 'both', tileGrid: true, brushes: [rivet], note: 'Tiled mode is on: draw across an edge and it wraps. A rivet brush is in the Brushes panel.' };
    d.gc();
    return d;
  };

  // ------------------------------------------------------------------ 4. portal pulse
  /** The Pit's portal: a crack in the rock, purple growth pulsing (ping-pong), green ooze dripping, a screen-blend glow. */
  S.portal = function () {
    const W = 64, H = 64, d = new DP.Doc(W, H, 'rgb');
    d.name = 'portal-pulse';
    d.palette = ['#0d0b10', '#1b1820', '#2a2530', '#3b3542', '#4e4757', '#3a1f4f', '#5b2d7a', '#8a44b0', '#b874d8', '#e2b4ff', '#1f5a2a', '#3fae4a', '#9cf27a', '#e8ffd0'].map(DP.hexToRgba);
    const k = kit(d), r = rng(11);
    const rock = d.addLayer('Rock', 'background');
    const crack = d.addLayer('Crack', 'layer');
    const growth = d.addLayer('Growth', 'layer');
    const ooze = d.addLayer('Ooze', 'layer');
    const glow = d.addLayer('Glow', 'layer', { blend: 'screen', opacity: 140 });
    frames(d, 8, 100);
    // distance to the crack's centre line, used by the rock, the crack and the growth
    const path = [[31, 2], [34, 11], [29, 20], [35, 29], [30, 38], [34, 47], [29, 55], [32, 63]];
    const segDist = (x, y) => {
      let best = 1e9, by = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, ay] = path[i], [bx, bym] = path[i + 1], dx = bx - ax, dy = bym - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
        const ex = x - (ax + dx * t), ey = y - (ay + dy * t), dd = Math.hypot(ex, ey);
        if (dd < best) { best = dd; by = ay + dy * t; }
      }
      return [best, by];
    };
    const noise = (x, y) => Math.sin(x * 0.9 + y * 0.31) * 0.5 + Math.sin(x * 0.27 - y * 0.83) * 0.7 + Math.sin((x + y) * 0.55) * 0.4;
    // rock: layered strata with lit top edges and dark seams, drawn once and linked to every frame
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const band = Math.floor((y + noise(x, 0) * 2.2 + x * 0.12) / 7);
      const edge = ((y + noise(x, 0) * 2.2 + x * 0.12) % 7 + 7) % 7;
      const shade = ['#3b3542', '#2a2530', '#4e4757', '#2a2530', '#3b3542'][band % 5];
      k.px(rock, 0, x, y, edge < 1 ? '#5f5868' : edge > 6 ? '#1b1820' : shade);
    }
    for (let i = 0; i < 18; i++) { const x = (r() * W) | 0, y = (r() * H) | 0, s = 2 + ((r() * 4) | 0); k.ell(rock, 0, x, y, x + s + 2, y + s, '#1b1820'); k.line(rock, 0, x + 1, y, x + s + 1, y, '#5f5868'); }
    k.link(rock, 0, 7);
    // the crack: a jagged opening, widest in the middle, a dark void with a faint purple depth
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [dd, py] = segDist(x, y), w = 1 + 3.2 * Math.sin(Math.PI * py / H);
      if (dd < w) k.px(crack, 0, x, y, dd < w - 1.5 ? '#0d0b10' : '#1b1020');
      else if (dd < w + 1 && x > 32) k.px(crack, 0, x, y, '#5f5868');
    }
    k.link(crack, 0, 7);
    // tendrils: branching random walks out of the crack, fixed paths that grow longer with the pulse
    const tendrils = [];
    for (let i = 0; i < 14; i++) {
      const sy = 6 + ((r() * 52) | 0), side = i % 2 ? 1 : -1, pts = [];
      let x = 32 + side * 3, y = sy, ang = (side > 0 ? 0 : Math.PI) + (r() - 0.5) * 1.2;
      for (let n = 0; n < 26; n++) { pts.push([Math.round(x), Math.round(y)]); ang += (r() - 0.5) * 0.7; x += Math.cos(ang); y += Math.sin(ang) * 0.8; }
      tendrils.push(pts);
    }
    const pulse = [0, 1, 2, 3, 4, 3, 2, 1];
    for (let f = 0; f < 8; f++) {
      const p = pulse[f];
      // growth: a fungal mat around the crack, lobed edge, growth rings inside, breathing with the pulse
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const [dd, py] = segDist(x, y), w = 1 + 3.2 * Math.sin(Math.PI * py / H);
        const reach = w + 4 + p * 0.8 + noise(x * 1.3, y * 1.1) * 2.2 + 3 * Math.sin(Math.PI * py / H);
        if (dd < w - 0.5 || dd > reach) continue;
        const ring = (reach - dd);
        const col = ring < 1 ? '#3a1f4f' : ring < 2 ? '#5b2d7a' : (Math.floor(ring - p * 0.5) % 3 === 0 ? '#b874d8' : '#8a44b0');
        k.px(growth, f, x, y, col);
      }
      // highlights on the wet lobes
      for (const [hx, hy] of [[27, 16], [37, 26], [26, 35], [38, 44], [28, 52]]) { k.px(growth, f, hx, hy - (p >> 1), '#e2b4ff'); k.px(growth, f, hx + 1, hy - (p >> 1), '#e2b4ff'); }
      // veins creep outward over the rock
      for (const t of tendrils) {
        const len = 8 + p * 3;
        for (let n = 0; n < Math.min(len, t.length); n++) k.px(growth, f, t[n][0], t[n][1], n > len - 3 ? '#3a1f4f' : '#5b2d7a');
      }
      // green ooze: drips swell, stretch and fall, a step each frame
      for (const [x, start, ph] of [[26, 22, 0], [38, 30, 3], [27, 40, 5], [37, 49, 2], [31, 58, 6]]) {
        const t = (f + ph) % 8, len = Math.min(t, 5), drop = t > 5 ? (t - 5) * 4 : 0;
        k.line(ooze, f, x, start, x, start + len, '#3fae4a');
        k.px(ooze, f, x, start, '#9cf27a');
        const dy = start + len + drop;
        if (dy < H - 1) { k.rect(ooze, f, x, dy, x + 1, dy + 1, '#9cf27a'); k.px(ooze, f, x, dy, '#e8ffd0'); }
      }
      k.ell(glow, f, 16 - p * 2, 8 - p, 47 + p * 2, 56 + p, '#3a1f4f');
      k.ell(glow, f, 24 - p, 18, 39 + p, 46, '#5b2d7a');
    }
    d.tags.push({ name: 'Pulse', from: 0, to: 7, colour: '#b874d8', dir: 'forward' });
    d.lighting.preset = 'Object'; d.lighting.ambient = [90, 90, 120]; d.lighting.darkness = 0.45; d.lighting.style = 'dither'; d.lighting.steps = 4;
    d.lighting.lights = [{ name: 'Portal', x: 32, y: 32, radius: 46, flatten: 1, colour: [184, 116, 216], intensity: 0.8, height: 10, flicker: 'Neon', shadow: false, placed: true }];
    d.view = { preview: true, lightPreview: true, loopTag: 0, note: 'Rock and crack are linked cels; the growth breathes, the ooze drips. Lit with a dither render style.' };
    d.gc();
    return d;
  };

  S.LIST = [
    ['walk', 'Walk cycle (indexed, groups, tags, onion skin)'],
    ['room', 'Lit room 320×180 (lighting, RotSprite fan, TV static)'],
    ['portal', 'Portal pulse (FX loop, linked cels, glow)'],
    ['tile', 'Brick tile (tiled mode, dither, brush)'],
  ];
})(typeof window !== 'undefined' ? window : globalThis);
