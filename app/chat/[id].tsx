import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  Keyboard,
  UIManager,
  LayoutAnimation,
  FlatList,
  Alert,
  Image,
  Modal
} from 'react-native';


import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { getMessages, sendMessage, sendTypingStatus, deleteMessage, clearConversation, markAsRead } from '@/utils/chat';
import { ArrowLeft, Send, Paperclip, Check, CheckCheck, Clock, Trash2, Smile, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import SecureMedia from '@/components/SecureMedia';
import { format } from 'date-fns';

export default function ChatRoomScreen() {
  const { id, recipientId, recipientName, recipientAvatar } = useLocalSearchParams<{ id: string, recipientId: string, recipientName: string, recipientAvatar?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { token, user } = useAuth();
  const { lastEvent, socket } = useSocket();
  const flatListRef = useRef<FlatList>(null);
  const inputAreaRef = useRef<View>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [isRemoteOnline, setIsRemoteOnline] = useState(false);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const remoteTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch messages
  const fetchChatMessages = useCallback(async () => {
    if (!token || !id || id === 'new') {
      setIsLoading(false);
      return;
    }
    
    try {
      const result = await getMessages(id as string, token);
      if (result.success) {
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
  }, [fetchChatMessages, id, token]);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        LayoutAnimation.configureNext({
          duration: 300,
          create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
          update: { type: LayoutAnimation.Types.easeInEaseOut },
        });
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        LayoutAnimation.configureNext({
          duration: 250,
          update: { type: LayoutAnimation.Types.easeInEaseOut },
        });
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    // Initial mount logic
  }, []);

  useEffect(() => {
    if (!socket || !id || id === 'new') return;

    // Mark as read when entering the room
    markAsRead(id as string, token as string);

    const handleNewMessage = (data: any) => {
      if (data.conversation_id === id) {
        setMessages(prev => {
          const exists = prev.findIndex(m => m._id === data._id) !== -1;
          if (exists) return prev;
          return [data, ...prev];
        });
      }
    };

    const handleTypingStatus = (data: any) => {
      const { conversationId, conversation_id, isTyping, is_typing, userId, user_id, sender_id } = data;
      const targetId = conversationId || conversation_id;
      const userIsTyping = isTyping !== undefined ? isTyping : is_typing;
      const typingUserId = userId || user_id || sender_id;

      if (targetId === id && typingUserId !== user?._id) {
        setRemoteTyping(userIsTyping);
        if (userIsTyping) {
          if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current);
          remoteTypingTimeoutRef.current = setTimeout(() => {
            setRemoteTyping(false);
          }, 3000);
        }
      }
    };

    const handleStatusUpdate = (data: any) => {
      console.log('[ChatRoom] Status update received:', data);
      if (data.conversation_id === id) {
        setMessages(prev => prev.map(msg => ({
          ...msg,
          status: data.status || msg.status
        })));
      }
    };

    const handleUserStatusChange = (data: any) => {
      const { userId, status } = data;
      // Match the incoming userId with the recipientId of this room
      if (userId === recipientId) {
        setIsRemoteOnline(status === 'online');
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing_status', handleTypingStatus);
    socket.on('message_status_update', handleStatusUpdate);
    socket.on('user_status_change', handleUserStatusChange);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing_status', handleTypingStatus);
      socket.off('message_status_update', handleStatusUpdate);
      socket.off('user_status_change', handleUserStatusChange);
    };
  }, [socket, id, user?._id, token]);

  const handleTyping = (text: string) => {
    setInputText(text);
    
    if (id && id !== 'new') {
      if (!isTyping) {
        setIsTyping(true);
        sendTypingStatus(id as string, true, token as string);
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        sendTypingStatus(id as string, false, token as string);
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
        ...(id && id !== 'new' ? { conversationId: id as string } : { recipientId: recipientId as string })
      };

      const result = await sendMessage(params);
      
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

  const handleClearChat = () => {
    if (!id || id === 'new') return;
    Alert.alert(
      "Bersihkan Obrolan",
      "Apakah Anda yakin ingin membersihkan seluruh obrolan ini?",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Bersihkan", 
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            const result = await clearConversation(id as string, token);
            if (result.success) {
              setMessages([]);
            } else {
              Alert.alert('Gagal', result.message);
            }
          }
        }
      ]
    );
  };

  const performDeleteMessage = async (messageId: string, type: 'me' | 'everyone') => {
    if (!token) return;
    const result = await deleteMessage(messageId, type, token);
    if (result.success) {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    } else {
      Alert.alert('Gagal', result.message);
    }
  };

  const handleDeleteMessage = (message: any) => {
    const isMe = message.sender_id === user?._id || message.sender_id?._id === user?._id;
    
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
    const isMe = item.sender_id === user?._id || item.sender_id?._id === user?._id;
    const time = format(new Date(item.createdAt), 'HH:mm');
    
    return (
      <View style={[
        styles.messageWrapper, 
        isMe ? styles.messageWrapperRight : styles.messageWrapperLeft
      ]}>
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
                att.url && att.url.includes('/api/v1/chat/media') ? (
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
      <View 
        style={[
          styles.container, 
          { 
            backgroundColor: theme.background,
            paddingBottom: Math.max(0, keyboardHeight)
          }
        ]}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { backgroundColor: theme.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
              activeOpacity={0.7}
              onPress={() => {
                if (recipientId) {
                  router.push({
                    pathname: "/user/[id]",
                    params: { 
                      id: recipientId,
                      initialName: recipientName,
                      initialAvatar: recipientAvatar !== 'undefined' ? recipientAvatar : undefined
                    }
                  });
                }
              }}
            >
              {recipientAvatar && recipientAvatar !== 'undefined' ? (
                <Image source={{ uri: recipientAvatar as string }} style={styles.headerAvatar} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{recipientName ? recipientName.charAt(0).toUpperCase() : 'C'}</Text>
                </View>
              )}
              <View style={styles.headerInfo}>
                <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{recipientName || 'Chat'}</Text>
                {/* Only render status text if typing or online */}
                {(remoteTyping || isRemoteOnline) ? (
                  <Text style={[styles.headerStatus, { color: remoteTyping ? theme.tint : theme.tint }]}>
                    {remoteTyping ? 'Sedang mengetik...' : 'Online'}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
            {id && id !== 'new' && (
              <TouchableOpacity onPress={handleClearChat} style={styles.headerActionButton}>
                <Trash2 size={20} color={theme.description} />
              </TouchableOpacity>
            )}
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item._id || index.toString()}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
          />
        </View>

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
        <View 
          ref={inputAreaRef}
          style={[
            styles.inputContainer, 
            { 
              backgroundColor: theme.background, 
              borderTopColor: theme.border,
              paddingBottom: Platform.OS === 'ios' ? 25 : (keyboardHeight > 0 ? 10 : 0)
            }
          ]}
          onLayout={(event) => {
            const { x, y, width, height } = event.nativeEvent.layout;
            console.log('⭐⭐⭐ [DEBUG LAYOUT INBOX] Input Area Pos:', { x, y, width, height });
          }}
        >
          <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
            <TouchableOpacity style={styles.iconButton}>
              <Smile size={24} color={theme.description} />
            </TouchableOpacity>
            
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Message"
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
      </KeyboardAvoidingView>
    </View>
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
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A0AEC0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerActionButton: {
    padding: 5,
    marginLeft: 5,
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
  messagesList: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    gap: 10,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  messageWrapperRight: {
    justifyContent: 'flex-end',
  },
  messageWrapperLeft: {
    justifyContent: 'flex-start',
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
});
