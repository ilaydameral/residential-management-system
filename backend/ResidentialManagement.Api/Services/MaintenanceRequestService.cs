using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Authorization;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class MaintenanceRequestService : IMaintenanceRequestService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;
    private readonly INotificationService _notificationService;
    private readonly IRequestFileStorageService _fileStorageService;
    private readonly IRealtimePublisher _realtimePublisher;

    private static readonly HashSet<string> AllowedCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "PLUMBING", "ELECTRICAL", "HEATING_COOLING", "ELEVATOR", "CLEANING", "SECURITY", "STRUCTURAL", "OTHER"
    };

    private static readonly HashSet<string> AllowedPriorities = new(StringComparer.OrdinalIgnoreCase)
    {
        "LOW", "NORMAL", "HIGH", "EMERGENCY"
    };

    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"
    };

    public MaintenanceRequestService(
        AppDbContext context,
        IManagerScopeService managerScopeService,
        INotificationService notificationService,
        IRequestFileStorageService fileStorageService,
        IRealtimePublisher realtimePublisher)
    {
        _context = context;
        _managerScopeService = managerScopeService;
        _notificationService = notificationService;
        _fileStorageService = fileStorageService;
        _realtimePublisher = realtimePublisher;
    }

    public async Task<MaintenanceRequestDetailDto> CreateRequestAsync(MaintenanceRequestCreateDto dto, int residentUserId)
    {
        var category = NormalizeCategory(dto.Category);
        var now = DateTime.UtcNow;

        // Verify resident has active occupancy for unit
        var occupancy = await _context.UnitOccupancies
            .AsNoTracking()
            .Include(uo => uo.Unit)
            .ThenInclude(u => u.Building)
            .FirstOrDefaultAsync(uo => uo.UnitId == dto.UnitId &&
                                       uo.UserId == residentUserId &&
                                       uo.IsActive &&
                                       (uo.EndDate == null || uo.EndDate > now));

        if (occupancy is null)
        {
            throw new ForbiddenException("Bu daire için bakım talebi oluşturma yetkiniz bulunmamaktadır.");
        }

        var propertyId = occupancy.Unit.Building.PropertyId;
        var buildingId = occupancy.Unit.BuildingId;

        var strategy = _context.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            var request = new MaintenanceRequest
            {
                RequestNumber = "TEMP",
                UnitId = dto.UnitId,
                PropertyId = propertyId,
                BuildingId = buildingId,
                CreatedByUserId = residentUserId,
                AssignedToUserId = null,
                Category = category,
                Title = dto.Title.Trim(),
                Description = dto.Description.Trim(),
                Priority = "NORMAL",
                Status = "OPEN",
                CreatedAt = now
            };

            _context.MaintenanceRequests.Add(request);
            await _context.SaveChangesAsync();

            // Deterministic, unique RequestNumber generation based on Id
            request.RequestNumber = $"REQ-{now:yyyyMMdd}-{request.Id:D4}";

            // Record CREATED history
            var history = new MaintenanceRequestHistory
            {
                MaintenanceRequestId = request.Id,
                ActionType = "CREATED",
                OldStatus = null,
                NewStatus = "OPEN",
                ChangedByUserId = residentUserId,
                Note = "Bakım talebi oluşturuldu.",
                CreatedAt = now
            };

            _context.MaintenanceRequestHistories.Add(history);

            // Notify scoped managers
            List<Notification> createdNotifications = new();
            var propertyManagers = await _context.ManagerAssignments
                .AsNoTracking()
                .Where(ma => ma.IsActive &&
                             ma.ManagerUser.IsActive &&
                             ma.PropertyId == propertyId &&
                             (ma.BuildingId == null || ma.BuildingId == buildingId))
                .Select(ma => ma.ManagerUserId)
                .Distinct()
                .ToListAsync();

            if (propertyManagers.Count > 0)
            {
                var notificationTitle = $"Yeni Talep: #{request.RequestNumber}";
                var notificationMessage = $"{request.Title} ({request.Category})";

                createdNotifications = await _notificationService.AddNotificationEntitiesForUsersAsync(
                    propertyManagers,
                    notificationTitle,
                    notificationMessage,
                    "REQUEST",
                    "MaintenanceRequest",
                    request.Id,
                    "REQUEST_CREATED");
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            if (createdNotifications.Count > 0)
            {
                var dtos = createdNotifications.Select(n => _notificationService.ToDto(n)).ToList();
                await _realtimePublisher.PublishNotificationsAsync(dtos);
            }

            var recipients = await ResolveMaintenanceEventRecipientsAsync(propertyId, buildingId, residentUserId, null);
            await _realtimePublisher.PublishMaintenanceRequestUpdatedAsync(new MaintenanceRequestUpdatedEvent
            {
                RequestId = request.Id,
                PropertyId = propertyId,
                BuildingId = buildingId,
                EventType = "CREATED",
                UpdatedAt = request.CreatedAt.ToString("o"),
                NewStatus = "OPEN",
                UpdatedByUserId = residentUserId
            }, recipients);

            var created = await FetchRequestDetailByIdAsync(request.Id);
            return ToDetailDto(created!);
        });
    }

    public async Task<MaintenanceRequestListResponseDto> GetResidentRequestsAsync(string? status, string? category, int page, int pageSize, int residentUserId)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = _context.MaintenanceRequests
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .Where(r => r.CreatedByUserId == residentUserId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normStatus = status.Trim().ToUpperInvariant();
            query = query.Where(r => r.Status == normStatus);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var normCategory = category.Trim().ToUpperInvariant();
            query = query.Where(r => r.Category == normCategory);
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => ToListItemDto(r))
            .ToListAsync();

        return new MaintenanceRequestListResponseDto
        {
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<MaintenanceRequestDetailDto> GetResidentRequestByIdAsync(int id, int residentUserId)
    {
        var request = await FetchRequestDetailByIdAsync(id);
        if (request is null || request.CreatedByUserId != residentUserId)
        {
            throw new NotFoundException($"ID'si {id} olan talep bulunamadı.");
        }

        return ToDetailDto(request);
    }

    public async Task<MaintenanceRequestDetailDto> CancelResidentRequestAsync(int id, int residentUserId)
    {
        var request = await _context.MaintenanceRequests
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null || request.CreatedByUserId != residentUserId)
        {
            throw new NotFoundException($"ID'si {id} olan talep bulunamadı.");
        }

        if (!request.Status.Equals("OPEN", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Yalnızca 'OPEN' (Açık) durumundaki taleplerinizi iptal edebilirsiniz.");
        }

        var now = DateTime.UtcNow;
        var oldStatus = request.Status;

        request.Status = "CANCELLED";
        request.CancelledAt = now;
        request.UpdatedAt = now;

        var history = new MaintenanceRequestHistory
        {
            MaintenanceRequestId = request.Id,
            ActionType = "CANCELLED",
            OldStatus = oldStatus,
            NewStatus = "CANCELLED",
            ChangedByUserId = residentUserId,
            Note = "Sakin tarafından talep iptal edildi.",
            CreatedAt = now
        };

        _context.MaintenanceRequestHistories.Add(history);

        // Notify assigned staff if present
        List<Notification> createdNotifications = new();
        if (request.AssignedToUserId.HasValue)
        {
            createdNotifications = await _notificationService.AddNotificationEntitiesForUsersAsync(
                new[] { request.AssignedToUserId.Value },
                $"Talep İptal Edildi: #{request.RequestNumber}",
                $"Sakin {request.Title} talebini iptal etti.",
                "REQUEST",
                "MaintenanceRequest",
                request.Id,
                "REQUEST_CANCELLED");
        }

        await _context.SaveChangesAsync();

        if (createdNotifications.Count > 0)
        {
            var dtos = createdNotifications.Select(n => _notificationService.ToDto(n)).ToList();
            await _realtimePublisher.PublishNotificationsAsync(dtos);
        }

        var recipients = await ResolveMaintenanceEventRecipientsAsync(request.PropertyId, request.BuildingId, request.CreatedByUserId, request.AssignedToUserId);
        await _realtimePublisher.PublishMaintenanceRequestUpdatedAsync(new MaintenanceRequestUpdatedEvent
        {
            RequestId = request.Id,
            PropertyId = request.PropertyId,
            BuildingId = request.BuildingId,
            EventType = "CANCELLED",
            UpdatedAt = now.ToString("o"),
            OldStatus = oldStatus,
            NewStatus = "CANCELLED",
            AssignedToUserId = request.AssignedToUserId,
            UpdatedByUserId = residentUserId
        }, recipients);

        var updated = await FetchRequestDetailByIdAsync(id);
        return ToDetailDto(updated!);
    }

    public async Task<MaintenanceRequestDetailDto> UpdateResidentResolvedRequestStatusAsync(int id, string newStatus, string? note, int residentUserId)
    {
        var request = await _context.MaintenanceRequests
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null || request.CreatedByUserId != residentUserId)
        {
            throw new NotFoundException($"ID'si {id} olan talep bulunamadı.");
        }

        if (!request.Status.Equals("RESOLVED", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Yalnızca 'RESOLVED' (Çözüldü) durumundaki talepler kapatılabilir veya yeniden açılabilir.");
        }

        var targetStatus = newStatus.Trim().ToUpperInvariant();
        var now = DateTime.UtcNow;
        var oldStatus = request.Status;
        List<Notification> createdNotifications = new();

        if (targetStatus == "CLOSED")
        {
            request.Status = "CLOSED";
            request.ClosedAt = now;
            request.UpdatedAt = now;

            _context.MaintenanceRequestHistories.Add(new MaintenanceRequestHistory
            {
                MaintenanceRequestId = request.Id,
                ActionType = "CLOSED",
                OldStatus = oldStatus,
                NewStatus = "CLOSED",
                ChangedByUserId = residentUserId,
                Note = !string.IsNullOrWhiteSpace(note) ? note.Trim() : "Sakin çözümü onayladı ve talebi kapattı.",
                CreatedAt = now
            });
        }
        else if (targetStatus == "IN_PROGRESS")
        {
            request.Status = "IN_PROGRESS";
            request.ResolvedAt = null;
            request.UpdatedAt = now;

            _context.MaintenanceRequestHistories.Add(new MaintenanceRequestHistory
            {
                MaintenanceRequestId = request.Id,
                ActionType = "REOPENED",
                OldStatus = oldStatus,
                NewStatus = "IN_PROGRESS",
                ChangedByUserId = residentUserId,
                Note = !string.IsNullOrWhiteSpace(note) ? note.Trim() : "Sakin sorunun devam ettiğini belirterek talebi yeniden açtı.",
                CreatedAt = now
            });

            // Notify assigned technician if present
            if (request.AssignedToUserId.HasValue)
            {
                createdNotifications = await _notificationService.AddNotificationEntitiesForUsersAsync(
                    new[] { request.AssignedToUserId.Value },
                    $"Talep Yeniden Açıldı: #{request.RequestNumber}",
                    $"Sakin #{request.RequestNumber} talebini yeniden açtı.",
                    "REQUEST",
                    "MaintenanceRequest",
                    request.Id,
                    "REQUEST_REOPENED");
            }
        }
        else
        {
            throw new BadRequestException("Geçersiz durum geçişi. Yalnızca 'CLOSED' veya 'IN_PROGRESS' seçilebilir.");
        }

        await _context.SaveChangesAsync();

        if (createdNotifications.Count > 0)
        {
            var dtos = createdNotifications.Select(n => _notificationService.ToDto(n)).ToList();
            await _realtimePublisher.PublishNotificationsAsync(dtos);
        }

        var eventType = targetStatus == "CLOSED" ? "CLOSED" : "REOPENED";
        var recipients = await ResolveMaintenanceEventRecipientsAsync(request.PropertyId, request.BuildingId, request.CreatedByUserId, request.AssignedToUserId);
        await _realtimePublisher.PublishMaintenanceRequestUpdatedAsync(new MaintenanceRequestUpdatedEvent
        {
            RequestId = request.Id,
            PropertyId = request.PropertyId,
            BuildingId = request.BuildingId,
            EventType = eventType,
            UpdatedAt = now.ToString("o"),
            OldStatus = oldStatus,
            NewStatus = targetStatus,
            AssignedToUserId = request.AssignedToUserId,
            UpdatedByUserId = residentUserId
        }, recipients);

        var updated = await FetchRequestDetailByIdAsync(id);
        return ToDetailDto(updated!);
    }

    public async Task<MaintenanceRequestAttachmentDto> AddAttachmentAsync(int requestId, Stream fileStream, string originalFileName, string contentType, int userId, bool isAdmin)
    {
        var request = await _context.MaintenanceRequests.FirstOrDefaultAsync(r => r.Id == requestId);
        if (request is null)
        {
            throw new NotFoundException($"ID'si {requestId} olan talep bulunamadı.");
        }

        // Authorization check
        if (!isAdmin)
        {
            var isCreator = request.CreatedByUserId == userId;
            var isAssigned = request.AssignedToUserId == userId;
            var canManage = await _managerScopeService.CanAccessBuildingAsync(userId, request.BuildingId, isAdmin);

            if (!isCreator && !isAssigned && !canManage)
            {
                throw new ForbiddenException("Bu talebe dosya ekleme yetkiniz yok.");
            }
        }

        // Validate max 3 attachments limit
        var currentAttachmentCount = await _context.MaintenanceRequestAttachments.CountAsync(a => a.MaintenanceRequestId == requestId);
        if (currentAttachmentCount >= 3)
        {
            throw new BadRequestException("Bir talebe en fazla 3 dosya eklenebilir.");
        }

        // Save file to storage
        var (storageKey, fileSizeBytes) = await _fileStorageService.SaveAttachmentAsync(fileStream, originalFileName, contentType);

        var attachment = new MaintenanceRequestAttachment
        {
            MaintenanceRequestId = requestId,
            OriginalFileName = Path.GetFileName(originalFileName),
            StorageKey = storageKey,
            ContentType = contentType,
            FileSizeBytes = fileSizeBytes,
            UploadedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.MaintenanceRequestAttachments.Add(attachment);
        await _context.SaveChangesAsync();

        var uploader = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        return new MaintenanceRequestAttachmentDto
        {
            Id = attachment.Id,
            OriginalFileName = attachment.OriginalFileName,
            ContentType = attachment.ContentType,
            FileSizeBytes = attachment.FileSizeBytes,
            UploadedByUserId = userId,
            UploadedByName = uploader != null ? $"{uploader.FirstName} {uploader.LastName}".Trim() : string.Empty,
            CreatedAt = attachment.CreatedAt
        };
    }

    public async Task<(Stream FileStream, string ContentType, string OriginalFileName)> GetAttachmentStreamAsync(int requestId, int attachmentId, int userId, bool isAdmin)
    {
        var attachment = await _context.MaintenanceRequestAttachments
            .Include(a => a.MaintenanceRequest)
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.MaintenanceRequestId == requestId);

        if (attachment is null)
        {
            throw new NotFoundException("Dosya kaydı bulunamadı.");
        }

        var request = attachment.MaintenanceRequest;

        // Authorization check
        if (!isAdmin)
        {
            var isCreator = request.CreatedByUserId == userId;
            var isAssigned = request.AssignedToUserId == userId;
            var canManage = await _managerScopeService.CanAccessBuildingAsync(userId, request.BuildingId, isAdmin);

            if (!isCreator && !isAssigned && !canManage)
            {
                throw new ForbiddenException("Bu dosyayı görüntüleme yetkiniz yok.");
            }
        }

        var fileStream = _fileStorageService.OpenAttachmentStream(attachment.StorageKey);
        return (fileStream, attachment.ContentType, attachment.OriginalFileName);
    }

    public async Task<MaintenanceRequestListResponseDto> GetManagementRequestsAsync(
        int? propertyId,
        int? buildingId,
        int? unitId,
        string? status,
        string? priority,
        string? category,
        int? assignedToUserId,
        string? search,
        int page,
        int pageSize,
        int userId,
        bool isAdmin)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = _context.MaintenanceRequests
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .AsQueryable();

        // Scope authorization filtering for Managers
        if (!isAdmin)
        {
            var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(userId, isAdmin);
            var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(userId, isAdmin);

            query = query.Where(r =>
                accessiblePropertyIds.Contains(r.PropertyId) &&
                accessibleBuildingIds.Contains(r.BuildingId));
        }

        if (propertyId.HasValue && propertyId.Value > 0) query = query.Where(r => r.PropertyId == propertyId.Value);
        if (buildingId.HasValue && buildingId.Value > 0) query = query.Where(r => r.BuildingId == buildingId.Value);
        if (unitId.HasValue && unitId.Value > 0) query = query.Where(r => r.UnitId == unitId.Value);
        if (assignedToUserId.HasValue && assignedToUserId.Value > 0) query = query.Where(r => r.AssignedToUserId == assignedToUserId.Value);

        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(r => r.Status == status.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(priority)) query = query.Where(r => r.Priority == priority.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(r => r.Category == category.Trim().ToUpperInvariant());

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r => r.Title.Contains(term) || r.RequestNumber.Contains(term));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => ToListItemDto(r))
            .ToListAsync();

        return new MaintenanceRequestListResponseDto
        {
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<MaintenanceRequestDetailDto> GetManagementRequestByIdAsync(int id, int userId, bool isAdmin)
    {
        var request = await FetchRequestDetailByIdAsync(id);
        if (request is null)
        {
            throw new NotFoundException($"ID'si {id} olan talep bulunamadı.");
        }

        if (!isAdmin)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(userId, request.BuildingId, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu talebe erişim yetkiniz bulunmamaktadır.");
            }
        }

        return ToDetailDto(request);
    }

    public async Task<MaintenanceRequestDetailDto> AssignTechnicianAsync(int requestId, int assignedToUserId, int userId, bool isAdmin)
    {
        var request = await _context.MaintenanceRequests
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request is null)
        {
            throw new NotFoundException($"ID'si {requestId} olan talep bulunamadı.");
        }

        if (!isAdmin)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(userId, request.BuildingId, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu talebe personel atama yetkiniz bulunmamaktadır.");
            }
        }

        if (request.Status.Equals("CLOSED", StringComparison.OrdinalIgnoreCase) ||
            request.Status.Equals("CANCELLED", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Kapatılmış veya iptal edilmiş taleplere personel atanamaz.");
        }

        // Verify target user has TECHNICAL_STAFF role
        var techUser = await _context.Users
            .AsNoTracking()
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == assignedToUserId && u.IsActive);

        if (techUser is null || !techUser.UserRoles.Any(ur => ur.Role.Code == AppRoles.TechnicalStaff))
        {
            throw new BadRequestException("Seçilen kullanıcı aktif bir teknik personel (TECHNICAL_STAFF) değil.");
        }

        var oldAssignedId = request.AssignedToUserId;
        if (oldAssignedId == assignedToUserId)
        {
            // Same technician already assigned
            return ToDetailDto(await FetchRequestDetailByIdAsync(requestId) ?? request);
        }

        var now = DateTime.UtcNow;
        request.AssignedToUserId = assignedToUserId;
        request.UpdatedAt = now;

        var history = new MaintenanceRequestHistory
        {
            MaintenanceRequestId = requestId,
            ActionType = "ASSIGNED",
            OldAssignedToUserId = oldAssignedId,
            NewAssignedToUserId = assignedToUserId,
            ChangedByUserId = userId,
            Note = $"Talep {techUser.FirstName} {techUser.LastName} kullanıcısına atandı.",
            CreatedAt = now
        };

        _context.MaintenanceRequestHistories.Add(history);

        // Notify technician
        var createdNotifications = await _notificationService.AddNotificationEntitiesForUsersAsync(
            new[] { assignedToUserId },
            $"Size Yeni Talep Atandı: #{request.RequestNumber}",
            $"{request.Title} ({request.Category})",
            "REQUEST",
            "MaintenanceRequest",
            request.Id,
            "REQUEST_ASSIGNED");

        await _context.SaveChangesAsync();

        if (createdNotifications.Count > 0)
        {
            var dtos = createdNotifications.Select(n => _notificationService.ToDto(n)).ToList();
            await _realtimePublisher.PublishNotificationsAsync(dtos);
        }

        var recipients = await ResolveMaintenanceEventRecipientsAsync(request.PropertyId, request.BuildingId, request.CreatedByUserId, assignedToUserId, oldAssignedId);
        await _realtimePublisher.PublishMaintenanceRequestUpdatedAsync(new MaintenanceRequestUpdatedEvent
        {
            RequestId = request.Id,
            PropertyId = request.PropertyId,
            BuildingId = request.BuildingId,
            EventType = "ASSIGNED",
            UpdatedAt = now.ToString("o"),
            AssignedToUserId = assignedToUserId,
            OldAssignedToUserId = oldAssignedId,
            UpdatedByUserId = userId
        }, recipients);

        var updated = await FetchRequestDetailByIdAsync(requestId);
        return ToDetailDto(updated!);
    }

    public async Task<MaintenanceRequestDetailDto> UpdatePriorityAsync(int requestId, string priority, int userId, bool isAdmin)
    {
        var request = await _context.MaintenanceRequests
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request is null)
        {
            throw new NotFoundException($"ID'si {requestId} olan talep bulunamadı.");
        }

        if (!isAdmin)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(userId, request.BuildingId, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu talebin önceliğini değiştirme yetkiniz bulunmamaktadır.");
            }
        }

        var normPriority = NormalizePriority(priority);
        if (request.Priority.Equals(normPriority, StringComparison.OrdinalIgnoreCase))
        {
            return ToDetailDto(await FetchRequestDetailByIdAsync(requestId) ?? request);
        }

        var now = DateTime.UtcNow;
        var oldPriority = request.Priority;
        request.Priority = normPriority;
        request.UpdatedAt = now;

        var history = new MaintenanceRequestHistory
        {
            MaintenanceRequestId = requestId,
            ActionType = "PRIORITY_CHANGED",
            ChangedByUserId = userId,
            Note = $"Öncelik '{oldPriority}' seviyesinden '{normPriority}' seviyesine değiştirildi.",
            CreatedAt = now
        };

        _context.MaintenanceRequestHistories.Add(history);
        await _context.SaveChangesAsync();

        var recipients = await ResolveMaintenanceEventRecipientsAsync(request.PropertyId, request.BuildingId, request.CreatedByUserId, request.AssignedToUserId);
        await _realtimePublisher.PublishMaintenanceRequestUpdatedAsync(new MaintenanceRequestUpdatedEvent
        {
            RequestId = request.Id,
            PropertyId = request.PropertyId,
            BuildingId = request.BuildingId,
            EventType = "PRIORITY_CHANGED",
            UpdatedAt = now.ToString("o"),
            AssignedToUserId = request.AssignedToUserId,
            UpdatedByUserId = userId
        }, recipients);

        var updated = await FetchRequestDetailByIdAsync(requestId);
        return ToDetailDto(updated!);
    }

    public async Task<MaintenanceRequestDetailDto> UpdateStatusAsync(int requestId, string newStatus, string? note, int userId, bool isAdmin)
    {
        var request = await _context.MaintenanceRequests
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request is null)
        {
            throw new NotFoundException($"ID'si {requestId} olan talep bulunamadı.");
        }

        var isTechStaff = !isAdmin && await IsTechnicalStaffAsync(userId);
        if (isTechStaff)
        {
            if (request.AssignedToUserId != userId)
            {
                throw new ForbiddenException("Sadece size atanmış taleplerin durumunu değiştirebilirsiniz.");
            }
        }
        else if (!isAdmin)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(userId, request.BuildingId, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu talebin durumunu değiştirme yetkiniz bulunmamaktadır.");
            }
        }

        var targetStatus = newStatus.Trim().ToUpperInvariant();
        if (!AllowedStatuses.Contains(targetStatus))
        {
            throw new BadRequestException("Geçersiz durum değeri.");
        }

        var currentStatus = request.Status;
        if (currentStatus.Equals(targetStatus, StringComparison.OrdinalIgnoreCase))
        {
            return ToDetailDto(await FetchRequestDetailByIdAsync(requestId) ?? request);
        }

        // Validate state machine transitions
        ValidateStatusTransition(currentStatus, targetStatus, isTechStaff);

        var now = DateTime.UtcNow;
        request.Status = targetStatus;
        request.UpdatedAt = now;

        string actionType = "STATUS_CHANGED";
        if (targetStatus == "RESOLVED")
        {
            request.ResolvedAt = now;
            actionType = "RESOLVED";
        }
        else if (targetStatus == "CLOSED")
        {
            request.ClosedAt = now;
            actionType = "CLOSED";
        }
        else if (targetStatus == "CANCELLED")
        {
            request.CancelledAt = now;
            actionType = "CANCELLED";
        }
        else if (currentStatus == "RESOLVED" && targetStatus == "IN_PROGRESS")
        {
            request.ResolvedAt = null;
            actionType = "REOPENED";
        }

        var historyNote = !string.IsNullOrWhiteSpace(note)
            ? note.Trim()
            : $"Durum '{currentStatus}' -> '{targetStatus}' olarak değiştirildi.";

        var history = new MaintenanceRequestHistory
        {
            MaintenanceRequestId = requestId,
            ActionType = actionType,
            OldStatus = currentStatus,
            NewStatus = targetStatus,
            ChangedByUserId = userId,
            Note = historyNote,
            CreatedAt = now
        };

        _context.MaintenanceRequestHistories.Add(history);

        // Notify creator resident
        List<Notification> createdNotifications = new();
        if (request.CreatedByUserId != userId)
        {
            var notificationTitle = $"Talep Durumu Güncellendi: #{request.RequestNumber}";
            var notificationMessage = $"Talebap durumunuz '{targetStatus}' olarak güncellendi.";

            createdNotifications = await _notificationService.AddNotificationEntitiesForUsersAsync(
                new[] { request.CreatedByUserId },
                notificationTitle,
                notificationMessage,
                "REQUEST",
                "MaintenanceRequest",
                request.Id,
                $"REQUEST_{targetStatus}");
        }

        await _context.SaveChangesAsync();

        if (createdNotifications.Count > 0)
        {
            var dtos = createdNotifications.Select(n => _notificationService.ToDto(n)).ToList();
            await _realtimePublisher.PublishNotificationsAsync(dtos);
        }

        var eventType = targetStatus == "CLOSED" ? "CLOSED" : targetStatus == "CANCELLED" ? "CANCELLED" : "STATUS_CHANGED";
        var recipients = await ResolveMaintenanceEventRecipientsAsync(request.PropertyId, request.BuildingId, request.CreatedByUserId, request.AssignedToUserId);
        await _realtimePublisher.PublishMaintenanceRequestUpdatedAsync(new MaintenanceRequestUpdatedEvent
        {
            RequestId = request.Id,
            PropertyId = request.PropertyId,
            BuildingId = request.BuildingId,
            EventType = eventType,
            UpdatedAt = now.ToString("o"),
            OldStatus = currentStatus,
            NewStatus = targetStatus,
            AssignedToUserId = request.AssignedToUserId,
            UpdatedByUserId = userId
        }, recipients);

        var updated = await FetchRequestDetailByIdAsync(requestId);
        return ToDetailDto(updated!);
    }

    public async Task<MaintenanceRequestDetailDto> AddWorkNoteAsync(int requestId, string note, int userId, bool isAdmin)
    {
        if (string.IsNullOrWhiteSpace(note))
        {
            throw new BadRequestException("Not metni boş olamaz.");
        }

        var request = await _context.MaintenanceRequests
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request is null)
        {
            throw new NotFoundException($"ID'si {requestId} olan talep bulunamadı.");
        }

        var isTechStaff = !isAdmin && await IsTechnicalStaffAsync(userId);
        if (isTechStaff)
        {
            if (request.AssignedToUserId != userId)
            {
                throw new ForbiddenException("Sadece size atanmış taleplere not ekleyebilirsiniz.");
            }
        }
        else if (!isAdmin)
        {
            var canAccess = await _managerScopeService.CanAccessBuildingAsync(userId, request.BuildingId, isAdmin);
            if (!canAccess)
            {
                throw new ForbiddenException("Bu talebe not ekleme yetkiniz bulunmamaktadır.");
            }
        }

        var now = DateTime.UtcNow;
        request.UpdatedAt = now;

        var history = new MaintenanceRequestHistory
        {
            MaintenanceRequestId = requestId,
            ActionType = "NOTE_ADDED",
            ChangedByUserId = userId,
            Note = note.Trim(),
            CreatedAt = now
        };

        _context.MaintenanceRequestHistories.Add(history);
        await _context.SaveChangesAsync();

        var recipients = await ResolveMaintenanceEventRecipientsAsync(request.PropertyId, request.BuildingId, request.CreatedByUserId, request.AssignedToUserId);
        await _realtimePublisher.PublishMaintenanceRequestUpdatedAsync(new MaintenanceRequestUpdatedEvent
        {
            RequestId = request.Id,
            PropertyId = request.PropertyId,
            BuildingId = request.BuildingId,
            EventType = "COMMENT_ADDED",
            UpdatedAt = now.ToString("o"),
            AssignedToUserId = request.AssignedToUserId,
            UpdatedByUserId = userId
        }, recipients);

        var updated = await FetchRequestDetailByIdAsync(requestId);
        return ToDetailDto(updated!);
    }

    public async Task<MaintenanceRequestListResponseDto> GetTechnicalRequestsAsync(string? status, string? priority, string? category, int page, int pageSize, int technicalUserId)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = _context.MaintenanceRequests
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .Where(r => r.AssignedToUserId == technicalUserId);

        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(r => r.Status == status.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(priority)) query = query.Where(r => r.Priority == priority.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(r => r.Category == category.Trim().ToUpperInvariant());

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => ToListItemDto(r))
            .ToListAsync();

        return new MaintenanceRequestListResponseDto
        {
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<MaintenanceRequestDetailDto> GetTechnicalRequestByIdAsync(int id, int technicalUserId)
    {
        var request = await FetchRequestDetailByIdAsync(id);
        if (request is null || request.AssignedToUserId != technicalUserId)
        {
            throw new NotFoundException($"Size atanmış ID'si {id} olan talep bulunamadı.");
        }

        return ToDetailDto(request);
    }

    private async Task<MaintenanceRequest?> FetchRequestDetailByIdAsync(int id)
    {
        return await _context.MaintenanceRequests
            .Include(r => r.Property)
            .Include(r => r.Building)
            .Include(r => r.Unit)
            .Include(r => r.CreatedByUser)
            .Include(r => r.AssignedToUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.ChangedByUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.OldAssignedToUser)
            .Include(r => r.Histories)
                .ThenInclude(h => h.NewAssignedToUser)
            .Include(r => r.Attachments)
                .ThenInclude(a => a.UploadedByUser)
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    private async Task<bool> IsTechnicalStaffAsync(int userId)
    {
        return await _context.UserRoles
            .AsNoTracking()
            .AnyAsync(ur => ur.UserId == userId && ur.Role.Code == AppRoles.TechnicalStaff);
    }

    private static void ValidateStatusTransition(string currentStatus, string targetStatus, bool isTechStaff)
    {
        if (currentStatus == "CLOSED" || currentStatus == "CANCELLED")
        {
            throw new BadRequestException($"Durumu '{currentStatus}' olan kapatılmış/iptal edilmiş talepler tekrar değiştirilemez.");
        }

        if (isTechStaff)
        {
            // Technical staff can only do: OPEN -> IN_PROGRESS, IN_PROGRESS -> RESOLVED
            if (currentStatus == "OPEN" && targetStatus == "IN_PROGRESS") return;
            if (currentStatus == "IN_PROGRESS" && targetStatus == "RESOLVED") return;
            throw new ForbiddenException($"Teknik personel '{currentStatus}' -> '{targetStatus}' geçişini yapamaz.");
        }

        // Manager / Admin transitions
        if (currentStatus == "OPEN")
        {
            if (targetStatus == "IN_PROGRESS" || targetStatus == "RESOLVED" || targetStatus == "CANCELLED") return;
        }
        else if (currentStatus == "IN_PROGRESS")
        {
            if (targetStatus == "RESOLVED" || targetStatus == "CANCELLED") return;
        }
        else if (currentStatus == "RESOLVED")
        {
            if (targetStatus == "CLOSED" || targetStatus == "IN_PROGRESS") return;
        }

        throw new BadRequestException($"Geçersiz durum geçişi: '{currentStatus}' -> '{targetStatus}'.");
    }

    private static string NormalizeCategory(string category)
    {
        if (string.IsNullOrWhiteSpace(category)) return "OTHER";
        var norm = category.Trim().ToUpperInvariant();
        return AllowedCategories.Contains(norm) ? norm : "OTHER";
    }

    private static string NormalizePriority(string priority)
    {
        if (string.IsNullOrWhiteSpace(priority)) return "NORMAL";
        var norm = priority.Trim().ToUpperInvariant();
        return AllowedPriorities.Contains(norm) ? norm : "NORMAL";
    }

    private static MaintenanceRequestListItemDto ToListItemDto(MaintenanceRequest r)
    {
        return new MaintenanceRequestListItemDto
        {
            Id = r.Id,
            RequestNumber = r.RequestNumber,
            UnitId = r.UnitId,
            PropertyId = r.PropertyId,
            PropertyName = r.Property?.Name ?? string.Empty,
            BuildingId = r.BuildingId,
            BuildingName = r.Building?.Name ?? string.Empty,
            UnitNumber = r.Unit?.UnitNumber ?? string.Empty,
            Category = r.Category,
            Title = r.Title,
            Priority = r.Priority,
            Status = r.Status,
            CreatedByUserId = r.CreatedByUserId,
            CreatedByName = r.CreatedByUser != null
                ? $"{r.CreatedByUser.FirstName} {r.CreatedByUser.LastName}".Trim()
                : string.Empty,
            AssignedToUserId = r.AssignedToUserId,
            AssignedToName = r.AssignedToUser != null
                ? $"{r.AssignedToUser.FirstName} {r.AssignedToUser.LastName}".Trim()
                : null,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt,
            ResolvedAt = r.ResolvedAt,
            ClosedAt = r.ClosedAt,
            CancelledAt = r.CancelledAt
        };
    }

    private static MaintenanceRequestDetailDto ToDetailDto(MaintenanceRequest r)
    {
        return new MaintenanceRequestDetailDto
        {
            Id = r.Id,
            RequestNumber = r.RequestNumber,
            UnitId = r.UnitId,
            PropertyId = r.PropertyId,
            PropertyName = r.Property?.Name ?? string.Empty,
            BuildingId = r.BuildingId,
            BuildingName = r.Building?.Name ?? string.Empty,
            UnitNumber = r.Unit?.UnitNumber ?? string.Empty,
            Category = r.Category,
            Title = r.Title,
            Description = r.Description,
            Priority = r.Priority,
            Status = r.Status,
            CreatedByUserId = r.CreatedByUserId,
            CreatedByName = r.CreatedByUser != null
                ? $"{r.CreatedByUser.FirstName} {r.CreatedByUser.LastName}".Trim()
                : string.Empty,
            AssignedToUserId = r.AssignedToUserId,
            AssignedToName = r.AssignedToUser != null
                ? $"{r.AssignedToUser.FirstName} {r.AssignedToUser.LastName}".Trim()
                : null,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt,
            ResolvedAt = r.ResolvedAt,
            ClosedAt = r.ClosedAt,
            CancelledAt = r.CancelledAt,
            Histories = r.Histories != null
                ? r.Histories
                    .OrderBy(h => h.CreatedAt)
                    .Select(h => new MaintenanceRequestHistoryDto
                    {
                        Id = h.Id,
                        ActionType = h.ActionType,
                        OldStatus = h.OldStatus,
                        NewStatus = h.NewStatus,
                        OldAssignedToUserId = h.OldAssignedToUserId,
                        OldAssignedToName = h.OldAssignedToUser != null ? $"{h.OldAssignedToUser.FirstName} {h.OldAssignedToUser.LastName}".Trim() : null,
                        NewAssignedToUserId = h.NewAssignedToUserId,
                        NewAssignedToName = h.NewAssignedToUser != null ? $"{h.NewAssignedToUser.FirstName} {h.NewAssignedToUser.LastName}".Trim() : null,
                        Note = h.Note,
                        ChangedByUserId = h.ChangedByUserId,
                        ChangedByName = h.ChangedByUser != null ? $"{h.ChangedByUser.FirstName} {h.ChangedByUser.LastName}".Trim() : string.Empty,
                        CreatedAt = h.CreatedAt
                    })
                    .ToList()
                : new List<MaintenanceRequestHistoryDto>(),
            Attachments = r.Attachments != null
                ? r.Attachments
                    .OrderBy(a => a.CreatedAt)
                    .Select(a => new MaintenanceRequestAttachmentDto
                    {
                        Id = a.Id,
                        OriginalFileName = a.OriginalFileName,
                        ContentType = a.ContentType,
                        FileSizeBytes = a.FileSizeBytes,
                        UploadedByUserId = a.UploadedByUserId,
                        UploadedByName = a.UploadedByUser != null ? $"{a.UploadedByUser.FirstName} {a.UploadedByUser.LastName}".Trim() : string.Empty,
                        CreatedAt = a.CreatedAt
                    })
                    .ToList()
                : new List<MaintenanceRequestAttachmentDto>()
        };
    }

    private async Task<List<int>> ResolveMaintenanceEventRecipientsAsync(
        int propertyId,
        int buildingId,
        int createdByUserId,
        int? assignedToUserId,
        int? oldAssignedToUserId = null)
    {
        var recipients = new List<int>();

        if (createdByUserId > 0)
        {
            recipients.Add(createdByUserId);
        }

        if (assignedToUserId.HasValue && assignedToUserId.Value > 0)
        {
            recipients.Add(assignedToUserId.Value);
        }

        if (oldAssignedToUserId.HasValue && oldAssignedToUserId.Value > 0)
        {
            recipients.Add(oldAssignedToUserId.Value);
        }

        var managerUserIds = await _context.ManagerAssignments
            .AsNoTracking()
            .Where(ma => ma.IsActive &&
                         ma.ManagerUser.IsActive &&
                         ma.PropertyId == propertyId &&
                         (ma.BuildingId == null || ma.BuildingId == buildingId))
            .Select(ma => ma.ManagerUserId)
            .Distinct()
            .ToListAsync();

        recipients.AddRange(managerUserIds);

        return recipients.Distinct().ToList();
    }
}
