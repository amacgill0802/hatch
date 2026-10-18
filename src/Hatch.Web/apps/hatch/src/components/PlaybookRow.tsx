import { Badge, Button, Text } from '@hatch/ui';
import { StatusPill } from './StatusPill';
import { TypeBadge } from './TypeBadge';
import { isReviewPlaybook, isUncheckedEdit, playbookLabel, transitionLabel } from '../lib/playbooks';
import { hasMultipleProjects } from '../lib/useProjects';
import type { Playbook, Project, Status } from '../types';

/**
 * One playbook's row in `PlaybooksPage`'s table: the facts, and the two
 * actions that open `PlaybookEditDialog` or delete it outright. Pure and
 * presentational, the `ProjectRow` shape - the page owns both pieces of
 * state Edit opens into.
 *
 * The whole informational area is itself the open control - there is no
 * separate Edit button - so Delete sits in its own trailing `<td>`, outside
 * the button's DOM subtree: a `<button>` cannot legally nest another one.
 */
export function PlaybookRow({
  playbook,
  projects,
  statuses,
  shadowed,
  onEdit,
  onDelete,
}: {
  playbook: Playbook;
  projects: Project[];
  statuses: Status[];
  shadowed?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fromStatus = statuses.find((s) => s.id === playbook.fromStatusId);
  const toStatus = statuses.find((s) => s.id === playbook.toStatusId);
  const multipleProjects = hasMultipleProjects(projects);

  return (
    <tr>
      <td colSpan={multipleProjects ? 5 : 4}>
        <button
          type="button"
          className="hatch-playbook-row-open"
          onClick={onEdit}
          aria-label={`Edit ${transitionLabel(playbook)}`}
        >
          {isReviewPlaybook(playbook) ? (
            <>
              {fromStatus ? <StatusPill status={fromStatus} /> : <strong>{playbook.fromStatusName}</strong>}{' '}
              <Text tone="muted" as="span">review playbook</Text>
            </>
          ) : (
            <>
              {fromStatus ? <StatusPill status={fromStatus} /> : <strong>{playbook.fromStatusName}</strong>}
              <span className="hatch-playbook-arrow">→</span>
              {toStatus ? <StatusPill status={toStatus} /> : <strong>{playbook.toStatusName}</strong>}
            </>
          )}

          {multipleProjects && <Text tone="muted" as="span">{playbookLabel(playbook)}</Text>}

          {playbook.types.length > 0 ? (
            playbook.types.map((t) => <TypeBadge key={t} type={t} />)
          ) : (
            <Text tone="muted" as="span">any</Text>
          )}

          <span className="hatch-playbook-model-effort">
            {playbook.model} {playbook.effort}
          </span>

          {isUncheckedEdit(playbook) && <Badge tone="danger">a check with no denied tools can edit</Badge>}
          {shadowed && <Badge tone="muted">shadowed by the file</Badge>}
        </button>
      </td>
      <td>
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </td>
    </tr>
  );
}
