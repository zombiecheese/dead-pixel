/* Dead Pixel: files. PNG (RGBA and indexed) written by hand so colours and alpha are exact, store-only ZIP, GIF,
   the .deadpixel project format, and sprite sheets for Unity (PNG + JSON + slicer script) and Unreal (Paper2D
   .paper2dsprites). Nothing here talks to a server: everything is read from and saved to the user's own machine. */
(function (root) {
  'use strict';
  const DP = root.DP || (root.DP = {});
  const IO = (DP.IO = {});
  const enc = new TextEncoder();

  // ---------------------------------------------------------------- bytes helpers
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes, crc) { crc = crc === undefined ? 0xffffffff : crc; for (let i = 0; i < bytes.length; i++) crc = CRC[(crc ^ bytes[i]) & 255] ^ (crc >>> 8); return crc; }
  IO.crc32 = (b) => (crc32(b) ^ 0xffffffff) >>> 0;
  function concat(parts) { let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
  async function streamBytes(bytes, stream) {
    const s = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  IO.deflate = (b) => streamBytes(b, new CompressionStream('deflate'));
  IO.inflate = (b) => streamBytes(b, new DecompressionStream('deflate'));
  IO.gzip = (b) => streamBytes(b, new CompressionStream('gzip'));
  IO.gunzip = (b) => streamBytes(b, new DecompressionStream('gzip'));
  function u32(v) { return new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]); }

  // ---------------------------------------------------------------- PNG
  async function chunk(type, data) {
    const t = enc.encode(type);
    const c = crc32(data, crc32(t)) ^ 0xffffffff;
    return concat([u32(data.length), t, data, u32(c >>> 0)]);
  }
  /** RGBA PNG. */
  IO.encodePNG = async function (rgba, w, h) {
    const raw = new Uint8Array((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1); }
    const ihdr = concat([u32(w), u32(h), new Uint8Array([8, 6, 0, 0, 0])]);
    return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), await chunk('IHDR', ihdr), await chunk('IDAT', await IO.deflate(raw)), await chunk('IEND', new Uint8Array(0))]);
  };
  /** Indexed PNG (colour type 3). indices: one byte per pixel; palette: [[r,g,b,a]...] up to 256. */
  IO.encodeIndexedPNG = async function (indices, w, h, palette) {
    const raw = new Uint8Array((w + 1) * h);
    for (let y = 0; y < h; y++) raw.set(indices.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
    const ihdr = concat([u32(w), u32(h), new Uint8Array([8, 3, 0, 0, 0])]);
    const plte = new Uint8Array(palette.length * 3), trns = new Uint8Array(palette.length);
    palette.forEach((c, i) => { plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2]; trns[i] = c[3] === undefined ? 255 : c[3]; });
    return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), await chunk('IHDR', ihdr), await chunk('PLTE', plte), await chunk('tRNS', trns), await chunk('IDAT', await IO.deflate(raw)), await chunk('IEND', new Uint8Array(0))]);
  };
  /**
   * An indexed PNG from RGBA if it fits in 256 colours (index 0 clear); otherwise null. Keeps a doc's palette order
   * when given, so engines that read palette PNGs see the same indices.
   */
  IO.toIndexed = function (rgba, palette) {
    const pal = [[0, 0, 0, 0]], map = new Map();
    if (palette) palette.forEach((c) => { const k = ((c[0] << 16) | (c[1] << 8) | c[2]) >>> 0; if (!map.has(k)) { map.set(k, pal.length); pal.push([c[0], c[1], c[2], 255]); } });
    const idx = new Uint8Array(rgba.length / 4);
    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
      if (rgba[i + 3] < 128) continue;
      const k = ((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]) >>> 0;
      let v = map.get(k);
      if (v === undefined) { if (pal.length >= 256) return null; v = pal.length; map.set(k, v); pal.push([rgba[i], rgba[i + 1], rgba[i + 2], 255]); }
      idx[p] = v;
    }
    return { indices: idx, palette: pal };
  };

  // ---------------------------------------------------------------- ZIP (stored)
  IO.zip = function (files) {
    const parts = [], central = [];
    let offset = 0;
    const dosTime = 0, dosDate = (2026 - 1980) << 9 | 1 << 5 | 1;
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = IO.crc32(data);
      const local = new Uint8Array(30 + name.length), v = new DataView(local.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
      v.setUint16(10, dosTime, true); v.setUint16(12, dosDate, true); v.setUint32(14, crc, true);
      v.setUint32(18, data.length, true); v.setUint32(22, data.length, true); v.setUint16(26, name.length, true);
      local.set(name, 30);
      const cen = new Uint8Array(46 + name.length), c = new DataView(cen.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true); cen.set(name, 46);
      parts.push(local, data); central.push(cen);
      offset += local.length + data.length;
    }
    const cenBytes = concat(central);
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cenBytes.length, true); e.setUint32(16, offset, true);
    return concat(parts.concat([cenBytes, end]));
  };

  // ---------------------------------------------------------------- GIF
  /** Animated GIF from RGBA frames [{rgba, delay(ms)}], all w x h. Colours beyond 255 are matched to a median cut. */
  IO.encodeGIF = function (frames, w, h, scale) {
    scale = scale || 1;
    const W = w * scale, H = h * scale;
    const all = new Uint8ClampedArray(frames.length * w * h * 4);
    frames.forEach((f, i) => all.set(f.rgba, i * w * h * 4));
    let pal = IO.toIndexed(all, null);
    let palette = pal ? pal.palette : [[0, 0, 0, 0]].concat(DP.extractPalette(all, 255));
    const cache = new Map();
    const indexOf = (r, g, b) => {
      const k = (r << 16) | (g << 8) | b; let v = cache.get(k);
      if (v === undefined) { let best = 1, bd = Infinity; for (let i = 1; i < palette.length; i++) { const d = DP.colourDist(palette[i], [r, g, b, 255]); if (d < bd) { bd = d; best = i; } } v = best; cache.set(k, v); }
      return v;
    };
    let bits = 1; while ((1 << bits) < palette.length) bits++;
    const size = 1 << bits;
    const out = [];
    const push = (...b) => out.push(...b);
    const word = (v) => push(v & 255, (v >> 8) & 255);
    push(...enc.encode('GIF89a')); word(W); word(H); push(0xf0 | (bits - 1), 0, 0);
    for (let i = 0; i < size; i++) { const c = palette[i] || [0, 0, 0]; push(c[0], c[1], c[2]); }
    push(0x21, 0xff, 11, ...enc.encode('NETSCAPE2.0'), 3, 1, 0, 0, 0);
    for (const f of frames) {
      push(0x21, 0xf9, 4, 0x09, 0, 0, 0, 0);
      const d = Math.max(2, Math.round(f.delay / 10)); out[out.length - 4] = d & 255; out[out.length - 3] = (d >> 8) & 255;
      push(0x2c); word(0); word(0); word(W); word(H); push(0);
      const px = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const s = (((y / scale) | 0) * w + ((x / scale) | 0)) * 4, r = f.rgba;
        px[y * W + x] = r[s + 3] < 128 ? 0 : indexOf(r[s], r[s + 1], r[s + 2]);
      }
      const minCode = Math.max(2, bits);
      push(minCode);
      const data = lzw(px, minCode);
      for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); push(n); for (let k = 0; k < n; k++) out.push(data[i + k]); }
      push(0);
    }
    push(0x3b);
    return new Uint8Array(out);
  };
  function lzw(px, minCode) {
    const clear = 1 << minCode, eoi = clear + 1;
    let codeSize = minCode + 1, next = eoi + 1, dict = new Map();
    const out = []; let cur = 0, curBits = 0;
    const emit = (code) => { cur |= code << curBits; curBits += codeSize; while (curBits >= 8) { out.push(cur & 255); cur >>>= 8; curBits -= 8; } };
    emit(clear);
    let prefix = px[0];
    for (let i = 1; i < px.length; i++) {
      const k = px[i], key = prefix * 4096 + k;
      const hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << codeSize) && codeSize < 12) codeSize++; }
      else { emit(clear); dict = new Map(); codeSize = minCode + 1; next = eoi + 1; }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (curBits > 0) out.push(cur & 255);
    return out;
  }

  // ---------------------------------------------------------------- base64
  function toB64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function fromB64(s) { const b = atob(s), out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; }

  // ---------------------------------------------------------------- .deadpixel project
  IO.FORMAT = 'deadpixel';
  IO.FORMAT_VERSION = 1;
  /** The project as a plain object (see docs/FORMAT.md). */
  IO.projectToJSON = function (doc) {
    const celData = {};
    for (const id in doc.celData) {
      const d = doc.celData[id].data;
      celData[id] = toB64(new Uint8Array(d.buffer, d.byteOffset, d.byteLength));
    }
    return {
      format: IO.FORMAT, version: IO.FORMAT_VERSION, app: 'Dead Pixel',
      name: doc.name, width: doc.w, height: doc.h, colorMode: doc.mode,
      palette: doc.palette.map((c) => DP.rgbaToHex(c, true)),
      layers: doc.layers.map((l) => ({ id: l.id, name: l.name, kind: l.kind, parent: l.parent, visible: l.visible, locked: l.locked, opacity: l.opacity, blend: l.blend, collapsed: !!l.collapsed })),
      frames: doc.frames.map((f) => ({ duration: f.duration })),
      tags: doc.tags.map((t) => ({ name: t.name, from: t.from, to: t.to, colour: t.colour, dir: t.dir })),
      cels: doc.cels,
      celEncoding: doc.mode === 'indexed' ? 'int16le-index' : 'rgba8',
      celData,
      indexedBlendSnap: doc.indexedBlendSnap, grid: doc.grid, lighting: doc.lighting,
      ...sourcesJSON(doc),
    };
  };
  /** Imported-sprite rects for cels that still exist, and the pivot; left out when there are none. */
  function sourcesJSON(doc) {
    const sources = {};
    for (const id in doc.sources || {}) if (doc.celData[id]) sources[id] = Object.assign({}, doc.sources[id]);
    const o = {};
    if (Object.keys(sources).length) o.sources = sources;
    if (doc.pivot) o.pivot = doc.pivot.slice();
    return o;
  }
  IO.projectFromJSON = function (j) {
    if (!j || j.format !== IO.FORMAT) throw new Error('This file is not a Dead Pixel project.');
    if (j.version > IO.FORMAT_VERSION) throw new Error('This project was saved by a newer Dead Pixel (format ' + j.version + ').');
    const doc = new DP.Doc(j.width, j.height, j.colorMode);
    doc.name = j.name || 'Untitled';
    doc.palette = j.palette.map(DP.hexToRgba);
    doc.layers = j.layers.map((l) => Object.assign({}, l));
    doc.frames = j.frames.map((f) => ({ duration: f.duration || 100 }));
    doc.tags = (j.tags || []).map((t) => Object.assign({ dir: 'forward', colour: '#c9a227' }, t));
    doc.cels = Object.assign({}, j.cels);
    doc.celData = {};
    for (const id in j.celData) {
      const b = fromB64(j.celData[id]);
      const data = j.colorMode === 'indexed' ? new Int16Array(b.buffer, 0, b.length / 2).slice() : new Uint8ClampedArray(b.buffer, 0, b.length).slice();
      doc.celData[id] = { data };
    }
    doc.indexedBlendSnap = j.indexedBlendSnap !== false;
    if (j.grid) doc.grid = j.grid;
    if (j.lighting) doc.lighting = Object.assign(DP.Lighting.defaults(), j.lighting);
    if (j.sources) doc.sources = Object.assign({}, j.sources);
    if (Array.isArray(j.pivot)) doc.pivot = j.pivot.slice(0, 2);
    doc.gc();
    return doc;
  };
  /** .deadpixel bytes: gzipped JSON. */
  IO.saveProject = async function (doc) { return IO.gzip(enc.encode(JSON.stringify(IO.projectToJSON(doc)))); };
  IO.loadProject = async function (bytes) {
    let text;
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) text = new TextDecoder().decode(await IO.gunzip(bytes));
    else text = new TextDecoder().decode(bytes);
    return IO.projectFromJSON(JSON.parse(text));
  };

  // ---------------------------------------------------------------- PowerQuest frames
  /** rgba cropped to a rect (parts outside the canvas are clear). */
  IO.crop = function (rgba, W, H, x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let yy = 0; yy < h; yy++) {
      const sy = y + yy; if (sy < 0 || sy >= H) continue;
      for (let xx = 0; xx < w; xx++) {
        const sx = x + xx; if (sx < 0 || sx >= W) continue;
        out.set(rgba.subarray((sy * W + sx) * 4, (sy * W + sx) * 4 + 4), (yy * w + xx) * 4);
      }
    }
    return out;
  };
  /**
   * The files for "Frames for PowerQuest": [{name, frame, rect:{x,y,w,h}, hide:Set}] (name without .png).
   * A plain drawing gives <Tag>_<n> per frame, as before. An imported file (cels carrying their source sprite, see
   * doc.sources) gives one file per sprite under its original name, at its original size and place, so it can be
   * dropped back over the original and keep its .meta (and every .anim that points at it). Other imported sprites
   * on the frame are left out (a room's other props); layers you added are included. Frames you drew new get the
   * next free <Tag>_<n>, cut around the pivot so they line up with the rest.
   */
  IO.powerQuestFiles = function (doc, groups, baseName) {
    const src = doc.sources || {}, full = { x: 0, y: 0, w: doc.w, h: doc.h };
    const imported = Object.keys(src).some((id) => doc.celData[id]);
    const files = [];
    files.skipped = [];
    if (!imported) {
      for (const g of groups) g.frames.forEach((f, i) => files.push({ name: g.name + '_' + i, frame: f, rect: full, hide: null }));
      return files;
    }
    // every frame, so untagged ones (a room's frame 1) are covered too; new frames are named after their tag
    const tagOf = (f) => { const t = doc.tags.find((t) => f >= t.from && f <= t.to); return t ? IO.safeName(t.name) : baseName || IO.safeName(doc.name); };
    const used = new Set(Object.values(src).map((r) => r.name)), emitted = new Set(), seenNew = new Set();
    const layers = doc.layers.filter((l) => l.kind !== 'group');
    let newRect = full;
    if (doc.pivot) { const px = doc.pivot[0], m = Math.max(px, doc.w - px); newRect = { x: px - m, y: 0, w: m * 2, h: doc.h }; }
    for (let f = 0; f < doc.frames.length; f++) {
      const owners = layers.filter((l) => { const id = doc.cels[l.id + '/' + f]; return id && src[id]; });
      if (owners.length) {
        for (const l of owners) {
          const r = src[doc.cels[l.id + '/' + f]];
          if (emitted.has(r.name)) continue;
          emitted.add(r.name);
          // a sprite the canvas cut pixels off (a room clipped to its bounds, a smaller canvas) would lose them if saved back
          if (r.cut) { files.skipped.push(r.name); continue; }
          const others = new Set(owners.filter((o) => o !== l).map((o) => o.id));
          files.push({ name: r.name, frame: f, rect: { x: r.x, y: r.y, w: r.w, h: r.h }, hide: others, show: l.visible ? null : l.id });
        }
        continue;
      }
      const key = layers.map((l) => doc.cels[l.id + '/' + f] || '').join('|');
      if (seenNew.has(key) || !layers.some((l) => doc.cels[l.id + '/' + f])) continue;
      seenNew.add(key);
      const base = tagOf(f);
      let n = 0; while (used.has(base + '_' + n) || emitted.has(base + '_' + n)) n++;
      const name = base + '_' + n; emitted.add(name);
      files.push({ name, frame: f, rect: newRect, hide: null });
    }
    return files;
  };

  // ---------------------------------------------------------------- sprite sheets
  /** Frame indices for 'all', or a tag (played in its direction, ping-pong without repeating ends). */
  IO.framesFor = function (doc, tagIndex) {
    if (tagIndex === undefined || tagIndex === null || tagIndex < 0) return doc.frames.map((_, i) => i);
    const t = doc.tags[tagIndex]; if (!t) return [];
    const r = []; for (let i = t.from; i <= t.to; i++) r.push(i);
    return r;
  };
  /**
   * Lays out frames. opts: {frames:[index], layout:'horizontal'|'vertical'|'grid'|'tags', columns, padding (between),
   * border, rgba(f)->RGBA (defaults to the composite)}. Returns {w, h, rgba, cells:[{frame, x, y, row, tag}]}.
   */
  IO.buildSheet = function (doc, opts) {
    const fw = doc.w, fh = doc.h, pad = opts.padding || 0, border = opts.border || 0;
    let rows = [];
    if (opts.layout === 'tags' && doc.tags.length) rows = doc.tags.map((t, ti) => IO.framesFor(doc, ti).map((f) => ({ frame: f, tag: t.name })));
    else {
      const list = (opts.frames || doc.frames.map((_, i) => i)).map((f) => ({ frame: f, tag: null }));
      let cols = opts.layout === 'vertical' ? 1 : opts.layout === 'grid' ? Math.max(1, opts.columns || Math.ceil(Math.sqrt(list.length))) : list.length;
      for (let i = 0; i < list.length; i += cols) rows.push(list.slice(i, i + cols));
    }
    const cols = Math.max(...rows.map((r) => r.length), 1);
    const W = border * 2 + cols * fw + (cols - 1) * pad, H = border * 2 + rows.length * fh + (rows.length - 1) * pad;
    const rgba = new Uint8ClampedArray(W * H * 4), cells = [];
    const get = opts.rgba || ((f) => doc.composite(f));
    rows.forEach((row, ri) => row.forEach((c, ci) => {
      const x = border + ci * (fw + pad), y = border + ri * (fh + pad);
      const src = get(c.frame);
      for (let yy = 0; yy < fh; yy++) rgba.set(src.subarray(yy * fw * 4, (yy + 1) * fw * 4), ((y + yy) * W + x) * 4);
      cells.push({ frame: c.frame, x, y, row: ri, tag: c.tag });
    }));
    return { w: W, h: H, rgba, cells };
  };
  const safe = (s) => String(s || 'sprite').trim().replace(/[^A-Za-z0-9_-]+/g, '_') || 'sprite';
  IO.safeName = safe;
  function frameName(doc, cell, i) { return safe(doc.name) + (cell.tag ? '_' + safe(cell.tag) : '') + '_' + i; }

  /** Generic JSON (array of frames, tags, layers): what the Unity importer script reads. */
  IO.sheetJSON = function (doc, sheet, imageName, opts) {
    const counters = {};
    return {
      generator: 'Dead Pixel', format: 'deadpixel-sheet', version: 1,
      frames: sheet.cells.map((c) => {
        const key = c.tag || ''; counters[key] = (counters[key] || 0);
        return {
          filename: frameName(doc, c, counters[key]++), frame: { x: c.x, y: c.y, w: doc.w, h: doc.h },
          rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: doc.w, h: doc.h }, sourceSize: { w: doc.w, h: doc.h },
          duration: doc.frames[c.frame].duration, index: c.frame,
        };
      }),
      meta: {
        app: 'Dead Pixel', image: imageName, format: 'RGBA8888', size: { w: sheet.w, h: sheet.h }, scale: '1',
        pixelsPerUnit: opts.ppu || 1, pivot: opts.pivot || { x: 0.5, y: 0 }, filterMode: 'Point',
        frameTags: doc.tags.map((t) => ({ name: t.name, from: t.from, to: t.to, direction: t.dir || 'forward', color: t.colour })),
        layers: doc.layers.map((l) => ({ name: l.name, kind: l.kind, opacity: l.opacity, blendMode: l.blend, group: l.parent ? (doc.layer(l.parent) || {}).name : null })),
      },
    };
  };
  /**
   * Unreal Paper2D sprite sheet (.paper2dsprites, the hash layout Paper2D's importer reads). Paper2D accepts sheets
   * whose meta.app names TexturePacker's export URL, so that string goes in as the compatibility marker; the real
   * maker is in meta.generator.
   */
  IO.paper2dJSON = function (doc, sheet, imageName, opts) {
    const frames = {}, counters = {};
    const pv = opts.pivot || { x: 0.5, y: 1 };
    sheet.cells.forEach((c) => {
      const key = c.tag || ''; counters[key] = counters[key] || 0;
      frames[frameName(doc, c, counters[key]++)] = {
        frame: { x: c.x, y: c.y, w: doc.w, h: doc.h }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: doc.w, h: doc.h }, sourceSize: { w: doc.w, h: doc.h },
        pivot: { x: pv.x, y: 1 - pv.y },
      };
    });
    return {
      frames,
      meta: {
        app: 'http://www.codeandweb.com/texturepacker', generator: 'Dead Pixel', version: '1.0', target: 'paper2d',
        image: imageName, format: 'RGBA8888', size: { w: sheet.w, h: sheet.h }, scale: '1',
        frameTags: doc.tags.map((t) => ({ name: t.name, from: t.from, to: t.to, direction: t.dir || 'forward' })),
      },
    };
  };

  // ---------------------------------------------------------------- saving and opening on the user's machine
  /** Downloads bytes as a file (the browser's own save). */
  IO.download = function (bytes, name, type) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: type || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  /** Saves with the system's Save dialog where the browser has one, else a download. Resolves false if the user said no. */
  IO.save = async function (bytes, name, type, desc, ext) {
    if (root.showSaveFilePicker) {
      try {
        const h = await root.showSaveFilePicker({ suggestedName: name, types: [{ description: desc || name, accept: { [type || 'application/octet-stream']: [ext || name.slice(name.lastIndexOf('.'))] } }] });
        const w = await h.createWritable(); await w.write(bytes); await w.close();
        return h; // the file handle, so the caller can save back to it
      } catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    IO.download(bytes, name, type);
    return true;
  };
  // ---------------------------------------------------------------- files you can save back to (Chrome, Edge)
  /* The browser's File System Access API: a project opened or saved through it can be saved again in place.
     Handles for the recent list live in this browser's IndexedDB, never on the server. */
  IO.canSaveInPlace = () => !!(root.showOpenFilePicker && root.showSaveFilePicker);
  /** Picks a project or image and keeps its handle: {file, handle} or null. */
  IO.pickWithHandle = async function (accept) {
    if (!root.showOpenFilePicker) { const [file] = await IO.pick(accept); return file ? { file, handle: null } : null; }
    try {
      const [handle] = await root.showOpenFilePicker({ types: [{ description: 'Dead Pixel project or image', accept: { 'application/octet-stream': ['.deadpixel', '.json'], 'image/*': ['.png', '.gif', '.jpg', '.jpeg', '.webp'] } }] });
      return { file: await handle.getFile(), handle };
    } catch (e) { return null; }
  };
  /** Asks for permission (once per session) and reads or writes a handle. */
  IO.permit = async function (handle, mode) {
    const o = { mode: mode || 'read' };
    if ((await handle.queryPermission(o)) === 'granted') return true;
    return (await handle.requestPermission(o)) === 'granted';
  };
  IO.writeHandle = async function (handle, bytes) {
    if (!(await IO.permit(handle, 'readwrite'))) return false;
    const w = await handle.createWritable(); await w.write(bytes); await w.close();
    return true;
  };
  function recentDB() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('deadpixel', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('recent', { keyPath: 'name' });
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  const recentTx = async (mode, fn) => {
    const db = await recentDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recent', mode), st = tx.objectStore('recent'), out = fn(st);
      tx.oncomplete = () => resolve(out && out.result); tx.onerror = () => reject(tx.error);
    });
  };
  IO.recent = {
    MAX: 8,
    async list() { try { return ((await recentTx('readonly', (s) => s.getAll())) || []).sort((a, b) => b.at - a.at); } catch (e) { return []; } },
    async add(handle) {
      if (!handle) return;
      try {
        await recentTx('readwrite', (s) => s.put({ name: handle.name, handle, at: Date.now() }));
        const all = await IO.recent.list();
        for (const old of all.slice(IO.recent.MAX)) await recentTx('readwrite', (s) => s.delete(old.name));
      } catch (e) { /* storage blocked: no recent list */ }
    },
    async remove(name) { try { await recentTx('readwrite', (s) => s.delete(name)); } catch (e) { /* ignore */ } },
  };

  /** Opens files the user picks. */
  IO.pick = function (accept, multiple) {
    return new Promise((resolve) => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = accept || ''; i.multiple = !!multiple;
      i.onchange = () => resolve([...i.files]); i.click();
    });
  };
  /** An image file to RGBA. */
  IO.readImage = async function (file) {
    const bmp = await createImageBitmap(file);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, rgba: d.data };
  };

  // ---------------------------------------------------------------- palettes in other formats
  IO.paletteToGPL = (pal, name) => 'GIMP Palette\nName: ' + (name || 'Dead Pixel') + '\nColumns: 8\n#\n' + pal.map((c, i) => c.slice(0, 3).map((v) => String(v).padStart(3)).join(' ') + '\tColour ' + i).join('\n') + '\n';
  IO.paletteToHex = (pal) => pal.map((c) => DP.rgbaToHex(c).slice(1)).join('\n') + '\n';
  IO.paletteToJASC = (pal) => 'JASC-PAL\n0100\n' + pal.length + '\n' + pal.map((c) => c.slice(0, 3).join(' ')).join('\n') + '\n';
  /** Reads .gpl, .pal (JASC), .hex or any text with hex codes. */
  IO.parsePalette = function (text) {
    const lines = text.split(/\r?\n/);
    if (/^GIMP Palette/.test(lines[0])) return lines.slice(1).map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)/)).filter(Boolean).map((m) => [+m[1], +m[2], +m[3], 255]);
    if (/^JASC-PAL/.test(lines[0])) return lines.slice(3).map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)/)).filter(Boolean).map((m) => [+m[1], +m[2], +m[3], 255]);
    const hexes = text.match(/#?\b[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b/g) || [];
    return hexes.map(DP.hexToRgba).filter(Boolean);
  };
})(typeof window !== 'undefined' ? window : globalThis);
