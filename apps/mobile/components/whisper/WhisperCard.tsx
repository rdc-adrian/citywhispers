import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useWhisper } from '../../hooks/useWhisper';
import type { PoiSummary } from '@citywhispers/types';

interface WhisperCardProps {
  poi: PoiSummary | null;
  onClose: () => void;
}

export function WhisperCard({ poi, onClose }: WhisperCardProps) {
  const { data: whisper, isLoading, error } = useWhisper({
    poiId: poi?.id ?? null, // Safe access with optional chaining
    enabled: Boolean(poi), // Only fetch if poi exists
  });

  // Early return if no POI selected
  if (!poi) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.poiName}>{poi.name}</Text>
        <Text style={styles.distance}>
          {poi.distance ? `${Math.round(poi.distance)}m away` : ''}
        </Text>
      </View>

      <View style={styles.content}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D4AF37" />
            <Text style={styles.loadingText}>Loading whisper...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              No whisper available for this location yet.
            </Text>
            <Text style={styles.errorSubtext}>
              Check back later as we add more stories.
            </Text>
          </View>
        )}

        {whisper && (
          <View style={styles.whisperContainer}>
            <Text style={styles.whisperText}>{whisper.whisperText}</Text>
            
            {whisper.audioUrl && (
              <View style={styles.audioIndicator}>
                <Text style={styles.audioText}>🎧 Audio available</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    minHeight: 200,
  },
  header: {
    marginBottom: 16,
  },
  poiName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  distance: {
    fontSize: 14,
    color: '#999999',
  },
  content: {
    minHeight: 100,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999999',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  whisperContainer: {
    paddingVertical: 8,
  },
  whisperText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#e0e0e0',
    marginBottom: 16,
  },
  audioIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  audioText: {
    fontSize: 14,
    color: '#D4AF37',
  },
});
