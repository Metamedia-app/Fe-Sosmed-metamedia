import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  RefreshControl,
  ScrollView
} from 'react-native';
import { ChevronLeft, Search, MoreHorizontal, User as UserIcon, Menu } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter, Stack } from 'expo-router';
import { getAvatarUrl } from '@/utils/avatar';
import { FollowUser } from '@/utils/follow';

interface FollowListLayoutProps {
  users: FollowUser[];
  followingStates: Record<string, boolean>;
  loadingStates: Record<string, boolean>;
  onToggleFollow: (userId: string) => Promise<void>;
  activeTab: 'following' | 'followers' | 'friends';
  counts: {
    following: number;
    followers: number;
    friends: number;
  };
  profileOwnerName: string;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onTabChange: (tab: 'following' | 'followers' | 'friends') => void;
  currentUserId: string;
}

export const FollowListLayout: React.FC<FollowListLayoutProps> = ({
  users,
  followingStates,
  loadingStates,
  onToggleFollow,
  activeTab,
  counts,
  profileOwnerName,
  isLoading,
  isRefreshing,
  onRefresh,
  onTabChange,
  currentUserId
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(user => 
    user.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.nim.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTab = (id: 'following' | 'followers' | 'friends', label: string, count: number) => {
    const isActive = activeTab === id;
    return (
      <TouchableOpacity 
        style={[styles.tabItem, isActive && { borderBottomColor: theme.text, borderBottomWidth: 2 }]}
        onPress={() => onTabChange(id)}
      >
        <Text style={[
          styles.tabLabel, 
          { color: isActive ? theme.text : theme.description }
        ]}>
          {label} {count > 0 ? count.toLocaleString() : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderUserItem = ({ item }: { item: FollowUser }) => {
    const isFollowing = followingStates[item._id];
    const isLoading = loadingStates[item._id];
    const isSelf = item._id === currentUserId;

    let buttonLabel = '';
    if (activeTab === 'following') {
      buttonLabel = isFollowing ? 'Mengikuti' : 'Ikuti';
    } else if (activeTab === 'followers') {
      buttonLabel = isFollowing ? 'Friends' : 'Followback';
    } else {
       buttonLabel = isFollowing ? 'Friends' : 'Ikuti';
    }

    return (
      <TouchableOpacity 
        style={styles.userRow}
        onPress={() => router.push({
          pathname: "/user/[id]",
          params: { id: item._id, initialName: item.nama, initialNim: item.nim, initialAvatar: getAvatarUrl(item) }
        })}
      >
        <Image source={{ uri: getAvatarUrl(item) }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>{item.nama}</Text>
          <Text style={[styles.userSub, { color: theme.description }]} numberOfLines={1}>@{item.nim}</Text>
        </View>

        {!isSelf && (
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={[
                styles.followBtn, 
                { 
                  backgroundColor: !isFollowing ? theme.tint : theme.border + '50',
                }
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleFollow(item._id);
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={!isFollowing ? "#FFF" : theme.text} />
              ) : (
                <Text style={[
                  styles.followBtnText, 
                  { color: !isFollowing ? "#FFF" : theme.text }
                ]}>
                  {buttonLabel}
                </Text>
              )}
            </TouchableOpacity>
            
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#ffffffff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.headerTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
          {profileOwnerName}
        </Text>

        <View style={styles.userAddBtn} />
      </View>

      <View style={[styles.content, { backgroundColor: theme.background }]}>
        {/* Tabs */}
        <View style={[styles.tabsContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          {renderTab('following', 'Following', counts.following)}
          {renderTab('followers', 'Followers', counts.followers)}
          {renderTab('friends', 'Friends', counts.friends)}
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
          <View style={[styles.searchBox, { backgroundColor: theme.border + '50' }]}>
            <Search size={18} color={theme.description} />
            <TextInput 
              placeholder="Search" 
              placeholderTextColor={theme.description}
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* List */}
        {isLoading && !isRefreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.tint} />
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item._id}
            renderItem={renderUserItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.tint} />
            }
            ListEmptyComponent={
              <View style={styles.centerBox}>
                <Text style={{ color: theme.description }}>No users found</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 45,
    paddingBottom: 10,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginLeft: 0, // Parent headerLeft already has paddingHorizontal: 15
  },
  logo: {
    width: '80%',
    height: '80%',
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  backBtn: { 
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAddBtn: { 
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    marginHorizontal: 0, // Keep full width for main content but rounded at top
    overflow: 'hidden',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  searchContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  listContent: { paddingBottom: 110 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  userSub: { fontSize: 13 },
  actionContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnText: { fontSize: 14, fontWeight: 'bold' },
  menuBtn: { padding: 5 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
});
