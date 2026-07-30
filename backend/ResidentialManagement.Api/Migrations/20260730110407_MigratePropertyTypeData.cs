using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class MigratePropertyTypeData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE p
                SET p.PropertyTypeId = pt.Id
                FROM dbo.Properties p
                INNER JOIN dbo.PropertyTypes pt
                    ON (p.PropertyType = N'Residential Complex' AND pt.Code = N'RESIDENTIAL_COMPLEX')
                    OR (p.PropertyType = N'Apartment Building' AND pt.Code = N'SINGLE_APARTMENT')
                WHERE p.PropertyTypeId IS NULL;

                IF EXISTS (SELECT 1 FROM dbo.Properties WHERE PropertyTypeId IS NULL)
                BEGIN
                    THROW 51001, N'Property type migration failed: unmatched PropertyType values exist.', 1;
                END;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE p
                SET p.PropertyTypeId = NULL
                FROM dbo.Properties p
                INNER JOIN dbo.PropertyTypes pt ON p.PropertyTypeId = pt.Id
                WHERE (p.PropertyType = N'Residential Complex' AND pt.Code = N'RESIDENTIAL_COMPLEX')
                   OR (p.PropertyType = N'Apartment Building' AND pt.Code = N'SINGLE_APARTMENT');
            ");
        }
    }
}
