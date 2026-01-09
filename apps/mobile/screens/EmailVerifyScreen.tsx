import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PinInput, PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { digitsOnly } from '../utils/validators'

type EmailVerifyScreenProps = {
  email: string
  onResend: () => Promise<void>
  onVerify: (code: string) => Promise<void>
  onBack: () => void
  initialCode?: string
}

export function EmailVerifyScreen({ email, onResend, onVerify, onBack, initialCode }: EmailVerifyScreenProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(30)

  useEffect(() => {
    setCooldown(30)
    if (initialCode) setCode(initialCode)
  }, [email, initialCode])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const canVerify = useMemo(() => digitsOnly(code).length === 6 && !busy, [busy, code])

  return (
    <ScreenContainer title="メール認証" onBack={onBack} scroll maxWidth={520}>
      <View style={styles.root}>
        <View style={styles.top}>
          <Text style={styles.desc}>入力したメールアドレスに認証コードを送信しました</Text>
          <Text style={styles.email}>{email}</Text>

          {error ? <Text style={styles.bannerError}>{error}</Text> : null}

          <PinInput length={6} value={code} onChange={setCode} error={!!error} />

          <View style={styles.resendRow}>
            {cooldown > 0 ? (
              <Text style={styles.resendDisabled}>認証コードを再送する（{cooldown}秒）</Text>
            ) : (
              <Pressable
                onPress={async () => {
                  setError('')
                  setBusy(true)
                  try {
                    await onResend()
                    setCooldown(30)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Text style={styles.resend}>認証コードを再送する</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.bottom}>
          <PrimaryButton
            label="認証する"
            disabled={!canVerify}
            onPress={async () => {
              setError('')
              const v = digitsOnly(code)
              if (v.length !== 6) {
                setError('認証コードを入力してください')
                return
              }
              setBusy(true)
              try {
                await onVerify(v)
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              } finally {
                setBusy(false)
              }
            }}
          />
          <View style={styles.spacer} />
          <SecondaryButton label="戻る" onPress={onBack} />
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
  desc: {
    color: THEME.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  email: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 16,
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
  resendRow: {
    marginTop: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  resend: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  resendDisabled: {
    color: THEME.textMuted,
    fontSize: 12,
  },
  bottom: {
    marginTop: 8,
    paddingBottom: 8,
  },
  spacer: {
    height: 12,
  },
})
