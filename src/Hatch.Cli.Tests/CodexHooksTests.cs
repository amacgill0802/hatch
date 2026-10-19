using System.Text.Json;

namespace Hatch.Cli.Tests;

/// <summary>The overlay <c>CODEX_HOME</c> a Codex session is handed: its hooks, its copy of the login, and what becomes of both.</summary>
public sealed class CodexHooksTests
{
    private const string Login = "{\"tokens\":{\"access\":\"one\"}}";

    private sealed class Home : IDisposable
    {
        public Home(bool withAuth = true)
        {
            Root = Path.Combine(Path.GetTempPath(), $"hatch-codex-{Guid.NewGuid():N}");
            Real = Path.Combine(Root, "real");
            Temp = Path.Combine(Root, "temp");
            Directory.CreateDirectory(Real);
            Directory.CreateDirectory(Temp);
            if (withAuth) File.WriteAllText(RealAuth, Login);
        }

        public string Root { get; }
        public string Real { get; }
        public string Temp { get; }
        public string RealAuth => Path.Combine(Real, "auth.json");

        public void Dispose() => Directory.Delete(Root, recursive: true);
    }

    [Fact]
    public void The_hooks_file_carries_post_tool_use_and_stop_running_hatch_inbox()
    {
        using var home = new Home();
        using var hooks = CodexHooks.Write(home.Temp, "AER-8", "hatch", rtk: "/usr/bin/rtk", codexHome: home.Real);
        Assert.NotNull(hooks);

        using var file = JsonDocument.Parse(File.ReadAllText(hooks.HooksFile));
        var all = file.RootElement.GetProperty("hooks");
        Assert.False(all.TryGetProperty("PreToolUse", out _));

        var post = all.GetProperty("PostToolUse")[0];
        Assert.Equal("*", post.GetProperty("matcher").GetString());
        var postHook = post.GetProperty("hooks")[0];
        Assert.Equal("command", postHook.GetProperty("type").GetString());
        Assert.Equal(10, postHook.GetProperty("timeout").GetInt32());
        var command = postHook.GetProperty("command").GetString()!;
        Assert.Contains("\"hatch\" inbox \"AER-8\" --hook post-tool-use", command);
        Assert.Contains($"--stamp \"{hooks.Stamp}\"", command);
        Assert.Contains($"--clamp \"{hooks.Clamp}\"", command);
        Assert.Contains($"--budget \"{hooks.Budget}\"", command);

        var stop = all.GetProperty("Stop")[0];
        Assert.False(stop.TryGetProperty("matcher", out _));
        var stopHook = stop.GetProperty("hooks")[0];
        Assert.Equal("command", stopHook.GetProperty("type").GetString());
        Assert.Equal(10, stopHook.GetProperty("timeout").GetInt32());
        Assert.Contains("--hook stop", stopHook.GetProperty("command").GetString());
    }

    [Fact]
    public void The_directory_is_the_codex_home_and_holds_every_path_and_goes_on_dispose()
    {
        using var home = new Home();
        var hooks = CodexHooks.Write(home.Temp, "AER-8", "hatch", codexHome: home.Real);
        Assert.NotNull(hooks);

        Assert.Equal(hooks.Directory, hooks.Opaque);
        Assert.Equal(home.Temp, Path.GetDirectoryName(hooks.Directory));
        foreach (var path in new[] { hooks.Stamp, hooks.Clamp, hooks.ClampDelivered, hooks.Budget })
            Assert.Equal(hooks.Directory, Path.GetDirectoryName(path));
        Assert.Equal(".delivered", Path.GetExtension(hooks.ClampDelivered));

        hooks.Dispose();
        Assert.False(Directory.Exists(hooks.Directory));
    }

    [Fact]
    public void The_login_is_copied_byte_for_byte_and_the_real_one_is_left_alone()
    {
        using var home = new Home();
        using var hooks = CodexHooks.Write(home.Temp, "AER-8", "hatch", codexHome: home.Real);
        Assert.NotNull(hooks);

        var copy = Path.Combine(hooks.Directory, "auth.json");
        Assert.Equal(File.ReadAllBytes(home.RealAuth), File.ReadAllBytes(copy));
        Assert.Equal(Login, File.ReadAllText(home.RealAuth));
        if (!OperatingSystem.IsWindows())
            Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite, File.GetUnixFileMode(copy));
    }

    [Fact]
    public void A_refreshed_login_is_written_back_on_dispose()
    {
        using var home = new Home();
        var hooks = CodexHooks.Write(home.Temp, "AER-8", "hatch", codexHome: home.Real);
        Assert.NotNull(hooks);

        const string refreshed = "{\"tokens\":{\"access\":\"two\"}}";
        File.WriteAllText(Path.Combine(hooks.Directory, "auth.json"), refreshed);
        hooks.Dispose();

        Assert.Equal(refreshed, File.ReadAllText(home.RealAuth));
        Assert.False(Directory.Exists(hooks.Directory));
    }

    [Fact]
    public void An_unchanged_login_is_not_written_back()
    {
        using var home = new Home();
        var hooks = CodexHooks.Write(home.Temp, "AER-8", "hatch", codexHome: home.Real);
        Assert.NotNull(hooks);

        // Changed under the overlay's feet, as another session's refresh would be.
        const string other = "{\"tokens\":{\"access\":\"other\"}}";
        File.WriteAllText(home.RealAuth, other);
        hooks.Dispose();

        Assert.Equal(other, File.ReadAllText(home.RealAuth));
    }

    [Fact]
    public void Nothing_is_made_where_the_real_home_has_no_login()
    {
        using var home = new Home(withAuth: false);

        Assert.Null(CodexHooks.Write(home.Temp, "AER-8", "hatch", codexHome: home.Real));
        Assert.Empty(Directory.GetFileSystemEntries(home.Temp));
    }

    [Fact]
    public void A_temp_that_cannot_be_made_answers_null()
    {
        using var home = new Home();
        var file = Path.Combine(home.Root, "a-file");
        File.WriteAllText(file, "");

        Assert.Null(CodexHooks.Write(file, "AER-8", "hatch", codexHome: home.Real));
    }
}
