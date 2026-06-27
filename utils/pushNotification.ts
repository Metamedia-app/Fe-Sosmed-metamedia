import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications are handled when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// [OLD API BACKUP]: const BASE_URL = 'https://besosmed-production.up.railway.app/api/v1/fcm-token';
const BASE_URL = 'https://api.metausosmed.my.id/api/v1/fcm-token';

export const registerForPushNotificationsAsync = async () => {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
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
    
    try {
      // Get the token from Expo
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      token = (await Notifications.getDevicePushTokenAsync()).data;
      console.log('ðŸ“¦ FCM Device Token:', token);
    } catch (e) {
      console.error('Error getting push token:', e);
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
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('ðŸ”” Notification Received:', notification);
      if (onNotificationReceived) onNotificationReceived(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('ðŸ“© Notification Response:', response);
      if (onNotificationResponse) onNotificationResponse(response);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
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
      console.log('ðŸš€ FCM Token saved to server:', result);
      return result;
    } catch (error) {
      console.error('âŒ Error saving FCM token:', error);
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
      console.log('ðŸ—‘ï¸ FCM Token deleted from server:', result);
      return result;
    } catch (error) {
      console.error('âŒ Error deleting FCM token:', error);
      return { success: false, error };
    }
  }
};
