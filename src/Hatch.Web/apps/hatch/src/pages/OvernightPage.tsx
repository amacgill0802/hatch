import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, PageHeader, Table } from '@hatch/ui';
import { getOvernight, markOvernightSeen } from '../api/client';
import { TypeBadge } from '../components/TypeBadge';
import { beneathLabel, nightHeading, overnightEmptyWords } from '../lib/overnight';
import { useLoaded } from '../lib/useLoaded';
import { useOvernightContext } from '../lib/useOvernightContext';
import type { OvernightDto } from '../types';

/**
 * The newest night the loop ran, biggest deliveries first - the read the
 * server already answers, drawn in the order it was given rather than
 * re-sorted here.
 */
export function OvernightPage() {
  const { data, error } = useLoaded<OvernightDto>(getOvernight);
  const { reload } = useOvernightContext();

  /* Reading this page is what counts as "read", whether or not the row data
     above happens to load - independent of useLoaded's own read, and run once
     regardless of how many times this effect's own dependency changes.
     Marks the night seen, then reloads the nav's own badge so it goes quiet
     here, now, with no page reload - for everybody looking at it. */
  useEffect(() => {
    void markOvernightSeen()
      .then(() => reload())
      .catch(() => {
        // Silent, matching useOvernight.ts: a failed mark leaves the control
        // exactly as lit as it was.
      });
  }, [reload]);

  return (
    <div className="hatch-page">
      <PageHeader title="Overnight" description="What the loop landed last, biggest deliveries first." />

      {error && <p className="text-danger">{error}</p>}

      {data && data.count === 0 && <EmptyState message={overnightEmptyWords()} />}

      {data && data.count > 0 && (
        <>
          <p className="hatch-section-hint text-muted">{nightHeading(data)}</p>
          <Card flush>
            <Table>
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Beneath</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <Link to={`/issues/${row.key}`}>{row.key}</Link>
                    </td>
                    <td>
                      <TypeBadge type={row.type} />
                    </td>
                    <td>{row.title}</td>
                    <td className="text-muted">{beneathLabel(row.descendantCount)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
