import React from 'react'
import { View, Text } from 'react-native'

interface Props {
  count: number
}

export function NearbyBadge({ count }: Props) {
  if (count === 0) return null
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(23,22,19,0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignSelf: 'flex-start',
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#c8a96e',
        }}
      />
      <Text style={{ color: '#a09890', fontSize: 11 }}>
        {count} whisper{count !== 1 ? 's' : ''} nearby
      </Text>
    </View>
  )
}
