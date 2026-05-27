// apps/mobile/hooks/useNearbyPois.ts
import { useEffect, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Audio } from 'expo-av';
import { fetchNearbyPois } from '../lib/api';
import type { PoiSummary } from '@citywhispers/types';

interface UseNearbyPoisOptions {
  latitude: number | null;
  longitude: number | null;
  radius?: number;
  limit?: number;
  enabled?: boolean;
}

// How many of the closest POIs to preload audio for.
// Top 3 covers the most likely next whisper without wasting bandwidth.
const PRELOAD_COUNT = 3;

export function useNearbyPois({
  latitude,
  longitude,
  radius = 2000,
  limit = 10,
  enabled = true,
}: UseNearbyPoisOptions) {
  const query = useQuery<PoiSummary[], Error>({
    queryKey: ['pois', 'nearby', latitude, longitude, radius, limit],
    queryFn: async () => {
      if (latitude === null || longitude === null) {
        throw new Error('Location is required');
      }

      // POI lookup is public — no auth token, avoids Clerk JWKS verification on the server
      return await fetchNearbyPois({ lat: latitude, lng: longitude, radius, limit });
    },
    enabled: enabled && latitude !== null && longitude !== null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });

  // ── G-4: Audio preloading ───────────────────────────────────────────────────
  // Pre-load the audio for the top PRELOAD_COUNT closest POIs into memory so
  // there is no buffering pause when the user taps a marker.
  //
  // Strategy: fire-and-forget createAsync with shouldPlay=false. This caches the
  // audio data so expo-av can start playback immediately on tap.
  //
  // Note: we don't gate on WiFi here (expo-network not installed). Preloading
  // 2–3 short MP3s (~1–3 MB total) on mobile data is acceptable; revisit if
  // bandwidth becomes a concern.
  const preloadedRef = useRef<Map<string, Audio.Sound>>(new Map());
  const prevUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!query.data) return;

    const pois = query.data;

    // Top N POIs sorted by distance; filter to those with an audioUrl ready
    const toPreload = pois
      .slice(0, PRELOAD_COUNT)
      .filter((poi): poi is PoiSummary & { audioUrl: string } =>
        typeof poi.audioUrl === 'string' && poi.audioUrl.length > 0
      );

    const newUrls = new Set(toPreload.map((p) => p.audioUrl));

    // Only preload URLs that aren't already cached
    const toAdd = toPreload.filter((p) => !prevUrlsRef.current.has(p.audioUrl));

    // Unload sounds for URLs that are no longer in the nearby set
    const toRemove = [...prevUrlsRef.current].filter((url) => !newUrls.has(url));

    for (const url of toRemove) {
      const sound = preloadedRef.current.get(url);
      if (sound) {
        sound.unloadAsync().catch(() => {});
        preloadedRef.current.delete(url);
      }
    }

    prevUrlsRef.current = newUrls;

    // Preload new sounds — don't play, just buffer into memory
    for (const poi of toAdd) {
      Audio.Sound.createAsync(
        { uri: poi.audioUrl },
        { shouldPlay: false },
        null,
        false
      )
        .then(({ sound }) => {
          preloadedRef.current.set(poi.audioUrl, sound);
        })
        .catch(() => {
          // Non-fatal — preloading is best-effort; playback will load on demand
        });
    }
  }, [query.data]);

  // Unload all preloaded sounds when the hook unmounts (map screen dismounts)
  useEffect(() => {
    return () => {
      for (const sound of preloadedRef.current.values()) {
        sound.unloadAsync().catch(() => {});
      }
      preloadedRef.current.clear();
      prevUrlsRef.current.clear();
    };
  }, []);

  return query;
}
