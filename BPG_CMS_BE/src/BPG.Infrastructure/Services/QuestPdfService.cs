using BPG.Application.DTOs;
using BPG.Application.IServices;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace BPG.Infrastructure.Services;

public class QuestPdfService : IPdfService
{
    public QuestPdfService()
    {
        // Require license configuration since version 2022.12.x
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] GeneratePhaseAcceptancePdf(PhaseAcceptancePdfModel model)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily(Fonts.Arial));

                page.Header().Element(x => ComposeHeader(x, model));
                page.Content().Element(x => ComposeContent(x, model));
                page.Footer().Element(ComposeFooter);
            });
        });

        return document.GeneratePdf();
    }

    private void ComposeHeader(IContainer container, PhaseAcceptancePdfModel model)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Item().Text("BIÊN BẢN NGHIỆM THU GIAI ĐOẠN (PHASE)")
                    .FontSize(18).SemiBold().FontColor(Colors.Blue.Darken2);
                
                column.Item().Text(text =>
                {
                    text.Span("Dự án: ").SemiBold();
                    text.Span(model.ProjectName);
                });
                
                column.Item().Text(text =>
                {
                    text.Span("Giai đoạn: ").SemiBold();
                    text.Span(model.PhaseName);
                });
            });
        });
    }

    private void ComposeContent(IContainer container, PhaseAcceptancePdfModel model)
    {
        container.PaddingVertical(1, Unit.Centimetre).Column(column =>
        {
            column.Spacing(10);

            column.Item().Row(row =>
            {
                row.RelativeItem().Text($"Người nghiệm thu: {model.AcceptedByFullName}");
                row.RelativeItem().Text($"Ngày nghiệm thu: {model.AcceptanceDate:dd/MM/yyyy HH:mm}");
            });

            column.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

            column.Item().Text("Nội dung đánh giá:").SemiBold();
            column.Item().Text(model.ReportContent);

            column.Item().PaddingTop(15).Text("Danh sách Công việc (Tasks) đã hoàn thành:").SemiBold();
            
            column.Item().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(30);  // STT
                    columns.RelativeColumn(3);   // Tên Task
                    columns.RelativeColumn(2);   // Người thực hiện
                    columns.RelativeColumn(1);   // Tiến độ
                });

                table.Header(header =>
                {
                    header.Cell().BorderBottom(1).Padding(2).Text("#").SemiBold();
                    header.Cell().BorderBottom(1).Padding(2).Text("Tên công việc").SemiBold();
                    header.Cell().BorderBottom(1).Padding(2).Text("Người thực hiện").SemiBold();
                    header.Cell().BorderBottom(1).Padding(2).Text("Tiến độ").SemiBold();
                });

                int index = 1;
                foreach (var task in model.Tasks)
                {
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten4).Padding(2).Text(index++.ToString());
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten4).Padding(2).Text(task.TaskName);
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten4).Padding(2).Text(task.AssigneeName);
                    table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten4).Padding(2).Text($"{task.ProgressPercent}%").FontColor(Colors.Green.Darken2).SemiBold();
                }
            });
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.AlignCenter().Text(x =>
        {
            x.Span("Trang ");
            x.CurrentPageNumber();
            x.Span(" / ");
            x.TotalPages();
        });
    }
}
