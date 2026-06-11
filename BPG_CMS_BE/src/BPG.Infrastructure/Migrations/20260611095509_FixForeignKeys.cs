using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BPG.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DirectPurchaseItems_DirectPurchaseRequests_DirectPurchaseRequestDirectPurchaseId",
                table: "DirectPurchaseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_GoodsReceipts_PurchaseOrders_PurchaseOrderPOId",
                table: "GoodsReceipts");

            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderPOId",
                table: "PurchaseOrderItems");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseOrderItems_PurchaseOrderPOId",
                table: "PurchaseOrderItems");

            migrationBuilder.DropIndex(
                name: "IX_GoodsReceipts_PurchaseOrderPOId",
                table: "GoodsReceipts");

            migrationBuilder.DropIndex(
                name: "IX_DirectPurchaseItems_DirectPurchaseRequestDirectPurchaseId",
                table: "DirectPurchaseItems");

            migrationBuilder.DropColumn(
                name: "PurchaseOrderPOId",
                table: "PurchaseOrderItems");

            migrationBuilder.DropColumn(
                name: "PurchaseOrderPOId",
                table: "GoodsReceipts");

            migrationBuilder.DropColumn(
                name: "DirectPurchaseRequestDirectPurchaseId",
                table: "DirectPurchaseItems");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderItems_POId",
                table: "PurchaseOrderItems",
                column: "POId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReceipts_POId",
                table: "GoodsReceipts",
                column: "POId");

            migrationBuilder.AddForeignKey(
                name: "FK_DirectPurchaseItems_DirectPurchaseRequests_DirectPurchaseId",
                table: "DirectPurchaseItems",
                column: "DirectPurchaseId",
                principalTable: "DirectPurchaseRequests",
                principalColumn: "DirectPurchaseId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GoodsReceipts_PurchaseOrders_POId",
                table: "GoodsReceipts",
                column: "POId",
                principalTable: "PurchaseOrders",
                principalColumn: "POId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrderItems_PurchaseOrders_POId",
                table: "PurchaseOrderItems",
                column: "POId",
                principalTable: "PurchaseOrders",
                principalColumn: "POId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DirectPurchaseItems_DirectPurchaseRequests_DirectPurchaseId",
                table: "DirectPurchaseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_GoodsReceipts_PurchaseOrders_POId",
                table: "GoodsReceipts");

            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrderItems_PurchaseOrders_POId",
                table: "PurchaseOrderItems");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseOrderItems_POId",
                table: "PurchaseOrderItems");

            migrationBuilder.DropIndex(
                name: "IX_GoodsReceipts_POId",
                table: "GoodsReceipts");

            migrationBuilder.AddColumn<long>(
                name: "PurchaseOrderPOId",
                table: "PurchaseOrderItems",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "PurchaseOrderPOId",
                table: "GoodsReceipts",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "DirectPurchaseRequestDirectPurchaseId",
                table: "DirectPurchaseItems",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderItems_PurchaseOrderPOId",
                table: "PurchaseOrderItems",
                column: "PurchaseOrderPOId");

            migrationBuilder.CreateIndex(
                name: "IX_GoodsReceipts_PurchaseOrderPOId",
                table: "GoodsReceipts",
                column: "PurchaseOrderPOId");

            migrationBuilder.CreateIndex(
                name: "IX_DirectPurchaseItems_DirectPurchaseRequestDirectPurchaseId",
                table: "DirectPurchaseItems",
                column: "DirectPurchaseRequestDirectPurchaseId");

            migrationBuilder.AddForeignKey(
                name: "FK_DirectPurchaseItems_DirectPurchaseRequests_DirectPurchaseRequestDirectPurchaseId",
                table: "DirectPurchaseItems",
                column: "DirectPurchaseRequestDirectPurchaseId",
                principalTable: "DirectPurchaseRequests",
                principalColumn: "DirectPurchaseId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GoodsReceipts_PurchaseOrders_PurchaseOrderPOId",
                table: "GoodsReceipts",
                column: "PurchaseOrderPOId",
                principalTable: "PurchaseOrders",
                principalColumn: "POId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderPOId",
                table: "PurchaseOrderItems",
                column: "PurchaseOrderPOId",
                principalTable: "PurchaseOrders",
                principalColumn: "POId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
