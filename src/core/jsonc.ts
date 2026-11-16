import * as fs from 'fs';
import { parseTree, findNodeAtLocation, getNodeValue, modify, Node, JSONPath, ParseError } from 'jsonc-parser';
import { TextEdit } from './types';

/**
 * A JSON-with-comments document (SPFx manifests contain comments) that keeps
 * positions, so findings can point at the exact property and fixes can be
 * produced as minimal text edits that preserve formatting and comments.
 */
export class JsoncDoc {
  readonly text: string;
  readonly root: Node | undefined;
  readonly value: any;
  readonly errors: ParseError[] = [];

  constructor(readonly file: string, text?: string) {
    this.text = text ?? fs.readFileSync(file, 'utf8');
    this.root = parseTree(this.text, this.errors, { allowTrailingComma: true });
    this.value = this.root ? getNodeValue(this.root) : undefined;
  }

  get(path: JSONPath): any {
    if (!this.root) { return undefined; }
    const node = findNodeAtLocation(this.root, path);
    return node ? getNodeValue(node) : undefined;
  }

  /** Location of a property value, or the closest existing parent if it is missing. */
  locate(path: JSONPath): { offset: number; length: number } {
    if (!this.root) { return { offset: 0, length: 0 }; }
    for (let i = path.length; i >= 0; i--) {
      const node = findNodeAtLocation(this.root, path.slice(0, i));
      if (node) {
        // For whole objects only highlight the first line, it reads much nicer.
        if (node.type === 'object' || node.type === 'array') {
          const keyNode = node.parent?.type === 'property' ? node.parent.children?.[0] : undefined;
          if (keyNode) { return { offset: keyNode.offset, length: keyNode.length }; }
          return { offset: node.offset, length: 1 };
        }
        return { offset: node.offset, length: node.length };
      }
    }
    return { offset: 0, length: 0 };
  }

  /** Text edits that set a value at the given path (creating parents as needed). */
  set(path: JSONPath, value: unknown): TextEdit[] {
    const indent = detectIndent(this.text);
    return modify(this.text, path, value, {
      formattingOptions: { insertSpaces: indent.spaces, tabSize: indent.size, eol: this.text.includes('\r\n') ? '\r\n' : '\n' },
    }).map(e => ({ file: this.file, offset: e.offset, length: e.length, newText: e.content }));
  }
}

function detectIndent(text: string): { spaces: boolean; size: number } {
  const m = /\n([ \t]+)"/.exec(text);
  if (!m) { return { spaces: true, size: 2 }; }
  if (m[1].startsWith('\t')) { return { spaces: false, size: 1 }; }
  return { spaces: true, size: Math.min(m[1].length, 4) };
}

/** Apply edits to a string (edits for a single file). */
export function applyEditsToText(text: string, edits: TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.offset - a.offset);
  let out = text;
  for (const e of sorted) {
    out = out.slice(0, e.offset) + e.newText + out.slice(e.offset + e.length);
  }
  return out;
}
