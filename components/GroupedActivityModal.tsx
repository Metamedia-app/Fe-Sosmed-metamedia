import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  Platform 
} from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { X, User, ChevronRight } from 'lucide-react-native';
import { Notification, GroupedItem } from '@/utils/notification';
import { useRouter } from 'expo-router';

interface GroupedActivityModalProps {
  isVisible: boolean;
  onClose: () => void;
  notification: Notification | null;
}

export const GroupedActivityModal = ({ isVisible, onClose, notification }: GroupedActivityModalProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  if (!notification) return null;

  const handleItemPress = (item: GroupedItem) => {
    onClose();
    
    const postId = notification.post?._id;
    if (!postId) return;

    // Navigate to post detail with target comment
    router.push({
      pathname: "/post/[id]",
      params: { 
        id: postId,
        autoOpenComments: 'true',
        targetCommentId: item.reference_id
      }
    });
  };

  const formatItemTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Daftar Aktivitas</Text>
              <Text style={[styles.headerSubTitle, { color: theme.description }]}>
                {notification.message}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* User List */}
          <FlatList
            data={notification.grouped_items || []}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.userItem, { borderBottomColor: theme.border + '50' }]}
                onPress={() => handleItemPress(item)}
              >
                <View style={[styles.userIcon, { backgroundColor: theme.tint + '15' }]}>
                  <User size={18} color={theme.tint} />
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: theme.text }]}>{item.nama}</Text>
                  <Text style={[styles.userTime, { color: theme.description }]}>
                    {formatItemTime(item.at)}
                  </Text>
                </View>
                <ChevronRight size={18} color={theme.description} />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={{ color: theme.description }}>Tidak ada detail tersedia</Text>
              </View>
            }
          />
        </View>
      </View>
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
    height: '60%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 40,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
  },
  userIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  userTime: {
    fontSize: 12,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  }
});
