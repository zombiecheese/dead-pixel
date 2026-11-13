/* Dead Pixel: the tool strip, tool options, and the colour, palette, light and brush panels. */
(function (root) {
  'use strict';
  const DP = root.DP, app = DP.app, T = DP.Tools;
  const $ = (id) => document.getElementById(id);
  const UI = (DP.UI = DP.UI || {});

  /** Tiny element builder: h('button', {class:'x', onclick}, 'text', child...) */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k.startsWith('aria-') && typeof v === 'boolean') { el.setAttribute(k, String(v)); continue; }
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  }
  UI.h = h;
  const num = (id, value, min, max, step, onchange, title) => h('input', { type: 'number', id, value, min, max, step: step || 1, title, onchange: (e) => onchange(+e.target.value) });
  const sel = (id, options, value, onchange, title) => {
    const s = h('select', { id, title, onchange: (e) => onchange(e.target.value) });
    for (const o of options) { const [v, l] = Array.isArray(o) ? o : [o, o]; s.append(h('option', { value: v }, l)); }
    s.value = value; return s;
  };
  const chk = (id, label, checked, onchange, title) => h('label', { class: 'chk', title }, h('input', { type: 'checkbox', id, checked, onchange: (e) => onchange(e.target.checked) }), label);
  const css = (c) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] === undefined ? 1 : c[3] / 255) + ')';
  UI.css = css;

  // ================================================================ toast and status
  let toastTimer = 0;
  UI.toast = function (msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
  };
  UI.status = function (p) {
    const d = app.doc;
    if (!p || p[0] < 0 || p[1] < 0 || p[0] >= d.w || p[1] >= d.h) { $('stPos').textContent = '–'; $('stCol').textContent = ''; return; }
    $('stPos').textContent = p[0] + ', ' + p[1];
    const c = d.cel(app.layerId, app.frame);
    if (c) {
      const v = T.getVal(d, c.data, p[1] * d.w + p[0]);
      if (T.isClear(d, v)) $('stCol').textContent = 'clear';
      else { const rgba = T.rgbaOf(d, v); $('stCol').textContent = (d.mode === 'indexed' ? 'index ' + v + '  ' : '') + DP.rgbaToHex(rgba, true); }
    } else $('stCol').textContent = '';
  };
  UI.message = (m) => { $('stMsg').textContent = m || ''; };

  // ================================================================ modal
  let modalResolve = null;
  /** Shows a dialog: build(el) fills it; buttons [{label, value, primary}]. Resolves with the button's value. */
  UI.modal = function (title, build, buttons) {
    const m = $('modal'); m.innerHTML = '';
    m.append(h('h2', null, title));
    const body = h('div'); m.append(body); build(body);
    const acts = h('div', { class: 'actions' });
    for (const b of buttons || [{ label: 'Close', value: null }]) acts.append(h('button', { class: b.primary ? 'primary' : '', onclick: () => UI.closeModal(b.value) }, b.label));
    m.append(acts);
    $('modalBack').hidden = false;
    const first = m.querySelector('input, select, button.primary'); if (first) first.focus();
    return new Promise((r) => (modalResolve = r));
  };
  UI.closeModal = function (v) { $('modalBack').hidden = true; if (modalResolve) { const r = modalResolve; modalResolve = null; r(v === undefined ? null : v); } };
  UI.confirm = (title, text, okLabel) => UI.modal(title, (b) => b.append(h('p', null, text)), [{ label: 'Cancel', value: false }, { label: okLabel || 'OK', value: true, primary: true }]);

  // ================================================================ tool strip
  const ICONS = {
    pencil: '.......##|......#.#|.....#.#.|....#.#..|...#.#...|..#.#....|.##.....|.##......|#........',
    eraser: '.........|....####.|...#...#.|..#...#..|.#...#...|#####....|.#..#....|..##.....|.........',
    undo: '.........|..#......|.##......|#######..|.##....#.|..#.....#|........#|.......#.|.#####...',
    redo: '.........|......#..|......##.|..#######|.#....##.|#.....#..|#........|.#.......|...#####.',
    shade: '#########|#.......#|##......#|###.....#|####....#|#####...#|######..#|#######.#|#########',
    fill: '...#.....|..#.#....|.#...#...|#.....#..|.#...#.#.|..#.#..#.|...#...#.|.......#.|......###',
    line: '........#|.......#.|......#..|.....#...|....#....|...#.....|..#......|.#.......|#........',
    rect: '#########|#.......#|#.......#|#.......#|#.......#|#.......#|#.......#|#.......#|#########',
    ellipse: '..#####..|.#.....#.|#.......#|#.......#|#.......#|#.......#|#.......#|.#.....#.|..#####..',
    gradient: '#.#.#.###|.#.#.####|#.#.#.###|.#.#.####|#.#.#.###|.#.#.####|#.#.#.###|.#.#.####|#.#.#.###',
    select: '##.##.##.|#.......#|.........|#.......#|#.......#|.........|#.......#|.........|##.##.##.',
    lasso: '..####...|.#....#..|#......#.|#......#.|.#....#..|..####...|...#.....|..#......|..##.....',
    wand: '......#..|.....###.|......#..|.....#...|....#....|...#.....|..#......|.#.......|#........',
    move: '....#....|...###...|....#....|.#..#..#.|#########|.#..#..#.|....#....|...###...|....#....',
    picker: '......##.|.....####|......##.|.....#.#.|....#....|...#.....|..#......|.#.......|#........',
    hand: '...#.#...|..#.#.#..|..#.#.#.#|..#.#.#.#|#.#######|.########|..#######|...#####.|...#####.',
    light: '....#....|.#..#..#.|..#...#..|...###...|####.####|...###...|..#...#..|.#..#..#.|....#....',
  };
  function icon(name) {
    const rows = (ICONS[name] || '').split('|');
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 9 9'); svg.setAttribute('aria-hidden', 'true');
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') { const re = document.createElementNS(ns, 'rect'); re.setAttribute('x', x); re.setAttribute('y', y); re.setAttribute('width', 1); re.setAttribute('height', 1); re.setAttribute('fill', 'currentColor'); svg.append(re); } }));
    return svg;
  }
  UI.buildTools = buildTools;
  function buildTools() {
    const tb = $('toolbox'); tb.innerHTML = '';
    app.TOOL_LIST.forEach(([id, name, key], i) => {
      if (i === 8 || i === 12) tb.append(h('div', { class: 'sep' }));
      tb.append(h('button', { 'data-tool': id, title: name + ' (' + (app.keyLabel('tool:' + id) || key) + ')', 'aria-label': name, onclick: () => app.setTool(id) }, icon(id)));
    });
    tb.append(h('div', { class: 'sep' }));
    // undo and redo on the toolbox, for tablets and phones without a keyboard
    tb.append(h('button', { class: 'touch-only', title: 'Undo (Ctrl+Z, or tap with two fingers)', 'aria-label': 'Undo', onclick: () => app.history.undo() }, icon('undo')),
      h('button', { class: 'touch-only', title: 'Redo (Ctrl+Y, or tap with three fingers)', 'aria-label': 'Redo', onclick: () => app.history.redo() }, icon('redo')));
    const sw = h('div', { class: 'swatches' },
      h('div', { class: 'sw s checker', id: 'swS', title: 'Secondary colour (right button). X swaps.', onclick: () => app.swapColours() }, h('div', { class: 'sw-fill', id: 'swSf' })),
      h('div', { class: 'sw p checker', id: 'swP', title: 'Primary colour (left button)', onclick: () => UI.showTab('colour') }, h('div', { class: 'sw-fill', id: 'swPf' })));
    tb.append(sw);
  }
  UI.refreshTools = function () { document.querySelectorAll('#toolbox [data-tool]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === app.tool)); };

  // ================================================================ options bar
  UI.refreshOptions = function () {
    const bar = $('optbar'); bar.innerHTML = '';
    const g = (...k) => h('span', { class: 'grp' }, ...k);
    const lbl = (t) => h('span', { class: 'lbl' }, t);
    const t = app.tool;
    const brushOpts = () => {
      if (app.brush.custom) bar.append(g(lbl('Brush'), app.brush.custom.w + '×' + app.brush.custom.h, h('button', { onclick: () => { app.brush.custom = null; UI.refreshOptions(); app.render(); } }, 'Back to round/square')));
      else bar.append(g(lbl('Size'), num('optSize', app.brush.size, 1, 64, 1, (v) => { app.brush.size = Math.max(1, Math.min(64, v | 0)); app.render(); }, 'Brush size ([ and ])'),
        sel('optShape', [['square', 'Square'], ['circle', 'Round']], app.brush.shape, (v) => { app.brush.shape = v; app.render(); })));
    };
    const inkOpts = () => {
      bar.append(g(lbl('Ink'), sel('optInk', [['simple', 'Simple'], ['shading', 'Shading'], ['dither', 'Dither pattern']], app.ink, (v) => { app.ink = v; UI.refreshOptions(); }, 'Shading steps through the palette ramp; dither paints a pattern')));
      if (app.ink === 'dither') bar.append(g(sel('optPat', Object.keys(T.DITHERS), app.dither.pattern, (v) => { app.dither.pattern = v; UI.refreshOptions(); }),
        app.dither.pattern.startsWith('bayer') ? h('input', { type: 'range', id: 'optLvl', min: 0, max: 1, step: 0.0625, value: app.dither.level, title: 'Pattern level', oninput: (e) => (app.dither.level = +e.target.value) }) : null,
        chk('optGap', 'Gaps in secondary', app.dither.fillAlt, (v) => (app.dither.fillAlt = v))));
      if (app.ink === 'shading') bar.append(g(h('span', { class: 'muted' }, app.palSel && app.palSel.to > app.palSel.from ? 'Ramp: palette ' + app.palSel.from + '–' + app.palSel.to : 'Ramp: whole palette (shift-click swatches for a range)')));
    };
    if (t === 'pencil' || t === 'eraser' || t === 'shade') {
      brushOpts();
      bar.append(g(chk('optPP', 'Pixel perfect', app.pixelPerfect, (v) => (app.pixelPerfect = v), 'Removes the doubled pixel on corners of 1px strokes (P)')));
      bar.append(g(lbl('Pen pressure'), sel('optPress', [['size', 'Size'], ['dither', 'Dither density'], ['off', 'Off']], app.input.pressure, (v) => { app.input.pressure = v; app.saveInput(); UI.refreshOptions(); }, 'What a pen\'s pressure changes. Size goes from the minimum up to the brush size.'),
        app.input.pressure === 'size' ? h('span', { class: 'grp' }, lbl('Min'), num('optMin', app.input.minSize, 1, 64, 1, (v) => { app.input.minSize = Math.max(1, v | 0); app.saveInput(); }, 'Brush size at the lightest touch')) : null));
      if (t === 'pencil') inkOpts();
      if (t === 'shade') bar.append(g(h('span', { class: 'muted' }, 'Left lightens, right darkens, one step along the ramp')));
    } else if (t === 'line' || t === 'rect' || t === 'ellipse') {
      if (t === 'line') brushOpts(); else bar.append(g(chk('optFilled', 'Filled', app.shapeFilled, (v) => (app.shapeFilled = v), 'Alt while dragging also fills')));
      inkOpts();
      bar.append(g(h('span', { class: 'muted' }, 'Shift: ' + (t === 'line' ? 'snap angles' : 'square/circle'))));
    } else if (t === 'fill') {
      bar.append(g(chk('optCont', 'Contiguous', app.fillContiguous, (v) => (app.fillContiguous = v), 'Off: every pixel of that colour')));
      inkOpts();
    } else if (t === 'gradient') {
      bar.append(g(lbl('Steps'), num('optSteps', app.gradient.steps, 2, 32, 1, (v) => (app.gradient.steps = Math.max(2, v | 0)))),
        g(lbl('Dither'), h('input', { type: 'range', id: 'optGD', min: 0, max: 1, step: 0.05, value: app.gradient.dither, oninput: (e) => (app.gradient.dither = +e.target.value), title: '0: flat bands (the default: no dither in the art)' })),
        g(chk('optRad', 'Radial', app.gradient.radial, (v) => (app.gradient.radial = v))),
        g(h('span', { class: 'muted' }, app.palSel && app.palSel.to > app.palSel.from ? 'Colours: palette range' : 'Colours: primary to secondary')));
    } else if (t === 'select' || t === 'lasso' || t === 'wand') {
      bar.append(g(lbl('Mode'), sel('optSelOp', [['replace', 'Replace'], ['add', 'Add (Shift)'], ['subtract', 'Subtract (Alt)']], app.selOp, (v) => (app.selOp = v))));
      if (t === 'wand') bar.append(g(chk('optWC', 'Contiguous', app.wandContiguous, (v) => (app.wandContiguous = v))));
      bar.append(g(h('button', { onclick: app.selectAll }, 'All'), h('button', { onclick: () => app.setSelection(null) }, 'None'), h('button', { onclick: app.invertSelection }, 'Invert'), h('button', { onclick: app.brushFromSelection, title: 'Ctrl+B' }, 'Make brush')));
    } else if (t === 'move') {
      bar.append(g(h('span', { class: 'muted' }, app.selection ? 'Drag to move the selection' : 'Drag to move the whole cel')),
        g(h('button', { onclick: () => app.flip('h') }, 'Flip H'), h('button', { onclick: () => app.flip('v') }, 'Flip V'), h('button', { onclick: () => UI.action('rotsprite') }, 'Rotate / scale…')));
    } else if (t === 'picker') bar.append(g(h('span', { class: 'muted' }, 'Left: primary, right: secondary. Alt: the active layer only (keeps the palette index)')));
    else if (t === 'light') bar.append(g(h('span', { class: 'muted' }, 'Drag a lamp to move it. Set lamps up in the Light panel.')), g(h('button', { onclick: () => UI.showTab('light') }, 'Light panel')));
    else if (t === 'hand') bar.append(g(h('span', { class: 'muted' }, 'Drag to pan. Wheel zooms; Space-drag pans with any tool.')));
    // always
    bar.append(h('span', { class: 'grp', style: 'margin-left:auto' },
      lbl('Tiled'), sel('optTiled', [['none', 'Off'], ['x', 'Horizontal'], ['y', 'Vertical'], ['both', 'Both']], app.tiled, (v) => { app.tiled = v; app.render(); }, 'Loops the canvas (T)'),
      lbl('Mirror'), chk('optSymX', 'X', app.symmetry.x, (v) => { app.symmetry.x = v; app.render(); }, 'Mirror left/right (S)'), chk('optSymY', 'Y', app.symmetry.y, (v) => { app.symmetry.y = v; app.render(); }, 'Mirror up/down')));
  };

  UI.refreshZoom = () => { $('zoomLabel').textContent = app.zoom * 100 + '%'; };
  UI.refreshDocInfo = function () {
    const d = app.doc;
    $('docinfo').textContent = (app.isDirty() ? '● ' : '') + (app.file ? app.file.name + ' — ' : '') + d.name + ' · ' + d.w + '×' + d.h + ' · ' + (d.mode === 'indexed' ? 'Indexed (' + d.palette.length + ')' : 'RGB') + ' · frame ' + (app.frame + 1) + '/' + d.frames.length;
    document.title = 'Dead Pixel';
  };

  // ================================================================ colour panel
  let hsv = [0, 0, 1], alpha = 255, editBefore = null, editTimer = 0;
  function buildColour() {
    const p = $('paneColour'); p.innerHTML = '';
    p.append(h('div', { class: 'row' },
      h('div', { class: 'checker', style: 'width:42px;height:42px;border:1px solid var(--line)' }, h('div', { id: 'cpPrim', class: 'sw-fill' })),
      h('div', { class: 'grow' },
        h('div', { class: 'row' }, h('input', { type: 'text', id: 'cpHex', class: 'mono', style: 'width:96px', title: 'Hex (#rrggbb or #rrggbbaa)', onchange: (e) => { const c = DP.hexToRgba(e.target.value); if (c) { pickerSet(c); applyPicker(true); } } }), h('button', { onclick: () => app.swapColours(), title: 'Swap (X)' }, 'Swap')),
        h('div', { id: 'cpLinkRow' }))));
    const sv = h('canvas', { id: 'cpSV', width: 180, height: 150 }), hue = h('canvas', { id: 'cpHue', class: 'strip', width: 18, height: 150 }), al = h('canvas', { id: 'cpAlpha', class: 'strip', width: 18, height: 150 });
    p.append(h('div', { class: 'picker' }, sv, hue, al));
    const rgbRow = h('div', { class: 'row' });
    ['R', 'G', 'B', 'A'].forEach((n, i) => rgbRow.append(h('label', { class: 'chk' }, n, num('cp' + n, 0, 0, 255, 1, (v) => { const c = currentPicker(); c[i] = Math.max(0, Math.min(255, v | 0)); pickerSet(c); applyPicker(true); }))));
    p.append(rgbRow);
    p.append(h('h3', null, 'Tints, shades, tones'));
    p.append(h('div', { class: 'matrix', id: 'cpMatrix' }));
    p.append(h('p', { class: 'note' }, 'Click a cell to use it. Click a row name to add the row to the palette. "Ramp" bends hue the hand-built way: lighter warms, darker cools.'));
    p.append(h('h3', null, 'Ramp builder'));
    p.append(h('div', { class: 'row' }, 'Primary to secondary in', num('cpSteps', 6, 2, 32, 1, () => {}), 'steps', chk('cpHueShift', 'Hue shift', true, () => {}),
      h('button', { onclick: () => { const n = +$('cpSteps').value || 6; const cols = DP.ramp(app.primary, app.secondary, n, $('cpHueShift').checked); addToPalette(cols, 'Add ramp'); } }, 'Add to palette')));
    p.append(h('h3', null, 'Gradient map'));
    p.append(h('p', { class: 'note' }, 'Repaints the active layer (this frame) by brightness onto the selected palette range, or the primary-to-secondary ramp.'));
    p.append(h('div', { class: 'row' }, h('button', { onclick: () => gradientMap(false) }, 'Map this frame'), h('button', { onclick: () => gradientMap(true) }, 'Map every frame')));

    const drag = (canvas, fn) => {
      const go = (e) => { const r = canvas.getBoundingClientRect(); fn(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))); applyPicker(false); };
      canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); beginEdit(); go(e); canvas.onpointermove = go; });
      canvas.addEventListener('pointerup', () => { canvas.onpointermove = null; endEdit(); });
    };
    drag(sv, (x, y) => { hsv[1] = x; hsv[2] = 1 - y; });
    drag(hue, (x, y) => { hsv[0] = y * 360; });
    drag(al, (x, y) => { alpha = Math.round((1 - y) * 255); });
  }
  function currentPicker() { return DP.hsvToRgb(hsv[0], hsv[1], hsv[2]).concat(alpha); }
  function pickerSet(c) { const v = DP.rgbToHsv(c[0], c[1], c[2]); if (v[1] > 0 && v[2] > 0) hsv[0] = v[0]; hsv[1] = v[1]; hsv[2] = v[2]; alpha = c[3] === undefined ? 255 : c[3]; }
  function beginEdit() { if (app.linkEntry && app.primaryIndex >= 0 && !editBefore) editBefore = app.doc.snapshot(); }
  function endEdit() {
    clearTimeout(editTimer);
    editTimer = setTimeout(() => {
      if (!editBefore) return;
      const before = editBefore, after = app.doc.snapshot(); editBefore = null;
      app.history.push(DP.snapEntry(app.doc, 'Edit palette colour', before, after));
    }, 250);
  }
  /** The picker's colour becomes the primary (and its palette entry, when linked). */
  function applyPicker(oneShot) {
    const c = currentPicker();
    if (app.linkEntry && app.primaryIndex >= 0 && app.primaryIndex < app.doc.palette.length) {
      if (oneShot) beginEdit();
      app.doc.palette[app.primaryIndex] = c.slice();
      app.doc.touch();
      if (oneShot) endEdit();
      app.primary = c; refreshPaletteGrid(); app.render();
    } else app.primary = c;
    refreshColourWidgets(false);
  }
  function drawPicker() {
    const sv = $('cpSV'), hue = $('cpHue'), al = $('cpAlpha'); if (!sv) return;
    const g = sv.getContext('2d'), w = sv.width, H = sv.height;
    const base = DP.hsvToRgb(hsv[0], 1, 1);
    const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, '#fff'); gx.addColorStop(1, css(base));
    g.fillStyle = gx; g.fillRect(0, 0, w, H);
    const gy = g.createLinearGradient(0, 0, 0, H); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, '#000');
    g.fillStyle = gy; g.fillRect(0, 0, w, H);
    g.strokeStyle = hsv[2] > 0.5 ? '#000' : '#fff'; g.beginPath(); g.arc(hsv[1] * w, (1 - hsv[2]) * H, 5, 0, Math.PI * 2); g.stroke();
    const hg = hue.getContext('2d');
    for (let y = 0; y < hue.height; y++) { hg.fillStyle = css(DP.hsvToRgb((y / hue.height) * 360, 1, 1)); hg.fillRect(0, y, hue.width, 1); }
    hg.fillStyle = '#fff'; hg.fillRect(0, (hsv[0] / 360) * hue.height - 1, hue.width, 2);
    const ag = al.getContext('2d'); ag.clearRect(0, 0, al.width, al.height);
    for (let y = 0; y < al.height; y += 6) for (let x = 0; x < al.width; x += 6) { ag.fillStyle = ((x + y) / 6) & 1 ? '#888' : '#ccc'; ag.fillRect(x, y, 6, 6); }
    const rgb = currentPicker(), agr = ag.createLinearGradient(0, 0, 0, al.height);
    agr.addColorStop(0, css(rgb.slice(0, 3).concat(255))); agr.addColorStop(1, css(rgb.slice(0, 3).concat(0)));
    ag.fillStyle = agr; ag.fillRect(0, 0, al.width, al.height);
    ag.fillStyle = '#fff'; ag.fillRect(0, (1 - alpha / 255) * al.height - 1, al.width, 2);
  }
  function refreshColourWidgets(fromState) {
    if (fromState) pickerSet(app.primary);
    const c = app.primary;
    if ($('cpPrim')) $('cpPrim').style.background = css(c);
    if ($('cpHex') && document.activeElement !== $('cpHex')) $('cpHex').value = DP.rgbaToHex(c, true);
    ['R', 'G', 'B', 'A'].forEach((n, i) => { const el = $('cp' + n); if (el && document.activeElement !== el) el.value = c[i]; });
    $('swPf').style.background = css(app.primary); $('swSf').style.background = css(app.secondary);
    const lr = $('cpLinkRow');
    if (lr) {
      lr.innerHTML = '';
      if (app.primaryIndex >= 0) lr.append(chk('cpLink', 'Edit palette entry ' + app.primaryIndex + (app.doc.mode === 'indexed' ? ' (recolours it everywhere)' : ''), app.linkEntry, (v) => (app.linkEntry = v)));
      else lr.append(h('span', { class: 'muted' }, app.doc.mode === 'indexed' ? 'Not on the palette' : 'Free colour (not a palette entry)'));
    }
    drawPicker();
    const m = DP.matrix(c, 7), mx = $('cpMatrix');
    if (mx) {
      mx.innerHTML = '';
      for (const [name, row] of [['Tints', m.tints], ['Shades', m.shades], ['Tones', m.tones], ['Ramp', m.ramp]]) {
        mx.append(h('button', { style: 'background:none;border:0;text-align:left;padding:0;color:var(--muted);font-size:11px;height:20px;min-height:0', title: 'Add this row to the palette', onclick: () => addToPalette(row, 'Add ' + name.toLowerCase()) }, '+ ' + name));
        row.forEach((col) => mx.append(h('button', { style: 'background:' + css(col), title: DP.rgbaToHex(col), onclick: () => { app.setColour('primary', col, app.doc.palette.findIndex((p) => p[0] === col[0] && p[1] === col[1] && p[2] === col[2])); } })));
      }
    }
  }
  UI.colourChanged = function () { refreshColourWidgets(true); refreshPaletteGrid(); };
  function addToPalette(cols, label) {
    app.mutate(label, () => { if (app.doc.palette.length + cols.length > 256) { UI.toast('A palette holds 256 colours at most.'); return false; } for (const c of cols) app.doc.palette.push(c.slice(0, 3).concat(255)); });
  }
  function gradientMap(all) {
    const d = app.doc, l = app.layer(); if (!l || l.kind === 'group') return;
    const vals = app.rampValues(6), lumOf = (v) => DP.lum(T.rgbaOf(d, v));
    const sorted = vals.slice().sort((a, b) => lumOf(a) - lumOf(b));
    const frames = all ? d.frames.map((_, i) => i) : [app.frame];
    app.mutate('Gradient map', () => {
      const done = new Set();
      for (const f of frames) {
        const id = d.celId(l.id, f); if (!id || done.has(id)) continue; done.add(id);
        const data = d.celData[id].data.slice();
        for (let i = 0; i < d.w * d.h; i++) {
          const v = T.getVal(d, data, i); if (T.isClear(d, v)) continue;
          if (app.selection && !app.selection.mask[i]) continue;
          const k = Math.min(sorted.length - 1, Math.floor(lumOf(v) * sorted.length));
          let nv = sorted[k];
          if (d.mode !== 'indexed') nv = ((nv & 0xffffff00) | (v & 255)) >>> 0;
          T.setVal(d, data, i, nv);
        }
        d.celData[id] = { data };
      }
    });
  }

  // ================================================================ palette panel
  function buildPalette() {
    const p = $('panePalette'); p.innerHTML = '';
    const presets = DP.allPresets();
    p.append(h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Colour mode'),
      h('button', { id: 'pmRGB', onclick: () => UI.action('modeRGB') }, 'RGB'), h('button', { id: 'pmIdx', onclick: () => UI.action('modeIndexed') }, 'Indexed')));
    p.append(h('div', { class: 'row' }, sel('palPreset', Object.keys(presets), Object.keys(presets)[0], () => {}, 'Palette presets'),
      h('button', { onclick: () => loadPreset(false), title: 'Replace the palette' }, 'Load'), h('button', { onclick: () => loadPreset(true) }, 'Append')));
    p.append(h('div', { class: 'palgrid', id: 'palGrid' }));
    p.append(h('p', { class: 'note', id: 'palInfo' }));
    p.append(h('div', { class: 'row' },
      h('button', { onclick: () => addToPalette([app.primary], 'Add colour') }, 'Add primary'),
      h('button', { onclick: deleteEntries }, 'Delete'),
      sel('palSort', [['', 'Sort…'], ['lum', 'By brightness'], ['hue', 'By hue'], ['sat', 'By saturation'], ['rev', 'Reverse']], '', (v) => { sortPalette(v); $('palSort').value = ''; })));
    p.append(h('div', { class: 'row' }, 'Size', num('palSize', 0, 1, 256, 1, () => {}), h('button', { onclick: () => resizePalette(+$('palSize').value) }, 'Resize')));
    p.append(h('h3', null, 'Copy and paste'));
    p.append(h('div', { class: 'row' }, h('button', { onclick: copyPalette }, 'Copy as hex'), h('button', { onclick: () => pasteBox(false) }, 'Paste…'), h('button', { onclick: () => pasteBox(true) }, 'Paste as new')));
    p.append(h('h3', null, 'Extract'));
    p.append(h('div', { class: 'row' }, 'Up to', num('palN', 16, 2, 256, 1, () => {}), 'colours', h('button', { onclick: () => extract(false) }, 'From this frame'), h('button', { onclick: () => extract(true) }, 'From an image…')));
    p.append(h('h3', null, 'Files'));
    p.append(h('div', { class: 'row' }, h('button', { onclick: () => UI.action('importPalette') }, 'Import…'),
      sel('palExp', [['', 'Export as…'], ['gpl', 'GIMP .gpl'], ['hex', '.hex'], ['pal', 'JASC .pal'], ['png', 'Swatch .png']], '', (v) => { if (v) UI.action('exportPalette', v); $('palExp').value = ''; })));
    p.append(h('p', { class: 'note' }, 'Click: primary. Right-click: secondary. Shift-click: a range (ramp for shading, gradients and maps). Drag to reorder. In indexed mode reordering and deleting keep the picture the same.'));
  }
  function loadPreset(append) {
    const cols = DP.allPresets()[$('palPreset').value]; if (!cols) return;
    app.mutate(append ? 'Append palette' : 'Load palette', () => {
      const d = app.doc;
      if (append) { if (d.palette.length + cols.length > 256) return false; cols.forEach((c) => d.palette.push(c.slice())); return; }
      if (d.mode === 'indexed') {
        // keep the picture: remap every index to its nearest in the new palette
        const map = d.palette.map((c) => DP.nearest(cols, c));
        for (const id in d.celData) { const a = d.celData[id].data.slice(); for (let i = 0; i < a.length; i++) if (a[i] >= 0) a[i] = map[a[i]] === undefined ? -1 : map[a[i]]; d.celData[id].data = a; }
      }
      d.palette = cols.map((c) => c.slice());
    });
    app.palSel = null;
  }
  function deleteEntries() {
    const d = app.doc;
    const drop = app.palSel ? Array.from({ length: app.palSel.to - app.palSel.from + 1 }, (_, i) => app.palSel.from + i) : app.primaryIndex >= 0 ? [app.primaryIndex] : [];
    if (!drop.length) { UI.toast('Pick a swatch (or shift-click a range) to delete.'); return; }
    if (drop.length >= d.palette.length) { UI.toast('Keep at least one colour.'); return; }
    app.mutate('Delete colours', () => d.removePaletteEntries(drop));
    app.palSel = null; app.primaryIndex = -1; UI.refreshPanels();
  }
  function sortPalette(how) {
    if (!how) return;
    const d = app.doc;
    const order = d.palette.map((_, i) => i);
    const key = (i) => { const c = d.palette[i], hs = DP.rgbToHsv(c[0], c[1], c[2]); return how === 'lum' ? DP.lum(c) : how === 'hue' ? (hs[1] < 0.08 ? -1 + DP.lum(c) : hs[0] + DP.lum(c) * 0.01) : hs[1]; };
    if (how === 'rev') order.reverse(); else order.sort((a, b) => key(a) - key(b));
    app.mutate('Sort palette', () => d.reorderPalette(order));
    app.primaryIndex = -1; app.palSel = null;
  }
  function resizePalette(n) {
    n = Math.max(1, Math.min(256, n | 0)); const d = app.doc;
    if (n === d.palette.length) return;
    app.mutate('Resize palette', () => {
      if (n < d.palette.length) d.removePaletteEntries(Array.from({ length: d.palette.length - n }, (_, i) => n + i));
      else while (d.palette.length < n) { const k = d.palette.length; d.palette.push([k * 37 % 256, k * 91 % 256, k * 53 % 256, 255].map((v, i) => (i < 3 ? 40 + (v % 180) : 255))); }
    });
  }
  async function copyPalette() {
    const text = DP.IO.paletteToHex(app.doc.palette);
    try { await navigator.clipboard.writeText(text); UI.toast('Copied ' + app.doc.palette.length + ' colours as hex'); }
    catch (e) { UI.modal('Copy the palette', (b) => { const t = h('textarea', { id: 'palCopy', readonly: true }, text); b.append(t); setTimeout(() => t.select(), 0); }); }
  }
  async function pasteBox(asNew) {
    const val = await UI.modal(asNew ? 'Paste a palette' : 'Paste colours', (b) => b.append(h('p', null, 'Paste hex codes, a .gpl or a .pal here.'), h('textarea', { id: 'palPaste', placeholder: '#ff0044\n#ffbf66 ...' })),
      [{ label: 'Cancel', value: null }, { label: asNew ? 'Replace palette' : 'Add colours', value: 'ok', primary: true }]);
    if (!val) return;
    const cols = DP.IO.parsePalette(document.getElementById('palPaste') ? document.getElementById('palPaste').value : '');
    UI.applyPalette(cols, asNew);
  }
  UI.applyPalette = function (cols, replace) {
    if (!cols.length) { UI.toast('No colours found.'); return; }
    const d = app.doc;
    app.mutate(replace ? 'Replace palette' : 'Add colours', () => {
      if (replace) {
        if (d.mode === 'indexed') { const map = d.palette.map((c) => DP.nearest(cols, c)); for (const id in d.celData) { const a = d.celData[id].data.slice(); for (let i = 0; i < a.length; i++) if (a[i] >= 0) a[i] = map[a[i]]; d.celData[id].data = a; } }
        d.palette = cols.slice(0, 256).map((c) => c.slice());
      } else { if (d.palette.length + cols.length > 256) return false; cols.forEach((c) => d.palette.push(c.slice())); }
    });
  };
  async function extract(fromFile) {
    const n = Math.max(2, Math.min(256, +$('palN').value || 16));
    let rgba;
    if (fromFile) { const [f] = await DP.IO.pick('image/*'); if (!f) return; rgba = (await DP.IO.readImage(f)).rgba; }
    else rgba = app.composite(app.frame);
    UI.applyPalette(DP.extractPalette(rgba, n), true);
  }
  let dragFrom = -1;
  function refreshPaletteGrid() {
    const g = $('palGrid'); if (!g) return;
    const d = app.doc; g.innerHTML = '';
    d.palette.forEach((c, i) => {
      const inR = app.palSel && i >= app.palSel.from && i <= app.palSel.to;
      const b = h('button', {
        class: 'ps' + (inR ? ' in-range' : '') + (i === app.primaryIndex ? ' is-p' : '') + (i === app.secondaryIndex ? ' is-s' : ''),
        style: 'background:' + css(c), title: i + '  ' + DP.rgbaToHex(c, true), draggable: 'true',
        onclick: (e) => {
          if (e.shiftKey) { const a = app.primaryIndex >= 0 ? app.primaryIndex : i; app.palSel = { from: Math.min(a, i), to: Math.max(a, i) }; refreshPaletteGrid(); UI.refreshOptions(); return; }
          app.palSel = null; app.setColour('primary', c, i); UI.refreshOptions();
        },
        oncontextmenu: (e) => { e.preventDefault(); app.setColour('secondary', c, i); },
        ondblclick: () => { app.linkEntry = true; UI.showTab('colour'); UI.colourChanged(); },
        ondragstart: (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; },
        ondragover: (e) => { e.preventDefault(); b.classList.add('drag-over'); },
        ondragleave: () => b.classList.remove('drag-over'),
        ondrop: (e) => {
          e.preventDefault(); b.classList.remove('drag-over');
          if (dragFrom < 0 || dragFrom === i) return;
          const order = d.palette.map((_, k) => k); order.splice(i, 0, order.splice(dragFrom, 1)[0]);
          app.mutate('Reorder palette', () => d.reorderPalette(order));
          if (app.primaryIndex >= 0) app.primaryIndex = order.indexOf(app.primaryIndex);
          if (app.secondaryIndex >= 0) app.secondaryIndex = order.indexOf(app.secondaryIndex);
          dragFrom = -1; refreshPaletteGrid();
        },
      });
      g.append(b);
    });
    if ($('palInfo')) $('palInfo').textContent = d.palette.length + ' colours' + (app.palSel ? ' · range ' + app.palSel.from + '–' + app.palSel.to : '') + (app.primaryIndex >= 0 ? ' · primary is entry ' + app.primaryIndex : '');
    if ($('palSize')) $('palSize').value = d.palette.length;
    if ($('pmRGB')) { $('pmRGB').setAttribute('aria-pressed', d.mode === 'rgb'); $('pmIdx').setAttribute('aria-pressed', d.mode === 'indexed'); }
  }
  UI.refreshPaletteGrid = refreshPaletteGrid;

  // ================================================================ light panel
  function buildLight() { UI.refreshLight(); }
  UI.refreshLight = function () {
    const p = $('paneLight'); if (!p) return;
    const d = app.doc, L = d.lighting, me = app.light;
    const keepScroll = p.parentElement.scrollTop;
    p.innerHTML = '';
    const changed = () => { app.render(); app.autosave(); UI.refreshPreview && UI.refreshPreview(); };
    const range = (id, label, value, min, max, step, set, fmt) => {
      const out = h('output', { id: id + 'O' }, fmt ? fmt(value) : value);
      return [h('label', { for: id }, label), h('input', { type: 'range', id, min, max, step, value, oninput: (e) => { set(+e.target.value); out.textContent = fmt ? fmt(+e.target.value) : e.target.value; changed(); } }), out];
    };
    p.append(h('p', { class: 'note' }, 'The light pass: a light map per sprite (surface direction + light mask, made the Pixel Art Lighter way), banded lamp pools on the multiply layer with a glow share added, ambient grade and darkness. Lighting is never painted into the art.'));
    p.append(h('div', { class: 'row' },
      h('button', { id: 'lpOn', 'aria-pressed': me.preview, onclick: () => { me.preview = !me.preview; UI.refreshLight(); app.render(); } }, me.preview ? 'Preview on' : 'Preview off'),
      sel('lpView', [['lit', 'Lit'], ['light', 'Light only'], ['normal', 'Light map: normals'], ['mask', 'Light map: mask']], me.view, (v) => { me.view = v; if (!me.preview) { me.preview = true; UI.refreshLight(); } app.render(); }),
      chk('lpAnim', 'Flicker', me.animate, (v) => { me.animate = v; app.render(); })));
    p.append(h('h3', null, 'Light map'));
    const kv = h('div', { class: 'kv' });
    kv.append(h('label', { for: 'lpPreset' }, 'Preset'), sel('lpPreset', ['Character', 'Object', 'Architecture'], L.preset, (v) => { L.preset = v; UI.refreshLight(); changed(); }, 'LightMapGenerator presets'), h('span'));
    kv.append(...range('lpStr', 'Shaping', L.strength, 0, 1, 0.05, (v) => (L.strength = v), (v) => Math.round(v * 100) + '%'));
    p.append(kv);
    p.append(chk('lpUse', 'Shade by surface', L.useMap, (v) => { L.useMap = v; changed(); }, 'Off: flat pools'));
    p.append(h('h3', null, 'Render style'));
    if (!L.style) L.style = L.smooth ? 'smooth' : 'banded';
    const kvS = h('div', { class: 'kv' });
    kvS.append(h('label', { for: 'lpStyle' }, 'Style'), sel('lpStyle', DP.Lighting.STYLES, L.style, (v) => { L.style = v; changed(); }, 'How light levels land on the pixels. Banded is the default.'), h('span'));
    kvS.append(...range('lpSteps', 'Light steps', L.steps || 5, 2, 16, 1, (v) => (L.steps = v), (v) => (v === 5 ? '5 (default)' : v)));
    p.append(kvS);
    if (L.preset === 'Architecture') {
      const P = L.planes;
      p.append(h('div', { class: 'row' }, 'Room planes', sel('lpPlanes', [['none', 'None'], ['ground', 'Ground (floor line)'], ['box', 'Box (back wall)']], P.kind, (v) => { P.kind = v; if (v === 'box' && (P.x1 <= P.x0 || P.x1 > d.w || P.y1 > d.h)) Object.assign(P, { x0: Math.round(d.w * 0.25), x1: Math.round(d.w * 0.75), y0: Math.round(d.h * 0.15), y1: Math.round(d.h * 0.65) }); UI.refreshLight(); changed(); })));
      if (P.kind === 'ground' && P.floorLine > d.h) P.floorLine = Math.round(d.h * 0.65);
      if (P.kind === 'ground') p.append(h('div', { class: 'row' }, 'Floor from y', num('lpFloor', P.floorLine, 0, d.h, 1, (v) => { P.floorLine = v; changed(); })));
      if (P.kind === 'box') p.append(h('div', { class: 'row' }, 'Back wall x', num('lpX0', P.x0, 0, d.w, 1, (v) => { P.x0 = v; changed(); }), '–', num('lpX1', P.x1, 0, d.w, 1, (v) => { P.x1 = v; changed(); })),
        h('div', { class: 'row' }, 'Back wall y', num('lpY0', P.y0, 0, d.h, 1, (v) => { P.y0 = v; changed(); }), '–', num('lpY1', P.y1, 0, d.h, 1, (v) => { P.y1 = v; changed(); }), chk('lpCeil', 'Ceiling', P.ceiling !== false, (v) => { P.ceiling = v; changed(); })));
    }
    p.append(h('h3', null, 'Mood'));
    if (L.moods && L.moods.length) {
      // an imported room: its times of day and its alternate world, one click each
      const cur = L.moods.find((m) => m.name === L.mood);
      p.append(h('div', { class: 'row' }, h('label', { for: 'lpMood' }, 'Room mood'),
        sel('lpMood', [['', 'Custom']].concat(L.moods.map((m) => [m.name, m.name])), cur ? cur.name : '', (v) => {
          if (!v) { L.mood = ''; UI.refreshLight(); return; }
          app.mutate('Room mood: ' + v, () => DP.Lighting.applyMood(d, v));
          if (!me.preview) me.preview = true;
          UI.refreshLight(); UI.refreshTimeline && UI.refreshTimeline(); changed();
        }, 'This room\'s looks: the light for each time of day, and the alternate world, Undertow (which also shows the Undertow layers)')));
      if (cur) p.append(h('p', { class: 'note' }, 'Weather: ' + DP.Lighting.weatherText(cur) + '. The weather is drawn by the engine\'s effects layers, not here.'));
    }
    const kv2 = h('div', { class: 'kv' });
    kv2.append(h('label', { for: 'lpAmb' }, 'Ambient'), h('input', { type: 'color', id: 'lpAmb', value: DP.rgbaToHex(L.ambient), oninput: (e) => { L.ambient = DP.hexToRgba(e.target.value).slice(0, 3); changed(); } }), h('span'));
    kv2.append(...range('lpDark', 'Darkness', L.darkness, 0, 1, 0.01, (v) => (L.darkness = v), (v) => Math.round(v * 100) + '%'));
    p.append(kv2, chk('lpSky', 'Darker towards the top (rooms with sky)', L.skyFalloff, (v) => { L.skyFalloff = v; changed(); }));
    p.append(h('h3', null, 'Lamps'));
    const list = h('div', { class: 'lights' });
    L.lights.forEach((l, i) => list.append(h('button', { 'aria-pressed': i === me.sel, onclick: () => { me.sel = i; UI.refreshLight(); app.render(); } }, h('span', { class: 'dot', style: 'background:' + css(l.colour) }), l.name + (l.shadow ? ' (shadow)' : '') + (l.off ? ' (off)' : ''), h('span', { class: 'muted mono', style: 'margin-left:auto' }, l.x + ',' + l.y))));
    p.append(list);
    p.append(h('div', { class: 'row' },
      h('button', { onclick: () => { L.lights.push({ name: 'Lamp ' + (L.lights.length + 1), x: Math.round(d.w / 2), y: Math.round(d.h / 3), radius: Math.round(Math.max(d.w, d.h) / 2), flatten: 1, colour: [255, 191, 102], intensity: 0.5, height: -1, flicker: 'Steady', shadow: false, placed: true }); me.sel = L.lights.length - 1; UI.refreshLight(); changed(); } }, 'Add lamp'),
      h('button', { onclick: () => { if (!L.lights[me.sel]) return; L.lights.splice(me.sel, 1); me.sel = Math.max(0, me.sel - 1); UI.refreshLight(); changed(); } }, 'Remove'),
      h('button', { onclick: () => app.setTool('light') }, 'Place on canvas (K)')));
    const l = L.lights[me.sel];
    if (l) {
      const kv3 = h('div', { class: 'kv' });
      kv3.append(h('label', { for: 'lpName' }, 'Name'), h('input', { type: 'text', id: 'lpName', value: l.name, onchange: (e) => { l.name = e.target.value; UI.refreshLight(); changed(); } }), h('span'));
      kv3.append(h('label', { for: 'lpCol' }, 'Colour'), h('input', { type: 'color', id: 'lpCol', value: DP.rgbaToHex(l.colour), oninput: (e) => { l.colour = DP.hexToRgba(e.target.value).slice(0, 3); changed(); } }), h('span'));
      kv3.append(...range('lpInt', 'Intensity', l.intensity, 0, 1, 0.01, (v) => (l.intensity = v), (v) => v.toFixed(2)));
      kv3.append(...range('lpRad', 'Radius', l.radius, 2, Math.max(d.w, d.h) * 1.5, 1, (v) => (l.radius = v)));
      kv3.append(...range('lpFlat', 'Flatten', l.flatten, 0.05, 1, 0.05, (v) => (l.flatten = v), (v) => v.toFixed(2)));
      kv3.append(...range('lpHgt', 'Height', l.height, -1, 120, 1, (v) => (l.height = v), (v) => (v < 0 ? 'auto' : v)));
      kv3.append(h('label', { for: 'lpFlick' }, 'Flicker'), sel('lpFlick', DP.Lighting.FLICKERS, l.flicker, (v) => { l.flicker = v; changed(); }), h('span'));
      kv3.append(h('label', null, 'Position'), h('div', { class: 'row' }, num('lpX', l.x, -999, 9999, 1, (v) => { l.x = v; changed(); UI.refreshLight(); }), num('lpY', l.y, -999, 9999, 1, (v) => { l.y = v; changed(); UI.refreshLight(); })), h('span'));
      p.append(kv3, h('div', { class: 'row' }, chk('lpShadow', 'Shadow pool (darkens)', l.shadow, (v) => { l.shadow = v; UI.refreshLight(); changed(); }), chk('lpOff', 'Off', !!l.off, (v) => { l.off = v; UI.refreshLight(); changed(); })));
    }
    p.append(h('h3', null, 'Export'));
    p.append(h('div', { class: 'row' }, h('button', { onclick: () => UI.action('exportLightMap') }, 'Light map (this frame)'), h('button', { onclick: () => UI.action('exportLightSheet') }, 'Light maps sheet'), h('button', { onclick: () => UI.action('exportLit') }, 'Lit render PNG')));
    p.append(h('p', { class: 'note' }, 'Light map PNGs use the runtime\'s encoding (R,G surface direction, B light mask, A coverage), the same files its LightMapBuilder writes.'));
    p.parentElement.scrollTop = keepScroll;
  };

  // ================================================================ brushes panel
  UI.refreshBrushes = function () {
    const p = $('paneBrushes'); if (!p) return;
    p.innerHTML = '';
    p.append(h('p', { class: 'note' }, 'Select part of a sprite and save it as a brush to stamp or paint repeated patterns (bricks, leaves, rivets).'));
    p.append(h('div', { class: 'row' }, h('button', { onclick: app.brushFromSelection }, 'New brush from selection (Ctrl+B)'), h('button', { onclick: () => { app.brush.custom = null; UI.refreshBrushes(); UI.refreshOptions(); app.render(); } }, 'Use a plain brush')));
    p.append(chk('brOwn', 'Paint with the brush\'s own colours (off: its shape in the primary colour)', app.brush.ownColours, (v) => { app.brush.ownColours = v; }));
    const list = h('div', { class: 'brushlist' });
    app.brushes.forEach((b, i) => {
      const c = h('canvas', { width: b.w, height: b.h, style: 'width:' + Math.min(48, b.w * 4) + 'px' });
      const g = c.getContext('2d'), img = g.createImageData(b.w, b.h);
      for (let k = 0; k < b.vals.length; k++) { const rgba = b.mode === 'indexed' ? (b.vals[k] >= 0 ? b.palette[b.vals[k]] : [0, 0, 0, 0]) : T.unpack(b.vals[k]); img.data.set(rgba, k * 4); }
      g.putImageData(img, 0, 0);
      list.append(h('button', { 'aria-pressed': app.brush.custom === b, title: b.w + '×' + b.h + ' (right-click to delete)', onclick: () => { app.brush.custom = b; app.setTool('pencil'); UI.refreshBrushes(); }, oncontextmenu: (e) => { e.preventDefault(); app.brushes.splice(i, 1); if (app.brush.custom === b) app.brush.custom = null; UI.refreshBrushes(); UI.refreshOptions(); } }, c));
    });
    if (!app.brushes.length) list.append(h('p', { class: 'note' }, 'No custom brushes yet.'));
    p.append(list);
  };

  // ================================================================ tabs
  UI.showTab = function (name) {
    document.querySelectorAll('#panelTabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
    document.querySelectorAll('.pane').forEach((p) => (p.hidden = p.dataset.pane !== name));
    if (name === 'history') UI.refreshHistory();
  };

  // ================================================================ history panel
  /** Every undo step by name; click one to go back (or forward) to just after it. */
  UI.refreshHistory = function () {
    const p = $('paneHistory'); if (!p || p.hidden) return;
    const H = app.history, done = H.undoStack, undone = H.redoStack.slice().reverse();
    p.innerHTML = '';
    const goTo = (n) => { // n = how many steps should stay done
      const cb = H.onChange; H.onChange = null; // one refresh at the end, not one per step
      try { while (H.undoStack.length > n && H.undo()); while (H.undoStack.length < n && H.redo()); } finally { H.onChange = cb; }
      if (cb) cb();
    };
    const list = h('div', { class: 'history' });
    const row = (label, n, state) => h('button', { class: 'history-item ' + state, 'aria-current': state === 'current' ? 'step' : null, onclick: () => goTo(n) }, label);
    list.append(row('Opened ' + app.doc.name, 0, done.length ? 'done' : 'current'));
    done.forEach((e, i) => list.append(row(e.label || 'Step', i + 1, i === done.length - 1 ? 'current' : 'done')));
    undone.forEach((e, i) => list.append(row(e.label || 'Step', done.length + i + 1, 'undone')));
    p.append(list, h('p', { class: 'muted' }, done.length + ' step' + (done.length === 1 ? '' : 's') + ' to undo, ' + undone.length + ' to redo, using ' + Math.ceil(H.bytes / 1048576) + ' of ' + H.limitMB + ' MB (View > Preferences). Click a step to go back to it.'));
    const cur = list.querySelector('.current'); if (cur) cur.scrollIntoView({ block: 'nearest' });
  };
  UI.refreshPanels = function () { refreshColourWidgets(true); refreshPaletteGrid(); UI.refreshLight(); UI.refreshBrushes(); UI.refreshHistory(); };

  UI.build = function () {
    buildTools(); buildColour(); buildPalette(); buildLight(); UI.refreshBrushes();
    document.querySelectorAll('#panelTabs [data-tab]').forEach((b) => b.addEventListener('click', () => UI.showTab(b.dataset.tab)));
    $('zoomIn').onclick = () => app.zoomStep(1); $('zoomOut').onclick = () => app.zoomStep(-1); $('zoomFit').onclick = () => app.fit();
    UI.buildTimeline(); UI.buildMenus(); UI.buildPreview();
    UI.refreshTools(); UI.refreshOptions();
  };
})(window);
