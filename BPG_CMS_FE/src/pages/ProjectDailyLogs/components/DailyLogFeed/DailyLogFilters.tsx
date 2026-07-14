import React from 'react';
import { Search } from 'lucide-react';
import { Input, Select } from '../../../../components/ui';
import type { WBSTask } from '../../../../types/common';

interface DailyLogFiltersProps {
  taskId?: string;
  currentTaskHasSubtasks: boolean;
  descendantTasks: WBSTask[];
  phaseOptions: Array<{ label: string; value: string }>;
  assignedEngineers: Array<{ id: string; name: string }>;
  
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedPhaseId: string;
  setSelectedPhaseId: (id: string) => void;
  selectedSubtaskId: string;
  setSelectedSubtaskId: (id: string) => void;
  selectedEngineerId: string;
  setSelectedEngineerId: (id: string) => void;
  
  startDateFilter: string;
  setStartDateFilter: (d: string) => void;
  endDateFilter: string;
  setEndDateFilter: (d: string) => void;
}

export const DailyLogFilters: React.FC<DailyLogFiltersProps> = ({
  taskId,
  currentTaskHasSubtasks,
  descendantTasks,
  phaseOptions,
  assignedEngineers,
  searchQuery,
  setSearchQuery,
  selectedPhaseId,
  setSelectedPhaseId,
  selectedSubtaskId,
  setSelectedSubtaskId,
  selectedEngineerId,
  setSelectedEngineerId,
  startDateFilter,
  setStartDateFilter,
  endDateFilter,
  setEndDateFilter
}) => {
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3 bg-[hsl(var(--bg-card))]">
      <div className="flex gap-3 flex-wrap items-center">
        {/* Tìm kiếm văn bản */}
        <div className="flex-[2] min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
          <Input
            type="text"
            placeholder="Tìm nội dung, công việc, kỹ sư..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-[38px]"
          />
        </div>

        {/* Lọc theo Giai đoạn (Chỉ hiện khi xem toàn bộ dự án, không chọn task cụ thể) */}
        {!taskId && (
          <div className="flex-1 min-w-[150px]">
            <Select
              value={selectedPhaseId}
              onChange={(e) => setSelectedPhaseId(e.target.value)}
              className="h-[38px] text-[0.85rem]"
              options={phaseOptions}
            />
          </div>
        )}

        {/* Lọc theo công việc con (Chỉ hiện khi task hiện tại có các công việc con) */}
        {taskId && currentTaskHasSubtasks && descendantTasks.length > 0 && (
          <div className="flex-1 min-w-[150px]">
            <Select
              value={selectedSubtaskId}
              onChange={(e) => setSelectedSubtaskId(e.target.value)}
              className="h-[38px] text-[0.85rem]"
              options={[
                { label: 'Tất cả công việc con', value: '' },
                ...descendantTasks.map(t => ({ label: t.name, value: t.id }))
              ]}
            />
          </div>
        )}

        {/* Lọc theo nhân viên kỹ thuật */}
        <div className="flex-1 min-w-[150px]">
          <Select
            value={selectedEngineerId}
            onChange={(e) => setSelectedEngineerId(e.target.value)}
            className="h-[38px] text-[0.85rem]"
            options={[
              { label: 'Tất cả Nhân viên kỹ thuật', value: '' },
              ...assignedEngineers.map(e => ({ label: e.name, value: e.id }))
            ]}
          />
        </div>
      </div>

      {/* Lọc theo khoảng ngày */}
      <div className="flex gap-3 flex-wrap items-center text-[0.85rem] text-[hsl(var(--text-secondary))] border-t border-[hsl(var(--border)/0.5)] pt-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">Từ ngày:</span>
          <Input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="h-[32px] text-xs py-1 w-[135px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">Đến ngày:</span>
          <Input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="h-[32px] text-xs py-1 w-[135px]"
          />
        </div>
        {(startDateFilter || endDateFilter) && (
          <button
            type="button"
            onClick={() => {
              setStartDateFilter('');
              setEndDateFilter('');
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
          >
            Xóa bộ lọc ngày
          </button>
        )}
      </div>
    </div>
  );
};
