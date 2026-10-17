const MERGE_WORDS: Record<string, string> = {
  clean: 'clean',
  blocked: "blocked by the repository's rules",
  behind: 'behind the trunk',
  dirty: 'in conflict',
  unstable: 'unstable',
  draft: 'a draft',
};

const REVIEW_WORDS: Record<string, string> = {
  approved: 'review: approved',
  'changes-requested': 'review: changes requested',
  'review-required': 'review: required',
};

// Own keys only, so a value like `constructor` is unrecognised rather than a function.
const wordFor = (words: Record<string, string>, value: string | null | undefined) =>
  value != null && Object.hasOwn(words, value) ? words[value] : null;

/**
 * What the forge says of the issue's pull request, beside the chip that links
 * to it: whether it could be merged now and why not, then - where there is one -
 * what its reviews add up to.
 *
 * Draws nothing for an unknown or absent merge state, and with it the review
 * chip: an answer the forge has not given is not worth a chip. `none` and
 * anything unrecognised draw no review chip.
 */
export function PullRequestStateChips({
  mergeState,
  reviewDecision,
  headSha,
  readAt,
}: {
  mergeState: string | null | undefined;
  reviewDecision: string | null | undefined;
  headSha?: string | null;
  readAt?: string | null;
}) {
  const merge = wordFor(MERGE_WORDS, mergeState);
  if (merge === null) return null;

  const review = wordFor(REVIEW_WORDS, reviewDecision);
  const title = [headSha && `head ${headSha.slice(0, 7)}`, readAt && `read ${new Date(readAt).toLocaleString()}`]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <span className="hatch-chip" title={title || undefined}>
        The forge calls it {merge}
      </span>
      {review !== null && <span className="hatch-chip">{review}</span>}
    </>
  );
}
