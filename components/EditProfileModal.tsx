import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { X, User, MapPin, Calendar, Heart, AlignLeft, Save } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
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
    Alert,
    Pressable
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface EditProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ isVisible, onClose }: EditProfileModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user, updateProfile } = useAuth();
  
  const [bio, setBio] = useState(user?.bio || '');
  const [tempatLahir, setTempatLahir] = useState(user?.tempat_lahir || '');
  const [tanggalLahir, setTanggalLahir] = useState(user?.tanggal_lahir || '');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [agama, setAgama] = useState(user?.agama || '');
  const [isLoading, setIsLoading] = useState(false);

  const parseDate = (dateStr: string) => {
    if (!dateStr || dateStr === '-' || dateStr === 'string') return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // Handle DD-MM-YYYY
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date();
  };

  const formatDate = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Update local state when user prop changes (e.g. after a fetch)
  // Only trigger on visibility change to input fresh data from context
  useEffect(() => {
    if (isVisible && user) {
      setBio(user.bio || '');
      setTempatLahir(user.tempat_lahir || '');
      const tgl = user.tanggal_lahir || '';
      if (tgl && tgl !== 'string' && tgl !== '-') {
        setTanggalLahir(tgl);
        setDate(parseDate(tgl));
      } else {
        setTanggalLahir('');
        setDate(new Date());
      }
      setAgama(user.agama || '');
    }
  }, [isVisible]); // Only sync when modal opens

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
      setTanggalLahir(formatDate(selectedDate));
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    const result = await updateProfile({
      bio,
      tempat_lahir: tempatLahir,
      tanggal_lahir: tanggalLahir,
      agama
    });

    setIsLoading(false);
    if (result.success) {
      Alert.alert('Berhasil', 'Profil Anda telah diperbarui!');
      onClose();
    } else {
      Alert.alert('Gagal', result.message || 'Terjadi kesalahan saat memperbarui profil.');
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
                  <X size={26} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profil</Text>
                <TouchableOpacity 
                  style={[styles.saveButton, { backgroundColor: theme.tint }]}
                  disabled={isLoading}
                  onPress={handleSave}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Save size={18} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.saveButtonText}>Simpan</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
              >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                  
                  {/* Bio Section */}
                  <View style={styles.inputSection}>
                    <View style={styles.labelRow}>
                      <AlignLeft size={18} color={theme.tint} />
                      <Text style={[styles.label, { color: theme.text }]}>Bio</Text>
                    </View>
                    <TextInput
                      style={[styles.textArea, { 
                        color: theme.text, 
                        backgroundColor: theme.background,
                        borderColor: theme.border 
                      }]}
                      placeholder="Tulis sesuatu tentang dirimu..."
                      placeholderTextColor={theme.description}
                      multiline
                      numberOfLines={4}
                      value={bio}
                      onChangeText={setBio}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* Personal Info Section */}
                  <View style={styles.gridSection}>
                    <View style={styles.inputHalf}>
                      <View style={styles.labelRow}>
                        <MapPin size={18} color={theme.tint} />
                        <Text style={[styles.label, { color: theme.text }]}>Tempat Lahir</Text>
                      </View>
                      <TextInput
                        style={[styles.input, { 
                          color: theme.text, 
                          backgroundColor: theme.background,
                          borderColor: theme.border 
                        }]}
                        placeholder="Contoh: Padang"
                        placeholderTextColor={theme.description}
                        value={tempatLahir}
                        onChangeText={setTempatLahir}
                      />
                    </View>

                    <View style={styles.inputHalf}>
                      <View style={styles.labelRow}>
                        <Calendar size={18} color={theme.tint} />
                        <Text style={[styles.label, { color: theme.text }]}>Tanggal Lahir</Text>
                      </View>
                      <Pressable 
                        style={({ pressed }) => [
                          styles.input, 
                          { 
                            backgroundColor: theme.background,
                            borderColor: theme.border,
                            justifyContent: 'center',
                            opacity: pressed ? 0.7 : 1
                          }
                        ]}
                        onPress={() => setShowDatePicker(true)}
                        disabled={isLoading}
                        hitSlop={10}
                      >
                        <Text style={{ color: tanggalLahir ? theme.text : theme.description, fontSize: 16 }}>
                          {tanggalLahir || 'Pilih Tanggal'}
                        </Text>
                      </Pressable>
                      
                      {showDatePicker && (
                        <DateTimePicker
                          value={date}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={onDateChange}
                          maximumDate={new Date()} // Can't be born in the future
                        />
                      )}
                    </View>
                  </View>

                  <View style={styles.inputSection}>
                    <View style={styles.labelRow}>
                      <Heart size={18} color={theme.tint} />
                      <Text style={[styles.label, { color: theme.text }]}>Agama</Text>
                    </View>
                    <TextInput
                      style={[styles.input, { 
                        color: theme.text, 
                        backgroundColor: theme.background,
                        borderColor: theme.border 
                      }]}
                      placeholder="Contoh: Islam"
                      placeholderTextColor={theme.description}
                      value={agama}
                      onChangeText={setAgama}
                    />
                  </View>

                  <Text style={[styles.helperText, { color: theme.description }]}>
                    Data akademik (NIM, Prodi, Status) tidak dapat diubah secara mandiri. Hubungi bagian akademik jika terdapat kesalahan.
                  </Text>
                  
                </ScrollView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '80%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
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
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  inputSection: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  gridSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  inputHalf: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
    fontStyle: 'italic',
  }
});
