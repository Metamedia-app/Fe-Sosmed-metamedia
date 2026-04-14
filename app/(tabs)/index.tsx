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
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const DUMMY_STORIES = [
  { id: '0', name: 'Cerita Anda', avatar: 'https://avatar.iran.liara.run/public/boy?username=fajar', isUser: true },
  { id: '1', name: 'Budi', avatar: 'https://avatar.iran.liara.run/public/boy?username=budi' },
  { id: '2', name: 'Siti', avatar: 'https://avatar.iran.liara.run/public/girl?username=siti' },
  { id: '3', name: 'Amin', avatar: 'https://avatar.iran.liara.run/public/boy?username=amin' },
  { id: '4', name: 'Dewi', avatar: 'https://avatar.iran.liara.run/public/girl?username=dewi' },
  { id: '5', name: 'Hadi', avatar: 'https://avatar.iran.liara.run/public/boy?username=hadi' },
];

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, refreshSignal, user } = useAuth();
  const { lastEvent } = useSocket();
  
  const [posts, setPosts] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
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
        // Data is in result.data.posts
        const fetchedPosts = result.data?.posts || [];
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
  }, [token]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Listen for global refresh signal from CreatePostModal
  useEffect(() => {
    if (refreshSignal > 0) {
      fetchPosts(true);
    }
  }, [refreshSignal]);

  // Listen for socket events — keep feed live without full reload
  useEffect(() => {
    if (!lastEvent) return;

    // New post from anyone: prepend to feed
    if (lastEvent.type === 'new_post') {
      const newPost: PostData = lastEvent.data?.post ?? lastEvent.data;
      if (!newPost?._id) return;
      setPosts((prev) => {
        if (prev.some((p) => p._id === newPost._id)) return prev;
        return [newPost, ...prev];
      });
    }

    // Like update: sync like count on the relevant post card
    if (lastEvent.type === 'like_update') {
      const { post_id, likes_count } = lastEvent.data ?? {};
      if (!post_id) return;
      setPosts((prev) =>
        prev.map((p) =>
          p._id === post_id ? { ...p, likes_count: likes_count ?? p.likes_count } : p
        )
      );
    }

    // NOTE: new_comment is intentionally NOT handled here.
    // PostCard manages its own commentsCount via socket listener + onCountChange from CommentModal.
    // Updating posts[] here would reset PostCard’s local state and cause double-counting.
  }, [lastEvent]);

  const StorySection = () => {
    const userStory = DUMMY_STORIES[0];
    const otherStories = DUMMY_STORIES.slice(1);

    return (
      <View style={[styles.storyContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {/* Fixed User Story */}
        <TouchableOpacity style={styles.fixedStory}>
          <View style={[styles.avatarRing, { borderColor: theme.border }]}>
            <Image 
              source={{ uri: getAvatarUrl(user || { nama: 'Fajar' }, true) }} 
              style={styles.storyAvatar} 
            />
            <View style={[styles.plusIcon, { backgroundColor: theme.tint }]}>
              <Plus size={12} color="#FFF" />
            </View>
          </View>
          <Text style={[styles.storyName, { color: theme.text }]} numberOfLines={1}>
            Cerita Anda
          </Text>
        </TouchableOpacity>

        {/* Separator Divider */}
        <View style={[styles.storyDivider, { backgroundColor: theme.border }]} />

        {/* Scrollable Other Stories */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.storyContent}
        >
          {otherStories.map((story) => (
            <TouchableOpacity key={story.id} style={styles.storyItem}>
              <View style={[styles.avatarRing, { borderColor: theme.tint }]}>
                <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
              </View>
              <Text style={[styles.storyName, { color: theme.text }]} numberOfLines={1}>
                {story.name}
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
        <FlashList<PostData>
          data={posts}
          renderItem={({ item }) => <PostCard post={item} />}
          estimatedItemSize={350}
          ListHeaderComponent={<StorySection />}
          ListEmptyComponent={!isLoading ? <EmptyState /> : null}
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
