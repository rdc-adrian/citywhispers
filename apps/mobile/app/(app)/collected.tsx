// apps/mobile/app/(app)/collected.tsx
import React, { useMemo } from 'react'
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  Pressable,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fetchDiscoveredWhispers } from '../../lib/api'
import { whisperTitle, whisperBody, whisperMeta } from '../../lib/typography'
import { useWhisperStore } from '../../store/useWhisperStore'
import type { DiscoveredWhisper } from '@citywhispers/types'
import type { ActiveWhisper } from '../../store/useWhisperStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derives an ambient time label from the hour a whisper was discovered. */
function ambientTimeLabel(iso: string): string {
  const hour = new Date(iso).getHours()
  if (hour >= 22 || hour < 2)  return 'near midnight'
  if (hour >= 2  && hour < 5)  return 'dead of night'
  if (hour >= 5  && hour < 7)  return 'before dawn'
  if (hour >= 7  && hour < 11) return 'morning light'
  if (hour >= 11 && hour < 14) return 'high noon'
  if (hour >= 14 && hour < 17) return 'afternoon heat'
  if (hour >= 17 && hour < 20) return 'golden hour'
  return 'after dark'
}

/** Human-readable relative date for the discovered timestamp. */
function relativeDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days === 1)  return 'yesterday'
  if (days < 7)   return `${days} days ago`
  if (days < 14)  return 'last week'
  if (days < 30)  return `${Math.floor(days / 7)} weeks ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Builds an ActiveWhisper from a DiscoveredWhisper for Journal replay.
 * category and timeSlot now come from the API directly.
 * personaSlug is not stored on UserWhisperEvent — defaults to ''.
 * isRevisit is always true: everything in the Journal is a second listen.
 */
function toActiveWhisper(item: DiscoveredWhisper): ActiveWhisper {
  return {
    poiId:        item.poiId,
    poiName:      item.poiName,
    category:     item.category,
    whisperId:    item.whisperId,
    whisperText:  item.whisperText,
    audioUrl:     item.audioUrl,
    timeSlot:     item.timeSlot,
    personaSlug:  '',
    ambientLabel: ambientTimeLabel(item.discoveredAt),
    nearby:       [],
    isRevisit:    true,
  }
}

/** Groups a flat whisper list by city name, preserving discovery order. */
function groupByCity(whispers: DiscoveredWhisper[]) {
  const map = new Map<string, DiscoveredWhisper[]>()
  for (const w of whispers) {
    if (!map.has(w.cityName)) map.set(w.cityName, [])
    map.get(w.cityName)!.push(w)
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }))
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CitySection({ title }: { title: string }) {
  return (
    <View style={styles.citySection}>
      <Text style={styles.cityLabel}>{title.toUpperCase()}</Text>
      <View style={styles.cityRule} />
    </View>
  )
}

function WhisperEntry({
  item,
  onPress,
}: {
  item: DiscoveredWhisper
  onPress: (item: DiscoveredWhisper) => void
}) {
  const timeLabel  = ambientTimeLabel(item.discoveredAt)
  const whenFound  = relativeDate(item.discoveredAt)
  const isComplete = item.completedAt !== null

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.entry, pressed && styles.entryPressed]}
    >
      <View style={styles.entryTopRow}>
        <Text style={styles.timeLabel}>{timeLabel}</Text>
        {isComplete && <View style={styles.completedDot} />}
      </View>

      {item.category ? (
        <Text style={styles.categoryLabel}>{item.category}</Text>
      ) : null}

      <Text style={styles.poiName}>{item.poiName}</Text>

      <Text style={styles.whisperExcerpt} numberOfLines={2}>
        {item.whisperText}
      </Text>

      <Text style={styles.dateLabel}>{whenFound}</Text>
    </Pressable>
  )
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CollectedScreen() {
  const { getToken }  = useAuth()
  const insets        = useSafeAreaInsets()
  const { openWhisper } = useWhisperStore()

  const { data: whispers, isLoading, error } = useQuery<DiscoveredWhisper[]>({
    queryKey: ['discovered-whispers'],
    queryFn: async () => {
      const token = await getToken()
      return fetchDiscoveredWhispers(token)
    },
    staleTime: 1000 * 60 * 5,
  })

  const sections = useMemo(
    () => (whispers ? groupByCity(whispers) : []),
    [whispers]
  )

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.stateAmbient}>listening for memories…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.stateError}>the drawer won't open</Text>
        <Text style={styles.stateErrorSub}>{(error as Error).message}</Text>
      </View>
    )
  }

  if (!whispers || whispers.length === 0) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.stateEmpty}>nothing here yet</Text>
        <Text style={styles.stateEmptySub}>
          Step outside.{'\n'}The city has been waiting.
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <WhisperEntry
            item={item}
            onPress={(w) => openWhisper(toActiveWhisper(w))}
          />
        )}
        renderSectionHeader={({ section }) => (
          <CitySection title={section.title} />
        )}
        ListHeaderComponent={
          <View style={styles.screenHeader}>
            <Text style={styles.screenLabel}>collected</Text>
            <Text style={styles.screenCount}>{whispers.length}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  centered: {
    flex: 1,
    backgroundColor: '#0f0e0c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },

  // ── Screen header ──────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 48,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 4,
  },
  screenLabel: {
    ...whisperMeta,
    fontSize: 10,
    color: '#5c5650',
    letterSpacing: 2.5,
  },
  screenCount: {
    ...whisperMeta,
    fontSize: 10,
    color: '#2a2722',
  },

  // ── City section header ────────────────────────────────────────────────────
  citySection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 14,
    gap: 12,
  },
  cityLabel: {
    ...whisperMeta,
    fontSize: 9.5,
    color: '#c8a96e',
    letterSpacing: 2,
  },
  cityRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(200,169,110,0.18)',
  },

  // ── Whisper entry ──────────────────────────────────────────────────────────
  entry: {
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  entryPressed: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeLabel: {
    ...whisperMeta,
    fontSize: 9,
    color: '#5c5650',
  },
  completedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#c8a96e',
    opacity: 0.55,
  },
  categoryLabel: {
    ...whisperMeta,
    fontSize: 9,
    color: '#3d3b38',
    marginBottom: 6,
  },
  poiName: {
    ...whisperTitle,
    fontSize: 22,
    lineHeight: 27,
    color: '#e8e4dc',
    marginBottom: 10,
  },
  whisperExcerpt: {
    ...whisperBody,
    fontSize: 15,
    lineHeight: 25,
    color: 'rgba(160,152,144,0.72)',
    marginBottom: 14,
  },
  dateLabel: {
    ...whisperMeta,
    fontSize: 9,
    color: '#2a2722',
  },

  // ── State screens ──────────────────────────────────────────────────────────
  stateAmbient: {
    ...whisperBody,
    fontSize: 18,
    color: '#2a2722',
    textAlign: 'center',
  },
  stateError: {
    ...whisperTitle,
    fontSize: 22,
    color: '#c06060',
    textAlign: 'center',
    marginBottom: 10,
  },
  stateErrorSub: {
    ...whisperMeta,
    fontSize: 9.5,
    color: '#5c5650',
    textAlign: 'center',
  },
  stateEmpty: {
    ...whisperTitle,
    fontSize: 26,
    color: '#2a2722',
    textAlign: 'center',
    marginBottom: 14,
  },
  stateEmptySub: {
    ...whisperBody,
    fontSize: 16,
    lineHeight: 28,
    color: '#2a2722',
    textAlign: 'center',
  },
})
