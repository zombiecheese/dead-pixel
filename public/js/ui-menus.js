/* Dead Pixel: menus, dialogs and every action (file, edit, sprite, layer, frame, view, exports). */
(function (root) {
  'use strict';
  const DP = root.DP, app = DP.app, UI = DP.UI, h = UI.h, IO = DP.IO, T = DP.Tools;
  const $ = (id) => document.getElementById(id);
  const val = (id) => { const el = $(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };
  const field = (label, input) => [h('label', { for: input.id }, label), input];
  const numIn = (id, v, min, max, step) => h('input', { type: 'number', id, value: v, min, max, step: step || 1 });
  const selIn = (id, opts, v) => { const s = h('select', { id }); for (const o of opts) { const [a, b] = Array.isArray(o) ? o : [o, o]; s.append(h('option', { value: a }, b)); } s.value = v; return s; };
  const chkIn = (id, v) => h('input', { type: 'checkbox', id, checked: !!v });

  // ================================================================ menus
  const MENUS = [
    ['File', [['New sprite…', 'new', 'Ctrl+N'], ['Open…', 'open', 'Ctrl+O'], ['Open recent…', 'openRecent'], ['Save project (.deadpixel)', 'save', 'Ctrl+S'], ['Save as…', 'saveAs', 'Ctrl+Shift+S'], '-',
      { sub: 'Samples (open one to explore)' }, ...DP.Samples.LIST.map(([k, label]) => [label, 'sample:' + k]), ['Lantern ghost (the start-up sprite)', 'sample:ghost'], '-',
      ['Import image as new sprite…', 'importImage'], ['Import image as layer…', 'importLayer'], ['Import sprite sheet…', 'importSheet'], '-',
      { sub: 'Export (saved to your computer)' }, ['Sprite sheet for Unity / Unreal…', 'exportSheet', 'Ctrl+E'], ['Frames for PowerQuest (zip of PNGs)…', 'exportFrames'], ['This frame as PNG…', 'exportPNG'], ['Animated GIF…', 'exportGIF'], '-',
      ['Unity importer script (C#)', 'unityScript']]],
    ['Edit', [['Undo', 'undo', 'Ctrl+Z'], ['Redo', 'redo', 'Ctrl+Y'], '-', ['Cut', 'cut', 'Ctrl+X'], ['Copy', 'copy', 'Ctrl+C'], ['Paste', 'paste', 'Ctrl+V'], ['Clear', 'clear', 'Del'], '-',
      ['Select all', 'selectAll', 'Ctrl+A'], ['Deselect', 'deselect', 'Ctrl+D'], ['Invert selection', 'invert'], ['New brush from selection', 'brush', 'Ctrl+B'], '-',
      ['Flip horizontal', 'flipH'], ['Flip vertical', 'flipV'], ['Rotate / scale (RotSprite)…', 'rotsprite'], ['Outline…', 'outline']]],
    ['Sprite', [['Properties…', 'properties'], ['Canvas size…', 'canvasSize'], ['Trim canvas to content', 'trimCanvas'], ['Scale…', 'scaleDoc'], '-', ['RGB colour', 'modeRGB'], ['Indexed colour…', 'modeIndexed'], ['Keep blends on the palette (indexed)', 'toggleSnap']]],
    ['Layer', [['New layer', 'newLayer'], ['New group', 'newGroup'], ['New background layer', 'newBackground'], ['Duplicate', 'dupLayer'], ['Delete', 'delLayer'], '-', ['Merge down', 'mergeDown'], ['Layer properties…', 'layerProps']]],
    ['Frame', [['New frame', 'newFrame', 'Alt+N'], ['Duplicate frame', 'dupFrame'], ['Delete frame', 'delFrame'], ['Frame duration…', 'durationDialog'], '-', ['Link cels', 'linkCels'], ['Unlink cels', 'unlinkCels'], '-', ['New tag…', 'newTag'], ['Mirror tag into a new tag…', 'mirrorTag'], ['Play / pause', 'play', 'Enter']]],
    ['View', [['Zoom in', 'zoomIn', '+'], ['Zoom out', 'zoomOut', '-'], ['Fit', 'fit', '0'], '-', ['Pixel grid', 'toggleGrid', '#'], ['Tile grid', 'toggleTileGrid'], ['Tile grid size…', 'tileGridSize'], ['Onion skin', 'toggleOnion', 'O'], ['Tiled mode: next', 'nextTiled', 'T'], '-', ['Preview window', 'preview', 'F2'], ['Lighting preview', 'toggleLight'], '-', ['Reference image…', 'reference'], ['Highlight off-palette colours', 'toggleOffPalette'], '-', ['Preferences…', 'penTouch'], ['Keyboard shortcuts…', 'keyboard']]],
    ['Help', [['Shortcuts', 'shortcuts'], ['About Dead Pixel', 'about']]],
  ];
  UI.buildMenus = function () {
    const nav = $('menus'); nav.innerHTML = '';
    let open = null;
    const close = () => { if (open) { open.list.hidden = true; open.btn.setAttribute('aria-expanded', 'false'); open = null; } };
    for (const [name, items] of MENUS) {
      const list = h('div', { class: 'menu-list', hidden: true, role: 'menu' });
      for (const it of items) {
        if (it === '-') { list.append(h('hr')); continue; }
        if (it.sub) { list.append(h('div', { class: 'sub' }, it.sub)); continue; }
        const kb = app.KEYS.some((k) => k[0] === it[1]) ? app.keyLabel(it[1]) : it[2];
        list.append(h('button', { role: 'menuitem', onclick: () => { close(); const [a, arg] = it[1].split(':'); UI.action(a, arg); } }, h('span', null, it[0]), kb ? h('kbd', null, kb) : null));
      }
      const btn = h('button', { 'aria-haspopup': 'true', 'aria-expanded': 'false', onclick: (e) => { e.stopPropagation(); const was = open && open.list === list; close(); if (!was) { list.hidden = false; btn.setAttribute('aria-expanded', 'true'); open = { list, btn }; } } }, name);
      btn.addEventListener('pointerenter', () => { if (open && open.list !== list) { close(); list.hidden = false; btn.setAttribute('aria-expanded', 'true'); open = { list, btn }; } });
      nav.append(h('div', { class: 'menu' }, btn, list));
    }
    document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) close(); });
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    // drop files anywhere
    root.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    root.addEventListener('drop', async (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      const handle = e.dataTransfer.items && e.dataTransfer.items[0] && e.dataTransfer.items[0].getAsFileSystemHandle ? await e.dataTransfer.items[0].getAsFileSystemHandle().catch(() => null) : null;
      if (/\.deadpixel$|\.json$/i.test(f.name)) openProjectFile(f, handle); else if (f.type.startsWith('image/')) importImageNew(f);
      else if (/\.(gpl|pal|hex|txt)$/i.test(f.name)) UI.applyPalette(IO.parsePalette(await f.text()), true);
    });
  };

  // ================================================================ helpers
  const base = () => IO.safeName(app.doc.name);
  async function saveBytes(bytes, name, type) { if (await IO.save(bytes, name, type)) UI.toast('Saved ' + name + ' to your computer'); }
  function rgbaFrames(list, lit) { return list.map((f) => ({ frame: f, rgba: lit ? app.displayed(f, 'lit', 0) : app.composite(f) })); }
  async function pngFor(rgba, w, h, preferIndexed) {
    if (preferIndexed && app.doc.mode === 'indexed') {
      const ix = IO.toIndexed(rgba, app.doc.palette);
      if (ix) return IO.encodeIndexedPNG(ix.indices, w, h, ix.palette);
    }
    return IO.encodePNG(rgba, w, h);
  }
  function scaled(rgba, w, h, k) {
    if (k === 1) return rgba;
    const W = w * k, out = new Uint8ClampedArray(W * h * k * 4);
    for (let y = 0; y < h * k; y++) for (let x = 0; x < W; x++) { const s = (((y / k) | 0) * w + ((x / k) | 0)) * 4, d = (y * W + x) * 4; out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3]; }
    return out;
  }
  function docFromImage(img, name) {
    const d = new DP.Doc(img.w, img.h, 'rgb');
    d.name = name.replace(/\.[^.]+$/, '');
    const pal = DP.extractPalette(img.rgba, 256);
    if (pal.length) d.palette = pal;
    const l = d.addLayer('Layer 1', 'layer');
    const id = DP.newId(); d.celData[id] = { data: new Uint8ClampedArray(img.rgba) }; d.cels[l.id + '/0'] = id;
    return d;
  }
  async function importImageNew(file) {
    if (!(await UI.okToReplace())) return;
    const img = await IO.readImage(file);
    app.setDoc(docFromImage(img, file.name));
    UI.toast('Opened ' + file.name + ' (' + img.w + '×' + img.h + ')');
  }
  async function openProjectFile(file, handle) {
    if (!(await UI.okToReplace())) return;
    try {
      const doc = await IO.loadProject(new Uint8Array(await file.arrayBuffer()));
      app.setDoc(doc);
      app.file = handle && /\.deadpixel$/i.test(file.name) ? handle : null; // .json and images are saved as a new file
      if (handle) IO.recent.add(handle);
      UI.refreshDocInfo(); UI.toast('Opened ' + file.name);
    } catch (e) { UI.modal('Could not open that file', (b) => b.append(h('p', null, e.message || String(e)))); }
  }
  /** True when there's nothing unsaved, or the user says to go ahead anyway. */
  UI.okToReplace = async function () {
    if (!app.isDirty()) return true;
    return UI.confirm('Discard unsaved changes?', app.doc.name + ' has changes you haven\'t saved. They will be lost (the autosave is replaced too).', 'Discard');
  };
  function openAny(file, handle) {
    if (/\.deadpixel$|\.json$/i.test(file.name)) openProjectFile(file, handle); else importImageNew(file);
  }

  // ================================================================ actions
  const A = {
    async new() {
      const presets = [['32x32', '32 × 32 icon'], ['48x48', '48 × 48'], ['32x64', '32 × 64 character'], ['64x64', '64 × 64'], ['128x128', '128 × 128'], ['320x180', '320 × 180 room (one screen)'], ['640x180', '640 × 180 wide room'], ['16x16', '16 × 16 tile']];
      const ok = await UI.modal('New sprite', (b) => {
        const f = h('div', { class: 'form' });
        const pre = selIn('nwPreset', [['', 'Custom']].concat(presets), '32x64');
        pre.onchange = () => { if (pre.value) { const [w, hh] = pre.value.split('x'); $('nwW').value = w; $('nwH').value = hh; } };
        f.append(...field('Name', h('input', { type: 'text', id: 'nwName', value: 'sprite' })), ...field('Size', pre), ...field('Width', numIn('nwW', 32, 1, 2048)), ...field('Height', numIn('nwH', 64, 1, 2048)),
          ...field('Colour mode', selIn('nwMode', [['rgb', 'RGB (true colour)'], ['indexed', 'Indexed (palette)']], 'rgb')),
          ...field('Palette', selIn('nwPal', Object.keys(DP.allPresets()), 'DB32')), ...field('Background layer', chkIn('nwBg', false)));
        b.append(f);
      }, [{ label: 'Cancel', value: false }, { label: 'Create', value: true, primary: true }]);
      if (!ok || !(await UI.okToReplace())) return;
      const d = new DP.Doc(Math.max(1, +val('nwW') | 0), Math.max(1, +val('nwH') | 0), val('nwMode'));
      d.name = val('nwName') || 'sprite';
      d.palette = DP.allPresets()[val('nwPal')].map((c) => c.slice());
      if (val('nwBg')) d.addLayer('Background', 'background');
      d.addLayer('Layer 1', 'layer');
      if (d.w >= 200) { d.lighting.preset = 'Architecture'; d.lighting.skyFalloff = true; }
      app.setDoc(d);
    },
    async open() {
      // (.json: a project saved as plain JSON opens the same)
      const got = await IO.pickWithHandle('.deadpixel,.json,image/png,image/gif,image/jpeg,image/webp');
      if (got) openAny(got.file, got.handle);
    },
    async openRecent() {
      const list = await IO.recent.list();
      let pick = null;
      await UI.modal('Open recent', (b) => {
        if (!list.length) { b.append(h('p', null, IO.canSaveInPlace() ? 'Nothing yet. Projects you open or save show up here (kept in this browser only).' : 'This browser can\'t reopen files by itself. Chrome and Edge can; elsewhere use File > Open.')); return; }
        const ul = h('div', { class: 'recent' });
        for (const r of list) ul.append(h('button', { class: 'recent-item', onclick: () => { pick = r; UI.closeModal(); } }, r.name, h('span', { class: 'muted' }, ' · ' + new Date(r.at).toLocaleString())));
        b.append(ul, h('p', { class: 'muted' }, 'The browser may ask again for permission to read the file.'));
      }, [{ label: 'Close', value: false }]);
      if (!pick) return;
      try {
        if (!(await IO.permit(pick.handle, 'read'))) return;
        openAny(await pick.handle.getFile(), pick.handle);
      } catch (e) { IO.recent.remove(pick.name); UI.toast(pick.name + ' has moved or been deleted'); }
    },
    async sample(key) {
      if (!(await UI.okToReplace())) return;
      app.openSample(key);
    },
    async save() {
      const bytes = await IO.saveProject(app.doc);
      if (app.file) {
        try { if (await IO.writeHandle(app.file, bytes)) { app.markSaved(); UI.toast('Saved ' + app.file.name); return; } } catch (e) { /* moved or blocked: save as */ }
      }
      return A.saveAs(bytes);
    },
    async saveAs(bytes) {
      const got = await IO.save(bytes instanceof Uint8Array ? bytes : await IO.saveProject(app.doc), base() + '.deadpixel', 'application/x-deadpixel');
      if (!got) return;
      if (got !== true) { app.file = got; IO.recent.add(got); }
      app.markSaved(); UI.refreshDocInfo(); UI.toast('Saved ' + (got.name || base() + '.deadpixel') + ' to your computer');
    },
    async importImage() { const [f] = await IO.pick('image/*'); if (f) importImageNew(f); },
    async importLayer() {
      const [f] = await IO.pick('image/*'); if (!f) return;
      const img = await IO.readImage(f), d = app.doc;
      app.mutate('Import layer', () => {
        const l = d.addLayer(f.name.replace(/\.[^.]+$/, ''), 'layer');
        const rgba = new Uint8ClampedArray(d.w * d.h * 4);
        for (let y = 0; y < Math.min(d.h, img.h); y++) for (let x = 0; x < Math.min(d.w, img.w); x++) { const s = (y * img.w + x) * 4, t = (y * d.w + x) * 4; rgba.set(img.rgba.subarray(s, s + 4), t); }
        const id = DP.newId(); d.celData[id] = { data: d.mode === 'indexed' ? d.toIndexed(rgba) : rgba }; d.cels[l.id + '/' + app.frame] = id;
        app.layerId = l.id;
      });
    },
    async importSheet() {
      const [f] = await IO.pick('image/*'); if (!f) return;
      const img = await IO.readImage(f);
      const ok = await UI.modal('Import sprite sheet', (b) => {
        b.append(h('p', null, f.name + ' is ' + img.w + ' × ' + img.h + '. Cut it into frames:'));
        const fm = h('div', { class: 'form' });
        fm.append(...field('Frame width', numIn('isW', Math.min(img.w, img.h), 1, img.w)), ...field('Frame height', numIn('isH', img.h, 1, img.h)), ...field('Padding between', numIn('isP', 0, 0, 64)), ...field('Border', numIn('isB', 0, 0, 64)), ...field('Frame duration (ms)', numIn('isD', 100, 10, 10000, 10)));
        b.append(fm);
      }, [{ label: 'Cancel', value: false }, { label: 'Import', value: true, primary: true }]);
      if (!ok) return;
      const fw = +val('isW'), fh = +val('isH'), pad = +val('isP'), bor = +val('isB'), dur = +val('isD');
      const cols = Math.max(1, Math.floor((img.w - bor * 2 + pad) / (fw + pad))), rws = Math.max(1, Math.floor((img.h - bor * 2 + pad) / (fh + pad)));
      const d = new DP.Doc(fw, fh, 'rgb'); d.name = f.name.replace(/\.[^.]+$/, '');
      d.palette = DP.extractPalette(img.rgba, 256);
      const l = d.addLayer('Layer 1', 'layer'); d.frames = [];
      for (let r = 0; r < rws; r++) for (let c = 0; c < cols; c++) {
        const rgba = new Uint8ClampedArray(fw * fh * 4); let any = false;
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const sx = bor + c * (fw + pad) + x, sy = bor + r * (fh + pad) + y; if (sx >= img.w || sy >= img.h) continue; const s = (sy * img.w + sx) * 4; rgba.set(img.rgba.subarray(s, s + 4), (y * fw + x) * 4); if (img.rgba[s + 3]) any = true; }
        if (!any && d.frames.length) continue;
        const fi = d.frames.length; d.frames.push({ duration: dur });
        const id = DP.newId(); d.celData[id] = { data: rgba }; d.cels[l.id + '/' + fi] = id;
      }
      if (!d.frames.length) d.frames.push({ duration: dur });
      app.setDoc(d); UI.toast('Imported ' + d.frames.length + ' frames');
    },
    async exportPNG() {
      const ok = await UI.modal('Export this frame', (b) => { const f = h('div', { class: 'form' }); f.append(...field('Scale', selIn('epS', ['1', '2', '3', '4', '6', '8'], '1')), ...field('Lit (game lighting)', chkIn('epLit', false)), ...field('Indexed PNG when possible', chkIn('epIdx', app.doc.mode === 'indexed'))); b.append(f); }, [{ label: 'Cancel', value: false }, { label: 'Save PNG', value: true, primary: true }]);
      if (!ok) return;
      const d = app.doc, k = +val('epS'), rgba = val('epLit') ? app.displayed(app.frame, 'lit', 0) : app.composite(app.frame);
      await saveBytes(await pngFor(scaled(rgba, d.w, d.h, k), d.w * k, d.h * k, val('epIdx') && k >= 1), base() + '_' + app.frame + '.png', 'image/png');
    },
    async exportFrames() {
      const d = app.doc;
      const ok = await UI.modal('Frames for PowerQuest', (b) => {
        b.append(h('p', null, Object.keys(d.sources || {}).length
          ? 'This file came from a Unity project, so each sprite is saved under its original name, size and place (GiveR_1.png and so on). Drop the files over the originals in the Sprites folder: Unity keeps their settings and every animation that uses them. Frames you drew new get the next free <Tag>_<n>.png.'
          : 'One PNG per frame, named the way PowerQuest groups animations: <Tag>_<n>.png for every tag (or <name>_<n>.png when there are none). Drop the folder into the character\'s or room\'s Sprites folder.'));
        const f = h('div', { class: 'form' });
        f.append(...field('Light maps too', chkIn('efLM', false)), ...field('Indexed PNGs (indexed mode)', chkIn('efIdx', d.mode === 'indexed')));
        b.append(f);
      }, [{ label: 'Cancel', value: false }, { label: 'Save zip', value: true, primary: true }]);
      if (!ok) return;
      const files = [];
      const groups = d.tags.length ? d.tags.map((t, i) => ({ name: IO.safeName(t.name), frames: IO.framesFor(d, i) })) : [{ name: base(), frames: IO.framesFor(d) }];
      const pq = IO.powerQuestFiles(d, groups, base());
      for (const p of pq) {
        const r = p.rect, rgba = p.show ? d.composite(p.frame, { only: p.show }) : p.hide ? d.composite(p.frame, { hide: p.hide }) : app.composite(p.frame);
        files.push({ name: p.name + '.png', data: await pngFor(IO.crop(rgba, d.w, d.h, r.x, r.y, r.w, r.h), r.w, r.h, val('efIdx')) });
        if (val('efLM')) files.push({ name: 'LightMaps/' + p.name + '.png', data: await IO.encodePNG(IO.crop(app.lightMap(p.frame), d.w, d.h, r.x, r.y, r.w, r.h), r.w, r.h) });
      }
      await saveBytes(IO.zip(files), base() + '_frames.zip', 'application/zip');
      if (pq.skipped.length) UI.toast(pq.skipped.length + ' sprite' + (pq.skipped.length > 1 ? 's' : '') + ' left out because the canvas cuts them off: ' + pq.skipped.slice(0, 4).join(', ') + (pq.skipped.length > 4 ? '…' : ''));
    },
    async exportSheet() {
      const d = app.doc;
      const ok = await UI.modal('Export sprite sheet', (b) => {
        const f = h('div', { class: 'form' });
        f.append(...field('For', selIn('esEng', [['unity', 'Unity (PNG + JSON, sliced by the importer script)'], ['unreal', 'Unreal Paper2D (PNG + .paper2dsprites)'], ['generic', 'Generic (PNG + JSON)'], ['png', 'PNG only (grid)']], 'unity')),
          ...field('Layout', selIn('esLay', [['horizontal', 'One row'], ['vertical', 'One column'], ['grid', 'Grid'], ['tags', 'A row per tag']], d.tags.length ? 'tags' : 'horizontal')),
          ...field('Grid columns', numIn('esCols', Math.ceil(Math.sqrt(d.frames.length)), 1, 256)),
          ...field('Frames', selIn('esTag', [['-1', 'All frames']].concat(d.tags.map((t, i) => [String(i), 'Tag: ' + t.name])), '-1')),
          ...field('Padding between', numIn('esPad', 0, 0, 64)), ...field('Border', numIn('esBor', 0, 0, 64)),
          ...field('Pixels per unit', numIn('esPPU', 1, 1, 1024)), ...field('Pivot', selIn('esPiv', [['bc', 'Bottom centre (feet)'], ['c', 'Centre'], ['tl', 'Top left']], 'bc')),
          ...field('Light map sheet too', chkIn('esLM', false)), ...field('Lit render', chkIn('esLit', false)));
        b.append(f, h('p', null, 'Unity: put the PNG and JSON side by side in Assets with DeadPixelSheetImporter.cs in an Editor folder (File > Unity importer script). It slices the sheet, sets point filtering and makes an animation clip per tag. Unreal: import the .paper2dsprites file with Paper2D; it makes the texture and a sprite per frame.'));
      }, [{ label: 'Cancel', value: false }, { label: 'Save', value: true, primary: true }]);
      if (!ok) return;
      const eng = val('esEng'), tag = +val('esTag');
      const piv = { bc: { x: 0.5, y: 0 }, c: { x: 0.5, y: 0.5 }, tl: { x: 0, y: 1 } }[val('esPiv')];
      const opts = { layout: val('esLay'), columns: +val('esCols'), padding: +val('esPad'), border: +val('esBor'), frames: IO.framesFor(d, tag) };
      if (tag >= 0 && opts.layout === 'tags') opts.layout = 'horizontal';
      const lit = val('esLit');
      const sheet = IO.buildSheet(d, Object.assign({}, opts, { rgba: (f) => (lit ? app.displayed(f, 'lit', 0) : app.composite(f)) }));
      const name = base() + (tag >= 0 ? '_' + IO.safeName(d.tags[tag].name) : '');
      const png = await pngFor(sheet.rgba, sheet.w, sheet.h, true);
      if (eng === 'png') { await saveBytes(png, name + '.png', 'image/png'); return; }
      const files = [{ name: name + '.png', data: png }];
      const meta = { ppu: +val('esPPU'), pivot: piv };
      if (eng === 'unreal') files.push({ name: name + '.paper2dsprites', data: new TextEncoder().encode(JSON.stringify(IO.paper2dJSON(d, sheet, name + '.png', meta), null, 2)) });
      else files.push({ name: name + '.json', data: new TextEncoder().encode(JSON.stringify(IO.sheetJSON(d, sheet, name + '.png', meta), null, 2)) });
      if (val('esLM')) { const ls = IO.buildSheet(d, Object.assign({}, opts, { rgba: (f) => app.lightMap(f) })); files.push({ name: name + '_light.png', data: await IO.encodePNG(ls.rgba, ls.w, ls.h) }); }
      if (eng === 'unity') files.push({ name: 'Editor/DeadPixelSheetImporter.cs', data: new TextEncoder().encode(DP.UNITY_SCRIPT || '') });
      await saveBytes(IO.zip(files), name + '_' + eng + '.zip', 'application/zip');
    },
    async exportGIF() {
      const d = app.doc;
      const ok = await UI.modal('Animated GIF', (b) => { const f = h('div', { class: 'form' }); f.append(...field('Frames', selIn('egTag', [['-1', 'All frames']].concat(d.tags.map((t, i) => [String(i), 'Tag: ' + t.name])), d.tags.length ? '0' : '-1')), ...field('Scale', selIn('egS', ['1', '2', '3', '4', '6', '8'], '4')), ...field('Lit (game lighting)', chkIn('egLit', app.light.preview))); b.append(f); }, [{ label: 'Cancel', value: false }, { label: 'Save GIF', value: true, primary: true }]);
      if (!ok) return;
      const tag = +val('egTag'), t = d.tags[tag];
      let list = IO.framesFor(d, tag);
      if (t && t.dir === 'reverse') list = list.reverse(); if (t && t.dir === 'pingpong') list = list.concat(list.slice(1, -1).reverse());
      const lit = val('egLit');
      const frames = list.map((f, i) => ({ rgba: lit ? app.displayed(f, 'lit', i * d.frames[f].duration / 1000) : app.composite(f), delay: d.frames[f].duration }));
      await saveBytes(IO.encodeGIF(frames, d.w, d.h, +val('egS')), base() + '.gif', 'image/gif');
    },
    async unityScript() { await saveBytes(new TextEncoder().encode(DP.UNITY_SCRIPT || ''), 'DeadPixelSheetImporter.cs', 'text/plain'); },
    async importPalette() {
      const [f] = await IO.pick('.gpl,.pal,.hex,.txt,image/*'); if (!f) return;
      if (f.type.startsWith('image/')) { const img = await IO.readImage(f); UI.applyPalette(DP.extractPalette(img.rgba, 256), true); }
      else UI.applyPalette(IO.parsePalette(await f.text()), true);
    },
    async exportPalette(kind) {
      const pal = app.doc.palette, n = base() + '_palette';
      if (kind === 'gpl') return saveBytes(new TextEncoder().encode(IO.paletteToGPL(pal, app.doc.name)), n + '.gpl', 'text/plain');
      if (kind === 'hex') return saveBytes(new TextEncoder().encode(IO.paletteToHex(pal)), n + '.hex', 'text/plain');
      if (kind === 'pal') return saveBytes(new TextEncoder().encode(IO.paletteToJASC(pal)), n + '.pal', 'text/plain');
      const cols = Math.min(16, pal.length), rows = Math.ceil(pal.length / cols), rgba = new Uint8ClampedArray(cols * rows * 4);
      pal.forEach((c, i) => rgba.set([c[0], c[1], c[2], c[3]], i * 4));
      return saveBytes(await IO.encodePNG(rgba, cols, rows), n + '.png', 'image/png');
    },
    async exportLightMap() { const d = app.doc; await saveBytes(await IO.encodePNG(app.lightMap(app.frame), d.w, d.h), base() + '_' + app.frame + '_light.png', 'image/png'); },
    async exportLightSheet() { const d = app.doc, s = IO.buildSheet(d, { layout: 'horizontal', rgba: (f) => app.lightMap(f) }); await saveBytes(await IO.encodePNG(s.rgba, s.w, s.h), base() + '_light.png', 'image/png'); },
    async exportLit() { const d = app.doc; await saveBytes(await IO.encodePNG(app.displayed(app.frame, 'lit', 0), d.w, d.h), base() + '_' + app.frame + '_lit.png', 'image/png'); },

    undo: () => app.history.undo(), redo: () => app.history.redo(),
    cut: () => app.copy(true), copy: () => app.copy(false), paste: () => app.paste(), clear: () => app.clearSelected(),
    selectAll: () => app.selectAll(), deselect: () => app.setSelection(null), invert: () => app.invertSelection(), brush: () => app.brushFromSelection(),
    flipH: () => app.flip('h'), flipV: () => app.flip('v'),
    async outline() {
      const O = app.outlineOpts || (app.outlineOpts = { mode: 'outside', eight: false, all: false });
      const ok = await UI.modal('Outline', (b) => {
        const f = h('div', { class: 'form' });
        f.append(...field('Where', selIn('olMode', [['outside', 'Around the art (adds pixels)'], ['inside', 'On the edge of the art (recolours it)']], O.mode)),
          ...field('Corners', selIn('olEight', [['4', 'No (clean pixel-art outline)'], ['8', 'Yes (thicker at corners)']], O.eight ? '8' : '4')),
          ...field('Every frame', chkIn('olAll', O.all)));
        b.append(f, h('p', null, 'Uses the primary colour, on the current layer. With a selection, only the selected art gets an outline.'));
      }, [{ label: 'Cancel', value: false }, { label: 'Outline', value: true, primary: true }]);
      if (!ok) return;
      Object.assign(O, { mode: val('olMode'), eight: val('olEight') === '8', all: !!val('olAll') });
      app.outline(O.mode, O.eight, O.all);
    },
    trimCanvas: () => app.trimCanvas(),
    async mirrorTag() {
      const d = app.doc;
      if (!d.tags.length) { UI.toast('Make a tag first (Frame > New tag)'); return; }
      const cur = Math.max(0, d.tags.findIndex((t) => app.frame >= t.from && app.frame <= t.to));
      const flipName = (n) => (/R$/.test(n) ? n.slice(0, -1) + 'L' : /L$/.test(n) ? n.slice(0, -1) + 'R' : n + ' mirrored');
      const ok = await UI.modal('Mirror tag into a new tag', (b) => {
        const f = h('div', { class: 'form' });
        const sel = selIn('mtTag', d.tags.map((t, i) => [String(i), t.name]), String(cur));
        sel.onchange = () => { $('mtName').value = flipName(d.tags[+sel.value].name); };
        f.append(...field('Tag', sel), ...field('New tag name', h('input', { type: 'text', id: 'mtName', value: flipName(d.tags[cur].name) })));
        b.append(f, h('p', null, d.pivot ? 'Copies the frames to the end, mirrored around the feet (the pivot from the Unity sprites), so the character stays on the same spot.' : 'Copies the frames to the end, mirrored left to right.'));
      }, [{ label: 'Cancel', value: false }, { label: 'Mirror', value: true, primary: true }]);
      if (ok) app.mirrorTag(+val('mtTag'), val('mtName') || 'Mirrored');
    },
    async rotsprite() {
      const ok = await UI.modal('Rotate and scale (RotSprite)', (b) => {
        b.append(h('p', null, 'Enlarges 8x with Scale2x, turns, and samples back down, so edges stay crisp and on your colours. Works on the selection, or the whole cel.'));
        const f = h('div', { class: 'form' });
        f.append(...field('Angle (degrees)', numIn('rsA', app.rotate.angle, -360, 360, 1)), ...field('Scale', numIn('rsS', app.rotate.scale, 0.1, 8, 0.05)), ...field('Every frame of the layer', chkIn('rsAll', false)));
        b.append(f);
      }, [{ label: 'Cancel', value: false }, { label: 'Apply', value: true, primary: true }]);
      if (!ok) return;
      app.rotate.angle = +val('rsA'); app.rotate.scale = +val('rsS');
      app.rotsprite(app.rotate.angle, app.rotate.scale, val('rsAll'));
    },

    async properties() {
      const d = app.doc;
      const ok = await UI.modal('Sprite properties', (b) => { const f = h('div', { class: 'form' }); f.append(...field('Name', h('input', { type: 'text', id: 'prName', value: d.name }))); b.append(f, h('p', null, d.w + ' × ' + d.h + ', ' + d.frames.length + ' frames, ' + d.layers.length + ' layers, ' + d.palette.length + ' colours.')); }, [{ label: 'Cancel', value: false }, { label: 'OK', value: true, primary: true }]);
      if (ok) app.mutate('Rename sprite', () => { d.name = val('prName') || d.name; });
    },
    async canvasSize() {
      const d = app.doc;
      const ok = await UI.modal('Canvas size', (b) => { const f = h('div', { class: 'form' }); f.append(...field('Width', numIn('csW', d.w, 1, 4096)), ...field('Height', numIn('csH', d.h, 1, 4096)), ...field('Anchor', selIn('csA', [['0,0', 'Top left'], ['0.5,0', 'Top'], ['0.5,0.5', 'Centre'], ['0.5,1', 'Bottom (feet stay put)'], ['0,1', 'Bottom left']], '0.5,1'))); b.append(f); }, [{ label: 'Cancel', value: false }, { label: 'Resize', value: true, primary: true }]);
      if (!ok) return;
      const [ax, ay] = val('csA').split(',').map(Number);
      app.mutate('Canvas size', () => d.resize(Math.max(1, +val('csW') | 0), Math.max(1, +val('csH') | 0), ax, ay)); app.fit();
    },
    async scaleDoc() {
      const ok = await UI.modal('Scale sprite', (b) => { const f = h('div', { class: 'form' }); f.append(...field('Whole-number scale', selIn('scK', ['2', '3', '4'], '2'))); b.append(f, h('p', null, 'Every cel grows by nearest neighbour. For free scaling use Rotate / scale (RotSprite).')); }, [{ label: 'Cancel', value: false }, { label: 'Scale', value: true, primary: true }]);
      if (ok) { app.mutate('Scale', () => app.doc.scale(+val('scK'))); app.fit(); }
    },
    modeRGB() { if (app.doc.mode === 'rgb') return; app.mutate('RGB colour', () => app.doc.setMode('rgb')); app.linkEntry = false; app.refreshAll(); UI.toast('RGB colour: the palette no longer drives the picture'); },
    async modeIndexed() {
      const d = app.doc;
      const ok = await UI.modal('Indexed colour', (b) => {
        b.append(h('p', null, 'Every pixel is matched to a palette entry. After this, changing a palette colour changes it everywhere on the canvas.'));
        const f = h('div', { class: 'form' });
        f.append(...field('Palette', selIn('ixPal', [['current', 'Current palette (' + d.palette.length + ')'], ['extract', 'Made from the picture']], 'current')), ...field('Colours to extract', numIn('ixN', 32, 2, 256)),
          ...field('Dither', selIn('ixD', [['0', 'None (default)'], ['0.5', 'Half strength'], ['1', 'Full']], '0')));
        b.append(f);
      }, [{ label: 'Cancel', value: false }, { label: 'Convert', value: true, primary: true }]);
      if (!ok) return;
      app.mutate('Indexed colour', () => {
        if (val('ixPal') === 'extract') {
          const all = []; for (let f = 0; f < d.frames.length; f++) all.push(d.composite(f));
          const big = new Uint8ClampedArray(all.reduce((n, a) => n + a.length, 0)); let o = 0; for (const a of all) { big.set(a, o); o += a.length; }
          d.palette = DP.extractPalette(big, +val('ixN') || 32);
        }
        d.setMode('indexed', +val('ixD'));
      });
      app.linkEntry = true; app.primaryIndex = DP.nearest(d.palette, app.primary); app.secondaryIndex = DP.nearest(d.palette, app.secondary);
      app.refreshAll();
    },
    toggleSnap() { app.mutate('Indexed blending', () => { app.doc.indexedBlendSnap = !app.doc.indexedBlendSnap; }); UI.toast('Blends on the palette: ' + (app.doc.indexedBlendSnap ? 'on' : 'off')); },

    newLayer() { app.mutate('New layer', () => { const cur = app.layer(); const l = app.doc.addLayer('Layer ' + (app.doc.layers.length + 1), 'layer', { parent: cur && cur.kind !== 'group' ? cur.parent : cur && cur.kind === 'group' ? cur.id : null }); app.layerId = l.id; }); },
    newGroup() { app.mutate('New group', () => { const g = app.doc.addLayer('Group ' + (app.doc.layers.filter((l) => l.kind === 'group').length + 1), 'group'); app.layerId = g.id; }); },
    newBackground() { if (app.doc.layers.some((l) => l.kind === 'background')) { UI.toast('There is a background layer already.'); return; } app.mutate('Background layer', () => { const l = app.doc.addLayer('Background', 'background'); app.layerId = l.id; }); },
    dupLayer() { app.mutate('Duplicate layer', () => { const n = app.doc.duplicateLayer(app.layerId); if (!n) return false; app.layerId = n.id; }); },
    async delLayer() {
      const l = app.layer(); if (!l) return;
      if (app.doc.layers.filter((x) => x.kind !== 'group').length <= 1 && l.kind !== 'group') { UI.toast('Keep at least one layer.'); return; }
      app.mutate('Delete layer', () => app.doc.removeLayer(l.id));
    },
    moveLayer(dir) { app.mutate('Move layer', () => app.doc.moveLayer(app.layerId, dir)); },
    mergeDown() { app.mutate('Merge down', () => { const sibs = app.doc.children(app.layer().parent); const below = sibs[sibs.indexOf(app.layer()) - 1]; if (!app.doc.mergeDown(app.layerId)) { UI.toast('Nothing to merge into below.'); return false; } app.layerId = below.id; }); },
    setParent(pid) {
      const l = app.layer(); if (!l || l.kind === 'background') return;
      let p = pid ? app.doc.layer(pid) : null;
      while (p) { if (p.id === l.id) { UI.toast('A group can\'t go inside itself.'); app.refreshAll(); return; } p = p.parent ? app.doc.layer(p.parent) : null; }
      app.mutate('Move into group', () => { l.parent = pid || null; const arr = app.doc.layers; arr.splice(arr.indexOf(l), 1); arr.push(l); });
    },
    async layerProps() {
      const l = app.layer(); if (!l) return;
      const ok = await UI.modal('Layer properties', (b) => { const f = h('div', { class: 'form' }); f.append(...field('Name', h('input', { type: 'text', id: 'lpN', value: l.name })), ...field('Blend mode', selIn('lpB', DP.BLEND_MODES, l.blend)), ...field('Opacity (0–255)', numIn('lpO', l.opacity, 0, 255))); b.append(f); }, [{ label: 'Cancel', value: false }, { label: 'OK', value: true, primary: true }]);
      if (ok) app.mutate('Layer properties', () => { l.name = val('lpN') || l.name; l.blend = val('lpB'); l.opacity = Math.max(0, Math.min(255, +val('lpO') | 0)); });
    },

    newFrame() { app.mutate('New frame', () => { app.frame = app.doc.addFrame(app.frame + 1); }); },
    dupFrame() { app.mutate('Duplicate frame', () => { app.frame = app.doc.addFrame(app.frame + 1, app.frame); }); },
    delFrame() {
      const r = UI.frameRange();
      if (r.to - r.from + 1 >= app.doc.frames.length) { UI.toast('Keep at least one frame.'); return; }
      app.mutate('Delete frame', () => { for (let f = r.to; f >= r.from; f--) app.doc.removeFrame(f); app.frame = Math.min(r.from, app.doc.frames.length - 1); });
      app.range = null;
    },
    moveFrame(dir) { const to = app.frame + dir; if (to < 0 || to >= app.doc.frames.length) return; app.mutate('Move frame', () => { app.doc.moveFrame(app.frame, to); app.frame = to; }); },
    duration(ms) { const r = UI.frameRange(); app.mutate('Frame duration', () => { for (let f = r.from; f <= r.to; f++) app.doc.frames[f].duration = Math.max(10, ms | 0); }); },
    async durationDialog() {
      const r = UI.frameRange();
      const ok = await UI.modal('Frame duration', (b) => { const f = h('div', { class: 'form' }); f.append(...field('Milliseconds', numIn('fdMs', app.doc.frames[app.frame].duration, 10, 10000, 10))); b.append(f, h('p', null, 'Frames ' + (r.from + 1) + '–' + (r.to + 1) + '. 100 ms is 10 fps; walk cycles often run near 120 ms.')); }, [{ label: 'Cancel', value: false }, { label: 'OK', value: true, primary: true }]);
      if (ok) A.duration(+val('fdMs'));
    },
    linkCels() {
      const r = UI.frameRange(), d = app.doc, l = app.layer();
      if (!l || l.kind === 'group' || r.from === r.to) { UI.toast('Shift-click frame numbers to pick the frames to link.'); return; }
      const src = d.celId(l.id, r.from); if (!src) { UI.toast('The first frame of the range has nothing on this layer.'); return; }
      app.mutate('Link cels', () => { for (let f = r.from + 1; f <= r.to; f++) d.cels[l.id + '/' + f] = src; });
      UI.toast('Linked: a change on one of these frames changes them all');
    },
    unlinkCels() {
      const r = UI.frameRange(), d = app.doc, l = app.layer(); if (!l) return;
      app.mutate('Unlink cels', () => { for (let f = r.from; f <= r.to; f++) { const id = d.celId(l.id, f); if (!id || !d.linked(l.id, f)) continue; const n = DP.newId(); d.celData[n] = { data: d.celData[id].data.slice() }; d.cels[l.id + '/' + f] = n; } });
    },
    async newTag() {
      const r = UI.frameRange();
      await tagDialog({ name: 'Walk', from: r.from, to: r.to, colour: ['#ffbf66', '#9d8bff', '#7fd3a0', '#ff6f6f', '#6fc3ff'][app.doc.tags.length % 5], dir: 'forward' }, -1);
    },
    async editTag(i) { await tagDialog(Object.assign({}, app.doc.tags[i]), i); },
    play: () => app.togglePlay(),

    zoomIn: () => app.zoomStep(1), zoomOut: () => app.zoomStep(-1), fit: () => app.fit(),
    toggleGrid() { app.showGrid = !app.showGrid; app.render(); },
    toggleTileGrid() { app.showTileGrid = !app.showTileGrid; app.render(); },
    async tileGridSize() {
      const g = app.doc.grid;
      const ok = await UI.modal('Tile grid', (b) => { const f = h('div', { class: 'form' }); f.append(...field('Width', numIn('tgW', g.w, 1, 512)), ...field('Height', numIn('tgH', g.h, 1, 512))); b.append(f); }, [{ label: 'Cancel', value: false }, { label: 'OK', value: true, primary: true }]);
      if (ok) { g.w = +val('tgW'); g.h = +val('tgH'); app.showTileGrid = true; app.render(); }
    },
    toggleOnion() { app.onion.on = !app.onion.on; UI.refreshTimelineBar(); app.render(); },
    nextTiled() { const o = ['none', 'x', 'y', 'both']; app.tiled = o[(o.indexOf(app.tiled) + 1) % 4]; UI.refreshOptions(); app.render(); UI.toast('Tiled mode: ' + app.tiled); },
    preview: () => UI.togglePreview(),
    async penTouch() {
      const I = app.input;
      const ok = await UI.modal('Preferences', (b) => {
        const f = h('div', { class: 'form' });
        f.append(...field('Pen pressure changes', selIn('ptP', [['size', 'Brush size'], ['dither', 'Dither density'], ['off', 'Nothing']], I.pressure)),
          ...field('Smallest size (lightest touch)', numIn('ptMin', I.minSize, 1, 64)),
          ...field('Pressure curve', selIn('ptC', [['soft', 'Soft (light touch goes far)'], ['linear', 'Linear'], ['firm', 'Firm (press harder)']], I.curve)),
          ...field('One finger', selIn('ptF', [['auto', 'Paints, until a pen is used, then pans'], ['draw', 'Always paints'], ['pan', 'Always pans']], I.fingers)),
          ...field('Two-finger tap undo, three-finger tap redo', chkIn('ptG', I.gestures)),
          ...field('Undo memory (MB)', numIn('ptU', I.undoMB, 16, 4096)),
          ...field('Keyboard shortcuts', h('button', { onclick: () => { UI.closeModal(false); UI.action('keyboard'); } }, 'Change…')));
        b.append(f, h('p', null, 'Pinch with two fingers to zoom and pan. The pen\'s eraser end erases whatever tool is chosen, and its side button paints with the secondary colour. Pressure needs a pen that reports it: Apple Pencil, Surface and Wacom pens, Samsung S Pen and most Windows Ink pens. Undo keeps as many steps as fit in the undo memory, dropping the oldest first (now using ' + Math.ceil(app.history.bytes / 1048576) + ' MB). These settings are kept in this browser.'));
      }, [{ label: 'Cancel', value: false }, { label: 'Save', value: true, primary: true }]);
      if (!ok) return;
      Object.assign(I, { pressure: val('ptP'), minSize: Math.max(1, +val('ptMin') | 0), curve: val('ptC'), fingers: val('ptF'), gestures: !!val('ptG'), undoMB: Math.min(4096, Math.max(16, +val('ptU') | 0 || 256)) });
      app.history.setLimitMB(I.undoMB); app.saveInput(); UI.refreshOptions();
    },
    async reference() {
      const R = app.reference || { opacity: 0.4, above: false, fit: true, show: true, x: 0, y: 0 };
      let picked = null;
      const ok = await UI.modal('Reference image', (b) => {
        const f = h('div', { class: 'form' });
        const pickBtn = h('button', { onclick: async () => { const [file] = await IO.pick('image/*'); if (file) { picked = file; pickBtn.textContent = file.name; } } }, R.name || 'Choose an image…');
        f.append(...field('Image', pickBtn), ...field('Show', chkIn('rfShow', R.show)), ...field('Opacity (%)', numIn('rfOp', Math.round(R.opacity * 100), 5, 100)),
          ...field('Draw it', selIn('rfAbove', [['below', 'Behind the art'], ['above', 'Over the art']], R.above ? 'above' : 'below')),
          ...field('Size', selIn('rfFit', [['fit', 'Fit the canvas'], ['actual', 'Actual pixels']], R.fit ? 'fit' : 'actual')),
          ...field('Offset X', numIn('rfX', R.x, -4096, 4096)), ...field('Offset Y', numIn('rfY', R.y, -4096, 4096)));
        b.append(f, h('p', null, 'For tracing a screenshot or concept art. It is only shown here: it is never saved in the project or in any export, and it goes when you close the tab.'));
      }, [{ label: 'Remove', value: 'remove' }, { label: 'Cancel', value: false }, { label: 'OK', value: true, primary: true }]);
      if (ok === 'remove') { app.reference = null; app.render(); return; }
      if (!ok) return;
      if (picked) { R.img = await createImageBitmap(picked); R.name = picked.name; }
      if (!R.img) return;
      Object.assign(R, { show: !!val('rfShow'), opacity: Math.max(0.05, Math.min(1, +val('rfOp') / 100)), above: val('rfAbove') === 'above', fit: val('rfFit') === 'fit', x: +val('rfX') | 0, y: +val('rfY') | 0 });
      app.reference = R; app.render();
    },
    toggleOffPalette() {
      app.offPalette = !app.offPalette; app.render();
      if (app.offPalette) { const n = app.offPaletteMask(app.frame).count; UI.toast(n ? n + ' pixel' + (n === 1 ? '' : 's') + ' in this frame are off the palette (shown in magenta)' : 'Every pixel in this frame is on the palette'); }
    },
    toggleLight() { app.light.preview = !app.light.preview; UI.refreshLight(); app.render(); },

    shortcuts() {
      UI.modal('Shortcuts', (b) => {
        const f = h('div', { class: 'form' });
        for (const [id, label] of app.KEYS) { const k = app.keyLabel(id); if (k) f.append(h('span', { class: 'mono' }, k), h('span', null, label)); }
        for (const [k, v] of [['Space-drag / wheel', 'Pan / zoom'], ['Shift (shapes)', 'Square, circle, 22.5° lines'], ['Alt (shapes)', 'Filled'], ['Right button', 'Secondary colour / darker shading']]) f.append(h('span', { class: 'mono' }, k), h('span', null, v));
        b.append(f, h('p', { class: 'muted' }, 'Change any of these in View > Preferences > Keyboard shortcuts.'));
      });
    },
    async keyboard() {
      const I = app.input, before = JSON.parse(JSON.stringify(I.keys || {})); I.keys = JSON.parse(JSON.stringify(before));
      let capturing = null;
      const draw = (f) => {
        f.innerHTML = '';
        for (const [id, label, def] of app.KEYS) {
          const btn = h('button', { class: 'keybtn mono', title: 'Click, then press the new keys', onclick: () => { if (capturing) capturing.btn.textContent = app.keyLabel(capturing.id) || '—'; capturing = { id, btn }; btn.textContent = 'Press keys… (Esc: none)'; } }, app.keyLabel(id) || '—');
          const reset = h('button', { title: 'Back to ' + def.join(' / '), disabled: !I.keys[id], onclick: () => { delete I.keys[id]; draw(f); } }, 'Reset');
          f.append(h('span', null, label), h('span', { class: 'row' }, btn, reset));
        }
      };
      const onKey = (e) => {
        if (!capturing) return;
        e.preventDefault(); e.stopPropagation();
        const combo = e.key === 'Escape' ? '' : app.comboOf(e); if (e.key !== 'Escape' && !combo) return; // a lone Ctrl or Shift: wait
        const id = capturing.id; capturing = null;
        if (combo) for (const [other] of app.KEYS) if (other !== id && app.keysFor(other).includes(combo)) { I.keys[other] = app.keysFor(other).filter((k) => k !== combo); UI.toast(combo + ' moved from ' + app.KEYS.find((k) => k[0] === other)[1]); }
        I.keys[id] = combo ? [combo] : [];
        draw($('kbForm'));
      };
      window.addEventListener('keydown', onKey, true);
      const ok = await UI.modal('Keyboard shortcuts', (b) => {
        const f = h('div', { class: 'form keys', id: 'kbForm' }); draw(f);
        b.append(h('p', { class: 'muted' }, 'Click a shortcut, then press the keys you want. If another action had them, it loses them.'), f);
      }, [{ label: 'Reset all', value: 'reset' }, { label: 'Cancel', value: false }, { label: 'Save', value: true, primary: true }]);
      window.removeEventListener('keydown', onKey, true);
      if (ok === 'reset') I.keys = {};
      else if (!ok) { I.keys = before; return; }
      for (const id in I.keys) if (!app.KEYS.some((k) => k[0] === id)) delete I.keys[id];
      app.saveInput(); UI.buildMenus(); UI.buildTools(); UI.refreshTools(); UI.toast(ok === 'reset' ? 'Shortcuts back to the defaults' : 'Shortcuts saved');
    },
    about() {
      UI.modal('Dead Pixel ' + DP.VERSION, (b) => b.append(
        h('p', null, 'A pixel art editor for 2D games. Your work stays on your computer: projects save as .deadpixel files through your browser, and the server only hands out the app.'),
        h('p', null, 'Exports: PNG (RGBA or indexed), sprite sheets for Unity (with an importer script) and Unreal Paper2D, PowerQuest frame folders, GIFs, and light maps.'),
        h('p', null, 'Lighting: LightMapGenerator and the RoomFxSim light pass, matching the Unity runtime line for line.')));
    },
  };
  async function tagDialog(t, index) {
    const d = app.doc;
    const res = await UI.modal(index < 0 ? 'New tag' : 'Edit tag', (b) => {
      const f = h('div', { class: 'form' });
      f.append(...field('Name', h('input', { type: 'text', id: 'tgName', value: t.name })), ...field('First frame', numIn('tgFrom', t.from + 1, 1, d.frames.length)), ...field('Last frame', numIn('tgTo', t.to + 1, 1, d.frames.length)),
        ...field('Colour', h('input', { type: 'color', id: 'tgCol', value: t.colour })), ...field('Plays', selIn('tgDir', [['forward', 'Forward'], ['reverse', 'Reverse'], ['pingpong', 'Ping-pong']], t.dir)));
      b.append(f);
    }, index < 0 ? [{ label: 'Cancel', value: null }, { label: 'Add tag', value: 'ok', primary: true }] : [{ label: 'Delete tag', value: 'del' }, { label: 'Cancel', value: null }, { label: 'Save', value: 'ok', primary: true }]);
    if (!res) return;
    if (res === 'del') { app.mutate('Delete tag', () => d.tags.splice(index, 1)); if (app.loopTag >= d.tags.length) app.loopTag = -1; app.refreshAll(); return; }
    const from = Math.max(0, Math.min(d.frames.length - 1, +val('tgFrom') - 1)), to = Math.max(from, Math.min(d.frames.length - 1, +val('tgTo') - 1));
    const nt = { name: val('tgName') || 'Tag', from, to, colour: val('tgCol'), dir: val('tgDir') };
    app.mutate(index < 0 ? 'New tag' : 'Edit tag', () => { if (index < 0) d.tags.push(nt); else d.tags[index] = nt; });
  }
  UI.action = function (name, arg) {
    const fn = A[name];
    if (!fn) return;
    Promise.resolve(fn(arg)).catch((e) => { console.error(e); UI.modal('Something went wrong', (b) => b.append(h('p', null, String(e && e.message || e)))); });
  };
})(window);
