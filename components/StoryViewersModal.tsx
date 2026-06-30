import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { storyService, Viewer } from '@/utils/story';
import { Image } from 'expo-image';
import { X, Search } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    TouchableWithoutFeedback,
    TextInput,
    Alert
} from 'react-native';
import { getAvatarUrl } from '@/utils/avatar';
import { getFollowing, followUser } from '@/utils/follow';
import { useRouter } from 'expo-router';
import { getOrCreateConversation } from '@/utils/chat';

interface StoryViewersModalProps {
  isVisible: boolean;
  storyId: string | null;
  onClose: () => void;
}

export default function StoryViewersModal({ isVisible, storyId, onClose }: StoryViewersModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, user: currentUser } = useAuth();
  const { lastEvent } = useSocket();
  const router = useRouter();
  
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isVisible && storyId && token) {
      fetchViewers();
    } else {
      setViewers([]);
      setTotalViews(0);
      setSearchQuery('');
    }
  }, [isVisible, storyId]);

  // Real-time socket listener for new viewers
  useEffect(() => {
    if (!lastEvent || !isVisible || !storyId) return;

    if (lastEvent.type === 'story_view_update') {
      const { story_id, views_count, viewer } = lastEvent.data ?? {};
      if (story_id === storyId) {
        if (typeof views_count === 'number') {
          setTotalViews(views_count);
        }
        if (viewer) {
          setViewers(prev => {
            // Avoid duplicates
            if (prev.some(v => (v._id || (v as any).id) === (viewer._id || viewer.id))) return prev;
            return [viewer, ...prev];
          });
        }
      }
    }
  }, [lastEvent, isVisible, storyId]);

  const fetchViewers = async () => {
    if (!storyId || !token) return;
    setIsLoading(true);
    try {
      const [result, followingRes] = await Promise.all([
        storyService.getViewers(token, storyId),
        getFollowing(currentUser?._id || '', token)
      ]);
      
      if (result.success && result.data) {
        setViewers(result.data.viewers);
        setTotalViews(result.data.total_views);
        
        const states: Record<string, boolean> = {};
        if (followingRes.success) {
          const myFollowingIds = new Set(followingRes.data.following.map((u: any) => u._id));
          result.data.viewers.forEach((v: any) => {
            const vid = v._id || v.id;
            states[vid] = myFollowingIds.has(vid);
          });
        }
        setFollowingStates(states);
      }
    } catch (error) {
      console.error('Fetch viewers error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredViewers = viewers.filter(v => 
    v.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFollowAction = async (viewer: Viewer) => {
    if (!token) return;
    const viewerId = viewer._id || (viewer as any).id;
    if (viewerId === currentUser?._id) return;
    
    if (followingStates[viewerId]) {
      // Already following -> Go to DM
      setLoadingStates(prev => ({ ...prev, [viewerId]: true }));
      const res = await getOrCreateConversation(viewerId, token);
      setLoadingStates(prev => ({ ...prev, [viewerId]: false }));
      
      if (res.success && res.data?.conversation_id) {
        onClose();
        router.push({
          pathname: `/chat/[id]`,
          params: {
            id: res.data.conversation_id,
            recipientId: viewerId,
            recipientName: viewer.nama,
            recipientAvatar: getAvatarUrl(viewer, true)
          }
        } as any);
      } else {
        Alert.alert('Gagal', res.message || 'Gagal memulai percakapan');
      }
    } else {
      // Not following -> Follow
      setLoadingStates(prev => ({ ...prev, [viewerId]: true }));
      const res = await followUser(viewerId, token);
      if (res.success) {
        setFollowingStates(prev => ({ ...prev, [viewerId]: true }));
      }
      setLoadingStates(prev => ({ ...prev, [viewerId]: false }));
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
              {/* Drag Handle */}
              <View style={styles.dragHandleContainer}>
                <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: theme.text }]}>Penonton Cerita</Text>
                  <Text style={[styles.subtitle, { color: theme.description }]}>{totalViews} orang telah melihat</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.background }]}>
                  <X size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={[styles.searchContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Search size={18} color={theme.description} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Cari penonton..."
                  placeholderTextColor={theme.description}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Content */}
              {isLoading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={theme.tint} />
                </View>
              ) : filteredViewers.length > 0 ? (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                  {filteredViewers.map((viewer, index) => (
                    <TouchableOpacity 
                      key={viewer._id || `viewer-${index}`} 
                      style={styles.viewerItem}
                      onPress={() => {
                        onClose();
                        router.push({
                          pathname: "/user/[id]",
                          params: { 
                            id: viewer._id || (viewer as any).id,
                            initialName: viewer.nama, 
                            initialNim: viewer.nim, 
                            initialAvatar: getAvatarUrl(viewer, true) 
                          }
                        } as any);
                      }}
                      activeOpacity={0.7}
                    >
                      <Image 
                        source={{ uri: getAvatarUrl(viewer, true) }} 
                        style={styles.avatar} 
                      />
                      <View style={styles.viewerInfo}>
                        <Text style={[styles.viewerName, { color: theme.text }]}>{viewer.nama}</Text>
                        <Text style={[styles.viewedTime, { color: theme.description }]}>
                          Melihat pada {new Date(viewer.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      
                      {(viewer._id || (viewer as any).id) !== currentUser?._id && (
                        <TouchableOpacity 
                          style={[
                            styles.followButton, 
                            { 
                              backgroundColor: followingStates[viewer._id || (viewer as any).id] ? 'transparent' : theme.tint,
                              borderColor: followingStates[viewer._id || (viewer as any).id] ? theme.border : theme.tint,
                            }
                          ]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleFollowAction(viewer);
                          }}
                          disabled={loadingStates[viewer._id || (viewer as any).id]}
                        >
                          {loadingStates[viewer._id || (viewer as any).id] ? (
                            <ActivityIndicator size="small" color={followingStates[viewer._id || (viewer as any).id] ? theme.text : '#fff'} />
                          ) : (
                            <Text style={[
                              styles.followButtonText, 
                              { color: followingStates[viewer._id || (viewer as any).id] ? theme.text : '#fff' }
                            ]}>
                              {followingStates[viewer._id || (viewer as any).id] ? 'Pesan' : 'Follow'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.centerContainer}>
                  <Text style={[styles.emptyText, { color: theme.description }]}>
                    {searchQuery ? 'Tidak ada hasil ditemukan' : 'Belum ada penonton'}
                  </Text>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '70%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  viewedTime: {
    fontSize: 12,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
  }
});
