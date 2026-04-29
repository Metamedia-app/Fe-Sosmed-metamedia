import React from 'react';
import { View, StyleSheet, StyleProp, ImageStyle } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AlertCircle } from 'lucide-react-native';

interface SecureMediaProps extends Omit<ImageProps, 'source'> {
  url: string;
  token: string | null;
  style?: StyleProp<ImageStyle>;
}

export default function SecureMedia({ url, token, style, ...props }: SecureMediaProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  if (!url || !token) {
    return (
      <View style={[styles.container, style, { backgroundColor: theme.border + '50' }]}>
        <AlertCircle size={24} color={theme.description} />
      </View>
    );
  }

  return (
    <Image 
      source={{ 
        uri: url,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }} 
      style={style} 
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

