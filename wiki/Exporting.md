# Exporting

Every export is built in the browser and downloads to your computer. Exports are under **File > Export**.

| Export | You get | Use it for |
| --- | --- | --- |
| **Sprite sheet for Unity / Unreal** (`Ctrl+E`) | A zip with the sheet PNG and its data | Unity, Unreal Paper2D, Godot, Phaser or your own tools |
| **Frames for PowerQuest** | A zip of one PNG per frame | PowerQuest characters and rooms |
| **This frame as PNG** | One PNG | Single images |
| **Animated GIF** | A GIF | Sharing |
| **Unity importer script (C#)** | `DeadPixelSheetImporter.cs` | Put it in a Unity Editor folder once |
| Light maps and lit renders | PNGs | See [Lighting](Lighting#getting-it-out) |

## Sprite sheet

| Option | Choices |
| --- | --- |
| **For** | Unity (PNG + JSON, sliced by the importer script), Unreal Paper2D (PNG + `.paper2dsprites`), generic (PNG + JSON), or PNG only. |
| **Layout** | One row, one column, a grid (choose the number of columns), or a row per tag. |
| **Frames** | All frames, or one tag. |
| **Padding between** and **Border** | Pixels between and around frames, so sprites don't bleed into each other. |
| **Pixels per unit** | Written into the data for Unity. |
| **Pivot** | Bottom centre (characters stand on their feet), centre, or top left. |
| **Light map sheet too** | Adds a matching `name_light.png`. |
| **Lit render** | Draws the sheet under the current lighting. |

The generic JSON lists every frame's rectangle and duration, the tags and the layers. See
[Unity and Unreal](Unity-and-Unreal) for bringing sheets into each engine.

## Frames for PowerQuest

One PNG per frame, named the way PowerQuest groups animations: `Tag_0.png`, `Tag_1.png`… for every tag, or
`name_0.png`… when there are no tags. Unzip into the character's or room's `Sprites` folder.

- **Light maps too** adds a `LightMaps/` folder with a light map for each frame.
- **Indexed PNGs** (indexed mode) writes palette PNGs.

For a file converted from a Unity project ([Importing Unity projects](Importing-Unity-Projects)), each sprite is
saved under its original name, size and place instead, so it drops over the original and keeps its Unity settings and
every animation that uses it. Frames you drew new get the next free `Tag_n.png`. A room prop that the canvas cuts off
is left out (convert with `--no-clip` to edit those).

## This frame as PNG

Choose a scale (1× to 8×), whether it is **Lit**, and whether to write an **indexed PNG** when the sprite is indexed.

## Animated GIF

Choose all frames or one tag, a scale (1× to 8×), and whether it is **Lit**. Frame durations and tag directions are
kept.
