import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Clipboard from 'expo-clipboard';
import { Copy, MessageCircle, MoreHorizontal, Share2, X } from 'lucide-react-native';
import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Dimensions,
} from 'react-native';

interface ShareModalProps {
  isVisible: boolean;
  onClose: () => void;
  postTitle?: string;
  postId: string;
  onShareSuccess: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ShareModal = ({
  isVisible,
  onClose,
  postTitle,
  postId,
  onShareSuccess,
}: ShareModalProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // Deep Link for the application
  const shareLink = `fesosmedmetamedia://post/${postId}`;
  const shareMessage = `${postTitle ? `"${postTitle}"\n\n` : ''}Lihat postingan ini di Metamedia:\n${shareLink}`;

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(shareLink);
      Alert.alert('Berhasil', 'Tautan telah disalin ke papan klip');
      onShareSuccess();
      onClose();
    } catch (error) {
      Alert.alert('Gagal', 'Gagal menyalin tautan');
    }
  };

  const handleWhatsAppShare = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        onShareSuccess();
        onClose();
      } else {
        Alert.alert('Gagal', 'WhatsApp tidak terpasang di perangkat ini');
      }
    } catch (error) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat membuka WhatsApp');
    }
  };

  const handleNativeShare = async () => {
    try {
      const result = await Share.share({
        message: shareMessage,
        url: Platform.OS === 'ios' ? shareLink : undefined,
        title: 'Bagikan Postingan',
      });

      if (result.action === Share.sharedAction) {
        // Successful share
        onShareSuccess();
        onClose();
      }
    } catch (error) {
      // Error or dismissed
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Bagikan ke</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.optionItem} 
              onPress={handleWhatsAppShare}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#25D366' }]}>
                <MessageCircle size={24} color="#FFF" />
              </View>
              <Text style={[styles.optionText, { color: theme.text }]}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionItem} 
              onPress={handleCopyLink}
            >
              <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
                <Copy size={24} color="#FFF" />
              </View>
              <Text style={[styles.optionText, { color: theme.text }]}>Salin Tautan</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionItem} 
              onPress={handleNativeShare}
            >
              <View style={[styles.iconContainer, { backgroundColor: theme.description }]}>
                <Share2 size={24} color="#FFF" />
              </View>
              <Text style={[styles.optionText, { color: theme.text }]}>Lainnya</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
             <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 30,
    paddingHorizontal: 10,
  },
  optionItem: {
    alignItems: 'center',
    width: SCREEN_WIDTH / 4,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    marginTop: 10,
  },
});
