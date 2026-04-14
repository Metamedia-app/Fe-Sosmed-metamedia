import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Bell } from 'lucide-react-native';

export default function NotificationsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const NOTIFICATIONS = [
    { id: '1', text: 'Budi Santoso menyukai postingan Anda.', time: '2 menit yang lalu' },
    { id: '2', text: 'Siti Aminah mengomentari postingan Anda.', time: '1 jam yang lalu' },
    { id: '3', text: 'Sistem: Selamat datang di Metamedia Campus!', time: '2 hari yang lalu' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={NOTIFICATIONS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.notiItem, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={[styles.iconContainer, { backgroundColor: theme.tint + '20' }]}>
              <Bell size={20} color={theme.tint} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.notiText, { color: theme.text }]}>{item.text}</Text>
              <Text style={[styles.notiTime, { color: theme.description }]}>{item.time}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notiItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  notiText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notiTime: {
    fontSize: 12,
    marginTop: 4,
  },
});
