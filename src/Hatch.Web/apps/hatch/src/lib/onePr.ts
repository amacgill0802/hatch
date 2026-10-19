import type { OnePrSetting } from '../components/OnePrControl';
import type { Issue, IssueType } from '../types';

/** What the story is doing right now and why, in a sentence - the answer to
    "is this one PR" that the control gives without anybody pressing anything. */
export function onePrSaid(issue: Pick<Issue, 'type' | 'onePr' | 'onePrOwn' | 'onePrFrom'>): string {
  const value = issue.onePr ? 'On' : 'Off';
  if (issue.onePrOwn !== null) return `${value} · set on this story`;
  if (issue.onePrFrom) return `${value} · inherited from ${issue.onePrFrom}`;
  return issue.type === 'story' ? `${value} · the project's default` : `${value} · not under a story`;
}

/** What a filing sends for `onePr`: the setting for a story, nothing for any
    other type - the server refuses the field on anything that is not one. */
export function onePrToFile(type: IssueType, setting: OnePrSetting): OnePrSetting | undefined {
  return type === 'story' ? setting : undefined;
}
