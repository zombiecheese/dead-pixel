# Recipes

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
