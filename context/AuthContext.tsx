import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { loadGoogleScript, loginRequestWeb } from '@/utils/googleAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

type User = {
  id: string;
  _id?: string; // MongoDB ID from backend
  nim: string;
  nama: string;
  program_studi?: string;
  tanggal_masuk?: string;
  status_mahasiswa?: string;
  jenis_kelamin?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  agama?: string;
  alamat?: string;
  bio?: string;
  avatar_url?: string;
  is_online?: boolean;
  email?: string;
  role?: string; // 'dosen' or 'mahasiswa'
};

type AuthContextType = {
  isLoggedIn: boolean;
  isLoadingAuth: boolean;
  token: string | null;
  user: User | null;
  refreshSignal: number;
  login: (token: string, user: User, fcmToken?: string) => void;
  logout: () => void;
  triggerRefresh: () => void;
  refreshProfile: () => Promise<void>;
  updateUserData: (newData: Partial<User>) => void;
  updateProfile: (data: { bio?: string; tempat_lahir?: string; tanggal_lahir?: string; agama?: string }) => Promise<{ success: boolean; message?: string }>;
  uploadAvatar: (imageUri: string, mimeType: string, fileName: string) => Promise<{ success: boolean; message?: string }>;
  deleteAvatar: () => Promise<{ success: boolean; message?: string }>;
  changePassword: (data: { oldPassword?: string; newPassword?: string }) => Promise<{ success: boolean; message?: string }>;
  linkGoogle: () => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; message?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const [isProcessingGoogle, setIsProcessingGoogle] = useState(false);
  const WEB_CLIENT_ID = '415448446076-rppbntavevtlk6llvc9j7douo2e4gvq5.apps.googleusercontent.com';

  // Configure Google Sign-In
  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('[GoogleSignin] Web Platform: Loading GIS script...');
      loadGoogleScript();
    } else {
      console.log('[GoogleSignin] Native Platform: Configuring...');
      try {
        // Strict guard: NEVER require GoogleSignin in Expo Go
        const isExpoGo = Constants.appOwnership === 'expo';
        if (!isExpoGo) {
          const { GoogleSignin } = require('@react-native-google-signin/google-signin');
          if (GoogleSignin) {
            GoogleSignin.configure({
              webClientId: WEB_CLIENT_ID,
              offlineAccess: true,
            });
            console.log('[GoogleSignin] Configured successfully âœ…');
          }
        } else {
          console.log('[GoogleSignin] Skipped configuration (Expo Go environment)');
        }
      } catch (error) {
        console.warn('[GoogleSignin] Warning: Native module not found.');
      }
    }
  }, []);

  // Load Auth State from AsyncStorage on Mount
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('@auth_token');
        const storedUser = await AsyncStorage.getItem('@auth_user');
        const storedFcmToken = await AsyncStorage.getItem('@auth_fcmToken');
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          if (storedFcmToken) setFcmToken(storedFcmToken);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Failed to load auth state', error);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    loadStoredAuth();
  }, []);

  // [FORCE LOGOUT / BANNED] HTTP 403 Interceptor
  useEffect(() => {
    const originalFetch = global.fetch;
    global.fetch = async function (...args) {
      try {
        const response = await originalFetch.apply(this, args);
        if (response.status === 403) {
          
          // --- CEK APAKAH INI ERROR KHUSUS ATAU VALIDASI RESOURCE ---
          try {
            const clone = response.clone();
            const body = await clone.json();
            
            if (body) {
              // Lewatkan error sinkronisasi akun Google
              if (body.errorCode === 'ACCOUNT_NOT_LINKED') {
                return response;
              }
              
              // Lewatkan error dari endpoint chat (pesan kasar / grup arsip / dilarang)
              // Biarkan komponen yang menampilkan `body.message` dari Backend langsung
              if (response.url && (response.url.includes('/chat') || response.url.includes('/messages') || response.url.includes('/posts') || response.url.includes('/comments'))) {
                return response; 
              }
            }
          } catch (e) {
            // Abaikan jika bukan JSON
          }

          console.warn("[Force Logout] Banned! API mengembalikan status 403 Forbidden.");
          
          // Tampilkan alert pemberitahuan sebelum melempar ke login
          Alert.alert(
            'Akses Diblokir',
            'Sesi dihentikan karena akun Anda telah dinonaktifkan. Silakan hubungi pihak kampus untuk informasi lebih lanjut.',
            [{ text: 'Tutup' }]
          );
          
          // If we have an FCM token and auth token, try to delete it from server first
          if (token && fcmToken) {
            try {
              const { pushNotificationService } = require('@/utils/pushNotification');
              await pushNotificationService.deleteToken(token, fcmToken);
            } catch (e) {}
          }
          
          try {
            await AsyncStorage.multiRemove(['@auth_token', '@auth_user', '@auth_fcmToken']);
          } catch (e) {}
          
          setToken(null);
          setUser(null);
          setFcmToken(null);
          setIsLoggedIn(false);
          router.replace('/login');
        }
        return response;
      } catch (error) {
        throw error;
      }
    };
    return () => {
      global.fetch = originalFetch;
    };
  }, [token, fcmToken]);

  const login = async (newToken: string, userData: User, newFcmToken?: string) => {
    try {
      await AsyncStorage.setItem('@auth_token', newToken);
      await AsyncStorage.setItem('@auth_user', JSON.stringify(userData));
      if (newFcmToken) await AsyncStorage.setItem('@auth_fcmToken', newFcmToken);
    } catch (error) {
      console.error('Failed to save auth state', error);
    }
    
    setToken(newToken);
    setUser(userData);
    if (newFcmToken) setFcmToken(newFcmToken);
    setIsLoggedIn(true);
  };

  const logout = async () => {
    // If we have an FCM token and auth token, try to delete it from server
    if (token && fcmToken) {
      try {
        const { pushNotificationService } = require('@/utils/pushNotification');
        await pushNotificationService.deleteToken(token, fcmToken);
      } catch (e) {
        console.error('Failed to delete FCM token on logout:', e);
      }
    }
    
    try {
      await AsyncStorage.multiRemove(['@auth_token', '@auth_user', '@auth_fcmToken']);
    } catch (error) {
      console.error('Failed to remove auth state', error);
    }
    
    setToken(null);
    setUser(null);
    setFcmToken(null);
    setIsLoggedIn(false);
    router.replace('/login');
  };

  const triggerRefresh = () => {
    setRefreshSignal(prev => prev + 1);
  };

  const updateUserData = (newData: Partial<User>) => {
    setUser(prev => {
      const updated = prev ? { ...prev, ...newData } : null;
      if (updated) AsyncStorage.setItem('@auth_user', JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      // [OLD API BACKUP]: const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me', {
      const response = await fetch('https://api.metausosmed.my.id/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const result = await response.json();
      if (response.ok) {
        // Based on confirmed structure: { success: true, data: { user: { ... } } }
        const userData = result.data?.user || result.data || result;
        
        // Ensure id compatibility & Google data compatibility
        if (userData._id && !userData.id) userData.id = userData._id;
        if (userData.id && !userData._id) userData._id = userData.id;
        if (!userData.nama && userData.name) userData.nama = userData.name;
        if (!userData.avatar_url && userData.picture) userData.avatar_url = userData.picture;
        
        setUser(prev => {
          const updated = prev ? { ...prev, ...userData } : userData;
          AsyncStorage.setItem('@auth_user', JSON.stringify(updated)).catch(console.error);
          return updated;
        });
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const updateProfile = async (data: { bio?: string; tempat_lahir?: string; tanggal_lahir?: string; agama?: string }) => {
    if (!token) return { success: false, message: 'No token found' };
    try {
      // [OLD API BACKUP]: const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me', {
      const response = await fetch('https://api.metausosmed.my.id/api/v1/me', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (response.ok) {
        const userData = result.data?.user || result.data || result;
        // Ensure id compatibility
        if (userData._id && !userData.id) userData.id = userData._id;
        if (userData.id && !userData._id) userData._id = userData.id;
        setUser(prev => {
          const updated = prev ? { ...prev, ...userData } : userData;
          AsyncStorage.setItem('@auth_user', JSON.stringify(updated)).catch(console.error);
          return updated;
        });
        return { success: true };
      } else {
        return { success: false, message: result.message || 'Gagal memperbarui profil' };
      }
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, message: 'Terjadi kesalahan koneksi' };
    }
  };

  const uploadAvatar = async (imageUri: string, mimeType: string, fileName: string) => {
    if (!token) return { success: false, message: 'No token found' };
    try {
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: mimeType,
        name: fileName || 'avatar.jpg',
      } as any);

      // [OLD API BACKUP]: const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me/avatar', {
      const response = await fetch('https://api.metausosmed.my.id/api/v1/me/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        const newAvatarUrl = result.data?.avatar_url;
        if (newAvatarUrl) {
          setUser(prev => {
            const updated = prev ? { ...prev, avatar_url: newAvatarUrl } : null;
            if (updated) AsyncStorage.setItem('@auth_user', JSON.stringify(updated)).catch(console.error);
            return updated;
          });
        } else {
          await refreshProfile(); // Fallback if avatar_url is missing in response
        }
        return { success: true };
      } else {
        return { success: false, message: result.message || 'Gagal mengunggah foto profil' };
      }
    } catch (error) {
      console.error('Upload avatar error:', error);
      return { success: false, message: 'Terjadi kesalahan koneksi' };
    }
  };

  const deleteAvatar = async () => {
    if (!token) return { success: false, message: 'No token found' };
    try {
      // [OLD API BACKUP]: const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me/avatar', {
      const response = await fetch('https://api.metausosmed.my.id/api/v1/me/avatar', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      const result = await response.json();
      if (response.ok) {
        setUser(prev => {
          const updated = prev ? { ...prev, avatar_url: undefined } : null;
          if (updated) AsyncStorage.setItem('@auth_user', JSON.stringify(updated)).catch(console.error);
          return updated;
        });
        return { success: true };
      } else {
        return { success: false, message: result.message || 'Gagal menghapus foto profil' };
      }
    } catch (error) {
      console.error('Delete avatar error:', error);
      return { success: false, message: 'Terjadi kesalahan koneksi' };
    }
  };

  const changePassword = async (data: { oldPassword?: string; newPassword?: string }) => {
    if (!token) return { success: false, message: 'No token found' };
    try {
      // [OLD API BACKUP]: const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me/password', {
      const response = await fetch('https://api.metausosmed.my.id/api/v1/me/password', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (response.ok) {
        return { success: true, message: result.message || 'Password berhasil diubah' };
      } else {
        return { success: false, message: result.message || 'Gagal mengubah password' };
      }
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, message: 'Terjadi kesalahan koneksi' };
    }
  };

  const linkGoogle = async () => {
    if (!token) return { success: false, message: 'Harus login dulu untuk menautkan akun' };
    if (isProcessingGoogle) return { success: false, message: 'Proses Google sedang berjalan...' };
    
    setIsProcessingGoogle(true);
    console.log('[AuthContext] linkGoogle called. Stack:', new Error().stack?.split('\n')[2]);
    
    try {
      let idToken: string | undefined;

      if (Platform.OS === 'web') {
        idToken = await loginRequestWeb(WEB_CLIENT_ID);
      } else {
        // Dynamic import before calling native methods
        try {
          const isExpoGo = Constants.appOwnership === 'expo';
          if (isExpoGo) {
            return { success: false, message: 'Google Sign-In tidak didukung di Expo Go. Gunakan Development Build.' };
          }
          
          const { GoogleSignin } = require('@react-native-google-signin/google-signin');
          await GoogleSignin.hasPlayServices();
          
          // Force account picker by signing out first
          try { await GoogleSignin.signOut(); } catch (e) {}
          
          const userInfo = await GoogleSignin.signIn();
          idToken = userInfo.data?.idToken ?? undefined;
        } catch (e: any) {
          if (e.message?.includes('RNGoogleSignin') || e.message?.includes('found')) {
            return { success: false, message: 'Fitur ini membutuhkan Development Build (tidak support di Expo Go)' };
          }
          throw e;
        }
      }

      if (!idToken) return { success: false, message: 'Gagal mengambil idToken dari Google' };

      console.log('[LinkGoogle] JWT Token:', token?.substring(0, 10) + '...');
      console.log('[LinkGoogle] Google idToken:', idToken.substring(0, 10) + '...');

      // [OLD API BACKUP]: const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me/link-google', {
      const response = await fetch('https://api.metausosmed.my.id/api/v1/me/link-google', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      const result = await response.json();
      console.log('[LinkGoogle] DEBUG Result:', JSON.stringify(result));
      if (response.ok) {
        // Update local user state with email immediately
        if (result.data?.email) {
          updateUserData({ email: result.data.email });
        }
        await refreshProfile();
        return { success: true, message: 'Akun Google berhasil ditautkan' };
      } else {
        return { success: false, message: result.message || 'Gagal menautkan Google' };
      }
    } catch (error: any) {
      console.error('Link Google error:', error);
      return { success: false, message: error.message || 'Gagal terhubung ke Google' };
    } finally {
      setIsProcessingGoogle(false);
    }
  };

  const loginWithGoogle = async () => {
    if (isProcessingGoogle) return { success: false, message: 'Proses Google sedang berjalan...' };
    
    setIsProcessingGoogle(true);
    console.log('[AuthContext] loginWithGoogle called. Stack:', new Error().stack?.split('\n')[2]);
    
    try {
      let idToken: string | undefined;

      if (Platform.OS === 'web') {
        idToken = await loginRequestWeb(WEB_CLIENT_ID);
      } else {
        try {
          const isExpoGo = Constants.appOwnership === 'expo';
          if (isExpoGo) {
            return { success: false, message: 'Google Sign-In tidak didukung di Expo Go. Gunakan Development Build.' };
          }

          const { GoogleSignin } = require('@react-native-google-signin/google-signin');
          await GoogleSignin.hasPlayServices();
          // Force account picker by signing out first
          try { await GoogleSignin.signOut(); } catch (e) {}
          
          const userInfo = await GoogleSignin.signIn();
          idToken = userInfo.data?.idToken ?? undefined;
        } catch (e: any) {
          if (e.message?.includes('RNGoogleSignin') || e.message?.includes('found')) {
            return { success: false, message: 'Fitur ini membutuhkan Development Build (tidak support di Expo Go)' };
          }
          throw e;
        }
      }

      if (!idToken) return { success: false, message: 'Gagal mengambil idToken dari Google' };

      // [OLD API BACKUP]: const response = await fetch('https://besosmed-production.up.railway.app/api/v1/auth/google', {
      const response = await fetch('https://api.metausosmed.my.id/api/v1/auth/google', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      const result = await response.json();
      if (response.ok) {
        const { token: newToken, user: rawUserData } = result.data || result;
        const userData = { ...rawUserData };
        
        // Normalize Google Data & Ensure ID compatibility
        if (userData._id && !userData.id) userData.id = userData._id;
        if (userData.id && !userData._id) userData._id = userData.id;
        if (!userData.nama && userData.name) userData.nama = userData.name;
        if (!userData.avatar_url && userData.picture) userData.avatar_url = userData.picture;
        
        // --- PUSH NOTIFICATION INTEGRATION ---
        let fcmTokenResult = undefined;
        try {
          const { registerForPushNotificationsAsync, pushNotificationService } = require('@/utils/pushNotification');
          fcmTokenResult = await registerForPushNotificationsAsync();
          if (fcmTokenResult && newToken) {
            await pushNotificationService.saveToken(newToken, fcmTokenResult);
          }
        } catch (pushError) {
          console.error('Failed to setup push notifications (Google):', pushError);
        }
        // -------------------------------------

        await login(newToken, userData, fcmTokenResult);
        return { success: true };
      } else {
        // --- TANGKAP ERROR CODE DARI BACKEND TIM (ACCOUNT_NOT_LINKED atau Banned) ---
        if (response.status === 403) {
          if (result.errorCode === 'ACCOUNT_NOT_LINKED') {
            return { success: false, message: 'Akun Google belum ditautkan. Login menggunakan NIM dulu!' };
          } else {
            return { success: false, message: result.message || 'Akun Anda sedang dibatasi.' };
          }
        }
        
        return { success: false, message: result.message || 'Gagal login via Google' };
      }
    } catch (error: any) {
      console.error('Login Google error:', error);
      return { success: false, message: error.message || 'Gagal login via Google' };
    } finally {
      setIsProcessingGoogle(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, 
      isLoadingAuth,
      token, 
      user, 
      refreshSignal, 
      login, 
      logout, 
      triggerRefresh,
      refreshProfile,
      updateUserData,
      updateProfile,
      uploadAvatar,
      deleteAvatar,
      changePassword,
      linkGoogle,
      loginWithGoogle
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
