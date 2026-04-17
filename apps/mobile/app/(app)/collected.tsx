import React from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { StatusBar } from 'expo-status-bar'
import { fetchDiscoveredWhispers, DiscoveredWhisper } from '../../lib/api'

function WhisperListItem({ item }: { item: DiscoveredWhisper }) {
  const date = new Date(item.discoveredAt)
  const label = date.toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
  })

  return (
    <View
      style={{
        backgroundColor: '#171613',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            color: '#e8e4dc',
            fontSize: 16,
            lineHeight: 22,
            flex: 1,
            marginRight: 12,
          }}
          numberOfLines={2}
        >
          {item.poiName}
        </Text>
        <Text style={{ color: '#5c5650', fontSize: 10, marginTop: 2 }}>
          {label}
        </Text>
      </View>
      <Text
        style={{ color: '#a09890', fontSize: 13, lineHeight: 20 }}
        numberOfLines={2}
      >
        {item.whisperText}
      </Text>
    </View>
  )
}

function EmptyState() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 20 }}>📖</Text>
      </View>
      <Text
        style={{
          color: '#a09890',
          fontSize: 18,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        Nothing collected yet
      </Text>
      <Text
        style={{
          color: '#5c5650',
          fontSize: 13,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        Tap a marker on the map to discover your first whisper.
      </Text>
    </View>
  )
}

export default function CollectedScreen() {
  const insets = useSafeAreaInsets()
  const { getToken } = useAuth()

  const { data, isLoading, isError, refetch } = useQuery<DiscoveredWhisper[]>({
    queryKey: ['user', 'discovered'],
    queryFn: async () => {
      const token = await getToken()
      return fetchDiscoveredWhispers({ token: token ?? '' })
    },
  })

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

      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 }}>
        <Text
          style={{
            color: '#c8a96e',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          Your discoveries
        </Text>
        <Text style={{ color: '#e8e4dc', fontSize: 28 }}>
          Collected
        </Text>
        {data && (
          <Text style={{ color: '#5c5650', fontSize: 13, marginTop: 4 }}>
            {data.length} whisper{data.length !== 1 ? 's' : ''} found
          </Text>
        )}
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#c8a96e" />
        </View>
      )}

      {/* Error */}
      {isError && (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 40,
          }}
        >
          <Text
            style={{
              color: '#5c5650',
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            Could not load your collection.
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={{
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#a09890', fontSize: 14 }}>Try again</Text>
          </Pressable>
        </View>
      )}

      {/* List */}
      {!isLoading && !isError && (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.whisperId}
          renderItem={({ item }) => <WhisperListItem item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          ListEmptyComponent={<EmptyState />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}
