/* Dead Pixel: the timeline matrix (frames across, layers down, cels at the crossings, tags above) and the floating
   preview window. */
(function (root) {
  'use strict';
  const DP = root.DP, app = DP.app, UI = DP.UI, h = UI.h;
  const $ = (id) => document.getElementById(id);
  const NAME_W = 210, CELL_W = 30;

  function frameRange() {
    if (app.range) return { from: Math.min(app.range.from, app.range.to), to: Math.max(app.range.from, app.range.to) };
    return { from: app.frame, to: app.frame };
  }
  UI.frameRange = frameRange;

  // ================================================================ toolbar
  UI.refreshTimelineBar = function () {
    const bar = $('tlBar'); bar.innerHTML = '';
    const d = app.doc, l = app.layer();
    const g = (...k) => h('span', { class: 'grp' }, ...k);
    const lbl = (t) => h('span', { class: 'lbl' }, t);
    const btn = (label, title, fn, attrs) => h('button', Object.assign({ title, 'aria-label': title, onclick: fn }, attrs || {}), label);
    const loop = h('select', { id: 'tlLoop', title: 'What Play loops', onchange: (e) => { app.loopTag = +e.target.value; if (app.playing) { app.togglePlay(); app.togglePlay(); } } },
      h('option', { value: -1 }, 'All frames'), ...d.tags.map((t, i) => h('option', { value: i }, t.name)));
    loop.value = app.loopTag;
    bar.append(g(btn('⏮', 'First frame', () => app.goFrame(0)), btn('◀', 'Previous frame (,)', () => app.goFrame(app.frame - 1)),
      btn(app.playing ? '❚❚' : '▶', 'Play / pause (Enter)', () => app.togglePlay(), { id: 'tlPlay' }),
      btn('▶|', 'Next frame (.)', () => app.goFrame(app.frame + 1)), btn('⏭', 'Last frame', () => app.goFrame(d.frames.length - 1)), loop));
    const r = frameRange();
    bar.append(g(lbl('Frame'), btn('+', 'New empty frame (Alt+N)', () => UI.action('newFrame')), btn('⧉', 'Duplicate frame', () => UI.action('dupFrame')), btn('−', 'Delete frame(s)', () => UI.action('delFrame')),
      btn('←', 'Move frame left', () => UI.action('moveFrame', -1)), btn('→', 'Move frame right', () => UI.action('moveFrame', 1)),
      h('input', { type: 'number', id: 'tlDur', min: 10, max: 10000, step: 10, value: d.frames[app.frame].duration, title: 'Duration in ms (applies to the selected frames)', onchange: (e) => UI.action('duration', +e.target.value) }), lbl('ms')));
    const blend = h('select', { id: 'tlBlend', title: 'Blend mode', disabled: !l, onchange: (e) => app.mutate('Blend mode', () => { l.blend = e.target.value; }) }, ...DP.BLEND_MODES.map((m) => h('option', { value: m }, m)));
    if (l) blend.value = l.blend;
    const groups = d.layers.filter((x) => x.kind === 'group' && x.id !== (l && l.id));
    const parent = h('select', { id: 'tlParent', title: 'Group', disabled: !l || (l && l.kind === 'background'), onchange: (e) => UI.action('setParent', e.target.value || null) }, h('option', { value: '' }, 'No group'), ...groups.map((x) => h('option', { value: x.id }, x.name)));
    if (l) parent.value = l.parent || '';
    bar.append(g(lbl('Layer'), btn('+', 'New layer', () => UI.action('newLayer')), btn('▤', 'New group', () => UI.action('newGroup')), btn('⧉', 'Duplicate layer', () => UI.action('dupLayer')), btn('−', 'Delete layer', () => UI.action('delLayer')),
      btn('↑', 'Move layer up', () => UI.action('moveLayer', 1)), btn('↓', 'Move layer down', () => UI.action('moveLayer', -1)), btn('⤓', 'Merge down', () => UI.action('mergeDown')),
      blend, h('input', { type: 'range', id: 'tlOpacity', min: 0, max: 255, value: l ? l.opacity : 255, title: 'Opacity', style: 'width:80px', disabled: !l, onchange: (e) => app.mutate('Opacity', () => { l.opacity = +e.target.value; }) }), parent));
    bar.append(g(lbl('Cels'), btn('Link', 'Link the selected frames\' cels on this layer (one drawing shared)', () => UI.action('linkCels')), btn('Unlink', 'Give the selected frames their own copies', () => UI.action('unlinkCels')),
      btn('+ Tag', 'Tag the selected frames (shift-click frame numbers to select)', () => UI.action('newTag'))));
    const o = app.onion;
    bar.append(g(h('button', { 'aria-pressed': o.on, title: 'Onion skin (O)', onclick: () => { o.on = !o.on; UI.refreshTimelineBar(); app.render(); } }, 'Onion'),
      h('input', { type: 'number', id: 'tlOnPrev', min: 0, max: 8, value: o.prev, title: 'Frames before', style: 'width:46px', onchange: (e) => { o.prev = Math.max(0, +e.target.value); app.render(); } }),
      h('input', { type: 'number', id: 'tlOnNext', min: 0, max: 8, value: o.next, title: 'Frames after', style: 'width:46px', onchange: (e) => { o.next = Math.max(0, +e.target.value); app.render(); } }),
      h('input', { type: 'range', id: 'tlOnOp', min: 0.05, max: 0.9, step: 0.05, value: o.opacity, title: 'Onion opacity', style: 'width:70px', oninput: (e) => { o.opacity = +e.target.value; app.render(); } }),
      h('label', { class: 'chk', title: 'Red before, blue after' }, h('input', { type: 'checkbox', id: 'tlOnTint', checked: o.tint, onchange: (e) => { o.tint = e.target.checked; app.render(); } }), 'Tint'),
      h('label', { class: 'chk', title: 'Draw ghosts over the frame (useful with a background layer)' }, h('input', { type: 'checkbox', id: 'tlOnAbove', checked: o.above, onchange: (e) => { o.above = e.target.checked; app.render(); } }), 'Above'),
      h('button', { title: 'Preview window (F2)', onclick: () => UI.togglePreview() }, 'Preview')));
    void r;
  };
  UI.refreshPlay = function () { const b = $('tlPlay'); if (b) b.textContent = app.playing ? '❚❚' : '▶'; };

  // ================================================================ grid
  function rows() {
    const d = app.doc, out = [];
    const walk = (parent, depth) => {
      const kids = d.children(parent).slice().reverse();
      for (const l of kids) { out.push({ l, depth }); if (l.kind === 'group' && !l.collapsed) walk(l.id, depth + 1); }
    };
    walk(null, 0);
    return out;
  }
  UI.refreshTimeline = function () {
    UI.refreshTimelineBar();
    const d = app.doc, grid = $('tlGrid'); grid.innerHTML = '';
    const n = d.frames.length, r = frameRange();
    grid.style.gridTemplateColumns = NAME_W + 'px repeat(' + n + ', ' + CELL_W + 'px)';
    // tag row
    grid.append(h('div', { class: 'tl-corner' }, 'Tags'));
    const tagRow = h('div', { class: 'tl-tagrow', style: 'grid-column: 2 / span ' + n });
    d.tags.forEach((t, i) => tagRow.append(h('button', {
      class: 'tl-tag', title: t.name + ' (' + (t.from + 1) + '–' + (t.to + 1) + ', ' + t.dir + '). Click to edit.',
      style: 'left:' + (t.from * CELL_W + 1) + 'px;width:' + ((t.to - t.from + 1) * CELL_W - 2) + 'px;background:' + t.colour + ';top:' + (3 + (i % 2) * 0) + 'px',
      onclick: () => UI.action('editTag', i),
    }, t.name)));
    grid.append(tagRow);
    // frame numbers
    grid.append(h('div', { class: 'tl-corner h2' }, 'Layers'));
    for (let f = 0; f < n; f++) {
      grid.append(h('div', {
        class: 'tl-cell frame-h' + (f === app.frame ? ' cur-f' : '') + (app.range && f >= r.from && f <= r.to ? ' in-r' : ''), 'data-f': f,
        title: 'Frame ' + (f + 1) + ' · ' + d.frames[f].duration + ' ms. Shift-click to select a range; double-click for the duration.',
        onclick: (e) => selectFrame(f, e.shiftKey), ondblclick: () => UI.action('durationDialog'),
      }, h('span', null, String(f + 1), h('small', null, d.frames[f].duration))));
    }
    for (const { l, depth } of rows()) {
      const cur = l.id === app.layerId;
      const nm = h('div', { class: 'tl-name' + (cur ? ' cur-l' : ''), style: 'padding-left:' + (6 + depth * 14) + 'px', onclick: () => { app.layerId = l.id; UI.refreshTimeline(); app.render(); }, ondblclick: (e) => rename(e.currentTarget, l) },
        h('button', { class: l.visible ? '' : 'off', title: l.visible ? 'Hide' : 'Show', 'aria-label': 'Visibility', onclick: (e) => { e.stopPropagation(); app.mutate(l.visible ? 'Hide layer' : 'Show layer', () => { l.visible = !l.visible; }); } }, '◉'),
        h('button', { class: l.locked ? '' : 'off', title: l.locked ? 'Unlock' : 'Lock', 'aria-label': 'Lock', onclick: (e) => { e.stopPropagation(); l.locked = !l.locked; UI.refreshTimeline(); } }, l.locked ? '🔒' : '🔓'),
        l.kind === 'group' ? h('button', { title: l.collapsed ? 'Expand' : 'Collapse', onclick: (e) => { e.stopPropagation(); l.collapsed = !l.collapsed; UI.refreshTimeline(); } }, l.collapsed ? '▸' : '▾') : null,
        h('span', { class: 'nm' }, l.name),
        h('span', { class: 'kind' }, l.kind === 'group' ? 'group' : l.kind === 'background' ? 'bg' : (l.blend !== 'normal' ? l.blend : '') + (l.opacity < 255 ? ' ' + Math.round(l.opacity / 2.55) + '%' : '')));
      grid.append(nm);
      for (let f = 0; f < n; f++) {
        const id = d.celId(l.id, f), prev = f > 0 ? d.celId(l.id, f - 1) : null;
        const cls = 'tl-cell' + (l.kind !== 'group' ? ' cel' : '') + (f === app.frame ? ' cur-f' : '') + (cur ? ' cur-l' : '') + (app.range && f >= r.from && f <= r.to && cur ? ' in-r' : '');
        const cell = h('div', { class: cls, 'data-f': f, onclick: (e) => { app.layerId = l.id; selectFrame(f, e.shiftKey); } });
        if (l.kind !== 'group') {
          if (id && prev === id) cell.append(h('span', { class: 'link' }));
          cell.append(h('span', { class: id ? 'dot' : 'dot empty' }));
        }
        grid.append(cell);
      }
    }
    UI.refreshDocInfo();
  };
  function selectFrame(f, extend) {
    if (extend) app.range = { from: app.range ? app.range.from : app.frame, to: f };
    else app.range = null;
    app.frame = f;
    if (app.playing) app.togglePlay();
    UI.refreshTimeline(); app.render();
  }
  /** Just the current-frame highlight (cheap, for playback). */
  UI.refreshTimelineCursor = function () {
    document.querySelectorAll('#tlGrid [data-f]').forEach((c) => c.classList.toggle('cur-f', +c.dataset.f === app.frame));
    const dur = $('tlDur'); if (dur && document.activeElement !== dur) dur.value = app.doc.frames[app.frame].duration;
    UI.refreshDocInfo();
  };
  function rename(el, l) {
    const nmEl = el.querySelector('.nm'); if (!nmEl) return;
    const inp = h('input', { type: 'text', id: 'tlRename', value: l.name });
    nmEl.replaceWith(inp); inp.focus(); inp.select();
    const done = (ok) => { if (ok && inp.value.trim() && inp.value !== l.name) app.mutate('Rename layer', () => { l.name = inp.value.trim(); }); else UI.refreshTimeline(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); e.stopPropagation(); });
    inp.addEventListener('blur', () => done(true));
    inp.addEventListener('click', (e) => e.stopPropagation());
  }
  UI.buildTimeline = function () {};

  // ================================================================ preview window
  let pvPlaying = true, pvTimer = 0, pvFrame = 0, pvSeqIdx = 0;
  UI.buildPreview = function () {
    const box = $('preview'), head = $('previewHead');
    let drag = null;
    head.addEventListener('pointerdown', (e) => { if (e.target.closest('select,button,input,label')) return; const r = box.getBoundingClientRect(); drag = { x: e.clientX - r.left, y: e.clientY - r.top }; head.setPointerCapture(e.pointerId); });
    head.addEventListener('pointermove', (e) => { if (!drag) return; box.style.left = Math.max(0, Math.min(innerWidth - 80, e.clientX - drag.x)) + 'px'; box.style.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - drag.y)) + 'px'; box.style.right = 'auto'; });
    head.addEventListener('pointerup', () => (drag = null));
    $('pvClose').onclick = () => UI.togglePreview(false);
    $('pvPlay').onclick = () => { pvPlaying = !pvPlaying; $('pvPlay').textContent = pvPlaying ? '❚❚' : '▶'; tick(); };
    for (const id of ['pvZoom', 'pvLit', 'pvBg']) $(id).addEventListener('change', () => drawPreview());
    $('pvTag').addEventListener('change', () => { pvSeqIdx = 0; tick(); });
  };
  function sequence() {
    const d = app.doc, k = +$('pvTag').value;
    const t = k >= 0 ? d.tags[k] : null;
    if (!t) return d.frames.map((_, i) => i);
    const fwd = []; for (let i = t.from; i <= Math.min(t.to, d.frames.length - 1); i++) fwd.push(i);
    if (t.dir === 'reverse') return fwd.reverse();
    if (t.dir === 'pingpong') return fwd.concat(fwd.slice(1, -1).reverse());
    return fwd;
  }
  function tick() {
    clearTimeout(pvTimer);
    if ($('preview').hidden) return;
    if (!pvPlaying) { pvFrame = app.frame; drawPreview(); return; }
    const seq = sequence(); if (!seq.length) return;
    pvSeqIdx %= seq.length; pvFrame = seq[pvSeqIdx];
    drawPreview();
    pvTimer = setTimeout(() => { pvSeqIdx++; tick(); }, app.doc.frames[pvFrame].duration);
  }
  function drawPreview() {
    const d = app.doc, c = $('pvCanvas'), z = +$('pvZoom').value;
    if (c.width !== d.w * z || c.height !== d.h * z) { c.width = d.w * z; c.height = d.h * z; }
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const bg = $('pvBg').value;
    if (bg === 'checker') { for (let y = 0; y < c.height; y += 8) for (let x = 0; x < c.width; x += 8) { g.fillStyle = ((x + y) / 8) & 1 ? '#8f8f8f' : '#bdbdbd'; g.fillRect(x, y, 8, 8); } }
    else { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
    const f = pvPlaying ? pvFrame : app.frame;
    const rgba = $('pvLit').checked ? app.displayed(f, 'lit') : app.composite(f);
    const tmp = document.createElement('canvas'); tmp.width = d.w; tmp.height = d.h;
    tmp.getContext('2d').putImageData(new ImageData(rgba, d.w, d.h), 0, 0);
    g.drawImage(tmp, 0, 0, c.width, c.height);
  }
  UI.refreshPreview = () => { if (!$('preview').hidden && !pvPlaying) drawPreview(); };
  UI.togglePreview = function (show) {
    const box = $('preview');
    box.hidden = show === undefined ? !box.hidden : !show;
    if (!box.hidden) {
      const s = $('pvTag'), v = s.value; s.innerHTML = '';
      s.append(h('option', { value: -1 }, 'All frames'), ...app.doc.tags.map((t, i) => h('option', { value: i }, t.name)));
      s.value = v && +v < app.doc.tags.length ? v : (app.doc.tags.length ? 0 : -1);
      $('pvLit').checked = app.light.preview;
      tick();
    } else clearTimeout(pvTimer);
  };
  // keep a paused preview in step with edits
  const oldRender = app.render;
  app.render = function () { oldRender(); if (!$('preview').hidden && !pvPlaying) drawPreview(); };
})(window);
