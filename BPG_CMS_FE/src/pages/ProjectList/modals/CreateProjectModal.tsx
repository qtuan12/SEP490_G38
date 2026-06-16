import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, Input, FormItem } from '../../../components/ui';
import { projectService } from '../../../services/projectService';
import { UploadCloud, FileText } from 'lucide-react';

const schema = z.object({
  name: z.string().min(3, 'Tên dự án phải có ít nhất 3 ký tự'),
  address: z.string().min(5, 'Địa chỉ công trường phải có ít nhất 5 ký tự'),
  startDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến bắt đầu'),
  endDate: z.string().min(1, 'Vui lòng chọn ngày dự kiến kết thúc'),
  status: z.enum(['draft', 'active', 'paused', 'done']).default('draft'),
  drawingNames: z.array(z.string()).max(5, 'Chỉ được chọn tối đa 5 file').default([])
});

type FormData = z.infer<typeof schema>;

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [dragging, setDragging] = useState(false);
  const [filePreviews, setFilePreviews] = useState<{file: File, url: string | null}[]>([]);
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      status: 'draft',
      drawingNames: []
    }
  });

  React.useEffect(() => {
    return () => {
      filePreviews.forEach(p => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
    };
  }, [filePreviews]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      await projectService.createProject({
        name: data.name,
        address: data.address,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
        drawingUrls: data.drawingNames
      });
    },
    onSuccess: () => {
      onSuccess();
      reset();
      setFilePreviews([]);
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
          url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null
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
          url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null
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
        Xác nhận tạo mới
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
            <Input type="date" {...register('startDate')} error={!!errors.startDate} />
          </FormItem>
          <FormItem label="Ngày dự kiến kết thúc" required error={errors.endDate?.message}>
            <Input type="date" {...register('endDate')} error={!!errors.endDate} />
          </FormItem>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
          <p className="text-sm text-gray-600 m-0 flex items-center gap-2">
            <span className="text-blue-600">ℹ️</span> Dự án mới sẽ được lưu ở trạng thái <strong>Bản nháp (Draft)</strong>. Sau khi tạo, hãy vào trang chi tiết dự án (WBS) để thêm thành viên và Kích hoạt thi công.
          </p>
        </div>

        <FormItem label="Bản vẽ thiết kế tổng thể (Tối đa 5 file)" error={errors.drawingNames?.message}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 dashed rounded-md p-6 text-center cursor-pointer transition-all ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
            onClick={() => document.getElementById('drawing-file-input')?.click()}
          >
            <input
              id="drawing-file-input"
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
                    {preview.url ? (
                      <img 
                        src={preview.url} 
                        alt={preview.file.name} 
                        className="w-16 h-16 object-cover rounded shadow-sm border border-gray-200" 
                      />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded shadow-sm border border-gray-200">
                         <FileText className="h-8 w-8 text-blue-500" />
                      </div>
                    )}
                    <span className="text-xs text-gray-600 truncate w-20 text-center" title={preview.file.name}>
                      {preview.file.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Kéo thả file vào đây hoặc click để duyệt file
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
            Có lỗi xảy ra khi tạo dự án. Vui lòng thử lại.
          </p>
        )}
      </form>
    </Modal>
  );
};
