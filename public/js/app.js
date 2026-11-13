/* Dead Pixel: the editor. State, the canvas view (zoom, pan, grid, onion skin, tiled copies, symmetry, lighting
   preview), the tools and the keyboard. Panels, timeline and menus are in ui-*.js, wired up at the end. */
(function (root) {
  'use strict';
  const DP = root.DP;
  const T = DP.Tools;
  const $ = (id) => document.getElementById(id);

  // ================================================================ state
  const app = (DP.app = {
    doc: null,
    history: new DP.History(256),
    frame: 0,
    layerId: null,
    range: null,                    // selected frames in the timeline {from, to}
    tool: 'pencil',
    primary: [255, 191, 102, 255], secondary: [19, 17, 24, 255],
    primaryIndex: -1, secondaryIndex: -1,
    linkEntry: false,               // the colour picker edits the primary's palette entry
    palSel: null,                   // palette range {from, to}
    brush: { size: 1, shape: 'square', custom: null, ownColours: true },
    brushes: [],                    // saved custom brushes
    pixelPerfect: true,
    ink: 'simple',                  // simple | shading | dither
    dither: { pattern: 'checker 50%', level: 0.5, fillAlt: false },
    shapeFilled: false,
    fillContiguous: true,
    gradient: { steps: 4, dither: 0, radial: false },
    selOp: 'replace',
    wandContiguous: true,
    tiled: 'none',                  // none | x | y | both
    symmetry: { x: false, y: false, cx: 0, cy: 0 },
    selection: null,                // {mask}
    clipboard: null,
    zoom: 8, panX: 0, panY: 0,
    showGrid: true, showTileGrid: false,
    onion: { on: false, prev: 1, next: 1, opacity: 0.35, tint: true, above: false },
    playing: false, loopTag: -1,
    light: { preview: false, view: 'lit', sel: 0, animate: true },
    rotate: { angle: 0, scale: 1 },
    // pens, tablets and phones (saved per browser)
    input: { pressure: 'size', minSize: 1, curve: 'linear', fingers: 'auto', gestures: true, penSeen: false, undoMB: 256 },
  });
  try { Object.assign(app.input, JSON.parse(localStorage.getItem('deadpixel:input') || '{}')); } catch (e) { /* storage blocked */ }
  app.history.setLimitMB(app.input.undoMB);
  app.saveInput = () => { try { localStorage.setItem('deadpixel:input', JSON.stringify(app.input)); } catch (e) { /* storage blocked */ } };
  /** Pen pressure 0..1 after the chosen curve; mice and fingers always press fully. */
  app.pressureOf = function (e) {
    if (!e || e.pointerType !== 'pen' || !(e.pressure > 0)) return 1;
    const c = { soft: 0.6, linear: 1, firm: 1.8 }[app.input.curve] || 1;
    return Math.min(1, Math.pow(e.pressure, c));
  };

  // ================================================================ colours
  app.valueOf = function (which) {
    const doc = app.doc;
    const c = which === 'secondary' ? app.secondary : app.primary;
    if (doc.mode === 'indexed') {
      const k = which === 'secondary' ? app.secondaryIndex : app.primaryIndex;
      return k >= 0 && k < doc.palette.length ? k : DP.nearest(doc.palette, c);
    }
    return c[3] === 0 ? 0 : T.pack(c);
  };
  app.setColour = function (which, rgba, index) {
    const c = rgba.slice(0, 4); if (c.length < 4) c.push(255);
    if (which === 'secondary') { app.secondary = c; app.secondaryIndex = index === undefined ? -1 : index; }
    else { app.primary = c; app.primaryIndex = index === undefined ? -1 : index; }
    if (app.doc.mode === 'indexed') {
      if (which === 'secondary' && app.secondaryIndex < 0) app.secondaryIndex = DP.nearest(app.doc.palette, c);
      if (which !== 'secondary' && app.primaryIndex < 0) app.primaryIndex = DP.nearest(app.doc.palette, c);
    }
    DP.UI && DP.UI.colourChanged();
  };
  app.swapColours = function () {
    [app.primary, app.secondary] = [app.secondary, app.primary];
    [app.primaryIndex, app.secondaryIndex] = [app.secondaryIndex, app.primaryIndex];
    DP.UI.colourChanged();
  };
  /** The shading ramp: the palette range if one is selected, else the whole palette, dark to light. */
  app.shadeRamp = function () {
    const doc = app.doc;
    let idx = doc.palette.map((_, i) => i);
    if (app.palSel && app.palSel.to > app.palSel.from) idx = idx.slice(app.palSel.from, app.palSel.to + 1);
    idx.sort((a, b) => DP.lum(doc.palette[a]) - DP.lum(doc.palette[b]));
    return doc.mode === 'indexed' ? idx : idx.map((i) => T.pack(doc.palette[i]));
  };
  app.rampValues = function (n) {
    const doc = app.doc;
    if (app.palSel && app.palSel.to > app.palSel.from) {
      const idx = []; for (let i = app.palSel.from; i <= app.palSel.to; i++) idx.push(i);
      return doc.mode === 'indexed' ? idx : idx.map((i) => T.pack(doc.palette[i]));
    }
    const cols = DP.ramp(app.primary, app.secondary, n, false);
    return cols.map((c) => (doc.mode === 'indexed' ? DP.nearest(doc.palette, c) : T.pack(c)));
  };

  // ================================================================ document lifecycle
  app.setDoc = function (doc, keepHistory) {
    app.doc = doc;
    if (!keepHistory) { app.file = null; app.savedVersion = doc.version; }
    app.frame = Math.min(app.frame, doc.frames.length - 1);
    if (!keepHistory) { app.history.clear(); app.frame = 0; }
    const visible = doc.layers.filter((l) => l.kind !== 'group');
    if (!doc.layer(app.layerId)) app.layerId = (visible[visible.length - 1] || doc.layers[0] || {}).id || null;
    app.selection = null; app.range = null;
    app.symmetry.cx = doc.w / 2; app.symmetry.cy = doc.h / 2;
    if (doc.lighting) for (const L of doc.lighting.lights) if (!L.placed) { L.x = Math.round(doc.w * 0.3); L.y = Math.round(doc.h * 0.25); L.placed = true; }
    if (doc.mode === 'indexed') { app.primaryIndex = DP.nearest(doc.palette, app.primary); app.secondaryIndex = DP.nearest(doc.palette, app.secondary); app.linkEntry = true; }
    else app.linkEntry = false;
    cache.clear();
    if (!keepHistory) app.fit();
    app.refreshAll();
  };
  app.layer = () => app.doc.layer(app.layerId);
  app.refreshAll = function () {
    DP.UI.refreshPanels(); DP.UI.refreshTimeline(); DP.UI.refreshDocInfo(); DP.UI.refreshOptions(); app.render();
  };
  app.history.onChange = function () {
    if (!app.doc) return;
    if (!app.doc.layer(app.layerId)) { const ls = app.doc.layers.filter((l) => l.kind !== 'group'); app.layerId = ls.length ? ls[ls.length - 1].id : null; }
    app.frame = Math.min(app.frame, app.doc.frames.length - 1);
    DP.UI.refreshTimeline(); DP.UI.refreshDocInfo(); DP.UI.refreshPanels(); app.render(); app.autosave();
  };
  app.mutate = (label, fn) => { const r = DP.mutate(app.doc, app.history, label, fn); app.refreshAll(); return r; };

  // ================================================================ view
  const view = $('view'), vg = view.getContext('2d');
  const docCanvas = document.createElement('canvas'), dg = docCanvas.getContext('2d');
  const cache = new Map();
  let dpr = 1;
  function resize() {
    const r = view.getBoundingClientRect();
    dpr = root.devicePixelRatio || 1;
    view.width = Math.max(1, Math.round(r.width * dpr)); view.height = Math.max(1, Math.round(r.height * dpr));
    app.render();
  }
  app.fit = function () {
    const r = view.getBoundingClientRect(), d = app.doc;
    if (!r.width || !d) return;
    const z = Math.max(1, Math.floor(Math.min((r.width - 40) / d.w, (r.height - 40) / d.h)));
    app.zoom = Math.min(64, z);
    app.panX = Math.round((r.width - d.w * app.zoom) / 2); app.panY = Math.round((r.height - d.h * app.zoom) / 2);
    DP.UI.refreshZoom(); app.render();
  };
  app.zoomAt = function (z, cx, cy) {
    const r = view.getBoundingClientRect();
    if (cx === undefined) { cx = r.width / 2; cy = r.height / 2; }
    z = Math.max(1, Math.min(64, z));
    const dx = (cx - app.panX) / app.zoom, dy = (cy - app.panY) / app.zoom;
    app.zoom = z; app.panX = Math.round(cx - dx * z); app.panY = Math.round(cy - dy * z);
    DP.UI.refreshZoom(); app.render();
  };
  const ZOOMS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  app.zoomStep = (dir, cx, cy) => { const i = ZOOMS.findIndex((z) => z >= app.zoom); const j = Math.max(0, Math.min(ZOOMS.length - 1, (ZOOMS[i] === app.zoom ? i : dir > 0 ? i - 1 : i) + dir)); app.zoomAt(ZOOMS[j], cx, cy); };

  /** The frame composited (cached until the document changes). */
  app.composite = function (f, opts) {
    const key = app.doc.version + '|' + f + '|' + (opts && opts.key || '');
    let c = cache.get(key);
    if (!c) { if (cache.size > 64) cache.clear(); c = app.doc.composite(f, opts); cache.set(key, c); }
    return c;
  };
  const mapCache = new Map();
  app.lightMap = function (f) {
    const L = app.doc.lighting;
    const key = app.doc.version + '|' + f + '|' + L.preset + '|' + JSON.stringify(L.planes);
    let m = mapCache.get(key);
    if (!m) { if (mapCache.size > 32) mapCache.clear(); m = DP.Lighting.generate(app.composite(f), app.doc.w, app.doc.h, L.preset, L.preset === 'Architecture' ? L.planes : null); mapCache.set(key, m); }
    return m;
  };
  /** What the canvas shows for a frame: the art, or the art lit / its light map. */
  app.displayed = function (f, view, t) {
    const d = app.doc, rgba = app.composite(f);
    view = view || (app.light.preview ? app.light.view : 'art');
    if (view === 'art') return rgba;
    if (view === 'normal' || view === 'mask') return DP.Lighting.mapView(app.lightMap(f), d.w, d.h, view);
    return DP.Lighting.render(rgba, d.w, d.h, app.lightMap(f), d.lighting, t || performance.now() / 1000, view === 'light' ? 'light' : 'lit');
  };

  function tinted(rgba, colour, alpha) {
    const out = new Uint8ClampedArray(rgba.length);
    for (let i = 0; i < rgba.length; i += 4) {
      if (!rgba[i + 3]) continue;
      if (colour) { out[i] = (rgba[i] + colour[0]) / 2; out[i + 1] = (rgba[i + 1] + colour[1]) / 2; out[i + 2] = (rgba[i + 2] + colour[2]) / 2; }
      else { out[i] = rgba[i]; out[i + 1] = rgba[i + 1]; out[i + 2] = rgba[i + 2]; }
      out[i + 3] = rgba[i + 3] * alpha;
    }
    return out;
  }
  function putDoc(rgba) {
    const d = app.doc;
    if (docCanvas.width !== d.w || docCanvas.height !== d.h) { docCanvas.width = d.w; docCanvas.height = d.h; }
    dg.putImageData(new ImageData(rgba, d.w, d.h), 0, 0);
  }

  // ================================================================ reference image and off-palette check (view only, never saved)
  app.reference = null;        // {img, opacity, above, fit, show, x, y, name}
  app.offPalette = false;
  let offCache = null;
  /** Pixels of the frame whose colour isn't in the palette, as a magenta overlay: {rgba, count}. */
  app.offPaletteMask = function (f) {
    const d = app.doc, key = d.version + '/' + f + '/' + d.palette.length;
    if (offCache && offCache.key === key) return offCache;
    const rgba = app.composite(f), pal = new Set(d.palette.map((c) => (c[0] << 16) | (c[1] << 8) | c[2]));
    const out = new Uint8ClampedArray(rgba.length); let count = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (!rgba[i + 3] || pal.has((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2])) continue;
      out[i] = 255; out[i + 1] = 0; out[i + 2] = 255; out[i + 3] = 255; count++;
    }
    offCache = { key, rgba: out, count };
    return offCache;
  };

  let raf = 0;
  app.render = function () { if (!raf) raf = requestAnimationFrame(draw); };
  let hover = null;   // doc pixel under the pointer
  let dragPreview = null; // tool overlays: {rect}, {lasso}
  function draw() {
    raf = 0;
    const d = app.doc; if (!d) return;
    const W = view.width, H = view.height, z = app.zoom * dpr, ox = app.panX * dpr, oy = app.panY * dpr;
    vg.setTransform(1, 0, 0, 1, 0, 0);
    vg.fillStyle = '#131118'; vg.fillRect(0, 0, W, H);
    vg.imageSmoothingEnabled = false;
    const tx = app.tiled === 'x' || app.tiled === 'both', ty = app.tiled === 'y' || app.tiled === 'both';
    const reps = [];
    for (let j = ty ? -1 : 0; j <= (ty ? 1 : 0); j++) for (let i = tx ? -1 : 0; i <= (tx ? 1 : 0); i++) reps.push([i, j]);
    // checks
    const cs = Math.max(4, Math.min(16, z * 2));
    for (const [i, j] of reps) {
      const x0 = ox + i * d.w * z, y0 = oy + j * d.h * z;
      vg.save(); vg.beginPath(); vg.rect(x0, y0, d.w * z, d.h * z); vg.clip();
      vg.fillStyle = '#bdbdbd'; vg.fillRect(x0, y0, d.w * z, d.h * z);
      vg.fillStyle = '#8f8f8f';
      for (let y = 0; y * cs < d.h * z; y++) for (let x = (y & 1); x * cs < d.w * z; x += 2) vg.fillRect(x0 + x * cs, y0 + y * cs, cs, cs);
      vg.restore();
    }
    // onion behind
    const drawImg = (rgba, alpha) => {
      putDoc(rgba);
      for (const [i, j] of reps) {
        vg.globalAlpha = (i || j) ? alpha * 0.6 : alpha;
        vg.drawImage(docCanvas, ox + i * d.w * z, oy + j * d.h * z, d.w * z, d.h * z);
      }
      vg.globalAlpha = 1;
    };
    const onion = () => {
      const o = app.onion;
      for (let k = o.prev; k >= 1; k--) { const f = app.frame - k; if (f >= 0) drawImg(tinted(app.composite(f), o.tint ? [255, 80, 80] : null, o.opacity / k), 1); }
      for (let k = o.next; k >= 1; k--) { const f = app.frame + k; if (f < d.frames.length) drawImg(tinted(app.composite(f), o.tint ? [120, 110, 255] : null, o.opacity / k), 1); }
    };
    const ref = app.reference;
    const drawRef = () => {
      if (!ref || !ref.show || !ref.img) return;
      const k = ref.fit ? Math.min(d.w / ref.img.width, d.h / ref.img.height) : 1;
      vg.save(); vg.beginPath(); vg.rect(ox, oy, d.w * z, d.h * z); vg.clip();
      vg.globalAlpha = ref.opacity; vg.imageSmoothingEnabled = ref.fit && k < 1;
      vg.drawImage(ref.img, ox + ref.x * z, oy + ref.y * z, ref.img.width * k * z, ref.img.height * k * z);
      vg.restore(); vg.globalAlpha = 1; vg.imageSmoothingEnabled = false;
    };
    if (ref && !ref.above) drawRef();
    if (app.onion.on && !app.onion.above && !app.playing) onion();
    drawImg(app.displayed(app.frame), 1);
    if (app.onion.on && app.onion.above && !app.playing) onion();
    if (ref && ref.above) drawRef();
    if (app.offPalette) {
      const m = app.offPaletteMask(app.frame);
      if (m.count) { putDoc(m.rgba); vg.globalAlpha = 0.85; vg.drawImage(docCanvas, ox, oy, d.w * z, d.h * z); vg.globalAlpha = 1; }
    }

    // grids
    if (app.showGrid && app.zoom >= 6) {
      vg.strokeStyle = 'rgba(255,255,255,0.09)'; vg.lineWidth = 1; vg.beginPath();
      for (let x = 0; x <= d.w; x++) { const X = Math.round(ox + x * z) + 0.5; vg.moveTo(X, oy); vg.lineTo(X, oy + d.h * z); }
      for (let y = 0; y <= d.h; y++) { const Y = Math.round(oy + y * z) + 0.5; vg.moveTo(ox, Y); vg.lineTo(ox + d.w * z, Y); }
      vg.stroke();
    }
    if (app.showTileGrid && d.grid.w > 0 && d.grid.h > 0) {
      vg.strokeStyle = 'rgba(255,191,102,0.45)'; vg.beginPath();
      for (let x = 0; x <= d.w; x += d.grid.w) { const X = Math.round(ox + x * z) + 0.5; vg.moveTo(X, oy); vg.lineTo(X, oy + d.h * z); }
      for (let y = 0; y <= d.h; y += d.grid.h) { const Y = Math.round(oy + y * z) + 0.5; vg.moveTo(ox, Y); vg.lineTo(ox + d.w * z, Y); }
      vg.stroke();
    }
    vg.strokeStyle = 'rgba(255,255,255,0.35)'; vg.strokeRect(ox - 0.5, oy - 0.5, d.w * z + 1, d.h * z + 1);
    // symmetry axes
    const s = app.symmetry;
    vg.setLineDash([6 * dpr, 4 * dpr]); vg.strokeStyle = '#9d8bff';
    if (s.x) { vg.beginPath(); vg.moveTo(ox + s.cx * z, oy); vg.lineTo(ox + s.cx * z, oy + d.h * z); vg.stroke(); }
    if (s.y) { vg.beginPath(); vg.moveTo(ox, oy + s.cy * z); vg.lineTo(ox + d.w * z, oy + s.cy * z); vg.stroke(); }
    vg.setLineDash([]);
    // selection outline (marching edge)
    if (app.selection) drawMaskEdge(app.selection.mask, ox, oy, z);
    if (dragPreview && dragPreview.rect) {
      const r = dragPreview.rect; vg.setLineDash([4 * dpr, 3 * dpr]); vg.strokeStyle = '#ffffff';
      vg.strokeRect(ox + r.x * z + 0.5, oy + r.y * z + 0.5, r.w * z, r.h * z); vg.setLineDash([]);
    }
    if (dragPreview && dragPreview.lasso) {
      vg.strokeStyle = '#ffffff'; vg.beginPath();
      dragPreview.lasso.forEach(([x, y], i) => (i ? vg.lineTo : vg.moveTo).call(vg, ox + x * z, oy + y * z)); vg.stroke();
    }
    if (dragPreview && dragPreview.line) {
      const [a, b] = dragPreview.line; vg.strokeStyle = '#ffbf66'; vg.beginPath(); vg.moveTo(ox + a[0] * z, oy + a[1] * z); vg.lineTo(ox + b[0] * z, oy + b[1] * z); vg.stroke();
    }
    // lights
    if (app.light.preview || app.tool === 'light') {
      d.lighting.lights.forEach((L, i) => {
        const X = ox + L.x * z, Y = oy + L.y * z;
        vg.strokeStyle = i === app.light.sel ? '#ffbf66' : '#ffffff'; vg.lineWidth = dpr * (i === app.light.sel ? 2 : 1);
        vg.beginPath(); vg.arc(X, Y, 6 * dpr, 0, Math.PI * 2); vg.stroke();
        vg.beginPath(); vg.moveTo(X - 10 * dpr, Y); vg.lineTo(X + 10 * dpr, Y); vg.moveTo(X, Y - 10 * dpr); vg.lineTo(X, Y + 10 * dpr); vg.stroke();
        if (i === app.light.sel) { vg.setLineDash([3 * dpr, 3 * dpr]); vg.beginPath(); vg.ellipse(X, Y, L.radius * z, L.radius * L.flatten * z, 0, 0, Math.PI * 2); vg.stroke(); vg.setLineDash([]); }
        vg.lineWidth = 1;
      });
      const P = d.lighting.planes;
      if (d.lighting.preset === 'Architecture' && P.kind !== 'none' && app.tool === 'light') {
        vg.strokeStyle = 'rgba(157,139,255,0.8)'; vg.setLineDash([5 * dpr, 4 * dpr]); vg.beginPath();
        if (P.kind === 'ground') { vg.moveTo(ox, oy + P.floorLine * z); vg.lineTo(ox + d.w * z, oy + P.floorLine * z); }
        else {
          vg.rect(ox + P.x0 * z, oy + P.y0 * z, (P.x1 - P.x0) * z, (P.y1 - P.y0) * z);
          vg.moveTo(ox, oy); vg.lineTo(ox + P.x0 * z, oy + P.y0 * z); vg.moveTo(ox + d.w * z, oy); vg.lineTo(ox + P.x1 * z, oy + P.y0 * z);
          vg.moveTo(ox, oy + d.h * z); vg.lineTo(ox + P.x0 * z, oy + P.y1 * z); vg.moveTo(ox + d.w * z, oy + d.h * z); vg.lineTo(ox + P.x1 * z, oy + P.y1 * z);
        }
        vg.stroke(); vg.setLineDash([]);
      }
    }
    // brush cursor
    if (hover && ['pencil', 'eraser', 'shade'].includes(app.tool)) {
      vg.strokeStyle = 'rgba(255,255,255,0.8)';
      const offs = app.brush.custom ? null : T.brushOffsets(app.brush.size, app.brush.shape);
      if (offs) for (const [px, py] of stroke0().mirrored(hover[0], hover[1])) for (const [dx, dy] of offs) vg.strokeRect(ox + (px + dx) * z + 0.5, oy + (py + dy) * z + 0.5, z - 1, z - 1);
      else { const c = app.brush.custom; vg.strokeRect(ox + (hover[0] - Math.floor(c.w / 2)) * z + 0.5, oy + (hover[1] - Math.floor(c.h / 2)) * z + 0.5, c.w * z, c.h * z); }
    }
    if (needsAnimation()) app.render();
  }
  function needsAnimation() {
    const L = app.doc.lighting;
    return app.light.preview && app.light.animate && L.lights.some((l) => !l.off && l.flicker !== 'Steady') && app.light.view !== 'normal' && app.light.view !== 'mask';
  }
  const stroke0 = () => ({ mirrored: (x, y) => T.Stroke.prototype.mirrored.call({ app }, x, y) });
  function drawMaskEdge(mask, ox, oy, z) {
    const d = app.doc, w = d.w, h = d.h;
    vg.beginPath();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      const X = ox + x * z, Y = oy + y * z;
      if (y === 0 || !mask[(y - 1) * w + x]) { vg.moveTo(X, Y + 0.5); vg.lineTo(X + z, Y + 0.5); }
      if (y === h - 1 || !mask[(y + 1) * w + x]) { vg.moveTo(X, Y + z - 0.5); vg.lineTo(X + z, Y + z - 0.5); }
      if (x === 0 || !mask[y * w + x - 1]) { vg.moveTo(X + 0.5, Y); vg.lineTo(X + 0.5, Y + z); }
      if (x === w - 1 || !mask[y * w + x + 1]) { vg.moveTo(X + z - 0.5, Y); vg.lineTo(X + z - 0.5, Y + z); }
    }
    vg.strokeStyle = '#000'; vg.lineWidth = 1; vg.stroke();
    vg.setLineDash([4, 4]); vg.lineDashOffset = -(performance.now() / 60) % 8; vg.strokeStyle = '#fff'; vg.stroke(); vg.setLineDash([]);
  }
  setInterval(() => { if (app.selection) app.render(); }, 150);

  // ================================================================ pointer input
  const toDoc = (e) => {
    const r = view.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left - app.panX) / app.zoom), Math.floor((e.clientY - r.top - app.panY) / app.zoom)];
  };
  const toDocF = (e) => {
    const r = view.getBoundingClientRect();
    return [(e.clientX - r.left - app.panX) / app.zoom, (e.clientY - r.top - app.panY) / app.zoom];
  };
  let active = null, panning = null, spaceDown = false;
  const pointers = new Map(); let pinch = null;

  view.addEventListener('contextmenu', (e) => e.preventDefault());
  // touch gestures: two-finger tap undoes, three-finger tap redoes
  let tap = null;
  view.addEventListener('pointerdown', (e) => {
    try { view.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already released */ }
    const touch = e.pointerType === 'touch';
    if (e.pointerType === 'pen' && !app.input.penSeen) { app.input.penSeen = true; app.saveInput(); }
    // palm rejection: once a pen is in use, a resting hand or finger pans instead of painting
    if (touch && active && active.pen) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (touch) {
      const nTouch = [...pointers.keys()].length;
      if (nTouch === 1) tap = { t: performance.now(), max: 1, moved: false, starts: new Map() };
      if (tap) { tap.max = Math.max(tap.max, nTouch); tap.starts.set(e.pointerId, [e.clientX, e.clientY]); }
    }
    if (pointers.size >= 2) {
      if (active && active.cancel) active.cancel(); active = null; panning = null;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: app.zoom, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, px: app.panX, py: app.panY };
      }
      app.render();
      return;
    }
    const fingersPan = touch && (app.input.fingers === 'pan' || (app.input.fingers === 'auto' && app.input.penSeen));
    if (e.button === 1 || spaceDown || app.tool === 'hand' || fingersPan) { panning = { x: e.clientX, y: e.clientY, px: app.panX, py: app.panY }; return; }
    // the pen's eraser end (or eraser button) erases whatever tool is chosen
    const penEraser = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32));
    const tool = TOOLS[penEraser ? 'eraser' : app.tool]; if (!tool) return;
    const p = toDoc(e);
    active = tool.down(p, e) || null;
    if (active) active.pen = e.pointerType === 'pen';
    app.render();
  });
  view.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (tap && tap.starts.has(e.pointerId)) { const s0 = tap.starts.get(e.pointerId); if (Math.hypot(e.clientX - s0[0], e.clientY - s0[1]) > 12) tap.moved = true; }
    if (!pointers.has(e.pointerId) && e.pointerType === 'touch') return;
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const r = view.getBoundingClientRect();
      app.panX = pinch.px + ((a[0] + b[0]) / 2 - pinch.mx); app.panY = pinch.py + ((a[1] + b[1]) / 2 - pinch.my);
      app.zoomAt(Math.round(pinch.z * d / pinch.d), (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
      return;
    }
    const p = toDoc(e);
    hover = p;
    DP.UI.status(p);
    if (panning) { app.panX = panning.px + e.clientX - panning.x; app.panY = panning.py + e.clientY - panning.y; app.render(); return; }
    if (active && active.move) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) active.move(toDoc(ev), ev);
    }
    app.render();
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (tap && e.pointerType === 'touch' && !pointers.size) {
      const quick = !tap.moved && performance.now() - tap.t < 350;
      if (quick && app.input.gestures && tap.max === 2) { app.history.undo(); DP.UI.toast('Undo'); }
      if (quick && app.input.gestures && tap.max === 3) { app.history.redo(); DP.UI.toast('Redo'); }
      tap = null;
    }
    if (pinch || pointers.size) { if (pointers.size < 2) pinch = null; panning = null; return; }
    if (panning) { panning = null; return; }
    if (active && active.up) active.up(toDoc(e), e);
    active = null; dragPreview = null;
    app.render();
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); tap = null; if (active && active.cancel) active.cancel(); active = null; panning = null; pinch = null; dragPreview = null; app.render(); });
  view.addEventListener('pointerleave', () => { hover = null; app.render(); });
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = view.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey || !e.shiftKey && Math.abs(e.deltaY) >= Math.abs(e.deltaX) && !e.altKey) app.zoomStep(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
    else { app.panX -= e.deltaX || e.deltaY; app.render(); }
  }, { passive: false });

  // ================================================================ tools
  function editableLayer() {
    const l = app.layer();
    if (!l) { DP.UI.toast('Add a layer first.'); return null; }
    if (l.kind === 'group') { DP.UI.toast('Pick a layer inside the group to paint on.'); return null; }
    if (l.locked) { DP.UI.toast('That layer is locked.'); return null; }
    if (!app.doc.shown(l)) { DP.UI.toast('That layer is hidden.'); return null; }
    return l;
  }
  function brushSpec() {
    if (app.brush.custom) return { custom: T.convertClip(app.doc, app.brush.custom), ownColours: app.brush.ownColours };
    return { offsets: T.brushOffsets(app.brush.size, app.brush.shape) };
  }
  function inkFor(e, erase) {
    const right = e.button === 2 || (e.buttons & 2);
    const doc = app.doc, l = app.layer();
    if (erase) return { kind: 'simple', value: l && l.kind === 'background' ? app.valueOf('secondary') : T.clearVal(doc) };
    if (app.ink === 'shading' || app.tool === 'shade') return { kind: 'shading', ramp: app.shadeRamp(), dir: right ? -1 : 1 };
    const value = app.valueOf(right ? 'secondary' : 'primary'), alt = app.valueOf(right ? 'primary' : 'secondary');
    if (app.ink === 'dither') return { kind: 'dither', value, alt, pattern: app.dither.pattern, level: app.dither.level, fillAlt: app.dither.fillAlt };
    return { kind: 'simple', value };
  }
  function freehandTool(erase) {
    return {
      down(p, e) {
        const l = editableLayer(); if (!l) return null;
        const s = new T.Stroke(app, l.id, app.frame), baseInk = inkFor(e, erase), baseBrush = brushSpec();
        // pen pressure: brush size between the minimum and the brush size, or dither density
        let pr = app.pressureOf(e);
        const at = (ev) => {
          const raw = app.pressureOf(ev); pr = pr * 0.5 + raw * 0.5;   // a little smoothing
          let brush = baseBrush, ink = baseInk, size = app.brush.size;
          if (ev.pointerType === 'pen' && !baseBrush.custom && app.input.pressure === 'size' && app.brush.size > 1) {
            const lo = Math.max(1, Math.min(app.brush.size, app.input.minSize | 0));
            size = Math.max(1, Math.round(lo + (app.brush.size - lo) * pr));
            brush = { offsets: T.brushOffsets(size, app.brush.shape) };
          }
          if (ev.pointerType === 'pen' && app.input.pressure === 'dither' && baseInk.kind !== 'shading' && !erase) {
            ink = { kind: 'dither', value: baseInk.value, alt: app.valueOf('secondary'), pattern: 'bayer 4x4 (level)', level: Math.round(pr * 16) / 16, fillAlt: false };
          }
          return { brush, ink, pp: app.pixelPerfect && !brush.custom && size === 1 };
        };
        let last = p;
        { const a = at(e); pr = app.pressureOf(e); T.freehand(s, p[0], p[1], a.brush, a.ink, a.pp); app.doc.touch(); }
        return {
          move(q, ev) {
            if (ev.shiftKey) return;
            if (q[0] === last[0] && q[1] === last[1]) return;
            const a = at(ev);
            last = q; T.freehand(s, q[0], q[1], a.brush, a.ink, a.pp); app.doc.touch();
          },
          up(q, ev) {
            if (ev.shiftKey && (q[0] !== p[0] || q[1] !== p[1])) { T.freehand(s, q[0], q[1], baseBrush, baseInk, false); }
            s.commit(app.history, erase ? 'Erase' : 'Paint');
          },
          cancel() { s.cancel(); },
        };
      },
    };
  }
  function shapeTool(kind) {
    return {
      down(p, e) {
        const l = editableLayer(); if (!l) return null;
        const s = new T.Stroke(app, l.id, app.frame), ink = inkFor(e, false), brush = brushSpec();
        const drawTo = (q, ev) => {
          s.reset();
          let [x1, y1] = q;
          if (ev.shiftKey) {
            const dx = x1 - p[0], dy = y1 - p[1];
            if (kind === 'line') {
              const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) * (Math.PI / 8), len = Math.max(Math.abs(dx), Math.abs(dy));
              const cos = Math.cos(a), sin = Math.sin(a), k = Math.abs(cos) > Math.abs(sin) ? len / Math.abs(cos) : len / Math.abs(sin);
              x1 = p[0] + Math.round(cos * k); y1 = p[1] + Math.round(sin * k);
            } else { const m = Math.max(Math.abs(dx), Math.abs(dy)); x1 = p[0] + Math.sign(dx || 1) * m; y1 = p[1] + Math.sign(dy || 1) * m; }
          }
          const filled = app.shapeFilled || ev.altKey;
          const pts = kind === 'line' ? T.line(p[0], p[1], x1, y1) : kind === 'rect' ? T.rect(p[0], p[1], x1, y1, filled) : T.ellipse(p[0], p[1], x1, y1, filled);
          const fillBrush = filled && kind !== 'line' ? { offsets: [[0, 0]] } : brush;
          for (const [x, y] of pts) T.dab(s, x, y, fillBrush, ink);
          app.doc.touch();
        };
        drawTo(p, e);
        return { move: drawTo, up: (q, ev) => { drawTo(q, ev); s.commit(app.history, kind === 'line' ? 'Line' : kind === 'rect' ? 'Rectangle' : 'Ellipse'); }, cancel: () => s.cancel() };
      },
    };
  }
  const TOOLS = (app.TOOLS = {
    pencil: freehandTool(false),
    eraser: freehandTool(true),
    shade: freehandTool(false),
    line: shapeTool('line'),
    rect: shapeTool('rect'),
    ellipse: shapeTool('ellipse'),
    fill: {
      down(p, e) {
        const l = editableLayer(); if (!l) return null;
        const s = new T.Stroke(app, l.id, app.frame);
        T.fill(s, p[0], p[1], inkFor(e, false), app.fillContiguous && !e.shiftKey);
        s.commit(app.history, 'Fill'); app.doc.touch();
        return null;
      },
    },
    gradient: {
      down(p, e) {
        const l = editableLayer(); if (!l) return null;
        const s = new T.Stroke(app, l.id, app.frame);
        const mask = T.region(app, s.before || s.data, p[0], p[1]);
        let values = app.rampValues(app.gradient.steps);
        if (e.button === 2) values = values.slice().reverse();
        const go = (q) => { s.reset(); dragPreview = { line: [[p[0] + 0.5, p[1] + 0.5], [q[0] + 0.5, q[1] + 0.5]] }; T.gradient(s, mask, p[0] + 0.5, p[1] + 0.5, q[0] + 0.5, q[1] + 0.5, values, app.gradient.dither, app.gradient.radial); app.doc.touch(); };
        return { move: go, up: (q) => { go(q); s.commit(app.history, 'Gradient'); }, cancel: () => s.cancel() };
      },
    },
    picker: {
      down(p, e) {
        const pick = (q, ev) => {
          const d = app.doc; if (q[0] < 0 || q[1] < 0 || q[0] >= d.w || q[1] >= d.h) return;
          const i = q[1] * d.w + q[0];
          const which = ev.button === 2 || (ev.buttons & 2) ? 'secondary' : 'primary';
          if (ev.altKey || ev.ctrlKey) { // the active layer's own pixel (gives the palette index in indexed mode)
            const c = d.cel(app.layerId, app.frame); if (!c) return;
            const v = T.getVal(d, c.data, i); if (T.isClear(d, v)) return;
            app.setColour(which, T.rgbaOf(d, v), d.mode === 'indexed' ? v : undefined);
          } else {
            const rgba = app.composite(app.frame); if (!rgba[i * 4 + 3]) return;
            const c = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], 255];
            const k = d.palette.findIndex((pc) => pc[0] === c[0] && pc[1] === c[1] && pc[2] === c[2]);
            app.setColour(which, c, k >= 0 ? k : undefined);
          }
        };
        pick(p, e);
        return { move: pick };
      },
    },
    select: {
      down(p, e) {
        const op = e.shiftKey ? 'add' : e.altKey ? 'subtract' : app.selOp;
        const base = app.selection ? app.selection.mask : null;
        let q = p;
        dragPreview = { rect: { x: p[0], y: p[1], w: 1, h: 1 } };
        return {
          move(r) { q = r; dragPreview = { rect: { x: Math.min(p[0], q[0]), y: Math.min(p[1], q[1]), w: Math.abs(q[0] - p[0]) + 1, h: Math.abs(q[1] - p[1]) + 1 } }; },
          up() {
            if (q[0] === p[0] && q[1] === p[1] && op === 'replace') { app.setSelection(null); return; }
            app.setSelection(T.selectRect(app.doc, p[0], p[1], q[0], q[1], base, op));
          },
        };
      },
    },
    lasso: {
      down(p, e) {
        const op = e.shiftKey ? 'add' : e.altKey ? 'subtract' : app.selOp;
        const base = app.selection ? app.selection.mask : null;
        const f = toDocF(e), pts = [f];
        dragPreview = { lasso: pts };
        return {
          move(_, ev) { pts.push(toDocF(ev)); dragPreview = { lasso: pts }; },
          up() { if (pts.length < 3) { app.setSelection(null); return; } app.setSelection(T.selectPolygon(app.doc, pts, base, op)); },
        };
      },
    },
    wand: {
      down(p, e) {
        const op = e.shiftKey ? 'add' : e.altKey ? 'subtract' : app.selOp;
        const c = app.doc.cel(app.layerId, app.frame);
        const data = c ? c.data : app.doc.newData();
        app.setSelection(T.selectWand(app.doc, data, p[0], p[1], app.selection && app.selection.mask, op, app.wandContiguous));
        return null;
      },
    },
    move: {
      down(p, e) {
        const l = editableLayer(); if (!l) return null;
        const d = app.doc, s = new T.Stroke(app, l.id, app.frame);
        const src = s.before || d.newData();
        const sel = app.selection ? app.selection.mask : null;
        const wrap = app.tiled !== 'none';
        app.selection = null; // the stroke must not clip to the old selection while moving
        const go = (q) => {
          const dx = q[0] - p[0], dy = q[1] - p[1];
          const clear = T.clearVal(d);
          if (sel) { s.data.set(src); for (let i = 0; i < sel.length; i++) if (sel[i]) T.setVal(d, s.data, i, clear); }
          else s.data.fill(d.mode === 'indexed' ? -1 : 0);
          for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
            const i = y * d.w + x;
            if (sel && !sel[i]) continue;
            let nx = x + dx, ny = y + dy;
            if (wrap) { nx = ((nx % d.w) + d.w) % d.w; ny = ((ny % d.h) + d.h) % d.h; }
            if (nx < 0 || ny < 0 || nx >= d.w || ny >= d.h) continue;
            const v = T.getVal(d, src, i);
            if (sel && T.isClear(d, v)) continue;
            T.setVal(d, s.data, ny * d.w + nx, v);
          }
          s.changed = dx !== 0 || dy !== 0;
          if (sel) {
            const m = new Uint8Array(sel.length);
            for (let i = 0; i < sel.length; i++) if (sel[i]) { const x = (i % d.w) + dx, y = ((i / d.w) | 0) + dy; if (x >= 0 && y >= 0 && x < d.w && y < d.h) m[y * d.w + x] = 1; }
            app.selection = { mask: m };
          }
          d.touch();
        };
        return {
          move: go,
          up: (q) => { go(q); s.commit(app.history, 'Move'); },
          cancel: () => { s.cancel(); app.selection = sel ? { mask: sel } : null; },
        };
      },
    },
    light: {
      down(p, e) {
        const L = app.doc.lighting;
        const f = toDocF(e);
        let best = -1, bd = 10 / app.zoom + 2;
        L.lights.forEach((l, i) => { const dd = Math.hypot(l.x - f[0], l.y - f[1]); if (dd < bd) { bd = dd; best = i; } });
        if (best >= 0) app.light.sel = best;
        if (!L.lights.length) return null;
        const before = app.doc.snapshot();
        const go = (q, ev) => { const g = toDocF(ev); const l = L.lights[app.light.sel]; l.x = Math.round(g[0]); l.y = Math.round(g[1]); l.placed = true; DP.UI.refreshLight(); };
        go(p, e);
        return { move: go, up: () => { const after = app.doc.snapshot(); app.history.push(DP.snapEntry(app.doc, 'Move light', before, after)); } };
      },
    },
    hand: { down() { return null; } },
  });
  app.TOOL_LIST = [
    ['pencil', 'Pencil', 'B'], ['eraser', 'Eraser', 'E'], ['shade', 'Shading ink', 'H'], ['fill', 'Fill', 'G'],
    ['line', 'Line', 'L'], ['rect', 'Rectangle', 'R'], ['ellipse', 'Ellipse', 'C'], ['gradient', 'Gradient', 'D'],
    ['select', 'Rectangle select', 'M'], ['lasso', 'Lasso select', 'Q'], ['wand', 'Magic wand', 'W'], ['move', 'Move', 'V'],
    ['picker', 'Eyedropper', 'I'], ['hand', 'Hand (pan)', 'Space'], ['light', 'Place lights', 'K'],
  ];
  app.setTool = function (t) { app.tool = t; DP.UI.refreshTools(); DP.UI.refreshOptions(); app.render(); };

  // ================================================================ selection and clipboard
  app.setSelection = function (mask) {
    if (mask && !mask.some((v) => v)) mask = null;
    app.selection = mask ? { mask } : null;
    app.render();
  };
  app.selectAll = () => app.setSelection(new Uint8Array(app.doc.w * app.doc.h).fill(1));
  app.invertSelection = () => { const m = app.selection ? app.selection.mask.map((v) => (v ? 0 : 1)) : new Uint8Array(app.doc.w * app.doc.h).fill(1); app.setSelection(m); };
  app.copy = function (cut) {
    const d = app.doc, c = d.cel(app.layerId, app.frame);
    const mask = app.selection && app.selection.mask;
    app.clipboard = T.copy(d, c ? c.data : null, mask);
    if (!app.clipboard) return;
    DP.UI.toast(cut ? 'Cut' : 'Copied');
    if (cut) app.clearSelected();
  };
  app.clearSelected = function () {
    const l = editableLayer(); if (!l) return;
    const s = new T.Stroke(app, l.id, app.frame);
    const v = l.kind === 'background' ? app.valueOf('secondary') : T.clearVal(app.doc);
    for (let i = 0; i < app.doc.w * app.doc.h; i++) if (!app.selection || app.selection.mask[i]) s.set(i, v);
    s.commit(app.history, 'Clear'); app.render();
  };
  app.paste = function () {
    const clip = app.clipboard; if (!clip) return;
    const l = editableLayer(); if (!l) return;
    const d = app.doc, c = T.convertClip(d, clip);
    app.selection = null;
    const s = new T.Stroke(app, l.id, app.frame), m = new Uint8Array(d.w * d.h);
    const x0 = Math.min(Math.max(0, c.x), Math.max(0, d.w - c.w)), y0 = Math.min(Math.max(0, c.y), Math.max(0, d.h - c.h));
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const v = c.vals[y * c.w + x]; if (T.isClear(d, v)) continue;
      const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= d.w || Y >= d.h) continue;
      s.set(Y * d.w + X, v); m[Y * d.w + X] = 1;
    }
    s.commit(app.history, 'Paste');
    app.setSelection(m); app.setTool('move');
    DP.UI.toast('Pasted: drag to place it');
  };
  /** Turns the selection (or the whole cel) into a custom brush. */
  app.brushFromSelection = function () {
    const d = app.doc, c = d.cel(app.layerId, app.frame);
    const clip = T.copy(d, c ? c.data : null, app.selection && app.selection.mask);
    if (!clip) { DP.UI.toast('Select something on the active layer first.'); return; }
    app.brushes.push(clip); app.brush.custom = clip;
    DP.UI.refreshBrushes(); DP.UI.refreshOptions(); app.setTool('pencil');
    DP.UI.toast('Saved as a brush (' + clip.w + 'x' + clip.h + ')');
  };

  // ================================================================ transforms (RotSprite, flips) on the selection or cel
  /** Applies fn(vals, w, h) -> vals to the selection's box, or the cel; every frame of the layer if all. */
  app.transformCels = function (label, fn, all) {
    const l = editableLayer(); if (!l) return;
    const d = app.doc, frames = all ? d.frames.map((_, i) => i) : [app.frame];
    const sel = app.selection && app.selection.mask;
    const box = sel ? T.maskBounds(d, sel) : { x: 0, y: 0, w: d.w, h: d.h };
    if (!box) return;
    const done = new Set();
    app.mutate(label, () => {
      let newMask = null;
      for (const f of frames) {
        const id = d.celId(l.id, f); if (!id || done.has(id)) continue; done.add(id);
        const data = d.celData[id].data.slice();
        const clear = T.clearVal(d);
        const vals = d.mode === 'indexed' ? new Int32Array(box.w * box.h) : new Uint32Array(box.w * box.h);
        for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
          const i = (box.y + y) * d.w + box.x + x;
          vals[y * box.w + x] = !sel || sel[i] ? T.getVal(d, data, i) : clear;
          if (!sel || sel[i]) T.setVal(d, data, i, clear);
        }
        const out = fn(vals, box.w, box.h, clear);
        newMask = sel ? new Uint8Array(d.w * d.h) : null;
        for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
          const v = out[y * box.w + x], i = (box.y + y) * d.w + box.x + x;
          if (T.isClear(d, v)) { if (!sel) T.setVal(d, data, i, v); continue; }
          T.setVal(d, data, i, v); if (newMask) newMask[i] = 1;
        }
        if (l.kind === 'background') for (let i = 0; i < d.w * d.h; i++) if (T.isClear(d, T.getVal(d, data, i))) T.setVal(d, data, i, app.valueOf('secondary'));
        d.celData[id] = { data };
      }
      if (newMask) app.selection = { mask: newMask };
    });
  };
  app.rotsprite = function (deg, scale, all) {
    app.transformCels('RotSprite ' + deg + '°', (v, w, h, clear) => {
      const big = Math.max(1, scale);
      // Room to grow: work on a canvas twice the box so corners aren't cut, then crop back to the box
      return DP.Transform.rotsprite(v, w, h, deg, big, big, w / 2, h / 2, clear);
    }, all);
  };
  /** Outline around (or inside the edge of) the art on the current layer, in the primary colour. */
  app.outline = function (mode, eight, all) {
    const l = editableLayer(); if (!l) return;
    const d = app.doc, frames = all ? d.frames.map((_, i) => i) : [app.frame], sel = app.selection && app.selection.mask;
    const value = app.valueOf('primary'), done = new Set();
    app.mutate('Outline', () => {
      for (const f of frames) {
        const id = d.celId(l.id, f); if (!id || done.has(id)) continue; done.add(id);
        const data = d.celData[id].data.slice(), n = d.w * d.h;
        const vals = d.mode === 'indexed' ? new Int32Array(n) : new Uint32Array(n);
        for (let i = 0; i < n; i++) vals[i] = T.getVal(d, data, i);
        const out = DP.outline(vals, d.w, d.h, (v) => T.isClear(d, v), value, mode, eight, sel);
        for (let i = 0; i < n; i++) if (out[i] !== vals[i]) T.setVal(d, data, i, out[i]);
        d.celData[id] = { data };
      }
    });
  };
  /** Crops the canvas to the drawn pixels on every frame and layer. */
  app.trimCanvas = function () {
    const b = app.doc.contentBounds();
    if (!b) { DP.UI.toast('Nothing drawn to trim to'); return; }
    if (b.w === app.doc.w && b.h === app.doc.h) { DP.UI.toast('Already trimmed'); return; }
    app.mutate('Trim canvas', () => app.doc.cropTo(b.x, b.y, b.w, b.h));
    app.selection = null; app.fit();
    DP.UI.toast('Trimmed to ' + b.w + '×' + b.h);
  };
  /**
   * Copies a tag's frames to the end as a new tag, mirrored left to right (WalkR to WalkL). Mirrors around the
   * pivot when the file has one (converted characters), otherwise around the canvas centre. Links inside the tag stay.
   */
  app.mirrorTag = function (ti, name) {
    const d = app.doc, t = d.tags[ti]; if (!t) return;
    const px = d.pivot ? d.pivot[0] : d.w / 2, n = t.to - t.from + 1, at = d.frames.length;
    app.mutate('Mirror tag', () => {
      const map = new Map();
      for (let k = 0; k < n; k++) {
        const f = t.from + k; d.frames.push({ duration: d.frames[f].duration });
        for (const l of d.layers) {
          const id = d.cels[l.id + '/' + f]; if (!id) continue;
          if (!map.has(id)) {
            const src = d.celData[id].data, data = d.newData();
            for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
              const X = Math.round(2 * px - 1 - x); if (X < 0 || X >= d.w) continue;
              T.setVal(d, data, y * d.w + X, T.getVal(d, src, y * d.w + x));
            }
            const nid = DP.newId(); d.celData[nid] = { data }; map.set(id, nid);
          }
          d.cels[l.id + '/' + (at + k)] = map.get(id);
        }
      }
      d.tags.push({ name, from: at, to: at + n - 1, colour: t.colour, dir: t.dir });
    });
    app.goFrame(at);
  };
  app.flip = (axis, all) => app.transformCels(axis === 'h' ? 'Flip horizontal' : 'Flip vertical', (v, w, h) => (axis === 'h' ? DP.Transform.flipH(v, w, h) : DP.Transform.flipV(v, w, h)), all);

  // ================================================================ playback
  let playTimer = 0;
  app.playFrames = function () {
    const d = app.doc, t = app.loopTag >= 0 ? d.tags[app.loopTag] : null;
    if (!t) return d.frames.map((_, i) => i);
    const fwd = []; for (let i = t.from; i <= t.to; i++) fwd.push(i);
    if (t.dir === 'reverse') return fwd.reverse();
    if (t.dir === 'pingpong') return fwd.concat(fwd.slice(1, -1).reverse());
    return fwd;
  };
  app.togglePlay = function () {
    app.playing = !app.playing;
    clearTimeout(playTimer);
    if (app.playing) {
      const seq = app.playFrames();
      let k = Math.max(0, seq.indexOf(app.frame));
      const step = () => {
        if (!app.playing) return;
        app.frame = seq[k]; DP.UI.refreshTimelineCursor(); app.render();
        playTimer = setTimeout(step, app.doc.frames[seq[k]].duration);
        k = (k + 1) % seq.length;
      };
      step();
    }
    DP.UI.refreshPlay();
  };
  app.goFrame = function (f) {
    const n = app.doc.frames.length;
    app.frame = ((f % n) + n) % n;
    DP.UI.refreshTimelineCursor(); DP.UI.refreshDocInfo(); app.render();
  };

  // ================================================================ keyboard
  /* Every shortcut is an entry here: [id, what it does, default keys]. People can rebind them in
     View > Preferences > Keyboard shortcuts; their choices are kept with the other preferences in this browser. */
  const ui = (a) => () => DP.UI.action(a);
  const KEYS = [
    ...[
      ['pencil', 'B'], ['eraser', 'E'], ['shade', 'H'], ['fill', 'G'], ['line', 'L'], ['rect', 'R'], ['ellipse', 'C'], ['gradient', 'D'],
      ['select', 'M'], ['lasso', 'Q'], ['wand', 'W'], ['move', 'V'], ['picker', 'I'], ['light', 'K'],
    ].map(([t, k]) => ['tool:' + t, 'Tool: ' + app.TOOL_LIST.find((x) => x[0] === t)[1], [k], () => app.setTool(t)]),
    ['undo', 'Undo', ['Ctrl+Z'], () => app.history.undo()],
    ['redo', 'Redo', ['Ctrl+Y', 'Ctrl+Shift+Z'], () => app.history.redo()],
    ['copy', 'Copy', ['Ctrl+C'], () => app.copy(false)],
    ['cut', 'Cut', ['Ctrl+X'], () => app.copy(true)],
    ['paste', 'Paste', ['Ctrl+V'], () => app.paste()],
    ['selectAll', 'Select all', ['Ctrl+A'], () => app.selectAll()],
    ['deselect', 'Deselect', ['Ctrl+D', 'Escape'], () => app.setSelection(null)],
    ['clear', 'Clear selection or cel', ['Delete', 'Backspace'], () => app.clearSelected()],
    ['brush', 'Brush from selection', ['Ctrl+B'], () => app.brushFromSelection()],
    ['new', 'New sprite', ['Ctrl+N'], ui('new')],
    ['open', 'Open', ['Ctrl+O'], ui('open')],
    ['save', 'Save project', ['Ctrl+S'], ui('save')],
    ['saveAs', 'Save as', ['Ctrl+Shift+S'], ui('saveAs')],
    ['exportSheet', 'Export sprite sheet', ['Ctrl+E'], ui('exportSheet')],
    ['newFrame', 'New frame', ['Alt+N'], ui('newFrame')],
    ['prevFrame', 'Previous frame', [','], () => app.goFrame(app.frame - 1)],
    ['nextFrame', 'Next frame', ['.'], () => app.goFrame(app.frame + 1)],
    ['play', 'Play / pause', ['Enter'], () => app.togglePlay()],
    ['swap', 'Swap colours', ['X'], () => app.swapColours()],
    ['sizeDown', 'Brush smaller', ['['], () => { app.brush.size = Math.max(1, app.brush.size - 1); app.brush.custom = null; DP.UI.refreshOptions(); app.render(); }],
    ['sizeUp', 'Brush bigger', [']'], () => { app.brush.size = Math.min(64, app.brush.size + 1); app.brush.custom = null; DP.UI.refreshOptions(); app.render(); }],
    ['zoomIn', 'Zoom in', ['+', '='], () => app.zoomStep(1)],
    ['zoomOut', 'Zoom out', ['-', '_'], () => app.zoomStep(-1)],
    ['fit', 'Fit', ['0', ')'], () => app.fit()],
    ['pixelPerfect', 'Pixel perfect', ['P'], () => { app.pixelPerfect = !app.pixelPerfect; DP.UI.refreshOptions(); DP.UI.toast('Pixel perfect ' + (app.pixelPerfect ? 'on' : 'off')); }],
    ['onion', 'Onion skin', ['O'], () => { app.onion.on = !app.onion.on; DP.UI.refreshTimelineBar(); app.render(); }],
    ['tiled', 'Tiled mode: next', ['T'], () => { const order = ['none', 'x', 'y', 'both']; app.tiled = order[(order.indexOf(app.tiled) + 1) % 4]; DP.UI.refreshOptions(); app.render(); DP.UI.toast('Tiled mode: ' + app.tiled); }],
    ['mirrorX', 'Mirror X', ['S'], () => { app.symmetry.x = !app.symmetry.x; DP.UI.refreshOptions(); app.render(); }],
    ['preview', 'Preview window', ['F2'], () => DP.UI.togglePreview()],
    ['grid', 'Pixel grid', ['#'], () => { app.showGrid = !app.showGrid; app.render(); }],
    ['history', 'History panel', ['Ctrl+H'], () => DP.UI.showTab('history')],
  ];
  app.KEYS = KEYS;
  /** The keys an action is bound to now (the person's choice, or the default). */
  app.keysFor = (id) => { const e = KEYS.find((k) => k[0] === id); const mine = app.input.keys && app.input.keys[id]; return mine || (e ? e[2] : []); };
  app.keyLabel = (id) => app.keysFor(id).join(' / ');
  /** A key press as text: 'Ctrl+Shift+S', 'B', '[', 'F2'. Shift only counts for letters and named keys. */
  app.comboOf = function (e) {
    let k = e.key; if (!k || ['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return '';
    if (k === ' ') k = 'Space';
    const letter = k.length === 1 && /[a-z]/i.test(k), named = k.length > 1;
    if (k.length === 1) k = k.toUpperCase();
    return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey && (letter || named) ? 'Shift+' : '') + k;
  };
  root.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!$('modalBack').hidden) { if (e.key === 'Escape') DP.UI.closeModal(); return; }
    if (e.code === 'Space') { spaceDown = true; view.style.cursor = 'grab'; e.preventDefault(); return; }
    const combo = app.comboOf(e); if (!combo) return;
    // Alt+N comes through as a special character on some keyboards, so match the physical key too
    const alt = e.altKey && e.code && /^Key[A-Z]$/.test(e.code) ? (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + 'Alt+' + (e.shiftKey ? 'Shift+' : '') + e.code.slice(3) : null;
    const hit = KEYS.find((k) => { const ks = app.keysFor(k[0]); return ks.includes(combo) || (alt && ks.includes(alt)); });
    if (!hit) return;
    e.preventDefault();
    hit[3]();
  });
  root.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; view.style.cursor = ''; } });

  // ================================================================ saved state
  app.file = null;             // a file handle Ctrl+S writes back to (Chrome, Edge), or null
  app.savedVersion = 0;        // doc.version when last opened or saved
  app.isDirty = () => !!app.doc && app.doc.version !== app.savedVersion && app.history.undoStack.length > 0;
  app.markSaved = () => { app.savedVersion = app.doc.version; DP.UI.refreshDocInfo(); };
  root.addEventListener('beforeunload', (e) => { if (app.isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  // ================================================================ autosave (this browser only)
  let saveTimer = 0;
  app.autosave = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const bytes = await DP.IO.saveProject(app.doc);
        let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        localStorage.setItem('deadpixel:autosave', btoa(s));
      } catch (e) { /* storage full or blocked: the session still works */ }
    }, 1500);
  };
  app.restoreAutosave = async function () {
    try {
      const s = localStorage.getItem('deadpixel:autosave'); if (!s) return null;
      const b = atob(s), bytes = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
      return await DP.IO.loadProject(bytes);
    } catch (e) { return null; }
  };

  // ================================================================ the example sprite shown on first open
  app.exampleDoc = function () {
    const d = new DP.Doc(48, 48, 'rgb');
    d.name = 'lantern-ghost';
    d.palette = DP.allPresets()['Room: Pier'] ? DP.allPresets()['DB32'].map((c) => c.slice()) : DP.PRESETS.DB32.map((c) => c.slice());
    const bg = d.addLayer('Floor', 'layer');
    const g = d.addLayer('Ghost', 'group');
    const body = d.addLayer('Body', 'layer', { parent: g.id });
    const glow = d.addLayer('Glow', 'layer', { parent: g.id, blend: 'screen', opacity: 160 });
    for (let f = 1; f < 4; f++) d.addFrame(f);
    d.frames.forEach((fr) => (fr.duration = 140));
    const P = (hex) => T.pack(DP.hexToRgba(hex));
    const put = (lid, f, pts, v) => {
      const key = lid + '/' + f; let id = d.cels[key];
      if (!id) { id = DP.newId(); d.celData[id] = { data: d.newData() }; d.cels[key] = id; }
      for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < d.w && y < d.h) T.setVal(d, d.celData[id].data, y * d.w + x, v);
    };
    for (let f = 0; f < 4; f++) {
      const bob = [0, -1, -2, -1][f];
      put(bg.id, f, T.rect(4, 40, 43, 47, true), P('3f3f74'));
      put(bg.id, f, T.rect(4, 40, 43, 40, true), P('5b6ee1'));
      put(bg.id, f, T.ellipse(14, 41, 33, 45, true), P('222034'));
      const cy = 14 + bob;
      put(body.id, f, T.ellipse(14, cy, 33, cy + 22, true), P('cbdbfc'));
      put(body.id, f, T.rect(14, cy + 12, 33, cy + 26, true), P('cbdbfc'));
      for (let x = 14; x <= 33; x++) if (((x + f) & 3) < 2) put(body.id, f, [[x, cy + 27]], P('cbdbfc'));
      put(body.id, f, T.ellipse(14, cy, 33, cy + 22, false), P('222034'));
      put(body.id, f, T.line(14, cy + 11, 14, cy + 26), P('222034'));
      put(body.id, f, T.line(33, cy + 11, 33, cy + 26), P('222034'));
      put(body.id, f, T.rect(28, cy + 8, 32, cy + 25, true), P('9badb7'));
      put(body.id, f, T.rect(19, cy + 8, 20, cy + 11, true), P('222034'));
      put(body.id, f, T.rect(26, cy + 8, 27, cy + 11, true), P('222034'));
      put(body.id, f, T.rect(22, cy + 15, 24, cy + 16, true), P('45283c'));
      put(body.id, f, T.rect(36, cy + 14, 41, cy + 20, true), P('df7126'));
      put(body.id, f, T.rect(37, cy + 15, 40, cy + 19, true), P('fbf236'));
      put(body.id, f, T.line(38, cy + 10, 38, cy + 13), P('222034'));
      put(glow.id, f, T.ellipse(33, cy + 11, 44, cy + 23, true), P('8f563b'));
    }
    d.tags.push({ name: 'Idle', from: 0, to: 3, colour: '#ffbf66', dir: 'pingpong' });
    d.lighting.ambient = [120, 120, 170]; d.lighting.darkness = 0.45;
    d.lighting.lights = [{ name: 'Lantern', x: 39, y: 30, radius: 40, flatten: 1, colour: [255, 191, 102], intensity: 0.7, height: -1, flicker: 'Candle', shadow: false, placed: true }];
    d.gc();
    return d;
  };

  // ================================================================ samples
  /** Opens a sample sprite and switches on the view settings it shows off (onion skin, tiled mode, lighting, preview). */
  app.openSample = function (key) {
    const d = key === 'ghost' ? app.exampleDoc() : DP.Samples[key]();
    const v = d.view || {}; delete d.view;
    if (app.playing) app.togglePlay();
    app.onion.on = !!v.onion;
    app.tiled = v.tiled || 'none';
    app.showTileGrid = !!v.tileGrid;
    app.light.preview = !!v.lightPreview;
    app.loopTag = v.loopTag !== undefined && d.tags.length ? v.loopTag : -1;
    if (v.brushes) for (const b of v.brushes) if (!app.brushes.includes(b)) app.brushes.push(b);
    app.setDoc(d);
    DP.UI.refreshTimelineBar && DP.UI.refreshTimelineBar();
    // size the preview so it stays a corner window rather than covering the canvas
    const pz = document.getElementById('pvZoom'); if (pz) pz.value = String(Math.max(1, Math.min(4, Math.floor(160 / Math.max(d.w, d.h)))));
    DP.UI.togglePreview(!!v.preview);
    if (v.preview && !app.playing) app.togglePlay();
    app.autosave();
    DP.UI.toast(v.note || ('Opened ' + d.name));
  };

  // ================================================================ start
  app.start = async function () {
    const restored = await app.restoreAutosave();
    app.doc = restored || app.exampleDoc();
    DP.UI.build();
    new ResizeObserver(resize).observe(view);
    app.setDoc(app.doc);
    if (restored) DP.UI.toast('Restored your last session from this browser');
    app.layerId = app.layerId || (app.doc.layers[app.doc.layers.length - 1] || {}).id;
    resize(); app.fit();
  };
  root.addEventListener('DOMContentLoaded', () => app.start());
})(window);
