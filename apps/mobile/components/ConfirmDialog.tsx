import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, SecondaryButton } from './Buttons'
import { THEME } from './theme'

type DialogAction = {
  label: string
  onPress: () => void
  disabled?: boolean
}

type ConfirmDialogProps = {
  visible: boolean
  title: string
  message: string
  error?: string
  onRequestClose: () => void
  primary: DialogAction
  secondary: DialogAction
}

export function ConfirmDialog({
  visible,
  title,
  message,
  error,
  onRequestClose,
  primary,
  secondary,
}: ConfirmDialogProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onRequestClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onRequestClose}
        {...(Platform.OS === 'web'
          ? ({
              role: 'button',
              'aria-label': 'close dialog',
            } as any)
          : null)}
      >
        <Pressable
          onPress={() => {
            // Prevent backdrop close when tapping inside.
          }}
          style={styles.card}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.buttons}>
            <SecondaryButton label={secondary.label} onPress={secondary.onPress} disabled={secondary.disabled} />
            <View style={styles.spacer} />
            <PrimaryButton
              label={primary.label}
              onPress={primary.onPress}
              disabled={primary.disabled}
              fullWidth={false}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 16,
  },
  title: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  message: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  error: {
    marginTop: 10,
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  spacer: {
    width: 10,
  },
})
