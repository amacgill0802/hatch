import { PageHeader } from '@hatch/ui';
import { renderMarkdown } from '../lib/markdown';
// Relative on purpose: Vite refuses a "/hatch-at-home.md" specifier into public/.
// The file stays where it is, so it is still served at /apps/hatch/hatch-at-home.md.
import source from '../../public/hatch-at-home.md?raw';

// The document's own H1 becomes the page header, so the title appears once.
// A document that loses its H1 fails here, loudly, rather than drawing a page
// with no title.
const match = source.match(/^# (.+)\r?\n([\s\S]*)$/);
if (!match) throw new Error('hatch-at-home.md must open with a "# " title line');
const [, title, body] = match;

/** The "Hatch at home" document, shown inside the app. */
export function DocsPage() {
  return (
    <div className="hatch-page">
      <PageHeader title={title} />
      <div className="hatch-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
    </div>
  );
}
