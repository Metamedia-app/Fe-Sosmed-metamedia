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
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BASE_URL } from '../utils/api';
import { getAvatarUrl } from '../utils/avatar';
import { recursiveReplyCounts, postCommentsCache } from '../utils/commentSyncStore';

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
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CommentModal = ({
  isVisible,
  onClose,
  postId,
  initialCommentsCount,
  onCountChange,
}: CommentModalProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, user } = useAuth();
  const { lastEvent } = useSocket();
  const inputRef = React.useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  // Top-level comments (parent_id === null)
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalComments, setTotalComments] = useState(initialCommentsCount);
  const [isLoading, setIsLoading] = useState(false);

  // replies[commentId] = flat list of Reply
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  // loadingReply[commentId] = true saat sedang fetch
  const [loadingReply, setLoadingReply] = useState<Record<string, boolean>>({});
  // expanded[commentId] = true saat balasan ditampilkan
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // repliesCount[commentId] = angka denormalized dari DB
  const [repliesCount, setRepliesCount] = useState<Record<string, number>>({});

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
    topLevelId?: string;
  } | null>(null);

  const processedIds = useRef<Set<string>>(new Set());

  // ── Auth headers ──────────────────────────────────────────────────────────
  const authHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // ── Propagate count changes ───────────────────────────────────────────────
  useEffect(() => { onCountChange?.(totalComments); }, [totalComments]);

  // ── Main visibility effect ────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) return;

    setNewComment('');
    loadComments();

    const timer = setInterval(() => loadComments(true), 20000);
    return () => clearInterval(timer);
  }, [isVisible, postId]);

  // Reset processedIds hanya jika ganti postingan
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

        // Sync replies_count dari masing-masing komentar
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
    }
  };

  // ── Fetch replies untuk satu komentar ─────────────────────────────────────
  const loadReplies = async (commentId: string) => {
    setLoadingReply(prev => ({ ...prev, [commentId]: true }));

    try {
      const allFetched: any[] = [];
      const authorMap: Record<string, string> = {};
      const parentCmt = comments.find(c => c._id === commentId);
      if (parentCmt) authorMap[commentId] = parentCmt.author?.nama || 'Anonim';

      // ── RECURSIVE BFS FETCH ──────────────────────────────────────────
      // Kita pakai antrean (queue) untuk menarik semua balasan di tiap level
      let queue = [commentId];
      const processedParents = new Set<string>();

      while (queue.length > 0) {
        // Ambil batch selanjutnya secara paralel agar tetap cepat
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
            if (c._id === commentId) continue; // skip parent
            
            // Simpan data & map nama author
            allFetched.push(c);
            if (c.author?.nama) authorMap[c._id] = c.author.nama;

            // Jika komentar ini punya anak lagi, masukkan ke antrean pengerjaan selanjutnya
            if ((c.replies_count || 0) > 0 && !processedParents.has(c._id)) {
              queue.push(c._id);
              processedParents.add(c._id);
            }
          }
        }
        
        // Safety break jika terlalu dalam (TikTok style jarang lewat dari 10 level)
        if (processedParents.size > 50) break;
      }

      // ── Gabungkan & Deduplikasi ──────────────────────────────────────────
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
      
      // Update hitungan lokal berdasarkan apa yang benar-benar kita temukan
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

  // ── Toggle replies ────────────────────────────────────────────────────────
  const toggleReplies = (commentId: string) => {
    if (expanded[commentId]) {
      // Tutup
      setExpanded(prev => ({ ...prev, [commentId]: false }));
    } else {
      // Buka — fetch setiap kali (tidak ada cache basi antar sesi)
      setExpanded(prev => ({ ...prev, [commentId]: true }));
      loadReplies(commentId);
    }
  };

  // ── Socket: live update ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible || !lastEvent || lastEvent.type !== 'new_comment') return;

    const rawCmt = lastEvent.data?.comment ?? lastEvent.data;
    if (!rawCmt?._id) return;
    if (processedIds.current.has(rawCmt._id)) return;
    processedIds.current.add(rawCmt._id);

    const newCmt: Comment = { ...rawCmt, createdAt: rawCmt.createdAt || rawCmt.created_at };
    const authorId = rawCmt?.author?._id || rawCmt?.author?.id;
    const currentUserId = user?._id || user?.id;

    // Jika ini komentar kita sendiri, abaikan socket (sudah ditangani handleSend)
    // Tapi tetap masukkan ke processedIds agar tidak diproses lagi.
    if (authorId === currentUserId && authorId !== undefined) {
      processedIds.current.add(rawCmt._id);
      return;
    }

    if (!newCmt.parent_id) {
      // ── Komentar utama baru ───────────────────
      setComments(prev => {
        if (prev.some(c => c._id === newCmt._id)) return prev;
        setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 100);
        return [newCmt, ...prev];
      });
      setTotalComments(p => p + 1);
    } else {
      // ── Reply baru ────────────────────────────
      const threadId = newCmt.top_level_id || newCmt.parent_id;
      
      // 1. Update Global Total
      setTotalComments(p => p + 1);

      // 2. Update Reply Count (Lihat X Balasan Button)
      if (threadId) {
        setRepliesCount(prev => ({
          ...prev,
          [threadId]: (prev[threadId] || 0) + 1,
        }));
        
        if (expanded[threadId]) {
          setReplies(prev => {
            const thread = prev[threadId] || [];
            if (thread.some(r => r._id === newCmt._id)) return prev;
            const parentReply = thread.find(r => r._id === newCmt.parent_id);
            return {
              ...prev,
              [threadId]: [...thread, { ...newCmt, parentAuthorName: parentReply?.author?.nama }],
            };
          });
        }

        // Update visual angka pada komen utama di list
        setComments(prev =>
          prev.map(c =>
            c._id === threadId ? { ...c, replies_count: (c.replies_count || 0) + 1 } : c
          )
        );
      }
    }
  }, [lastEvent, isVisible, expanded]);

  // ── Send comment / reply ──────────────────────────────────────────────────
  const handleSend = async () => {
    if (!newComment.trim() || isSubmitting || !token) return;
    setIsSubmitting(true);

    const parentId = replyingTo?.id ?? null;
    const topLevelId = replyingTo?.topLevelId ?? null;
    setReplyingTo(null);
    setNewComment('');

    try {
      const res = await fetch(`${BASE_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: newComment.trim(),
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
          // Komentar utama baru
          setComments(prev => {
            if (prev.some(c => c._id === newCmt._id)) return prev;
            setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 100);
            return [newCmt, ...prev];
          });
          setTotalComments(p => p + 1);
        } else {
          // Reply baru
          const threadId = topLevelId || parentId;
          
          // 1. Update Global Total
          setTotalComments(p => p + 1);

          // 2. Update Reply Count
          setRepliesCount(prev => ({ ...prev, [threadId]: (prev[threadId] || 0) + 1 }));

          setReplies(prev => {
            const thread = prev[threadId] || [];
            if (thread.some(r => r._id === newCmt._id)) return prev;
            const parentReply = thread.find(r => r._id === parentId);
            const parentAuthorName = parentReply?.author?.nama;
            return {
              ...prev,
              [threadId]: [...thread, { ...newCmt, parentAuthorName }],
            };
          });

          setComments(prev =>
            prev.map(c =>
              c._id === threadId ? { ...c, replies_count: (c.replies_count || 0) + 1 } : c
            )
          );
          setExpanded(prev => ({ ...prev, [threadId]: true }));
        }
      } else {
        Alert.alert('Gagal', result.message || 'Gagal mengirim komentar');
      }
    } catch (err) {
      console.error('handleSend error:', err);
      Alert.alert('Kesalahan', 'Tidak dapat mengirim komentar. Periksa koneksi Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  // ── Sub-components ────────────────────────────────────────────────────────

  const ReplyItem = ({ item, topLevelId }: { item: Reply; topLevelId: string }) => {
    const avatar = getAvatarUrl(item.author, true);

    return (
      <View style={styles.replyItem}>
        <View style={styles.threadLine} />
        <Image source={{ uri: avatar }} style={styles.replyAvatar} />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <View style={styles.authorRow}>
              <Text style={[styles.commentAuthor, { color: theme.text }]}>
                {item.author?.nama || 'Anonim'}
              </Text>
              {item.parentAuthorName && (
                <>
                  <Text style={[styles.replyArrow, { color: theme.primary }]}>›</Text>
                  <Text style={[styles.replyTarget, { color: theme.description }]}>
                    {item.parentAuthorName}
                  </Text>
                </>
              )}
            </View>
            <Text style={[styles.commentDate, { color: theme.description }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.commentText, { color: theme.text }]}>{item.body}</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              setReplyingTo({ id: item._id, name: item.author?.nama || 'Anonim', topLevelId })
            }
            disabled={isSubmitting}
          >
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>Balas</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const CommentItem = ({ item }: { item: Comment }) => {
    const avatar = getAvatarUrl(item.author, true);

    const isExpanded = expanded[item._id] || false;
    const isLoadingReplies = loadingReply[item._id] || false;
    const replyList = replies[item._id] || [];
    const count = repliesCount[item._id] ?? item.replies_count;

    return (
      <View style={styles.commentBlock}>
        <View style={styles.commentItem}>
          <Image source={{ uri: avatar }} style={styles.commentAvatar} />
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={[styles.commentAuthor, { color: theme.text }]}>
                {item.author?.nama || 'Anonim'}
              </Text>
              <Text style={[styles.commentDate, { color: theme.description }]}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
            <Text style={[styles.commentText, { color: theme.text }]}>{item.body}</Text>

            <View style={styles.commentActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() =>
                  setReplyingTo({ id: item._id, name: item.author?.nama || 'Anonim' })
                }
                disabled={isSubmitting}
              >
                <Text style={[styles.actionBtnText, { color: theme.primary }]}>Balas</Text>
              </TouchableOpacity>

              {count > 0 && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => toggleReplies(item._id)}
                  disabled={isLoadingReplies}
                >
                  {isLoadingReplies ? (
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: 4 }} />
                  ) : (
                    <View style={styles.viewRepliesRow}>
                      {isExpanded ? (
                        <ChevronUp size={13} color={theme.primary} />
                      ) : (
                        <ChevronDown size={13} color={theme.primary} />
                      )}
                      <Text style={[styles.actionBtnText, { color: theme.primary, marginLeft: 3 }]}>
                        {isExpanded ? 'Sembunyikan Balasan' : `Lihat ${count} Balasan`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {isExpanded &&
          replyList.map(reply => (
            <ReplyItem key={reply._id} item={reply} topLevelId={item._id} />
          ))}
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContent, { backgroundColor: theme.card }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleRow}>
              <MessageCircle size={20} color={theme.primary} />
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                Komentar ({totalComments})
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Comments list */}
          <View style={styles.listContainer}>
            {isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.centerContainer}>
                <MessageCircle size={48} color={theme.border} strokeWidth={1} />
                <Text style={[styles.emptyText, { color: theme.description }]}>
                  Belum ada komentar. Jadi yang pertama!
                </Text>
              </View>
            ) : (
              <ScrollView ref={scrollViewRef} contentContainerStyle={styles.listContent}>
                {comments
                  .filter(c => !c.parent_id)
                  .map(comment => (
                    <CommentItem key={comment._id} item={comment} />
                  ))}
              </ScrollView>
            )}
          </View>

          {/* Input area */}
          <View
            style={[
              styles.inputContainer,
              { backgroundColor: theme.card, borderTopColor: theme.border },
            ]}
          >
            {replyingTo && (
              <View style={[styles.replyBar, { backgroundColor: theme.background }]}>
                <Text style={[styles.replyBarText, { color: theme.description }]}>
                  Membalas{' '}
                  <Text style={{ fontWeight: 'bold', color: theme.text }}>{replyingTo.name}</Text>
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <X size={16} color={theme.description} />
                </TouchableOpacity>
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
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { backgroundColor: newComment.trim() ? theme.primary : theme.border },
                ]}
                onPress={handleSend}
                disabled={!newComment.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Send size={18} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  closeButton: { padding: 2 },
  listContainer: { flex: 1 },
  listContent: { padding: 15, paddingBottom: 20 },
  commentBlock: { marginBottom: 20 },
  commentItem: { flexDirection: 'row', gap: 12 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F3F5' },
  commentContent: { flex: 1 },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: { fontSize: 14, fontWeight: 'bold' },
  commentDate: { fontSize: 11 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 14 },
  actionBtn: { paddingVertical: 3 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  viewRepliesRow: { flexDirection: 'row', alignItems: 'center' },
  replyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    marginLeft: 48,
    gap: 10,
  },
  threadLine: {
    position: 'absolute',
    left: -24,
    top: 0,
    bottom: 10,
    width: 1.5,
    backgroundColor: 'rgba(150,150,150,0.25)',
    borderRadius: 1,
  },
  replyAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F3F5' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flexWrap: 'wrap' },
  replyArrow: { fontSize: 14, fontWeight: 'bold', lineHeight: 16 },
  replyTarget: { fontSize: 13, fontWeight: '500' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { textAlign: 'center', marginTop: 12, fontSize: 14 },
  inputContainer: { borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 30 : 12 },
  replyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  replyBarText: { fontSize: 12 },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 12 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
