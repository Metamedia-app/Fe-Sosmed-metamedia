import { PostCard, PostData } from '@/components/PostCard';
import { getAvatarUrl } from '@/utils/avatar';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Plus, RefreshCcw } from 'lucide-react-native';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { Story, storyService } from '@/utils/story';
import CreateStoryModal from '@/components/CreateStoryModal';
import StoryViewer from '@/components/StoryViewer';
import StoryViewersModal from '@/components/StoryViewersModal';
import { subscribeToCommentSync } from '@/utils/commentSyncStore';
import { BASE_URL } from '@/utils/api';

// No dummy stories needed

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, refreshSignal, user } = useAuth();
  const { lastEvent } = useSocket();
  
  const [posts, setPosts] = useState<PostData[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isCreateStoryVisible, setIsCreateStoryVisible] = useState(false);
  const [isStoryViewerVisible, setIsStoryViewerVisible] = useState(false);
  const [isViewersVisible, setIsViewersVisible] = useState(false);
  const [selectedStoryGroup, setSelectedStoryGroup] = useState<Story[]>([]);
  const [activeStoryIdForViewers, setActiveStoryIdForViewers] = useState<string | null>(null);
  
  // Anti-duplicate & Anti-stale event tracker
  const lastProcessedEventTime = React.useRef<number>(0);
  const mountTime = React.useRef<number>(Date.now());

  const fetchStories = useCallback(async () => {
    if (!token) return;
    setIsLoadingStories(true);
    try {
      const result = await storyService.getStories(token);
      if (result.success && result.data?.stories) {
        setStories(result.data.stories as any);
      }
    } catch (err) {
      console.error('Fetch stories error:', err);
    } finally {
      setIsLoadingStories(false);
    }
  }, [token]);

  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
      fetchStories();
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('https://besosmed-production.up.railway.app/api/v1/posts', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        const fetchedPosts = (result.data?.posts || []).filter((p: any) => p.type !== 'repost');
        setPosts(fetchedPosts);
      } else {
        setError(result.message || 'Gagal mengambil postingan');
      }
    } catch (err) {
      console.error('Fetch posts error:', err);
      setError('Kesalahan koneksi internet');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token, fetchStories]);

  useEffect(() => {
    fetchStories();
    fetchPosts();
  }, [refreshSignal, token, fetchPosts, fetchStories]);

  // Listen for global refresh signal from CreatePostModal
  useEffect(() => {
    if (refreshSignal > 0) {
      fetchPosts(true);
    }
  }, [refreshSignal]);

  // Listen for socket events — keep feed live without full reload
  useEffect(() => {
    if (!lastEvent) return;

    // Guard 1: Prevent processing events that happened before this screen was opened
    if (lastEvent.timestamp < mountTime.current) return;

    // Guard 2: Prevent re-processing the same event (Anti-Jumping)
    if (lastEvent.timestamp <= lastProcessedEventTime.current) return;
    lastProcessedEventTime.current = lastEvent.timestamp;

    // 1. New post from anyone: prepend to feed OR update repost count
    if (lastEvent.type === 'new_post') {
      const newPost: PostData = lastEvent.data?.post ?? lastEvent.data;
      if (!newPost?._id) return;

      if (newPost.type === 'repost' && newPost.original_post_id?._id) {
        // INCREMENT REPOST COUNT ON ORIGINAL: If a new repost event arrives, 
        // prioritize absolute count from original_post_id object if available.
        const originalId = newPost.original_post_id._id;
        const serverRepostCount = newPost.original_post_id.reposts_count;
        
        setPosts((prev) =>
          prev.map((p) => {
            if (p._id === originalId) {
              return { ...p, reposts_count: serverRepostCount ?? (p.reposts_count || 0) + 1 };
            }
            if (p.type === 'repost' && p.original_post_id?._id === originalId) {
              return {
                ...p,
                original_post_id: { 
                  ...p.original_post_id, 
                  reposts_count: serverRepostCount ?? (p.original_post_id.reposts_count || 0) + 1 
                }
              };
            }
            return p;
          })
        );
      } else if (newPost.type === 'original') {
        // ADD NEW ORIGINAL POST: Normal feed behavior
        setPosts((prev) => {
          if (prev.some((p) => p._id === newPost._id)) return prev;
          return [newPost, ...prev];
        });
      }
    }

    // 2. Like update: sync like count on the relevant post card
    if (lastEvent.type === 'like_update') {
      const { post_id, postId, id, likes_count, like_count } = lastEvent.data ?? {};
      const targetId = post_id ?? postId ?? id;
      const finalLikes = likes_count ?? like_count;
      if (targetId) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p._id === targetId) return { ...p, likes_count: finalLikes ?? p.likes_count };
            if (p.type === 'repost' && p.original_post_id?._id === targetId) {
              return {
                ...p,
                original_post_id: { ...p.original_post_id!, likes_count: finalLikes ?? p.original_post_id!.likes_count }
              };
            }
            return p;
          })
        );
      }
    }

    // 3. New Comment update: sync comments_count on the relevant post card
    if (lastEvent.type === 'new_comment') {
      const data = lastEvent.data ?? {};
      const eventPostId = data.post_id ?? data.postId ?? data.id;
      // Prioritize absolute count if Backend sends it in the comment event
      const serverCmtCount = data.comments_count ?? data.total_comments ?? data.comment_count;

      if (eventPostId) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p._id === eventPostId) {
              return { ...p, comments_count: serverCmtCount ?? (p.comments_count || 0) + 1 };
            }
            if (p.type === 'repost' && p.original_post_id?._id === eventPostId) {
              return {
                ...p,
                original_post_id: {
                  ...p.original_post_id!,
                  comments_count: serverCmtCount ?? (p.original_post_id!.comments_count || 0) + 1,
                },
              };
            }
            return p;
          })
        );
      }
    }

    // 4. Repost update: sync reposts_count on the relevant post card
    if (lastEvent.type === 'repost_update') {
      const { post_id, postId, id, reposts_count, count, repost_count } = lastEvent.data ?? {};
      const targetId = post_id ?? postId ?? id;
      const finalCount = reposts_count ?? count ?? repost_count;

      if (targetId) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p._id === targetId) return { ...p, reposts_count: finalCount ?? p.reposts_count };
            if (p.type === 'repost' && p.original_post_id?._id === targetId) {
              return {
                ...p,
                original_post_id: { ...p.original_post_id!, reposts_count: finalCount ?? p.original_post_id!.reposts_count }
              };
            }
            return p;
          })
        );
      }
    }

    // 5. handle DELETE_POST
    if (lastEvent.type === 'delete_post') {
      const { post_id } = lastEvent.data ?? {};
      if (post_id) {
        setPosts((prev) => prev.filter((p) => p._id !== post_id));
      }
    }

    // 5. handle STORY_VIEW_UPDATE
    if (lastEvent.type === 'story_view_update') {
      const { story_id, views_count } = lastEvent.data ?? {};
      if (story_id) {
        // Update global stories group state
        setStories((prev: any) => 
          prev.map((group: any) => ({
            ...group,
            items: (group.items || []).map((item: any) => 
              item._id === story_id ? { ...item, views_count: views_count ?? item.views_count } : item
            )
          }))
        );

        // Update active story group if currently viewed in StoryViewer
        setSelectedStoryGroup((prev) => {
          if (!prev.some(s => s._id === story_id)) return prev;
          return prev.map(s => s._id === story_id ? { ...s, views_count: views_count ?? s.views_count } : s);
        });
      }
    }
  }, [lastEvent]);

  // Global Sync: Listen for local updates from CommentModal/other screens
  useEffect(() => {
    const unsubscribe = subscribeToCommentSync((type, id, payload) => {
      if (type === "POST_STATS_UPDATE") {
        setPosts((prev) =>
          prev.map((p) => {
            const isMatch = p._id === id || (p.type === 'repost' && p.original_post_id?._id === id);
            if (!isMatch) return p;

            return {
              ...p,
              comments_count: payload.comments_count ?? p.comments_count,
              likes_count: payload.likes_count ?? p.likes_count,
              reposts_count: payload.reposts_count ?? p.reposts_count,
              shares_count: payload.shares_count ?? p.shares_count,
              original_post_id: p.type === 'repost' && p.original_post_id ? {
                ...p.original_post_id,
                comments_count: payload.comments_count ?? p.original_post_id.comments_count,
                likes_count: payload.likes_count ?? p.original_post_id.likes_count,
                reposts_count: payload.reposts_count ?? p.original_post_id.reposts_count,
                shares_count: payload.shares_count ?? p.original_post_id.shares_count,
              } : p.original_post_id
            };
          })
        );
      }
    });
    return unsubscribe;
  }, []);

  const handleDeleteSuccess = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId && (p as any).id !== postId));
  };

  const groupedStories = useMemo(() => {
    // Current stories state now contains StoryGroup[] from the API
    const groups = (stories as any[]).map(group => {
      const author = group.user || group.author || { nama: 'Pengguna' };
      const authorId = author._id || author.id;
      
      const normalizedItems = (group.items || []).map((story: any) => {
        // Robust media detection (same as before)
        let mediaUrl = "";
        if (typeof story.media === 'string') {
          mediaUrl = story.media;
        } else if (story.media) {
          mediaUrl = story.media.url || story.media.path || story.media.uri || story.media.media_url || "";
        }

        // Expand relative URL
        if (mediaUrl && !mediaUrl.startsWith('http')) {
          const rootUrl = BASE_URL.replace('/api/v1', '');
          mediaUrl = `${rootUrl}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
        }

        return {
          ...story,
          author_id: authorId,
          author: author,
          media: {
             ...story.media,
             url: mediaUrl,
             type: story.media?.type || (mediaUrl.match(/\.(mp4|mov|wmv|avi|flv|mkv|webm)$/i) ? 'video' : 'image')
          }
        };
      });

      return {
        author,
        stories: normalizedItems
      };
    });

    // Sort so user's story is first, then by latest story date
    return groups.sort((a, b) => {
      const aId = (a.author?._id || a.author?.id || "").toString().toLowerCase();
      const bId = (b.author?._id || b.author?.id || "").toString().toLowerCase();
      const myId = (user?._id || user?.id || "").toString().toLowerCase();
      
      if (aId === myId) return -1;
      if (bId === myId) return 1;
      
      const getLatestTime = (g: any) => {
        const dateStr = g.stories[0]?.createdAt || g.stories[0]?.created_at;
        const time = new Date(dateStr).getTime();
        return isNaN(time) ? 0 : time;
      };

      return getLatestTime(b) - getLatestTime(a);
    });
  }, [stories, user]);

  const StorySection = () => {
    const myGroup = groupedStories.find(g => g.author._id === user?._id || g.author._id === user?.id);
    const otherGroups = groupedStories.filter(g => g.author._id !== user?._id && g.author._id !== user?.id);

    const handleOpenGroup = (groupStories: Story[]) => {
      setSelectedStoryGroup(groupStories);
      setIsStoryViewerVisible(true);
    };

    return (
      <View style={[styles.storyContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {/* Fixed User Story Slot */}
        <TouchableOpacity 
          style={styles.fixedStory} 
          onPress={() => myGroup ? handleOpenGroup(myGroup.stories) : setIsCreateStoryVisible(true)}
        >
          <View style={[styles.avatarRing, { borderColor: myGroup ? theme.tint : theme.border }]}>
            <Image 
              source={{ uri: getAvatarUrl(user || { nama: 'Fajar' }, true) }} 
              style={styles.storyAvatar} 
            />
            {!myGroup && (
              <View style={[styles.plusIcon, { backgroundColor: theme.tint }]}>
                <Plus size={12} color="#FFF" />
              </View>
            )}
          </View>
          <Text style={[styles.storyName, { color: theme.text }]} numberOfLines={1}>
            {myGroup ? 'Cerita Anda' : 'Buat Cerita'}
          </Text>
        </TouchableOpacity>

        {/* Separator Divider */}
        {otherGroups.length > 0 && (
          <View style={[styles.storyDivider, { backgroundColor: theme.border }]} />
        )}

        {/* Scrollable Other Stories */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.storyContent}
        >
          {otherGroups.map((group, index) => (
            <TouchableOpacity 
              key={group.author?._id || group.author?.id || `group-${index}`} 
              style={styles.storyItem}
              onPress={() => handleOpenGroup(group.stories)}
            >
              <View style={[styles.avatarRing, { borderColor: theme.tint }]}>
                <Image 
                  source={{ uri: getAvatarUrl(group.author, true) }} 
                  style={styles.storyAvatar} 
                />
              </View>
              <Text style={[styles.storyName, { color: theme.text }]} numberOfLines={1}>
                {group.author.nama}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.centerContainer}>
      {error ? (
        <>
          <Text style={[styles.errorText, { color: theme.description }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.tint }]} onPress={() => fetchPosts()}>
            <RefreshCcw size={16} color="#FFF" />
            <Text style={styles.retryButtonText}>Coba Lagi</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={[styles.emptyText, { color: theme.description }]}>Belum ada postingan baru.</Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" backgroundColor={theme.tint} />
      {isLoading && !isRefreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlashList
          data={posts as any}
          renderItem={({ item }: any) => (
            <PostCard 
              post={item} 
              onDeleteSuccess={() => handleDeleteSuccess(item._id)} 
            />
          )}
          // @ts-ignore
          estimatedItemSize={350}
          ListHeaderComponent={<StorySection />}
          ListEmptyComponent={!isLoading ? EmptyState : (null as any)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={() => fetchPosts(true)} 
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        />
      )}

      {/* Modals */}
      <CreateStoryModal 
        isVisible={isCreateStoryVisible} 
        onClose={() => setIsCreateStoryVisible(false)}
        onSuccess={() => fetchStories()}
      />
      
      <StoryViewer 
        isVisible={isStoryViewerVisible}
        stories={selectedStoryGroup}
        isPaused={isViewersVisible}
        onClose={() => setIsStoryViewerVisible(false)}
        onViewersClick={(id) => {
          setActiveStoryIdForViewers(id);
          setIsViewersVisible(true);
        }}
      />

      <StoryViewersModal 
        isVisible={isViewersVisible}
        storyId={activeStoryIdForViewers}
        onClose={() => setIsViewersVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  storyContainer: {
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 5,
    flexDirection: 'row', // Align fixed story and scrollable list
    alignItems: 'center',
    // Elevated Fresh Look
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  fixedStory: {
    paddingLeft: 15,
    alignItems: 'center',
    width: 90,
  },
  storyDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 5,
  },
  storyContent: {
    paddingRight: 15,
    gap: 15,
    paddingLeft: 5,
  },
  storyItem: {
    alignItems: 'center',
    width: 75,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 6,
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  plusIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyName: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});
