import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { loadGoogleScript, loginRequestWeb } from '@/utils/googleAuth';

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
  token: string | null;
  user: User | null;
  refreshSignal: number;
  login: (token: string, user: User) => void;
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
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
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
            console.log('[GoogleSignin] Configured successfully ✅');
          }
        } else {
          console.log('[GoogleSignin] Skipped configuration (Expo Go environment)');
        }
      } catch (error) {
        console.warn('[GoogleSignin] Warning: Native module not found.');
      }
    }
  }, []);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    setIsLoggedIn(true);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
  };

  const triggerRefresh = () => {
    setRefreshSignal(prev => prev + 1);
  };

  const updateUserData = (newData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...newData } : null);
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const result = await response.json();
      if (response.ok) {
        // Based on confirmed structure: { success: true, data: { user: { ... } } }
        const userData = result.data?.user || result.data || result;
        
        // Ensure id compatibility
        if (userData._id && !userData.id) userData.id = userData._id;
        if (userData.id && !userData._id) userData._id = userData.id;
        setUser(prev => prev ? { ...prev, ...userData } : userData);
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  const updateProfile = async (data: { bio?: string; tempat_lahir?: string; tanggal_lahir?: string; agama?: string }) => {
    if (!token) return { success: false, message: 'No token found' };
    try {
      const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me', {
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
        setUser(prev => prev ? { ...prev, ...userData } : userData);
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

      const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me/avatar', {
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
          setUser(prev => prev ? { ...prev, avatar_url: newAvatarUrl } : null);
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
      const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me/avatar', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      const result = await response.json();
      if (response.ok) {
        setUser(prev => prev ? { ...prev, avatar_url: undefined } : null);
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
      const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me/password', {
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

      const response = await fetch('https://besosmed-production.up.railway.app/api/v1/me/link-google', {
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

      const response = await fetch('https://besosmed-production.up.railway.app/api/v1/auth/google', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      const result = await response.json();
      if (response.ok) {
        const { token: newToken, user: userData } = result.data || result;
        login(newToken, userData);
        return { success: true };
      } else {
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
