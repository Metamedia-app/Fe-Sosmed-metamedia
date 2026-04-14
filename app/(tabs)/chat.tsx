import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MessageSquareText, Radio, Search, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const INBOX_DATA = [
  {
    id: '1',
    name: 'Budi Santoso',
    lastMessage: 'Halo Fajar, tugas SI sudah selesai?',
    time: '10:30 AM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=budi',
    unread: 2,
    type: 'inbox',
  },
  {
    id: '2',
    name: 'Siti Aminah',
    lastMessage: 'Pemandangan di rektorat emang bagus banget!',
    time: '09:15 AM',
    avatar: 'https://avatar.iran.liara.run/public/girl?username=siti',
    unread: 0,
    type: 'inbox',
  },
  {
    id: '3',
    name: 'Admin Kampus',
    lastMessage: 'Pengumuman beasiswa semester ganjil sudah keluar.',
    time: 'Yesterday',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=admin',
    unread: 0,
    type: 'inbox',
  },
];

const GRUP_DATA = [
  {
    id: 'g1',
    name: 'Kelompok 5 - Basis Data',
    lastMessage: 'Hadi: Izin kumpul hari ini jam 1 siang.',
    time: '11:45 AM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=hadi',
    unread: 5,
    type: 'grup',
  },
  {
    id: 'g2',
    name: 'Himpunan Mahasiswa TI',
    lastMessage: 'Tyo: Rapat pengukuhan besok pagi.',
    time: '08:00 AM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=tyo',
    unread: 0,
    type: 'grup',
  },
];

const COMMUNITY_DATA = [
  {
    id: 'c1',
    name: 'KM Metamedia Info',
    lastMessage: 'Voter: Klik untuk mengikuti pemilu raya kampus.',
    time: '12:00 PM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=voter',
    unread: 12,
    type: 'community',
  },
  {
    id: 'c2',
    name: 'Lowongan Magang 2026',
    lastMessage: 'Intern: PT Techindo sudah membuka pendaftaran.',
    time: '02:30 PM',
    avatar: 'https://avatar.iran.liara.run/public/boy?username=intern',
    unread: 0,
    type: 'community',
  },
];

export default function ChatScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [activeCategory, setActiveCategory] = useState('inbox');

  const getActiveData = () => {
    switch (activeCategory) {
      case 'inbox': return INBOX_DATA;
      case 'grup': return GRUP_DATA;
      case 'community': return COMMUNITY_DATA;
      default: return INBOX_DATA;
    }
  };

  const renderCategoryTab = (id: string, label: string, icon: any) => {
    const isActive = activeCategory === id;
    const IconComponent = icon;
    
    return (
      <TouchableOpacity 
        onPress={() => setActiveCategory(id)}
        style={[
          styles.categoryTab, 
          isActive && { borderBottomColor: theme.tint, borderBottomWidth: 3 }
        ]}
      >
        <IconComponent size={18} color={isActive ? theme.tint : theme.description} />
        <Text style={[
          styles.categoryText, 
          { color: isActive ? theme.tint : theme.description },
          isActive && { fontWeight: 'bold' }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
        <Search size={18} color={theme.description} />
        <Text style={[styles.searchText, { color: theme.description }]}>Cari pesan...</Text>
      </View>

      {/* Categories Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {renderCategoryTab('inbox', 'Inbox', MessageSquareText)}
        {renderCategoryTab('grup', 'Grup', Users)}
        {renderCategoryTab('community', 'Community', Radio)}
      </View>

      <FlatList
        data={getActiveData()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.chatItem, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
          >
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.chatInfo}>
              <View style={styles.chatHeader}>
                <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.time, { color: theme.description }]}>{item.time}</Text>
              </View>
              <View style={styles.messageRow}>
                <Text 
                  style={[styles.lastMessage, { color: theme.description }]} 
                  numberOfLines={1}
                >
                  {item.lastMessage}
                </Text>
                {item.unread > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: theme.tint }]}>
                    <Text style={styles.unreadText}>{item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 5,
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  searchText: {
    fontSize: 15,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderBottomWidth: 1,
    marginBottom: 5,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chatItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    backgroundColor: '#E4E6EB',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  time: {
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  unreadText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
