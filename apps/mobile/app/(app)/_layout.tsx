// apps/mobile/app/(app)/_layout.tsx
import React, { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { View, Text } from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useWhisperStore } from '../../store/useWhisperStore'
import { fetchDiscoveredWhispers } from '../../lib/api'
import { MapOverlay } from '../../components/map/MapOverlay'
import { WhisperCard } from '../../components/whisper/WhisperCard'

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
  )
}

export default function AppLayout() {
  const { getToken } = useAuth()
  const hydrateDiscovered = useWhisperStore(s => s.hydrateDiscovered)

  useEffect(() => {
    const hydrate = async () => {
      try {
        const token = await getToken()
        if (!token) return
        const whispers = await fetchDiscoveredWhispers(token)
        hydrateDiscovered(whispers)
      } catch {
        // Silent failure — store stays empty, markers stay full opacity
        // Discovery state will self-correct on next launch
      }
    }

    hydrate()
  }, [])

  return (
    // View wrapper lets MapOverlay and WhisperCard overlay all tabs, not just map.
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0f0e0c',
            borderTopColor: 'rgba(255,255,255,0.08)',
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: '#c8a96e',
          tabBarInactiveTintColor: '#5c5650',
          tabBarLabelStyle: {
            fontSize: 10,
            letterSpacing: 1,
            textTransform: 'uppercase',
          },
        }}
      >
        <Tabs.Screen
          name="map"
          options={{
            title: 'Explore',
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="🗺" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="collected"
          options={{
            title: 'Collected',
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="✦" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="⚙" focused={focused} />
            ),
          }}
        />
      </Tabs>

      {/* Global overlays — sit above all tabs, including the tab bar */}
      <MapOverlay />
      <WhisperCard />
    </View>
  )
}
