# Dead Pixel sheets in Unity

1. Copy `Editor/DeadPixelSheetImporter.cs` into any `Editor` folder in your project (it also comes in every Unity
   export zip, and from File > Unity importer script). It needs the 2D Sprite package (in Unity's 2D feature set).
2. Export from Dead Pixel with **File > Sprite sheet for Unity / Unreal**, "For: Unity".
3. Drop `name.png` and `name.json` into the same folder under `Assets`.

On import the PNG is set to Sprite (Multiple), point filtering, no compression, no mipmaps and the JSON's pixels per
unit; it's sliced into one sprite per frame with the JSON's pivot; and `name_Tag.anim` is made for every tag (looping,
timed from the frame durations, reverse and ping-pong played out). Export again and reimport: sprite IDs are kept, so
prefabs and clips keep pointing at the right sprites.

For PowerQuest games use **Frames for PowerQuest** instead: it writes one PNG per frame named
`Tag_n.png`, which is how PowerQuest builds its animations.
