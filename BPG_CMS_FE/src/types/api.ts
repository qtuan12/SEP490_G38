export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
  errorCode?: string;
}

export interface ApiResult<T = any> {
  data: T;
  message: string;
}

export interface PagedList<T> {
  items: T[];
  pageIndex?: number;
  pageNumber?: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiPagedResponse<T> extends ApiResponse<PagedList<T>> {}
