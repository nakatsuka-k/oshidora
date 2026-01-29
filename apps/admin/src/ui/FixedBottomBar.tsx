import React from 'react'
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native'

type Props = {
  children: React.ReactNode
  style?: ViewStyle
}

export function FixedBottomBar({ children, style }: Props) {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.bar, style]}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(10px)',
        } as any)
      : null),
  },
})
