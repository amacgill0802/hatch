/* The Projects edit dialog's draft, same known/working shape as lib/draft.ts
   but generalized to a record of fields - name, key, and the repositories
   list - rather than one string. Operates on ProjectRepositoryWriteRequest[],
   the PUT shape, like lib/repositories.ts does and for the same reason: a
   newly-added entry has no `canonical` yet. No DOM. */

import { normalizeProjectKey, rekeyObjection } from './projectKey';
import type { Project, ProjectLandingWriteRequest, ProjectPatchRequest, ProjectRepositoryWriteRequest } from '../types';

export interface ProjectDraft {
  known: {
    name: string;
    key: string;
    color: string | null;
    icon: string | null;
    repositories: ProjectRepositoryWriteRequest[];
    landing: 'pull-request' | 'trunk';
    checksRequired: boolean;
    onePullRequest: boolean;
  };
  name: string;
  key: string;
  color: string | null;
  icon: string | null;
  repositories: ProjectRepositoryWriteRequest[];
  landing: 'pull-request' | 'trunk';
  checksRequired: boolean;
  onePullRequest: boolean;
}

export interface ProjectDraftDiff {
  patch: ProjectPatchRequest | null;
  repositories: ProjectRepositoryWriteRequest[] | null;
}

function sameRepositories(a: ProjectRepositoryWriteRequest[], b: ProjectRepositoryWriteRequest[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, i) => entry.remote === b[i].remote && entry.baseBranch === b[i].baseBranch);
}

export function openProjectDraft(project: Project): ProjectDraft {
  const repositories = project.repositories.map(({ remote, baseBranch }) => ({ remote, baseBranch }));
  return {
    known: {
      name: project.name,
      key: project.key,
      color: project.color,
      icon: project.icon,
      repositories,
      landing: project.landing,
      checksRequired: project.checksRequired,
      onePullRequest: project.onePullRequest,
    },
    name: project.name,
    key: project.key,
    color: project.color,
    icon: project.icon,
    repositories,
    landing: project.landing,
    checksRequired: project.checksRequired,
    onePullRequest: project.onePullRequest,
  };
}

/** Why Save is greyed by the key, or null - a key left alone is no objection; a changed one meets the rekey speed bump. */
export function projectDraftKeyObjection(draft: ProjectDraft, confirmation: string): string | null {
  if (normalizeProjectKey(draft.key) === normalizeProjectKey(draft.known.key)) return null;
  return rekeyObjection(draft.known.key, draft.key, confirmation);
}

export function projectDraftDiff(draft: ProjectDraft): ProjectDraftDiff {
  const patchFields: ProjectPatchRequest = {};
  if (draft.name !== draft.known.name) patchFields.name = draft.name;
  if (draft.key !== draft.known.key) patchFields.key = draft.key;
  if (draft.color !== draft.known.color) patchFields.color = draft.color ?? '';
  if (draft.icon !== draft.known.icon) patchFields.icon = draft.icon ?? '';

  return {
    patch: Object.keys(patchFields).length > 0 ? patchFields : null,
    repositories: sameRepositories(draft.repositories, draft.known.repositories) ? null : draft.repositories,
  };
}

/** Why Save sends a landing PUT, or doesn't - a sparse diff the same way projectDraftDiff's patchFields is. */
export function projectLandingDiff(draft: ProjectDraft): ProjectLandingWriteRequest | null {
  const fields: ProjectLandingWriteRequest = {};
  if (draft.landing !== draft.known.landing) fields.landing = draft.landing;
  if (draft.checksRequired !== draft.known.checksRequired) fields.checksRequired = draft.checksRequired;
  if (draft.onePullRequest !== draft.known.onePullRequest) fields.onePullRequest = draft.onePullRequest;

  return Object.keys(fields).length > 0 ? fields : null;
}
