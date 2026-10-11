## What this does

`IssuesController`'s constructor gains a seventh parameter, `IProjectAccess access`, so the approver gate in HA-386 has something to call. No behavior changes here - `access` goes unused until HA-386 wires it in. This is pure scaffolding: threading one new constructor parameter through every place `IssuesController` is built.

## Acceptance criterion

`make test-api` is green, unchanged: every one of the 19 existing `new IssuesController(...)` call sites compiles with the new 7th argument, and every existing test still passes with no behavior change.

## Files

- `src/Hatch.Api/Modules/Hatch/IssuesController.cs:24-30` - constructor gains `IProjectAccess access` as the final parameter.
- `src/Hatch.Api/Modules/Hatch/TrunkBuildBugController.cs:71` - construct a throwaway `new ProjectAccess(db, actors)` inline next to the existing `IssuesController` construction; that controller only calls `CreateIssueAsync`, which never reads `access`, so nothing else there changes.
- `src/Hatch.Api.Tests/Hatch/IssuesControllerTests.cs:3516` - the harness's `Issues = new IssuesController(db, ranks, actors, TestClaims.With(), caller, time)` gains a 7th argument, `new ProjectAccess(db, actors)`.
- 17 other test files construct `IssuesController` directly and need the identical one-argument fix, or the test project will not compile: `BuildCheckControllerTests.cs`, `AssigneeControllerTests.cs`, `ActivityControllerTests.cs`, `IssueExpressControllerTests.cs`, `IssueExpediteControllerTests.cs`, `ImportControllerTests.cs`, `IssueDependenciesControllerTests.cs`, `IssueStallControllerTests.cs`, `MergeCheckControllerTests.cs`, `IssueWorkLogControllerTests.cs`, `IssueProjectionStallTests.cs`, `IssueWipLimitControllerTests.cs`, `IssuePlaybookControllerTests.cs`, `RunnersControllerTests.cs`, `TrunkBuildControllerTests.cs`, `WipMoveTests.cs`, `WorkLogControllerTests.cs`. Each gets the same `, new ProjectAccess(db, actors)` (or that harness's own `db`/`actors` names) appended.

Confirmed by a literal grep for `new IssuesController(` across the solution: 19 occurrences in 19 files - this list's 17, plus `IssuesControllerTests.cs`, plus `TrunkBuildBugController.cs`.

`IProjectAccess`/`ProjectAccess` already exist (`ProjectAccess.cs`, landed by HA-290) and are already registered in `HatchModule.cs:52` - no DI change needed. None of the 17 other test files ever set a protected column (grepped `IsProtected` across `src/Hatch.Api.Tests/Hatch/*.cs` - the only hit is `StatusesControllerTests.cs`, which does not construct `IssuesController`), so wiring the real `ProjectAccess` into all of them is safe and needs no stub.

## What was checked

Read the constructor and confirmed the line range against the file as it stands today. Grepped every direct `new IssuesController(...)` call site: 19, confirmed by count, not estimate. Grepped `IsProtected` across the test directory and confirmed no other test file sets it. Read `HatchModule.cs:52` and confirmed `IProjectAccess` is already registered there.

## Not checked

Nothing beyond this file list - this task touches no logic, only an argument list, so there is no behavior to verify.
