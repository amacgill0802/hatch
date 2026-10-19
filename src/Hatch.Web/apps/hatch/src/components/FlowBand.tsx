import { Callout } from '@hatch/ui';
import type { useCallout } from '@hatch/ui';
import type { RefObject } from 'react';
import type { FlowBandKind } from '../lib/queue';

/**
 * The band across the lower half of a card, naming where it sits in the work
 * queue - `lib/queue.ts`'s `flowBand` decides which, if any, this is. Drawn
 * nothing with no band, the same as `WipBands` draws nothing with no section.
 *
 * With a `tip` the band is the anchor of a callout carrying `sentence` under
 * the band's own words. The callout sits inside the band, so the band's
 * `--callout-edge` colours it; nothing in here carries a `title`, which would
 * put a native tooltip over it.
 */
export function FlowBand({
  band,
  sentence,
  tip,
}: {
  band: { kind: FlowBandKind; words: string } | null;
  sentence?: string;
  tip?: ReturnType<typeof useCallout>;
}) {
  if (!band) return null;

  return (
    <div
      className={`hatch-flow-band hatch-flow-${band.kind}`}
      ref={tip ? (tip.anchorRef as RefObject<HTMLDivElement>) : undefined}
      {...tip?.hover}
    >
      {band.words}
      {tip && sentence && (
        <Callout id={tip.id} anchor={tip.anchorRef} open={tip.open} heading={band.words}>
          {sentence}
        </Callout>
      )}
    </div>
  );
}
