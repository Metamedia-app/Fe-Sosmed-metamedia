import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Users, X, Info, UserPlus } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { communityService } from '@/utils/chatCommunity';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CreateCommunityModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateCommunityModal({ isVisible, onClose, onSuccess }: CreateCommunityModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, triggerRefresh } = useAuth();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState(''); // Comma separated NIMs
  const [selectedAvatar, setSelectedAvatar] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(panY, {
        toValue: 0,
        tension: 60,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      panY.setValue(SCREEN_HEIGHT);
    }
  }, [isVisible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (e, gestureState) => {
        if (gestureState.dy > 0) panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const handleClose = () => {
    Animated.timing(panY, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setSelectedAvatar(result.assets[0]);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Peringatan', 'Nama komunitas tidak boleh kosong.');
      return;
    }
    
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('members', members); // Raw NIMs as provided in curl example

      if (selectedAvatar) {
        const filename = selectedAvatar.uri.split('/').pop() || `avatar-${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('avatar', { uri: selectedAvatar.uri, name: filename, type });
      } else {
        formData.append('avatar', '');
      }

      const res = await communityService.createCommunity(token || '', formData);
      
      if (res.success) {
        Alert.alert('Berhasil', 'Komunitas berhasil dibuat! 🚀');
        setName('');
        setDescription('');
        setMembers('');
        setSelectedAvatar(null);
        handleClose();
        if (onSuccess) onSuccess();
        triggerRefresh();
      } else {
        Alert.alert('Gagal', res.message || 'Gagal membuat komunitas.');
      }
    } catch (error) {
      console.error('Create community error:', error);
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
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.clickableOverlay} />
        </TouchableWithoutFeedback>
        
        <Animated.View 
          style={[
            styles.modalContainer, 
            { 
              backgroundColor: theme.card,
              transform: [{ translateY: panY }] 
            }
          ]}
        >
          <View {...panResponder.panHandlers}>
            <View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Buat Komunitas Baru</Text>
              <TouchableOpacity 
                style={[
                  styles.createButton, 
                  { backgroundColor: name.trim() && !isLoading ? theme.tint : theme.border }
                ]}
                disabled={!name.trim() || isLoading}
                onPress={handleCreate}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.createButtonText, { color: name.trim() ? '#FFF' : theme.description }]}>
                    Simpan
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Avatar Selection */}
              <TouchableOpacity onPress={pickAvatar} style={styles.avatarPickerContainer}>
                {selectedAvatar ? (
                  <Image source={{ uri: selectedAvatar.uri }} style={styles.avatarPreview} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Camera size={32} color={theme.description} />
                    <Text style={[styles.avatarLabel, { color: theme.description }]}>Pilih Foto</Text>
                  </View>
                )}
                <View style={[styles.cameraBadge, { backgroundColor: theme.tint }]}>
                  <Camera size={14} color="#FFF" />
                </View>
              </TouchableOpacity>

              {/* Form Fields */}
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.description }]}>Nama Komunitas</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Users size={20} color={theme.description} />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Contoh: Pecinta Kopi Metamedia"
                      placeholderTextColor={theme.description}
                      value={name}
                      onChangeText={setName}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.description }]}>Deskripsi (Opsional)</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.border, alignItems: 'flex-start', paddingTop: 12 }]}>
                    <Info size={20} color={theme.description} style={{ marginTop: 2 }} />
                    <TextInput
                      style={[styles.input, { color: theme.text, minHeight: 80 }]}
                      placeholder="Jelaskan tentang komunitas ini..."
                      placeholderTextColor={theme.description}
                      multiline
                      value={description}
                      onChangeText={setDescription}
                      textAlignVertical="top"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.description }]}>Undang Anggota (NIM)</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <UserPlus size={20} color={theme.description} />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Masukkan NIM (pisahkan dengan koma)"
                      placeholderTextColor={theme.description}
                      value={members}
                      onChangeText={setMembers}
                      editable={!isLoading}
                      autoCapitalize="none"
                    />
                  </View>
                  <Text style={[styles.hint, { color: theme.description }]}>
                    Contoh: 225520211002, 225520211003
                  </Text>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  clickableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    height: '85%',
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollContent: {
    padding: 20,
  },
  avatarPickerContainer: {
    alignItems: 'center',
    marginBottom: 30,
    alignSelf: 'center',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 50,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
    marginLeft: 4,
    marginTop: 2,
    fontStyle: 'italic',
  }
});
