import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { UploadCloud, X, AlertCircle, Loader2 } from 'lucide-react';
import {projectService} from '../../../../src/services/projectService';
import type {WBSTask} from '../../../types/common';
import { Modal } from '../../../../src/components/ui/Modal';
import { useAuth } from '../../../../src/context/AuthContext';

const dailyLogSchema = z.object({
  progress: z.number().min(0).max(100),
  content: z.string().min(1, 'Vui lòng nhập chi tiết diễn biến thi công.')
});

type DailyLogForm = z.infer<typeof dailyLogSchema>;

interface DailyLogFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: WBSTask;
  engineerId: string;
  engineerName: string;
  onSuccess: (message: string) => void;
  onError?: (message: string) => void;
}

export const DailyLogFormModal: React.FC<DailyLogFormModalProps> = ({
  isOpen,
  onClose,
  task,
  engineerId,
  engineerName,
  onSuccess
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [images, setImages] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<DailyLogForm>({
    resolver: zodResolver(dailyLogSchema),
    defaultValues: {
      progress: task.progress,
      content: ''
    }
  });

  const progress = watch('progress');

  useEffect(() => {
    if (isOpen) {
      reset({
        progress: task.progress,
        content: ''
      });
      setImages([]);
    }
  }, [isOpen, task, reset]);

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
    const validFiles = files.filter(f => f.type.startsWith('image/')).slice(0, 5 - images.length);
    if (validFiles.length === 0) return;

    const urls = validFiles.map(file => URL.createObjectURL(file));
    setImages(prev => [...prev, ...urls].slice(0, 5));
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: async (data: DailyLogForm) => {
      const finalImages = images.length > 0 ? images : [
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80'
      ];

      return projectService.createDailyLog({
        projectId: task.projectId,
        taskId: task.id,
        taskName: task.name,
        engineerId,
        engineerName,
        progressFrom: task.progress,
        progressTo: data.progress,
        content: data.content,
        weather: '',
        images: finalImages
      }, engineerName, user?.role, undefined);
    },
    onSuccess: () => {
      const msg = `Đã báo cáo nhật ký thi công cho việc "${task.name}" thành công!`;
      toast.success(msg);
      onSuccess(msg);
      queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Lỗi khi gửi nhật ký thi công.');
    }
  });

  const onSubmit = (data: DailyLogForm) => {
    mutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cập nhật Nhật ký công trường">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        
        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 p-3 rounded-md border border-blue-100 text-sm">
          <AlertCircle size={18} />
          <span>Báo cáo cho việc: <strong>{task.name}</strong></span>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-slate-700">Tiến độ hoàn thành (%)</label>
            <strong className="text-blue-600 text-lg">{progress}%</strong>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {task.progress}% (Hiện tại)
            </span>
            <input
              type="range"
              min={task.progress}
              max={100}
              {...register('progress', { valueAsNumber: true })}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              disabled={task.progress === 100}
            />
            <span className="text-xs text-slate-500 whitespace-nowrap">100%</span>
          </div>
          <span className="text-xs text-slate-500 block mt-1.5">
            * Khóa cứng chiều lùi: Bạn chỉ có thể kéo tiến độ tiến lên hoặc giữ nguyên. Mọi sự cố phải được báo cáo qua thẻ "Sự cố" riêng biệt.
          </span>
          {errors.progress && <p className="text-red-500 text-xs mt-1">{errors.progress.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">
            Diễn biến công việc chi tiết <span className="text-red-500">*</span>
          </label>
          <textarea
            placeholder="Mô tả công việc đã làm được hôm nay, số lượng nhân công huy động, các khó khăn gặp phải nếu có..."
            {...register('content')}
            rows={4}
            className={`w-full text-sm px-3 py-2 rounded-md border ${errors.content ? 'border-red-500' : 'border-slate-200'} bg-white text-slate-900 focus:outline-none focus:border-blue-600`}
          />
          {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-600">Hình ảnh hiện trường thi công (Tối đa 5 ảnh)</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('log-image-input')?.click()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
          >
            <input
              id="log-image-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={images.length >= 5}
            />
            <UploadCloud size={28} className="text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600 mb-0.5">
              Kéo thả hình ảnh vào đây hoặc click để chọn ảnh
            </p>
            <span className="text-xs text-slate-500">
              Đã chọn {images.length}/5 ảnh
            </span>
          </div>

          {images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((imgUrl, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-md overflow-hidden border border-slate-200 group">
                  <img src={imgUrl} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(idx);
                    }}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Gửi báo cáo nhật ký'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
