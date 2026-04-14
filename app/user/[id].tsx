import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, GraduationCap, Grid, Repeat, User as UserIcon, MapPin, Heart, Cake, ChevronLeft, Menu } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { getAvatarUrl } from '@/utils/avatar';
import { followUser, unfollowUser, getFollowers, getFollowing, getOtherUserProfile } from '@/utils/follow';

export default function UserProfileScreen() {
  const { id, initialName, initialNim, initialAvatar } = useLocalSearchParams<{ 
    id: string;
    initialName?: string;
    initialNim?: string;
    initialAvatar?: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user: currentUser, token } = useAuth();

  const [targetUser, setTargetUser] = useState<any>(initialName ? {
    nama: initialName,
    nim: initialNim,
    avatar: initialAvatar,
    _id: id,
    id: id
  } : null);
  const [activeTab, setActiveTab] = useState<'posts' | 'reposts'>('posts');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingInitially, setIsLoadingInitially] = useState(true);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (id === currentUser?._id) {
      router.replace('/profile');
      return;
    }
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    if (!id || !token) return;
    setIsLoadingInitially(true);
    await fetchData();
    setIsLoadingInitially(false);
  };

  const fetchData = async () => {
    if (!id || !token) return;
    try {
      const [profileRes, followersRes, followingRes] = await Promise.all([
        getOtherUserProfile(id, token),
        getFollowers(id, token),
        getFollowing(id, token)
      ]);

      if (profileRes.success) {
        // Robust detection of user object in response
        const userData = profileRes.data?.user || profileRes.data || profileRes.user || profileRes;
        
        // Ensure id compatibility if needed
        if (userData && userData._id && !userData.id) userData.id = userData._id;
        
        setTargetUser(userData);
      }

      if (followersRes.success) {
        const list = followersRes.data.followers || [];
        setFollowersCount(list.length);
        setIsFollowing(list.some((f: any) => f._id === currentUser?._id));
      }
      
      if (followingRes.success) {
        setFollowingCount(followingRes.data.following?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleFollowToggle = async () => {
    if (!id || !token || isFollowLoading) return;
    
    setIsFollowLoading(true);
    const apiCall = isFollowing ? unfollowUser : followUser;
    
    const res = await apiCall(id, token);
    setIsFollowLoading(false);
    
    if (res.success) {
      setIsFollowing(!isFollowing);
      setFollowersCount(prev => isFollowing ? prev - 1 : prev + 1);
    } else {
      Alert.alert('Gagal', res.message || 'Terjadi kesalahan');
    }
  };

  if (isLoadingInitially && !targetUser) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
        <Text style={[styles.loadingText, { color: theme.description }]}>Memuat profil...</Text>
      </View>
    );
  }

  const studentData = {
    name: targetUser?.nama || targetUser?.name || (isLoadingInitially ? 'Memuat...' : 'Pengguna Metamedia'),
    nim: targetUser?.nim || targetUser?.nim_mahasiswa || (isLoadingInitially ? '...' : '-'),
    prodi: targetUser?.program_studi || targetUser?.prodi || 'MetaMedia Student',
    status: targetUser?.status_mahasiswa || targetUser?.status || 'AKTIF',
    gender: targetUser?.jenis_kelamin || '-',
    birthplace: targetUser?.tempat_lahir || '-',
    birthdate: targetUser?.tanggal_lahir || '-',
    religion: targetUser?.agama || '-',
    avatar: getAvatarUrl(targetUser || {}, (targetUser?.jenis_kelamin || '').toLowerCase() === 'laki-laki'),
    bio: targetUser?.bio || 'Mahasiswa Universitas Metamedia',
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom Header Bar */}
      <View style={styles.customHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.headerTitleText, { color: '#FFFFFF' }]} numberOfLines={1}>
          {studentData.name}
        </Text>

        <TouchableOpacity style={styles.menuBtn}>
          <Menu size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.content, { backgroundColor: theme.background }]}>
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.tint} />
          }
        >
          {/* Header Profile Section */}
          <View style={styles.profileHeaderLayout}>
          <View style={[styles.tiktokAvatarContainer, { borderColor: theme.border }]}>
            <Image source={{ uri: studentData.avatar }} style={styles.tiktokAvatar} />
          </View>
          <View style={styles.tiktokNameContainer}>
            <Text style={[styles.tiktokNameText, { color: theme.text }]} numberOfLines={1}>{studentData.name}</Text>
            <Text style={[styles.tiktokUsernameText, { color: theme.description }]}>@{studentData.nim}</Text>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.followButton, 
              { backgroundColor: isFollowing ? theme.border + '80' : theme.tint }
            ]}
            onPress={handleFollowToggle}
            disabled={isFollowLoading}
          >
            {isFollowLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? theme.text : "#FFF"} />
            ) : (
              <Text style={[
                styles.followButtonText, 
                { color: isFollowing ? theme.text : "#FFF" }
              ]}>
                {isFollowing ? 'Mengikuti' : 'Ikuti'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => router.push(`/user/${id}/following` as any)}
          >
            <Text style={[styles.statNumber, { color: theme.text }]}>{followingCount}</Text>
            <Text style={[styles.statLabel, { color: theme.description }]}>Mengikuti</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => router.push(`/user/${id}/followers` as any)}
          >
            <Text style={[styles.statNumber, { color: theme.text }]}>{followersCount}</Text>
            <Text style={[styles.statLabel, { color: theme.description }]}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: theme.text }]}>0</Text>
            <Text style={[styles.statLabel, { color: theme.description }]}>Suka</Text>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioContainer}>
          <Text style={[styles.bioText, { color: theme.text }]}>{studentData.bio}</Text>
        </View>

        {/* Info Card (Academic Only) */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.infoItem}>
            <GraduationCap size={20} color={theme.tint} />
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoLabel, { color: theme.description }]}>Program Studi</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{studentData.prodi}</Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Calendar size={20} color={theme.tint} />
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoLabel, { color: theme.description }]}>Status Mahasiswa</Text>
              <View style={[styles.statusBadge, { backgroundColor: '#10B98120' }]}>
                <Text style={[styles.statusText, { color: '#10B981' }]}>{studentData.status}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Header */}
        <View style={[styles.tabHeader, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
          <TouchableOpacity 
            style={[styles.tabItem, activeTab === 'posts' && { borderBottomColor: theme.tint, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('posts')}
          >
            <Grid size={20} color={activeTab === 'posts' ? theme.tint : theme.description} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabItem, activeTab === 'reposts' && { borderBottomColor: theme.tint, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('reposts')}
          >
            <Repeat size={20} color={activeTab === 'reposts' ? theme.tint : theme.description} />
          </TouchableOpacity>
        </View>
        
        {/* Grid Placeholder */}
        <View style={styles.placeholderGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={`post-${i}`} style={[styles.gridItem, { backgroundColor: theme.card }]}>
              <Image source={{ uri: `https://picsum.photos/seed/user${id}p${i}/200` }} style={{ width: '100%', height: '100%' }} />
            </View>
          ))}
        </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileHeaderLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  customHeader: {
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
  content: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    overflow: 'hidden',
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
  },
  logo: {
    width: '80%',
    height: '80%',
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tiktokAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    marginRight: 15,
  },
  tiktokAvatar: { width: '100%', height: '100%' },
  tiktokNameContainer: { flex: 1, justifyContent: 'center' },
  tiktokNameText: { fontSize: 20, fontWeight: 'bold' },
  tiktokUsernameText: { fontSize: 13 },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  followButtonText: { fontSize: 14, fontWeight: 'bold' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statBox: { marginRight: 30, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12 },
  bioContainer: { paddingHorizontal: 20, marginBottom: 20 },
  bioText: { fontSize: 14, lineHeight: 20 },
  card: {
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  infoTextContainer: { flex: 1 },
  infoLabel: { fontSize: 11 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  tabHeader: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  placeholderGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 1 },
  gridItem: { width: '33.33%', aspectRatio: 1, borderWidth: 0.5, padding: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 15 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
});
