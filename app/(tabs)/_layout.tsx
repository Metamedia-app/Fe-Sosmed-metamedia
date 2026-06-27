import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { Bell, Home, MessageSquare, Search, SquarePlus, User, Menu } from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, DeviceEventEmitter } from 'react-native';
import CreatePostModal from '@/components/CreatePostModal';
import { useState } from 'react';

function NotificationBell() {
  const { unreadNotificationsCount } = useSocket();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  return (
    <TouchableOpacity 
      onPress={() => router.push('/notifications')}
      style={{ marginRight: 15, position: 'relative' }}
    >
      <Bell size={28} color="#FFFFFF" />
      {unreadNotificationsCount > 0 && (
        <View style={{
          position: 'absolute',
          top: -4,
          right: -4,
          backgroundColor: '#FF3B30', // iOS Red
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 4,
          borderWidth: 1.5,
          borderColor: theme.primary,
        }}>
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 10, 
            fontWeight: 'bold',
            textAlign: 'center' 
          }}>
            {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { isLoggedIn, isLoadingAuth } = useAuth();
  const { unreadChatSummary } = useSocket();
  const [isCreatePostVisible, setIsCreatePostVisible] = useState(false);

  if (isLoadingAuth) {
    return null; // Wait for AsyncStorage to load before deciding to redirect
  }

  if (!isLoggedIn) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.primary, // Brand Navy
          tabBarInactiveTintColor: theme.icon,
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.primary,
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 3.84,
          },
          headerTintColor: '#FFFFFF',
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 20,
          },
          headerLeft: () => (
            <View style={{ 
              marginLeft: 15, 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              backgroundColor: '#FFFFFF', 
              justifyContent: 'center', 
              alignItems: 'center',
              overflow: 'hidden'
            }}>
              <Image 
                source={require('@/assets/images/icon.png')} 
                style={{ width: '80%', height: '80%' }}
                resizeMode="contain"
              />
            </View>
          ),
          headerRight: () => <NotificationBell />,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: theme.card, // WARNA BACKGROUND: Kembalikan block warna asli (biasanya putih)
            bottom: 15, // JARAK MENGAMBANG: Seberapa jauh tab bar diangkat dari dasar layar
            left: 20, // GESER KIRI: Menarik batas kiri menjauh dari tepi layar ke arah tengah
            right: 20, // GESER KANAN: Menarik batas kanan menjauh dari tepi layar ke arah tengah
            height: 55, // KETEBALAN BAR: Mengatur tinggi tab bar (atas-bawah)
            borderRadius: 100, // LENGKUNGAN SUDUT: Semakin besar bikin batas kiri/kanannya bundar kayak kapsul
            borderTopWidth: 0, // Garis bawaan React Navigation (biarkan 0 agar mulus)
            borderWidth: 0, // Garis batas pinggir (biarkan 0 agar tidak kaku)
            elevation: 20, // NAIKKAN ELEVASI: Agar bar tetap paling depan dibanding gradient
            zIndex: 100, // Z-INDEX TINGGI: Memastikan bar berada di atas gradient
            shadowColor: '#000',
            shadowOffset: { width: 0, height:10 }, 
            shadowOpacity: 0.25, 
            shadowRadius: 20, 
            marginHorizontal: 10,
            paddingHorizontal: 15, 
            paddingBottom: 1, 
            paddingTop: 3, 
          },
        }}>
        {/* ... daftar screen ... */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Metamedia',
            tabBarLabel: 'Beranda',
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              // Jika SEDANG berada di Beranda, klik tab ini akan me-refresh (Scroll to top)
              // Jika DARI halaman lain, klik tab ini HANYA akan berpindah layar biasa tanpa reset posisi
              if (navigation.isFocused()) {
                DeviceEventEmitter.emit('homeTabPressToRefresh');
              }
            },
          })}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Pencarian',
            tabBarLabel: 'Cari',
            tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: 'Buat Postingan',
            tabBarLabel: '',
            tabBarIcon: () => null,
            tabBarButton: (props) => (
              <TouchableOpacity 
                onPress={() => setIsCreatePostVisible(true)}
                style={{
                  top: -10, // NAIK/TURUN TOMBOL
                  justifyContent: 'center',
                  alignItems: 'center',
                  flex: 1, 
                }}
              >
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.tint,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 4, 
                  borderColor: theme.card, 
                  elevation: 10, 
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 5 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                }}>
                  <SquarePlus size={24} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chatting',
            tabBarLabel: 'Chat',
            tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
            tabBarBadge: unreadChatSummary?.total_unread > 0 ? unreadChatSummary.total_unread : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#FF3B30',
              color: '#FFFFFF',
              fontSize: 10,
              minWidth: 16,
              height: 16,
              lineHeight: 16,
            }
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile Saya',
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
            headerRight: () => (
              <TouchableOpacity 
                onPress={() => router.push('/settings')}
                style={{ marginRight: 15 }}
              >
                <Menu size={28} color="#FFFFFF" />
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            href: null, // Sembunyikan dari bottom bar
          }}
        />
      </Tabs>

      <CreatePostModal 
        isVisible={isCreatePostVisible} 
        onClose={() => setIsCreatePostVisible(false)} 
      />

      {/* GLOBAL Bottom Fade Gradient */}
      <LinearGradient
        colors={[`${theme.background}00`, theme.background, theme.background]}
        locations={[0, 0.6, 1]}
        style={styles.bottomFade}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 85, 
    pointerEvents: 'none',
    zIndex: 50, // Z-INDEX MENENGAH: Di bawah bar (100) tapi di atas konten (0)
    elevation: 5, // ELEVASI MENENGAH
  },
});

