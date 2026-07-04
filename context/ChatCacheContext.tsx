/**
 * ChatCacheContext.tsx
 * 
 * Global in-memory cache untuk pesan chat.
 * Mengimplementasikan pola Stale-While-Revalidate:
 * - Tampilkan data lama dari cache INSTAN (0ms)
 * - Sinkronisasi pesan baru via Socket.io di background
 * - Tidak perlu refetch API saat kembali ke percakapan yang sama
 */

import React, { createContext, useContext, useRef, useCallback } from 'react';

interface CacheEntry {
  messages: any[];
  hasMore: boolean;
  fetchedAt: number;
}

interface ChatCacheContextType {
  getCache: (conversationId: string) => CacheEntry | null;
  setCache: (conversationId: string, messages: any[], hasMore: boolean) => void;
  appendMessages: (conversationId: string, olderMessages: any[], newHasMore: boolean) => void;
  prependMessage: (conversationId: string, message: any) => void;
  updateMessage: (conversationId: string, tempId: string, realMessage: any) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  clearCache: (conversationId: string) => void;
}

const ChatCacheContext = createContext<ChatCacheContextType | undefined>(undefined);

// Cache expires after 5 minutes of inactivity
const CACHE_TTL_MS = 5 * 60 * 1000;

export function ChatCacheProvider({ children }: { children: React.ReactNode }) {
  // useRef sehingga perubahan cache tidak trigger re-render pada provider
  const cacheRef = useRef<Record<string, CacheEntry>>({});

  const getCache = useCallback((conversationId: string): CacheEntry | null => {
    const entry = cacheRef.current[conversationId];
    if (!entry) return null;
    
    // Expire stale cache
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      delete cacheRef.current[conversationId];
      return null;
    }
    
    return entry;
  }, []);

  const setCache = useCallback((conversationId: string, messages: any[], hasMore: boolean) => {
    cacheRef.current[conversationId] = {
      messages,
      hasMore,
      fetchedAt: Date.now(),
    };
  }, []);

  // Tambahkan pesan lama (load more / scroll ke atas)
  const appendMessages = useCallback((conversationId: string, olderMessages: any[], newHasMore: boolean) => {
    const entry = cacheRef.current[conversationId];
    if (!entry) return;

    const existingIds = new Set(entry.messages.map((m: any) => m._id));
    const filtered = olderMessages.filter((m: any) => !existingIds.has(m._id));
    
    cacheRef.current[conversationId] = {
      messages: [...entry.messages, ...filtered],
      hasMore: newHasMore,
      fetchedAt: entry.fetchedAt, // Keep original fetch time
    };
  }, []);

  // Prepend pesan baru (dari socket / sent)
  const prependMessage = useCallback((conversationId: string, message: any) => {
    const entry = cacheRef.current[conversationId];
    if (!entry) return;
    
    const exists = entry.messages.some((m: any) => m._id === message._id);
    if (exists) return;
    
    cacheRef.current[conversationId] = {
      ...entry,
      messages: [message, ...entry.messages],
    };
  }, []);

  // Ganti temp message dengan real message dari server
  const updateMessage = useCallback((conversationId: string, tempId: string, realMessage: any) => {
    const entry = cacheRef.current[conversationId];
    if (!entry) return;
    
    cacheRef.current[conversationId] = {
      ...entry,
      messages: entry.messages.map((m: any) => 
        m._id === tempId ? realMessage : m
      ),
    };
  }, []);

  // Hapus pesan dari cache
  const removeMessage = useCallback((conversationId: string, messageId: string) => {
    const entry = cacheRef.current[conversationId];
    if (!entry) return;
    
    cacheRef.current[conversationId] = {
      ...entry,
      messages: entry.messages.filter((m: any) => m._id !== messageId),
    };
  }, []);

  const clearCache = useCallback((conversationId: string) => {
    delete cacheRef.current[conversationId];
  }, []);

  return (
    <ChatCacheContext.Provider value={{
      getCache,
      setCache,
      appendMessages,
      prependMessage,
      updateMessage,
      removeMessage,
      clearCache,
    }}>
      {children}
    </ChatCacheContext.Provider>
  );
}

export function useChatCache(): ChatCacheContextType {
  const context = useContext(ChatCacheContext);
  if (!context) {
    throw new Error('useChatCache must be used within a ChatCacheProvider');
  }
  return context;
}
