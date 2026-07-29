using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Entities;

namespace ResidentialManagement.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(
        DbContextOptions<AppDbContext> options
    ) : base(options)
    {
    }

    public DbSet<Property> Properties { get; set; }
}