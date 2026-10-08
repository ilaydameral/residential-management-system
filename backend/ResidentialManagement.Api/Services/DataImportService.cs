using System.Data;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class DataImportService : IDataImportService
{
    private sealed record ValidatedImportTarget(Property? Property, Building? Building);
    private sealed class ImportRowExecutionException : Exception
    {
        public ImportRowExecutionException(int rowNumber, string message) : base(message)
        {
            RowNumber = rowNumber;
        }

        public int RowNumber { get; }
    }

    private readonly AppDbContext _context;
    private readonly IImportFileStorageService _storageService;
    private readonly IImportFileParser _fileParser;
    private readonly IManagerScopeService _managerScopeService;
    private readonly IPasswordService _passwordService;
    private readonly IBuildingService _buildingService;
    private readonly IUnitService _unitService;
    private readonly ILogger<DataImportService> _logger;

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
                new() { Key = "PropertyName", Label = "Taşınmaz Adı", IsRequired = false },
                new() { Key = "Name", Label = "Blok Adı", IsRequired = true },
                new() { Key = "Code", Label = "Blok Kodu", IsRequired = true },
                new() { Key = "FloorCount", Label = "Kat Sayısı (1-200)", IsRequired = true },
                new() { Key = "Description", Label = "Açıklama", IsRequired = false }
            }
        },
        {
            "UNITS", new List<TargetFieldOptionDto>
            {
                new() { Key = "PropertyName", Label = "Taşınmaz Adı", IsRequired = false },
                new() { Key = "BuildingCode", Label = "Blok Kodu", IsRequired = false },
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
                new() { Key = "PropertyName", Label = "Taşınmaz Adı", IsRequired = false },
                new() { Key = "BuildingCode", Label = "Blok Kodu", IsRequired = false },
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
        IPasswordService passwordService,
        IBuildingService buildingService,
        IUnitService unitService,
        ILogger<DataImportService> logger)
    {
        _context = context;
        _storageService = storageService;
        _fileParser = fileParser;
        _managerScopeService = managerScopeService;
        _passwordService = passwordService;
        _buildingService = buildingService;
        _unitService = unitService;
        _logger = logger;
    }

    public async Task<ImportUploadResponseDto> UploadFileAsync(
        IFormFile file,
        string importType,
        int? targetPropertyId,
        int? targetBuildingId,
        int currentUserId,
        bool isAdmin)
    {
        var normalizedType = importType?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!ImportTypePolicies.TryGet(normalizedType, out var policy))
        {
            throw new BadRequestException($"Geçersiz içe aktarım türü: '{importType}'.");
        }

        var target = await ValidateImportTargetAsync(
            policy,
            targetPropertyId,
            targetBuildingId,
            currentUserId,
            isAdmin);

        using var stream = file.OpenReadStream();
        var (storageKey, fileHashSha256, fileSizeBytes) = await _storageService.SaveImportFileAsync(stream, file.FileName);
        ImportBatch batch;
        bool isDuplicateUpload;
        string? duplicateWarning;
        try
        {
            var validatedTargetPropertyId = target.Property?.Id;
            var validatedTargetBuildingId = target.Building?.Id;

            var existingBatch = await _context.ImportBatches
                .AsNoTracking()
                .Where(b => b.CreatedByUserId == currentUserId &&
                            b.ImportType == normalizedType &&
                            b.TargetPropertyId == validatedTargetPropertyId &&
                            b.TargetBuildingId == validatedTargetBuildingId &&
                            b.FileHashSha256 == fileHashSha256)
                .OrderByDescending(b => b.CreatedAt)
                .FirstOrDefaultAsync();

            isDuplicateUpload = existingBatch != null;
            duplicateWarning = isDuplicateUpload
                ? $"Daha önce bu dosya içeriğiyle bir içe aktarım oluşturulmuş (Parti ID: #{existingBatch!.Id}, Yüklenme: {existingBatch.CreatedAt:g})."
                : null;

            batch = new ImportBatch
            {
                ImportType = normalizedType,
                OriginalFileName = file.FileName,
                StorageKey = storageKey,
                FileHashSha256 = fileHashSha256,
                Status = "UPLOADED",
                TargetPropertyId = target.Property?.Id,
                TargetBuildingId = target.Building?.Id,
                CreatedByUserId = currentUserId,
                CreatedAt = DateTime.UtcNow
            };

            _context.ImportBatches.Add(batch);
            await _context.SaveChangesAsync();
        }
        catch
        {
            FailedUploadCleanup.Run(() => _storageService.DeleteImportFile(storageKey), _logger);
            throw;
        }

        var user = await _context.Users.FindAsync(currentUserId);

        var batchDto = ToBatchDto(batch, user != null ? $"{user.FirstName} {user.LastName}".Trim() : string.Empty);
        batchDto.TargetPropertyName = target.Property?.Name;
        batchDto.TargetBuildingName = target.Building?.Name;
        batchDto.TargetBuildingCode = target.Building?.Code;

        return new ImportUploadResponseDto
        {
            Batch = batchDto,
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

        if (!ImportTypePolicies.TryGet(batch.ImportType, out var policy) || !policy.IsEndToEndSupported)
        {
            throw new BadRequestException($"'{batch.ImportType}' içe aktarım türü henüz desteklenmemektedir.");
        }

        await ValidateBatchTargetForReadAsync(policy, batch, currentUserId, isAdmin);

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

        if (!ImportTypePolicies.TryGet(batch.ImportType, out var policy) || !policy.IsEndToEndSupported ||
            !TargetFieldsRegistry.TryGetValue(batch.ImportType, out var allowedFields))
        {
            throw new BadRequestException($"'{batch.ImportType}' v1 aktarım motorunda desteklenmemektedir.");
        }

        var target = await ValidateImportTargetAsync(
            policy,
            batch.TargetPropertyId,
            batch.TargetBuildingId,
            currentUserId,
            isAdmin);

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
                isAdmin,
                target);

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
        bool isAdmin,
        ValidatedImportTarget target)
    {
        return importType switch
        {
            "PROPERTIES" => await ValidatePropertyRowAsync(mappedValues, errors, isAdmin),
            "BUILDINGS" => await ValidateBuildingRowAsync(mappedValues, errors, target),
            "UNITS" => await ValidateUnitRowAsync(mappedValues, errors, target),
            "USERS" => await ValidateUserRowAsync(mappedValues, errors),
            "OCCUPANCIES" => await ValidateOccupancyRowAsync(mappedValues, errors, target),
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
        var propTypeCode = GetValue(mappedValues, "PropertyTypeCode");

        if (string.IsNullOrWhiteSpace(name))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "Name", Message = "Taşınmaz adı zorunludur." });
        if (string.IsNullOrWhiteSpace(address))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "AddressLine", Message = "Adres alanı zorunludur." });
        if (string.IsNullOrWhiteSpace(city))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "City", Message = "İl alanı zorunludur." });
        if (string.IsNullOrWhiteSpace(district))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "District", Message = "İlçe alanı zorunludur." });

        if (!string.IsNullOrWhiteSpace(propTypeCode))
        {
            var lookup = await _context.PropertyTypes
                .AsNoTracking()
                .FirstOrDefaultAsync(pt => pt.Code.ToLower() == propTypeCode.ToLower() || pt.Name.ToLower() == propTypeCode.ToLower());
            if (lookup is null || !lookup.IsActive)
            {
                errors.Add(new ValidationErrorItemDto { Code = "REFERENCE_NOT_FOUND", Field = "PropertyTypeCode", Message = $"'{propTypeCode}' kodlu aktif bir taşınmaz tipi bulunamadı." });
            }
        }

        if (errors.Count > 0)
        {
            return ("ERROR", "INVALID");
        }

        var existingProp = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Name.ToLower() == name!.ToLower());

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
        ValidatedImportTarget target)
    {
        var propName = GetValue(mappedValues, "PropertyName");
        var name = GetValue(mappedValues, "Name");
        var code = GetValue(mappedValues, "Code");
        var floorStr = GetValue(mappedValues, "FloorCount");

        if (string.IsNullOrWhiteSpace(name))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "Name", Message = "Blok adı zorunludur." });
        else if (name.Length > 150)
            errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "Name", Message = "Blok adı en fazla 150 karakter olabilir." });
        if (string.IsNullOrWhiteSpace(code))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "Code", Message = "Blok kodu zorunludur." });
        else if (code.Length > 50)
            errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "Code", Message = "Blok kodu en fazla 50 karakter olabilir." });
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

        var prop = target.Property!;
        if (!MatchesOptionalTargetValue(propName, prop.Name))
        {
            errors.Add(new ValidationErrorItemDto
            {
                Code = "TARGET_MISMATCH",
                Field = "PropertyName",
                Message = $"Satırdaki taşınmaz '{propName}', seçilen hedef yapı '{prop.Name}' ile eşleşmiyor."
            });
            return ("ERROR", "INVALID");
        }

        var isSingleApartment = await _context.Properties
            .AsNoTracking()
            .Where(p => p.Id == prop.Id)
            .Select(p => p.PropertyTypeLookup != null && p.PropertyTypeLookup.Code == "SINGLE_APARTMENT" ||
                         p.PropertyType == "SINGLE_APARTMENT" ||
                         p.PropertyType == "Tek Apartman" ||
                         p.PropertyType == "Apartman")
            .FirstAsync();

        if (isSingleApartment && await _context.Buildings.AnyAsync(b => b.PropertyId == prop.Id))
        {
            errors.Add(new ValidationErrorItemDto
            {
                Code = "DOMAIN_CONFLICT",
                Field = "PropertyName",
                Message = "Tek apartman türündeki bir yapı altında en fazla bir bina bulunabilir."
            });
            return ("ERROR", "INVALID");
        }

        var normalizedCode = NormalizeBuildingCode(code!);
        var existingBuilding = await _context.Buildings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.PropertyId == prop.Id && b.Code == normalizedCode);

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
        ValidatedImportTarget target)
    {
        var propName = GetValue(mappedValues, "PropertyName");
        var buildingCode = GetValue(mappedValues, "BuildingCode");
        var unitNumber = GetValue(mappedValues, "UnitNumber");
        var unitTypeCode = GetValue(mappedValues, "UnitTypeCode");
        var grossStr = GetValue(mappedValues, "GrossArea");
        var netStr = GetValue(mappedValues, "NetArea");
        var floorStr = GetValue(mappedValues, "FloorNumber");

        if (string.IsNullOrWhiteSpace(unitNumber))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "UnitNumber", Message = "Daire No zorunludur." });
        else if (unitNumber.Length > 50)
            errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "UnitNumber", Message = "Daire numarası en fazla 50 karakter olabilir." });
        if (string.IsNullOrWhiteSpace(unitTypeCode))
            errors.Add(new ValidationErrorItemDto { Code = "REQUIRED_FIELD", Field = "UnitTypeCode", Message = "Daire tipi kodu zorunludur." });

        decimal? grossArea = null;
        if (!string.IsNullOrWhiteSpace(grossStr))
        {
            if (!decimal.TryParse(grossStr, out var g) || g <= 0 || g > 999999.99m)
                errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "GrossArea", Message = "Brüt alan 0,01 ile 999999,99 arasında olmalıdır." });
            else
                grossArea = g;
        }

        decimal? netArea = null;
        if (!string.IsNullOrWhiteSpace(netStr))
        {
            if (!decimal.TryParse(netStr, out var n) || n <= 0 || n > 999999.99m)
                errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "NetArea", Message = "Net alan 0,01 ile 999999,99 arasında olmalıdır." });
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

        var building = target.Building!;

        var floorNumber = 0;
        if (!string.IsNullOrWhiteSpace(floorStr) && !int.TryParse(floorStr, out floorNumber))
        {
            errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "FloorNumber", Message = "Kat numarası tam sayı olmalıdır." });
        }
        else if (floorNumber > building.FloorCount)
        {
            errors.Add(new ValidationErrorItemDto { Code = "INVALID_VALUE", Field = "FloorNumber", Message = $"Kat numarası bina kat sayısından ({building.FloorCount}) büyük olamaz." });
        }

        if (errors.Count > 0)
        {
            return ("ERROR", "INVALID");
        }

        if (!MatchesOptionalTargetValue(propName, target.Property!.Name))
        {
            errors.Add(new ValidationErrorItemDto
            {
                Code = "TARGET_MISMATCH",
                Field = "PropertyName",
                Message = $"Satırdaki taşınmaz '{propName}', seçilen hedef yapı '{target.Property.Name}' ile eşleşmiyor."
            });
            return ("ERROR", "INVALID");
        }

        if (!MatchesOptionalTargetValue(buildingCode, building.Code))
        {
            errors.Add(new ValidationErrorItemDto
            {
                Code = "TARGET_MISMATCH",
                Field = "BuildingCode",
                Message = $"Satırdaki blok kodu '{buildingCode}', seçilen hedef blok '{building.Code}' ile eşleşmiyor."
            });
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
            .FirstOrDefaultAsync(u => u.BuildingId == building.Id && u.UnitNumber.ToLower() == unitNumber!.ToLower());

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
        ValidatedImportTarget target)
    {
        var propName = GetValue(mappedValues, "PropertyName");
        var buildingCode = GetValue(mappedValues, "BuildingCode");
        var unitNumber = GetValue(mappedValues, "UnitNumber");
        var userNameOrEmail = GetValue(mappedValues, "UserNameOrEmail");
        var occTypeCode = GetValue(mappedValues, "OccupancyTypeCode");
        var startDateStr = GetValue(mappedValues, "StartDate");
        var endDateStr = GetValue(mappedValues, "EndDate");

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

        if (!MatchesOptionalTargetValue(propName, target.Property!.Name))
        {
            errors.Add(new ValidationErrorItemDto
            {
                Code = "TARGET_MISMATCH",
                Field = "PropertyName",
                Message = $"Satırdaki taşınmaz '{propName}', seçilen hedef yapı '{target.Property.Name}' ile eşleşmiyor."
            });
            return ("ERROR", "INVALID");
        }

        if (!MatchesOptionalTargetValue(buildingCode, target.Building!.Code))
        {
            errors.Add(new ValidationErrorItemDto
            {
                Code = "TARGET_MISMATCH",
                Field = "BuildingCode",
                Message = $"Satırdaki blok kodu '{buildingCode}', seçilen hedef blok '{target.Building.Code}' ile eşleşmiyor."
            });
            return ("ERROR", "INVALID");
        }

        var unit = await _context.Units
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.BuildingId == target.Building.Id &&
                                      u.UnitNumber.ToLower() == unitNumber!.ToLower() &&
                                      u.IsActive);

        if (unit is null)
        {
            errors.Add(new ValidationErrorItemDto { Code = "REFERENCE_NOT_FOUND", Field = "UnitNumber", Message = $"Seçilen hedef blokta '{unitNumber}' nolu aktif bir daire bulunamadı." });
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

        if (!user.IsActive)
        {
            errors.Add(new ValidationErrorItemDto { Code = "INACTIVE_REFERENCE", Field = "UserNameOrEmail", Message = $"'{userNameOrEmail}' kullanıcısı pasif olduğu için ikamet kaydı oluşturulamaz." });
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

        var normalizedStartDate = NormalizeUtc(startDate);
        DateTime? normalizedEndDate = endDate.HasValue ? NormalizeUtc(endDate.Value) : null;
        var requestedEndDate = normalizedEndDate ?? DateTime.MaxValue;

        var collision = await _context.UnitOccupancies
            .AsNoTracking()
            .AnyAsync(uo =>
                uo.UserId == user.Id &&
                uo.UnitId == unit.Id &&
                uo.OccupancyTypeId == occType.Id &&
                uo.StartDate <= requestedEndDate &&
                (!uo.EndDate.HasValue || uo.EndDate.Value >= normalizedStartDate));

        if (collision)
        {
            errors.Add(new ValidationErrorItemDto { Code = "DUPLICATE", Field = "UserNameOrEmail", Message = $"'{unitNumber}' dairesinde '{user.UserName}' için çakışan bir ikamet dönemi zaten mevcut." });
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

        if (!ImportTypePolicies.TryGet(batch.ImportType, out var policy) || !policy.IsEndToEndSupported)
        {
            throw new BadRequestException($"'{batch.ImportType}' içe aktarım türü henüz desteklenmemektedir.");
        }

        await ValidateBatchTargetForReadAsync(policy, batch, currentUserId, isAdmin);

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

        if (!ImportTypePolicies.TryGet(batch.ImportType, out var policy) || !policy.IsEndToEndSupported)
        {
            throw new BadRequestException($"'{batch.ImportType}' içe aktarım türü henüz desteklenmemektedir.");
        }

        if (batch.Status != "READY")
        {
            if (batch.Status is "IMPORTING" or "COMPLETED")
            {
                throw new ConflictException("Bu içe aktarım partisi başka bir işlem tarafından alınmış veya tamamlanmıştır.");
            }

            throw new BadRequestException($"Yalnızca 'READY' statüsündeki partiler içe aktarılabilir. Mevcut statü: '{batch.Status}'.");
        }

        EnsureBatchHasExecutionTarget(policy, batch);
        var target = await ValidateImportTargetAsync(
            policy,
            batch.TargetPropertyId,
            batch.TargetBuildingId,
            currentUserId,
            isAdmin);

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
        batch.ErrorMessage = null;
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            _context.ChangeTracker.Clear();
            throw new ConflictException("Bu içe aktarım partisi başka bir işlem tarafından alınmıştır. Lütfen durumu yenileyin.");
        }

        int? residentRoleId = null;
        if (batch.ImportType == "USERS")
        {
            residentRoleId = await _context.Roles
                .Where(r => r.Code == "RESIDENT" && r.IsActive)
                .Select(r => (int?)r.Id)
                .FirstOrDefaultAsync();

            if (!residentRoleId.HasValue)
            {
                await MarkBatchFailedAsync(batch.Id, "Aktarım için gerekli aktif Sakin rolü bulunamadı.");
                throw new ConflictException("Aktarım için gerekli aktif Sakin rolü bulunamadı.");
            }
        }

        int createdCount = 0;

        var strategy = _context.Database.CreateExecutionStrategy();
        try
        {
            await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

                createdCount = 0;
                foreach (var log in createLogs)
                {
                    log.Status = "VALID";
                    log.CreatedEntityId = null;
                }

                // Scope and target state may have changed after validation/claim; check again in the execution transaction.
                target = await ValidateImportTargetAsync(
                    policy,
                    batch.TargetPropertyId,
                    batch.TargetBuildingId,
                    currentUserId,
                    isAdmin);

                foreach (var log in createLogs)
                {
                    var mapped = JsonSerializer.Deserialize<Dictionary<string, string>>(log.RawDataJson) ?? new();

                    try
                    {
                        var createdId = await ExecuteRowEntityCreationAsync(
                            batch,
                            target,
                            mapped,
                            residentRoleId);

                        log.Status = "IMPORTED";
                        log.CreatedEntityId = createdId;
                        createdCount++;
                    }
                    catch (Exception ex) when (ex is InvalidOperationException or KeyNotFoundException or BadRequestException or DbUpdateException)
                    {
                        throw new ImportRowExecutionException(
                            log.RowNumber,
                            GetControlledDomainError(ex));
                    }
                }

                batch.ImportedRows = createdCount;
                batch.CompletedAt = DateTime.UtcNow;
                batch.Status = "COMPLETED";
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            });
        }
        catch (ImportRowExecutionException ex)
        {
            var message = $"Satır #{ex.RowNumber} güncel alan kurallarıyla çakıştığı için aktarım geri alındı: {ex.Message}";
            await MarkBatchFailedAsync(batch.Id, message, ex.RowNumber);
            throw new ConflictException(message);
        }
        catch (Exception ex) when (ex is ForbiddenException or NotFoundException or BadRequestException)
        {
            await MarkBatchFailedAsync(batch.Id, "Hedef kapsam veya yetki doğrulaması başarısız oldu.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Import batch {BatchId} execution failed and was rolled back.", batch.Id);
            const string message = "Aktarım tamamlanamadı. Hiçbir veri kaydedilmedi; lütfen partiyi yeniden doğrulayın.";
            await MarkBatchFailedAsync(batch.Id, message);
            throw new BadRequestException(message);
        }

        _context.ChangeTracker.Clear();
        batch = await _context.ImportBatches
            .Include(b => b.TargetProperty)
            .Include(b => b.TargetBuilding)
            .FirstAsync(b => b.Id == batchId);
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

    private async Task<int> ExecuteRowEntityCreationAsync(
        ImportBatch batch,
        ValidatedImportTarget target,
        Dictionary<string, string> mapped,
        int? residentRoleId)
    {
        EnsureExecutionTargetMetadata(batch.ImportType, target, mapped);

        switch (batch.ImportType)
        {
            case "PROPERTIES":
                {
                    var name = GetValue(mapped, "Name");
                    var address = GetValue(mapped, "AddressLine");
                    var city = GetValue(mapped, "City");
                    var district = GetValue(mapped, "District");
                    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(address) || string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(district))
                        throw new InvalidOperationException("Zorunlu yapı alanlarından biri eksik.");

                    var exists = await _context.Properties.AsNoTracking().AnyAsync(p => p.Name.ToLower() == name.ToLower());
                    if (exists) throw new InvalidOperationException("Aynı ada sahip bir yapı zaten mevcut.");

                    var typeCode = GetValue(mapped, "PropertyTypeCode");
                    int? propertyTypeId = null;
                    string propertyTypeCode = "RESIDENTIAL_COMPLEX";
                    if (!string.IsNullOrWhiteSpace(typeCode))
                    {
                        var lookup = await _context.PropertyTypes.FirstOrDefaultAsync(pt => pt.Code.ToLower() == typeCode.ToLower() || pt.Name.ToLower() == typeCode.ToLower());
                        if (lookup is null || !lookup.IsActive)
                        {
                            throw new InvalidOperationException("Geçerli veya aktif bir gayrimenkul türü bulunamadı.");
                        }
                        propertyTypeId = lookup.Id;
                        propertyTypeCode = lookup.Code;
                    }
                    else
                    {
                        var defaultType = await _context.PropertyTypes.FirstOrDefaultAsync(pt => pt.Code == "RESIDENTIAL_COMPLEX");
                        if (defaultType != null)
                        {
                            propertyTypeId = defaultType.Id;
                            propertyTypeCode = defaultType.Code;
                        }
                    }

                    var prop = new Property
                    {
                        Name = name,
                        PropertyTypeId = propertyTypeId,
                        PropertyType = propertyTypeCode,
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
                    var name = GetValue(mapped, "Name");
                    var code = GetValue(mapped, "Code");
                    var floorStr = GetValue(mapped, "FloorCount");
                    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(code) ||
                        name.Length > 150 || code.Length > 50 ||
                        !int.TryParse(floorStr, out var floorCount) || floorCount is < 1 or > 200)
                    {
                        throw new InvalidOperationException("Bina adı, kodu ve geçerli kat sayısı zorunludur.");
                    }

                    var created = await _buildingService.CreateBuildingAsync(new CreateBuildingDto
                    {
                        PropertyId = target.Property!.Id,
                        Name = name,
                        Code = code,
                        FloorCount = floorCount,
                        Description = GetValue(mapped, "Description")
                    });
                    return created.Id;
                }

            case "UNITS":
                {
                    var unitNumber = GetValue(mapped, "UnitNumber");
                    var unitTypeCode = GetValue(mapped, "UnitTypeCode");
                    if (string.IsNullOrWhiteSpace(unitNumber) || string.IsNullOrWhiteSpace(unitTypeCode))
                        throw new InvalidOperationException("Daire numarası ve daire türü zorunludur.");

                    var unitType = await _context.UnitTypes.AsNoTracking().FirstOrDefaultAsync(ut => ut.Code.ToLower() == unitTypeCode.ToLower() && ut.IsActive);
                    if (unitType is null) throw new InvalidOperationException("Aktif ve geçerli bir daire türü bulunamadı.");

                    if (unitNumber.Length > 50)
                        throw new InvalidOperationException("Daire numarası en fazla 50 karakter olabilir.");

                    var grossArea = ParseOptionalArea(GetValue(mapped, "GrossArea"), "Brüt alan");
                    var netArea = ParseOptionalArea(GetValue(mapped, "NetArea"), "Net alan");
                    int floorNum = int.TryParse(GetValue(mapped, "FloorNumber"), out var fn) ? fn : 0;

                    var created = await _unitService.CreateUnitAsync(new CreateUnitDto
                    {
                        BuildingId = target.Building!.Id,
                        UnitTypeId = unitType.Id,
                        UnitNumber = unitNumber,
                        FloorNumber = floorNum,
                        GrossArea = grossArea,
                        NetArea = netArea,
                    });
                    return created.Id;
                }

            case "USERS":
                {
                    var userName = GetValue(mapped, "UserName");
                    var email = GetValue(mapped, "Email");
                    var firstName = GetValue(mapped, "FirstName");
                    var lastName = GetValue(mapped, "LastName");
                    if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
                        throw new InvalidOperationException("Kullanıcı adı, e-posta, ad ve soyad zorunludur.");

                    var exists = await _context.Users.AsNoTracking().AnyAsync(u => u.UserName.ToLower() == userName.ToLower() || u.Email.ToLower() == email.ToLower());
                    if (exists) throw new InvalidOperationException("Aynı kullanıcı adı veya e-posta ile bir kullanıcı zaten mevcut.");

                    if (!residentRoleId.HasValue)
                        throw new InvalidOperationException("Aktif Sakin rolü bulunamadı.");

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
                        RoleId = residentRoleId.Value
                    });
                    await _context.SaveChangesAsync();

                    return user.Id;
                }

            case "OCCUPANCIES":
                {
                    return await CreateImportedOccupancyAsync(target.Building!.Id, mapped);
                }

            default:
                throw new InvalidOperationException("Desteklenmeyen içe aktarım türü yürütülemez.");
        }
    }

    private async Task<int> CreateImportedOccupancyAsync(
        int targetBuildingId,
        Dictionary<string, string> mapped)
    {
        var unitNumber = GetValue(mapped, "UnitNumber");
        var userNameOrEmail = GetValue(mapped, "UserNameOrEmail");
        var occupancyTypeCode = GetValue(mapped, "OccupancyTypeCode");
        var startDateValue = GetValue(mapped, "StartDate");

        if (string.IsNullOrWhiteSpace(unitNumber) ||
            string.IsNullOrWhiteSpace(userNameOrEmail) ||
            string.IsNullOrWhiteSpace(occupancyTypeCode) ||
            !DateTime.TryParse(startDateValue, out var parsedStartDate))
        {
            throw new InvalidOperationException("Daire, kullanıcı, ikamet türü ve geçerli başlangıç tarihi zorunludur.");
        }

        var startDate = NormalizeUtc(parsedStartDate);
        var endDateValue = GetValue(mapped, "EndDate");
        DateTime? endDate = null;
        if (!string.IsNullOrWhiteSpace(endDateValue))
        {
            if (!DateTime.TryParse(endDateValue, out var parsedEndDate))
            {
                throw new InvalidOperationException("Bitiş tarihi geçerli bir tarih olmalıdır.");
            }

            endDate = NormalizeUtc(parsedEndDate);
        }

        if (endDate.HasValue && endDate.Value < startDate)
        {
            throw new InvalidOperationException("Bitiş tarihi başlangıç tarihinden önce olamaz.");
        }

        var unit = await _context.Units
            .Include(u => u.Building)
                .ThenInclude(b => b.Property)
            .FirstOrDefaultAsync(u =>
                u.BuildingId == targetBuildingId &&
                u.UnitNumber.ToLower() == unitNumber.ToLower());

        if (unit is null)
        {
            throw new KeyNotFoundException("Seçilen hedef blokta belirtilen daire bulunamadı.");
        }

        if (!unit.IsActive || !unit.Building.IsActive || !unit.Building.Property.IsActive)
        {
            throw new InvalidOperationException("Pasif daire, bina veya yapı için ikamet kaydı oluşturulamaz.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u =>
            u.UserName.ToLower() == userNameOrEmail.ToLower() ||
            u.Email.ToLower() == userNameOrEmail.ToLower());

        if (user is null)
        {
            throw new KeyNotFoundException("Belirtilen kullanıcı bulunamadı.");
        }

        if (!user.IsActive)
        {
            throw new InvalidOperationException("Pasif kullanıcı için ikamet kaydı oluşturulamaz.");
        }

        var occupancyType = await _context.OccupancyTypes.FirstOrDefaultAsync(ot =>
            ot.Code.ToLower() == occupancyTypeCode.ToLower());

        if (occupancyType is null)
        {
            throw new KeyNotFoundException("Belirtilen ikamet türü bulunamadı.");
        }

        if (!occupancyType.IsActive)
        {
            throw new InvalidOperationException("Pasif ikamet türü kullanılamaz.");
        }

        var requestedEndDate = endDate ?? DateTime.MaxValue;
        var hasOverlap = await _context.UnitOccupancies.AnyAsync(occupancy =>
            occupancy.UserId == user.Id &&
            occupancy.UnitId == unit.Id &&
            occupancy.OccupancyTypeId == occupancyType.Id &&
            occupancy.StartDate <= requestedEndDate &&
            (!occupancy.EndDate.HasValue || occupancy.EndDate.Value >= startDate));

        if (hasOverlap)
        {
            throw new InvalidOperationException("Aynı kullanıcı, daire ve ikamet türü için çakışan tarih aralığı zaten mevcut.");
        }

        var utcNow = DateTime.UtcNow;
        var occupancy = new UnitOccupancy
        {
            UnitId = unit.Id,
            UserId = user.Id,
            OccupancyTypeId = occupancyType.Id,
            StartDate = startDate,
            EndDate = endDate,
            IsActive = !endDate.HasValue || endDate.Value >= utcNow,
            IsPrimary = false,
            CreatedAt = utcNow
        };

        _context.UnitOccupancies.Add(occupancy);
        await _context.SaveChangesAsync();
        return occupancy.Id;
    }

    private async Task MarkBatchFailedAsync(int batchId, string message, int? failedRowNumber = null)
    {
        _context.ChangeTracker.Clear();

        var failedBatch = await _context.ImportBatches
            .Include(b => b.RowLogs)
            .FirstOrDefaultAsync(b => b.Id == batchId);

        if (failedBatch is null || failedBatch.Status == "COMPLETED")
        {
            return;
        }

        failedBatch.Status = "FAILED";
        failedBatch.ImportedRows = 0;
        failedBatch.CompletedAt = null;
        failedBatch.ErrorMessage = message;

        if (failedRowNumber.HasValue)
        {
            var failedRow = failedBatch.RowLogs.FirstOrDefault(r => r.RowNumber == failedRowNumber.Value);
            if (failedRow is not null)
            {
                failedRow.Status = "INVALID";
                failedRow.ActionPreview = "ERROR";
                failedRow.CreatedEntityId = null;
                failedRow.ErrorMessagesJson = JsonSerializer.Serialize(new[]
                {
                    new ValidationErrorItemDto
                    {
                        Code = "DOMAIN_CONFLICT",
                        Field = string.Empty,
                        Message = message
                    }
                });
            }
        }

        await _context.SaveChangesAsync();
    }

    private static void EnsureBatchHasExecutionTarget(ImportTypePolicy policy, ImportBatch batch)
    {
        if (policy.TargetRequirement == ImportTargetRequirement.Property && !batch.TargetPropertyId.HasValue)
        {
            throw new BadRequestException("Bu eski içe aktarım partisinde hedef yapı bilgisi bulunmadığı için aktarım yürütülemez.");
        }

        if (policy.TargetRequirement == ImportTargetRequirement.Building &&
            (!batch.TargetPropertyId.HasValue || !batch.TargetBuildingId.HasValue))
        {
            throw new BadRequestException("Bu eski içe aktarım partisinde hedef yapı/blok bilgisi bulunmadığı için aktarım yürütülemez.");
        }
    }

    private static void EnsureExecutionTargetMetadata(
        string importType,
        ValidatedImportTarget target,
        Dictionary<string, string> mapped)
    {
        if (importType is not ("BUILDINGS" or "UNITS" or "OCCUPANCIES"))
        {
            return;
        }

        var propertyName = GetValue(mapped, "PropertyName");
        if (!MatchesOptionalTargetValue(propertyName, target.Property!.Name))
        {
            throw new InvalidOperationException("Satırdaki yapı bilgisi seçilen aktarım hedefiyle eşleşmiyor.");
        }

        if (importType is "UNITS" or "OCCUPANCIES")
        {
            var buildingCode = GetValue(mapped, "BuildingCode");
            if (!MatchesOptionalTargetValue(buildingCode, target.Building!.Code))
            {
                throw new InvalidOperationException("Satırdaki blok bilgisi seçilen aktarım hedefiyle eşleşmiyor.");
            }
        }
    }

    private static string GetControlledDomainError(Exception exception)
    {
        return exception switch
        {
            DbUpdateException => "Kayıt, veritabanındaki benzersizlik veya bütünlük kuralıyla çakışıyor.",
            InvalidOperationException or KeyNotFoundException or BadRequestException => exception.Message,
            _ => "Satır güncel alan kurallarıyla doğrulanamadı."
        };
    }

    private static decimal? ParseOptionalArea(string? value, string fieldLabel)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (!decimal.TryParse(value.Trim(), out var area) || area <= 0 || area > 999999.99m)
        {
            throw new InvalidOperationException($"{fieldLabel} 0,01 ile 999999,99 m² arasında geçerli bir sayı olmalıdır.");
        }

        return area;
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }

    private static string NormalizeBuildingCode(string code)
    {
        var normalized = Regex.Replace(code.Trim(), @"[\s-]+", "_");
        return normalized.ToUpperInvariant();
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

        if (!ImportTypePolicies.TryGet(batch.ImportType, out var policy))
        {
            throw new BadRequestException($"'{batch.ImportType}' içe aktarım türü desteklenmemektedir.");
        }

        if (policy.RollbackPolicy == ImportRollbackPolicy.NotSupported)
        {
            throw new BadRequestException($"'{batch.ImportType}' içe aktarım türü için geri alma işlemi desteklenmemektedir.");
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
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                _context.ChangeTracker.Clear();
                throw new ConflictException("Bu içe aktarım partisi başka bir işlem tarafından güncellenmiştir. Lütfen durumu yenileyin.");
            }

            var u = await _context.Users.FindAsync(batch.CreatedByUserId);
            return new ImportRollbackResponseDto
            {
                Batch = ToBatchDto(batch, u != null ? $"{u.FirstName} {u.LastName}".Trim() : string.Empty),
                IsSuccess = true,
                Message = "Parti geri alındı (Aktarılan kayıt bulunmuyordu).",
                RolledBackRecordCount = 0
            };
        }

        await CheckRollbackDependenciesAsync(batch.ImportType, createdEntityIds);

        int rolledBackCount = 0;
        var strategy = _context.Database.CreateExecutionStrategy();
        try
        {
            await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

                await ValidateBatchTargetForReadAsync(policy, batch, currentUserId, isAdmin);

                rolledBackCount = await ExecuteRollbackAsync(batch.ImportType, createdEntityIds);

                batch.Status = "ROLLED_BACK";
                batch.RolledBackAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await tx.CommitAsync();
            });
        }
        catch (DbUpdateConcurrencyException)
        {
            _context.ChangeTracker.Clear();
            throw new ConflictException("Bu içe aktarım partisi başka bir işlem tarafından güncellenmiştir. Lütfen durumu yenileyin.");
        }
        catch (Exception ex) when (ex is BadRequestException or ForbiddenException or NotFoundException or ConflictException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Import batch {BatchId} rollback failed.", batchId);
            throw new BadRequestException("Geri alma işlemi sırasında bir hata oluştu. Hiçbir değişiklik yapılmadı.");
        }

        _context.ChangeTracker.Clear();
        batch = await _context.ImportBatches
            .Include(b => b.TargetProperty)
            .Include(b => b.TargetBuilding)
            .FirstAsync(b => b.Id == batchId);

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
                    var hasManagers = await _context.ManagerAssignments.AsNoTracking().AnyAsync(ma => createdEntityIds.Contains(ma.PropertyId));
                    var hasFacilities = await _context.CommonFacilities.AsNoTracking().AnyAsync(cf => createdEntityIds.Contains(cf.PropertyId));
                    var hasRequests = await _context.MaintenanceRequests.AsNoTracking().AnyAsync(mr => createdEntityIds.Contains(mr.PropertyId));
                    var hasAnnouncements = await _context.Announcements.AsNoTracking().AnyAsync(a => createdEntityIds.Contains(a.PropertyId));
                    var hasVisitors = await _context.Visitors.AsNoTracking().AnyAsync(v => createdEntityIds.Contains(v.Unit.Building.PropertyId));
                    var hasVehicles = await _context.ResidentVehicles.AsNoTracking().AnyAsync(rv => createdEntityIds.Contains(rv.Unit.Building.PropertyId));

                    if (hasBuildings || hasExpenses || hasDues || hasManagers || hasFacilities || hasRequests || hasAnnouncements || hasVisitors || hasVehicles)
                    {
                        throw new BadRequestException("İçe aktarılan taşınmazlara bağlı bina, gider, aidat, yönetici, ortak alan, talep, duyuru, ziyaretçi veya araç kayıtları bulunduğundan geri alma engellendi (ROLLBACK_BLOCKED).");
                    }
                    break;
                }

            case "BUILDINGS":
                {
                    var hasUnits = await _context.Units.AsNoTracking().AnyAsync(u => createdEntityIds.Contains(u.BuildingId));
                    var hasExpenses = await _context.Expenses.AsNoTracking().AnyAsync(e => e.BuildingId.HasValue && createdEntityIds.Contains(e.BuildingId.Value));
                    var hasManagers = await _context.ManagerAssignments.AsNoTracking().AnyAsync(ma => ma.BuildingId.HasValue && createdEntityIds.Contains(ma.BuildingId.Value));
                    var hasFacilities = await _context.CommonFacilities.AsNoTracking().AnyAsync(cf => cf.BuildingId.HasValue && createdEntityIds.Contains(cf.BuildingId.Value));
                    var hasRequests = await _context.MaintenanceRequests.AsNoTracking().AnyAsync(mr => createdEntityIds.Contains(mr.BuildingId));
                    var hasVisitors = await _context.Visitors.AsNoTracking().AnyAsync(v => createdEntityIds.Contains(v.Unit.BuildingId));
                    var hasVehicles = await _context.ResidentVehicles.AsNoTracking().AnyAsync(rv => createdEntityIds.Contains(rv.Unit.BuildingId));

                    if (hasUnits || hasExpenses || hasManagers || hasFacilities || hasRequests || hasVisitors || hasVehicles)
                    {
                        throw new BadRequestException("İçe aktarılan bloklara bağlı daire, gider, yönetici ataması, ortak alan, talep, ziyaretçi veya araç kayıtları bulunduğundan geri alma engellendi (ROLLBACK_BLOCKED).");
                    }
                    break;
                }

            case "UNITS":
                {
                    var hasOccupancies = await _context.UnitOccupancies.AsNoTracking().AnyAsync(uo => createdEntityIds.Contains(uo.UnitId));
                    var hasCharges = await _context.UnitCharges.AsNoTracking().AnyAsync(uc => createdEntityIds.Contains(uc.UnitId));
                    var hasRequests = await _context.MaintenanceRequests.AsNoTracking().AnyAsync(mr => createdEntityIds.Contains(mr.UnitId));
                    var hasVisitors = await _context.Visitors.AsNoTracking().AnyAsync(v => createdEntityIds.Contains(v.UnitId));
                    var hasVehicles = await _context.ResidentVehicles.AsNoTracking().AnyAsync(rv => createdEntityIds.Contains(rv.UnitId));
                    var hasReservations = await _context.FacilityReservations.AsNoTracking().AnyAsync(fr => createdEntityIds.Contains(fr.UnitId));

                    if (hasOccupancies || hasCharges || hasRequests || hasVisitors || hasVehicles || hasReservations)
                    {
                        throw new BadRequestException("İçe aktarılan dairelere bağlı ikamet, borç, talep, ziyaretçi, araç veya rezervasyon kayıtları bulunduğundan geri alma engellendi (ROLLBACK_BLOCKED).");
                    }
                    break;
                }

            case "USERS":
                {
                    var hasOccupancies = await _context.UnitOccupancies.AsNoTracking().AnyAsync(uo => createdEntityIds.Contains(uo.UserId));
                    var hasSubmissions = await _context.PaymentSubmissions.AsNoTracking().AnyAsync(ps => createdEntityIds.Contains(ps.SubmittedByUserId) || (ps.ReviewedByUserId.HasValue && createdEntityIds.Contains(ps.ReviewedByUserId.Value)));
                    var hasPayments = await _context.Payments.AsNoTracking().AnyAsync(p => (p.PayerUserId.HasValue && createdEntityIds.Contains(p.PayerUserId.Value)) || createdEntityIds.Contains(p.CreatedByUserId) || (p.CancelledByUserId.HasValue && createdEntityIds.Contains(p.CancelledByUserId.Value)));
                    var hasNotifications = await _context.Notifications.AsNoTracking().AnyAsync(n => createdEntityIds.Contains(n.UserId));
                    var hasManagers = await _context.ManagerAssignments.AsNoTracking().AnyAsync(ma => createdEntityIds.Contains(ma.ManagerUserId));
                    var hasRequests = await _context.MaintenanceRequests.AsNoTracking().AnyAsync(mr => createdEntityIds.Contains(mr.CreatedByUserId) || (mr.AssignedToUserId.HasValue && createdEntityIds.Contains(mr.AssignedToUserId.Value)));
                    var hasRequestHistories = await _context.MaintenanceRequestHistories.AsNoTracking().AnyAsync(mrh => createdEntityIds.Contains(mrh.ChangedByUserId));
                    var hasReservations = await _context.FacilityReservations.AsNoTracking().AnyAsync(fr => createdEntityIds.Contains(fr.ResidentUserId) || (fr.ReviewedByUserId.HasValue && createdEntityIds.Contains(fr.ReviewedByUserId.Value)));
                    var hasVisitors = await _context.Visitors.AsNoTracking().AnyAsync(v => createdEntityIds.Contains(v.HostUserId) || (v.CheckedInByUserId.HasValue && createdEntityIds.Contains(v.CheckedInByUserId.Value)));
                    var hasVehicles = await _context.ResidentVehicles.AsNoTracking().AnyAsync(rv => createdEntityIds.Contains(rv.ResidentUserId));
                    var hasAnnouncements = await _context.Announcements.AsNoTracking().AnyAsync(a => createdEntityIds.Contains(a.CreatedByUserId));
                    var hasExtraRoles = await _context.UserRoles.AsNoTracking().AnyAsync(ur => createdEntityIds.Contains(ur.UserId) && ur.Role.Code != "RESIDENT");

                    if (hasOccupancies || hasSubmissions || hasPayments || hasNotifications || hasManagers || hasRequests || hasRequestHistories || hasReservations || hasVisitors || hasVehicles || hasAnnouncements || hasExtraRoles)
                    {
                        throw new BadRequestException("İçe aktarılan kullanıcılara bağlı ikamet, finansal işlem, talep, ortak alan rezervasyonu, ziyaretçi, araç veya rol kayıtları bulunduğundan geri alma engellendi (ROLLBACK_BLOCKED).");
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
                    var utcNow = DateTime.UtcNow;
                    var items = await _context.UnitOccupancies.Where(uo => createdEntityIds.Contains(uo.Id)).ToListAsync();
                    foreach (var item in items)
                    {
                        if (item.IsActive || !item.EndDate.HasValue || item.EndDate.Value > utcNow)
                        {
                            item.IsActive = false;
                            item.EndDate = item.StartDate > utcNow ? item.StartDate : utcNow;
                            item.UpdatedAt = utcNow;
                            count++;
                        }
                    }
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
                .Select(kvp => $"{SanitizeCsvCell(kvp.Key)}:{SanitizeCsvCell(kvp.Value)}");
            var mappedStr = string.Join("; ", safeData);

            foreach (var err in errors)
            {
                sb.AppendLine($"\"{log.RowNumber}\",\"{log.ActionPreview}\",\"{SanitizeCsvCell(err.Code)}\",\"{SanitizeCsvCell(err.Message)}\",\"{SanitizeCsvCell(mappedStr)}\"");
            }

            if (errors.Count == 0)
            {
                sb.AppendLine($"\"{log.RowNumber}\",\"{log.ActionPreview}\",\"ERROR\",\"Hata detayı bulunamadı.\",\"{SanitizeCsvCell(mappedStr)}\"");
            }
        }

        var fileBytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"import_errors_batch_{batchId}.csv";
        return (fileBytes, "text/csv; charset=utf-8", fileName);
    }

    private static string SanitizeCsvCell(string? val)
    {
        if (string.IsNullOrEmpty(val)) return string.Empty;

        var trimmed = val.TrimStart();
        if (trimmed.StartsWith("=") || trimmed.StartsWith("+") || trimmed.StartsWith("-") || trimmed.StartsWith("@"))
        {
            val = "'" + val;
        }

        return val.Replace("\"", "\"\"");
    }

    public const int MinFileRetentionDays = 1;
    public const int MaxFileRetentionDays = 365;
    public const int MinPiiRetentionDays = 7;
    public const int MaxPiiRetentionDays = 365;

    public async Task<ImportRetentionResultDto> CleanupRetentionDataAsync(
        int fileRetentionDays = 7,
        int piiRetentionDays = 30,
        int currentUserId = 0,
        bool isAdmin = true)
    {
        if (!isAdmin)
        {
            throw new ForbiddenException("Veri saklama temizleme işlemi yalnızca sistem yöneticileri tarafından yürütülebilir.");
        }

        if (fileRetentionDays < MinFileRetentionDays) fileRetentionDays = MinFileRetentionDays;
        if (fileRetentionDays > MaxFileRetentionDays) fileRetentionDays = MaxFileRetentionDays;

        if (piiRetentionDays < MinPiiRetentionDays) piiRetentionDays = MinPiiRetentionDays;
        if (piiRetentionDays > MaxPiiRetentionDays) piiRetentionDays = MaxPiiRetentionDays;

        var fileCutoff = DateTime.UtcNow.AddDays(-fileRetentionDays);
        var piiCutoff = DateTime.UtcNow.AddDays(-piiRetentionDays);

        var terminalStatuses = new[] { "COMPLETED", "FAILED", "ROLLED_BACK" };

        var fileEligibleBatches = await _context.ImportBatches
            .Where(b => terminalStatuses.Contains(b.Status) &&
                        b.CreatedAt <= fileCutoff &&
                        b.StorageKey != null &&
                        b.StorageKey != string.Empty &&
                        b.StorageKey != "[CLEANED_UP]")
            .ToListAsync();

        int filesDeleted = 0;
        foreach (var batch in fileEligibleBatches)
        {
            if (!string.IsNullOrWhiteSpace(batch.StorageKey))
            {
                _storageService.DeleteImportFile(batch.StorageKey);
                batch.StorageKey = "[CLEANED_UP]";
                filesDeleted++;
            }
        }

        if (fileEligibleBatches.Count > 0)
        {
            await _context.SaveChangesAsync();
        }

        var piiEligibleBatchIds = await _context.ImportBatches
            .AsNoTracking()
            .Where(b => terminalStatuses.Contains(b.Status) && b.CreatedAt <= piiCutoff)
            .Select(b => b.Id)
            .ToListAsync();

        int rowLogsRedacted = 0;
        if (piiEligibleBatchIds.Count > 0)
        {
            var logsToRedact = await _context.ImportRowLogs
                .Where(rl => piiEligibleBatchIds.Contains(rl.ImportBatchId) &&
                             rl.RawDataJson != null &&
                             rl.RawDataJson != "[REDACTED]")
                .ToListAsync();

            foreach (var log in logsToRedact)
            {
                log.RawDataJson = "[REDACTED]";
                rowLogsRedacted++;
            }

            if (logsToRedact.Count > 0)
            {
                await _context.SaveChangesAsync();
            }
        }

        return new ImportRetentionResultDto
        {
            EligibleBatchesEvaluated = fileEligibleBatches.Count + piiEligibleBatchIds.Count,
            FilesDeleted = filesDeleted,
            RowLogsRedacted = rowLogsRedacted,
            ProcessedAt = DateTime.UtcNow
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

        IQueryable<ImportBatch> query = _context.ImportBatches
            .AsNoTracking()
            .Include(b => b.TargetProperty)
            .Include(b => b.TargetBuilding);

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

    private async Task<ValidatedImportTarget> ValidateImportTargetAsync(
        ImportTypePolicy policy,
        int? targetPropertyId,
        int? targetBuildingId,
        int currentUserId,
        bool isAdmin)
    {
        if (!policy.IsEndToEndSupported)
        {
            throw new BadRequestException($"'{policy.ImportType}' içe aktarım türü henüz desteklenmemektedir.");
        }

        if (isAdmin)
        {
            if (!policy.IsAdminAllowed)
            {
                throw new ForbiddenException("Bu içe aktarım türü için yetkiniz bulunmamaktadır.");
            }
        }
        else if (!policy.IsManagerCandidate)
        {
            throw new ForbiddenException("Bu içe aktarım türü yalnızca sistem yöneticileri tarafından kullanılabilir.");
        }

        if (policy.TargetRequirement == ImportTargetRequirement.None)
        {
            // Global imports deliberately ignore supplied scope values instead of persisting misleading targets.
            return new ValidatedImportTarget(null, null);
        }

        if (!targetPropertyId.HasValue)
        {
            throw new BadRequestException("Bu içe aktarım türü için hedef yapı seçilmelidir.");
        }

        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == targetPropertyId.Value);

        if (property is null)
        {
            throw new NotFoundException($"ID'si {targetPropertyId.Value} olan hedef yapı bulunamadı.");
        }

        if (!property.IsActive)
        {
            throw new BadRequestException("Pasif bir yapı içe aktarım hedefi olarak kullanılamaz.");
        }

        if (policy.TargetRequirement == ImportTargetRequirement.Property)
        {
            if (targetBuildingId.HasValue)
            {
                throw new BadRequestException("Bu içe aktarım türünde hedef blok seçilmemelidir.");
            }

            if (!isAdmin && !await _managerScopeService.CanManagePropertyAsync(currentUserId, property.Id, false))
            {
                throw new ForbiddenException("Seçilen yapı üzerinde yeni blok oluşturma yetkiniz bulunmamaktadır.");
            }

            return new ValidatedImportTarget(property, null);
        }

        if (!targetBuildingId.HasValue)
        {
            throw new BadRequestException("Bu içe aktarım türü için hedef blok seçilmelidir.");
        }

        var building = await _context.Buildings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == targetBuildingId.Value);

        if (building is null)
        {
            throw new NotFoundException($"ID'si {targetBuildingId.Value} olan hedef blok bulunamadı.");
        }

        if (building.PropertyId != property.Id)
        {
            throw new BadRequestException("Seçilen hedef blok, seçilen hedef yapıya ait değildir.");
        }

        if (!building.IsActive)
        {
            throw new BadRequestException("Pasif bir blok içe aktarım hedefi olarak kullanılamaz.");
        }

        if (!isAdmin && !await _managerScopeService.CanAccessBuildingAsync(currentUserId, building.Id, false))
        {
            throw new ForbiddenException("Seçilen bloğa erişim yetkiniz bulunmamaktadır.");
        }

        return new ValidatedImportTarget(property, building);
    }

    private async Task ValidateBatchTargetForReadAsync(
        ImportTypePolicy policy,
        ImportBatch batch,
        int currentUserId,
        bool isAdmin)
    {
        var isHistoricalUnscopedBatch =
            policy.TargetRequirement != ImportTargetRequirement.None &&
            !batch.TargetPropertyId.HasValue;

        if (isHistoricalUnscopedBatch && isAdmin)
        {
            return;
        }

        await ValidateImportTargetAsync(
            policy,
            batch.TargetPropertyId,
            batch.TargetBuildingId,
            currentUserId,
            isAdmin);
    }

    private static bool MatchesOptionalTargetValue(string? suppliedValue, string expectedValue)
    {
        return string.IsNullOrWhiteSpace(suppliedValue) ||
               suppliedValue.Trim().Equals(expectedValue.Trim(), StringComparison.OrdinalIgnoreCase);
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
            TargetPropertyId = b.TargetPropertyId,
            TargetPropertyName = b.TargetProperty?.Name,
            TargetBuildingId = b.TargetBuildingId,
            TargetBuildingName = b.TargetBuilding?.Name,
            TargetBuildingCode = b.TargetBuilding?.Code,
            CreatedAt = b.CreatedAt,
            ValidatedAt = b.ValidatedAt,
            CompletedAt = b.CompletedAt,
            RolledBackAt = b.RolledBackAt,
            ErrorMessage = b.ErrorMessage
        };
    }
}
