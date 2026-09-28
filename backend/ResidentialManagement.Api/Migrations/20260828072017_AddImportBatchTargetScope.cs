using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResidentialManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddImportBatchTargetScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "ImportBatches",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<int>(
                name: "TargetBuildingId",
                table: "ImportBatches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TargetPropertyId",
                table: "ImportBatches",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_TargetBuildingId",
                table: "ImportBatches",
                column: "TargetBuildingId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_TargetPropertyId",
                table: "ImportBatches",
                column: "TargetPropertyId");

            migrationBuilder.AddForeignKey(
                name: "FK_ImportBatches_Buildings_TargetBuildingId",
                table: "ImportBatches",
                column: "TargetBuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ImportBatches_Properties_TargetPropertyId",
                table: "ImportBatches",
                column: "TargetPropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ImportBatches_Buildings_TargetBuildingId",
                table: "ImportBatches");

            migrationBuilder.DropForeignKey(
                name: "FK_ImportBatches_Properties_TargetPropertyId",
                table: "ImportBatches");

            migrationBuilder.DropIndex(
                name: "IX_ImportBatches_TargetBuildingId",
                table: "ImportBatches");

            migrationBuilder.DropIndex(
                name: "IX_ImportBatches_TargetPropertyId",
                table: "ImportBatches");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "ImportBatches");

            migrationBuilder.DropColumn(
                name: "TargetBuildingId",
                table: "ImportBatches");

            migrationBuilder.DropColumn(
                name: "TargetPropertyId",
                table: "ImportBatches");
        }
    }
}
