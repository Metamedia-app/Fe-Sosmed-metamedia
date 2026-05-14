import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp, MessageCircle, Send, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BASE_URL } from '../utils/api';
import { getAvatarUrl } from '../utils/avatar';
import { recursiveReplyCounts, postCommentsCache, broadcastPostStatsUpdate } from '../utils/commentSyncStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Author {
  _id: string;
  nama: string;
  avatar_url?: string;
}

interface Comment {
  _id: string;
  body: string;
  parent_id: string | null;
  top_level_id?: string | null;
  replies_count: number;
  author: Author;
  createdAt: string;
}

interface Reply extends Comment {
  parentAuthorName?: string;
}

interface CommentModalProps {
  isVisible: boolean;
  onClose: () => void;
  postId: string;
  initialCommentsCount: number;
  onCountChange?: (count: number) => void;
  targetCommentId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CommentModal = ({
  isVisible,
  onClose,
  postId,
  initialCommentsCount,
  onCountChange,
  targetCommentId,
}: CommentModalProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, user } = useAuth();
  const { lastEvent } = useSocket();
  const inputRef = React.useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalComments, setTotalComments] = useState(initialCommentsCount);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  
  const itemLayouts = useRef<Record<string, number>>({});
  const flashAnim = useRef(new Animated.Value(0)).current;

  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [loadingReply, setLoadingReply] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [repliesCount, setRepliesCount] = useState<Record<string, number>>({});

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
    topLevelId?: string;
  } | null>(null);

  const processedIds = useRef<Set<string>>(new Set());
  const authHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // ── Propagate count changes ───────────────────────────────────────────────
  useEffect(() => { onCountChange?.(totalComments); }, [totalComments]);

  // Sync with prop (Source of Truth from HomeScreen/PostCard)
  useEffect(() => {
    setTotalComments(initialCommentsCount);
  }, [initialCommentsCount]);

  // ── Main visibility effect ────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) return;
    setNewComment('');
    loadComments();
    const timer = setInterval(() => loadComments(true), 20000);
    return () => clearInterval(timer);
  }, [isVisible, postId]);

  useEffect(() => {
    processedIds.current = new Set();
    setReplies({});
    setExpanded({});
    setLoadingReply({});
    setComments([]);
  }, [postId]);

  // ── Fetch top-level comments ──────────────────────────────────────────────
  const loadComments = async (silent = false) => {
    if (!postId || !token) return;
    if (!silent) setIsLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/posts/${postId}/comments`, { headers: authHeaders });
      const result = await res.json();

      if (res.ok) {
        const loaded: Comment[] = (result.data.comments || []).map((c: any) => ({
          ...c,
          createdAt: c.createdAt || c.created_at,
        }));
        postCommentsCache[postId] = loaded;

        if (silent) {
          setComments(prev => {
            const newOnes = loaded.filter(l => !prev.some(p => p._id === l._id));
            if (newOnes.length === 0) return prev;
            return [...newOnes, ...prev];
          });
        } else {
          setComments(loaded);
        }

        const counts: Record<string, number> = {};
        loaded.forEach(c => {
          counts[c._id] = c.replies_count;
          recursiveReplyCounts[c._id] = c.replies_count;
        });
        setRepliesCount(prev => ({ ...prev, ...counts }));
      }
    } catch (err) {
      console.error('loadComments error:', err);
    } finally {
      setIsLoading(false);
      if (targetCommentId) {
        setTimeout(async () => {
          let targetY = itemLayouts.current[targetCommentId];
          if (targetY === undefined) {
            const parentId = Object.keys(replies).find(key => 
              replies[key].some(r => r._id === targetCommentId)
            );
            if (parentId) {
              setExpanded(prev => ({ ...prev, [parentId]: true }));
              await new Promise(resolve => setTimeout(resolve, 500));
              targetY = itemLayouts.current[targetCommentId];
            }
          }
          if (targetY !== undefined) {
            scrollViewRef.current?.scrollTo({ y: targetY - 20, animated: true });
            setHighlightedId(targetCommentId);
            Animated.sequence([
              Animated.timing(flashAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
              Animated.delay(2000),
              Animated.timing(flashAnim, { toValue: 0, duration: 800, useNativeDriver: false })
            ]).start(() => setHighlightedId(null));
          }
        }, 300);
      }
    }
  };

  // ── Fetch replies ────────────────────────────────────────────────────────
  const loadReplies = async (commentId: string) => {
    setLoadingReply(prev => ({ ...prev, [commentId]: true }));
    try {
      const allFetched: any[] = [];
      const authorMap: Record<string, string> = {};
      const parentCmt = comments.find(c => c._id === commentId);
      if (parentCmt) authorMap[commentId] = parentCmt.author?.nama || 'Anonim';

      let queue = [commentId];
      const processedParents = new Set<string>();

      while (queue.length > 0) {
        const currentBatch = [...queue];
        queue = [];
        const batchResults = await Promise.all(
          currentBatch.map(id => 
            fetch(`${BASE_URL}/posts/${postId}/comments?parent_id=${id}`, { headers: authHeaders })
              .then(res => res.json())
              .catch(() => null)
          )
        );
        for (const res of batchResults) {
          if (!res?.success || !res.data) continue;
          const rawList = res.data.replies || res.data.comments || [];
          for (const c of rawList) {
            if (c._id === commentId) continue;
            allFetched.push(c);
            if (c.author?.nama) authorMap[c._id] = c.author.nama;
            if ((c.replies_count || 0) > 0 && !processedParents.has(c._id)) {
              queue.push(c._id);
              processedParents.add(c._id);
            }
          }
        }
        if (processedParents.size > 50) break;
      }

      const seen = new Set<string>();
      const finalFlat: Reply[] = allFetched
        .filter(c => {
          if (seen.has(c._id)) return false;
          seen.add(c._id);
          return true;
        })
        .map(c => ({
          ...c,
          createdAt: c.createdAt || c.created_at,
          parentAuthorName: (c.parent_id && c.parent_id !== commentId) ? authorMap[c.parent_id] : undefined
        }))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      setReplies(prev => ({ ...prev, [commentId]: finalFlat }));
      setRepliesCount(prev => ({
        ...prev,
        [commentId]: Math.max(prev[commentId] || 0, finalFlat.length)
      }));
    } catch (err) {
      console.error('loadReplies error:', err);
    } finally {
      setLoadingReply(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const toggleReplies = (commentId: string) => {
    if (expanded[commentId]) {
      setExpanded(prev => ({ ...prev, [commentId]: false }));
    } else {
      setExpanded(prev => ({ ...prev, [commentId]: true }));
      loadReplies(commentId);
    }
  };

  // ── Socket: live update ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible || !lastEvent || lastEvent.type !== 'new_comment') return;

    const data = lastEvent.data ?? {};
    const rawCmt = data.comment ?? data;
    const eventPostId = data.post_id ?? data.postId ?? data.id;
    
    if (!rawCmt?._id || eventPostId !== postId) return;
    if (processedIds.current.has(rawCmt._id)) return;
    processedIds.current.add(rawCmt._id);

    const newCmt: Comment = { ...rawCmt, createdAt: rawCmt.createdAt || rawCmt.created_at };
    const authorId = rawCmt?.author?._id || rawCmt?.author?.id;
    const currentUserId = user?._id || user?.id;

    if (authorId === currentUserId && authorId !== undefined) {
      return;
    }

    if (!newCmt.parent_id) {
      setComments(prev => {
        if (prev.some(c => c._id === newCmt._id)) return prev;
        setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 100);
        return [newCmt, ...prev];
      });
      // totalComments synced via initialCommentsCount prop from PostCard
    } else {
      const threadId = newCmt.top_level_id || newCmt.parent_id;
      if (threadId) {
        setRepliesCount(prev => ({ ...prev, [threadId]: (prev[threadId] || 0) + 1 }));
        if (expanded[threadId]) {
          setReplies(prev => {
            const thread = prev[threadId] || [];
            if (thread.some(r => r._id === newCmt._id)) return prev;
            const parentReply = thread.find(r => r._id === (newCmt.parent_id || threadId));
            return {
              ...prev,
              [threadId]: [...thread, { ...newCmt, parentAuthorName: parentReply?.author?.nama }],
            };
          });
        }
        setComments(prev =>
          prev.map(c => c._id === threadId ? { ...c, replies_count: (c.replies_count || 0) + 1 } : c)
        );
      }
    }
  }, [lastEvent, isVisible, expanded, postId, user?.id, user?._id]);

  // ── Send comment / reply ──────────────────────────────────────────────────
  const isSubmittingRef = useRef(false);
  const handleSend = async () => {
    if (!newComment.trim() || isSubmitting || isSubmittingRef.current || !token) return;
    
    isSubmittingRef.current = true;
    const commentBody = newComment.trim();
    const parentId = replyingTo?.id ?? null;
    const topLevelId = replyingTo?.topLevelId ?? null;
    
    // Optimistic UI updates
    setNewComment('');
    setReplyingTo(null);
    setIsSubmitting(true);
    
    // Keyboard stays open like in Room Chat! No Keyboard.dismiss() here.

    try {
      const res = await fetch(`${BASE_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: commentBody,
          ...(parentId ? { parent_id: parentId } : {}),
        }),
      });

      const result = await res.json();

      if (res.ok) {
        const rawCmt = result.data?.comment ?? result.data;
        if (!rawCmt?._id) return;

        processedIds.current.add(rawCmt._id);
        const newCmt: Comment = { ...rawCmt, createdAt: rawCmt.createdAt || rawCmt.created_at };

        if (!parentId) {
          setComments(prev => [newCmt, ...prev]);
          setTotalComments(p => p + 1);
          setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 100);
        } else {
          const threadId = topLevelId || parentId;
          setTotalComments(p => p + 1);
          setRepliesCount(prev => ({ ...prev, [threadId]: (prev[threadId] || 0) + 1 }));

          setReplies(prev => {
            const thread = prev[threadId] || [];
            const parentReply = thread.find(r => r._id === parentId);
            return {
              ...prev,
              [threadId]: [...thread, { ...newCmt, parentAuthorName: parentReply?.author?.nama }],
            };
          });

          setComments(prev =>
            prev.map(c => c._id === threadId ? { ...c, replies_count: (c.replies_count || 0) + 1 } : c)
          );
          setExpanded(prev => ({ ...prev, [threadId]: true }));
        }
        
        broadcastPostStatsUpdate(postId, { comments_count: totalComments + 1 });

      } else {
        Alert.alert('Gagal', result.message || 'Gagal mengirim komentar');
        setNewComment(commentBody);
      }
    } catch (err) {
      console.error('Comment send error:', err);
      setNewComment(commentBody);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch { return ''; }
  };

  const ReplyItem = ({ item, topLevelId }: { item: Reply; topLevelId: string }) => {
    const avatar = getAvatarUrl(item.author, true);
    return (
      <Animated.View style={styles.replyItem}>
        <View style={styles.threadLine} />
        <Image source={{ uri: avatar }} style={styles.replyAvatar} />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <View style={styles.authorRow}>
              <Text style={[styles.commentAuthor, { color: theme.text }]}>{item.author?.nama || 'Anonim'}</Text>
              {item.parentAuthorName && (
                <>
                  <Text style={[styles.replyArrow, { color: theme.primary }]}>›</Text>
                  <Text style={[styles.replyTarget, { color: theme.description }]}>{item.parentAuthorName}</Text>
                </>
              )}
            </View>
            <Text style={[styles.commentDate, { color: theme.description }]}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={[styles.commentText, { color: theme.text }]}>{item.body}</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setReplyingTo({ id: item._id, name: item.author?.nama || 'Anonim', topLevelId })}
            disabled={isSubmitting}
          >
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>Balas</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const CommentItem = ({ item }: { item: Comment }) => {
    const avatar = getAvatarUrl(item.author, true);
    const isExpanded = expanded[item._id] || false;
    const isLoadingReplies = loadingReply[item._id] || false;
    const replyList = replies[item._id] || [];
    const isHighlighted = highlightedId === item._id;
    const count = repliesCount[item._id] ?? item.replies_count;
    const highlightBg = flashAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.background, theme.tint + '20']
    });

    return (
      <Animated.View 
        style={[styles.commentBlock, isHighlighted && { backgroundColor: highlightBg, borderRadius: 12, padding: 8 }]}
        onLayout={(e) => { itemLayouts.current[item._id] = e.nativeEvent.layout.y; }}
      >
        <View style={styles.commentItem}>
          <Image source={{ uri: avatar }} style={styles.commentAvatar} />
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={[styles.commentAuthor, { color: theme.text }]}>{item.author?.nama || 'Anonim'}</Text>
              <Text style={[styles.commentDate, { color: theme.description }]}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={[styles.commentText, { color: theme.text }]}>{item.body}</Text>
            <View style={styles.commentActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setReplyingTo({ id: item._id, name: item.author?.nama || 'Anonim' })}
                disabled={isSubmitting}
              >
                <Text style={[styles.actionBtnText, { color: theme.primary }]}>Balas</Text>
              </TouchableOpacity>
              {count > 0 && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleReplies(item._id)} disabled={isLoadingReplies}>
                  {isLoadingReplies ? <ActivityIndicator size="small" color={theme.primary} /> : (
                    <View style={styles.viewRepliesRow}>
                      {isExpanded ? <ChevronUp size={13} color={theme.primary} /> : <ChevronDown size={13} color={theme.primary} />}
                      <Text style={[styles.actionBtnText, { color: theme.primary, marginLeft: 3 }]}>
                        {isExpanded ? 'Sembunyikan' : `Lihat ${count} Balasan`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        {isExpanded && replyList.map(reply => <ReplyItem key={reply._id} item={reply} topLevelId={item._id} />)}
      </Animated.View>
    );
  };

  return (
    <Modal 
      visible={isVisible} 
      animationType="fade" 
      transparent 
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.clickableOverlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
          </View>
          <ScrollView 
            scrollEnabled={false} 
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ flex: 1 }}
          >
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <View style={styles.headerTitleRow}>
                <MessageCircle size={20} color={theme.primary} /><Text style={[styles.headerTitle, { color: theme.text }]}>Komentar ({totalComments})</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <View style={styles.listContainer}>
              {isLoading ? <View style={styles.centerContainer}><ActivityIndicator size="large" color={theme.primary} /></View> : 
               comments.length === 0 ? <View style={styles.centerContainer}><MessageCircle size={48} color={theme.border} /><Text style={[styles.emptyText, { color: theme.description }]}>Belum ada komentar.</Text></View> :
                <ScrollView 
                  ref={scrollViewRef} 
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="always"
                >
                  {comments.map(comment => <CommentItem key={comment._id} item={comment} />)}
                </ScrollView>}
            </View>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
              {replyingTo && (
                <View style={[styles.replyBar, { backgroundColor: theme.background }]}>
                  <Text style={[styles.replyBarText, { color: theme.description }]}>Membalas <Text style={{ fontWeight: 'bold', color: theme.text }}>{replyingTo.name}</Text></Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}><X size={16} color={theme.description} /></TouchableOpacity>
                </View>
              )}
              <View style={styles.inputArea}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                  placeholder={replyingTo ? 'Tulis balasan...' : 'Tulis komentar...'}
                  placeholderTextColor={theme.description}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                />
                <Pressable 
                  style={({ pressed }) => [
                    styles.sendButton, 
                    { 
                      backgroundColor: newComment.trim() ? theme.primary : theme.border,
                      opacity: pressed ? 0.7 : 1,
                      zIndex: 999,
                      elevation: 5
                    }
                  ]} 
                  onPressIn={handleSend}
                  disabled={!newComment.trim() || isSubmitting}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  {isSubmitting ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={18} color="#FFF" />}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  clickableOverlay: { ...StyleSheet.absoluteFillObject },
  modalContent: { height: '70%', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  dragHandleContainer: { alignItems: 'center', paddingVertical: 12 },
  dragHandle: { width: 40, height: 5, borderRadius: 2.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  closeBtn: { padding: 4 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  listContainer: { flex: 1 },
  listContent: { padding: 15, paddingBottom: 20 },
  commentBlock: { marginBottom: 20 },
  commentItem: { flexDirection: 'row', gap: 12 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontSize: 14, fontWeight: 'bold' },
  commentDate: { fontSize: 11 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 14 },
  actionBtn: { paddingVertical: 3 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  viewRepliesRow: { flexDirection: 'row', alignItems: 'center' },
  replyItem: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, marginLeft: 48, gap: 10 },
  threadLine: { position: 'absolute', left: -24, top: 0, bottom: 10, width: 1.5, backgroundColor: 'rgba(150,150,150,0.25)', borderRadius: 1 },
  replyAvatar: { width: 28, height: 28, borderRadius: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flexWrap: 'wrap' },
  replyArrow: { fontSize: 14, fontWeight: 'bold', lineHeight: 16 },
  replyTarget: { fontSize: 13, fontWeight: '500' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { textAlign: 'center', marginTop: 12, fontSize: 14 },
  inputContainer: { borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 30 : 12 },
  replyBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8 },
  replyBarText: { fontSize: 12 },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 12 },
  input: { flex: 1, minHeight: 40, maxHeight: 100, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, fontSize: 14 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
