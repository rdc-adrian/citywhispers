import React from 'react'
import { Tabs } from 'expo-router'
import { View, Text } from 'react-native'

interface TabIconProps {
  label: string
  icon: string
  focused: boolean
}

function TabIcon({ label, icon, focused }: TabIconProps) {
  return (
    <View style={{ alignItems: 'center', gap: 4, paddingTop: 8 }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.35 }}>{icon}</Text>
      <Text
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          color: focused ? '#c8a96e' : '#5c5650',
        }}
      >
        {label}
      </Text>
    </View>
  )
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#171613',
          borderTopColor: 'rgba(255,255,255,0.07)',
          height: 72,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Explore" icon="📍" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="collected"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Collected" icon="📖" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Settings" icon="⚙️" focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}
