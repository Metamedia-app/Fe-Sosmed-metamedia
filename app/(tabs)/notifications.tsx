import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl, 
  ActivityIndicator,
  Animated,
  ScrollView,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { 
  Bell, 
  Heart, 
  MessageCircle, 
  UserPlus, 
  Repeat, 
  Share2, 
  CheckCircle,
  ChevronLeft
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { notificationService, Notification } from '@/utils/notification';
import { getAvatarUrl } from '@/utils/avatar';
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import { GroupedActivityModal } from '@/components/GroupedActivityModal';

// Removed date-fns as it was causing resolution issues in Metro
// import { formatDistanceToNow } from 'date-fns';
// import { id as localeId } from 'date-fns/locale';

export default function NotificationsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, user } = useAuth();
  const { lastNotification, setUnreadCount } = useSocket();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'like' | 'comment' | 'repost'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedGroupNotif, setSelectedGroupNotif] = useState<Notification | null>(null);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);

  const filteredNotifications = React.useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter(n => n.type === activeFilter);
  }, [notifications, activeFilter]);

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (seconds < 60) return 'Baru saja';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} menit yang lalu`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} jam yang lalu`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days} hari yang lalu`;
      
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch {
      return 'Baru saja';
    }
  };
  
  // Anti-duplicate & Anti-stale event tracker
  const lastProcessedEventTime = useRef<number>(0);
  const mountTime = useRef<number>(Date.now());

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    const result = await notificationService.getNotifications(token);
    if (result.success && result.data) {
      const fetchedNotifs = result.data.notifications;
      setNotifications(fetchedNotifs);
      
      // Fetch absolute truth unread count from backend
      const countResult = await notificationService.getUnreadCount(token);
      if (countResult.success && countResult.data) {
        setUnreadCount(countResult.data.unread_count);
      }
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, [token, setUnreadCount]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Handle real-time notifications via Dedicated socket state
  useEffect(() => {
    if (!lastNotification || !lastNotification._id) return;

    // Check if we already have this notification (by ID)
    setNotifications(prev => {
      if (prev.find(n => n._id === lastNotification._id)) return prev;
      return [lastNotification, ...prev];
    });
  }, [lastNotification]);

  const handleMarkAllAsRead = async () => {
    if (!token) return;
    const result = await notificationService.markAllAsRead(token);
    if (result.success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handlePress = async (notification: Notification) => {
    if (!token) return;
    
    // Mark as read locally and on server
    if (!notification.is_read) {
      setNotifications(prev => prev.map(n => n._id === notification._id ? { ...n, is_read: true } : n));
      setUnreadCount((prev: number) => Math.max(0, prev - 1));
      await notificationService.markAsRead(token, notification._id);
    }

    // Navigation logic
    const postId = notification.post?._id;

    if (notification.type === 'follow') {
      router.push({
        pathname: "/user/[id]",
        params: { id: notification.sender._id, initialName: notification.sender.nama }
      });
    } else if (notification.others_count > 0) {
      // Show list of users for grouped notifications
      setSelectedGroupNotif(notification);
      setIsGroupModalVisible(true);
    } else if (postId) {
      // Direct navigation to post detail
      router.push({
        pathname: "/post/[id]",
        params: { 
          id: postId,
          autoOpenComments: notification.type === 'comment' ? 'true' : 'false',
          targetCommentId: notification.comment_id || undefined
        }
      });
    } else {
      // Fallback to profile if post data is missing or it's a profile-based interaction
      router.push({
        pathname: "/user/[id]",
        params: { id: notification.sender._id, initialName: notification.sender.nama }
      });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={14} color="#FFFFFF" fill="#FFFFFF" />;
      case 'comment': return <MessageCircle size={14} color="#FFFFFF" fill="#FFFFFF" />;
      case 'follow': return <UserPlus size={14} color="#FFFFFF" />;
      case 'repost': return <Repeat size={14} color="#FFFFFF" />;
      case 'share': return <Share2 size={14} color="#FFFFFF" />;
      default: return <Bell size={14} color="#FFFFFF" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'like': return '#FF2D55';
      case 'comment': return '#34C759';
      case 'follow': return '#007AFF';
      case 'repost': return '#5856D6';
      case 'share': return '#FF9500';
      default: return theme.tint;
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[
        styles.notiItem, 
        { 
          backgroundColor: item.is_read ? theme.background : theme.tint + '08',
          borderBottomColor: theme.border 
        }
      ]}
      onPress={() => handlePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Image 
          source={{ uri: getAvatarUrl(item.sender) }} 
          style={styles.avatar} 
          contentFit="cover"
          transition={200}
        />
        <View style={[styles.typeOverlay, { backgroundColor: getIconBg(item.type) }]}>
          {getIcon(item.type)}
        </View>
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.notiMessage, { color: theme.text }]} numberOfLines={3}>
          <Text style={{ fontWeight: '700' }}>{item.sender.nama}</Text>
          {/* Only manually add "others" if the message doesn't already contain it */}
          {item.others_count > 0 && !item.message.includes('lainnya') ? ` dan ${item.others_count} lainnya` : ''}
          {` ${item.message.replace(item.sender.nama, '').trim()}`}
        </Text>
        <Text style={[styles.notiTime, { color: theme.description }]}>
          {formatTimeAgo(item.createdAt)}
        </Text>
      </View>
      {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: theme.tint }]} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifikasi</Text>
        <TouchableOpacity 
          style={styles.markAllBtn}
          onPress={handleMarkAllAsRead}
          activeOpacity={0.6}
        >
          <CheckCircle size={22} color={theme.tint} />
          <Text style={[styles.markAllText, { color: theme.tint }]}>Baca semua</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Bar */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterContainer}
        >
          {[
            { id: 'all', label: 'Semua' },
            { id: 'like', label: 'Suka' },
            { id: 'comment', label: 'Komentar' },
            { id: 'repost', label: 'Repost' }
          ].map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                { backgroundColor: activeFilter === filter.id ? theme.tint : theme.border + '30' }
              ]}
              onPress={() => setActiveFilter(filter.id as any)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterLabel,
                { color: activeFilter === filter.id ? '#FFFFFF' : theme.description }
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={() => { setIsRefreshing(true); fetchNotifications(); }} 
              tintColor={theme.tint} 
            />
          }
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Bell size={64} color={theme.border} strokeWidth={1} />
              <Text style={[styles.emptyText, { color: theme.description }]}>Belum ada aktivitas baru</Text>
            </View>
          }
        />
      )}

      <GroupedActivityModal 
        isVisible={isGroupModalVisible}
        onClose={() => setIsGroupModalVisible(false)}
        notification={selectedGroupNotif}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'baseline', 
    paddingHorizontal: 20, 
    paddingTop: 60, 
    paddingBottom: 20,
    borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  markAllBtn: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  markAllText: { fontSize: 13, fontWeight: '600' },
  notiItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'flex-start',
    borderBottomWidth: 0.3,
  },
  avatarContainer: { position: 'relative', marginRight: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f0f0f0' },
  typeOverlay: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textContainer: { flex: 1, paddingTop: 2 },
  notiMessage: { fontSize: 15, lineHeight: 20, marginBottom: 4 },
  notiTime: { fontSize: 13, fontWeight: '400' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, marginTop: 22, marginLeft: 8 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { marginTop: 16, fontSize: 16, fontWeight: '500' }
});
