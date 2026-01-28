import { useCallback, useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import { STORAGE_EMAIL_KEY } from '../../constants/storage'
import { safeLocalStorageSet } from '../../lib/storage'
import { isValidEmail } from '../../lib/validation'

export function LoginScreen({
  apiBase,
  mock,
  onLoggedIn,
  initialBanner,
  onForgotPassword,
}: {
  apiBase: string
  mock: boolean
  onLoggedIn: (token: string, remember: boolean) => void
  initialBanner: string
  onForgotPassword: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)

  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(initialBanner)

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0 && !busy, [busy, email, password])

  const loginViaApi = useCallback(async (): Promise<string> => {
    if (!apiBase) throw new Error('通信に失敗しました。時間をおいて再度お試しください')

    const res = await fetch(`${apiBase}/cms/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(mock ? { 'X-Mock': '1' } : {}) },
      body: JSON.stringify({ email: email.trim(), password, remember }),
    })

    const json = (await res.json().catch(() => ({}))) as any
    if (!res.ok) {
      throw new Error(json && json.error ? String(json.error) : 'メールアドレスまたはパスワードが違います')
    }

    const token = json && typeof json.token === 'string' ? json.token : ''
    if (!token) throw new Error('通信に失敗しました。時間をおいて再度お試しください')
    return token
  }, [apiBase, email, mock, password, remember])

  const loginMock = useCallback(async (): Promise<string> => {
    if (email.toLowerCase() === 'admin@example.com' && password === 'password') {
      return `mock-token-${Math.random().toString(36).slice(2)}`
    }
    throw new Error('メールアドレスまたはパスワードが違います')
  }, [email, password])

  const onSubmit = useCallback(async () => {
    setBanner('')
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setBanner('メールアドレスを入力してください')
      return
    }
    if (!isValidEmail(normalizedEmail)) {
      setBanner('メールアドレスの形式が正しくありません')
      return
    }
    if (!password) {
      setBanner('パスワードを入力してください')
      return
    }

    setBusy(true)
    try {
      const token = await (async () => {
        try {
          return await loginViaApi()
        } catch (e) {
          if (mock) return await loginMock()
          throw e
        }
      })()
      safeLocalStorageSet(STORAGE_EMAIL_KEY, normalizedEmail)
      onLoggedIn(token, remember)
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }, [email, loginMock, loginViaApi, mock, onLoggedIn, password, remember])

  return (
    <View style={styles.loginRoot}>
      <View style={styles.loginCard}>
        <Text style={styles.loginTitle}>ログイン</Text>
        <Text style={styles.loginDesc}>管理画面にログインします</Text>

        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="admin@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>パスワード</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="パスワード"
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <Pressable onPress={() => setRemember((v) => !v)} style={[styles.check, remember ? styles.checkOn : null]}>
              <View style={[styles.checkBox, remember ? styles.checkBoxOn : null]} />
              <Text style={styles.checkText}>ログイン状態を保持</Text>
            </Pressable>

            <Pressable onPress={onForgotPassword} style={styles.linkBtn}>
              <Text style={styles.linkText}>パスワードを忘れた</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable
              disabled={!canSubmit}
              onPress={() => void onSubmit()}
              style={[styles.btnPrimary, !canSubmit ? styles.btnDisabled : null]}
            >
              <Text style={styles.btnPrimaryText}>{busy ? 'ログイン中…' : 'ログイン'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}
