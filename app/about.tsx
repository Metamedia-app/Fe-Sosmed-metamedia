import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { ChevronLeft, ChevronRight, Code, Server, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { getOtherUserProfile } from '@/utils/follow';
import { useRouter, Stack } from 'expo-router';

export default function AboutScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { token } = useAuth();
  const router = useRouter();

  const FOUNDERS_CONFIG = [
    {
      id: '69db3548ff306cded1841212',
      nim: '225520211003',
      fallbackName: 'Fajar Kurnia Putra',
      role: 'Frontend Developer',
      icon: <Code size={24} color={theme.tint} />
    },
    {
      id: '69db3548ff306cded1841211',
      nim: '225520211002',
      fallbackName: 'Tim Backend (1002)',
      role: 'Backend Developer',
      icon: <Server size={24} color={theme.tint} />
    },
    {
      id: '69db3548ff306cded184121b',
      nim: '225520211012',
      fallbackName: 'Tim Backend (1012)',
      role: 'Backend Developer',
      icon: <Server size={24} color={theme.tint} />
    }
  ];

  const [foundersData, setFoundersData] = useState<any[]>(FOUNDERS_CONFIG);

  useEffect(() => {
    if (token) {
      const fetchFounders = async () => {
        try {
          const updatedFounders = await Promise.all(FOUNDERS_CONFIG.map(async (f) => {
            const result = await getOtherUserProfile(f.id, token);
            if (result.success) {
              const userObj = result.data?.user || result.data || result.user || result;
              return {
                ...f,
                name: userObj.nama || userObj.name || f.fallbackName,
                avatar: userObj.avatar_url || null
              };
            }
            return f;
          }));
          setFoundersData(updatedFounders);
        } catch (error) {
          console.error('Failed to fetch founder profiles', error);
        }
      };
      fetchFounders();
    }
  }, [token]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Tentang Aplikasi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        <View style={{ alignItems: 'center', marginBottom: 30, marginTop: 10 }}>
          <Image source={require('@/assets/images/icon.png')} style={{ width: 100, height: 100, marginBottom: 15 }} resizeMode="contain" />
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme.text, letterSpacing: 1 }}>META-U</Text>
          <Text style={{ fontSize: 14, color: theme.description, marginTop: 5 }}>Versi 1.0.0 (Rilis Publik)</Text>
        </View>

        <View style={[styles.storyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Heart size={22} color={theme.brandRed || '#E53935'} style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>Kisah Kami</Text>
          </View>
          <Text style={{ color: theme.text, lineHeight: 24, textAlign: 'justify', fontSize: 15 }}>
            META-U dibangun dengan satu tujuan sederhana: menyatukan seluruh civitas akademika kampus dalam satu wadah digital yang modern dan interaktif. Kami percaya bahwa komunikasi yang baik adalah kunci kesuksesan, dan aplikasi ini adalah wujud nyata karya mahasiswa untuk mahasiswa.
          </Text>
        </View>

        <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 15, marginTop: 10 }}>
          Tim Pendiri (Founders)
        </Text>

        {foundersData.map((founder, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.founderCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => {
              router.push({
                pathname: '/user/[id]',
                params: { id: founder.id, initialName: founder.name || founder.fallbackName, initialNim: founder.nim }
              } as any);
            }}
          >
            <View style={[styles.founderIconContainer, { backgroundColor: theme.primary + '15', overflow: 'hidden' }]}>
              {founder.avatar ? (
                <Image source={{ uri: founder.avatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                founder.icon
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text }}>{founder.name || founder.fallbackName}</Text>
              <Text style={{ fontSize: 13, color: theme.tint, fontWeight: '600', marginBottom: 4 }}>{founder.role}</Text>
              <Text style={{ fontSize: 12, color: theme.description }}>NIM: {founder.nim}</Text>
            </View>
            <ChevronRight size={20} color={theme.border} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  storyCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  founderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  founderIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
});
