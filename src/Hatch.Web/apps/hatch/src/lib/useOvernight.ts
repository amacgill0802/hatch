import { useCallback, useEffect, useState } from 'react';
import { getOvernight } from '../api/client';
import type { OvernightDto } from '../types';

/** How often the bar re-asks. Shared with useAttention.ts's own POLL_MS - see
    that file for why a minute and not the battery's two. */
export const POLL_MS = 60 * 1000;

/**
 * What the newest night holds for this reader, kept current without a reload.
 *
 * Shaped on useAttention.ts, and for the same reasons. Three things move it:
 *
 * - The first load.
 * - The poll above.
 * - `visibilitychange`, so a tab brought forward in the morning does not draw
 *   last night's answer - its timers stopped while it was backgrounded.
 *
 * Nothing here reports an error, the same as useAttention.ts: a read that
 * fails leaves the last answer drawn and says nothing at all.
 *
 * `reload` is exposed alongside the value for OvernightPage, which has to go
 * quiet the moment it marks the night seen, for everybody looking at it right
 * now, rather than waiting for the next poll.
 */
export function useOvernight(): { dto: OvernightDto | null; reload: () => Promise<void> } {
  const [dto, setDto] = useState<OvernightDto | null>(null);

  const load = useCallback(async () => {
    try {
      setDto(await getOvernight());
    } catch {
      // Deliberately silent - see the note above.
    }
  }, []);

  useEffect(() => {
    void load();

    const timer = setInterval(() => void load(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { dto, reload: load };
}
