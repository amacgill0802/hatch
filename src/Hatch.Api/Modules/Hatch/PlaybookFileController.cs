using Hatch.Api.Common;
using Hatch.Api.Ef;
using Hatch.Api.Services.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// The stored <see cref="EfHatchPlaybookFile"/> rows, one per repository's
/// trunk, read back for the Files-on-the-trunk page - see
/// <see cref="PlaybookFile"/> for what a stored row holds and how it got
/// there.
/// </summary>
[ApiController]
[Route("api/hatch/playbook-files")]
[RequireRole(PersonRole.User, AcceptScope = ApiKeyScopes.Hatch)]
public class PlaybookFileController(HatchContext db, ICallerIdentity caller, TimeProvider time) : ControllerBase
{
    /// <summary>Every stored playbook-file verdict, ordered by canonical then trunk - what the page reads once a load.</summary>
    [HttpGet]
    public async Task<ActionResult<PlaybookFilesDto>> GetPlaybookFiles(CancellationToken ct)
    {
        var names = (await db.Statuses.AsNoTracking().ToListAsync(ct)).ToDictionary(s => s.Id, s => s.Name);

        var rows = await db.PlaybookFiles.AsNoTracking()
            .OrderBy(f => f.Canonical).ThenBy(f => f.Trunk)
            .ToListAsync(ct);

        return new PlaybookFilesDto(PlaybookFile.Path, rows.Select(f => ToDto(f, names)).ToList());
    }

    /// <summary>Full stored-row shape GET lists - mirrors TrunkBuildProjection.Project.</summary>
    private static PlaybookFileDto ToDto(EfHatchPlaybookFile f, IReadOnlyDictionary<int, string> names) => new(
        f.Id, f.Remote, f.Canonical, f.Trunk, f.Sha, f.State, f.Hash,
        EfHatchPlaybookFile.ReadRows(f.Rows).Select(r => PlaybookFile.ToDto(r, names)).ToList(),
        f.Problem, f.LastGoodSha, f.LastGoodHash, f.Url, f.CheckedAt, f.Runner, f.CheckedBy);
}
