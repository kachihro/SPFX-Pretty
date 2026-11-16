import * as https from 'https';

/**
 * SPFx compatibility data, from Microsoft Learn "SharePoint Framework Platform & Toolchain
 * Compatibility Reference" (checked 16/11/2026). Node = supported major versions,
 * ts = supported TypeScript range, react = the exact React version to use.
 */
export interface SpfxRelease {
  version: string;
  node: number[];
  ts: [string, string];
  react: string;
  toolchain: 'gulp' | 'heft';
  /** dd/mm/yyyy where known */
  released?: string;
}

const R = (version: string, node: number[], ts: [string, string], react: string, released?: string): SpfxRelease =>
  ({ version, node, ts, react, toolchain: cmp(version, '1.22.0') >= 0 ? 'heft' : 'gulp', released });

export const SPFX_RELEASES: SpfxRelease[] = [
  R('1.24.1', [22, 24, 26], ['2.9', '5.8'], '18.3.1', '02/11/2026'),
  R('1.24.0', [22, 24, 26], ['2.9', '5.8'], '18.3.1', '28/10/2026'),
  R('1.23.2', [22], ['2.9', '5.8'], '17.0.1'),
  R('1.23.0', [22], ['2.9', '5.8'], '17.0.1', '13/05/2026'),
  R('1.22.2', [22], ['2.9', '5.8'], '17.0.1'),
  R('1.22.1', [22], ['2.9', '5.8'], '17.0.1'),
  R('1.22.0', [22], ['2.9', '5.8'], '17.0.1'),
  R('1.21.1', [22], ['5.3', '5.3'], '17.0.1'),
  R('1.21.0', [22], ['5.3', '5.3'], '17.0.1'),
  R('1.20.0', [18], ['4.5', '4.7'], '17.0.1'),
  R('1.19.0', [18], ['4.5', '4.7'], '17.0.1'),
  R('1.18.2', [16, 18], ['4.5', '4.7'], '17.0.1'),
  R('1.18.1', [16, 18], ['4.5', '4.7'], '17.0.1'),
  R('1.18.0', [16, 18], ['4.5', '4.7'], '17.0.1'),
  R('1.17.4', [16], ['4.5', '4.5'], '17.0.1'),
  R('1.17.3', [16], ['4.5', '4.5'], '17.0.1'),
  R('1.17.2', [16], ['4.5', '4.5'], '17.0.1'),
  R('1.17.1', [16], ['4.5', '4.5'], '17.0.1'),
  R('1.17.0', [16], ['4.5', '4.5'], '17.0.1'),
  R('1.16.1', [16], ['4.5', '4.5'], '17.0.1'),
  R('1.16.0', [16], ['4.5', '4.5'], '17.0.1'),
  R('1.15.2', [12, 14, 16], ['4.5', '4.5'], '16.13.1'),
  R('1.15.0', [12, 14, 16], ['4.5', '4.5'], '16.13.1'),
  R('1.14.0', [12, 14], ['3.9', '3.9'], '16.13.1'),
  R('1.13.1', [12, 14], ['3.9', '3.9'], '16.13.1'),
  R('1.13.0', [12, 14], ['3.9', '3.9'], '16.13.1'),
  R('1.12.1', [10, 12, 14], ['3.7', '3.7'], '16.9.0'),
  R('1.11.0', [10], ['3.3', '3.3'], '16.8.5'),
  R('1.10.0', [8, 10], ['3.3', '3.3'], '16.8.5'),
  R('1.9.1', [8, 10], ['2.9', '2.9'], '16.8.5'),
  R('1.8.2', [8, 10], ['2.9', '2.9'], '16.7.0'),
  R('1.8.1', [8], ['2.7', '3.0'], '16.7.0'),
  R('1.8.0', [8], ['2.7', '3.0'], '16.7.0'),
  R('1.7.1', [8], ['2.4', '2.4'], '16.3.2'),
  R('1.7.0', [8], ['2.4', '2.4'], '16.3.2'),
  R('1.6.0', [6, 8], ['2.4', '2.4'], '15'),
  R('1.5.1', [6, 8], ['2.4', '2.4'], '15'),
  R('1.5.0', [6, 8], ['2.4', '2.4'], '15'),
  R('1.4.1', [6, 8], ['2.4', '2.4'], '15'),
  R('1.4.0', [6], ['2.4', '2.4'], '15'),
  R('1.3.0', [6], ['2.4', '2.4'], '15'),
  R('1.1.0', [6], ['2.4', '2.4'], '15'),
  R('1.0.0', [6], ['2.4', '2.4'], '15'),
];

export const BUNDLED_LATEST = SPFX_RELEASES[0].version;

/** Compare dotted versions numerically (pre-release suffixes sort before the release). */
export function cmp(a: string, b: string): number {
  const pa = clean(a).split(/[.-]/), pb = clean(b).split(/[.-]/);
  for (let i = 0; i < 3; i++) {
    const d = (parseInt(pa[i] ?? '0', 10) || 0) - (parseInt(pb[i] ?? '0', 10) || 0);
    if (d) { return d; }
  }
  const preA = /-/.test(clean(a)), preB = /-/.test(clean(b));
  return preA === preB ? 0 : preA ? -1 : 1;
}

/** Strip ^ ~ >= etc from a package.json range. */
export function clean(v: string): string {
  return String(v).trim().replace(/^[^\d]*/, '');
}

export function major(v: string): number { return parseInt(clean(v), 10) || 0; }
export function minor(v: string): number { return parseInt(clean(v).split('.')[1] ?? '0', 10) || 0; }

/** The compatibility row for a version (exact, else the nearest older release). */
export function releaseFor(version: string): SpfxRelease | undefined {
  const v = clean(version);
  return SPFX_RELEASES.find(r => r.version === v) ?? SPFX_RELEASES.find(r => cmp(r.version, v) <= 0);
}

/** Releases strictly after `from` up to and including `to`, oldest first. */
export function releasesBetween(from: string, to: string): SpfxRelease[] {
  return SPFX_RELEASES.filter(r => cmp(r.version, from) > 0 && cmp(r.version, to) <= 0).reverse();
}

export function releaseNotesUrl(version: string): string {
  return `https://learn.microsoft.com/sharepoint/dev/spfx/release-${clean(version)}`;
}

/**
 * Ask the public npm registry which version the SPFx generator's @latest tag points at.
 * Only the package name is sent. Falls back to the bundled table on any error / timeout.
 */
export function fetchLatestSpfxVersion(timeoutMs = 4000): Promise<string | undefined> {
  return new Promise(resolve => {
    const req = https.get('https://registry.npmjs.org/-/package/@microsoft/generator-sharepoint/dist-tags',
      { headers: { accept: 'application/json' }, timeout: timeoutMs }, res => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => {
          try { const v = JSON.parse(body)?.latest; resolve(typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v) ? v : undefined); } catch { resolve(undefined); }
        });
      });
    req.on('timeout', () => { req.destroy(); resolve(undefined); });
    req.on('error', () => resolve(undefined));
  });
}
