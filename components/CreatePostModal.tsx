import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as ImagePicker from 'expo-image-picker';
import { Hash, Image as ImageIcon, MapPin, User2, X, Play } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Alert
} from 'react-native';

interface CreatePostModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type SelectedMedia = {
  uri: string;
  type: 'image' | 'video';
};

export default function CreatePostModal({ isVisible, onClose, onSuccess }: CreatePostModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, user, triggerRefresh } = useAuth();
  
  const [content, setContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const userData = {
    name: user?.nama || 'Pengguna Metamedia',
    avatar: `https://avatar.iran.liara.run/public/boy?username=${user?.nama || 'user'}`,
    prodi: user?.program_studi || 'Mahasiswa'
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Maaf, kami butuh izin galeri untuk mengunggah foto/video.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5, // Optional limit
    });

    if (!result.canceled) {
      const newMedia: SelectedMedia[] = result.assets.map(asset => ({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image'
      }));
      setSelectedMedia([...selectedMedia, ...newMedia]);
    }
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!content.trim() && selectedMedia.length === 0) return;

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('caption', content);
      
      // Loop through all selected media
      for (const item of selectedMedia) {
        const filename = item.uri.split('/').pop() || `upload-${Date.now()}.jpg`;
        const ext = filename.split('.').pop()?.toLowerCase();
        
        let type = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
        if (ext === 'png') type = 'image/png';
        else if (ext === 'mov') type = 'video/mp4';

        if (Platform.OS === 'web') {
          try {
            const blobResponse = await fetch(item.uri);
            const blob = await blobResponse.blob();
            formData.append('files', blob, filename);
          } catch (e) {
            console.error('Blob error:', e);
          }
        } else {
          // @ts-ignore
          formData.append('files', {
            uri: item.uri,
            name: filename,
            type: type,
          });
        }
      }

      console.log(`Sending post with ${selectedMedia.length} media items...`);

      const response = await fetch('https://besosmed-production.up.railway.app/api/v1/posts', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Berhasil', 'Postingan kamu sudah terbit! 🚀');
        triggerRefresh();
        onClose();
        setContent('');
        setSelectedMedia([]);
        if (onSuccess) onSuccess();
      } else {
        Alert.alert('Gagal', result.message || 'Gagal memposting. Coba lagi nanti.');
      }
    } catch (error) {
      console.error('Post error:', error);
      Alert.alert('Kesalahan', 'Terjadi kesalahan koneksi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
              <View style={styles.dragHandleContainer}>
                <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
              </View>

              {/* Header */}
              <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} disabled={isLoading}>
                  <X size={26} color={theme.text} strokeWidth={2.5} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Buat Postingan</Text>
                <TouchableOpacity 
                  style={[
                    styles.postButton, 
                    { backgroundColor: (content.length > 0 || selectedMedia.length > 0) && !isLoading ? theme.tint : theme.border }
                  ]}
                  disabled={(content.length === 0 && selectedMedia.length === 0) || isLoading}
                  onPress={handlePost}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={[styles.postButtonText, { color: (content.length > 0 || selectedMedia.length > 0) ? '#FFF' : theme.description }]}>Posting</Text>
                  )}
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
              >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                  {/* User Section */}
                  <View style={styles.userRow}>
                    <Image source={{ uri: userData.avatar }} style={styles.avatar} />
                    <View>
                      <Text style={[styles.userName, { color: theme.text }]}>{userData.name}</Text>
                      <View style={[styles.privacyBadge, { backgroundColor: theme.background }]}>
                        <User2 size={12} color={theme.description} />
                        <Text style={[styles.privacyText, { color: theme.description }]}>Publik</Text>
                      </View>
                    </View>
                  </View>

                  {/* Input Section */}
                  <TextInput
                    style={[styles.input, { color: theme.text, minHeight: selectedMedia.length > 0 ? 100 : 250 }]}
                    placeholder="Apa yang Anda pikirkan hari ini?"
                    placeholderTextColor={theme.description}
                    multiline
                    autoFocus={selectedMedia.length === 0}
                    value={content}
                    onChangeText={setContent}
                    textAlignVertical="top"
                    editable={!isLoading}
                  />

                  {/* Multi-Media Preview Scroll */}
                  {selectedMedia.length > 0 && (
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      style={styles.mediaPreviewList}
                      contentContainerStyle={{ gap: 12, paddingRight: 20 }}
                    >
                      {selectedMedia.map((item, index) => (
                        <View key={index} style={styles.mediaItemContainer}>
                          <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
                          {item.type === 'video' && (
                            <View style={styles.videoIndicator}>
                              <Play size={16} color="#FFF" fill="#FFF" />
                            </View>
                          )}
                          <TouchableOpacity 
                            style={styles.removeMediaButton} 
                            onPress={() => removeMedia(index)}
                            disabled={isLoading}
                          >
                            <View style={styles.removeIconBg}>
                              <X size={14} color="#FFF" />
                            </View>
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity style={styles.addMoreButton} onPress={pickMedia} disabled={isLoading}>
                        <View style={[styles.addMoreInner, { borderColor: theme.border }]}>
                          <ImageIcon size={24} color={theme.description} />
                          <Text style={{ color: theme.description, fontSize: 10, marginTop: 4 }}>Tambah</Text>
                        </View>
                      </TouchableOpacity>
                    </ScrollView>
                  )}
                </ScrollView>

                {/* Toolbar */}
                <View style={[styles.toolbar, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
                  <Text style={[styles.helperText, { color: theme.description }]}>Tambahkan ke postingan Anda</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionItem} onPress={pickMedia} disabled={isLoading}>
                      <ImageIcon size={24} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem} disabled={isLoading}>
                      <MapPin size={24} color="#F44336" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem} disabled={isLoading}>
                      <Hash size={24} color="#2196F3" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.charCount, { color: content.length > 250 ? '#F44336' : theme.description }]}>
                      {content.length}/280
                    </Text>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '90%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    elevation: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  postButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollContent: {
    padding: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  privacyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  input: {
    fontSize: 18,
    lineHeight: 26,
  },
  toolbar: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
  },
  helperText: {
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionItem: {
    padding: 2,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  mediaPreviewList: {
    marginTop: 20,
  },
  mediaItemContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#F1F3F5',
  },
  videoIndicator: {
    position: 'absolute',
    top: '40%',
    left: '40%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 6,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  removeIconBg: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreButton: {
    width: 120,
    height: 160,
  },
  addMoreInner: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
