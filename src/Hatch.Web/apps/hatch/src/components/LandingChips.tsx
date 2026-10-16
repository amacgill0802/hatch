import type { Landing } from '../types';

/**
 * A repository landing: a chip beside the pull request's, one per repository
 * whose work has reached its trunk. Links nowhere - the server never parses a
 * remote into a forge URL.
 */
export function LandingChips({ landings }: { landings: readonly Landing[] | undefined }) {
  return (
    <>
      {(landings ?? []).map((l) => (
        <span key={l.canonical} className="hatch-chip hatch-chip-landing" title={`${l.remote} @ ${l.sha}`}>
          Landed on {l.trunk} at {l.sha.slice(0, 7)}
        </span>
      ))}
    </>
  );
}
