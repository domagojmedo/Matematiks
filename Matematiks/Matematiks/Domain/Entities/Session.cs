namespace Matematiks.Domain.Entities;

public class Session
{
    public Session(SessionType sessionType)
    {
        SessionType = sessionType;
    }

    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime Created { get; set; } = DateTime.Now;

    public int CorrectCounter { get; set; }

    public int DeleteCounter { get; set; }

    public DateTime LastActionTime { get; set; } = DateTime.Now;

    public SessionType SessionType { get; set; }

    public TimeSpan Duration => LastActionTime - Created;
}

public enum SessionType
{
    Addition = 1,
    Subtraction = 2,
    Multiplication = 3,
    Division = 4
}