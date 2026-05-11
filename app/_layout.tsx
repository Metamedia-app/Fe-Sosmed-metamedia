import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import React, { useEffect } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { pushNotificationService } from '@/utils/pushNotification';

export const unstable_settings = {
  anchor: '(tabs)',
};

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
    <AuthProvider>
      <SocketProvider>
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
          <StatusBar style="auto" hidden={Platform.OS === 'android'} />
        </ThemeProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
