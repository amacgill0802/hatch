using Hatch.Api.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// The questions a move gate asks about the caller: is this person an
/// owner of the project, may this person approve on it, and may this person
/// move an issue into a given status at all.
/// </summary>
public interface IProjectAccess
{
    Task<bool> IsOwnerAsync(int projectId, CancellationToken ct);
    Task<bool> CanApproveAsync(int projectId, CancellationToken ct);
    Task<bool> CanMoveIntoAsync(int projectId, EfHatchStatus status, CancellationToken ct);
}

/// <summary>
/// Answers both questions about the caller, never about an arbitrary person -
/// that is the whole question a move gate needs answered, and the only one
/// this service exists to answer. A key or a keyless program is never an
/// owner or approver, so it answers <c>false</c> for one without a query.
/// </summary>
public class ProjectAccess(HatchContext db, IActorDirectory actors) : IProjectAccess
{
    public Task<bool> IsOwnerAsync(int projectId, CancellationToken ct) =>
        HasRoleAsync(projectId, ProjectMemberRole.Owner, ct);

    public async Task<bool> CanApproveAsync(int projectId, CancellationToken ct) =>
        await HasRoleAsync(projectId, ProjectMemberRole.Owner, ct) || await HasRoleAsync(projectId, ProjectMemberRole.Approver, ct);

    public async Task<bool> CanMoveIntoAsync(int projectId, EfHatchStatus status, CancellationToken ct) =>
        !status.IsProtected || await CanApproveAsync(projectId, ct);

    private async Task<bool> HasRoleAsync(int projectId, string role, CancellationToken ct)
    {
        var me = await actors.MeAsync(ct);
        if (me is not { Kind: ActorKind.Person }) return false;

        return await db.ProjectMembers.AnyAsync(m => m.ProjectId == projectId && m.PersonId == me.Id && m.Role == role, ct);
    }
}
