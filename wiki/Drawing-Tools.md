# Drawing tools

Pick a tool from the toolbox or press its key. The option bar above the canvas shows that tool's settings.

| Tool | Key | How it works |
| --- | --- | --- |
| **Pencil** | `B` | Left button paints the primary colour, right button the secondary. Hold Shift while dragging for a straight line from where you pressed. |
| **Eraser** | `E` | Clears pixels. On a background layer it paints the secondary colour instead, because a background has no transparency. |
| **Shading ink** | `H` | Left button lightens a pixel one step along the ramp, right button darkens it. The ramp is the palette range you shift-click on the Palette tab, or the whole palette sorted dark to light. |
| **Line** | `L` | Click and drag. Shift snaps the angle to 22.5° steps. |
| **Rectangle** | `R` | Outline or filled (option bar). Shift makes a square. |
| **Ellipse** | `C` | Outline or filled (option bar). Shift makes a circle. |
| **Fill** | `G` | Contiguous fill, or global (every pixel of that colour on the layer) from the option bar or by holding Shift. |
| **Gradient** | `D` | Drag from start to end. Banded steps from primary to secondary, linear or radial, with an optional dither pattern between the bands. |
| **Eyedropper** | `I` | Samples the colour you see. Alt- or Ctrl-click takes the active layer's own pixel instead (its palette index in indexed mode). Right button sets the secondary colour. |
| **Select / Lasso / Wand** | `M` / `Q` / `W` | See [Selections and editing](Selections-and-Editing). |
| **Move** | `V` | Drags the selection, or the whole cel. Arrow keys nudge one pixel. |
| **Lights** | `K` | Drags lamps on the canvas. See [Lighting](Lighting). |
| **Hand** | Space | Hold Space and drag to pan. The middle mouse button pans too. |

## Brush size and shape

`[` and `]` make the brush smaller and larger, or type a size on the option bar. The shape is **Square** or
**Round**, or a custom brush from the Brushes tab.

## Pixel perfect

**Pixel perfect** (`P`, on by default) removes the doubled corner pixel that 1 px freehand strokes leave when they
turn, as you draw, so curves come out clean.

## Inks

The **Ink** drop-down on the option bar changes how the pencil, shapes and fills put down colour:

- **Simple**: paints the colour.
- **Shading**: steps each pixel along the ramp, like the shading ink tool.
- **Dither**: paints a pattern of the primary colour. Choose checker, 25% or 75% dots, sparse, crisscross,
  diagonal, horizontal or vertical lines, or a 4×4 Bayer pattern at any level.

The defaults keep dither out of the art itself. Dither inks are meant for effects layers and tests.

## Custom brushes

Select part of the picture and press `Ctrl+B` (Edit > New brush from selection). The brush appears on the
**Brushes** tab. Click it to paint with it; it paints in its own colours, or as a shape filled with the primary
colour (option bar). Right-click a brush to delete it, and choose **Use a plain brush** to go back to round or
square.

## Colours while drawing

- `X` swaps the primary and secondary colours.
- The eyedropper (`I`) picks a colour from the canvas.
- In indexed mode the primary colour is a palette entry; see [Colour and palettes](Colour-and-Palettes).

## Undo and history

- **Undo** (`Ctrl+Z`) and **redo** (`Ctrl+Y`) cover everything, including palette, layer, frame and lighting
  changes.
- History is limited by memory rather than steps: it keeps as many steps as fit in 256 MB, dropping the oldest
  first. Small sprites get deep undo and big rooms stay safe. Change the limit in **View > Preferences > Undo
  memory**.
- The **History** tab (`Ctrl+H`) lists every step by name. Click a step to go back to just after it, or click a
  greyed step to redo up to it.

## When drawing does nothing

The layer may be locked or hidden, a group may be selected instead of a layer, or a selection may be limiting the
stroke (press `Ctrl+D` to deselect).
