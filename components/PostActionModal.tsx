import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Edit3, Flag, Trash2, X, Copy, Share2 } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PostActionModalProps {
  isVisible: boolean;
  onClose: () => void;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReport?: () => void;
  onCopyLink?: () => void;
}

export default function PostActionModal({
  isVisible,
  onClose,
  isOwner,
  onEdit,
  onDelete,
  onReport,
  onCopyLink
}: PostActionModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  React.useEffect(() => {
    if (isVisible) {
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
    }
  }, [isVisible]);

  const handleAction = (callback: () => void) => {
    // Call callback first, then close to ensure the parent state is still active
    callback();
    onClose();
  };

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
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
              <View style={styles.header}>
                <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
              </View>

              <View style={styles.optionsContainer}>
                {isOwner ? (
                  <>
                    <TouchableOpacity 
                      style={styles.optionItem} 
                      onPress={() => handleAction(onEdit)}
                    >
                      <View style={[styles.iconBg, { backgroundColor: '#E3F2FD' }]}>
                        <Edit3 size={20} color="#1976D2" />
                      </View>
                      <Text style={[styles.optionText, { color: theme.text }]}>Edit Postingan</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.optionItem} 
                      onPress={() => {
                        console.log('[PostActionModal] Delete button pressed');
                        handleAction(onDelete);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconBg, { backgroundColor: '#FFEBEE' }]}>
                        <X size={20} color="#F44336" />
                      </View>
                      <Text style={[styles.optionText, { color: '#F44336' }]}>Hapus Postingan</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={styles.optionItem} 
                      onPress={() => handleAction(onReport || (() => {}))}
                    >
                      <View style={[styles.iconBg, { backgroundColor: '#FFF3E0' }]}>
                        <Flag size={20} color="#F57C00" />
                      </View>
                      <Text style={[styles.optionText, { color: theme.text }]}>Laporkan Postingan</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity 
                   style={styles.optionItem} 
                   onPress={() => handleAction(onCopyLink || (() => {}))}
                >
                  <View style={[styles.iconBg, { backgroundColor: theme.background }]}>
                    <Copy size={20} color={theme.description} />
                  </View>
                  <Text style={[styles.optionText, { color: theme.text }]}>Salin Tautan</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.cancelButton, { backgroundColor: theme.background }]} 
                  onPress={onClose}
                >
                  <Text style={[styles.cancelText, { color: theme.text }]}>Batal</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  optionsContainer: {
    paddingHorizontal: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 15,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
