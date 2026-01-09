import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { CheckboxRow, PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type CastProfileStatus = 'unregistered' | 'pending' | 'published'

type SocialLink = { label: string; url: string }

type CastProfileDraft = {
  name: string
  affiliation: string
  genres: string[]
  biography: string
  representativeWorks: string
  socialLinks: SocialLink[]
  selfPr: string
}

type StoredCastProfile = {
  status: CastProfileStatus
  approvedAt?: string
  draft: CastProfileDraft
}

type CastProfileRegisterScreenProps = {
  apiBaseUrl: string
  onBack: () => void
}

const STORAGE_KEY = 'cast_profile_me_v1'
const GENRE_OPTIONS = ['女優', '俳優', '脚本', '演出', '制作', 'その他']

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`)
    return
  }
  Alert.alert(title, message)
}

function confirmDiscard(message: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message)
  }
  // native confirm handled by Alert in caller
  return false
}

function emptyDraft(): CastProfileDraft {
  return {
    name: '',
    affiliation: '',
    genres: [],
    biography: '',
    representativeWorks: '',
    socialLinks: [{ label: 'X', url: '' }, { label: 'Instagram', url: '' }],
    selfPr: '',
  }
}

function statusLabel(status: CastProfileStatus): string {
  switch (status) {
    case 'unregistered':
      return '未登録'
    case 'pending':
      return '承認待ち'
    case 'published':
      return '公開中'
  }
}

export function CastProfileRegisterScreen({ apiBaseUrl, onBack }: CastProfileRegisterScreenProps) {
  const [status, setStatus] = useState<CastProfileStatus>('unregistered')
  const [approvedAt, setApprovedAt] = useState<string | undefined>(undefined)
  const [editMode, setEditMode] = useState(true)
  const [busy, setBusy] = useState(false)

  const [draft, setDraft] = useState<CastProfileDraft>(() => emptyDraft())
  const [initialSnapshot, setInitialSnapshot] = useState<string>('')

  const readOnly = useMemo(() => {
    if (status === 'pending') return true
    if (status === 'published') return !editMode
    return false
  }, [editMode, status])

  const hasChanges = useMemo(() => {
    return JSON.stringify(draft) !== initialSnapshot
  }, [draft, initialSnapshot])

  const load = useCallback(async () => {
    try {
      // TODO: Replace with server source of truth (GET /api/cast-profiles/me)
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setStatus('unregistered')
        setApprovedAt(undefined)
        setEditMode(true)
        setDraft(emptyDraft())
        setInitialSnapshot(JSON.stringify(emptyDraft()))
        return
      }
      const stored = JSON.parse(raw) as StoredCastProfile
      const nextDraft = stored?.draft || emptyDraft()
      setStatus(stored?.status || 'unregistered')
      setApprovedAt(stored?.approvedAt)
      setDraft(nextDraft)
      setInitialSnapshot(JSON.stringify(nextDraft))
      setEditMode(stored?.status !== 'pending')
    } catch {
      setStatus('unregistered')
      setApprovedAt(undefined)
      const d = emptyDraft()
      setDraft(d)
      setInitialSnapshot(JSON.stringify(d))
      setEditMode(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleGenre = useCallback(
    (g: string) => {
      setDraft((prev) => {
        const has = prev.genres.includes(g)
        const next = has ? prev.genres.filter((x) => x !== g) : [...prev.genres, g]
        return { ...prev, genres: next }
      })
    },
    [setDraft]
  )

  const setSocialLink = useCallback((index: number, patch: Partial<SocialLink>) => {
    setDraft((prev) => {
      const next = [...prev.socialLinks]
      const cur = next[index] || { label: '', url: '' }
      next[index] = { ...cur, ...patch }
      return { ...prev, socialLinks: next }
    })
  }, [])

  const addSocialLink = useCallback(() => {
    setDraft((prev) => ({ ...prev, socialLinks: [...prev.socialLinks, { label: '', url: '' }] }))
  }, [])

  const removeSocialLink = useCallback((index: number) => {
    setDraft((prev) => {
      const next = prev.socialLinks.filter((_, i) => i !== index)
      return { ...prev, socialLinks: next.length ? next : [{ label: '', url: '' }] }
    })
  }, [])

  const handleBack = useCallback(() => {
    if (!readOnly && hasChanges) {
      if (Platform.OS === 'web') {
        const ok = confirmDiscard('編集内容を保存せずに戻りますか？')
        if (ok) onBack()
        return
      }
      Alert.alert('確認', '編集内容を保存せずに戻りますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '戻る', style: 'destructive', onPress: onBack },
      ])
      return
    }
    onBack()
  }, [hasChanges, onBack, readOnly])

  const validate = useCallback((): string | null => {
    if (!draft.name.trim()) return '必須項目を入力してください'
    if (draft.name.trim().length > 50) return '氏名は50文字以内で入力してください'
    if (draft.selfPr.length > 500) return '自己PR文は500文字以内で入力してください'
    return null
  }, [draft.name, draft.selfPr.length])

  const save = useCallback(async () => {
    const err = validate()
    if (err) {
      showAlert('エラー', err)
      return
    }

    setBusy(true)
    try {
      // TODO: Replace with API call (POST /api/cast-profiles)
      // apiBaseUrl is currently unused; keep for future server wiring.
      void apiBaseUrl

      const nextStatus: CastProfileStatus = status === 'published' ? 'pending' : 'pending'
      const next: StoredCastProfile = {
        status: nextStatus,
        approvedAt,
        draft: {
          ...draft,
          name: draft.name.trim(),
          affiliation: draft.affiliation.trim(),
        },
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setStatus(nextStatus)
      setEditMode(false)
      setInitialSnapshot(JSON.stringify(next.draft))
      showAlert('送信完了', status === 'published' ? '更新申請を送信しました（承認待ち）' : '登録内容を送信しました（承認待ち）')
    } catch {
      showAlert('エラー', 'キャストプロフィールの登録に失敗しました。時間をおいて再度お試しください')
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, approvedAt, draft, status, validate])

  const headerRight = useMemo(() => {
    if (status === 'pending') return null
    if (status === 'published' && !editMode) {
      return <SecondaryButton label="編集" onPress={() => setEditMode(true)} disabled={busy} />
    }
    return <PrimaryButton label="保存" onPress={save} disabled={busy || readOnly || !hasChanges} fullWidth={false} />
  }, [busy, editMode, hasChanges, readOnly, save, status])

  return (
    <ScreenContainer scroll maxWidth={520}>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleBack} disabled={busy} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>キャストプロフィール登録</Text>
          <View style={styles.headerRight}>{headerRight}</View>
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>登録ステータス</Text>
          <Text style={styles.statusValue}>{statusLabel(status)}</Text>
          {status === 'pending' ? (
            <Text style={styles.statusNote}>承認中です。結果はメールで通知されます。</Text>
          ) : null}
          {status === 'published' && approvedAt ? (
            <Text style={styles.statusNote}>承認日時: {approvedAt}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本情報</Text>

          <View style={styles.field}>
            <Text style={styles.label}>氏名（本名・芸名）</Text>
            <TextInput
              value={draft.name}
              onChangeText={(v) => setDraft((p) => ({ ...p, name: v }))}
              placeholder="氏名"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              maxLength={50}
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
            />
            <Text style={styles.count}>{draft.name.length}/50</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>所属</Text>
            <TextInput
              value={draft.affiliation}
              onChangeText={(v) => setDraft((p) => ({ ...p, affiliation: v }))}
              placeholder="フリーランス / 事務所名"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>ジャンル（複数選択）</Text>
            <View style={styles.checkboxGroup}>
              {GENRE_OPTIONS.map((g) => (
                <CheckboxRow
                  key={g}
                  checked={draft.genres.includes(g)}
                  onToggle={() => {
                    if (readOnly || busy) return
                    toggleGenre(g)
                  }}
                >
                  <Text style={styles.checkboxText}>{g}</Text>
                </CheckboxRow>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>経歴</Text>
            <TextInput
              value={draft.biography}
              onChangeText={(v) => setDraft((p) => ({ ...p, biography: v }))}
              placeholder="学歴・職歴など"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              multiline
              style={[styles.textarea, readOnly || busy ? styles.inputDisabled : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>代表作</Text>
            <TextInput
              value={draft.representativeWorks}
              onChangeText={(v) => setDraft((p) => ({ ...p, representativeWorks: v }))}
              placeholder="作品名を改行で入力"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              multiline
              style={[styles.textarea, readOnly || busy ? styles.inputDisabled : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>SNSリンク</Text>
            {draft.socialLinks.map((it, idx) => (
              <View key={`${idx}-${it.label}`} style={styles.socialRow}>
                <TextInput
                  value={it.label}
                  onChangeText={(v) => setSocialLink(idx, { label: v })}
                  placeholder="種別（X/Instagram等）"
                  placeholderTextColor={THEME.textMuted}
                  editable={!readOnly && !busy}
                  style={[styles.socialLabel, readOnly || busy ? styles.inputDisabled : null]}
                />
                <View style={styles.socialGap} />
                <TextInput
                  value={it.url}
                  onChangeText={(v) => setSocialLink(idx, { url: v })}
                  placeholder="https://..."
                  placeholderTextColor={THEME.textMuted}
                  autoCapitalize="none"
                  editable={!readOnly && !busy}
                  style={[styles.socialUrl, readOnly || busy ? styles.inputDisabled : null]}
                />
                {!readOnly && !busy ? (
                  <Pressable onPress={() => removeSocialLink(idx)} style={styles.socialRemove} accessibilityRole="button">
                    <Text style={styles.socialRemoveText}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {!readOnly && !busy ? (
              <Pressable onPress={addSocialLink} style={styles.addRow} accessibilityRole="button">
                <Text style={styles.addRowText}>+ 行を追加</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>自己PR文</Text>
            <TextInput
              value={draft.selfPr}
              onChangeText={(v) => setDraft((p) => ({ ...p, selfPr: v }))}
              placeholder="人物紹介・アピール文"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              multiline
              style={[styles.textarea, readOnly || busy ? styles.inputDisabled : null]}
            />
            <Text style={styles.count}>{draft.selfPr.length}/500</Text>
          </View>

          {status === 'pending' ? (
            <View style={styles.bottomActions}>
              <SecondaryButton label="戻る" onPress={handleBack} disabled={busy} />
            </View>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 20,
    backgroundColor: THEME.card,
  },
  backText: {
    color: THEME.text,
    fontSize: 20,
    lineHeight: 20,
  },
  headerTitle: {
    flex: 1,
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  headerRight: {
    width: 90,
    alignItems: 'flex-end',
  },
  statusBox: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 14,
    marginBottom: 16,
  },
  statusTitle: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusValue: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  statusNote: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 13,
  },
  textarea: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 13,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    opacity: 0.6,
  },
  count: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 10,
    textAlign: 'right',
  },
  checkboxGroup: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: THEME.card,
  },
  checkboxText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  socialLabel: {
    width: 130,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 12,
  },
  socialGap: {
    width: 8,
  },
  socialUrl: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 12,
  },
  socialRemove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    backgroundColor: THEME.card,
  },
  socialRemoveText: {
    color: THEME.textMuted,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '800',
  },
  addRow: {
    marginTop: 8,
    paddingVertical: 10,
  },
  addRowText: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  bottomActions: {
    marginTop: 16,
  },
})
