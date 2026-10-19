import { describe, expect, it } from 'vitest';
import {
  briefLimitDraft,
  briefLimitRequest,
  budgetDraft,
  budgetRequest,
  deniedToolsDraft,
  deniedToolsRequest,
  fileRowLabel,
  isOverridden,
  isReviewPlaybook,
  isUncheckedEdit,
  matchesProjectFilter,
  playbookLabel,
  projectLabel,
  shadowedByFile,
  transitionLabel,
} from './playbooks';
import type { IssueType } from '../types';

const move = { fromStatusId: 3, toStatusId: 4, fromStatusName: 'In Progress', toStatusName: 'In Review' };
const review = { fromStatusId: 4, toStatusId: 4, fromStatusName: 'In Review', toStatusName: 'In Review' };

describe('isReviewPlaybook', () => {
  it('is a row whose two ends are the same column', () => {
    expect(isReviewPlaybook(review)).toBe(true);
  });

  it('is not an ordinary move', () => {
    expect(isReviewPlaybook(move)).toBe(false);
  });
});

describe('transitionLabel', () => {
  it('names an ordinary move by its two ends', () => {
    expect(transitionLabel(move)).toBe('In Progress to In Review');
  });

  it('names the review playbook by its column and what it is for', () => {
    expect(transitionLabel(review)).toBe('In Review review');
  });
});

describe('the budget field', () => {
  it('shows no cap as a blank box', () => {
    expect(budgetDraft(null)).toBe('');
  });

  it('shows a held budget as its number', () => {
    expect(budgetDraft(3)).toBe('3');
  });

  it('trims the field for the wire', () => {
    expect(budgetRequest(' 3 ')).toBe('3');
  });

  it('a blank field clears the budget', () => {
    expect(budgetRequest('  ')).toBe('');
  });
});

describe('the brief limit field', () => {
  it('shows no cap as a blank box', () => {
    expect(briefLimitDraft(null)).toBe('');
  });

  it('shows a held brief limit as its number', () => {
    expect(briefLimitDraft(3)).toBe('3');
  });

  it('trims the field for the wire', () => {
    expect(briefLimitRequest(' 3 ')).toBe('3');
  });

  it('a blank field clears the brief limit', () => {
    expect(briefLimitRequest('  ')).toBe('');
  });
});

describe('the denied tools field', () => {
  it('shows no rules as a blank box', () => {
    expect(deniedToolsDraft([])).toBe('');
  });

  it('shows each rule on its own line', () => {
    expect(deniedToolsDraft(['Bash', 'WebFetch'])).toBe('Bash\nWebFetch');
  });

  it('a blank field clears the rules', () => {
    expect(deniedToolsRequest('')).toEqual([]);
  });

  it('splits the field into rules for the wire', () => {
    expect(deniedToolsRequest('Bash\nWebFetch')).toEqual(['Bash', 'WebFetch']);
  });

  it('drops blank lines and trims the rest', () => {
    expect(deniedToolsRequest('Bash\n\n  WebFetch  \n')).toEqual(['Bash', 'WebFetch']);
  });
});

describe('projectLabel', () => {
  it('reads a board-wide row as "All projects"', () => {
    expect(projectLabel({ projectKey: null, projectName: null })).toBe('All projects');
  });

  it('reads a project row as "KEY — Name"', () => {
    expect(projectLabel({ projectKey: 'AB', projectName: 'Alphabet' })).toBe('AB — Alphabet');
  });
});

describe('playbookLabel', () => {
  it('reads a board-wide row as "board-wide"', () => {
    expect(playbookLabel({ projectKey: null })).toBe('board-wide');
  });

  it("reads a project row as the project's own", () => {
    expect(playbookLabel({ projectKey: 'AER' })).toBe("AER's own");
  });
});

describe('fileRowLabel', () => {
  it('names the trunk and the short sha', () => {
    expect(fileRowLabel({ trunk: 'main', sha: 'abcdef0123456789' })).toBe(
      '.hatch/playbooks.yaml on main at abcdef0',
    );
  });
});

describe('shadowedByFile', () => {
  const boardRow = { fromStatusId: 3, toStatusId: 4, shape: 'any' as const, types: ['bug', 'task'] as IssueType[] };

  it('is shadowed by a file row with the same ends, shape and types in a different order', () => {
    const fileRows = [
      { fromStatusId: 3, toStatusId: 4, shape: 'any' as const, types: ['task', 'bug'] as IssueType[] },
    ];

    expect(shadowedByFile(boardRow, fileRows)).toBe(true);
  });

  it('is not shadowed by a different toStatusId', () => {
    const fileRows = [
      { fromStatusId: 3, toStatusId: 5, shape: 'any' as const, types: ['bug', 'task'] as IssueType[] },
    ];

    expect(shadowedByFile(boardRow, fileRows)).toBe(false);
  });

  it('is not shadowed by an extra type', () => {
    const fileRows = [
      { fromStatusId: 3, toStatusId: 4, shape: 'any' as const, types: ['bug', 'task', 'epic'] as IssueType[] },
    ];

    expect(shadowedByFile(boardRow, fileRows)).toBe(false);
  });

  it('is not shadowed by a different shape', () => {
    const fileRows = [
      { fromStatusId: 3, toStatusId: 4, shape: 'leaf' as const, types: ['bug', 'task'] as IssueType[] },
    ];

    expect(shadowedByFile(boardRow, fileRows)).toBe(false);
  });

  it('is not shadowed when there are no file rows', () => {
    expect(shadowedByFile(boardRow, [])).toBe(false);
  });
});

describe('matchesProjectFilter', () => {
  const boardWide = { projectKey: null };
  const projectA = { projectKey: 'A' };
  const projectB = { projectKey: 'B' };

  it('keeps every row when the filter is cleared', () => {
    expect(matchesProjectFilter(boardWide, '')).toBe(true);
    expect(matchesProjectFilter(projectA, '')).toBe(true);
    expect(matchesProjectFilter(projectB, '')).toBe(true);
  });

  it('keeps the board-wide row and the matching project, and drops the other', () => {
    expect(matchesProjectFilter(boardWide, 'A')).toBe(true);
    expect(matchesProjectFilter(projectA, 'A')).toBe(true);
    expect(matchesProjectFilter(projectB, 'A')).toBe(false);
  });
});

describe('isUncheckedEdit', () => {
  it('is a check with no denied tools', () => {
    expect(isUncheckedEdit({ isCheck: true, deniedTools: [] })).toBe(true);
  });

  it('is not a check that denies at least one tool', () => {
    expect(isUncheckedEdit({ isCheck: true, deniedTools: ['Bash'] })).toBe(false);
  });

  it('is not a row that is not a check at all', () => {
    expect(isUncheckedEdit({ isCheck: false, deniedTools: [] })).toBe(false);
  });
});

describe('isOverridden', () => {
  it('is not a row with no prescribed text', () => {
    expect(isOverridden({ prompt: 'Do the thing.', defaultPrompt: null })).toBe(false);
  });

  it('is not a row whose prompt equals its prescribed text', () => {
    expect(isOverridden({ prompt: 'Do the thing.', defaultPrompt: 'Do the thing.' })).toBe(false);
  });

  it('is a row whose prompt differs from its prescribed text', () => {
    expect(isOverridden({ prompt: 'Do the thing.', defaultPrompt: 'Do it differently.' })).toBe(true);
  });

  it('compares against an empty prescribed text rather than treating it as none', () => {
    expect(isOverridden({ prompt: 'Do the thing.', defaultPrompt: '' })).toBe(true);
  });
});
