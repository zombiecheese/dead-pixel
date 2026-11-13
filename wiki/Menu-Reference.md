# Menu reference

Every command in the menu bar, with its default shortcut. Shortcuts can be changed in **View > Keyboard shortcuts**.

## File

| Command | Key | Does |
| --- | --- | --- |
| New sprite | `Ctrl+N` | Name, size (or a preset), RGB or indexed colour, starting palette, optional background layer. |
| Open | `Ctrl+O` | Opens a `.deadpixel` project or an image. |
| Open recent | | The last 8 projects (Chrome and Edge). |
| Save project | `Ctrl+S` | Saves `name.deadpixel`, back to the same file where the browser allows it. |
| Save as | `Ctrl+Shift+S` | Saves to a new file. |
| Samples | | Walk cycle, Lit room, Portal pulse, Brick tile and the Lantern ghost. See [Getting started](Getting-Started#try-the-samples). |
| Import image as new sprite | | See [Saving and opening](Saving-and-Opening#importing-images). |
| Import image as layer | | Adds an image as a layer on the current frame. |
| Import sprite sheet | | Cuts a sheet into frames. |
| Sprite sheet for Unity / Unreal | `Ctrl+E` | See [Exporting](Exporting#sprite-sheet). |
| Frames for PowerQuest | | See [Exporting](Exporting#frames-for-powerquest). |
| This frame as PNG | | See [Exporting](Exporting#this-frame-as-png). |
| Animated GIF | | See [Exporting](Exporting#animated-gif). |
| Unity importer script (C#) | | Saves `DeadPixelSheetImporter.cs`. See [Unity and Unreal](Unity-and-Unreal). |

## Edit

| Command | Key | Does |
| --- | --- | --- |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` | Every change, including palette, layers, frames and lights. |
| Cut / Copy / Paste | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | A paste floats; place it with Move. |
| Clear | `Delete` | Clears the selection, or the cel. |
| Select all / Deselect | `Ctrl+A` / `Ctrl+D` | |
| Invert selection | | |
| New brush from selection | `Ctrl+B` | See [Drawing tools](Drawing-Tools#custom-brushes). |
| Flip horizontal / vertical | | The selection, or the cel. |
| Rotate / scale (RotSprite) | | See [Selections and editing](Selections-and-Editing#rotate-and-scale-rotsprite). |
| Outline | | See [Selections and editing](Selections-and-Editing#outline). |

## Sprite

| Command | Does |
| --- | --- |
| Properties | Name, and a summary of the sprite. |
| Canvas size | Grow or crop around an anchor. |
| Trim canvas to content | Crop to the drawn pixels. |
| Scale | 2×, 3× or 4×, nearest neighbour. |
| RGB colour / Indexed colour | Colour mode. |
| Keep blends on the palette | Indexed blending snaps to the palette. |

More in [Sprite and canvas](Sprite-and-Canvas).

## Layer

| Command | Does |
| --- | --- |
| New layer / New group / New background layer | See [Layers](Layers#kinds-of-layer). |
| Duplicate / Delete | |
| Merge down | Merges into the layer below. |
| Layer properties | Name, blend mode, opacity. |

## Frame

| Command | Key | Does |
| --- | --- | --- |
| New frame | `Alt+N` | A copy of the current frame. |
| Duplicate frame / Delete frame | | |
| Frame duration | | Milliseconds, for the frame or the selected range. |
| Link cels / Unlink cels | | See [Animation](Animation#linked-cels). |
| New tag | | Over the selected frames. |
| Mirror tag into a new tag | | WalkR to WalkL. |
| Play / pause | `Enter` | |

## View

| Command | Key | Does |
| --- | --- | --- |
| Zoom in / Zoom out / Fit | `+` / `-` / `0` | |
| Pixel grid | `#` | From 600% zoom. |
| Tile grid / Tile grid size | | See [Tiles and symmetry](Tiles-and-Symmetry#grids). |
| Onion skin | `O` | See [Animation](Animation#onion-skin). |
| Tiled mode: next | `T` | Off, horizontal, vertical, both. |
| Preview window | `F2` | See [Animation](Animation#preview-window). |
| Lighting preview | | See [Lighting](Lighting). |
| Reference image | | See [Selections and editing](Selections-and-Editing#reference-image). |
| Highlight off-palette colours | | Shows off-palette pixels in magenta. |
| Preferences | | Pen, touch and undo memory. See [Pens, tablets and touch](Pens-Tablets-and-Touch#preferences). |
| Keyboard shortcuts | | See [Shortcuts](Shortcuts). |

## Help

| Command | Does |
| --- | --- |
| Shortcuts | Lists the keys as they are set now. |
| About Dead Pixel | The version and what the app does. |
