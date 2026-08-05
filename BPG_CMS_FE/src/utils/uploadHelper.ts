import { projectService } from '../services/projectService';
import { compressImageFile } from './fileCompression';

export interface UploadedFileState {
  id: string;
  name: string;
  url?: string;
  status: 'uploading' | 'success' | 'error';
  file?: File;
}

export const compressAndUploadFile = async (
  file: File,
  folder: string,
  onSuccess: (url: string) => void,
  onError: () => void
) => {
  try {
    const fileToSend = await compressImageFile(file);
    const urls = await projectService.uploadFiles([fileToSend], folder);
    if (urls && urls.length > 0) {
      onSuccess(urls[0]);
    } else {
      onError();
    }
  } catch (err) {
    console.error("Upload error:", err);
    onError();
  }
};
