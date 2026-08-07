using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class DataImportService : IDataImportService
{
    private readonly AppDbContext _context;
    private readonly IImportFileStorageService _storageService;
    private readonly IImportFileParser _fileParser;
    private readonly IManagerScopeService _managerScopeService;

    private static readonly Dictionary<string, List<TargetFieldOptionDto>> TargetFieldsRegistry = new(StringComparer.OrdinalIgnoreCase)
    {
        {
            "PROPERTIES", new List<TargetFieldOptionDto>
            {
                new() { Key = "Name", Label = "Taşınmaz Adı", IsRequired = true },
                new() { Key = "PropertyTypeCode", Label = "Taşınmaz Tipi Kodu (RESIDENTIAL_COMPLEX vb.)", IsRequired = false },
                new() { Key = "AddressLine", Label = "Adres", IsRequired = true },
                new() { Key = "City", Label = "İl", IsRequired = true },
                new() { Key = "District", Label = "İlçe", IsRequired = true },
                new() { Key = "Description", Label = "Açıklama", IsRequired = false }
            }
        },
        {
            "BUILDINGS", new List<TargetFieldOptionDto>
            {
                new() { Key = "PropertyName", Label = "Taşınmaz Adı", IsRequired = true },
                new() { Key = "Name", Label = "Blok Adı", IsRequired = true },
                new() { Key = "Code", Label = "Blok Kodu", IsRequired = true },
                new() { Key = "FloorCount", Label = "Kat Sayısı (1-200)", IsRequired = true },
                new() { Key = "Description", Label = "Açıklama", IsRequired = false }
            }
        },
        {
            "UNITS", new List<TargetFieldOptionDto>
            {
                new() { Key = "PropertyName", Label = "Taşınmaz Adı", IsRequired = true },
                new() { Key = "BuildingCode", Label = "Blok Kodu", IsRequired = true },
                new() { Key = "UnitNumber", Label = "Daire No", IsRequired = true },
                new() { Key = "UnitTypeCode", Label = "Daire Tipi Kodu (APARTMENT vb.)", IsRequired = true },
                new() { Key = "FloorNumber", Label = "Kat No", IsRequired = false },
                new() { Key = "GrossArea", Label = "Brüt Alan (m²)", IsRequired = false },
                new() { Key = "NetArea", Label = "Net Alan (m²)", IsRequired = false }
            }
        },
        {
            "USERS", new List<TargetFieldOptionDto>
            {
                new() { Key = "UserName", Label = "Kullanıcı Adı", IsRequired = true },
                new() { Key = "Email", Label = "E-Posta Adresi", IsRequired = true },
                new() { Key = "FirstName", Label = "Ad", IsRequired = true },
                new() { Key = "LastName", Label = "Soyad", IsRequired = true },
                new() { Key = "PhoneNumber", Label = "Telefon", IsRequired = false }
            }
        },
        {
            "OCCUPANCIES", new List<TargetFieldOptionDto>
            {
                new() { Key = "PropertyName", Label = "Taşınmaz Adı", IsRequired = true },
                new() { Key = "BuildingCode", Label = "Blok Kodu", IsRequired = true },
                new() { Key = "UnitNumber", Label = "Daire No", IsRequired = true },
                new() { Key = "UserNameOrEmail", Label = "Kullanıcı Adı veya E-Posta", IsRequired = true },
                new() { Key = "OccupancyTypeCode", Label = "İkamet Türü (OWNER/TENANT)", IsRequired = true },
                new() { Key = "StartDate", Label = "Başlangıç Tarihi (YYYY-AA-GG)", IsRequired = true },
                new() { Key = "EndDate", Label = "Bitiş Tarihi (Opsiyonel)", IsRequired = false }
            }
        }
    };

    public DataImportService(
        AppDbContext context,
        IImportFileStorageService storageService,
        IImportFileParser fileParser,
        IManagerScopeService managerScopeService)
    {
        _context = context;
        _storageService = storageService;
        _fileParser = fileParser;
        _managerScopeService = managerScopeService;
    }

    public async Task<ImportUploadResponseDto> UploadFileAsync(
        IFormFile file,
        string importType,
        int currentUserId,
        bool isAdmin)
    {
        var normalizedType = importType?.Trim().ToUpperInvariant() ?? string.Empty;
        var validTypes = new[] { "PROPERTIES", "BUILDINGS", "UNITS", "USERS", "OCCUPANCIES", "DUE_CHARGES", "EXPENSES" };
        if (!validTypes.Contains(normalizedType))
        {
            throw new BadRequestException($"Geçersiz içe aktarım türü: '{importType}'.");
        }

        using var stream = file.OpenReadStream();
        var (storageKey, fileHashSha256, fileSizeBytes) = await _storageService.SaveImportFileAsync(stream, file.FileName);

        var existingBatch = await _context.ImportBatches
            .AsNoTracking()
            .Where(b => b.CreatedByUserId == currentUserId && b.ImportType == normalizedType && b.FileHashSha256 == fileHashSha256)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

        bool isDuplicateUpload = existingBatch != null;
        string? duplicateWarning = isDuplicateUpload
            ? $"Daha önce bu dosya içeriğiyle bir içe aktarım oluşturulmuş (Parti ID: #{existingBatch!.Id}, Yüklenme: {existingBatch.CreatedAt:g})."
            : null;

        var batch = new ImportBatch
        {
            ImportType = normalizedType,
            OriginalFileName = file.FileName,
            StorageKey = storageKey,
            FileHashSha256 = fileHashSha256,
            Status = "UPLOADED",
            CreatedByUserId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _context.ImportBatches.Add(batch);
        await _context.SaveChangesAsync();

        var user = await _context.Users.FindAsync(currentUserId);

        return new ImportUploadResponseDto
        {
            Batch = ToBatchDto(batch, user != null ? $"{user.FirstName} {user.LastName}".Trim() : string.Empty),
            IsDuplicateUpload = isDuplicateUpload,
            DuplicateWarning = duplicateWarning
        };
    }

    public async Task<ImportColumnMappingOptionsDto> GetColumnMappingOptionsAsync(
        int batchId,
        int currentUserId,
        bool isAdmin)
    {
        var batch = await GetBatchAndCheckAccessAsync(batchId, currentUserId, isAdmin);

        using var stream = _storageService.OpenImportFileStream(batch.StorageKey);
        var extension = Path.GetExtension(batch.OriginalFileName);
        var parseResult = _fileParser.ParseFile(stream, extension);

        var allowedFields = TargetFieldsRegistry.TryGetValue(batch.ImportType, out var fields)
            ? fields
            : new List<TargetFieldOptionDto>();

        var suggested = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var header in parseResult.Headers)
        {
            var cleanHeader = header.Trim();
            var matchedField = allowedFields.FirstOrDefault(f =>
                f.Key.Equals(cleanHeader, StringComparison.OrdinalIgnoreCase) ||
                f.Label.Equals(cleanHeader, StringComparison.OrdinalIgnoreCase) ||
                NormalizeHeader(f.Key) == NormalizeHeader(cleanHeader) ||
                NormalizeHeader(f.Label) == NormalizeHeader(cleanHeader));

            if (matchedField != null && !suggested.ContainsValue(matchedField.Key))
            {
                suggested[cleanHeader] = matchedField.Key;
            }
        }

        return new ImportColumnMappingOptionsDto
        {
            BatchId = batch.Id,
            ImportType = batch.ImportType,
            SourceHeaders = parseResult.Headers,
            AllowedTargetFields = allowedFields,
            SuggestedMappings = suggested
        };
    }

    public async Task<ImportPreviewResponseDto> ValidateBatchAsync(
        int batchId,
        ValidateImportBatchRequestDto request,
        int currentUserId,
        bool isAdmin)
    {
        var batch = await GetBatchAndCheckAccessAsync(batchId, currentUserId, isAdmin);

        if (!TargetFieldsRegistry.TryGetValue(batch.ImportType, out var allowedFields))
        {
            throw new BadRequestException($"'{batch.ImportType}' v1 aktarım motorunda desteklenmemektedir.");
        }

        var mappings = request.ColumnMappings ?? new Dictionary<string, string>();

        var targetCounts = mappings.Values.GroupBy(v => v).ToDictionary(g => g.Key, g => g.Count());
        var duplicateTargets = targetCounts.Where(kvp => kvp.Value > 1).Select(kvp => kvp.Key).ToList();
        if (duplicateTargets.Count > 0)
        {
            throw new BadRequestException($"Aynı hedef alan birden fazla sütuna eşlenemez: {string.Join(", ", duplicateTargets)}.");
        }

        var missingRequired = allowedFields
            .Where(f => f.IsRequired && !mappings.ContainsValue(f.Key))
            .Select(f => f.Label)
            .ToList();

        if (missingRequired.Count > 0)
        {
            throw new BadRequestException($"Zorunlu alanlar eşlenmemiş: {string.Join(", ", missingRequired)}.");
        }

        using var stream = _storageService.OpenImportFileStream(batch.StorageKey);
        var extension = Path.GetExtension(batch.OriginalFileName);
        var parseResult = _fileParser.ParseFile(stream, extension);

        var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(currentUserId, isAdmin);
        var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(currentUserId, isAdmin);

        var rowLogs = new List<ImportRowLog>();

        foreach (var parsedRow in parseResult.Rows)
        {
            var mappedValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kvp in mappings)
            {
                var sourceCol = kvp.Key;
                var targetField = kvp.Value;

                if (parsedRow.Values.TryGetValue(sourceCol, out var val))
                {
                    mappedValues[targetField] = val?.Trim() ?? string.Empty;
                }
            }

            var errors = new List<ValidationErrorItemDto>();

            var (actionPreview, status) = await ValidateRowAsync(
                batch.ImportType,
                parsedRow.RowNumber,
                mappedValues,
                errors,
                currentUserId,
                isAdmin,
                accessiblePropertyIds,
                accessibleBuildingIds);

            var rawDataJson = JsonSerializer.Serialize(parsedRow.Values);
            var errorsJson = errors.Count > 0 ? JsonSerializer.Serialize(errors) : null;

            rowLogs.Add(new ImportRowLog
            {
                ImportBatchId = batch.Id,
                RowNumber = parsedRow.RowNumber,
                RawDataJson = rawDataJson,
                Status = status,
                ActionPreview = actionPreview,
                ErrorMessagesJson = errorsJson
            });
        }

        var strategy = _context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _context.Database.BeginTransactionAsync();

            var existingLogs = await _context.ImportRowLogs
                .Where(rl => rl.ImportBatchId == batch.Id)
                .ToListAsync();

            _context.ImportRowLogs.RemoveRange(existingLogs);
            await _context.SaveChangesAsync();

            await _context.ImportRowLogs.AddRangeAsync(rowLogs);

            batch.TotalRows = rowLogs.Count;
            batch.ValidRows = rowLogs.Count(r => r.Status == "VALID" && r.ActionPreview == "CREATE");
            batch.SkippedRows = rowLogs.Count(r => r.ActionPreview == "SKIP");
            batch.InvalidRows = rowLogs.Count(r => r.Status == "INVALID" || r.ActionPreview == "ERROR");
            batch.ImportedRows = 0;
            batch.ValidatedAt = DateTime.UtcNow;

            if (batch.InvalidRows > 0)
            {
                batch.Status = "VALIDATED";
            }
            else if (batch.ValidRows > 0)
            {
                batch.Status = "READY";
            }
            else
            {
                batch.Status = "VALIDATED";
            }

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        });

        return await GetPreviewAsync(batch.Id, null, 1, 50, currentUserId, isAdmin);
    }

    private async Task<(string ActionPreview, string Status)> ValidateRowAsync(
        string importType,
        int rowNumber,
        Dictionary<string, string> mappedValues,
        List<ValidationErrorItemDto> errors,
        int currentUserId,
        bool isAdmin,
        List<int> accessiblePropertyIds,
        List<int> accessibleBuildingIds)
    {
        return importType switch
        {
            "PROPERTIES" => await ValidatePropertyRowAsync(mappedValues, errors, isAdmin),
            "BUILDINGS" => await ValidateBuildingRowAsync(mappedValues, errors, isAdmin, accessiblePropertyIds),
            "UNITS" => await ValidateUnitRowAsync(mappedValues, errors, isAdmin, accessibleBuildingIds),
            "USERS" => await ValidateUserRowAsync(mappedValues, errors),
            "OCCUPANCIES" => await ValidateOccupancyRowAsync(mappedValues, errors, isAdmin, accessibleBuildingIds),
            _ => ("ERROR", "INVALID")
        };
    }

    private async Task<(string ActionPreview, string Status)> ValidatePropertyRowAsync(
        Dictionary<string, string> mappedValues,
        List<ValidationErrorItemDto> errors,
        bool isAdmin)
    {
        if (!isAdmin)
        {
            errors.Add(new ValidationErrorItemDto
            {
                Code = "FORBIDDEN_SCOPE",
                Field = "Role",
                Message = "Taşınmaz (Site/Apartman) ekleme yetkisi yalnızca sistem yöneticilerine (ADMIN) aittir."
            });
            return ("ERROR", "INVALID");
        }

        var name = GetValue(mappedValues, "Name");
        var address = GetValue(mappedValues, "AddressLine");
        var city = GetValue(mappedValues, "City");
        var district = GetValue(mappedValues, "District");

        if (string.IsNullOrWhiteSpace(name))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "Name", Message = "Taşınmaz adı zorunludur." });
        if (string.IsNullOrWhiteSpace(address))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "AddressLine", Message = "Adres alanı zorunludur." });
        if (string.IsNullOrWhiteSpace(city))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "City", Message = "İl alanı zorunludur." });
        if (string.IsNullOrWhiteSpace(district))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "District", Message = "İlçe alanı zorunludur." });

        if (errors.Count > 0)
        {
            return ("ERROR", "INVALID");
        }

        var existingProp = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Name.ToLower() == name!.ToLower() && p.IsActive);

        if (existingProp != null)
        {
            errors.Add(new ValidationErrorItemDto
            {
                Code = "DUPLICATE",
                Field = "Name",
                Message = $"'{name}' isimli bir taşınmaz sistemde zaten mevcut (Mükerrer kayıt)."
            });
            return ("SKIP", "SKIPPED");
        }

        return ("CREATE", "VALID");
    }

    private async Task<(string ActionPreview, string Status)> ValidateBuildingRowAsync(
        Dictionary<string, string> mappedValues,
        List<ValidationErrorItemDto> errors,
        bool isAdmin,
        List<int> accessiblePropertyIds)
    {
        var propName = GetValue(mappedValues, "PropertyName");
        var name = GetValue(mappedValues, "Name");
        var code = GetValue(mappedValues, "Code");
        var floorStr = GetValue(mappedValues, "FloorCount");

        if (string.IsNullOrWhiteSpace(propName))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "PropertyName", Message = "Taşınmaz adı zorunludur." });
        if (string.IsNullOrWhiteSpace(name))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "Name", Message = "Blok adı zorunludur." });
        if (string.IsNullOrWhiteSpace(code))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "Code", Message = "Blok kodu zorunludur." });
        if (string.IsNullOrWhiteSpace(floorStr))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "FloorCount", Message = "Kat sayısı zorunludur." });

        if (!int.TryParse(floorStr, out var floorCount) || floorCount < 1 || floorCount > 200)
        {
            errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "FloorCount", Message = "Kat sayısı 1 ile 200 arasında tam sayı olmalıdır." });
        }

        if (errors.Count > 0)
        {
            return ("ERROR", "INVALID");
        }

        var prop = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Name.ToLower() == propName!.ToLower() && p.IsActive);

        if (prop is null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "REFERENCE_NOT_FOUND", Field = "PropertyName", Message = $"'{propName}' isimli aktif bir taşınmaz bulunamadı." });
            return ("ERROR", "INVALID");
        }

        if (!isAdmin && !accessiblePropertyIds.Contains(prop.Id))
        {
            errors.Add(new ValidationErrorItemDto { Code = "FORBIDDEN_SCOPE", Field = "PropertyName", Message = $"'{propName}' taşınmazına erişim/ekleme yetkiniz bulunmamaktadır." });
            return ("ERROR", "INVALID");
        }

        var existingBuilding = await _context.Buildings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.PropertyId == prop.Id && b.Code.ToLower() == code!.ToLower() && b.IsActive);

        if (existingBuilding != null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "DUPLICATE", Field = "Code", Message = $"'{propName}' bünyesinde '{code}' kodlu bir blok zaten mevcut." });
            return ("SKIP", "SKIPPED");
        }

        return ("CREATE", "VALID");
    }

    private async Task<(string ActionPreview, string Status)> ValidateUnitRowAsync(
        Dictionary<string, string> mappedValues,
        List<ValidationErrorItemDto> errors,
        bool isAdmin,
        List<int> accessibleBuildingIds)
    {
        var propName = GetValue(mappedValues, "PropertyName");
        var buildingCode = GetValue(mappedValues, "BuildingCode");
        var unitNumber = GetValue(mappedValues, "UnitNumber");
        var unitTypeCode = GetValue(mappedValues, "UnitTypeCode");
        var grossStr = GetValue(mappedValues, "GrossArea");
        var netStr = GetValue(mappedValues, "NetArea");

        if (string.IsNullOrWhiteSpace(propName))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "PropertyName", Message = "Taşınmaz adı zorunludur." });
        if (string.IsNullOrWhiteSpace(buildingCode))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "BuildingCode", Message = "Blok kodu zorunludur." });
        if (string.IsNullOrWhiteSpace(unitNumber))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "UnitNumber", Message = "Daire No zorunludur." });
        if (string.IsNullOrWhiteSpace(unitTypeCode))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "UnitTypeCode", Message = "Daire tipi kodu zorunludur." });

        decimal? grossArea = null;
        if (!string.IsNullOrWhiteSpace(grossStr))
        {
            if (!decimal.TryParse(grossStr, out var g) || g <= 0)
                errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "GrossArea", Message = "Brüt alan pozitif sayı olmalıdır." });
            else
                grossArea = g;
        }

        decimal? netArea = null;
        if (!string.IsNullOrWhiteSpace(netStr))
        {
            if (!decimal.TryParse(netStr, out var n) || n <= 0)
                errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "NetArea", Message = "Net alan pozitif sayı olmalıdır." });
            else
                netArea = n;
        }

        if (grossArea.HasValue && netArea.HasValue && netArea.Value > grossArea.Value)
        {
            errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "NetArea", Message = "Net alan brüt alandan büyük olamaz." });
        }

        if (errors.Count > 0)
        {
            return ("ERROR", "INVALID");
        }

        var building = await _context.Buildings
            .AsNoTracking()
            .Include(b => b.Property)
            .FirstOrDefaultAsync(b => b.Property.Name.ToLower() == propName!.ToLower() && b.Code.ToLower() == buildingCode!.ToLower() && b.IsActive);

        if (building is null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "REFERENCE_NOT_FOUND", Field = "BuildingCode", Message = $"'{propName}' altında '{buildingCode}' kodlu bir blok bulunamadı." });
            return ("ERROR", "INVALID");
        }

        if (!isAdmin && !accessibleBuildingIds.Contains(building.Id))
        {
            errors.Add(new ValidationErrorItemDto { Code = "FORBIDDEN_SCOPE", Field = "BuildingCode", Message = $"'{buildingCode}' bloğuna daire ekleme yetkiniz bulunmamaktadır." });
            return ("ERROR", "INVALID");
        }

        var unitType = await _context.UnitTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(ut => ut.Code.ToLower() == unitTypeCode!.ToLower() && ut.IsActive);

        if (unitType is null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "REFERENCE_NOT_FOUND", Field = "UnitTypeCode", Message = $"'{unitTypeCode}' kodlu aktif bir daire tipi bulunamadı." });
            return ("ERROR", "INVALID");
        }

        var existingUnit = await _context.Units
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.BuildingId == building.Id && u.UnitNumber.ToLower() == unitNumber!.ToLower() && u.IsActive);

        if (existingUnit != null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "DUPLICATE", Field = "UnitNumber", Message = $"'{buildingCode}' bloğunda '{unitNumber}' numaralı daire zaten mevcut." });
            return ("SKIP", "SKIPPED");
        }

        return ("CREATE", "VALID");
    }

    private async Task<(string ActionPreview, string Status)> ValidateUserRowAsync(
        Dictionary<string, string> mappedValues,
        List<ValidationErrorItemDto> errors)
    {
        var userName = GetValue(mappedValues, "UserName");
        var email = GetValue(mappedValues, "Email");
        var firstName = GetValue(mappedValues, "FirstName");
        var lastName = GetValue(mappedValues, "LastName");

        if (string.IsNullOrWhiteSpace(userName))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "UserName", Message = "Kullanıcı adı zorunludur." });
        if (string.IsNullOrWhiteSpace(email))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "Email", Message = "E-posta adresi zorunludur." });
        if (string.IsNullOrWhiteSpace(firstName))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "FirstName", Message = "Ad alanı zorunludur." });
        if (string.IsNullOrWhiteSpace(lastName))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "LastName", Message = "Soyad alanı zorunludur." });

        if (errors.Count > 0)
        {
            return ("ERROR", "INVALID");
        }

        var existingUser = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserName.ToLower() == userName!.ToLower() || u.Email.ToLower() == email!.ToLower());

        if (existingUser != null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "DUPLICATE", Field = "UserName", Message = $"'{userName}' kullanıcı adı veya '{email}' e-posta adresi sistemde zaten kayıtlı." });
            return ("SKIP", "SKIPPED");
        }

        return ("CREATE", "VALID");
    }

    private async Task<(string ActionPreview, string Status)> ValidateOccupancyRowAsync(
        Dictionary<string, string> mappedValues,
        List<ValidationErrorItemDto> errors,
        bool isAdmin,
        List<int> accessibleBuildingIds)
    {
        var propName = GetValue(mappedValues, "PropertyName");
        var buildingCode = GetValue(mappedValues, "BuildingCode");
        var unitNumber = GetValue(mappedValues, "UnitNumber");
        var userNameOrEmail = GetValue(mappedValues, "UserNameOrEmail");
        var occTypeCode = GetValue(mappedValues, "OccupancyTypeCode");
        var startDateStr = GetValue(mappedValues, "StartDate");
        var endDateStr = GetValue(mappedValues, "EndDate");

        if (string.IsNullOrWhiteSpace(propName))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "PropertyName", Message = "Taşınmaz adı zorunludur." });
        if (string.IsNullOrWhiteSpace(buildingCode))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "BuildingCode", Message = "Blok kodu zorunludur." });
        if (string.IsNullOrWhiteSpace(unitNumber))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "UnitNumber", Message = "Daire No zorunludur." });
        if (string.IsNullOrWhiteSpace(userNameOrEmail))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "UserNameOrEmail", Message = "Kullanıcı adı veya e-posta zorunludur." });
        if (string.IsNullOrWhiteSpace(occTypeCode))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "OccupancyTypeCode", Message = "İkamet türü kodu zorunludur." });
        if (string.IsNullOrWhiteSpace(startDateStr))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "StartDate", Message = "Başlangıç tarihi zorunludur." });

        DateTime startDate = DateTime.MinValue;
        if (!string.IsNullOrWhiteSpace(startDateStr) && !DateTime.TryParse(startDateStr, out startDate))
        {
            errors.Add(new ValidationErrorItemDto { Code = "INVALID_FORMAT", Field = "StartDate", Message = "Başlangıç tarihi geçerli bir tarih olmalıdır (Örn: 2026-01-01)." });
        }

        DateTime? endDate = null;
        if (!string.IsNullOrWhiteSpace(endDateStr))
        {
            if (!DateTime.TryParse(endDateStr, out var ed))
            {
                errors.Add(new ValidationErrorItemDto { Code = "INVALID_FORMAT", Field = "EndDate", Message = "Bitiş tarihi geçerli bir tarih olmalıdır." });
            }
            else
            {
                endDate = ed;
            }
        }

        if (endDate.HasValue && startDate != DateTime.MinValue && endDate.Value < startDate)
        {
            errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "EndDate", Message = "Bitiş tarihi başlangıç tarihinden önce olamaz." });
        }

        if (errors.Count > 0)
        {
            return ("ERROR", "INVALID");
        }

        var unit = await _context.Units
            .AsNoTracking()
            .Include(u => u.Building)
                .ThenInclude(b => b.Property)
            .FirstOrDefaultAsync(u => u.Building.Property.Name.ToLower() == propName!.ToLower() &&
                                      u.Building.Code.ToLower() == buildingCode!.ToLower() &&
                                      u.UnitNumber.ToLower() == unitNumber!.ToLower() && u.IsActive);

        if (unit is null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "REFERENCE_NOT_FOUND", Field = "UnitNumber", Message = $"'{propName} / {buildingCode}' altında '{unitNumber}' nolu daire bulunamadı." });
            return ("ERROR", "INVALID");
        }

        if (!isAdmin && !accessibleBuildingIds.Contains(unit.BuildingId))
        {
            errors.Add(new ValidationErrorItemDto { Code = "FORBIDDEN_SCOPE", Field = "UnitNumber", Message = $"'{unitNumber}' nolu daireye ikamet atama yetkiniz bulunmamaktadır." });
            return ("ERROR", "INVALID");
        }

        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserName.ToLower() == userNameOrEmail!.ToLower() || u.Email.ToLower() == userNameOrEmail!.ToLower());

        if (user is null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "REFERENCE_NOT_FOUND", Field = "UserNameOrEmail", Message = $"'{userNameOrEmail}' kullanıcısı bulunamadı." });
            return ("ERROR", "INVALID");
        }

        var occType = await _context.OccupancyTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(ot => ot.Code.ToLower() == occTypeCode!.ToLower() && ot.IsActive);

        if (occType is null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "REFERENCE_NOT_FOUND", Field = "OccupancyTypeCode", Message = $"'{occTypeCode}' ikamet türü bulunamadı." });
            return ("ERROR", "INVALID");
        }

        var collision = await _context.UnitOccupancies
            .AsNoTracking()
            .AnyAsync(uo => uo.IsActive && (uo.UnitId == unit.Id || uo.UserId == user.Id) && uo.OccupancyTypeId == occType.Id);

        if (collision)
        {
            errors.Add(new ValidationErrorItemDto { Code = "DUPLICATE", Field = "UserNameOrEmail", Message = $"'{unitNumber}' dairesinde veya '{user.UserName}' kullanıcısında zaten aktif ikamet kaydı mevcut." });
            return ("SKIP", "SKIPPED");
        }

        return ("CREATE", "VALID");
    }

    public async Task<ImportPreviewResponseDto> GetPreviewAsync(
        int batchId,
        string? actionFilter,
        int page,
        int pageSize,
        int currentUserId,
        bool isAdmin)
    {
        var batch = await GetBatchAndCheckAccessAsync(batchId, currentUserId, isAdmin);

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var query = _context.ImportRowLogs
            .AsNoTracking()
            .Where(rl => rl.ImportBatchId == batch.Id);

        if (!string.IsNullOrWhiteSpace(actionFilter))
        {
            var normalizedAction = actionFilter.Trim().ToUpperInvariant();
            query = query.Where(rl => rl.ActionPreview == normalizedAction);
        }

        var totalFiltered = await query.CountAsync();
        var logs = await query
            .OrderBy(rl => rl.RowNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var user = await _context.Users.FindAsync(batch.CreatedByUserId);
        var batchDto = ToBatchDto(batch, user != null ? $"{user.FirstName} {user.LastName}".Trim() : string.Empty);

        var rowDtos = logs.Select(rl =>
        {
            var rawData = !string.IsNullOrWhiteSpace(rl.RawDataJson)
                ? JsonSerializer.Deserialize<Dictionary<string, string>>(rl.RawDataJson) ?? new()
                : new Dictionary<string, string>();

            var errors = !string.IsNullOrWhiteSpace(rl.ErrorMessagesJson)
                ? JsonSerializer.Deserialize<List<ValidationErrorItemDto>>(rl.ErrorMessagesJson) ?? new()
                : new List<ValidationErrorItemDto>();

            return new ImportRowLogDto
            {
                Id = rl.Id,
                ImportBatchId = rl.ImportBatchId,
                RowNumber = rl.RowNumber,
                RawData = rawData,
                Status = rl.Status,
                ActionPreview = rl.ActionPreview,
                ValidationErrors = errors,
                CreatedEntityId = rl.CreatedEntityId
            };
        }).ToList();

        return new ImportPreviewResponseDto
        {
            Summary = batchDto,
            Page = page,
            PageSize = pageSize,
            TotalFilteredRows = totalFiltered,
            Rows = rowDtos
        };
    }

    private async Task<ImportBatch> GetBatchAndCheckAccessAsync(int batchId, int currentUserId, bool isAdmin)
    {
        var batch = await _context.ImportBatches
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == batchId);

        if (batch is null)
        {
            throw new NotFoundException($"ID'si {batchId} olan içe aktarım partisi bulunamadı.");
        }

        if (!isAdmin && batch.CreatedByUserId != currentUserId)
        {
            throw new ForbiddenException("Bu içe aktarım partisine erişim yetkiniz bulunmamaktadır.");
        }

        return batch;
    }

    private static string? GetValue(Dictionary<string, string> dict, string key)
    {
        return dict.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val)
            ? val.Trim()
            : null;
    }

    private static string NormalizeHeader(string header)
    {
        return header.Replace(" ", "").Replace("_", "").Replace("-", "").ToLowerInvariant();
    }

    private static ImportBatchDto ToBatchDto(ImportBatch b, string createdByFullName)
    {
        return new ImportBatchDto
        {
            Id = b.Id,
            ImportType = b.ImportType,
            OriginalFileName = b.OriginalFileName,
            StorageKey = b.StorageKey,
            FileHashSha256 = b.FileHashSha256,
            Status = b.Status,
            TotalRows = b.TotalRows,
            ValidRows = b.ValidRows,
            InvalidRows = b.InvalidRows,
            ImportedRows = b.ImportedRows,
            SkippedRows = b.SkippedRows,
            CreatedByUserId = b.CreatedByUserId,
            CreatedByFullName = createdByFullName,
            CreatedAt = b.CreatedAt,
            ValidatedAt = b.ValidatedAt,
            CompletedAt = b.CompletedAt,
            RolledBackAt = b.RolledBackAt,
            ErrorMessage = b.ErrorMessage
        };
    }
}
