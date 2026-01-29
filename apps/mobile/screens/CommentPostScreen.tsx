import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { type CommentPostScreenProps, MAX_LEN } from '../types/commentPostScreenTypes'

export function CommentPostScreen({
  onBack,
  workId,
  workTitle,
  onSubmitted,
  onDone,
}: CommentPostScreenProps) {
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
      await onSubmitted({ workId, body })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenContainer title="コメント" onBack={onBack} scroll>
      <View style={styles.root}>
        <View style={styles.targetBox}>
          <Text style={styles.targetTitle} numberOfLines={2} ellipsizeMode="tail">
            {workTitle}
          </Text>
        </View>

        {done ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneTitle}>送信が完了しました</Text>
            <Text style={styles.doneSub}>
              ご投稿ありがとうございます。{`\n`}
              コメント公開前に管理者側のチェックを挟むため、反映までに時間がかかる場合があります。
            </Text>
            <View style={styles.doneButtons}>
              <PrimaryButton label="作品詳細へ戻る" onPress={onDone} />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>投稿内容</Text>

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
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: THEME.card,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
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
