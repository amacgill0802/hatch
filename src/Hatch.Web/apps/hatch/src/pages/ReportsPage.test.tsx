import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ReportsPage } from './ReportsPage';

describe('ReportsPage', () => {
  it('lists the Timeline report with what it answers and a link to it', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );

    expect(html).toContain('Reports');
    expect(html).toContain('Timeline');
    expect(html).toContain('When each epic was in flight, and how long its work sat in each column.');
    expect(html).toContain('href="/reports/timeline"');
  });
});
