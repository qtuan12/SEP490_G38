import imageCompression from 'browser-image-compression';

const IMAGE_COMPRESSION_THRESHOLD_BYTES = 1024 * 1024;

const COMPRESSIBLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/bmp',
]);

export const isCompressibleImage = (file: File) =>
  COMPRESSIBLE_IMAGE_TYPES.has(file.type.toLowerCase()) &&
  file.size >= IMAGE_COMPRESSION_THRESHOLD_BYTES;

export const compressImageFile = async (file: File): Promise<File> => {
  if (!isCompressibleImage(file)) {
    return file;
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      preserveExif: false,
    });

    return compressed.size < file.size ? compressed : file;
  } catch (error) {
    console.warn('Không thể nén ảnh, dùng file gốc:', error);
    return file;
  }
};

export const compressFormDataImages = async (formData: FormData): Promise<FormData> => {
  const compressedFormData = new FormData();

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const compressedFile = await compressImageFile(value);
      compressedFormData.append(key, compressedFile, compressedFile.name || value.name);
    } else {
      compressedFormData.append(key, value);
    }
  }

  return compressedFormData;
};
