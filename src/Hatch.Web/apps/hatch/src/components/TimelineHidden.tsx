import { OTHER_KEY } from '../lib/timeline';

/** The rows the timeline is hiding, and the way back. It reports each press and
    writes nothing - the page that owns the hidden set does - and draws nothing
    at all while nothing is hidden. */
export function TimelineHidden({
  entries,
  onShow,
  onShowAll,
}: {
  /** Each hidden top-level row's key, with its title when the answer has one. */
  entries: { key: string; title: string | null }[];
  onShow: (key: string) => void;
  onShowAll: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <details className="hatch-timeline-hidden">
      {/* One text node: two adjacent ones would render with a comment between. */}
      <summary className="hatch-section-title">{`Hidden (${entries.length})`}</summary>
      <ul>
        {entries.map(({ key, title }) => (
          <li key={key}>
            {/* The Other row is drawn without its sentinel key, as in the chart. */}
            {!(key === OTHER_KEY && title !== null) && <span className="hatch-timeline-key">{key}</span>}
            {title !== null && <span className="hatch-timeline-hidden__title">{title}</span>}
            <button type="button" className="hatch-timeline-show" aria-label={`Show ${key}`} onClick={() => onShow(key)}>
              Show
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="hatch-timeline-show" onClick={onShowAll}>
        Show all
      </button>
    </details>
  );
}
