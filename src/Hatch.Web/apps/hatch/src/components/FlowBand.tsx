import type { FlowBandKind } from '../lib/queue';

/**
 * The band across the lower half of a card, naming where it sits in the work
 * queue - `lib/queue.ts`'s `flowBand` decides which, if any, this is. Drawn
 * nothing with no band, the same as `WipBands` draws nothing with no section.
 */
export function FlowBand({ band }: { band: { kind: FlowBandKind; words: string } | null }) {
  if (!band) return null;

  return <div className={`hatch-flow-band hatch-flow-${band.kind}`}>{band.words}</div>;
}
