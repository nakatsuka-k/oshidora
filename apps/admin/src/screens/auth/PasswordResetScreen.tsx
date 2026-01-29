import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'

function getTokenFromLocation(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''

  try {
    const url = new URL(window.location.href)
    const q = String(url.searchParams.get('token') || '').trim()
    if (q) return q
  } catch {
    // ignore
  }

  const rawHash = String(window.location.hash || '')
  const i = rawHash.indexOf('?')
  if (i >= 0) {
    const qs = rawHash.slice(i + 1)
    try {
      const params = new URLSearchParams(qs)
      return String(params.get('token') || '').trim()
    } catch {
      return ''
    }
  }

  return ''
}

export function PasswordResetScreen({
  apiBase,
  mock,
  onGoLogin,
}: {
  apiBase: string
  mock: boolean
  onGoLogin: () => void
}) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  useEffect(() => {
    setToken(getTokenFromLocation())
  }, [])

  const requestReset = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, '')}/cms/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(mock ? { 'X-Mock': '1' } : {}) },
        body: JSON.stringify({ email: email.trim() }),
      })
      const json = (await res.json().catch(() => ({}))) as any
      if (!res.ok) throw new Error(json?.error ? String(json.error) : '送信に失敗しました')
      setBanner(
        json?.debugLink
          ? `再設定用のメールを送信しました（DEBUG: ${String(json.debugLink)}）`
          : '再設定用のメールを送信しました（届かない場合は設定やメールアドレスを確認してください）'
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBase, email, mock])

  const submitNewPassword = useCallback(async () => {
    if (!token) {
      setBanner('トークンがありません')
      return
    }
    if (!newPassword || newPassword.length < 8) {
      setBanner('パスワードは8文字以上で入力してください')
      return
    }
    if (newPassword !== newPassword2) {
      setBanner('パスワードが一致しません')
      return
    }

    setBusy(true)
    setBanner('')
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, '')}/cms/auth/reset-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(mock ? { 'X-Mock': '1' } : {}) },
        body: JSON.stringify({ token, newPassword }),
      })
      const json = (await res.json().catch(() => ({}))) as any
      if (!res.ok) throw new Error(json?.error ? String(json.error) : '再設定に失敗しました')
      setBanner('パスワードを再設定しました。ログインしてください。')
      setNewPassword('')
      setNewPassword2('')
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBase, mock, newPassword, newPassword2, token])

  return (
    <View style={styles.loginRoot}>
      <View style={styles.loginCard}>
        <Text style={styles.loginTitle}>パスワード再発行</Text>
        <Text style={styles.loginDesc}>管理者パスワードを再設定します</Text>

        {!token ? (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>メールアドレス</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="admin@example.com" autoCapitalize="none" style={styles.input} />
            </View>
            <View style={styles.actions}>
              <Pressable
                disabled={busy || !email.trim()}
                onPress={() => void requestReset()}
                style={[styles.btnPrimary, busy || !email.trim() ? styles.btnDisabled : null]}
              >
                <Text style={styles.btnPrimaryText}>{busy ? '送信中…' : '再設定メールを送信'}</Text>
              </Pressable>
              <Pressable onPress={onGoLogin} style={styles.btnSecondary}>
                <Text style={styles.btnSecondaryText}>ログインへ戻る</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>新しいパスワード（8文字以上）</Text>
              <TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" style={styles.input} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>新しいパスワード（確認）</Text>
              <TextInput value={newPassword2} onChangeText={setNewPassword2} secureTextEntry autoCapitalize="none" style={styles.input} />
            </View>
            <View style={styles.actions}>
              <Pressable disabled={busy} onPress={() => void submitNewPassword()} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
                <Text style={styles.btnPrimaryText}>{busy ? '処理中…' : 'パスワードを再設定'}</Text>
              </Pressable>
              <Pressable onPress={onGoLogin} style={styles.btnSecondary}>
                <Text style={styles.btnSecondaryText}>ログインへ戻る</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
