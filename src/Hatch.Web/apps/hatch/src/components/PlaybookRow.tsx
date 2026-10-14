import { Button, Text } from '@hatch/ui';
import { budgetDraft, briefLimitDraft, isReviewPlaybook, projectLabel } from '../lib/playbooks';
import { hasMultipleProjects } from '../lib/useProjects';
import type { Playbook, Project } from '../types';

/**
 * One playbook's row in `PlaybooksPage`'s table: the facts, and the two
 * actions that open `PlaybookEditDialog` or delete it outright. Pure and
 * presentational, the `ProjectRow` shape - the page owns both pieces of
 * state Edit opens into.
 */
export function PlaybookRow({
  playbook,
  projects,
  onEdit,
  onDelete,
}: {
  playbook: Playbook;
  projects: Project[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr>
      <td>
        {isReviewPlaybook(playbook) ? (
          <>
            <strong>{playbook.fromStatusName}</strong> <Text tone="muted">review playbook</Text>
          </>
        ) : (
          <>
            <strong>{playbook.fromStatusName}</strong> → <strong>{playbook.toStatusName}</strong>
          </>
        )}
      </td>
      {hasMultipleProjects(projects) && <td>{projectLabel(playbook)}</td>}
      <td>{playbook.types.join(', ') || 'any'}</td>
      <td>{playbook.shape}</td>
      <td>{playbook.model}</td>
      <td>{playbook.effort}</td>
      <td>{budgetDraft(playbook.budget)}</td>
      <td>{briefLimitDraft(playbook.briefLimit)}</td>
      <td>{playbook.deniedTools.join(', ') || 'any'}</td>
      <td>
        <div className="hatch-row-actions">
          <Button onClick={onEdit}>Edit</Button>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
