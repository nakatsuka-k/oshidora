import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type Props = {
  targetLabel: string
  ownedCoins: number
  onBack: () => void
  onGrant: (amount: number) => Promise<void>
}

const PRESET_AMOUNTS = [10, 30, 50, 100, 300]

function toInt(value: string) {
  const raw = String(value ?? '').replace(/\D/g, '')
  if (!raw) return 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

export function CoinGrantScreen({ targetLabel, ownedCoins, onBack, onGrant }: Props) {
  const [selectedAmount, setSelectedAmount] = useState<number>(0)
  const [customText, setCustomText] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const customAmount = useMemo(() => toInt(customText), [customText])
  const amount = useMemo(() => (customAmount > 0 ? customAmount : selectedAmount), [customAmount, selectedAmount])

  const canSubmit = amount > 0 && amount <= ownedCoins && !busy

  const submit = async () => {
    if (!canSubmit) return
    setError('')
    setBusy(true)
    try {
      await onGrant(amount)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <ScreenContainer title="推しポイント付与" onBack={onBack} scroll>
      <View style={styles.root}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.k}>付与先</Text>
          <Text style={styles.v}>{targetLabel}</Text>

          <View style={styles.hr} />

          <Text style={styles.k}>所持コイン</Text>
          <Text style={styles.v}>{Number.isFinite(ownedCoins) ? ownedCoins : 0}コイン</Text>
        </View>

        <Text style={styles.sectionTitle}>付与するコイン数</Text>

        <View style={styles.presetRow}>
          {PRESET_AMOUNTS.map((a) => {
            const selected = selectedAmount === a && customAmount === 0
            return (
              <Pressable
                key={a}
                onPress={() => {
                  setCustomText('')
                  setSelectedAmount(a)
                }}
                style={[styles.presetChip, selected ? styles.presetChipSelected : null]}
              >
                <Text style={[styles.presetText, selected ? styles.presetTextSelected : null]}>{a}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.inputBox}>
          <Text style={styles.inputLabel}>任意入力</Text>
          <TextInput
            value={customText}
            onChangeText={setCustomText}
            placeholder="例：25"
            placeholderTextColor={THEME.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />
          <Text style={styles.inputHelp}>※ 入力がある場合はこちらが優先されます</Text>
        </View>

        {amount > ownedCoins ? <Text style={styles.warn}>所持コインが不足しています</Text> : null}

        <View style={styles.buttons}>
          <PrimaryButton label="付与する" onPress={submit} disabled={!canSubmit} />
          <View style={styles.gap} />
          <SecondaryButton label="キャンセル" onPress={onBack} disabled={busy} />
        </View>

        {busy ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>処理中…</Text>
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
  error: {
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 14,
    marginBottom: 14,
  },
  k: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  v: {
    marginTop: 6,
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
  },
  hr: {
    height: 1,
    backgroundColor: THEME.divider,
    marginVertical: 12,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  presetChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
  },
  presetChipSelected: {
    borderColor: THEME.accent,
  },
  presetText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  presetTextSelected: {
    color: THEME.accent,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 14,
  },
  inputLabel: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    marginTop: 10,
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.bg,
  },
  inputHelp: {
    marginTop: 8,
    color: THEME.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  warn: {
    marginTop: 10,
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  buttons: {
    marginTop: 14,
  },
  gap: {
    height: 10,
  },
  loading: {
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
})
