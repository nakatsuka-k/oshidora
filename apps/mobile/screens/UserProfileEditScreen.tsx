import { useCallback, useMemo, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { isValidEmail } from '../utils/validators'

type UserProfileEditScreenProps = {
  apiBaseUrl: string
  onBack: () => void
  onSave: (opts: {
    displayName: string
    email: string
    phone: string
    birthDate: string
    password?: string
    avatarUrl?: string
  }) => Promise<void>
  initialDisplayName?: string
  initialEmail?: string
  initialPhone?: string
  initialBirthDate?: string
  initialAvatarUrl?: string
  isNewRegistration?: boolean
}

export function UserProfileEditScreen({
  apiBaseUrl,
  onBack,
  onSave,
  initialDisplayName = '',
  initialEmail = '',
  initialPhone = '',
  initialBirthDate = '',
  initialAvatarUrl = '',
  isNewRegistration = false,
}: UserProfileEditScreenProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [birthDate, setBirthDate] = useState(initialBirthDate)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [busy, setBusy] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const hasChanges = useMemo(() => {
    return (
      displayName !== initialDisplayName ||
      email !== initialEmail ||
      phone !== initialPhone ||
      birthDate !== initialBirthDate ||
      avatarUrl !== initialAvatarUrl
    )
  }, [displayName, email, phone, birthDate, avatarUrl, initialDisplayName, initialEmail, initialPhone, initialBirthDate, initialAvatarUrl])

  const canSubmit = useMemo(() => {
    if (busy || avatarUploading) return false

    if (isNewRegistration) {
      const birthDateTrimmed = birthDate.trim()
      return (
        !!displayName.trim() &&
        isValidEmail(email) &&
        !!phone.trim() &&
        !!birthDateTrimmed &&
        /^\d{4}-\d{2}-\d{2}$/.test(birthDateTrimmed) &&
        password.trim().length >= 8 &&
        password === passwordConfirm
      )
    }

    return hasChanges
  }, [busy, avatarUploading, isNewRegistration, displayName, email, phone, birthDate, password, passwordConfirm, hasChanges])

  const handleBack = useCallback(() => {
    if (hasChanges) {
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
        const uploadResp = await fetch(`${apiBaseUrl}/v1/r2/assets/${fileName}`, {
          method: 'PUT',
          headers: {
            'Content-Type': mimeType,
          },
          body: blob,
        })

        if (!uploadResp.ok) {
          const text = await uploadResp.text().catch(() => '')
          throw new Error(text || 'アップロードに失敗しました')
        }

        const data = (await uploadResp.json().catch(() => null)) as { publicUrl?: string } | null
        const url = data?.publicUrl
        if (!url) throw new Error('アップロードの応答が不正です')
        setAvatarUrl(url)
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
    if (isNewRegistration && !password.trim()) {
      Alert.alert('エラー', 'パスワードを設定してください')
      return
    }
    if (isNewRegistration && password.length < 8) {
      Alert.alert('エラー', 'パスワードは8文字以上で設定してください')
      return
    }
    if (isNewRegistration && password !== passwordConfirm) {
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

    setBusy(true)
    try {
      await onSave({
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        birthDate: birthDateTrimmed,
        password: isNewRegistration && password ? password : undefined,
        avatarUrl: avatarUrl || undefined,
      })
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }, [displayName, email, phone, birthDate, password, passwordConfirm, avatarUrl, isNewRegistration, onSave])

  return (
    <ScreenContainer title={isNewRegistration ? 'プロフィール登録' : 'ユーザープロフィール編集'} onBack={handleBack} scroll maxWidth={520}>
      <View style={styles.root}>
        {isNewRegistration && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>あと少しで利用開始できます。プロフィールを登録してください。</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プロフィール画像</Text>
          <Pressable onPress={handlePickImage} disabled={busy || avatarUploading} style={styles.avatarBox}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarPlaceholder}>画像を選択</Text>
            )}
            {!avatarUploading && <Text style={styles.avatarButtonLabel}>{avatarUrl ? '変更' : '選択'}</Text>}
            {avatarUploading && <Text style={styles.avatarButtonLabel}>アップロード中...</Text>}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本情報</Text>

          <View style={styles.field}>
            <Text style={styles.label}>表示名（ニックネーム）</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="推しドラ太郎"
              placeholderTextColor={THEME.textMuted}
              editable={!busy}
              maxLength={20}
              style={styles.input}
            />
            <Text style={styles.count}>{displayName.length}/20</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="example@example.com"
              placeholderTextColor={THEME.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!busy && !isNewRegistration}
              style={[styles.input, busy || isNewRegistration ? styles.inputDisabled : null]}
            />
            {isNewRegistration && <Text style={styles.hintText}>※ 認証済みのメールアドレスです（変更は別フロー）</Text>}
          </View>

          {isNewRegistration && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>パスワード</Text>
                <View style={styles.passwordInput}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="8文字以上"
                    placeholderTextColor={THEME.textMuted}
                    secureTextEntry={!showPassword}
                    editable={!busy}
                    style={styles.passwordField}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} disabled={busy}>
                    <Text style={styles.passwordToggle}>{showPassword ? '非表示' : '表示'}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>パスワード（確認）</Text>
                <View style={styles.passwordInput}>
                  <TextInput
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    placeholder="パスワードを再度入力"
                    placeholderTextColor={THEME.textMuted}
                    secureTextEntry={!showPasswordConfirm}
                    editable={!busy}
                    style={styles.passwordField}
                  />
                  <Pressable onPress={() => setShowPasswordConfirm(!showPasswordConfirm)} disabled={busy}>
                    <Text style={styles.passwordToggle}>{showPasswordConfirm ? '非表示' : '表示'}</Text>
                  </Pressable>
                </View>
                {password && passwordConfirm && password !== passwordConfirm && (
                  <Text style={styles.errorText}>パスワードが一致しません</Text>
                )}
              </View>
            </>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>電話番号</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="09012345678"
              placeholderTextColor={THEME.textMuted}
              keyboardType="phone-pad"
              editable={!busy && !isNewRegistration}
              style={[styles.input, !isNewRegistration && !busy ? null : styles.inputDisabled]}
            />
            {isNewRegistration && <Text style={styles.hintText}>※ SMS認証で確定した番号です</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>生年月日（YYYY-MM-DD）</Text>
            <TextInput
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="1990-01-15"
              placeholderTextColor={THEME.textMuted}
              editable={!busy}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.buttons}>
          <SecondaryButton label={isNewRegistration ? 'キャンセル' : 'キャンセル'} onPress={handleBack} disabled={busy || avatarUploading} />
          <View style={styles.spacer} />
          <PrimaryButton label={isNewRegistration ? '登録' : '完了'} onPress={handleSave} disabled={!canSubmit} fullWidth={false} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: THEME.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '500',
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
  avatarBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  avatarPlaceholder: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  avatarButtonLabel: {
    position: 'absolute',
    bottom: 8,
    color: THEME.accent,
    fontSize: 11,
    fontWeight: '700',
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
  inputDisabled: {
    opacity: 0.6,
  },
  passwordInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordField: {
    flex: 1,
    color: THEME.text,
    fontSize: 13,
  },
  passwordToggle: {
    color: THEME.accent,
    fontSize: 11,
    fontWeight: '600',
    paddingLeft: 8,
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
  errorText: {
    marginTop: 4,
    color: THEME.danger,
    fontSize: 11,
    fontWeight: '600',
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
})
