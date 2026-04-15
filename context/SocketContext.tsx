import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

type SocketEvent = {
  type: string;
  data: any;
  timestamp: number;
};

type SocketContextType = {
  lastEvent: SocketEvent | null;
  isConnected: boolean;
  socket: Socket | null;
};

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// URL backend sesuai instruksi baru
const SOCKET_URL = 'https://besosmed-production.up.railway.app';

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, isLoggedIn } = useAuth();
  const [lastEvent, setLastEvent] = useState<SocketEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

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
    const events = ['new_post', 'new_comment', 'like_update', 'share_update', 'repost_update', 'notification', 'delete_post'];

    events.forEach(eventType => {
      socket.on(eventType, (data) => {
        console.log(`[Socket.io] Event received: ${eventType}`);
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
    <SocketContext.Provider value={{ lastEvent, isConnected, socket: socketRef.current }}>
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
