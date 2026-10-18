import { describe, expect, it } from 'vitest';
import { openProjectDraft, projectDraftDiff, projectDraftKeyObjection, projectLandingDiff, type ProjectDraft } from './projectDraft';

describe('openProjectDraft', () => {
  it('seeds known and the working fields from a Project', () => {
    const project = {
      id: 1,
      key: 'AER',
      name: 'Aerial',
      issueCount: 0,
      createdAt: '2026-01-01',
      color: '#6b7280',
      icon: 'rocket',
      logoUpdatedAt: null,
      repositories: [{ remote: 'a', canonical: 'canonical-a', baseBranch: 'main' }],
      members: [],
      canApprove: false,
      canAdminister: false,
      landing: 'pull-request' as const,
      checksRequired: true,
      onePullRequest: false,
      autoHealBugEnabled: false,
      autoHealBugPriority: 'emergency' as const,
      autoHealBugPreApproval: 'express' as const,
      autoHealBugStatusId: null,
      repoSourced: false,
      repoSourcedBy: null,
      repoSourcedAt: null,
    };

    const draft = openProjectDraft(project);

    expect(draft.name).toBe('Aerial');
    expect(draft.key).toBe('AER');
    expect(draft.known).toEqual({
      name: 'Aerial',
      key: 'AER',
      color: '#6b7280',
      icon: 'rocket',
      repositories: [{ remote: 'a', baseBranch: 'main' }],
      landing: 'pull-request',
      checksRequired: true,
      onePullRequest: false,
      autoHealBugEnabled: false,
      autoHealBugPriority: 'emergency',
      autoHealBugPreApproval: 'express',
      autoHealBugStatusId: null,
      repoSourced: false,
    });
  });

  it('maps repositories down to remote and baseBranch, dropping canonical', () => {
    const project = {
      id: 1,
      key: 'AER',
      name: 'Aerial',
      issueCount: 0,
      createdAt: '2026-01-01',
      color: null,
      icon: null,
      logoUpdatedAt: null,
      repositories: [{ remote: 'a', canonical: 'canonical-a', baseBranch: null }],
      members: [],
      canApprove: false,
      canAdminister: false,
      landing: 'pull-request' as const,
      checksRequired: true,
      onePullRequest: false,
      autoHealBugEnabled: false,
      autoHealBugPriority: 'emergency' as const,
      autoHealBugPreApproval: 'express' as const,
      autoHealBugStatusId: null,
      repoSourced: false,
      repoSourcedBy: null,
      repoSourcedAt: null,
    };

    const draft = openProjectDraft(project);

    expect(draft.repositories).toEqual([{ remote: 'a', baseBranch: null }]);
  });
});

describe('projectDraftDiff', () => {
  const known = {
    name: 'Aerial',
    key: 'AER',
    color: '#6b7280',
    icon: 'rocket',
    repositories: [{ remote: 'a', baseBranch: 'main' }],
    landing: 'pull-request' as const,
    checksRequired: true,
    onePullRequest: false,
    autoHealBugEnabled: false,
    autoHealBugPriority: 'emergency' as const,
    autoHealBugPreApproval: 'express' as const,
    autoHealBugStatusId: null,
    repoSourced: false,
  };

  it('is empty when nothing changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectDraftDiff(draft)).toEqual({ patch: null, repositories: null });
  });

  it('carries only name when only name changed', () => {
    const draft: ProjectDraft = { known, name: 'Renamed', key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectDraftDiff(draft)).toEqual({ patch: { name: 'Renamed' }, repositories: null });
  });

  it('carries only key when only key changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: 'NEW', color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectDraftDiff(draft)).toEqual({ patch: { key: 'NEW' }, repositories: null });
  });

  it('carries only color when only color changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: '#111827', icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectDraftDiff(draft)).toEqual({ patch: { color: '#111827' }, repositories: null });
  });

  it('carries only icon when only icon changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: 'comet', repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectDraftDiff(draft)).toEqual({ patch: { icon: 'comet' }, repositories: null });
  });

  it('sends an empty string to clear color', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: null, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectDraftDiff(draft)).toEqual({ patch: { color: '' }, repositories: null });
  });

  it('sends an empty string to clear icon', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: null, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectDraftDiff(draft)).toEqual({ patch: { icon: '' }, repositories: null });
  });

  it('reports a change when repositories are reordered despite identical membership', () => {
    const repositories = [
      { remote: 'a', baseBranch: 'main' },
      { remote: 'b', baseBranch: 'dev' },
    ];
    const reorderedKnown = { ...known, repositories };
    const draft: ProjectDraft = {
      known: reorderedKnown,
      name: reorderedKnown.name,
      key: reorderedKnown.key,
      color: reorderedKnown.color,
      icon: reorderedKnown.icon,
      repositories: [repositories[1], repositories[0]],
      landing: reorderedKnown.landing,
      checksRequired: reorderedKnown.checksRequired,
      onePullRequest: false,
      autoHealBugEnabled: reorderedKnown.autoHealBugEnabled,
      autoHealBugPriority: reorderedKnown.autoHealBugPriority,
      autoHealBugPreApproval: reorderedKnown.autoHealBugPreApproval,
      autoHealBugStatusId: reorderedKnown.autoHealBugStatusId,
      repoSourced: reorderedKnown.repoSourced,
    };

    const diff = projectDraftDiff(draft);

    expect(diff.patch).toBeNull();
    expect(diff.repositories).toEqual([
      { remote: 'b', baseBranch: 'dev' },
      { remote: 'a', baseBranch: 'main' },
    ]);
  });

  it.each([
    {
      label: 'an added entry',
      repositories: [{ remote: 'a', baseBranch: 'main' }, { remote: 'b', baseBranch: null }],
    },
    { label: 'a removed entry', repositories: [] },
    { label: 'an edited baseBranch', repositories: [{ remote: 'a', baseBranch: 'develop' }] },
  ])('reports a change on $label', ({ repositories }) => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };

    const diff = projectDraftDiff(draft);

    expect(diff.patch).toBeNull();
    expect(diff.repositories).toEqual(repositories);
  });

  it('is unchanged when the working repositories are a freshly-built array with the same entries', () => {
    const draft: ProjectDraft = {
      known,
      name: known.name,
      key: known.key,
      color: known.color,
      icon: known.icon,
      repositories: known.repositories.map((r) => ({ ...r })),
      landing: known.landing,
      checksRequired: known.checksRequired,
      onePullRequest: false,
      autoHealBugEnabled: known.autoHealBugEnabled,
      autoHealBugPriority: known.autoHealBugPriority,
      autoHealBugPreApproval: known.autoHealBugPreApproval,
      autoHealBugStatusId: known.autoHealBugStatusId,
      repoSourced: known.repoSourced,
    };

    expect(projectDraftDiff(draft).repositories).toBeNull();
  });
});

describe('projectLandingDiff', () => {
  const known = {
    name: 'Aerial',
    key: 'AER',
    color: '#6b7280',
    icon: 'rocket',
    repositories: [{ remote: 'a', baseBranch: 'main' }],
    landing: 'pull-request' as const,
    checksRequired: true,
    onePullRequest: false,
    autoHealBugEnabled: true,
    autoHealBugPriority: 'emergency' as const,
    autoHealBugPreApproval: 'express' as const,
    autoHealBugStatusId: null,
    repoSourced: false,
  };

  it('is null when nothing changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectLandingDiff(draft)).toBeNull();
  });

  it('carries only landing when only landing changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: 'trunk', checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectLandingDiff(draft)).toEqual({ landing: 'trunk' });
  });

  it('carries only checksRequired when only checksRequired changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: false, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectLandingDiff(draft)).toEqual({ checksRequired: false });
  });

  it('carries both when both changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: 'trunk', checksRequired: false, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectLandingDiff(draft)).toEqual({ landing: 'trunk', checksRequired: false });
  });

  it('carries only onePullRequest when only onePullRequest changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: true, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectLandingDiff(draft)).toEqual({ onePullRequest: true });
  });

  it('carries only autoHealBugEnabled when only autoHealBugEnabled changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: false, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectLandingDiff(draft)).toEqual({ autoHealBugEnabled: false });
  });

  it('carries only autoHealBugPriority when only autoHealBugPriority changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: 'expedited', autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectLandingDiff(draft)).toEqual({ autoHealBugPriority: 'expedited' });
  });

  it('carries only autoHealBugPreApproval when only autoHealBugPreApproval changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: 'preapproved', autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced };
    expect(projectLandingDiff(draft)).toEqual({ autoHealBugPreApproval: 'preapproved' });
  });

  it('carries only autoHealBugStatusId as a string when only autoHealBugStatusId changed', () => {
    const draft: ProjectDraft = { known, name: known.name, key: known.key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: 5, repoSourced: known.repoSourced };
    expect(projectLandingDiff(draft)).toEqual({ autoHealBugStatusId: '5' });
  });

  it('clears autoHealBugStatusId with an empty string when set back to automatic', () => {
    const withColumn = { ...known, autoHealBugStatusId: 5 };
    const draft: ProjectDraft = { known: withColumn, name: withColumn.name, key: withColumn.key, color: withColumn.color, icon: withColumn.icon, repositories: withColumn.repositories, landing: withColumn.landing, checksRequired: withColumn.checksRequired, onePullRequest: withColumn.onePullRequest, autoHealBugEnabled: withColumn.autoHealBugEnabled, autoHealBugPriority: withColumn.autoHealBugPriority, autoHealBugPreApproval: withColumn.autoHealBugPreApproval, autoHealBugStatusId: null, repoSourced: withColumn.repoSourced };
    expect(projectLandingDiff(draft)).toEqual({ autoHealBugStatusId: '' });
  });

  it('ignores autoHealBugPriority, autoHealBugPreApproval and autoHealBugStatusId while the switch is off', () => {
    const off = { ...known, autoHealBugEnabled: false };
    const draft: ProjectDraft = {
      known: off,
      name: off.name,
      key: off.key,
      color: off.color,
      icon: off.icon,
      repositories: off.repositories,
      landing: off.landing,
      checksRequired: off.checksRequired,
      onePullRequest: off.onePullRequest,
      autoHealBugEnabled: false,
      autoHealBugPriority: 'expedited',
      autoHealBugPreApproval: 'preapproved',
      autoHealBugStatusId: 5,
      repoSourced: off.repoSourced,
    };
    expect(projectLandingDiff(draft)).toBeNull();
  });
});

describe('projectDraftKeyObjection', () => {
  const known = {
    name: 'Aerial',
    key: 'AER',
    color: '#6b7280',
    icon: 'rocket',
    repositories: [{ remote: 'a', baseBranch: 'main' }],
    landing: 'pull-request' as const,
    checksRequired: true,
    onePullRequest: false,
    autoHealBugEnabled: false,
    autoHealBugPriority: 'emergency' as const,
    autoHealBugPreApproval: 'express' as const,
    autoHealBugStatusId: null,
    repoSourced: false,
  };
  const withKey = (key: string): ProjectDraft => ({ known, name: known.name, key, color: known.color, icon: known.icon, repositories: known.repositories, landing: known.landing, checksRequired: known.checksRequired, onePullRequest: known.onePullRequest, autoHealBugEnabled: known.autoHealBugEnabled, autoHealBugPriority: known.autoHealBugPriority, autoHealBugPreApproval: known.autoHealBugPreApproval, autoHealBugStatusId: known.autoHealBugStatusId, repoSourced: known.repoSourced });

  it('is no objection when the key is unchanged', () => {
    expect(projectDraftKeyObjection(withKey('AER'), '')).toBeNull();
  });

  it('is no objection when the key differs only by case or padding', () => {
    expect(projectDraftKeyObjection(withKey(' aer '), '')).toBeNull();
  });

  it('asks for the old key when the key changed and is unconfirmed', () => {
    expect(projectDraftKeyObjection(withKey('NEW'), '')).toBe('Type AER to confirm.');
  });

  it('is no objection when the key changed and the old key is typed', () => {
    expect(projectDraftKeyObjection(withKey('NEW'), 'aer')).toBeNull();
  });

  it('objects to a changed key that is invalid', () => {
    expect(projectDraftKeyObjection(withKey('1X'), 'AER')).not.toBeNull();
  });
});
