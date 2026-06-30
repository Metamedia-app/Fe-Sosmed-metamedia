import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ChevronLeft, Lock, Eye, EyeOff } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Stack } from 'expo-router';

export default function ChangePasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { changePassword } = useAuth();
  const router = useRouter();
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!oldPassword.trim()) {
      setErrorMsg('Password lama tidak boleh kosong');
      return;
    }
    
    if (!newPassword.trim()) {
      setErrorMsg('Password baru tidak boleh kosong');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password baru harus minimal 6 karakter');
      return;
    }

    setIsLoading(true);
    
    const result = await changePassword({ oldPassword, newPassword });
    
    setIsLoading(false);

    if (result.success) {
      setSuccessMsg(result.message || 'Password berhasil diubah');
      setTimeout(() => {
        router.back();
      }, 2000);
    } else {
      setErrorMsg(result.message || 'Gagal mengubah password');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Ganti Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: 30, marginTop: 10 }}>
            <Text style={{ fontSize: 15, color: theme.description, lineHeight: 22 }}>
              Demi keamanan akun, pastikan Anda menggunakan password yang kuat dan unik (minimal 6 karakter).
            </Text>
          </View>

          {errorMsg ? (
            <View style={[styles.messageBox, { backgroundColor: theme.brandRed + '20', borderColor: theme.brandRed }]}>
              <Text style={[styles.messageText, { color: theme.brandRed }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={[styles.messageBox, { backgroundColor: '#10B98120', borderColor: '#10B981' }]}>
              <Text style={[styles.messageText, { color: '#10B981' }]}>{successMsg}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Password Lama</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Lock size={20} color={theme.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Masukkan password lama"
                placeholderTextColor={theme.description}
                secureTextEntry={!showOldPassword}
                value={oldPassword}
                onChangeText={setOldPassword}
              />
              <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)} style={styles.eyeIcon}>
                {showOldPassword ? (
                  <EyeOff size={20} color={theme.icon} />
                ) : (
                  <Eye size={20} color={theme.icon} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Password Baru</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Lock size={20} color={theme.icon} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Masukkan password baru"
                placeholderTextColor={theme.description}
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
                {showNewPassword ? (
                  <EyeOff size={20} color={theme.icon} />
                ) : (
                  <Eye size={20} color={theme.icon} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.saveButton, 
              { backgroundColor: isLoading ? theme.primary + '80' : theme.primary }
            ]} 
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Simpan Password</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 10,
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  messageBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  eyeIcon: {
    padding: 8,
  },
  saveButton: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
