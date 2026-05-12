import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Story, storyService } from '@/utils/story';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, ChevronRight, X, Eye, MoreVertical } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    TouchableWithoutFeedback,
    Platform
} from 'react-native';
import { getAvatarUrl } from '@/utils/avatar';

const { width, height } = Dimensions.get('window');

interface StoryViewerProps {
  isVisible: boolean;
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  onAllStoriesEnd?: () => void;
  onViewersClick?: (storyId: string) => void;
  onStorySeen?: (storyId: string) => void;
  isPaused?: boolean;
}

export default function StoryViewer({ 
  isVisible, 
  stories, 
  initialIndex = 0, 
  onClose, 
  onAllStoriesEnd,
  onViewersClick,
  onStorySeen,
  isPaused = false
}: StoryViewerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token, user } = useAuth();
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const progress = useRef(new Animated.Value(0)).current;
  const [paused, setPaused] = useState(false);

  const currentStory = stories[currentIndex];
  const isOwnStory = currentStory?.author_id === user?._id || currentStory?.author_id === user?.id;

  useEffect(() => {
    if (isVisible) {
      setCurrentIndex(initialIndex);
      startProgress();
      recordView(stories[initialIndex]?._id);
    } else {
      progress.stopAnimation();
      progress.setValue(0);
    }
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && !paused && !isPaused) {
      startProgress();
    } else {
      progress.stopAnimation();
    }
  }, [currentIndex, paused, isPaused, isVisible]);

  const player = useVideoPlayer(currentStory?.media?.type === 'video' ? currentStory.media.url : null, p => {
    p.loop = false;
    p.play();
  });

  const startProgress = () => {
    progress.setValue(0);
    const duration = currentStory?.media?.type === 'video' ? 10000 : 5000;
    Animated.timing(progress, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        nextStory();
      }
    });
  };

  const recordView = async (storyId: string) => {
    if (!token || !storyId) return;
    try {
      await storyService.recordView(token, storyId);
      if (onStorySeen) onStorySeen(storyId);
    } catch (error) {
       // Silently fail view recording
    }
  };

  const nextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      recordView(stories[currentIndex + 1]?._id);
    } else {
      onClose();
      if (onAllStoriesEnd) onAllStoriesEnd();
    }
  };

  const prevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      // Stay on first story or restart? 
      progress.setValue(0);
      startProgress();
    }
  };

  const handleTouch = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    if (x < width / 3) {
      prevStory();
    } else {
      nextStory();
    }
  };

  if (!currentStory) return null;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Progress Bars */}
        <View style={styles.progressContainer}>
          {stories.map((item, index) => (
            <View key={index} style={[styles.progressBarBg, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
              <Animated.View 
                style={[
                  styles.progressBarFill, 
                  { 
                    backgroundColor: '#FFF',
                    width: index === currentIndex 
                      ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                      : index < currentIndex ? '100%' : '0%'
                  }
                ]} 
              />
            </View>
          ))}
        </View>

        {/* Content */}
        <TouchableWithoutFeedback 
          onPressIn={() => {
            setPaused(true);
            if (currentStory?.media?.type === 'video') player?.pause();
          }} 
          onPressOut={() => {
            setPaused(false);
            if (currentStory?.media?.type === 'video') player?.play();
          }}
          onPress={handleTouch}
        >
          <View style={styles.contentContainer}>
             {currentStory?.media?.type === 'video' ? (
                <VideoView 
                  player={player} 
                  style={styles.media} 
                  contentFit="contain"
                  nativeControls={false}
                />
             ) : (
                <Image 
                    source={{ uri: currentStory?.media?.url }} 
                    style={styles.media}
                    contentFit="contain"
                />
             )}
             
             {/* Text Overlay */}
             {currentStory.content && (
                <View style={styles.textOverlay}>
                    <Text style={styles.storyText}>{currentStory.content}</Text>
                </View>
             )}
          </View>
        </TouchableWithoutFeedback>

        {/* Header Overlay */}
        <View style={styles.header}>
            <View style={styles.authorRow}>
                <Image 
                    source={{ uri: getAvatarUrl(currentStory.author || { nama: 'User' }, true) }} 
                    style={styles.avatar} 
                />
                <View>
                    <Text style={styles.authorName}>{currentStory.author?.nama || (currentStory as any).author?.name || 'Pengguna'}</Text>
                    <Text style={styles.timeText}>
                        {(() => {
                            const date = new Date(currentStory.createdAt);
                            return isNaN(date.getTime()) ? 'Baru saja' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        })()}
                    </Text>
                </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={28} color="#FFF" />
            </TouchableOpacity>
        </View>

        {/* Footer Overlay (For Own Stories) */}
        {isOwnStory && (
            <SafeAreaView style={styles.footer}>
                <TouchableOpacity 
                    style={styles.viewersButton} 
                    onPress={() => onViewersClick && onViewersClick(currentStory._id)}
                >
                    <Eye size={20} color="#FFF" />
                    <Text style={styles.footerText}>{currentStory.views_count || 0} Penonton</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreButton}>
                    <MoreVertical size={20} color="#FFF" />
                </TouchableOpacity>
            </SafeAreaView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 10,
    right: 10,
    flexDirection: 'row',
    height: 3,
    gap: 5,
    zIndex: 10,
  },
  progressBarBg: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: width,
    height: height,
    backgroundColor: '#000',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 12,
  },
  storyText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 40,
    left: 15,
    right: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  authorName: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  timeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  closeButton: {
    padding: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  viewersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  footerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  moreButton: {
    padding: 10,
  }
});
