import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { SelectField } from '../../app/components/SelectField'
import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { cmsFetchJson, type CmsApiConfig } from '../../lib/cmsApi'
import { isValidEmail } from '../../lib/validation'

type AdminRow = { id: string; name: string; email: string; role: string; disabled: boolean }

export function AdminsListScreen({
  cfg,
  onOpenDetail,
  onNew,
}: {
  cfg: CmsApiConfig
  onOpenDetail: (id: string) => void
  onNew: () => void
}) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<AdminRow[]>([])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/admins')
        if (!mounted) return
        setRows(
          (json.items ?? []).map((a) => ({
            id: String(a.id ?? ''),
            name: String(a.name ?? ''),
            email: String(a.email ?? ''),
            role: String(a.role ?? 'Admin'),
            disabled: Boolean(a.disabled),
          }))
        )
      } catch (e) {
        if (!mounted) return
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        if (!mounted) return
        setBusy(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>管理者一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {busy ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読み込み中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{`${r.email} / ${r.role}${r.disabled ? ' / 無効' : ''}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>管理者がありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

export function AdminEditScreen({
  cfg,
  title,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  title: string
  id: string
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Admin')
  const [disabled, setDisabled] = useState(false)
  const [password, setPassword] = useState('')

  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) {
      setName('')
      setEmail('')
      setRole('Admin')
      setDisabled(false)
      setPassword('')
      return
    }

    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/admins/${encodeURIComponent(id)}`)
        if (!mounted) return
        const a = json.item
        setName(String(a?.name ?? ''))
        setEmail(String(a?.email ?? ''))
        setRole(String(a?.role ?? 'Admin'))
        setDisabled(Boolean(a?.disabled))
      } catch (e) {
        if (!mounted) return
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        if (!mounted) return
        setBusy(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg, id])

  const onSave = useCallback(() => {
    if (!name.trim()) {
      setBanner('氏名を入力してください')
      return
    }
    if (!isValidEmail(email)) {
      setBanner('メールアドレスが不正です')
      return
    }
    if (!id && !password.trim()) {
      setBanner('パスワードを入力してください')
      return
    }

    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const payload: any = { name, email, role, disabled }
        if (password.trim()) payload.password = password

        if (id) {
          await cmsFetchJson(cfg, `/cms/admins/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/admins', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }

        setPassword('')
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, disabled, email, id, name, onBack, password, role])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>入力</Text>
        {id ? (
          <View style={styles.field}>
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>氏名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>メールアドレス</Text>
          <TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
        </View>
        <SelectField label="権限" value={role} placeholder="選択" options={[{ label: 'Admin', value: 'Admin' }]} onChange={setRole} />
        <View style={styles.field}>
          <Text style={styles.label}>{id ? 'パスワード（変更時のみ）' : 'パスワード'}</Text>
          <TextInput value={password} onChangeText={setPassword} style={styles.input} autoCapitalize="none" secureTextEntry />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>無効化</Text>
          <Switch value={disabled} onValueChange={setDisabled} />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}
