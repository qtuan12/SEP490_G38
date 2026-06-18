export interface MaterialCatalog {
  materialId: number;
  categoryId: number;
  categoryName?: string;
  baseUnitId: number;
  baseUnitName?: string;
  code: string;
  name: string;
  specification?: string;
}

export interface CreateMaterialCatalogRequest {
  categoryId: number;
  baseUnitId: number;
  code: string;
  name: string;
  specification?: string;
}

export interface UpdateMaterialCatalogRequest {
  categoryId: number;
  baseUnitId: number;
  code: string;
  name: string;
  specification?: string;
}

export interface MaterialConversion {
  materialId: number;
  alternativeUnitId: number;
  alternativeUnitName?: string;
  conversionRate: number;
}

export interface MaterialConversionRequest {
  alternativeUnitId: number;
  conversionRate: number;
}
