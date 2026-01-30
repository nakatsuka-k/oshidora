import { useCallback, useMemo, useState } from 'react'
import { Alert, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Path, Svg } from 'react-native-svg'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { Chip, PrimaryButton, ScreenContainer, SecondaryButton, Section, TextField, THEME } from '../components'
import { isValidEmail } from '../utils/validators'
import { type UserProfileEditScreenProps, GENRE_GROUPS } from '../types/userProfileEditTypes'

export function UserProfileEditScreen({
  apiBaseUrl,
  onBack,
  onRequestEmailChange,
  onRequestPhoneChange,
  onSave,
  initialDisplayName = '',
  initialFullName = '',
  initialFullNameKana = '',
  initialEmail = '',
  initialPhone = '',
  initialBirthDate = '',
  initialFavoriteGenres = [],
  initialAvatarUrl = '',
  initialUserId = '',
  isNewRegistration = false,
}: UserProfileEditScreenProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [fullName, setFullName] = useState(initialFullName)
  const [fullNameKana, setFullNameKana] = useState(initialFullNameKana)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [birthDate, setBirthDate] = useState(initialBirthDate)
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(initialFavoriteGenres)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [busy, setBusy] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [birthPickerOpen, setBirthPickerOpen] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const EyeIcon = ({ open }: { open: boolean }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke={THEME.textMuted}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={THEME.textMuted}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {open ? null : <Path d="M4 4l16 16" stroke={THEME.textMuted} strokeWidth={2} strokeLinecap="round" />}
    </Svg>
  )

  const ChevronDownIcon = () => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={THEME.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )

  const UserAvatarIcon = () => (
    <Svg width={56} height={56} viewBox="0 0 64 64" fill="none">
      <Path
        d="M32 34c7.2 0 13-5.8 13-13S39.2 8 32 8 19 13.8 19 21s5.8 13 13 13Z"
        fill={THEME.placeholder}
      />
      <Path
        d="M12 56c0-11 9-20 20-20s20 9 20 20"
        fill={THEME.placeholder}
      />
    </Svg>
  )

  const birthDateValue = useMemo(() => {
    const v = birthDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(1990, 0, 1)
    const [y, m, d] = v.split('-').map((x) => Number(x))
    if (!y || !m || !d) return new Date(1990, 0, 1)
    return new Date(y, m - 1, d)
  }, [birthDate])

  const setBirthDateFromDate = useCallback((date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    setBirthDate(`${y}-${m}-${d}`)
  }, [])

  const hasChanges = useMemo(() => {
    return (
      displayName !== initialDisplayName ||
      fullName !== initialFullName ||
      fullNameKana !== initialFullNameKana ||
      email !== initialEmail ||
      phone !== initialPhone ||
      birthDate !== initialBirthDate ||
      avatarUrl !== initialAvatarUrl ||
      JSON.stringify(favoriteGenres) !== JSON.stringify(initialFavoriteGenres)
    )
  }, [
    displayName,
    fullName,
    fullNameKana,
    email,
    phone,
    birthDate,
    avatarUrl,
    favoriteGenres,
    initialDisplayName,
    initialFullName,
    initialFullNameKana,
    initialEmail,
    initialPhone,
    initialBirthDate,
    initialAvatarUrl,
    initialFavoriteGenres,
  ])

  const requiredIssues = useMemo(() => {
    const issues: Array<{ key: string; label: string }> = []

    const displayNameTrimmed = displayName.trim()
    const birthDateTrimmed = birthDate.trim()
    const hasBirthDate = !!birthDateTrimmed
    const birthDateValid = /^\d{4}-\d{2}-\d{2}$/.test(birthDateTrimmed)

    // Note: email/phone are read-only on this screen (change flows exist separately).
    if (!displayNameTrimmed) issues.push({ key: 'displayName', label: '表示名' })

    // Registration requires a complete profile; edit allows partial saves but should surface missing required items.
    if (isNewRegistration) {
      if (!isValidEmail(email)) issues.push({ key: 'email', label: 'メールアドレス' })
      if (!phone.trim()) issues.push({ key: 'phone', label: '電話番号' })
      if (password.trim().length < 8) issues.push({ key: 'password', label: 'パスワード（8文字以上）' })
      if (password !== passwordConfirm) issues.push({ key: 'passwordConfirm', label: 'パスワード（確認）' })
      if (!hasBirthDate) issues.push({ key: 'birthDate', label: '生年月日' })
      else if (!birthDateValid) issues.push({ key: 'birthDate', label: '生年月日（形式）' })
    } else {
      // In edit mode, show these as “必須” but allow saving with a confirmation.
      if (!hasBirthDate) issues.push({ key: 'birthDate', label: '生年月日' })
      if (favoriteGenres.length < 1) issues.push({ key: 'favoriteGenres', label: '好きなジャンル' })
    }

    return issues
  }, [birthDate, displayName, email, favoriteGenres.length, isNewRegistration, password, passwordConfirm, phone])

  const canSubmit = useMemo(() => {
    if (busy || avatarUploading) return false

    const changingPassword = isNewRegistration || password.trim().length > 0 || passwordConfirm.trim().length > 0
    if (changingPassword) {
      if (password.trim().length < 8) return false
      if (password !== passwordConfirm) return false
      // Registration still needs required fields; edit can proceed and will confirm if required items are missing.
      return isNewRegistration ? requiredIssues.length === 0 : true
    }

    // Edit flow: allow tapping “完了” whenever something changed.
    return isNewRegistration ? requiredIssues.length === 0 : hasChanges
  }, [avatarUploading, busy, hasChanges, isNewRegistration, password, passwordConfirm, requiredIssues.length])

  const allGenreOptions = useMemo(() => {
    const seen = new Set<string>()
    return GENRE_GROUPS.map((g) => {
      const filtered = g.options.filter((opt) => {
        if (seen.has(opt)) return false
        seen.add(opt)
        return true
      })
      return { ...g, options: filtered }
    }).filter((g) => g.options.length > 0)
  }, [])

  const toggleGenre = useCallback((label: string) => {
    setFavoriteGenres((prev) => {
      const exists = prev.includes(label)
      if (exists) return prev.filter((v) => v !== label)
      return [...prev, label]
    })
  }, [])

  const handleBack = useCallback(() => {
    if (hasChanges) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const ok = window.confirm('変更内容を保存せずに戻りますか？')
        if (ok) onBack()
        return
      }

      Alert.alert('確認', '変更内容を保存せずに戻りますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '戻る',
          onPress: onBack,
          style: 'destructive',
        },
      ])
      return
    }
    onBack()
  }, [hasChanges, onBack])

  const openBirthDatePicker = useCallback((pressEvent?: any) => {
    if (busy) return

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const native = pressEvent?.nativeEvent
      const pageX = typeof native?.pageX === 'number' ? native.pageX : null
      const pageY = typeof native?.pageY === 'number' ? native.pageY : null
      const clientX =
        typeof native?.clientX === 'number'
          ? native.clientX
          : typeof pageX === 'number' && typeof window !== 'undefined'
            ? pageX - (window.scrollX || 0)
            : null
      const clientY =
        typeof native?.clientY === 'number'
          ? native.clientY
          : typeof pageY === 'number' && typeof window !== 'undefined'
            ? pageY - (window.scrollY || 0)
            : null

      const anchorEl =
        typeof document !== 'undefined' && typeof clientX === 'number' && typeof clientY === 'number'
          ? document.elementFromPoint(clientX, clientY)
          : null

      const rect = (anchorEl as any)?.getBoundingClientRect?.() as
        | { left: number; top: number; width: number; height: number }
        | undefined

      const input = document.createElement('input')
      input.type = 'date'
      input.value = /^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim()) ? birthDate.trim() : ''
      input.max = new Date().toISOString().slice(0, 10)
      // Some browsers won't open a date picker for fully off-screen or display:none inputs.
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
        if (v) setBirthDate(v)
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
  }, [birthDate, busy])

  const handlePickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('パーミッション', 'ギャラリーへのアクセス許可が必要です')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      })

      if (result.canceled || !result.assets[0]) return

      const asset = result.assets[0]
      const mimeType = asset.mimeType || 'image/jpeg'
      const ext = mimeType === 'image/png' ? 'png' : 'jpg'
      const fileName = `profile-${Date.now()}.${ext}`

      setAvatarUploading(true)
      try {
        const blob = await fetch(asset.uri).then((r) => r.blob())
        const legacyUploader = 'https://oshidra-uploader.kousuke-c62.workers.dev'
        const defaultUploader = 'https://assets-uploader.oshidra.com/'
        const envUploader = (process.env.EXPO_PUBLIC_UPLOADER_BASE_URL || '').trim()
        const uploaderJwt = (process.env.EXPO_PUBLIC_UPLOADER_JWT || '').trim()

        const resolvedUploaderBaseUrl = (envUploader && envUploader !== legacyUploader) ? envUploader : defaultUploader

        const uploadViaApi = async () => {
          const uploadUrl = `${apiBaseUrl}/v1/r2/assets/${fileName}`
          const uploadResp = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': mimeType,
            },
            body: blob,
          })

          if (!uploadResp.ok) {
            const errorData = await uploadResp.json().catch(() => ({}))
            const errorMsg = errorData.error || `Upload failed with status ${uploadResp.status}`
            const debugInfo = errorData.debug ? `\nDebug: ${JSON.stringify(errorData.debug)}` : ''
            throw new Error(errorMsg + debugInfo)
          }

          const data = (await uploadResp.json().catch(() => null)) as { publicUrl?: string } | null
          const url = data?.publicUrl
          if (!url) throw new Error('アップロードの応答が不正です')
          setAvatarUrl(url)
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
          setAvatarUrl(url)
        }

        if (uploaderJwt) {
          try {
            await uploadViaUploader()
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            const status = typeof (e as any)?.status === 'number' ? Number((e as any).status) : null
            // If uploader auth is misconfigured (401/403), fall back to API upload.
            if (status === 401 || status === 403 || /unauthorized|token|authorization/i.test(msg)) {
              await uploadViaApi()
            } else {
              throw e
            }
          }
        } else {
          // No JWT available; use API proxy upload.
          await uploadViaApi()
        }
      } finally {
        setAvatarUploading(false)
      }
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '画像の選択に失敗しました')
    }
  }, [apiBaseUrl])

  const handleSave = useCallback(async () => {
    setAttemptedSubmit(true)

    if (!hasChanges && !isNewRegistration && password.trim().length === 0 && passwordConfirm.trim().length === 0) {
      Alert.alert('確認', '変更がありません')
      return
    }

    if (!displayName.trim()) {
      Alert.alert('エラー', '表示名を入力してください')
      return
    }

    if (isNewRegistration) {
      if (!isValidEmail(email)) {
        Alert.alert('エラー', 'メールアドレスの形式が正しくありません')
        return
      }
      if (!phone.trim()) {
        Alert.alert('エラー', '電話番号が不明です')
        return
      }
    }

    const changingPassword = isNewRegistration || password.trim().length > 0 || passwordConfirm.trim().length > 0
    if (changingPassword && password.trim().length < 8) {
      Alert.alert('エラー', 'パスワードは8文字以上で設定してください')
      return
    }
    if (changingPassword && password !== passwordConfirm) {
      Alert.alert('エラー', 'パスワードが一致しません')
      return
    }

    const birthDateTrimmed = birthDate.trim()
    if (isNewRegistration) {
      if (!birthDateTrimmed) {
        Alert.alert('エラー', '生年月日を入力してください')
        return
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateTrimmed)) {
        Alert.alert('エラー', '生年月日の形式が正しくありません（YYYY-MM-DDで入力）')
        return
      }
    } else {
      // Edit mode: allow blank, but validate if provided.
      if (birthDateTrimmed && !/^\d{4}-\d{2}-\d{2}$/.test(birthDateTrimmed)) {
        Alert.alert('エラー', '生年月日の形式が正しくありません（YYYY-MM-DDで入力）')
        return
      }
    }

    // Check if birthDate is in the future (only when provided)
    if (birthDateTrimmed) {
      const birth = new Date(birthDateTrimmed)
      const today = new Date()
      if (birth > today) {
        Alert.alert('エラー', '生年月日は今日以前の日付を選択してください')
        return
      }
    }

    if (!isNewRegistration && requiredIssues.length > 0) {
      const msg = '必須項目（*）が未入力ですが、入力済みの内容だけ先に保存しますか？'

      const proceed = await new Promise<boolean>((resolve) => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          resolve(window.confirm(msg))
          return
        }
        Alert.alert('確認', msg, [
          { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
          { text: '保存する', onPress: () => resolve(true) },
        ])
      })

      if (!proceed) return
    }

    setBusy(true)
    try {
      const mergedFullName = !isNewRegistration && fullName === initialFullName ? initialFullName.trim() : fullName.trim()
      const mergedFullNameKana =
        !isNewRegistration && fullNameKana === initialFullNameKana ? initialFullNameKana.trim() : fullNameKana.trim()
      const mergedBirthDate = !isNewRegistration && birthDate === initialBirthDate ? initialBirthDate.trim() : birthDateTrimmed
      const mergedAvatarUrl = !isNewRegistration && avatarUrl === initialAvatarUrl ? initialAvatarUrl : avatarUrl
      const mergedFavoriteGenres =
        !isNewRegistration && JSON.stringify(favoriteGenres) === JSON.stringify(initialFavoriteGenres)
          ? initialFavoriteGenres
          : favoriteGenres

      await onSave({
        displayName: displayName.trim(),
        fullName: mergedFullName,
        fullNameKana: mergedFullNameKana,
        email: email.trim(),
        phone: phone.trim(),
        birthDate: mergedBirthDate,
        favoriteGenres: mergedFavoriteGenres,
        password: changingPassword && password ? password : undefined,
        avatarUrl: mergedAvatarUrl || undefined,
      })
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }, [
    displayName,
    fullName,
    fullNameKana,
    email,
    phone,
    birthDate,
    favoriteGenres,
    password,
    passwordConfirm,
    avatarUrl,
    hasChanges,
    initialAvatarUrl,
    initialBirthDate,
    initialFavoriteGenres,
    initialFullName,
    initialFullNameKana,
    isNewRegistration,
    onSave,
    requiredIssues.length,
  ])

  const birthDatePicker = Platform.OS !== 'web' ? (
    <Modal transparent visible={birthPickerOpen} animationType="fade" onRequestClose={() => setBirthPickerOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setBirthPickerOpen(false)}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>生年月日を選択</Text>
          <DateTimePicker
            value={birthDateValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => {
              if (!date) return
              setBirthDateFromDate(date)
              if (Platform.OS !== 'ios') setBirthPickerOpen(false)
            }}
          />

          {Platform.OS === 'ios' ? (
            <View style={styles.modalButtons}>
              <SecondaryButton label="閉じる" onPress={() => setBirthPickerOpen(false)} disabled={busy} />
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  ) : null

  return (
    <ScreenContainer title={isNewRegistration ? 'プロフィール登録' : 'ユーザープロフィール編集'} onBack={handleBack} scroll>
      <View style={styles.root}>
        {birthDatePicker}
        {isNewRegistration ? <Text style={styles.leadText}>あと少しで利用開始できます。プロフィールを登録してください。</Text> : null}

        <Section title="プロフィール画像">
          <View style={styles.avatarBlock}>
            <Pressable onPress={handlePickImage} disabled={busy || avatarUploading} style={styles.avatarCircle}>
              {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : <UserAvatarIcon />}
            </Pressable>

            <View style={styles.avatarButtonWrap}>
              <PrimaryButton
                label={avatarUrl ? '画像を変更' : '画像を選択'}
                onPress={handlePickImage}
                disabled={busy || avatarUploading}
              />
            </View>
            {avatarUploading ? <Text style={styles.hintText}>アップロード中...</Text> : null}
          </View>
        </Section>

        <Section title="基本情報">

          {isNewRegistration ? (
            <View style={styles.field}>
              <Text style={styles.label}>ユーザーID</Text>
              <Text style={styles.staticValue}>{initialUserId.trim() ? initialUserId.trim() : '--------'}</Text>
            </View>
          ) : null}

          <TextField
            label="表示名（ニックネーム）*"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="推しドラ太郎"
            editable={!busy}
            maxLength={20}
            countText={`${displayName.length}/20`}
            errorText={attemptedSubmit && !displayName.trim() ? '表示名は必須です' : undefined}
            containerStyle={styles.field}
          />

          {!isNewRegistration ? (
            <>
              <TextField
                label="名前（姓名）"
                value={fullName}
                onChangeText={setFullName}
                placeholder="推しドラ 太郎"
                editable={!busy}
                maxLength={40}
                countText={`${fullName.length}/40`}
                containerStyle={styles.field}
              />

              <TextField
                label="カナ（セイメイ）"
                value={fullNameKana}
                onChangeText={setFullNameKana}
                placeholder="オシドラ タロウ"
                editable={!busy}
                maxLength={40}
                countText={`${fullNameKana.length}/40`}
                containerStyle={styles.field}
              />
            </>
          ) : null}

          <View style={styles.field}>
            <TextField
              label="メールアドレス"
              value={email}
              onChangeText={setEmail}
              placeholder="example@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
              containerStyle={styles.field}
              right={
                !isNewRegistration && onRequestEmailChange ? (
                  <Pressable
                    onPress={onRequestEmailChange}
                    disabled={busy}
                    style={[styles.changeButton, busy ? styles.inputDisabled : null]}
                  >
                    <Text style={styles.changeButtonText}>変更</Text>
                  </Pressable>
                ) : null
              }
            />
            <Text style={styles.hintText}>※認証済みのメールアドレスです</Text>
          </View>

          {isNewRegistration ? (
            <>
              <TextField
                label="パスワード"
                value={password}
                onChangeText={setPassword}
                placeholder="パスワード"
                secureTextEntry={!showPassword}
                controlHeight={48}
                editable={!busy}
                autoCapitalize="none"
                helperText="※8文字以上"
                containerStyle={styles.field}
                right={
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                    disabled={busy}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'パスワードを非表示にする' : 'パスワードを表示する'}
                  >
                    <EyeIcon open={showPassword} />
                  </Pressable>
                }
              />

              <TextField
                label="パスワード（確認）"
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                placeholder="パスワード（確認）"
                secureTextEntry={!showPasswordConfirm}
                controlHeight={48}
                editable={!busy}
                autoCapitalize="none"
                helperText="※8文字以上"
                errorText={password && passwordConfirm && password !== passwordConfirm ? 'パスワードが一致しません' : undefined}
                containerStyle={styles.field}
                right={
                  <Pressable
                    onPress={() => setShowPasswordConfirm((v) => !v)}
                    hitSlop={10}
                    disabled={busy}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPasswordConfirm ? '確認用パスワードを非表示にする' : '確認用パスワードを表示する'
                    }
                  >
                    <EyeIcon open={showPasswordConfirm} />
                  </Pressable>
                }
              />
            </>
          ) : null}

          {!isNewRegistration && (
            <>
              <TextField
                label="パスワード（変更する場合のみ）"
                value={password}
                onChangeText={setPassword}
                placeholder="8文字以上"
                secureTextEntry={!showPassword}
                controlHeight={48}
                editable={!busy}
                autoCapitalize="none"
                containerStyle={styles.field}
                right={
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                    disabled={busy}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'パスワードを非表示にする' : 'パスワードを表示する'}
                  >
                    <EyeIcon open={showPassword} />
                  </Pressable>
                }
              />

              <TextField
                label="パスワード（確認）"
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                placeholder="パスワードを再度入力"
                secureTextEntry={!showPasswordConfirm}
                controlHeight={48}
                editable={!busy}
                autoCapitalize="none"
                errorText={password && passwordConfirm && password !== passwordConfirm ? 'パスワードが一致しません' : undefined}
                containerStyle={styles.field}
                right={
                  <Pressable
                    onPress={() => setShowPasswordConfirm((v) => !v)}
                    hitSlop={10}
                    disabled={busy}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPasswordConfirm ? '確認用パスワードを非表示にする' : '確認用パスワードを表示する'
                    }
                  >
                    <EyeIcon open={showPasswordConfirm} />
                  </Pressable>
                }
              />
            </>
          )}

          <View style={styles.field}>
            <TextField
              label="電話番号"
              value={phone}
              onChangeText={setPhone}
              placeholder="09012345678"
              keyboardType="phone-pad"
              editable={false}
              containerStyle={styles.field}
              right={
                !isNewRegistration && onRequestPhoneChange ? (
                  <Pressable
                    onPress={onRequestPhoneChange}
                    disabled={busy}
                    style={[styles.changeButton, busy ? styles.inputDisabled : null]}
                  >
                    <Text style={styles.changeButtonText}>変更</Text>
                  </Pressable>
                ) : null
              }
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>生年月日*</Text>
            <Pressable
              onPress={(e) => openBirthDatePicker(e)}
              disabled={busy}
              style={[styles.selectRow, busy ? styles.inputDisabled : null]}
              accessibilityRole="button"
            >
              <Text style={[styles.dateText, birthDate.trim() ? null : styles.datePlaceholder]}>{birthDate.trim() || '選択してください'}</Text>
              <ChevronDownIcon />
            </Pressable>
            {attemptedSubmit && !birthDate.trim() ? <Text style={styles.inlineError}>生年月日は必須です</Text> : null}
            {attemptedSubmit && birthDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim()) ? (
              <Text style={styles.inlineError}>形式が正しくありません（YYYY-MM-DD）</Text>
            ) : null}
          </View>
        </Section>

        {!isNewRegistration ? (
          <Section title="好きなドラマ・映画のジャンル（複数選択）*">
            {favoriteGenres.length > 0 ? (
              <Text style={styles.hintText}>選択中：{favoriteGenres.join(' / ')}</Text>
            ) : (
              <Text style={styles.hintText}>1つ以上選択してください</Text>
            )}

            {attemptedSubmit && favoriteGenres.length < 1 ? (
              <Text style={styles.inlineError}>好きなジャンルは1つ以上選択してください</Text>
            ) : null}

            {allGenreOptions.map((group) => (
              <View key={group.title} style={styles.genreGroup}>
                <Text style={styles.genreGroupTitle}>{group.title}</Text>
                <View style={styles.genreWrap}>
                  {group.options.map((label) => {
                    const selected = favoriteGenres.includes(label)
                    return (
                      <Chip key={label} label={label} selected={selected} onPress={busy ? undefined : () => toggleGenre(label)} />
                    )
                  })}
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {isNewRegistration ? (
          <View style={styles.singleButton}>
            <PrimaryButton label="登録" onPress={handleSave} disabled={!canSubmit} />
          </View>
        ) : (
          <View style={styles.buttons}>
            <SecondaryButton label="キャンセル" onPress={handleBack} disabled={busy || avatarUploading} />
            <View style={styles.spacer} />
            <PrimaryButton label="完了" onPress={handleSave} disabled={!canSubmit} fullWidth={false} />
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
  leadText: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  inlineError: {
    marginTop: 6,
    color: THEME.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
  },
  changeButtonText: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  avatarBlock: {
    alignItems: 'center',
  },
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'hidden',
  },
  avatarButtonWrap: {
    width: '100%',
    marginTop: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  field: {
    marginBottom: 14,
  },
  staticValue: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
  genreGroup: {
    marginTop: 10,
  },
  genreGroupTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  dateText: {
    color: THEME.text,
    fontSize: 13,
    lineHeight: 18,
  },
  datePlaceholder: {
    color: THEME.textMuted,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  selectRow: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 10,
    textAlign: 'right',
  },
  hintText: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 11,
  },
  singleButton: {
    marginTop: 12,
    paddingBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingBottom: 20,
  },
  spacer: {
    width: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
    padding: 16,
  },
  modalTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
})
