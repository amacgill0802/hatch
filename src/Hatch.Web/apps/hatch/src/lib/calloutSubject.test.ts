import { describe, expect, it } from 'vitest';
import { openSubject } from '@hatch/ui/calloutSubject';

describe('openSubject', () => {
  it('is null when nothing is open', () => {
    expect(openSubject(null, false, new Map([['a', 'HA-1']]))).toBeNull();
  });

  it('gives the registered subject for the open id', () => {
    const subjects = new Map([['a', 'HA-1']]);
    expect(openSubject('a', false, subjects)).toBe('HA-1');
  });

  it('is null when the open id has no registered subject', () => {
    const subjects = new Map([['a', 'HA-1']]);
    expect(openSubject('b', false, subjects)).toBeNull();
  });

  it('is null while suspended, even for a registered, open id', () => {
    const subjects = new Map([['a', 'HA-1']]);
    expect(openSubject('a', true, subjects)).toBeNull();
  });
});
