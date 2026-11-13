# Unity and Unreal

## Unity

1. Copy `Editor/DeadPixelSheetImporter.cs` into any `Editor` folder in your project. It comes in every Unity export
   zip, and from **File > Unity importer script**. It needs the 2D Sprite package (in Unity's 2D feature set).
2. Export from Dead Pixel with **File > Sprite sheet for Unity / Unreal**, *For: Unity*.
3. Drop `name.png` and `name.json` into the same folder under `Assets`.

On import the PNG is set to Sprite (Multiple), point filtering, no compression, no mipmaps and the JSON's pixels per
unit. It's sliced into one sprite per frame with the JSON's pivot, and `name_Tag.anim` is made for every tag
(looping, timed from the frame durations, with reverse and ping-pong played out). Export again and reimport: sprite
IDs are kept, so prefabs and clips keep pointing at the right sprites.

For PowerQuest games, use **Frames for PowerQuest** instead ([Exporting](Exporting#frames-for-powerquest)). It writes
one PNG per frame named `Tag_n.png`, which is how PowerQuest builds its animations.

## Unreal (Paper2D)

1. Export with **File > Sprite sheet for Unity / Unreal**, *For: Unreal Paper2D*. The zip holds `name.png` and
   `name.paper2dsprites`.
2. Enable the Paper2D plugin, then drag `name.paper2dsprites` (with the PNG beside it) into the Content Browser.
   Paper2D makes the texture, a sprite sheet asset and one sprite per frame.
3. Select the sprites and use **Create Flipbook** for each tag (frame names start with the tag: `name_Walk_0`…).
4. For crisp pixels set the texture's Filter to Nearest and Compression to UserInterface2D, or use Paper2D's
   "Apply Paper2D Texture Settings" action.

The file is the TexturePacker-style JSON hash that Paper2D reads. Pivots are written per frame.

## Other engines

Choose *For: Generic* to get the PNG and a JSON file with every frame's rectangle and duration, the tags and the
layers, ready for Godot, Phaser or your own tools.
