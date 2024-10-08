using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop;

namespace Matematiks.Data;


public interface IMatematiksDbContextFactory
{
    Task<MatematiksDbContext> CreateContextAsync();
}

public class MatematiksDbContextFactory : IMatematiksDbContextFactory
{
    private readonly IDbContextFactory<MatematiksDbContext> _factory;
    private readonly IJSRuntime _js;
    private Task<int>? lastTask = null;
    private int lastStatus = -2;
    private bool init = false;
    private string backupName = backup;

    public const string backup = $"{dbFilename}_bak";
    public const string dbFilename = "matematiks.sqlite3";

    public MatematiksDbContextFactory(IJSRuntime js, IDbContextFactory<MatematiksDbContext> dbContextFactory)
    {
        _js = js;
        _factory = dbContextFactory;

        lastTask = SynchronizeAsync();
        _factory = dbContextFactory;
    }

    public async Task<MatematiksDbContext> CreateContextAsync()
    {
        await CheckForPendingTasksAsync();
        var ctx = await _factory.CreateDbContextAsync();

        if (!init)
        {
            Console.WriteLine($"Last status: {lastStatus}");
            await ctx.Database.EnsureCreatedAsync();
            init = true;
        }

        ctx.SavedChanges += Ctx_SavedChanges;

        return ctx;
    }

    private async Task CheckForPendingTasksAsync()
    {
        if (lastTask != null)
        {
            lastStatus = await lastTask;
            lastTask.Dispose();
            lastTask = null;
            if (lastStatus == 0)
            {
                Restore();
            }
        }
    }

    private void Ctx_SavedChanges(object? sender, SavedChangesEventArgs e) => lastTask = SynchronizeAsync();

    private async Task<int> SynchronizeAsync()
    {
        if (init)
        {
            Backup();
        }

        var result = await _js.InvokeAsync<int>("db.synchronizeDbWithCache", backupName);
        var resultText = result == -1 ? "Failure" : (result == 0 ? "Restored" : "Cached");
        Console.WriteLine($"Synchronization status: {resultText}");
        return result;
    }

    private void Backup() => DoSwap(false);
    private void Restore() => DoSwap(true);

    private void DoSwap(bool restore)
    {
        backupName = restore ? backup : $"{backup}-{Guid.NewGuid().ToString().Split('-')[0]}";
        var dir = restore ? nameof(restore) : nameof(backup);
        Console.WriteLine($"Begin {dir}.");

        var source = restore ? $"Data Source={backupName}" : $"Data Source={dbFilename}";
        var target = restore ? $"Data Source={dbFilename}" : $"Data Source={backupName}";
        using var src = new SqliteConnection(source);
        using var tgt = new SqliteConnection(target);

        src.Open();
        tgt.Open();

        src.BackupDatabase(tgt);

        tgt.Close();
        src.Close();

        Console.WriteLine($"End {dir}.");
    }
}
