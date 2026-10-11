## What this does

Tests for the approver gate and merge-column refusal that the sibling behavior task adds to `MoveIssue`/`PatchIssue`/`BulkEdit` in `IssuesController.cs`. Depends on that behavior task (gated with `hatch depends`) - it must land first, since these tests exercise code it adds.

## Acceptance criterion

`make test-api` is green with new cases, each a fact from HA-293's criterion 1: a protected-column move succeeds for a live owner or approver and is `403` (naming the project) for anyone else; it is `403` with the program sentence for a key or runner header regardless of membership; a same-column reorder and a move out of a protected column need no membership; a move into a `MergesPullRequest` column with no `PullRequestUrl` is `400`, and succeeds once the url is set; a bulk edit resolves one approvable key and one not in the same `200`, the second in `failures`.

## Files

`src/Hatch.Api.Tests/Hatch/IssuesControllerTests.cs` only.

## Setup

`NewAsync` (`:3490-3528`) needs a protected and a merge-protected column beside `inbox`/`todo`/`done`:

```csharp
var approved = new EfHatchStatus { Name = "approved", SortOrder = 30, IsProtected = true };
var merges = new EfHatchStatus { Name = "merges", SortOrder = 35, IsProtected = true, MergesPullRequest = true };
```

Expose `Approved`/`Merges` ids on `Harness` like `Inbox`/`Todo`/`Done` (`:3376-3380`).

This file's own `StubCallerIdentity` (`:3531-3556`) is a different class from `AuthFakes.cs`'s same-named one - here the key field is `Key`, and `IsProgramAsync` (`:3551-3552`) reads `Key is not null || Local is { Kind: ActorKind.Key }`. Use `Key`, not `ApiKey`, below.

## The cases

New "Protected columns" region (near `:661` or `:1220`), one case per fact, modeled on existing patterns rather than inventing a new one:

- **Owner/approver allowed**: `h.Actors.AddPerson("Ada")` + a `ProjectMembers` row (`Role = .Owner`, separately `.Approver`) + `h.Actors.Me = owner` - only `Actors.Me` matters, since `ProjectAccess.HasRoleAsync` resolves via `actors.MeAsync()`, not `caller.Person`. Move/patch/bulk into `approved` succeeds (200, `StatusId` updated).
- **Another person, no membership**: 403, `Value` is the exact sentence naming `h.ProjectId`'s key (`"AER"` in this harness).
- **A key**: `h.Caller.Key = AProgram()` (`:172`, already used this way at `:687-699`) - 403 with the program sentence, regardless of membership.
- **Local operator, wall off**: `h.Caller.Local`/`h.Actors.Me` both `new Actor(ActorKind.Person, LocalCaller.PersonId, "Ada")`, plus a membership row - succeeds. Mirrors `IssueClaimTests.cs:552`/`WipMoveTests.cs:221`.
- **Runner header**: `h.Caller.Local = new Actor(ActorKind.Key, Guid.NewGuid(), "a-runner")` (mirrors `WipMoveTests.cs:221`) - 403 with the program sentence even with a membership row present, since `IsProgramAsync` is checked first, unconditionally.
- **No pull request url into a merge column**: `PullRequestUrl = null`, move into `merges` as owner - `400` with the merge sentence; set the url, same move succeeds.
- **Same-column reorder, no membership**: seed an issue into `approved` by writing `StatusId` directly on the tracked entity post-create (idiom at `:839-850`, since reaching `approved` through the controller would itself need membership). Move it between two neighbours still inside `approved` - succeeds. Mirrors `AMoveWithinAColumn_WritesNothing` (`:1240-1252`).
- **Move out, no membership**: seed in `approved` the same way, move to `done` (unprotected) - succeeds.
- **Bulk, mixed**: two keys in one bulk request, one in a project the caller may approve on, one not - the first lands in `changed`/`unchanged`, the second in `failures` with the project-naming sentence, call still returns `200`.

## What was checked

Read `IssueClaimTests.cs:552`/`WipMoveTests.cs:221` for the wall-off/runner idiom and `:839-850` for the direct-db seeding idiom, and `AMoveWithinAColumn_WritesNothing` (`:1240-1252`) as the reorder model. Confirmed `EfHatchProjectMember`/`ProjectMemberRole.{Owner,Approver}` match this setup, and that `StubActorDirectory`'s `Me`/`AddPerson` are independent settable members.

## Not checked

Nothing beyond this file - no production code changes here.
