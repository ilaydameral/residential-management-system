USE ApartmentManagementDb;
GO

SELECT *
FROM dbo.Properties;

USE ApartmentManagementDb;
GO

SELECT
    MAX(LEN(Name)) AS MaxNameLength,
    MAX(LEN(PropertyType)) AS MaxPropertyTypeLength,
    MAX(LEN(AddressLine)) AS MaxAddressLineLength,
    MAX(LEN(City)) AS MaxCityLength,
    MAX(LEN(District)) AS MaxDistrictLength,
    MAX(LEN(Description)) AS MaxDescriptionLength
FROM dbo.Properties;
