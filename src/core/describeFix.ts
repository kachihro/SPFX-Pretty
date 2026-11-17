import * as fs from 'fs';
import { applyEditsToText } from './jsonc';
import { Fix } from './types';

/**
 * A readable preview of what a fix will change - shown BEFORE anything is applied.
 * Lines starting with "-" are removed, "+" are added.
 */
export function describeFix(fix: Fix, rel: (file: string) => string): string[] {
  const out: string[] = [];
  if (fix.ask) { return [`Asks you for: ${fix.ask.prompt}`, `Then writes it to ${rel(fix.ask.file)} (${fix.ask.jsonPath.join(' > ')})`]; }
  if (fix.pick) { return [`Lets you choose: ${fix.pick.prompt}`, ...fix.pick.options.map(o => `  - ${o.label.replace(/\$\([^)]*\)\s*/g, '')}`)]; }
  if (fix.command) { return ['Opens a file picker - nothing changes until you choose a file.']; }
  const byFile = new Map<string, typeof fix.edits>();
  for (const e of fix.edits) { byFile.set(e.file, [...(byFile.get(e.file) ?? []), e]); }
  for (const [file, edits] of byFile) {
    let before = '';
    try { before = fs.readFileSync(file, 'utf8'); } catch { /* new file */ }
    const after = applyEditsToText(before, edits);
    out.push(`${rel(file)}:`);
    out.push(...lineDiff(before, after).map(l => `  ${l}`));
  }
  for (const c of fix.creates ?? []) {
    const exists = fs.existsSync(c.file);
    const what = c.encoding === 'base64' && /\.png$/i.test(c.file) ? 'image' : 'file';
    out.push(`${exists ? 'Replace' : 'Create'} ${what}: ${rel(c.file)}`);
  }
  return out.length ? out : ['(no file changes)'];
}

/** Changed lines only: trims the common start and end, caps the output. */
export function lineDiff(before: string, after: string, max = 8): string[] {
  const a = before.split(/\r?\n/), b = after.split(/\r?\n/);
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) { s++; }
  let ea = a.length - 1, eb = b.length - 1;
  while (ea >= s && eb >= s && a[ea] === b[eb]) { ea--; eb--; }
  const cut = (l: string) => (l.length > 140 ? l.slice(0, 137).trimEnd() + '...' : l).trim();
  const removed = a.slice(s, ea + 1).filter(l => l.trim()).map(l => `- ${cut(l)}`);
  const added = b.slice(s, eb + 1).filter(l => l.trim()).map(l => `+ ${cut(l)}`);
  const clip = (xs: string[]) => (xs.length > max ? [...xs.slice(0, max), `  ...and ${xs.length - max} more line(s)`] : xs);
  return [...clip(removed), ...clip(added)];
}
