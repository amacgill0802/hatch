/**
 * The button beside the work queue control that turns flow-viz on: pressed,
 * the board reads the queue alongside itself and bands every card with its
 * place in it (see `lib/flowViz.ts`, `lib/queue.ts`'s `flowBand`). Unpressed,
 * the board reads and draws exactly as it always has.
 *
 * Owns no state of its own - `on` and `onToggle` are the board's, the same
 * split `QueueControl` draws between the button and its modal.
 */
export function FlowVizControl({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`hatch-flow-viz-control${on ? ' active' : ''}`}
      aria-pressed={on}
      title="Band every card with its place in the work queue"
      aria-label="Band every card with its place in the work queue"
      onClick={onToggle}
    >
      <svg className="hatch-flow-viz-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4 13h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="currentColor" />
      </svg>
    </button>
  );
}
