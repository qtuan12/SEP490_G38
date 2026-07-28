import imageCompression from 'browser-image-compression';
import { projectService } from '../services/projectService';

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
  let fileToSend = file;
  if (file.type.startsWith('image/')) {
    try {
      fileToSend = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true
      });
      console.log(`Compressed image: ${file.name} to ${(fileToSend.size / 1024).toFixed(2)}KB`);
    } catch (err) {
      console.warn("Không thể nén ảnh:", err);
    }
  }
  try {
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
