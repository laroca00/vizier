// Refraction profile from liquid-glass-js (MIT, Armagan Amcalar): exponential
// edge and rim falloffs along the shape normal, a boost near the corners and a
// ripple across the rim. The original evaluates it per frame in WebGL over an
// html2canvas snapshot of the page; here it is baked once per size into a
// displacement map that an SVG filter applies to the live backdrop.

export type DisplacementMap = {
  href: string;
  scale: number;
};

// The original works in texture units of the page; these are those values at
// an 800px tall window.
const EDGE = 8;
const EDGE_FALLOFF = 0.15;
const RIM = 40;
const RIM_FALLOFF = 0.8;
const CORNER = 16;
const CORNER_FALLOFF = 0.3;
const RIPPLE = 80;

// Past this depth every term has decayed below a hundredth of a pixel.
const DEPTH_CUTOFF = 7 / Math.min(EDGE_FALLOFF, RIM_FALLOFF, CORNER_FALLOFF);

export function createDisplacementMap(
  width: number,
  height: number,
  radius: number,
  strength = 1,
): DisplacementMap {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const halfW = w / 2;
  const halfH = h / 2;
  const minSide = Math.min(w, h);
  const r = Math.min(radius, minSide / 2);
  const offsets = new Float32Array(w * h * 2);
  let max = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - halfW;
      const py = y + 0.5 - halfH;
      const qx = Math.abs(px) - halfW + r;
      const qy = Math.abs(py) - halfH + r;
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const corner = Math.hypot(ox, oy);
      const depth = r - corner - Math.min(Math.max(qx, qy), 0);
      if (depth <= 0 || depth > DEPTH_CUTOFF) continue;

      let nx: number;
      let ny: number;
      if (corner > 0) {
        nx = (ox / corner) * Math.sign(px);
        ny = (oy / corner) * Math.sign(py);
      } else if (qx > qy) {
        nx = Math.sign(px);
        ny = 0;
      } else {
        nx = 0;
        ny = Math.sign(py);
      }

      const rim = Math.exp(-depth * RIM_FALLOFF);
      const boxCorner = Math.max(Math.min(x, w - x), Math.min(y, h - y));
      const along =
        EDGE * Math.exp(-depth * EDGE_FALLOFF) + RIM * rim + CORNER * Math.exp(-boxCorner * CORNER_FALLOFF);
      const across = Math.sin((depth / minSide) * 25) * RIPPLE * rim;

      // The original samples outwards; a backdrop filter can only read what is
      // under the element, so sample towards the centre instead.
      const dx = (-nx * along - ny * across) * strength;
      const dy = (-ny * along + nx * across) * strength;
      const i = (y * w + x) * 2;
      offsets[i] = dx;
      offsets[i + 1] = dy;
      max = Math.max(max, Math.abs(dx), Math.abs(dy));
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(w, h);
  // 8 bits cannot store 0.5 exactly. Centring on 128 turns that error into one
  // sub-pixel shift for the whole map instead of a seam where offsets reach zero.
  const step = max / 127 || 1;
  for (let i = 0, j = 0; i < offsets.length; i += 2, j += 4) {
    image.data[j] = 128 + Math.round(offsets[i] / step);
    image.data[j + 1] = 128 + Math.round(offsets[i + 1] / step);
    image.data[j + 2] = 128;
    image.data[j + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  return { href: canvas.toDataURL("image/png"), scale: step * 255 };
}
