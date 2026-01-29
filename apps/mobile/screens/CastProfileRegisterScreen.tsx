import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { CheckboxRow, PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { normalizeUrl } from '../utils/socialLinks'
import { showAlert, confirmDiscard, emptyDraft, statusLabel, type CastProfileDraft, type CastProfileStatus, type SocialLink, type StoredCastProfile, type CastProfileRegisterScreenProps, STORAGE_KEY, GENRE_OPTIONS, CATEGORY_OPTIONS } from '../utils/castProfileUtils'

export function CastProfileRegisterScreen({ apiBaseUrl, authToken, onBack }: CastProfileRegisterScreenProps) {
  const [status, setStatus] = useState<CastProfileStatus>('unregistered')
  const [approvedAt, setApprovedAt] = useState<string | undefined>(undefined)
  const [rejectionReason, setRejectionReason] = useState<string | undefined>(undefined)
  const [editMode, setEditMode] = useState(true)
  const [busy, setBusy] = useState(false)

  const [draft, setDraft] = useState<CastProfileDraft>(() => emptyDraft())
  const [initialSnapshot, setInitialSnapshot] = useState<string>('')

  const readOnly = useMemo(() => {
    if (status === 'pending') return true
    if (status === 'rejected') return false
    if (status === 'published') return !editMode
    return false
  }, [editMode, status])

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
        setEditMode(mappedStatus !== 'pending')
        return
      }

      // Fallback: local storage draft
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setStatus('unregistered')
        setApprovedAt(undefined)
        setRejectionReason(undefined)
        setEditMode(true)
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
      setEditMode(stored?.status !== 'pending')
    } catch {
      setStatus('unregistered')
      setApprovedAt(undefined)
      setRejectionReason(undefined)
      const d = emptyDraft()
      setDraft(d)
      setInitialSnapshot(JSON.stringify(d))
      setEditMode(true)
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

  const pickFaceImage = useCallback(async () => {
    if (readOnly || busy) return
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        showAlert('権限が必要です', '画像を選択するために写真へのアクセスを許可してください')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      })

      if (result.canceled || !result.assets[0]) return
      setBusy(true)
      try {
        const url = await uploadImageAsset(result.assets[0], 'cast-profile-face')
        setDraft((prev) => ({ ...prev, faceImageUrl: url }))
      } finally {
        setBusy(false)
      }
    } catch (e) {
      showAlert('エラー', e instanceof Error ? e.message : '画像の選択に失敗しました')
    }
  }, [busy, readOnly, uploadImageAsset])

  const clearFaceImage = useCallback(() => {
    setDraft((prev) => ({ ...prev, faceImageUrl: '' }))
  }, [])

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
      setEditMode(false)
      setInitialSnapshot(JSON.stringify(nextDraft))
      showAlert('送信完了', status === 'published' ? '更新申請を送信しました（承認待ち）' : '登録内容を送信しました（承認待ち）')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      showAlert('エラー', msg || 'キャストプロフィールの登録に失敗しました。時間をおいて再度お試しください')
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, approvedAt, authToken, draft, rejectionReason, status, validate])

  const headerRight = useMemo(() => {
    if (status === 'pending') return null
    if (status === 'published' && !editMode) {
      return <SecondaryButton label="編集" onPress={() => setEditMode(true)} disabled={busy} />
    }
    return <PrimaryButton label="保存" onPress={save} disabled={busy || readOnly || !hasChanges} fullWidth={false} />
  }, [busy, editMode, hasChanges, readOnly, save, status])

  return (
    <ScreenContainer scroll>
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
          {status === 'rejected' ? (
            <Text style={styles.statusNote}>差し戻し: {rejectionReason || '内容をご確認のうえ再送信してください。'}</Text>
          ) : null}
          {status === 'published' && approvedAt ? (
            <Text style={styles.statusNote}>承認日時: {approvedAt}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プロフィール</Text>

          <View style={styles.field}>
            <Text style={styles.label}>顔写真をアップロード（1:1）</Text>
            <View style={styles.fileRow}>
              <Pressable
                onPress={pickFaceImage}
                disabled={readOnly || busy}
                style={[styles.fileButton, readOnly || busy ? styles.inputDisabled : null]}
                accessibilityRole="button"
              >
                <Text style={styles.fileButtonText}>画像を選択</Text>
              </Pressable>
              {draft.faceImageUrl ? (
                <Pressable onPress={clearFaceImage} disabled={readOnly || busy} accessibilityRole="button" style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>削除</Text>
                </Pressable>
              ) : null}
            </View>
            {draft.faceImageUrl ? (
              <View style={styles.thumbGrid}>
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: draft.faceImageUrl }} style={styles.thumbSquare} />
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>プロフィール画像をアップロード（9:16 / 10枚まで）</Text>
            <View style={styles.fileRow}>
              <Pressable
                onPress={pickProfileImage}
                disabled={readOnly || busy}
                style={[styles.fileButton, readOnly || busy ? styles.inputDisabled : null]}
                accessibilityRole="button"
              >
                <Text style={styles.fileButtonText}>ファイルを選択</Text>
              </Pressable>
              <Text style={styles.fileNote}>※1枚ずつトリミングします</Text>
            </View>
            {draft.profileImages.length ? (
              <View style={styles.thumbGrid}>
                {draft.profileImages.map((uri, idx) => (
                  <View key={`${uri}-${idx}`} style={styles.thumbWrap}>
                    <Image source={{ uri }} style={styles.thumbPortrait} />
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

          <View style={styles.field}>
            <Text style={styles.label}>氏名（本名もしくは芸名）</Text>
            <TextInput
              value={draft.name}
              onChangeText={(v) => setDraft((p) => ({ ...p, name: v }))}
              placeholder="山田太郎"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              maxLength={50}
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
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
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
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
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>所属</Text>
            <TextInput
              value={draft.affiliation}
              onChangeText={(v) => setDraft((p) => ({ ...p, affiliation: v }))}
              placeholder="フリーランス/事務所名"
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
            <Text style={styles.label}>生年月日</Text>
            <TextInput
              value={draft.birthDate}
              onChangeText={(v) => setDraft((p) => ({ ...p, birthDate: v }))}
              placeholder="選択してください"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>出身地</Text>
            <TextInput
              value={draft.birthplace}
              onChangeText={(v) => setDraft((p) => ({ ...p, birthplace: v }))}
              placeholder="東京都"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
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
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>趣味</Text>
            <TextInput
              value={draft.hobbies}
              onChangeText={(v) => setDraft((p) => ({ ...p, hobbies: v }))}
              placeholder={'映画・アニメ鑑賞\nダンス・歌'}
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              multiline
              style={[styles.textareaShort, readOnly || busy ? styles.inputDisabled : null]}
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
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
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
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>カテゴリ</Text>
            <View style={styles.chipGroup}>
              {CATEGORY_OPTIONS.map((c) => {
                const selected = draft.categories.includes(c)
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      if (readOnly || busy) return
                      toggleCategory(c)
                    }}
                    accessibilityRole="button"
                    style={[styles.chip, selected ? styles.chipSelected : null]}
                  >
                    <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]} numberOfLines={1}>
                      {c}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>SNSリンク</Text>
            {draft.socialLinks.map((it, idx) => (
              <View key={`${idx}-${it.url}`} style={styles.socialRow}>
                <TextInput
                  value={it.url}
                  onChangeText={(v) => setSocialLink(idx, { url: v })}
                  placeholder="SNSリンク"
                  placeholderTextColor={THEME.textMuted}
                  autoCapitalize="none"
                  editable={!readOnly && !busy}
                  style={[styles.socialUrl, readOnly || busy ? styles.inputDisabled : null]}
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

          <View style={styles.field}>
            <Text style={styles.label}>自己PR</Text>
            <TextInput
              value={draft.bio}
              onChangeText={(v) => setDraft((p) => ({ ...p, bio: v }))}
              placeholder="自己PRを記入する"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              multiline
              style={[styles.textarea, readOnly || busy ? styles.inputDisabled : null]}
            />
            <Text style={styles.count}>{draft.bio.length}/500</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>経歴・出演実績</Text>
            <TextInput
              value={draft.career}
              onChangeText={(v) => setDraft((p) => ({ ...p, career: v }))}
              placeholder="経歴・出演実績を記入する"
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              multiline
              style={[styles.textarea, readOnly || busy ? styles.inputDisabled : null]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PDF（非公開）URL</Text>
            <TextInput
              value={draft.privatePdfUrl}
              onChangeText={(v) => setDraft((p) => ({ ...p, privatePdfUrl: v }))}
              placeholder="https://..."
              placeholderTextColor={THEME.textMuted}
              editable={!readOnly && !busy}
              autoCapitalize="none"
              style={[styles.input, readOnly || busy ? styles.inputDisabled : null]}
            />
            <Text style={styles.helperText}>※公開プロフィールには表示されない想定です</Text>
          </View>

          {status === 'pending' ? (
            <View style={styles.bottomActions}>
              <SecondaryButton label="戻る" onPress={handleBack} disabled={busy} />
            </View>
          ) : null}

          {status !== 'pending' ? (
            <View style={styles.bottomActions}>
              <PrimaryButton label="保存" onPress={save} disabled={busy || readOnly || !hasChanges} />
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
  textareaShort: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 13,
    minHeight: 72,
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
  fileButton: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileButtonText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  fileNote: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
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
    gap: 10,
    marginTop: 10,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumbPortrait: {
    width: 72,
    height: 128,
    borderRadius: 10,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  thumbSquare: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  thumbRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 13,
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
  helperText: {
    marginTop: 6,
    color: THEME.textMuted,
    fontSize: 11,
    lineHeight: 16,
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
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  chipSelected: {
    borderColor: THEME.accent,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  chipText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: THEME.accent,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
