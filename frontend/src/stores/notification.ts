import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io, Socket } from 'socket.io-client';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERTA';
  read: boolean;
  createdAt: string;
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<AppNotification[]>([]);
  const socket = ref<Socket | null>(null);

  const unreadCount = computed(() => {
    if (!Array.isArray(notifications.value)) return 0;
    return notifications.value.filter(n => !n.read).length;
  });

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (Array.isArray(data)) {
        notifications.value = data;
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const connectSocket = () => {
    if (socket.value) return;

    socket.value = io();

    socket.value.on('notification_received', (notification: AppNotification) => {
      // Avoid duplicates if already fetched
      if (!notifications.value.find(n => n.id === notification.id)) {
        notifications.value.unshift(notification);
        playNotificationSound();
      }
    });
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      const index = notifications.value.findIndex(n => n.id === id);
      if (index !== -1) notifications.value[index].read = true;
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      notifications.value.forEach(n => n.read = true);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    connectSocket,
    markAsRead,
    markAllAsRead,
  };
});
