import { CommentModal } from '@/components/CommentModal';
import { ShareModal } from '@/components/ShareModal';
import CreatePostModal from '@/components/CreatePostModal';
import PostActionModal from '@/components/PostActionModal';
import ReportPostModal from '@/components/ReportPostModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MessageCircle, MoreHorizontal, Repeat, Share2, ThumbsUp } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import { Alert, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring
} from 'react-native-reanimated';
import { BASE_URL } from '../utils/api';
import { getAvatarUrl } from '../utils/avatar';
import { notifyPostCommentsUpdated, recursiveReplyCounts, syncRecursiveCount } from '../utils/commentSyncStore';
import { deletePost } from '../utils/post';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type PostMedia = {
  url: string;
  type: string;
  thumbnail_url?: string;
};

export type PostAuthor = {
  _id: string;
  id?: string;
  nim: string;
  nama: string;
  program_studi?: string;
  avatar?: string;
  avatar_url?: string;
  jenis_kelamin?: string;
};

export type PostData = {
  _id: string;
  author: PostAuthor;
  caption: string;
  media: PostMedia[];
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  shares_count: number;
  createdAt: string;
  is_liked?: boolean;
  is_reposted?: boolean;
  type?: 'original' | 'repost';
  original_post_id?: {
    _id: string;
    author_id: PostAuthor;
    caption: string;
    media: PostMedia[];
    likes_count: number;
    comments_count: number;
    reposts_count: number;
    shares_count: number;
    is_liked?: boolean;
    is_reposted?: boolean;
    createdAt: string;
  } | null;
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

/**
 * Sub-component to render the original post content if it's a repost
 */
const OriginalPostBlock = React.memo(({ originalPost, theme, onAuthorPress }: { 
  originalPost: any; 
  theme: any;
  onAuthorPress: (author: PostAuthor) => void;
}) => {
  if (!originalPost) return null;

  const author = originalPost.author_id || originalPost.author;
  const avatarUrl = getAvatarUrl(author);
  const mediaCount = originalPost.media?.length || 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <View style={[styles.originalPostContainer, { borderColor: theme.border }]}>
      <TouchableOpacity 
        style={styles.originalAuthorInfo}
        onPress={() => onAuthorPress(author)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: avatarUrl }} style={styles.originalAvatar} />
        <View>
          <Text style={[styles.originalName, { color: theme.text }]}>{author?.nama}</Text>
          <Text style={[styles.originalSubText, { color: theme.description }]}>
            {author?.nim} • {formatDate(originalPost.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>

      {originalPost.caption ? (
        <Text style={[styles.originalContent, { color: theme.text }]} numberOfLines={3}>
          {originalPost.caption}
        </Text>
      ) : null}

      {mediaCount > 0 && (
        <View style={styles.originalMediaPreview}>
          <Image 
            source={{ uri: originalPost.media[0].url }} 
            style={styles.originalMediaImage}
            contentFit="cover"
          />
          {mediaCount > 1 && (
            <View style={styles.originalMediaOverlay}>
              <Text style={styles.originalMediaCount}>+{mediaCount - 1}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

export const PostCard = ({ 
  post, 
  onDeleteSuccess, 
  initialShowComments = false,
  targetCommentId
}: { 
  post: PostData; 
  onDeleteSuccess?: () => void;
  initialShowComments?: boolean;
  targetCommentId?: string;
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, user, triggerRefresh } = useAuth();
  const router = useRouter();

  // === REPOST LOGIC ===
  // isRepost: this post object is itself a repost (type='repost')
  const isRepost = post.type === 'repost' && !!post.original_post_id;
  
  // targetId: the ID we hit the API with - always the ORIGINAL post
  const targetId = isRepost ? post.original_post_id!._id : post._id;

  // If user is viewing a post of type='repost', they (or someone) has already reposted it.
  // If it's THEIR repost (it's in their profile reposts tab), they have already reposted → always true.
  // For original posts in the feed: rely on API's is_reposted.
  const initialReposted = isRepost
    ? true  // This post IS a repost – current user owns it, so they've reposted
    : (post.is_reposted || false);

  // Counts always come from original post if available (correct total)
  const initialRepostCount = isRepost ? (post.original_post_id?.reposts_count ?? post.reposts_count) : post.reposts_count;
  const initialLikeCount = isRepost ? (post.original_post_id?.likes_count ?? post.likes_count) : post.likes_count;
  const initialCommentCount = isRepost ? (post.original_post_id?.comments_count ?? post.comments_count) : post.comments_count;
  const initialShareCount = isRepost ? (post.original_post_id?.shares_count ?? post.shares_count) : post.shares_count;

  const [likeCount, setLikeCount] = useState(initialLikeCount || 0);
  const [commentsCount, setCommentsCount] = useState(initialCommentCount || 0);
  const [sharesCount, setSharesCount] = useState(initialShareCount || 0);
  const [isReposted, setIsReposted] = useState(initialReposted || false);
  const [repostsCount, setRepostsCount] = useState(initialRepostCount || 0);
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCommentModalVisible, setIsCommentModalVisible] = useState(initialShowComments);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isProcessingRepost, setIsProcessingRepost] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const processedCommentIds = React.useRef<Set<string>>(new Set());

  const { lastEvent } = useSocket();

  // Sync isLiked only when post_id or post.is_liked changes
  React.useEffect(() => {
    setIsLiked(post.is_liked || false);
  }, [post._id, post.is_liked]);

  // Sync repost state when post changes
  React.useEffect(() => {
    const newReposted = isRepost ? true : (post.is_reposted || false);
    setIsReposted(newReposted);
    setRepostsCount(initialRepostCount || 0);
  }, [post._id]);

  // Sync likeCount when post.likes_count changes (e.g. from parent's socket update)
  React.useEffect(() => {
    setLikeCount(initialLikeCount || 0);
  }, [post._id, initialLikeCount]);

  // Sync shares count
  React.useEffect(() => {
    setSharesCount(initialShareCount || 0);
  }, [post._id, initialShareCount]);

  // Sync commentsCount when post.comments_count changes
  // We use a guard to prevent "jumping back" if the prop is stale but FE already has a newer count
  const lastSyncedPostId = React.useRef(post._id);
  // Sync commentsCount when post.comments_count changes
  useEffect(() => {
    // If modal is open, we trust the modal's internal counting and onCountChange updates
    if (isCommentModalVisible) return;

    if (initialCommentCount !== undefined && initialCommentCount !== commentsCount) {
      // Sync with prop if modal is closed and there's a mismatch
      // This is now safe because HomeScreen handles real-time socket updates for comments
      setCommentsCount(initialCommentCount);
    }
  }, [initialCommentCount, isCommentModalVisible]);

  React.useEffect(() => {
    if (!lastEvent) return;


    // 1. handle NEW_COMMENT
    if (lastEvent.type === 'new_comment') {
      const data = lastEvent.data ?? {};
      const eventPostId = data.post_id ?? data.postId ?? data.id;
      const rawCmt = data.comment ?? data;
      const commentId = rawCmt?._id;
      
      if (commentId && eventPostId === post._id && !processedCommentIds.current.has(commentId)) {
        processedCommentIds.current.add(commentId);
        
        // Prioritize absolute count if Backend sends it
        const serverCmtCount = data.comments_count ?? data.total_comments ?? data.comment_count;

        // Only update local state if we are NOT using the prop update (to avoid double count)
        // OR if the modal is open (since modal doesn't see props)
        if (isCommentModalVisible) {
          if (serverCmtCount !== undefined) {
             setCommentsCount(serverCmtCount);
          } else {
            const authorId = rawCmt?.author?._id || rawCmt?.author?.id;
            const currentUserId = user?._id || user?.id;
            if (authorId !== currentUserId) {
              setCommentsCount((prev) => prev + 1);
            }
          }
        }
      }
    }

    // 1b. handle NEW_POST (for repost increments)
    if (lastEvent.type === 'new_post') {
      const newPost: PostData = lastEvent.data?.post ?? lastEvent.data;
      if (newPost?.type === 'repost' && newPost.original_post_id?._id === targetId) {
        // Prioritize absolute count from the repost event data
        const serverRepostCount = newPost.original_post_id.reposts_count;
        if (serverRepostCount !== undefined) {
          setRepostsCount(serverRepostCount);
        } else {
          setRepostsCount((prev) => prev + 1);
        }
      }
    }

    // 2. handle LIKE_UPDATE
    if (lastEvent.type === 'like_update') {
      const { post_id, postId, id, likes_count, like_count } = lastEvent.data;
      const eventPostId = post_id ?? postId ?? id;
      const finalLikes = likes_count ?? like_count;
      if (eventPostId === targetId && finalLikes !== undefined) {
        setLikeCount(finalLikes);
      }
    }

    // 3. handle REPOST_UPDATE
    if (lastEvent.type === 'repost_update') {
      const { post_id, postId, id, reposts_count, count, repost_count } = lastEvent.data;
      const eventPostId = post_id ?? postId ?? id;
      const finalCount = reposts_count ?? count ?? repost_count;

      if (eventPostId === targetId && finalCount !== undefined) {
        setRepostsCount(finalCount);
      }
    }

    // 4. handle SHARE_UPDATE
    if (lastEvent.type === 'share_update') {
      const { post_id, postId, id, shares_count, share_count } = lastEvent.data;
      const eventPostId = post_id ?? postId ?? id;
      const finalShares = shares_count ?? share_count;
      if (eventPostId === targetId && finalShares !== undefined) {
        setSharesCount(finalShares);
      }
    }
  }, [lastEvent, post._id, targetId, user?.id, user?._id, isCommentModalVisible]);
  
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

  const handleRepost = async () => {
    if (isProcessingRepost) return;

    // Block if viewing own original post
    const originalAuthorId = isRepost
      ? (post.original_post_id?.author_id?._id || post.original_post_id?.author_id?.id)
      : (post.author?._id || post.author?.id);

    if (originalAuthorId === (user?._id || user?.id)) {
      Alert.alert('Info', 'Anda tidak dapat me-repost postingan sendiri');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessingRepost(true);
    const prevCount = repostsCount;
    const prevReposted = isReposted;

    // Optimistic update BEFORE API call
    if (isReposted) {
      // Will UNREPOST - count goes down, turn off
      setRepostsCount(prev => Math.max(0, prev - 1));
      setIsReposted(false);
    } else {
      // Will REPOST - count goes up, turn on
      setRepostsCount(prev => prev + 1);
      setIsReposted(true);
    }

    try {
      // POST = new repost, DELETE = unrepost
      // Backend needs: POST /posts/:id/repost AND DELETE /posts/:id/repost
      const method = prevReposted ? 'DELETE' : 'POST';
      const res = await fetch(`${BASE_URL}/posts/${targetId}/repost`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const result = await res.json();
      if (res.ok && result.success) {
        // Sync count to server truth
        if (result.data?.original_reposts_count !== undefined) {
          setRepostsCount(result.data.original_reposts_count);
        }
        // Confirm state based on what we intended
        setIsReposted(!prevReposted);
        
        // Notify other screens (like Profile tab) to re-fetch lists
        triggerRefresh();
      } else {
        throw new Error(result.message || 'Gagal');
      }
    } catch (e: any) {
      // Revert optimistic update on failure
      setRepostsCount(prevCount);
      setIsReposted(prevReposted);
    } finally {
      setIsProcessingRepost(false);
    }
  };

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsShareModalVisible(true);
  };

  const handleShareSuccess = async () => {
    const prevCount = sharesCount;
    setSharesCount(prev => prev + 1);

    try {
      const res = await fetch(`${BASE_URL}/posts/${post._id}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (!res.ok) throw new Error();
    } catch {
      setSharesCount(prevCount);
    }
  };

  const handleMoreOptions = () => {
    setIsActionModalVisible(true);
  };

  const confirmDelete = () => {
    // Confirmation removed for instant experience
    handleDelete();
  };

  const handleDelete = async () => {
    if (!token) return;
    
    const postId = post._id || (post as any).id;
    if (!postId) return;

    setIsDeleting(true);
    try {
      const res = await deletePost(postId, token);
      if (res.success) {
        // Success: Trigger callback immediately without Alert
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }
      }
    } catch (error) {
      console.error('[DELETE] Unexpected Error:', error);
    } finally {
      setIsDeleting(false);
    }
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
      {/* Repost Header Indicator */}
      {post.type === 'repost' && (
        <View style={styles.repostHeader}>
          <Repeat size={14} color={theme.description} />
          <Text style={[styles.repostHeaderText, { color: theme.description }]}>
            Sudah memposting ulang
          </Text>
        </View>
      )}

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
              {post.author.nim} {post.author.program_studi ? `• ${post.author.program_studi}` : ''}
            </Text>
            <Text style={[styles.subText, { color: theme.description, fontSize: 11 }]}>
              {formatDate(post.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMoreOptions}>
          <MoreHorizontal size={20} color={theme.description} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {post.caption ? (
        <Text style={[styles.content, { color: theme.text }]}>{post.caption}</Text>
      ) : null}

      {/* Repost Block */}
      {post.type === 'repost' && post.original_post_id && (
        <View style={styles.originalPostWrapper}>
          <OriginalPostBlock 
            originalPost={post.original_post_id} 
            theme={theme}
            onAuthorPress={(author) => router.push({
              pathname: "/user/[id]",
              params: { 
                id: author._id,
                initialName: author.nama, 
                initialNim: author.nim, 
                initialAvatar: getAvatarUrl(author, (author.jenis_kelamin || '').toLowerCase() === 'laki-laki') 
              }
            })}
          />
        </View>
      )}

      {/* Post Media Rendering (Carousel for multiple) - Only for original posts */}
      {post.type !== 'repost' && mediaCount > 0 && (
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
        <View style={styles.leftStats}>
          <View style={styles.statItem}>
            <View style={[styles.likeBadge, { backgroundColor: isLiked ? '#1D4289' : theme.tint }]}>
              <ThumbsUp size={10} color="#FFF" />
            </View>
            <Text style={[styles.statText, { color: theme.description }]}>{likeCount}</Text>
          </View>
        </View>
        <View style={styles.rightStats}>
          <Text style={[styles.statText, { color: theme.description }]}>{commentsCount} Komentar</Text>
          <Text style={[styles.statSeparator, { color: theme.border }]}>•</Text>
          <Text style={[styles.statText, { color: theme.description }]}>{repostsCount} Repost</Text>
          <Text style={[styles.statSeparator, { color: theme.border }]}>•</Text>
          <Text style={[styles.statText, { color: theme.description }]}>{sharesCount} Share</Text>
        </View>
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
        {/* Repost Button: Hide ONLY if user is the ORIGINAL AUTHOR */}
        {(() => {
          const originalAuthorId = isRepost
            ? (post.original_post_id?.author_id?._id || post.original_post_id?.author_id?.id)
            : (post.author?._id || post.author?.id);
          const myId = user?._id || user?.id;
          if (originalAuthorId === myId) return null;
          return (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRepost}
              activeOpacity={0.7}
              disabled={isProcessingRepost}
            >
              <Repeat
                size={20}
                color={isReposted ? theme.primary : theme.text}
              />
              <Text style={[
                styles.actionText,
                { color: isReposted ? theme.primary : theme.text }
              ]}>
                {repostsCount}
              </Text>
            </TouchableOpacity>
          );
        })()}
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
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
        targetCommentId={targetCommentId}
      />

      <ShareModal
        isVisible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        postId={post._id}
        postTitle={post.caption}
        onShareSuccess={handleShareSuccess}
      />

      <CreatePostModal
        isVisible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        postToEdit={post}
      />

      <PostActionModal 
        isVisible={isActionModalVisible}
        onClose={() => setIsActionModalVisible(false)}
        isOwner={(() => {
          // Normalize IDs to strings for comparison
          const authorId = String(post.author?._id || post.author?.id || (typeof post.author === 'string' ? post.author : ''));
          const currentUserId = String(user?._id || user?.id || '');
          const match = authorId === currentUserId && currentUserId !== '';
          
          if (isActionModalVisible) {
            console.log(`[OWNER CHECK] Author: "${authorId}", Me: "${currentUserId}", Match: ${match}`);
          }
          return match;
        })()}
        onEdit={() => setIsEditModalVisible(true)}
        onDelete={() => {
          console.log(`[ACTION] Delete clicked for: ${post._id}`);
          confirmDelete();
        }}
        onReport={() => setIsReportModalVisible(true)}
        onCopyLink={() => Alert.alert('Berhasil', 'Tautan berhasil disalin!')}
      />

      <ReportPostModal
        isVisible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
        postId={post._id}
        token={token || ''}
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
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  leftStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statSeparator: {
    marginHorizontal: 4,
    fontSize: 13,
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
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 8,
    gap: 6,
  },
  repostHeaderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  originalPostWrapper: {
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  originalPostContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  originalAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: '#F1F3F5',
  },
  originalName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  originalSubText: {
    fontSize: 11,
  },
  originalContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  originalMediaPreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  originalMediaImage: {
    width: '100%',
    height: '100%',
  },
  originalMediaOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  originalMediaCount: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
