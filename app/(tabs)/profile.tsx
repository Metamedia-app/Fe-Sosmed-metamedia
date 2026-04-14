import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { BookOpen, Calendar, Edit3, GraduationCap, Grid, Repeat, Settings, User as UserIcon, MapPin, Heart, Info, Cake, RefreshCcw } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl, Platform, Alert, ActionSheetIOS } from 'react-native';
import EditProfileModal from '@/components/EditProfileModal';
import * as ImagePicker from 'expo-image-picker';
import { getAvatarUrl } from '@/utils/avatar';
import { getFollowers, getFollowing } from '@/utils/follow';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user, token, refreshProfile, uploadAvatar, deleteAvatar } = useAuth();
  const [activeTab, setActiveTab] = useState<'posts' | 'reposts'>('posts');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingInitially, setIsLoadingInitially] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    const loadProfile = async () => {
      await Promise.all([
        refreshProfile(),
        fetchFollowCounts()
      ]);
      setIsLoadingInitially(false);
    };
    loadProfile();
  }, []);

  const fetchFollowCounts = async () => {
    if (!user?._id || !token) return;
    try {
      const [followersRes, followingRes] = await Promise.all([
        getFollowers(user._id, token),
        getFollowing(user._id, token)
      ]);
      
      if (followersRes.success) {
        setFollowersCount(followersRes.data.followers.length);
      }
      if (followingRes.success) {
        setFollowingCount(followingRes.data.following.length);
      }
    } catch (error) {
      console.error('Error fetching follow counts:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refreshProfile(),
      fetchFollowCounts()
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
          <Text style={[styles.statNumber, { color: theme.text }]}>0</Text>
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

      {/* Tabs / Grid View simulation */}
      <View style={[styles.tabContent, { backgroundColor: theme.card }]}>
        <View style={[styles.tabHeader, { borderBottomColor: theme.border }]}>
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
        
        {/* Posts/Reposts Content */}
        <View style={styles.placeholderGrid}>
          {activeTab === 'posts' ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <View key={`post-${i}`} style={[styles.gridItem, { backgroundColor: theme.background }]}>
                <Image source={{ uri: `https://picsum.photos/seed/post${i}/200` }} style={{ width: '100%', height: '100%' }} />
              </View>
            ))
          ) : (
            [1, 2, 3].map((i) => (
              <View key={`repost-${i}`} style={[styles.gridItem, { backgroundColor: theme.background }]}>
                <Image source={{ uri: `https://picsum.photos/seed/repost${i}/200` }} style={{ width: '100%', height: '100%' }} />
                <View style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}>
                   <Repeat size={12} color="#FFF" />
                </View>
              </View>
            ))
          )}
        </View>
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
  placeholderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 1,
  },
  gridItem: {
    width: '33.33%',
    aspectRatio: 1,
    borderWidth: 0.5,
    padding: 1,
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
});
