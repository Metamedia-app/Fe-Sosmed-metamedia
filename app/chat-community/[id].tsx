import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, 
  Platform, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView,
  Modal, ScrollView, Image, LayoutAnimation, UIManager, TouchableWithoutFeedback
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useChatCache } from '@/context/ChatCacheContext';
import { communityService, Community, CommunityMessage } from '@/utils/chatCommunity';
import { ArrowLeft, Send, Paperclip, Check, CheckCheck, Clock, MoreVertical, X, Users, Camera, Trash2, Smile, User, UserPlus, UserMinus, AlertTriangle, Type as KeyboardIcon } from 'lucide-react-native';
import SecureMedia from '@/components/SecureMedia';
import CustomCamera from '@/components/CustomCamera';
import MediaViewerModal from '@/components/MediaViewerModal';
import { EmojiKeyboard } from 'rn-emoji-keyboard';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CommunityChatScreen() {
  const { id, communityName } = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const { getCache, setCache, appendMessages: appendToCache, prependMessage: prependToCache } = useChatCache();

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  // isLoading: hanya true saat tidak ada cache sama sekali
  const [isLoading, setIsLoading] = useState(() => !getCache(id as string));
  const [isSending, setIsSending] = useState(false);
  const [communityDetail, setCommunityDetail] = useState<Community | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{[key: string]: string}>({});
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [inviteNim, setInviteNim] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState<string | null>(null);
  const [isDeletingCommunity, setIsDeletingCommunity] = useState(false);
  const [isLeavingCommunity, setIsLeavingCommunity] = useState(false);
  
  // Edit Community State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isEditingCommunity, setIsEditingCommunity] = useState(false);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
  
  // Track OS keyboard height to make Emoji Picker exactly the same height
  const [keyboardHeight, setKeyboardHeight] = useState(320);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    return () => showSub.remove();
  }, []);

  // WhatsApp-style smooth keyboard controller
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Pagination
  const PAGE_SIZE = 30;
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [editAvatar, setEditAvatar] = useState<any>(null);
  const [editCover, setEditCover] = useState<any>(null);
  
  const isSendingRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const remoteTypingTimeouts = useRef<{[key: string]: any}>({});
  const inputAreaRef = useRef<View>(null);
  const textInputRef = useRef<TextInput>(null);

  // WhatsApp-style smooth keyboard controller
  const { height: keyboardHeightAnim } = useReanimatedKeyboardAnimation();
  const emojiHeightAnim = useSharedValue(0);

  useEffect(() => {
    const currentKbHeight = -keyboardHeightAnim.value;
    if (isEmojiPickerVisible) {
      if (currentKbHeight > 50) {
        // Switching from Keyboard to Emoji: Snap instantly to prevent dip
        emojiHeightAnim.value = keyboardHeight;
      } else {
        // Opening Emoji from closed state: Animate up
        emojiHeightAnim.value = withTiming(keyboardHeight, { duration: 250 });
      }
    } else {
      if (currentKbHeight > 50) {
        // Switching from Emoji to Keyboard (keyboard is already up): Snap instantly
        emojiHeightAnim.value = 0;
      } else {
        // Closing Emoji to home state: Animate down
        emojiHeightAnim.value = withTiming(0, { duration: 250 });
      }
    }
  }, [isEmojiPickerVisible, keyboardHeight]);

  // Animated padding on the main container — pushes ALL content up smoothly
  const animatedContainerStyle = useAnimatedStyle(() => {
    const kbHeight = -keyboardHeightAnim.value;
    // Perfect WhatsApp lock: takes the max so the input bar stays completely stationary during swaps
    return {
      paddingBottom: Math.max(kbHeight, emojiHeightAnim.value)
    };
  });

  const typingStatusText = useMemo(() => {
    const users = Object.values(typingUsers);
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} sedang mengetik...`;
    if (users.length === 2) return `${users[0]} dan ${users[1]} sedang mengetik...`;
    return `${users[0]}, ${users[1]} dan ${users.length - 2} lainnya sedang mengetik...`;
  }, [typingUsers]);

  const fetchChatMessages = useCallback(async () => {
    if (!token || !id || id === 'new') {
      setIsLoading(false);
      return;
    }

    // 1. Cek cache — tampilkan secara INSTAN (0ms)
    const cached = getCache(id as string);
    if (cached) {
      setMessages(cached.messages);
      setHasMore(cached.hasMore);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    
    try {
      const result = await communityService.getCommunityMessages(token, id as string, PAGE_SIZE);
      if (result.success) {
        const sorted = result.data.sort((a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const unique: any[] = Array.from(new Map(sorted.map((item: any) => [item._id, item])).values());
        const reversed = unique.reverse();
        const newHasMore = result.meta?.has_more === true;
        
        setMessages(reversed);
        setHasMore(newHasMore);
        setCache(id as string, reversed, newHasMore);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, token]);

  // Load older messages (cursor-based, scroll ke atas)
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;
    setIsLoadingMore(true);
    
    const oldestMessageId = messages[messages.length - 1]?._id;
    
    try {
      const result = await communityService.getCommunityMessages(token, id as string, PAGE_SIZE, oldestMessageId);
      if (result.success && result.data && result.data.length > 0) {
        const sorted = result.data.sort((a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const unique: any[] = Array.from(new Map(sorted.map((item: any) => [item._id, item])).values());
        const reversed = unique.reverse();
        const newHasMore = result.meta?.has_more === true;
        
        setMessages(prev => [...prev, ...reversed]);
        setHasMore(newHasMore);
        appendToCache(id as string, reversed, newHasMore);
      } else {
        setHasMore(false);
        appendToCache(id as string, [], false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, messages, id, token]);

  const fetchDetail = useCallback(async () => {
    if (!token || !id) return;
    const result = await communityService.getCommunityDetail(token, id as string);
    if (result.success) {
      setCommunityDetail(result.data);
    }
  }, [id, token]);

  useEffect(() => {
    fetchChatMessages();
    fetchDetail();
    if (token && id) {
      communityService.markAsRead(token, id as string);
    }
  }, [fetchChatMessages, fetchDetail, id, token]);
  
  // Real-time integration
  useEffect(() => {
    if (!socket || !id) return;

    const handleNewMessage = (data: any) => {
      if (data.community_id === id || data.conversation_id === id) {
        setMessages(prev => {
          if (prev.some(m => m._id === data._id)) return prev;
          
          const isMyMessage = data.sender_id?._id === user?._id || data.sender_id === user?._id;
          if (isMyMessage) {
            const pendingIdx = prev.findIndex(m => 
              m.status === 'pending' && 
              m._id.startsWith('temp-') && 
              (m.body === data.body || (!m.body && !data.body))
            );
            if (pendingIdx >= 0) {
              const updated = [...prev];
              updated[pendingIdx] = data;
              // Sync ke cache
              setCache(id as string, updated, false);
              return updated;
            }
          }
          
          const updated = [data, ...prev];
          prependToCache(id as string, data);
          return updated;
        });
        if (data.sender_id?._id !== user?._id && data.sender_id !== user?._id) {
          communityService.markAsRead(token as string, id as string);
        }
      }
    };

    const handleTypingStatus = (data: any) => {
      const targetId = data.conversationId || data.conversation_id || data.community_id;
      const isTypingNow = data.isTyping !== undefined ? data.isTyping : data.is_typing;
      const typingUserId = data.userId || data.user_id || data.sender_id;

      if (targetId === id && typingUserId !== user?._id) {
        if (isTypingNow) {
          let displayName = data.user?.nama || data.user_nama;
          
          if (!displayName && communityDetail?.members) {
            const member = communityDetail.members.find(m => m._id === typingUserId || m.id === typingUserId);
            if (member) displayName = member.nama || member.name;
          }

          const finalName = displayName || 'Seseorang';
          
          setTypingUsers(prev => ({ ...prev, [typingUserId]: finalName }));

          // Auto-remove after timeout
          if (remoteTypingTimeouts.current[typingUserId]) {
            clearTimeout(remoteTypingTimeouts.current[typingUserId]);
          }
          remoteTypingTimeouts.current[typingUserId] = setTimeout(() => {
            setTypingUsers(prev => {
              const next = { ...prev };
              delete next[typingUserId];
              return next;
            });
            delete remoteTypingTimeouts.current[typingUserId];
          }, 4000);
        } else {
          // Explicit stop typing
          setTypingUsers(prev => {
            const next = { ...prev };
            delete next[typingUserId];
            return next;
          });
          if (remoteTypingTimeouts.current[typingUserId]) {
            clearTimeout(remoteTypingTimeouts.current[typingUserId]);
            delete remoteTypingTimeouts.current[typingUserId];
          }
        }
      }
    };

    const handleMessageDeleted = (data: any) => {
      if (data.conversation_id === id) {
        setMessages(prev => prev.filter(m => m._id !== data.message_id));
      }
    };

    const handleMessageRead = (data: any) => {
      if (data.conversation_id === id || data.community_id === id) {
        setMessages(prev => prev.map(msg => {
          const statusOrder = { 'pending': 0, 'sent': 1, 'delivered': 2, 'read': 3 };
          const currentWeight = statusOrder[msg.status as keyof typeof statusOrder] || 0;
          const newWeight = statusOrder['read'] || 0;
          
          if (data.message_id) {
            return (msg._id === data.message_id && newWeight > currentWeight) ? { ...msg, status: 'read' } : msg;
          }
          return newWeight > currentWeight ? { ...msg, status: 'read' } : msg;
        }));
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing_status', handleTypingStatus);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_read', handleMessageRead);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing_status', handleTypingStatus);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_read', handleMessageRead);
    };
  }, [socket, id, token, user?._id, communityDetail]);

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!token || !id) return;

    if (!isTyping) {
      setIsTyping(true);
      communityService.setTypingStatus(token, id as string, true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      communityService.setTypingStatus(token, id as string, false);
    }, 2000);
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Izin Ditolak', 'Dibutuhkan akses ke galeri untuk mengirim gambar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.3,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
    }
  };



  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedImage) || isSendingRef.current || !token || !id) return;

    isSendingRef.current = true;
    const tempId = `temp-${Date.now()}`;
    const currentText = inputText;
    const currentImage = selectedImage;
    
    const pendingMsg = {
      _id: tempId,
      body: currentText.trim(),
      sender_id: { _id: user?._id, nama: user?.nama, avatar_url: user?.avatar_url },
      createdAt: new Date().toISOString(),
      status: 'pending',
      attachments: currentImage ? [{ url: currentImage.uri, type: 'image' }] : []
    };

    setInputText('');
    setSelectedImage(null);
    setIsSending(true);
    setMessages(prev => [pendingMsg, ...prev]);

    const files = currentImage ? [currentImage] : undefined;
    const result = await communityService.sendMessage(token, id as string, currentText.trim(), files);
    
    if (result.success) {
      setMessages(prev => {
        const filtered = prev.filter(m => m._id !== tempId);
        if (filtered.some(m => m._id === result.data?._id)) return filtered;
        return [result.data, ...filtered];
      });
    } else {
      Alert.alert('Gagal', result.message || 'Pesan gagal dikirim');
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setInputText(currentText);
      setSelectedImage(currentImage);
    }
    
    setIsSending(false);
    isSendingRef.current = false;
  };

  const handleInvite = async () => {
    if (!inviteNim.trim() || isInviting || !token || !id) return;

    setIsInviting(true);
    const result = await communityService.inviteMember(token, id as string, inviteNim.trim());
    if (result.success) {
      Alert.alert('Berhasil', result.message || 'Anggota berhasil diundang');
      setInviteNim('');
      fetchDetail(); 
    } else {
      Alert.alert('Gagal', result.message || 'Gagal mengundang anggota');
    }
    setIsInviting(false);
  };

  const performDeleteMessage = async (messageId: string, type: 'me' | 'everyone') => {
    if (!token) return;
    const result = await communityService.deleteMessage(token, messageId, type);
    if (result.success) {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    } else {
      Alert.alert('Gagal', result.message || 'Gagal menghapus pesan');
    }
  };

  const handleDeleteMessage = (message: any) => {
    const isMe = message.sender_id?._id === user?._id || message.sender_id === user?._id;
    const isAdmin = communityDetail?.admins?.some((admin: any) => 
      (typeof admin === 'string' ? admin === user?._id : admin._id === user?._id)
    );

    const options: any[] = [
      { 
        text: "Hapus untuk Saya", 
        style: "destructive",
        onPress: () => performDeleteMessage(message._id, 'me')
      },
      { text: "Batal", style: "cancel" }
    ];

    if (isMe || isAdmin) {
      options.unshift({
        text: "Hapus untuk Semua Orang",
        style: "destructive",
        onPress: () => performDeleteMessage(message._id, 'everyone')
      });
    }

    Alert.alert(
      "Hapus Pesan",
      "Pilih tindakan untuk pesan ini:",
      options
    );
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      "Keluarkan Anggota",
      `Apakah Anda yakin ingin mengeluarkan ${memberName} dari komunitas ini?`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Keluarkan", 
          style: "destructive", 
          onPress: async () => {
            if (!token || !id) return;
            setIsRemovingMember(memberId);
            const result = await communityService.removeMember(token, id as string, memberId);
            if (result.success) {
              Alert.alert('Berhasil', result.message || 'Anggota berhasil dikeluarkan');
              fetchDetail(); 
            } else {
              Alert.alert('Gagal', result.message || 'Gagal mengeluarkan anggota');
            }
            setIsRemovingMember(null);
          }
        }
      ]
    );
  };

  const handleDeleteCommunity = () => {
    Alert.alert(
      "Hapus Komunitas",
      "Apakah Anda yakin ingin menghapus komunitas ini secara PERMANEN? Seluruh pesan dan file akan dihapus selamanya.",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Hapus Permanen", 
          style: "destructive",
          onPress: async () => {
            if (!token || !id) return;
            setIsDeletingCommunity(true);
            const result = await communityService.deleteCommunity(token, id as string);
            if (result.success) {
              Alert.alert('Berhasil', 'Komunitas telah dihapus.');
              setIsDetailVisible(false);
              router.replace('/(tabs)/chat');
            } else {
              Alert.alert('Gagal', result.message || 'Gagal menghapus komunitas');
            }
            setIsDeletingCommunity(false);
          }
        }
      ]
    );
  };

  const handleLeaveCommunity = () => {
    Alert.alert(
      "Keluar Komunitas",
      "Apakah Anda yakin ingin keluar dari komunitas ini?",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Keluar", 
          style: "destructive",
          onPress: async () => {
            if (!token || !id) return;
            setIsLeavingCommunity(true);
            const result = await communityService.leaveCommunity(token, id as string);
            if (result.success) {
              Alert.alert('Berhasil', result.message || 'Anda telah keluar dari komunitas.');
              setIsDetailVisible(false);
              router.replace('/(tabs)/chat');
            } else {
              Alert.alert('Gagal', result.message || 'Gagal keluar dari komunitas');
            }
            setIsLeavingCommunity(false);
          }
        }
      ]
    );
  };

  const openEditModal = () => {
    if (communityDetail) {
      setEditName(communityDetail.name || '');
      setEditDesc(communityDetail.description || '');
      setEditAvatar(null);
      setIsEditModalVisible(true);
    }
  };

  const handlePickEditAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Izin Ditolak', 'Dibutuhkan akses ke galeri.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.2,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setEditAvatar(result.assets[0]);
    }
  };

  const handleEditCommunity = async () => {
    if (!editName.trim() || !token || !id) return;
    setIsEditingCommunity(true);
    
    const formData = new FormData();
    formData.append('name', editName.trim());
    formData.append('description', editDesc.trim());
    
    if (editAvatar) {
      const filename = editAvatar.uri.split('/').pop() || `avatar-${Date.now()}.png`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      // @ts-ignore
      formData.append('avatar', { uri: editAvatar.uri, name: filename, type });
    }

    const result = await communityService.editCommunity(token, id as string, formData);
    if (result.success) {
      Alert.alert('Berhasil', result.message || 'Komunitas berhasil diperbarui');
      setIsEditModalVisible(false);
      fetchDetail(); 
    } else {
      Alert.alert('Gagal', result.message || 'Gagal memperbarui komunitas');
    }
    setIsEditingCommunity(false);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id?._id === user?._id || item.sender_id === user?._id;
    const time = format(new Date(item.createdAt), 'HH:mm');

    return (
      <View style={[
        styles.messageWrapper, 
        isMe ? styles.messageWrapperRight : styles.messageWrapperLeft
      ]}>
        {!isMe && (
          <Text style={[styles.senderName, { color: theme.description }]}>
            {item.sender_id?.nama || item.sender_nama || 'Anggota'}
          </Text>
        )}
        <TouchableOpacity 
          activeOpacity={0.8}
          onLongPress={() => handleDeleteMessage(item)}
          style={[
            styles.messageBubble,
            isMe ? styles.messageBubbleRight : styles.messageBubbleLeft,
            isMe ? { backgroundColor: theme.tint } : { backgroundColor: colorScheme === 'light' ? '#F5F5F5' : theme.card }
          ]}
        >
          {item.attachments && item.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {item.attachments.map((att: any, idx: number) => {
                const mediaUrl = att.url || att.file_url;
                return mediaUrl ? (
                  <TouchableOpacity key={idx} activeOpacity={0.85} onPress={() => setViewerUrl(mediaUrl)}>
                    <SecureMedia 
                      url={mediaUrl} 
                      token={token} 
                      style={styles.attachmentImage} 
                      contentFit="cover"
                    />
                  </TouchableOpacity>
                ) : null;
              })}
            </View>
          )}
          <View style={{ position: 'relative' }}>
            <Text style={[styles.messageText, { color: isMe ? '#FFF' : theme.text }]}>
              {item.body || item.content}
            </Text>
          <View style={styles.messageInfoAbsolute}>
            <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.description }]}>
              {time}
            </Text>
            {isMe && (
              item.status === 'read' ? 
                <CheckCheck size={14} color="#4FC3F7" style={styles.readIcon} /> : 
                item.status === 'sent' || item.status === 'delivered' ?
                <CheckCheck size={14} color="rgba(255,255,255,0.7)" style={styles.readIcon} /> :
                item.status === 'pending' ?
                <Clock size={11} color="rgba(255,255,255,0.5)" style={styles.readIcon} /> :
                <Check size={14} color="rgba(255,255,255,0.7)" style={styles.readIcon} />
            )}
          </View>
        </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background }, animatedContainerStyle]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={theme.text} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerInfo}
              onPress={() => setIsDetailVisible(true)}
            >
              <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
                {communityDetail?.name || communityName || 'Community Chat'}
              </Text>
              <Text style={[styles.headerStatus, { color: typingStatusText ? theme.tint : theme.description }]}>
                {typingStatusText || 'Klik untuk detail komunitas'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerActionButton} onPress={() => setIsDetailVisible(true)}>
              <MoreVertical size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item._id || index.toString()}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.5}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            ListFooterComponent={() => (
              isLoadingMore ? (
                <View style={{ paddingVertical: 20 }}>
                  <ActivityIndicator size="small" color={theme.tint} />
                </View>
              ) : null
            )}
          />
        </View>

        {/* Selected Image Preview */}
        {selectedImage && (
          <View style={[styles.previewContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <View style={styles.previewImageWrapper}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
              <TouchableOpacity 
                style={styles.removePreviewButton}
                onPress={() => setSelectedImage(null)}
              >
                <X size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Platform.OS === 'ios' ? 25 : 10 }]}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => { 
                if (isEmojiPickerVisible) {
                  // Trick WhatsApp: focus keyboard first, hide emoji picker AFTER keyboard has risen
                  textInputRef.current?.focus();
                  setTimeout(() => setIsEmojiPickerVisible(false), 250);
                } else {
                  Keyboard.dismiss(); 
                  setIsEmojiPickerVisible(true); 
                }
              }}
            >
              {isEmojiPickerVisible ? (
                <KeyboardIcon size={24} color={theme.description} />
              ) : (
                <Smile size={24} color={theme.description} />
              )}
            </TouchableOpacity>

            <TextInput
              ref={textInputRef}
              style={[styles.input, { color: theme.text }]}
              placeholder="Message"
              placeholderTextColor={theme.description}
              value={inputText}
              onChangeText={handleTyping}
              onFocus={() => {
                if (isEmojiPickerVisible) {
                  setTimeout(() => setIsEmojiPickerVisible(false), 250);
                }
              }}
              multiline
              maxLength={1000}
            />
            
            <TouchableOpacity style={styles.iconButton} onPress={handlePickImage}>
              <Paperclip size={20} color={theme.description} style={{ transform: [{ rotate: '-45deg' }] }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, { marginRight: 5 }]} onPress={() => setIsCameraVisible(true)}>
              <Camera size={20} color={theme.description} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: theme.tint }]}
            onPress={handleSendMessage}
            disabled={(!inputText.trim() && !selectedImage) || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Send size={20} color="#FFF" style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>
        </View>
      </View>
        
        {/* Emoji Picker */}
        {isEmojiPickerVisible && (
          <View style={{ position: 'absolute', bottom: 0, height: keyboardHeight, width: '100%', backgroundColor: theme.card, zIndex: 100 }}>
            <EmojiKeyboard
              onEmojiSelected={(emojiObject) => {
                setInputText((prev) => prev + emojiObject.emoji);
              }}
              theme={{
                knob: theme.tint,
                container: theme.card,
                header: theme.text,
                skinTonesContainer: theme.background,
                category: {
                  icon: theme.description,
                  iconActive: theme.tint,
                  container: theme.background,
                  containerActive: theme.card,
                },
              }}
            />
          </View>
        )}

      <CustomCamera 
        visible={isCameraVisible} 
        onClose={() => setIsCameraVisible(false)} 
        onCapture={(asset) => setSelectedImage(asset)} 
      />

      <MediaViewerModal 
        visible={!!viewerUrl} 
        url={viewerUrl} 
        token={token} 
        onClose={() => setViewerUrl(null)} 
      />

      {/* Detail Modal (Floating Card Style) */}
      <Modal
        visible={isDetailVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDetailVisible(false)}
      >
        <View style={styles.floatingModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsDetailVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[styles.floatingCard, { backgroundColor: theme.card }]}>
            <ScrollView 
              style={styles.modalContent} 
              showsVerticalScrollIndicator={false}
              stickyHeaderIndices={[1]} // Index 1 is the Community Name View
            >
              {/* Index 0: Avatar Section */}
              <View style={styles.detailHeroAvatar}>
                {communityDetail?.avatar_url ? (
                  <SecureMedia url={communityDetail.avatar_url} token={token} style={styles.detailAvatar} />
                ) : (
                  <View style={[styles.detailAvatar, { backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                    <Users size={60} color={theme.description} />
                  </View>
                )}
              </View>

              {/* Index 1: Community Name Section (STICKY) */}
              <View style={[styles.detailHeroName, { backgroundColor: theme.card }]}>
                <Text style={[styles.detailName, { color: theme.text }]}>{communityDetail?.name}</Text>
                <View style={[styles.stickyNameDivider, { backgroundColor: theme.border }]} />
              </View>

              {/* Index 2+: Other Info Section */}
              <View style={styles.detailOtherInfo}>
                {communityDetail?.description ? (
                  <Text style={[styles.detailDesc, { color: theme.description }]}>{communityDetail?.description}</Text>
                ) : null}

                <View style={[styles.infoSection]}>
                  <View style={styles.infoItem}>
                    <User size={18} color={theme.tint} />
                    <View>
                      <Text style={[styles.infoLabel, { color: theme.description }]}>Pembuat</Text>
                      <Text style={[styles.infoValue, { color: theme.text }]}>
                        {communityDetail?.creator?.nama || communityDetail?.creator_id?.nama || 'Unknown'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.infoItem}>
                    <Clock size={18} color={theme.tint} />
                    <View>
                      <Text style={[styles.infoLabel, { color: theme.description }]}>Dibuat pada</Text>
                      <Text style={[styles.infoValue, { color: theme.text }]}>
                        {communityDetail ? format(new Date(communityDetail.createdAt), 'dd MMMM yyyy') : '-'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Invite Section */}
                <View style={[styles.section, { borderTopColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.tint }]}>Undang Anggota</Text>
                  <View style={[styles.inviteInputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.inviteInput, { color: theme.text }]}
                      placeholder="Masukkan NIM teman..."
                      placeholderTextColor={theme.description}
                      value={inviteNim}
                      onChangeText={setInviteNim}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity 
                      style={[styles.inviteButton, { backgroundColor: theme.tint }]}
                      onPress={handleInvite}
                      disabled={!inviteNim.trim() || isInviting}
                    >
                      {isInviting ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <UserPlus size={18} color="#FFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.section, { borderTopColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.tint }]}>Anggota ({communityDetail?.member_count || communityDetail?.members?.length || 0})</Text>
                  {communityDetail?.members?.map((member: any) => {
                    const isAdmin = communityDetail?.admins?.some((admin: any) => 
                      (typeof admin === 'string' ? admin === user?._id : admin._id === user?._id)
                    );
                    const isMemberAdmin = communityDetail?.admins?.some((admin: any) => 
                      (typeof admin === 'string' ? admin === member._id : admin._id === member._id)
                    );
                    const isMe = member._id === user?._id;

                    return (
                      <TouchableOpacity 
                        key={member._id} 
                        style={styles.memberItem}
                        onPress={() => {
                          setIsDetailVisible(false); // Tutup modal dulu
                          // Beri sedikit waktu untuk animasi modal tertutup
                          setTimeout(() => {
                            router.push({
                              pathname: "/user/[id]",
                              params: { 
                                id: member._id, 
                                initialName: member.nama, 
                                initialNim: member.nim,
                                initialAvatar: member.avatar_url || ''
                              }
                            } as any);
                          }, 100);
                        }}
                      >
                        {member.avatar_url ? (
                          <SecureMedia url={member.avatar_url} token={token} style={styles.memberAvatar} />
                        ) : (
                          <View style={[styles.memberAvatar, { backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                            <User size={16} color={theme.description} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.memberName, { color: theme.text }]}>{member.nama}</Text>
                            {isMemberAdmin && (
                              <View style={{ backgroundColor: theme.tint + '15', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                <Text style={{ color: theme.tint, fontSize: 10, fontWeight: 'bold' }}>Admin</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.memberNim, { color: theme.description }]}>{member.nim}</Text>
                        </View>
                        
                        {isAdmin && !isMe && !isMemberAdmin && (
                          <TouchableOpacity 
                            style={styles.removeMemberBtn} 
                            onPress={(e) => {
                              e.stopPropagation();
                              handleRemoveMember(member._id, member.nama);
                            }}
                            disabled={isRemovingMember === member._id}
                          >
                            {isRemovingMember === member._id ? (
                              <ActivityIndicator size="small" color={theme.error || '#F44336'} />
                            ) : (
                              <UserMinus size={20} color={theme.error || '#F44336'} />
                            )}
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Leave Community (For Members) */}
                {(communityDetail?.creator?._id !== user?._id && communityDetail?.creator_id?._id !== user?._id) && (
                  <View style={[styles.section, { borderTopColor: theme.border, marginBottom: 40 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.error || '#F44336' }]}>Tindakan</Text>
                    <TouchableOpacity 
                      style={[styles.deleteCommunityBtn, { borderColor: theme.error || '#F44336' }]}
                      onPress={handleLeaveCommunity}
                      disabled={isLeavingCommunity}
                    >
                      {isLeavingCommunity ? (
                        <ActivityIndicator size="small" color={theme.error || '#F44336'} />
                      ) : (
                        <>
                          <UserMinus size={20} color={theme.error || '#F44336'} />
                          <Text style={[styles.deleteCommunityText, { color: theme.error || '#F44336' }]}>Keluar dari Komunitas</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Danger Zone (For Creators) */}
                {(communityDetail?.creator?._id === user?._id || communityDetail?.creator_id?._id === user?._id) && (
                  <View style={[styles.section, { borderTopColor: theme.border, marginBottom: 40 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.error || '#F44336' }]}>Zona Bahaya & Pengaturan</Text>
                    
                    <TouchableOpacity 
                      style={[styles.deleteCommunityBtn, { borderColor: theme.tint, marginBottom: 15 }]}
                      onPress={openEditModal}
                    >
                      <Camera size={20} color={theme.tint} />
                      <Text style={[styles.deleteCommunityText, { color: theme.tint }]}>Edit Komunitas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.deleteCommunityBtn, { borderColor: theme.error || '#F44336' }]}
                      onPress={handleDeleteCommunity}
                      disabled={isDeletingCommunity}
                    >
                      {isDeletingCommunity ? (
                        <ActivityIndicator size="small" color={theme.error || '#F44336'} />
                      ) : (
                        <>
                          <Trash2 size={20} color={theme.error || '#F44336'} />
                          <Text style={[styles.deleteCommunityText, { color: theme.error || '#F44336' }]}>Hapus Komunitas Permanen</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: theme.tint }]}
              onPress={() => setIsDetailVisible(false)}
            >
              <Text style={styles.closeButtonText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Community Modal */}
      <Modal visible={isEditModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditModalVisible(false)}>
        <View style={styles.floatingModalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <View style={[styles.floatingCard, { backgroundColor: theme.card, maxHeight: '80%', width: '90%', borderRadius: 20, overflow: 'hidden' }]}>
              <View style={[styles.header, { borderBottomColor: theme.border, paddingVertical: 15, paddingHorizontal: 20 }]}>
                <Text style={[styles.headerName, { color: theme.text, flex: 1 }]}>Edit Komunitas</Text>
                <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                  <X size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={{ alignSelf: 'center', alignItems: 'center', marginBottom: 20 }} onPress={handlePickEditAvatar}>
                  {editAvatar ? (
                    <Image source={{ uri: editAvatar.uri }} style={{ width: 100, height: 100, borderRadius: 50 }} />
                  ) : communityDetail?.avatar_url ? (
                    <SecureMedia url={communityDetail.avatar_url} token={token} style={{ width: 100, height: 100, borderRadius: 50 }} />
                  ) : (
                    <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }}>
                      <Camera size={30} color={theme.description} />
                    </View>
                  )}
                  <Text style={{ color: theme.tint, marginTop: 10, fontWeight: 'bold' }}>Ganti Foto</Text>
                </TouchableOpacity>

                <Text style={{ color: theme.description, marginBottom: 5, fontSize: 12 }}>Nama Komunitas</Text>
                <TextInput 
                  style={[{ backgroundColor: theme.background, color: theme.text, padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: theme.border }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nama Komunitas..."
                  placeholderTextColor={theme.description}
                />

                <Text style={{ color: theme.description, marginBottom: 5, fontSize: 12 }}>Deskripsi</Text>
                <TextInput 
                  style={[{ backgroundColor: theme.background, color: theme.text, padding: 12, borderRadius: 8, marginBottom: 30, height: 100, borderWidth: 1, borderColor: theme.border }]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                  textAlignVertical="top"
                  placeholder="Ceritakan tentang komunitas ini..."
                  placeholderTextColor={theme.description}
                />

                <TouchableOpacity 
                  style={{ backgroundColor: theme.tint, width: '100%', borderRadius: 8, padding: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 20 }}
                  onPress={handleEditCommunity}
                  disabled={isEditingCommunity}
                >
                  {isEditingCommunity ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Simpan Perubahan</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 45,
    paddingBottom: 10,
    paddingHorizontal: 10,
    zIndex: 10,
  },
  backButton: {
    padding: 5,
    marginRight: 5,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActionButton: {
    padding: 5,
    marginLeft: 5,
  },
  messagesList: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    gap: 10,
  },
  messageWrapper: {
    marginBottom: 10,
    width: '100%',
  },
  messageWrapperRight: {
    alignItems: 'flex-end',
  },
  messageWrapperLeft: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    maxWidth: '85%',
    minWidth: 80,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  messageBubbleRight: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopRightRadius: 0,
  },
  messageBubbleLeft: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderTopLeftRadius: 0,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    paddingRight: 50,
    paddingBottom: 10,
  },
  messageInfoAbsolute: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  messageTime: {
    fontSize: 10,
  },
  readIcon: {
    marginLeft: 2,
  },
  attachmentsContainer: {
    marginBottom: 8,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  previewContainer: {
    padding: 15,
    borderTopWidth: 1,
  },
  previewImageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removePreviewButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    marginRight: 10,
    minHeight: 48,
    paddingHorizontal: 5,
  },
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 5,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  floatingCard: {
    width: '95%',
    height: '80%',
    borderRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  modalContent: {
    flex: 1,
  },
  detailHeroAvatar: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  detailHeroName: {
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 10,
  },
  detailOtherInfo: {
    paddingTop: 10,
  },
  stickyNameDivider: {
    height: 1,
    width: '40%',
    marginTop: 8,
    borderRadius: 1,
    opacity: 0.3,
  },
  detailAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  detailName: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detailDesc: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
    marginBottom: 20,
  },
  infoSection: {
    gap: 15,
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  section: {
    paddingTop: 20,
    marginTop: 20,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberNim: {
    fontSize: 12,
  },
  inviteInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 50,
    gap: 10,
  },
  inviteInput: {
    flex: 1,
    fontSize: 15,
  },
  inviteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMemberBtn: {
    padding: 8,
  },
  deleteCommunityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  deleteCommunityText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
