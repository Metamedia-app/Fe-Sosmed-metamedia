import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming, 
  useSharedValue
} from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SkeletonItem = ({ style }: { style: any }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animatedStyle, { backgroundColor: '#E1E9EE' }]} />;
};

export const PostCardSkeleton = () => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#1A1A1A' : '#FFFFFF';
  const skeletonColor = isDark ? '#333' : '#E1E9EE';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.authorInfo}>
          <SkeletonItem style={[styles.avatar, { backgroundColor: skeletonColor }]} />
          <View>
            <SkeletonItem style={[styles.nameLine, { backgroundColor: skeletonColor }]} />
            <SkeletonItem style={[styles.subLine, { backgroundColor: skeletonColor }]} />
          </View>
        </View>
        <SkeletonItem style={[styles.moreIcon, { backgroundColor: skeletonColor }]} />
      </View>

      {/* Content */}
      <View style={styles.contentPadding}>
        <SkeletonItem style={[styles.contentLine, { width: '90%', backgroundColor: skeletonColor }]} />
        <SkeletonItem style={[styles.contentLine, { width: '70%', backgroundColor: skeletonColor }]} />
      </View>

      {/* Media Placeholder */}
      <SkeletonItem style={[styles.mediaPlaceholder, { backgroundColor: skeletonColor }]} />

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <SkeletonItem style={[styles.statItem, { backgroundColor: skeletonColor }]} />
        <SkeletonItem style={[styles.statItem, { backgroundColor: skeletonColor }]} />
      </View>

      {/* Action Row */}
      <View style={styles.actionRow}>
        <SkeletonItem style={[styles.actionButton, { backgroundColor: skeletonColor }]} />
        <SkeletonItem style={[styles.actionButton, { backgroundColor: skeletonColor }]} />
        <SkeletonItem style={[styles.actionButton, { backgroundColor: skeletonColor }]} />
        <SkeletonItem style={[styles.actionButton, { backgroundColor: skeletonColor }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    paddingVertical: 15,
    borderRadius: 12,
    marginHorizontal: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  nameLine: {
    width: 120,
    height: 14,
    borderRadius: 4,
    marginBottom: 8,
  },
  subLine: {
    width: 80,
    height: 10,
    borderRadius: 4,
  },
  moreIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  contentPadding: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  contentLine: {
    height: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  mediaPlaceholder: {
    width: '100%',
    height: 250,
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 15,
    gap: 10,
  },
  statItem: {
    width: 40,
    height: 12,
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButton: {
    width: 60,
    height: 24,
    borderRadius: 12,
  },
});
