import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';
import SecureMedia from './SecureMedia';

interface MediaViewerModalProps {
  visible: boolean;
  url: string | null;
  token: string | null;
  onClose: () => void;
}

export default function MediaViewerModal({ visible, url, token, onClose }: MediaViewerModalProps) {
  if (!url) return null;

  const isVideo = url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.mov');

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
            <X size={28} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.contentContainer}>
            {isVideo ? (
              <SecureMedia 
                url={url} 
                token={token} 
                style={styles.media} 
                contentFit="contain" 
                showControls={true}
              />
            ) : (
              <ReactNativeZoomableView
                maxZoom={3}
                minZoom={1}
                zoomStep={0.5}
                initialZoom={1}
                bindToBorders={true}
                style={styles.zoomableView}
              >
                <SecureMedia 
                  url={url} 
                  token={token} 
                  style={styles.media} 
                  contentFit="contain" 
                  showControls={true}
                />
              </ReactNativeZoomableView>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  safeArea: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
  },
  contentContainer: {
    flex: 1,
  },
  zoomableView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  media: {
    width: '100%',
    height: '100%',
  }
});
