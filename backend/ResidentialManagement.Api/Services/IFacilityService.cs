using System;
using ResidentialManagement.Api.DTOs;

namespace ResidentialManagement.Api.Services;

public interface IFacilityService
{
    // Management - Facilities
    Task<List<CommonFacilityDto>> GetAllFacilitiesAsync(int userId, bool isAdmin, int? propertyId = null, int? buildingId = null, bool? isActive = null);
    Task<CommonFacilityDto?> GetFacilityByIdAsync(int id, int userId, bool isAdmin);
    Task<CommonFacilityDto> CreateFacilityAsync(CreateCommonFacilityDto dto, int currentUserId, bool isAdmin);
    Task<CommonFacilityDto> UpdateFacilityAsync(int id, UpdateCommonFacilityDto dto, int currentUserId, bool isAdmin);
    Task<CommonFacilityDto> SetFacilityActiveStatusAsync(int id, bool isActive, int currentUserId, bool isAdmin);

    // Management - Maintenance Blocks
    Task<List<FacilityMaintenanceBlockDto>> GetMaintenanceBlocksAsync(int facilityId, int userId, bool isAdmin);
    Task<FacilityMaintenanceBlockDto> CreateMaintenanceBlockAsync(int facilityId, CreateMaintenanceBlockDto dto, int currentUserId, bool isAdmin);
    Task DeleteMaintenanceBlockAsync(int blockId, int currentUserId, bool isAdmin);

    // Resident - Availability & Booking
    Task<FacilityAvailabilityDto> GetFacilityAvailabilityAsync(int facilityId, DateTime date, int residentUserId);
    Task<FacilityReservationDto> CreateReservationAsync(CreateReservationDto dto, int residentUserId);
    Task<FacilityReservationDto> CancelReservationAsync(long reservationId, int residentUserId);
    Task<List<FacilityReservationDto>> GetMyReservationsAsync(int residentUserId);

    // Management - Reservations
    Task<List<FacilityReservationDto>> GetManagementReservationsAsync(int userId, bool isAdmin, int? facilityId = null, int? propertyId = null, int? buildingId = null, string? status = null, DateTime? dateFrom = null, DateTime? dateTo = null);
    Task<FacilityReservationDto> ApproveReservationAsync(long reservationId, int reviewerUserId, bool isAdmin);
    Task<FacilityReservationDto> RejectReservationAsync(long reservationId, ReviewReservationDto dto, int reviewerUserId, bool isAdmin);
}
