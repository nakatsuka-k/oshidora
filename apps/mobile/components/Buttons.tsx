import { Pressable, StyleSheet, Text } from 'react-native'
import { THEME } from './theme'

type ButtonProps = {
  label: string
  onPress?: () => void
  disabled?: boolean
  fullWidth?: boolean
}

export function PrimaryButton({ label, onPress, disabled, fullWidth = true }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primary, fullWidth ? styles.fullWidth : styles.flex, disabled ? styles.disabled : null]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  )
}

export function SecondaryButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondary, disabled ? styles.disabled : null]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  flex: {
    flex: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  primary: {
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  secondary: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
  },
})
