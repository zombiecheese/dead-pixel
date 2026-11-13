# Saving and opening

## Projects

- **File > Save project** (`Ctrl+S`) saves `name.deadpixel`, which holds everything: layers, frames, cels, tags,
  palette and lights. Rename the sprite first in **Sprite > Properties**.
- In Chrome and Edge, once a project has been opened or saved, `Ctrl+S` writes straight back to the same file.
  **Save as** (`Ctrl+Shift+S`) picks a new one. Other browsers download a fresh copy each time.
- **File > Open** (`Ctrl+O`) opens a `.deadpixel` file (or a `.json` copy of one). You can also drop a project, or
  any image, onto the window.
- **File > Open recent** (Chrome and Edge) lists the last 8 projects you opened or saved. The list lives in this
  browser only, and the browser may ask again for permission to read a file.

A dot before the name in the title bar means there are unsaved changes. Dead Pixel asks before closing the tab,
opening another file, starting a new sprite or loading a sample over them.

## Importing images

| Command | Does |
| --- | --- |
| **Import image as new sprite** | Opens a PNG, GIF, JPEG or WebP as a new one-layer sprite. |
| **Import image as layer** | Adds the image as a new layer on the current frame. |
| **Import sprite sheet** | Cuts a sheet into frames. Set the frame width and height, the padding between frames, the border around the sheet and each frame's duration. Empty cells are skipped. |

Use [Importing Unity projects](Importing-Unity-Projects) to convert a whole Unity or PowerQuest project at once.

## Autosave

The current session is saved in the browser's local storage as you work and restored when you come back. It is
lost if you clear the browser's site data, so keep anything important in `.deadpixel` files.

The file format is described in [File format](File-Format). It is plain gzipped JSON, so other tools can read and
write it.
