import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MessageSquareText, Radio, Search, Users, Check, CheckCheck, Clock, SquarePlus } from 'lucide-react-native';
import React, { useState, useCallback, useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { getConversations, deleteConversation } from '@/utils/chat';
import { getMyGroups } from '@/utils/chatMatkul';
import { communityService } from '@/utils/chatCommunity';
import { useRouter, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import SecureMedia from '@/components/SecureMedia';
import CreateCommunityModal from '@/components/CreateCommunityModal';

const ChatSkeleton = ({ theme }: { theme: any }) => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={{ flexDirection: 'row', padding: 15, alignItems: 'center' }}>
      <Animated.View style={[{ width: 50, height: 50, borderRadius: 25, backgroundColor: theme.border }, animatedStyle]} />
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Animated.View style={[{ width: '60%', height: 16, borderRadius: 8, backgroundColor: theme.border, marginBottom: 8 }, animatedStyle]} />
        <Animated.View style={[{ width: '80%', height: 12, borderRadius: 6, backgroundColor: theme.border }, animatedStyle]} />
      </View>
    </View>
  );
};

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
  const [communities, setCommunities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateCommunityVisible, setIsCreateCommunityVisible] = useState(false);
  const { token, user } = useAuth();
  const { lastEvent, unreadChatSummary, refreshUnreadChat, socket, onlineUsers } = useSocket();
  const router = useRouter();

  const fetchChats = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setIsLoading(true);
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
        
        // ONLY include if it's a personal chat (has a user)
        if (userId && !seenUsers.has(userId)) {
          seenUsers.add(userId);
          uniqueData.push(item);
        }
      }
      
      if (uniqueData.length > 0) {
        console.log('[Debug Inbox Terbaru] Data Pertama:', JSON.stringify(uniqueData[0], null, 2));
      }
      setConversations(uniqueData);
    }
    if (!silent) setIsLoading(false);
  }, [token]);

  const fetchGroups = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setIsLoading(true);
    const result = await getMyGroups(token);
    if (result.success) {
      const sortedData = result.data.sort((a: any, b: any) => {
        const timeA = new Date(a.last_message_at || 0).getTime();
        const timeB = new Date(b.last_message_at || 0).getTime();
        return timeB - timeA;
      });
      if (sortedData.length > 0) {
        console.log('[Debug Grup Terbaru] Data Pertama:', JSON.stringify(sortedData[0], null, 2));
      }
      setGroups(sortedData);
    }
    if (!silent) setIsLoading(false);
  }, [token]);

  const fetchCommunities = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setIsLoading(true);
    const result = await communityService.getMyCommunities(token);
    if (result.success) {
      setCommunities(result.data || []);
    }
    if (!silent) setIsLoading(false);
  }, [token]);

  // Handle incoming real-time messages to bump conversation to top
  useEffect(() => {
    if (!socket) return;

    const handleUnifiedMessage = (newMsg: any) => {
      console.log('[ChatList] New message received:', newMsg);
      let foundInInbox = false;
      let foundInGroups = false;
      
      // Update personal inbox
      setConversations(prev => {
        const existingIdx = prev.findIndex(c => c._id === newMsg.conversation_id);
        if (existingIdx >= 0) {
          foundInInbox = true;
          const updated = [...prev];
          const convo = { ...updated[existingIdx] };
          convo.last_message = newMsg.body || 'Mengirim lampiran';
          convo.last_message_at = newMsg.createdAt;
          convo.last_message_status = newMsg.status || 'sent';
          convo.last_message_sender_id = newMsg.sender_id?._id || newMsg.sender_id;
          
          if (newMsg.sender_id !== user?._id && newMsg.sender_id?._id !== user?._id) {
            convo.unread_count = (convo.unread_count || 0) + 1;
          }
          updated.splice(existingIdx, 1);
          return [convo, ...updated];
        }
        return prev;
      });

      // Update group inbox
      setGroups(prev => {
        const existingIdx = prev.findIndex(g => g._id === newMsg.conversation_id);
        if (existingIdx >= 0) {
          foundInGroups = true;
          const updated = [...prev];
          const group = { ...updated[existingIdx] };
          group.last_message = newMsg.body || 'Mengirim lampiran';
          group.last_message_at = newMsg.createdAt;
          group.last_message_status = newMsg.status || 'sent';
          group.last_message_sender_id = newMsg.sender_id?._id || newMsg.sender_id;

          if (newMsg.sender_id !== user?._id && newMsg.sender_id?._id !== user?._id) {
            group.unread_count = (group.unread_count || 0) + 1;
          }
          updated.splice(existingIdx, 1);
          return [group, ...updated];
        }
        return prev;
      });

      // If not found in either, it's a new conversation
      setTimeout(() => {
        if (!foundInInbox && !foundInGroups) {
          console.log('[ChatList] Message not found in current lists, fetching all...');
          fetchChats(true);
          fetchGroups(true);
        }
      }, 500);
    };

    const handleStatusUpdate = (data: any) => {
      console.log('[ChatList] Status update received:', data);
      setConversations(prev => prev.map(convo => {
        if (convo._id === data.conversation_id) {
          return { ...convo, last_message_status: data.status };
        }
        return convo;
      }));
      setGroups(prev => prev.map(group => {
        if (group._id === data.conversation_id) {
          return { ...group, last_message_status: data.status };
        }
        return group;
      }));
    };

    socket.on('new_message', handleUnifiedMessage);
    socket.on('message_status_update', handleStatusUpdate);

    return () => {
      socket.off('new_message', handleUnifiedMessage);
      socket.off('message_status_update', handleStatusUpdate);
    };
  }, [socket, fetchChats, fetchGroups, user?._id]);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadChat(); // Sync latest unread summary from API
      if (activeCategory === 'inbox') {
        fetchChats();
      } else if (activeCategory === 'grup') {
        fetchGroups();
      } else if (activeCategory === 'community') {
        fetchCommunities();
      }
    }, [activeCategory, fetchChats, fetchGroups, fetchCommunities, refreshUnreadChat])
  );

  const getActiveData = () => {
    switch (activeCategory) {
      case 'inbox': return conversations;
      case 'grup': return groups;
      case 'community': return communities;
      default: return conversations;
    }
  };

  const renderCategoryTab = (id: string, label: string, icon: any, unreadCount: number = 0) => {
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
        {unreadCount > 0 && (
          <View style={[
            styles.tabBadge, 
            { backgroundColor: isActive ? '#FFFFFF' : theme.tint }
          ]}>
            <Text style={[
              styles.tabBadgeText,
              { color: isActive ? theme.tint : '#FFFFFF' }
            ]}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
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
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.tabsContainer}
        >
          {renderCategoryTab('inbox', 'Inbox', MessageSquareText, unreadChatSummary?.categories?.inbox)}
          {renderCategoryTab('grup', 'Grup', Users, unreadChatSummary?.categories?.group)}
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {renderCategoryTab('community', 'Community', Radio, unreadChatSummary?.categories?.community)}
            {activeCategory === 'community' && (
              <TouchableOpacity 
                style={[styles.createCommunityBtn, { backgroundColor: theme.tint + '20', marginLeft: 10 }]}
                onPress={() => setIsCreateCommunityVisible(true)}
              >
                <SquarePlus size={18} color={theme.tint} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
      {isLoading ? (
        <View style={{ flex: 1 }}>
          <ChatSkeleton theme={theme} />
          <ChatSkeleton theme={theme} />
          <ChatSkeleton theme={theme} />
          <ChatSkeleton theme={theme} />
          <ChatSkeleton theme={theme} />
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
          const isCommunity = activeCategory === 'community';
          
          const targetUser = isInbox ? item.user : null;
          const name = isInbox ? targetUser?.nama : (isGroup || isCommunity) ? item.name : item.name;
          const avatar = isInbox ? targetUser?.avatar_url : (isGroup || isCommunity) ? item.avatar_url : item.avatar;
          const isOnline = isInbox && targetUser && onlineUsers[targetUser._id || targetUser.id];
            
            // For groups/communities, API might not send last_message string directly or send an ID
            const defaultLastMessage = isGroup ? (item.subject_info ? `Kode: ${item.subject_info.code}` : 'Ketuk untuk membuka grup') 
                                     : isCommunity ? (item.description || 'Ketuk untuk membuka komunitas')
                                     : 'Mengirim lampiran';
            
            // If last_message is a string (ID), show default; if it's an object with body, show body.
            const lastMessage = item.last_message?.body || 
                               (typeof item.last_message === 'string' ? item.last_message : defaultLastMessage);
            
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
                onLongPress={() => {
                  if (isInbox) {
                    Alert.alert(
                      "Hapus Obrolan",
                      `Apakah Anda yakin ingin menghapus obrolan dengan ${name}?`,
                      [
                        { text: "Batal", style: "cancel" },
                        { 
                          text: "Hapus", 
                          style: "destructive",
                          onPress: async () => {
                            const res = await deleteConversation(item._id, token);
                            if (res.success) {
                              setConversations(prev => prev.filter(c => c._id !== item._id));
                            } else {
                              Alert.alert('Gagal', res.message || 'Gagal menghapus obrolan');
                            }
                          }
                        }
                      ]
                    );
                  }
                }}
                onPress={() => {
                  if (isInbox) {
                    router.push(`/chat/${item._id}?recipientId=${targetUser?._id}&recipientName=${encodeURIComponent(name)}&recipientAvatar=${encodeURIComponent(avatar || '')}`);
                  } else if (isGroup) {
                    router.push(`/chat-matkul/${item._id}?groupName=${encodeURIComponent(name)}`);
                  } else if (activeCategory === 'community') {
                    router.push(`/chat-community/${item._id}?communityName=${encodeURIComponent(name)}`);
                  }
                }}
              >
                <View style={{ position: 'relative' }}>
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
                  {isOnline && (
                    <View style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 17,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: '#4CAF50',
                      borderWidth: 2,
                      borderColor: theme.background
                    }} />
                  )}
                </View>
                
                <View style={styles.chatInfo}>
                  <View style={styles.chatHeader}>
                    <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.time, { color: unread > 0 ? theme.tint : theme.description }, unread > 0 && { fontWeight: 'bold' }]}>{timeStr}</Text>
                  </View>
                  <View style={styles.messageRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {(isInbox || isGroup) && item.last_message_sender_id === user?._id && (
                        <View style={{ marginRight: 4 }}>
                          {(item.last_message_status === 'read' || item.status === 'read') ? (
                            <CheckCheck size={14} color="#4FC3F7" />
                          ) : (item.last_message_status === 'delivered' || item.status === 'delivered') ? (
                            <CheckCheck size={14} color={theme.description} />
                          ) : item.last_message_status === 'pending' ? (
                            <Clock size={12} color={theme.description} />
                          ) : (
                            <Check size={14} color={theme.description} />
                          )}
                        </View>
                      )}
                      <Text 
                        style={[styles.lastMessage, { color: unread > 0 ? theme.text : theme.description }, unread > 0 && { fontWeight: '600' }]} 
                        numberOfLines={1}
                      >
                        {lastMessage}
                      </Text>
                    </View>
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
      
      <CreateCommunityModal 
        isVisible={isCreateCommunityVisible}
        onClose={() => setIsCreateCommunityVisible(false)}
        onSuccess={() => fetchCommunities()}
      />
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
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginLeft: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  createCommunityBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
});
