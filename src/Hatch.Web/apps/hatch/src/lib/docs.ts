import { Marked, type Token, type Tokens } from 'marked';

/** The plain text of a run of inline tokens: what a reader sees, with the markup
    gone. A heading token's own `text` is raw markdown (backticks and all), so a
    slug taken from it would carry the markup's punctuation. Leaf `text` is
    already unescaped, so nothing here decodes entities. */
export function plainText(tokens: Token[]): string {
  let out = '';
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
      case 'codespan':
      case 'escape':
        out += token.text;
        break;
      case 'image':
        out += token.text;
        break;
      case 'html':
        break;
      default:
        if ('tokens' in token && Array.isArray(token.tokens)) out += plainText(token.tokens);
    }
  }
  return out;
}

/** GitHub's heading ids: lowercase, punctuation dropped, spaces to hyphens, and a
    repeat takes `-1`, `-2`, ... The next suffix is tried until the candidate is
    unused, so `x`, `x`, `x-1` cannot hand out `x-1` twice. */
export function createSlugger(): (text: string) => string {
  const uses = new Map<string, number>();
  return (text) => {
    const base = text.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
    let candidate = base;
    let n = uses.get(base) ?? 0;
    while (uses.has(candidate)) candidate = `${base}-${++n}`;
    uses.set(base, n);
    uses.set(candidate, uses.get(candidate) ?? 0);
    return candidate;
  };
}

export interface OutlineEntry {
  depth: 2 | 3;
  text: string;
  id: string;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Renders the document to HTML whose `##`-`####` headings carry an id and a `#`
    anchor, and lists the `##`/`###` headings as an outline. One pass: the outline
    and the ids come from the same slugger run in document order, so they cannot
    disagree. The output is not sanitized - that is the page's job, and a separate
    step. A local `Marked`, so the global instance `markdown.ts` uses is untouched. */
export function renderDocs(source: string): { html: string; outline: OutlineEntry[] } {
  const slug = createSlugger();
  const outline: OutlineEntry[] = [];
  const marked = new Marked({
    renderer: {
      heading(token: Tokens.Heading) {
        const { depth, tokens } = token;
        if (depth < 2 || depth > 4) return false;
        const text = plainText(tokens);
        const id = slug(text);
        if (depth === 2 || depth === 3) outline.push({ depth, text, id });
        const label = escapeAttr(text);
        return (
          `<h${depth} id="${id}">${this.parser.parseInline(tokens)}` +
          `<a class="hatch-docs-anchor" href="#${id}" aria-label="Link to ${label}">#</a></h${depth}>\n`
        );
      },
    },
  });
  const html = marked.parse(source, { async: false });
  return { html, outline };
}
