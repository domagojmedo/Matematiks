namespace Matematiks.Data;

public interface ISessionService
{
    Task<Session> CreateSession();
    Task<Session[]> GetSessionsAsync();
    Task UpdateCounters(int sessionId, int correct, int deleted);
}

public class SessionService(IMatematiksDbContextFactory dbContextFactory) : ISessionService
{
    public async Task<Session> CreateSession()
    {
        using var ctx = await dbContextFactory.CreateContextAsync();
        var session = new Session();

        ctx.Sessions.Add(session);
        await ctx.SaveChangesAsync();

        return session;
    }

    public async Task<Session[]> GetSessionsAsync()
    {
        using var ctx = await dbContextFactory.CreateContextAsync();
        return ctx.Sessions.ToArray();
    }

    public async Task UpdateCounters(int sessionId, int correct, int deleted)
    {
        using var ctx = await dbContextFactory.CreateContextAsync();
        var session = await ctx.Sessions.FindAsync(sessionId);

        if (session != null)
        {
            session.CorrectCounter = correct;
            session.DeleteCounter = deleted;

            await ctx.SaveChangesAsync();
        }
    }
}
