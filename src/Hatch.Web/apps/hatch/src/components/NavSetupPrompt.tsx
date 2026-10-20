import { useState } from 'react';
import { useMenuOpen } from '@hatch/ui';
import { setupPrompt, stampedSetupGuide } from '../lib/setupPrompt';
import { CopyIcon } from './CopyIcon';

/**
 * The gear's "Setup Prompt" row: one press puts the line a newcomer pastes
 * into Claude on the clipboard, so bringing somebody on is a copy and a send.
 * The address comes from the build (see lib/setupPrompt.ts); a build stamped
 * with none draws no row.
 */
export function NavSetupPrompt() {
  return <SetupPromptItem prompt={setupPrompt(stampedSetupGuide())} />;
}

/**
 * A plain button wearing the row's class rather than a `Menu.Item`, because a
 * `Menu.Item` closes the panel on press, and the panel is where "Copied" is
 * said. A copy that closes the panel and says nothing cannot be told apart
 * from one that did nothing - the reason `Command` speaks after a press too.
 *
 * Not drawn where the clipboard API is absent: there it would be a button
 * that silently does nothing, and the line is on the Docs page to be
 * selected by hand.
 */
export function SetupPromptItem({ prompt }: { prompt: string | null }) {
  const open = useMenuOpen();
  const [said, setSaid] = useState<string | null>(null);

  // "Copied" is about this opening of the panel. Closing it clears the word,
  // adjusted during render the way Command resets on a changed command, so a
  // reopened panel never claims a copy from an earlier visit.
  if (!open && said !== null) setSaid(null);

  // Read at render rather than held: whether this document may reach the
  // clipboard is a fact about the page, and it does not change under us.
  const canCopy = typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';
  if (prompt === null || !canCopy) return null;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSaid('Copied');
    } catch {
      setSaid('Copy refused');
    }
  }

  return (
    <button type="button" className="hatch-menu__item hatch-setup-prompt" title={prompt} onClick={() => void copy(prompt)}>
      <CopyIcon className="hatch-setup-prompt__icon" />
      <span>Setup Prompt</span>
      {said !== null && (
        <span className="hatch-setup-prompt__said" role="status">
          {said}
        </span>
      )}
    </button>
  );
}
