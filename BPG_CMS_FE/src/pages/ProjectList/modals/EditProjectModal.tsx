import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, Input, FormItem } from '../../../components/ui';
import { projectService } from '../../../services/projectService';
import type { Project } from '../../../types/common';
import { UploadCloud, FileText, X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LazyImage } from '../../../utils/imageOptimizer';
import { compressAndUploadFile } from '../../../utils/uploadHelper';
import type { UploadedFileState } from '../../../utils/uploadHelper';

const schema = z.object({
  name: z.string().min(3, 'Tên dự án phải có ít nhất 3 ký tự'),
  address: z.string().min(5, 'Địa chỉ công trường phải có ít nhất 5 ký tự'),
  startDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến bắt đầu'),
  endDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến kết thúc'),
  drawingNames: z.array(z.string()).default([])
});

type FormData = z.infer<typeof schema>;

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: Project | null;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, onClose, onSuccess, project }) => {
  const [dragging, setDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [hasFileChanges, setHasFileChanges] = useState(false);
  const initializedProjectIdRef = useRef<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset, setValue } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { drawingNames: [] }
  });

  const isDraft = !project || project.status === 'draft';

  useEffect(() => {
    if (!isOpen || !project) {
      if (!isOpen) initializedProjectIdRef.current = null;
      return;
    }

    const projectChanged = initializedProjectIdRef.current !== project.id;
    if (!projectChanged && (isDirty || hasFileChanges)) return;

    if (project && isOpen) {
      reset({
        name: project.name,
        address: project.address,
        startDate: project.startDate,
        endDate: project.endDate,
        drawingNames: project.drawingUrls || (project.drawingUrl ? [project.drawingUrl] : [])
      });

      // Show existing files mapped to UploadedFileState
      if (project.attachments && project.attachments.length > 0) {
        setUploadedFiles(project.attachments.map(a => ({
          id: a.fileUrl,
          name: a.fileName,
          url: a.fileUrl,
          status: 'success'
        })));
      } else if (project.drawingUrls && project.drawingUrls.length > 0) {
        setUploadedFiles(project.drawingUrls.map(u => ({
          id: u,
          name: u.substring(u.lastIndexOf('/') + 1) || u,
          url: u,
          status: 'success'
        })));
      } else if (project.drawingUrl) {
        setUploadedFiles([{
          id: project.drawingUrl,
          name: project.drawingUrl.substring(project.drawingUrl.lastIndexOf('/') + 1) || project.drawingUrl,
          url: project.drawingUrl,
          status: 'success'
        }]);
      } else {
        setUploadedFiles([]);
      }
      setHasFileChanges(false);
      initializedProjectIdRef.current = project.id;
    }
  }, [project, isOpen, reset, isDirty, hasFileChanges]);

  useEffect(() => {
    return () => {
      uploadedFiles.forEach(p => {
        if (p.url && p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
      });
    };
  }, [uploadedFiles]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!project) return;
      
      const finalAttachments = uploadedFiles
        .filter(f => f.status === 'success' && f.url)
        .map(f => {
          const existing = project.attachments?.find(a => a.fileUrl === f.url);
          if (existing) return existing;
          return {
            fileName: f.name,
            fileUrl: f.url!,
            fileType: f.url!.endsWith('.pdf') ? 'pdf' : 'image',
            attachmentType: 'design'
          };
        });

      const drawingUrls = finalAttachments.map(a => a.fileUrl);

      await projectService.updateProject(project.id, {
        name: data.name || project.name,
        address: data.address || project.address,
        startDate: data.startDate || project.startDate,
        endDate: data.endDate || project.endDate,
        drawingUrls: drawingUrls,
        attachments: finalAttachments
      });
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  const onSubmit = async (data: FormData) => {
    if (uploadedFiles.some(f => f.status === 'uploading')) {
      toast.error('Vui lòng chờ bản vẽ thiết kế tải lên hoàn tất.');
      return;
    }
    if (uploadedFiles.some(f => f.status === 'error') || uploadedFiles.some(f => !f.url || !f.url.startsWith('http'))) {
      toast.error('Không thể tải ảnh/file lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.');
      return;
    }
    await mutation.mutateAsync(data);
  };

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
      const files = Array.from(e.dataTransfer.files);
      addFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
    // reset input so the same file can be selected again if removed
    e.target.value = '';
  };

  const addFiles = (files: File[]) => {
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 20 * 1024 * 1024) {
      toast.error('Tổng dung lượng các file không được vượt quá 20MB.');
      return;
    }

    setHasFileChanges(true);
    files.forEach(file => {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

      const newFileState: UploadedFileState = {
        id: tempId,
        name: file.name,
        url: localUrl || undefined,
        status: 'uploading'
      };

      setUploadedFiles(prev => [...prev, newFileState]);

      compressAndUploadFile(
        file,
        'projects/design',
        (uploadedUrl) => {
          setUploadedFiles(prev => {
            const updated = prev.map(f => f.id === tempId ? { ...f, status: 'success' as const, url: uploadedUrl } : f);
            const successUrls = updated.filter(f => f.status === 'success' && f.url).map(f => f.url!);
            setValue('drawingNames', successUrls, { shouldValidate: true, shouldDirty: true });
            return updated;
          });
        },
        (message) => {
          toast.error(message || `Không thể tải file ${file.name} lên.`);
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'error' as const } : f)
          );
        }
      );
    });
  };

  const handleRemoveFile = (e: React.MouseEvent, idToRemove: string) => {
    e.stopPropagation();
    setHasFileChanges(true);
    setUploadedFiles(prev => {
      const target = prev.find(f => f.id === idToRemove);
      if (target && target.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      const filtered = prev.filter(f => f.id !== idToRemove);
      const successUrls = filtered.filter(f => f.status === 'success' && f.url).map(f => f.url!);
      setValue('drawingNames', successUrls, { shouldValidate: true, shouldDirty: true });
      return filtered;
    });
  };

  const isAnyFileUploading = uploadedFiles.some(f => f.status === 'uploading');

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="mr-3">
        Hủy bỏ
      </Button>
      <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting} disabled={isAnyFileUploading}>
        {isAnyFileUploading ? 'Đang tải bản vẽ...' : 'Cập nhật'}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sửa thông tin Dự án" footer={footer} width="md">
      <form className="flex flex-col gap-4">
        <FormItem label="Tên dự án" required error={errors.name?.message}>
          <Input placeholder="Nhập tên dự án công trình" {...register('name')} error={!!errors.name} disabled={!isDraft} />
        </FormItem>

        <FormItem label="Địa chỉ công trường" required error={errors.address?.message}>
          <Input placeholder="Số nhà, Tỉnh thành..." {...register('address')} error={!!errors.address} disabled={!isDraft} />
        </FormItem>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormItem label="Ngày dự kiến bắt đầu" required error={errors.startDate?.message}>
            <Input type="date" {...register('startDate')} error={!!errors.startDate} disabled={!isDraft} />
          </FormItem>
          <FormItem label="Ngày dự kiến kết thúc" required error={errors.endDate?.message}>
            <Input type="date" {...register('endDate')} error={!!errors.endDate} disabled={!isDraft} />
          </FormItem>
        </div>
        
        <FormItem label="Bản vẽ thiết kế tổng thể" error={errors.drawingNames?.message}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 dashed rounded-md p-6 text-center cursor-pointer transition-all ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
            onClick={() => {
              document.getElementById('edit-drawing-file-input')?.click();
            }}
          >
            <input
              id="edit-drawing-file-input"
              type="file"
              accept=".doc,.docx,.pdf,.png,.jpg,.jpeg"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <UploadCloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            
            {uploadedFiles && uploadedFiles.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4" onClick={(e) => e.stopPropagation()}>
                {uploadedFiles.map((preview) => (
                  <div key={preview.id} className="flex flex-col items-center gap-1 group relative">
                    <button
                      type="button"
                      onClick={(e) => handleRemoveFile(e, preview.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 border-none outline-none cursor-pointer"
                      title="Xóa bản vẽ"
                    >
                      <X size={12} />
                    </button>
                    
                    <div className={`relative w-16 h-16 rounded overflow-hidden shadow-sm border ${preview.status === 'error' ? 'border-red-500' : preview.status === 'success' ? 'border-green-500' : 'border-gray-200'}`}>
                      {preview.url && (preview.url.startsWith('blob:') || !preview.url.endsWith('.pdf')) ? (
                        <LazyImage 
                          src={preview.url} 
                          alt={preview.name} 
                          widthOption={200}
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                          <FileText className="h-8 w-8 text-blue-500" />
                        </div>
                      )}
                      
                      {preview.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 size={16} className="animate-spin text-white" />
                        </div>
                      )}

                      {preview.status === 'error' && (
                        <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[8px] text-center py-0.5 font-bold">Lỗi</span>
                      )}

                      {preview.status === 'success' && (
                        <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-[8px] text-center py-0.5 font-bold">OK</span>
                      )}
                    </div>
                    
                    <span className="text-xs text-gray-600 truncate w-20 text-center" title={preview.name}>
                      {preview.name.split('/').pop()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Kéo thả file vào đây hoặc click để duyệt file mới
                </p>
                <span className="text-xs text-gray-500">
                  Hỗ trợ PDF, PNG, JPG tối đa 20MB
                </span>
              </div>
            )}
            {uploadedFiles.length > 0 && uploadedFiles.length < 5 && (
              <div className="mt-4 text-xs text-blue-600 font-semibold" onClick={(e) => e.stopPropagation()}>
                <span className="cursor-pointer hover:underline" onClick={() => document.getElementById('edit-drawing-file-input')?.click()}>
                  + Thêm bản vẽ khác ({uploadedFiles.length}/5)
                </span>
              </div>
            )}
          </div>
        </FormItem>

        {mutation.isError && (
          <p className="text-sm text-red-600 mt-2">
            Có lỗi xảy ra khi sửa dự án. {mutation.error?.message}
          </p>
        )}
      </form>
    </Modal>
  );
};


