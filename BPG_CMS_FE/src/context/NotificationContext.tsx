import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { toast } from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notificationService';
import type { Notification } from '../types/notification';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  isLoading: boolean;
  hasEmergencyUnread: boolean;
  fetchNotifications: (page?: number, size?: number) => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  connection: HubConnection | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);



export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [hasEmergencyUnread, setHasEmergencyUnread] = useState(false);

  const connectionRef = useRef<HubConnection | null>(null);
  
  // ... code cũ giữ nguyên (fetchNotifications, markAsRead, markAllAsRead)...


  // Lấy danh sách thông báo
  const fetchNotifications = useCallback(async (page: number = 1, size: number = 10) => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const result = await notificationService.getNotifications(page, size);

      setNotifications(result.items);
      setTotalCount(result.totalCount);
      setUnreadCount(result.items.filter(n => !n.isRead).length);
      // Kiểm tra nếu có thông báo khẩn cấp chưa đọc
      setHasEmergencyUnread(result.items.some(n => !n.isRead && n.notificationType === 'EmergencyStop'));
    } catch (error) {
      console.error('Lỗi khi lấy thông báo:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Đánh dấu 1 thông báo là đã đọc
  const markAsRead = async (notificationId: number) => {
    try {
      await notificationService.markAsRead(notificationId, false);
      setNotifications(prev => {
        const updated = prev.map(n => (n.notificationId === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
        // Cập nhật trạng thái khẩn cấp
        setHasEmergencyUnread(updated.some(n => !n.isRead && n.notificationType === 'EmergencyStop'));
        return updated;
      });
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Lỗi khi đánh dấu đã đọc:', error);
      toast.error('Không thể cập nhật trạng thái thông báo.');
    }
  };

  // Đánh dấu tất cả là đã đọc
  const markAllAsRead = async () => {
    try {
      await notificationService.markAsRead(undefined, true);
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      setHasEmergencyUnread(false);
      toast.success('Đã đánh dấu đọc tất cả thông báo.');
    } catch (error) {
      console.error('Lỗi khi đánh dấu đọc tất cả:', error);
      toast.error('Không thể đánh dấu đọc tất cả.');
    }
  };

  // Tự động lấy danh sách khi đăng nhập
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications(1, 20);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setHasEmergencyUnread(false);
    }
  }, [isAuthenticated, fetchNotifications]);

  // Thiết lập kết nối SignalR Realtime
  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5160/api';
    const hubUrl = apiUrl.replace(/\/api$/, '') + '/hubs/notifications';

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => localStorage.getItem('bpg_token') || '',
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('ReceiveNotification', (noti: Notification) => {
      console.log('Nhận thông báo realtime:', noti);
      setNotifications(prev => [noti, ...prev]);
      setUnreadCount(prev => prev + 1);

      if (noti.notificationType === 'EmergencyStop') {
        // Cập nhật trạng thái khẩn cấp — chuông đỏ nhấp nháy trên header
        setHasEmergencyUnread(true);
      } else {
        toast(noti.title, { duration: 4000 });
      }
    });

    connection
      .start()
      .then(() => {
        console.log('Đã kết nối SignalR Notification Hub thành công.');
        connectionRef.current = connection;
        setConnection(connection);
      })
      .catch((err: any) => {
        console.error('Lỗi kết nối SignalR Hub:', err);
      });

    return () => {
      connection.stop().then(() => {
        console.log('Đã ngắt kết nối SignalR Hub.');
        setConnection(null);
      });
    };
  }, [isAuthenticated, token]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        totalCount,
        isLoading,
        hasEmergencyUnread,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        connection,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
