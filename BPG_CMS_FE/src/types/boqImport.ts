export interface PhaseBOQImportRowInput {
  rowNumber: number;
  materialCode: string;
  quantity: number;
  unitCode: string;
}

export type PhaseBOQImportRowStatus = 'New' | 'Updated' | 'Unchanged' | 'Deleted' | 'Error';

export interface PhaseBOQImportRowResult {
  rowNumber: number;
  materialCode: string;
  materialName: string;
  quantity: number;
  unitCode: string;
  unitName: string;
  status: PhaseBOQImportRowStatus;
  errors: string[];
}

export interface PhaseBOQImportMergedItem {
  materialId: number;
  materialCode: string;
  materialName: string;
  quantity: number;
  unitId: number;
  unitCode: string;
  unitName: string;
}

export interface PhaseBOQImportPreview {
  canApply: boolean;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  deletedCount: number;
  errorCount: number;
  rows: PhaseBOQImportRowResult[];
  mergedItems: PhaseBOQImportMergedItem[];
}

export interface BOQTemplateRow {
  materialCode: string;
  materialName: string;
  quantity: number;
  unitCode: string;
  unitName: string;
}

export interface ParsedBOQWorkbook {
  rows: PhaseBOQImportRowInput[];
  errors: string[];
}
