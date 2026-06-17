import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, Input, FormItem } from '../../../components/ui';
import { projectService } from '../../../services/projectService';
import { apiClient } from '../../../services/api';
import type { Project } from '../../../types/common';
import { UploadCloud, FileText } from 'lucide-react';

const schema = z.object({
  name: z.string().min(3, 'Tên dự án phải có ít nhất 3 ký tự'),
  address: z.string().min(5, 'Địa chỉ công trường phải có ít nhất 5 ký tự'),
  startDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến bắt đầu'),
  endDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến kết thúc'),
  drawingNames: z.array(z.string()).max(5, 'Chỉ được chọn tối đa 5 file').default([])
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
  const [filePreviews, setFilePreviews] = useState<{file?: File, url: string, name: string}[]>([]);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { drawingNames: [] }
  });

  useEffect(() => {
    if (project && isOpen) {
      reset({
        name: project.name,
        address: project.address,
        startDate: project.startDate,
        endDate: project.endDate,
        drawingNames: project.drawingUrls || (project.drawingUrl ? [project.drawingUrl] : [])
      });

      // Show existing files
      if (project.attachments && project.attachments.length > 0) {
        setFilePreviews(project.attachments.map(a => ({ url: a.fileUrl, name: a.fileName })));
      } else if (project.drawingUrls && project.drawingUrls.length > 0) {
        setFilePreviews(project.drawingUrls.map(u => ({ url: u, name: u })));
      } else if (project.drawingUrl) {
        setFilePreviews([{ url: project.drawingUrl, name: project.drawingUrl }]);
      } else {
        setFilePreviews([]);
      }
    }
  }, [project, isOpen, reset]);

  useEffect(() => {
    return () => {
      filePreviews.forEach(p => {
        if (p.file && p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
      });
    };
  }, [filePreviews]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!project) return;
      
      let attachments: any[] = [];
      let drawingUrls: string[] = data.drawingNames;

      // Filter out files that are newly added (have p.file)
      const newFiles = filePreviews.filter(p => p.file);
      const existingPreviews = filePreviews.filter(p => !p.file);

      // We need to keep old attachments that were not removed
      // If we are replacing all, we should just upload new ones.
      // But user can remove existing and add new.
      // For simplicity, we just take the current filePreviews list.

      if (newFiles.length > 0) {
        const formData = new globalThis.FormData();
        newFiles.forEach(p => {
          formData.append('files', p.file as File);
        });
        formData.append('folder', 'projects/design');
        
        try {
          const uploadRes = await apiClient.postFormData<any>('/files/upload-multiple', formData);
          if (uploadRes.success && uploadRes.data) {
            attachments = uploadRes.data;
          }
        } catch (error) {
          console.error("Lỗi upload file:", error);
          throw new Error("Lỗi upload file thiết kế");
        }
      }

      // Combine existing and new attachments
      const finalAttachments = [
        ...(project.attachments?.filter(a => existingPreviews.some(ep => ep.url === a.fileUrl)) || []),
        ...attachments
      ];

      drawingUrls = finalAttachments.map(a => a.fileUrl);

      await projectService.updateProject(project.id, {
        name: data.name,
        address: data.address,
        startDate: data.startDate,
        endDate: data.endDate,
        drawingUrls: drawingUrls,
        attachments: finalAttachments
      });
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    }
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
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
      const files = Array.from(e.dataTransfer.files).slice(0, 5);
      const previews = files.map(f => ({
          file: f,
          url: f.type.startsWith('image/') ? URL.createObjectURL(f) : f.name,
          name: f.name
      }));
      setFilePreviews(previews);
      setValue('drawingNames', files.map(f => f.name), { shouldValidate: true });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).slice(0, 5);
      const previews = files.map(f => ({
          file: f,
          url: f.type.startsWith('image/') ? URL.createObjectURL(f) : f.name,
          name: f.name
      }));
      setFilePreviews(previews);
      setValue('drawingNames', files.map(f => f.name), { shouldValidate: true });
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="mr-3">
        Hủy bỏ
      </Button>
      <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={isSubmitting}>
        Cập nhật
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sửa thông tin Dự án" footer={footer} width="md">
      <form className="flex flex-col gap-4">
        <FormItem label="Tên dự án" required error={errors.name?.message}>
          <Input placeholder="Nhập tên dự án công trình" {...register('name')} error={!!errors.name} />
        </FormItem>

        <FormItem label="Địa chỉ công trường" required error={errors.address?.message}>
          <Input placeholder="Số nhà, Tỉnh thành..." {...register('address')} error={!!errors.address} />
        </FormItem>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormItem label="Ngày dự kiến bắt đầu" required error={errors.startDate?.message}>
            <Input type="date" {...register('startDate')} error={!!errors.startDate} />
          </FormItem>
          <FormItem label="Ngày dự kiến kết thúc" required error={errors.endDate?.message}>
            <Input type="date" {...register('endDate')} error={!!errors.endDate} />
          </FormItem>
        </div>
        
        <FormItem label="Bản vẽ thiết kế tổng thể (Tối đa 5 file, sẽ ghi đè file cũ)" error={errors.drawingNames?.message}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 dashed rounded-md p-6 text-center cursor-pointer transition-all ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
            onClick={() => document.getElementById('edit-drawing-file-input')?.click()}
          >
            <input
              id="edit-drawing-file-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <UploadCloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            
            {filePreviews && filePreviews.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4" onClick={(e) => e.stopPropagation()}>
                {filePreviews.map((preview, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1 group relative">
                    {preview.url && (preview.url.startsWith('blob:') || preview.url.startsWith('http')) ? (
                      <img 
                        src={preview.url} 
                        alt={preview.name} 
                        className="w-16 h-16 object-cover rounded shadow-sm border border-gray-200" 
                      />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded shadow-sm border border-gray-200">
                         <FileText className="h-8 w-8 text-blue-500" />
                      </div>
                    )}
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
                  Hỗ trợ PDF, PNG, JPG tối đa 20MB (tối đa 5 file)
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

