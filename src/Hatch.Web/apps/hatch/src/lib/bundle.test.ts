import { describe, expect, it } from 'vitest';
import { bundle, type Box } from './bundle';
import type { ChainEdge } from './chains';

const NUM = '-?\\d+(?:\\.\\d+)?';
const POINT = `${NUM},${NUM}`;
// A `d` that is exactly one `M` followed by one or more full `C` triples -
// no `L`, `H`, `V`, `Z`, and no bare numbers left over.
const CUBICS_ONLY = new RegExp(`^M ${POINT}(?: C ${POINT} ${POINT} ${POINT})+$`);

const box = (over: Partial<Box> = {}): Box => ({ left: 0, top: 0, width: 100, height: 40, ...over });

const edge = (from: string, to: string, flow: ChainEdge['flow'] = 'upstream'): ChainEdge => ({ from, to, flow });

/** Every `x,y` token in a `d`, command letters stripped - the test has no
    path-parsing library to reach for, and `d` only ever carries `M`/`C`. */
function points(d: string): { x: number; y: number }[] {
  return d
    .split(/\s+/)
    .filter((token) => /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(token))
    .map((token) => {
      const [x, y] = token.split(',').map(Number);
      return { x, y };
    });
}

describe('bundle', () => {
  it('drops an edge with a missing box and returns empty arrays for no edges', () => {
    const boxes = new Map<string, Box>([['A', box()]]);
    expect(bundle([edge('A', 'B')], boxes)).toEqual({ strokes: [], heads: [] });
    expect(bundle([], boxes)).toEqual({ strokes: [], heads: [] });
  });

  it('emits only M followed by C commands, rounded, never NaN', () => {
    const boxes = new Map<string, Box>([
      ['a', box({ left: 0, top: 0 })],
      ['b', box({ left: 300, top: 0 })],
      ['c', box({ left: 300, top: 120 })],
    ]);
    const { strokes, heads } = bundle([edge('a', 'b'), edge('a', 'c'), edge('c', 'b', 'downstream')], boxes);
    expect(strokes.length).toBeGreaterThan(0);
    expect(heads.length).toBeGreaterThan(0);
    for (const stroke of [...strokes, ...heads]) {
      expect(stroke.d).toMatch(CUBICS_ONLY);
    }
  });

  it('bundles three edges into one card into one entry trunk and one head', () => {
    const boxes = new Map<string, Box>([
      ['hub', box({ left: 300, top: 100 })],
      ['a', box({ left: 0, top: 0 })],
      ['b', box({ left: 0, top: 100 })],
      ['c', box({ left: 0, top: 200 })],
    ]);
    const { strokes, heads } = bundle([edge('a', 'hub'), edge('b', 'hub'), edge('c', 'hub')], boxes);
    // 3 exit trunks (a, b, c) + 1 entry trunk (hub) + 3 spans = 7.
    expect(strokes).toHaveLength(7);
    expect(heads).toHaveLength(1);
    expect(heads[0].flow).toBe('upstream');
  });

  it('bundles three edges out of one card into one exit trunk', () => {
    const boxes = new Map<string, Box>([
      ['hub', box({ left: 0, top: 100 })],
      ['a', box({ left: 300, top: 0 })],
      ['b', box({ left: 300, top: 100 })],
      ['c', box({ left: 300, top: 200 })],
    ]);
    const { strokes, heads } = bundle([edge('hub', 'a'), edge('hub', 'b'), edge('hub', 'c')], boxes);
    // 1 exit trunk (hub) + 3 entry trunks (a, b, c) + 3 spans = 7.
    expect(strokes).toHaveLength(7);
    expect(heads).toHaveLength(3);
  });

  it('gives a card that is an end of both flows one trunk and one head per flow', () => {
    const boxes = new Map<string, Box>([
      ['m', box({ left: 300, top: 100 })],
      ['p1', box({ left: 0, top: 0 })],
      ['p2', box({ left: 0, top: 200 })],
    ]);
    const { strokes, heads } = bundle([edge('p1', 'm', 'upstream'), edge('p2', 'm', 'downstream')], boxes);
    // p1 exit + p2 exit + m's two entry trunks (one per flow) + 2 spans = 6.
    expect(strokes).toHaveLength(6);
    expect(heads).toHaveLength(2);
    expect(heads.map((h) => h.flow).sort()).toEqual(['downstream', 'upstream']);
  });

  it('keeps a trunk and the span meeting it collinear through their shared hub', () => {
    const boxes = new Map<string, Box>([
      ['a', box({ left: 0, top: 0 })],
      ['b', box({ left: 300, top: 60 })],
    ]);
    const { strokes } = bundle([edge('a', 'b')], boxes);
    const span = strokes.find((s) => {
      const p = points(s.d);
      return p.length === 4 && p[0].x !== p[1].x; // the span is the one whose first control point actually pulls away
    })!;
    const spanPoints = points(span.d);
    const srcHub = spanPoints[0];
    const srcControl = spanPoints[1];

    const srcTrunk = strokes.find((s) => {
      const p = points(s.d);
      const end = p[p.length - 1];
      return end.x === srcHub.x && end.y === srcHub.y;
    })!;
    const trunkControl = points(srcTrunk.d)[2];

    expect(trunkControl.y).toBe(srcHub.y);
    expect(srcControl.y).toBe(srcHub.y);
  });

  it('flips a hub to the other side when the other ends move across it', () => {
    const xBox = box({ left: 300, top: 0 });
    const sideOf = (otherLeft: number): 'left' | 'right' => {
      const boxes = new Map<string, Box>([
        ['x', xBox],
        ['other', box({ left: otherLeft, top: 0 })],
      ]);
      const { strokes } = bundle([edge('x', 'other')], boxes);
      const xTrunk = strokes.find((s) => {
        const p = points(s.d);
        return p[0].x === xBox.left || p[0].x === xBox.left + xBox.width;
      })!;
      const p = points(xTrunk.d);
      return p[2].x > p[0].x ? 'right' : 'left';
    };
    expect(sideOf(600)).toBe('right');
    expect(sideOf(0)).toBe('left');
  });

  it("points a head's tip at the waiting card's own edge, along its hub's tangent", () => {
    const boxes = new Map<string, Box>([
      ['a', box({ left: 0, top: 0 })],
      ['b', box({ left: 300, top: 40, height: 60 })],
    ]);
    const { heads } = bundle([edge('a', 'b')], boxes);
    expect(heads).toHaveLength(1);
    const pts = points(heads[0].d);
    const tip = pts[0];
    const base1 = pts[2];
    const base2 = pts[5];
    const bBox = boxes.get('b')!;

    expect(tip.x === bBox.left || tip.x === bBox.left + bBox.width).toBe(true);
    expect(tip.y).toBeCloseTo(bBox.top + bBox.height / 2, 1);
    expect(base1.x).toBe(base2.x);
    expect((base1.y + base2.y) / 2).toBeCloseTo(tip.y, 1);
  });

  it('keeps the same-column loop and an overlapping-box span finite and non-empty', () => {
    const sameColumn = new Map<string, Box>([
      ['top', box({ left: 100, top: 0 })],
      ['bottom', box({ left: 100, top: 200 })],
    ]);
    const { strokes: loopStrokes } = bundle([edge('top', 'bottom')], sameColumn);
    expect(loopStrokes.length).toBeGreaterThan(0);
    for (const stroke of loopStrokes) expect(stroke.d).toMatch(CUBICS_ONLY);

    const overlapping = new Map<string, Box>([
      ['x', box({ left: 100, top: 0 })],
      ['y', box({ left: 120, top: 10 })],
    ]);
    const { strokes: overlapStrokes } = bundle([edge('x', 'y')], overlapping);
    expect(overlapStrokes.length).toBeGreaterThan(0);
    for (const stroke of overlapStrokes) expect(stroke.d).toMatch(CUBICS_ONLY);
  });
});
