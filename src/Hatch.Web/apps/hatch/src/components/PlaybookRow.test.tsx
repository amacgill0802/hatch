import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlaybookRow } from './PlaybookRow';
import type { Playbook, Project } from '../types';

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
  updatedAt: '2026-01-01T00:00:00Z',
  projectId: null,
  projectKey: null,
  projectName: null,
};

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
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('To Do');
    expect(html).toContain('In Progress');
  });

  it('names a review playbook by its one column, not an arrow', () => {
    const playbook: Playbook = { ...BASE, toStatusId: BASE.fromStatusId, toStatusName: BASE.fromStatusName };
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={playbook} projects={ONE_PROJECT} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('review playbook');
  });

  it('shows "any" for empty types, and the list joined otherwise', () => {
    const anyHtml = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} onEdit={noop} onDelete={noop} />,
    );
    expect(anyHtml).toContain('any');

    const typed: Playbook = { ...BASE, types: ['task', 'bug'] };
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={typed} projects={ONE_PROJECT} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('task, bug');
  });

  it('shows "any" for empty denied tools, and the list joined otherwise', () => {
    const anyHtml = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} onEdit={noop} onDelete={noop} />,
    );
    expect(anyHtml).toContain('any');

    const denied: Playbook = { ...BASE, deniedTools: ['Bash', 'WebFetch'] };
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={denied} projects={ONE_PROJECT} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('Bash, WebFetch');
  });

  it('shows the shape, model and effort', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('>any<');
    expect(html).toContain('sonnet');
    expect(html).toContain('medium');
  });

  it('draws no project column with a single project', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} onEdit={noop} onDelete={noop} />,
    );
    expect(html).not.toContain('All projects');
  });

  it('shows "All projects" for a board-wide row, with multiple projects', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={TWO_PROJECTS} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('All projects');
  });

  it('names the project for a scoped row, with multiple projects', () => {
    const scoped: Playbook = { ...BASE, projectId: 1, projectKey: 'AER', projectName: 'Aerospace' };
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={scoped} projects={TWO_PROJECTS} onEdit={noop} onDelete={noop} />,
    );
    expect(html).toContain('AER — Aerospace');
  });

  it('has an ungated Delete button, unlike ProjectRow', () => {
    const html = renderToStaticMarkup(
      <PlaybookRow playbook={BASE} projects={ONE_PROJECT} onEdit={noop} onDelete={noop} />,
    );
    const deleteButton = /<button[^>]*>Delete<\/button>/.exec(html)![0];
    expect(deleteButton).not.toContain('disabled');
  });
});
