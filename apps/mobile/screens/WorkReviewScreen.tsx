import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type WorkReviewScreenProps = {
  onBack: () => void
  work: {
    id: string
    title: string
    subtitle?: string
  }
  initial?: {
    rating?: number | null
    comment?: string | null
  }
  onSubmit: (opts: { contentId: string; rating: number; comment: string }) => Promise<void>
  onDone: () => void
}

const MAX_COMMENT_LEN = 500

function StarRow({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: 5 }).map((_, idx) => {
        const n = idx + 1
        const selected = n <= value
        return (
          <Pressable key={n} onPress={() => onChange(n)} style={[styles.starHit, selected ? styles.starHitSelected : null]}>
            <Text style={[styles.star, selected ? styles.starSelected : null]}>★</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function WorkReviewScreen({ onBack, work, initial, onSubmit, onDone }: WorkReviewScreenProps) {
  const [rating, setRating] = useState<number>(typeof initial?.rating === 'number' ? initial.rating : 0)
  const [comment, setComment] = useState<string>(initial?.comment ? String(initial.comment) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>('')
  const [done, setDone] = useState(false)

  const canSend = rating >= 1 && rating <= 5 && !busy
  const counter = useMemo(() => `${Math.min(comment.length, MAX_COMMENT_LEN)} / ${MAX_COMMENT_LEN}`, [comment.length])

  const submit = useCallback(async () => {
    if (!canSend) return
    setError('')
    setBusy(true)
    try {
      await onSubmit({ contentId: work.id, rating, comment: comment.trim() })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [canSend, comment, onSubmit, rating, work.id])

  return (
    <ScreenContainer title="評価" onBack={onBack} scroll>
      <View style={styles.root}>
        <View style={styles.targetCard}>
          <Text style={styles.targetName} numberOfLines={2} ellipsizeMode="tail">
            {work.title}
          </Text>
          {work.subtitle ? <Text style={styles.targetSub}>{work.subtitle}</Text> : null}
        </View>

        {done ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneTitle}>送信が完了しました</Text>
            <Text style={styles.doneSub}>ご投稿ありがとうございます</Text>
            <View style={styles.doneButtons}>
              <PrimaryButton label="作品詳細へ戻る" onPress={onDone} />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>星評価（必須）</Text>
              <StarRow value={rating} onChange={setRating} />
              <Text style={styles.sectionHint}>{rating > 0 ? `${rating} / 5` : '星を選択してください'}</Text>
            </View>

            <View style={styles.gap} />

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>コメント（任意）</Text>
              <TextInput
                value={comment}
                onChangeText={(v) => setComment(v.slice(0, MAX_COMMENT_LEN))}
                placeholder="感想を書いてください"
                placeholderTextColor={THEME.textMuted}
                multiline
                editable={!busy}
                style={styles.textarea}
                maxLength={MAX_COMMENT_LEN}
              />
              <Text style={styles.counter}>{counter}</Text>
            </View>

            <View style={styles.gap} />

            <View style={styles.buttons}>
              <SecondaryButton label="キャンセル" onPress={onBack} disabled={busy} />
              <View style={styles.spacer} />
              <PrimaryButton label="評価を送信" onPress={submit} disabled={!canSend} fullWidth={false} />
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
    gap: 12,
  },
  targetCard: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    padding: 14,
  },
  targetName: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '900',
  },
  targetSub: {
    marginTop: 6,
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  form: {
    gap: 10,
  },
  error: {
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    padding: 14,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
  },
  sectionHint: {
    marginTop: 8,
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    backgroundColor: THEME.bg,
  },
  starHitSelected: {
    backgroundColor: THEME.card,
  },
  star: {
    color: THEME.textMuted,
    fontSize: 18,
    fontWeight: '900',
  },
  starSelected: {
    color: THEME.text,
  },
  textarea: {
    minHeight: 140,
    padding: 12,
    color: THEME.text,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    borderRadius: 14,
    fontSize: 13,
    fontWeight: '700',
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
  gap: {
    height: 10,
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
    gap: 10,
  },
})
