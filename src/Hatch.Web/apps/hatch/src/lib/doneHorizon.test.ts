import { describe, expect, it } from 'vitest';
import { doneHorizonPhrase } from './doneHorizon';

describe('doneHorizonPhrase', () => {
  it('says one hour in the singular', () => {
    expect(doneHorizonPhrase(1)).toBe('1 hour');
  });

  it('stays in hours below a full day', () => {
    expect(doneHorizonPhrase(23)).toBe('23 hours');
  });

  it('says one day at exactly 24 hours', () => {
    expect(doneHorizonPhrase(24)).toBe('1 day');
  });

  it('says two days at 48 hours', () => {
    expect(doneHorizonPhrase(48)).toBe('2 days');
  });

  it('stays in hours when not evenly divisible by 24', () => {
    expect(doneHorizonPhrase(36)).toBe('36 hours');
  });

  it('says seven days at 168 hours', () => {
    expect(doneHorizonPhrase(168)).toBe('7 days');
  });
});
