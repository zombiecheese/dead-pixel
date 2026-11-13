# Dead Pixel sheets in Unreal (Paper2D)

1. Export with **File > Sprite sheet for Unity / Unreal**, "For: Unreal Paper2D". The zip holds `name.png` and
   `name.paper2dsprites`.
2. Enable the Paper2D plugin, then drag `name.paper2dsprites` (with the PNG beside it) into the Content Browser.
   Paper2D makes the texture, a sprite sheet asset and one sprite per frame.
3. Select the sprites and use **Create Flipbook** for each tag (the frame names start with the tag: `name_Walk_0`…).
4. For crisp pixels set the texture's Filter to Nearest and Compression to UserInterface2D (or apply the
   Paper2D "Apply Paper2D Texture Settings" action).

The file is the TexturePacker-style JSON hash Paper2D reads. Paper2D checks `meta.app` for TexturePacker's export URL,
so Dead Pixel writes that as a compatibility marker; `meta.generator` says "Dead Pixel". Pivots are written per frame
(Paper2D measures y from the top).
