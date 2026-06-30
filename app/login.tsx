import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Keyboard, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, LogIn } from 'lucide-react-native';
import { registerForPushNotificationsAsync, pushNotificationService } from '@/utils/pushNotification';

export default function LoginScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();

  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for rate limit
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && errorMessage?.includes('Coba lagi')) {
      setErrorMessage(null);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Premium Keyboard Animation
  const logoAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        Animated.timing(logoAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false, // Must be false because we animate height/marginBottom
        }).start();
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleLogin = async () => {
    if (!nim || !password) {
      setErrorMessage('Harap isi NIM NIDN dan kata sandi');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      // [OLD API BACKUP]: const response = await fetch('https://besosmed-production.up.railway.app/api/v1/auth/login', {
      const response = await fetch('https://api.metausosmed.my.id/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nim: nim.trim(),
          password: password,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const { token, user } = result.data || result;
        const userData = user || { 
          id: result._id || result.id || '1', 
          _id: result._id || result.id || '1',
          nim: nim, 
          nama: result.nama || 'Pengguna' 
        };
        
        // Ensure both id and _id are present for compatibility
        if (userData._id && !userData.id) userData.id = userData._id;
        if (userData.id && !userData._id) userData._id = userData.id;

        // --- PUSH NOTIFICATION INTEGRATION (Non-Blocking) ---
        registerForPushNotificationsAsync().then(async (fcmToken) => {
          if (fcmToken && token) {
            await pushNotificationService.saveToken(token, fcmToken);
            // Optionally update local storage with fcmToken in the background
            AsyncStorage.setItem('@auth_fcmToken', fcmToken).catch(console.error);
          }
        }).catch((pushError) => {
          console.error('Failed to setup push notifications:', pushError);
        });
        // -------------------------------------

        await login(token || 'dummy-token', userData, undefined);
        router.replace('/');
      } else {
        if (response.status === 401) {
          setErrorMessage(result.message || 'NIM NIDN atau password salah.');
        } else if (response.status === 403) {
          setErrorMessage(result.message || 'Akun Anda telah dinonaktifkan/diblokir. Silakan hubungi pihak kampus untuk informasi lebih lanjut.');
        } else if (response.status === 500 || result.retryAfter) {
          if (result.retryAfter) {
            setCountdown(result.retryAfter);
          }
          setErrorMessage(result.message || 'Terlalu banyak percobaan. Silakan coba lagi nanti.');
        } else {
          setErrorMessage(result.message || 'Terjadi kesalahan pada server');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage('Gagal menghubungkan ke server. Periksa koneksi internet Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await loginWithGoogle();
      if (response.success) {
        router.replace('/');
      } else {
        setErrorMessage(response.message || 'Gagal login dengan Google');
      }
    } catch (error) {
      console.error('Google login catch:', error);
      setErrorMessage('Terjadi kesalahan saat login Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo Section with Premium Animation */}
        <Animated.View style={[
          styles.logoContainer,
          {
            opacity: logoAnim,
            height: logoAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 170] // 170 is roughly the height of the logo + text
            }),
            marginBottom: logoAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 40]
            }),
            transform: [{
              scale: logoAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1]
              })
            }]
          }
        ]}>
          <View style={styles.logoCircle}>
            <Image 
              source={require('@/assets/images/icon.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>Metamedia</Text>
          <Text style={styles.appSubtitle}>Campus Social Platform</Text>
        </Animated.View>

        {/* Form Section */}
        <View style={[styles.formContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.welcomeText, { color: theme.text }]}>Selamat Datang!</Text>
          
          {/* Inline Error Notification */}
          {errorMessage && (
            <View style={[styles.errorBox, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
              <Text style={[styles.errorText, { color: theme.primary }]}>{errorMessage}</Text>
              {countdown > 0 && (
                <Text style={[styles.countdownText, { color: theme.primary }]}>
                  Tunggu {countdown} detik lagi
                </Text>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Mail color={theme.icon} size={20} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="NIM/NIDN/Email"
                placeholderTextColor={theme.description}
                value={nim}
                onChangeText={(text) => {
                  setNim(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                editable={!isLoading && countdown === 0}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Lock color={theme.icon} size={20} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Kata Sandi"
                placeholderTextColor={theme.description}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry
                editable={!isLoading && countdown === 0}
              />
            </View>
          </View>



          <TouchableOpacity 
            style={[
              styles.loginButton, 
              { backgroundColor: theme.accent, opacity: (isLoading || countdown > 0) ? 0.7 : 1 }
            ]}
            onPress={handleLogin}
            disabled={isLoading || countdown > 0}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <>
                <LogIn color={theme.primary} size={20} style={{ marginRight: 8 }} />
                <Text style={[styles.loginButtonText, { color: theme.primary }]}>
                  {countdown > 0 ? `Tunggu (${countdown}s)` : 'Masuk'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.description }]}>Atau</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity 
            style={[
              styles.googleButton, 
              { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }
            ]}
            onPress={handleGoogleLogin}
            disabled={isLoading || countdown > 0}
          >
            <Image 
              source={{ uri: 'https://img.icons8.com/color/48/000000/google-logo.png' }} 
              style={styles.googleIcon} 
            />
            <Text style={[styles.googleButtonText, { color: theme.text }]}>
              Masuk dengan Google
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  logoImage: {
    width: '70%',
    height: '70%',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  formContainer: {
    borderRadius: 24,
    padding: 25,
    paddingTop: 35,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 25,
  },
  loginButton: {
    height: 55,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
    gap: 4,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  countdownText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 14,
    fontWeight: '600',
  },
  googleButton: {
    height: 55,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
