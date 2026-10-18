/* Reading the playbook files the Playbooks page draws under "Files on the
   trunk": pure helpers only, so these run under plain Node with no DOM. */

import type { PlaybookFileDto, Project } from '../types';

/** The three states a file can be in, as a word a person reads. */
export function stateLabel(state: string): string {
  switch (state) {
    case 'parsed':
      return 'Parsed';
    case 'invalid':
      return 'Invalid';
    default:
      return 'Absent';
  }
}

/** What an absent file's card says - fixed text, not built from the fetched
    `path`, since every file on a given trunk shares the same path. */
export function absentSentence(trunk: string): string {
  return `no .hatch/playbooks.yaml on ${trunk}`;
}

/** The seven characters a card has room for. Deliberately not lib/revision.ts's
    shortSha: that one is gated on whether a build is stamped, a concept a
    file's sha has no equivalent of - it is always a full git sha. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

/** Every canonical some project's repository points at - the set a trunk's
    absent file is checked against before it is shown at all. */
export function boundCanonicals(projects: Project[]): Set<string> {
  return new Set(projects.flatMap((p) => p.repositories.map((r) => r.canonical)));
}

/** Drops an absent file for a canonical no project points at - nothing to read
    there is a fact about every trunk, not about this one. A parsed or invalid
    file is kept regardless: either already says something worth a card. */
export function visibleFiles(files: PlaybookFileDto[], bound: Set<string>): PlaybookFileDto[] {
  return files.filter((f) => f.state !== 'absent' || bound.has(f.canonical));
}

/** By canonical, then by trunk on a tie - the order the API already answers
    in, kept here so the page does not depend on that staying true. */
export function sortedFiles(files: PlaybookFileDto[]): PlaybookFileDto[] {
  return [...files].sort(
    (a, b) => a.canonical.localeCompare(b.canonical) || a.trunk.localeCompare(b.trunk),
  );
}

/** Every project whose primary repository resolves to this file's
    `(canonical, trunk)` pair. `files` is the complete, unfiltered list from
    `getPlaybookFiles()` - the ambiguous-trunk check below needs to see every
    loaded file for a canonical, not just the ones a different, unrelated
    filter happened to keep visible. */
export function projectsReading(
  file: PlaybookFileDto,
  projects: Project[],
  files: PlaybookFileDto[],
): Project[] {
  return projects.filter((p) => {
    if (!p.repoSourced) return false;
    const primary = p.repositories[0];
    if (!primary || primary.canonical !== file.canonical) return false;
    if (primary.baseBranch !== null) return primary.baseBranch === file.trunk;
    return files.filter((f) => f.canonical === primary.canonical).length === 1;
  });
}
