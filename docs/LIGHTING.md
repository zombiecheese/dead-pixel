# Lighting in Dead Pixel

Dead Pixel previews and renders sprites with a 2D lighting model written to match a Unity C# runtime
(`public/js/lighting.js`). A sprite lit here looks the way it will under that runtime.

## The two halves

### 1. Light maps (`LightMapGenerator`)

For each frame the lighting builds a light map from the art. It records which way each pixel faces and how much light
it takes. Dead Pixel runs the same generator:

| Channel | Holds |
| --- | --- |
| R, G | surface direction (128 = facing the camera) |
| B | light mask (how much a lamp can light this pixel) |
| A | coverage (clear pixels are `128,128,0,0`) |

**Presets** match the Unity import presets:

- **Character**: rounded bodies with a soft rim.
- **Object**: props, harder facets.
- **Architecture**: rooms and walls, flatter. Architecture also takes **room planes**:
  - **Ground**: everything below a floor line faces up.
  - **Box**: a one-point room. The back wall faces the camera, and the floor, ceiling and side walls face in toward it.
    Set the back wall's corners to match the art's vanishing point.

The generator reads rows bottom-up, exactly like the Unity version, so maps exported here drop straight into a
Unity project's light map folder.

### 2. The light pass (`RoomFxSim`)

The room light pass, in this order:

1. **Ambient grade**: the art is pulled toward the ambient colour (chroma 0.75) and darkened by *darkness*. The
   result is banded over the light steps.
2. **Lamp pools**: each lamp lifts the darkness inside its radius on the multiply layer (strength
   min(1, intensity × 2.2)), shaped by the light map when *shade by surface* is on.
3. **Glow**: an additive share of each lamp (intensity × 0.35) for the warm bloom.
4. **Limits** (the "keep the colours" rule): never darker than 0.16, glow never above 0.4.

**Lamp settings**: position, colour, intensity, radius, flatten (squash the pool into an ellipse for floors), height
(how high above the surface, for surface shading; -1 uses the default), and **shadow pool** (darkens instead of lighting).

**Flicker types**:

| Flicker | Behaviour |
| --- | --- |
| Steady | none |
| Lamp | mostly on, dips to about half now and then (a bad bulb) |
| Fluoro | steady, then every few seconds a fast on/off stutter |
| Candle | a soft, constant flutter between 80% and 100% |
| Neon | on, with a regular drop to near dark |
| Beacon | a rotating sweep: a sharp bright pulse, then dim |

## Room moods

A room converted with `tools/import_unity.mjs --moods <folder>` opens with the lighting its mood profile
(`<folder>/Moods/<Room>.asset`) gives it: its lamps where the profile puts them, the glows listed in
`<folder>/art_glows.json`, and a **Room mood** list on the Light tab with the room's four times of day (Morning, Day,
Evening, Night), an alternate world and any story mood (a storm night).

The alternate world is called **Undertow** in the format: layers named `Surface…` are the normal world and layers
named `Undertow…` the alternate one (with or without PowerQuest's `Prop` prefix).

Choosing a mood:

- sets the **ambient** colour and the **darkness** for that time;
- lights the lamps that only burn when the mood has its lamps on (evening and night), and puts them out by day;
- switches lights that belong to one world only (a white beam on the Surface, a green one in the Undertow);
- for **Undertow**, shows the room's Undertow layers and hides the Surface ones (and back again for the others).

Under the list is the mood's **weather** (rain, wind, fog banks, lightning, haze). Dead Pixel doesn't draw weather:
the engine's effects layers do, over the art. It is there so you know what the art will sit under.

Rooms that are always at one time (a night-only exterior, a cave) only list that time. Lamps you add yourself are
left alone when the mood changes. A mood switch is one undo step.

To check a room in every mood without opening the editor:

```sh
node tools/render_moods.mjs Art/DeadPixel/Rooms/Kitchen.deadpixel out/ --scale 2
```

## Render styles

How light levels land on pixels. Choose on the Light tab under **Render style**, with **Light steps** for the number
of bands (5 is the default).

| Style | Look |
| --- | --- |
| **Banded** | The default: flat bands with a dithered seam between them. |
| **Hard** | Flat bands, hard edges. |
| **Dither** | A full 4×4 ordered (Bayer) dither between steps. |
| **Checker** | A 2×2 checker between steps. |
| **Noise** | A stable noise dither. |
| **Smooth** | No banding: continuous light. |

Only the lighting dithers. The art itself stays dither-free (the art style rule).

## Views

- **Lit**: the art under the lights.
- **Light only**: just the light on a grey surface, good for placing lamps.
- **Light map: normals**: the R,G direction channels.
- **Light map: mask**: the B channel.

## Getting it out

| Export | Where |
| --- | --- |
| Light map PNG, this frame or the whole sheet | Light tab buttons |
| Light maps beside each frame | Frames for PowerQuest, "Light maps too" (writes `LightMaps/`) |
| Light map sheet matching the sprite sheet | Sprite sheet export, "Light map sheet too" |
| Lit frame or animation | This frame as PNG ("Lit"), Animated GIF ("Lit"), sprite sheet ("Lit render") |

The lighting setup (preset, planes, style, steps, mood, lamps and a converted room's moods) is saved in the `.deadpixel` project.

## Keeping it in step with the Unity runtime

`lighting.js` follows `LightMapGenerator.cs`, `FxCanvas.cs` (Banded), `SurfaceBuffer.cs` (Facing) and the
`RoomFxSim` pass. When the runtime's lighting changes, port the change and update the tests in `tests/run.mjs` (the
"matches FxCanvas.Banded" test pins the band maths).
