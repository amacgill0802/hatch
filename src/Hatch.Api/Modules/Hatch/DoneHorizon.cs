using Microsoft.Extensions.Options;

namespace Hatch.Api.Modules.Hatch;

/// <summary>
/// The one horizon past which a terminal card stops being handed over on the
/// board - see <see cref="HatchOptions.DoneHorizonHours"/>.
///
/// A class rather than a static for the reason <see cref="Runners"/> is one:
/// it holds a configured number and nothing else, and every judgement it
/// makes takes the instant it is judging against rather than reading a clock.
/// </summary>
public sealed class DoneHorizon(IOptions<HatchOptions> options)
{
    /// <summary>
    /// The horizon itself, in hours. Guarded here and nowhere else: zero is
    /// kept as the operator's own choice to turn the fold off, and only a
    /// negative value - which nothing before this could ever have meant -
    /// falls back to the default.
    /// </summary>
    public int Hours { get; } = options.Value.DoneHorizonHours switch
    {
        0 => 0,
        > 0 => options.Value.DoneHorizonHours,
        _ => new HatchOptions().DoneHorizonHours,
    };

    /// <summary>The instant at or after which a terminal card's ClosedAt still hands it over, or null where the fold is off.</summary>
    public DateTimeOffset? Cutoff(DateTimeOffset now) => Hours > 0 ? now.AddHours(-Hours) : null;
}
