import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import { useAuth } from './AuthContext';
import { notificationService } from '@/utils/notification';

// Sound Registries - Using Local Synthesized Assets (Unique & High Quality)
const SOUND_THEMES = {
  ethereal: require('../assets/sounds/ethereal.wav'),
  futuristic: require('../assets/sounds/futuristic.wav'),
  organic: require('../assets/sounds/organic.wav'),
  retro: require('../assets/sounds/retro.wav'),
  minimal: require('../assets/sounds/minimal.wav'),
};

type SocketEvent = {
  type: string;
  data: any;
  timestamp: number;
};

type SocketContextType = {
  lastEvent: SocketEvent | null;
  unreadNotificationsCount: number;
  lastNotification: any | null; 
  setUnreadCount: (update: number | ((prev: number) => number)) => void;
  isConnected: boolean;
  socket: Socket | null;
  // Sound related
  soundTheme: keyof typeof SOUND_THEMES;
  setSoundTheme: (theme: keyof typeof SOUND_THEMES) => void;
  playNotificationSound: () => Promise<void>;
};

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// URL backend
const SOCKET_URL = 'https://besosmed-production.up.railway.app';

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, isLoggedIn } = useAuth();
  const [lastEvent, setLastEvent] = useState<SocketEvent | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [soundTheme, setSoundTheme] = useState<keyof typeof SOUND_THEMES>('ethereal');
  const socketRef = useRef<Socket | null>(null);
  const appState = useRef(AppState.currentState);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Function to play sound based on current theme using local assets
  const playNotificationSound = useCallback(async () => {
    try {
      // Unload previous sound if any
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // use createAsync with local asset (require)
      const { sound } = await Audio.Sound.createAsync(
        SOUND_THEMES[soundTheme],
        { shouldPlay: true, volume: 0.8 }
      );
      soundRef.current = sound;
    } catch (error) {
      console.error('[Sound] Playback error:', error);
    }
  }, [soundTheme]);

  const fetchInitialCount = useCallback(async () => {
    if (!token || !isLoggedIn) return;
    try {
      const result = await notificationService.getUnreadCount(token);
      if (result.success) {
        const count = result.data?.unread_count ?? (result as any).unread_count ?? 0;
        setUnreadNotificationsCount(count);
      }
    } catch (error) {
      console.error('[Socket] Sync error:', error);
    }
  }, [token, isLoggedIn]);

  const setUnreadCount = (update: number | ((prev: number) => number)) => {
    if (typeof update === 'function') {
      setUnreadNotificationsCount(prev => update(prev));
    } else {
      setUnreadNotificationsCount(update);
    }
  };

  useEffect(() => {
    // Configure audio mode for consistent playback
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    if (!isLoggedIn || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
    });
    
    fetchInitialCount();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchInitialCount();
      }
      appState.current = nextAppState;
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    socket.on('connect', () => {
      setIsConnected(true);
      fetchInitialCount();
    });

    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', () => setIsConnected(false));

    const events = ['new_post', 'new_comment', 'like_update', 'share_update', 'repost_update', 'notification', 'delete_post', 'follow_update', 'story_view_update', 'chat_message', 'typing'];

    events.forEach(eventType => {
      socket.on(eventType, (data) => {
        if (eventType === 'typing' || eventType === 'chat_message') {
          console.log(`[SocketEvent] ${eventType}:`, data);
        }

        if (eventType === 'notification') {
          const serverCount = data?.unread_count ?? data?.count;
          if (typeof serverCount === 'number') {
            setUnreadNotificationsCount(serverCount);
          } else {
            setUnreadNotificationsCount(prev => prev + 1);
          }
          setLastNotification(data);
          
          // PLAY NOTIF SOUND!
          playNotificationSound();
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
      subscription.remove();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [isLoggedIn, token, fetchInitialCount, playNotificationSound]);

  return (
    <SocketContext.Provider value={{ 
      lastEvent, 
      unreadNotificationsCount, 
      lastNotification, 
      setUnreadCount,
      isConnected, 
      socket: socketRef.current,
      soundTheme,
      setSoundTheme,
      playNotificationSound
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
