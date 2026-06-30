import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { X, FlipHorizontal } from 'lucide-react-native';

interface CustomCameraProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (asset: { uri: string; type: 'image' | 'video' }) => void;
}

export default function CustomCamera({ visible, onClose, onCapture }: CustomCameraProps) {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  if (!visible) return null;

  if (!camPermission || !micPermission) {
    return <View />;
  }

  if (!camPermission.granted || !micPermission.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.permissionContainer}>
          <Text style={{ textAlign: 'center', marginBottom: 20, color: '#FFF' }}>
            Kami butuh izin kamera dan mikrofon untuk fitur ini.
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={() => {
              requestCamPermission();
              requestMicPermission();
            }}
          >
            <Text style={{ color: '#000', fontWeight: 'bold' }}>Beri Izin Akses</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={onClose}>
            <Text style={{ color: '#FFF' }}>Batal</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    if (mode === 'picture') {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (photo) {
          onCapture({ uri: photo.uri, type: 'image' });
          onClose();
        }
      } catch (e) {
        console.error('Failed to take photo', e);
      }
    } else {
      if (isRecording) {
        cameraRef.current.stopRecording();
        setIsRecording(false);
      } else {
        setIsRecording(true);
        try {
          const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
          if (video) {
            onCapture({ uri: video.uri, type: 'video' });
            onClose();
          }
        } catch (e) {
          console.error('Failed to record video', e);
          setIsRecording(false);
        }
      }
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <CameraView 
          ref={cameraRef}
          style={styles.camera} 
          facing={facing} 
          mode={mode} 
        >
          {/* Controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={28} color="#FFF" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <FlipHorizontal size={28} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.bottomControls}>
              
              {/* Mode Switcher */}
              {!isRecording && (
                <View style={styles.modeSwitcher}>
                  <TouchableOpacity onPress={() => setMode('picture')}>
                    <Text style={[styles.modeText, mode === 'picture' && styles.modeTextActive]}>FOTO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMode('video')}>
                    <Text style={[styles.modeText, mode === 'video' && styles.modeTextActive]}>VIDEO</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity 
                style={styles.captureButtonContainer}
                onPress={handleCapture}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.captureButton, 
                  mode === 'video' && styles.captureButtonVideo,
                  isRecording && styles.captureButtonRecording
                ]} />
              </TouchableOpacity>
              
              <Text style={styles.hintText}>
                {isRecording ? 'Merekam... Tekan lagi untuk berhenti' : (mode === 'picture' ? 'Tap untuk memotret' : 'Tap untuk merekam')}
              </Text>
            </View>
          </View>
        </CameraView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.9)', padding: 20 },
  permissionButton: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  camera: { flex: 1 },
  controlsContainer: { flex: 1, backgroundColor: 'transparent' },
  closeButton: { position: 'absolute', top: 40, left: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 25 },
  flipButton: { position: 'absolute', top: 40, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 25 },
  bottomControls: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
  modeSwitcher: { flexDirection: 'row', gap: 30, marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  modeText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', opacity: 0.5 },
  modeTextActive: { opacity: 1, color: '#FFD700' },
  captureButtonContainer: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF' },
  captureButtonVideo: { backgroundColor: '#FF3B30' },
  captureButtonRecording: { borderRadius: 15, transform: [{ scale: 0.6 }] },
  hintText: { color: '#FFF', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 15, overflow: 'hidden' }
});
