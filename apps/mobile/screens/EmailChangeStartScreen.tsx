import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, TextField, THEME } from '../components'
import { isValidEmail } from '../utils/validators'

type EmailChangeStartScreenProps = {
  initialEmail?: string
  onBack: () => void
  onSendCode: (email: string) => Promise<string | void>
  onSent: (email: string, initialCode?: string) => void
}

export function EmailChangeStartScreen({ initialEmail = '', onBack, onSendCode, onSent }: EmailChangeStartScreenProps) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canSend = useMemo(() => {
    if (busy) return false
    return isValidEmail(email)
  }, [busy, email])

  return (
    <ScreenContainer title="メールアドレス変更" onBack={onBack} scroll>
      <View style={styles.root}>
        <Text style={styles.desc}>新しいメールアドレスを入力し、認証コードで変更を確定します。</Text>

        {error ? <Text style={styles.bannerError}>{error}</Text> : null}

        <TextField
          label="新しいメールアドレス"
          value={email}
          onChangeText={setEmail}
          placeholder="example@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!busy}
          containerStyle={styles.field}
        />

        <View style={styles.bottom}>
          <PrimaryButton
            label="認証コードを送信"
            disabled={!canSend}
            onPress={async () => {
              setError('')
              if (!isValidEmail(email)) {
                setError('メールアドレスを入力してください')
                return
              }
              setBusy(true)
              try {
                const dbg = await onSendCode(email)
                onSent(email, typeof dbg === 'string' && dbg.trim() ? dbg : undefined)
              } catch (e: any) {
                setError(String(e?.message ?? '送信に失敗しました'))
              } finally {
                setBusy(false)
              }
            }}
          />
          <View style={styles.spacer} />
          <SecondaryButton label="戻る" onPress={onBack} disabled={busy} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
  },
  desc: {
    color: THEME.textMuted,
    fontSize: 12,
    marginBottom: 16,
  },
  field: {
    marginBottom: 0,
  },
  bannerError: {
    fontSize: 12,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.danger,
    backgroundColor: THEME.card,
    borderRadius: 16,
    color: THEME.text,
  },
  bottom: {
    marginTop: 16,
    paddingBottom: 8,
  },
  spacer: {
    height: 12,
  },
})
