import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { PinInput, PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { digitsOnly } from '../utils/validators'

type Sms2faScreenProps = {
  onBack: () => void
  onComplete: () => void
}

export function Sms2faScreen({ onBack, onComplete }: Sms2faScreenProps) {
  const [phase, setPhase] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(30)

  useEffect(() => {
    if (phase !== 'code') return
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown, phase])

  const phoneDigits = useMemo(() => digitsOnly(phone), [phone])

  const canSend = useMemo(() => phoneDigits.length >= 10 && !busy, [busy, phoneDigits.length])
  const canVerify = useMemo(() => digitsOnly(code).length === 4 && !busy, [busy, code])

  return (
    <ScreenContainer title="二段階認証" onBack={onBack} scroll maxWidth={520}>
      <View style={styles.root}>
        <Text style={styles.desc}>セキュリティ向上のため、SMSによる認証を行います</Text>
        <Text style={styles.desc2}>登録した電話番号に4桁の認証コードを送信します</Text>

        {error ? <Text style={styles.bannerError}>{error}</Text> : null}

        {phase === 'phone' ? (
          <>
            <Text style={styles.label}>電話番号</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="09012345678"
              placeholderTextColor={THEME.textMuted}
              keyboardType="phone-pad"
              style={styles.input}
            />
            <Text style={styles.help}>SMSが受信できる番号を入力してください</Text>

            <View style={styles.bottom}>
              <PrimaryButton
                label="認証コードを送信"
                disabled={!canSend}
                onPress={async () => {
                  setError('')
                  if (phoneDigits.length < 10) {
                    setError('電話番号を入力してください')
                    return
                  }
                  setBusy(true)
                  try {
                    await new Promise((r) => setTimeout(r, 250))
                    setPhase('code')
                    setCooldown(30)
                  } finally {
                    setBusy(false)
                  }
                }}
              />
              <View style={styles.spacer} />
              <SecondaryButton label="戻る" onPress={onBack} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>認証コード</Text>
            <Text style={styles.help2}>SMSで届いた4桁のコードを入力してください</Text>
            <PinInput length={4} value={code} onChange={setCode} error={!!error} />

            <View style={styles.resendRow}>
              {cooldown > 0 ? (
                <Text style={styles.resendDisabled}>認証コードを再送する（{cooldown}秒）</Text>
              ) : (
                <Pressable
                  onPress={async () => {
                    setError('')
                    setBusy(true)
                    try {
                      await new Promise((r) => setTimeout(r, 250))
                      setCooldown(30)
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <Text style={styles.resend}>認証コードを再送する</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.bottom}>
              <PrimaryButton
                label="認証する"
                disabled={!canVerify}
                onPress={async () => {
                  setError('')
                  const v = digitsOnly(code)
                  if (v.length !== 4) {
                    setError('認証コードを入力してください')
                    return
                  }
                  setBusy(true)
                  try {
                    await new Promise((r) => setTimeout(r, 250))
                    if (v === '0000') {
                      setError('認証コードが正しくありません')
                      return
                    }
                    onComplete()
                  } finally {
                    setBusy(false)
                  }
                }}
              />
              <View style={styles.spacer} />
              <SecondaryButton
                label="戻る"
                onPress={() => {
                  setError('')
                  setCode('')
                  setPhase('phone')
                }}
              />
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  desc: {
    color: THEME.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  desc2: {
    color: THEME.textMuted,
    fontSize: 12,
    marginBottom: 16,
  },
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
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
  help: {
    color: THEME.textMuted,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  help2: {
    color: THEME.textMuted,
    fontSize: 12,
    marginBottom: 8,
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
