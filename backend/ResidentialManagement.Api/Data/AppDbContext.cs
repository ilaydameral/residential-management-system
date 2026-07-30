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

    public DbSet<PropertyType> PropertyTypes { get; set; }
    public DbSet<Property> Properties { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<PropertyType>(entity =>
        {
            entity.HasIndex(pt => pt.Code).IsUnique();
        });

        modelBuilder.Entity<Property>(entity =>
        {
            entity.HasOne(p => p.PropertyTypeLookup)
                .WithMany()
                .HasForeignKey(p => p.PropertyTypeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PropertyType>().HasData(
            new PropertyType
            {
                Id = 1,
                Name = "Site / Konut Sitesi",
                Code = "RESIDENTIAL_COMPLEX",
                Description = "Çok bloklu veya sosyal tesisli konut sitesi",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new PropertyType
            {
                Id = 2,
                Name = "Apartman",
                Code = "SINGLE_APARTMENT",
                Description = "Tek bloklu konut binası",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new PropertyType
            {
                Id = 3,
                Name = "Ticari Kompleks",
                Code = "COMMERCIAL",
                Description = "İş merkezi, çarşı veya ticari kompleks",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new PropertyType
            {
                Id = 4,
                Name = "Karma Kullanım",
                Code = "MIXED_USE",
                Description = "Hem konut hem ticari birimleri olan kompleks",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}