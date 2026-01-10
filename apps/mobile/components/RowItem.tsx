import { Pressable, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type RowItemProps = {
  title: string
  subtitle?: string
  actionLabel: string
  onAction?: () => void
  actionDisabled?: boolean

  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  secondaryActionDisabled?: boolean
}

export function RowItem({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionDisabled,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled,
}: RowItemProps) {
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

      <View style={styles.actions}>
        {secondaryActionLabel ? (
          <Pressable
            onPress={onSecondaryAction}
            disabled={secondaryActionDisabled}
            style={[styles.action, secondaryActionDisabled ? styles.actionDisabled : null]}
          >
            <Text style={[styles.actionText, secondaryActionDisabled ? styles.actionTextDisabled : null]}>
              {secondaryActionLabel}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onAction}
          disabled={actionDisabled}
          style={[styles.action, actionDisabled ? styles.actionDisabled : null]}
        >
          <Text style={[styles.actionText, actionDisabled ? styles.actionTextDisabled : null]}>{actionLabel}</Text>
        </Pressable>
      </View>
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  actionTextDisabled: {
    color: THEME.textMuted,
  },
})
