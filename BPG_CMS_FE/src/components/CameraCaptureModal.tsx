import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, RotateCcw } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

/**
 * Chụp ảnh ngay trong trang bằng getUserMedia, không mở app Camera hệ thống ra ngoài.
 * Cần thiết vì trên Android, khi PWA chạy standalone, mở input[capture] ra camera hệ thống
 * có thể không trả người dùng về đúng cửa sổ PWA — mất luôn trạng thái app và ảnh vừa chụp.
 */
export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setError(null);
    setReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        window.isSecureContext
          ? 'Trình duyệt không hỗ trợ mở camera trong ứng dụng.'
          : 'Trang đang chạy qua HTTP nên trình duyệt chặn camera. Hãy truy cập bằng HTTPS (hoặc localhost).'
      );
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // iOS/Safari không phải lúc nào cũng tự chạy dù có autoPlay — gọi play() cho chắc.
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError('Bạn đã từ chối quyền camera. Vào cài đặt trình duyệt/ứng dụng để cấp lại quyền Camera cho trang này.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setError('Không tìm thấy camera phù hợp trên thiết bị.');
        } else if (name === 'NotReadableError') {
          setError('Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.');
        } else {
          setError('Không thể mở camera. Vui lòng kiểm tra quyền truy cập camera cho trình duyệt.');
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
    }, 'image/jpeg', 0.9);
  };

  return createPortal(
    // z-index phải cao hơn Modal (zIndex 1000) — CameraCaptureModal thường được mở từ trong
    // một Modal, nếu thấp hơn thì camera bật nhưng bị lớp overlay của Modal che hoàn toàn.
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 2000 }}>
      <div
        className="flex items-center justify-between px-4 pt-3 pb-2 text-white shrink-0"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <span className="text-sm font-semibold">Chụp ảnh hiện trường</span>
        <button onClick={onClose} className="p-1.5 rounded-full bg-white/10">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-center text-white px-6 flex flex-col items-center gap-3">
            <p className="text-sm">{error}</p>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 text-sm font-medium flex items-center gap-1.5">
              <RotateCcw size={14} />
              Đóng
            </button>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        )}
      </div>

      {!error && (
        <div
          className="flex items-center justify-center py-6 shrink-0"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleCapture}
            disabled={!ready}
            className="w-16 h-16 rounded-full bg-white border-4 border-white/40 disabled:opacity-40 flex items-center justify-center active:scale-95 transition-transform"
            title="Chụp ảnh"
          >
            <Camera size={26} className="text-black" />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};
