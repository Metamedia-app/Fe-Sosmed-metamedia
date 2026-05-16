import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon, X, Play, Send } from 'lucide-react-native';
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
import { storyService } from '@/utils/story';
import { logEvent } from '../utils/analytics';

interface CreateStoryModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type SelectedMedia = {
  uri: string;
  type: 'image' | 'video';
};

export default function CreateStoryModal({ isVisible, onClose, onSuccess }: CreateStoryModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, user } = useAuth();
  
  const [content, setContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Maaf, kami butuh izin galeri untuk mengunggah cerita.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image'
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedMedia || !token) return;

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('content', content);
      
      const filename = selectedMedia.uri.split('/').pop() || `story-${Date.now()}.jpg`;
      const ext = filename.split('.').pop()?.toLowerCase();
      
      let type = selectedMedia.type === 'video' ? 'video/mp4' : 'image/jpeg';
      if (ext === 'png') type = 'image/png';
      else if (ext === 'mov') type = 'video/mp4';

      if (Platform.OS === 'web') {
        try {
          const blobResponse = await fetch(selectedMedia.uri);
          const blob = await blobResponse.blob();
          formData.append('file', blob, filename);
        } catch (e) {
          console.error('Blob error:', e);
          // Fallback to direct append if blob fails
          // @ts-ignore
          formData.append('file', {
            uri: selectedMedia.uri,
            name: filename,
            type: type,
          });
        }
      } else {
        // @ts-ignore
        formData.append('file', {
          uri: selectedMedia.uri,
          name: filename,
          type: type,
        });
      }

      const result = await storyService.createStory(token, formData);

      if (result.success) {
        Alert.alert('Berhasil', 'Cerita kamu sudah terbit! ✨');
        
        // CATAT ANALYTICS: Saat Story berhasil diunggah
        logEvent('create_story', { media_type: selectedMedia.type, has_text: content.length > 0 });
        
        setContent('');
        setSelectedMedia(null);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        Alert.alert('Gagal', result.message || 'Gagal mengunggah cerita.');
      }
    } catch (error) {
      console.error('Story upload error:', error);
      Alert.alert('Kesalahan', 'Terjadi kesalahan koneksi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} disabled={isLoading}>
                  <X size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Cerita Baru</Text>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                {selectedMedia ? (
                  <View style={styles.mediaPreviewContainer}>
                    <Image source={{ uri: selectedMedia.uri }} style={styles.mediaPreview} />
                    {selectedMedia.type === 'video' && (
                      <View style={styles.videoIndicator}>
                        <Play size={32} color="#FFF" fill="#FFF" />
                      </View>
                    )}
                    <TouchableOpacity 
                      style={styles.changeMediaButton} 
                      onPress={pickMedia}
                      disabled={isLoading}
                    >
                      <View style={styles.changeMediaInner}>
                        <ImageIcon size={16} color="#FFF" />
                        <Text style={styles.changeMediaText}>Ganti</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.pickPlaceholder, { borderColor: theme.border }]} onPress={pickMedia}>
                    <View style={[styles.pickIconBg, { backgroundColor: theme.background }]}>
                      <ImageIcon size={40} color={theme.tint} />
                    </View>
                    <Text style={[styles.pickText, { color: theme.text }]}>Pilih Foto atau Video</Text>
                    <Text style={[styles.pickSubtext, { color: theme.description }]}>Ceritakan momen seru kamu hari ini</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.inputSection}>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                    placeholder="Tambahkan teks (opsional)..."
                    placeholderTextColor={theme.description}
                    multiline
                    value={content}
                    onChangeText={setContent}
                    maxLength={100}
                    editable={!isLoading}
                  />
                  <Text style={[styles.charCount, { color: theme.description }]}>{content.length}/100</Text>
                </View>

                <TouchableOpacity 
                  style={[
                    styles.uploadButton, 
                    { backgroundColor: selectedMedia && !isLoading ? theme.tint : theme.border }
                  ]}
                  disabled={!selectedMedia || isLoading}
                  onPress={handleUpload}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.uploadButtonText}>Bagikan ke Cerita</Text>
                      <Send size={18} color="#FFF" />
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
  },
  pickPlaceholder: {
    width: '100%',
    height: 350,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  pickIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickText: {
    fontSize: 18,
    fontWeight: '600',
  },
  pickSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  mediaPreviewContainer: {
    width: '100%',
    height: 350,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoIndicator: {
    position: 'absolute',
    top: '40%',
    left: '42%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 15,
    borderRadius: 40,
  },
  changeMediaButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  changeMediaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  changeMediaText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  inputSection: {
    marginTop: 20,
    gap: 6,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  uploadButton: {
    marginTop: 24,
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
