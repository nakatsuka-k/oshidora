import { useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { isValidEmail } from '../utils/validators'

type SignupScreenProps = {
  initialEmail?: string
  onSendCode: (email: string, password: string) => Promise<void>
  onLogin: () => void
  onBack: () => void
}

export function SignupScreen({ initialEmail, onSendCode, onLogin, onBack }: SignupScreenProps) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canSend = useMemo(() => isValidEmail(email) && password.trim().length > 0 && !busy, [busy, email, password])

  return (
    <ScreenContainer title="新規登録" onBack={onBack} scroll>
      <View style={styles.root}>
        {error ? <Text style={styles.bannerError}>{error}</Text> : null}

        <View style={styles.field}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="メールアドレス"
            placeholderTextColor={THEME.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="パスワード"
            placeholderTextColor={THEME.textMuted}
            secureTextEntry={!show}
            autoCapitalize="none"
            style={styles.input}
          />
          <View style={styles.toggleRow}>
            <SecondaryButton label={show ? '非表示' : '表示'} onPress={() => setShow((v) => !v)} />
          </View>
        </View>

        <Text style={styles.help}>登録用の認証コードをメールで送信します</Text>

        <View style={styles.bottom}>
          <PrimaryButton
            label="認証コードを送信"
            disabled={!canSend}
            onPress={async () => {
              setError('')
              const e = email.trim()
              if (!isValidEmail(e)) {
                setError('メールアドレスの形式が正しくありません')
                return
              }
              if (!password.trim()) {
                setError('パスワードを入力してください')
                return
              }
              setBusy(true)
              try {
                await onSendCode(e, password)
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              } finally {
                setBusy(false)
              }
            }}
          />
          <View style={styles.spacer} />
          <SecondaryButton label="すでにアカウントをお持ちの方（ログイン）" onPress={onLogin} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  field: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    color: THEME.text,
    backgroundColor: THEME.card,
  },
  toggleRow: {
    marginTop: 8,
    width: 160,
  },
  help: {
    color: THEME.textMuted,
    fontSize: 12,
    marginBottom: 16,
  },
  bottom: {
    marginTop: 8,
    paddingBottom: 8,
  },
  spacer: {
    height: 12,
  },
})
