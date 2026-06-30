import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Platform, Alert } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import React, { useEffect, useState } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { pushNotificationService } from '@/utils/pushNotification';
import GlobalAlert from '@/components/GlobalAlert';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export const unstable_settings = {
  anchor: '(tabs)',
};

import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';

function VersionChecker({ children }: { children: React.ReactNode }) {
  const [isOutdated, setIsOutdated] = useState(false);
  const [updateUrl, setUpdateUrl] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch('https://api.metausosmed.my.id/api/v1/system/config');
        const result = await response.json();
        
        if (result.success && result.data) {
          const { min_required_version, update_url, maintenance_mode } = result.data;
          
          if (maintenance_mode) {
             Alert.alert('Perbaikan Sistem', 'Aplikasi sedang dalam perbaikan rutin. Silakan kembali lagi nanti.');
             setIsOutdated(true);
             return;
          }

          // Simple string comparison for versions like "1.0.0" < "1.0.1"
          // For a production app, use a proper semver library, but this works for basic X.Y.Z
          const currentParts = CURRENT_VERSION.split('.').map(Number);
          const requiredParts = (min_required_version || '1.0.0').split('.').map(Number);
          
          let needsUpdate = false;
          for (let i = 0; i < 3; i++) {
            if ((currentParts[i] || 0) < (requiredParts[i] || 0)) {
              needsUpdate = true;
              break;
            } else if ((currentParts[i] || 0) > (requiredParts[i] || 0)) {
              break;
            }
          }

          if (needsUpdate) {
            setIsOutdated(true);
            setUpdateUrl(update_url || 'https://play.google.com');
          }
        }
      } catch (e) {
        console.warn('Gagal mengecek versi API', e);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkVersion();
  }, []);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1A80E5" />
      </View>
    );
  }

  if (isOutdated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 }}>
        <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: '#E6F4FE', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 32 }}>🚀</Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1A80E5', marginBottom: 10, textAlign: 'center' }}>Pembaruan Tersedia</Text>
        <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30, lineHeight: 24 }}>
          Versi META-U Anda terlalu lama. Silakan perbarui aplikasi ke versi terbaru untuk mendapatkan fitur dan perbaikan keamanan terbaru.
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: '#1A80E5', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12, width: '100%', alignItems: 'center' }}
          onPress={() => updateUrl ? Linking.openURL(updateUrl) : null}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Perbarui Sekarang</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  useEffect(() => {
    // Setup Push Notification Listeners
    const unsubscribe = pushNotificationService.addNotificationListeners(
      (notification) => {
        // Handle foreground notification
        console.log('Foreground notification:', notification.request.content.title);
      },
      (response) => {
        // Handle notification click
        console.log('Notification clicked:', response.notification.request.content.data);
      }
    );

    if (Platform.OS === 'android') {
      // Hide navigation bar and status bar for immersive experience
      const hideSystemBars = async () => {
        try {
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBehaviorAsync('overlay-swipe');
        } catch (e) {
          console.warn('[ImmersiveMode] Error:', e);
        }
      };
      
      hideSystemBars();
    }

    return () => unsubscribe();
  }, []);

  return (
    <VersionChecker>
      <AuthProvider>
        <SocketProvider>
          <KeyboardProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="user/[id]/followers" options={{ headerShown: false }} />
                <Stack.Screen name="user/[id]/following" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="settings" options={{ title: 'Pengaturan', headerBackTitle: 'Kembali' }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <GlobalAlert />
              <StatusBar style="auto" hidden={Platform.OS === 'android'} />
            </ThemeProvider>
          </KeyboardProvider>
        </SocketProvider>
      </AuthProvider>
    </VersionChecker>
  );
}
