import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── Cek apakah berjalan di Expo Go (bukan APK/dev build) ────────────────────
const isExpoGo = Constants.appOwnership === 'expo';

// ─── Setup notification handler ───────────────────────────────────────────────
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  // Silently ignore if not available in Expo Go
}

// ─── Background FCM handler (hanya berjalan di native build / APK) ─────────────
if (!isExpoGo) {
  try {
    const { default: messaging } = require('@react-native-firebase/messaging');
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log('📨 Background FCM message:', remoteMessage.notification?.title);
    });
  } catch (e) {
    console.log('Firebase messaging not available (Expo Go)');
  }
}

// [OLD API BACKUP]: const BASE_URL = 'https://besosmed-production.up.railway.app/api/v1/fcm-token';
const BASE_URL = 'https://api.metausosmed.my.id/api/v1/fcm-token';

export const registerForPushNotificationsAsync = async () => {
  // Tidak bisa pakai push notification di Expo Go SDK 53+
  if (isExpoGo) {
    console.log('⚠️ Push notifications tidak tersedia di Expo Go. Gunakan APK/dev build.');
    return null;
  }

  let token;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    } catch (e) {
      console.warn('Could not set notification channel:', e);
    }
  }

  if (Device.isDevice) {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      // Gunakan Firebase Messaging untuk mendapatkan FCM token di native build
      const { default: messaging } = require('@react-native-firebase/messaging');
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('FCM Authorization not granted');
        return null;
      }

      token = await messaging().getToken();
      console.log('🔥 FCM Token from Firebase:', token);
    } catch (e) {
      console.error('Error getting FCM token:', e);
      return null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  return token;
};

export const pushNotificationService = {
  // Add listeners for notifications
  addNotificationListeners: (
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ) => {
    const listeners: Array<{ remove: () => void }> = [];
    let unsubscribeFCM: (() => void) | undefined;

    try {
      const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('🔔 Notification Received:', notification.request.content.title);
        if (onNotificationReceived) onNotificationReceived(notification);
      });
      listeners.push(notificationListener);

      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('📩 Notification Response:', response.notification.request.content.data);
        if (onNotificationResponse) onNotificationResponse(response);
      });
      listeners.push(responseListener);
    } catch (e) {
      console.log('expo-notifications listeners not available in Expo Go');
    }

    // Firebase foreground listener (hanya di native build)
    if (!isExpoGo) {
      try {
        const { default: messaging } = require('@react-native-firebase/messaging');
        unsubscribeFCM = messaging().onMessage(async (remoteMessage: any) => {
          console.log('🔥 Foreground FCM message:', remoteMessage.notification?.title);
        });
      } catch (e) {
        console.log('Firebase messaging foreground listener not available');
      }
    }

    return () => {
      listeners.forEach(l => l.remove());
      if (unsubscribeFCM) unsubscribeFCM();
    };
  },

  // POST /api/v1/fcm-token
  saveToken: async (authToken: string, fcmToken: string) => {
    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: fcmToken }),
      });
      const result = await response.json();
      console.log('🚀 FCM Token saved to server:', result);
      return result;
    } catch (error) {
      console.error('❌ Error saving FCM token:', error);
      return { success: false, error };
    }
  },

  // DELETE /api/v1/fcm-token
  deleteToken: async (authToken: string, fcmToken: string) => {
    try {
      const response = await fetch(BASE_URL, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: fcmToken }),
      });
      const result = await response.json();
      console.log('🗑️ FCM Token deleted from server:', result);
      return result;
    } catch (error) {
      console.error('❌ Error deleting FCM token:', error);
      return { success: false, error };
    }
  }
};
