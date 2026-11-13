# Troubleshooting

| Problem | Fix |
| --- | --- |
| Nothing downloads | Allow downloads for the site. |
| My work is gone after clearing the browser | The restored session lives in browser storage. Keep work in `.deadpixel` files. |
| Colours changed when I went indexed | Every pixel moves to the nearest palette colour. Load or extract the right palette first, or undo. |
| A blended layer shows colours outside the palette | Turn on Sprite > Keep blends on the palette. |
| Unity sprites are blurry or not sliced | The importer script isn't in an Editor folder, or the JSON isn't beside the PNG with the same name. |
| Drawing does nothing | The layer is locked or hidden, a group is selected, or a selection is limiting the stroke (`Ctrl+D`). |
| Pen pressure does nothing | Set **Pen pressure** on the option bar to Size or Dither density, and the brush size above 1. Some pens and browsers don't report pressure ([Pens, tablets and touch](Pens-Tablets-and-Touch)). |
| My palm leaves marks on a tablet | In View > Preferences set **One finger** to "Paints, until a pen is used, then pans" or "Always pans". |
| Save asks where to save every time, or there's no Open recent | Saving back in place and Open recent need Chrome or Edge. Other browsers download a new copy each time. |
| Undo stops going back far enough | Raise **Undo memory** in View > Preferences. |
| Exported frames have the wrong names for PowerQuest | Name your tags after the animations (Walk, Idle…): files are `Tag_n.png`. |

Still stuck? Open an issue on [GitHub](https://github.com/zombiecheese/dead-pixel/issues).
