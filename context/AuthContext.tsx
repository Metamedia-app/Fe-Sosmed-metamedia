import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

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

  // Configure Google Sign-In
  useEffect(() => {
    console.log('[GoogleSignin] Configuring...');
    try {
      GoogleSignin.configure({
        webClientId: '415448446076-rppbntavevtlk6llvc9j7douo2e4gvq5.apps.googleusercontent.com',
        androidClientId: '415448446076-3atspbq1392m5p0rpqt8q0sksoh8qitp.apps.googleusercontent.com',
        offlineAccess: true,
      });
      console.log('[GoogleSignin] Configured successfully ✅');
    } catch (error) {
      console.error('[GoogleSignin] Configuration error ❌', error);
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
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

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
        await refreshProfile();
        return { success: true, message: 'Akun Google berhasil ditautkan' };
      } else {
        return { success: false, message: result.message || 'Gagal menautkan Google' };
      }
    } catch (error: any) {
      console.error('Link Google error:', error);
      return { success: false, message: error.message || 'Gagal terhubung ke Google' };
    }
  };

  const loginWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      // Force account picker by signing out first
      try { await GoogleSignin.signOut(); } catch (e) {}
      
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

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
