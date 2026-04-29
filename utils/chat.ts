import { BASE_URL } from './api';
import { Platform } from 'react-native';

export const getConversations = async (token: string) => {
  try {
    console.log('[API Chat] Fetching conversations...');
    const response = await fetch(`${BASE_URL}/chat/conversations`, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    console.log(`[API Chat] Conversations fetched. Success: ${result.success}, Count: ${result.data?.length || 0}`);
    
    return {
      success: response.ok && result.success,
      data: result.data || [],
      message: result.message
    };
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return { success: false, data: [], message: 'Gagal mengambil daftar percakapan' };
  }
};

export const getMessages = async (conversationId: string, token: string) => {
  try {
    console.log(`[API Chat] Fetching messages for conversation: ${conversationId}`);
    const response = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    console.log(`[API Chat] Messages fetched. Success: ${result.success}, Count: ${result.data?.length || 0}`);
    
    return {
      success: response.ok && result.success,
      data: result.data || [],
      message: result.message
    };
  } catch (error) {
    console.error(`Error fetching messages for ${conversationId}:`, error);
    return { success: false, data: [], message: 'Gagal mengambil riwayat pesan' };
  }
};

interface SendMessageParams {
  token: string;
  recipientId?: string;
  conversationId?: string;
  body?: string;
  files?: any[]; // URI from image picker
}

export const sendMessage = async ({ token, recipientId, conversationId, body, files }: SendMessageParams) => {
  try {
    const formData = new FormData();
    if (recipientId) formData.append('recipientId', recipientId);
    if (conversationId) formData.append('conversationId', conversationId);
    if (body) formData.append('body', body);
    if (files && files.length > 0) {
      for (const file of files) {
        if (Platform.OS === 'web') {
          try {
            const res = await fetch(file.uri);
            const blob = await res.blob();
            formData.append('files', blob, file.fileName || `media-${Date.now()}.png`);
          } catch (e) {
            console.error('Failed to parse blob for web upload:', e);
          }
        } else {
          const uriParts = file.uri.split('.');
          const fileType = uriParts[uriParts.length - 1];
          
          formData.append('files', {
            uri: file.uri,
            name: file.fileName || `media-${Date.now()}.${fileType}`,
            type: file.mimeType || `image/${fileType}`
          } as any);
        }
      }
    }

    console.log('[API Chat] Sending message payload...', { recipientId, conversationId, body, hasFiles: files?.length });
    const response = await fetch(`${BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      body: formData
    });

    const result = await response.json();
    console.log('[API Chat] Send message response:', result);
    
    return {
      success: response.ok && result.success,
      data: result.data,
      message: result.message
    };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, message: 'Gagal mengirim pesan' };
  }
};

export const sendTypingStatus = async (conversationId: string, isTyping: boolean, token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/chat/typing`, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ conversationId, isTyping })
    });
    const result = await response.json();
    return { success: response.ok && result.success };
  } catch (error) {
    console.error('Error sending typing status:', error);
    return { success: false };
  }
};

export const deleteMessage = async (messageId: string, type: 'me' | 'everyone', token: string) => {
  try {
    console.log(`[API Chat] Deleting message ${messageId} with type: ${type}`);
    const response = await fetch(`${BASE_URL}/chat/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type })
    });
    const result = await response.json();
    console.log(`[API Chat] Delete message response:`, result);
    return { success: response.ok && result.success, message: result.message };
  } catch (error) {
    console.error('Error deleting message:', error);
    return { success: false, message: 'Gagal menghapus pesan' };
  }
};

export const clearConversation = async (conversationId: string, token: string) => {
  try {
    console.log(`[API Chat] Clearing conversation ${conversationId}`);
    const response = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/clear`, {
      method: 'DELETE',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    console.log(`[API Chat] Clear conversation response:`, result);
    return { success: response.ok && result.success, message: result.message };
  } catch (error) {
    console.error('Error clearing conversation:', error);
    return { success: false, message: 'Gagal membersihkan obrolan' };
  }
};
