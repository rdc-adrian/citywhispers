import React, { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { StatusBar } from 'expo-status-bar'

export default function OnboardingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAllow() {
    setLoading(true)
    setError(null)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setError('Location access is needed to find whispers near you.')
        setLoading(false)
        return
      }
      router.replace('/(app)/map')
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  function handleSkip() {
    router.replace('/(app)/map')
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0f0e0c',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 16,
      }}
    >
      <StatusBar style="light" />

      {/* Wordmark */}
      <Text
        style={{
          color: '#c8a96e',
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 4,
          marginBottom: 48,
        }}
      >
        CityWhispers
      </Text>

      {/* Headline */}
      <Text
        style={{
          color: '#e8e4dc',
          fontSize: 38,
          lineHeight: 46,
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        The city is{'\n'}
        <Text style={{ fontStyle: 'italic', color: '#c8a96e' }}>speaking.</Text>
      </Text>

      {/* Subheading */}
      <Text
        style={{
          color: '#a09890',
          fontSize: 14,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 56,
          maxWidth: 260,
        }}
      >
        Most people don't hear it. Short, quiet stories hidden in the places you pass every day.
      </Text>

      {/* Permission card */}
      <View
        style={{
          width: '100%',
          backgroundColor: '#1f1d19',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: '#5c5650',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          Location access
        </Text>
        <Text style={{ color: '#a09890', fontSize: 13, lineHeight: 20 }}>
          CityWhispers needs your location to reveal nearby stories and hidden histories.
        </Text>
      </View>

      {/* Error message */}
      {error && (
        <Text
          style={{
            color: '#c06060',
            fontSize: 12,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          {error}
        </Text>
      )}

      {/* Allow button */}
      <Pressable
        onPress={handleAllow}
        disabled={loading}
        style={{
          width: '100%',
          backgroundColor: '#c8a96e',
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#1a1610" />
        ) : (
          <Text
            style={{
              color: '#1a1610',
              fontSize: 14,
              fontWeight: '500',
              letterSpacing: 0.5,
            }}
          >
            Allow location access
          </Text>
        )}
      </Pressable>

      {/* Skip */}
      <Pressable onPress={handleSkip}>
        <Text style={{ color: '#5c5650', fontSize: 13, paddingVertical: 8 }}>
          Not now
        </Text>
      </Pressable>
    </View>
  )
}
