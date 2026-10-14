import { describe, expect, it } from 'vitest';
import { beneathLabel, nightHeading, overnightEmptyWords, overnightLabel, overnightTone } from './overnight';

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

describe('overnightTone', () => {
  it('rests when nothing is unseen', () => {
    expect(overnightTone({ from: null, to: null, count: 0, rows: [], unseen: 0 })).toBe('rest');
  });

  it('rests before the first answer', () => {
    // Not a third state. "We have not asked yet" and "nothing is waiting" are
    // the same thing to draw, the same as attentionTone's own note.
    expect(overnightTone(null)).toBe('rest');
  });

  it('asks as soon as one row is unseen', () => {
    expect(overnightTone({ from: null, to: null, count: 1, rows: [], unseen: 1 })).toBe('asking');
  });

  it('asks the same way at a larger count - tone is a boolean fact, not a threshold', () => {
    expect(overnightTone({ from: null, to: null, count: 9, rows: [], unseen: 9 })).toBe('asking');
  });
});

describe('overnightLabel', () => {
  it('says nothing is new at zero unseen', () => {
    expect(overnightLabel({ from: null, to: null, count: 0, rows: [], unseen: 0 })).toBe(
      'Nothing new since you last read the overnight page',
    );
  });

  it('says nothing is new before the first answer', () => {
    expect(overnightLabel(null)).toBe('Nothing new since you last read the overnight page');
  });

  it('says issue in the singular at exactly one unseen', () => {
    expect(overnightLabel({ from: null, to: null, count: 1, rows: [], unseen: 1 })).toBe(
      '1 issue landed overnight, unread',
    );
  });

  it('pluralises otherwise', () => {
    expect(overnightLabel({ from: null, to: null, count: 3, rows: [], unseen: 3 })).toBe(
      '3 issues landed overnight, unread',
    );
  });
});
