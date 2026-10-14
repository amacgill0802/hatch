import { useState } from 'react';
import { Button, Card, EmptyState, Field, PageHeader, Table } from '@hatch/ui';
import { deletePlaybook, getPlaybooks, getStatuses } from '../api/client';
import { PlaybookEditDialog } from '../components/PlaybookEditDialog';
import { PlaybookRow } from '../components/PlaybookRow';
import { message } from '../lib/errors';
import { matchesProjectFilter } from '../lib/playbooks';
import { useLoaded } from '../lib/useLoaded';
import { hasMultipleProjects, useProjects } from '../lib/useProjects';
import type { Playbook, Status } from '../types';

/**
 * The matrix an agent is dispatched by, and the only place it can be changed.
 *
 * Everything on this page is refused to an API key on purpose: a playbook picks
 * the next agent's instructions, its model and its budget, so an agent able to
 * edit one could widen its own. The page is the operator's side of that
 * refusal, and it is why the settings are worth having as rows at all - the
 * right effort for a transition is not something anybody guesses correctly the
 * first time, it is something they retune after watching a run go badly.
 */
export function PlaybooksPage() {
  const { data: playbooks, error, setError, reload } = useLoaded<Playbook[]>(getPlaybooks);
  const { data: statuses } = useLoaded<Status[]>(getStatuses);
  const { projects } = useProjects();
  const [projectFilter, setProjectFilter] = useState('');
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [creating, setCreating] = useState(false);

  async function act(action: () => Promise<unknown>) {
    try {
      await action();
      await reload();
      setError(null);
    } catch (err) {
      setError(message(err));
    }
  }

  const visible = playbooks?.filter((p) => matchesProjectFilter(p, projectFilter));

  return (
    <div className="hatch-page">
      <PageHeader
        title="Playbooks"
        description="What an agent is told, and how much thought to spend, when it moves an issue one column along - and, for the review column to itself, when a pull request there has stopped merging with the trunk."
        actions={
          <>
            {hasMultipleProjects(projects) && (
              <Field label="Project">
                <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                  <option value="">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.key}>
                      {project.key} — {project.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Button variant="primary" disabled={!statuses} onClick={() => setCreating(true)}>
              New playbook
            </Button>
          </>
        }
      />

      {error && <p className="text-danger">{error}</p>}

      {playbooks?.length === 0 && (
        <EmptyState message="No playbooks yet. Without one, a transition dispatches nothing at all - hatch.sh work says so rather than guessing." />
      )}

      {playbooks && playbooks.length > 0 && (
        <Card flush>
          <Table>
            <thead>
              <tr>
                <th>Transition</th>
                {hasMultipleProjects(projects) && <th>Project</th>}
                <th>Types</th>
                <th>Shape</th>
                <th>Model</th>
                <th>Effort</th>
                <th>Budget (M tokens)</th>
                <th>Brief limit (chars)</th>
                <th>Denied tools</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible?.map((playbook) => (
                <PlaybookRow
                  key={playbook.id}
                  playbook={playbook}
                  projects={projects}
                  onEdit={() => setEditing(playbook)}
                  onDelete={() => void act(() => deletePlaybook(playbook.id))}
                />
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <PlaybookEditDialog
        open={creating || editing !== null}
        playbook={editing}
        statuses={statuses ?? []}
        projects={projects}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={() => void reload()}
      />
    </div>
  );
}
