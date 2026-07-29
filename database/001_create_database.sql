USE master;
GO

IF DB_ID(N'ApartmentManagementDb') IS NULL
BEGIN
    CREATE DATABASE ApartmentManagementDb;
END;
GO
