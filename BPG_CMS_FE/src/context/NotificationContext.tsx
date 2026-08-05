import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { toast } from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notificationService';
import type { Notification } from '../types/notification';
import { useQueryClient } from '@tanstack/react-query';
import {
  REALTIME_DATA_CHANGED_AGGREGATION_MS,
  REALTIME_DATA_CHANGED_EVENT,
  RealtimeQueryEntities,
  type RealtimeDataChangedPayload,
} from '../constants/realtimeEntities';

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
  const queryClient = useQueryClient();
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [hasEmergencyUnread, setHasEmergencyUnread] = useState(false);

  const connectionRef = useRef<HubConnection | null>(null);
  const pendingChangedEntitiesRef = useRef(new Set<string>());
  const pendingChangedAtRef = useRef<string | undefined>(undefined);
  const pendingRefreshAllRef = useRef(false);
  const dataChangedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDataChanges = useCallback(() => {
    dataChangedTimerRef.current = null;

    const refreshAll = pendingRefreshAllRef.current;
    const payload: RealtimeDataChangedPayload = {
      entities: refreshAll
        ? []
        : Array.from(pendingChangedEntitiesRef.current).sort(),
      changedAt: pendingChangedAtRef.current ?? new Date().toISOString(),
      refreshAll,
    };

    pendingChangedEntitiesRef.current.clear();
    pendingChangedAtRef.current = undefined;
    pendingRefreshAllRef.current = false;

    const changedEntitySet = new Set(payload.entities ?? []);
    void queryClient.invalidateQueries({
      refetchType: 'active',
      predicate: query => {
        if (refreshAll) return true;
        const queryPrefix = String(query.queryKey[0] ?? '');
        const watchedEntities = RealtimeQueryEntities[queryPrefix];
        // Query chưa được khai báo vẫn refresh để không bỏ sót màn hình nghiệp vụ mới.
        return !watchedEntities
          || watchedEntities.some(entity => changedEntitySet.has(entity));
      },
    });
    window.dispatchEvent(new CustomEvent(REALTIME_DATA_CHANGED_EVENT, { detail: payload }));
  }, [queryClient]);

  const scheduleDataRefresh = useCallback((
    payload?: RealtimeDataChangedPayload,
    forceRefreshAll = false,
  ) => {
    const entities = payload?.entities?.filter(
      (entity): entity is string => typeof entity === 'string' && entity.length > 0,
    );

    if (forceRefreshAll || payload?.refreshAll === true || !entities?.length) {
      pendingRefreshAllRef.current = true;
      pendingChangedEntitiesRef.current.clear();
    } else if (!pendingRefreshAllRef.current) {
      entities.forEach(entity => pendingChangedEntitiesRef.current.add(entity));
    }

    const changedAt = payload?.changedAt;
    if (changedAt && (!pendingChangedAtRef.current || changedAt > pendingChangedAtRef.current)) {
      pendingChangedAtRef.current = changedAt;
    }

    // Cửa sổ gom cố định giúp nhiều sự kiện liên tiếp chỉ gây một lần tải lại,
    // đồng thời không bị trì hoãn vô hạn khi hệ thống liên tục có thay đổi.
    if (dataChangedTimerRef.current === null) {
      dataChangedTimerRef.current = setTimeout(
        flushDataChanges,
        REALTIME_DATA_CHANGED_AGGREGATION_MS,
      );
    }
  }, [flushDataChanges]);
  
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
      const result = await notificationService.markAsRead(undefined, true);
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      setHasEmergencyUnread(false);
      console.log(result.message || 'Đã đánh dấu đọc tất cả thông báo.');
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
        void connectionRef.current.stop().catch(error => {
          console.error('Không thể ngắt kết nối SignalR:', error);
        });
        connectionRef.current = null;
      }
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'https://localhost:7111/api';
    const hubUrl = apiUrl.replace(/\/api$/, '') + '/hubs/notifications';

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => localStorage.getItem('bpg_token') || '',
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    let disposed = false;

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

    connection.on('DataChanged', (payload: RealtimeDataChangedPayload) => {
      scheduleDataRefresh(payload);
    });

    connection.onreconnected(() => {
      scheduleDataRefresh({
        changedAt: new Date().toISOString(),
        refreshAll: true,
      }, true);
      fetchNotifications(1, 20);
    });

    connection
      .start()
      .then(() => {
        if (disposed) {
          void connection.stop().catch(error => {
            console.error('Không thể ngắt kết nối SignalR đã hủy:', error);
          });
          return;
        }
        console.log('Đã kết nối SignalR Notification Hub thành công.');
        connectionRef.current = connection;
        setConnection(connection);
      })
      .catch((err: any) => {
        if (!disposed) console.error('Lỗi kết nối SignalR Hub:', err);
      });

    return () => {
      disposed = true;
      if (dataChangedTimerRef.current !== null) {
        clearTimeout(dataChangedTimerRef.current);
        dataChangedTimerRef.current = null;
      }
      pendingChangedEntitiesRef.current.clear();
      pendingChangedAtRef.current = undefined;
      pendingRefreshAllRef.current = false;

      void connection.stop()
        .then(() => console.log('Đã ngắt kết nối SignalR Hub.'))
        .catch(error => console.error('Không thể ngắt kết nối SignalR Hub:', error))
        .finally(() => {
          if (connectionRef.current === connection) {
            connectionRef.current = null;
            setConnection(current => current === connection ? null : current);
          }
        });
    };
  }, [isAuthenticated, token, fetchNotifications, scheduleDataRefresh]);

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
