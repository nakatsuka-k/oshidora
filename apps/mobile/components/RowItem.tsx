import { Pressable, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type RowItemProps = {
  title: string
  subtitle?: string
  actionLabel: string
  onAction?: () => void
}

export function RowItem({ title, subtitle, actionLabel, onAction }: RowItemProps) {
  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={onAction} style={styles.action}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
    minHeight: 44,
  },
  left: {
    flex: 1,
  },
  title: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    color: THEME.textMuted,
    fontSize: 12,
  },
  action: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: THEME.card,
  },
  actionText: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '700',
  },
})
