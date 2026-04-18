import { PostCard, PostData } from '@/components/PostCard';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPostById } from '@/utils/post';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PostDetailScreen() {
  const { id, autoOpenComments, targetCommentId } = useLocalSearchParams<{ 
    id: string; 
    autoOpenComments?: string;
    targetCommentId?: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { token } = useAuth();

  const [post, setPost] = useState<PostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!id || !token) return;
      setIsLoading(true);
      const result = await getPostById(id, token);
      if (result.success && result.data?.post) {
        setPost(result.data.post);
      } else {
        setError(result.message || 'Gagal mengambil detail postingan');
      }
      setIsLoading(false);
    };

    fetchPost();
  }, [id, token]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Postingan',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
              <ChevronLeft size={28} color={theme.text} />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={[styles.errorText, { color: theme.description }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryBtn, { backgroundColor: theme.tint }]}
            onPress={() => router.back()}
          >
            <Text style={styles.retryText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      ) : post ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <PostCard 
            post={post} 
            onDeleteSuccess={() => router.back()}
            initialShowComments={autoOpenComments === 'true'}
            targetCommentId={targetCommentId}
          />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 10,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
