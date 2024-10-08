namespace Matematiks.Domain.Entities;

public class Session
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime Created { get; set; } = DateTime.Now;

    public int CorrectCounter { get; set; }

    public int DeleteCounter { get; set; }

    public DateTime LastActionTime { get; set; } = DateTime.Now;

    public TimeSpan Duration => LastActionTime - Created;
}