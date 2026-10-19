import { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Table, Text } from '@hatch/ui';
import { deletePlaybook, getPlaybookFiles, getPlaybooks, getStatuses } from '../api/client';
import { PlaybookEditDialog } from '../components/PlaybookEditDialog';
import { PlaybookRow } from '../components/PlaybookRow';
import { StatusPill } from '../components/StatusPill';
import { TypeBadge } from '../components/TypeBadge';
import { agoPhrase } from '../lib/claim';
import { message } from '../lib/errors';
import {
  coverageOf,
  fileRowLabel,
  isReviewPlaybook,
  isUncheckedEdit,
  matchesProjectFilter,
  transitionLabel,
} from '../lib/playbooks';
import {
  absentSentence,
  boundCanonicals,
  fileForProject,
  projectsReading,
  shortSha,
  sortedFiles,
  stateLabel,
  visibleFiles,
} from '../lib/playbookFiles';
import { pullRequestWords } from '../lib/pullRequest';
import { useLoaded } from '../lib/useLoaded';
import { hasMultipleProjects, useProjects } from '../lib/useProjects';
import type { Playbook, PlaybookFileRowDto, PlaybookFilesDto, Status } from '../types';

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
  const { data: files } = useLoaded<PlaybookFilesDto>(getPlaybookFiles);
  const { projects } = useProjects();
  const [projectFilter, setProjectFilter] = useState('');
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [creating, setCreating] = useState(false);

  const bound = useMemo(() => boundCanonicals(projects), [projects]);
  const visibleFileList = files && sortedFiles(visibleFiles(files.files, bound));

  // Once per render, as ClaimPanel's own `now` is - every card on the page
  // judges "read how long ago" against the same instant.
  const now = new Date();

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
  const filteredProject = projectFilter ? projects.find((p) => p.key === projectFilter) ?? null : null;
  const activeFile =
    filteredProject?.repoSourced && files ? fileForProject(filteredProject, files.files) : null;

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

      {playbooks?.length === 0 && (activeFile?.rows.length ?? 0) === 0 && (
        <EmptyState message="No playbooks yet. Without one, a transition dispatches nothing at all - hatch.sh work says so rather than guessing." />
      )}

      {playbooks && (playbooks.length > 0 || (activeFile?.rows.length ?? 0) > 0) && (
        <Card flush>
          <Table>
            <thead>
              <tr>
                <th>Transition</th>
                {hasMultipleProjects(projects) && <th>Project</th>}
                <th>Types</th>
                <th>Model</th>
                <th>Effort</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {activeFile?.rows.map((row, i) => (
                <PlaybookFileRowLine
                  key={`${transitionLabel(row)}-${i}`}
                  row={row}
                  statuses={statuses ?? []}
                  label={fileRowLabel(activeFile)}
                />
              ))}
              {visible?.map((playbook) => (
                <PlaybookRow
                  key={playbook.id}
                  playbook={playbook}
                  projects={projects}
                  statuses={statuses ?? []}
                  shadowed={activeFile && playbook.projectKey === null ? coverageOf(playbook, activeFile.rows) === 'overridden' : false}
                  onEdit={() => setEditing(playbook)}
                  onDelete={() => void act(() => deletePlaybook(playbook.id))}
                />
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <h2 className="hatch-section-title">Files on the trunk</h2>

      {visibleFileList?.length === 0 && (
        <EmptyState message="No .hatch/playbooks.yaml read yet - a runner's poll puts one here, at the root of a trunk some project's repository points at." />
      )}

      {visibleFileList?.map((f) => {
        const readers = projectsReading(f, projects, files?.files ?? []);
        return (
          <Card key={`${f.canonical}:${f.trunk}`}>
            <div className="hatch-playbook-file-head">
              <strong>{f.canonical}</strong>
              <Text tone="muted" as="span">{f.trunk}</Text>
              <code>{shortSha(f.sha)}</code>
              <Badge tone={f.state === 'invalid' ? 'danger' : 'muted'}>{stateLabel(f.state)}</Badge>
              <Text tone="muted" as="span">
                read {agoPhrase(f.checkedAt, now)} by {f.runner}
              </Text>
              {f.url !== null && (
                <a className="hatch-chip hatch-chip-link" href={f.url} target="_blank" rel="noreferrer noopener">
                  <span className="hatch-chip-kind">File</span>
                  {pullRequestWords(f.url)}
                </a>
              )}
            </div>

            {f.state === 'parsed' && (
              <Table>
                <thead>
                  <tr>
                    <th>Transition</th>
                    <th>Types</th>
                    <th>Model</th>
                    <th>Effort</th>
                  </tr>
                </thead>
                <tbody>
                  {f.rows.map((row, i) => (
                    <PlaybookFileRowLine key={`${transitionLabel(row)}-${i}`} row={row} statuses={statuses ?? []} />
                  ))}
                </tbody>
              </Table>
            )}

            {f.state === 'invalid' && (
              <p>
                {f.problem}
                {f.lastGoodSha !== null && <> — last good sha {shortSha(f.lastGoodSha)}</>}
              </p>
            )}

            {f.state === 'absent' && <p>{absentSentence(f.trunk)}</p>}

            {readers.length > 0 ? (
              <Text tone="muted" as="p">{`read by ${readers.map((p) => p.key).join(', ')}`}</Text>
            ) : (
              <Text tone="muted" as="p">no project reads this file yet</Text>
            )}
          </Card>
        );
      })}

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

/** One row of a file's parsed playbook, read-only: the main table's own
    `PlaybookRow` minus the edit button and Delete - a file row's own fields
    may not be changed. `label`, given once a project filter merges this row
    into the main table, draws in the same column `PlaybookRow` draws its own
    label in, with a trailing blank cell standing in for the Delete column a
    file row never has; omitted, as in the "Files on the trunk" card below,
    neither cell is drawn and the row is this mini-table's own four columns. */
function PlaybookFileRowLine({
  row,
  statuses,
  label,
}: {
  row: PlaybookFileRowDto;
  statuses: Status[];
  label?: string;
}) {
  const fromStatus = statuses.find((s) => s.id === row.fromStatusId);
  const toStatus = statuses.find((s) => s.id === row.toStatusId);

  return (
    <tr>
      <td>
        {isReviewPlaybook(row) ? (
          <>
            {fromStatus ? <StatusPill status={fromStatus} /> : <strong>{row.fromStatusName}</strong>}{' '}
            <Text tone="muted" as="span">review playbook</Text>
          </>
        ) : (
          <>
            {fromStatus ? <StatusPill status={fromStatus} /> : <strong>{row.fromStatusName}</strong>}
            <span className="hatch-playbook-arrow">→</span>
            {toStatus ? <StatusPill status={toStatus} /> : <strong>{row.toStatusName}</strong>}
          </>
        )}
        {isUncheckedEdit(row) && <Badge tone="danger">a check with no denied tools can edit</Badge>}
      </td>
      {label !== undefined && (
        <td>
          <Text tone="muted" as="span">{label}</Text>
        </td>
      )}
      <td>
        {row.types.length > 0 ? (
          row.types.map((t) => <TypeBadge key={t} type={t} />)
        ) : (
          <Text tone="muted" as="span">any</Text>
        )}
      </td>
      <td>{row.model}</td>
      <td>{row.effort}</td>
      {label !== undefined && <td />}
    </tr>
  );
}
