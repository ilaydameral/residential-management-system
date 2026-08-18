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
    private readonly IPasswordService _passwordService;

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
        IManagerScopeService managerScopeService,
        IPasswordService passwordService)
    {
        _context = context;
        _storageService = storageService;
        _fileParser = fileParser;
        _managerScopeService = managerScopeService;
        _passwordService = passwordService;
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

        if (normalizedType == "PROPERTIES" && !isAdmin)
        {
            throw new ForbiddenException("Siteler/Taşınmazlar aktarımı yalnızca sistem yöneticileri (ADMIN) tarafından yapılabilir.");
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

            var rawDataJson = JsonSerializer.Serialize(mappedValues);
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

            if (batch.InvalidRows == 0 && batch.ValidRows > 0)
            {
                batch.Status = "READY";
            }
            else
            {
                batch.Status = "VALIDATED";
            }

            _context.Update(batch);
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

    public async Task<ImportConfirmResponseDto> ConfirmBatchAsync(
        int batchId,
        int currentUserId,
        bool isAdmin)
    {
        var batch = await _context.ImportBatches
            .Include(b => b.RowLogs)
            .FirstOrDefaultAsync(b => b.Id == batchId);

        if (batch is null)
        {
            throw new NotFoundException($"ID'si {batchId} olan içe aktarım partisi bulunamadı.");
        }

        if (!isAdmin && batch.CreatedByUserId != currentUserId)
        {
            throw new ForbiddenException("Bu içe aktarım partisini onaylama yetkiniz bulunmamaktadır.");
        }

        if (batch.Status != "READY")
        {
            throw new BadRequestException($"Yalnızca 'READY' statüsündeki partiler içe aktarılabilir. Mevcut statü: '{batch.Status}'.");
        }

        var createLogs = batch.RowLogs
            .Where(r => r.ActionPreview == "CREATE" && r.Status == "VALID")
            .OrderBy(r => r.RowNumber)
            .ToList();

        if (createLogs.Count == 0)
        {
            throw new BadRequestException("Partide aktarılacak geçerli (CREATE) satır bulunmamaktadır.");
        }

        var invalidLogsCount = batch.RowLogs.Count(r => r.Status == "INVALID" || r.ActionPreview == "ERROR");
        if (invalidLogsCount > 0)
        {
            throw new BadRequestException("Hatalı (ERROR/INVALID) satır içeren partiler doğrulama düzeltilmeden aktarılamaz.");
        }

        batch.Status = "IMPORTING";
        await _context.SaveChangesAsync();

        var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(currentUserId, isAdmin);
        var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(currentUserId, isAdmin);

        var residentRole = await _context.Roles.FirstOrDefaultAsync(r => r.Code == "RESIDENT");
        var residentRoleId = residentRole?.Id ?? 3;

        int createdCount = 0;
        bool isStale = false;
        string staleMessage = string.Empty;

        var strategy = _context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _context.Database.BeginTransactionAsync();

            try
            {
                foreach (var log in createLogs)
                {
                    var mapped = JsonSerializer.Deserialize<Dictionary<string, string>>(log.RawDataJson) ?? new();

                    int? createdId = await ExecuteRowEntityCreationAsync(
                        batch.ImportType,
                        mapped,
                        isAdmin,
                        accessiblePropertyIds,
                        accessibleBuildingIds,
                        residentRoleId);

                    if (!createdId.HasValue)
                    {
                        isStale = true;
                        staleMessage = $"Satır #{log.RowNumber} için güncelliğini yitirmiş doğrulama tespiti (STALE_VALIDATION). Lütfen partiyi tekrar doğrulayın.";
                        break;
                    }

                    log.Status = "IMPORTED";
                    log.CreatedEntityId = createdId.Value;
                    createdCount++;
                }

                if (isStale)
                {
                    await tx.RollbackAsync();
                }
                else
                {
                    batch.ImportedRows = createdCount;
                    batch.CompletedAt = DateTime.UtcNow;
                    batch.Status = "COMPLETED";
                    await _context.SaveChangesAsync();
                    await tx.CommitAsync();
                }
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                isStale = true;
                staleMessage = $"Aktarım esnasında beklenmeyen bir hata oluştu: {ex.Message}";
            }
        });

        if (isStale)
        {
            batch.Status = "FAILED";
            batch.ErrorMessage = staleMessage;
            await _context.SaveChangesAsync();
            throw new BadRequestException(staleMessage);
        }

        var user = await _context.Users.FindAsync(batch.CreatedByUserId);
        var batchDto = ToBatchDto(batch, user != null ? $"{user.FirstName} {user.LastName}".Trim() : string.Empty);

        return new ImportConfirmResponseDto
        {
            Batch = batchDto,
            Reconciliation = new ImportReconciliationDto
            {
                AttemptedCreateRows = createLogs.Count,
                SuccessfullyCreatedRows = createdCount,
                SkippedRows = batch.SkippedRows,
                FailedRows = 0
            }
        };
    }

    private async Task<int?> ExecuteRowEntityCreationAsync(
        string importType,
        Dictionary<string, string> mapped,
        bool isAdmin,
        List<int> accessiblePropertyIds,
        List<int> accessibleBuildingIds,
        int residentRoleId)
    {
        switch (importType)
        {
            case "PROPERTIES":
                {
                    if (!isAdmin) return null;
                    var name = GetValue(mapped, "Name");
                    var address = GetValue(mapped, "AddressLine");
                    var city = GetValue(mapped, "City");
                    var district = GetValue(mapped, "District");
                    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(address) || string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(district))
                        return null;

                    var exists = await _context.Properties.AsNoTracking().AnyAsync(p => p.Name.ToLower() == name.ToLower() && p.IsActive);
                    if (exists) return null;

                    var prop = new Property
                    {
                        Name = name,
                        AddressLine = address,
                        City = city,
                        District = district,
                        Description = GetValue(mapped, "Description"),
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Properties.Add(prop);
                    await _context.SaveChangesAsync();
                    return prop.Id;
                }

            case "BUILDINGS":
                {
                    var propName = GetValue(mapped, "PropertyName");
                    var name = GetValue(mapped, "Name");
                    var code = GetValue(mapped, "Code");
                    var floorStr = GetValue(mapped, "FloorCount");
                    if (string.IsNullOrWhiteSpace(propName) || string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(floorStr))
                        return null;
                    if (!int.TryParse(floorStr, out var floorCount) || floorCount < 1 || floorCount > 200) return null;

                    var prop = await _context.Properties.AsNoTracking().FirstOrDefaultAsync(p => p.Name.ToLower() == propName.ToLower() && p.IsActive);
                    if (prop is null) return null;
                    if (!isAdmin && !accessiblePropertyIds.Contains(prop.Id)) return null;

                    var exists = await _context.Buildings.AsNoTracking().AnyAsync(b => b.PropertyId == prop.Id && b.Code.ToLower() == code.ToLower() && b.IsActive);
                    if (exists) return null;

                    var bld = new Building
                    {
                        PropertyId = prop.Id,
                        Name = name,
                        Code = code,
                        FloorCount = floorCount,
                        Description = GetValue(mapped, "Description"),
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Buildings.Add(bld);
                    await _context.SaveChangesAsync();
                    return bld.Id;
                }

            case "UNITS":
                {
                    var propName = GetValue(mapped, "PropertyName");
                    var buildingCode = GetValue(mapped, "BuildingCode");
                    var unitNumber = GetValue(mapped, "UnitNumber");
                    var unitTypeCode = GetValue(mapped, "UnitTypeCode");
                    if (string.IsNullOrWhiteSpace(propName) || string.IsNullOrWhiteSpace(buildingCode) || string.IsNullOrWhiteSpace(unitNumber) || string.IsNullOrWhiteSpace(unitTypeCode))
                        return null;

                    var building = await _context.Buildings.AsNoTracking().Include(b => b.Property).FirstOrDefaultAsync(b => b.Property.Name.ToLower() == propName.ToLower() && b.Code.ToLower() == buildingCode.ToLower() && b.IsActive);
                    if (building is null) return null;
                    if (!isAdmin && !accessibleBuildingIds.Contains(building.Id)) return null;

                    var unitType = await _context.UnitTypes.AsNoTracking().FirstOrDefaultAsync(ut => ut.Code.ToLower() == unitTypeCode.ToLower() && ut.IsActive);
                    if (unitType is null) return null;

                    var exists = await _context.Units.AsNoTracking().AnyAsync(u => u.BuildingId == building.Id && u.UnitNumber.ToLower() == unitNumber.ToLower() && u.IsActive);
                    if (exists) return null;

                    decimal? grossArea = decimal.TryParse(GetValue(mapped, "GrossArea"), out var g) && g > 0 ? g : null;
                    decimal? netArea = decimal.TryParse(GetValue(mapped, "NetArea"), out var n) && n > 0 ? n : null;
                    int floorNum = int.TryParse(GetValue(mapped, "FloorNumber"), out var fn) ? fn : 0;

                    var unit = new Unit
                    {
                        BuildingId = building.Id,
                        UnitTypeId = unitType.Id,
                        UnitNumber = unitNumber,
                        FloorNumber = floorNum,
                        GrossArea = grossArea,
                        NetArea = netArea,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Units.Add(unit);
                    await _context.SaveChangesAsync();
                    return unit.Id;
                }

            case "USERS":
                {
                    var userName = GetValue(mapped, "UserName");
                    var email = GetValue(mapped, "Email");
                    var firstName = GetValue(mapped, "FirstName");
                    var lastName = GetValue(mapped, "LastName");
                    if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
                        return null;

                    var exists = await _context.Users.AsNoTracking().AnyAsync(u => u.UserName.ToLower() == userName.ToLower() || u.Email.ToLower() == email.ToLower());
                    if (exists) return null;

                    var tempPassword = $"{Guid.NewGuid():N}"[..10] + "!A1";
                    var user = new User
                    {
                        UserName = userName,
                        Email = email,
                        FirstName = firstName,
                        LastName = lastName,
                        PasswordHash = string.Empty,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };
                    user.PasswordHash = _passwordService.HashPassword(user, tempPassword);
                    _context.Users.Add(user);
                    await _context.SaveChangesAsync();

                    _context.UserRoles.Add(new UserRole
                    {
                        UserId = user.Id,
                        RoleId = residentRoleId
                    });
                    await _context.SaveChangesAsync();

                    return user.Id;
                }

            case "OCCUPANCIES":
                {
                    var propName = GetValue(mapped, "PropertyName");
                    var buildingCode = GetValue(mapped, "BuildingCode");
                    var unitNumber = GetValue(mapped, "UnitNumber");
                    var userNameOrEmail = GetValue(mapped, "UserNameOrEmail");
                    var occTypeCode = GetValue(mapped, "OccupancyTypeCode");
                    var startDateStr = GetValue(mapped, "StartDate");
                    if (string.IsNullOrWhiteSpace(propName) || string.IsNullOrWhiteSpace(buildingCode) || string.IsNullOrWhiteSpace(unitNumber) || string.IsNullOrWhiteSpace(userNameOrEmail) || string.IsNullOrWhiteSpace(occTypeCode) || string.IsNullOrWhiteSpace(startDateStr))
                        return null;

                    if (!DateTime.TryParse(startDateStr, out var startDate)) return null;
                    DateTime? endDate = DateTime.TryParse(GetValue(mapped, "EndDate"), out var ed) ? ed : null;

                    var unit = await _context.Units.AsNoTracking().Include(u => u.Building).ThenInclude(b => b.Property).FirstOrDefaultAsync(u => u.Building.Property.Name.ToLower() == propName.ToLower() && u.Building.Code.ToLower() == buildingCode.ToLower() && u.UnitNumber.ToLower() == unitNumber.ToLower() && u.IsActive);
                    if (unit is null) return null;
                    if (!isAdmin && !accessibleBuildingIds.Contains(unit.BuildingId)) return null;

                    var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserName.ToLower() == userNameOrEmail.ToLower() || u.Email.ToLower() == userNameOrEmail.ToLower());
                    if (user is null) return null;

                    var occType = await _context.OccupancyTypes.AsNoTracking().FirstOrDefaultAsync(ot => ot.Code.ToLower() == occTypeCode.ToLower() && ot.IsActive);
                    if (occType is null) return null;

                    var collision = await _context.UnitOccupancies.AsNoTracking().AnyAsync(uo => uo.IsActive && (uo.UnitId == unit.Id || uo.UserId == user.Id) && uo.OccupancyTypeId == occType.Id);
                    if (collision) return null;

                    var occ = new UnitOccupancy
                    {
                        UnitId = unit.Id,
                        UserId = user.Id,
                        OccupancyTypeId = occType.Id,
                        StartDate = startDate,
                        EndDate = endDate,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.UnitOccupancies.Add(occ);
                    await _context.SaveChangesAsync();
                    return occ.Id;
                }

            default:
                return null;
        }
    }

    public async Task<ImportSummaryResponseDto> GetSummaryAsync(
        int batchId,
        int currentUserId,
        bool isAdmin)
    {
        var batch = await GetBatchAndCheckAccessAsync(batchId, currentUserId, isAdmin);
        var user = await _context.Users.FindAsync(batch.CreatedByUserId);

        var createdIds = await _context.ImportRowLogs
            .AsNoTracking()
            .Where(rl => rl.ImportBatchId == batch.Id && rl.CreatedEntityId != null)
            .Select(rl => rl.CreatedEntityId!.Value)
            .ToListAsync();

        return new ImportSummaryResponseDto
        {
            Batch = ToBatchDto(batch, user != null ? $"{user.FirstName} {user.LastName}".Trim() : string.Empty),
            Reconciliation = new ImportReconciliationDto
            {
                AttemptedCreateRows = batch.ValidRows,
                SuccessfullyCreatedRows = batch.ImportedRows,
                SkippedRows = batch.SkippedRows,
                FailedRows = batch.InvalidRows
            },
            CreatedEntityIds = createdIds
        };
    }

    public async Task<ImportRollbackResponseDto> RollbackBatchAsync(
        int batchId,
        int currentUserId,
        bool isAdmin)
    {
        var batch = await _context.ImportBatches
            .Include(b => b.RowLogs)
            .FirstOrDefaultAsync(b => b.Id == batchId);

        if (batch is null)
        {
            throw new NotFoundException($"ID'si {batchId} olan içe aktarım partisi bulunamadı.");
        }

        if (!isAdmin && batch.CreatedByUserId != currentUserId)
        {
            throw new ForbiddenException("Bu içe aktarım partisini geri alma yetkiniz bulunmamaktadır.");
        }

        if (batch.Status == "ROLLED_BACK")
        {
            throw new BadRequestException("Bu içe aktarım partisi daha önce zaten geri alınmış (ROLLED_BACK).");
        }

        if (batch.Status != "COMPLETED")
        {
            throw new BadRequestException($"Yalnızca 'COMPLETED' statüsündeki partiler geri alınabilir. Mevcut statü: '{batch.Status}'.");
        }

        var createdEntityIds = batch.RowLogs
            .Where(rl => rl.CreatedEntityId.HasValue)
            .Select(rl => rl.CreatedEntityId!.Value)
            .Distinct()
            .ToList();

        if (createdEntityIds.Count == 0)
        {
            batch.Status = "ROLLED_BACK";
            batch.RolledBackAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var u = await _context.Users.FindAsync(batch.CreatedByUserId);
            return new ImportRollbackResponseDto
            {
                Batch = ToBatchDto(batch, u != null ? $"{u.FirstName} {u.LastName}".Trim() : string.Empty),
                IsSuccess = true,
                Message = "Parti geri alındı (Aktarılan kayıt bulunmuyordu).",
                RolledBackRecordCount = 0
            };
        }

        int rolledBackCount = 0;
        await CheckRollbackDependenciesAsync(batch.ImportType, createdEntityIds);

        var strategy = _context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _context.Database.BeginTransactionAsync();

            rolledBackCount = await ExecuteRollbackAsync(batch.ImportType, createdEntityIds);

            batch.Status = "ROLLED_BACK";
            batch.RolledBackAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        });

        var user = await _context.Users.FindAsync(batch.CreatedByUserId);
        return new ImportRollbackResponseDto
        {
            Batch = ToBatchDto(batch, user != null ? $"{user.FirstName} {user.LastName}".Trim() : string.Empty),
            IsSuccess = true,
            Message = $"İçe aktarılan {rolledBackCount} adet kayıt başarıyla geri alındı (ROLLED_BACK).",
            RolledBackRecordCount = rolledBackCount
        };
    }

    private async Task CheckRollbackDependenciesAsync(string importType, List<int> createdEntityIds)
    {
        switch (importType)
        {
            case "PROPERTIES":
                {
                    var hasBuildings = await _context.Buildings.AsNoTracking().AnyAsync(b => createdEntityIds.Contains(b.PropertyId));
                    var hasExpenses = await _context.Expenses.AsNoTracking().AnyAsync(e => createdEntityIds.Contains(e.PropertyId));
                    var hasDues = await _context.DueDefinitions.AsNoTracking().AnyAsync(d => createdEntityIds.Contains(d.PropertyId));
                    if (hasBuildings || hasExpenses || hasDues)
                    {
                        throw new BadRequestException("İçe aktarılan taşınmazlara bağlı blok, gider veya aidat tanımları bulunduğundan geri alma engellendi (ROLLBACK_BLOCKED).");
                    }
                    break;
                }

            case "BUILDINGS":
                {
                    var hasUnits = await _context.Units.AsNoTracking().AnyAsync(u => createdEntityIds.Contains(u.BuildingId));
                    var hasExpenses = await _context.Expenses.AsNoTracking().AnyAsync(e => e.BuildingId.HasValue && createdEntityIds.Contains(e.BuildingId.Value));
                    if (hasUnits || hasExpenses)
                    {
                        throw new BadRequestException("İçe aktarılan bloklara bağlı daire veya gider kayıtları bulunduğundan geri alma engellendi (ROLLBACK_BLOCKED).");
                    }
                    break;
                }

            case "UNITS":
                {
                    var hasOccupancies = await _context.UnitOccupancies.AsNoTracking().AnyAsync(uo => createdEntityIds.Contains(uo.UnitId));
                    var hasCharges = await _context.UnitCharges.AsNoTracking().AnyAsync(uc => createdEntityIds.Contains(uc.UnitId));
                    if (hasOccupancies || hasCharges)
                    {
                        throw new BadRequestException("İçe aktarılan dairelere bağlı ikamet veya borç kayıtları bulunduğundan geri alma engellendi (ROLLBACK_BLOCKED).");
                    }
                    break;
                }

            case "USERS":
                {
                    var hasOccupancies = await _context.UnitOccupancies.AsNoTracking().AnyAsync(uo => createdEntityIds.Contains(uo.UserId));
                    var hasSubmissions = await _context.PaymentSubmissions.AsNoTracking().AnyAsync(ps => createdEntityIds.Contains(ps.SubmittedByUserId));
                    var hasNotifications = await _context.Notifications.AsNoTracking().AnyAsync(n => createdEntityIds.Contains(n.UserId));
                    if (hasOccupancies || hasSubmissions || hasNotifications)
                    {
                        throw new BadRequestException("İçe aktarılan kullanıcılara ait ikamet veya finansal işlemler bulunduğundan geri alma engellendi (ROLLBACK_BLOCKED).");
                    }
                    break;
                }

            case "OCCUPANCIES":
                break;
        }
    }

    private async Task<int> ExecuteRollbackAsync(string importType, List<int> createdEntityIds)
    {
        int count = 0;
        switch (importType)
        {
            case "PROPERTIES":
                {
                    var items = await _context.Properties.Where(p => createdEntityIds.Contains(p.Id)).ToListAsync();
                    _context.Properties.RemoveRange(items);
                    count = items.Count;
                    break;
                }

            case "BUILDINGS":
                {
                    var items = await _context.Buildings.Where(b => createdEntityIds.Contains(b.Id)).ToListAsync();
                    _context.Buildings.RemoveRange(items);
                    count = items.Count;
                    break;
                }

            case "UNITS":
                {
                    var items = await _context.Units.Where(u => createdEntityIds.Contains(u.Id)).ToListAsync();
                    _context.Units.RemoveRange(items);
                    count = items.Count;
                    break;
                }

            case "USERS":
                {
                    var roles = await _context.UserRoles.Where(ur => createdEntityIds.Contains(ur.UserId)).ToListAsync();
                    _context.UserRoles.RemoveRange(roles);
                    var users = await _context.Users.Where(u => createdEntityIds.Contains(u.Id)).ToListAsync();
                    _context.Users.RemoveRange(users);
                    count = users.Count;
                    break;
                }

            case "OCCUPANCIES":
                {
                    var items = await _context.UnitOccupancies.Where(uo => createdEntityIds.Contains(uo.Id)).ToListAsync();
                    _context.UnitOccupancies.RemoveRange(items);
                    count = items.Count;
                    break;
                }
        }

        await _context.SaveChangesAsync();
        return count;
    }

    public async Task<(byte[] FileBytes, string ContentType, string FileName)> ExportErrorsCsvAsync(
        int batchId,
        int currentUserId,
        bool isAdmin)
    {
        var batch = await GetBatchAndCheckAccessAsync(batchId, currentUserId, isAdmin);

        var errorLogs = await _context.ImportRowLogs
            .AsNoTracking()
            .Where(rl => rl.ImportBatchId == batch.Id && (rl.Status == "INVALID" || rl.ActionPreview == "ERROR"))
            .OrderBy(rl => rl.RowNumber)
            .ToListAsync();

        var sb = new System.Text.StringBuilder();
        sb.Append('\uFEFF');
        sb.AppendLine("RowNumber,ActionPreview,ErrorCode,ErrorMessage,MappedValues");

        foreach (var log in errorLogs)
        {
            var errors = !string.IsNullOrWhiteSpace(log.ErrorMessagesJson)
                ? JsonSerializer.Deserialize<List<ValidationErrorItemDto>>(log.ErrorMessagesJson) ?? new()
                : new List<ValidationErrorItemDto>();

            var rawData = !string.IsNullOrWhiteSpace(log.RawDataJson)
                ? JsonSerializer.Deserialize<Dictionary<string, string>>(log.RawDataJson) ?? new()
                : new Dictionary<string, string>();

            var safeData = rawData
                .Where(kvp => !kvp.Key.Contains("password", StringComparison.OrdinalIgnoreCase))
                .Select(kvp => $"{kvp.Key}:{kvp.Value}");
            var mappedStr = string.Join("; ", safeData);

            foreach (var err in errors)
            {
                sb.AppendLine($"\"{log.RowNumber}\",\"{log.ActionPreview}\",\"{EscapeCsv(err.Code)}\",\"{EscapeCsv(err.Message)}\",\"{EscapeCsv(mappedStr)}\"");
            }

            if (errors.Count == 0)
            {
                sb.AppendLine($"\"{log.RowNumber}\",\"{log.ActionPreview}\",\"ERROR\",\"Hata detayı bulunamadı.\",\"{EscapeCsv(mappedStr)}\"");
            }
        }

        var fileBytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"import_errors_batch_{batchId}.csv";
        return (fileBytes, "text/csv; charset=utf-8", fileName);
    }

    private static string EscapeCsv(string val)
    {
        if (string.IsNullOrEmpty(val)) return string.Empty;
        return val.Replace("\"", "\"\"");
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

    public async Task<ImportBatchListResponseDto> GetBatchesAsync(
        string? importType,
        string? status,
        int page,
        int pageSize,
        int currentUserId,
        bool isAdmin)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = _context.ImportBatches.AsNoTracking();

        if (!isAdmin)
        {
            query = query.Where(b => b.CreatedByUserId == currentUserId);
        }

        if (!string.IsNullOrWhiteSpace(importType))
        {
            var normType = importType.Trim().ToUpperInvariant();
            query = query.Where(b => b.ImportType == normType);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normStatus = status.Trim().ToUpperInvariant();
            query = query.Where(b => b.Status == normStatus);
        }

        var totalCount = await query.CountAsync();
        var batches = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var userIds = batches.Select(b => b.CreatedByUserId).Distinct().ToList();
        var users = await _context.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim());

        var dtos = batches.Select(b => ToBatchDto(b, users.TryGetValue(b.CreatedByUserId, out var name) ? name : string.Empty)).ToList();

        return new ImportBatchListResponseDto
        {
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Items = dtos
        };
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
