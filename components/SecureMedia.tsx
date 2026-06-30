import React from 'react';
import { View, StyleSheet, StyleProp, ImageStyle } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AlertCircle, PlayCircle } from 'lucide-react-native';
import { BASE_URL } from '@/utils/api';

interface SecureMediaProps extends Omit<ImageProps, 'source'> {
  url: string;
  token: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: any;
  showControls?: boolean;
}

function SecureVideo({ fullUrl, token, style, contentFit, showControls }: any) {
  const videoSource = {
    uri: fullUrl,
    ...(fullUrl.startsWith('file://') ? {} : { headers: { 'Authorization': `Bearer ${token}` } })
  };

  const player = useVideoPlayer(videoSource, player => {
    player.loop = showControls;
    if (!showControls) {
      player.pause();
    }
  });

  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', overflow: 'hidden' }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        allowsFullscreen
        allowsPictureInPicture
        contentFit={contentFit === 'cover' ? 'cover' : 'contain'}
        nativeControls={showControls}
      />
      {!showControls && (
        <View style={{ position: 'absolute', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 30, padding: 2 }}>
          <PlayCircle size={40} color="#FFF" />
        </View>
      )}
    </View>
  );
}

export default function SecureMedia({ url, token, style, contentFit, showControls = false, ...props }: SecureMediaProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  if (!url || (!token && !url.startsWith('file://'))) {
    return (
      <View style={[styles.container, style, { backgroundColor: theme.border + '50' }]}>
        <AlertCircle size={24} color={theme.description} />
      </View>
    );
  }

  // Handle local file:/// uris vs relative server /api/... uris
  let fullUrl = url.startsWith('/') ? `${BASE_URL}${url}` : url;
  
  // Fix double slash issue from backend like http://domain.com//api/... -> http://domain.com/api/...
  fullUrl = fullUrl.replace(/([^:]\/)\/+/g, "$1");

  const isVideo = fullUrl.toLowerCase().endsWith('.mp4') || fullUrl.toLowerCase().endsWith('.mov');

  if (isVideo) {
    return <SecureVideo fullUrl={fullUrl} token={token} style={style} contentFit={contentFit} showControls={showControls} />;
  }

  return (
    <Image 
      source={{ 
        uri: fullUrl,
        ...(fullUrl.startsWith('file://') ? {} : { headers: { 'Authorization': `Bearer ${token}` } })
      }} 
      style={style} 
      contentFit={contentFit}
      {...props} 
    />
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  }
});

