// apps/mobile/app/(app)/settings.tsx
import React from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { Toggle } from '../../components/ui/Toggle'
import { fetchUserPreferences, patchUserPreferences } from '../../lib/api'
import type { UserPreferences } from '@citywhispers/types'

const DEFAULT_PREFS: UserPreferences = {
  autoplay: false,
  radiusMeters: 500,
  showVisited: true,
  darkMode: true,
  language: 'English',
  notifications: false,
}

interface RowProps {
  label: string
  sublabel?: string
  right?: React.ReactNode
}

function SettingsRow({ label, sublabel, right }: RowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={{ color: '#e8e4dc', fontSize: 15 }}>{label}</Text>
        {sublabel ? (
          <Text style={{ color: '#5c5650', fontSize: 12, marginTop: 2 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        color: '#5c5650',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 2,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 8,
      }}
    >
      {label}
    </Text>
  )
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const { signOut, getToken } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()

  const { data: rawPrefs, isLoading } = useQuery<UserPreferences>({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const token = await getToken()
      return fetchUserPreferences(token)
    },
    staleTime: 1000 * 60 * 5,
  })

  // Always safe — never null or undefined
  const prefs: UserPreferences = rawPrefs ?? DEFAULT_PREFS

  const { mutate: savePrefs } = useMutation({
    mutationFn: async (next: Partial<UserPreferences>) => {
      const token = await getToken()
      return patchUserPreferences(next, token)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['user-preferences'], updated)
    },
    onError: (err) => {
      console.error('[Settings] Failed to save preference:', err)
      Alert.alert('Error', 'Could not save your preference. Please try again.')
    },
  })

  function updatePref<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) {
    // Optimistic update so toggle feels instant
    queryClient.setQueryData(
      ['user-preferences'],
      (prev: UserPreferences | undefined) => ({
        ...(prev ?? DEFAULT_PREFS),
        [key]: value,
      })
    )
    savePrefs({ [key]: value })
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }

  const initials =
    user?.firstName?.[0] ??
    user?.emailAddresses?.[0]?.emailAddress?.[0] ??
    'W'
  const displayName = user?.firstName ?? 'Wanderer'
  const email = user?.emailAddresses?.[0]?.emailAddress ?? ''

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0f0e0c',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#c8a96e" />
      </View>
    )
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0f0e0c',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
          <Text
            style={{
              color: '#c8a96e',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 4,
            }}
          >
            Preferences
          </Text>
          <Text style={{ color: '#e8e4dc', fontSize: 28 }}>Settings</Text>
        </View>

        {/* Profile */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            paddingHorizontal: 24,
            paddingVertical: 20,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#1f1d19',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#c8a96e', fontSize: 22 }}>
              {initials.toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={{ color: '#e8e4dc', fontSize: 20 }}>
              {displayName}
            </Text>
            {email ? (
              <Text style={{ color: '#5c5650', fontSize: 12, marginTop: 2 }}>
                {email}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Playback */}
        <SectionLabel label="Playback" />
        <View
          style={{
            backgroundColor: '#171613',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <SettingsRow
            label="Autoplay audio"
            sublabel="Play whisper when card opens"
            right={
              <Toggle
                value={prefs.autoplay}
                onValueChange={(v) => updatePref('autoplay', v)}
              />
            }
          />
        </View>

        {/* Discovery */}
        <SectionLabel label="Discovery" />
        <View
          style={{
            backgroundColor: '#171613',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <SettingsRow
            label="Nearby radius"
            sublabel="How far to surface whispers"
            right={
              <Text style={{ color: '#5c5650', fontSize: 14 }}>
                {prefs.radiusMeters} m ›
              </Text>
            }
          />
          <SettingsRow
            label="Show visited markers"
            right={
              <Toggle
                value={prefs.showVisited}
                onValueChange={(v) => updatePref('showVisited', v)}
              />
            }
          />
        </View>

        {/* App */}
        <SectionLabel label="App" />
        <View
          style={{
            backgroundColor: '#171613',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <SettingsRow
            label="Dark mode"
            right={
              <Toggle
                value={prefs.darkMode}
                onValueChange={(v) => updatePref('darkMode', v)}
              />
            }
          />
          <SettingsRow
            label="Language"
            right={
              <Text style={{ color: '#5c5650', fontSize: 14 }}>
                {prefs.language} ›
              </Text>
            }
          />
          <SettingsRow
            label="Notifications"
            right={
              <Toggle
                value={prefs.notifications}
                onValueChange={(v) => updatePref('notifications', v)}
              />
            }
          />
        </View>

        {/* Sign out */}
        <Pressable
          onPress={handleSignOut}
          style={{
            marginHorizontal: 24,
            marginTop: 32,
            paddingVertical: 16,
            backgroundColor: '#171613',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#c06060', fontSize: 14 }}>Sign out</Text>
        </Pressable>

        <Text
          style={{
            color: '#2a2722',
            fontSize: 11,
            textAlign: 'center',
            paddingVertical: 20,
          }}
        >
          CityWhispers · v0.1.0 MVP
        </Text>
      </ScrollView>
    </View>
  )
}
