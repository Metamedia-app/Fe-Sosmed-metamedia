
export interface GroupedItem {
  user_id: string;
  nama: string;
  reference_id: string;
  at: string;
  _id: string;
}

export interface Notification {
  _id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'repost' | 'share';
  sender: {
    _id: string;
    nama: string;
    avatar_url: string;
  };
  post?: {
    _id: string;
    caption?: string;
    media?: any[];
  } | null;
  comment_id?: string;
  message: string;
  is_read: boolean;
  others_count: number;
  grouped_items?: GroupedItem[];
  createdAt: string;
}

// [OLD API BACKUP]: const BASE_URL = 'https://besosmed-production.up.railway.app/api/v1/notifications';
const BASE_URL = 'https://api.metausosmed.my.id/api/v1/notifications';

export const notificationService = {
  getNotifications: async (token: string, limit = 20, skip = 0): Promise<{ success: boolean; data?: { notifications: Notification[] }; message?: string }> => {
    try {
      const response = await fetch(`${BASE_URL}?limit=${limit}&skip=${skip}`, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { success: false, message: 'Gagal mengambil notifikasi' };
    }
  },

  markAllAsRead: async (token: string): Promise<{ success: boolean; message: string; data?: { unread_count: number } }> => {
    try {
      const response = await fetch(`${BASE_URL}/read`, {
        method: 'PATCH',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error marking all as read:', error);
      return { success: false, message: 'Gagal menandai semua sebagai dibaca' };
    }
  },

  markAsRead: async (token: string, id: string): Promise<{ success: boolean; message: string; data?: { unread_count: number } }> => {
    try {
      const response = await fetch(`${BASE_URL}/${id}/read`, {
        method: 'PATCH',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, message: 'Gagal menandai notifikasi sebagai dibaca' };
    }
  },

  getUnreadCount: async (token: string): Promise<{ success: boolean; data?: { unread_count: number } }> => {
    try {
      const response = await fetch(`${BASE_URL}/unread-count`, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return { success: false };
    }
  },
};
