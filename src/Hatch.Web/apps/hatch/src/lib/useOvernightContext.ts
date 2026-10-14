import { createContext, useContext } from 'react';
import type { OvernightDto } from '../types';

/**
 * What `useOvernight()` answers, read through context rather than a second
 * call to the hook - a second call would be a second request, polling on its
 * own schedule, that could land a beat apart from the first.
 *
 * The context and its hook rather than the component that provides them, in a
 * file of their own, for useAttentionContext.ts's own reason: a module that
 * exports both a component and a hook cannot be hot-reloaded, and the poll
 * lives in that provider's state. The provider is
 * components/OvernightProvider.tsx.
 */
export interface OvernightContextValue {
  dto: OvernightDto | null;
  reload: () => Promise<void>;
}

export const OvernightContext = createContext<OvernightContextValue | null>(null);

/** What a surface drawing on the newest night needs. Thrown outside the
    provider, exactly as `useAttentionContext()` is. */
export function useOvernightContext(): OvernightContextValue {
  const held = useContext(OvernightContext);
  if (!held) throw new Error('useOvernightContext outside OvernightProvider');
  return held;
}
