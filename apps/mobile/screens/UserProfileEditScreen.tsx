import { useCallback, useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type UserProfileEditScreenProps = {
  onBack: () => void
  onSave: (opts: { displayName: string; email: string; phone: string; birthDate: string }) => Promise<void>
  initialDisplayName?: string
  initialEmail?: string
  initialPhone?: string
  initialBirthDate?: string
}

export function UserProfileEditScreen({
  onBack,
  onSave,
  initialDisplayName = '',
  initialEmail = '',
  initialPhone = '',
  initialBirthDate = '',
}: UserProfileEditScreenProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [birthDate, setBirthDate] = useState(initialBirthDate)
  const [busy, setBusy] = useState(false)

  const hasChanges = useMemo(() => {
    return (
      displayName !== initialDisplayName ||
      email !== initialEmail ||
      phone !== initialPhone ||
      birthDate !== initialBirthDate
    )
  }, [displayName, email, phone, birthDate, initialDisplayName, initialEmail, initialPhone, initialBirthDate])

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

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert('エラー', '表示名を入力してください')
      return
    }
    if (!email.trim()) {
      Alert.alert('エラー', 'メールアドレスを入力してください')
      return
    }

    setBusy(true)
    try {
      await onSave({
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        birthDate: birthDate.trim(),
      })
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }, [displayName, email, phone, birthDate, onSave])

  return (
    <ScreenContainer title="ユーザープロフィール編集" onBack={handleBack} scroll maxWidth={520}>
      <View style={styles.root}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本情報</Text>

          <View style={styles.field}>
            <Text style={styles.label}>表示名（ニックネーム）</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="表示名を入力"
              placeholderTextColor={THEME.textMuted}
              editable={!busy}
              maxLength={50}
              style={styles.input}
            />
            <Text style={styles.count}>{displayName.length}/50</Text>
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
              editable={!busy}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>電話番号</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="09012345678"
              placeholderTextColor={THEME.textMuted}
              keyboardType="phone-pad"
              editable={!busy}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>生年月日（例：1990-01-15）</Text>
            <TextInput
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={THEME.textMuted}
              editable={!busy}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.buttons}>
          <SecondaryButton label="キャンセル" onPress={handleBack} disabled={busy} />
          <View style={styles.spacer} />
          <PrimaryButton label="完了" onPress={handleSave} disabled={!hasChanges || busy} fullWidth={false} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
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
  count: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 10,
    textAlign: 'right',
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  spacer: {
    width: 10,
  },
})
