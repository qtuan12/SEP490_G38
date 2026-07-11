import { useEffect, useRef } from 'react';
import { useNotification } from '../context/NotificationContext';

/**
 * Đăng ký lắng nghe 1 event từ SignalR Hub.
 * Dùng useRef để tránh re-subscribe khi callback thay đổi reference.
 */
export function useSignalREvent<T = any>(eventName: string, callback: (data: T) => void) {
  const { connection } = useNotification();
  const callbackRef = useRef(callback);

  // Cập nhật ref mỗi khi callback thay đổi, không cần re-subscribe
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!connection) return;

    const handler = (data: T) => callbackRef.current(data);

    connection.on(eventName, handler);

    return () => {
      connection.off(eventName, handler);
    };
  }, [connection, eventName]);
}
