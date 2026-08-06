using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDuePeriodUnitAmount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "UnitAmount",
                table: "DuePeriods",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddCheckConstraint(
                name: "CK_DuePeriods_UnitAmount_Positive",
                table: "DuePeriods",
                sql: "[UnitAmount] > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_DuePeriods_UnitAmount_Positive",
                table: "DuePeriods");

            migrationBuilder.DropColumn(
                name: "UnitAmount",
                table: "DuePeriods");
        }
    }
}
