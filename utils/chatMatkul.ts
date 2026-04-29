import { BASE_URL } from './api';
import { Platform } from 'react-native';

export const getMyGroups = async (token: string) => {
  try {
    console.log('[API ChatMatkul] Fetching my groups...');
    const response = await fetch(`${BASE_URL}/chat-matkul/my-groups`, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    console.log(`[API ChatMatkul] Groups fetched. Success: ${result.success}, Count: ${result.data?.length || 0}`);
    
    return {
      success: response.ok && result.success,
      data: result.data || [],
      message: result.message
    };
  } catch (error) {
    console.error('Error fetching groups:', error);
    return { success: false, data: [], message: 'Gagal mengambil daftar grup matkul' };
  }
};

export const getGroupMessages = async (conversationId: string, token: string) => {
  try {
    console.log(`[API ChatMatkul] Fetching messages for group: ${conversationId}`);
    const response = await fetch(`${BASE_URL}/chat-matkul/messages/${conversationId}`, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    console.log(`[API ChatMatkul] Group messages fetched. Success: ${result.success}, Count: ${result.data?.length || 0}`);
    
    return {
      success: response.ok && result.success,
      data: result.data || [],
      message: result.message
    };
  } catch (error) {
    console.error(`Error fetching messages for group ${conversationId}:`, error);
    return { success: false, data: [], message: 'Gagal mengambil riwayat pesan grup' };
  }
};

interface SendGroupMessageParams {
  token: string;
  conversationId: string;
  body?: string;
  files?: any[]; // URI from image picker
}

export const sendGroupMessage = async ({ token, conversationId, body, files }: SendGroupMessageParams) => {
  try {
    const formData = new FormData();
    formData.append('conversationId', conversationId);
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

    console.log('[API ChatMatkul] Sending message payload...', { conversationId, body, hasFiles: files?.length });
    const response = await fetch(`${BASE_URL}/chat-matkul/messages`, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      body: formData
    });

    const result = await response.json();
    console.log('[API ChatMatkul] Send message response:', result);
    
    return {
      success: response.ok && result.success,
      data: result.data,
      message: result.message
    };
  } catch (error) {
    console.error('Error sending group message:', error);
    return { success: false, message: 'Gagal mengirim pesan ke grup' };
  }
};

export const deleteGroupMessage = async (messageId: string, token: string) => {
  try {
    console.log(`[API ChatMatkul] Deleting message ${messageId}`);
    const response = await fetch(`${BASE_URL}/chat-matkul/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    console.log(`[API ChatMatkul] Delete message response:`, result);
    return { success: response.ok && result.success, message: result.message };
  } catch (error) {
    console.error('Error deleting group message:', error);
    return { success: false, message: 'Gagal menghapus pesan' };
  }
};

export const sendGroupTypingStatus = async (conversationId: string, isTyping: boolean, token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/chat-matkul/typing`, {
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
    console.error('Error sending group typing status:', error);
    return { success: false };
  }
};
