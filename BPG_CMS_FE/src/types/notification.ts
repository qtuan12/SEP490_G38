export interface Notification {
  notificationId: number;
  userId: number;
  title: string;
  content: string;
  notificationType: string;
  referenceType?: string;
  referenceId?: number;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}
