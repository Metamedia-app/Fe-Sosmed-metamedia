import { getAnalytics, logScreenView as faLogScreenView, logEvent as faLogEvent, setUserId as faSetUserId } from '@react-native-firebase/analytics';

// Inisialisasi instance analytics modular
const analyticsInstance = getAnalytics();

/**
 * Mencatat ketika pengguna membuka halaman (screen) tertentu.
 * Gunakan ini setiap kali terjadi perpindahan navigasi.
 */
export const logScreenView = async (screenName: string, screenClass: string = 'Screen') => {
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
  try {
    await faSetUserId(analyticsInstance, userId);
    console.log(`[Analytics] Set User ID: ${userId}`);
  } catch (error) {
    console.error(`[Analytics] Gagal set User ID`, error);
  }
};

