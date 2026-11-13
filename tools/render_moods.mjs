// Renders a converted room in each of its moods (the times of day and the alternate world), lit by the light pass, as
// PNGs: a quick way to check a room's art and lighting together without opening the editor or Unity.
//
//   node tools/render_moods.mjs <Room.deadpixel> <output folder> [--scale 2] [--crop 320]
//
// Writes <Room>_<Mood>.png for every mood the room has. --crop keeps that many pixels from the left (wide rooms).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['palettes-game', 'lighting', 'core', 'tools', 'transform', 'io']) (0, eval)(readFileSync(join(root, 'public/js', f + '.js'), 'utf8'));
const DP = globalThis.DP, IO = DP.IO;

const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(name) ? +args[args.indexOf(name) + 1] : def);
const scale = opt('--scale', 1), cropW = opt('--crop', 0);
const [file, out] = args.filter((a, i) => !a.startsWith('--') && !['--scale', '--crop'].includes(args[i - 1]));
if (!file || !out) { console.error('usage: node tools/render_moods.mjs <Room.deadpixel> <output folder> [--scale 2] [--crop 320]'); process.exit(1); }

const doc = await IO.loadProject(new Uint8Array(readFileSync(file)));
const L = doc.lighting, name = basename(file).replace(/\.deadpixel$/, '');
mkdirSync(out, { recursive: true });
for (const mood of L.moods && L.moods.length ? L.moods : [{ name: 'Custom' }]) {
  if (L.moods && L.moods.length) DP.Lighting.applyMood(doc, mood.name);
  const rgba = doc.composite(0);
  const map = DP.Lighting.generate(rgba, doc.w, doc.h, L.preset, L.preset === 'Architecture' ? L.planes : null);
  let lit = DP.Lighting.render(rgba, doc.w, doc.h, map, L, 0, 'lit'), w = doc.w, h = doc.h;
  if (cropW && cropW < w) { lit = IO.crop(lit, w, h, 0, 0, cropW, h); w = cropW; }
  if (scale > 1) {
    const big = new Uint8ClampedArray(w * scale * h * scale * 4);
    for (let y = 0; y < h * scale; y++) for (let x = 0; x < w * scale; x++) {
      const s = (((y / scale) | 0) * w + ((x / scale) | 0)) * 4, o = (y * w * scale + x) * 4;
      big[o] = lit[s]; big[o + 1] = lit[s + 1]; big[o + 2] = lit[s + 2]; big[o + 3] = 255;
    }
    lit = big; w *= scale; h *= scale;
  } else for (let i = 3; i < lit.length; i += 4) lit[i] = 255;
  const png = await IO.encodePNG(lit, w, h);
  const path = join(out, name + '_' + mood.name.replace(/[^\w]+/g, '') + '.png');
  writeFileSync(path, png);
  console.log(path);
}
