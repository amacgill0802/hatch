import { describe, expect, it } from 'vitest';
import { beneathLabel, nightHeading, overnightEmptyWords } from './overnight';

describe('overnightEmptyWords', () => {
  it('says nothing has landed yet', () => {
    expect(overnightEmptyWords()).toBe('Nothing has landed yet.');
  });
});

describe('nightHeading', () => {
  it('names the range and pluralises the count', () => {
    const dto = { from: '2026-10-05T23:40:00Z', to: '2026-10-06T11:40:00Z', count: 3 };
    const from = new Date(dto.from).toLocaleString();
    const to = new Date(dto.to).toLocaleString();

    expect(nightHeading(dto)).toBe(`${from} – ${to}, 3 issues landed.`);
  });

  it('says issue in the singular at one', () => {
    const dto = { from: '2026-10-05T23:40:00Z', to: '2026-10-06T11:40:00Z', count: 1 };
    const from = new Date(dto.from).toLocaleString();
    const to = new Date(dto.to).toLocaleString();

    expect(nightHeading(dto)).toBe(`${from} – ${to}, 1 issue landed.`);
  });

  it('falls back to the empty state when there is no range', () => {
    expect(nightHeading({ from: null, to: null, count: 0 })).toBe('Nothing has landed yet.');
    expect(nightHeading({ from: null, to: '2026-10-06T11:40:00Z', count: 0 })).toBe('Nothing has landed yet.');
    expect(nightHeading({ from: '2026-10-05T23:40:00Z', to: null, count: 0 })).toBe('Nothing has landed yet.');
  });
});

describe('beneathLabel', () => {
  it('says none at zero', () => {
    expect(beneathLabel(0)).toBe('none beneath');
  });

  it('says the count otherwise', () => {
    expect(beneathLabel(1)).toBe('1 beneath');
    expect(beneathLabel(4)).toBe('4 beneath');
  });
});
