'use client';
import { create } from 'zustand';

interface Notification { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string; data?: any; }

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  setUnreadCount: (count: number) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setNotifications: (notifications: Notification[]) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications], unreadCount: s.unreadCount + (n.isRead ? 0 : 1) })),
  setUnreadCount: (count) => set({ unreadCount: count }),
  markRead: (id) => set((s) => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n), unreadCount: Math.max(0, s.unreadCount - 1) })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map(n => ({ ...n, isRead: true })), unreadCount: 0 })),
  setNotifications: (notifications) => set({ notifications }),
}));
