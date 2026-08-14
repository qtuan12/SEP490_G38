import { projectService } from '../services/projectService';
import { compressImageFile } from './fileCompression';

export interface UploadedFileState {
  id: string;
  name: string;
  url?: string;
  status: 'uploading' | 'success' | 'error';
  file?: File;
  errorMessage?: string;
}

export const compressAndUploadFile = async (
  file: File,
  folder: string,
  onSuccess: (url: string) => void,
  onError: (message: string) => void
) => {
  try {
    const fileToSend = await compressImageFile(file);
    const urls = await projectService.uploadFiles([fileToSend], folder);
    if (urls && urls.length > 0) {
      onSuccess(urls[0]);
    } else {
      onError('Máy chủ không trả về đường dẫn tệp sau khi tải lên.');
    }
  } catch (err) {
    console.error("Upload error:", err);
    onError(err instanceof Error && err.message
      ? err.message
      : 'Không thể tải tệp lên. Vui lòng thử lại.');
  }
};
