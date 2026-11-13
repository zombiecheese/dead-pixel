# Dead Pixel user guide

Dead Pixel is a pixel art editor for 2D games in Unity and Unreal. It runs in any modern browser (Chrome, Edge,
Firefox, Safari). Everything you make stays on your computer: projects save as `.deadpixel` files and exports
download through the browser. Nothing is ever stored on the server.

- [1. First look](#1-first-look)
- [2. Saving and opening](#2-saving-and-opening)
- [3. Drawing](#3-drawing)
- [4. Colour and palettes](#4-colour-and-palettes)
- [5. Layers](#5-layers)
- [6. Animation](#6-animation)
- [7. Lighting](#7-lighting)
- [8. Tiles and symmetry](#8-tiles-and-symmetry)
- [9. Rotating and scaling](#9-rotating-and-scaling)
- [10. Exporting for your game](#10-exporting-for-your-game)
- [11. Recipes](#11-recipes)
- [12. Shortcuts](#12-shortcuts)
- [13. Troubleshooting](#13-troubleshooting)

The defaults follow a dither-free art style: no dither painted into the art (only the engine lighting dithers), and haze, fog, glows and light pools are engine effects on their own layers, never painted in.

---

## 1. First look

| Area | What's there |
| --- | --- |
| **Menu bar** (top) | File, Edit, Sprite, Layer, Frame, View, Help. The right side shows the sprite's name, size, colour mode and frame. |
| **Toolbox** (left) | Drawing tools, then the primary and secondary colours (click the small arrow or press `X` to swap). |
| **Option bar** (above the canvas) | Settings for the current tool (size, shape, pixel perfect, ink, dither), plus Tiled and Mirror. |
| **Canvas** (middle) | Scroll to zoom, Space-drag or middle-drag to pan, `0` to fit. Two fingers pan and pinch on a tablet. |
| **Panels** (right) | Colour, Palette, Light and Brushes tabs. |
| **Timeline** (bottom) | Playback, frame and layer buttons, onion skin, then the grid of layers × frames. |

New to it? Open **File > Samples** and pick one. Each sample turns on the views it shows off:

| Sample | Try this |
| --- | --- |
| Walk cycle | Press `Enter` to play, switch the loop between Walk and Idle, toggle onion skin (`O`). On the Palette tab, double-click a hoodie colour and change it: every frame updates. |
| Lit room | The Light tab: change **Render style**, drag lamps with `K`, try the light-only and light-map views. |
| Portal pulse | An FX loop with linked cels (the joined dots in the timeline) and a screen-blend glow. |
| Brick tile | Draw across an edge: tiled mode wraps it. Pick the rivet brush on the Brushes tab and stamp. |

Your last session is kept in the browser and comes back when you reopen the page. That is a convenience, not a save:
use File > Save project for anything you want to keep.

## 2. Saving and opening

- **File > New sprite** (`Ctrl+N`): width, height, colour mode (RGB or indexed), palette and an optional background layer.
- **File > Save project** (`Ctrl+S`) saves `name.deadpixel`. It holds everything: layers, frames, cels, tags,
  palette and lights. Rename the sprite in **Sprite > Properties**. In Chrome and Edge, once a project has been
  opened or saved, `Ctrl+S` writes straight back to that file; **Save as** (`Ctrl+Shift+S`) picks a new one. Other
  browsers download a fresh copy each time.
- **File > Open** (`Ctrl+O`) opens a `.deadpixel` file. You can also drop one, or any image, onto the window.
- **File > Open recent** (Chrome and Edge) lists the last 8 projects you opened or saved. The list lives in this
  browser only; the browser may ask again for permission to read a file.
- A dot before the name in the title bar means there are unsaved changes. Dead Pixel asks before closing the tab,
  opening another file, starting a new sprite or loading a sample over them.
- **Import image as new sprite / as layer**, and **Import sprite sheet** (cut a sheet into frames by cell size,
  padding and border).

The file format is documented in [FORMAT.md](FORMAT.md). It's plain gzipped JSON, so tools can read and write it.

## 3. Drawing

| Tool | Key | Notes |
| --- | --- | --- |
| Pencil | `B` | Left button primary colour, right button secondary. Hold Shift while dragging for a straight line from where you pressed. |
| Eraser | `E` | On a background layer it paints the secondary colour instead of clearing. |
| Shading ink | `H` | Left lightens a pixel one step along the ramp, right darkens it. The ramp is the palette range you shift-click on the Palette tab, or the whole palette sorted dark to light. |
| Line | `L` | Shift snaps the angle to 22.5° steps. |
| Rectangle / Ellipse | `R` / `C` | Outline or filled (option bar). Shift makes a square or circle. |
| Fill | `G` | Contiguous, or global (every pixel of that colour) from the option bar or by holding Shift. |
| Gradient | `D` | Banded, linear or radial, from primary to secondary, optional dither pattern. |
| Eyedropper | `I` | Samples the whole picture. Alt- or Ctrl-click takes the active layer's own pixel (its palette index in indexed mode). Right button sets the secondary colour. |
| Select / Lasso / Wand | `M` / `Q` / `W` | Shift adds, Alt subtracts. Drawing stays inside the selection. |
| Move | `V` | Drags the selection (or the whole cel). Arrow keys nudge a pixel. |
| Lights | `K` | Drags lamps on the canvas (see [Lighting](#7-lighting)). |
| Hand | Space | Pan. |

**Brush size and shape.** `[` and `]` change the size. Square or round, or a custom brush.

**Pixel perfect** (`P`, on by default). Removes the doubled corner pixel on 1px freehand strokes as you draw, so
curves come out clean.

**Inks.** *Simple* paints the colour. *Shading* steps along the ramp. *Dither* paints a pattern of the primary
colour: checker, 25% and 75% dots, sparse, crisscross, diagonal, horizontal or vertical lines, or a 4×4 Bayer at any
level. The ink works with the pencil, shapes and fills. Use it for engine FX layers and tests. The defaults keep
dither out of the art itself.

**Custom brushes.** Select something and press `Ctrl+B` (Edit > New brush from selection). The Brushes tab lists them.
A brush paints in its own colours, or as a shape in the primary colour (option bar). Right-click a brush to delete it.

### Pens, tablets and phones

Dead Pixel works with a mouse, a pen or a finger on PCs, tablets and phones.

- **Pen pressure**: on the pencil, eraser and shading tools, the option bar's *Pen pressure* sets what pressing harder does.
  - **Size**: the brush grows from *Min* at the lightest touch up to the brush size. Set the size above 1 to feel it.
  - **Dither density**: a light touch paints a sparse 4×4 pattern and a hard press paints solid. Use this for FX layers; the defaults keep dither out of the art itself.
  - **Off**: pressure does nothing.
- **Pen buttons**: the pen's eraser end erases with any tool, and the side (barrel) button paints with the secondary colour.
- **Fingers**:
  - Pinch with two fingers to zoom and pan.
  - Tap with two fingers to undo, and with three to redo.
  - Once you've used a pen, one finger pans instead of painting, so a resting palm doesn't leave marks.
- **Touch layout**: on touch screens the buttons get bigger and the toolbox gains Undo and Redo buttons. On phones the toolbox, options and panels stack.

All of this is in **View > Preferences**, along with the pressure curve (soft, linear or firm) and what one finger does (paint, pan, or auto). Settings are kept in the browser.

Pressure works with pens that report it: Apple Pencil (Safari on iPad), Surface, Wacom and other Windows Ink pens (Chrome, Edge, Firefox), and Samsung S Pen (Chrome on Android).

**Clipboard.** `Ctrl+C`, `Ctrl+X` and `Ctrl+V`. A paste lands as a floating selection you drag into place with Move.

**Undo** (`Ctrl+Z`) and **redo** (`Ctrl+Y`) cover everything, including palette, layer and frame changes. History is limited by memory rather than steps: it keeps as many steps as fit in 256 MB, dropping the oldest first, so small sprites get deep undo and big rooms stay safe. Change the limit in **View > Preferences > Undo memory**.

**History** (the History tab, `Ctrl+H`) lists every step by name. Click one to go back to just after it, or click a
greyed step to redo up to it.

**Outline** (Edit > Outline) draws a 1 px line in the primary colour around the art on the current layer, or on its
edge. Corners off gives the clean pixel-art outline. With a selection, only the selected art gets one; tick Every
frame to do the whole layer.

**Reference image** (View > Reference image) shows a see-through picture behind or over the art for tracing a
screenshot or concept art, fitted to the canvas or at actual pixels, with an offset. It is never saved or exported.

**Highlight off-palette colours** (View) shows in magenta every pixel whose colour isn't on the palette, so RGB art
stays on your palette. Load the room's palette first (Palette tab).

## 4. Colour and palettes

### RGB and indexed

- **RGB**: every pixel has its own colour and alpha. Best for concept work and anything with soft alpha.
- **Indexed**: every pixel points at a palette entry. Change an entry and that colour changes everywhere, on every
  frame. Reordering, sorting or deleting entries keeps the picture the same. This is how to do palette swaps
  (outfits, hair colours, day/night variants).

Switch with **Sprite > RGB colour** or **Sprite > Indexed colour**. Going to indexed maps every pixel to the nearest
palette colour. Dither is off by default, following the art rule.

In indexed mode blend modes still work. **Sprite > Keep blends on the palette** puts each blended result back on the
nearest palette colour so the art stays inside the palette.

### Colour tab

- Saturation/value square, hue strip and alpha strip; hex and R, G, B, A fields.
- In indexed mode the colour is linked to its palette entry: editing it edits the entry.
- **Tints, shades, tones** rows and a hue-shifted **ramp** row from the primary colour. Click a cell to use it, click
  the row name to add the row to the palette.
- **Ramp builder**: primary to secondary in N steps, with optional hue shift (lighter warms, darker cools).
- **Gradient map**: recolours the active layer by brightness along a ramp, on this frame or every frame.

### Palette tab

- **Presets**: a set of room palettes (named "Room: …"), DB16, DB32, Game Boy, EGA, CGA and greys.
  **Load** replaces the palette; **Append** adds to it.
- **Drag** swatches to reorder. Shift-click selects a range (used as the shading ramp).
- **Sort** by brightness, hue or saturation, or reverse. **Resize** the palette. **Delete** entries.
- **Copy / Paste** as hex text, so palettes can be passed around in chat.
- **Extract** a palette from the frame or any image (median cut, choose how many colours).
- **Import / export** `.gpl` (GIMP, Aseprite), `.pal` (JASC), `.hex` and a swatch `.png`.

## 5. Layers

- **Kinds**: normal (transparent), **background** (opaque; the eraser paints the secondary colour) and **group**
  (holds layers; collapse it with the arrow).
- **Blend modes**: normal, multiply, screen, overlay, darken, lighten, colour dodge, colour burn, hard light,
  soft light, difference, exclusion, addition, subtract, divide, hue, saturation, colour, luminosity.
- **Opacity** 0 to 255, **visibility** (eye), **lock** (padlock).
- Layer > Duplicate, Delete, **Merge down**, **Layer properties** (name, blend, opacity, group).
- Double-click a layer name to rename. Use the ↑ ↓ buttons to reorder and the group drop-down to move a layer into a group.

## 6. Animation

### The timeline

Frames run across, layers run down, and each square is a **cel**. A dot means the cel has pixels; an empty square
means nothing on that layer in that frame.

- `,` and `.` step frames; the ⏮ ⏭ buttons jump to the first and last.
- **New frame** (`Alt+N`) copies the current frame. **Duplicate**, **Delete** and the ← → buttons move frames.
- Shift-click frame numbers to select a range. Duration, delete, move and link then act on the whole range.
- **Duration**: each frame has its own milliseconds (shown under the frame number).

### Tags and loops

Tags name a run of frames: Walk, Idle, Talk, Pick up. Make one with **+ Tag** (or Frame > New tag) over the selected
frames, and click a tag to edit or delete it. Each tag has:

- a colour,
- a direction: **forward**, **reverse** or **ping-pong**.

The loop drop-down next to Play chooses what plays: all frames or one tag. Exports use the tags too: one Unity clip
per tag, and `Tag_n.png` names for PowerQuest.

**Frame > Mirror tag into a new tag** copies a tag's frames to the end, flipped left to right, as a new tag (WalkR
becomes WalkL). On a character converted from a Unity project it flips around the feet, so the character stays on the same
spot; otherwise around the canvas centre. Linked cels stay linked.

### Linked cels

A linked cel is one drawing shared by several frames. Edit it on any of those frames and all of them change. Use
linked cels for parts that don't move (a background, a held prop, a head during a body bob).

- Select frames on a layer and press **Link**. Linked cels show joined dots.
- **Unlink** gives each frame its own copy again.

### Onion skin

Press `O` or the **Onion** button. Set how many frames before and after to show, and the opacity. **Tint** shows
earlier frames red and later frames blue. **Above** draws them over the current frame instead of behind it.

### Preview window

Press `F2` (or View > Preview window). It's a small floating player you can drag anywhere. It shows the sprite at 1x
to 8x, plays any tag, lit or unlit, on checks, black, white or a night colour. Leave it open while you draw: it
updates live.

## 7. Lighting

The Light tab runs lighting code that matches a Unity runtime: `LightMapGenerator` and the room light pass. What
you see is what that runtime will do. See [LIGHTING.md](LIGHTING.md) for the details.

1. **Preview on.** Then choose a view: lit, light only, light map normals, or light map mask.
2. **Light map preset.** Character, Object or Architecture, matching the Unity import presets. Architecture adds
   **room planes**: a floor line, or a one-point box (back wall and ceiling) for rooms.
3. **Shade by surface** uses the light map's directions. Off gives flat pools.
4. **Render style**: how light levels land on the pixels.
   - **Banded**: flat bands with dithered seams.
   - **Hard**: flat bands, no dither.
   - **Dither**: 4×4 ordered dither between levels.
   - **Checker**: 2×2 checker between levels.
   - **Noise**: noise dither.
   - **Smooth**: no banding.

   **Light steps** sets how many bands there are (5 is the default).
5. **Mood**: ambient colour, darkness, and "darker towards the top" for rooms with sky.
   A room converted from a Unity project with mood profiles also has a **Room mood** list: its times of day, its
   alternate world (**Undertow**) and any story mood. Pick one to see the room lit that way; **Undertow** also swaps in
   the alternate-world layers
   (see [Room moods](LIGHTING.md#room-moods)).
6. **Lamps**: add as many as you like. Each has a name, position, colour, intensity, radius, flatten, height and
   flicker (steady, lamp, fluoro, candle, neon, beacon). It can also be a **shadow pool** that darkens instead.
   Drag lamps on the canvas with `K`.

Lighting is a preview and render aid. It's never painted into the cels. To keep a lit image, use **Export > This
frame as PNG** with "Lit", or an animated GIF with "Lit render". To give your game the light map, use **Light map**
exports (encoding: R,G surface direction, B light mask, A coverage) or tick "Light maps too" on the
PowerQuest export.

## 8. Tiles and symmetry

- **Tiled mode** (`T` cycles: off, horizontal, vertical, both). The canvas shows the sprite repeated around itself,
  and drawing off one edge comes in on the other. Use it for seamless floors, walls and textures.
- **Tile grid** (View > Tile grid, size in View > Tile grid size). Draws a grid every N pixels for tilesets.
- **Pixel grid** (`#`) appears from 600% zoom.
- **Mirror** (`S`, or the X and Y boxes on the option bar). Every stroke is mirrored across the sprite's centre lines.

## 9. Rotating and scaling

**Edit > Rotate / scale (RotSprite)** turns and resizes pixel art without blurring it. It scales up with Scale2x
three times, rotates, then samples back down, so lines stay clean. It works on the selection, the cel, or every
frame of the layer. Set the angle (-360° to 360°) and the scale (0.1 to 8).

Also available:

- **Flip horizontal** and **Flip vertical**.
- **Sprite > Scale**: the whole sprite 2×, 3× or 4× (nearest neighbour). For free scaling use RotSprite.
- **Sprite > Canvas size**: grow or crop around an anchor.
- **Sprite > Trim canvas to content**: crop to the drawn pixels on every frame and layer.

## 10. Exporting for your game

Every export downloads to your computer.

| Export | Use it for |
| --- | --- |
| **Frames for PowerQuest** | PowerQuest games. A zip of `Tag_0.png, Tag_1.png…` (one set per tag), optional light maps and indexed PNGs. Unzip into the character's or room's Sprites folder. For a file converted from a Unity project, each sprite is saved under its original name, size and place instead, so it drops over the original and keeps its Unity settings and every animation that uses it. Frames you drew new get the next free `Tag_n.png`. A room prop the canvas cuts off is left out (convert with `--no-clip` to edit those). |
| **Sprite sheet for Unity / Unreal** | Any Unity project ([unity/README.md](../unity/README.md)) or Unreal Paper2D ([unreal/README.md](../unreal/README.md)). |
| **This frame as PNG** | Single images, any scale, RGBA or indexed palette PNG, lit or not. |
| **Animated GIF** | Sharing. Any tag, any scale, optionally lit. |

**Sprite sheet options:**

- **For**: Unity, Unreal Paper2D, or generic JSON.
- **Frames**: all frames or one tag.
- **Layout**: row, column, grid (choose columns), or one row per tag.
- **Padding between** and **Border**: pixels around frames, so sprites don't bleed.
- **Pivot**: bottom centre (characters stand on their feet), centre or top left.
- **Pixels per unit**.
- **Light map sheet too**: a matching light map sheet.

In Unity, put `DeadPixelSheetImporter.cs` (in every Unity zip, and from File > Unity importer script) in an Editor
folder. Then drop the PNG and JSON in together. You get point-filtered sliced sprites and one animation clip per tag.
Re-exporting keeps sprite IDs, so prefabs don't break.

## 11. Recipes

**A character walk cycle**

1. New sprite, indexed, with the character's palette.
2. One layer per body part inside a group, plus a Shadow layer set to multiply.
3. Draw the contact pose on frame 1. Add frames with `Alt+N` and adjust each part, with onion skin on.
4. Link cels for parts that don't change.
5. Tag frames 1 to 8 "Walk". Open the preview (`F2`) and loop the tag.
6. Export: Frames for PowerQuest.

**A palette swap (outfits, hair dyes)**

1. Make the sprite indexed.
2. Click a palette entry and change it on the Colour tab. Every frame follows.
3. Save or export that variant, then recolour for the next one (undo takes you back).

**Checking a room under the lighting**

1. Import the room PNG as a new sprite (320×180).
2. Light tab: Architecture preset, room planes Box, then fit the back wall to the art.
3. Add lamps where the room's lights are, with the flicker types the scene uses.
4. Compare the render styles and steps, then export a lit PNG for review, or the light map for your game.

**A seamless texture**

1. New 32×32 sprite.
2. Turn on tiled mode with `T` until it says "both", and turn on the tile grid.
3. Draw across the edges freely.
4. Export a PNG.

## 12. Shortcuts

| Key | Does |
| --- | --- |
| Two-finger tap / three-finger tap | undo / redo (touch) |
| `B` `E` `H` `G` `L` `R` `C` `D` | pencil, eraser, shading ink, fill, line, rectangle, ellipse, gradient |
| `M` `Q` `W` `V` `I` `K` | select, lasso, wand, move, eyedropper, lights |
| `[` `]` | brush size |
| `X` | swap colours |
| `P` `S` `T` `O` | pixel perfect, mirror, tiled mode, onion skin |
| `#` | pixel grid |
| `,` `.` | previous / next frame |
| `Enter` | play / pause |
| `Alt+N` | new frame |
| `F2` | preview window |
| `+` `-` `0` | zoom in, zoom out, fit |
| `Ctrl+Z` `Ctrl+Y` | undo, redo |
| `Ctrl+C` `Ctrl+X` `Ctrl+V` | copy, cut, paste |
| `Ctrl+A` `Ctrl+D` | select all, deselect |
| `Ctrl+B` | brush from selection |
| `Ctrl+N` `Ctrl+O` `Ctrl+S` `Ctrl+E` | new, open, save, export sprite sheet |
| `Ctrl+Shift+S` | save as |
| `Ctrl+H` | history panel |
| `Delete` | clear the selection |

These are the defaults. Change any of them in **View > Keyboard shortcuts** (also in Preferences): click a shortcut,
press the new keys, and Save. A key another action had moves over. Help > Shortcuts shows the keys as they are now.

## 13. Troubleshooting

| Problem | Fix |
| --- | --- |
| Nothing downloads | Allow downloads for the site. |
| My work is gone after clearing the browser | The restored session lives in browser storage. Keep work in `.deadpixel` files. |
| Colours changed when I went indexed | Every pixel moves to the nearest palette colour. Load or extract the right palette first, or undo. |
| A blended layer shows colours outside the palette | Turn on Sprite > Keep blends on the palette. |
| Unity sprites are blurry or not sliced | The importer script isn't in an Editor folder, or the JSON isn't beside the PNG with the same name. |
| Drawing does nothing | The layer is locked or hidden, a group is selected, or a selection is limiting the stroke (`Ctrl+D`). |
