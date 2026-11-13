// Dead Pixel core tests (no dependencies): node tests/run.mjs
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['palettes-game', 'lighting', 'core', 'tools', 'transform', 'io', 'samples']) {
  (0, eval)(readFileSync(join(root, 'public/js', f + '.js'), 'utf8'));
}
const DP = globalThis.DP, T = DP.Tools;
let pass = 0, fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e)); }
}
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || 'expected') + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); };
const ok = (v, msg) => { if (!v) throw new Error(msg || 'not true'); };
const appFor = (doc) => ({ doc, selection: null, tiled: 'none', symmetry: { x: false, y: false, cx: doc.w / 2, cy: doc.h / 2 } });

// ---------------------------------------------------------------- lighting (matches the Unity runtime)
await test('Banded matches FxCanvas.Banded (seam dither, flat bands)', () => {
  const b = DP.Lighting.banded;
  eq(b(0, 0, 0.5, 5), 0.6, 'level 0.5 at (0,0): seam, Bayer 0 takes the upper band');
  eq(b(1, 0, 0.5, 5), 0.4, 'level 0.5 at (1,0): Bayer 8 stays low');
  eq(b(3, 3, 0.95, 5), 1, 'above the seam rounds up');
  eq(b(3, 3, 0.02, 5), 0, 'below the seam rounds down');
  eq(b(0, 0, 0.37, 4, 'smooth'), 0.37, 'smooth passes through');
  eq(b(0, 0, 0.5, 5, 'hard'), 0.6, 'hard bands round half up');
});
await test('Light map: clear pixels encode as (128,128,0,0), flat surfaces face out', () => {
  const w = 12, h = 12, rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) rgba.set([150, 150, 150, 255], (y * w + x) * 4);
  const m = DP.Lighting.generate(rgba, w, h, 'Architecture', null);
  eq(Array.from(m.slice(0, 4)), [128, 128, 0, 0]);
  const c = (6 * w + 6) * 4;
  eq([m[c], m[c + 1], m[c + 3]], [128, 128, 255], 'the middle of a flat panel faces the viewer');
  ok(m[c + 2] > 200, 'a light grey takes most of the light');
});
await test('Light map: a character dome leans its edges outwards (y up in the map)', () => {
  const w = 16, h = 16, rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - 7.5) ** 2 + (y - 7.5) ** 2 < 36) rgba.set([200, 120, 90, 255], (y * w + x) * 4);
  const m = DP.Lighting.generate(rgba, w, h, 'Character', null);
  const at = (x, y) => (y * w + x) * 4;
  ok(m[at(3, 8)] < 128, 'left edge faces left');
  ok(m[at(12, 8)] > 128, 'right edge faces right');
  ok(m[at(8, 3) + 1] > 128, 'top edge (row 3 from the top) faces up');
  ok(m[at(8, 12) + 1] < 128, 'bottom edge faces down');
});
await test('Light pass: a lamp lights near it, darkness keeps the floor of MinLight', () => {
  const w = 40, h = 20, rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  const S = DP.Lighting.defaults();
  S.ambient = [255, 255, 255]; S.darkness = 1; S.useMap = false;
  S.lights = [{ name: 'L', x: 5, y: 10, radius: 12, flatten: 1, colour: [255, 255, 255], intensity: 1, height: -1, flicker: 'Steady' }];
  const out = DP.Lighting.render(rgba, w, h, null, S, 0, 'lit');
  const px = (x, y) => out[(y * w + x) * 4];
  ok(px(5, 10) > px(35, 10), 'brighter at the lamp');
  ok(px(35, 10) >= Math.round(0.16 * 255) - 1, 'never darker than MinLight');
});

await test('Room moods: applying one sets the light, the lamps and the Surface/Undertow layers, and round-trips', async () => {
  const d = new DP.Doc(8, 8, 'rgb');
  const surface = d.addLayer('PropSurfaceBack', 'layer'), under = d.addLayer('PropUndertowBack', 'layer', { visible: false }), keys = d.addLayer('PropKeys', 'layer');
  const L = d.lighting;
  L.lights = [
    { name: 'Ceiling', x: 4, y: 1, radius: 6, flatten: 1, colour: [255, 217, 153], intensity: 0.3, height: -1, flicker: 'Steady', lamp: true, layer: 'both' },
    { name: 'Window', x: 1, y: 3, radius: 4, flatten: 1, colour: [255, 247, 224], intensity: 0.2, height: -1, flicker: 'Steady', lamp: false, layer: 'surface' },
    { name: 'Mine', x: 2, y: 2, radius: 3, flatten: 1, colour: [255, 0, 0], intensity: 0.2, height: -1, flicker: 'Steady', off: true },
  ];
  const w = { rain: 0.6, wind: 0.25, fogBanks: 3, lightningEvery: 6 };
  L.moods = [
    { name: 'Day', ambient: [255, 255, 255], darkness: 0, lampsOn: false, weather: {} },
    { name: 'Night', ambient: [92, 107, 184], darkness: 0.6, lampsOn: true, weather: {} },
    { name: 'Undertow', ambient: [158, 115, 204], darkness: 0.5, lampsOn: false, undertow: true, weather: w },
  ];
  ok(DP.Lighting.applyMood(d, 'Dusk') === null, 'an unknown mood changes nothing');
  DP.Lighting.applyMood(d, 'Night');
  eq([L.mood, L.ambient, L.darkness], ['Night', [92, 107, 184], 0.6]);
  eq(L.lights.map((l) => !!l.off), [false, false, true], 'night: the lamp is lit; a lamp the artist added is left alone');
  eq([surface.visible, under.visible, keys.visible], [true, false, true]);
  DP.Lighting.applyMood(d, 'Undertow');
  eq(L.lights.map((l) => !!l.off), [true, true, true], 'the Undertow: lamps out, Surface-only lights off');
  eq([surface.visible, under.visible, keys.visible], [false, true, true], 'the Undertow layers show');
  eq(DP.Lighting.weatherText(L.moods[2]), 'rain 60%, wind to the right 25%, 3 fog banks, lightning about every 6 s');
  eq(DP.Lighting.weatherText(L.moods[0]), 'clear and still');
  DP.Lighting.applyMood(d, 'Day');
  eq(L.lights.map((l) => !!l.off), [true, false, true], 'day: lamps off, the window lit');
  const back = await DP.IO.loadProject(await DP.IO.saveProject(d));
  eq(back.lighting.moods.map((m) => m.name), ['Day', 'Night', 'Undertow'], 'moods are saved in the project');
  eq(back.lighting.mood, 'Day');
});

// ---------------------------------------------------------------- drawing
await test('Pixel perfect removes the corner pixel of an L turn', () => {
  const d = DP.Doc.blank(8, 8, 'rgb'), app = appFor(d);
  const s = new T.Stroke(app, d.layers[0].id, 0), ink = { kind: 'simple', value: T.pack([255, 0, 0, 255]) }, brush = { offsets: [[0, 0]] };
  T.freehand(s, 1, 1, brush, ink, true); T.freehand(s, 2, 1, brush, ink, true); T.freehand(s, 2, 2, brush, ink, true);
  eq(T.getVal(d, s.data, 1 * 8 + 2), 0, 'the corner (2,1) is put back');
  ok(T.getVal(d, s.data, 1 * 8 + 1) && T.getVal(d, s.data, 2 * 8 + 2), 'the ends stay');
  const s2 = new T.Stroke(app, d.layers[0].id, 0);
  T.freehand(s2, 1, 1, brush, ink, false); T.freehand(s2, 2, 1, brush, ink, false); T.freehand(s2, 2, 2, brush, ink, false);
  ok(T.getVal(d, s2.data, 1 * 8 + 2), 'without pixel perfect the corner stays');
});
await test('Shading ink steps one place along the ramp, once per stroke', () => {
  const d = DP.Doc.blank(4, 1, 'indexed'); d.palette = [[0, 0, 0, 255], [100, 100, 100, 255], [200, 200, 200, 255]];
  const app = appFor(d), s = new T.Stroke(app, d.layers[0].id, 0);
  s.data.fill(1);
  const ink = { kind: 'shading', ramp: [0, 1, 2], dir: 1 };
  T.dab(s, 0, 0, { offsets: [[0, 0]] }, ink); T.dab(s, 0, 0, { offsets: [[0, 0]] }, ink);
  eq(s.data[0], 2, 'one step lighter even when painted twice');
});
await test('Symmetry mirrors a dab; tiled mode wraps', () => {
  const d = DP.Doc.blank(8, 8, 'indexed'), app = appFor(d);
  app.symmetry.x = true;
  const s = new T.Stroke(app, d.layers[0].id, 0);
  T.dab(s, 1, 3, { offsets: [[0, 0]] }, { kind: 'simple', value: 5 });
  eq([s.data[3 * 8 + 1], s.data[3 * 8 + 6]], [5, 5]);
  app.symmetry.x = false; app.tiled = 'both';
  T.dab(s, 9, -1, { offsets: [[0, 0]] }, { kind: 'simple', value: 7 });
  eq(s.data[7 * 8 + 1], 7, '(9,-1) wraps to (1,7)');
});
await test('Ellipse and line algorithms', () => {
  eq(T.line(0, 0, 3, 1).length, 4);
  const e = T.ellipse(0, 0, 6, 4, false);
  ok(e.some(([x, y]) => x === 0 && y === 2) && e.some(([x, y]) => x === 6 && y === 2), 'touches both sides');
});

// ---------------------------------------------------------------- transforms
await test('Scale2x rounds a diagonal step', () => {
  const v = new Uint32Array([1, 0, 1, 1]); // 2x2: top-left, bottom row
  const out = DP.Transform.scale2x(v, 2, 2);
  eq(out.length, 16);
  eq(out[1 * 4 + 2], 1, 'the inner corner fills in');
});
await test('RotSprite by 0 and 360 degrees leaves the art as it was; 90 turns it', () => {
  const w = 6, h = 6, v = new Int32Array(w * h).fill(-1);
  v[1 * w + 1] = 3; v[1 * w + 2] = 3; v[4 * w + 4] = 2;
  eq(Array.from(DP.Transform.rotsprite(v, w, h, 0, 1, 1, 3, 3, -1)), Array.from(v));
  eq(Array.from(DP.Transform.rotsprite(v, w, h, 360, 1, 1, 3, 3, -1)), Array.from(v));
  const r = DP.Transform.rotsprite(v, w, h, 90, 1, 1, 3, 3, -1);
  ok(r.some((x) => x === 2) && r.some((x) => x === 3), 'keeps its colours');
  ok(Array.from(r).every((x) => x === -1 || x === 2 || x === 3), 'no new colours');
});

// ---------------------------------------------------------------- document
await test('Blend modes: multiply and screen', () => {
  const d = DP.Doc.blank(1, 1, 'rgb');
  d.celData.a = { data: new Uint8ClampedArray([200, 100, 50, 255]) }; d.cels[d.layers[0].id + '/0'] = 'a';
  const top = d.addLayer('top', 'layer', { blend: 'multiply' });
  d.celData.b = { data: new Uint8ClampedArray([128, 255, 0, 255]) }; d.cels[top.id + '/0'] = 'b';
  eq(Array.from(d.composite(0)).map(Math.round), [100, 100, 0, 255]);
  top.blend = 'screen';
  eq(Array.from(d.composite(0)).map(Math.round), [228, 255, 50, 255]);
});
await test('Groups composite their children, then blend as one', () => {
  const d = DP.Doc.blank(1, 1, 'rgb');
  d.celData.a = { data: new Uint8ClampedArray([255, 0, 0, 255]) }; d.cels[d.layers[0].id + '/0'] = 'a';
  const g = d.addLayer('g', 'group', { opacity: 0 });
  const c = d.addLayer('c', 'layer', { parent: g.id });
  d.celData.b = { data: new Uint8ClampedArray([0, 0, 255, 255]) }; d.cels[c.id + '/0'] = 'b';
  eq(Array.from(d.composite(0)), [255, 0, 0, 255], 'a group at 0% hides its children');
});
await test('Indexed: palette edit recolours everywhere; reorder keeps the picture', () => {
  const d = DP.Doc.blank(2, 1, 'indexed'); d.palette = [[10, 10, 10, 255], [200, 0, 0, 255], [0, 200, 0, 255]];
  d.celData.a = { data: new Int16Array([1, 2]) }; d.cels[d.layers[0].id + '/0'] = 'a';
  const before = Array.from(d.composite(0));
  d.reorderPalette([2, 0, 1]);
  eq(Array.from(d.composite(0)), before);
  d.palette[d.celData.a.data[0]] = [1, 2, 3, 255];
  eq(Array.from(d.composite(0).slice(0, 3)), [1, 2, 3]);
  d.removePaletteEntries([0]);
  eq(d.palette.length, 2);
});
await test('Frames: insert, duplicate, delete keep cels and tags in step; linked cels share', () => {
  const d = DP.Doc.blank(2, 2, 'rgb'), L = d.layers[0].id;
  d.celData.x = { data: new Uint8ClampedArray(16).fill(9) }; d.cels[L + '/0'] = 'x';
  d.tags.push({ name: 'Walk', from: 0, to: 0, dir: 'forward' });
  d.addFrame(1, 0); d.addFrame(0);
  eq(d.frames.length, 3);
  ok(!d.celId(L, 0) && d.celId(L, 1) === 'x' && d.celId(L, 2) && d.celId(L, 2) !== 'x');
  eq([d.tags[0].from, d.tags[0].to], [1, 1]);
  d.cels[L + '/2'] = 'x'; ok(d.linked(L, 1) && d.linked(L, 2));
  d.removeFrame(0); eq(d.frames.length, 2); eq(d.celId(L, 0), 'x');
});
await test('Undo snapshots restore structure', () => {
  const d = DP.Doc.blank(2, 2, 'rgb'), hist = new DP.History();
  DP.mutate(d, hist, 'add', () => { d.addLayer('two', 'layer'); d.addFrame(1); });
  eq([d.layers.length, d.frames.length], [2, 2]);
  hist.undo(); eq([d.layers.length, d.frames.length], [1, 1]);
  hist.redo(); eq([d.layers.length, d.frames.length], [2, 2]);
});

await test('Undo is capped by memory, counting shared arrays once', () => {
  const h = new DP.History(1), MB = 1024 * 1024, noop = () => {};
  const big = () => new Uint8Array(MB / 4);
  const shared = big();
  for (let i = 0; i < 3; i++) h.push({ label: 's' + i, refs: [shared], undo: noop, redo: noop });
  eq(h.undoStack.length, 3); eq(h.bytes, MB / 4, 'one shared array counted once');
  for (let i = 0; i < 6; i++) h.push({ label: 'b' + i, refs: [big()], undo: noop, redo: noop });
  ok(h.bytes <= MB, 'stays under the cap'); eq(h.undoStack[h.undoStack.length - 1].label, 'b5', 'newest kept');
  ok(!h.undoStack.some((e) => e.label[0] === 's'), 'oldest dropped first');
  h.undo(); h.push({ label: 'n', refs: [big()], undo: noop, redo: noop });
  eq(h.redoStack.length, 0); ok(h.bytes <= MB, 'dropped redo steps release memory');
  h.push({ label: 'huge', refs: [new Uint8Array(2 * MB)], undo: noop, redo: noop });
  eq(h.undoStack.length, 1, 'a single step over the cap is still kept');
  h.setLimitMB(4); eq(h.limitMB, 4);
});

await test('PowerQuest frames: imported sprites go back under their own names, size and place', async () => {
  const d = new DP.Doc(10, 8, 'rgb'); d.frames = [{ duration: 100 }, { duration: 100 }, { duration: 100 }];
  const L = d.addLayer('Sprite', 'layer');
  const a = DP.newId(), b = DP.newId(), c = DP.newId();
  for (const id of [a, b, c]) d.celData[id] = { data: d.newData() };
  d.celData[a].data.set([255, 0, 0, 255], (7 * 10 + 4) * 4);
  d.cels[L.id + '/0'] = a; d.cels[L.id + '/1'] = b; d.cels[L.id + '/2'] = c;
  d.sources[a] = { name: 'WalkR_0', x: 2, y: 0, w: 4, h: 8 }; d.sources[b] = { name: 'WalkR_1', x: 3, y: 0, w: 3, h: 8 };
  d.pivot = [4, 8];
  d.tags.push({ name: 'WalkR', from: 0, to: 2, dir: 'forward' });
  const back = await DP.IO.loadProject(await DP.IO.saveProject(d));
  eq(back.sources[a], d.sources[a]); eq(back.pivot, [4, 8]);
  const files = DP.IO.powerQuestFiles(back, [{ name: 'WalkR', frames: [0, 1, 2] }], 'x');
  eq(files.map((f) => f.name), ['WalkR_0', 'WalkR_1', 'WalkR_2'], 'originals keep names; the new frame takes the next free number');
  eq(files[0].rect, { x: 2, y: 0, w: 4, h: 8 }); eq(files[2].rect, { x: -2, y: 0, w: 12, h: 8 }, 'new frames are cut around the pivot');
  const px = DP.IO.crop(back.composite(0), 10, 8, 2, 0, 4, 8);
  eq(Array.from(px.slice((7 * 4 + 2) * 4, (7 * 4 + 2) * 4 + 4)), [255, 0, 0, 255]);
  d.resize(14, 8, 0.5, 0); eq(d.sources[a].x, 4, 'resizing moves the rects with the pixels'); eq(d.pivot, [6, 8]);
  d.cels[L.id + '/1'] = a; d.sources[a] = { name: 'WalkR_0', x: -1, y: 0, w: 4, h: 8 };
  eq(DP.IO.powerQuestFiles(d, [], 'x').skipped, [], 'a rect past the edge with nothing drawn there still goes back');
  d.cropTo(7, 0, 7, 8); // cuts off the red pixel at x 6
  eq(DP.IO.powerQuestFiles(d, [], 'x').skipped, ['WalkR_0'], 'a sprite whose drawn pixels the canvas cut off is not saved back');
  const plain = new DP.Doc(4, 4, 'rgb'); plain.frames = [{ duration: 1 }, { duration: 1 }];
  eq(DP.IO.powerQuestFiles(plain, [{ name: 'Idle', frames: [0, 1] }]).map((f) => f.name), ['Idle_0', 'Idle_1'], 'plain drawings export as before');
});

await test('Outline: outside adds a clean 4-way ring, inside recolours the edge; trim crops to the art', () => {
  const w = 5, h = 5, v = new Int32Array(w * h).fill(-1); v[12] = 3; // one pixel in the middle
  const clear = (x) => x < 0;
  const out = DP.outline(v, w, h, clear, 7, 'outside', false);
  eq([7, 11, 13, 17].map((i) => out[i]), [7, 7, 7, 7]); eq(out[6], -1, 'no corners in 4-way'); eq(out[12], 3);
  eq(DP.outline(v, w, h, clear, 7, 'outside', true)[6], 7, '8-way fills corners');
  eq(DP.outline(v, w, h, clear, 7, 'inside', false)[12], 7);
  const d = new DP.Doc(8, 6, 'indexed'); const L = d.addLayer('a', 'layer'); const id = DP.newId();
  d.celData[id] = { data: new Int16Array(48).fill(-1) }; d.celData[id].data[2 * 8 + 3] = 1; d.celData[id].data[4 * 8 + 5] = 1; d.cels[L.id + '/0'] = id;
  d.sources[id] = { name: 'S', x: 1, y: 1, w: 6, h: 4 };
  const b = d.contentBounds(); eq(b, { x: 3, y: 2, w: 3, h: 3 });
  d.cropTo(b.x, b.y, b.w, b.h); eq([d.w, d.h], [3, 3]); eq(d.celData[id].data[0], 1); eq(d.celData[id].data[8], 1);
  eq(d.sources[id], { name: 'S', x: -2, y: -1, w: 6, h: 4 }, 'source rects move with the crop (no drawn pixels lost)');
});

// ---------------------------------------------------------------- files
await test('PNG: RGBA and indexed encode to valid PNGs with exact pixels', async () => {
  const rgba = new Uint8ClampedArray([1, 2, 3, 4, 128, 128, 0, 0, 255, 0, 0, 255, 0, 0, 0, 255]);
  const png = await DP.IO.encodePNG(rgba, 2, 2);
  eq(Array.from(png.slice(1, 4)), [80, 78, 71]);
  // find IDAT and inflate
  let o = 8, raw = null;
  while (o < png.length) { const len = (png[o] << 24 | png[o + 1] << 16 | png[o + 2] << 8 | png[o + 3]) >>> 0; const type = String.fromCharCode(...png.slice(o + 4, o + 8)); if (type === 'IDAT') raw = inflateSync(Buffer.from(png.slice(o + 8, o + 8 + len))); o += 12 + len; }
  eq(Array.from(raw), [0, 1, 2, 3, 4, 128, 128, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 255], 'alpha-0 colour bytes survive (light maps need them)');
  const ix = DP.IO.toIndexed(rgba, null);
  ok(ix && ix.palette.length <= 256);
  const ipng = await DP.IO.encodeIndexedPNG(ix.indices, 2, 2, ix.palette);
  ok(String.fromCharCode(...ipng.slice(37, 41)) === 'PLTE', 'palette chunk follows the header');
});
await test('.deadpixel project round-trips (RGB and indexed)', async () => {
  for (const mode of ['rgb', 'indexed']) {
    const d = DP.Doc.blank(3, 2, mode); d.name = 'walk';
    const app = appFor(d), s = new T.Stroke(app, d.layers[0].id, 0);
    T.dab(s, 1, 1, { offsets: [[0, 0]] }, { kind: 'simple', value: mode === 'rgb' ? T.pack([9, 8, 7, 255]) : 4 });
    d.addLayer('Group', 'group'); d.addFrame(1, 0); d.tags.push({ name: 'Idle', from: 0, to: 1, dir: 'pingpong', colour: '#fff' });
    const bytes = await DP.IO.saveProject(d);
    ok(bytes[0] === 0x1f && bytes[1] === 0x8b, 'gzipped');
    const e = await DP.IO.loadProject(bytes);
    eq([e.w, e.h, e.mode, e.layers.length, e.frames.length, e.tags[0].dir, e.name], [3, 2, mode, 2, 2, 'pingpong', 'walk']);
    eq(Array.from(e.composite(1)), Array.from(d.composite(1)));
  }
});
await test('Sprite sheets: layouts, Unity JSON and Paper2D hash', () => {
  const d = DP.Doc.blank(4, 3, 'rgb'); d.name = 'Hero walk';
  d.addFrame(1); d.addFrame(2); d.tags.push({ name: 'Walk', from: 0, to: 2, dir: 'forward' });
  const s = DP.IO.buildSheet(d, { layout: 'grid', columns: 2, padding: 1, border: 2 });
  eq([s.w, s.h], [2 * 2 + 2 * 4 + 1, 2 * 2 + 2 * 3 + 1]);
  eq([s.cells[2].x, s.cells[2].y], [2, 2 + 3 + 1]);
  const j = DP.IO.sheetJSON(d, s, 'Hero_walk.png', { ppu: 1 });
  eq(j.generator, 'Dead Pixel'); eq(j.frames.length, 3); eq(j.meta.frameTags[0].name, 'Walk');
  const t = DP.IO.buildSheet(d, { layout: 'tags' });
  const u = DP.IO.paper2dJSON(d, t, 'x.png', {});
  eq(Object.keys(u.frames), ['Hero_walk_Walk_0', 'Hero_walk_Walk_1', 'Hero_walk_Walk_2']);
  eq(u.meta.size, { w: 12, h: 3 });
});
await test('GIF and ZIP are well formed', () => {
  const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(255);
  const g = DP.IO.encodeGIF([{ rgba, delay: 100 }, { rgba, delay: 100 }], 4, 4, 2);
  eq(String.fromCharCode(...g.slice(0, 6)), 'GIF89a'); eq(g[g.length - 1], 0x3b);
  const z = DP.IO.zip([{ name: 'a.txt', data: new TextEncoder().encode('hi') }]);
  eq(Array.from(z.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
});
await test('Palette files parse', () => {
  const pal = [[1, 2, 3, 255], [250, 128, 0, 255]];
  eq(DP.IO.parsePalette(DP.IO.paletteToGPL(pal)), pal);
  eq(DP.IO.parsePalette(DP.IO.paletteToJASC(pal)), pal);
  eq(DP.IO.parsePalette(DP.IO.paletteToHex(pal)), pal);
  eq(DP.extractPalette(new Uint8ClampedArray([1, 2, 3, 255, 1, 2, 3, 255, 9, 9, 9, 255]), 8).length, 2);
});

// ---------------------------------------------------------------- samples
for (const [key] of DP.Samples.LIST) await test('Sample ' + key + ' builds, has art, and survives save / open', async () => {
  const d = DP.Samples[key](); delete d.view;
  ok(d.frames.length >= 1 && d.layers.length >= 2, 'frames and layers');
  const rgba = d.composite(0); let painted = 0; for (let i = 3; i < rgba.length; i += 4) if (rgba[i]) painted++;
  ok(painted > d.w * d.h * 0.1, 'frame 0 has art');
  const back = await DP.IO.loadProject(await DP.IO.saveProject(d));
  eq(back.frames.length, d.frames.length); eq(back.tags.map((t) => [t.name, t.from, t.to, t.dir]), d.tags.map((t) => [t.name, t.from, t.to, t.dir]));
  eq(Array.from(back.composite(d.frames.length - 1)), Array.from(d.composite(d.frames.length - 1)), 'last frame round-trips');
});
await test('Walk sample: linked badge cel and recolouring one palette entry changes every frame', () => {
  const d = DP.Samples.walk();
  const badge = d.layers.find((l) => /Badge/.test(l.name));
  ok(d.cels[badge.id + '/0'] === d.cels[badge.id + '/7'], 'badge is linked');
  eq(d.mode, 'indexed');
  const before = [0, 5].map((f) => Array.from(d.composite(f)));
  const used = d.celData[d.cels[d.layers.find((l) => l.name === 'Body').id + '/0']].data.find((v) => v >= 0);
  d.palette[used] = [255, 0, 255, 255]; d.version = (d.version || 0) + 1;
  for (const [i, f] of [0, 5].entries()) ok(Array.from(d.composite(f)).join() !== before[i].join(), 'frame ' + f + ' recoloured');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
