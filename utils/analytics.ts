import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let analyticsInstance: any = null;
let faLogEvent: any = null;
let faSetUserId: any = null;
let faSetAnalyticsCollectionEnabled: any = null;

// Bypass Firebase Initialization jika berjalan di Expo Go
if (!isExpoGo) {
  try {
    const analytics = require('@react-native-firebase/analytics');
    analyticsInstance = analytics.getAnalytics();
    faLogEvent = analytics.logEvent;
    faSetUserId = analytics.setUserId;
    faSetAnalyticsCollectionEnabled = analytics.setAnalyticsCollectionEnabled;
    
    faSetAnalyticsCollectionEnabled(analyticsInstance, true).catch((err: any) => {
      console.error('[Analytics] Gagal mengaktifkan pengumpulan data', err);
    });
  } catch (error) {
    console.warn('[Analytics] Modul Firebase Native tidak ditemukan (Bypass aktif).');
  }
}

/**
 * Mencatat ketika pengguna membuka halaman (screen) tertentu.
 * Gunakan ini setiap kali terjadi perpindahan navigasi.
 */
export const logScreenView = async (screenName: string, screenClass: string = 'Screen') => {
  if (isExpoGo || !faLogEvent || !analyticsInstance) {
    console.log(`[Analytics - Bypass Expo Go] Catat Screen View: ${screenName}`);
    return;
  }
  try {
    await faLogEvent(analyticsInstance, 'screen_view', {
      screen_name: screenName,
      screen_class: screenClass,
    });
    console.log(`[Analytics] Catat Screen View: ${screenName}`);
  } catch (error) {
    console.error(`[Analytics] Gagal mencatat Screen View: ${screenName}`, error);
  }
};

/**
 * Mencatat aktivitas spesifik pengguna (seperti klik tombol, submit form).
 * @param eventName Nama event (contoh: 'click_like', 'submit_post')
 * @param params Data tambahan yang mau dicatat (contoh: { post_id: 123 })
 */
export const logEvent = async (eventName: string, params?: { [key: string]: any }) => {
  if (isExpoGo || !faLogEvent || !analyticsInstance) {
    console.log(`[Analytics - Bypass Expo Go] Catat Event: ${eventName}`, params || '');
    return;
  }
  try {
    await faLogEvent(analyticsInstance, eventName, params);
    console.log(`[Analytics] Catat Event: ${eventName}`, params || '');
  } catch (error) {
    console.error(`[Analytics] Gagal mencatat Event: ${eventName}`, error);
  }
};

/**
 * Mendaftarkan ID pengguna (NIM/ID user) ke analytics.
 * Panggil ini setelah mahasiswa berhasil login.
 */
export const setUserId = async (userId: string) => {
  if (isExpoGo || !faSetUserId || !analyticsInstance) {
    console.log(`[Analytics - Bypass Expo Go] Set User ID: ${userId}`);
    return;
  }
  try {
    await faSetUserId(analyticsInstance, userId);
    console.log(`[Analytics] Set User ID: ${userId}`);
  } catch (error) {
    console.error(`[Analytics] Gagal set User ID: ${userId}`, error);
  }
};
