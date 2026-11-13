# The .deadpixel project format (version 1)

A `.deadpixel` file is UTF-8 JSON, gzipped. (Dead Pixel also opens it un-gzipped.) It holds everything needed to
carry on editing: layers, frames, cels, tags, the palette and the lighting setup.

```jsonc
{
  "format": "deadpixel",          // always this
  "version": 1,                   // format version; newer versions add fields, never change these
  "app": "Dead Pixel",
  "name": "hero-walk",
  "width": 32, "height": 64,
  "colorMode": "rgb",             // "rgb" or "indexed"
  "palette": ["#140c1c", "#ffbf66", "#00000080"],   // #rrggbb or #rrggbbaa, up to 256
  "layers": [                     // bottom first; a layer's parent is a group's id (or null)
    { "id": "i1", "name": "Body", "kind": "layer", "parent": null, "visible": true, "locked": false,
      "opacity": 255, "blend": "normal", "collapsed": false }
  ],                              // kind: "layer" | "background" | "group"
  "frames": [{ "duration": 120 }],                   // milliseconds
  "tags": [{ "name": "Walk", "from": 0, "to": 7, "colour": "#ffbf66", "dir": "forward" }],  // dir: forward | reverse | pingpong
  "cels": { "i1/0": "c1", "i1/1": "c1" },            // "<layerId>/<frame>" -> cel data id; a shared id is a linked cel
  "celEncoding": "rgba8",                            // "rgba8" (rgb) or "int16le-index" (indexed)
  "celData": { "c1": "<base64>" },                   // width*height pixels, rows top to bottom
  "indexedBlendSnap": true,
  "grid": { "w": 16, "h": 16, "show": false },
  "lighting": { /* preset, planes, style, steps, ambient, darkness, lights[] (see lighting.js defaults());
                   optional, for rooms converted from a Unity project: mood, moods[] (see below) */ },
  "sources": { "c1": { "name": "WalkR_0", "x": 15, "y": 0, "w": 24, "h": 58 } },  // optional, see below
  "pivot": [27, 58]                                  // optional
}
```

- `rgba8`: 4 bytes per pixel, R G B A, not premultiplied.
- `int16le-index`: 2 bytes per pixel, little-endian signed palette index; -1 is clear.
- `sources` (optional): for files converted from a Unity project, the sprite each cel came from: its file name (no `.png`)
  and where its original rect sits on the canvas. "Frames for PowerQuest" uses it to save each sprite back under
  its own name, size and place. `pivot` is the canvas point imported sprites are lined up on (the feet). Older
  versions of Dead Pixel ignore both.
- `lighting.moods` (optional): a converted room's looks, `{ name, ambient: [r,g,b], darkness, lampsOn, undertow,
  weather: { rain, drizzle, wind, fogBanks, fog, fogDensity, leaves, snow, lightningEvery, lightning, haze,
  hazeColour } }`, and `lighting.mood`, the name of the one applied. Imported lights also carry `lamp` (only lit
  when the mood has `lampsOn`) and `layer` (`both`, `surface` or `undertow`; `undertow` is the alternate world, see
  [Room moods](LIGHTING.md#room-moods)). Older versions of Dead Pixel ignore all
  of these and show the lighting as saved.
- Groups have no cels. A frame with no entry for a layer is empty on that layer.
- Blend modes: normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light,
  difference, exclusion, addition, subtract, divide, hue, saturation, color, luminosity.
