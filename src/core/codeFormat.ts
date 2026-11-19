/**
 * Pretty-prints the JSON examples in the help ("before" / "after") and highlights them.
 * Fragments like  "developer": { "name": "Kachihro" }  are formatted as if inside an object.
 * Anything that isn't JSON (SCSS, XML, TypeScript) is returned unchanged.
 */
export interface Formatted { text: string; lang: 'json' | 'text'; }

export function formatSnippet(src: string): Formatted {
  const t = src.trim();
  for (const wrap of [false, true]) {
    try {
      const parsed = JSON.parse(wrap ? `{${t}}` : t);
      let text = JSON.stringify(parsed, null, 2);
      if (wrap) {
        // drop the braces we added and the indent they caused
        text = text.split('\n').slice(1, -1).map(l => l.replace(/^ {2}/, '')).join('\n');
      }
      return { text, lang: 'json' };
    } catch { /* try the next shape */ }
  }
  return { text: src, lang: 'text' };
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** HTML with <span class="k|s|n|b|p"> tokens for keys, strings, numbers, booleans and punctuation. */
export function highlightJson(text: string): string {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)|([{}[\],])/g;
  let out = '', last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index));
    if (m[1]) { out += m[2] ? `<span class="k">${esc(m[1])}</span>${esc(m[2])}` : `<span class="s">${esc(m[1])}</span>`; }
    else if (m[3]) { out += `<span class="b">${m[3]}</span>`; }
    else if (m[4]) { out += `<span class="n">${m[4]}</span>`; }
    else { out += `<span class="p">${esc(m[5])}</span>`; }
    last = re.lastIndex;
  }
  return out + esc(text.slice(last));
}

/** Formatted + highlighted HTML for a <pre><code> block. */
export function snippetHtml(src: string): string {
  const f = formatSnippet(src);
  return f.lang === 'json' ? highlightJson(f.text) : esc(f.text);
}

/** CSS for the highlighted tokens (light + dark). */
export const SNIPPET_CSS = `.k{color:#2A6FDB}.s{color:#0b7a4b}.n{color:#b45309}.b{color:#7B3FE4}.p{color:#8a94a6}
@media (prefers-color-scheme:dark){.k{color:#7cb7ff}.s{color:#8bd5a5}.n{color:#f5b36b}.b{color:#c4a5ff}.p{color:#7d8696}}`;
