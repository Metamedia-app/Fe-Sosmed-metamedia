import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  KeyboardAvoidingView
} from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AlertCircle, CheckCircle2, ChevronRight, Flag, X } from 'lucide-react-native';
import { getReportReasons, reportPost } from '@/utils/post';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReportPostModalProps {
  isVisible: boolean;
  onClose: () => void;
  postId: string;
  token: string;
}

export default function ReportPostModal({
  isVisible,
  onClose,
  postId,
  token
}: ReportPostModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [reasons, setReasons] = useState<string[]>([]);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (isVisible) {
      fetchReasons();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true
      }).start();
      // Reset state when closing
      setTimeout(() => {
        setSelectedReason(null);
        setReasonText('');
        setIsSuccess(false);
        setError(null);
      }, 300);
    }
  }, [isVisible]);

  const fetchReasons = async () => {
    setLoading(true);
    const result = await getReportReasons(token);
    if (result.success) {
      setReasons(result.data.reasons);
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;

    console.log('[ReportModal] Submitting report...', { postId, selectedReason, hasToken: !!token });
    setSubmitting(true);
    try {
      const result = await reportPost(postId, {
        reason_type: selectedReason,
        reason_text: reasonText
      }, token);

      console.log('[ReportModal] Submit result:', result);
      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.message);
      }
    } catch (e) {
      console.error('[ReportModal] Submit catch:', e);
      setError('Terjadi kesalahan sistem saat mengirim laporan.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    if (isSuccess) {
      return (
        <View style={styles.successContainer}>
          <CheckCircle2 size={60} color="#4CAF50" />
          <Text style={[styles.successTitle, { color: theme.text }]}>Laporan Terkirim</Text>
          <Text style={[styles.successDesc, { color: theme.description }]}>
            Terima kasih, laporan Anda telah kami terima dan akan segera ditinjau oleh tim moderasi.
          </Text>
          <TouchableOpacity 
            style={[styles.closeButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Selesai</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <View style={styles.header}>
          <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>Laporkan Postingan</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
            <X size={24} color={theme.description} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
          ) : error && !reasons.length ? (
            <View style={styles.errorContainer}>
              <AlertCircle size={40} color="#F44336" />
              <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
              <TouchableOpacity onPress={fetchReasons} style={styles.retryButton}>
                <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Coba Lagi</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.reasonsList}>
              <Text style={[styles.sectionTitle, { color: theme.description }]}>Pilih Alasan Laporan</Text>
              {reasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonItem,
                    { 
                      backgroundColor: selectedReason === reason ? theme.primary + '15' : 'transparent',
                      borderColor: selectedReason === reason ? theme.primary : 'transparent',
                      borderWidth: 1
                    }
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <Text style={[
                    styles.reasonLabel, 
                    { color: selectedReason === reason ? theme.primary : theme.text }
                  ]}>
                    {reason}
                  </Text>
                  {selectedReason === reason && <CheckCircle2 size={20} color={theme.primary} />}
                </TouchableOpacity>
              ))}

              <Text style={[styles.sectionTitle, { color: theme.description, marginTop: 20 }]}>
                Keterangan Tambahan (Opsional)
              </Text>
              <TextInput
                style={[
                  styles.textInput, 
                  { 
                    backgroundColor: theme.background, 
                    color: theme.text,
                    borderColor: theme.border,
                    textAlignVertical: 'top'
                  }
                ]}
                placeholder="Tuliskan detail laporan Anda di sini..."
                placeholderTextColor={theme.description}
                multiline
                numberOfLines={4}
                value={reasonText}
                onChangeText={setReasonText}
              />

              {error && (
                <View style={[styles.inlineError, { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' }]}>
                  <AlertCircle size={18} color="#D32F2F" />
                  <Text style={[styles.inlineErrorText, { color: '#D32F2F' }]}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: !selectedReason ? theme.border : theme.primary }
                ]}
                disabled={!selectedReason || submitting}
                onPress={handleSubmit}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitText}>Kirim Laporan</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </>
    );
  };

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <Animated.View 
                style={[
                  styles.content, 
                  { 
                    backgroundColor: theme.card,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                {renderContent()}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    minHeight: SCREEN_HEIGHT * 0.6,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeIcon: {
    position: 'absolute',
    right: 20,
    top: 15,
  },
  scrollContainer: {
    padding: 20,
  },
  loader: {
    marginTop: 50,
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reasonsList: {
    paddingBottom: 20,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 15,
    fontSize: 15,
    minHeight: 100,
    marginBottom: 25,
  },
  submitButton: {
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    flex: 1,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
  },
  successDesc: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  inlineErrorText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    marginTop: 30,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
