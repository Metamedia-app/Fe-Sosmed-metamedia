import EditProfileModal from '@/components/EditProfileModal';
import { PostCard, PostData } from '@/components/PostCard';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BASE_URL } from '@/utils/api';
import { getAvatarUrl } from '@/utils/avatar';
import { getFollowers, getFollowing } from '@/utils/follow';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Cake, Calendar, GraduationCap, Layout as ListIcon, Heart, MapPin, Repeat, User as UserIcon, Mail } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { subscribeToCommentSync } from '@/utils/commentSyncStore';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user, token, refreshProfile, uploadAvatar, deleteAvatar, linkGoogle, refreshSignal } = useAuth();
  const { lastEvent } = useSocket();
  const [activeTab, setActiveTab] = useState<'posts' | 'reposts'>('posts');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingInitially, setIsLoadingInitially] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [reposts, setReposts] = useState<PostData[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(false);



  // Anti-duplicate & Anti-stale event tracker
  const lastProcessedEventTime = React.useRef<number>(0);
  const mountTime = React.useRef<number>(Date.now());

  useEffect(() => {
    if (!lastEvent || !user?._id) return;

    // Guard 1: Prevent processing events that happened before this screen was opened
    if (lastEvent.timestamp < mountTime.current) return;

    // Guard 2: Prevent re-processing the same event (Anti-Jumping)
    if (lastEvent.timestamp <= lastProcessedEventTime.current) return;
    lastProcessedEventTime.current = lastEvent.timestamp;

    // 1. New Post/Repost from me
    if (lastEvent.type === 'new_post') {
      const newPost: PostData = lastEvent.data?.post ?? lastEvent.data;
      if (!newPost?._id) return;
      
      const authorId = newPost.author?._id || newPost.author?.id;
      if (authorId !== user._id) return;

      if (newPost.type === 'original') {
        setPosts((prev) => {
          if (prev.some((p) => p._id === newPost._id)) return prev;
          return [newPost, ...prev];
        });
      } else if (newPost.type === 'repost') {
        setReposts((prev) => {
          const originalId = newPost.original_post_id?._id;
          if (prev.some((p) => p.original_post_id?._id === originalId)) return prev;
          return [newPost, ...prev];
        });
      }
    }

    // 2. Engagement Updates (Like, Repost, Share)
    if (['like_update', 'repost_update', 'share_update'].includes(lastEvent.type)) {
      const { post_id, likes_count, reposts_count, shares_count } = lastEvent.data;
      
      const updateList = (list: PostData[]) => list.map(p => {
        const isMatch = p._id === post_id || (p.type === 'repost' && p.original_post_id?._id === post_id);
        if (!isMatch) return p;
        
        return {
          ...p,
          likes_count: likes_count ?? p.likes_count,
          reposts_count: reposts_count ?? p.reposts_count,
          shares_count: shares_count ?? p.shares_count,
          original_post_id: p.type === 'repost' && p.original_post_id ? {
            ...p.original_post_id,
            likes_count: likes_count ?? p.original_post_id.likes_count,
            reposts_count: reposts_count ?? p.original_post_id.reposts_count,
            shares_count: shares_count ?? p.original_post_id.shares_count,
          } : p.original_post_id
        };
      });

      setPosts(prev => updateList(prev));
      setReposts(prev => updateList(prev));
    }

    // 3. Post Deletion (including unrepost)
    if (lastEvent.type === 'delete_post') {
      const { post_id } = lastEvent.data;
      if (post_id) {
        setPosts(prev => prev.filter(p => p._id !== post_id));
        setReposts(prev => prev.filter(p => p._id !== post_id));
      }
    }

    // 4. Follow Updates
    if (lastEvent.type === 'follow_update') {
      const { follower_id, following_id, followers_count, following_count } = lastEvent.data;
      
      // If someone followed/unfollowed ME
      if (following_id === user._id) {
        if (typeof followers_count === 'number') {
          setFollowersCount(followers_count);
        } else {
          fetchFollowCounts();
        }
      }
      
      // If I followed/unfollowed SOMEONE
      if (follower_id === user._id) {
        if (typeof following_count === 'number') {
          setFollowingCount(following_count);
        } else {
          fetchFollowCounts();
        }
      }
    }
  }, [lastEvent, user?._id]);

  // Global Sync: Listen for local updates from CommentModal/other screens
  useEffect(() => {
    const unsubscribe = subscribeToCommentSync((type, id, payload) => {
      if (type === "POST_STATS_UPDATE") {
        const updateList = (list: PostData[]) => list.map((p) => {
          const isMatch = p._id === id || (p.type === 'repost' && p.original_post_id?._id === id);
          if (!isMatch) return p;

          return {
            ...p,
            comments_count: payload.comments_count ?? p.comments_count,
            likes_count: payload.likes_count ?? p.likes_count,
            reposts_count: payload.reposts_count ?? p.reposts_count,
            shares_count: payload.shares_count ?? p.shares_count,
            original_post_id: p.type === 'repost' && p.original_post_id ? {
              ...p.original_post_id,
              comments_count: payload.comments_count ?? p.original_post_id.comments_count,
              likes_count: payload.likes_count ?? p.original_post_id.likes_count,
              reposts_count: payload.reposts_count ?? p.original_post_id.reposts_count,
              shares_count: payload.shares_count ?? p.original_post_id.shares_count,
            } : p.original_post_id
          };
        });

        setPosts((prev) => updateList(prev));
        setReposts((prev) => updateList(prev));
      }
    });
    return unsubscribe;
  }, []);

  const fetchUserContent = useCallback(async () => {
    if (!user?._id || !token) return;
    setIsPostsLoading(true);
    try {
      const [postsRes, repostsRes] = await Promise.all([
        fetch(`${BASE_URL}/posts?author=${user._id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/posts?reposted_by=${user._id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const postsData = await postsRes.json();
      const repostsData = await repostsRes.json();

      if (postsRes.ok) {
        setPosts(postsData.data?.posts?.filter((p: any) => 
          (p.author?._id || p.author?.id) === user?._id && p.type === 'original'
        ) || []);
      }
      if (repostsRes.ok) {
        const rawReposts = repostsData.data?.posts?.filter((p: any) => 
          p.type === 'repost' && (p.author?._id || p.author?.id) === user?._id
        ) || [];
        const uniqueReposts: any[] = [];
        const seenIds = new Set();
        
        rawReposts.forEach((p: any) => {
          const originalId = p.original_post_id?._id;
          if (originalId && !seenIds.has(originalId)) {
            seenIds.add(originalId);
            uniqueReposts.push(p);
          }
        });
        
        setReposts(uniqueReposts);
      }
    } catch (error) {
      console.error('Error fetching profile content:', error);
    } finally {
      setIsPostsLoading(false);
    }
  }, [user?._id, token]);

  const fetchFollowCounts = useCallback(async () => {
    if (!user?._id || !token) return;
    try {
      const [followersRes, followingRes] = await Promise.all([
        getFollowers(user._id, token),
        getFollowing(user._id, token)
      ]);
      if (followersRes.success) setFollowersCount(followersRes.data.followers.length);
      if (followingRes.success) setFollowingCount(followingRes.data.following.length);
    } catch (error) {
      console.error('Error fetching follow counts:', error);
    }
  }, [user?._id, token]);

  useEffect(() => {
    const loadProfile = async () => {
      if (posts.length === 0 && reposts.length === 0) setIsLoadingInitially(true);
      await Promise.all([refreshProfile(), fetchFollowCounts(), fetchUserContent()]);
      setIsLoadingInitially(false);
    };
    loadProfile();
  }, [refreshSignal, token, fetchUserContent, fetchFollowCounts]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refreshProfile(),
      fetchFollowCounts(),
      fetchUserContent()
    ]);
    setIsRefreshing(false);
  };

  const studentData = {
    name: user?.nama || 'Pengguna Metamedia',
    nim: user?.nim || '-',
    prodi: user?.program_studi || 'Belum diatur',
    status: user?.status_mahasiswa || 'AKTIF',
    gender: user?.jenis_kelamin || '-',
    birthplace: user?.tempat_lahir || '-',
    birthdate: user?.tanggal_lahir || '-',
    religion: user?.agama || '-',
    avatar: getAvatarUrl(user || {}, (user?.jenis_kelamin || '').toLowerCase() === 'laki-laki'),
    cover: 'https://picsum.photos/seed/metamedia/800/400',
    bio: user?.bio || 'Mahasiswa Universitas Metamedia',
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Batal', 'Ubah Foto Profil', 'Hapus Foto Profil'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleUploadAvatar();
          else if (buttonIndex === 2) handleDeleteAvatar();
        }
      );
    } else {
      Alert.alert(
        'Foto Profil',
        'Pilih tindakan untuk foto profil Anda',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Ubah Foto Profil', onPress: handleUploadAvatar },
          { text: 'Hapus', onPress: handleDeleteAvatar, style: 'destructive' },
        ],
        { cancelable: true }
      );
    }
  };

  const handleUploadAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Akses Ditolak', 'Dibutuhkan akses ke galeri foto untuk mengubah avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setIsAvatarLoading(true);
      
      const uriParts = asset.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      const mimeType = asset.mimeType || `image/${fileType}`;
      const fileName = asset.fileName || `avatar-${Date.now()}.${fileType}`;

      const response = await uploadAvatar(asset.uri, mimeType, fileName);
      setIsAvatarLoading(false);

      if (response.success) {
        Alert.alert('Berhasil', 'Foto profil telah diperbarui.');
      } else {
        Alert.alert('Gagal', response.message);
      }
    }
  };

  const handleDeleteAvatar = () => {
    Alert.alert(
      'Hapus Foto Profil',
      'Apakah Anda yakin ingin menghapus foto profil ini?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            setIsAvatarLoading(true);
            const response = await deleteAvatar();
            setIsAvatarLoading(false);
            if (response.success) {
              Alert.alert('Berhasil', 'Foto profil berhasil dihapus.');
            } else {
              Alert.alert('Gagal', response.message);
            }
          }
        }
      ]
    );
  };

  const handleLinkGoogle = async () => {
    Alert.alert(
      'Tautkan Google',
      'Hubungkan akun Google Anda agar bisa login lebih mudah nantinya.',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Tautkan SEKARANG', 
          onPress: async () => {
            setIsLoadingInitially(true);
            const response = await linkGoogle();
            setIsLoadingInitially(false);
            if (response.success) {
              Alert.alert('Berhasil', response.message);
            } else {
              Alert.alert('Gagal', response.message);
            }
          }
        }
      ]
    );
  };


  if (isLoadingInitially) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
        <Text style={[styles.loadingText, { color: theme.description }]}>Memuat data mahasiswa...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]} 
      contentContainerStyle={{ paddingBottom: 100 }}
      stickyHeaderIndices={[5]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.tint} />
      }
    >
      {/* Header Profile Section (TikTok Style) */}
      <View style={styles.profileHeaderLayout}>
        <TouchableOpacity 
          style={[styles.tiktokAvatarContainer, { borderColor: theme.border }]}
          onPress={handleAvatarPress}
          disabled={isAvatarLoading}
        >
          <Image source={{ uri: studentData.avatar }} style={styles.tiktokAvatar} />
          {isAvatarLoading && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator size="small" color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.tiktokNameContainer}>
          <Text style={[styles.tiktokNameText, { color: theme.text }]} numberOfLines={1}>{studentData.name}</Text>
          <Text style={[styles.tiktokUsernameText, { color: theme.description }]}>@{studentData.nim}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.tiktokEditButton, { backgroundColor: theme.border + '50' }]}
          onPress={() => setIsEditModalVisible(true)}
        >
          <Text style={[styles.tiktokEditButtonText, { color: theme.text }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <TouchableOpacity 
          style={styles.statBox}
          onPress={() => router.push(`/user/${user?._id}/following`)}
        >
          <Text style={[styles.statNumber, { color: theme.text }]}>{followingCount}</Text>
          <Text style={[styles.statLabel, { color: theme.description }]}>Mengikuti</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.statBox}
          onPress={() => router.push(`/user/${user?._id}/followers`)}
        >
          <Text style={[styles.statNumber, { color: theme.text }]}>{followersCount}</Text>
          <Text style={[styles.statLabel, { color: theme.description }]}>Followers</Text>
        </TouchableOpacity>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: theme.text }]}>
            {posts.reduce((acc, p) => acc + (p.likes_count || 0), 0)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.description }]}>Suka</Text>
        </View>
      </View>

      {/* Bio Section */}
      <View style={styles.bioContainer}>
        {studentData.bio ? (
           <Text style={[styles.bioText, { color: theme.text }]}>{studentData.bio}</Text>
        ) : (
           <TouchableOpacity onPress={() => setIsEditModalVisible(true)}>
             <Text style={[styles.addBioText, { color: theme.text }]}>+ Tambahkan bio <Text style={{color: theme.description}}>☺ Beritahu kami tentang diri Anda</Text></Text>
           </TouchableOpacity>
        )}
      </View>

      {/* Academic Details Card */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Informasi Akademik</Text>
        
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

        <TouchableOpacity 
          style={[
            styles.infoItem, 
            { borderTopWidth: 1, borderTopColor: theme.border + '30', paddingTop: 15, marginTop: 5 },
            user?.email ? { opacity: 0.8 } : null
          ]}
          onPress={user?.email ? undefined : handleLinkGoogle}
          disabled={!!user?.email}
          activeOpacity={user?.email ? 1 : 0.7}
        >
          <Mail size={20} color={user?.email ? "#4CAF50" : "#EA4335"} />
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoLabel, { color: theme.description }]}>Google Auth</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {user?.email ? user.email : 'Tautkan Akun Google'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: user?.email ? '#4CAF5020' : '#EA433520' }]}>
            <Text style={[styles.statusText, { color: user?.email ? '#4CAF50' : '#EA4335' }]}>
              {user?.email ? 'VERIFIED' : 'LINK'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Personal Details Card */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Informasi Personal</Text>
        
        <View style={styles.infoItem}>
          <UserIcon size={20} color={theme.tint} />
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoLabel, { color: theme.description }]}>Jenis Kelamin</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{studentData.gender}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <MapPin size={20} color={theme.tint} />
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoLabel, { color: theme.description }]}>Tempat Lahir</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{studentData.birthplace}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Cake size={20} color={theme.tint} />
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoLabel, { color: theme.description }]}>Tanggal Lahir</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{studentData.birthdate}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Heart size={20} color={theme.tint} />
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoLabel, { color: theme.description }]}>Agama</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{studentData.religion}</Text>
          </View>
        </View>
      </View>

      {/* Tabs Header - Sticky Index 5 */}
      <View style={[styles.tabContent, { backgroundColor: theme.card, marginTop: 10 }]}>
        <View style={[styles.tabHeader, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
          <TouchableOpacity 
            style={[styles.tabItem, activeTab === 'posts' && { borderBottomColor: theme.tint, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('posts')}
          >
            <ListIcon size={20} color={activeTab === 'posts' ? theme.tint : theme.description} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabItem, activeTab === 'reposts' && { borderBottomColor: theme.tint, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('reposts')}
          >
            <Repeat size={20} color={activeTab === 'reposts' ? theme.tint : theme.description} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed Content */}
      <View style={{ backgroundColor: theme.background }}>
        
        {/* Posts/Reposts List */}
        {isPostsLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : (
          <View style={styles.listContainer}>
            {activeTab === 'posts' ? (
              posts.length > 0 ? (
                posts.map((post) => (
                  <PostCard 
                    key={post._id} 
                    post={post}
                    onDeleteSuccess={() => {
                      setPosts(prev => prev.filter(p => p._id !== post._id));
                    }}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                   <Text style={{ color: theme.description }}>Belum ada postingan</Text>
                </View>
              )
            ) : (
              reposts.length > 0 ? (
                reposts.map((post) => (
                  <PostCard 
                    key={post._id} 
                    post={post}
                    onDeleteSuccess={() => {
                      setReposts(prev => prev.filter(p => p._id !== post._id));
                    }}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                   <Text style={{ color: theme.description }}>Belum ada repostan</Text>
                </View>
              )
            )}
          </View>
        )}
      </View>

      <EditProfileModal 
        isVisible={isEditModalVisible} 
        onClose={() => setIsEditModalVisible(false)} 
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeaderLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 20,
  },
  tiktokAvatarContainer: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    marginRight: 20,
  },
  tiktokAvatar: {
    width: '100%',
    height: '100%',
  },
  tiktokNameContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 10,
  },
  tiktokNameText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tiktokUsernameText: {
    fontSize: 14,
  },
  tiktokEditButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tiktokEditButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statBox: {
    marginRight: 40,
    alignItems: 'flex-start',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
  },
  bioContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  addBioText: {
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    padding: 22,
    marginBottom: 12,
    marginHorizontal: 15,
    borderRadius: 16,
    // Modern Box Shadow
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 15,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    marginTop: 5,
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
  },
  listContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    width: '100%',
  },
});
