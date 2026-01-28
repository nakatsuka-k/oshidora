import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { cmsFetchJson, useCmsApi } from '../../lib/cmsApi'
import { isValidEmail } from '../../lib/validation'
import { styles } from '../../ui/styles'

export function UserCreateScreen({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const cfg = useCmsApi()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [smsAuthSkip, setSmsAuthSkip] = useState(false)
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = useCallback(() => {
    const normalizedEmail = email.trim()
    if (!isValidEmail(normalizedEmail)) {
      setBanner('メールアドレスが不正です')
      return
    }
    if (!password || password.length < 8) {
      setBanner('パスワードは8文字以上で入力してください')
      return
    }

    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const res = await cmsFetchJson<{ ok: boolean; id: string }>(cfg, '/cms/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            phone: phone.trim() || undefined,
            password,
            emailVerified,
            smsAuthSkip,
          }),
        })
        const id = String(res?.id ?? '').trim()
        if (!id) throw new Error('作成に失敗しました')
        onCreated(id)
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, email, emailVerified, onCreated, password, phone, smsAuthSkip])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>ユーザー新規作成</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>入力</Text>
        <View style={styles.field}>
          <Text style={styles.label}>メールアドレス（必須）</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="user@example.com" autoCapitalize="none" style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>電話番号（任意）</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="090..." autoCapitalize="none" style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>初期パスワード（必須 / 8文字以上）</Text>
          <TextInput value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry style={styles.input} />
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>メール認証済みとして作成</Text>
          <Switch value={emailVerified} onValueChange={setEmailVerified} />
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>SMS認証スキップ</Text>
          <Switch value={smsAuthSkip} onValueChange={setSmsAuthSkip} />
        </View>

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSubmit} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '作成中…' : '作成'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}
