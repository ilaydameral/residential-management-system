using System.Data;
using Microsoft.EntityFrameworkCore;
using ResidentialManagement.Api.Data;
using ResidentialManagement.Api.DTOs;
using ResidentialManagement.Api.Entities;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class PaymentSubmissionService : IPaymentSubmissionService
{
    private readonly AppDbContext _context;
    private readonly IManagerScopeService _managerScopeService;
    private readonly IReceiptStorageService _receiptStorageService;
    private readonly INotificationService _notificationService;
    private readonly IRealtimePublisher _realtimePublisher;

    public PaymentSubmissionService(
        AppDbContext context,
        IManagerScopeService managerScopeService,
        IReceiptStorageService receiptStorageService,
        INotificationService notificationService,
        IRealtimePublisher realtimePublisher)
    {
        _context = context;
        _managerScopeService = managerScopeService;
        _receiptStorageService = receiptStorageService;
        _notificationService = notificationService;
        _realtimePublisher = realtimePublisher;
    }

    public async Task<List<ResidentUnitChargeDto>> GetMyUnitChargesAsync(int residentUserId)
    {
        var activeUnitIds = await GetResidentActiveUnitIdsAsync(residentUserId);
        if (activeUnitIds.Count == 0)
        {
            return new List<ResidentUnitChargeDto>();
        }

        var charges = await _context.UnitCharges
            .Include(uc => uc.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(uc => uc.Payments)
            .AsNoTracking()
            .Where(uc => activeUnitIds.Contains(uc.UnitId))
            .OrderByDescending(uc => uc.DueDate)
            .ThenByDescending(uc => uc.Id)
            .ToListAsync();

        return charges.Select(ToResidentUnitChargeDto).ToList();
    }

    public async Task<ResidentUnitChargeDto?> GetMyUnitChargeByIdAsync(int id, int residentUserId)
    {
        var activeUnitIds = await GetResidentActiveUnitIdsAsync(residentUserId);
        var charge = await _context.UnitCharges
            .Include(uc => uc.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(uc => uc.Payments)
            .AsNoTracking()
            .FirstOrDefaultAsync(uc => uc.Id == id);

        if (charge is null || !activeUnitIds.Contains(charge.UnitId))
        {
            return null;
        }

        return ToResidentUnitChargeDto(charge);
    }

    public async Task<PaymentSubmissionDto> CreateSubmissionAsync(CreatePaymentSubmissionRequestDto requestDto, int residentUserId)
    {
        var activeUnitIds = await GetResidentActiveUnitIdsAsync(residentUserId);
        var charge = await _context.UnitCharges
            .Include(uc => uc.Unit)
                .ThenInclude(u => u.Building)
                    .ThenInclude(b => b.Property)
            .Include(uc => uc.Payments)
            .Include(uc => uc.PaymentSubmissions)
            .FirstOrDefaultAsync(uc => uc.Id == requestDto.UnitChargeId);

        if (charge is null)
        {
            throw new KeyNotFoundException($"ID'si {requestDto.UnitChargeId} olan borç kaydı bulunamadı.");
        }

        if (!activeUnitIds.Contains(charge.UnitId))
        {
            throw new ForbiddenException("Bu daireye ait borçlandırma için ödeme bildirimi yapma yetkiniz bulunmamaktadır.");
        }

        if (charge.IsCancelled)
        {
            throw new InvalidOperationException("İptal edilmiş bir borçlandırma için ödeme bildirimi oluşturulamaz.");
        }

        var (paidAmount, remainingAmount, _) = CalculateChargeStatus(charge);
        if (remainingAmount <= 0)
        {
            throw new InvalidOperationException("Tamamı ödenmiş bir borç için yeni ödeme bildirimi oluşturulamaz.");
        }

        if (requestDto.PaymentDate.Date > DateTime.UtcNow.Date)
        {
            throw new BadRequestException("Ödeme tarihi bugünden ileri bir tarih olamaz.");
        }

        var method = (requestDto.PaymentMethod ?? "BANK_TRANSFER").Trim().ToUpperInvariant();
        if (method != "BANK_TRANSFER" && method != "CREDIT_CARD" && method != "CASH")
        {
            throw new BadRequestException("Ödeme yöntemi yalnızca BANK_TRANSFER, CREDIT_CARD veya CASH olabilir.");
        }

        var pendingTotal = charge.PaymentSubmissions
            .Where(ps => ps.Status == "PENDING")
            .Sum(ps => ps.Amount);

        var maxAllowedSubmission = remainingAmount - pendingTotal;
        if (requestDto.Amount > maxAllowedSubmission)
        {
            if (maxAllowedSubmission <= 0)
            {
                throw new BadRequestException("Bu borç için zaten kalan tutarı karşılayan onay bekleyen ödeme başvurularınız mevcuttur. Yeni başvuru oluşturulamaz.");
            }
            throw new BadRequestException($"Ödeme tutarı ({requestDto.Amount:N2} TL), kalan talep edilebilir bakiye tutarını ({maxAllowedSubmission:N2} TL) aşamaz.");
        }

        var storageKey = await _receiptStorageService.SaveReceiptFileAsync(requestDto.ReceiptFile);

        try
        {
            var submission = new PaymentSubmission
            {
                UnitChargeId = charge.Id,
                SubmittedByUserId = residentUserId,
                Amount = requestDto.Amount,
                PaymentDate = requestDto.PaymentDate,
                PaymentMethod = method,
                ReferenceCode = string.IsNullOrWhiteSpace(requestDto.ReferenceCode) ? null : requestDto.ReferenceCode.Trim(),
                ReceiptAttachmentUrl = storageKey,
                UserNotes = string.IsNullOrWhiteSpace(requestDto.UserNotes) ? null : requestDto.UserNotes.Trim(),
                Status = "PENDING",
                CreatedAt = DateTime.UtcNow
            };

            _context.PaymentSubmissions.Add(submission);
            await _context.SaveChangesAsync();

            await _realtimePublisher.PublishActivityFeedInvalidatedAsync("FINANCE");

            return await GetMySubmissionByIdAsync(submission.Id, residentUserId)
                ?? throw new InvalidOperationException("Ödeme başvurusu oluşturuldu ancak detayları alınamadı.");
        }
        catch
        {
            _receiptStorageService.DeleteReceiptFile(storageKey);
            throw;
        }
    }

    public async Task<List<PaymentSubmissionDto>> GetMySubmissionsAsync(int residentUserId)
    {
        return await _context.PaymentSubmissions
            .AsNoTracking()
            .Where(ps => ps.SubmittedByUserId == residentUserId)
            .OrderByDescending(ps => ps.CreatedAt)
            .Select(ToDtoExpression())
            .ToListAsync();
    }

    public async Task<PaymentSubmissionDto?> GetMySubmissionByIdAsync(int id, int residentUserId)
    {
        var submission = await _context.PaymentSubmissions
            .AsNoTracking()
            .Where(ps => ps.Id == id && ps.SubmittedByUserId == residentUserId)
            .Select(ToDtoExpression())
            .FirstOrDefaultAsync();

        return submission;
    }

    public async Task<PaymentSubmissionDto?> CancelMySubmissionAsync(int id, int residentUserId)
    {
        var submission = await _context.PaymentSubmissions
            .FirstOrDefaultAsync(ps => ps.Id == id && ps.SubmittedByUserId == residentUserId);

        if (submission is null)
        {
            return null;
        }

        if (submission.Status != "PENDING")
        {
            throw new InvalidOperationException("Yalnızca PENDING durumundaki başvurularınızı iptal edebilirsiniz.");
        }

        submission.Status = "CANCELLED";
        submission.CancelledAt = DateTime.UtcNow;
        submission.CancelledByUserId = residentUserId;
        submission.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return await GetMySubmissionByIdAsync(id, residentUserId);
    }

    public async Task<List<PaymentSubmissionDto>> GetManagementSubmissionsAsync(
        int currentUserId,
        bool isAdmin,
        string? status,
        int? propertyId,
        int? buildingId,
        int? unitId)
    {
        var accessibleBuildingIds = await _managerScopeService.GetAccessibleBuildingIdsAsync(currentUserId, isAdmin);
        var accessiblePropertyIds = await _managerScopeService.GetAccessiblePropertyIdsAsync(currentUserId, isAdmin);

        var query = _context.PaymentSubmissions.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpperInvariant();
            query = query.Where(ps => ps.Status == normalizedStatus);
        }

        if (unitId.HasValue)
        {
            query = query.Where(ps => ps.UnitCharge.UnitId == unitId.Value);
        }

        if (buildingId.HasValue)
        {
            query = query.Where(ps => ps.UnitCharge.Unit.BuildingId == buildingId.Value);
        }

        if (propertyId.HasValue)
        {
            query = query.Where(ps => ps.UnitCharge.Unit.Building.PropertyId == propertyId.Value);
        }

        if (!isAdmin)
        {
            query = query.Where(ps =>
                accessibleBuildingIds.Contains(ps.UnitCharge.Unit.BuildingId) ||
                accessiblePropertyIds.Contains(ps.UnitCharge.Unit.Building.PropertyId));
        }

        return await query
            .OrderByDescending(ps => ps.CreatedAt)
            .Select(ToDtoExpression())
            .ToListAsync();
    }

    public async Task<PaymentSubmissionDto?> GetManagementSubmissionByIdAsync(int id, int currentUserId, bool isAdmin)
    {
        var submission = await _context.PaymentSubmissions
            .Include(ps => ps.UnitCharge)
                .ThenInclude(uc => uc.Unit)
            .AsNoTracking()
            .FirstOrDefaultAsync(ps => ps.Id == id);

        if (submission is null)
        {
            return null;
        }

        var canAccess = await _managerScopeService.CanAccessUnitAsync(currentUserId, submission.UnitCharge.UnitId, isAdmin);
        if (!canAccess)
        {
            throw new ForbiddenException("Bu daireye ait ödeme başvurusunu görüntüleme yetkiniz bulunmamaktadır.");
        }

        return await _context.PaymentSubmissions
            .AsNoTracking()
            .Where(ps => ps.Id == id)
            .Select(ToDtoExpression())
            .FirstOrDefaultAsync();
    }

    public async Task<PaymentSubmissionDto> ApproveSubmissionAsync(int id, ApprovePaymentSubmissionDto dto, int reviewerUserId, bool isAdmin)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var submission = await _context.PaymentSubmissions
            .Include(ps => ps.UnitCharge)
                .ThenInclude(uc => uc.Payments)
            .FirstOrDefaultAsync(ps => ps.Id == id);

        if (submission is null)
        {
            throw new KeyNotFoundException($"ID'si {id} olan ödeme başvurusu bulunamadı.");
        }

        var canAccess = await _managerScopeService.CanAccessUnitAsync(reviewerUserId, submission.UnitCharge.UnitId, isAdmin);
        if (!canAccess)
        {
            throw new ForbiddenException("Bu daireye ait ödeme başvurusunu onaylama yetkiniz bulunmamaktadır.");
        }

        if (submission.Status != "PENDING")
        {
            throw new InvalidOperationException("Yalnızca PENDING durumundaki ödeme başvuruları onaylanabilir.");
        }

        if (submission.UnitCharge.IsCancelled)
        {
            throw new InvalidOperationException("İptal edilmiş bir borçlandırmaya ait ödeme başvurusu onaylanamaz.");
        }

        var confirmedPaid = submission.UnitCharge.Payments
            .Where(p => !p.IsCancelled)
            .Sum(p => p.Amount);

        var remainingBalance = submission.UnitCharge.Amount - confirmedPaid;
        if (submission.Amount > remainingBalance)
        {
            throw new InvalidOperationException($"Onaylanmak istenen ödeme tutarı ({submission.Amount:N2} TL), kalan borç tutarını ({remainingBalance:N2} TL) aşamaz.");
        }

        var utcNow = DateTime.UtcNow;

        var payment = new Payment
        {
            UnitChargeId = submission.UnitChargeId,
            PaymentSubmissionId = submission.Id,
            PayerUserId = submission.SubmittedByUserId,
            Amount = submission.Amount,
            PaymentDate = submission.PaymentDate,
            PaymentMethod = submission.PaymentMethod,
            TransactionReference = string.IsNullOrWhiteSpace(dto.TransactionReference) ? submission.ReferenceCode : dto.TransactionReference.Trim(),
            Notes = string.IsNullOrWhiteSpace(dto.Notes)
                ? (string.IsNullOrWhiteSpace(submission.UserNotes) ? $"Dekont başvurusu onaylandı. (Başvuru #{submission.Id})" : submission.UserNotes)
                : dto.Notes.Trim(),
            IsCancelled = false,
            CreatedAt = utcNow,
            CreatedByUserId = reviewerUserId
        };

        _context.Payments.Add(payment);

        submission.Status = "APPROVED";
        submission.ReviewedByUserId = reviewerUserId;
        submission.ReviewedAt = utcNow;
        submission.UpdatedAt = utcNow;

        var createdNotifications = await _notificationService.AddNotificationEntitiesForUsersAsync(
            new[] { submission.SubmittedByUserId },
            "Ödeme Dekontunuz Onaylandı",
            $"{submission.Amount:N2} TL tutarındaki ödeme dekontu başvurunuz onaylanmıştır.",
            "FINANCE",
            "PaymentSubmission",
            submission.Id);

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        if (createdNotifications.Count > 0)
        {
            var dtos = createdNotifications.Select(n => _notificationService.ToDto(n)).ToList();
            await _realtimePublisher.PublishNotificationsAsync(dtos);
        }

        await _realtimePublisher.PublishActivityFeedInvalidatedAsync("FINANCE");

        return await GetManagementSubmissionByIdAsync(submission.Id, reviewerUserId, isAdmin)
            ?? throw new InvalidOperationException("Başvuru onaylandı ancak detayları alınamadı.");
    }

    public async Task<PaymentSubmissionDto> RejectSubmissionAsync(int id, RejectPaymentSubmissionDto dto, int reviewerUserId, bool isAdmin)
    {
        if (string.IsNullOrWhiteSpace(dto.RejectionReason))
        {
            throw new BadRequestException("Red gerekçesi girmek zorunludur.");
        }

        var submission = await _context.PaymentSubmissions
            .Include(ps => ps.UnitCharge)
            .FirstOrDefaultAsync(ps => ps.Id == id);

        if (submission is null)
        {
            throw new KeyNotFoundException($"ID'si {id} olan ödeme başvurusu bulunamadı.");
        }

        var canAccess = await _managerScopeService.CanAccessUnitAsync(reviewerUserId, submission.UnitCharge.UnitId, isAdmin);
        if (!canAccess)
        {
            throw new ForbiddenException("Bu daireye ait ödeme başvurusunu reddetme yetkiniz bulunmamaktadır.");
        }

        if (submission.Status != "PENDING")
        {
            throw new InvalidOperationException("Yalnızca PENDING durumundaki ödeme başvuruları reddedilebilir.");
        }

        var utcNow = DateTime.UtcNow;
        submission.Status = "REJECTED";
        submission.ReviewedByUserId = reviewerUserId;
        submission.ReviewedAt = utcNow;
        submission.RejectionReason = dto.RejectionReason.Trim();
        submission.UpdatedAt = utcNow;

        var rejectedNotifications = await _notificationService.AddNotificationEntitiesForUsersAsync(
            new[] { submission.SubmittedByUserId },
            "Ödeme Dekontunuz Reddedildi",
            $"{submission.Amount:N2} TL tutarındaki ödeme dekontu başvurunuz reddedilmiştir. Gerekçe: {submission.RejectionReason}",
            "FINANCE",
            "PaymentSubmission",
            submission.Id);

        await _context.SaveChangesAsync();

        if (rejectedNotifications.Count > 0)
        {
            var dtos = rejectedNotifications.Select(n => _notificationService.ToDto(n)).ToList();
            await _realtimePublisher.PublishNotificationsAsync(dtos);
        }

        await _realtimePublisher.PublishActivityFeedInvalidatedAsync("FINANCE");

        return await GetManagementSubmissionByIdAsync(submission.Id, reviewerUserId, isAdmin)
            ?? throw new InvalidOperationException("Başvuru reddedildi ancak detayları alınamadı.");
    }

    public async Task<(Stream Stream, string ContentType, string FileName)> GetReceiptStreamAsync(int submissionId, int currentUserId, bool isAdmin)
    {
        var submission = await _context.PaymentSubmissions
            .Include(ps => ps.UnitCharge)
            .AsNoTracking()
            .FirstOrDefaultAsync(ps => ps.Id == submissionId);

        if (submission is null)
        {
            throw new KeyNotFoundException($"ID'si {submissionId} olan ödeme başvurusu bulunamadı.");
        }

        // Access check: Either the submitting resident OR manager/admin with unit access
        var isSubmittingResident = submission.SubmittedByUserId == currentUserId;
        var canAccessUnit = await _managerScopeService.CanAccessUnitAsync(currentUserId, submission.UnitCharge.UnitId, isAdmin);

        if (!isSubmittingResident && !canAccessUnit)
        {
            throw new ForbiddenException("Bu dekont dosyasına erişim yetkiniz bulunmamaktadır.");
        }

        if (string.IsNullOrWhiteSpace(submission.ReceiptAttachmentUrl))
        {
            throw new KeyNotFoundException("Bu başvuruya ait dekont dosyası bulunmamaktadır.");
        }

        return _receiptStorageService.GetReceiptFile(submission.ReceiptAttachmentUrl);
    }

    private async Task<List<int>> GetResidentActiveUnitIdsAsync(int residentUserId)
    {
        var now = DateTime.UtcNow;
        return await _context.UnitOccupancies
            .AsNoTracking()
            .Where(uo => uo.UserId == residentUserId && uo.IsActive && (uo.EndDate == null || uo.EndDate > now))
            .Select(uo => uo.UnitId)
            .Distinct()
            .ToListAsync();
    }

    private static ResidentUnitChargeDto ToResidentUnitChargeDto(UnitCharge charge)
    {
        var (paidAmount, remainingAmount, status) = CalculateChargeStatus(charge);

        return new ResidentUnitChargeDto
        {
            Id = charge.Id,
            UnitId = charge.UnitId,
            UnitNumber = charge.Unit.UnitNumber,
            BuildingName = charge.Unit.Building.Name,
            PropertyName = charge.Unit.Building.Property.Name,
            Title = charge.Title,
            Description = charge.Description,
            Amount = charge.Amount,
            PaidAmount = paidAmount,
            RemainingAmount = remainingAmount,
            Status = status,
            DueDate = charge.DueDate,
            ChargeType = charge.ChargeType,
            IsCancelled = charge.IsCancelled,
            CreatedAt = charge.CreatedAt
        };
    }

    private static (decimal PaidAmount, decimal RemainingAmount, string Status) CalculateChargeStatus(UnitCharge charge)
    {
        var paidAmount = charge.Payments
            .Where(p => !p.IsCancelled)
            .Sum(p => p.Amount);

        var remainingAmount = charge.Amount - paidAmount;
        if (remainingAmount < 0) remainingAmount = 0;

        string status;
        if (charge.IsCancelled)
        {
            status = "CANCELLED";
        }
        else if (remainingAmount <= 0)
        {
            status = "PAID";
        }
        else if (paidAmount > 0)
        {
            status = "PARTIALLY_PAID";
        }
        else if (charge.DueDate < DateTime.UtcNow)
        {
            status = "OVERDUE";
        }
        else
        {
            status = "UNPAID";
        }

        return (paidAmount, remainingAmount, status);
    }

    private static System.Linq.Expressions.Expression<Func<PaymentSubmission, PaymentSubmissionDto>> ToDtoExpression()
    {
        return ps => new PaymentSubmissionDto
        {
            Id = ps.Id,
            UnitChargeId = ps.UnitChargeId,
            UnitChargeTitle = ps.UnitCharge.Title,
            UnitId = ps.UnitCharge.UnitId,
            UnitNumber = ps.UnitCharge.Unit.UnitNumber,
            BuildingName = ps.UnitCharge.Unit.Building.Name,
            PropertyName = ps.UnitCharge.Unit.Building.Property.Name,
            SubmittedByUserId = ps.SubmittedByUserId,
            SubmittedByFullName = (ps.SubmittedByUser.FirstName + " " + ps.SubmittedByUser.LastName).Trim(),
            Amount = ps.Amount,
            PaymentDate = ps.PaymentDate,
            PaymentMethod = ps.PaymentMethod,
            ReferenceCode = ps.ReferenceCode,
            ReceiptAttachmentUrl = ps.ReceiptAttachmentUrl,
            UserNotes = ps.UserNotes,
            Status = ps.Status,
            ReviewedByUserId = ps.ReviewedByUserId,
            ReviewedByFullName = ps.ReviewedByUser == null ? null : (ps.ReviewedByUser.FirstName + " " + ps.ReviewedByUser.LastName).Trim(),
            ReviewedAt = ps.ReviewedAt,
            RejectionReason = ps.RejectionReason,
            CancelledAt = ps.CancelledAt,
            CancelledByFullName = ps.CancelledByUser == null ? null : (ps.CancelledByUser.FirstName + " " + ps.CancelledByUser.LastName).Trim(),
            CreatedAt = ps.CreatedAt
        };
    }
}
