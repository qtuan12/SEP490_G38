export interface Supplier {
  supplierId: number;
  supplierName: string;
  contactInfo?: string;
  address?: string;
  serviceArea?: string;
  rating?: number;
  evaluationNote?: string;
  collaborationStatus: 'Strategic' | 'Regular' | 'Restricted' | 'Blacklisted';
}

export interface GetSuppliersQuery {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDescending?: boolean;
  collaborationStatus?: string;
}

export interface ImportSuppliersResult {
  successCount: number;
  skippedCount: number;
  errors: string[];
  importedSuppliers: Supplier[];
}
