import { useCallback, useMemo, useState } from 'react'
import { Alert, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Path, Svg } from 'react-native-svg'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { Chip, PrimaryButton, ScreenContainer, SecondaryButton, Section, TextField, THEME } from '../components'
import { isValidEmail } from '../utils/validators'

type UserProfileEditScreenProps = {
  apiBaseUrl: string
  onBack: () => void
  onRequestEmailChange?: () => void
  onRequestPhoneChange?: () => void
  onSave: (opts: {
    displayName: string
    fullName: string
    fullNameKana: string
    email: string
    phone: string
    birthDate: string
    favoriteGenres: string[]
    password?: string
    avatarUrl?: string
  }) => Promise<void>
  initialDisplayName?: string
  initialFullName?: string
  initialFullNameKana?: string
  initialEmail?: string
  initialPhone?: string
  initialBirthDate?: string
  initialFavoriteGenres?: string[]
  initialAvatarUrl?: string
  initialUserId?: string
  isNewRegistration?: boolean
}

const GENRE_GROUPS: Array<{ title: string; options: string[] }> = [
  {
    title: '🎬 定番・王道ジャンル',
    options: ['アクション', 'アドベンチャー', 'SF', 'ファンタジー', 'ミステリー', 'サスペンス', 'スリラー', 'ホラー', 'パニック', 'クライム（犯罪）', 'スパイ・諜報もの'],
  },
  {
    title: '❤️ 感情・人間ドラマ系',
    options: ['恋愛（ラブストーリー）', 'ヒューマンドラマ', '家族ドラマ', '青春', '成長物語', '感動系', '切ない系', '泣ける作品', '心温まる系'],
  },
  {
    title: '😂 コメディ・ライト系',
    options: ['コメディ', 'ラブコメ', 'ブラックコメディ', 'ドタバタコメディ', '日常系', 'ゆる系', 'ほのぼの系'],
  },
  {
    title: '🧠 知的・重厚系',
    options: ['社会派', '政治ドラマ', '法廷ドラマ', '医療ドラマ', '経済・ビジネス', '実話・実録ベース', '歴史ドラマ', '時代劇'],
  },
  {
    title: '🔮 特殊設定・尖り系',
    options: ['タイムトラベル', 'パラレルワールド', 'デスゲーム', 'サバイバル', 'ディストピア', '終末世界', 'クローズドサークル', '一話完結型', '群像劇'],
  },
  {
    title: '🧑‍🤝‍🧑 キャラクター・関係性重視',
    options: ['バディもの', 'チームもの', '群像劇', 'ライバル関係', '師弟関係', '女性主人公', '男性主人公', '子供が活躍する作品'],
  },
  {
    title: '🌍 世界観・舞台別',
    options: ['日本作品', '海外作品', 'アジアドラマ', '韓国ドラマ', '中国ドラマ', 'ヨーロッパ作品', 'ハリウッド映画'],
  },
  {
    title: '🎥 フォーマット・作風',
    options: ['短編ドラマ', '長編映画', 'シリーズもの', 'シーズン制', '原作あり（漫画・小説）', 'オリジナル作品', '低予算インディーズ', 'アート系・実験的'],
  },
  {
    title: '🔥 テーマ・刺激強め',
    options: ['バイオレンス強め', 'ダークな世界観', '心理描写重視', '倫理観を問う', 'どんでん返し系', '考察したくなる作品'],
  },
  {
    title: '👨‍👩‍👧‍👦 視聴シーン別（地味に便利）',
    options: ['一人でじっくり観たい', '家族で観られる', '子供と一緒に観たい', '気軽に流し見', '一気見したい', '寝る前に観たい'],
  },
]

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

  const canSubmit = useMemo(() => {
    if (busy || avatarUploading) return false

    if (isNewRegistration) {
      const birthDateTrimmed = birthDate.trim()
      return (
        !!displayName.trim() &&
        isValidEmail(email) &&
        !!phone.trim() &&
        password.trim().length >= 8 &&
        password === passwordConfirm &&
        !!birthDateTrimmed &&
        /^\d{4}-\d{2}-\d{2}$/.test(birthDateTrimmed) &&
        true
      )
    }

    const changingPassword = password.trim().length > 0 || passwordConfirm.trim().length > 0
    if (changingPassword) {
      if (password.trim().length < 8) return false
      if (password !== passwordConfirm) return false
      return true
    }

    return hasChanges
  }, [busy, avatarUploading, isNewRegistration, displayName, fullName, fullNameKana, email, phone, birthDate, favoriteGenres, password, passwordConfirm, hasChanges])

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
    if (!displayName.trim()) {
      Alert.alert('エラー', '表示名を入力してください')
      return
    }
    if (!isValidEmail(email)) {
      Alert.alert('エラー', 'メールアドレスの形式が正しくありません')
      return
    }
    if (!phone.trim()) {
      Alert.alert('エラー', '電話番号が不明です')
      return
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
    if (!birthDateTrimmed) {
      Alert.alert('エラー', '生年月日を入力してください')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateTrimmed)) {
      Alert.alert('エラー', '生年月日の形式が正しくありません（YYYY-MM-DDで入力）')
      return
    }

    // Check if birthDate is in the future
    if (birthDateTrimmed) {
      const birth = new Date(birthDateTrimmed)
      const today = new Date()
      if (birth > today) {
        Alert.alert('エラー', '生年月日は今日以前の日付を選択してください')
        return
      }
    }

    if (!isNewRegistration && favoriteGenres.length < 1) {
      Alert.alert('エラー', '好きなドラマ・映画のジャンルを1つ以上選択してください')
      return
    }

    setBusy(true)
    try {
      await onSave({
        displayName: displayName.trim(),
        fullName: fullName.trim(),
        fullNameKana: fullNameKana.trim(),
        email: email.trim(),
        phone: phone.trim(),
        birthDate: birthDateTrimmed,
        favoriteGenres,
        password: changingPassword && password ? password : undefined,
        avatarUrl: avatarUrl || undefined,
      })
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }, [displayName, fullName, fullNameKana, email, phone, birthDate, favoriteGenres, password, passwordConfirm, avatarUrl, isNewRegistration, onSave])

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
            label="表示名（ニックネーム）"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="推しドラ太郎"
            editable={!busy}
            maxLength={20}
            countText={`${displayName.length}/20`}
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
            <Text style={styles.label}>生年月日</Text>
            <Pressable
              onPress={(e) => openBirthDatePicker(e)}
              disabled={busy}
              style={[styles.selectRow, busy ? styles.inputDisabled : null]}
              accessibilityRole="button"
            >
              <Text style={[styles.dateText, birthDate.trim() ? null : styles.datePlaceholder]}>{birthDate.trim() || '選択してください'}</Text>
              <ChevronDownIcon />
            </Pressable>
          </View>
        </Section>

        {!isNewRegistration ? (
          <Section title="好きなドラマ・映画のジャンル（複数選択）">
            {favoriteGenres.length > 0 ? (
              <Text style={styles.hintText}>選択中：{favoriteGenres.join(' / ')}</Text>
            ) : (
              <Text style={styles.hintText}>1つ以上選択してください</Text>
            )}

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
