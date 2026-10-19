import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from 'react';
import { createMenuBar } from './menuState';
import type { MenuBar as CalloutController } from './menuState';
import { placeCallout } from './calloutPlacement';
import { openSubject } from './calloutSubject';
import './Callout.css';

interface GroupValue {
  controller: CalloutController;
  suspended: boolean;
  subjects: Map<string, string>;
}

const GroupContext = createContext<GroupValue | null>(null);

function newController(): CalloutController {
  return createMenuBar({
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  });
}

/** Read at event time, not render time: a laptop that gains a mouse changes
    its answer, and the server has no answer at all. */
function canHover() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;
}

export interface CalloutGroupProps {
  /** Close whatever is open and keep every callout in the group closed until
      this clears. */
  suspended?: boolean;
  /** Which registered subject's callout is open, by the name its
      `useCallout(subject)` call registered - null while nothing is open,
      while `suspended`, or when the open anchor registered none. */
  onOpenChange?: (subject: string | null) => void;
  children: ReactNode;
}

/** Puts the callouts inside it on one controller, so at most one is open and
    moving from one anchor to the next switches at once. */
function CalloutGroup({ suspended = false, onOpenChange, children }: CalloutGroupProps) {
  const [controller] = useState(newController);
  const [subjects] = useState(() => new Map<string, string>());
  useEffect(() => {
    if (suspended) controller.close();
  }, [suspended, controller]);

  const openId = useSyncExternalStore(controller.subscribe, () => controller.openId, () => null);
  const subject = openSubject(openId, suspended, subjects);
  const report = useRef(onOpenChange);
  report.current = onOpenChange;
  useEffect(() => {
    report.current?.(subject);
  }, [subject]);

  return (
    <GroupContext.Provider value={{ controller, suspended, subjects }}>{children}</GroupContext.Provider>
  );
}

export interface UseCallout {
  /** Pass to `<Callout id>`. */
  id: string;
  open: boolean;
  /** Put on the element the callout is placed beside. */
  anchorRef: RefObject<HTMLElement | null>;
  /** For `aria-describedby` on the anchor: the callout's id while it is open. */
  describedBy: string | undefined;
  /** Spread on the element the callout is anchored to. */
  hover: {
    onPointerEnter: (event: ReactPointerEvent) => void;
    onPointerLeave: (event: ReactPointerEvent) => void;
  };
  /** Spread on the element that takes focus - the anchor itself, or another. */
  focus: {
    onFocus: (event: ReactFocusEvent) => void;
    onBlur: (event: ReactFocusEvent) => void;
  };
}

/**
 * Owns when one callout is open: a hover-capable pointer resting on the anchor,
 * or focus reaching it from the keyboard. Pointer-leave, focus leaving, Escape
 * and a press anywhere close it. A touch pointer never opens it, and neither
 * does a mouse click that merely focuses the anchor - `:focus-visible` is what
 * tells a keyboard arrival from a pointer one, and a modal handing focus back
 * to a clicked card must not pop the callout open over the board.
 *
 * All timing and one-open-per-group live in `menuState.ts`; this is the DOM
 * around it.
 */
export function useCallout(subject?: string): UseCallout {
  const group = useContext(GroupContext);
  const [own] = useState(() => (group ? null : newController()));
  const controller = group?.controller ?? own!;
  const suspended = group?.suspended ?? false;
  const id = useId();
  const anchorRef = useRef<HTMLElement>(null);
  const isOpen = useSyncExternalStore(
    controller.subscribe,
    () => controller.isOpen(id),
    () => false,
  );
  const open = isOpen && !suspended;

  useEffect(() => () => controller.close(id), [controller, id]);

  useEffect(() => {
    if (!group || subject === undefined) return;
    group.subjects.set(id, subject);
    return () => {
      group.subjects.delete(id);
    };
  }, [group, id, subject]);

  // Document-level: on the board the keyboard focus is on a different element
  // from the anchor, so neither element's own handlers would hear these.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') controller.close(id);
    };
    const onPointerDown = () => controller.close(id);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, controller, id]);

  return {
    id,
    open,
    anchorRef,
    describedBy: open ? id : undefined,
    hover: {
      onPointerEnter(event) {
        if (event.pointerType === 'touch') return;
        controller.pointerEnter(id, canHover());
      },
      onPointerLeave(event) {
        if (event.pointerType === 'touch') return;
        controller.pointerLeave(id);
      },
    },
    focus: {
      onFocus(event) {
        if (event.currentTarget.matches(':focus-visible')) controller.open(id);
      },
      onBlur(event) {
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) controller.close(id);
      },
    },
  };
}

export interface CalloutProps {
  /** From `useCallout().id`: the anchor's `aria-describedby` points at it. */
  id: string;
  /** The element to sit beside, from `useCallout().anchorRef`. */
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  heading: ReactNode;
  children?: ReactNode;
}

/**
 * A heading over a body, drawn beside its anchor while `open` and nothing at
 * all otherwise, so a board of hundreds of cards pays for none. It is placed by
 * `placeCallout` from the anchor's measured rect, its own measured size and
 * the viewport, and written straight onto the element rather than through
 * state, so placing it costs no second render.
 *
 * It carries no `title`: a tooltip the browser draws would sit over this one.
 */
function CalloutRoot({ id, anchor, open, heading, children }: CalloutProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = ref.current;
      const target = anchor.current;
      if (!el || !target) return;
      const rect = el.getBoundingClientRect();
      const placement = placeCallout(
        target.getBoundingClientRect(),
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight },
      );
      el.style.top = `${placement.top}px`;
      el.style.left = `${placement.left}px`;
      el.dataset.side = placement.side;
      el.style.visibility = 'visible';
    };
    place();
    // Capture, so a scroller of its own - a board column - counts as well as
    // the page.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor]);

  if (!open) return null;
  return (
    <div ref={ref} role="tooltip" id={id} className="hatch-callout">
      <div className="hatch-callout__heading">{heading}</div>
      <div className="hatch-callout__body">{children}</div>
    </div>
  );
}

export const Callout = Object.assign(CalloutRoot, { Group: CalloutGroup });
