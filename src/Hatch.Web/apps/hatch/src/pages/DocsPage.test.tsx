import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderMarkdown } from '../lib/markdown';
import { DocsPage } from './DocsPage';

// renderMarkdown's DOMPurify pair needs a real DOM, which this workspace's
// tests do not have - see ProseClamp.test.tsx. The identity stub, wrapped in a
// spy, still shows what the page handed it.
vi.mock('../lib/markdown', () => ({ renderMarkdown: vi.fn((source: string) => source) }));

describe('DocsPage', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <DocsPage />
    </MemoryRouter>,
  );

  it('titles the page from the document, once', () => {
    expect(html).toContain('<h1>Hatch at home</h1>');
    expect(html.split('<h1').length - 1).toBe(1);
  });

  it('renders the rest of the document, without its leading title line', () => {
    const body = vi.mocked(renderMarkdown).mock.calls[0][0];

    expect(body.startsWith('# ')).toBe(false);
    expect(body).toContain('The two sentences to send a friend');
    expect(html).toContain('class="hatch-markdown"');
  });
});
