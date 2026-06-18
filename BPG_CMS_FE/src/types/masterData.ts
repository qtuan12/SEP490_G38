export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Unit {
  unitId: number;
  unitCode: string;
  unitName: string;
}

export interface CreateUnitRequest {
  unitCode: string;
  unitName: string;
}

export interface UpdateUnitRequest {
  unitCode: string;
  unitName: string;
}

export interface MaterialCategory {
  categoryId: number;
  categoryCode: string;
  categoryName: string;
}

export interface CreateMaterialCategoryRequest {
  categoryCode: string;
  categoryName: string;
}

export interface UpdateMaterialCategoryRequest {
  categoryCode: string;
  categoryName: string;
}

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
