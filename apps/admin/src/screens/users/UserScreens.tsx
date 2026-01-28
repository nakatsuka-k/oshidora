import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
  mock: boolean
}

type CmsFetchJson = <T = any>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

type SelectFieldComponent = (props: any) => any

type IsValidEmailFn = (email: string) => boolean

type UserRow = {
  id: string
  email: string
  emailVerified: boolean
  phone: string
  phoneVerified: boolean
  createdAt: string
  kind: 'user' | 'cast'
}

export function UsersListScreen({
  cfg,
  cmsFetchJson,
  styles,
  SelectField,
  onOpenDetail,
  onNew,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  SelectField: SelectFieldComponent
  onOpenDetail: (id: string) => void
  onNew?: () => void
}) {
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<UserRow[]>([])

  const [qKind, setQKind] = useState<'' | 'user' | 'cast'>('')
  const [qSort, setQSort] = useState<'' | 'createdAt' | 'kind'>('')

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const params = new URLSearchParams()
      if (qKind) params.set('kind', qKind)
      if (qSort) params.set('sort', qSort)
      const qs = params.toString()
      const path = qs ? `/cms/users?${qs}` : '/cms/users'

      const json = await cmsFetchJson<{
        items: Array<{ id: string; email: string; emailVerified: boolean; phone: string; phoneVerified: boolean; createdAt: string; kind?: string }>
      }>(cfg, path)
      setRows(
        (json.items ?? []).map((u) => ({
          id: String(u.id ?? ''),
          email: String(u.email ?? ''),
          emailVerified: Boolean((u as any).emailVerified),
          phone: String((u as any).phone ?? ''),
          phoneVerified: Boolean((u as any).phoneVerified),
          createdAt: String((u as any).createdAt ?? ''),
          kind: String((u as any).kind ?? 'user') === 'cast' ? 'cast' : 'user',
        }))
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg, cmsFetchJson, qKind, qSort])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>ユーザー一覧</Text>
        {onNew ? (
          <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
            <Text style={styles.smallBtnPrimaryText}>新規作成</Text>
          </Pressable>
        ) : null}
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>フィルタ</Text>
        <View style={styles.filtersGrid}>
          <SelectField
            label="区分"
            value={qKind}
            placeholder="すべて"
            options={[
              { label: 'すべて', value: '' },
              { label: '一般ユーザー', value: 'user' },
              { label: 'キャスト', value: 'cast' },
            ]}
            onChange={(v: any) => setQKind(v as any)}
          />
          <SelectField
            label="並び順"
            value={qSort}
            placeholder="作成日（新しい順）"
            options={[
              { label: '作成日（新しい順）', value: '' },
              { label: '区分→作成日', value: 'kind' },
            ]}
            onChange={(v: any) => setQSort(v as any)}
          />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={() => void load()} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '読込中…' : '更新'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setQKind('')
              setQSort('')
            }}
            style={styles.btnSecondary}
          >
            <Text style={styles.btnSecondaryText}>リセット</Text>
          </Pressable>
        </View>
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
                <Text style={styles.tableLabel}>{r.email || r.id}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${r.kind === 'cast' ? 'キャスト' : '一般'}${r.createdAt ? ` / ${r.createdAt}` : ''}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>ユーザーがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

export function UserCreateScreen({
  cfg,
  cmsFetchJson,
  isValidEmail,
  styles,
  onBack,
  onCreated,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  isValidEmail: IsValidEmailFn
  styles: any
  onBack: () => void
  onCreated: (id: string) => void
}) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
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
          body: JSON.stringify({ email: normalizedEmail, phone: phone.trim() || undefined, password }),
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
  }, [cfg, cmsFetchJson, email, isValidEmail, onCreated, password, phone])

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

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSubmit} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '作成中…' : '作成'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

export function UserDetailScreen({
  cfg,
  cmsFetchJson,
  styles,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  id: string
  onBack: () => void
}) {
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState<null | {
    id: string
    email: string
    emailVerified: boolean
    phone: string
    phoneVerified: boolean
    createdAt: string
    updatedAt: string
  }>(null)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/users/${encodeURIComponent(id)}`)
        if (!mounted) return
        const u = json.item
        setItem({
          id: String(u?.id ?? id),
          email: String(u?.email ?? ''),
          emailVerified: Boolean(u?.emailVerified),
          phone: String(u?.phone ?? ''),
          phoneVerified: Boolean(u?.phoneVerified),
          createdAt: String(u?.createdAt ?? ''),
          updatedAt: String(u?.updatedAt ?? ''),
        })
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
  }, [cfg, cmsFetchJson, id])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>ユーザー詳細</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本情報</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ユーザーID</Text>
          <Text style={styles.readonlyText}>{item?.id || id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>メールアドレス</Text>
          <Text style={styles.readonlyText}>{item?.email || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>メール認証</Text>
          <Text style={styles.readonlyText}>{item ? (item.emailVerified ? '済' : '未') : busy ? '—' : '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>電話番号</Text>
          <Text style={styles.readonlyText}>{item?.phone || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>電話番号認証</Text>
          <Text style={styles.readonlyText}>{item ? (item.phoneVerified ? '済' : '未') : busy ? '—' : '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>作成日時</Text>
          <Text style={styles.readonlyText}>{item?.createdAt || '—'}</Text>
        </View>
      </View>
    </ScrollView>
  )
}
