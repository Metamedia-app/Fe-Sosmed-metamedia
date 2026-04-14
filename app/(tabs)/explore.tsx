import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { followUser } from '@/utils/follow';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 3;

const TRENDING_TAGS = ['#Akademik', '#Beasiswa', '#EventKampus', '#Organisasi', '#KaryaMhs', '#Tips'];

const SUGGESTED_STUDENTS = [
  { id: '1', name: 'Andi Pratama', prodi: 'Teknik Sipil', avatar: 'https://avatar.iran.liara.run/public/boy?username=andi' },
  { id: '2', name: 'Bunga Citra', prodi: 'Akuntansi', avatar: 'https://avatar.iran.liara.run/public/girl?username=bunga' },
  { id: '3', name: 'Chandra Wali', prodi: 'Hukum', avatar: 'https://avatar.iran.liara.run/public/boy?username=chandra' },
];

const MOMENTS = [
  { id: '1', image: 'https://picsum.photos/seed/k1/400/400' },
  { id: '2', image: 'https://picsum.photos/seed/k2/400/400' },
  { id: '3', image: 'https://picsum.photos/seed/k3/400/400' },
  { id: '4', image: 'https://picsum.photos/seed/k4/400/400' },
  { id: '5', image: 'https://picsum.photos/seed/k5/400/400' },
  { id: '6', image: 'https://picsum.photos/seed/k6/400/400' },
  { id: '7', image: 'https://picsum.photos/seed/k7/400/400' },
  { id: '8', image: 'https://picsum.photos/seed/k8/400/400' },
  { id: '9', image: 'https://picsum.photos/seed/k9/400/400' },
];

export default function SearchScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { token } = useAuth();
  
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const SearchHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.card }]}>
      <View style={[styles.searchBox, { backgroundColor: theme.background }]}>
        <Search size={18} color={theme.description} />
        <TextInput 
          placeholder="Cari mahasiswa, topik, atau event..." 
          placeholderTextColor={theme.description}
          style={[styles.input, { color: theme.text }]}
        />
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.tagsContainer}
        contentContainerStyle={styles.tagsContent}
      >
        {TRENDING_TAGS.map((tag) => (
          <TouchableOpacity key={tag} style={[styles.tagItem, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.tagText, { color: theme.tint }]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const handleFollow = async (userId: string) => {
    if (!token) return;
    const res = await followUser(userId, token);
    if (res.success) {
      setFollowingIds(prev => new Set([...prev, userId]));
    } else {
      Alert.alert('Gagal', res.message || 'Gagal mengikuti pengguna');
    }
  };

  const SuggestedSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Saran Untuk Anda</Text>
        <TouchableOpacity><Text style={{ color: theme.tint, fontWeight: '600' }}>Lihat Semua</Text></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedList}>
        {SUGGESTED_STUDENTS.map((student) => {
          const isFollowing = followingIds.has(student.id);
          return (
            <TouchableOpacity 
              key={student.id} 
              style={[styles.suggestedCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push({
                pathname: "/user/[id]",
                params: { id: student.id, initialName: student.name, initialNim: '', initialAvatar: student.avatar }
              })}
            >
              <Image source={{ uri: student.avatar }} style={styles.suggestedAvatar} />
              <Text style={[styles.suggestedName, { color: theme.text }]} numberOfLines={1}>{student.name}</Text>
              <Text style={[styles.suggestedProdi, { color: theme.description }]} numberOfLines={1}>{student.prodi}</Text>
              <TouchableOpacity 
                style={[
                  styles.followButton, 
                  { backgroundColor: isFollowing ? theme.border + '80' : theme.tint }
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleFollow(student.id);
                }}
              >
                <Text style={[styles.followButtonText, { color: isFollowing ? theme.text : '#FFF' }]}>
                  {isFollowing ? 'Mengikuti' : 'Ikuti'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlashList
        data={MOMENTS}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.momentItem}>
            <Image 
              source={{ uri: item.image }} 
              style={styles.momentImage} 
              contentFit="cover"
            />
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <>
            <SearchHeader />
            <SuggestedSection />
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text, marginLeft: 15, marginTop: 10, marginBottom: 10 }]}>Momen Kampus</Text>
            </View>
          </>
        }
        // @ts-ignore - estimatedItemSize is required but reported as not existing by the current TS version
        estimatedItemSize={COLUMN_WIDTH}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    paddingHorizontal: 15,
    height: 48,
    borderRadius: 12,
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  tagsContainer: {
    marginTop: 15,
    marginBottom: 5,
  },
  tagsContent: {
    paddingHorizontal: 15,
    gap: 10,
  },
  tagItem: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  suggestedList: {
    paddingHorizontal: 15,
    gap: 12,
  },
  suggestedCard: {
    width: 140,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  suggestedAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  suggestedName: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  suggestedProdi: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 10,
  },
  followButton: {
    width: '100%',
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  followButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  momentItem: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    padding: 0.5,
  },
  momentImage: {
    width: '100%',
    height: '100%',
  },
});
