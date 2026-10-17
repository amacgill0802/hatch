import { describe, expect, it } from 'vitest';
import { marked } from 'marked';
import source from '../../public/hatch-at-home.md?raw';
import { createSlugger, renderDocs } from './docs';

/** The document's lines outside fenced blocks, which is where its headings are. */
function proseLines(): string[] {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (m) {
      if (fence === null) fence = m[1][0];
      else if (m[1][0] === fence) fence = null;
      continue;
    }
    if (fence === null) out.push(line);
  }
  return out;
}

const ids = (html: string) => [...html.matchAll(/<h[2-4] id="([^"]*)"/g)].map((m) => m[1]);

describe('renderDocs on the document', () => {
  const { html, outline } = renderDocs(source);

  it('lists the depth-2 headings in order, without backticks', () => {
    const expected = proseLines()
      .filter((l) => l.startsWith('## '))
      .map((l) => l.slice(3).replace(/`/g, ''));
    expect(outline.filter((e) => e.depth === 2).map((e) => e.text)).toEqual(expected);
  });

  it('gives every ##-#### heading a unique id', () => {
    const found = ids(html);
    expect(new Set(found).size).toBe(found.length);
    expect(found.length).toBe(proseLines().filter((l) => /^#{2,4} /.test(l)).length);
  });

  it('slugs the headings the document links to', () => {
    const outlineIds = outline.map((e) => e.id);
    for (const id of [
      'the-hatch-cli-command-by-command',
      'the-loop-hatch-go-to-work',
      'one-increment-hatch-work',
      'letting-the-loop-merge-for-you',
    ]) {
      expect(outlineIds).toContain(id);
    }
  });

  it('links each heading with a labelled anchor', () => {
    expect(html).toMatch(/<a class="hatch-docs-anchor" href="#the-hatch-cli-command-by-command" aria-label="[^"]+">#<\/a>/);
  });
});

describe('renderDocs on fixtures', () => {
  it('suffixes a repeated heading', () => {
    expect(renderDocs('## x\n\n## x\n').outline.map((e) => e.id)).toEqual(['x', 'x-1']);
    expect(renderDocs('## x\n\n### x\n\n## x\n').outline.map((e) => e.id)).toEqual(['x', 'x-1', 'x-2']);
  });

  it('slugs from the plain text of a heading', () => {
    const { outline } = renderDocs('## A *b* & `c`\n');
    expect(outline).toEqual([{ depth: 2, text: 'A b & c', id: 'a-b--c' }]);
  });

  it('escapes the label and keeps the markup in the heading', () => {
    const { html } = renderDocs('## Say "hi" <b>\n');
    expect(html).toContain('aria-label="Link to Say &quot;hi&quot; "');
  });

  it('leaves h1 and h5 to the default renderer', () => {
    const { html, outline } = renderDocs('# One\n\n##### Five\n');
    expect(html).not.toContain('id=');
    expect(outline).toEqual([]);
  });

  it('keeps #### out of the outline but gives it an id', () => {
    const { html, outline } = renderDocs('#### d\n');
    expect(html).toContain('<h4 id="d">');
    expect(outline).toEqual([]);
  });

  it('does not treat a # line in a fence as a heading', () => {
    const { html, outline } = renderDocs('```sh\n## not a heading\n```\n');
    expect(outline).toEqual([]);
    expect(ids(html)).toEqual([]);
  });

  it('numbers nested headings in document order', () => {
    const { outline } = renderDocs('## a\n\n> ## a\n\n- ## a\n');
    expect(outline.map((e) => e.id)).toEqual(['a', 'a-1', 'a-2']);
  });

  it('leaves the global marked untouched', () => {
    renderDocs('## T\n');
    expect(marked.parse('## T', { async: false })).not.toContain('id=');
  });
});

describe('createSlugger', () => {
  it('cannot hand out a suffix twice', () => {
    const slug = createSlugger();
    expect([slug('x'), slug('x'), slug('x-1'), slug('x')]).toEqual(['x', 'x-1', 'x-1-1', 'x-2']);
  });

  it('keeps letters, digits, underscores and hyphens', () => {
    expect(createSlugger()('Ünï_c0de: a-b?')).toBe('ünï_c0de-a-b');
  });
});
