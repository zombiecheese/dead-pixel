# Layers

Layers are listed down the left of the timeline, top layer first. See [Animation](Animation) for how layers and
frames meet in cels.

## Kinds of layer

| Kind | Made with | Notes |
| --- | --- | --- |
| **Layer** | Layer > New layer, or the timeline's + Layer button | Transparent. |
| **Background** | Layer > New background layer | Opaque. The eraser and Clear paint the secondary colour on it. A sprite has at most one. |
| **Group** | Layer > New group | Holds layers, and groups can nest. Collapse or expand it with its arrow. |

## Layer settings

- **Visibility** (eye) and **lock** (padlock) are on each row.
- **Opacity** from 0 to 255, set with the timeline slider or in Layer properties.
- **Blend mode**: normal, multiply, screen, overlay, darken, lighten, colour dodge, colour burn, hard light, soft light,
  difference, exclusion, addition, subtract, divide, hue, saturation, colour and luminosity.
- **Group**: the drop-down on the timeline bar moves the layer into a group or out of one.

**Layer > Layer properties** sets the name, blend mode and opacity together. Double-click a layer name to rename it.

## Layer commands

| Command | Does |
| --- | --- |
| Layer > Duplicate | Copies the layer with all its cels. |
| Layer > Delete | Removes the layer, or a group and everything in it. A sprite always keeps at least one layer. |
| Layer > Merge down | Merges the layer into the one below, applying its blend mode and opacity. |
| ↑ ↓ (timeline) | Moves the layer up or down. |

In indexed mode, see [Keep blends on the palette](Colour-and-Palettes#rgb-and-indexed) to keep blended results on
the palette.
