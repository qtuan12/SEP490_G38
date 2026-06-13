import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notificationService';
import type { Notification } from '../types/notification';
import toast from 'react-hot-toast';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (page?: number, size?: number) => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const connectionRef = useRef<HubConnection | null>(null);

  // Lấy danh sách thông báo
  const fetchNotifications = useCallback(async (page: number = 1, size: number = 10) => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const result = await notificationService.getNotifications(page, size);
      
      if (page === 1) {
        setNotifications(result.items);
      } else {
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.notificationId));
          const newItems = result.items.filter(n => !existingIds.has(n.notificationId));
          return [...prev, ...newItems];
        });
      }

      setUnreadCount(result.items.filter(n => !n.isRead).length);
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
      setNotifications(prev =>
        prev.map(n => (n.notificationId === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
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

      toast(() => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{noti.title}</strong>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{noti.content}</span>
        </div>
      ), {
        icon: '🔔',
        duration: 6000,
        style: {
          background: 'rgba(15, 23, 42, 0.9)',
          color: '#f8fafc',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
        }
      });
    });

    connection
      .start()
      .then(() => {
        console.log('Đã kết nối SignalR Notification Hub thành công.');
        connectionRef.current = connection;
      })
      .catch(err => {
        console.error('Lỗi kết nối SignalR Hub:', err);
      });

    return () => {
      connection.stop().then(() => {
        console.log('Đã ngắt kết nối SignalR Hub.');
      });
    };
  }, [isAuthenticated, token]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
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
