import React, { useState } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';
import { isIOSDevice, isRunningStandalone } from '../utils/pwaHelpers';

const DISMISS_KEY = 'ios_install_banner_dismissed';

export const IOSInstallBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  if (dismissed || !isIOSDevice() || isRunningStandalone()) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[hsl(var(--primary-glow))] border border-[hsl(var(--primary)/0.3)] text-sm">
      <div className="flex-1 min-w-0 text-[hsl(var(--text-primary))]">
        <p className="font-semibold m-0 mb-0.5">Cài ứng dụng lên màn hình chính</p>
        <p className="text-xs text-[hsl(var(--text-secondary))] m-0 flex items-center gap-1 flex-wrap">
          Bấm <Share size={13} className="inline shrink-0" /> <strong>Chia sẻ</strong> rồi chọn <PlusSquare size={13} className="inline shrink-0" /> <strong>"Thêm vào MH chính"</strong> để mở nhanh như một ứng dụng.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]"
        title="Đóng"
      >
        <X size={16} />
      </button>
    </div>
  );
};
