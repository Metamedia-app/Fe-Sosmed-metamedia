import { PostData } from '@/components/PostCard';
import { PostDetailModal } from '@/components/PostDetailModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BASE_URL } from '@/utils/api';
import { followUser, getFollowers, getFollowing, getOtherUserProfile, unfollowUser } from '@/utils/follow';
import { getAvatarUrl } from '@/utils/avatar';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, ChevronLeft, GraduationCap, Grid, Menu, Repeat } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';

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
  const { lastEvent } = useSocket();

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
  const [posts, setPosts] = useState<PostData[]>([]);
  const [reposts, setReposts] = useState<PostData[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  // Anti-duplicate & Anti-stale event tracker
  const lastProcessedEventTime = React.useRef<number>(0);
  const mountTime = React.useRef<number>(Date.now());

  useEffect(() => {
    if (id === currentUser?._id) {
      router.replace('/profile');
      return;
    }
    loadProfile();
  }, [id]);

  // Real-time socket listener
  useEffect(() => {
    if (!lastEvent || !id) return;

    // Guard 1: Prevent processing events that happened before this screen was opened
    if (lastEvent.timestamp < mountTime.current) return;

    // Guard 2: Prevent re-processing the same event (Anti-Jumping)
    if (lastEvent.timestamp <= lastProcessedEventTime.current) return;
    lastProcessedEventTime.current = lastEvent.timestamp;

    // 1. New Post/Repost from this user
    if (lastEvent.type === 'new_post') {
      const newPost: PostData = lastEvent.data?.post ?? lastEvent.data;
      if (!newPost?._id) return;
      
      const authorId = newPost.author?._id || newPost.author?.id;
      if (authorId !== id) return;

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
      const { follower_id, following_id, followers_count, following_count, type } = lastEvent.data;
      
      // If someone followed/unfollowed the user whose profile we are viewing
      if (following_id === id) {
        if (typeof followers_count === 'number') {
          setFollowersCount(followers_count);
        } else {
          fetchData();
        }

        // If the person performing the action is the currently logged-in user
        if (follower_id === currentUser?._id) {
          setIsFollowing(type === 'follow');
        }
      }

      // If the user whose profile we are viewing followed/unfollowed someone else
      if (follower_id === id) {
        if (typeof following_count === 'number') {
          setFollowingCount(following_count);
        } else {
          fetchData();
        }
      }
    }
  }, [lastEvent, id]);

  const loadProfile = async () => {
    if (!id || !token) return;
    setIsLoadingInitially(true);
    await fetchData();
    setIsLoadingInitially(false);
  };

  const fetchData = async () => {
    if (!id || !token) return;
    try {
      const [profileRes, followersRes, followingRes, postsRes, repostsRes] = await Promise.all([
        getOtherUserProfile(id, token),
        getFollowers(id, token),
        getFollowing(id, token),
        fetch(`${BASE_URL}/posts?author=${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/posts?reposted_by=${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
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

      const postsData = await postsRes.json();
      const repostsData = await repostsRes.json();

      if (postsRes.ok) {
        setPosts(postsData.data?.posts?.filter((p: any) => 
          (p.author?._id || p.author?.id) === id && p.type === 'original'
        ) || []);
      }
      if (repostsRes.ok) {
        // Filter reposts by type, ensure the user is the one who reposted, and remove duplicates by original_post_id
        const rawReposts = repostsData.data?.posts?.filter((p: any) => 
          p.type === 'repost' && (p.author?._id || p.author?.id) === id
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
      console.error('Error fetching user data:', error);
    }
  };

  /**
   * For repost items: fetch the ORIGINAL post to get accurate counts
   * and the correct is_reposted flag for the CURRENT logged-in user.
   */
  const openRepostDetail = async (repostPost: PostData) => {
    const originalId = repostPost.original_post_id?._id;
    if (!originalId || !token) {
      setSelectedPost(repostPost);
      setIsDetailVisible(true);
      return;
    }
    setIsFetchingDetail(true);
    try {
      const res = await fetch(`${BASE_URL}/posts/${originalId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (res.ok && result.data?.post) {
        setSelectedPost(result.data.post);
      } else {
        setSelectedPost(repostPost);
      }
    } catch {
      setSelectedPost(repostPost);
    } finally {
      setIsFetchingDetail(false);
      setIsDetailVisible(true);
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
      // Removed manual setFollowersCount update to prevent duplication with socket event
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
          stickyHeaderIndices={[4]}
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
            <Text style={[styles.statNumber, { color: theme.text }]}>
              {posts.reduce((acc, p) => acc + (p.likes_count || 0), 0)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.description }]}>Suka</Text>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioContainer}>
          <Text style={[styles.bioText, { color: theme.text }]}>{studentData.bio}</Text>
        </View>

        {/* Info Card (Academic Only) */}
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
        </View>


        {/* Tab Header - Sticky Index 5 */}
        <View style={[styles.tabContent, { backgroundColor: theme.card, marginTop: 10 }]}>
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
        </View>
        
        {/* Feed Content */}
        {isPostsLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {activeTab === 'posts' ? (
              posts.length > 0 ? (
                posts.map((post) => (
                  <TouchableOpacity 
                    key={post._id} 
                    style={[styles.gridItem, { backgroundColor: theme.card }]}
                    onPress={() => {
                      setSelectedPost(post);
                      setIsDetailVisible(true);
                    }}
                  >
                    {post.media && post.media.length > 0 ? (
                      <Image 
                        source={{ uri: post.media[0].url }} 
                        style={{ width: '100%', height: '100%' }} 
                        contentFit="cover"
                      />
                    ) : (post.type === 'repost' && post.original_post_id?.media && post.original_post_id.media.length > 0) ? (
                      <Image 
                        source={{ uri: post.original_post_id.media[0].url }} 
                        style={{ width: '100%', height: '100%' }} 
                        contentFit="cover"
                      />
                    ) : (
                      <View style={{ flex: 1, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }}>
                         <Text style={{ color: theme.description, fontSize: 10 }}>No Media</Text>
                      </View>
                    )}
                    {post.type === 'repost' && (
                      <View style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}>
                         <Repeat size={12} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                   <Text style={{ color: theme.description }}>Belum ada postingan</Text>
                </View>
              )
            ) : (
              reposts.length > 0 ? (
                reposts.map((post) => (
                  <TouchableOpacity 
                    key={post._id} 
                    style={[styles.gridItem, { backgroundColor: theme.card }]}
                    onPress={() => openRepostDetail(post)}
                  >
                    {post.media && post.media.length > 0 ? (
                      <Image 
                        source={{ uri: post.media[0].url }} 
                        style={{ width: '100%', height: '100%' }} 
                        contentFit="cover"
                      />
                    ) : (post.type === 'repost' && post.original_post_id?.media && post.original_post_id.media.length > 0) ? (
                      <Image 
                        source={{ uri: post.original_post_id.media[0].url }} 
                        style={{ width: '100%', height: '100%' }} 
                        contentFit="cover"
                      />
                    ) : (
                      <View style={{ flex: 1, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }}>
                         <Text style={{ color: theme.description, fontSize: 10 }}>No Media</Text>
                      </View>
                    )}
                    <View style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}>
                       <Repeat size={12} color="#FFF" />
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                   <Text style={{ color: theme.description }}>Belum ada repostan</Text>
                </View>
              )
            )}
          </View>
        )}
        </ScrollView>
      </View>

      <PostDetailModal 
        isVisible={isDetailVisible}
        onClose={() => {
          setIsDetailVisible(false);
          setSelectedPost(null);
        }}
        post={selectedPost}
        onDeleteSuccess={() => {
          if (selectedPost) {
            const postId = selectedPost._id || (selectedPost as any).id;
            setPosts(prev => prev.filter(p => p._id !== postId && (p as any).id !== postId));
            setReposts(prev => prev.filter(p => p._id !== postId && (p as any).id !== postId));
          }
        }}
      />

      {/* Loading overlay when fetching detail */}
      {isFetchingDetail && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center', alignItems: 'center', zIndex: 999
        }}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileHeaderLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 15,
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
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    marginRight: 20,
  },
  tiktokAvatar: { width: '100%', height: '100%' },
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
  tiktokUsernameText: { fontSize: 14 },
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
  statBox: { 
    marginRight: 40, 
    alignItems: 'flex-start' 
  },
  statNumber: { 
    fontSize: 18, 
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: { fontSize: 13 },
  bioContainer: { 
    paddingHorizontal: 20, 
    marginBottom: 25 
  },
  bioText: { fontSize: 14, lineHeight: 20 },
  card: {
    padding: 22,
    marginHorizontal: 15,
    marginBottom: 12,
    borderRadius: 16,
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
    gap: 15 
  },
  infoTextContainer: { flex: 1 },
  infoLabel: { fontSize: 12, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '600' },
  statusBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 6, 
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  tabContent: {
    flex: 1,
    marginTop: 5,
  },
  tabHeader: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 15 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 1 },
  gridItem: { width: '33.33%', aspectRatio: 1, borderWidth: 0.5, padding: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 15 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  emptyContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    width: '100%',
  },
});
