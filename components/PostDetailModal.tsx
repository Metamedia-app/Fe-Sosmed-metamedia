import React from 'react';
import { 
  Modal, 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  ScrollView 
} from 'react-native';
import { X } from 'lucide-react-native';
import { PostCard, PostData } from '@/components/PostCard';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface PostDetailModalProps {
  isVisible: boolean;
  onClose: () => void;
  post: PostData | null;
  onDeleteSuccess?: () => void;
}

export const PostDetailModal = ({ isVisible, onClose, post, onDeleteSuccess }: PostDetailModalProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  if (!post) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.9)' }]}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header with Close Button */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.cardWrapper, { backgroundColor: theme.background }]}>
              <PostCard 
                post={post} 
                onDeleteSuccess={() => {
                  onDeleteSuccess?.();
                  onClose();
                }} 
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  cardWrapper: {
    marginHorizontal: 10,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
});
