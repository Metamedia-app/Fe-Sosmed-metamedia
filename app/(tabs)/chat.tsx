import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MessageSquareText, Radio, Search, Users } from 'lucide-react-native';
import React, { useState, useCallback, useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { getConversations } from '@/utils/chat';
import { getMyGroups } from '@/utils/chatMatkul';
import { useRouter, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import SecureMedia from '@/components/SecureMedia';

const INBOX_DATA = [
  {
    id: '1',
    name: 'Budi Santoso',
    lastMessage: 'Halo Fajar, tugas SI sudah selesai?',
    time: '10:30 AM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=budi',
    unread: 2,
    type: 'inbox',
  },
  {
    id: '2',
    name: 'Siti Aminah',
    lastMessage: 'Pemandangan di rektorat emang bagus banget!',
    time: '09:15 AM',
    avatar: 'https://avatar.iran.liara.run/public/girl?username=siti',
    unread: 0,
    type: 'inbox',
  },
  {
    id: '3',
    name: 'Admin Kampus',
    lastMessage: 'Pengumuman beasiswa semester ganjil sudah keluar.',
    time: 'Yesterday',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=admin',
    unread: 0,
    type: 'inbox',
  },
];

const GRUP_DATA = [
  {
    id: 'g1',
    name: 'Kelompok 5 - Basis Data',
    lastMessage: 'Hadi: Izin kumpul hari ini jam 1 siang.',
    time: '11:45 AM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=hadi',
    unread: 5,
    type: 'grup',
  },
  {
    id: 'g2',
    name: 'Himpunan Mahasiswa TI',
    lastMessage: 'Tyo: Rapat pengukuhan besok pagi.',
    time: '08:00 AM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=tyo',
    unread: 0,
    type: 'grup',
  },
];

const COMMUNITY_DATA = [
  {
    id: 'c1',
    name: 'KM Metamedia Info',
    lastMessage: 'Voter: Klik untuk mengikuti pemilu raya kampus.',
    time: '12:00 PM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=voter',
    unread: 12,
    type: 'community',
  },
  {
    id: 'c2',
    name: 'Lowongan Magang 2026',
    lastMessage: 'Intern: PT Techindo sudah membuka pendaftaran.',
    time: '02:30 PM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=intern',
    unread: 0,
    type: 'community',
  },
];

export default function ChatScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [activeCategory, setActiveCategory] = useState('inbox');
  const [conversations, setConversations] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { token, user } = useAuth();
  const { lastEvent } = useSocket();
  const router = useRouter();

  const fetchChats = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    const result = await getConversations(token);
    if (result.success) {
      const sortedData = result.data.sort((a: any, b: any) => {
        const timeA = new Date(a.last_message_at || 0).getTime();
        const timeB = new Date(b.last_message_at || 0).getTime();
        return timeB - timeA;
      });
      
      const uniqueData: any[] = [];
      const seenUsers = new Set();
      
      for (const item of sortedData) {
        const userId = item.user?._id || item.user?.id;
        // Keep the item if we haven't seen this user yet, or if it doesn't have a user object (failsafe)
        if (!userId) {
          uniqueData.push(item);
        } else if (!seenUsers.has(userId)) {
          seenUsers.add(userId);
          uniqueData.push(item);
        }
      }
      
      console.log(`[ChatScreen] Rendered Inbox: ${uniqueData.length} unique conversations from ${sortedData.length} total.`);
      setConversations(uniqueData);
    }
    setIsLoading(false);
  }, [token]);

  const fetchGroups = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    const result = await getMyGroups(token);
    if (result.success) {
      const sortedData = result.data.sort((a: any, b: any) => {
        const timeA = new Date(a.last_message_at || 0).getTime();
        const timeB = new Date(b.last_message_at || 0).getTime();
        return timeB - timeA;
      });
      setGroups(sortedData);
    }
    setIsLoading(false);
  }, [token]);

  // Handle incoming real-time messages to bump conversation to top
  useEffect(() => {
    if (lastEvent?.type === 'chat_message') {
      const newMsg = lastEvent.data;
      setConversations(prev => {
        const existingIdx = prev.findIndex(c => c._id === newMsg.conversation_id);
        if (existingIdx >= 0) {
          // Clone the array
          const updated = [...prev];
          const convo = { ...updated[existingIdx] };
          // Update last message data
          convo.last_message = newMsg.body || 'Mengirim lampiran';
          convo.last_message_at = newMsg.createdAt;
          // Only increment unread if I am the recipient
          if (newMsg.sender_id !== user?._id) {
            convo.unread_count = (convo.unread_count || 0) + 1;
          }
          // Remove from old position and add to top
          updated.splice(existingIdx, 1);
          return [convo, ...updated];
        } else {
          // If it's a completely new conversation, we trigger a refetch
          fetchChats();
          return prev;
        }
      });
    }
  }, [lastEvent, fetchChats, user?._id]);

  useFocusEffect(
    useCallback(() => {
      if (activeCategory === 'inbox') {
        fetchChats();
      } else if (activeCategory === 'grup') {
        fetchGroups();
      }
    }, [activeCategory, fetchChats, fetchGroups])
  );

  const getActiveData = () => {
    switch (activeCategory) {
      case 'inbox': return conversations;
      case 'grup': return groups;
      case 'community': return COMMUNITY_DATA;
      default: return conversations;
    }
  };

  const renderCategoryTab = (id: string, label: string, icon: any) => {
    const isActive = activeCategory === id;
    const IconComponent = icon;
    
    return (
      <TouchableOpacity 
        onPress={() => setActiveCategory(id)}
        activeOpacity={0.7}
        style={[
          styles.categoryTab, 
          isActive ? { backgroundColor: theme.tint } : { backgroundColor: 'transparent' }
        ]}
      >
        <IconComponent size={16} color={isActive ? '#FFFFFF' : theme.description} />
        <Text style={[
          styles.categoryText, 
          { color: isActive ? '#FFFFFF' : theme.description },
          isActive && { fontWeight: '600' }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }]}>
        <Search size={18} color={theme.description} />
        <Text style={[styles.searchText, { color: theme.description }]}>Cari pesan atau grup...</Text>
      </View>

      {/* Categories Tabs */}
      <View style={[styles.tabsContainer]}>
        {renderCategoryTab('inbox', 'Inbox', MessageSquareText)}
        {renderCategoryTab('grup', 'Grup', Users)}
        {renderCategoryTab('community', 'Community', Radio)}
      </View>

      {isLoading && (activeCategory === 'inbox' || activeCategory === 'grup') ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <FlatList
          data={getActiveData()}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={() => (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: theme.description }}>Belum ada pesan</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isInbox = activeCategory === 'inbox';
            const isGroup = activeCategory === 'grup';
            
            const targetUser = isInbox ? item.user : null;
            const name = isInbox ? targetUser?.nama : isGroup ? item.name : item.name;
            const avatar = isInbox ? targetUser?.avatar_url : item.avatar_url || item.avatar;
            
            // For groups, API might not send last_message string directly
            const defaultLastMessage = isGroup ? (item.subject_info ? `Kode: ${item.subject_info.code}` : 'Ketuk untuk membuka grup') : 'Mengirim lampiran';
            const lastMessage = item.last_message || item.lastMessage || defaultLastMessage;
            
            let timeStr = item.time || '';
            const timestamp = isGroup ? item.last_message_at || item.createdAt : item.last_message_at;
            
            if (timestamp) {
              const date = new Date(timestamp);
              const today = new Date();
              if (date.toDateString() === today.toDateString()) {
                timeStr = format(date, 'HH:mm');
              } else {
                timeStr = format(date, 'dd/MM');
              }
            }
            
            const unread = isInbox || isGroup ? item.unread_count : item.unread;
            
            return (
              <TouchableOpacity 
                activeOpacity={0.7}
                style={[styles.chatItem, { backgroundColor: theme.background }]}
                onPress={() => {
                  if (isInbox) {
                    router.push(`/chat/${item._id}?recipientId=${targetUser?._id}&recipientName=${encodeURIComponent(name)}`);
                  } else if (isGroup) {
                    router.push(`/chat-matkul/${item._id}?groupName=${encodeURIComponent(name)}`);
                  }
                }}
              >
                {avatar && avatar.includes('workers.dev') ? (
                  // Normal avatar (public)
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : avatar ? (
                  // Encrypted or other media
                  <SecureMedia url={avatar} token={token} style={styles.avatar} />
                ) : (
                  // Default placeholder
                  <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.border }]}>
                    <Users size={24} color={theme.description} />
                  </View>
                )}
                
                <View style={styles.chatInfo}>
                  <View style={styles.chatHeader}>
                    <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.time, { color: unread > 0 ? theme.tint : theme.description }, unread > 0 && { fontWeight: 'bold' }]}>{timeStr}</Text>
                  </View>
                  <View style={styles.messageRow}>
                    <Text 
                      style={[styles.lastMessage, { color: unread > 0 ? theme.text : theme.description }, unread > 0 && { fontWeight: '600' }]} 
                      numberOfLines={1}
                    >
                      {lastMessage}
                    </Text>
                    {unread > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: theme.tint }]}>
                        <Text style={styles.unreadText}>{unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
  },
  searchText: {
    fontSize: 15,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    backgroundColor: '#E4E6EB',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  time: {
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  unreadText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
