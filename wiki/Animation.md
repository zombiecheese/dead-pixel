# Animation

## The timeline

Frames run across and layers run down. Each square where they cross is a **cel**. A dot means the cel has pixels,
and an empty square means nothing is on that layer in that frame.

| Control | Key | Does |
| --- | --- | --- |
| ⏮ ◀ ▶ ▶| ⏭ | `,` `.` `Enter` | First frame, previous, play/pause, next, last. |
| Loop drop-down | | Plays all frames or one tag. |
| Frame + | `Alt+N` | New frame, a copy of the current one. |
| Duplicate / − | | Duplicates or deletes the frame. |
| ← → | | Moves the frame earlier or later. |
| ms field | | The frame's duration in milliseconds, shown under each frame number. |

Shift-click frame numbers to select a range. Duration, delete, move and link then act on the whole range.
**Frame > Frame duration** sets the duration for the frame or the range (100 ms is 10 frames a second).

## Tags

Tags name a run of frames, like Walk, Idle, Talk or Pick up. Select frames and press **+ Tag** (or Frame > New tag).
Click a tag to edit or delete it. Each tag has a name, a colour and a direction:

- **Forward**, **Reverse** or **Ping-pong**.

Exports use tags too: one Unity clip per tag, and `Tag_n.png` file names for PowerQuest.

**Frame > Mirror tag into a new tag** copies a tag's frames to the end, flipped left to right, as a new tag (WalkR
becomes WalkL). On a character converted from a Unity project it flips around the feet, so the character stays on
the same spot; otherwise it flips around the canvas centre. Linked cels stay linked.

## Linked cels

A linked cel is one drawing shared by several frames. Edit it on any of those frames and all of them change. Use
linked cels for parts that don't move: a background, a held prop, a head during a body bob.

- Select frames on a layer and press **Link** (Frame > Link cels). Linked cels show joined dots.
- **Unlink** gives each frame its own copy again.

## Onion skin

Press `O` or the **Onion** button. Set how many frames before and after to show, and their opacity. **Tint** shows
earlier frames red and later frames blue. **Above** draws them over the current frame instead of behind it.

## Preview window

Press `F2` (View > Preview window), or the timeline's Preview button. It's a small floating player you can drag
anywhere. It shows the sprite at 1× to 8×, plays any tag, lit or unlit, on checks, black, white or a night colour.
Leave it open while you draw: it updates live.
