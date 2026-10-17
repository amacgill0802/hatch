import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import source from '../../public/hatch-at-home.md?raw';
import { createSlugger, renderDocs } from '../lib/docs';
import { DocsPage } from './DocsPage';

// The real sanitizer needs a DOM, which this workspace's tests do not have -
// see ProseClamp.test.tsx. The identity stub still shows what the page handed it.
vi.mock('dompurify', () => ({ default: { sanitize: (html: string) => html } }));

const state = vi.hoisted(() => ({ phone: false }));
vi.mock('../lib/viewport', () => ({ usePhone: () => state.phone }));

function render(phone: boolean): string {
  state.phone = phone;
  return renderToStaticMarkup(
    <MemoryRouter>
      <DocsPage />
    </MemoryRouter>,
  );
}

/** The ids of the document's `## ` lines, skipping fenced code. */
function h2Ids(markdown: string): string[] {
  const slug = createSlugger();
  const ids: string[] = [];
  let fence = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const run = line.match(/^ {0,3}(`{3,})/);
    if (fence) {
      if (run && run[1].length >= fence && /^ {0,3}`+\s*$/.test(line)) fence = 0;
      continue;
    }
    if (run) {
      fence = run[1].length;
      continue;
    }
    const heading = line.match(/^## (.+?)\s*#*\s*$/);
    if (heading) ids.push(slug(heading[1]));
  }
  return ids;
}

/** The `href="#…"` targets inside the first <nav>…</nav>, or the <details>. */
function outlineHrefs(html: string): string[] {
  const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
  return [...nav.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
}

describe('DocsPage', () => {
  const desk = render(false);
  const phone = render(true);
  const body = source.replace(/^# .+\r?\n/, '');
  const outline = renderDocs(body).outline;

  it('titles the page from the document, once', () => {
    expect(desk).toContain('<h1>Hatch at home</h1>');
    expect(desk.split('<h1').length - 1).toBe(1);
  });

  it('lists the headings in document order as an outline nav on the desk', () => {
    expect(outlineHrefs(desk)).toEqual(outline.map((entry) => entry.id));
    expect(desk).not.toContain('<details');
  });

  it('outlines the document\'s ## headings and not the ones inside fenced code', () => {
    const ids = outline.filter((entry) => entry.depth === 2).map((entry) => entry.id);

    expect(ids).toEqual(h2Ids(body));
    expect(ids[0]).toBe('prerequisites');
    expect(desk).toContain('href="#upgrading"');
    expect(desk).not.toContain('href="#the-operator-and-claude-contract"');
  });

  it('puts the document in a docs body article, with anchored headings', () => {
    expect(desk).toContain('<article class="hatch-docs-body"');
    expect(desk).toContain('id="prerequisites"');
    expect(desk).not.toContain('hatch-markdown');
  });

  it('folds the outline into a closed details on a phone, still one nav', () => {
    expect(phone).toContain('<details');
    expect(phone).not.toMatch(/<details[^>]*\sopen/);
    expect(outlineHrefs(phone)).toEqual(outline.map((entry) => entry.id));
    expect(phone.split('<nav').length - 1).toBe(1);
  });
});
