import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { useBanner } from '../../lib/banner'
import { CollapsibleSection } from '../../ui/CollapsibleSection'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
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
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<UserRow[]>([])

  const [openQuery, setOpenQuery] = useState(true)
  const [openResults, setOpenResults] = useState(true)

  const [qText, setQText] = useState('')

  const [qKind, setQKind] = useState<'' | 'user' | 'cast'>('')
  const [qSort, setQSort] = useState<'' | 'createdAt' | 'kind'>('')

  const hasFilter = Boolean(qText.trim() || qKind || qSort)

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const params = new URLSearchParams()
      if (qText.trim()) params.set('q', qText.trim())
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
  }, [cfg, cmsFetchJson, qKind, qSort, qText, setBanner])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <View style={{ flex: 1, gap: 6 } as any}>
          <Text style={styles.pageTitle}>ユーザー</Text>
          <Text style={styles.pageSubtitle ?? styles.pageLead}>検索して開く</Text>
        </View>
        {onNew ? (
          <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
            <Text style={styles.smallBtnPrimaryText}>新規作成</Text>
          </Pressable>
        ) : null}
      </View>

      <CollapsibleSection
        title="検索"
        subtitle="メール / 区分"
        open={openQuery}
        onToggle={() => setOpenQuery((v) => !v)}
        styles={styles}
      >

        {!busy && hasFilter && rows.length === 0 ? (
          <View style={styles.warningPill}>
            <Text style={styles.warningPillText}>条件に一致するユーザーが見つかりません</Text>
          </View>
        ) : null}

        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>検索（メール）</Text>
            <TextInput
              value={qText}
              onChangeText={setQText}
              placeholder="user@example.com"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
          <SelectField
            label="区分（キャスト/一般）"
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
            label="表示順"
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
              setQText('')
              setQKind('')
              setQSort('')
            }}
            style={styles.btnSecondary}
          >
            <Text style={styles.btnSecondaryText}>リセット</Text>
          </Pressable>
        </View>
        <Text style={styles.pageLead}>{`表示: ${rows.length}件（最大200件）`}</Text>
      </CollapsibleSection>

      <CollapsibleSection
        title="結果"
        subtitle="一覧"
        open={openResults}
        onToggle={() => setOpenResults((v) => !v)}
        styles={styles}
      >
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
              <View style={styles.tableRight}>
                <Text style={styles.linkText}>詳細</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>ユーザーがありません</Text>
            </View>
          ) : null}
        </View>
      </CollapsibleSection>
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
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [openLogin, setOpenLogin] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  const dirty = Boolean(email.trim() || phone.trim() || password)
  const shouldWarn = dirty && !busy

  useEffect(() => {
    if (!shouldWarn) return
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return
    const handler = (e: any) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [shouldWarn])

  const confirmBack = useCallback(() => {
    if (!shouldWarn) return true
    if (Platform.OS !== 'web') return true
    if (typeof window === 'undefined') return true
    return window.confirm('入力途中です。戻りますか？')
  }, [shouldWarn])

  const onBackSafe = useCallback(() => {
    if (!confirmBack()) return
    onBack()
  }, [confirmBack, onBack])

  const emailNormalized = email.trim()
  const emailError = emailNormalized
    ? !isValidEmail(emailNormalized)
      ? 'メールアドレスの形式をご確認ください'
      : ''
    : 'ログインに使用するメールアドレスを入力してください'
  const passwordError = password ? (password.length < 8 ? '8文字以上のパスワードを設定してください' : '') : 'パスワードを入力してください'

  const showEmailError = (submitted || emailTouched) && Boolean(emailError)
  const showPasswordError = (submitted || passwordTouched) && Boolean(passwordError)
  const missing = [!emailNormalized ? 'メール' : '', !password ? 'パスワード' : ''].filter(Boolean)

  const onSubmit = useCallback(() => {
    setSubmitted(true)
    setEmailTouched(true)
    setPasswordTouched(true)

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) return
    if (!password || password.length < 8) return

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
    <ScrollView style={styles.contentScroll} contentContainerStyle={[styles.contentInner, { paddingBottom: 110 }] as any}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBackSafe} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 6 } as any}>
          <Text style={styles.pageTitle}>ユーザー作成</Text>
          <Text style={styles.pageSubtitle ?? styles.pageLead}>ログイン情報</Text>
          <Text style={styles.pageLead}>以下の情報を入力してください。※後から変更できます。</Text>
        </View>
        {shouldWarn ? <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '800' } as any}>未保存</Text> : null}
      </View>

      <CollapsibleSection
        title="ログイン"
        subtitle="必須を埋める"
        open={openLogin}
        onToggle={() => setOpenLogin((v) => !v)}
        styles={styles}
      >

        {!busy && submitted && missing.length > 0 ? (
          <View style={styles.warningPill}>
            <Text style={styles.warningPillText}>{`未入力: ${missing.join(' / ')}`}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>
            ログイン用メールアドレス <Text style={{ color: '#64748b' } as any}>*</Text>
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="user@example.com"
            autoCapitalize="none"
            onBlur={() => setEmailTouched(true)}
            style={styles.input}
          />
          {showEmailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>電話番号（任意）</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="090..." autoCapitalize="none" style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>
            初期パスワード <Text style={{ color: '#64748b' } as any}>*</Text>
            （8文字以上）
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            onBlur={() => setPasswordTouched(true)}
            style={styles.input}
          />
          {showPasswordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
        </View>
      </CollapsibleSection>

      <View style={styles.stickyBar}>
        <View style={styles.stickyBarInner}>
          <Text style={styles.stickyBarHint}>作成後、詳細へ移動</Text>
          <View style={styles.stickyBarActions}>
            <Pressable disabled={busy} onPress={onBackSafe} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>戻る</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={onSubmit}
              style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}
            >
              <Text style={styles.btnPrimaryText}>{busy ? '作成中…' : '作成'}</Text>
            </Pressable>
          </View>
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
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState<null | {
    id: string
    email: string
    emailVerified: boolean
    phone: string
    phoneVerified: boolean
    smsAuthSkip: boolean
    createdAt: string
    updatedAt: string
  }>(null)

  const [openBasic, setOpenBasic] = useState(true)
  const [openEdit, setOpenEdit] = useState(true)

  const [editMode, setEditMode] = useState(false)
  const [editEmail, setEditEmail] = useState('')
  const [editEmailVerified, setEditEmailVerified] = useState(false)
  const [editPhone, setEditPhone] = useState('')
  const [editPhoneVerified, setEditPhoneVerified] = useState(false)
  const [editSmsAuthSkip, setEditSmsAuthSkip] = useState(false)

  const [initialKey, setInitialKey] = useState('')
  const currentKey = useMemo(() => {
    return JSON.stringify({
      email: editEmail.trim(),
      emailVerified: Boolean(editEmailVerified),
      phone: editPhone.trim(),
      phoneVerified: Boolean(editPhoneVerified),
      smsAuthSkip: Boolean(editSmsAuthSkip),
    })
  }, [editEmail, editEmailVerified, editPhone, editPhoneVerified, editSmsAuthSkip])

  const dirty = editMode && Boolean(initialKey) && initialKey !== currentKey
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const justSaved = Boolean(savedAt && Date.now() - savedAt < 1800)

  const resetEditFromItem = useCallback((u: typeof item) => {
    if (!u) return
    setEditEmail(String(u.email ?? ''))
    setEditEmailVerified(Boolean(u.emailVerified))
    setEditPhone(String(u.phone ?? ''))
    setEditPhoneVerified(Boolean(u.phoneVerified))
    setEditSmsAuthSkip(Boolean((u as any).smsAuthSkip))
    const key = JSON.stringify({
      email: String(u.email ?? '').trim(),
      emailVerified: Boolean(u.emailVerified),
      phone: String(u.phone ?? '').trim(),
      phoneVerified: Boolean(u.phoneVerified),
      smsAuthSkip: Boolean((u as any).smsAuthSkip),
    })
    setInitialKey(key)
  }, [])

  useEffect(() => {
    if (!dirty) return
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return
    const handler = (e: any) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

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
        const next = {
          id: String(u?.id ?? id),
          email: String(u?.email ?? ''),
          emailVerified: Boolean(u?.emailVerified),
          phone: String(u?.phone ?? ''),
          phoneVerified: Boolean(u?.phoneVerified),
          smsAuthSkip: Boolean(u?.smsAuthSkip),
          createdAt: String(u?.createdAt ?? ''),
          updatedAt: String(u?.updatedAt ?? ''),
        }
        setItem(next)
        if (!editMode) resetEditFromItem(next)
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
  }, [cfg, cmsFetchJson, editMode, id, resetEditFromItem, setBanner])

  const onSave = useCallback(() => {
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/users/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: editEmail.trim(),
            emailVerified: Boolean(editEmailVerified),
            phone: editPhone.trim(),
            phoneVerified: Boolean(editPhoneVerified),
            smsAuthSkip: Boolean(editSmsAuthSkip),
          }),
        })

        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/users/${encodeURIComponent(id)}`)
        const u = json.item
        const next = {
          id: String(u?.id ?? id),
          email: String(u?.email ?? ''),
          emailVerified: Boolean(u?.emailVerified),
          phone: String(u?.phone ?? ''),
          phoneVerified: Boolean(u?.phoneVerified),
          smsAuthSkip: Boolean(u?.smsAuthSkip),
          createdAt: String(u?.createdAt ?? ''),
          updatedAt: String(u?.updatedAt ?? ''),
        }
        setItem(next)
        resetEditFromItem(next)
        setSavedAt(Date.now())
        setBanner('保存しました')
        setEditMode(false)
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, editEmail, editEmailVerified, editPhone, editPhoneVerified, editSmsAuthSkip, id, resetEditFromItem, setBanner])

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
        <View style={styles.pageHeaderRow}>
          <Pressable onPress={onBack} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>戻る</Text>
          </Pressable>
          <View style={{ flex: 1, gap: 6 } as any}>
            <Text style={styles.pageTitle}>ユーザー</Text>
            <Text style={styles.pageSubtitle ?? styles.pageLead}>詳細・編集</Text>
          </View>
          {dirty ? <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '800' } as any}>未保存</Text> : null}

          {editMode ? (
            <View style={[styles.row, { gap: 10 } as any]}>
              <Pressable
                disabled={busy}
                onPress={() => {
                  resetEditFromItem(item)
                  setEditMode(false)
                  setBanner('')
                }}
                style={[styles.smallBtn, busy ? styles.btnDisabled : null]}
              >
                <Text style={styles.smallBtnText}>破棄</Text>
              </Pressable>
              <Pressable
                disabled={busy || !dirty}
                onPress={onSave}
                style={[styles.smallBtnPrimary, busy || !dirty ? styles.btnDisabled : null]}
              >
                <Text style={styles.smallBtnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              disabled={busy}
              onPress={() => {
                resetEditFromItem(item)
                setEditMode(true)
                setSavedAt(null)
              }}
              style={[styles.smallBtnPrimary, busy ? styles.btnDisabled : null]}
            >
              <Text style={styles.smallBtnPrimaryText}>編集</Text>
            </Pressable>
          )}
        </View>

        <CollapsibleSection
          title="基本"
          subtitle={item?.email ? item.email : id}
          open={openBasic}
          onToggle={() => setOpenBasic((v) => !v)}
          styles={styles}
        >
          <View style={styles.field}>
            <Text style={styles.label}>ユーザーID</Text>
            <Text style={styles.readonlyText}>{item?.id || id || '—'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>作成日時</Text>
            <Text style={styles.readonlyText}>{item?.createdAt || '—'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>更新日時</Text>
            <Text style={styles.readonlyText}>{item?.updatedAt || '—'}</Text>
          </View>
        </CollapsibleSection>

        <CollapsibleSection
          title="編集"
          subtitle="ログイン情報"
          open={openEdit}
          onToggle={() => setOpenEdit((v) => !v)}
          styles={styles}
          badges={
            justSaved
              ? [{ kind: 'saved', label: '保存しました' }]
              : dirty
                ? [{ kind: 'dirty', label: '未保存' }]
                : undefined
          }
        >
          <View style={styles.field}>
            <Text style={styles.label}>メールアドレス</Text>
            {editMode ? (
              <TextInput value={editEmail} onChangeText={setEditEmail} autoCapitalize="none" style={styles.input} />
            ) : (
              <Text style={styles.readonlyText}>{item?.email || '—'}</Text>
            )}
          </View>

          <View style={styles.devRow}>
            <Text style={styles.devLabel}>メール認証</Text>
            <Switch disabled={!editMode} value={editEmailVerified} onValueChange={setEditEmailVerified} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>電話番号</Text>
            {editMode ? (
              <TextInput value={editPhone} onChangeText={setEditPhone} autoCapitalize="none" style={styles.input} />
            ) : (
              <Text style={styles.readonlyText}>{item?.phone || '—'}</Text>
            )}
          </View>

          <View style={styles.devRow}>
            <Text style={styles.devLabel}>電話番号認証</Text>
            <Switch disabled={!editMode} value={editPhoneVerified} onValueChange={setEditPhoneVerified} />
          </View>

          <View style={styles.devRow}>
            <Text style={styles.devLabel}>SMS認証スキップ</Text>
            <Switch disabled={!editMode} value={editSmsAuthSkip} onValueChange={setEditSmsAuthSkip} />
          </View>
        </CollapsibleSection>
      </ScrollView>
    </View>
  )
}
