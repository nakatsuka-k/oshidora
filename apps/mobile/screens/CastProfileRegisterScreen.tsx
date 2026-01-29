import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Alert, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { PrimaryButton, ScreenContainer, SecondaryButton, TabBar, THEME } from '../components'
import { normalizeUrl } from '../utils/socialLinks'
import { showAlert, confirmDiscard, emptyDraft, statusLabel, type CastProfileDraft, type CastProfileStatus, type SocialLink, type StoredCastProfile, type CastProfileRegisterScreenProps, STORAGE_KEY, GENRE_OPTIONS, STANDARD_CATEGORY_OPTIONS, GENRE_TAG_OPTIONS } from '../utils/castProfileUtils'

export function CastProfileRegisterScreen({ apiBaseUrl, authToken, onBack, activeTab, onPressTab }: CastProfileRegisterScreenProps) {
  const { width: windowWidth } = useWindowDimensions()
  const [status, setStatus] = useState<CastProfileStatus>('unregistered')
  const [approvedAt, setApprovedAt] = useState<string | undefined>(undefined)
  const [rejectionReason, setRejectionReason] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const [birthPickerOpen, setBirthPickerOpen] = useState(false)
  const [focusedField, setFocusedField] = useState<string>('')
  const [thumbGridWidth, setThumbGridWidth] = useState<number>(0)

  const [draft, setDraft] = useState<CastProfileDraft>(() => emptyDraft())
  const [initialSnapshot, setInitialSnapshot] = useState<string>('')

  const readOnly = useMemo(() => {
    return status === 'pending'
  }, [status])

  const hasChanges = useMemo(() => {
    return JSON.stringify(draft) !== initialSnapshot
  }, [draft, initialSnapshot])

  const load = useCallback(async () => {
    try {
      const loadFromApi = async () => {
        if (!authToken) return null
        const resp = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/v1/cast-profiles/me`, {
          headers: { authorization: `Bearer ${authToken}` },
        })
        if (!resp.ok) return null
        const json = (await resp.json().catch(() => null)) as any
        return json?.item ?? null
      }

      const apiItem = await loadFromApi().catch(() => null)
      if (apiItem) {
        const rawDraft = apiItem?.draft ?? {}
        const base = emptyDraft()
        const d = (rawDraft || {}) as Partial<CastProfileDraft> & Record<string, unknown>

        const rawLinks: unknown = (d as any)?.socialLinks
        const migratedLinks: SocialLink[] = Array.isArray(rawLinks)
          ? rawLinks
              .map((x) => {
                if (typeof x === 'string') return { url: x }
                if (x && typeof x === 'object') {
                  const url = typeof (x as any).url === 'string' ? (x as any).url : ''
                  return { url }
                }
                return { url: '' }
              })
              .filter((x) => x && typeof x.url === 'string')
          : [{ url: '' }]

        const rawImages: unknown = (d as any)?.profileImages
        const profileImages: string[] = Array.isArray(rawImages) ? rawImages.filter((x) => typeof x === 'string') : []

        const rawGenres: unknown = (d as any)?.genres
        const genres: string[] = Array.isArray(rawGenres) ? rawGenres.filter((x) => typeof x === 'string') : []

        const rawCategories: unknown = (d as any)?.categories
        const categories: string[] = Array.isArray(rawCategories)
          ? rawCategories.filter((x) => typeof x === 'string')
          : []

        const legacySelfPr = typeof (d as any)?.selfPr === 'string' ? String((d as any).selfPr) : ''
        const bio = typeof (d as any)?.bio === 'string' ? String((d as any).bio) : legacySelfPr

        const faceImageUrl = typeof (d as any)?.faceImageUrl === 'string'
          ? String((d as any).faceImageUrl)
          : (typeof (d as any)?.faceImage === 'string' ? String((d as any).faceImage) : '')

        const nextDraft: CastProfileDraft = {
          ...base,
          ...d,
          profileImages,
          genres,
          categories,
          socialLinks: migratedLinks.length ? migratedLinks : [{ url: '' }],
          bio,
          faceImageUrl,
          specialSkills: typeof (d as any)?.specialSkills === 'string' ? String((d as any).specialSkills) : base.specialSkills,
          privatePdfUrl: typeof (d as any)?.privatePdfUrl === 'string' ? String((d as any).privatePdfUrl) : base.privatePdfUrl,
        }

        const nextStatus = String(apiItem?.status ?? '').toLowerCase()
        const mappedStatus: CastProfileStatus =
          nextStatus === 'approved' ? 'published'
          : nextStatus === 'pending' ? 'pending'
          : nextStatus === 'rejected' ? 'rejected'
          : 'unregistered'

        setStatus(mappedStatus)
        setApprovedAt(apiItem?.decidedAt ? String(apiItem.decidedAt) : undefined)
        setRejectionReason(apiItem?.rejectionReason ? String(apiItem.rejectionReason) : undefined)
        setDraft(nextDraft)
        setInitialSnapshot(JSON.stringify(nextDraft))
        return
      }

      // Fallback: local storage draft
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setStatus('unregistered')
        setApprovedAt(undefined)
        setRejectionReason(undefined)
        setDraft(emptyDraft())
        setInitialSnapshot(JSON.stringify(emptyDraft()))
        return
      }
      const stored = JSON.parse(raw) as StoredCastProfile
      const nextDraft = (() => {
        const base = emptyDraft()
        const d = (stored?.draft || {}) as Partial<CastProfileDraft> & Record<string, unknown>
        const rawLinks: unknown = (d as any)?.socialLinks
        const migrated: SocialLink[] = Array.isArray(rawLinks)
          ? rawLinks
              .map((x) => {
                if (typeof x === 'string') return { url: x }
                if (x && typeof x === 'object') {
                  const url = typeof (x as any).url === 'string' ? (x as any).url : ''
                  return { url }
                }
                return { url: '' }
              })
              .filter((x) => x && typeof x.url === 'string')
          : [{ url: '' }]

        const rawImages: unknown = (d as any)?.profileImages
        const profileImages: string[] = Array.isArray(rawImages) ? rawImages.filter((x) => typeof x === 'string') : []

        const rawGenres: unknown = (d as any)?.genres
        const genres: string[] = Array.isArray(rawGenres) ? rawGenres.filter((x) => typeof x === 'string') : []

        const rawCategories: unknown = (d as any)?.categories
        const categories: string[] = Array.isArray(rawCategories)
          ? rawCategories.filter((x) => typeof x === 'string')
          : []

        const legacySelfPr = typeof (d as any)?.selfPr === 'string' ? String((d as any).selfPr) : ''
        const bio = typeof (d as any)?.bio === 'string' ? String((d as any).bio) : legacySelfPr

        return {
          ...base,
          ...d,
          profileImages,
          genres,
          categories,
          socialLinks: migrated.length ? migrated : [{ url: '' }],
          bio,
        }
      })()
      setStatus(stored?.status || 'unregistered')
      setApprovedAt(stored?.approvedAt)
      setRejectionReason(stored?.rejectionReason)
      setDraft(nextDraft)
      setInitialSnapshot(JSON.stringify(nextDraft))
    } catch {
      setStatus('unregistered')
      setApprovedAt(undefined)
      setRejectionReason(undefined)
      const d = emptyDraft()
      setDraft(d)
      setInitialSnapshot(JSON.stringify(d))
    }
  }, [apiBaseUrl, authToken])

  useEffect(() => {
    void load()
  }, [load])

  const uploadImageAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset, keyPrefix: string) => {
    const mimeType = asset.mimeType || 'image/jpeg'
    const ext = mimeType === 'image/png' ? 'png' : 'jpg'
    const fileName = `${keyPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`

    const blob = await fetch(asset.uri).then((r) => r.blob())
    const legacyUploader = 'https://oshidra-uploader.kousuke-c62.workers.dev'
    const defaultUploader = 'https://assets-uploader.oshidra.com/'
    const envUploader = (process.env.EXPO_PUBLIC_UPLOADER_BASE_URL || '').trim()
    const uploaderJwt = (process.env.EXPO_PUBLIC_UPLOADER_JWT || '').trim()
    const resolvedUploaderBaseUrl = (envUploader && envUploader !== legacyUploader) ? envUploader : defaultUploader

    const uploadViaApi = async () => {
      const uploadUrl = `${apiBaseUrl.replace(/\/+$/, '')}/v1/r2/assets/${encodeURIComponent(fileName)}`
      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: blob,
      })
      if (!uploadResp.ok) {
        const errorData = await uploadResp.json().catch(() => ({}))
        const errorMsg = (errorData as any)?.error || `Upload failed with status ${uploadResp.status}`
        const debugInfo = (errorData as any)?.debug ? `\nDebug: ${JSON.stringify((errorData as any).debug)}` : ''
        throw new Error(errorMsg + debugInfo)
      }
      const data = (await uploadResp.json().catch(() => null)) as { publicUrl?: string } | null
      const url = data?.publicUrl
      if (!url) throw new Error('アップロードの応答が不正です')
      return url
    }

    const uploadViaUploader = async () => {
      const uploadUrl = resolvedUploaderBaseUrl.replace(/\/+$/, '') + '/'
      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${uploaderJwt}`,
          'Content-Type': mimeType,
        },
        body: blob,
      })

      const json = (await uploadResp.json().catch(() => null)) as any
      if (!uploadResp.ok) {
        const errorMsg =
          json?.error ||
          json?.message ||
          `Upload failed with status ${uploadResp.status}`
        const err = new Error(errorMsg)
        ;(err as any).status = uploadResp.status
        throw err
      }

      const url = json?.data?.url
      if (!url || typeof url !== 'string') throw new Error('アップロードの応答が不正です')
      return url
    }

    if (uploaderJwt) {
      try {
        return await uploadViaUploader()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const status = typeof (e as any)?.status === 'number' ? Number((e as any).status) : null
        if (status === 401 || status === 403 || /unauthorized|token|authorization/i.test(msg)) {
          return await uploadViaApi()
        }
        throw e
      }
    }

    return await uploadViaApi()
  }, [apiBaseUrl])

  const pickProfileImage = useCallback(async () => {
    if (readOnly || busy) return
    if (draft.profileImages.length >= 10) {
      showAlert('上限', 'プロフィール画像は10枚までです')
      return
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        showAlert('権限が必要です', '画像を選択するために写真へのアクセスを許可してください')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      })

      if (result.canceled || !result.assets[0]) return
      setBusy(true)
      try {
        const url = await uploadImageAsset(result.assets[0], 'cast-profile-portrait')
        setDraft((prev) => ({ ...prev, profileImages: [...prev.profileImages, url].slice(0, 10) }))
      } finally {
        setBusy(false)
      }
    } catch (e) {
      showAlert('エラー', e instanceof Error ? e.message : '画像の選択に失敗しました')
    }
  }, [busy, draft.profileImages.length, readOnly, uploadImageAsset])

  const removeProfileImage = useCallback((index: number) => {
    setDraft((prev) => ({ ...prev, profileImages: prev.profileImages.filter((_, i) => i !== index) }))
  }, [])

  const openBirthDatePicker = useCallback((pressEvent?: any) => {
    if (readOnly || busy) return

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const existing = document.getElementById('cast-birthdate-input') as HTMLInputElement | null
      if (existing) {
        try {
          existing.focus()
          ;(existing as any).showPicker?.()
          existing.click()
          return
        } catch {
          // fallthrough
        }
      }

      const input = document.createElement('input')
      input.id = 'cast-birthdate-input'
      input.type = 'date'
      input.value = (draft.birthDate || '').trim()
      input.max = new Date().toISOString().slice(0, 10)

      const rect = pressEvent?.currentTarget?.getBoundingClientRect?.()
      input.style.position = 'fixed'
      input.style.left = rect ? `${Math.max(0, Math.min(rect.left, (window.innerWidth || 1) - 1))}px` : '0'
      input.style.top = rect ? `${Math.max(0, Math.min(rect.top, (window.innerHeight || 1) - 1))}px` : '0'
      input.style.width = '1px'
      input.style.height = '1px'
      input.style.opacity = '0'
      input.style.pointerEvents = 'none'
      input.style.zIndex = '-1'

      input.onchange = () => {
        const v = input.value
        if (v) setDraft((p) => ({ ...p, birthDate: v }))
        input.remove()
      }
      input.onblur = () => {
        setTimeout(() => input.remove(), 0)
      }

      document.body.appendChild(input)
      input.focus()
      ;(input as any).showPicker?.()
      input.click()
      return
    }

    setBirthPickerOpen(true)
  }, [busy, draft.birthDate, readOnly])

  const birthDateAsDate = useMemo(() => {
    const raw = String(draft.birthDate || '').trim()
    if (!raw) return new Date(1995, 0, 1)
    const m = raw.match(/^\d{4}-\d{2}-\d{2}$/)
    if (!m) return new Date(1995, 0, 1)
    const d = new Date(raw + 'T00:00:00')
    if (Number.isNaN(d.getTime())) return new Date(1995, 0, 1)
    return d
  }, [draft.birthDate])

  const birthDatePicker = Platform.OS !== 'web' ? (
    <Modal transparent visible={birthPickerOpen} animationType="fade" onRequestClose={() => setBirthPickerOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setBirthPickerOpen(false)}>
        <Pressable style={styles.modalCard} onPress={() => null}>
          <Text style={styles.modalTitle}>生年月日</Text>
          <DateTimePicker
            value={birthDateAsDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => {
              if (!date) {
                if (Platform.OS !== 'ios') setBirthPickerOpen(false)
                return
              }
              const iso = date.toISOString().slice(0, 10)
              setDraft((p) => ({ ...p, birthDate: iso }))
              if (Platform.OS !== 'ios') setBirthPickerOpen(false)
            }}
          />
          <View style={styles.modalActions}>
            <SecondaryButton label="閉じる" onPress={() => setBirthPickerOpen(false)} disabled={busy} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  ) : null

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

  const toggleCategory = useCallback(
    (c: string) => {
      setDraft((prev) => {
        const has = prev.categories.includes(c)
        const next = has ? prev.categories.filter((x) => x !== c) : [...prev.categories, c]
        return { ...prev, categories: next }
      })
    },
    [setDraft]
  )

  const setSocialLink = useCallback((index: number, patch: Partial<SocialLink>) => {
    setDraft((prev) => {
      const next = [...prev.socialLinks]
      const cur = next[index] || { url: '' }
      next[index] = { ...cur, ...patch }
      return { ...prev, socialLinks: next }
    })
  }, [])

  const addSocialLink = useCallback(() => {
    setDraft((prev) => ({ ...prev, socialLinks: [...prev.socialLinks, { url: '' }] }))
  }, [])

  const removeSocialLink = useCallback((index: number) => {
    setDraft((prev) => {
      const next = prev.socialLinks.filter((_, i) => i !== index)
      return { ...prev, socialLinks: next.length ? next : [{ url: '' }] }
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
    if (draft.bio.length > 500) return '自己PR文は500文字以内で入力してください'

    for (const it of draft.socialLinks) {
      const raw = String(it?.url || '').trim()
      if (!raw) continue
      const normalized = normalizeUrl(raw)
      try {
        const u = new URL(normalized)
        if (!u.hostname) return 'SNSリンクのURLが不正です'
        if (!/^https?:$/i.test(u.protocol)) return 'SNSリンクは https:// から始まるURLを入力してください'
      } catch {
        return 'SNSリンクのURLが不正です'
      }
    }

    return null
  }, [draft.name, draft.bio.length, draft.socialLinks])

  const save = useCallback(async () => {
    const err = validate()
    if (err) {
      showAlert('エラー', err)
      return
    }

    setBusy(true)
    try {
      const nextStatus: CastProfileStatus = 'pending'
      const nextDraft: CastProfileDraft = {
        ...draft,
        name: draft.name.trim(),
        affiliation: draft.affiliation.trim(),
      }

      if (authToken) {
        const resp = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/v1/cast-profiles/me`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ draft: nextDraft }),
        })
        if (!resp.ok) {
          const json = (await resp.json().catch(() => ({}))) as any
          const msg = json?.error ? String(json.error) : `status ${resp.status}`
          throw new Error(msg)
        }
      }

      const next: StoredCastProfile = {
        status: nextStatus,
        approvedAt,
        rejectionReason,
        draft: nextDraft,
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setStatus(nextStatus)
      setInitialSnapshot(JSON.stringify(nextDraft))
      showAlert('送信完了', status === 'published' ? '更新申請を送信しました（承認待ち）' : '登録内容を送信しました（承認待ち）')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showAlert('エラー', msg || 'キャストプロフィールの登録に失敗しました。時間をおいて再度お試しください')
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, approvedAt, authToken, draft, rejectionReason, status, validate])

  const headerSaveDisabled = busy || readOnly || !hasChanges

  const thumbLayout = useMemo(() => {
    // Match layout deterministically across platforms by computing sizes from the available width.
    const cols = 4
    const gap = 8
    const fallbackWidth = Math.max(0, windowWidth - 32) // ScreenContainer default padding=16 on both sides
    const gridWidth = thumbGridWidth > 0 ? thumbGridWidth : fallbackWidth

    const usable = Math.max(0, gridWidth - gap * (cols - 1))
    const itemW = Math.max(56, Math.floor(usable / cols))
    const itemH = Math.round((itemW * 16) / 9)

    return { cols, gap, itemW, itemH }
  }, [thumbGridWidth, windowWidth])

  const headerRight = (
    <Pressable
      accessibilityRole="button"
      onPress={save}
      disabled={headerSaveDisabled}
      style={[styles.headerSaveBtn, headerSaveDisabled ? styles.headerSaveBtnDisabled : null]}
    >
      <Text style={styles.headerSaveText}>保存</Text>
    </Pressable>
  )

  const headerLeft = (
    <Pressable onPress={handleBack} disabled={busy} style={styles.headerBackBtn} accessibilityRole="button">
      <Text style={styles.headerBackText}>＜</Text>
    </Pressable>
  )

  const inputStyle = useCallback(
    (key: string) => {
      return [styles.input, focusedField === key ? styles.inputFocused : null, readOnly || busy ? styles.inputDisabled : null]
    },
    [busy, focusedField, readOnly]
  )

  const selectStyle = useCallback(
    (key: string) => {
      return [styles.selectInput, focusedField === key ? styles.inputFocused : null, readOnly || busy ? styles.inputDisabled : null]
    },
    [busy, focusedField, readOnly]
  )

  const ToggleRow = ({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) => (
    <Pressable onPress={onToggle} disabled={readOnly || busy} style={styles.checkRow} accessibilityRole="button">
      <View style={[styles.checkBox, checked ? styles.checkBoxChecked : null]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  )

  const Tag = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={readOnly || busy}
      style={[styles.tag, selected ? styles.tagSelected : null]}
    >
      <Text style={[styles.tagText, selected ? styles.tagTextSelected : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )

  return (
    <ScreenContainer
      title="キャストプロフィール登録"
      onBack={handleBack}
      headerRight={headerRight}
      headerLeft={headerLeft}
      scroll
      footer={<TabBar active={activeTab ?? 'cast'} onPress={(k) => onPressTab?.(k)} />}
      footerPaddingHorizontal={0}
    >
      <View style={styles.root}>

        <View style={styles.statusWrap}>
          <Text style={styles.statusTitle}>登録ステータス</Text>
          <Text style={styles.statusValueMuted}>{statusLabel(status)}</Text>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プロフィール</Text>
          <View style={styles.field}>
            <Text style={styles.helperLabel}>プロフィール画像をアップロード</Text>
            <View style={styles.fileRowBetween}>
              <Pressable
                onPress={pickProfileImage}
                disabled={readOnly || busy}
                style={[styles.fileButtonPrimary, readOnly || busy ? styles.inputDisabled : null]}
                accessibilityRole="button"
              >
                <Text style={styles.fileButtonPrimaryText}>ファイルを選択</Text>
              </Pressable>
              <Text style={styles.fileNote}>※10枚まで</Text>
            </View>
            {draft.profileImages.length ? (
              <View
                style={styles.thumbGrid}
                onLayout={(e) => setThumbGridWidth(e.nativeEvent.layout.width)}
              >
                {draft.profileImages.map((uri, idx) => (
                  <View
                    key={`${uri}-${idx}`}
                    style={[
                      styles.thumbWrap,
                      {
                        width: thumbLayout.itemW,
                        marginRight: idx % thumbLayout.cols === thumbLayout.cols - 1 ? 0 : thumbLayout.gap,
                        marginBottom: thumbLayout.gap,
                      },
                    ]}
                  >
                    <Image source={{ uri }} style={[styles.thumbPortrait, { width: thumbLayout.itemW, height: thumbLayout.itemH }]} />
                    {!readOnly && !busy ? (
                      <Pressable onPress={() => removeProfileImage(idx)} style={styles.thumbRemove} accessibilityRole="button">
                        <Text style={styles.thumbRemoveText}>×</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本情報</Text>

          <View style={styles.field}>
            <Text style={styles.label}>氏名（本名もしくは芸名）</Text>
            <TextInput
              value={draft.name}
              onChangeText={(v) => setDraft((p) => ({ ...p, name: v }))}
              placeholder="山田太郎"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              maxLength={50}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField('')}
              style={inputStyle('name')}
            />
            <Text style={styles.count}>{draft.name.length}/50</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>氏名（フリガナ）</Text>
            <TextInput
              value={draft.nameKana}
              onChangeText={(v) => setDraft((p) => ({ ...p, nameKana: v }))}
              placeholder="ヤマダタロウ"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              onFocus={() => setFocusedField('nameKana')}
              onBlur={() => setFocusedField('')}
              style={inputStyle('nameKana')}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>氏名（アルファベット）</Text>
            <TextInput
              value={draft.nameAlphabet}
              onChangeText={(v) => setDraft((p) => ({ ...p, nameAlphabet: v }))}
              placeholder="Taro Yamada"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              autoCapitalize="none"
              onFocus={() => setFocusedField('nameAlphabet')}
              onBlur={() => setFocusedField('')}
              style={inputStyle('nameAlphabet')}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>所属</Text>
            <TextInput
              value={draft.affiliation}
              onChangeText={(v) => setDraft((p) => ({ ...p, affiliation: v }))}
              placeholder="フリーランス／事務所名"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              onFocus={() => setFocusedField('affiliation')}
              onBlur={() => setFocusedField('')}
              style={inputStyle('affiliation')}
            />
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ジャンル（複数選択）</Text>

          <View style={styles.field}>
            {GENRE_OPTIONS.map((g) => (
              <ToggleRow
                key={g}
                label={g}
                checked={draft.genres.includes(g)}
                onToggle={() => toggleGenre(g)}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>個人データ</Text>

          <View style={styles.field}>
            <Text style={styles.label}>生年月日</Text>
            <Pressable
              accessibilityRole="button"
              onPress={(e) => openBirthDatePicker(e)}
              disabled={readOnly || busy}
              onPressIn={() => setFocusedField('birthDate')}
              onPressOut={() => setFocusedField('')}
              style={selectStyle('birthDate')}
            >
              <Text style={[styles.selectText, draft.birthDate ? null : styles.selectTextPlaceholder]}>
                {draft.birthDate ? draft.birthDate : '選択してください'}
              </Text>
              <Text style={styles.selectChevron}>▾</Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>出身地</Text>
            <TextInput
              value={draft.birthplace}
              onChangeText={(v) => setDraft((p) => ({ ...p, birthplace: v }))}
              placeholder="東京都"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              onFocus={() => setFocusedField('birthplace')}
              onBlur={() => setFocusedField('')}
              style={inputStyle('birthplace')}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>血液型</Text>
            <TextInput
              value={draft.bloodType}
              onChangeText={(v) => setDraft((p) => ({ ...p, bloodType: v }))}
              placeholder="A型"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              onFocus={() => setFocusedField('bloodType')}
              onBlur={() => setFocusedField('')}
              style={inputStyle('bloodType')}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>趣味</Text>
            <TextInput
              value={draft.hobbies}
              onChangeText={(v) => setDraft((p) => ({ ...p, hobbies: v }))}
              placeholder={'映画・アニメ鑑賞'}
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              onFocus={() => setFocusedField('hobbies')}
              onBlur={() => setFocusedField('')}
              style={inputStyle('hobbies')}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>特技</Text>
            <TextInput
              value={draft.specialSkills}
              onChangeText={(v) => setDraft((p) => ({ ...p, specialSkills: v }))}
              placeholder="演技・ダンス・歌など"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              onFocus={() => setFocusedField('specialSkills')}
              onBlur={() => setFocusedField('')}
              style={inputStyle('specialSkills')}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>資格</Text>
            <TextInput
              value={draft.qualifications}
              onChangeText={(v) => setDraft((p) => ({ ...p, qualifications: v }))}
              placeholder="英検1級"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              onFocus={() => setFocusedField('qualifications')}
              onBlur={() => setFocusedField('')}
              style={inputStyle('qualifications')}
            />
          </View>

        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>カテゴリ</Text>

          <View style={styles.field}>
            <Text style={styles.subTitleAccent}>定番・王道ジャンル</Text>
            <View style={styles.tagGroup}>
              {STANDARD_CATEGORY_OPTIONS.map((c) => (
                <Tag
                  key={c}
                  label={c}
                  selected={draft.categories.includes(c)}
                  onPress={() => toggleCategory(c)}
                />
              ))}
            </View>

            <Text style={[styles.subTitle, { marginTop: 14 }]}>ジャンルタグ</Text>
            <View style={styles.tagGroup}>
              {GENRE_TAG_OPTIONS.map((c) => (
                <Tag
                  key={c}
                  label={c}
                  selected={draft.categories.includes(c)}
                  onPress={() => toggleCategory(c)}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SNSリンク</Text>

          <View style={styles.field}>
            {draft.socialLinks.map((it, idx) => (
              <View key={`${idx}-${it.url}`} style={styles.socialRow}>
                <TextInput
                  value={it.url}
                  onChangeText={(v) => setSocialLink(idx, { url: v })}
                  placeholder="SNSリンク"
                  placeholderTextColor={THEME.textMuted}
                  autoCapitalize="none"
                  editable={!readOnly && !busy}
                  onFocus={() => setFocusedField(`social-${idx}`)}
                  onBlur={() => setFocusedField('')}
                  style={[styles.socialUrl, focusedField === `social-${idx}` ? styles.inputFocused : null, readOnly || busy ? styles.inputDisabled : null]}
                />
                {!readOnly && !busy && draft.socialLinks.length > 1 ? (
                  <Pressable onPress={() => removeSocialLink(idx)} style={styles.socialRemove} accessibilityRole="button">
                    <Text style={styles.socialRemoveText}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {!readOnly && !busy ? (
              <Pressable onPress={addSocialLink} style={styles.addRow} accessibilityRole="button">
                <Text style={styles.addRowText}>行を追加 +</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>自己PR</Text>

          <View style={styles.field}>
            <TextInput
              value={draft.bio}
              onChangeText={(v) => setDraft((p) => ({ ...p, bio: v }))}
              placeholder="自己PRを記入する"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              multiline
              onFocus={() => setFocusedField('bio')}
              onBlur={() => setFocusedField('')}
              style={[styles.textarea, focusedField === 'bio' ? styles.inputFocused : null, readOnly || busy ? styles.inputDisabled : null]}
            />
            <Text style={styles.count}>{draft.bio.length}/500</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>経歴・出演実績</Text>

          <View style={styles.field}>
            <TextInput
              value={draft.career}
              onChangeText={(v) => setDraft((p) => ({ ...p, career: v }))}
              placeholder="経歴・出演実績を記入する"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              multiline
              onFocus={() => setFocusedField('career')}
              onBlur={() => setFocusedField('')}
              style={[styles.textarea, focusedField === 'career' ? styles.inputFocused : null, readOnly || busy ? styles.inputDisabled : null]}
            />
          </View>
        </View>

        <View style={styles.bottomSpacer} />

        <View style={styles.bottomActions}>
          <PrimaryButton
            label="保存"
            onPress={save}
            disabled={headerSaveDisabled}
            containerStyle={styles.bottomSaveBtn}
            textStyle={styles.bottomSaveText}
          />
        </View>

        <View style={styles.bottomSafeArea} />
      </View>
      {birthDatePicker}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '900',
  },
  headerSaveBtn: {
    backgroundColor: THEME.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveBtnDisabled: {
    opacity: 0.45,
  },
  headerSaveText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
  },
  statusWrap: {
    paddingTop: 6,
    paddingBottom: 16,
  },
  statusTitle: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  statusValueMuted: {
    color: THEME.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  section: {
    paddingVertical: 18,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 18,
  },
  field: {
    marginBottom: 14,
  },
  subTitle: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  subTitleAccent: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
  },
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  helperLabel: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#0B0B0B',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    color: THEME.text,
    fontSize: 13,
  },
  inputFocused: {
    borderColor: 'rgba(255,255,255,0.32)',
  },
  textarea: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#0B0B0B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 13,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    opacity: 0.6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fileRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fileButton: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileButtonPrimary: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: THEME.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileButtonPrimaryText: {
    color: THEME.bg,
    fontSize: 12,
    fontWeight: '900',
  },
  fileButtonText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  fileNote: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '800',
    minWidth: 80,
    textAlign: 'right',
  },
  clearBtn: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearBtnText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumbPortrait: {
    borderRadius: 10,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    backgroundColor: THEME.card,
  },
  thumbRemoveText: {
    color: THEME.textMuted,
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '900',
  },
  count: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 10,
    textAlign: 'right',
  },
  selectInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#0B0B0B',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
  },
  selectTextPlaceholder: {
    color: THEME.textMuted,
    fontWeight: '700',
  },
  selectChevron: {
    color: THEME.textMuted,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 10,
  },
  tagGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  tagSelected: {
    borderColor: THEME.accent,
  },
  tagText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
  },
  tagTextSelected: {
    color: THEME.accent,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: {
    borderColor: THEME.accent,
  },
  checkMark: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 14,
  },
  checkLabel: {
    flex: 1,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  socialUrl: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#0B0B0B',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 46,
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
    backgroundColor: 'transparent',
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
  bottomSaveBtn: {
    borderRadius: 999,
    paddingVertical: 16,
  },
  bottomSaveText: {
    color: '#111827',
    fontWeight: '900',
  },
  bottomSpacer: {
    height: 8,
  },
  bottomSafeArea: {
    height: 28,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 14,
  },
  modalTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalActions: {
    marginTop: 12,
  },
})
