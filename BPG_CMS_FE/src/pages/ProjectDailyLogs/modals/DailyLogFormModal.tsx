import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { UploadCloud, X, AlertCircle } from 'lucide-react';
import { projectService } from '../../../services/projectService';
import type { WBSTask, DailyLog, WBSPhase } from '../../../types/common';
import { Modal, Button, Textarea } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';

const dailyLogSchema = z.object({
  progress: z.number().min(0).max(100),
  content: z.string().min(1, 'Vui lòng nhập chi tiết diễn biến thi công.')
});

type DailyLogForm = z.infer<typeof dailyLogSchema>;

interface DailyLogFormProps {
  onCancel: () => void;
  task?: WBSTask;
  taskId?: string;
  tasks?: WBSTask[];
  phases?: WBSPhase[];
  selectedPhaseId?: string;
  editLog?: DailyLog;
  engineerId: string;
  engineerName: string;
  isPL?: boolean;
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
  hideHeader?: boolean;
}

export const DailyLogForm: React.FC<DailyLogFormProps> = ({
  onCancel,
  task,
  taskId,
  tasks = [],
  editLog,
  engineerId,
  engineerName,
  onSuccess,
  hideHeader = false
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditMode = !!editLog;

  // Selected new files for upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Local object URLs for previewing new files
  const [previews, setPreviews] = useState<string[]>([]);
  // Keep track of existing images in edit mode
  const [existingImages, setExistingImages] = useState<string[]>([]);
  // File dragging state
  const [dragging, setDragging] = useState(false);
  // Find the selected task object
  const currentTask = React.useMemo(() => {
    if (task) return task;
    if (editLog) return undefined; // Task is not changeable in edit mode
    if (!tasks || tasks.length === 0) return undefined;
    const activeId = taskId;
    if (!activeId) return undefined;
    return tasks.find(t => String(t.id).replace(/^t-/, '') === String(activeId).replace(/^t-/, ''));
  }, [task, taskId, tasks, editLog]);

  const minProgress = currentTask ? currentTask.progress : 0;
  const isProgressDisabled = !currentTask || currentTask.progress === 100;

  const schema = React.useMemo(() => {
    const isTMOrAdmin = user?.role === 'admin' || user?.role === 'technicalmanager';
    const minVal = isTMOrAdmin ? 0 : minProgress;
    return z.object({
      progress: z.number()
        .min(minVal, `Tiến độ không được nhỏ hơn tiến độ hiện tại (${minVal}%).`)
        .max(100),
      content: z.string().trim()
    }).refine(data => {
      if (data.progress < minProgress) {
        return data.content.length >= 5;
      }
      return true;
    }, {
      message: 'Vui lòng nhập lý do giảm tiến độ công việc (tối thiểu 5 ký tự).',
      path: ['content']
    }).refine(data => {
      if (data.progress >= minProgress) {
        return data.content.length >= 5;
      }
      return true;
    }, {
      message: 'Vui lòng nhập chi tiết diễn biến thi công (tối thiểu 5 ký tự).',
      path: ['content']
    });
  }, [minProgress, user?.role]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<DailyLogForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      progress: task?.progress || 0,
      content: ''
    }
  });

  const progress = watch('progress');

  useEffect(() => {
    setSelectedFiles([]);
    setPreviews([]);
    
    if (isEditMode && editLog) {
      setExistingImages(editLog.images || []);
      reset({
        progress: editLog.progressTo,
        content: editLog.content
      });
    } else {
      setExistingImages([]);
      if (currentTask) {
        reset({
          progress: currentTask.progress,
          content: ''
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTask?.id, editLog]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addImages(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addImages(Array.from(e.target.files));
    }
  };

  const addImages = (files: File[]) => {
    const totalCurrentCount = existingImages.length + selectedFiles.length;
    const remainingCount = 5 - totalCurrentCount;
    if (remainingCount <= 0) {
      toast.error('Đã đạt giới hạn tối đa 5 ảnh.');
      return;
    }

    // Kiểm tra dung lượng hình ảnh (tối đa 10MB mỗi file)
    const MAX_SIZE = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > MAX_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error('Hình ảnh không được vượt quá 10MB.');
      return;
    }

    const validFiles = files.filter(f => f.type.startsWith('image/')).slice(0, remainingCount);
    if (validFiles.length === 0) return;

    const newFiles = [...selectedFiles, ...validFiles];
    setSelectedFiles(newFiles);

    const urls = validFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...urls]);
  };

  const removeNewImage = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: async (data: DailyLogForm) => {
      let finalImages: string[] = [];

      // 1. Upload new files to Cloudinary if any
      if (selectedFiles.length > 0) {
        finalImages = await projectService.uploadFiles(selectedFiles, 'dailylogs');
      }

      // 2. Merge with remaining existing images
      const allImages = [...existingImages, ...finalImages];

      // If no images at all, add a fallback default image
      if (allImages.length === 0 && !isEditMode) {
        allImages.push('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80');
      }

      if (isEditMode && editLog) {
        return projectService.updateDailyLog(editLog.id, data.content, allImages);
      } else {
        if (!currentTask) throw new Error('Vui lòng chọn công việc hợp lệ.');
        return projectService.createDailyLog({
          projectId: currentTask.projectId,
          taskId: currentTask.id,
          taskName: currentTask.name,
          engineerId,
          engineerName,
          progressFrom: currentTask.progress,
          progressTo: data.progress,
          content: data.content,
          weather: '',
          images: allImages
        }, engineerName, user?.role, undefined);
      }
    },
    onSuccess: (resLog) => {
      const msg = isEditMode 
        ? `Đã cập nhật nhật ký thi công thành công!` 
        : `Đã báo cáo nhật ký thi công cho việc "${resLog.taskName}" thành công!`;
      toast.success(msg);
      onSuccess(msg);
      
      const pId = task?.projectId || editLog?.projectId || (currentTask?.projectId);
      if (pId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', pId] });
        queryClient.invalidateQueries({ queryKey: ['daily-logs', pId] });
      }
      onCancel();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi xử lý nhật ký thi công.');
    }
  });

  const onSubmit = (data: DailyLogForm) => {
    mutation.mutate(data);
  };

  const totalImagesCount = existingImages.length + selectedFiles.length;

  return (
    <div className={`bg-[hsl(var(--bg-card))] rounded-md ${hideHeader ? '' : 'border border-[hsl(var(--border))] shadow-sm mt-4'} overflow-hidden animate-fade-in`}>
      {!hideHeader && (
        <div className="p-3 bg-blue-50/50 border-b border-[hsl(var(--border))]">
          <h4 className="m-0 text-[0.95rem] font-semibold text-blue-700">{isEditMode ? "Sửa Nhật ký công trường" : "Cập nhật Nhật ký công trường"}</h4>
        </div>
      )}
      <div className={hideHeader ? '' : 'p-4'}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Progress Slider (Only for Create Mode) */}
          {!isEditMode ? (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-slate-700">Tiến độ hoàn thành (%)</label>
                <strong className="text-blue-600 text-lg">{progress}%</strong>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {currentTask ? `${currentTask.progress}% (Hiện tại)` : '0%'}
                </span>
                <input
                  type="range"
                  {...register('progress', { 
                    valueAsNumber: true,
                    onChange: (e) => {
                      const val = Number(e.target.value);
                      const isTMOrAdmin = user?.role === 'admin' || user?.role === 'technicalmanager';
                      if (!isTMOrAdmin && val < minProgress) {
                        setValue('progress', minProgress);
                      }
                    }
                  })}
                  min={user?.role === 'admin' || user?.role === 'technicalmanager' ? 0 : minProgress}
                  max={100}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  disabled={isProgressDisabled}
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">100%</span>
              </div>
              <span className="text-xs text-slate-500 block mt-1.5">
                * Khóa cứng chiều lùi: Bạn chỉ có thể kéo tiến độ tiến lên hoặc giữ nguyên.
              </span>
              {errors.progress && <p className="text-red-500 text-xs mt-1">{errors.progress.message}</p>}
            </div>
          ) : (
            editLog && (
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600">Tiến độ đã ghi nhận (Đóng băng)</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 font-semibold w-full">
                  {editLog.progressTo}%
                </div>
                <span className="text-xs text-slate-500 block mt-1">
                  * Tiến độ của nhật ký đã ghi nhận được đóng băng ở chế độ chỉnh sửa.
                </span>
              </div>
            )
          )}

          {/* Task Selection / Display */}
          {isEditMode && editLog ? (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 p-3 rounded-md border border-blue-100 text-sm">
              <AlertCircle size={18} />
              <span>Đang sửa nhật ký cho việc: <strong>{editLog.taskName}</strong></span>
            </div>
          ) : currentTask ? (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 p-3 rounded-md border border-blue-100 text-sm">
              <AlertCircle size={18} />
              <span>Báo cáo cho việc: <strong>{currentTask.name}</strong></span>
            </div>
          ) : null}

          {/* Detailed Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-600">
              {isEditMode 
                ? 'Mô tả công việc' 
                : progress < minProgress 
                ? 'Lý do giảm tiến độ' 
                : 'Diễn biến công việc chi tiết'} <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder={progress < minProgress ? "Vui lòng nhập lý do cụ thể vì sao tiến độ công việc bị giảm..." : "Mô tả công việc đã làm được hôm nay, số lượng nhân công huy động, các khó khăn gặp phải nếu có..."}
              {...register('content')}
              rows={4}
              error={!!errors.content}
            />
            {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content.message}</p>}
          </div>

          {/* Cloudinary Image Upload Box */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-600">Hình ảnh hiện trường thi công (Tối đa 5 ảnh)</label>
            
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (totalImagesCount < 5) {
                  document.getElementById('log-image-input')?.click();
                }
              }}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                totalImagesCount >= 5 
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                  : dragging 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <input
                id="log-image-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={totalImagesCount >= 5}
              />
              
              {totalImagesCount > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-4 mt-2" onClick={e => e.stopPropagation()}>
                  {/* Existing Images (Edit mode) */}
                  {existingImages.map((imgUrl, idx) => (
                    <div key={`existing-${idx}`} className="relative w-16 h-16 rounded shadow-sm border border-gray-200 group overflow-hidden">
                      <img src={imgUrl} alt="existing preview" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 bg-slate-500 text-white text-[8px] text-center py-0.5 font-bold">Đã lưu</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeExistingImage(idx);
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Xóa ảnh này"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  {/* New Selected Images */}
                  {previews.map((imgUrl, idx) => (
                    <div key={`new-${idx}`} className="relative w-16 h-16 rounded shadow-sm border border-gray-200 group overflow-hidden">
                      <img src={imgUrl} alt="new preview" className="w-full h-full object-cover border border-green-500" />
                      <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-[8px] text-center py-0.5 font-bold">Mới</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNewImage(idx);
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Hủy chọn"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <UploadCloud size={32} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-600">
                    Kéo thả hình ảnh vào đây hoặc click để chọn ảnh
                  </p>
                  <span className="text-xs text-slate-500">
                    Hỗ trợ định dạng hình ảnh tối đa 10MB (tối đa 5 ảnh)
                  </span>
                </div>
              )}

              {totalImagesCount > 0 && totalImagesCount < 5 && (
                <div className="mt-4 text-xs text-blue-600 font-semibold" onClick={e => e.stopPropagation()}>
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => document.getElementById('log-image-input')?.click()}
                  >
                    + Thêm ảnh khác ({totalImagesCount}/5)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Buttons */}
          <div className="flex justify-end gap-3 mt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel} 
              disabled={mutation.isPending}
            >
              Hủy
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              isLoading={mutation.isPending}
            >
              {isEditMode ? 'Cập nhật' : 'Gửi báo cáo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DailyLogFormModalProps extends Omit<DailyLogFormProps, 'onCancel'> {
  isOpen: boolean;
  onClose: () => void;
  isPL?: boolean;
}

export const DailyLogFormModal: React.FC<DailyLogFormModalProps> = ({
  isOpen, onClose, isPL, ...rest
}) => {
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={rest.editLog ? "Sửa Nhật ký công trường" : "Cập nhật Nhật ký công trường"}>
      <DailyLogForm {...rest} isPL={isPL} onCancel={onClose} hideHeader={true} />
    </Modal>
  );
};
