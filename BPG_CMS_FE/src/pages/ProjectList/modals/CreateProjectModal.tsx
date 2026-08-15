import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, Input, FormItem } from '../../../components/ui';
import { projectService } from '../../../services/projectService';
import { UploadCloud, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { compressAndUploadFile } from '../../../utils/uploadHelper';
import type { UploadedFileState } from '../../../utils/uploadHelper';

const schema = z.object({
  name: z.string().min(3, 'Tên dự án phải có ít nhất 3 ký tự'),
  address: z.string().min(5, 'Địa chỉ công trường phải có ít nhất 5 ký tự'),
  startDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến bắt đầu').refine(dateStr => {
    const start = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return start >= today;
  }, { message: 'Ngày bắt đầu không được trong quá khứ' }),
  endDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến kết thúc').refine(dateStr => {
    const end = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end >= today;
  }, { message: 'Ngày kết thúc không được trong quá khứ' }),
  status: z.enum(['draft', 'inprogress', 'paused', 'done']).default('draft'),
  drawingNames: z.array(z.string()).default([])
}).refine(data => {
  if (!data.startDate || !data.endDate) return true;
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: "Ngày kết thúc phải lớn hơn ngày bắt đầu",
  path: ["endDate"]
});

const isPreviewableImage = (fileName: string) =>
  /\.(avif|bmp|gif|heic|heif|jfif|jpe?g|png|tiff?|webp)$/i.test(fileName);

const getProjectAttachmentFileType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (extension === 'dwg' || extension === 'dxf') return 'cad';
  if (extension === 'doc' || extension === 'docx') return 'document';
  return 'image';
};

type FormData = z.infer<typeof schema>;

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [dragging, setDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const todayStr = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, reset, watch } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      status: 'draft',
      drawingNames: []
    }
  });

  const selectedStartDate = watch('startDate');

  const minEndDate = React.useMemo(() => {
    if (selectedStartDate) {
      const start = new Date(selectedStartDate);
      if (!isNaN(start.getTime())) {
        start.setDate(start.getDate() + 1);
        return start.toISOString().split('T')[0];
      }
    }
    return todayStr;
  }, [selectedStartDate, todayStr]);

  React.useEffect(() => {
    return () => {
      uploadedFiles.forEach(p => {
        if (p.url && p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
      });
    };
  }, [uploadedFiles]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const successfulFiles = uploadedFiles
        .filter(f => f.status === 'success' && f.url)
        .map(f => ({ name: f.name, url: f.url! }));
      const successUrls = successfulFiles.map(f => f.url);

      const result = await projectService.createProject({
        name: data.name,
        address: data.address,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
        drawingUrls: successUrls,
        attachments: successfulFiles.map(file => ({
          fileName: file.name,
          fileUrl: file.url,
          fileType: getProjectAttachmentFileType(file.name),
          attachmentType: 'design'
        }))
      });
      return result.__message;
    },
    onSuccess: (message) => {
      onSuccess(message);
      reset();
      setUploadedFiles([]);
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
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      toast.error(`Tổng dung lượng các bản vẽ không được vượt quá 50 MB (đã chọn: ${(totalSize / 1024 / 1024).toFixed(2)} MB).`);
      return;
    }

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
            setValue('drawingNames', successUrls, { shouldValidate: true });
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

  const removeFile = (id: string) => {
    setUploadedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target && target.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      const filtered = prev.filter(f => f.id !== id);
      const successUrls = filtered.filter(f => f.status === 'success' && f.url).map(f => f.url!);
      setValue('drawingNames', successUrls, { shouldValidate: true });
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
        {isAnyFileUploading ? 'Đang tải bản vẽ...' : 'Xác nhận tạo mới'}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Khởi tạo Dự án mới" footer={footer} width="md">
      <form className="flex flex-col gap-4">
        <FormItem label="Tên dự án" required error={errors.name?.message}>
          <Input placeholder="Nhập tên dự án công trình" {...register('name')} error={!!errors.name} />
        </FormItem>

        <FormItem label="Địa chỉ công trường" required error={errors.address?.message}>
          <Input placeholder="Số nhà, Tỉnh thành..." {...register('address')} error={!!errors.address} />
        </FormItem>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormItem label="Ngày dự kiến bắt đầu" required error={errors.startDate?.message}>
            <Input type="date" min={todayStr} lang="en-GB" {...register('startDate')} error={!!errors.startDate} />
          </FormItem>
          <FormItem label="Ngày dự kiến kết thúc" required error={errors.endDate?.message}>
            <Input type="date" min={minEndDate} lang="en-GB" {...register('endDate')} error={!!errors.endDate} />
          </FormItem>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
          <p className="text-sm text-gray-600 m-0 flex items-center gap-2">
            <span className="text-blue-600"></span> Dự án mới sẽ được lưu ở trạng thái Bản nháp. Sau khi tạo, hãy vào trang chi tiết dự án để thêm thành viên và Kích hoạt thi công.
          </p>
        </div>

        <FormItem label="Bản vẽ thiết kế tổng thể" error={errors.drawingNames?.message}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 dashed rounded-md p-6 text-center cursor-pointer transition-all ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
            onClick={() => document.getElementById('drawing-file-input')?.click()}
          >
            <input
              id="drawing-file-input"
              type="file"
              accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <UploadCloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />

            {uploadedFiles && uploadedFiles.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4" onClick={(e) => e.stopPropagation()}>
                {uploadedFiles.map((preview) => (
                  <div key={preview.id} className="flex flex-col items-center gap-1 group relative">
                    <div className={`relative w-16 h-16 rounded overflow-hidden shadow-sm border ${preview.status === 'error' ? 'border-red-500' : preview.status === 'success' ? 'border-green-500' : 'border-gray-200'}`}>
                      {preview.url && isPreviewableImage(preview.name) ? (
                        <img
                          src={preview.url}
                          alt={preview.name}
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
                      {preview.name}
                    </span>
                    
                    <button
                      type="button"
                      onClick={() => removeFile(preview.id)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 border-none outline-none"
                      style={{ cursor: 'pointer' }}
                      title="Xóa file"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Kéo thả file vào đây hoặc click để duyệt file
                </p>
                <span className="text-xs text-gray-500">
                  Hỗ trợ PDF, PNG, JPG tối đa 20MB
                </span>
              </div>
            )}
          </div>
        </FormItem>

        {mutation.isError && (
          <p className="text-sm text-red-600 mt-2">
            Có lỗi xảy ra khi tạo dự án. Vui lòng thử lại.
          </p>
        )}
      </form>
    </Modal>
  );
};
