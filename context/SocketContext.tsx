import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { notificationService } from '@/utils/notification';

type SocketEvent = {
  type: string;
  data: any;
  timestamp: number;
};

type SocketContextType = {
  lastEvent: SocketEvent | null;
  unreadNotificationsCount: number;
  lastNotification: any | null; // Specifically for real-time notification persistence
  setUnreadCount: (count: number) => void;
  isConnected: boolean;
  socket: Socket | null;
};

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// URL backend sesuai instruksi baru
const SOCKET_URL = 'https://besosmed-production.up.railway.app';

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, isLoggedIn } = useAuth();
  const [lastEvent, setLastEvent] = useState<SocketEvent | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const setUnreadCount = (update: number | ((prev: number) => number)) => {
    if (typeof update === 'function') {
      setUnreadNotificationsCount(prev => update(prev));
    } else {
      setUnreadNotificationsCount(update);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !token) {
      if (socketRef.current) {
        console.log('[Socket.io] Disconnecting...');
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Initialize Socket.io with auth token
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'], // Force websocket for reliability in RN
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
    });
    
    // Initial Fetch for unread count
    const fetchInitialCount = async () => {
      console.log('[Socket] Fetching initial unread count...');
      try {
        const result = await notificationService.getUnreadCount(token);
        console.log('[Socket] Full API Response for unread count:', JSON.stringify(result));
        if (result.success) {
          // Robust check for field name variations
          const count = result.data?.unread_count ?? (result as any).unread_count ?? 0;
          console.log('[Socket] Computed count:', count);
          setUnreadNotificationsCount(count);
        }
      } catch (error) {
        console.error('[Socket] Initial fetch error:', error);
      }
    };
    fetchInitialCount();

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket.io] Connected ✅', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket.io] Disconnected ❌ Reason:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket.io] Connection Error:', error.message);
      setIsConnected(false);
    });

    // --- Dynamic Event Listeners ---
    // Mapping events from Backend to our app's lastEvent state
    const events = ['new_post', 'new_comment', 'like_update', 'share_update', 'repost_update', 'notification', 'delete_post', 'follow_update', 'story_view_update'];

    events.forEach(eventType => {
      socket.on(eventType, (data) => {
        console.log(`[Socket.io] Event received: ${eventType}`);
        
        // Specific handling for notifications
        if (eventType === 'notification') {
          setUnreadNotificationsCount(prev => prev + 1);
          setLastNotification(data);
        }

        setLastEvent({
          type: eventType,
          data: data,
          timestamp: Date.now(),
        });
      });
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isLoggedIn, token]);

  return (
    <SocketContext.Provider value={{ 
      lastEvent, 
      unreadNotificationsCount, 
      lastNotification, 
      setUnreadCount,
      isConnected, 
      socket: socketRef.current 
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
