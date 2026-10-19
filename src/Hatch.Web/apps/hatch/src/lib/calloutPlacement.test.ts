import { describe, expect, it } from 'vitest';
import { placeCallout } from '@hatch/ui/calloutPlacement';

/* This lives in apps/hatch because packages/ui has no test runner and
   `make test-web` only loops over apps/. The viewport throughout is 1000x800
   and the callout 200x100 (or a 1000x120 viewport for the two cases where a
   vertical clamp is the only way either side fits), so the arithmetic in each
   assertion is readable against those two numbers. */

const VIEWPORT = { width: 1000, height: 800 };
const CALLOUT = { width: 200, height: 100 };

describe('placeCallout', () => {
  it('places below, centred on the anchor, when it fits', () => {
    const anchor = { top: 100, left: 400, width: 40, height: 20 };
    expect(placeCallout(anchor, CALLOUT, VIEWPORT)).toEqual({ side: 'below', top: 128, left: 320 });
  });

  it('flips to above when below does not fit', () => {
    const anchor = { top: 700, left: 400, width: 40, height: 20 };
    expect(placeCallout(anchor, CALLOUT, VIEWPORT)).toEqual({ side: 'above', top: 592, left: 320 });
  });

  it('flips to below when above is preferred but does not fit', () => {
    const anchor = { top: 20, left: 400, width: 40, height: 20 };
    expect(placeCallout(anchor, CALLOUT, VIEWPORT, { prefer: 'above' })).toEqual({
      side: 'below',
      top: 48,
      left: 320,
    });
  });

  it('clamps at the left edge', () => {
    const anchor = { top: 100, left: 0, width: 20, height: 20 };
    expect(placeCallout(anchor, CALLOUT, VIEWPORT)).toEqual({ side: 'below', top: 128, left: 8 });
  });

  it('clamps at the right edge', () => {
    const anchor = { top: 100, left: 980, width: 20, height: 20 };
    expect(placeCallout(anchor, CALLOUT, VIEWPORT)).toEqual({ side: 'below', top: 128, left: 792 });
  });

  it('clamps at the top edge when neither side fits and above has more room', () => {
    const shortViewport = { width: 1000, height: 120 };
    const anchor = { top: 70, left: 400, width: 40, height: 20 };
    expect(placeCallout(anchor, CALLOUT, shortViewport)).toEqual({ side: 'above', top: 8, left: 320 });
  });

  it('clamps at the bottom edge when neither side fits and below has more room', () => {
    const shortViewport = { width: 1000, height: 120 };
    const anchor = { top: 30, left: 400, width: 40, height: 20 };
    expect(placeCallout(anchor, CALLOUT, shortViewport)).toEqual({ side: 'below', top: 12, left: 320 });
  });

  it('flips and clamps the cross axis together in a corner', () => {
    const anchor = { top: 750, left: 980, width: 20, height: 30 };
    expect(placeCallout(anchor, CALLOUT, VIEWPORT)).toEqual({ side: 'above', top: 642, left: 792 });
  });

  it('pins left to the margin when the callout is wider than the viewport allows', () => {
    const anchor = { top: 100, left: 400, width: 40, height: 20 };
    const wide = { width: 990, height: 100 };
    expect(placeCallout(anchor, wide, VIEWPORT).left).toBe(8);
  });
});
