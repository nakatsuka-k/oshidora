import { useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type CommentPostScreenProps = {
  onBack: () => void
  contentId: string
  contentTitle: string
  onSubmitted: (opts: { contentId: string; body: string }) => Promise<void>
  onDone: () => void
}

const MAX_LEN = 500

export function CommentPostScreen({ onBack, contentId, contentTitle, onSubmitted, onDone }: CommentPostScreenProps) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>('')
  const [done, setDone] = useState(false)

  const length = body.length
  const canSend = length > 0 && length <= MAX_LEN && !busy

  const counter = useMemo(() => `${Math.min(length, MAX_LEN)} / ${MAX_LEN}`, [length])

  const submit = async () => {
    if (!canSend) return
    setError('')
    setBusy(true)
    try {
      await onSubmitted({ contentId, body })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenContainer title="コメント" onBack={onBack} scroll maxWidth={520}>
      <View style={styles.root}>
        <View style={styles.targetBox}>
          <Text style={styles.targetTitle} numberOfLines={2} ellipsizeMode="tail">
            {contentTitle}
          </Text>
        </View>

        {done ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneTitle}>送信が完了しました</Text>
            <Text style={styles.doneSub}>ご投稿ありがとうございます</Text>
            <View style={styles.doneButtons}>
              <PrimaryButton label="動画詳細へ戻る" onPress={onDone} />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.textareaWrap}>
              <TextInput
                value={body}
                onChangeText={(v) => setBody(v.slice(0, MAX_LEN))}
                placeholder="コメントを書く"
                placeholderTextColor={THEME.textMuted}
                multiline
                style={styles.textarea}
                editable={!busy}
                maxLength={MAX_LEN}
              />
              <Text style={styles.counter}>{counter}</Text>
            </View>

            <View style={styles.buttons}>
              <SecondaryButton label="キャンセル" onPress={onBack} disabled={busy} />
              <View style={styles.spacer} />
              <PrimaryButton label="送信" onPress={submit} disabled={!canSend} fullWidth={false} />
            </View>

            {busy ? (
              <View style={styles.loading}>
                <ActivityIndicator />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  targetBox: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  targetTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  form: {
    flex: 1,
  },
  error: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  textareaWrap: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    padding: 12,
  },
  textarea: {
    minHeight: 160,
    color: THEME.text,
    fontSize: 13,
    lineHeight: 19,
    textAlignVertical: 'top',
  },
  counter: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  buttons: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    width: 10,
  },
  loading: {
    marginTop: 12,
    alignItems: 'center',
  },
  doneBox: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    padding: 16,
  },
  doneTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  doneSub: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  doneButtons: {
    marginTop: 14,
  },
})
