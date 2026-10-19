/* Dependency edges plus boxes in, path data out. It is the whole of HA-941's
   smooth-curve-no-corners rule stated as geometry rather than as a hope, and
   it is pure - rectangles and edges in, strings out - so both halves are
   tested rather than squinted at. Nothing here draws; the component that
   does owns colour and translation.

   Edges out of one card leave as one stroke (its exit trunk) and then fan
   out; edges into one card converge into one stroke (its entry trunk)
   before reaching it, ending in an arrowhead. A hub carries one flow, so a
   card that is an end of both an upstream and a downstream edge gets a
   trunk, a hub and a head per flow it is an end of - the two colours cannot
   share a stroke. Every curve touching a hub leaves or arrives along that
   hub's one tangent, the outward horizontal from the card it belongs to, so
   every control point adjacent to a hub takes that hub's own y verbatim -
   which is what keeps a trunk and the spans meeting it smooth rather than
   cornered. */

import type { ChainEdge, Flow } from './chains';

/** A card's box in the overlay's own frame - origin at the board's top-left
    corner. The component translates; nothing here reads the DOM. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Stroke {
  d: string;
  flow: Flow;
}

export interface Bundle {
  /** The trunks and spans, as cubic beziers. */
  strokes: Stroke[];
  /** One filled arrowhead per card that waits, per flow. */
  heads: Stroke[];
}

/** How far outside a card's own box a hub sits, in the overlay's own pixel
    units - the gap a trunk crosses before fanning out into spans. */
const GUTTER = 16;

/** The least a span's control point reaches out from its own hub. Without
    this floor, a same-column pair of hubs (zero horizontal distance) or a
    too-close pair drives the control point onto the hub itself, the tangent
    collapses to zero, and the curve degenerates exactly where it must not. */
const MIN_PULL = 24;

/** How much of a span's own hub-to-hub distance its control points reach
    out, before the MIN_PULL floor is applied. */
const PULL_FRACTION = 0.5;

/** The arrowhead's tip-to-base length, in the overlay's own pixel units. */
const ARROW_LENGTH = 8;

/** The arrowhead's base width, in the overlay's own pixel units. */
const ARROW_WIDTH = 6;

/** Decimal places kept in every coordinate a `d` carries, so a one-pixel
    scroll does not rewrite every path with sixteen digits. */
const PRECISION = 1;

function round(n: number): number {
  const factor = 10 ** PRECISION;
  return Math.round(n * factor) / factor;
}

function point(x: number, y: number): string {
  return `${round(x)},${round(y)}`;
}

/** A straight run, still emitted as a cubic - both control points sit on
    their own endpoints - to satisfy "cubic beziers only" without curving. */
function straight(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${point(x1, y1)} C ${point(x1, y1)} ${point(x2, y2)} ${point(x2, y2)}`;
}

/** A closed triangle built from three straight cubics, so an arrowhead is
    straight-edged without ever using `L` or `Z`. */
function trianglePath(tipX: number, tipY: number, b1x: number, b1y: number, b2x: number, b2y: number): string {
  return (
    `M ${point(tipX, tipY)} ` +
    `C ${point(tipX, tipY)} ${point(b1x, b1y)} ${point(b1x, b1y)} ` +
    `C ${point(b1x, b1y)} ${point(b2x, b2y)} ${point(b2x, b2y)} ` +
    `C ${point(b2x, b2y)} ${point(tipX, tipY)} ${point(tipX, tipY)}`
  );
}

function centerX(box: Box): number {
  return box.left + box.width / 2;
}

type Direction = 'exit' | 'entry';

/** The outward sign from the card a hub belongs to: +1 for a hub sitting to
    the card's right, -1 for one sitting to its left. */
type Side = 1 | -1;

interface Hub {
  flow: Flow;
  direction: Direction;
  /** Vertically, the card's own centre; horizontally, out past GUTTER. */
  x: number;
  y: number;
  side: Side;
  /** Where the card's own edge sits, on the hub's own side - the trunk's
      card-side endpoint, and the arrowhead's tip. */
  cardEdgeX: number;
}

function hubKey(card: string, flow: Flow, direction: Direction): string {
  return `${card}|${flow}|${direction}`;
}

/** One hub per (card, flow, direction) a surviving edge touches, sided by
    where the other ends of its own edges mostly lie - ties go right for an
    exit hub, left for an entry hub, stated in counts rather than left to
    judgment: among the edges a hub serves, count how many other ends sit
    strictly left and strictly right of this card's own centre; an equal
    centre counts toward neither. */
function buildHubs(drawable: readonly ChainEdge[], boxes: ReadonlyMap<string, Box>): Map<string, Hub> {
  interface Group {
    card: string;
    flow: Flow;
    direction: Direction;
    otherXs: number[];
  }
  const groups = new Map<string, Group>();

  const touch = (card: string, flow: Flow, direction: Direction, otherX: number): void => {
    const key = hubKey(card, flow, direction);
    const group = groups.get(key);
    if (group) group.otherXs.push(otherX);
    else groups.set(key, { card, flow, direction, otherXs: [otherX] });
  };

  for (const edge of drawable) {
    touch(edge.from, edge.flow, 'exit', centerX(boxes.get(edge.to)!));
    touch(edge.to, edge.flow, 'entry', centerX(boxes.get(edge.from)!));
  }

  const hubs = new Map<string, Hub>();
  for (const [key, group] of groups) {
    const box = boxes.get(group.card)!;
    const cx = centerX(box);
    let left = 0;
    let right = 0;
    for (const otherX of group.otherXs) {
      if (otherX < cx) left++;
      else if (otherX > cx) right++;
    }
    // Right wins ties and the zero-strict-count case for an exit hub; left
    // wins both for an entry hub.
    const side: Side = group.direction === 'exit' ? (left > right ? -1 : 1) : right > left ? 1 : -1;
    const y = box.top + box.height / 2;
    const cardEdgeX = side === 1 ? box.left + box.width : box.left;
    const x = side === 1 ? box.left + box.width + GUTTER : box.left - GUTTER;
    hubs.set(key, { flow: group.flow, direction: group.direction, x, y, side, cardEdgeX });
  }
  return hubs;
}

/** One per occupied hub: from the card's own edge out to an exit hub, or
    from an entry hub in to the card's own edge. */
function trunkStroke(hub: Hub): Stroke {
  const d =
    hub.direction === 'exit'
      ? straight(hub.cardEdgeX, hub.y, hub.x, hub.y)
      : straight(hub.x, hub.y, hub.cardEdgeX, hub.y);
  return { d, flow: hub.flow };
}

/** One per surviving edge: from the source's exit hub to the target's entry
    hub. Each control point reaches out from its own hub along that hub's
    own outward sign, by a fraction of the hub-to-hub distance floored at
    MIN_PULL - which is what keeps the same-column loop and the
    closer-than-gutter span alike non-degenerate, with no branch for either. */
function spanStroke(edge: ChainEdge, hubs: ReadonlyMap<string, Hub>): Stroke {
  const src = hubs.get(hubKey(edge.from, edge.flow, 'exit'))!;
  const tgt = hubs.get(hubKey(edge.to, edge.flow, 'entry'))!;
  const pull = Math.max(Math.abs(tgt.x - src.x) * PULL_FRACTION, MIN_PULL);
  const c1x = src.x + src.side * pull;
  const c2x = tgt.x + tgt.side * pull;
  const d = `M ${point(src.x, src.y)} C ${point(c1x, src.y)} ${point(c2x, tgt.y)} ${point(tgt.x, tgt.y)}`;
  return { d, flow: edge.flow };
}

/** One per entry hub: a filled triangle whose tip sits on the waiting
    card's own edge and whose axis runs along that hub's tangent, so it
    lines up with the trunk that feeds it. */
function headStroke(hub: Hub): Stroke {
  const inward = (-hub.side) as Side;
  const baseX = hub.cardEdgeX - inward * ARROW_LENGTH;
  const d = trianglePath(hub.cardEdgeX, hub.y, baseX, hub.y - ARROW_WIDTH / 2, baseX, hub.y + ARROW_WIDTH / 2);
  return { d, flow: hub.flow };
}

/**
 * @param edges Every edge a hovered chain carries.
 * @param boxes Every card currently drawn on the board, keyed by its key.
 */
export function bundle(edges: readonly ChainEdge[], boxes: ReadonlyMap<string, Box>): Bundle {
  const drawable = edges.filter((edge) => boxes.has(edge.from) && boxes.has(edge.to));
  if (drawable.length === 0) return { strokes: [], heads: [] };

  const hubs = buildHubs(drawable, boxes);

  const strokes: Stroke[] = [];
  for (const hub of hubs.values()) strokes.push(trunkStroke(hub));
  for (const edge of drawable) strokes.push(spanStroke(edge, hubs));

  const heads: Stroke[] = [];
  for (const hub of hubs.values()) if (hub.direction === 'entry') heads.push(headStroke(hub));

  return { strokes, heads };
}
