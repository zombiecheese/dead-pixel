# Developing Dead Pixel

Plain JavaScript with no dependencies, no bundler and no framework. Each file in `public/js` is a classic script
that adds to one global namespace, `DP`, so the app also runs from `file://`.

## Layout

```
public/
  index.html          the page; script order matters (see below)
  css/app.css         dark UI, design tokens on :root
  js/
    palettes-game.js  DP.GAME_PALETTES: the room palettes
    lighting.js       DP.Lighting: LightMapGenerator + the RoomFxSim light pass, render styles, flicker
    core.js           colours, palettes, DP.Doc, blend modes, DP.History, DP.mutate
    tools.js          DP.Tools: strokes, pixel perfect, inks, shapes, fill, gradient, selections, clipboard
    transform.js      DP.Transform: Scale2x, RotSprite, flips, 90° turns
    io.js             DP.IO: PNG/indexed PNG/GIF/ZIP encoders, .deadpixel, sprite sheets, palettes, downloads
    samples.js        DP.Samples: the sample projects, drawn in code
    unity-script.js   generated from unity/Editor/DeadPixelSheetImporter.cs (do not edit)
    app.js            DP.app: state, canvas, tools, playback, keymap, autosave, start-up
    ui-panels.js      DP.UI: helpers, toolbox, option bar, Colour/Palette/Light/Brushes/History panels
    ui-timeline.js    timeline bar, layer × frame grid, preview window
    ui-menus.js       menus and every UI.action (dialogs, import, export)
unity/Editor/         the Unity importer (AssetPostprocessor)
docs/                 GUIDE, LIGHTING, DEPLOY, FORMAT, ROADMAP, this file
.github/workflows/     CI: npm test and the single-file build on every PR; container.yml publishes the image
samples/              sample projects + GIFs (tools/make_samples.mjs)
wiki/                 the GitHub wiki's source; .github/workflows/wiki.yml publishes it from main
tests/run.mjs         node tests for everything that isn't UI
tools/                build.mjs, make_samples.mjs, make_icons.py, import_unity.mjs, render_moods.mjs
```

Script order: palettes-game, lighting, core, tools, transform, io, samples, unity-script, app, ui-panels,
ui-timeline, ui-menus. Everything up to `samples` has no DOM use and also loads in node (the tests eval them).

## The document (`DP.Doc`)

| Field | Holds |
| --- | --- |
| `w`, `h`, `mode` | size; `'rgb'` or `'indexed'` |
| `palette` | `[[r,g,b,a], …]` up to 256 |
| `layers` | flat array, bottom first; `{id, name, kind: layer\|background\|group, parent, visible, locked, opacity, blend}` |
| `frames` | `[{duration}]` in ms |
| `cels` | `'layerId/frame' → celId`. Two keys with the same celId are a **linked cel**. |
| `celData` | `celId → {data}`: `Uint8ClampedArray` RGBA (rgb) or `Int16Array` palette indices, -1 clear (indexed) |
| `tags` | `[{name, from, to, colour, dir: forward\|reverse\|pingpong}]` |
| `lighting` | see `DP.Lighting.defaults()` |
| `grid`, `indexedBlendSnap`, `version` | tile grid, indexed blend snapping, a change counter for caches |

Tools work on **pixel values**: a packed `0xRRGGBBAA` in rgb mode (0 is clear) or a palette index in indexed mode.
`DP.Tools.getVal` / `setVal` / `isClear` / `rgbaOf` hide the difference.

## Undo

- **Cel arrays are never changed after a commit.** A stroke (`new T.Stroke(app, layerId, frame)`) works on a copy,
  and `commit(history, label)` swaps it in and pushes before/after arrays. Undo just swaps them back.
- **Structural changes** (layers, frames, palette, tags, lights) go through `app.mutate(label, fn)`. It snapshots the
  document before and after `fn`. Snapshots share cel arrays, so they are cheap.
- **The cap is memory, not steps.** Each history entry lists the pixel arrays it keeps alive in `refs`. `DP.History`
  counts each array once however many entries share it, and drops the oldest steps once the total passes the limit
  (256 MB by default, `history.setLimitMB(mb)`, set in View > Preferences). Strokes pass `[before, after]`;
  snapshot changes build their entry with `DP.snapEntry(doc, label, before, after)`. An entry without `refs` counts
  as free, so give any new kind of entry its arrays.
- After any change, call `doc.touch()` (or go through the helpers above) so `doc.version` moves and caches refresh.

## Adding a tool

1. Add an entry to `TOOLS` in `app.js`:
   `name: { down(p, e) { …; return { move(q, ev), up(q, ev), cancel() } } }`.
   `p` is a doc pixel `[x, y]`. Draw through a `T.Stroke` so undo, selections, tiled mode and mirror all work.
2. Add an icon to `ICONS` in `ui-panels.js` (a 9×9 grid of `#` and `.`), a toolbox button and a key in
   `app.js`'s shortcut switch.
3. Add its option bar settings in `UI.refreshOptions`.

## Adding an export

Write the encoder in `io.js` (pure, testable in node), then add a menu entry in `ui-menus.js` and an action that
calls `saveBytes(bytes, filename, mime)`. **Always save through `IO.save` / `saveBytes`**: it uses the system Save dialog where
the browser has one, else a download. Nothing may be sent to the server.

## Tests and builds

```sh
npm test                         # node tests/run.mjs: lighting, inks, pixel perfect, RotSprite, formats, samples
node tools/build.mjs             # regenerate public/js/unity-script.js from the C# importer
node tools/build.mjs --single    # dist/deadpixel.html, everything inlined
node tools/make_samples.mjs      # rewrite samples/*.deadpixel and *.gif
python3 tools/make_icons.py      # redraw the zombie-head logo and favicons
node tools/import_unity.mjs <unity project> <out> [--only A,B] [--strip F] [--moods F] [--no-clip]   # Unity/PowerQuest art -> .deadpixel
node tools/render_moods.mjs <Room.deadpixel> <out> [--scale 2] [--crop 320]   # a room lit in each of its moods, as PNGs
```

The Docker build and GitHub Actions (`.github/workflows/test.yml`, on every pull request and push to main) run the
tests and the single-file build, so keep them green.

## Rules to keep

These are the project's ground rules; keep them.

- **Storage.** Saves and exports never go on the server or container. They stay local to the user, through the
  browser: downloads, file open, and saving back to a file the user opened. The only browser storage is the
  autosave and Preferences (pen, touch, undo memory, shortcuts) in localStorage, and Open recent's file handles in
  IndexedDB. The server only serves static files: nginx, read-only, `GET`/`HEAD` only ([DEPLOY.md](DEPLOY.md)).
- **Format.** The `.deadpixel` format only grows: add fields, never change or remove existing ones, and bump
  `version` only for a change old readers can't ignore. Update [FORMAT.md](FORMAT.md).
- **Lighting.** `lighting.js` matches a Unity C# runtime (`LightMapGenerator`, `FxCanvas.Banded`, `RoomFxSim`) so
  exported light maps look the same in the engine. Change the maths only together with that runtime, and keep the
  lighting tests passing.
- **Art.** The art style is dither-free; only the engine lighting dithers. Defaults never dither art (indexed
  conversion, gradients).
- **Docs.** Keep the README, `docs/` and `wiki/` current when features change, and move items in [ROADMAP.md](ROADMAP.md)
  in the same PR.
- **Name.** "Dead Pixel". The logo is a pixelated zombie head showing its brain (`tools/make_icons.py`).
