import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type Props = {
  apiBaseUrl: string
  authToken: string
  initialEmail: string
  onBack: () => void
  onDone: () => void
}

export function WithdrawalRequestScreen({ apiBaseUrl, authToken, initialEmail, onBack, onDone }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const [email] = useState<string>((initialEmail || '').trim())
  const [reason, setReason] = useState('')

  const canSubmit = useMemo(() => {
    if (busy) return false
    if (!authToken.trim()) return false
    if (reason.trim().length > 500) return false
    return true
  }, [authToken, busy, reason])

  const submit = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/v1/withdrawal-requests`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email, reason: reason.trim() }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg ? `HTTP ${res.status}: ${msg}` : `HTTP ${res.status}`)
      }
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, authToken, email, reason])

  return (
    <ScreenContainer title="退会申請" onBack={onBack} maxWidth={828}>
      <View style={styles.root}>
        {done ? (
          <View style={styles.card}>
            <Text style={styles.title}>申請を受け付けました</Text>
            <Text style={styles.note}>
              退会はこの時点では完了しません。{`\n`}
              管理者の確認後に手続きが進みます。
            </Text>
            <View style={{ height: 12 }} />
            <PrimaryButton label="戻る" onPress={onDone} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.note}>
                退会をご希望の場合は、こちらから申請してください。{`\n`}
                ※ 申請を送信しても、この時点では退会は完了しません。
              </Text>

              <View style={{ height: 14 }} />

              <Text style={styles.label}>連絡先メールアドレス</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyText}>{email || '—'}</Text>
              </View>

              <View style={{ height: 12 }} />

              <Text style={styles.label}>理由（任意）</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="例：利用頻度が減ったため"
                placeholderTextColor={THEME.textMuted}
                style={styles.textArea}
                multiline
              />
              <Text style={styles.count}>{Math.min(500, reason.length)}/500</Text>

              {error ? <Text style={styles.error}>申請に失敗しました: {error}</Text> : null}

              <View style={styles.buttons}>
                <SecondaryButton label="キャンセル" onPress={onBack} disabled={busy} />
                <View style={styles.spacer} />
                {busy ? (
                  <View style={styles.busyBtn}>
                    <ActivityIndicator />
                  </View>
                ) : (
                  <PrimaryButton label="申請を送信" onPress={submit} disabled={!canSubmit} fullWidth={false} />
                )}
              </View>
            </View>

            <Text style={styles.hint}>
              送信後の対応は管理者の確認後となります。{`\n`}
              急ぎの場合はお問い合わせをご利用ください。
            </Text>
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
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 16,
  },
  title: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  note: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  readonlyField: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readonlyText: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
  },
  textArea: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
    minHeight: 110,
    textAlignVertical: 'top',
  },
  count: {
    marginTop: 6,
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
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
  busyBtn: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
})
