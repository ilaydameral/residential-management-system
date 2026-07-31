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
    public DbSet<UnitType> UnitTypes { get; set; }
    public DbSet<Property> Properties { get; set; }
    public DbSet<Building> Buildings { get; set; }
    public DbSet<Unit> Units { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<PropertyType>(entity =>
        {
            entity.HasIndex(pt => pt.Code).IsUnique();
        });

        modelBuilder.Entity<UnitType>(entity =>
        {
            entity.HasIndex(ut => ut.Code).IsUnique();
        });

        modelBuilder.Entity<Property>(entity =>
        {
            entity.HasOne(p => p.PropertyTypeLookup)
                .WithMany()
                .HasForeignKey(p => p.PropertyTypeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Building>(entity =>
        {
            entity.HasOne(b => b.Property)
                .WithMany(p => p.Buildings)
                .HasForeignKey(b => b.PropertyId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(b => new { b.PropertyId, b.Code })
                .IsUnique();

            entity.ToTable(t => t.HasCheckConstraint(
                "CK_Buildings_FloorCount_Range",
                "[FloorCount] >= 1 AND [FloorCount] <= 200"));
        });

        modelBuilder.Entity<Unit>(entity =>
        {
            entity.HasOne(u => u.Building)
                .WithMany(b => b.Units)
                .HasForeignKey(u => u.BuildingId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(u => u.UnitType)
                .WithMany(ut => ut.Units)
                .HasForeignKey(u => u.UnitTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(u => new { u.BuildingId, u.UnitNumber })
                .IsUnique();

            entity.Property(u => u.GrossArea)
                .HasColumnType("decimal(10,2)");

            entity.Property(u => u.NetArea)
                .HasColumnType("decimal(10,2)");

            entity.ToTable(t =>
            {
                t.HasCheckConstraint(
                    "CK_Units_GrossArea_Positive",
                    "[GrossArea] IS NULL OR [GrossArea] > 0");

                t.HasCheckConstraint(
                    "CK_Units_NetArea_Positive",
                    "[NetArea] IS NULL OR [NetArea] > 0");

                t.HasCheckConstraint(
                    "CK_Units_NetArea_NotGreaterThanGrossArea",
                    "[GrossArea] IS NULL OR [NetArea] IS NULL OR [NetArea] <= [GrossArea]");
            });
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

        modelBuilder.Entity<UnitType>().HasData(
            new UnitType
            {
                Id = 1,
                Name = "Daire",
                Code = "APARTMENT",
                Description = "Konut / Mesken birimi",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new UnitType
            {
                Id = 2,
                Name = "Dükkan",
                Code = "SHOP",
                Description = "Ticari dükkan veya mağaza",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new UnitType
            {
                Id = 3,
                Name = "Ofis",
                Code = "OFFICE",
                Description = "Büro veya çalışma alanı",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new UnitType
            {
                Id = 4,
                Name = "Depo",
                Code = "STORAGE",
                Description = "Bağımsız depo veya sığınak alanı",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new UnitType
            {
                Id = 5,
                Name = "Otopark Alanı",
                Code = "PARKING_SPACE",
                Description = "Tahsisli araç park yeri",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}