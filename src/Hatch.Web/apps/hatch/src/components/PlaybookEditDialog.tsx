import { useState } from 'react';
import { Button, Field, Modal, Text } from '@hatch/ui';
import { createPlaybook, patchPlaybook } from '../api/client';
import { boardColumns } from '../lib/columns';
import { message } from '../lib/errors';
import {
  briefLimitDraft,
  briefLimitRequest,
  budgetDraft,
  budgetRequest,
  deniedToolsDraft,
  deniedToolsRequest,
  transitionLabel,
} from '../lib/playbooks';
import { hasMultipleProjects } from '../lib/useProjects';
import {
  ISSUE_TYPES,
  PLAYBOOK_EFFORTS,
  PLAYBOOK_EFFORT_DEFAULT,
  PLAYBOOK_MODELS,
  PLAYBOOK_MODEL_DEFAULT,
  PLAYBOOK_SHAPES,
  PLAYBOOK_SHAPE_DEFAULT,
  type IssueType,
  type Playbook,
  type PlaybookShape,
  type Project,
  type Status,
} from '../types';
import { Choice } from './Choice';
import { MarkdownEditor } from './MarkdownEditor';

/** The draft every field edits, whichever path opened it. `fromStatusId` and
    `toStatusId` ride along even when editing - where they are fixed and shown
    only as the dialog's title - because building `openDraft` once for both
    paths is simpler than a second shape that drops them. */
interface Draft {
  fromStatusId: number;
  toStatusId: number;
  types: IssueType[];
  shape: PlaybookShape;
  model: string;
  effort: string;
  budget: string;
  briefLimit: string;
  deniedTools: string;
  projectId: string;
  prompt: string;
}

function openDraft(playbook: Playbook | null, statuses: Status[]): Draft {
  if (playbook) {
    return {
      fromStatusId: playbook.fromStatusId,
      toStatusId: playbook.toStatusId,
      types: playbook.types,
      shape: playbook.shape,
      model: playbook.model,
      effort: playbook.effort,
      budget: budgetDraft(playbook.budget),
      briefLimit: briefLimitDraft(playbook.briefLimit),
      deniedTools: deniedToolsDraft(playbook.deniedTools),
      projectId: playbook.projectId === null ? '' : String(playbook.projectId),
      prompt: playbook.prompt,
    };
  }
  const board = boardColumns(statuses);
  return {
    fromStatusId: board[0]?.id ?? 0,
    toStatusId: board[1]?.id ?? 0,
    types: [],
    shape: PLAYBOOK_SHAPE_DEFAULT,
    model: PLAYBOOK_MODEL_DEFAULT,
    effort: PLAYBOOK_EFFORT_DEFAULT,
    budget: '',
    briefLimit: '',
    deniedTools: '',
    projectId: '',
    prompt: '',
  };
}

/**
 * The one form a playbook's every field is edited through, behind both New
 * and Edit - see HA-523. Modeled on `ProjectEditDialog`: an `opened` id
 * compared against the prop to reset the draft, and a "stays open on error"
 * convention with its own `error` state.
 *
 * Its own `open` is what lets one dialog serve both paths - `playbook` is
 * only which row it is editing, or `null` for a new one, and `open` is
 * tracked apart so "create" needs no `Playbook` to compare against. `opened`
 * folds both into one identity (`playbook.id`, or `'new'`) so the draft resets
 * whenever the dialog starts again, including a second "New playbook" right
 * after the first was saved.
 */
export function PlaybookEditDialog({
  open,
  playbook,
  statuses,
  projects,
  onClose,
  onSaved,
}: {
  open: boolean;
  playbook: Playbook | null;
  statuses: Status[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const wantInit = open ? (playbook ? playbook.id : 'new') : null;
  const [opened, setOpened] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (wantInit !== opened) {
    setOpened(wantInit);
    if (wantInit !== null) {
      setDraft(openDraft(playbook, statuses));
      setError(null);
    }
  }

  if (!open || !draft) return <Modal open={false} onClose={onClose} title="" />;

  function write(next: Partial<Draft>) {
    setDraft((d) => d && { ...d, ...next });
  }

  async function save() {
    setSaving(true);
    try {
      if (playbook) {
        await patchPlaybook(playbook.id, {
          types: draft!.types,
          shape: draft!.shape,
          model: draft!.model,
          effort: draft!.effort,
          budget: budgetRequest(draft!.budget),
          briefLimit: briefLimitRequest(draft!.briefLimit),
          deniedTools: deniedToolsRequest(draft!.deniedTools),
          projectId: draft!.projectId,
          prompt: draft!.prompt,
        });
      } else {
        await createPlaybook({
          fromStatusId: draft!.fromStatusId,
          toStatusId: draft!.toStatusId,
          types: draft!.types,
          shape: draft!.shape,
          model: draft!.model,
          effort: draft!.effort,
          budget: budgetRequest(draft!.budget),
          briefLimit: briefLimitRequest(draft!.briefLimit),
          deniedTools: deniedToolsRequest(draft!.deniedTools),
          projectId: draft!.projectId || undefined,
          prompt: draft!.prompt,
        });
      }
      setError(null);
      onSaved();
      onClose();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  const board = boardColumns(statuses);

  return (
    <Modal
      open
      onClose={onClose}
      title={playbook ? `Edit ${transitionLabel(playbook)}` : 'New playbook'}
      footer={
        <div className="hatch-form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!draft.prompt.trim()} onClick={() => void save()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="hatch-form">
        {error && <p className="text-danger">{error}</p>}

        <div className="hatch-field-grid">
          {!playbook && (
            <>
              <Field label="From" hint="The column the issue is in when the agent picks it up.">
                <select value={draft.fromStatusId} onChange={(e) => write({ fromStatusId: Number(e.target.value) })}>
                  {board.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="To"
                hint="Where it should be when the agent stops. The review column to itself is the review playbook: what an agent is told when a pull request there has stopped merging or its build fails."
              >
                <select value={draft.toStatusId} onChange={(e) => write({ toStatusId: Number(e.target.value) })}>
                  {board.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Types" hint="Leave all unticked for every type." as="div">
            <TypesCell types={draft.types} onChange={(types) => write({ types })} />
          </Field>
          <Field label="Shape" hint="Whether the issue's children matter: any, only a leaf, or only a parent.">
            <Choice value={draft.shape} options={PLAYBOOK_SHAPES} onChange={(shape) => write({ shape: shape as PlaybookShape })} />
          </Field>
          <Field label="Model" hint="Which model the dispatched session runs on.">
            <Choice value={draft.model} options={PLAYBOOK_MODELS} onChange={(model) => write({ model })} />
          </Field>
          <Field label="Effort" hint="How much thought it may spend on the move.">
            <Choice value={draft.effort} options={PLAYBOOK_EFFORTS} onChange={(effort) => write({ effort })} />
          </Field>
          <Field label="Budget (M tokens)" hint="Leave blank for no cap.">
            <input inputMode="numeric" value={draft.budget} onChange={(e) => write({ budget: e.target.value })} />
          </Field>
          <Field label="Brief limit (chars)" hint="Leave blank for no cap.">
            <input inputMode="numeric" value={draft.briefLimit} onChange={(e) => write({ briefLimit: e.target.value })} />
          </Field>
          <Field label="Denied tools" hint="One rule per line. Leave blank for every tool." as="div">
            <textarea
              rows={2}
              className="hatch-grows"
              value={draft.deniedTools}
              onChange={(e) => write({ deniedTools: e.target.value })}
            />
          </Field>
          {hasMultipleProjects(projects) && (
            <Field label="Project">
              <select value={draft.projectId} onChange={(e) => write({ projectId: e.target.value })}>
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={String(project.id)}>
                    {project.key} — {project.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div className="hatch-playbook-prompt">
          <Field label="Prompt" as="div" hint="What the agent is told before it is shown the ticket. The ticket is the brief; this is the method.">
            <MarkdownEditor
              value={draft.prompt}
              onChange={(prompt) => write({ prompt })}
              rows={16}
              className="hatch-grows"
              ariaLabel="Prompt"
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/** Which types a row speaks for. Nothing ticked is every type - see NormalizeTypes.
    Moved in from PlaybooksPage.tsx, as-is, for HA-523: the create and edit paths
    share one dialog now, so they share this control too. */
function TypesCell({ types, onChange }: { types: IssueType[]; onChange: (types: IssueType[]) => void }) {
  return (
    <div className="hatch-playbook-types">
      {ISSUE_TYPES.map((type) => (
        <label key={type}>
          <input
            type="checkbox"
            checked={types.includes(type)}
            onChange={(e) => onChange(e.target.checked ? [...types, type] : types.filter((t) => t !== type))}
          />
          {type}
        </label>
      ))}
      {types.length === 0 && <Text tone="muted">any</Text>}
    </div>
  );
}
