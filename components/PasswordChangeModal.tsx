import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { X, Lock, Eye, EyeOff } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

interface PasswordChangeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PasswordChangeModal({ visible, onClose }: PasswordChangeModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { changePassword } = useAuth();
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleClose = () => {
    setOldPassword('');
    setNewPassword('');
    setErrorMsg('');
    setSuccessMsg('');
    setShowOldPassword(false);
    setShowNewPassword(false);
    onClose();
  };

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
        handleClose();
      }, 2000);
    } else {
      setErrorMsg(result.message || 'Gagal mengubah password');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Ganti Password</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={theme.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
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
          </ScrollView>

          {/* Footer */}
          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <TouchableOpacity 
              style={[styles.cancelButton, { borderColor: theme.border }]} 
              onPress={handleClose}
              disabled={isLoading}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>Batal</Text>
            </TouchableOpacity>
            
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
                <Text style={styles.saveButtonText}>Simpan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '70%',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
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
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
