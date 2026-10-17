import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PullRequestStateChips } from './PullRequestStateChips';

const render = (mergeState: string | null | undefined, reviewDecision: string | null | undefined = 'none') =>
  renderToStaticMarkup(<PullRequestStateChips mergeState={mergeState} reviewDecision={reviewDecision} />);

describe('PullRequestStateChips', () => {
  it.each([
    ['clean', 'The forge calls it clean'],
    ['blocked', "The forge calls it blocked by the repository&#x27;s rules"],
    ['behind', 'The forge calls it behind the trunk'],
    ['dirty', 'The forge calls it in conflict'],
    ['unstable', 'The forge calls it unstable'],
    ['draft', 'The forge calls it a draft'],
  ])('says %s as one sentence', (state, sentence) => {
    expect(render(state)).toContain(sentence);
  });

  it.each(['unknown', null, undefined, 'something-new', 'constructor'])('draws nothing for merge state %s', (state) => {
    expect(render(state, 'approved')).toBe('');
  });

  it.each([
    ['approved', 'review: approved'],
    ['changes-requested', 'review: changes requested'],
    ['review-required', 'review: required'],
  ])('draws a second chip for review decision %s', (decision, sentence) => {
    const html = render('clean', decision);

    expect(html).toContain(sentence);
    expect(html.match(/hatch-chip/g)).toHaveLength(2);
  });

  it.each(['none', null, undefined, 'something-new', 'constructor'])('draws no review chip for %s', (decision) => {
    const html = render('clean', decision);

    expect(html).not.toContain('review:');
    expect(html.match(/hatch-chip/g)).toHaveLength(1);
  });

  it('puts the head sha, shortened, in the merge chip title', () => {
    const html = renderToStaticMarkup(
      <PullRequestStateChips mergeState="clean" reviewDecision="none" headSha="0123456789abcdef" />,
    );

    expect(html).toContain('head 0123456');
    expect(html).not.toContain('0123456789');
  });
});
