import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { getMessages, sendMessage, sendTypingStatus, deleteMessage, clearConversation } from '@/utils/chat';
import { ArrowLeft, Send, Paperclip, Check, CheckCheck, Trash2, Smile, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import SecureMedia from '@/components/SecureMedia';
import { format } from 'date-fns';

export default function ChatRoomScreen() {
  const { id, recipientId, recipientName } = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { token, user } = useAuth();
  const { lastEvent } = useSocket();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  
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
      const result = await getMessages(id as string, token);
      if (result.success) {
        // Sort descending because FlatList is inverted
        const sorted = result.data.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setMessages(sorted);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchChatMessages();
  }, [fetchChatMessages]);

  useEffect(() => {
    if (!lastEvent || !id || id === 'new') return;

    if (lastEvent.type === 'chat_message') {
      const newMsg = lastEvent.data;
      if (newMsg.conversation_id === id) {
        setMessages(prev => {
          if (prev.some(m => m._id === newMsg._id)) return prev;
          return [newMsg, ...prev];
        });
      }
    } else if (lastEvent.type === 'typing') {
      const { conversationId, isTyping: userIsTyping, userId } = lastEvent.data;
      if (conversationId === id && userId !== user?._id) {
        setRemoteTyping(userIsTyping);
        if (userIsTyping) {
          if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current);
          remoteTypingTimeoutRef.current = setTimeout(() => {
            setRemoteTyping(false);
          }, 3000);
        }
      }
    }
  }, [lastEvent, id, user?._id]);

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
    if (!inputText.trim() && !selectedImage) return;
    if (!token) return;

    const currentText = inputText;
    const currentImage = selectedImage;
    
    setInputText('');
    setSelectedImage(null);
    setIsSending(true);

    try {
      const files = currentImage ? [currentImage] : undefined;
      const params = {
        token,
        body: currentText,
        files,
        ...(id && id !== 'new' ? { conversationId: id as string } : { recipientId: recipientId as string })
      };

      const result = await sendMessage(params);
      
      if (result.success) {
        // Optimistically add to list or refetch
        setMessages(prev => [result.data, ...prev]);
        if (id === 'new' && result.data.conversation_id) {
          // If this was a new chat, we might want to update the ID, 
          // but for now relying on the backend returning the new message is fine
          router.setParams({ id: result.data.conversation_id });
        }
      } else {
        Alert.alert('Gagal', 'Pesan gagal dikirim');
        setInputText(currentText);
        setSelectedImage(currentImage);
      }
    } catch (error) {
      console.error('Send error:', error);
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
    const isMe = message.sender_id === user?._id;
    
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
    const isMe = item.sender_id === user?._id;
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
                  item.is_read ? 
                    <CheckCheck size={14} color="#FFF" style={styles.readIcon} /> : 
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
      <View style={[styles.header, { backgroundColor: theme.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerAvatarPlaceholder}>
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{recipientName ? recipientName.charAt(0).toUpperCase() : 'C'}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{recipientName || 'Chat'}</Text>
          <Text style={[styles.headerStatus, { color: remoteTyping ? theme.tint : theme.description }]}>
            {remoteTyping ? 'Sedang mengetik...' : 'Online'}
          </Text>
        </View>
        {id && id !== 'new' && (
          <TouchableOpacity onPress={handleClearChat} style={styles.headerActionButton}>
            <Trash2 size={20} color={theme.description} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
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
      <View style={[styles.inputContainer, { backgroundColor: 'transparent' }]}>
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
