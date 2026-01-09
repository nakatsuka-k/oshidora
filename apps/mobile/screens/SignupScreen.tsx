import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Path, Svg } from 'react-native-svg'
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

  const EyeIcon = ({ open }: { open: boolean }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {/* Simple eye / eye-off using strokes */}
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke={THEME.accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={THEME.accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {open ? null : (
        <Path
          d="M4 4l16 16"
          stroke={THEME.accent}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </Svg>
  )

  return (
    <ScreenContainer title="新規登録" onBack={onBack} scroll maxWidth={520}>
      <View style={styles.root}>
        {error ? <Text style={styles.bannerError}>{error}</Text> : null}

        <View style={styles.top}>
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
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="パスワード"
                placeholderTextColor={THEME.textMuted}
                secureTextEntry={!show}
                autoCapitalize="none"
                style={styles.passwordInput}
              />
              <Pressable
                onPress={() => setShow((v) => !v)}
                hitSlop={10}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={show ? 'パスワードを非表示にする' : 'パスワードを表示する'}
              >
                <EyeIcon open={show} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.help}>登録用の認証コードをメールで送信します</Text>
        </View>

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
    justifyContent: 'space-between',
  },
  top: {
    paddingTop: 0,
  },
  bannerError: {
    fontSize: 12,
    marginBottom: 0,
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    color: THEME.text,
    backgroundColor: THEME.card,
  },
  eyeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: {
    color: THEME.textMuted,
    fontSize: 12,
    marginBottom: 16,
  },
  bottom: {
    marginTop: 16,
    paddingBottom: 8,
  },
  spacer: {
    height: 12,
  },
})
