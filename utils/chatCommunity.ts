// [OLD API BACKUP]: const BASE_URL = 'https://besosmed-production.up.railway.app/api/v1/chat/communities';
const BASE_URL = 'https://api.metausosmed.my.id/api/v1/chat/communities';

export interface Community {
  _id: string;
  name: string;
  description: string;
  avatar_url: string;
  participants?: string[];
  admins: any[];
  creator_id?: {
    _id: string;
    nim: string;
    nama: string;
    avatar_url: string;
  };
  creator?: {
    _id: string;
    nim: string;
    nama: string;
    avatar_url: string;
  };
  members?: {
    _id: string;
    nim: string;
    nama: string;
    avatar_url: string;
  }[];
  member_count?: number;
  type: 'community';
  unread_counts?: Record<string, number>;
  last_message?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMessage {
  _id: string;
  conversation_id: string;
  sender_id: {
    _id: string;
    nim: string;
    nama: string;
    avatar_url: string;
  };
  body: string;
  attachments: any[];
  status: string;
  createdAt: string;
}

export const communityService = {
  // GET /api/v1/chat/communities
  getMyCommunities: async (token: string) => {
    try {
      const response = await fetch(BASE_URL, {
        headers: { 'Authorization': `Bearer ${token}`, 'accept': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching communities:', error);
      return { success: false, message: 'Gagal mengambil daftar komunitas' };
    }
  },

  // GET /api/v1/chat/communities/{id}
  getCommunityDetail: async (token: string, id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/${id}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'accept': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching community detail:', error);
      return { success: false, message: 'Gagal mengambil detail komunitas' };
    }
  },

  // GET /api/v1/chat/communities/{id}/messages
  getCommunityMessages: async (token: string, id: string, limit = 30, skip = 0) => {
    try {
      const response = await fetch(`${BASE_URL}/${id}/messages?limit=${limit}&skip=${skip}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'accept': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching community messages:', error);
      return { success: false, message: 'Gagal mengambil pesan komunitas' };
    }
  },

  // POST /api/v1/chat/communities/messages (Multipart Form Data)
  sendMessage: async (token: string, conversationId: string, body: string, files?: any[]) => {
    try {
      const formData = new FormData();
      formData.append('conversationId', conversationId);
      formData.append('body', body);
      
      if (files && files.length > 0) {
        files.forEach((file, index) => {
          const filename = file.uri.split('/').pop() || `file-${Date.now()}-${index}`;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          // @ts-ignore
          formData.append('files', { uri: file.uri, name: filename, type });
        });
      } else {
        formData.append('files', '');
      }

      const response = await fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json'
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok && data.success === undefined) {
        data.success = true;
      }
      return data;
    } catch (error) {
      console.error('Error sending community message:', error);
      return { success: false, message: 'Gagal mengirim pesan' };
    }
  },

  // POST /api/v1/chat/communities/typing
  setTypingStatus: async (token: string, conversationId: string, isTyping: boolean) => {
    try {
      await fetch(`${BASE_URL}/typing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({ conversationId, isTyping })
      });
    } catch (error) {
      // Suppress network error spam for typing indicator
      // console.warn('Note: Typing status endpoint unavailable or network error');
    }
  },

  // PATCH /api/v1/chat/communities/{id}/read
  markAsRead: async (token: string, id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'accept': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  },

  // POST /api/v1/chat/communities
  createCommunity: async (token: string, formData: FormData) => {
    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json'
        },
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating community:', error);
      return { success: false, message: 'Gagal membuat komunitas' };
    }
  },

  // POST /api/v1/chat/communities/invite
  inviteMember: async (token: string, communityId: string, nim: string) => {
    try {
      const response = await fetch(`${BASE_URL}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({ communityId, nim })
      });
      const data = await response.json();
      if (response.ok && data.success === undefined) {
        data.success = true;
      }
      return data;
    } catch (error) {
      console.error('Error inviting member:', error);
      return { success: false, message: 'Gagal mengundang anggota' };
    }
  },

  // DELETE /api/v1/chat/communities/messages/{messageId}
  deleteMessage: async (token: string, messageId: string, type: 'me' | 'everyone') => {
    try {
      const response = await fetch(`${BASE_URL}/messages/${messageId}?type=${type}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error deleting community message:', error);
      return { success: false, message: 'Gagal menghapus pesan' };
    }
  },

  // DELETE /api/v1/chat/communities/{communityId}/members/{userId}
  removeMember: async (token: string, communityId: string, userId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/${communityId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error removing community member:', error);
      return { success: false, message: 'Gagal mengeluarkan anggota' };
    }
  },

  // DELETE /api/v1/chat/communities/{id}
  deleteCommunity: async (token: string, id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error deleting community:', error);
      return { success: false, message: 'Gagal menghapus komunitas' };
    }
  }
};
