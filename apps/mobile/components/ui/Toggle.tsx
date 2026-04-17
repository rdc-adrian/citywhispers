import React from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'

interface Props {
  value: boolean
  onValueChange: (v: boolean) => void
}

export function Toggle({ value, onValueChange }: Props) {
  const translateX = useSharedValue(value ? 18 : 0)

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  function toggle() {
    const next = !value
    translateX.value = withTiming(next ? 18 : 0, { duration: 180 })
    onValueChange(next)
  }

  return (
    <Pressable onPress={toggle}>
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          borderWidth: 1,
          justifyContent: 'center',
          paddingHorizontal: 2,
          backgroundColor: value ? '#c8a96e' : '#2a2722',
          borderColor: value ? '#c8a96e' : 'rgba(255,255,255,0.1)',
        }}
      >
        <Animated.View
          style={[
            thumbStyle,
            {
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#ffffff',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
            },
          ]}
        />
      </View>
    </Pressable>
  )
}
