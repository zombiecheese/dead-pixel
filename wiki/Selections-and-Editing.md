# Selections and editing

## Selecting

| Tool | Key | Selects |
| --- | --- | --- |
| **Rectangle select** | `M` | A box. |
| **Lasso** | `Q` | A freehand shape. |
| **Magic wand** | `W` | Touching pixels of the same colour. |

Hold **Shift** to add to the selection and **Alt** to subtract from it. While something is selected, drawing stays
inside it.

| Command | Key | Does |
| --- | --- | --- |
| Edit > Select all | `Ctrl+A` | Selects the whole canvas. |
| Edit > Deselect | `Ctrl+D` | Clears the selection. |
| Edit > Invert selection | | Selects everything that wasn't selected. |
| Edit > Clear | `Delete` | Clears the selected pixels, or the whole cel when nothing is selected. On a background layer it paints the secondary colour instead. |

## Moving

The **Move** tool (`V`) drags the selection, or the whole cel when nothing is selected. Arrow keys nudge one pixel
at a time.

## Clipboard

`Ctrl+C` copies, `Ctrl+X` cuts and `Ctrl+V` pastes. A paste lands as a floating selection: drag it into place with
the Move tool.

## Brushes from a selection

`Ctrl+B` (Edit > New brush from selection) turns the selected pixels into a custom brush. See
[Drawing tools](Drawing-Tools#custom-brushes).

## Flips

**Edit > Flip horizontal** and **Edit > Flip vertical** flip the selection, or the cel when nothing is selected.

## Rotate and scale (RotSprite)

**Edit > Rotate / scale (RotSprite)** turns and resizes pixel art without blurring it. It enlarges the art 8× with
Scale2x, rotates it, then samples it back down, so edges stay crisp and on your colours.

| Setting | Does |
| --- | --- |
| **Angle** | Degrees, -360 to 360. |
| **Scale** | 0.1 to 8. |
| **Every frame of the layer** | Applies to every frame instead of just this cel. |

It works on the selection, or the whole cel when nothing is selected.

## Outline

**Edit > Outline** draws a 1 px line in the primary colour on the current layer.

| Setting | Options |
| --- | --- |
| **Where** | Around the art (adds pixels), or on the edge of the art (recolours its outer pixels). |
| **Corners** | No gives the clean pixel-art outline. Yes fills the corners too, for a thicker line. |
| **Every frame** | Outlines the layer on every frame. |

With a selection, only the selected art gets an outline.

## Reference image

**View > Reference image** shows a see-through picture behind or over the art, for tracing a screenshot or concept
art. Choose the image, its opacity, whether it is drawn behind or over the art, whether it fits the canvas or shows
at actual pixels, and an X/Y offset. It is never saved in the project or in any export, and it goes when you close
the tab. **Remove** takes it away.

## Highlight off-palette colours

**View > Highlight off-palette colours** shows in magenta every pixel whose colour isn't on the palette, and tells
you how many there are in the frame. Use it to keep RGB art on your palette.
