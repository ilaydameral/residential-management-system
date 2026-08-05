namespace ResidentialManagement.Api.Services;

public interface IManagerScopeService
{
    Task<List<int>> GetAccessiblePropertyIdsAsync(int userId, bool isAdmin);
    Task<List<int>> GetAccessibleBuildingIdsAsync(int userId, bool isAdmin);
    Task<bool> CanViewPropertyAsync(int userId, int propertyId, bool isAdmin);
    Task<bool> CanManagePropertyAsync(int userId, int propertyId, bool isAdmin);
    Task<bool> CanAccessBuildingAsync(int userId, int buildingId, bool isAdmin);
    Task<bool> CanAccessUnitAsync(int userId, int unitId, bool isAdmin);
}
