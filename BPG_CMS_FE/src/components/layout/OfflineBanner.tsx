import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-[hsl(var(--danger))] text-white text-xs font-medium py-1.5 px-3 sticky top-0 z-40">
      <WifiOff size={13} />
      <span>Mất kết nối mạng — một số thao tác có thể không thực hiện được.</span>
    </div>
  );
};
