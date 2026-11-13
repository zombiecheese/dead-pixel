# Status and roadmap

What has shipped, what is being worked on, and what is still to do. **Keep this current:** a PR that delivers,
starts or drops an item moves it between these sections in the same PR.

Last updated 2026-11-13.

## Releases

| Version | Date | What's in it |
| --- | --- | --- |
| v1.0.0 | 2026-11-13 | The first public release: everything under Delivered below. |

To cut a release: bump `version` in `package.json` and `DP.VERSION` in `public/js/core.js`, add a row here, merge,
then publish a GitHub release tagged `vX.Y.Z` on `main`. Publishing it builds and pushes the container image.

## Delivered

Verified in Chromium (desktop, iPad and iPhone emulation); 29 node tests pass (`npm test`), also run by CI.

| Item | Release |
| --- | --- |
| Editor: timeline, layers/groups, blend modes, linked cels, onion skin, tags, preview window | v1.0.0 |
| Drawing: pixel perfect, shading ink, dither inks, custom brushes, tiled mode, symmetry, RotSprite | v1.0.0 |
| Colour: RGB and indexed, palette tools, colour wheel, tints/shades/tones, ramps, gradient maps | v1.0.0 |
| Lighting preview and render, light map export | v1.0.0 |
| Exports: .deadpixel, PNG, GIF, Unity/Unreal sheets, PowerQuest frames | v1.0.0 |
| Samples (File > Samples) and docs | v1.0.0 |
| Pens, tablets and phones: pressure, eraser end, gestures, touch layout | v1.0.0 |
| `tools/import_unity.mjs`: a Unity / PowerQuest project's characters, rooms and other sprite folders as `.deadpixel` | v1.0.0 |
| Undo capped by memory (256 MB default, View > Preferences) | v1.0.0 |
| PowerQuest round trip: converted files record each cel's source sprite; Frames for PowerQuest writes sprites back under their original names, size and place (checked pixel-identical in node) | v1.0.0 |
| Room import clips to the room bounds, keeping scenery wider than the room; `--no-clip` to opt out | v1.0.0 |
| CI: GitHub Actions runs `npm test` and the single-file build | v1.0.0 |
| Container image on GitHub Container Registry for every release (amd64 and arm64) | v1.0.0 |
| Wiki: a page for every part of the app, published from `wiki/` by a workflow; live demo link in the README | next release |
| QoL: save in place and Save as, Open recent, unsaved-changes warning, History tab, reference image, off-palette highlight, Outline, Trim canvas, Mirror tag, rebindable shortcuts | v1.0.0 |
| Room moods: converted rooms open with their mood profile's lamps, art glows, times of day, alternate world and story moods (Light > Room mood); `tools/render_moods.mjs` renders a room in each | v1.0.0 |

## In progress

Nothing right now.

## Outstanding

Checks that need real hardware or a Unity editor (help welcome):

- **Round trip inside Unity**: unzip a Frames for PowerQuest export over a character's Sprites folder and play its
  animations. So far it has only been checked in node, not in the editor.
- **Pen pressure on real hardware**: so far only Chromium's emulated pen; needs a real iPad or Wacom.
- **Real file pickers**: Save in place, Open recent and their permission prompts can't be driven headless. Try them
  in Chrome or Edge.

Feature ideas (rough effort in working days):

| Idea | Effort | Decision needed |
| --- | --- | --- |
| Colour cycling / palette shifting / palette animation | about 3, plus 2 to 3 for a live Unity cycle | Baked frames only, or a live Unity cycle too? Can PowerQuest sprites take a custom shader? |
| Batch export | about 1 | None |
| Installable app (PWA, offline) | about 1 | None |
| Character-in-room preview | about 2 | None |
| Palette per room, shared across files | about 2 | Where it lives: the game project or Dead Pixel |
| Live link to the Unity project (edit and save straight into `Assets/`) | about 4 to 5 | None; Chrome and Edge only |
| Room overlay: walkable areas, hotspots, baselines | about 2 read-only, about 5 editable | Read-only or editable? |
| Lighting re-port check against the Unity runtime's C# | about 2, then per change | How to hear when the runtime's lighting changes |
| Tilemap mode | about 5 | Which engines' tilemaps to target |
