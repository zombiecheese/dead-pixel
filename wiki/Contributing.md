# Contributing

Dead Pixel is plain JavaScript with no dependencies, no bundler and no framework, so getting started takes a clone
and Node.js.

```sh
git clone https://github.com/zombiecheese/dead-pixel
cd dead-pixel
npm test                       # node tests for everything that isn't UI
npm run serve                  # http://localhost:8080 (or just open public/index.html)
```

The developer guide, [docs/DEVELOPING.md](https://github.com/zombiecheese/dead-pixel/blob/main/docs/DEVELOPING.md),
covers the code layout, the document model, how undo works, how to add a tool or an export, and the project's ground
rules. The short version:

- **Nothing goes to a server.** Saves and exports stay in the user's browser and on their computer.
- **The file format only grows.** Add fields; never change or remove existing ones. See [File format](File-Format).
- **Lighting matches the Unity runtime.** Change its maths only together with that runtime, and keep the tests
  passing.
- **Defaults never dither art.** Only the lighting dithers.
- **Keep the docs current.** Update the README, `docs/` and this wiki's source (`wiki/`) when features change, and
  move items in [docs/ROADMAP.md](https://github.com/zombiecheese/dead-pixel/blob/main/docs/ROADMAP.md) in the same
  pull request.

## Editing this wiki

The wiki is generated from the [`wiki/`](https://github.com/zombiecheese/dead-pixel/tree/main/wiki) folder. Edit the
Markdown there and open a pull request; when it merges into `main`, a workflow copies the folder into the GitHub
wiki. Link between pages by page name, like `[Lighting](Lighting)`.

## License

By contributing you agree that your work is released under the
[GNU GPL v3 or later](https://github.com/zombiecheese/dead-pixel/blob/main/LICENSE), like the rest of Dead Pixel.
