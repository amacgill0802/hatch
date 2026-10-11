## What this does

A move into a protected column is refused unless the caller is a live owner or approver of the issue's project. A narrower refusal rides the same check: a move into a column with `MergesPullRequest` on is `400` for an issue with no `PullRequestUrl`. Both apply to `MoveIssue`, `PatchIssue` and `BulkEdit` - the three places `IssuesController` changes `StatusId`. Touches `IssuesController.cs` (the two helpers and every call site below) and `IssuesControllerTests.cs` (the new tests).

Depends on the sibling plumbing task threading `IProjectAccess access` through the constructor and all 19 call sites, no behavior change - gated with `hatch depends`, lands first.

## Acceptance criterion

`make test-api` green: `MoveIssue`/`PatchIssue`/`BulkEdit` each refuse a protected-column move unless the caller is a live owner/approver (`403`, naming the project to a non-member, the program sentence to a key or runner regardless of membership); each refuses a `MergesPullRequest` move with no `PullRequestUrl` (`400`); a same-column reorder or a move out of protection needs no membership; a bulk edit resolves one approvable key and one not in the same `200`, the second in `failures`. Criterion 1 of parent HA-293, sliced to the controller.

## The two refusals, as one pair of helpers

Add beside `OverrideRefusal`/`ProjectMoveRefusal` ("The one narrowing" region, `IssuesController.cs:1007` on):

```csharp
private async Task<string?> ProtectedMoveRefusalAsync(EfHatchProject project, EfHatchStatus target, CancellationToken ct)
{
    if (!target.IsProtected) return null;
    if (await caller.IsProgramAsync(ct))
        return "moving work into a protected column is an owner's or approver's call, not an agent's";
    if (!await access.CanApproveAsync(project.Id, ct))
        return $"only an owner or approver of {project.Key} may move work into \"{target.Name}\"";
    return null;
}

private static string? MergeColumnRefusal(EfHatchIssue issue, EfHatchStatus target) =>
    target.MergesPullRequest && string.IsNullOrWhiteSpace(issue.PullRequestUrl)
        ? $"\"{target.Name}\" merges the pull request, and this issue has none recorded"
        : null;
```

Both return a sentence or null, the shape `Error`/`Conflict` already use in `StageEditAsync`; each call site wraps the result in the HTTP shape it needs. `ProtectedMoveRefusalAsync` checks membership against the passed-in project, not `issue.ProjectId` - see the project-move note below.

## `MoveIssue` (`:883-935`)

After `var changedColumn = issue.StatusId != status.Id;`, inside `if (changedColumn)`, before `var now = time.GetUtcNow();`:

```csharp
if (await ProtectedMoveRefusalAsync(issue.Project!, status, ct) is { } forbidden)
    return new ObjectResult(forbidden) { StatusCode = StatusCodes.Status403Forbidden };
if (MergeColumnRefusal(issue, status) is { } mergeRefusal) return BadRequest(mergeRefusal);
```

`issue.Project` is already loaded. A same-column reorder never reaches this block (`changedColumn` false), so reordering/moving-out stay ungated by construction.

## `StageEditAsync` (`:596` on), shared by `PatchIssue`/`BulkEdit`

Return tuple (`:596-598`) gains a sixth element, `string? Forbidden`; every existing `return (...)` gains a trailing `, null` (or `, forbidden` where this writes it). Inside the status block (`:643-648`):

```csharp
EfHatchStatus? status = null;
if (edit.StatusId is { } statusId && statusId != issue.StatusId)
{
    status = await db.Statuses.FirstOrDefaultAsync(s => s.Id == statusId, ct);
    if (status is null) return (false, $"there is no column {statusId}", null, null, [], null);

    var statusProject = targetProject ?? issue.Project!;
    if (await ProtectedMoveRefusalAsync(statusProject, status, ct) is { } forbidden)
        return (false, null, null, null, [], forbidden);
    if (MergeColumnRefusal(issue, status) is { } mergeRefusal)
        return (false, mergeRefusal, null, null, [], null);
}
```

`statusProject` follows where the issue is going to live, not where it's leaving - `targetProject` is resolved at `:608-614` (null unless this edit also moves projects).

## `PatchIssue` (`:342-414`) and `BulkEdit` (`:434-575`)

`PatchIssue`'s two call sites (`:369-374`, `:392-396`) destructure the result; check `forbidden` ahead of `full`/`conflict`/`error`:

```csharp
var (changed, error, conflict, full, _, forbidden) = await StageEditAsync(...);
if (forbidden is not null) return new ObjectResult(forbidden) { StatusCode = StatusCodes.Status403Forbidden };
if (full is not null) return Conflict(full);
if (conflict is not null) return Conflict(conflict);
if (error is not null) return BadRequest(error);
```

`BulkEdit`'s one call site, inside `ResolveAndStageAsync` (`:519-525`), reports `forbidden` into `failures` like `error`/`conflict`/`full.Error` already are - per-key, not whole-request:

```csharp
var (moved, error, conflict, full, rekeyedByThis, forbidden) = await StageEditAsync(...);
if (forbidden is not null) failures.Add(new IssueBulkFailureDto(key, forbidden));
else if (full is not null) failures.Add(new IssueBulkFailureDto(key, full.Error));
else if (conflict is not null) failures.Add(new IssueBulkFailureDto(key, conflict));
else if (error is not null) failures.Add(new IssueBulkFailureDto(key, error));
else if (moved) changed.Add(await KeyOfAsync(issue, ct));
else unchanged.Add(await KeyOfAsync(issue, ct));
```

## Tests, in `IssuesControllerTests.cs`

`NewAsync` (`:3490-3528`) needs a protected and a merge-protected column beside `inbox`/`todo`/`done`:

```csharp
var approved = new EfHatchStatus { Name = "approved", SortOrder = 30, IsProtected = true };
var merges = new EfHatchStatus { Name = "merges", SortOrder = 35, IsProtected = true, MergesPullRequest = true };
```

Expose `Approved`/`Merges` ids on `Harness` like `Inbox`/`Todo`/`Done` (`:3376-3380`).

This file's `StubCallerIdentity` (`:3531-3556`) differs from `AuthFakes.cs`'s same-named class - here the key field is `Key`, and `IsProgramAsync` (`:3551-3552`) reads `Key is not null || Local is { Kind: ActorKind.Key }`. Use `Key`, not `ApiKey`.

New "Protected columns" region (near `:661` or `:1220`), one case per fact, modeled on existing patterns:

- **Owner/approver allowed**: `h.Actors.AddPerson("Ada")` + a `ProjectMembers` row (`Role = .Owner`, separately `.Approver`) + `h.Actors.Me = owner` - only `Actors.Me` matters (`ProjectAccess.HasRoleAsync` resolves via `actors.MeAsync()`, not `caller.Person`). Move/patch/bulk into `approved` succeeds (200, `StatusId` updated).
- **Another person, no membership**: 403, `Value` names `h.ProjectId`'s key (`"AER"`).
- **A key**: `h.Caller.Key = AProgram()` (`:172`, used this way at `:687-699`) - 403, program sentence, regardless of membership.
- **Local operator, wall off**: `h.Caller.Local`/`h.Actors.Me` both `new Actor(ActorKind.Person, LocalCaller.PersonId, "Ada")`, plus a membership row - succeeds. Mirrors `IssueClaimTests.cs:552`/`WipMoveTests.cs:221`.
- **Runner header**: `h.Caller.Local = new Actor(ActorKind.Key, Guid.NewGuid(), "a-runner")` - 403, program sentence, even with a membership row, since `IsProgramAsync` is checked first.
- **No pull request url into a merge column**: `PullRequestUrl = null`, move into `merges` as owner - `400`, merge sentence; set the url, same move succeeds.
- **Same-column reorder, no membership**: seed into `approved` by writing `StatusId` directly post-create (idiom at `:839-850`). Move between two neighbours in `approved` - succeeds. Mirrors `AMoveWithinAColumn_WritesNothing` (`:1240-1252`).
- **Move out, no membership**: seed in `approved` the same way, move to `done` - succeeds.
- **Bulk, mixed**: two keys, one approvable, one not - first in `changed`/`unchanged`, second in `failures` with the project sentence, call returns `200`.

## What was checked, and not

Re-verified every line number against `IssuesController.cs` as it stands. Confirmed `ProjectAccess.CanApproveAsync`/`IsOwnerAsync`, `EfHatchStatus.IsProtected`/`MergesPullRequest`, `EfHatchProjectMember`/`ProjectMemberRole.{Owner,Approver}` already exist with the shape used above, and the `IssueClaimTests.cs:552`/`WipMoveTests.cs:221` and `:839-850` idioms. `MaxBulkKeys` is `500` (`:45`). One file-disjoint slice once the plumbing task lands - no further seam worth cutting. Not measured: whether `access.CanApproveAsync`'s up-to-two queries per bulk key matter at `MaxBulkKeys` - `LoadAsync` already costs one query per key here, so no new shape; no batching was designed for it.
