using Microsoft.EntityFrameworkCore;

namespace Matematiks.Data;

public class MatematiksDbContext : DbContext
{
    public MatematiksDbContext(DbContextOptions<MatematiksDbContext> opts) : base(opts)
    { }

    public DbSet<Session> Sessions => Set<Session>();
}

public class Session
{
    public int Id { get; set; }

    public DateTime Created { get; set; } = DateTime.UtcNow;

    public int CorrectCounter { get; set; }

    public int DeleteCounter { get; set; }
}
