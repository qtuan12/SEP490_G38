import ExcelJS from 'exceljs';
import type { BOQTemplateRow, ParsedBOQWorkbook } from '../types/boqImport';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 1000;

export const DEFAULT_BOQ_TEMPLATE_ROWS: BOQTemplateRow[] = [
  { materialCode: 'XM-VICEM-PCB40', materialName: 'Xi măng VICEM PCB40 đóng bao', quantity: 50, unitCode: 'BAO', unitName: 'Bao' },
  { materialCode: 'BT-TUOI-M250', materialName: 'Bê tông thương phẩm M250', quantity: 40, unitCode: 'M3', unitName: 'Mét khối' },
  { materialCode: 'THEP-HP-D16', materialName: 'Thép thanh vằn Hòa Phát D16 CB400-V', quantity: 150, unitCode: 'CAY', unitName: 'Cây' },
  { materialCode: 'THEP-HP-D6', materialName: 'Thép cuộn Hòa Phát D6 CB240-T', quantity: 280, unitCode: 'KG', unitName: 'kg' },
  { materialCode: 'DAY-THEP-BUOC-1', materialName: 'Dây thép buộc 1 mm', quantity: 30, unitCode: 'KG', unitName: 'kg' },
  { materialCode: 'DINH-THEP-5CM', materialName: 'Đinh thép 5 cm', quantity: 10, unitCode: 'KG', unitName: 'kg' },
  { materialCode: 'CAT-XAY-TO', materialName: 'Cát xây tô', quantity: 10, unitCode: 'M3', unitName: 'Mét khối' },
  { materialCode: 'DA-1X2', materialName: 'Đá 1x2', quantity: 5, unitCode: 'M3', unitName: 'Mét khối' },
  { materialCode: 'GACH-2LO-220', materialName: 'Gạch 2 lỗ 220x105x60', quantity: 4000, unitCode: 'VIEN', unitName: 'Viên' },
  { materialCode: 'VAN-PHU-PHIM-18', materialName: 'Ván ép phủ phim 18 mm', quantity: 40, unitCode: 'TAM', unitName: 'Tấm' },
  { materialCode: 'CAY-CHONG-THEP-3M', materialName: 'Cây chống thép tăng 3 m', quantity: 30, unitCode: 'CAY', unitName: 'Cây' },
  { materialCode: 'TY-REN-COPPHA-D17', materialName: 'Bộ ty ren cốp pha D17', quantity: 24, unitCode: 'BO', unitName: 'Bộ' },
  { materialCode: 'DAU-COPPHA-20L', materialName: 'Dầu chống dính cốp pha 20 lít', quantity: 2, unitCode: 'THUNG', unitName: 'Thùng' },
  { materialCode: 'SIKA-TOP-107', materialName: 'SikaTop-107 Seal VN', quantity: 8, unitCode: 'BO', unitName: 'Bộ' },
  { materialCode: 'SIKA-GROUT-214', materialName: 'SikaGrout 214-11 25 kg', quantity: 10, unitCode: 'BAO', unitName: 'Bao' },
];

const normalizeHeader = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const HEADER_ALIASES = {
  materialCode: new Set(['mavattu', 'materialcode', 'code']),
  quantity: new Set(['soluongdutoan', 'soluongdinhmuc', 'soluong', 'quantity', 'boqquantity']),
  unitCode: new Set(['madvt', 'madonvitinh', 'unitcode']),
};

const isFormulaCell = (cell: ExcelJS.Cell): boolean => {
  const value = cell.value;
  return typeof value === 'object' && value !== null && 'formula' in value;
};

const cellText = (cell: ExcelJS.Cell): string => cell.text.trim();

const parseQuantity = (cell: ExcelJS.Cell): number | null => {
  if (typeof cell.value === 'number') return cell.value;
  const raw = cellText(cell).replace(/\s/g, '');
  if (!/^-?\d+(?:[.,]\d+)?$/.test(raw)) return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseBOQExcelFile = async (file: File): Promise<ParsedBOQWorkbook> => {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { rows: [], errors: ['Chỉ hỗ trợ file Excel định dạng .xlsx.'] };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { rows: [], errors: ['File Excel không được vượt quá 5 MB.'] };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return { rows: [], errors: ['Không thể đọc file Excel. File có thể bị hỏng hoặc sai định dạng.'] };
  }

  const worksheet = workbook.getWorksheet('BOQ') ?? workbook.worksheets[0];
  if (!worksheet) return { rows: [], errors: ['File Excel không có worksheet dữ liệu.'] };

  let headerRowNumber = 0;
  let materialCodeColumn = 0;
  let quantityColumn = 0;
  let unitCodeColumn = 0;

  for (let rowNumber = 1; rowNumber <= Math.min(10, worksheet.actualRowCount); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.eachCell((cell, columnNumber) => {
      const normalized = normalizeHeader(cellText(cell));
      if (HEADER_ALIASES.materialCode.has(normalized)) materialCodeColumn = columnNumber;
      if (HEADER_ALIASES.quantity.has(normalized)) quantityColumn = columnNumber;
      if (HEADER_ALIASES.unitCode.has(normalized)) unitCodeColumn = columnNumber;
    });
    if (materialCodeColumn && quantityColumn && unitCodeColumn) {
      headerRowNumber = rowNumber;
      break;
    }
    materialCodeColumn = 0;
    quantityColumn = 0;
    unitCodeColumn = 0;
  }

  if (!headerRowNumber) {
    return {
      rows: [],
      errors: ['Không tìm thấy đủ các cột bắt buộc: Mã vật tư, Số lượng dự toán, Mã ĐVT.'],
    };
  }

  const rows: ParsedBOQWorkbook['rows'] = [];
  const errors: string[] = [];
  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const materialCell = row.getCell(materialCodeColumn);
    const quantityCell = row.getCell(quantityColumn);
    const unitCell = row.getCell(unitCodeColumn);
    const materialCode = cellText(materialCell);
    const unitCode = cellText(unitCell);
    const quantityText = cellText(quantityCell);

    if (!materialCode && !unitCode && !quantityText) continue;
    if (isFormulaCell(materialCell) || isFormulaCell(quantityCell) || isFormulaCell(unitCell)) {
      errors.push(`Dòng ${rowNumber}: không hỗ trợ công thức tại các cột bắt buộc.`);
      continue;
    }

    const quantity = parseQuantity(quantityCell);
    if (!materialCode) errors.push(`Dòng ${rowNumber}: thiếu Mã vật tư.`);
    if (!unitCode) errors.push(`Dòng ${rowNumber}: thiếu Mã ĐVT.`);
    if (quantity === null) errors.push(`Dòng ${rowNumber}: Số lượng dự toán không phải là số hợp lệ.`);
    if (!materialCode || !unitCode || quantity === null) continue;

    rows.push({ rowNumber, materialCode, quantity, unitCode });
  }

  if (rows.length > MAX_ROWS) errors.push(`Mỗi lần chỉ được import tối đa ${MAX_ROWS} dòng BOQ.`);
  if (rows.length === 0 && errors.length === 0) errors.push('File Excel không có dòng dữ liệu BOQ.');

  return { rows: rows.slice(0, MAX_ROWS), errors };
};

export const downloadBOQImportTemplate = async (
  rows: BOQTemplateRow[],
  fileName: string,
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BPG-CMS';
  workbook.created = new Date();

  const guide = workbook.addWorksheet('Hướng dẫn');
  guide.columns = [{ width: 110 }];
  [
    'HƯỚNG DẪN IMPORT BOQ',
    '1. Không đổi tên worksheet BOQ hoặc các cột có dấu *.',
    '2. Mã vật tư và Mã ĐVT phải tồn tại trong hệ thống.',
    '3. Hệ thống đối chiếu theo mã; Tên vật tư và Tên ĐVT chỉ để tham khảo.',
    '4. Import đồng bộ toàn bộ BOQ: vật tư hiện có nhưng không còn trong Excel sẽ được xóa khi lưu.',
    '5. Số lượng phải lớn hơn 0 và có tối đa 3 chữ số thập phân.',
  ].forEach((text, index) => {
    const cell = guide.getCell(index + 1, 1);
    cell.value = text;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (index === 0) cell.font = { bold: true, size: 14 };
  });

  const sheet = workbook.addWorksheet('BOQ', { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = ['STT', 'Mã vật tư*', 'Tên vật tư', 'Số lượng dự toán*', 'Mã ĐVT*', 'Tên ĐVT'];
  sheet.addRow(headers);
  sheet.columns = [
    { width: 8 }, { width: 18 }, { width: 34 },
    { width: 22 }, { width: 16 }, { width: 18 },
  ];
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  rows.forEach((row, index) => {
    sheet.addRow([
      index + 1,
      row.materialCode,
      row.materialName,
      row.quantity,
      row.unitCode,
      row.unitName,
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
