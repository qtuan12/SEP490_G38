import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { UploadCloud, X, AlertCircle, Loader2, Camera, RotateCcw } from 'lucide-react';
import { projectService } from '../../../services/projectService';
import type { WBSTask, DailyLog, WBSPhase } from '../../../types/common';
import { Modal, Button, Textarea } from '../../../components/ui';
import { compressAndUploadFile } from '../../../utils/uploadHelper';
import type { UploadedFileState } from '../../../utils/uploadHelper';
import { CameraCaptureModal } from '../../../components/CameraCaptureModal';

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
  canManageTechnical?: boolean;
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
  isPL = false,
  canManageTechnical = false,
  onSuccess,
  hideHeader = false
}) => {
  const queryClient = useQueryClient();
  const isEditMode = !!editLog;

  // Selected new files with upload status
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  // Keep track of existing images in edit mode
  const [existingImages, setExistingImages] = useState<string[]>([]);
  // File dragging state
  const [dragging, setDragging] = useState(false);
  // Chụp ảnh ngay trong trang (getUserMedia) thay vì mở app Camera hệ thống — trên Android,
  // khi PWA chạy standalone, mở camera hệ thống có thể không trả về đúng cửa sổ app, mất ảnh vừa chụp.
  const [cameraOpen, setCameraOpen] = useState(false);
  const supportsInPageCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
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
  const sliderMin = canManageTechnical ? 0 : minProgress;
  const isProgressDisabled = !currentTask || (!canManageTechnical && currentTask.progress === 100);
  const hasTaskAssignee = currentTask?.assignedTo?.split(',').some(id => id.trim().length > 0) ?? false;
  const isAssignedEngineer = !!currentTask
    && !!engineerId
    && (currentTask.assignedTo?.split(',').map(id => id.trim()).includes(String(engineerId)) ?? false);
  const canCreateForCurrentTask = isEditMode || (hasTaskAssignee && (isPL || canManageTechnical || isAssignedEngineer));

  const schema = React.useMemo(() => {
    return z.object({
      progress: z.number()
        .min(sliderMin, `Tiến độ không được nhỏ hơn tiến độ hiện tại (${sliderMin}%).`)
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
  }, [minProgress, sliderMin]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<DailyLogForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      progress: task?.progress || 0,
      content: ''
    }
  });

  const progress = watch('progress');
  const displayedProgress = !isEditMode && progress < sliderMin ? sliderMin : progress;

  useEffect(() => {
    setUploadedFiles([]);
    
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
          progress: sliderMin,
          content: ''
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTask?.id, editLog, sliderMin]);

  useEffect(() => {
    if (!isEditMode && progress < sliderMin) {
      setValue('progress', sliderMin);
    }
  }, [isEditMode, progress, setValue, sliderMin]);

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
    // Kiểm tra dung lượng hình ảnh (tối đa 10MB mỗi file)
    const MAX_SIZE = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > MAX_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error('Hình ảnh không được vượt quá 10MB.');
      return;
    }

    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    validFiles.forEach(file => {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);
      
      const newFileState: UploadedFileState = {
        id: tempId,
        name: file.name,
        url: localUrl,
        status: 'uploading',
        file
      };

      setUploadedFiles(prev => [...prev, newFileState]);

      compressAndUploadFile(
        file,
        'dailylogs',
        (uploadedUrl) => {
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'success', url: uploadedUrl } : f)
          );
        },
        () => {
          toast.error(`Không thể tải ảnh ${file.name} lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.`);
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f)
          );
        }
      );
    });
  };

  const retryUpload = (id: string) => {
    const target = uploadedFiles.find(f => f.id === id);
    if (!target || !target.file) return;

    setUploadedFiles(prev =>
      prev.map(f => f.id === id ? { ...f, status: 'uploading' } : f)
    );

    compressAndUploadFile(
      target.file,
      'dailylogs',
      (uploadedUrl) => {
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'success', url: uploadedUrl } : f)
        );
      },
      () => {
        toast.error(`Không thể tải ảnh ${target.name} lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.`);
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'error' } : f)
        );
      }
    );
  };

  const removeNewImage = (id: string) => {
    setUploadedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target && target.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: async (data: DailyLogForm) => {
      // Collect successful URLs
      const finalImages = uploadedFiles
        .filter(f => f.status === 'success' && f.url)
        .map(f => f.url!);

      const allImages = [...existingImages, ...finalImages];

      if (isEditMode && editLog) {
        return projectService.updateDailyLog(editLog.id, data.content, allImages);
      } else {
        if (!currentTask) throw new Error('Vui lòng chọn công việc hợp lệ.');
        if (!canCreateForCurrentTask) throw new Error('Công việc chưa được phân công hoặc bạn không có quyền tạo nhật ký cho công việc này.');
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
        }, engineerName, canManageTechnical, undefined);
      }
    },
    onSuccess: (resLog) => {
      const msg = isEditMode
        ? 'Đã cập nhật nhật ký thi công.'
        : `Đã tạo nhật ký thi công cho công việc "${resLog.taskName}".`;
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
      toast.error(error.message || 'Không thể xử lý nhật ký thi công.');
    }
  });

  const onSubmit = (data: DailyLogForm) => {
    if (!canCreateForCurrentTask) {
      toast.error('Công việc chưa được phân công hoặc bạn không có quyền tạo nhật ký cho công việc này.');
      return;
    }

    // 1. Chặn submit nếu có hình ảnh đang tải lên
    if (uploadedFiles.some(f => f.status === 'uploading')) {
      toast.error('Vui lòng chờ hình ảnh tải lên hoàn tất.');
      return;
    }

    // 2. Chặn submit nếu có hình ảnh bị lỗi upload (timeout / kết nối / dung lượng)
    if (uploadedFiles.some(f => f.status === 'error')) {
      toast.error('Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.');
      return;
    }

    // 3. Đảm bảo tất cả file mới đều có URL remote hợp lệ
    const hasInvalidUploads = uploadedFiles.some(f => !f.url || !f.url.startsWith('http'));
    if (hasInvalidUploads) {
      toast.error('Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.');
      return;
    }

    mutation.mutate(data);
  };

  const totalImagesCount = existingImages.length + uploadedFiles.length;

  return (
    <>
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
                <strong className="text-blue-600 text-lg">{displayedProgress}%</strong>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {currentTask ? `${currentTask.progress}% (Hiện tại)` : '0%'}
                </span>
                <input
                  type="range"
                  {...register('progress', { 
                    valueAsNumber: true
                  })}
                  value={displayedProgress}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setValue('progress', Math.max(val, sliderMin), {
                      shouldDirty: true,
                      shouldValidate: true
                    });
                  }}
                  min={sliderMin}
                  max={100}
                  step={1}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isProgressDisabled}
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">100%</span>
              </div>
              <span className="text-xs text-slate-500 block mt-1.5">
                {canManageTechnical
                  ? '* Quyền TPKT: Bạn có thể điều chỉnh giảm tiến độ nếu cần (yêu cầu nhập lý do giảm).'
                  : '* Khóa cứng chiều lùi: Bạn chỉ có thể kéo tiến độ tiến lên hoặc giữ nguyên.'}
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
            <label className="block text-sm font-medium mb-1.5 text-slate-600">Hình ảnh hiện trường thi công</label>
            
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  if (supportsInPageCamera) {
                    setCameraOpen(true);
                  } else {
                    document.getElementById('log-camera-input')?.click();
                  }
                }}
                disabled={mutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Camera size={16} />
                Chụp ảnh
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('log-image-input')?.click()}
                disabled={mutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <UploadCloud size={16} />
                Chọn ảnh
              </button>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (!mutation.isPending) {
                  document.getElementById('log-image-input')?.click();
                }
              }}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                dragging
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
                disabled={mutation.isPending}
              />
              <input
                id="log-camera-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
                disabled={mutation.isPending}
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
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className={`relative w-16 h-16 rounded shadow-sm border group overflow-hidden ${file.status === 'error' ? 'border-red-500' : file.status === 'success' ? 'border-green-500' : 'border-gray-200'}`}>
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                      
                      {file.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 size={12} className="animate-spin text-white" />
                        </div>
                      )}
                      
                      {file.status === 'error' && (
                        <>
                          <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[8px] text-center py-0.5 font-bold">Lỗi</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              retryUpload(file.id);
                            }}
                            className="absolute top-1 left-1 bg-blue-600 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 transition-opacity z-10"
                            title="Thử lại upload"
                          >
                            <RotateCcw size={10} />
                          </button>
                        </>
                      )}
                      
                      {file.status === 'success' && (
                        <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-[8px] text-center py-0.5 font-bold">Mới</span>
                      )}
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNewImage(file.id);
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
                    Hỗ trợ định dạng hình ảnh tối đa 10MB
                  </span>
                </div>
              )}

              {uploadedFiles.some(f => f.status === 'error') && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 text-left">
                    <AlertCircle size={16} className="text-red-600 shrink-0" />
                    <span>Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.</span>
                  </div>
                </div>
              )}

              {totalImagesCount > 0 && (
                <div className="mt-4 text-xs text-blue-600 font-semibold" onClick={e => e.stopPropagation()}>
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => document.getElementById('log-image-input')?.click()}
                  >
                    + Thêm ảnh khác (Đã chọn {totalImagesCount} ảnh)
                  </span>
                </div>
              )}
            </div>
          </div>

          {!canCreateForCurrentTask && !isEditMode && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Công việc chưa được phân công hoặc bạn không có quyền tạo nhật ký cho công việc này.
            </div>
          )}

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
              disabled={mutation.isPending || (!canCreateForCurrentTask && !isEditMode)}
            >
              {isEditMode ? 'Cập nhật' : 'Gửi báo cáo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
    <CameraCaptureModal
      isOpen={cameraOpen}
      onClose={() => setCameraOpen(false)}
      onCapture={(file) => {
        setCameraOpen(false);
        addImages([file]);
      }}
    />
    </>
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
    <Modal isOpen={isOpen} onClose={onClose} title={rest.editLog ? "Sửa Nhật ký công trường" : "Cập nhật Nhật ký công trường"} mobileFullScreen>
      <DailyLogForm {...rest} isPL={isPL} onCancel={onClose} hideHeader={true} />
    </Modal>
  );
};
