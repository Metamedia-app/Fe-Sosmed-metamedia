import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, 
  Platform, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView,
  Modal, ScrollView, Image, TouchableWithoutFeedback, StatusBar, UIManager, LayoutAnimation
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';

import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { getGroupMessages, sendGroupMessage, sendGroupTypingStatus, deleteGroupMessage, markGroupAsRead, getGroupDetail, toggleGroupMute } from '@/utils/chatMatkul';
import { markAsRead } from '@/utils/chat';
import { ArrowLeft, Send, Paperclip, Check, CheckCheck, Clock, Trash2, Smile, Camera, X, Users, BookOpen, BellOff, Bell, Lock, MoreVertical, Download, Plus, FileText, Calendar, User, Type as KeyboardIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import SecureMedia from '@/components/SecureMedia';
import CustomCamera from '@/components/CustomCamera';
import MediaViewerModal from '@/components/MediaViewerModal';
import { EmojiKeyboard } from 'rn-emoji-keyboard';
import { format } from 'date-fns';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ModalItemSkeleton = ({ theme }: { theme: any }) => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[
      { height: 65, borderRadius: 12, backgroundColor: theme.border, marginBottom: 10, width: '100%' },
      animatedStyle
    ]} />
  );
};

export default function GroupChatRoomScreen() {
  const { id, groupName } = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { token, user } = useAuth();
  const { lastEvent, socket } = useSocket();

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const textInputRef = useRef<TextInput>(null);
  
  const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
  
  // Pagination
  const PAGE_SIZE = 30;
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Track OS keyboard height to make Emoji Picker exactly the same height
  const [keyboardHeight, setKeyboardHeight] = useState(320);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    return () => showSub.remove();
  }, []);
  
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

  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{[key: string]: string}>({});
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isSyllabusVisible, setIsSyllabusVisible] = useState(false);
  const [isAssignmentsVisible, setIsAssignmentsVisible] = useState(false);
  const [syllabusData, setSyllabusData] = useState<any[]>([]);
  const [assignmentsData, setAssignmentsData] = useState<any[]>([]);
  const [isLoadingSyllabus, setIsLoadingSyllabus] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [groupDetail, setGroupDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  const [isSyllabusUploadVisible, setIsSyllabusUploadVisible] = useState(false);
  const [syllabusUploadTitle, setSyllabusUploadTitle] = useState('');
  const [selectedSyllabusFile, setSelectedSyllabusFile] = useState<any>(null);
  const [uploadingMeetingNumber, setUploadingMeetingNumber] = useState(1);
  const [isUploadingSyllabus, setIsUploadingSyllabus] = useState(false);

  const [isAssignmentUploadVisible, setIsAssignmentUploadVisible] = useState(false);
  const [assignmentUploadTitle, setAssignmentUploadTitle] = useState('');
  const [assignmentUploadDesc, setAssignmentUploadDesc] = useState('');
  const [assignmentDueDate, setAssignmentDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [selectedAssignmentFile, setSelectedAssignmentFile] = useState<any>(null);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  
  const [activeAttachment, setActiveAttachment] = useState<any>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const handlePickGroupAvatar = async () => {
    if (!isDosen) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingGroupAvatar(true);
        const asset = result.assets[0];
        
        const formData = new FormData();
        const fileExt = asset.uri.split('.').pop() || 'jpg';
        const mimeType = `image/${fileExt}`;
        
        formData.append('file', {
          uri: Platform.OS === 'ios' ? asset.uri.replace('file://', '') : asset.uri,
          type: mimeType,
          name: `group-avatar.${fileExt}`,
        } as any);

        const response = await fetch(`https://api.metausosmed.my.id/api/v1/chat-matkul/${id}/avatar`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': '*/*'
          },
          body: formData,
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
          Alert.alert('Berhasil', 'Avatar grup berhasil diperbarui.');
          setGroupDetail((prev: any) => ({ ...prev, avatar_url: data.data.avatar_url }));
        } else {
          Alert.alert('Gagal', data.message || 'Gagal mengunggah avatar grup');
        }
      }
    } catch (error) {
      console.error('Error uploading group avatar:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat mengunggah foto');
    } finally {
      setIsUploadingGroupAvatar(false);
    }
  };

  const isAnyModalVisible = isMenuVisible || isDetailVisible || isSyllabusVisible || isAssignmentsVisible || isSyllabusUploadVisible || isAssignmentUploadVisible || isPreviewVisible;
  
  const isDosen = useMemo(() => {
    const myId = user?._id || user?.id;
    const isAdmin = groupDetail?.admins?.some((admin: any) => 
      (typeof admin === 'string' ? admin === myId : admin._id === myId)
    );
    const isGlobalDosen = user?.role?.toLowerCase() === 'dosen' || user?.role?.toLowerCase() === 'admin';
    return isAdmin || isGlobalDosen;
  }, [groupDetail, user]);
  
  const flatListRef = useRef<FlatList>(null);
  const inputAreaRef = useRef<View>(null);
  const typingTimeoutRef = useRef<any>(null);
  const remoteTypingTimeouts = useRef<{[key: string]: any}>({});

  const typingStatusText = useMemo(() => {
    const users = Object.values(typingUsers);
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} sedang mengetik...`;
    if (users.length === 2) return `${users[0]} dan ${users[1]} sedang mengetik...`;
    return `${users[0]}, ${users[1]} dan ${users.length - 2} lainnya sedang mengetik...`;
  }, [typingUsers]);

  // Fetch initial messages with BE Cursor Pagination
  const fetchChatMessages = useCallback(async () => {
    if (!token || !id || id === 'new') {
      setIsLoading(false);
      return;
    }
    
    try {
      const result = await getGroupMessages(id as string, token, PAGE_SIZE);
      if (result.success) {
        // Sort oldest → newest (index 0 = oldest), then reverse for FlatList inverted
        const sorted = result.data.sort((a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const unique: any[] = Array.from(new Map(sorted.map((item: any) => [item._id, item])).values());
        
        setMessages(unique.reverse()); // Reverse for inverted FlatList
        setHasMore(unique.length >= PAGE_SIZE || result.meta?.has_more === true);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, token]);

  // Load older messages from BE when scrolled to top
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;
    setIsLoadingMore(true);
    
    // The last item in our inverted list is the oldest message currently rendered
    const oldestMessageId = messages[messages.length - 1]?._id;
    
    try {
      const result = await getGroupMessages(id as string, token, PAGE_SIZE, oldestMessageId);
      if (result.success && result.data && result.data.length > 0) {
        const sorted = result.data.sort((a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const unique: any[] = Array.from(new Map(sorted.map((item: any) => [item._id, item])).values());
        
        setMessages(prev => [...prev, ...unique.reverse()]);
        setHasMore(unique.length >= PAGE_SIZE || result.meta?.has_more === true);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, messages, id, token]);

  useEffect(() => {
    fetchChatMessages();
    if (token && id && id !== 'new') {
      getGroupDetail(id as string, token as string).then(result => {
        if (result.success) {
          setGroupDetail(result.data);
        }
      });
    }
  }, [fetchChatMessages, id, token]);

  useEffect(() => {
    if (!socket || !id || id === 'new') return;
    markGroupAsRead(id as string, token as string);

    const handleGroupMessage = (data: any) => {
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
              return updated;
            }
          }
          return [data, ...prev];
        });
        if (data.sender_id?._id !== user?._id && data.sender_id !== user?._id) {
          markGroupAsRead(id as string, token as string);
        }
      }
    };

    const handleGroupTyping = (data: any) => {
      const { groupId, conversationId, conversation_id, isTyping, is_typing, userId, user_id, sender_id, user: typingUser } = data;
      const targetId = groupId || conversationId || conversation_id;
      const userIsTyping = isTyping !== undefined ? isTyping : is_typing;
      const typingUserId = userId || user_id || sender_id;

      if (targetId === id && typingUserId !== user?._id) {
        let displayName = typingUser?.nama || typingUser?.name;
        if (!displayName && groupDetail?.members) {
          const member = groupDetail.members.find((m: any) => m._id === typingUserId || m.id === typingUserId);
          if (member) displayName = member.nama || member.name;
        }
        const finalName = displayName || 'Seseorang';
        setTypingUsers(prev => ({ ...prev, [typingUserId]: finalName }));
        if (userIsTyping) {
          if (remoteTypingTimeouts.current[typingUserId]) clearTimeout(remoteTypingTimeouts.current[typingUserId]);
          remoteTypingTimeouts.current[typingUserId] = setTimeout(() => {
            setTypingUsers(prev => { const next = { ...prev }; delete next[typingUserId]; return next; });
            delete remoteTypingTimeouts.current[typingUserId];
          }, 4000);
        } else {
          setTypingUsers(prev => { const next = { ...prev }; delete next[typingUserId]; return next; });
          if (remoteTypingTimeouts.current[typingUserId]) {
            clearTimeout(remoteTypingTimeouts.current[typingUserId]);
            delete remoteTypingTimeouts.current[typingUserId];
          }
        }
      }
    };

    const handleStatusUpdate = (data: any) => {
      if (data.conversation_id === id) {
        setMessages(prev => prev.map(msg => {
          const statusOrder = { 'pending': 0, 'sent': 1, 'delivered': 2, 'read': 3 };
          const currentWeight = statusOrder[msg.status as keyof typeof statusOrder] || 0;
          const newWeight = statusOrder[data.status as keyof typeof statusOrder] || 0;
          if (newWeight > currentWeight) return { ...msg, status: data.status };
          return msg;
        }));
      }
    };

    const handleMuteUpdate = (data: any) => {
      if (data.groupId === id || data.conversationId === id) {
        setGroupDetail((prev: any) => {
          if (!prev) return { is_muted: data.is_muted };
          return { ...prev, is_muted: data.is_muted };
        });
      }
    };

    socket.on('new_message', handleGroupMessage);
    socket.on('group_typing_status', handleGroupTyping);
    socket.on('typing_status', handleGroupTyping);
    socket.on('message_status_update', handleStatusUpdate);
    socket.on('group_mute_update', handleMuteUpdate);

    return () => {
      socket.off('new_message', handleGroupMessage);
      socket.off('group_typing_status', handleGroupTyping);
      socket.off('typing_status', handleGroupTyping);
      socket.off('message_status_update', handleStatusUpdate);
      socket.off('group_mute_update', handleMuteUpdate);
    };
  }, [socket, id, user?._id, token, groupDetail]);

  const handleTyping = (text: string) => {
    setInputText(text);
    if (id && id !== 'new') {
      if (!isTyping) {
        setIsTyping(true);
        sendGroupTypingStatus(id as string, true, token as string);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        sendGroupTypingStatus(id as string, false, token as string);
      }, 2000);
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Izin Ditolak', 'Dibutuhkan akses ke galeri untuk mengirim gambar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedImage) || isSendingRef.current) return;
    if (!token) return;

    isSendingRef.current = true;
    const tempId = `temp-${Date.now()}`;
    const currentText = inputText;
    const currentImage = selectedImage;
    
    const pendingMsg = {
      _id: tempId,
      body: currentText.trim(),
      sender_id: user?._id,
      createdAt: new Date().toISOString(),
      status: 'pending',
      attachments: currentImage ? [{ file_url: currentImage.uri, file_type: 'image' }] : []
    };

    setInputText('');
    setSelectedImage(null);
    setIsSending(true);

    setMessages(prev => [pendingMsg, ...prev]);

    try {
      const files = currentImage ? [currentImage] : undefined;
      const params = { token, body: currentText, files, conversationId: id as string };
      const result = await sendGroupMessage(params);
      
      if (result.success && result.data) {
        setMessages(prev => {
          const filtered = prev.filter(m => m._id !== tempId);
          if (filtered.findIndex(m => m._id === result.data._id) !== -1) return filtered;
          return [result.data, ...filtered];
        });
        if (id === 'new' && result.data.conversation_id) {
          router.setParams({ id: result.data.conversation_id });
        }
      } else {
        Alert.alert('Gagal', result.message || 'Pesan gagal dikirim');
        setMessages(prev => prev.filter(m => m._id !== tempId));
        setInputText(currentText);
        setSelectedImage(currentImage);
      }
    } catch (error) {
      console.error('Send error:', error);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setInputText(currentText);
      setSelectedImage(currentImage);
    } finally {
      setIsSending(false);
      isSendingRef.current = false;
    }
  };

  const fetchSyllabus = async () => {
    setIsLoadingSyllabus(true);
    try {
      const response = await fetch(`https://api.metausosmed.my.id/api/v1/chat/subject/${id}/syllabus`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) setSyllabusData(result.data);
    } catch (error) {
      console.error('Fetch syllabus error:', error);
    } finally {
      setIsLoadingSyllabus(false);
    }
  };

  const fetchAssignments = async () => {
    setIsLoadingAssignments(true);
    try {
      const response = await fetch(`https://api.metausosmed.my.id/api/v1/chat/subject/${id}/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) setAssignmentsData(result.data);
    } catch (error) {
      console.error('Fetch assignments error:', error);
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  const handleShowSyllabus = () => {
    setIsMenuVisible(false);
    setIsSyllabusVisible(true);
    fetchSyllabus();
  };

  const handleShowAssignments = () => {
    setIsMenuVisible(false);
    setIsAssignmentsVisible(true);
    fetchAssignments();
  };

  const handleDownloadAndOpenFile = async (url: string, fileName: string, silent: boolean = false) => {
    if (!token) return;
    if (!silent) setIsDownloading(true);
    
    try {
      const prodUrl = url.replace('http://localhost:3000', 'https://api.metausosmed.my.id');
      const sanitizedFileName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const fileUri = `${FileSystem.cacheDirectory}${sanitizedFileName}`;
      let finalUri = fileUri;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      if (!fileInfo.exists) {
        const downloadRes = await FileSystem.downloadAsync(prodUrl, fileUri, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (downloadRes.status !== 200) {
          if (!silent) Alert.alert('Gagal', 'File tidak ditemukan di server.');
          return null;
        }
        finalUri = downloadRes.uri;
      }

      setCachedUri(finalUri);

      if (!silent) {
        const isImage = fileName.match(/\.(jpg|jpeg|png|gif)$/i);
        if (isImage) {
          try {
            const { status } = await MediaLibrary.requestPermissionsAsync(true);
            if (status === 'granted') {
              await MediaLibrary.saveToLibraryAsync(finalUri);
              Alert.alert('Berhasil', 'File telah disimpan ke Galeri Foto.');
            } else {
              await Sharing.shareAsync(finalUri);
            }
          } catch (err) {
            await Sharing.shareAsync(finalUri);
          }
        } else {
          await Sharing.shareAsync(finalUri);
        }
      }
      return finalUri;
    } catch (error) {
      if (!silent) {
        Alert.alert('Kesalahan', 'Gagal memproses file.');
      }
      return null;
    } finally {
      if (!silent) setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (activeAttachment && isPreviewVisible) {
      setCachedUri(null);
      handleDownloadAndOpenFile(activeAttachment.url, activeAttachment.name, true);
    }
  }, [activeAttachment, isPreviewVisible]);

  const handleToggleMute = async () => {
    if (!id || !groupDetail || !token) return;
    const newMuteStatus = !groupDetail.is_muted;
    try {
      const url = `https://api.metausosmed.my.id/api/v1/chat/subject/${id}/mute`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMuted: newMuteStatus })
      });
      const result = await response.json();
      if (result.success || response.ok) {
        setGroupDetail({ ...groupDetail, is_muted: newMuteStatus });
        Alert.alert('Berhasil', newMuteStatus ? 'Grup berhasil di Mute' : 'Grup berhasil di Unmute');
      }
    } catch (error) {
      Alert.alert('Kesalahan', 'Gagal mengubah status bungkaman.');
    }
  };

  const performDeleteMessage = async (messageId: string, type: 'me' | 'everyone' = 'me') => {
    if (!token) return;
    const result = await deleteGroupMessage(messageId, type, token);
    if (result.success) {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    } else {
      Alert.alert('Gagal', result.message);
    }
  };

  const handleDeleteMessage = (message: any) => {
    const isMe = message.sender_id?._id === user?._id || message.sender_id === user?._id;
    const options: any[] = [
      { text: "Hapus untuk Saya", style: "destructive", onPress: () => performDeleteMessage(message._id, 'me') },
      { text: "Batal", style: "cancel" }
    ];
    if (isMe) {
      options.unshift({ text: "Hapus untuk Semua", style: "destructive", onPress: () => performDeleteMessage(message._id, 'everyone') });
    }
    Alert.alert("Hapus Pesan", "Pilih tindakan untuk pesan ini:", options);
  };

  const handleUploadSyllabus = async () => {
    if (!syllabusUploadTitle.trim()) {
      Alert.alert('Error', 'Judul silabus tidak boleh kosong.');
      return;
    }
    setIsUploadingSyllabus(true);
    try {
      const formData = new FormData();
      formData.append('title', syllabusUploadTitle.trim());
      formData.append('meeting_number', String(uploadingMeetingNumber));
      if (selectedSyllabusFile) {
        formData.append('file', {
          uri: selectedSyllabusFile.uri,
          name: selectedSyllabusFile.name || `syllabus-${Date.now()}.pdf`,
          type: selectedSyllabusFile.mimeType || 'application/pdf',
        } as any);
      }
      const response = await fetch(`https://api.metausosmed.my.id/api/v1/chat/subject/${id}/syllabus`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': '*/*',
        },
        body: formData,
      });
      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert('Berhasil', 'Silabus berhasil diunggah.');
        setIsSyllabusUploadVisible(false);
        setSyllabusUploadTitle('');
        setSelectedSyllabusFile(null);
        fetchSyllabus();
      } else {
        Alert.alert('Gagal', result.message || 'Gagal mengunggah silabus.');
      }
    } catch (error) {
      Alert.alert('Error', 'Terjadi kesalahan saat mengunggah silabus.');
    } finally {
      setIsUploadingSyllabus(false);
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignmentUploadTitle.trim()) {
      Alert.alert('Error', 'Judul tugas tidak boleh kosong.');
      return;
    }
    setIsCreatingAssignment(true);
    try {
      const formData = new FormData();
      formData.append('title', assignmentUploadTitle.trim());
      formData.append('description', assignmentUploadDesc.trim());
      formData.append('due_date', assignmentDueDate.toISOString());
      if (selectedAssignmentFile) {
        formData.append('file', {
          uri: selectedAssignmentFile.uri,
          name: selectedAssignmentFile.name || `assignment-${Date.now()}.pdf`,
          type: selectedAssignmentFile.mimeType || 'application/pdf',
        } as any);
      }
      const response = await fetch(`https://api.metausosmed.my.id/api/v1/chat/subject/${id}/assignments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': '*/*',
        },
        body: formData,
      });
      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert('Berhasil', 'Tugas berhasil dibuat.');
        setIsAssignmentUploadVisible(false);
        setAssignmentUploadTitle('');
        setAssignmentUploadDesc('');
        setSelectedAssignmentFile(null);
        fetchAssignments();
      } else {
        Alert.alert('Gagal', result.message || 'Gagal membuat tugas.');
      }
    } catch (error) {
      Alert.alert('Error', 'Terjadi kesalahan saat membuat tugas.');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id?._id === user?._id || item.sender_id === user?._id;
    const senderName = item.sender_id?.nama || 'Anggota';
    const time = format(new Date(item.createdAt), 'HH:mm');
    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperRight : styles.messageWrapperLeft]}>
        {!isMe && (
          <Text style={{ color: theme.description, fontSize: 12, fontWeight: '500', paddingLeft: 12, paddingBottom: 4 }}>
            {senderName}
          </Text>
        )}
        <TouchableOpacity 
          activeOpacity={1}
          onLongPress={() => handleDeleteMessage(item)}
          style={[styles.messageBubble, isMe ? [styles.messageBubbleRight, { backgroundColor: theme.tint }] : [styles.messageBubbleLeft, { backgroundColor: theme.card }]]}
        >
          {item.attachments && item.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {item.attachments.map((att: any, idx: number) => (
                <TouchableOpacity key={idx} activeOpacity={0.85} onPress={() => setViewerUrl(att.url)}>
                  <SecureMedia url={att.url} token={token} style={styles.attachmentImage} contentFit="cover" />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {item.body ? (
            <View style={{ position: 'relative' }}>
              <Text style={[styles.messageText, { color: isMe ? '#FFF' : theme.text }]}>{item.body}</Text>
              <View style={styles.messageInfoAbsolute}>
                <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.description }]}>{time}</Text>
                {isMe && ((item.status === 'read' || item.is_read) ? <CheckCheck size={14} color="#4FC3F7" /> : <Check size={14} color="rgba(255,255,255,0.7)" />)}
              </View>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[styles.container, { backgroundColor: theme.background }, animatedContainerStyle]}>
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setIsDetailVisible(true)} style={{ marginLeft: 8, marginRight: 12 }}>
              {groupDetail?.avatar_url ? <Image source={{ uri: groupDetail.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} /> : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.tint + '20', justifyContent: 'center', alignItems: 'center' }}><Users size={20} color={theme.tint} /></View>}
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setIsDetailVisible(true)} style={styles.headerInfo}>
              <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{groupName || 'Grup Chat'}{groupDetail?.is_muted && <Text> 🔇</Text>}</Text>
              <Text style={[styles.headerStatus, { color: typingStatusText ? theme.tint : theme.description }]}>{typingStatusText || 'Klik untuk detail'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsMenuVisible(true)} style={styles.moreButton}>
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
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removePreviewButton}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={styles.removePreviewText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {groupDetail?.is_muted && !isDosen ? (
          <View style={[styles.mutedContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <Lock size={20} color={theme.description} />
            <Text style={[styles.mutedText, { color: theme.description }]}>Hanya dosen yang dapat mengirim pesan</Text>
          </View>
        ) : (
          <View ref={inputAreaRef} style={[styles.inputContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
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
                placeholder="Tulis pesan..."
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
              style={[
                styles.sendButton, 
                { backgroundColor: theme.tint }
              ]}
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
        )}

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

      {/* Action Menu Modal */}
      <Modal
        visible={isMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.menuModalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsMenuVisible(false)}
        >
          <View style={[styles.menuContent, { backgroundColor: theme.card }]}>
            {isDosen && (
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setIsMenuVisible(false);
                setTimeout(() => {
                  Alert.alert(
                    groupDetail?.is_muted ? 'Unmute Grup' : 'Mute Grup',
                    `Apakah Anda yakin ingin ${groupDetail?.is_muted ? 'Unmute' : 'Mute'} grup ini?`,
                    [
                      { text: 'Batal', style: 'cancel' },
                      { text: 'Ya, Lanjutkan', onPress: handleToggleMute }
                    ]
                  );
                }, 100);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: groupDetail?.is_muted ? '#E8F5E9' : '#FFEBEE' }]}>
                {groupDetail?.is_muted ? (
                  <Bell size={18} color="#4CAF50" />
                ) : (
                  <BellOff size={18} color="#D32F2F" />
                )}
              </View>
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                {groupDetail?.is_muted ? 'Unmute Grup' : 'Mute Grup'}
              </Text>
            </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleShowAssignments}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#E3F2FD' }]}>
                <BookOpen size={18} color="#2196F3" />
              </View>
              <Text style={[styles.menuItemText, { color: theme.text }]}>Tugas Kuliah</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleShowSyllabus}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#F3E5F5' }]}>
                <FileText size={18} color="#9C27B0" />
              </View>
              <Text style={[styles.menuItemText, { color: theme.text }]}>Materi Silabus</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setIsMenuVisible(false);
              handleShowDetail();
            }}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#F3E5F5' }]}>
                <Users size={18} color="#9C27B0" />
              </View>
              <Text style={[styles.menuItemText, { color: theme.text }]}>Detail Anggota</Text>
            </TouchableOpacity>
            
            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
            
            <TouchableOpacity style={styles.menuItem} onPress={() => setIsMenuVisible(false)}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#FAFAFA' }]}>
                <MoreVertical size={18} color="#757575" />
              </View>
              <Text style={[styles.menuItemText, { color: theme.text }]}>Lainnya...</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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

      {/* Group Detail Modal (Floating Card) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isDetailVisible}
        onRequestClose={() => setIsDetailVisible(false)}
      >
        <View style={styles.floatingModalOverlay}>
          {/* Background overlay to close modal */}
          <TouchableWithoutFeedback onPress={() => setIsDetailVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          {/* The Actual Card - Separated from touchable background */}
          <View style={[styles.floatingCard, { backgroundColor: theme.card }]}>
            {/* Scrollable Content */}
            <View style={[styles.membersSection, { marginTop: 0 }]}>
              <ScrollView 
                style={styles.membersScrollView} 
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                stickyHeaderIndices={[1]}
              >
                {/* Index 0: Icon & Info Section */}
                <View style={[styles.floatingCardHeader, { paddingBottom: 10, marginTop: 10 }]}>
                  <TouchableOpacity 
                    onPress={handlePickGroupAvatar}
                    disabled={!isDosen || isUploadingGroupAvatar}
                    style={[styles.avatarPlaceholderLarge, { backgroundColor: theme.tint + '20', overflow: 'hidden' }]}
                  >
                    {isUploadingGroupAvatar ? (
                      <ActivityIndicator size="small" color={theme.tint} />
                    ) : groupDetail?.avatar_url ? (
                      <Image source={{ uri: groupDetail.avatar_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Users size={32} color={theme.tint} />
                    )}
                    
                    {isDosen && !isUploadingGroupAvatar && (
                      <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: theme.card, borderRadius: 12, padding: 4, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2 }}>
                        <Camera size={14} color={theme.tint} />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Index 1: Sticky Name Section */}
                <View style={[styles.detailHeroName, { backgroundColor: theme.card, paddingVertical: 10 }]}>
                  <Text style={[styles.floatingCardTitle, { color: theme.text, marginTop: 0 }]}>{groupDetail?.name}</Text>
                  {groupDetail?.subject_info && (
                    <Text style={[styles.floatingCardSubtitle, { color: theme.description }]}>
                      {groupDetail.subject_info.code} • {groupDetail.subject_info.academic_year}
                    </Text>
                  )}
                  {groupDetail?.is_muted && (
                    <View style={[styles.muteStatusBadge, { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2', alignSelf: 'center' }]}>
                      <BellOff size={14} color="#D32F2F" />
                      <Text style={[styles.muteStatusText, { color: '#D32F2F' }]}>Mode Pengumuman Aktif (Muted)</Text>
                    </View>
                  )}
                  <View style={[styles.stickyNameDivider, { backgroundColor: theme.border, alignSelf: 'center' }]} />
                </View>

                {/* Index 2+: Members List */}
                <View style={{ paddingHorizontal: 0, paddingTop: 10 }}>
                  <Text style={[styles.sectionLabel, { color: theme.tint, marginBottom: 15 }]}>
                    ANGGOTA ({groupDetail?.members?.length || 0})
                  </Text>
                  
                  {isLoadingDetail ? (
                    <View style={{ gap: 5, paddingVertical: 10 }}>
                      <ModalItemSkeleton theme={theme} />
                      <ModalItemSkeleton theme={theme} />
                      <ModalItemSkeleton theme={theme} />
                      <ModalItemSkeleton theme={theme} />
                      <ModalItemSkeleton theme={theme} />
                    </View>
                  ) : (

                    groupDetail?.members?.map((member: any, index: number) => {
                      // Prepared for upcoming BE update with 'role' field
                      // Fallback to current 'admins' list check for backward compatibility
                      const isDosenMember = groupDetail?.admins?.some((admin: any) => 
                        (typeof admin === 'string' ? admin === member._id : admin._id === member._id)
                      );
                      
                      const mName = member.nama || member.name || 'Anggota';
                      const mId = member._id || member.id || member.nim; // Prioritaskan _id sistem daripada nim
                      const avatarUrl = member.avatar_url || member.avatar;
                      
                      return (
                        <TouchableOpacity 
                          key={index} 
                          style={styles.floatingMemberItem}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (mId) {
                              setIsDetailVisible(false);
                              router.push({
                                pathname: "/user/[id]",
                                params: { 
                                  id: mId,
                                  initialName: mName,
                                  initialNim: member.nim || '',
                                  initialAvatar: avatarUrl || ''
                                }
                              });
                            }
                          }}
                        >
                          <View style={styles.memberAvatarContainer}>
                            {avatarUrl ? (
                              <SecureMedia 
                                // [OLD API BACKUP]: url={avatarUrl.replace('http://localhost:3000', 'https://besosmed-production.up.railway.app')} 
                                url={avatarUrl.replace('http://localhost:3000', 'https://api.metausosmed.my.id')} 
                                token={token} 
                                style={styles.memberAvatarSmall} 
                              />
                            ) : (
                              <View style={[styles.memberAvatarSmall, { backgroundColor: theme.tint + '10', justifyContent: 'center', alignItems: 'center' }]}>
                                <User size={18} color={theme.tint} />
                              </View>
                            )}
                          </View>
                          <View style={styles.memberInfoSmall}>
                            <Text style={[styles.memberNameSmall, { color: theme.text }]}>{mName}</Text>
                            {mId && (
                              <Text style={[styles.memberNimSmall, { color: theme.description }]}>
                                NIM: {mId}
                              </Text>
                            )}
                          </View>
                          {isDosenMember && (
                            <View style={[styles.roleBadgeSmall, { backgroundColor: theme.tint + '15', borderWidth: 1, borderColor: theme.tint + '30' }]}>
                              <Text style={[styles.roleTextSmall, { color: theme.tint, fontSize: 10, fontWeight: 'bold' }]}>DOSEN</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Attachment Preview Modal */}
      <Modal
        visible={isPreviewVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPreviewVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Header Bar */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingTop: Platform.OS === 'ios' ? 60 : 40,
            paddingHorizontal: 20,
            paddingBottom: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }} numberOfLines={1}>
                {activeAttachment?.name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                Pratinjau Lampiran
              </Text>
            </View>
            <TouchableOpacity 
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 20 }}
              onPress={() => setIsPreviewVisible(false)}
            >
              <X size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Image Content */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {activeAttachment && (
              <SecureMedia 
                // [OLD API BACKUP]: url={activeAttachment.url.replace('http://localhost:3000', 'https://besosmed-production.up.railway.app')} 
                url={activeAttachment.url.replace('http://localhost:3000', 'https://api.metausosmed.my.id')} 
                token={token} 
                style={{ width: '100%', height: '80%' }}
                // @ts-ignore
                contentFit="contain"
              />
            )}
          </View>

          {/* Footer Actions */}
          <View style={{ 
            paddingBottom: Platform.OS === 'ios' ? 50 : 30,
            paddingHorizontal: 30,
            paddingTop: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            alignItems: 'center'
          }}>
            <TouchableOpacity 
              style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: theme.tint, 
                paddingHorizontal: 40, 
                paddingVertical: 15, 
                borderRadius: 30,
                gap: 12,
                shadowColor: theme.tint,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 10
              }}
              onPress={() => handleDownloadAndOpenFile(activeAttachment.url, activeAttachment.name)}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Download size={20} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Simpan Ke HP</Text>
                </>
              )}
            </TouchableOpacity>
            
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 15 }}>
              File akan disimpan secara permanen di folder Download/Galeri Anda
            </Text>
          </View>
        </View>
      </Modal>
      {/* Syllabus Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isSyllabusVisible}
        onRequestClose={() => setIsSyllabusVisible(false)}
      >
        <View style={styles.floatingModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsSyllabusVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[styles.floatingCard, { backgroundColor: theme.card }]}>
            <View style={[styles.floatingCardHeader, { flexDirection: 'column', alignItems: 'center' }]}>
              <View style={[styles.floatingIconContainer, { backgroundColor: '#F3E5F5', marginRight: 0, marginBottom: 12 }]}>
                <FileText size={24} color="#9C27B0" />
              </View>
              <Text style={[styles.floatingCardTitle, { color: theme.text, textAlign: 'center' }]} numberOfLines={1}>
                {groupDetail?.name}
              </Text>
              <Text style={[styles.floatingCardSubtitle, { color: theme.description, textAlign: 'center' }]}>
                Materi Silabus
              </Text>
            </View>

            <View style={[styles.floatingCardDivider, { backgroundColor: theme.border }]} />

            <View style={styles.membersSection}>
              <ScrollView 
                style={styles.membersScrollView} 
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {isLoadingSyllabus ? (
                  <View style={{ paddingVertical: 10 }}>
                    <ModalItemSkeleton theme={theme} />
                    <ModalItemSkeleton theme={theme} />
                    <ModalItemSkeleton theme={theme} />
                    <ModalItemSkeleton theme={theme} />
                  </View>
                ) : Array.from({ length: 14 }, (_, i) => i + 1).map((num) => {
                  const material = syllabusData.find(s => s.meeting_number === num);
                  return (
                    <View key={num} style={styles.syllabusItem}>
                      <View style={[styles.meetingBadge, { backgroundColor: material ? '#E8F5E9' : '#F5F5F5' }]}>
                        <Text style={[styles.meetingText, { color: material ? '#2E7D32' : '#757575' }]}>{num}</Text>
                      </View>
                      <View style={styles.syllabusInfo}>
                        <Text style={[styles.syllabusTitle, { color: theme.text }]} numberOfLines={1}>
                          {material?.title || `Materi Pertemuan ${num}`}
                        </Text>
                        <Text style={[styles.syllabusStatus, { color: material ? '#2E7D32' : theme.description }]}>
                          {material ? 'Materi tersedia' : 'Belum ada materi'}
                        </Text>
                      </View>
                      {material && (
                        <TouchableOpacity 
                          style={[styles.downloadButton, { backgroundColor: theme.tint + '15' }]}
                          onPress={() => {
                            const rawUrl = material.attachments?.[0]?.url;
                            if (rawUrl) {
                              handleDownloadAndOpenFile(rawUrl, material.attachments[0].name || `Materi-${num}.pdf`);
                            }
                          }}
                        >
                          <Download size={18} color={theme.tint} />
                        </TouchableOpacity>
                      )}
                      {isDosen && !material && (
                        <TouchableOpacity 
                          style={[styles.uploadButtonSmall, { backgroundColor: theme.border }]}
                          onPress={() => {
                            setUploadingMeetingNumber(num);
                            setIsSyllabusUploadVisible(true);
                            setIsSyllabusVisible(false);
                          }}
                        >
                          <Plus size={18} color={theme.text} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Syllabus Upload Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isSyllabusUploadVisible}
        onRequestClose={() => setIsSyllabusUploadVisible(false)}
      >
        <View style={styles.floatingModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsSyllabusUploadVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={[styles.floatingCard, { backgroundColor: theme.card }]}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
            <View style={styles.floatingCardHeader}>
              <View style={[styles.floatingIconContainer, { backgroundColor: '#F3E5F5' }]}>
                <Plus size={24} color="#9C27B0" />
              </View>
              <View>
                <Text style={[styles.floatingCardTitle, { color: theme.text }]}>Unggah Materi</Text>
                <Text style={[styles.floatingCardSubtitle, { color: theme.description }]}>Tambahkan materi untuk pertemuan ini</Text>
              </View>
            </View>

            <View style={[styles.floatingCardDivider, { backgroundColor: theme.border }]} />

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={styles.uploadForm}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Judul Materi</Text>
                <TextInput 
                  style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  placeholder="Contoh: Pengenalan Logika"
                  placeholderTextColor={theme.description}
                  value={syllabusUploadTitle}
                  onChangeText={setSyllabusUploadTitle}
                />

                <Text style={[styles.formLabel, { color: theme.text, marginTop: 15 }]}>Pilih File</Text>
                <TouchableOpacity 
                  style={[styles.filePickerBtn, { borderColor: theme.tint, backgroundColor: theme.tint + '10' }]}
                  onPress={() => pickDocument('syllabus')}
                >
                  <Paperclip size={20} color={theme.tint} />
                  <Text style={[styles.filePickerText, { color: theme.tint }]} numberOfLines={1}>
                    {selectedSyllabusFile ? selectedSyllabusFile.name : 'Pilih Lampiran (PDF/Doc)'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.formActionRow}>
                  <TouchableOpacity 
                    style={[styles.cancelBtn, { backgroundColor: theme.border }]}
                    onPress={() => {
                      setIsSyllabusUploadVisible(false);
                      setTimeout(() => {
                        setIsSyllabusVisible(true);
                      }, 100);
                    }}
                  >
                    <Text style={[styles.cancelBtnText, { color: theme.text }]}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.submitBtn, { backgroundColor: theme.tint }]}
                    onPress={handleUploadSyllabus}
                    disabled={isUploadingSyllabus}
                  >
                    {isUploadingSyllabus ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.submitBtnText}>Unggah</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Assignment Upload Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isAssignmentUploadVisible}
        onRequestClose={() => setIsAssignmentUploadVisible(false)}
      >
        <View style={styles.floatingModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsAssignmentUploadVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={[styles.floatingCard, { backgroundColor: theme.card }]}>
            <View style={styles.floatingCardHeader}>
              <View style={[styles.floatingIconContainer, { backgroundColor: '#E8F5E9' }]}>
                <Plus size={24} color="#4CAF50" />
              </View>
              <View>
                <Text style={[styles.floatingCardTitle, { color: theme.text }]}>Buat Tugas Baru</Text>
                <Text style={[styles.floatingCardSubtitle, { color: theme.description }]}>Berikan penugasan baru untuk mahasiswa</Text>
              </View>
            </View>

            <View style={[styles.floatingCardDivider, { backgroundColor: theme.border }]} />

            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
            >
              <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={true}
              >
                <View style={[styles.uploadForm, { marginTop: 4 }]}>
                  <View style={{ marginBottom: 0 }}>
                    <Text style={[styles.formLabel, { color: theme.text, fontWeight: '600', marginBottom: 6, fontSize: 13 }]}>Judul Tugas</Text>
                    <TextInput 
                      style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, height: 44, borderRadius: 12 }]}
                      placeholder="Masukkan judul tugas..."
                      placeholderTextColor={theme.description}
                      value={assignmentUploadTitle}
                      onChangeText={setAssignmentUploadTitle}
                    />
                  </View>

                  <View style={{ marginBottom: 10 }}>
                    <Text style={[styles.formLabel, { color: theme.text, fontWeight: '600', marginBottom: 6, fontSize: 13 }]}>Deskripsi</Text>
                    <TextInput 
                      style={[styles.formInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, height: 55, textAlignVertical: 'top', borderRadius: 12, paddingTop: 10 }]}
                      placeholder="Tulis instruksi tugas di sini..."
                      placeholderTextColor={theme.description}
                      value={assignmentUploadDesc}
                      onChangeText={setAssignmentUploadDesc}
                      multiline
                    />
                  </View>
                  
                  <View style={{ marginBottom: 10 }}>
                    <Text style={[styles.formLabel, { color: theme.text, fontWeight: '600', marginBottom: 6, fontSize: 13 }]}>Tenggat Waktu (Deadline)</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity 
                        style={[styles.datePickerBtn, { flex: 1, borderColor: theme.border, backgroundColor: theme.background, height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }]}
                        onPress={() => { setPickerMode('date'); setShowDatePicker(true); }}
                      >
                        <Calendar size={16} color={theme.tint} />
                        <Text style={[styles.datePickerText, { color: theme.text, fontSize: 13, marginLeft: 8 }]}>
                          {assignmentDueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.datePickerBtn, { flex: 1, borderColor: theme.border, backgroundColor: theme.background, height: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }]}
                        onPress={() => { setPickerMode('time'); setShowDatePicker(true); }}
                      >
                        <Clock size={16} color={theme.tint} />
                        <Text style={[styles.datePickerText, { color: theme.text, fontSize: 13, marginLeft: 8 }]}>
                          {assignmentDueDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {showDatePicker && (
                    <DateTimePicker
                      value={assignmentDueDate}
                      mode={pickerMode}
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (event.type === 'set' && selectedDate) {
                          const newDate = new Date(assignmentDueDate);
                          if (pickerMode === 'date') {
                            newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                          } else {
                            newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                          }
                          setAssignmentDueDate(newDate);
                        }
                      }}
                    />
                  )}

                  <View style={{ marginBottom: 5 }}>
                    <Text style={[styles.formLabel, { color: theme.text, fontWeight: '600', marginBottom: 6, fontSize: 13 }]}>Lampiran Materi (Opsional)</Text>
                    <TouchableOpacity 
                      style={[styles.filePickerBtn, { borderColor: theme.tint, borderStyle: 'dashed', height: 44, borderRadius: 12, backgroundColor: theme.tint + '05', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 0, justifyContent: 'flex-start', borderWidth: 1 }]}
                      onPress={() => pickDocument('assignment')}
                    >
                      <Paperclip size={18} color={theme.tint} />
                      <Text style={[styles.filePickerText, { color: theme.tint, fontSize: 13, fontWeight: '500', marginLeft: 8, flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                        {selectedAssignmentFile ? selectedAssignmentFile.name : 'Pilih File Lampiran'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.formActionRow, { marginTop: 12, paddingBottom: 16, gap: 10 }]}>
                    <TouchableOpacity 
                      style={[styles.cancelBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }]}
                      onPress={() => {
                        setIsAssignmentUploadVisible(false);
                        setTimeout(() => {
                          setIsAssignmentsVisible(true);
                        }, 100);
                      }}
                    >
                    <Text style={[styles.cancelBtnText, { color: theme.description, fontWeight: '600' }]}>Batal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.submitBtn, { backgroundColor: theme.tint, flex: 2, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: theme.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }]}
                    onPress={handleCreateAssignment}
                    disabled={isCreatingAssignment}
                  >
                    {isCreatingAssignment ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={[styles.submitBtnText, { color: '#FFF', fontWeight: '700' }]}>Buat Tugas</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Assignments Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isAssignmentsVisible}
        onRequestClose={() => setIsAssignmentsVisible(false)}
      >
        <View style={styles.floatingModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsAssignmentsVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View style={[styles.floatingCard, { backgroundColor: theme.card }]}>
            <View style={[styles.floatingCardHeader, { flexDirection: 'column', alignItems: 'center' }]}>
              <View style={[styles.floatingIconContainer, { backgroundColor: '#E3F2FD', marginRight: 0, marginBottom: 12 }]}>
                <BookOpen size={24} color="#2196F3" />
              </View>
              <Text style={[styles.floatingCardTitle, { color: theme.text, textAlign: 'center' }]} numberOfLines={1}>
                {groupDetail?.name}
              </Text>
              <Text style={[styles.floatingCardSubtitle, { color: theme.description, textAlign: 'center' }]}>
                Tugas Kuliah
              </Text>
            </View>

            <View style={[styles.floatingCardDivider, { backgroundColor: theme.border }]} />

            <View style={styles.membersSection}>
              <ScrollView 
                style={styles.membersScrollView} 
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {isLoadingAssignments ? (
                  <View style={{ paddingVertical: 10 }}>
                    <ModalItemSkeleton theme={theme} />
                    <ModalItemSkeleton theme={theme} />
                    <ModalItemSkeleton theme={theme} />
                  </View>
                ) : assignmentsData.length > 0 ? (
                  assignmentsData.map((task) => (
                    <View key={task._id} style={styles.assignmentItem}>
                      <View style={styles.assignmentHeader}>
                        <Text style={[styles.assignmentTitle, { color: theme.text }]} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: task.status === 'ACTIVE' ? '#E8F5E9' : '#FFEBEE' }]}>
                          <Text style={[styles.statusText, { color: task.status === 'ACTIVE' ? '#2E7D32' : '#D32F2F' }]}>
                            {task.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.assignmentDesc, { color: theme.description }]} numberOfLines={2}>
                        {task.description}
                      </Text>
                      <View style={styles.assignmentFooter}>
                        <View style={styles.dueDateContainer}>
                          <Clock size={12} color={theme.description} />
                          <Text style={[styles.dueDateText, { color: theme.description }]}>
                            {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                         {task.attachments?.length > 0 && (
                          <TouchableOpacity 
                            style={styles.attachmentLink}
                            onPress={() => {
                              const attachment = task.attachments[0];
                              const isImage = attachment.name?.match(/\.(jpg|jpeg|png|gif)$/i) || attachment.type === 'image';
                              
                              if (isImage) {
                                setActiveAttachment(attachment);
                                setIsPreviewVisible(true);
                              } else {
                                handleDownloadAndOpenFile(attachment.url, attachment.name || 'Lampiran.pdf');
                              }
                            }}
                          >
                            <FileText size={12} color={theme.tint} />
                            <Text style={[styles.attachmentText, { color: theme.tint }]}>Lihat Lampiran</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={{ color: theme.description }}>Belum ada tugas yang diberikan.</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {isDosen && (
              <TouchableOpacity 
                style={[styles.createAssignmentBtn, { backgroundColor: theme.tint }]}
                onPress={() => {
                  setIsAssignmentUploadVisible(true);
                  setIsAssignmentsVisible(false);
                }}
              >
                <Plus size={20} color="#FFF" />
                <Text style={styles.createBtnText}>Buat Tugas Baru</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </Animated.View>
    </>
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
  moreButton: {
    padding: 5,
    marginLeft: 5,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A0AEC0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  headerName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 2,
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
    marginBottom: 4,
    marginLeft: 12,
    fontWeight: '500',
  },
  messageBubble: {
    maxWidth: '85%',
    minWidth: 80,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  messageBubbleRight: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderTopRightRadius: 0,
  },
  messageBubbleLeft: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 18,
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
    backgroundColor: 'transparent',
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
    height: 200,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  attachmentPlaceholder: {
    width: 200,
    height: 150,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
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
  removePreviewText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -2,
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
    marginBottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfoCard: {
    alignItems: 'center',
    marginBottom: 30,
  },
  groupIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  groupNameText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  subjectInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
    gap: 5,
  },
  subjectCode: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionHeader: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 15,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberNim: {
    fontSize: 13,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  roleText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 30,
    gap: 10,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  mutedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    gap: 10,
  },
  mutedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuMoreButton: {
    padding: 8,
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 100 : 60,
    paddingRight: 15,
  },
  menuContent: {
    width: 220,
    borderRadius: 15,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 8,
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
    height: '70%',
    borderRadius: 30,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  floatingCardHeader: {
    alignItems: 'center',
    marginBottom: 15,
  },
  floatingCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  floatingCardSubtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  muteStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
    gap: 5,
  },
  muteStatusText: {
    color: '#D32F2F',
    fontSize: 12,
    fontWeight: '600',
  },
  avatarPlaceholderLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadForm: {
    gap: 15,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  floatingCardDivider: {
    height: 1,
    width: '100%',
    marginVertical: 15,
  },
  membersSection: {
    flex: 1,
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 1,
  },
  membersScrollView: {
    flex: 1,
  },
  floatingMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  memberAvatarContainer: {
    marginRight: 12,
  },
  memberAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberInfoSmall: {
    flex: 1,
  },
  memberNameSmall: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberNimSmall: {
    fontSize: 12,
  },
  roleBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  roleTextSmall: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  closeButtonLarge: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonTextLarge: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  floatingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  syllabusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  meetingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  meetingText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  syllabusInfo: {
    flex: 1,
  },
  syllabusTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  syllabusStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentItem: {
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  assignmentDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  assignmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dueDateText: {
    fontSize: 11,
  },
  attachmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attachmentText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  createAssignmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  uploadFormCard: {
    width: '90%',
    borderRadius: 20,
    padding: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  uploadFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 15,
  },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 20,
  },
  filePickerText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 5,
  },
  datePickerText: {
    fontSize: 14,
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  detailHeroName: {
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  stickyNameDivider: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 15,
  },
  previewContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  previewImageWrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removePreviewButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePreviewText: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: 'bold',
  },
});
