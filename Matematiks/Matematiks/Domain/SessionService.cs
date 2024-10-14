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

        var sessionIndex = sessions.FindIndex(x => x.Id == session.Id);

        if (sessionIndex == -1)
        {
            sessions.Add(session);
        }
        else
        {
            sessions[sessionIndex] = session;
        }

        _storage.SetItem("sessions", sessions);
    }

    public List<Session> GetSessions()
    {
        var sessions = _storage.GetItem<List<Session>>("sessions") ?? [];

        // fix for older values before SessionType was introduced
        sessions = sessions.Select(x =>
            {
                if (x.SessionType == 0)
                {
                    x.SessionType = SessionType.Addition;
                }

                return x;
            })
            .ToList();

        return sessions;
    }
}
