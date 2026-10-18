import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlaybookRow } from './PlaybookRow';
import type { Playbook, Project, Status } from '../types';

const BASE: Playbook = {
  id: 1,
  fromStatusId: 1,
  fromStatusName: 'To Do',
  toStatusId: 2,
  toStatusName: 'In Progress',
  types: [],
  shape: 'any',
  prompt: 'Do the thing.',
  model: 'sonnet',
  effort: 'medium',
  budget: null,
  briefLimit: null,
  deniedTools: [],
  isCheck: false,
  updatedAt: '2026-01-01T00:00:00Z',
  projectId: null,
  projectKey: null,
  projectName: null,
};

const STATUSES: Status[] = [
  { id: 1, name: 'To Do', sortOrder: 1, isTerminal: false, isDeferred: false, isWip: false, expressSkips: false, parentPulls: false, agentFiles: false, isImplementation: false, isProtected: false, mergesPullRequest: false, color: '#888888' },
  { id: 2, name: 'In Progress', sortOrder: 2, isTerminal: false, isDeferred: false, isWip: false, expressSkips: false, parentPulls: false, agentFiles: false, isImplementation: false, isProtected: false, mergesPullRequest: false, color: '#888888' },
];

const ONE_PROJECT: Project[] = [
  {
    id: 1,
    key: 'AER',
    name: 'Aerospace',
    issueCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    color: null,
    icon: null,
    logoUpdatedAt: null,
    repositories: [],
    members: [],
    canApprove: false,
    canAdminister: false,
    landing: 'pull-request',
    checksRequired: true,
    onePullRequest: false,
    autoHealBugEnabled: false,
    autoHealBugPriority: 'emergency',
    autoHealBugPreApproval: 'express',
    autoHealBugStatusId: null,
    repoSourced: false,
    repoSourcedBy: null,
    repoSourcedAt: null,
  },
];

const TWO_PROJECTS: Project[] = [
  ...ONE_PROJECT,
  { ...ONE_PROJECT[0], id: 2, key: 'HA', name: 'Hatch' },
];

const noop = () => undefined;

describe('PlaybookRow', () => {
  it('names the transition by its two ends', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('To Do');
    expect(html).toContain('In Progress');
  });

  it('names a review playbook by its one column, not an arrow', () => {
    const playbook: Playbook = { ...BASE, toStatusId: BASE.fromStatusId, toStatusName: BASE.fromStatusName };
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={playbook} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('review playbook');
    expect(html).not.toContain('hatch-playbook-arrow');
  });

  it('shows "any" for empty types, and a badge per type otherwise', () => {
    const anyHtml = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(anyHtml).toContain('any');
    expect(anyHtml).not.toContain('hatch-badge');

    const typed: Playbook = { ...BASE, types: ['task', 'bug'] };
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={typed} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('hatch-badge');
    expect(html).toContain('task');
    expect(html).toContain('bug');
  });

  it('shows the model and effort as plain text', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('sonnet');
    expect(html).toContain('medium');
  });

  it('draws no project info with a single project', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).not.toContain('All projects');
    expect(html).not.toContain('role="img"');
  });

  it('shows "board-wide" for a board-wide row, with multiple projects', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={TWO_PROJECTS} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('board-wide');
  });

  it("draws the project's own label for a scoped row, with multiple projects", () => {
    const scoped: Playbook = { ...BASE, projectId: 1, projectKey: 'AER', projectName: 'Aerospace' };
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={scoped} projects={TWO_PROJECTS} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('AER&#x27;s own');
    expect(html).not.toContain('board-wide');
  });

  it('draws no Shape, Budget, Brief limit or Denied tools', () => {
    const playbook: Playbook = {
      ...BASE,
      shape: 'leaf',
      budget: 5,
      briefLimit: 4000,
      deniedTools: ['Bash', 'WebFetch'],
    };
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={playbook} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).not.toContain('leaf');
    expect(html).not.toContain('>5<');
    expect(html).not.toContain('4000');
    expect(html).not.toContain('Bash');
    expect(html).not.toContain('WebFetch');
  });

  it('has an ungated Delete button, outside the open button', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    const deleteButton = /<button[^>]*>Delete<\/button>/.exec(html)![0];
    expect(deleteButton).not.toContain('disabled');
  });

  it('shows the warning badge for a check with no denied tools, and in no other case', () => {
    const uncheckedCheck: Playbook = { ...BASE, isCheck: true, deniedTools: [] };
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={uncheckedCheck} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('hatch-badge--danger');

    const guardedCheck: Playbook = { ...BASE, isCheck: true, deniedTools: ['Bash'] };
    const guardedHtml = renderToStaticMarkup(
      <PlaybookRow playbook={guardedCheck} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(guardedHtml).not.toContain('hatch-badge--danger');

    const notCheck: Playbook = { ...BASE, isCheck: false, deniedTools: [] };
    const notCheckHtml = renderToStaticMarkup(
      <PlaybookRow playbook={notCheck} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(notCheckHtml).not.toContain('hatch-badge--danger');
  });

  it('shows the shadowed badge only when passed shadowed', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    expect(html).not.toContain('shadowed by the file');

    const shadowedHtml = renderToStaticMarkup(
      <PlaybookRow
        playbook={BASE}
        projects={ONE_PROJECT}
        statuses={STATUSES}
        shadowed
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(shadowedHtml).toContain('shadowed by the file');
  });

  it('opens with a real, focusable button distinct from Delete', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} statuses={STATUSES} onEdit={noop} onDelete={noop} />,
    );
    const openButton = /<button[^>]*class="hatch-playbook-row-open"[^>]*>/.exec(html);
    expect(openButton).not.toBeNull();
    expect(openButton![0]).toContain('aria-label="Edit To Do to In Progress"');
    expect(html.match(/<button/g)?.length).toBe(2);
  });
});
