import type { MergeCheck } from '../types';
import { playbookFileWords } from '../lib/mergeCheck';

/**
 * The issue's merge checks name a playbook file its pull request rewrites: a
 * chip beside the pull request's, saying so.
 *
 * Information for a person already about to read the diff, not a problem the
 * loop or a person needs to fix - drawn whether the branch is clean or not.
 */
export function PlaybookFileChip({ checks }: { checks: readonly MergeCheck[] }) {
  const path = checks.find((c) => c.playbookFilePath)?.playbookFilePath;
  if (!path) return null;

  return <span className="hatch-chip hatch-chip-playbook-file">{playbookFileWords(path)}</span>;
}
