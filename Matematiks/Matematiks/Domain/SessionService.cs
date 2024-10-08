using Blazored.LocalStorage;
using Matematiks.Domain.Entities;

namespace Matematiks.Domain;

public interface ISessionService
{
    List<Session> GetSessions();
    void SaveSession(Session session);
}

public class SessionService : ISessionService
{
    private readonly ISyncLocalStorageService _storage;

    public SessionService(ISyncLocalStorageService storage)
    {
        _storage = storage;
    }

    public void SaveSession(Session session)
    {
        var sessions = GetSessions();

        var existingSession = sessions.FirstOrDefault(x => x.Id == session.Id);

        if (existingSession is null)
        {
            sessions.Add(session);
        }
        else
        {
            existingSession.CorrectCounter = session.CorrectCounter;
            existingSession.DeleteCounter = session.DeleteCounter;
        }

        _storage.SetItem("sessions", sessions);
    }

    public List<Session> GetSessions()
    {
        var sessions = _storage.GetItem<List<Session>>("sessions") ?? [];

        return sessions;
    }
}
