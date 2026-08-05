import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search } from 'lucide-react';
import { Badge, DataTable, Input, TableLoader, type ColumnDef } from '../../components/ui';
import { supplierService } from '../../services/supplierService';
import { surplusService } from '../../services/surplusService';
import type { Supplier } from '../../types/supplier';

interface Props {
  projectId: number;
}

const text = {
  unrated: 'Ch\u01b0a c\u00f3 \u0111\u00e1nh gi\u00e1',
  supplierName: 'T\u00ean nh\u00e0 cung c\u1ea5p',
  contactInfo: 'Th\u00f4ng tin li\u00ean h\u1ec7',
  address: '\u0110\u1ecba ch\u1ec9',
  serviceArea: 'Khu v\u1ef1c ph\u1ee5c v\u1ee5',
  rating: '\u0110\u00e1nh gi\u00e1',
  status: 'Tr\u1ea1ng th\u00e1i',
  active: '\u0110ang ho\u1ea1t \u0111\u1ed9ng',
  inactive: 'T\u1ea1m ng\u01b0ng',
  title: 'Nh\u00e0 cung c\u1ea5p \u0111\u00e3 giao d\u1ecbch',
  countSuffix: 'nh\u00e0 cung c\u1ea5p',
  searchPlaceholder: 'T\u00ecm theo t\u00ean, li\u00ean h\u1ec7, khu v\u1ef1c...',
  loading: '\u0110ang t\u1ea3i d\u1eef li\u1ec7u nh\u00e0 cung c\u1ea5p...',
  empty: 'D\u1ef1 \u00e1n ch\u01b0a c\u00f3 nh\u00e0 cung c\u1ea5p ph\u00e1t sinh t\u1eeb phi\u1ebfu nh\u1eadp kho.',
};

const renderStars = (rating?: number) => {
  if (!rating) {
    return <span className="text-[hsl(var(--text-muted))] text-xs font-normal">{text.unrated}</span>;
  }

  return (
    <span className="text-amber-500 font-semibold" title={`${rating}/5 sao`}>
      {'\u2605'.repeat(Math.round(rating))}{' '}
      <span className="text-[11px] text-[hsl(var(--text-secondary))] ml-0.5">({rating})</span>
    </span>
  );
};

export const ProjectRelatedSuppliersTab: React.FC<Props> = ({ projectId }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: projectSuppliers = [], isLoading: loadingProjectSuppliers } = useQuery({
    queryKey: ['project-received-suppliers', projectId],
    queryFn: () => surplusService.getProjectReceivedSuppliers(projectId),
    enabled: projectId > 0,
    staleTime: 30_000,
  });

  const { data: masterSupplierPage, isLoading: loadingMasterSuppliers } = useQuery({
    queryKey: ['project-related-suppliers-master', projectId],
    queryFn: () => supplierService.getSuppliers({ pageSize: 500, sortBy: 'name' }),
    enabled: projectSuppliers.length > 0,
    staleTime: 60_000,
  });

  const suppliers = useMemo<Supplier[]>(() => {
    const masterById = new Map((masterSupplierPage?.items || []).map(supplier => [supplier.supplierId, supplier]));

    return projectSuppliers.map(projectSupplier => {
      const master = masterById.get(projectSupplier.supplierId);
      return master || {
        supplierId: projectSupplier.supplierId,
        supplierName: projectSupplier.supplierName,
        collaborationStatus: 'Active',
      };
    });
  }, [masterSupplierPage?.items, projectSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return suppliers;

    return suppliers.filter(supplier =>
      [
        supplier.supplierName,
        supplier.contactInfo,
        supplier.address,
        supplier.serviceArea,
        supplier.evaluationNote,
      ].some(value => value?.toLowerCase().includes(q))
    );
  }, [searchTerm, suppliers]);

  const columns: ColumnDef<Supplier>[] = [
    {
      key: 'supplierName',
      header: text.supplierName,
      render: supplier => (
        <div className="flex items-center gap-2">
          <div className="p-1 bg-[hsl(var(--primary-glow))] rounded-sm border border-[hsl(var(--border))]">
            <Building2 size={15} className="text-[hsl(var(--primary))]" />
          </div>
          <span className="font-semibold text-[hsl(var(--text-primary))]">{supplier.supplierName}</span>
        </div>
      ),
    },
    {
      key: 'contactInfo',
      header: text.contactInfo,
      render: supplier => (
        <span className="text-[hsl(var(--text-secondary))] block max-w-[180px] whitespace-normal break-words" title={supplier.contactInfo}>
          {supplier.contactInfo || '-'}
        </span>
      ),
    },
    {
      key: 'address',
      header: text.address,
      render: supplier => (
        <span className="text-[hsl(var(--text-secondary))] block max-w-[200px] whitespace-normal break-words" title={supplier.address}>
          {supplier.address || '-'}
        </span>
      ),
    },
    {
      key: 'serviceArea',
      header: text.serviceArea,
      render: supplier => (
        <span className="text-[hsl(var(--text-secondary))]" title={supplier.serviceArea}>
          {supplier.serviceArea || '-'}
        </span>
      ),
    },
    {
      key: 'rating',
      header: text.rating,
      render: supplier => renderStars(supplier.rating),
    },
    {
      key: 'collaborationStatus',
      header: text.status,
      render: supplier => (
        <Badge
          variant={supplier.collaborationStatus === 'Active' ? 'success' : 'danger'}
          className="normal-case font-medium"
        >
          {supplier.collaborationStatus === 'Active' ? text.active : text.inactive}
        </Badge>
      ),
    },
  ];

  const isLoading = loadingProjectSuppliers || loadingMasterSuppliers;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold m-0 text-[hsl(var(--text-primary))]">{text.title}</h3>
            <p className="text-sm text-[hsl(var(--text-muted))] m-0 mt-1">
              {suppliers.length.toLocaleString('vi-VN')} {text.countSuffix}
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder={text.searchPlaceholder}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {isLoading ? (
          <TableLoader isTable={false} message={text.loading} minHeight="240px" />
        ) : (
          <DataTable
            columns={columns}
            data={filteredSuppliers}
            keyExtractor={supplier => supplier.supplierId.toString()}
            emptyMessage={text.empty}
          />
        )}
      </div>
    </div>
  );
};
