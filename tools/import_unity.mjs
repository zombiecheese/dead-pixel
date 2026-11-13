// Converts a Unity / PowerQuest project's art into Dead Pixel projects.
//
//   node tools/import_unity.mjs <unity project> <output folder> [--only Hero,Arcade] [--strip MyGame] [--moods MyGame/Resources] [--no-clip]
//
// --strip names extra folders to leave out of document names (Game, Resources and Sprites always are), for example
//   your project's own root folder under Assets.
//
// Characters (Assets/Game/Characters/<Name>): one <Name>.deadpixel. Every .anim clip becomes a tag with its key
//   timings; sprites are lined up on their pivots (the feet); a sprite used more than once is a linked cel. Sprites no
//   clip uses come last, under an "Unused" tag.
// Rooms (Assets/Game/Rooms/<Name>): one <Name>.deadpixel with a layer per prop, placed where the room prefab puts it
//   (inactive props, like alternate versions of a room, are hidden layers). Frame 1 is the room; each prop animation follows
//   as a tag, with every other layer linked to frame 1. The canvas is the room's bounds (the background), so props
//   parked off-screen are cut off; scenery wider than the room (a parallax strip
//   behind a window) still widens it. Pass --no-clip to widen the canvas to hold every prop.
//   With --moods <folder> (under Assets), the room's mood profile (<folder>/Moods/<Name>.asset) and the art's glows
//   (<folder>/art_glows.json) become its lighting: the lamps where the profile puts them, and a mood per time of day,
//   the alternate world (Undertow) and each story mood.
// Anything else (GUI, inventory, cursors): one .deadpixel per folder, frames grouped into tags by name
//   (Walk_0, Walk_1… → tag Walk).
// Sprites with 256 colours or fewer and no part-transparent pixels come in as indexed colour, so a palette edit
// recolours every frame; the rest stay RGB.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['palettes-game', 'lighting', 'core', 'tools', 'transform', 'io']) (0, eval)(readFileSync(join(root, 'public/js', f + '.js'), 'utf8'));
const DP = globalThis.DP, IO = DP.IO;

const args = process.argv.slice(2);
const clip = !args.includes('--no-clip');
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
// folder names left out of the document names for "other" sprite folders (add your project's own root folder)
const STRIP = ['Game', 'Resources', 'Sprites', ...(args.includes('--strip') ? args[args.indexOf('--strip') + 1].split(',') : [])];
// the folder under Assets holding Moods/<Room>.asset and art_glows.json (room lighting); none: rooms open unlit
const MOODS = args.includes('--moods') ? args[args.indexOf('--moods') + 1] : null;
const [unity, out] = args.filter((a, i) => !a.startsWith('--') && !['--only', '--strip', '--moods'].includes(args[i - 1]));
if (!unity || !out) { console.error('usage: node tools/import_unity.mjs <unity project> <output folder> [--only A,B] [--strip Folder,…] [--moods Folder] [--no-clip]'); process.exit(1); }
const assets = join(unity, 'Assets');

// ------------------------------------------------------------------ PNG decoding (8-bit, non-interlaced)
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG (a Git LFS pointer? run git lfs pull)');
  let p = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0, plte = null, trns = null; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    p += 12 + len;
  }
  if (inter) throw new Error('interlaced PNG');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], bpp = Math.max(1, (ch * depth) >> 3), stride = (w * ch * depth + 7) >> 3;
  const raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = y && x >= bpp ? px[o - stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[o + x] = v & 255;
    }
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  const sample = (y, i) => { if (depth === 8) return px[y * stride + i]; if (depth === 16) return px[y * stride + i * 2]; const per = 8 / depth, byte = px[y * stride + ((i / per) | 0)]; return (byte >> (8 - depth * (1 + (i % per)))) & ((1 << depth) - 1); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (type === 6) for (let k = 0; k < 4; k++) rgba[o + k] = sample(y, x * 4 + k);
    else if (type === 2) { for (let k = 0; k < 3; k++) rgba[o + k] = sample(y, x * 3 + k); rgba[o + 3] = 255; }
    else if (type === 3) { const i = sample(y, x); rgba[o] = plte[i * 3]; rgba[o + 1] = plte[i * 3 + 1]; rgba[o + 2] = plte[i * 3 + 2]; rgba[o + 3] = trns && i < trns.length ? trns[i] : 255; }
    else if (type === 0) { const g = depth < 8 ? sample(y, x) * (255 / ((1 << depth) - 1)) : sample(y, x); rgba[o] = rgba[o + 1] = rgba[o + 2] = g; rgba[o + 3] = 255; }
    else if (type === 4) { rgba[o] = rgba[o + 1] = rgba[o + 2] = sample(y, x * 2); rgba[o + 3] = sample(y, x * 2 + 1); }
  }
  return { w, h, rgba };
}

// ------------------------------------------------------------------ Unity metadata
const ALIGN = [[0.5, 0.5], [0, 1], [0.5, 1], [1, 1], [0, 0.5], [1, 0.5], [0, 0], [0.5, 0], [1, 0]];
function walk(dir, list = []) { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, list); else list.push(p); } return list; }
const sprites = new Map(); // guid -> {path, pivot:[x,y] (y up), name}
for (const f of walk(assets)) {
  if (!f.endsWith('.png.meta')) continue;
  const m = readFileSync(f, 'utf8'), guid = (m.match(/^guid: (\w+)/m) || [])[1]; if (!guid) continue;
  const al = +((m.match(/^  alignment: (\d+)/m) || [])[1] || 0);
  const pv = m.match(/^  spritePivot: \{x: ([-\d.e]+), y: ([-\d.e]+)\}/m);
  sprites.set(guid, { path: f.slice(0, -5), name: basename(f, '.png.meta'), pivot: al === 9 && pv ? [+pv[1], +pv[2]] : ALIGN[al] || ALIGN[0] });
}
const imgCache = new Map();
const image = (s) => { if (!imgCache.has(s.path)) imgCache.set(s.path, decodePNG(readFileSync(s.path))); return imgCache.get(s.path); };

/** An .anim clip: its sprite keys with durations in ms. */
function readAnim(file) {
  const t = readFileSync(file, 'utf8');
  const name = (t.match(/^  m_Name: (.*)$/m) || [])[1] || basename(file, '.anim');
  const rate = +((t.match(/m_SampleRate: ([\d.]+)/) || [])[1] || 12);
  const stop = +((t.match(/m_StopTime: ([\d.e-]+)/) || [])[1] || 0);
  const loop = /m_LoopTime: 1/.test(t);
  const pp = t.indexOf('m_PPtrCurves:'), end = t.indexOf('m_SampleRate');
  const block = pp >= 0 ? t.slice(pp, end) : '';
  if (!/attribute: m_Sprite/.test(block)) return null;
  const keys = [...block.matchAll(/- time: ([\d.e-]+)\s*\n\s*value: \{fileID: -?\d+, guid: (\w+)/g)].map((m) => ({ time: +m[1], guid: m[2] }));
  if (!keys.length) return null;
  const frames = keys.map((k, i) => {
    const next = i + 1 < keys.length ? keys[i + 1].time : Math.max(stop, k.time + 1 / rate);
    return { guid: k.guid, ms: Math.max(10, Math.round((next - k.time) * 1000)) };
  });
  return { name, loop, frames };
}

// ------------------------------------------------------------------ building documents
/** Picks indexed colour when every pixel is clear or solid and there are at most 256 colours. */
function chooseMode(images) {
  const seen = new Map();
  for (const im of images) for (let i = 0; i < im.rgba.length; i += 4) {
    const a = im.rgba[i + 3]; if (!a) continue; if (a !== 255) return { mode: 'rgb' };
    const k = (im.rgba[i] << 16) | (im.rgba[i + 1] << 8) | im.rgba[i + 2];
    if (!seen.has(k)) { if (seen.size >= 256) return { mode: 'rgb' }; seen.set(k, [im.rgba[i], im.rgba[i + 1], im.rgba[i + 2], 255]); }
  }
  const lum = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
  return { mode: 'indexed', palette: [...seen.values()].sort((a, b) => lum(a) - lum(b)) };
}
/** Pixel values for a placed image on a w x h canvas; data.cut is true when the canvas cut drawn pixels off. */
function celFor(d, im, ox, oy, mode, palIndex) {
  const data = d.newData();
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const X = ox + x, Y = oy + y, s = (y * im.w + x) * 4; if (!im.rgba[s + 3]) continue;
    if (X < 0 || Y < 0 || X >= d.w || Y >= d.h) { data.cut = true; continue; }
    const t = Y * d.w + X;
    if (mode === 'indexed') data[t] = palIndex.get((im.rgba[s] << 16) | (im.rgba[s + 1] << 8) | im.rgba[s + 2]);
    else data.set(im.rgba.subarray(s, s + 4), t * 4);
  }
  return data;
}
const TAGCOLS = ['#ffbf66', '#7fd3a0', '#9d8bff', '#ff7a7a', '#66c8ff', '#e2b4ff', '#f2e56b', '#c9a27a'];

/** One sprite strip: clips [{name, loop, frames:[{guid|sprite, ms}]}], lined up on pivots, linked cels for repeats. */
function stripDoc(name, clips, preset) {
  const used = []; const seen = new Set();
  for (const c of clips) for (const f of c.frames) { const s = f.sprite || sprites.get(f.guid); f.s = s; if (s && !seen.has(s.path)) { seen.add(s.path); used.push(s); } }
  for (const c of clips) c.frames = c.frames.filter((f) => f.s);
  clips = clips.filter((c) => c.frames.length);
  if (!clips.length) return null;
  const ims = used.map(image);
  let L = 0, R = 0, T = 0, B = 0;
  used.forEach((s, i) => { const im = ims[i], px = Math.round(s.pivot[0] * im.w), py = Math.round((1 - s.pivot[1]) * im.h); L = Math.max(L, px); R = Math.max(R, im.w - px); T = Math.max(T, py); B = Math.max(B, im.h - py); });
  const { mode, palette } = chooseMode(ims);
  const d = new DP.Doc(Math.max(1, L + R), Math.max(1, T + B), mode);
  d.name = name;
  if (palette) d.palette = palette;
  const palIndex = new Map((palette || []).map((c, i) => [(c[0] << 16) | (c[1] << 8) | c[2], i]));
  const layer = d.addLayer('Sprite', 'layer');
  d.frames = []; const celOf = new Map();
  clips.forEach((c, ci) => {
    const from = d.frames.length;
    for (const f of c.frames) {
      const s = f.s, im = image(s);
      let id = celOf.get(s.path);
      if (!id) {
        const ox = L - Math.round(s.pivot[0] * im.w), oy = T - Math.round((1 - s.pivot[1]) * im.h);
        id = DP.newId(); d.celData[id] = { data: celFor(d, im, ox, oy, mode, palIndex) }; celOf.set(s.path, id);
        d.sources[id] = { name: s.name, x: ox, y: oy, w: im.w, h: im.h };
      }
      d.cels[layer.id + '/' + d.frames.length] = id;
      d.frames.push({ duration: f.ms });
    }
    d.tags.push({ name: c.name, from, to: d.frames.length - 1, colour: TAGCOLS[ci % TAGCOLS.length], dir: 'forward' });
  });
  d.pivot = [L, T];
  d.lighting.preset = preset || 'Character';
  return d;
}

/** Sprites in a folder grouped by name: Walk_0, Walk_1 → clip Walk. */
function groupClips(spriteList, ms = 100) {
  const groups = new Map();
  for (const s of spriteList) {
    const m = s.name.match(/^(.*?)[_ -]?(\d+)$/), key = m && m[1] ? m[1] : s.name, n = m ? +m[2] : 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ s, n });
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, l]) => ({ name, loop: true, frames: l.sort((a, b) => a.n - b.n).map((x) => ({ sprite: x.s, ms })) }));
}
const spritesIn = (dir) => [...sprites.values()].filter((s) => s.path.startsWith(dir + '/')).sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }));

// ------------------------------------------------------------------ characters
function character(dir) {
  const anims = readdirSync(dir).filter((f) => f.endsWith('.anim')).sort().map((f) => readAnim(join(dir, f))).filter(Boolean);
  const usedPaths = new Set(anims.flatMap((a) => a.frames.map((f) => (sprites.get(f.guid) || {}).path)));
  const unused = spritesIn(dir).filter((s) => !usedPaths.has(s.path));
  const clips = anims.concat(unused.length ? [{ name: 'Unused', loop: false, frames: unused.map((s) => ({ sprite: s, ms: 100 })) }] : []);
  return stripDoc(basename(dir), clips, 'Character');
}

// ------------------------------------------------------------------ rooms
/** Unity YAML: documents keyed by fileID, with the fields this needs. */
function readPrefab(file) {
  const docs = new Map();
  for (const part of readFileSync(file, 'utf8').split(/^--- /m).slice(1)) {
    const head = part.match(/^!u!(\d+) &(-?\d+)/); if (!head) continue;
    const g = (re) => (part.match(re) || [])[1];
    docs.set(head[2], {
      type: +head[1], id: head[2], text: part,
      go: g(/m_GameObject: \{fileID: (-?\d+)\}/), name: g(/^  m_Name: (.*)$/m), active: g(/^  m_IsActive: (\d)/m),
      pos: part.match(/m_LocalPosition: \{x: ([-\d.e]+), y: ([-\d.e]+)/), father: g(/m_Father: \{fileID: (-?\d+)\}/),
      sprite: g(/m_Sprite: \{fileID: -?\d+, guid: (\w+)/), order: g(/m_SortingOrder: (-?\d+)/), enabled: g(/^  m_Enabled: (\d)/m),
      anim: g(/^    m_animation: (.*)$/m), baseline: g(/^    m_baseline: ([-\d.e]+)/m),
    });
  }
  return docs;
}
function room(dir) {
  const prefab = readdirSync(dir).find((f) => /^Room.*\.prefab$/.test(f)); if (!prefab) return null;
  const docs = readPrefab(join(dir, prefab)), all = [...docs.values()];
  const anims = new Map(readdirSync(dir).filter((f) => f.endsWith('.anim')).map((f) => readAnim(join(dir, f))).filter(Boolean).map((a) => [a.name, a]));
  const trOf = new Map(all.filter((x) => x.type === 4 && x.go).map((x) => [x.go, x]));
  const worldPos = (tr) => { let x = 0, y = 0; while (tr) { if (tr.pos) { x += +tr.pos[1]; y += +tr.pos[2]; } tr = tr.father && tr.father !== '0' ? docs.get(tr.father) : null; } return [x, y]; };
  const props = [];
  for (const sr of all.filter((x) => x.type === 212 && x.go)) {
    const go = docs.get(sr.go); if (!go) continue;
    const mono = all.find((x) => x.type === 114 && x.go === sr.go && x.anim !== undefined);
    const anim = mono && mono.anim ? anims.get(mono.anim.trim()) : null;
    const first = sr.sprite && sprites.get(sr.sprite) || (anim && sprites.get(anim.frames[0].guid));
    if (!first) continue;
    const [x, y] = worldPos(trOf.get(sr.go));
    props.push({ name: go.name || 'Prop', active: go.active !== '0' && sr.enabled !== '0', order: +(sr.order || 0), baseline: +(mono && mono.baseline || 0), x, y, sprite: first, anim });
  }
  if (!props.length) return null;
  // world rect of every sprite any prop can show, so the canvas holds them all
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const rectOf = (p, s) => { const im = image(s), l = Math.round(p.x - s.pivot[0] * im.w), t = Math.round(p.y + (1 - s.pivot[1]) * im.h); return [l, t, im]; };
  for (const p of props) for (const s of [p.sprite].concat(p.anim ? p.anim.frames.map((f) => sprites.get(f.guid)).filter(Boolean) : [])) {
    const [l, t, im] = rectOf(p, s); x0 = Math.min(x0, l); x1 = Math.max(x1, l + im.w); y1 = Math.max(y1, t); y0 = Math.min(y0, t - im.h);
  }
  // clip to the room's bounds (PowerQuest's RoomComponent m_bounds, the background's size) unless --no-clip
  const rc = all.find((x) => x.type === 114 && /m_bounds:/.test(x.text));
  const bm = rc && rc.text.match(/m_bounds:\s*m_min: \{x: ([-\d.e]+), y: ([-\d.e]+)\}\s*m_max: \{x: ([-\d.e]+), y: ([-\d.e]+)\}/);
  if (clip && bm) {
    const [bx0, by0, bx1, by1] = bm.slice(1).map((v) => Math.round(+v));
    if (bx1 > bx0 && by1 > by0) {
      x0 = bx0; y0 = by0; x1 = bx1; y1 = by1;
      // scenery wider than the room (a strip that scrolls past a window) is kept whole;
      // only smaller props parked off-screen are cut
      for (const p of props) for (const s of [p.sprite].concat(p.anim ? p.anim.frames.map((f) => sprites.get(f.guid)).filter(Boolean) : [])) {
        const [l, t, im] = rectOf(p, s); if (im.w <= bx1 - bx0) continue;
        x0 = Math.min(x0, l); x1 = Math.max(x1, l + im.w); y1 = Math.max(y1, t); y0 = Math.min(y0, t - im.h);
      }
    }
  }
  const W = x1 - x0, H = y1 - y0;
  // back to front: sorting order, then baseline (PowerQuest draws higher baselines behind), then prefab order
  props.forEach((p, i) => (p.i = i));
  props.sort((a, b) => a.order - b.order || b.baseline - a.baseline || a.i - b.i);
  const ims = [...new Set(props.flatMap((p) => [p.sprite].concat(p.anim ? p.anim.frames.map((f) => sprites.get(f.guid)).filter(Boolean) : [])))].map(image);
  const { mode, palette } = chooseMode(ims);
  const d = new DP.Doc(W, H, mode); d.name = basename(dir);
  if (palette) d.palette = palette;
  const palIndex = new Map((palette || []).map((c, i) => [(c[0] << 16) | (c[1] << 8) | c[2], i]));
  const place = (p, s, id) => {
    const [l, t, im] = rectOf(p, s), data = celFor(d, im, l - x0, y1 - t, mode, palIndex);
    d.sources[id] = { name: s.name, x: l - x0, y: y1 - t, w: im.w, h: im.h }; if (data.cut) d.sources[id].cut = true;
    return data;
  };
  d.frames = [{ duration: 100 }];
  for (const p of props) {
    const l = d.addLayer(p.name, 'layer', { visible: p.active }); p.layer = l;
    const id = DP.newId(); d.celData[id] = { data: place(p, p.sprite, id) }; d.cels[l.id + '/0'] = id;
  }
  let ci = 0;
  for (const p of props) {
    if (!p.anim || p.anim.frames.length < 2) continue;
    const from = d.frames.length, cache = new Map();
    for (const f of p.anim.frames) {
      const s = sprites.get(f.guid); if (!s) continue;
      const fi = d.frames.length; d.frames.push({ duration: f.ms });
      for (const q of props) d.cels[q.layer.id + '/' + fi] = d.cels[q.layer.id + '/0'];
      let id = cache.get(s.path); if (!id) { id = DP.newId(); d.celData[id] = { data: place(p, s, id) }; cache.set(s.path, id); }
      d.cels[p.layer.id + '/' + fi] = id;
    }
    if (d.frames.length > from) d.tags.push({ name: p.anim.name, from, to: d.frames.length - 1, colour: TAGCOLS[ci++ % TAGCOLS.length], dir: 'forward' });
  }
  d.lighting.preset = 'Architecture';
  roomMoods(d, x0, y1);
  return d;
}

// ------------------------------------------------------------------ room moods (lights, day cycle, weather, alternate world)
/** A Unity YAML asset's fields as nested objects (the subset ScriptableObjects use: maps, "- " lists, {inline: maps}, []). */
function readAsset(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !/^(%|---)/.test(l));
  const value = (v) => {
    v = v.trim();
    if (v === '[]') return [];
    if (v[0] === '{') { const o = {}; for (const m of v.slice(1, -1).matchAll(/(\w+): ([^,}]+)/g)) o[m[1]] = value(m[2]); return o; }
    return v !== '' && !isNaN(v) ? +v : v;
  };
  let i = 0;
  const block = (indent) => {
    let out = null;
    while (i < lines.length) {
      const line = lines[i], ind = line.match(/^ */)[0].length;
      if (ind < indent) break;
      const item = line.slice(ind).startsWith('- ');
      if (item) {
        out = out || []; if (!Array.isArray(out)) break;
        lines[i] = ' '.repeat(ind + 2) + line.slice(ind + 2); // the item's first field, at the item's own indent
        out.push(block(ind + 2));
        continue;
      }
      if (Array.isArray(out)) break; // the list is over: this is the parent's next field
      const m = line.slice(ind).match(/^([^:]+):(.*)$/); i++;
      if (!m) continue;
      out = out || {};
      if (m[2].trim() !== '') out[m[1]] = value(m[2]);
      else {
        const next = lines[i] || '', nind = next.match(/^ */)[0].length;
        out[m[1]] = nind > ind || (nind === ind && next.slice(nind).startsWith('- ')) ? block(nind) : null;
      }
    }
    return out;
  };
  const top = block(0) || {};
  return top.MonoBehaviour || top;
}
const rgb = (c) => (c ? [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v * 255)))) : [255, 255, 255]);
const FLICKERS = ['Steady', 'Lamp', 'Fluoro', 'Candle', 'Neon', 'Beacon'];
let glowsCache;
/**
 * The room's mood profile (<--moods>/Moods/<Room>.asset) as the document's lighting: its lamps where the profile
 * puts them (and the art's own glows, <--moods>/art_glows.json), and a mood for each time of day and the alternate
 * world (Undertow), so Light > Room mood shows the room as the engine lights it. The mood it opens in is the room's own time (rooms that
 * are always at night open at night), otherwise Day.
 */
function roomMoods(d, x0, y1) {
  if (!MOODS) return;
  const path = join(assets, MOODS, 'Moods', d.name + '.asset');
  if (!existsSync(path)) return;
  const p = readAsset(path), L = d.lighting;
  const at = (x, y) => [Math.round(x - x0), Math.round(y1 - y)];
  L.lights = [];
  for (const l of p.Lights || []) {
    const [x, y] = at(l.Position.x, l.Position.y);
    L.lights.push({ name: l.Name, x, y, radius: l.Radius, flatten: l.Flatten === undefined ? 1 : l.Flatten, colour: rgb(l.Colour), intensity: l.Intensity,
      height: l.Height === undefined ? -1 : l.Height, flicker: FLICKERS[l.Flicker || 0], shadow: !!l.Shadow, placed: true,
      lamp: !!l.OnlyWhenLit, layer: ['both', 'surface', 'undertow'][l.Layer || 0] });
  }
  if (glowsCache === undefined) {
    const g = join(assets, MOODS, 'art_glows.json');
    glowsCache = existsSync(g) ? JSON.parse(readFileSync(g, 'utf8')).rooms || [] : [];
  }
  let gi = 0;
  for (const r of glowsCache) if (r.room === d.name) for (const g of r.glows || []) {
    const [x, y] = at(g.x, g.y);
    L.lights.push({ name: 'ArtGlow' + gi++, x, y, radius: g.radius, flatten: 1, colour: rgb(g.colour), intensity: Math.min(1, g.intensity * 0.8), height: -1, flicker: 'Steady', shadow: false, placed: true, lamp: false, layer: 'both' });
  }
  const mood = (name, m) => {
    const w = m.Weather || {};
    return { name, ambient: rgb(m.Ambient), darkness: m.Darkness || 0, lampsOn: !!m.LampsOn, undertow: name === 'Undertow',
      weather: { rain: w.Rain || 0, drizzle: w.Drizzle || 0, wind: w.Wind || 0, fogBanks: w.FogBanks || 0, fog: rgb(w.FogColour), fogDensity: w.FogDensity || 0,
        leaves: w.Leaves || 0, snow: w.Snow || 0, lightningEvery: w.LightningEvery || 0, lightning: rgb(w.LightningColour), haze: w.Haze || 0, hazeColour: rgb(w.HazeColour) } };
  };
  const times = ['Morning', 'Day', 'Evening', 'Night'];
  L.moods = (p.FixedTime ? [times[p.Time]] : times).filter((t) => p[t]).map((t) => mood(t, p[t]));
  if (p.Undertow && d.layers.some((l) => /^(Prop)?Undertow/.test(l.name))) L.moods.push(mood('Undertow', p.Undertow));
  for (const sm of p.StoryMoods || []) if (sm.Flag && sm.Mood) L.moods.push(mood('Story: ' + sm.Flag, sm.Mood));
  L.skyFalloff = !!p.Outdoors;
  const open = p.FixedTime ? times[p.Time] : 'Day';
  const visible = d.layers.map((l) => l.visible);
  if (L.moods.length) DP.Lighting.applyMood(d, L.moods.some((m) => m.name === open) ? open : L.moods[0].name);
  d.layers.forEach((l, i) => (l.visible = visible[i])); // the prefab decides which layers start shown
}

// ------------------------------------------------------------------ run
const report = [];
async function write(d, sub, src) {
  if (!d) return;
  const dir = join(out, sub); mkdirSync(dir, { recursive: true });
  d.gc && d.gc();
  const bytes = await IO.saveProject(d);
  writeFileSync(join(dir, d.name + '.deadpixel'), bytes);
  report.push({ file: sub + '/' + d.name + '.deadpixel', src: relative(unity, src), size: d.w + 'x' + d.h, mode: d.mode, frames: d.frames.length, layers: d.layers.length, tags: d.tags.length, kb: Math.round(bytes.length / 1024) });
  console.log(sub.padEnd(10), d.name.padEnd(28), (d.w + 'x' + d.h).padEnd(9), d.mode.padEnd(8), d.frames.length + ' frames', d.tags.length + ' tags');
}
const want = (n) => !only || only.has(n);
const errors = [];
const attempt = async (what, fn) => { try { await fn(); } catch (e) { errors.push(what + ': ' + e.message); console.log('SKIP', what, e.message); } };

const chars = join(assets, 'Game/Characters');
if (existsSync(chars)) for (const n of readdirSync(chars).sort()) { const p = join(chars, n); if (statSync(p).isDirectory() && want(n)) await attempt(n, () => write(character(p), 'Characters', p)); }
const rooms = join(assets, 'Game/Rooms');
if (existsSync(rooms)) for (const n of readdirSync(rooms).sort()) { const p = join(rooms, n); if (statSync(p).isDirectory() && want(n)) await attempt(n, () => write(room(p), 'Rooms', p)); }
// everything else that has sprites: one document per folder
const covered = [chars, rooms];
const folders = new Map();
for (const s of sprites.values()) {
  if (covered.some((c) => s.path.startsWith(c + '/'))) continue;
  const dir = dirname(s.path); if (dir === join(assets, 'Game')) continue; // PowerQuest's own icon and logo
  if (!folders.has(dir)) folders.set(dir, []); folders.get(dir).push(s);
}
for (const [dir, list] of [...folders.entries()].sort()) {
  const rel = relative(assets, dir), name = rel.split('/').filter((x) => !STRIP.includes(x)).join('-') || basename(dir);
  if (!want(name)) continue;
  if (/^(Plugins|PowerQuest|TextMesh)/.test(rel)) continue;
  await attempt(name, () => { const d = stripDoc(name, groupClips(list.sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }))), 'Object'); return write(d, 'Other', dir); });
}
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.json'), JSON.stringify({ generated: new Date().toISOString(), files: report, skipped: errors }, null, 1));
console.log('\n' + report.length + ' documents, ' + errors.length + ' skipped');
