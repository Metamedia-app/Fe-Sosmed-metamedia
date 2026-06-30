import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Settings as SettingsIcon, Bell, Shield, CircleHelp, LogOut, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const SettingItem = ({ icon: Icon, title, onPress }: any) => (
    <TouchableOpacity 
      style={[styles.settingItem, { borderBottomColor: theme.border }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <Icon size={20} color={theme.icon} style={styles.icon} />
        <Text style={[styles.settingText, { color: theme.text }]}>{title}</Text>
      </View>
      <ChevronRight size={20} color={theme.description} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Akun</Text>
          <SettingItem icon={SettingsIcon} title="Pengaturan Akun" />
          <SettingItem icon={Bell} title="Notifikasi" />
          <SettingItem icon={Shield} title="Privasi & Keamanan" />
          <SettingItem 
            icon={Shield} 
            title="Ganti Password" 
            onPress={() => router.push('/change-password')} 
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Bantuan</Text>
          <SettingItem icon={CircleHelp} title="Pusat Bantuan" />
          <SettingItem 
            icon={CircleHelp} 
            title="Tentang Aplikasi" 
            onPress={() => router.push('/about')}
          />
        </View>

      </ScrollView>
      
      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: theme.brandRed }]} 
          onPress={handleLogout}
        >
          <LogOut size={20} color="#FFF" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
  },
  section: {
    marginBottom: 20,
    borderRadius: 16,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 0.5,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 15,
  },
  settingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  bottomContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  logoutIcon: {
    marginRight: 10,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
