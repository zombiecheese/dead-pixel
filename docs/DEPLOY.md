# Deploying Dead Pixel

Dead Pixel is a static web app: HTML, CSS and JavaScript with no server code. Host it with Docker,
or open it straight from disk.

## Docker (recommended)

```sh
docker compose up -d          # builds the image, serves on http://localhost:8080
docker compose logs -f        # nginx access log
docker compose down
```

Or by hand:

```sh
docker build -t deadpixel .
docker run -d --name deadpixel -p 8080:8080 \
  --read-only --tmpfs /var/cache/nginx --tmpfs /var/run --tmpfs /tmp \
  --restart unless-stopped deadpixel
```

The image has two stages:

1. **Build** (`node:alpine`) regenerates `public/js/unity-script.js` and runs `npm test`. A failing test stops the build.
2. **Serve** (`nginx:alpine`) copies `public/` and `docker/nginx.conf`.

Health check: `GET /healthz` returns `ok`.

To change the port, copy `.env.example` to `.env` and set `DEADPIXEL_PORT` (for example `9000`). There is nothing
else to configure: the app has no secrets, accounts or server settings.

## Why the server never holds your work

This is a hard rule for the project: **saves and exports never touch the server.**

- Projects and exports are built in the browser and downloaded to your computer.
- Opening a file reads it in the browser; nothing is uploaded.
- The last session is kept in the browser's own storage, on your machine.
- nginx allows only `GET` and `HEAD` (anything else gets `405`), with a 1 KB request body limit.
- The container runs read-only, so even a bug could not write files into it.
- The content security policy only allows the app's own scripts, plus Google Fonts for the typefaces.

## Other ways to run it

| Way | How |
| --- | --- |
| From disk | Open `public/index.html` in a browser. Everything works from `file://`. |
| One file | `node tools/build.mjs --single` writes `dist/deadpixel.html` with every script, style and icon inlined. Email it, drop it on a shared drive, or open it offline. |
| Any static host | Serve the `public/` folder (GitHub Pages, S3, an existing web server). |
| Quick local server | `npm run serve` (Python's http.server on port 8080). |

Fonts load from Google Fonts. Offline, the app falls back to system fonts and works the same.

## Updating

```sh
git pull
docker compose up -d --build
```

Users' projects are files on their own machines, so updating the app never touches their work. The `.deadpixel`
format is versioned ([FORMAT.md](FORMAT.md)): newer versions only add fields, so older projects keep opening.
