export interface MaterialCategory {
  categoryId: number;
  categoryName: string;
  description?: string;
}

export interface CreateMaterialCategoryRequest {
  categoryName: string;
  description?: string;
}

export interface UpdateMaterialCategoryRequest {
  categoryName: string;
  description?: string;
}
