import { useEffect, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { PageHeader } from '@hatch/ui';
import { docLinkTarget, hashId, isPlainPrimaryClick, renderDocs } from '../lib/docs';
import { usePhone } from '../lib/viewport';
// Relative on purpose: Vite refuses a "/hatch-at-home.md" specifier into public/.
// The file stays where it is, so it is still served at /apps/hatch/hatch-at-home.md.
import source from '../../public/hatch-at-home.md?raw';

// The document's own H1 becomes the page header, so the title appears once.
// A document that loses its H1 fails here, loudly, rather than drawing a page
// with no title.
const match = source.match(/^# (.+)\r?\n([\s\S]*)$/);
if (!match) throw new Error('hatch-at-home.md must open with a "# " title line');
const [, title, body] = match;

const docs = renderDocs(body);
// DOMPurify's default SANITIZE_DOM silently drops an id whose value names a
// property of document or of a form (title, links, images, forms, body,
// location...), so a heading titled "Links" would lose its anchor. The content
// here is shipped in the repo, not typed by a user, so the clobbering guard
// protects nothing and costs anchors.
const html = DOMPurify.sanitize(docs.html, { SANITIZE_DOM: false });

const list = (
  <ol className="hatch-docs-outline-list">
    {docs.outline.map((entry) => (
      <li key={entry.id} className={`hatch-docs-outline-item hatch-docs-outline-item--d${entry.depth}`}>
        <a href={'#' + entry.id}>{entry.text}</a>
      </li>
    ))}
  </ol>
);

/** The "Hatch at home" document, shown inside the app. */
export function DocsPage() {
  const isPhone = usePhone();
  const { hash } = useLocation();
  const navigate = useNavigate();

  // On a fresh load and on every hash change, Back included. scrollIntoView moves
  // whichever ancestor scrolls: .hatch-page on the desk, the document on a phone.
  useEffect(() => {
    const id = hashId(hash);
    if (!id) return;
    document.getElementById(id)?.scrollIntoView();
  }, [hash]);

  // One handler for the whole article. A link into the app goes through the router
  // (no page load, either address); fragments and external links stay the browser's.
  const onBodyClick = (e: MouseEvent<HTMLElement>) => {
    const a = (e.target as Element).closest?.('a');
    if (!a || !e.currentTarget.contains(a) || !isPlainPrimaryClick(e)) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const t = docLinkTarget(a.getAttribute('href'));
    if (t.kind !== 'app') return;
    e.preventDefault();
    navigate(t.to);
  };

  return (
    <div className="hatch-page">
      <PageHeader title={title} />
      {/* A direct child of .hatch-page, which caps its children at --measure. */}
      <div className="hatch-docs">
        {/* Plain anchors, not <Link>: a router link would turn a fragment into a route change. */}
        {isPhone ? (
          <details className="hatch-docs-outline">
            <summary>On this page</summary>
            <nav aria-label="On this page">{list}</nav>
          </details>
        ) : (
          <nav className="hatch-docs-outline" aria-label="On this page">
            <p className="hatch-docs-outline-title">On this page</p>
            {list}
          </nav>
        )}
        <article className="hatch-docs-body" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
