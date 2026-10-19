import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, EmptyState, PageHeader, Table } from '@hatch/ui';
import { getSearch, getStatuses } from '../api/client';
import { StatusPill } from '../components/StatusPill';
import { TypeBadge } from '../components/TypeBadge';
import { message } from '../lib/errors';
import { createLedger } from '../lib/refresh';
import { countLine, hasMore, matchedWords, readSearch, searchRequest, writeSearch } from '../lib/search';
import { useLoaded } from '../lib/useLoaded';
import type { SearchHit, Status } from '../types';

/** How long the box waits after the last keystroke before it writes `q`. */
const DEBOUNCE_MS = 300;

/**
 * Every issue, by its words and by when it was made or closed - a search box
 * over a table of hits. The box's own state is the URL's `q` and nowhere
 * else, so Back undoes a search and pasting the link reproduces it.
 *
 * The filter row (Project/Type/Column facets, date ranges) is a sibling task
 * on top of this page.
 */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const filters = readSearch(params);

  const { data: statuses } = useLoaded<Status[]>(getStatuses);

  const [draft, setDraft] = useState(filters.q);
  const [lastQ, setLastQ] = useState(filters.q);
  // The URL's q changed from outside (Back, or a link reached from elsewhere)
  // - adjusted during render, the way InlineTitle re-syncs its own draft.
  if (filters.q !== lastQ) {
    setLastQ(filters.q);
    setDraft(filters.q);
  }

  useEffect(() => {
    if (draft === filters.q) return;
    const timer = setTimeout(() => {
      setParams(writeSearch({ ...filters, q: draft }), { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // filters.q, not filters: a re-render with the same q (loading, statuses
    // arriving) must not restart the timer, or a quick re-render could starve it.
  }, [draft, filters.q, setParams]);

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledger] = useState(createLedger);

  const key = writeSearch(filters).toString();

  useEffect(() => {
    const ticket = ledger.begin();
    setHits([]);
    setTotal(0);
    setLoading(true);
    setError(null);

    getSearch(searchRequest(filters, 0)).then(
      (result) => {
        if (!ledger.isCurrent(ticket)) return;
        setHits(result.hits);
        setTotal(result.total);
        setLoading(false);
      },
      (err: unknown) => {
        if (!ledger.isCurrent(ticket)) return;
        setError(message(err));
        setLoading(false);
      },
    );

    return () => ledger.invalidate();
    // key, not filters: it is the same string for an unchanged search, so a
    // re-render that leaves the search alone does not reload it.
  }, [key]);

  function showMore() {
    const ticket = ledger.begin();
    setLoadingMore(true);
    setError(null);

    getSearch(searchRequest(filters, hits.length)).then(
      (result) => {
        if (!ledger.isCurrent(ticket)) return;
        setHits((prev) => [...prev, ...result.hits]);
        setTotal(result.total);
        setLoadingMore(false);
      },
      (err: unknown) => {
        if (!ledger.isCurrent(ticket)) return;
        setError(message(err));
        setLoadingMore(false);
      },
    );
  }

  return (
    <div className="hatch-page">
      <PageHeader title="Search" description="Every issue, by its words and by when it was made or closed." />

      <div className="hatch-board-filters">
        {/* type="search" on purpose; base.css says why. hatch-search-box is
            unstyled for now - the filter-row task renames this div to also
            carry hatch-search-filters and adds its facets inside it. */}
        <input
          type="search"
          className={`hatch-board-search hatch-search-box${draft.trim() !== '' ? ' hatch-board-search--lit' : ''}`}
          aria-label="Search issues"
          placeholder="Search titles, descriptions, comments…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>

      {loading && <p className="text-muted">Searching…</p>}

      {!loading && error && hits.length === 0 && <p className="text-danger">{error}</p>}

      {!loading && !error && hits.length === 0 && <EmptyState message="Nothing matches." />}

      {!loading && hits.length > 0 && (
        <>
          {error && <p className="text-danger">{error}</p>}

          <p className="text-muted" aria-live="polite">
            {countLine(hits.length, total)}
          </p>

          <Card flush>
            <Table>
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Column</th>
                  <th>Project</th>
                  <th>Created</th>
                  <th>Closed</th>
                  <th>Matched</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((hit) => {
                  const status = statuses?.find((s) => s.id === hit.card.statusId);
                  const words = matchedWords(hit.matched);

                  return (
                    <tr key={hit.card.key}>
                      <td>
                        <Link to={`/issues/${hit.card.key}`}>{hit.card.key}</Link>
                      </td>
                      <td>
                        <TypeBadge type={hit.card.type} />
                      </td>
                      <td>{hit.card.title}</td>
                      <td>
                        {status ? <StatusPill status={status} /> : <span>#{hit.card.statusId}</span>}
                      </td>
                      <td>{hit.card.projectKey}</td>
                      <td className="text-muted">{new Date(hit.createdAt).toLocaleDateString()}</td>
                      <td className="text-muted">{hit.closedAt ? new Date(hit.closedAt).toLocaleDateString() : ''}</td>
                      <td>{words && <span className="text-muted">{words}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          {hasMore(hits.length, total) && (
            <div className="hatch-form-actions">
              <Button onClick={showMore} loading={loadingMore}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
