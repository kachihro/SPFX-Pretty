import * as zlib from 'zlib';
import { ComponentKind } from './types';
import { initials } from './titles';

/**
 * Icon generation with zero native dependencies:
 *  - PNG (for the .sppkg App Catalog icon and Teams colour/outline icons)
 *  - SVG data URIs (for web part / ACE / command toolbox icons)
 *
 * Shapes are drawn as signed-distance functions with 4x4 super-sampling, so edges are anti-aliased.
 */

export type Glyph = 'package' | 'webpart' | 'ace' | 'extension' | 'commandset' | 'field' | 'form' | 'library';

export function glyphForKind(kind: ComponentKind | 'Solution'): Glyph {
  switch (kind) {
    case 'Solution': return 'package';
    case 'WebPart': return 'webpart';
    case 'AdaptiveCardExtension': return 'ace';
    case 'ListViewCommandSet': return 'commandset';
    case 'FieldCustomizer': return 'field';
    case 'FormCustomizer': return 'form';
    case 'Library': return 'library';
    default: return 'extension';
  }
}

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) { return [15, 108, 189]; }
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Slightly darker shade for the gradient bottom. */
function shade([r, g, b]: Rgb, f: number): Rgb {
  return [Math.round(r * f), Math.round(g * f), Math.round(b * f)];
}

// ---------- signed distance helpers (unit space 0..1) ----------
function sdRoundRect(x: number, y: number, cx: number, cy: number, hw: number, hh: number, r: number): number {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdCircle(x: number, y: number, cx: number, cy: number, r: number): number {
  return Math.hypot(x - cx, y - cy) - r;
}
const union = (...d: number[]) => Math.min(...d);
const subtract = (a: number, b: number) => Math.max(a, -b);

/** Distance to the white glyph for the given type (negative = inside). */
function glyphSdf(g: Glyph, x: number, y: number): number {
  switch (g) {
    case 'package': { // box with a lid line
      const box = sdRoundRect(x, y, 0.5, 0.54, 0.24, 0.2, 0.04);
      const lid = sdRoundRect(x, y, 0.5, 0.36, 0.27, 0.06, 0.03);
      const gap = sdRoundRect(x, y, 0.5, 0.43, 0.3, 0.012, 0);
      const tape = sdRoundRect(x, y, 0.5, 0.52, 0.035, 0.22, 0);
      return subtract(subtract(union(box, lid), gap), tape);
    }
    case 'webpart': { // 2x2 tiles, like a page layout
      const s = 0.105, r = 0.03;
      return union(
        sdRoundRect(x, y, 0.38, 0.38, s, s, r), sdRoundRect(x, y, 0.62, 0.38, s, s, r),
        sdRoundRect(x, y, 0.38, 0.62, s, s, r), sdRoundRect(x, y, 0.62, 0.62, s, s, r));
    }
    case 'ace': { // a dashboard card with a header line
      const card = sdRoundRect(x, y, 0.5, 0.5, 0.25, 0.19, 0.05);
      const line1 = sdRoundRect(x, y, 0.45, 0.47, 0.13, 0.025, 0.02);
      const line2 = sdRoundRect(x, y, 0.42, 0.57, 0.1, 0.025, 0.02);
      return subtract(subtract(card, line1), line2);
    }
    case 'commandset': { // three toolbar buttons
      return union(
        sdRoundRect(x, y, 0.3, 0.5, 0.07, 0.07, 0.02),
        sdRoundRect(x, y, 0.5, 0.5, 0.07, 0.07, 0.02),
        sdRoundRect(x, y, 0.7, 0.5, 0.07, 0.07, 0.02));
    }
    case 'field': { // a column with a highlighted cell
      const col = sdRoundRect(x, y, 0.5, 0.5, 0.13, 0.26, 0.03);
      const cell = sdRoundRect(x, y, 0.5, 0.5, 0.09, 0.05, 0.01);
      const r1 = sdRoundRect(x, y, 0.5, 0.33, 0.09, 0.04, 0.01);
      const r3 = sdRoundRect(x, y, 0.5, 0.67, 0.09, 0.04, 0.01);
      return subtract(subtract(subtract(col, r1), r3), cell);
    }
    case 'form': { // form with fields
      const page = sdRoundRect(x, y, 0.5, 0.5, 0.2, 0.26, 0.04);
      const f1 = sdRoundRect(x, y, 0.5, 0.38, 0.13, 0.035, 0.015);
      const f2 = sdRoundRect(x, y, 0.5, 0.5, 0.13, 0.035, 0.015);
      const f3 = sdRoundRect(x, y, 0.44, 0.62, 0.07, 0.035, 0.015);
      return subtract(subtract(subtract(page, f1), f2), f3);
    }
    case 'library': { // stacked books
      return union(
        sdRoundRect(x, y, 0.35, 0.5, 0.05, 0.22, 0.015),
        sdRoundRect(x, y, 0.48, 0.5, 0.05, 0.22, 0.015),
        sdRoundRect(x, y, 0.63, 0.52, 0.05, 0.2, 0.015));
    }
    case 'extension':
    default: { // puzzle piece
      const body = sdRoundRect(x, y, 0.47, 0.55, 0.18, 0.18, 0.03);
      const knobTop = sdCircle(x, y, 0.47, 0.35, 0.065);
      const knobRight = sdCircle(x, y, 0.67, 0.55, 0.065);
      return union(body, knobTop, knobRight);
    }
  }
}

export interface PngIconOptions {
  size: number;
  colour: string;
  glyph: Glyph;
  /** 'colour' = brand background + white glyph. 'outline' = white glyph on transparent (Teams outline icon). */
  style?: 'colour' | 'outline';
  /** Rounded background (App Catalog) or full bleed square (Teams colour icon). */
  rounded?: boolean;
}

/** Render an icon as RGBA pixels. */
function render(opts: PngIconOptions): Buffer {
  const { size, glyph } = opts;
  const style = opts.style ?? 'colour';
  const rounded = opts.rounded ?? true;
  const top = hexToRgb(opts.colour);
  const bottom = shade(top, 0.78);
  const px = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let bgCov = 0, glyphCov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const bg = rounded ? sdRoundRect(x, y, 0.5, 0.5, 0.5, 0.5, 0.18) : -1;
          if (bg <= 0) { bgCov++; }
          if (glyphSdf(glyph, x, y) <= 0) { glyphCov++; }
        }
      }
      const n = SS * SS;
      const i = (py * size + pxi) * 4;
      if (style === 'outline') {
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
        px[i + 3] = Math.round((glyphCov / n) * 255);
        continue;
      }
      const t = py / (size - 1);
      const base: Rgb = [0, 1, 2].map(k => Math.round(top[k] + (bottom[k] - top[k]) * t)) as Rgb;
      const g = glyphCov / n;
      px[i] = Math.round(base[0] + (255 - base[0]) * g);
      px[i + 1] = Math.round(base[1] + (255 - base[1]) * g);
      px[i + 2] = Math.round(base[2] + (255 - base[2]) * g);
      px[i + 3] = Math.round((bgCov / n) * 255);
    }
  }
  return px;
}

// ---------- minimal PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) { c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(rgba: Buffer, width: number, height: number): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function makePngIcon(opts: PngIconOptions): Buffer {
  return encodePng(render(opts), opts.size, opts.size);
}

/** Read width/height from a PNG header without decoding it. */
export function readPngSize(buf: Buffer): { width: number; height: number } | undefined {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) { return undefined; }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ---------- SVG toolbox icons ----------
const SVG_GLYPH_PATHS: Record<Glyph, string> = {
  package: '<rect x="13" y="19" width="22" height="18" rx="2" fill="#fff"/><rect x="11" y="14" width="26" height="6" rx="1.5" fill="#fff"/><rect x="22.5" y="14" width="3" height="23" fill="url(#g)"/>',
  webpart: '<rect x="13" y="13" width="10" height="10" rx="1.5" fill="#fff"/><rect x="25" y="13" width="10" height="10" rx="1.5" fill="#fff"/><rect x="13" y="25" width="10" height="10" rx="1.5" fill="#fff"/><rect x="25" y="25" width="10" height="10" rx="1.5" fill="#fff"/>',
  ace: '<rect x="12" y="15" width="24" height="18" rx="2.5" fill="#fff"/><rect x="16" y="20.5" width="12" height="2.4" rx="1.2" fill="url(#g)"/><rect x="16" y="25.5" width="9" height="2.4" rx="1.2" fill="url(#g)"/>',
  extension: '<rect x="14" y="18" width="17" height="17" rx="1.5" fill="#fff"/><circle cx="22.5" cy="17" r="3.2" fill="#fff"/><circle cx="32" cy="26.5" r="3.2" fill="#fff"/>',
  commandset: '<rect x="11" y="20.5" width="7" height="7" rx="1" fill="#fff"/><rect x="20.5" y="20.5" width="7" height="7" rx="1" fill="#fff"/><rect x="30" y="20.5" width="7" height="7" rx="1" fill="#fff"/>',
  field: '<rect x="18" y="12" width="12" height="24" rx="1.5" fill="#fff"/><rect x="20" y="22" width="8" height="4" fill="url(#g)"/>',
  form: '<rect x="14" y="11" width="20" height="26" rx="2" fill="#fff"/><rect x="17.5" y="16.5" width="13" height="3" rx="1.2" fill="url(#g)"/><rect x="17.5" y="22.5" width="13" height="3" rx="1.2" fill="url(#g)"/><rect x="17.5" y="28.5" width="7" height="3" rx="1.2" fill="url(#g)"/>',
  library: '<rect x="14" y="13" width="5" height="22" rx="1" fill="#fff"/><rect x="21" y="13" width="5" height="22" rx="1" fill="#fff"/><rect x="28" y="15" width="5" height="20" rx="1" fill="#fff"/>',
};

export interface SvgIconOptions {
  colour: string;
  glyph: Glyph;
  /** If supplied, initials are drawn instead of the glyph (good for telling web parts apart). */
  title?: string;
}

export function makeSvgIcon(opts: SvgIconOptions): string {
  const [r, g, b] = hexToRgb(opts.colour);
  const [r2, g2, b2] = shade([r, g, b], 0.78);
  const c1 = `rgb(${r},${g},${b})`;
  const c2 = `rgb(${r2},${g2},${b2})`;
  const content = opts.title
    ? `<text x="24" y="30.5" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="600" fill="#fff">${escapeXml(initials(opts.title))}</text>`
    : SVG_GLYPH_PATHS[opts.glyph];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="48" height="48" rx="9" fill="url(#g)"/>${content}</svg>`;
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
}

/**
 * Suggest a Fluent UI (Office UI Fabric) icon font name from the web part title.
 * Used when people prefer font icons over generated images.
 */
export function suggestFluentIcon(title: string, kind: ComponentKind): string {
  const t = title.toLowerCase();
  const map: [RegExp, string][] = [
    [/news|announce/, 'News'], [/event|calendar|schedule/, 'Calendar'], [/people|staff|team|directory|profile/, 'People'],
    [/birthday|anniversar|celebrat/, 'BirthdayCake'], [/weather/, 'Sunny'], [/chart|report|dashboard|kpi|stat/, 'BarChart4'],
    [/link|quick/, 'Link'], [/search|find/, 'Search'], [/doc|file|librar/, 'DocumentSet'], [/task|todo|planner/, 'TaskManager'],
    [/map|location|office/, 'MapPin'], [/video|stream/, 'Video'], [/image|photo|gallery|carousel/, 'PhotoCollection'],
    [/form|survey|poll|feedback/, 'Questionnaire'], [/faq|help|support/, 'Help'], [/alert|banner|notice|warning/, 'Megaphone'],
    [/welcome|hero|header/, 'Home'], [/clock|time|countdown/, 'Clock'], [/list|table|grid/, 'Table'], [/chat|teams|message/, 'Chat'],
  ];
  for (const [re, icon] of map) { if (re.test(t)) { return icon; } }
  return kind === 'AdaptiveCardExtension' ? 'CardHeader' : 'WebComponents';
}
