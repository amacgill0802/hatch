import { Link } from 'react-router-dom';
import { Card, EmptyState, PageHeader, Table } from '@hatch/ui';
import { getOvernight } from '../api/client';
import { TypeBadge } from '../components/TypeBadge';
import { beneathLabel, nightHeading, overnightEmptyWords } from '../lib/overnight';
import { useLoaded } from '../lib/useLoaded';
import type { OvernightDto } from '../types';

/**
 * The newest night the loop ran, biggest deliveries first - the read the
 * server already answers, drawn in the order it was given rather than
 * re-sorted here.
 */
export function OvernightPage() {
  const { data, error } = useLoaded<OvernightDto>(getOvernight);

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
