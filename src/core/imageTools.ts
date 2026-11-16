import * as zlib from 'zlib';
import { encodePng } from './icons';

/**
 * Minimal PNG decoder + resizer so a company logo can become every icon size SharePoint needs
 * (96x96 App Catalog, 192/32 Teams, toolbox), with no native image libraries.
 * Supports 8-bit greyscale, RGB, palette (+tRNS), grey+alpha and RGBA; non-interlaced.
 */
export interface Rgba { width: number; height: number; data: Buffer; }

export function decodePng(buf: Buffer): Rgba {
  if (buf.readUInt32BE(0) !== 0x89504e47) { throw new Error('Not a PNG file'); }
  let pos = 8, width = 0, height = 0, depth = 0, colour = 0, interlace = 0;
  let palette: Buffer | undefined, trns: Buffer | undefined;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; colour = data[9]; interlace = data[12]; }
    else if (type === 'PLTE') { palette = data; }
    else if (type === 'tRNS') { trns = data; }
    else if (type === 'IDAT') { idat.push(data); }
    else if (type === 'IEND') { break; }
    pos += 12 + len;
  }
  if (depth !== 8) { throw new Error(`PNG bit depth ${depth} isn't supported - re-save the logo as a standard 8-bit PNG`); }
  if (interlace) { throw new Error('Interlaced PNGs aren\'t supported - re-save the logo without interlacing'); }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colour];
  if (!channels) { throw new Error(`Unsupported PNG colour type ${colour}`); }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  // Undo the per-row filters
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      let v = row[x];
      switch (filter) {
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; break; }
      }
      pixels[y * stride + x] = v & 255;
    }
  }
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    switch (colour) {
      case 0: out[o] = out[o + 1] = out[o + 2] = pixels[i]; out[o + 3] = 255; break;
      case 2: pixels.copy(out, o, i * 3, i * 3 + 3); out[o + 3] = 255; break;
      case 3: { const p = pixels[i]; out[o] = palette![p * 3]; out[o + 1] = palette![p * 3 + 1]; out[o + 2] = palette![p * 3 + 2]; out[o + 3] = trns && p < trns.length ? trns[p] : 255; break; }
      case 4: out[o] = out[o + 1] = out[o + 2] = pixels[i * 2]; out[o + 3] = pixels[i * 2 + 1]; break;
      case 6: pixels.copy(out, o, i * 4, i * 4 + 4); break;
    }
  }
  return { width, height, data: out };
}

/**
 * Fit an image into a size x size square (keeping aspect ratio, centred, transparent padding),
 * using area averaging with premultiplied alpha - good quality for downscaling logos.
 */
export function fitSquare(img: Rgba, size: number, paddingRatio = 0): Rgba {
  const inner = Math.max(1, Math.round(size * (1 - paddingRatio * 2)));
  const scale = Math.min(inner / img.width, inner / img.height);
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const ox = Math.floor((size - w) / 2), oy = Math.floor((size - h) / 2);
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx0 = x / scale, sx1 = (x + 1) / scale, sy0 = y / scale, sy1 = (y + 1) / scale;
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let sy = Math.floor(sy0); sy < Math.min(img.height, Math.ceil(sy1)); sy++) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        for (let sx = Math.floor(sx0); sx < Math.min(img.width, Math.ceil(sx1)); sx++) {
          const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0);
          const wgt = wx * wy, i = (sy * img.width + sx) * 4, al = img.data[i + 3] / 255;
          r += img.data[i] * al * wgt; g += img.data[i + 1] * al * wgt; b += img.data[i + 2] * al * wgt; a += al * wgt; wsum += wgt;
        }
      }
      const o = ((y + oy) * size + (x + ox)) * 4;
      if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
      out[o + 3] = Math.round((a / (wsum || 1)) * 255);
    }
  }
  return { width: size, height: size, data: out };
}

/** White silhouette of the logo (Teams outline icon: white on transparent). */
export function silhouette(img: Rgba): Rgba {
  const out = Buffer.from(img.data);
  for (let i = 0; i < out.length; i += 4) { out[i] = out[i + 1] = out[i + 2] = 255; }
  return { ...img, data: out };
}

/** Put the image on a solid background (Teams colour icon should be fully opaque). */
export function onBackground(img: Rgba, rgb: [number, number, number]): Rgba {
  const out = Buffer.alloc(img.data.length);
  for (let i = 0; i < out.length; i += 4) {
    const a = img.data[i + 3] / 255;
    for (let k = 0; k < 3; k++) { out[i + k] = Math.round(img.data[i + k] * a + rgb[k] * (1 - a)); }
    out[i + 3] = 255;
  }
  return { ...img, data: out };
}

export function toPng(img: Rgba): Buffer { return encodePng(img.data, img.width, img.height); }

/** All the icon files made from one company logo. */
export function companyIconSet(logoPng: Buffer): { app96: Buffer; toolbox64: Buffer; teamsColour192: Buffer; teamsOutline32: Buffer; about48: Buffer } {
  const logo = decodePng(logoPng);
  return {
    app96: toPng(fitSquare(logo, 96)),
    about48: toPng(fitSquare(logo, 48)),
    toolbox64: toPng(fitSquare(logo, 64, 0.04)),
    teamsColour192: toPng(onBackground(fitSquare(logo, 192, 0.12), [255, 255, 255])),
    teamsOutline32: toPng(silhouette(fitSquare(logo, 32, 0.06))),
  };
}
