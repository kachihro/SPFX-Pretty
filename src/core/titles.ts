/**
 * Helpers that turn scaffold-y names ("hello-world-client-side-solution",
 * "HelloWorldWebPart") into titles that look good in the App Catalog.
 */

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
const KEEP_UPPER = new Set(['spfx', 'hr', 'it', 'ui', 'api', 'kpi', 'faq', 'crm', 'pdf', 'ace', 'sso', 'id', 'url', 'sp', 'm365', 'o365', 'qr']);

/** Noise that the Yeoman generator adds and nobody wants to see in the catalog. */
const NOISE = [
  /[-_ ]?client[-_ ]?side[-_ ]?solution$/i,
  /[-_ ]?spfx$/i,
  /^spfx[-_ ]/i,
  /[-_ ]?web[-_ ]?part$/i,
  /[-_ ]?webpart$/i,
  /[-_ ]?application[-_ ]?customizer$/i,
  /[-_ ]?command[-_ ]?set$/i,
  /[-_ ]?field[-_ ]?customizer$/i,
  /[-_ ]?form[-_ ]?customizer$/i,
  /[-_ ]?adaptive[-_ ]?card[-_ ]?extension$/i,
  /[-_ ]?feature$/i,
];

export function splitWords(raw: string): string[] {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function stripNoise(raw: string): string {
  let s = raw.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of NOISE) {
      const next = s.replace(re, '').trim();
      if (next !== s && next.length > 0) { s = next; changed = true; }
    }
  }
  return s;
}

export function toNiceTitle(raw: string): string {
  const words = splitWords(stripNoise(raw));
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (KEEP_UPPER.has(lower)) { return lower === 'spfx' ? 'SPFx' : lower === 'm365' ? 'M365' : lower === 'o365' ? 'O365' : lower.toUpperCase(); }
      if (i > 0 && SMALL_WORDS.has(lower)) { return lower; }
      if (/^[A-Z0-9]{2,}$/.test(w)) { return w; } // already an acronym
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** Why a title looks "un-nice" - empty array means it's lovely. */
export function titleProblems(title: string | undefined): string[] {
  const problems: string[] = [];
  if (!title || !title.trim()) { return ['is empty']; }
  const t = title.trim();
  if (/client-side-solution/i.test(t)) { problems.push('still has the generator suffix "client-side-solution"'); }
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(t)) { problems.push('is kebab-case (looks like a package name, not a title)'); }
  else if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(t)) { problems.push('is snake_case'); }
  else if (/^[A-Z][a-z0-9]+([A-Z][a-z0-9]*)+$/.test(t)) { problems.push('is PascalCase with no spaces'); }
  else if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/.test(t)) { problems.push('is camelCase with no spaces'); }
  else if (/^[a-z]/.test(t)) { problems.push('starts with a lower-case letter'); }
  if (/web ?part$/i.test(t)) { problems.push('ends with "WebPart" (users already know it is a web part)'); }
  if (t.length > 60) { problems.push(`is long (${t.length} chars) and will be truncated in the App Catalog / toolbox`); }
  return problems;
}

/** Scaffold-default descriptions such as "HelloWorld description". */
export function isPlaceholderDescription(desc: string | undefined, title?: string): boolean {
  if (!desc || !desc.trim()) { return true; }
  const d = desc.trim().toLowerCase();
  if (/^[\w-]+ description$/.test(d)) { return true; }
  if (title && d === `${title.toLowerCase()} description`) { return true; }
  if (/^(todo|tbd|description|my description|lorem ipsum)/.test(d)) { return true; }
  if (/^[\w-]+ feature$/.test(d)) { return true; }
  return false;
}

export function initials(title: string): string {
  const words = splitWords(stripNoise(title)).filter(w => !SMALL_WORDS.has(w.toLowerCase()));
  if (words.length === 0) { return '?'; }
  if (words.length === 1) { return words[0].slice(0, 2).replace(/^./, c => c.toUpperCase()); }
  return (words[0][0] + words[1][0]).toUpperCase();
}
