import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard,
  Modal, ScrollView, Image
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { getGroupMessages, sendGroupMessage, sendGroupTypingStatus, deleteGroupMessage, markGroupAsRead, getGroupDetail, toggleGroupMute } from '@/utils/chatMatkul';
import { markAsRead } from '@/utils/chat';
import { ArrowLeft, Send, Paperclip, Check, CheckCheck, Clock, Trash2, Smile, Camera, X, Users, BookOpen, BellOff, Bell, Lock, MoreVertical } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import SecureMedia from '@/components/SecureMedia';
import { format } from 'date-fns';

export default function GroupChatRoomScreen() {
  const { id, groupName } = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { token, user } = useAuth();
  const { lastEvent, socket } = useSocket();

  console.log('[DEBUG ROLE] Current User Role:', user?.role);
  if (user) console.log('[DEBUG USER] Full User Data:', JSON.stringify(user));
  
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState('');
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [groupDetail, setGroupDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  // Calculate if user is dosen based on group member data or global profile role
  const isDosen = useMemo(() => {
    const myId = user?._id || user?.id;
    const myMemberData = groupDetail?.members?.find((m: any) => m._id === myId || m.id === myId);
    const roleFromGroup = myMemberData?.role?.toLowerCase() === 'dosen';
    
    console.log('[DEBUG MUTE] My ID:', myId);
    console.log('[DEBUG MUTE] Role from Profile:', user?.role);
    console.log('[DEBUG MUTE] Found My Member Data:', JSON.stringify(myMemberData));
    
    return (user?.role?.toLowerCase() === 'dosen') || roleFromGroup;
  }, [groupDetail, user]);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const remoteTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch messages
  const fetchChatMessages = useCallback(async () => {
    if (!token || !id || id === 'new') {
      setIsLoading(false);
      return;
    }
    
    try {
      const result = await getGroupMessages(id as string, token);
      if (result.success) {
        if (result.data.length > 0) {
          console.log('[Debug Pesan Grup] Status Pesan Pertama:', result.data[0].status, result.data[0].body);
        }
        const sorted = result.data.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        // Ensure no duplicates from backend
        const unique = Array.from(new Map(sorted.map((item: any) => [item._id, item])).values());
        setMessages(unique);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchChatMessages();
    // Also fetch group detail immediately to know mute status/role
    if (token && id && id !== 'new') {
      getGroupDetail(id as string, token as string).then(result => {
        if (result.success) {
          console.log('[DEBUG API] Group Detail Response:', JSON.stringify(result.data));
          console.log('[DEBUG API] Is Muted from Server:', result.data.is_muted);
          setGroupDetail(result.data);
        }
      });
    }
  }, [fetchChatMessages, id, token]);

  useEffect(() => {
    if (!socket || !id || id === 'new') return;

    // Mark as read when entering the room
    markGroupAsRead(id as string, token as string);

    const handleGroupMessage = (data: any) => {
      if (data.conversation_id === id) {
        // Mark as read when new message arrives
        markGroupAsRead(id as string, token as string);
        
        setMessages(prev => {
          const exists = prev.findIndex(m => m._id === data._id) !== -1;
          if (exists) return prev;
          return [data, ...prev];
        });
      }
    };

    const handleGroupTyping = (data: any) => {
      const { groupId, conversationId, isTyping: userIsTyping, userId, user: typingUser } = data;
      const targetId = groupId || conversationId;
      if (targetId === id && userId !== user?._id) {
        // If backend provides user object with name
        const displayName = typingUser?.nama || 'Seseorang';
        setRemoteTyping(userIsTyping ? `${displayName} sedang mengetik...` : '');
        
        if (userIsTyping) {
          if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current);
          remoteTypingTimeoutRef.current = setTimeout(() => {
            setRemoteTyping('');
          }, 3000);
        }
      }
    };

    const handleStatusUpdate = (data: any) => {
      if (data.conversation_id === id) {
        console.log('[GroupChat] Status update received:', data.status);
        setMessages(prev => prev.map(msg => {
          // Only update status if it's a progress (sent -> delivered -> read)
          const statusOrder = { 'pending': 0, 'sent': 1, 'delivered': 2, 'read': 3 };
          const currentWeight = statusOrder[msg.status as keyof typeof statusOrder] || 0;
          const newWeight = statusOrder[data.status as keyof typeof statusOrder] || 0;
          
          if (newWeight > currentWeight) {
            return { ...msg, status: data.status };
          }
          return msg;
        }));
      }
    };

    const handleMuteUpdate = (data: any) => {
      // Data: { groupId: "...", is_muted: true/false }
      if (data.groupId === id || data.conversationId === id) {
        console.log('[GroupChat] Mute update received:', data.is_muted);
        setGroupDetail(prev => {
          if (!prev) return { is_muted: data.is_muted };
          return { ...prev, is_muted: data.is_muted };
        });
      }
    };

    socket.on('new_message', handleGroupMessage);
    socket.on('group_typing_status', handleGroupTyping);
    socket.on('message_status_update', handleStatusUpdate);
    socket.on('group_mute_update', handleMuteUpdate); // Mendengarkan sinyal bungkam

    return () => {
      socket.off('new_message', handleGroupMessage);
      socket.off('group_typing_status', handleGroupTyping);
      socket.off('message_status_update', handleStatusUpdate);
      socket.off('group_mute_update', handleMuteUpdate);
    };
  }, [socket, id, user?._id, token]);

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
    if ((!inputText.trim() && !selectedImage) || isSending) return;
    if (!token) return;

    const tempId = `temp-${Date.now()}`;
    const currentText = inputText;
    const currentImage = selectedImage;
    
    // Create optimistic message
    const pendingMsg = {
      _id: tempId,
      body: currentText.trim(),
      sender_id: user?._id,
      createdAt: new Date().toISOString(),
      status: 'pending', // Special status for clock icon
      attachments: currentImage ? [{ file_url: currentImage.uri, file_type: 'image' }] : []
    };

    setInputText('');
    setSelectedImage(null);
    setIsSending(true);

    // Optimistically add to list
    setMessages(prev => [pendingMsg, ...prev]);

    try {
      const files = currentImage ? [currentImage] : undefined;
      const params = {
        token,
        body: currentText,
        files,
        conversationId: id as string
      };

      const result = await sendGroupMessage(params);
      
      if (result.success && result.data) {
        // Replace temp message with real one from server
        setMessages(prev => {
          const filtered = prev.filter(m => m._id !== tempId);
          if (filtered.findIndex(m => m._id === result.data._id) !== -1) return filtered;
          return [result.data, ...filtered];
        });
        
        if (id === 'new' && result.data.conversation_id) {
          router.setParams({ id: result.data.conversation_id });
        }
      } else {
        Alert.alert('Gagal', 'Pesan gagal dikirim');
        // Remove optimistic message if failed
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
    }
  };

  const handleShowDetail = async () => {
    if (!id || id === 'new') return;
    setIsDetailVisible(true);
    setIsLoadingDetail(true);
    try {
      const result = await getGroupDetail(id as string, token as string);
      if (result.success) {
        // Merge the new data but PRESERVE the current is_muted state
        setGroupDetail((prev: any) => ({
          ...result.data,
          is_muted: prev?.is_muted ?? result.data?.is_muted
        }));
      }
    } catch (error) {
      console.error('Error loading group detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleToggleMute = async () => {
    if (!id || !groupDetail || !token) return;
    const newMuteStatus = !groupDetail.is_muted;
    const result = await toggleGroupMute(id as string, newMuteStatus, token);
    if (result.success) {
      setGroupDetail({ ...groupDetail, is_muted: newMuteStatus });
      Alert.alert('Berhasil', newMuteStatus ? 'Grup berhasil dibungkam' : 'Grup berhasil dibuka');
    } else {
      Alert.alert('Gagal', result.message || 'Gagal mengubah status grup');
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
      { 
        text: "Hapus untuk Saya", 
        style: "destructive",
        onPress: () => performDeleteMessage(message._id, 'me')
      },
      { text: "Batal", style: "cancel" }
    ];

    if (isMe) {
      options.unshift({
        text: "Hapus untuk Semua",
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

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id?._id === user?._id || item.sender_id === user?._id;
    const senderName = item.sender_id?.nama || 'Anggota';
    const time = format(new Date(item.createdAt), 'HH:mm');
    
    return (
      <View style={[
        styles.messageWrapper, 
        isMe ? styles.messageWrapperRight : styles.messageWrapperLeft
      ]}>
        {!isMe && (
          <Text style={[styles.senderName, { color: theme.description }]}>
            {senderName}
          </Text>
        )}
        <TouchableOpacity 
          activeOpacity={0.8}
          onLongPress={() => handleDeleteMessage(item)}
          style={[
            styles.messageBubble,
            isMe ? [styles.messageBubbleRight, { backgroundColor: theme.tint }] : [styles.messageBubbleLeft, { backgroundColor: theme.card }]
          ]}
        >
          {item.attachments && item.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {item.attachments.map((att: any, idx: number) => (
                att.url && (att.url.includes('/api/v1/chat/media') || att.url.includes('/api/v1/chat-matkul/media')) ? (
                  <SecureMedia 
                    key={idx} 
                    url={att.url} 
                    token={token} 
                    style={styles.attachmentImage} 
                    contentFit="cover"
                  />
                ) : (
                  <View key={idx} style={styles.attachmentPlaceholder}>
                    <Text style={{ color: isMe ? '#FFF' : theme.text }}>Attachment</Text>
                  </View>
                )
              ))}
            </View>
          )}
          
          {item.body ? (
            <View style={{ position: 'relative' }}>
              <Text style={[styles.messageText, { color: isMe ? '#FFF' : theme.text }]}>
                {item.body}
              </Text>
              <View style={styles.messageInfoAbsolute}>
                <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.description }]}>
                  {time}
                </Text>
                {isMe && (
                  (item.status === 'read' || item.is_read) ? 
                    <CheckCheck size={14} color="#4FC3F7" style={styles.readIcon} /> : 
                    item.status === 'delivered' ?
                    <CheckCheck size={14} color="rgba(255,255,255,0.7)" style={styles.readIcon} /> :
                    item.status === 'pending' ?
                    <Clock size={11} color="rgba(255,255,255,0.5)" style={styles.readIcon} /> :
                    <Check size={14} color="rgba(255,255,255,0.7)" style={styles.readIcon} />
                )}
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
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 25}
      >
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={handleShowDetail}
          style={styles.headerInfo}
        >
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
            {groupName || 'Grup Chat'}
          </Text>
          <Text style={[styles.headerStatus, { color: remoteTyping ? theme.tint : theme.description }]}>
            {remoteTyping || 'Klik untuk detail grup'}
          </Text>
        </TouchableOpacity>

        {isDosen && (
          <TouchableOpacity 
            onPress={() => {
              Alert.alert(
                groupDetail?.is_muted ? 'Buka Pembungkaman' : 'Bungkam Grup',
                `Apakah Anda yakin ingin ${groupDetail?.is_muted ? 'membuka' : 'membungkam'} grup ini?`,
                [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Ya, Lanjutkan', onPress: handleToggleMute }
                ]
              );
            }}
            style={styles.moreButton}
          >
            {groupDetail?.is_muted ? (
              <BellOff size={22} color="#D32F2F" />
            ) : (
              <MoreVertical size={24} color={theme.text} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Group Detail Modal */}
      <Modal
        visible={isDetailVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Detail Grup</Text>
              <TouchableOpacity onPress={() => setIsDetailVisible(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {isLoadingDetail ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={theme.tint} />
              </View>
            ) : groupDetail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.groupInfoCard}>
                  <View style={[styles.groupIconContainer, { backgroundColor: theme.tint + '20' }]}>
                    <Users size={40} color={theme.tint} />
                  </View>
                  <Text style={[styles.groupNameText, { color: theme.text }]}>{groupDetail.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {groupDetail.subject_info && (
                      <View style={styles.subjectInfoBadge}>
                        <BookOpen size={14} color={theme.description} />
                        <Text style={[styles.subjectCode, { color: theme.description }]}>
                          {groupDetail.subject_info.code}
                        </Text>
                      </View>
                    )}
                    {groupDetail.is_muted && (
                      <View style={[styles.subjectInfoBadge, { backgroundColor: '#FFEBEE' }]}>
                        <BellOff size={14} color="#D32F2F" />
                        <Text style={[styles.subjectCode, { color: "#D32F2F" }]}>Dibungkam</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.tint }]}>
                    Anggota ({groupDetail.members?.length || 0})
                  </Text>
                </View>

                {groupDetail.members?.map((member: any) => (
                  <View key={member._id} style={[styles.memberItem, { borderBottomColor: theme.border }]}>
                    {member.avatar_url ? (
                      <SecureMedia url={member.avatar_url} token={token} style={styles.memberAvatar} />
                    ) : (
                      <View style={[styles.memberAvatar, { backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: theme.description, fontWeight: 'bold' }}>
                          {member.nama?.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: theme.text }]}>{member.nama}</Text>
                      <Text style={[styles.memberNim, { color: theme.description }]}>{member.nim}</Text>
                    </View>
                    {member.role === 'dosen' && (
                      <View style={[styles.roleBadge, { backgroundColor: '#FF9800' }]}>
                        <Text style={styles.roleText}>Dosen</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.modalError}>
                <Text style={{ color: theme.description }}>Gagal memuat detail grup</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item._id || index.toString()}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Selected Image Preview */}
      {selectedImage && (
        <View style={[styles.previewContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <View style={styles.previewImageWrapper}>
            <SecureMedia url={selectedImage.uri} token={token} style={styles.previewImage} />
            <TouchableOpacity 
              style={styles.removePreviewButton}
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.removePreviewText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input Area */}
      {groupDetail?.is_muted && !isDosen ? (
        <View style={[styles.mutedContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <Lock size={20} color={theme.description} />
          <Text style={[styles.mutedText, { color: theme.description }]}>
            Hanya dosen yang dapat mengirim pesan
          </Text>
        </View>
      ) : (
        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
            <TouchableOpacity style={styles.iconButton}>
              <Smile size={24} color={theme.description} />
            </TouchableOpacity>
            
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Tulis pesan..."
              placeholderTextColor={theme.description}
              value={inputText}
              onChangeText={handleTyping}
              multiline
              maxLength={1000}
            />
            
            <TouchableOpacity style={styles.iconButton} onPress={handlePickImage}>
              <Paperclip size={20} color={theme.description} style={{ transform: [{ rotate: '-45deg' }] }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, { marginRight: 5 }]}>
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
      </KeyboardAvoidingView>
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
  moreButton: {
    padding: 8,
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
