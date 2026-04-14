import { CommentModal } from '@/components/CommentModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { MessageCircle, MoreHorizontal, Repeat, Share2, ThumbsUp } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { syncRecursiveCount, recursiveReplyCounts, notifyPostCommentsUpdated } from '../utils/commentSyncStore';
import { BASE_URL } from '../utils/api';
import { getAvatarUrl } from '../utils/avatar';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type PostMedia = {
  url: string;
  type: string;
  thumbnail_url?: string;
};

export type PostData = {
  _id: string;
  author: {
    _id: string;
    nim: string;
    nama: string;
    program_studi: string;
    avatar?: string;
    avatar_url?: string;
    jenis_kelamin?: string;
  };
  caption: string;
  media: PostMedia[];
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  shares_count: number;
  createdAt: string;
  is_liked?: boolean;
};



/**
 * Sub-component to handle individual media items (Image or Video)
 */
const PostMediaItem = ({ media, theme }: { media: PostMedia; theme: any }) => {
  const isVideo = media.type === 'video';
  
  const player = useVideoPlayer(media.url, (player) => {
    if (isVideo) {
      player.loop = true;
      player.muted = true;
      player.play();
    }
  });

  if (isVideo) {
    return (
      <VideoView
        player={player}
        style={styles.postMediaItem}
        contentFit="cover"
        allowsFullscreen
        allowsPictureInPicture
      />
    );
  }

  return (
    <Image 
      source={{ uri: media.url }} 
      style={styles.postMediaItem} 
      contentFit="cover"
      transition={200}
    />
  );
};

export const PostCard = ({ post }: { post: PostData }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token } = useAuth();
  const router = useRouter();

  // Local State for Like
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.likes_count);
  const [activeIndex, setActiveIndex] = useState(0);

  // Sync isLiked only when post_id or post.is_liked changes
  React.useEffect(() => {
    setIsLiked(post.is_liked || false);
  }, [post._id, post.is_liked]);

  // Sync likeCount when post.likes_count changes (e.g. from parent's socket update)
  React.useEffect(() => {
    setLikeCount(post.likes_count);
  }, [post._id, post.likes_count]);

  // Sync commentsCount when post.comments_count changes (e.g. from refresh or parent update)
  React.useEffect(() => {
    setCommentsCount(post.comments_count);
  }, [post._id, post.comments_count]);

  const [isCommentModalVisible, setIsCommentModalVisible] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const processedCommentIds = React.useRef<Set<string>>(new Set());

  const { lastEvent } = useSocket();
  const { user } = useAuth();

  React.useEffect(() => {
    if (!lastEvent) return;


    if (lastEvent.type === 'new_comment') {
      const eventPostId = lastEvent.data?.post_id ?? lastEvent.data?.postId;
      const rawCmt = lastEvent.data?.comment ?? lastEvent.data;
      const commentId = rawCmt?._id;
      
      // Jika modal sedang terbuka, biarkan modal yang mengurus penghitungan.
      // Kita hanya mendaftarkan ID nya agar tidak dihitung ulang nanti.
      if (commentId) {
        if (isCommentModalVisible) {
          processedCommentIds.current.add(commentId);
          return;
        }

        // Jika modal tertutup dan ID belum diproses, baru kita tambahkan ke count.
        if (eventPostId === post._id && !processedCommentIds.current.has(commentId)) {
          processedCommentIds.current.add(commentId);
          const authorId = rawCmt?.author?._id || rawCmt?.author?.id;
          const currentUserId = user?._id || user?.id;

          if (authorId !== currentUserId) {
            setCommentsCount((prev) => prev + 1);
          }
        }
      }
    }
  }, [lastEvent, post._id, user?.id, user?._id, isCommentModalVisible]);
  
  // Zero-Delay: Pre-fetch recursive counts silently ONLY when user starts to touch the button
  const handlePreSync = () => {
    if (commentsCount > 0 && token) {
      const prefetch = async () => {
        try {
          const res = await fetch(`${BASE_URL}/posts/${post._id}/comments`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const result = await res.json();
          if (res.ok) {
            const topComments = result.data.comments || [];
            notifyPostCommentsUpdated(post._id, topComments); // BROADCAST DATA KE SELURUH APLIKASI
            topComments.forEach((c: any) => {
              if (c.replies_count > 0 && recursiveReplyCounts[c._id] === undefined) {
                syncRecursiveCount(post._id, c._id, token);
              }
            });
          }
        } catch (e) {}
      };
      prefetch();
    }
  };

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handleLike = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevLiked = isLiked;
    const prevCount = likeCount;

    if (isLiked) {
      setLikeCount(prev => prev - 1);
      setIsLiked(false);
    } else {
      setLikeCount(prev => prev + 1);
      setIsLiked(true);
      scale.value = withSequence(
        withSpring(1.5, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 10, stiffness: 100 })
      );
    }

    try {
      await fetch(`${BASE_URL}/posts/${post._id}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
    } catch {
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
    }
  };

  const handleOpenComments = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCommentModalVisible(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const authorAvatar = getAvatarUrl(post.author);
  const mediaCount = post.media?.length || 0;

  const handleScroll = (event: any) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / (SCREEN_WIDTH - 20)); // -20 for margins
    setActiveIndex(index);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.authorInfo}
          onPress={() => router.push({
            pathname: "/user/[id]",
            params: { 
              id: post.author._id,
              initialName: post.author.nama, 
              initialNim: post.author.nim, 
              initialAvatar: getAvatarUrl(post.author, (post.author.jenis_kelamin || '').toLowerCase() === 'laki-laki') 
            }
          })}
          activeOpacity={0.7}
        >
          <Image source={{ uri: authorAvatar }} style={styles.avatar} />
          <View>
            <Text style={[styles.name, { color: theme.text }]}>{post.author.nama}</Text>
            <Text style={[styles.subText, { color: theme.description }]}>
              {post.author.nim} • {post.author.program_studi}
            </Text>
            <Text style={[styles.subText, { color: theme.description, fontSize: 11 }]}>
              {formatDate(post.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity>
          <MoreHorizontal size={20} color={theme.description} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <Text style={[styles.content, { color: theme.text }]}>{post.caption}</Text>

      {/* Post Media Rendering (Carousel for multiple) */}
      {mediaCount > 0 && (
        <View>
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={styles.mediaContainer}
          >
            {post.media.map((item, index) => (
              <View key={index} style={styles.mediaSlide}>
                <PostMediaItem media={item} theme={theme} />
              </View>
            ))}
          </ScrollView>
          
          {/* Pagination Dots */}
          {mediaCount > 1 && (
            <View style={styles.paginationRow}>
              {post.media.map((_, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.dot, 
                    { backgroundColor: index === activeIndex ? theme.primary : theme.border }
                  ]} 
                />
              ))}
            </View>
          )}

          {/* Page Counter (Floating) */}
          {mediaCount > 1 && (
            <View style={styles.mediaCounter}>
              <Text style={styles.counterText}>{activeIndex + 1}/{mediaCount}</Text>
            </View>
          )}
        </View>
      )}

      {/* Stats */}
      <View style={[styles.statsRow, { borderBottomColor: theme.border }]}>
        <View style={styles.statItem}>
          <View style={[styles.likeBadge, { backgroundColor: isLiked ? '#1D4289' : theme.tint }]}>
            <ThumbsUp size={10} color="#FFF" />
          </View>
          <Text style={[styles.statText, { color: theme.description }]}>{likeCount}</Text>
        </View>
        <Text style={[styles.statText, { color: theme.description }]}>{commentsCount} Komentar</Text>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleLike}
          activeOpacity={0.7}
        >
          <Animated.View style={animatedStyle}>
            <ThumbsUp 
              size={18} 
              color={isLiked ? theme.primary : theme.description} 
              fill={isLiked ? theme.primary : 'transparent'}
            />
          </Animated.View>
          <Text style={[
            styles.actionText, 
            { color: isLiked ? theme.primary : theme.description }
          ]}>
            Suka
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleOpenComments}>
          <MessageCircle size={18} color={theme.description} />
          <Text style={[styles.actionText, { color: theme.description }]}>Komentar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Repeat size={18} color={theme.description} />
          <Text style={[styles.actionText, { color: theme.description }]}>Repostat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Share2 size={18} color={theme.description} />
          <Text style={[styles.actionText, { color: theme.description }]}>Bagikan</Text>
        </TouchableOpacity>
      </View>

      <CommentModal
        isVisible={isCommentModalVisible}
        onClose={() => setIsCommentModalVisible(false)}
        postId={post._id}
        initialCommentsCount={commentsCount}
        onCountChange={(count) => setCommentsCount(count)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#F1F3F5',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 13,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  mediaContainer: {
    width: '100%',
    height: 320,
    marginBottom: 12,
  },
  mediaSlide: {
    width: SCREEN_WIDTH - 20, // Margin adjusted
    height: 320,
    backgroundColor: '#000',
  },
  postMediaItem: {
    width: '100%',
    height: '100%',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mediaCounter: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  counterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  statText: {
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
});
