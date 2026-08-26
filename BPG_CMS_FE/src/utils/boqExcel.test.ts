import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseBOQExcelFile } from './boqExcel';

describe('parseBOQExcelFile', () => {
  it('đọc được đúng header do file mẫu BOQ tạo ra', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Hướng dẫn');
    const sheet = workbook.addWorksheet('BOQ');
    sheet.addRow(['STT', 'Mã vật tư*', 'Tên vật tư', 'Số lượng dự toán*', 'Mã ĐVT*', 'Tên ĐVT']);
    sheet.addRow([1, 'XM-VICEM-PCB40', 'Xi măng VICEM PCB40 đóng bao', 50, 'BAO', 'Bao']);
    const buffer = await workbook.xlsx.writeBuffer();
    const file = {
      name: 'BOQ_Giai_doan.xlsx',
      size: buffer.byteLength,
      arrayBuffer: async () => buffer,
    } as File;

    await expect(parseBOQExcelFile(file)).resolves.toEqual({
      rows: [{ rowNumber: 2, materialCode: 'XM-VICEM-PCB40', quantity: 50, unitCode: 'BAO' }],
      errors: [],
    });
  });
});
