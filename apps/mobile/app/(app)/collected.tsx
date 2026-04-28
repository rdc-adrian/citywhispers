// apps/mobile/app/(app)/collected.tsx
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { fetchDiscoveredWhispers } from '../../lib/api';
import type { DiscoveredWhisper } from '@citywhispers/types';

export default function CollectedScreen() {
  const { getToken } = useAuth();

  const { data: whispers, isLoading, error } = useQuery<DiscoveredWhisper[]>({
    queryKey: ['discovered-whispers'],
    queryFn: async () => {
      const token = await getToken();
      return fetchDiscoveredWhispers(token);
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading your collection...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load whispers</Text>
        <Text style={styles.errorSubtext}>{(error as Error).message}</Text>
      </View>
    );
  }

  if (!whispers || whispers.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No whispers yet</Text>
        <Text style={styles.emptySubtext}>
          Explore the map to discover stories
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Collection</Text>
      <Text style={styles.subheader}>{whispers.length} whispers discovered</Text>
      
      <FlatList
        data={whispers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.whisperCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.poiName}>{item.poiName}</Text>
              <Text style={styles.cityName}>{item.cityName}</Text>
            </View>
            <Text style={styles.whisperText} numberOfLines={3}>
              {item.whisperText}
            </Text>
            <Text style={styles.discoveredDate}>
              {new Date(item.discoveredAt).toLocaleDateString()}
            </Text>
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 60,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  subheader: {
    fontSize: 16,
    color: '#999999',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#999999',
  },
  errorText: {
    fontSize: 18,
    color: '#ff6b6b',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999999',
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  whisperCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardHeader: {
    marginBottom: 12,
  },
  poiName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  cityName: {
    fontSize: 14,
    color: '#D4AF37',
  },
  whisperText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#cccccc',
    marginBottom: 12,
  },
  discoveredDate: {
    fontSize: 12,
    color: '#666666',
  },
});
