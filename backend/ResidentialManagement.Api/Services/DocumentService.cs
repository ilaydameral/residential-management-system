using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class DocumentService : IDocumentService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;
    private readonly IDocumentFileStorageService _storage;

    public DocumentService(
        AppDbContext context,
        IManagerScopeService managerScopeService,
        IDocumentFileStorageService storage)
    {
        _context = context;
        _managerScopeService = managerScopeService;
        _storage = storage;
    }

    public async Task<DocumentListResponseDto> GetManagementAsync(
        int? propertyId, int? buildingId, int? unitId, string? category, string? visibility,
        bool? isActive, string? search, int page, int pageSize, int userId, bool isAdmin)
    {
        (page, pageSize) = NormalizePaging(page, pageSize);
        var query = DocumentsWithDetails().AsNoTracking();

        if (!isAdmin)
        {
            var manageablePropertyIds = await _managerScopeService.GetManageablePropertyIdsAsync(userId, false);
            var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(userId, false);
            query = query.Where(document =>
                (!document.BuildingId.HasValue && manageablePropertyIds.Contains(document.PropertyId)) ||
                (document.BuildingId.HasValue && accessibleBuildingIds.Contains(document.BuildingId.Value)));
        }

        query = ApplyFilters(query, propertyId, buildingId, unitId, category, visibility, isActive, search);
        var totalCount = await query.CountAsync();
        var items = await query.OrderByDescending(document => document.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToDtoProjection())
            .ToListAsync();

        return new DocumentListResponseDto { TotalCount = totalCount, Page = page, PageSize = pageSize, Items = items };
    }

    public async Task<DocumentDto> GetManagementByIdAsync(int id, int userId, bool isAdmin)
    {
        var document = await DocumentsWithDetails().AsNoTracking().FirstOrDefaultAsync(item => item.Id == id)
            ?? throw new KeyNotFoundException("Belge bulunamadı.");
        await EnsureManagementAccessAsync(document, userId, isAdmin);
        return Map(document);
    }

    public async Task<DocumentDto> CreateAsync(CreateDocumentRequestDto request, int userId, bool isAdmin)
    {
        if (request.File is null) throw new BadRequestException("Yüklenecek belge zorunludur.");
        var title = RequireTitle(request.Title);
        var originalFileName = Path.GetFileName(request.File.FileName);
        if (string.IsNullOrWhiteSpace(originalFileName) || originalFileName.Length > 255)
            throw new BadRequestException("Belge dosya adı geçersiz veya 255 karakterden uzun.");

        var category = NormalizeCategory(request.Category);
        var visibility = NormalizeVisibility(request.Visibility);
        var target = await ValidateTargetAsync(request.PropertyId, request.BuildingId, request.UnitId);
        await EnsureTargetManagementAccessAsync(target.Property.Id, target.Building?.Id, userId, isAdmin);

        string? storageKey = null;
        try
        {
            await using var stream = request.File.OpenReadStream();
            var stored = await _storage.SaveAsync(stream, originalFileName, request.File.ContentType);
            storageKey = stored.StorageKey;

            var duplicate = await HasActiveDuplicateAsync(
                request.PropertyId, request.BuildingId, request.UnitId, stored.Sha256, null);
            if (duplicate)
            {
                throw new ConflictException("Aynı dosya seçilen hedefte zaten aktif bir belge olarak bulunuyor.");
            }

            var document = new Document
            {
                PropertyId = request.PropertyId,
                BuildingId = request.BuildingId,
                UnitId = request.UnitId,
                Title = title,
                Description = NormalizeOptional(request.Description),
                Category = category,
                OriginalFileName = originalFileName,
                StorageKey = stored.StorageKey,
                ContentType = request.File.ContentType.Split(';', 2)[0].Trim(),
                FileSize = stored.FileSize,
                Sha256 = stored.Sha256,
                Visibility = visibility,
                UploadedByUserId = userId,
                UploadedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.Documents.Add(document);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                throw new ConflictException("Belge kaydı aynı hedefteki mevcut bir belgeyle çakışıyor.");
            }

            // The database now owns the file lifecycle. A later response/projection failure must not
            // remove a file that is already referenced by a committed document row.
            storageKey = null;
            return await GetManagementByIdAsync(document.Id, userId, isAdmin);
        }
        catch
        {
            if (storageKey is not null) _storage.Delete(storageKey);
            throw;
        }
    }

    public async Task<DocumentDto> UpdateMetadataAsync(int id, UpdateDocumentMetadataDto request, int userId, bool isAdmin)
    {
        var document = await DocumentsWithDetails().FirstOrDefaultAsync(item => item.Id == id)
            ?? throw new KeyNotFoundException("Belge bulunamadı.");
        await EnsureManagementAccessAsync(document, userId, isAdmin);

        document.Title = RequireTitle(request.Title);
        document.Description = NormalizeOptional(request.Description);
        document.Category = NormalizeCategory(request.Category);
        document.Visibility = NormalizeVisibility(request.Visibility);
        document.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Map(document);
    }

    public async Task<DocumentDto> SetStatusAsync(int id, bool isActive, int userId, bool isAdmin)
    {
        var document = await DocumentsWithDetails().FirstOrDefaultAsync(item => item.Id == id)
            ?? throw new KeyNotFoundException("Belge bulunamadı.");
        await EnsureManagementAccessAsync(document, userId, isAdmin);

        if (document.IsActive == isActive) return Map(document);

        if (isActive && await HasActiveDuplicateAsync(
                document.PropertyId, document.BuildingId, document.UnitId, document.Sha256, document.Id))
        {
            throw new ConflictException("Aynı dosyanın bu hedefte aktif bir belge kaydı zaten bulunuyor.");
        }

        document.IsActive = isActive;
        document.UpdatedAt = DateTime.UtcNow;
        document.ArchivedAt = isActive ? null : DateTime.UtcNow;
        document.ArchivedByUserId = isActive ? null : userId;
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException) when (isActive)
        {
            throw new ConflictException("Aynı dosyanın bu hedefte aktif bir belge kaydı zaten bulunuyor.");
        }
        return Map(document);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)> DownloadManagementAsync(int id, int userId, bool isAdmin)
    {
        var document = await DocumentsWithDetails().AsNoTracking().FirstOrDefaultAsync(item => item.Id == id)
            ?? throw new KeyNotFoundException("Belge bulunamadı.");
        await EnsureManagementAccessAsync(document, userId, isAdmin);
        return (_storage.OpenRead(document.StorageKey), document.ContentType, document.OriginalFileName);
    }

    public async Task<DocumentListResponseDto> GetResidentAsync(string? category, string? search, int page, int pageSize, int userId)
    {
        (page, pageSize) = NormalizePaging(page, pageSize);
        var query = ApplyResidentScope(DocumentsWithDetails().AsNoTracking(), userId);
        query = ApplyFilters(query, null, null, null, category, DocumentVisibilities.Residents, true, search);
        var totalCount = await query.CountAsync();
        var items = await query.OrderByDescending(document => document.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToDtoProjection())
            .ToListAsync();
        return new DocumentListResponseDto { TotalCount = totalCount, Page = page, PageSize = pageSize, Items = items };
    }

    public async Task<DocumentDto> GetResidentByIdAsync(int id, int userId)
    {
        var document = await ApplyResidentScope(DocumentsWithDetails().AsNoTracking(), userId)
            .FirstOrDefaultAsync(item => item.Id == id)
            ?? throw new KeyNotFoundException("Belge bulunamadı veya bu belgeye erişiminiz yok.");
        return Map(document);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)> DownloadResidentAsync(int id, int userId)
    {
        var document = await ApplyResidentScope(DocumentsWithDetails().AsNoTracking(), userId)
            .FirstOrDefaultAsync(item => item.Id == id)
            ?? throw new KeyNotFoundException("Belge bulunamadı veya bu belgeye erişiminiz yok.");
        return (_storage.OpenRead(document.StorageKey), document.ContentType, document.OriginalFileName);
    }

    private IQueryable<Document> ApplyResidentScope(IQueryable<Document> query, int userId)
    {
        var now = DateTime.UtcNow;
        var occupancies = _context.UnitOccupancies.AsNoTracking().Where(occupancy =>
            occupancy.UserId == userId && occupancy.IsActive && occupancy.StartDate <= now &&
            (!occupancy.EndDate.HasValue || occupancy.EndDate.Value >= now) &&
            occupancy.OccupancyType.IsActive && occupancy.Unit.IsActive &&
            occupancy.Unit.Building.IsActive && occupancy.Unit.Building.Property.IsActive);

        return query.Where(document => document.IsActive && document.Visibility == DocumentVisibilities.Residents &&
            occupancies.Any(occupancy =>
                (!document.BuildingId.HasValue && occupancy.Unit.Building.PropertyId == document.PropertyId) ||
                (document.BuildingId.HasValue && !document.UnitId.HasValue && occupancy.Unit.BuildingId == document.BuildingId.Value) ||
                (document.UnitId.HasValue && occupancy.UnitId == document.UnitId.Value)));
    }

    private async Task<(Property Property, Building? Building, Unit? Unit)> ValidateTargetAsync(
        int propertyId, int? buildingId, int? unitId)
    {
        if (unitId.HasValue && !buildingId.HasValue)
            throw new BadRequestException("Daire hedefli belge için blok seçilmelidir.");

        var property = await _context.Properties.AsNoTracking().FirstOrDefaultAsync(item => item.Id == propertyId)
            ?? throw new KeyNotFoundException("Hedef yapı bulunamadı.");
        if (!property.IsActive) throw new BadRequestException("Pasif yapı belge hedefi olamaz.");

        Building? building = null;
        if (buildingId.HasValue)
        {
            building = await _context.Buildings.AsNoTracking().FirstOrDefaultAsync(item => item.Id == buildingId.Value)
                ?? throw new KeyNotFoundException("Hedef blok bulunamadı.");
            if (building.PropertyId != propertyId) throw new BadRequestException("Hedef blok seçilen yapıya ait değil.");
            if (!building.IsActive) throw new BadRequestException("Pasif blok belge hedefi olamaz.");
        }

        Unit? unit = null;
        if (unitId.HasValue)
        {
            unit = await _context.Units.AsNoTracking().FirstOrDefaultAsync(item => item.Id == unitId.Value)
                ?? throw new KeyNotFoundException("Hedef daire bulunamadı.");
            if (unit.BuildingId != buildingId) throw new BadRequestException("Hedef daire seçilen bloğa ait değil.");
            if (!unit.IsActive) throw new BadRequestException("Pasif daire belge hedefi olamaz.");
        }

        return (property, building, unit);
    }

    private async Task EnsureTargetManagementAccessAsync(int propertyId, int? buildingId, int userId, bool isAdmin)
    {
        var allowed = buildingId.HasValue
            ? await _managerScopeService.CanAccessBuildingAsync(userId, buildingId.Value, isAdmin)
            : await _managerScopeService.CanManagePropertyAsync(userId, propertyId, isAdmin);
        if (!allowed) throw new ForbiddenException("Bu hedefte belge yönetme yetkiniz bulunmamaktadır.");
    }

    private Task EnsureManagementAccessAsync(Document document, int userId, bool isAdmin) =>
        EnsureTargetManagementAccessAsync(document.PropertyId, document.BuildingId, userId, isAdmin);

    private Task<bool> HasActiveDuplicateAsync(int propertyId, int? buildingId, int? unitId, string sha256, int? excludedId) =>
        _context.Documents.AsNoTracking().AnyAsync(document =>
            (!excludedId.HasValue || document.Id != excludedId.Value) && document.IsActive &&
            document.PropertyId == propertyId && document.BuildingId == buildingId &&
            document.UnitId == unitId && document.Sha256 == sha256);

    private static IQueryable<Document> ApplyFilters(IQueryable<Document> query, int? propertyId, int? buildingId,
        int? unitId, string? category, string? visibility, bool? isActive, string? search)
    {
        if (propertyId.HasValue) query = query.Where(item => item.PropertyId == propertyId.Value);
        if (buildingId.HasValue) query = query.Where(item => item.BuildingId == buildingId.Value);
        if (unitId.HasValue) query = query.Where(item => item.UnitId == unitId.Value);
        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalized = NormalizeCategory(category);
            query = query.Where(item => item.Category == normalized);
        }
        if (!string.IsNullOrWhiteSpace(visibility))
        {
            var normalized = NormalizeVisibility(visibility);
            query = query.Where(item => item.Visibility == normalized);
        }
        if (isActive.HasValue) query = query.Where(item => item.IsActive == isActive.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(item => item.Title.Contains(term) ||
                (item.Description != null && item.Description.Contains(term)) ||
                item.OriginalFileName.Contains(term));
        }
        return query;
    }

    private IQueryable<Document> DocumentsWithDetails() => _context.Documents
        .Include(item => item.Property)
        .Include(item => item.Building)
        .Include(item => item.Unit)
        .Include(item => item.UploadedByUser)
        .Include(item => item.ArchivedByUser);

    private static System.Linq.Expressions.Expression<Func<Document, DocumentDto>> ToDtoProjection() => item => new DocumentDto
    {
        Id = item.Id, PropertyId = item.PropertyId, PropertyName = item.Property.Name,
        BuildingId = item.BuildingId, BuildingName = item.Building != null ? item.Building.Name : null,
        BuildingCode = item.Building != null ? item.Building.Code : null,
        UnitId = item.UnitId, UnitNumber = item.Unit != null ? item.Unit.UnitNumber : null,
        TargetType = item.UnitId != null ? "UNIT" : item.BuildingId != null ? "BUILDING" : "PROPERTY",
        Title = item.Title, Description = item.Description, Category = item.Category,
        OriginalFileName = item.OriginalFileName, ContentType = item.ContentType,
        FileSize = item.FileSize, Sha256 = item.Sha256, Visibility = item.Visibility, IsActive = item.IsActive,
        UploadedByUserId = item.UploadedByUserId,
        UploadedByName = (item.UploadedByUser.FirstName + " " + item.UploadedByUser.LastName).Trim(),
        UploadedAt = item.UploadedAt, UpdatedAt = item.UpdatedAt, ArchivedAt = item.ArchivedAt,
        ArchivedByUserId = item.ArchivedByUserId,
        ArchivedByName = item.ArchivedByUser != null
            ? (item.ArchivedByUser.FirstName + " " + item.ArchivedByUser.LastName).Trim() : null
    };

    private static DocumentDto Map(Document item) => ToDtoProjection().Compile()(item);

    private static (int Page, int PageSize) NormalizePaging(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, 100));
    private static string RequireTitle(string value) => !string.IsNullOrWhiteSpace(value)
        ? value.Trim() : throw new BadRequestException("Belge başlığı zorunludur.");
    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string NormalizeCategory(string value)
    {
        var normalized = value?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!DocumentCategories.All.Contains(normalized)) throw new BadRequestException("Geçersiz belge kategorisi.");
        return normalized;
    }
    private static string NormalizeVisibility(string value)
    {
        var normalized = value?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!DocumentVisibilities.All.Contains(normalized)) throw new BadRequestException("Geçersiz belge görünürlüğü.");
        return normalized;
    }
}
