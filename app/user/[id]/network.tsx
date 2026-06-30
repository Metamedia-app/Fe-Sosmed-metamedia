import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, User as UserIcon } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl } from 'react-native';
import { getAvatarUrl } from '@/utils/avatar';
import { getFollowers, FollowUser, followUser, unfollowUser, getFollowing, getOtherUserProfile } from '@/utils/follow';
import { FollowListLayout } from '@/components/FollowListLayout';

export default function NetworkScreen() {
  const { id, initialTab = 'followers' } = useLocalSearchParams<{ id: string, initialTab?: 'followers' | 'following' | 'friends' }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [followersList, setFollowersList] = useState<FollowUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const [friendsList, setFriendsList] = useState<FollowUser[]>([]);
  const [activeTab, setActiveTab] = useState<'followers' | 'following' | 'friends'>(initialTab);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState({ followers: 0, following: 0, friends: 0 });
  const [profileOwner, setProfileOwner] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
  }, [id]);

  const fetchUsers = async () => {
    if (!id || !token || !currentUser?._id) return;
    setIsLoading(true);
    try {
      const [followersRes, myFollowingRes, targetFollowingRes, targetUserRes] = await Promise.all([
        getFollowers(id, token),
        getFollowing(currentUser._id, token),
        getFollowing(id, token),
        getOtherUserProfile(id, token)
      ]);

      if (targetUserRes.success) {
        setProfileOwner(targetUserRes.data?.user || targetUserRes.data);
      }

      if (followersRes.success) {
        const followersData = followersRes.data.followers || [];
        setFollowersList(followersData);
        
        // Following list
        let followingData: FollowUser[] = [];
        if (targetFollowingRes.success) {
          followingData = targetFollowingRes.data.following || [];
          setFollowingList(followingData);
        }

        // Friends list (Mutuals)
        let friendsData: FollowUser[] = [];
        if (targetFollowingRes.success) {
          const targetFollowingIds = new Set(followingData.map((u: any) => u._id));
          friendsData = followersData.filter((u: any) => targetFollowingIds.has(u._id));
          setFriendsList(friendsData);
        }

        // Determine which of these people I am already following
        const states: Record<string, boolean> = {};
        if (myFollowingRes.success) {
          const myFollowing = myFollowingRes.data.following || [];
          const myFollowingIds = new Set(myFollowing.map((u: any) => u._id));
          [...followersData, ...followingData].forEach((u: FollowUser) => {
            states[u._id] = myFollowingIds.has(u._id);
          });
        }
        setFollowingStates(states);

        setCounts({
          followers: followersData.length,
          following: followingData.length,
          friends: friendsData.length
        });
      }
    } catch (error) {
      console.error('Error fetching followers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchUsers();
    setIsRefreshing(false);
  };

  const handleToggleFollow = async (targetId: string) => {
    if (!token || loadingStates[targetId]) return;
    if (targetId === currentUser?._id) return; // Can't follow self

    setLoadingStates(prev => ({ ...prev, [targetId]: true }));
    const isCurrentlyFollowing = followingStates[targetId];
    
    const apiCall = isCurrentlyFollowing ? unfollowUser : followUser;
    const res = await apiCall(targetId, token);
    
    if (res.success) {
      setFollowingStates(prev => ({ ...prev, [targetId]: !isCurrentlyFollowing }));
    } else {
      Alert.alert('Gagal', res.message || 'Terjadi kesalahan');
    }
    setLoadingStates(prev => ({ ...prev, [targetId]: false }));
  };

  const renderItem = ({ item }: { item: FollowUser }) => (
    <TouchableOpacity 
      style={[styles.userItem, { borderBottomColor: theme.border }]}
      onPress={() => router.push(`/user/${item._id}`)}
    >
      <Image 
        source={{ uri: getAvatarUrl(item) }} 
        style={styles.avatar} 
      />
      <View style={styles.userInfo}>
        <Text style={[styles.name, { color: theme.text }]}>{item.nama}</Text>
        <Text style={[styles.username, { color: theme.description }]}>@{item.nim}</Text>
      </View>
      
      {item._id !== currentUser?._id && (
        <TouchableOpacity 
          style={[
            styles.viewButton, 
            { 
              backgroundColor: followingStates[item._id] ? 'transparent' : theme.tint,
              borderColor: theme.tint,
              minWidth: 100
            }
          ]}
          onPress={(e) => {
            e.stopPropagation();
            handleToggleFollow(item._id);
          }}
          disabled={loadingStates[item._id]}
        >
          {loadingStates[item._id] ? (
            <ActivityIndicator size="small" color={followingStates[item._id] ? theme.tint : "#FFF"} />
          ) : (
            <Text style={[
              styles.viewButtonText, 
              { color: followingStates[item._id] ? theme.tint : "#FFF" }
            ]}>
              {followingStates[item._id] ? 'Friends' : 'Followback'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  // Dynamic users based on activeTab
  const getActiveUsers = () => {
    if (activeTab === 'following') return followingList;
    if (activeTab === 'friends') return friendsList;
    return followersList;
  };

  return (
    <FollowListLayout
      users={getActiveUsers()}
      followingStates={followingStates}
      loadingStates={loadingStates}
      onToggleFollow={handleToggleFollow}
      activeTab={activeTab}
      counts={counts}
      profileOwnerName={profileOwner?.nama || profileOwner?.nim || 'Profile'}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      onRefresh={onRefresh}
      onTabChange={(tab) => {
        setActiveTab(tab); // Instant switch using state!
      }}
      currentUserId={currentUser?._id || ''}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  backButton: { padding: 8 },
  listContent: { paddingBottom: 20 },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  userInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold' },
  username: { fontSize: 14 },
  viewButton: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  viewButtonText: { fontSize: 13, fontWeight: '600' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100, gap: 10 },
  emptyText: { fontSize: 16 },
});
