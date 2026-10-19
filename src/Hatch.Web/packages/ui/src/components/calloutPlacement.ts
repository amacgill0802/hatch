/* The arithmetic that decides where a callout goes, with no React and no DOM
   in it so a node test can drive it. It reads no window and no document: the
   anchor, the callout size and the viewport all arrive as plain numbers, in
   CSS pixels relative to the viewport - what getBoundingClientRect returns -
   so the component that calls this applies the result to a position: fixed
   element unchanged. */

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type CalloutSide = 'above' | 'below';

export interface PlaceOptions {
  prefer?: CalloutSide;
  gap?: number;
  margin?: number;
}

export interface Placement {
  side: CalloutSide;
  top: number;
  left: number;
}

// The lower bound wins when the range is inverted (the callout is wider, or
// taller, than the viewport less twice the margin) - never a negative upper
// bound - so min is applied last.
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function placeCallout(anchor: Box, size: Size, viewport: Size, options?: PlaceOptions): Placement {
  const gap = options?.gap ?? 8;
  const margin = options?.margin ?? 8;
  const prefer = options?.prefer ?? 'below';

  const belowTop = anchor.top + anchor.height + gap;
  const belowFits = belowTop + size.height <= viewport.height - margin;
  const aboveTop = anchor.top - gap - size.height;
  const aboveFits = aboveTop >= margin;

  const left = clamp(
    anchor.left + anchor.width / 2 - size.width / 2,
    margin,
    viewport.width - size.width - margin,
  );

  let side: CalloutSide;
  let top: number;

  const otherFits = prefer === 'below' ? aboveFits : belowFits;
  const preferFits = prefer === 'below' ? belowFits : aboveFits;

  if (preferFits) {
    side = prefer;
    top = prefer === 'below' ? belowTop : aboveTop;
  } else if (otherFits) {
    side = prefer === 'below' ? 'above' : 'below';
    top = side === 'below' ? belowTop : aboveTop;
  } else {
    const roomAbove = anchor.top;
    const roomBelow = viewport.height - anchor.top - anchor.height;
    side = roomBelow > roomAbove ? 'below' : 'above';
    top = clamp(side === 'below' ? belowTop : aboveTop, margin, viewport.height - size.height - margin);
  }

  return { side, top, left };
}
