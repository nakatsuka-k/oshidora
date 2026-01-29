import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, TextLink, THEME } from '../components'
import { apiFetch } from '../utils/api'
import { type ContactTypeKey, CONTACT_TYPES, type ContactScreenProps } from '../types/contactTypes'

export function ContactScreen({ apiBaseUrl, displayName, email, onBack, onGoFaq, onDone }: ContactScreenProps) {
  const [typeKey, setTypeKey] = useState<ContactTypeKey>('service')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [typeOpen, setTypeOpen] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const typeLabel = useMemo(() => CONTACT_TYPES.find((t) => t.key === typeKey)?.label ?? '—', [typeKey])

  const isDirty = useMemo(() => subject.trim().length > 0 || body.trim().length > 0, [subject, body])

  const canSubmit = useMemo(() => {
    if (busy) return false
    if (!subject.trim()) return false
    if (!body.trim()) return false
    return true
  }, [body, busy, subject])

  const handleBack = () => {
    if (!isDirty) {
      onBack()
      return
    }
    Alert.alert('確認', '入力内容を破棄して戻りますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '破棄して戻る', style: 'destructive', onPress: onBack },
    ])
  }

  const submit = async () => {
    setError('')
    if (!subject.trim()) {
      setError('件名を入力してください')
      return
    }
    if (!body.trim()) {
      setError('お問い合わせ内容を入力してください')
      return
    }

    setBusy(true)
    try {
      const res = await apiFetch(`${apiBaseUrl}/v1/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: typeKey,
          subject: subject.trim(),
          body: body.trim(),
          displayName: (displayName || '').trim(),
          email: (email || '').trim(),
          sentAt: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setSubject('')
      setBody('')
      Alert.alert('送信しました', 'お問い合わせを受け付けました。', [{ text: 'OK', onPress: onDone }])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenContainer title="お問い合わせ" onBack={handleBack} scroll>
      <View style={styles.root}>
        <View style={styles.topLinkRow}>
          <View style={{ flex: 1 }} />
          <TextLink label="よくある質問" onPress={onGoFaq} />
        </View>

        {error ? (
          <View style={styles.bannerError}>
            <Text style={styles.bannerErrorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>お問い合わせ内容</Text>
        <View style={styles.card}>
          <Text style={styles.label}>お問い合わせ種別</Text>
          <Pressable
            onPress={() => setTypeOpen((v) => !v)}
            style={[styles.selectBox, typeOpen ? styles.selectBoxOpen : null]}
          >
            <Text style={styles.selectText}>{typeLabel}</Text>
            <Text style={styles.selectCaret}>{typeOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {typeOpen ? (
            <View style={styles.selectOptions}>
              {CONTACT_TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    setTypeKey(t.key)
                    setTypeOpen(false)
                  }}
                  style={styles.selectOption}
                >
                  <Text style={styles.selectOptionText}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ height: 12 }} />

          <Text style={styles.label}>件名</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="例：ログインできない"
            placeholderTextColor={THEME.textMuted}
            autoCapitalize="none"
            style={styles.input}
          />

          <View style={{ height: 12 }} />

          <Text style={styles.label}>お問い合わせ内容</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="内容をご記入ください"
            placeholderTextColor={THEME.textMuted}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.textarea]}
          />
        </View>

        <View style={{ height: 18 }} />

        <Text style={styles.sectionTitle}>ユーザー情報（表示のみ）</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>表示名</Text>
            <Text style={styles.infoValue}>{displayName || '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>メールアドレス</Text>
            <Text style={styles.infoValue}>{email || '—'}</Text>
          </View>
        </View>

        <View style={{ height: 18 }} />

        <View style={styles.buttonsRow}>
          <SecondaryButton label="キャンセル" onPress={handleBack} disabled={busy} />
          <View style={{ width: 10 }} />
          <PrimaryButton label={busy ? '送信中...' : '送信'} onPress={() => void submit()} disabled={!canSubmit} fullWidth={false} />
        </View>

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  bannerError: {
    borderWidth: 1,
    borderColor: THEME.danger,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  bannerErrorText: {
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.bg,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
  },
  textarea: {
    minHeight: 140,
  },
  selectBox: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBoxOpen: {
    borderColor: THEME.accent,
  },
  selectText: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    paddingRight: 10,
  },
  selectCaret: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  selectOptions: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  selectOptionText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
    width: 120,
  },
  infoValue: {
    flex: 1,
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: THEME.divider,
    marginVertical: 10,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  busyRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },
})
