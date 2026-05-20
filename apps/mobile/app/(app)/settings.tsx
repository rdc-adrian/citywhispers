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
  const { signOut, getToken, isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()

  const {
    data: rawPrefs,
    isLoading,
    isError,
    error,
  } = useQuery<UserPreferences>({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      console.log('[Settings] ── queryFn START ──')
      const token = await getToken()
      console.log('[Settings] Token:', token ? `obtained (${token.slice(0, 20)}...)` : 'NULL')
      const result = await fetchUserPreferences(token)
      console.log('[Settings] fetchUserPreferences SUCCESS:', JSON.stringify(result))
      return result
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
    // Only run once Clerk has confirmed the user is loaded and signed in
    enabled: isLoaded && isSignedIn === true,
  })

  const prefs: UserPreferences = rawPrefs ?? DEFAULT_PREFS

  const { mutate: savePrefs, isPending: isSaving } = useMutation({
    mutationFn: async (next: Partial<UserPreferences>) => {
      console.log('[Settings] PATCH payload:', JSON.stringify(next))

      // Retry token fetch up to 3 times — Clerk can occasionally
      // return null briefly even when the user is signed in
      let token: string | null = null
      for (let i = 0; i < 3; i++) {
        token = await getToken()
        if (token) break
        console.warn(`[Settings] Token null on attempt ${i + 1}, retrying...`)
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      if (!token) {
        console.error('[Settings] Token still null after retries — aborting PATCH')
        throw new Error('Not authenticated')
      }

      console.log('[Settings] PATCH token obtained, firing request...')
      const result = await patchUserPreferences(next, token)
      console.log('[Settings] PATCH response:', JSON.stringify(result))
      return result
    },
    onSuccess: (updated) => {
      console.log('[Settings] PATCH success — cache updated')
      queryClient.setQueryData(['user-preferences'], updated)
    },
    onError: (err) => {
      console.error('[Settings] PATCH failed:', err)
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

  // ── Clerk not ready or query in flight ──
  if (!isLoaded || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0f0e0c',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <ActivityIndicator color="#c8a96e" />
        <Text style={{ color: '#5c5650', fontSize: 12 }}>
          {!isLoaded ? 'Authenticating...' : 'Loading preferences...'}
        </Text>
      </View>
    )
  }

  // ── Error state ──
  if (isError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0f0e0c',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 12,
        }}
      >
        <Text style={{ color: '#c06060', fontSize: 15 }}>
          Failed to load preferences
        </Text>
        <Text style={{ color: '#5c5650', fontSize: 12, textAlign: 'center' }}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
        <Pressable
          onPress={() =>
            queryClient.invalidateQueries({ queryKey: ['user-preferences'] })
          }
          style={{
            marginTop: 8,
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: '#171613',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: 12,
          }}
        >
          <Text style={{ color: '#c8a96e', fontSize: 14 }}>Retry</Text>
        </Pressable>
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

        {/* Dev debug strip — remove before Sprint B */}
        {__DEV__ && (
          <View
            style={{
              marginHorizontal: 24,
              marginBottom: 8,
              padding: 12,
              backgroundColor: '#1f1d19',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'rgba(200,169,110,0.2)',
            }}
          >
            <Text style={{ color: '#c8a96e', fontSize: 10, marginBottom: 4 }}>
              DEBUG — remove before Sprint B
            </Text>
            <Text style={{ color: '#5c5650', fontSize: 10 }}>
              source: {rawPrefs ? 'server' : 'default fallback'}
            </Text>
            <Text style={{ color: '#5c5650', fontSize: 10 }}>
              saving: {isSaving ? 'yes' : 'no'}
            </Text>
            <Text style={{ color: '#5c5650', fontSize: 10 }}>
              prefs: {JSON.stringify(prefs)}
            </Text>
          </View>
        )}

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

        {__DEV__ && (
  <Pressable
    onPress={async () => {
      console.log('[TokenTest] isLoaded:', isLoaded, '| isSignedIn:', isSignedIn)
      const t1 = await getToken()
      console.log('[TokenTest] getToken():', t1 ? t1.slice(0, 30) : 'NULL')
      const t2 = await getToken({ template: 'default' })
      console.log('[TokenTest] getToken({ template: default }):', t2 ? t2.slice(0, 30) : 'NULL')
    }}
    style={{
      marginHorizontal: 24,
      marginTop: 8,
      paddingVertical: 12,
      backgroundColor: '#1f1d19',
      borderRadius: 12,
      alignItems: 'center',
    }}
  >
    <Text style={{ color: '#c8a96e', fontSize: 12 }}>DEV: Test token</Text>
  </Pressable>
)}
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
