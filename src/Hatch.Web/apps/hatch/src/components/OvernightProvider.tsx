import type { ReactNode } from 'react';
import { useOvernight } from '../lib/useOvernight';
import { OvernightContext } from '../lib/useOvernightContext';

/**
 * Runs `useOvernight()` once, for the bar and the page to share.
 *
 * Sits above <Routes>, beside <AttentionProvider> (App.tsx), so the poll
 * outlives navigation between the two surfaces that read it.
 * `lib/useOvernight.ts` itself is unchanged - it only ever runs inside this
 * one component now.
 */
export function OvernightProvider({ children }: { children: ReactNode }) {
  const { dto, reload } = useOvernight();

  return <OvernightContext.Provider value={{ dto, reload }}>{children}</OvernightContext.Provider>;
}
