# Importing Unity projects

`tools/import_unity.mjs` converts an existing Unity or PowerQuest project's art into `.deadpixel` files, so you can
edit it in Dead Pixel and export it straight back. It needs [Node.js](https://nodejs.org/) 18 or newer and a copy of
this repository; nothing else to install.

```sh
node tools/import_unity.mjs <unity project> <output folder> [--only Hero,Kitchen] [--strip MyGame] [--moods MyGame/Resources] [--no-clip]
```

## What it converts

| From | Becomes |
| --- | --- |
| **Characters** (`Assets/Game/Characters/<Name>`) | One `<Name>.deadpixel`. Every `.anim` clip becomes a tag with its timings, sprites are lined up on their pivots (the feet), and a sprite used more than once is a linked cel. Sprites no clip uses come last, under an "Unused" tag. |
| **Rooms** (`Assets/Game/Rooms/<Name>`) | One `<Name>.deadpixel` with a layer per prop, placed where the room prefab puts it. Inactive props are hidden layers. Frame 1 is the room, and each prop animation follows as a tag. |
| **Other sprite folders** (GUI, inventory, cursors…) | One `.deadpixel` per folder, with frames grouped into tags by name (`Walk_0`, `Walk_1`… become the tag Walk). |

Sprites with 256 colours or fewer and no part-transparent pixels come in as indexed colour, so a palette edit
recolours every frame. The rest stay RGB.

Each converted file remembers where every sprite came from, so **Frames for PowerQuest** writes them back under their
original names, sizes and places ([Exporting](Exporting#frames-for-powerquest)).

## Options

| Option | Does |
| --- | --- |
| `--only A,B` | Converts only the characters, rooms or folders with those names. |
| `--strip F1,F2` | Leaves extra folder names out of the names of "other" documents, for example your project's own root folder under `Assets`. `Game`, `Resources` and `Sprites` are always left out. |
| `--moods F` | A folder under `Assets` holding `Moods/<Room>.asset` mood profiles and `art_glows.json`. Rooms then open with their lamps and a [Room mood](Lighting#room-moods) for each time of day, the alternate world and any story mood. Without it, rooms open unlit. |
| `--no-clip` | By default the canvas is the room's bounds (its background), so props parked off-screen are cut off, while scenery wider than the room (a strip scrolling past a window) still widens it. `--no-clip` widens the canvas to hold every prop. |

## Checking room moods without the editor

```sh
node tools/render_moods.mjs <Room.deadpixel> <output folder> [--scale 2] [--crop 320]
```

Writes `<Room>_<Mood>.png` for every mood the room has. `--crop` keeps that many pixels from the left, for wide
rooms.
