// Writes the built-in samples to samples/: a .deadpixel project and an animated GIF preview (lit when the
// sample uses lighting) for each. node tools/make_samples.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['palettes-game', 'lighting', 'core', 'tools', 'transform', 'io', 'samples']) (0, eval)(readFileSync(join(root, 'public/js', f + '.js'), 'utf8'));
const DP = globalThis.DP, IO = DP.IO, out = join(root, 'samples');
mkdirSync(out, { recursive: true });
const scaleFor = (d) => Math.max(1, Math.min(6, Math.floor(256 / Math.max(d.w, d.h))));
for (const [key] of DP.Samples.LIST) {
  const d = DP.Samples[key](), lit = !!(d.view && d.view.lightPreview), tiled = !!(d.view && d.view.tiled && d.view.tiled !== 'none'); delete d.view;
  writeFileSync(join(out, d.name + '.deadpixel'), await IO.saveProject(d));
  const frames = []; let t = 0;
  for (let f = 0; f < d.frames.length; f++) {
    let rgba = d.composite(f);
    if (lit) rgba = DP.Lighting.render(rgba, d.w, d.h, DP.Lighting.generate(rgba, d.w, d.h, d.lighting.preset, d.lighting.preset === 'Architecture' ? d.lighting.planes : null), d.lighting, t, 'lit');
    frames.push({ rgba, delay: d.frames[f].duration }); t += d.frames[f].duration / 1000;
  }
  // ping-pong tags play back and forth in the editor; the GIF does the same so it loops cleanly
  const tag = d.tags[0];
  if (tag && tag.dir === 'pingpong') for (let f = tag.to - 1; f > tag.from; f--) frames.push(frames[f]);
  if (tiled) {
    // a tile shows off best repeated 3 x 3, so the seams can be checked
    const W = d.w * 3, H = d.h * 3;
    for (const fr of frames) {
      const big = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) big.set(fr.rgba.subarray(((y % d.h) * d.w + (x % d.w)) * 4, ((y % d.h) * d.w + (x % d.w)) * 4 + 4), (y * W + x) * 4);
      fr.rgba = big;
    }
    writeFileSync(join(out, d.name + '.gif'), IO.encodeGIF(frames, W, H, 3));
  } else writeFileSync(join(out, d.name + '.gif'), IO.encodeGIF(frames, d.w, d.h, scaleFor(d)));
  console.log('wrote', d.name, d.frames.length + ' frames', lit ? '(lit)' : '');
}
