using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class AnnouncementService : IAnnouncementService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimePublisher _realtimePublisher;

    private static readonly HashSet<string> AllowedPriorities = new(StringComparer.OrdinalIgnoreCase)
    {
        "NORMAL",
        "IMPORTANT",
        "URGENT"
    };

    public AnnouncementService(
        AppDbContext context,
        IManagerScopeService managerScopeService,
        INotificationService notificationService,
        IRealtimePublisher realtimePublisher)
    {
        _context = context;
        _managerScopeService = managerScopeService;
        _notificationService = notificationService;
        _realtimePublisher = realtimePublisher;
    }

    public async Task<AnnouncementListResponseDto> GetManagementAnnouncementsAsync(
        int? propertyId,
        int? buildingId,
        string? status,
        string? priority,
        string? search,
        int page,
        int pageSize,
        int userId,
        bool isAdmin)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = _context.Announcements
            .AsNoTracking()
            .Include(a => a.Property)
            .Include(a => a.Building)
            .Include(a => a.CreatedByUser)
            .AsQueryable();

        // Scope Authorization filtering
        if (!isAdmin)
        {
            var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(userId, isAdmin);
            var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(userId, isAdmin);

            query = query.Where(a =>
                accessiblePropertyIds.Contains(a.PropertyId) &&
                (a.BuildingId == null || accessibleBuildingIds.Contains(a.BuildingId.Value)));
        }

        // Apply filters
        if (propertyId.HasValue && propertyId.Value > 0)
        {
            query = query.Where(a => a.PropertyId == propertyId.Value);
        }

        if (buildingId.HasValue && buildingId.Value > 0)
        {
            query = query.Where(a => a.BuildingId == buildingId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normStatus = status.Trim().ToUpperInvariant();
            query = query.Where(a => a.Status == normStatus);
        }

        if (!string.IsNullOrWhiteSpace(priority))
        {
            var normPriority = priority.Trim().ToUpperInvariant();
            query = query.Where(a => a.Priority == normPriority);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(a => a.Title.Contains(term));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => ToListItemDto(a))
            .ToListAsync();

        return new AnnouncementListResponseDto
        {
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<AnnouncementDetailDto> GetManagementAnnouncementByIdAsync(int id, int userId, bool isAdmin)
    {
        var announcement = await FetchAnnouncementByIdAsync(id);
        if (announcement is null)
        {
            throw new NotFoundException($"ID'si {id} olan duyuru bulunamadı.");
        }

        await EnsureManagementAccessAsync(announcement, userId, isAdmin);

        return ToDetailDto(announcement);
    }

    public async Task<AnnouncementDetailDto> CreateDraftAnnouncementAsync(AnnouncementCreateDto dto, int userId, bool isAdmin)
    {
        // Validate Property existence
        var propertyExists = await _context.Properties.AnyAsync(p => p.Id == dto.PropertyId);
        if (!propertyExists)
        {
            throw new BadRequestException("Belirtilen gayrimenkul bulunamadı.");
        }

        // Validate Building existence and consistency
        if (dto.BuildingId.HasValue && dto.BuildingId.Value > 0)
        {
            var building = await _context.Buildings
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == dto.BuildingId.Value);

            if (building is null)
            {
                throw new BadRequestException("Belirtilen bina bulunamadı.");
            }

            if (building.PropertyId != dto.PropertyId)
            {
                throw new BadRequestException("Seçilen bina, belirtilen gayrimenkule ait değil.");
            }
        }

        // Check manager authorization scope
        if (!isAdmin)
        {
            if (dto.BuildingId.HasValue && dto.BuildingId.Value > 0)
            {
                var canAccessBuilding = await _managerScopeService.CanAccessBuildingAsync(userId, dto.BuildingId.Value, isAdmin);
                if (!canAccessBuilding)
                {
                    throw new ForbiddenException("Belirtilen bina için duyuru oluşturma yetkiniz yok.");
                }
            }
            else
            {
                var canManageProperty = await _managerScopeService.CanManagePropertyAsync(userId, dto.PropertyId, isAdmin);
                if (!canManageProperty)
                {
                    throw new ForbiddenException("Belirtilen gayrimenkul için site geneli duyuru oluşturma yetkiniz yok.");
                }
            }
        }

        var priority = NormalizePriority(dto.Priority);

        var announcement = new Announcement
        {
            PropertyId = dto.PropertyId,
            BuildingId = dto.BuildingId.HasValue && dto.BuildingId.Value > 0 ? dto.BuildingId : null,
            Title = dto.Title.Trim(),
            Content = dto.Content.Trim(),
            Priority = priority,
            Status = "DRAFT",
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Announcements.Add(announcement);
        await _context.SaveChangesAsync();

        var created = await FetchAnnouncementByIdAsync(announcement.Id);
        return ToDetailDto(created!);
    }

    public async Task<AnnouncementDetailDto> UpdateAnnouncementAsync(int id, AnnouncementUpdateDto dto, int userId, bool isAdmin)
    {
        var announcement = await FetchAnnouncementByIdAsync(id);
        if (announcement is null)
        {
            throw new NotFoundException($"ID'si {id} olan duyuru bulunamadı.");
        }

        await EnsureManagementAccessAsync(announcement, userId, isAdmin);

        if (announcement.Status.Equals("CANCELLED", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("İptal edilmiş duyurular düzenlenemez.");
        }

        var priority = NormalizePriority(dto.Priority);

        announcement.Title = dto.Title.Trim();
        announcement.Content = dto.Content.Trim();
        announcement.Priority = priority;
        announcement.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var updated = await FetchAnnouncementByIdAsync(id);
        return ToDetailDto(updated!);
    }

    public async Task<AnnouncementDetailDto> PublishAnnouncementAsync(int id, int userId, bool isAdmin)
    {
        var strategy = _context.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            var announcement = await _context.Announcements
                .Include(a => a.Property)
                .Include(a => a.Building)
                .Include(a => a.CreatedByUser)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (announcement is null)
            {
                throw new NotFoundException($"ID'si {id} olan duyuru bulunamadı.");
            }

            await EnsureManagementAccessAsync(announcement, userId, isAdmin);

            if (announcement.Status.Equals("PUBLISHED", StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestException("Bu duyuru zaten yayınlanmış.");
            }

            if (announcement.Status.Equals("CANCELLED", StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestException("İptal edilmiş duyuru yayınlanamaz.");
            }

            if (!announcement.Status.Equals("DRAFT", StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestException($"Durumu '{announcement.Status}' olan duyuru yayınlanamaz.");
            }

            // Update status
            var now = DateTime.UtcNow;
            announcement.Status = "PUBLISHED";
            announcement.PublishedAt = now;
            announcement.UpdatedAt = now;

            // Resolve target resident user IDs (only active occupancies)
            List<int> targetResidentUserIds;
            if (announcement.BuildingId.HasValue)
            {
                targetResidentUserIds = await _context.UnitOccupancies
                    .AsNoTracking()
                    .Where(uo => uo.IsActive &&
                                 uo.User.IsActive &&
                                 uo.Unit.BuildingId == announcement.BuildingId.Value &&
                                 (uo.EndDate == null || uo.EndDate > now))
                    .Select(uo => uo.UserId)
                    .Distinct()
                    .ToListAsync();
            }
            else
            {
                targetResidentUserIds = await _context.UnitOccupancies
                    .AsNoTracking()
                    .Where(uo => uo.IsActive &&
                                 uo.User.IsActive &&
                                 uo.Unit.Building.PropertyId == announcement.PropertyId &&
                                 (uo.EndDate == null || uo.EndDate > now))
                    .Select(uo => uo.UserId)
                    .Distinct()
                    .ToListAsync();
            }

            // Stage notifications if target residents exist
            List<Notification> createdNotifications = new();
            if (targetResidentUserIds.Count > 0)
            {
                var notificationTitle = $"Yeni Duyuru: {announcement.Title}";
                var notificationMessage = announcement.Content.Length > 150
                    ? $"{announcement.Content[..147]}..."
                    : announcement.Content;

                createdNotifications = await _notificationService.AddNotificationEntitiesForUsersAsync(
                    targetResidentUserIds,
                    notificationTitle,
                    notificationMessage,
                    "ANNOUNCEMENT",
                    "Announcement",
                    announcement.Id,
                    "ANNOUNCEMENT_PUBLISHED");
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            if (createdNotifications.Count > 0)
            {
                var dtos = createdNotifications.Select(n => _notificationService.ToDto(n)).ToList();
                await _realtimePublisher.PublishNotificationsAsync(dtos);
            }

            await _realtimePublisher.PublishActivityFeedInvalidatedAsync("ANNOUNCEMENT");

            return ToDetailDto(announcement);
        });
    }

    public async Task<AnnouncementDetailDto> CancelAnnouncementAsync(int id, int userId, bool isAdmin)
    {
        var announcement = await FetchAnnouncementByIdAsync(id);
        if (announcement is null)
        {
            throw new NotFoundException($"ID'si {id} olan duyuru bulunamadı.");
        }

        await EnsureManagementAccessAsync(announcement, userId, isAdmin);

        if (announcement.Status.Equals("CANCELLED", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Bu duyuru zaten iptal edilmiş.");
        }

        var now = DateTime.UtcNow;
        announcement.Status = "CANCELLED";
        announcement.CancelledAt = now;
        announcement.UpdatedAt = now;

        await _context.SaveChangesAsync();

        var updated = await FetchAnnouncementByIdAsync(id);
        return ToDetailDto(updated!);
    }

    public async Task<AnnouncementListResponseDto> GetResidentAnnouncementsAsync(
        string? priority,
        string? search,
        int page,
        int pageSize,
        int residentUserId)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var now = DateTime.UtcNow;

        // Get resident's active occupancies
        var activeOccupancies = await _context.UnitOccupancies
            .AsNoTracking()
            .Where(uo => uo.UserId == residentUserId &&
                         uo.IsActive &&
                         (uo.EndDate == null || uo.EndDate > now))
            .Select(uo => new { uo.Unit.Building.PropertyId, uo.Unit.BuildingId })
            .ToListAsync();

        if (activeOccupancies.Count == 0)
        {
            return new AnnouncementListResponseDto
            {
                TotalCount = 0,
                Page = page,
                PageSize = pageSize,
                Items = new List<AnnouncementListItemDto>()
            };
        }

        var propertyIds = activeOccupancies.Select(o => o.PropertyId).Distinct().ToList();
        var buildingIds = activeOccupancies.Select(o => o.BuildingId).Distinct().ToList();

        var query = _context.Announcements
            .AsNoTracking()
            .Include(a => a.Property)
            .Include(a => a.Building)
            .Include(a => a.CreatedByUser)
            .Where(a => a.Status == "PUBLISHED" &&
                        ((a.BuildingId == null && propertyIds.Contains(a.PropertyId)) ||
                         (a.BuildingId != null && buildingIds.Contains(a.BuildingId.Value))));

        if (!string.IsNullOrWhiteSpace(priority))
        {
            var normPriority = priority.Trim().ToUpperInvariant();
            query = query.Where(a => a.Priority == normPriority);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(a => a.Title.Contains(term));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(a => a.PublishedAt ?? a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => ToListItemDto(a))
            .ToListAsync();

        return new AnnouncementListResponseDto
        {
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<AnnouncementDetailDto> GetResidentAnnouncementByIdAsync(int id, int residentUserId)
    {
        var announcement = await FetchAnnouncementByIdAsync(id);
        if (announcement is null || !announcement.Status.Equals("PUBLISHED", StringComparison.OrdinalIgnoreCase))
        {
            throw new NotFoundException($"ID'si {id} olan yayınlanmış duyuru bulunamadı.");
        }

        var now = DateTime.UtcNow;

        // Check if resident has active occupancy in announcement scope
        var hasActiveScope = await _context.UnitOccupancies
            .AsNoTracking()
            .Where(uo => uo.UserId == residentUserId &&
                         uo.IsActive &&
                         (uo.EndDate == null || uo.EndDate > now))
            .AnyAsync(uo => announcement.BuildingId.HasValue
                ? uo.Unit.BuildingId == announcement.BuildingId.Value
                : uo.Unit.Building.PropertyId == announcement.PropertyId);

        if (!hasActiveScope)
        {
            throw new ForbiddenException("Bu duyuruya erişim yetkiniz bulunmamaktadır.");
        }

        return ToDetailDto(announcement);
    }

    private async Task<Announcement?> FetchAnnouncementByIdAsync(int id)
    {
        return await _context.Announcements
            .Include(a => a.Property)
            .Include(a => a.Building)
            .Include(a => a.CreatedByUser)
            .FirstOrDefaultAsync(a => a.Id == id);
    }

    private async Task EnsureManagementAccessAsync(Announcement announcement, int userId, bool isAdmin)
    {
        if (isAdmin) return;

        if (announcement.BuildingId.HasValue)
        {
            var canAccessBuilding = await _managerScopeService.CanAccessBuildingAsync(userId, announcement.BuildingId.Value, isAdmin);
            if (!canAccessBuilding)
            {
                throw new ForbiddenException("Bu duyuruya erişim yetkiniz bulunmamaktadır.");
            }
        }
        else
        {
            var canAccessProperty = await _managerScopeService.CanViewPropertyAsync(userId, announcement.PropertyId, isAdmin);
            if (!canAccessProperty)
            {
                throw new ForbiddenException("Bu duyuruya erişim yetkiniz bulunmamaktadır.");
            }
        }
    }

    private static string NormalizePriority(string? priority)
    {
        if (string.IsNullOrWhiteSpace(priority)) return "NORMAL";
        var norm = priority.Trim().ToUpperInvariant();
        return AllowedPriorities.Contains(norm) ? norm : "NORMAL";
    }

    private static AnnouncementListItemDto ToListItemDto(Announcement a)
    {
        return new AnnouncementListItemDto
        {
            Id = a.Id,
            PropertyId = a.PropertyId,
            PropertyName = a.Property?.Name ?? string.Empty,
            BuildingId = a.BuildingId,
            BuildingName = a.Building?.Name,
            Title = a.Title,
            Priority = a.Priority,
            Status = a.Status,
            CreatedByUserId = a.CreatedByUserId,
            CreatedByName = a.CreatedByUser != null
                ? $"{a.CreatedByUser.FirstName} {a.CreatedByUser.LastName}".Trim()
                : string.Empty,
            CreatedAt = a.CreatedAt,
            UpdatedAt = a.UpdatedAt,
            PublishedAt = a.PublishedAt,
            CancelledAt = a.CancelledAt
        };
    }

    private static AnnouncementDetailDto ToDetailDto(Announcement a)
    {
        return new AnnouncementDetailDto
        {
            Id = a.Id,
            PropertyId = a.PropertyId,
            PropertyName = a.Property?.Name ?? string.Empty,
            BuildingId = a.BuildingId,
            BuildingName = a.Building?.Name,
            Title = a.Title,
            Content = a.Content,
            Priority = a.Priority,
            Status = a.Status,
            CreatedByUserId = a.CreatedByUserId,
            CreatedByName = a.CreatedByUser != null
                ? $"{a.CreatedByUser.FirstName} {a.CreatedByUser.LastName}".Trim()
                : string.Empty,
            CreatedAt = a.CreatedAt,
            UpdatedAt = a.UpdatedAt,
            PublishedAt = a.PublishedAt,
            CancelledAt = a.CancelledAt
        };
    }
}
