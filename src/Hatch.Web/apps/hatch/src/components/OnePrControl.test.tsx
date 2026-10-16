import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnePrControl } from './OnePrControl';
import { onePrSaid } from '../lib/onePr';

const story = (over: Partial<Parameters<typeof OnePrControl>[0]['issue']> = {}) => ({
  key: 'HA-5',
  type: 'story' as const,
  onePr: false,
  onePrOwn: null,
  onePrFrom: null,
  ...over,
});

describe('onePrSaid', () => {
  it("says where a story's value came from", () => {
    expect(onePrSaid(story())).toBe("Off · the project's default");
    expect(onePrSaid(story({ onePr: true }))).toBe("On · the project's default");
    expect(onePrSaid(story({ onePr: true, onePrOwn: true }))).toBe('On · set on this story');
    expect(onePrSaid(story({ onePr: false, onePrOwn: false }))).toBe('Off · set on this story');
  });

  it('names the story a task inherited it from', () => {
    expect(onePrSaid({ type: 'task', onePr: true, onePrOwn: null, onePrFrom: 'HA-5' })).toBe('On · inherited from HA-5');
  });

  it('says so where nothing sits above', () => {
    expect(onePrSaid({ type: 'task', onePr: false, onePrOwn: null, onePrFrom: null })).toBe('Off · not under a story');
  });
});

describe('OnePrControl', () => {
  it('marks project default when the story carries no override of its own', () => {
    const html = renderToStaticMarkup(<OnePrControl issue={story({ onePr: true })} onChange={() => {}} />);

    expect(html).toContain('aria-label="Set HA-5&#x27;s one pull request setting"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Project default</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>On</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Off</);
    expect(html).toContain("On · the project&#x27;s default");
  });

  it('marks on and off for an override, and disables only the marked step', () => {
    const on = renderToStaticMarkup(<OnePrControl issue={story({ onePr: true, onePrOwn: true })} onChange={() => {}} />);
    expect(on).toMatch(/aria-pressed="true"[^>]*>On</);
    expect(on).toMatch(/class="hatch-one-pr-step here"[^>]*disabled=""[^>]*>On</);
    expect(on).not.toMatch(/disabled=""[^>]*>Off</);

    const off = renderToStaticMarkup(<OnePrControl issue={story({ onePr: false, onePrOwn: false })} onChange={() => {}} />);
    expect(off).toMatch(/aria-pressed="true"[^>]*>Off</);
    expect(off).toContain('Off · set on this story');
  });

  it('stops answering while a press is out', () => {
    const html = renderToStaticMarkup(<OnePrControl issue={story()} busy onChange={() => {}} />);

    expect(html).toContain('aria-busy="true"');
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });

  it('is offered whoever is looking - the write is open to an API key', () => {
    const html = renderToStaticMarkup(<OnePrControl issue={story()} onChange={() => {}} />);

    expect(html).toContain('<button');
  });
});
