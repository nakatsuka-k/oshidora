import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Platform,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'

type Screen = 'login' | 'app'

type RouteId =
  | 'login'
  | 'dev'
  | 'dashboard'
  | 'works'
  | 'videos'
  | 'castStaff'
  | 'comments'
  | 'coin'
  | 'users'
  | 'inquiries'
  | 'settings'

type SidebarItem = {
  id: RouteId
  label: string
}

const STORAGE_KEY = 'oshidra_admin_token_v1'
const STORAGE_EMAIL_KEY = 'oshidra_admin_email_v1'
const STORAGE_DEV_MODE_KEY = 'oshidra_admin_dev_mode_v1'
const STORAGE_API_OVERRIDE_KEY = 'oshidra_admin_api_base_override_v1'
const STORAGE_DEV_POS_KEY = 'oshidra_admin_dev_pos_v1'

function isValidEmail(email: string): boolean {
  const v = email.trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function getRouteFromHash(): RouteId {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'login'
  const raw = (window.location.hash || '').replace(/^#/, '').trim()
  const path = raw.replace(/^\//, '').trim()
  const first = path.split('?')[0].split('#')[0].split('/')[0]
  const key = (first || 'login').toLowerCase()

  switch (key) {
    case 'dev':
      return 'dev'
    case 'dashboard':
      return 'dashboard'
    case 'works':
      return 'works'
    case 'videos':
      return 'videos'
    case 'caststaff':
      return 'castStaff'
    case 'comments':
      return 'comments'
    case 'coin':
      return 'coin'
    case 'users':
      return 'users'
    case 'inquiries':
      return 'inquiries'
    case 'settings':
      return 'settings'
    default:
      return 'login'
  }
}

function getRouteFromPathname(): RouteId | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  const raw = (window.location.pathname || '').trim()
  const path = raw.replace(/^\//, '').trim()
  if (!path || path === 'index.html') return null

  const first = path.split('?')[0].split('#')[0].split('/')[0]
  const key = (first || '').toLowerCase()

  switch (key) {
    case 'dev':
      return 'dev'
    case 'dashboard':
      return 'dashboard'
    case 'works':
      return 'works'
    case 'videos':
      return 'videos'
    case 'caststaff':
      return 'castStaff'
    case 'comments':
      return 'comments'
    case 'coin':
      return 'coin'
    case 'users':
      return 'users'
    case 'inquiries':
      return 'inquiries'
    case 'settings':
      return 'settings'
    case 'login':
      return 'login'
    default:
      return null
  }
}

function getRouteFromLocation(): RouteId {
  return getRouteFromPathname() ?? getRouteFromHash()
}

function setHashRoute(route: RouteId): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  const next = route === 'login' ? '#/login' : `#/${route}`
  if (window.location.hash === next) return
  window.location.hash = next
}

function setPathRoute(route: RouteId): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  const nextPath = route === 'login' ? '/login' : route === 'dashboard' ? '/dashboard' : `/${route}`
  if (window.location.pathname === nextPath) return
  window.history.pushState({}, '', nextPath + window.location.search + window.location.hash)
}

function getApiBaseFromLocation(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''

  const override = safeLocalStorageGet(STORAGE_API_OVERRIDE_KEY).trim()
  if (override) return override.replace(/\/$/, '')

  const url = new URL(window.location.href)
  const q = String(url.searchParams.get('api') || '').trim()
  return q ? q.replace(/\/$/, '') : ''
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function safeLocalStorageGet(key: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''
  try {
    return String(window.localStorage.getItem(key) || '')
  } catch {
    return ''
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function safeLocalStorageRemove(key: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function AppHeader({ adminName, onLogout }: { adminName: string; onLogout: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerLogo}>oshidora</Text>

      <View style={styles.headerRight}>
        <Text style={styles.headerUser} numberOfLines={1}>
          {adminName || '管理者'}
        </Text>
        <Pressable onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>ログアウト</Text>
        </Pressable>
      </View>
    </View>
  )
}

function Sidebar({ items, activeId, onNavigate }: { items: SidebarItem[]; activeId: RouteId; onNavigate: (id: RouteId) => void }) {
  return (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>管理メニュー</Text>
      <View style={styles.sidebarDivider} />
      <View style={styles.sidebarList}>
        {items.map((it) => (
          <Pressable
            key={it.id}
            onPress={() => onNavigate(it.id)}
            style={[styles.sidebarItem, activeId === it.id ? styles.sidebarItemActive : null]}
          >
            <Text style={[styles.sidebarItemText, activeId === it.id ? styles.sidebarItemTextActive : null]}>{it.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

type KPIItem = {
  id: string
  label: string
  value: string
  route: RouteId
}

type ActivityItem = {
  id: string
  label: string
  detail: string
  pendingCount?: number
  route: RouteId
}

function DashboardScreen({ onNavigate }: { onNavigate: (id: RouteId) => void }) {
  const kpis = useMemo<KPIItem[]>(
    () => [
      { id: 'users_total', label: '総ユーザー数', value: '—', route: 'users' },
      { id: 'users_today', label: '本日の新規登録', value: '—', route: 'users' },
      { id: 'works_published', label: '公開中作品数', value: '—', route: 'works' },
      { id: 'videos_published', label: '公開中動画数', value: '—', route: 'videos' },
      { id: 'plays_today', label: '本日の再生回数', value: '—', route: 'videos' },
      { id: 'coins_spent_today', label: '本日のコイン消費', value: '—', route: 'coin' },
    ],
    []
  )

  const activities = useMemo<ActivityItem[]>(
    () => [
      { id: 'a_comments_new', label: '新規投稿されたコメント', detail: '最新5件', pendingCount: 0, route: 'comments' },
      { id: 'a_comments_report', label: 'コメント通報', detail: '未対応', pendingCount: 0, route: 'comments' },
      { id: 'a_cast_staff', label: 'キャスト・スタッフ新規登録', detail: '直近', pendingCount: 0, route: 'castStaff' },
      { id: 'a_coin_withdraw', label: 'コイン換金申請', detail: '未処理', pendingCount: 0, route: 'coin' },
      { id: 'a_inquiries', label: 'お問い合わせ', detail: '未対応', pendingCount: 0, route: 'inquiries' },
    ],
    []
  )

  const shortcuts = useMemo<Array<{ id: string; label: string; route: RouteId }>>(
    () => [
      { id: 's_add_work', label: '作品を追加', route: 'works' },
      { id: 's_add_video', label: '動画を追加', route: 'videos' },
      { id: 's_comment_approve', label: 'コメント承認', route: 'comments' },
      { id: 's_cast_register', label: 'キャスト登録', route: 'castStaff' },
      { id: 's_coin_withdraw', label: 'コイン換金処理', route: 'coin' },
      { id: 's_inquiries', label: 'お問い合わせ確認', route: 'inquiries' },
    ],
    []
  )

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>ダッシュボード</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>サマリー情報</Text>
        <View style={styles.kpiGrid}>
          {kpis.map((it) => (
            <Pressable key={it.id} onPress={() => onNavigate(it.route)} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{it.label}</Text>
              <Text style={styles.kpiValue}>{it.value}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近のアクティビティ</Text>
        <View style={styles.table}>
          {activities.map((a) => (
            <Pressable key={a.id} onPress={() => onNavigate(a.route)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{a.label}</Text>
                <Text style={styles.tableDetail}>{a.detail}</Text>
              </View>
              <View style={styles.tableRight}>
                {typeof a.pendingCount === 'number' ? (
                  <Text style={[styles.pendingText, a.pendingCount > 0 ? styles.pendingTextEmph : null]}>
                    未対応 {a.pendingCount}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>管理ショートカット</Text>
        <View style={styles.shortcutGrid}>
          {shortcuts.map((s) => (
            <Pressable key={s.id} onPress={() => onNavigate(s.route)} style={styles.shortcutCard}>
              <Text style={styles.shortcutText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>{title}</Text>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>未実装</Text>
      </View>
    </ScrollView>
  )
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  options: Array<{ label: string; value: string }>
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value)
    return hit ? hit.label : ''
  }, [options, value])

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.selectWrap}>
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.selectBtn}>
          <Text style={styles.selectText}>{selectedLabel || placeholder}</Text>
        </Pressable>
        {open ? (
          <View style={styles.selectMenu}>
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                style={styles.selectMenuItem}
              >
                <Text style={styles.selectMenuText}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

type VideoRow = {
  id: string
  title: string
  workName: string
  episodeLabel: string
  kind: '本編' | 'ショート'
  subtitles: 'あり' | 'なし'
  status: '公開' | '非公開'
  views: number
  rating: number
  createdAt: string
}

function VideoListScreen() {
  const works = useMemo(() => ['全て', '作品A', '作品B'], [])

  const [qTitle, setQTitle] = useState('')
  const [qWork, setQWork] = useState('')
  const [qStatus, setQStatus] = useState('')
  const [qSubtitles, setQSubtitles] = useState('')
  const [qKind, setQKind] = useState('')
  const [qFrom, setQFrom] = useState('')
  const [qTo, setQTo] = useState('')

  const [rows, setRows] = useState<VideoRow[]>(() => [
    {
      id: 'V000001',
      title: 'サンプル動画（本編）',
      workName: '作品A',
      episodeLabel: '第1話',
      kind: '本編',
      subtitles: 'あり',
      status: '公開',
      views: 1234,
      rating: 4.2,
      createdAt: '2026-01-10 12:34',
    },
    {
      id: 'V000002',
      title: 'サンプル動画（ショート）',
      workName: '作品A',
      episodeLabel: 'ショート',
      kind: 'ショート',
      subtitles: 'なし',
      status: '非公開',
      views: 88,
      rating: 3.8,
      createdAt: '2026-01-09 08:00',
    },
    {
      id: 'V000003',
      title: '別作品の動画',
      workName: '作品B',
      episodeLabel: '第2話',
      kind: '本編',
      subtitles: 'なし',
      status: '公開',
      views: 540,
      rating: 4.7,
      createdAt: '2026-01-08 20:15',
    },
  ])

  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const pageSize = 20

  const reset = useCallback(() => {
    setQTitle('')
    setQWork('')
    setQStatus('')
    setQSubtitles('')
    setQKind('')
    setQFrom('')
    setQTo('')
    setPage(1)
  }, [])

  const filtered = useMemo(() => {
    const title = qTitle.trim()
    return rows.filter((r) => {
      if (title && !r.title.includes(title)) return false
      if (qWork && qWork !== '全て' && r.workName !== qWork) return false
      if (qStatus && r.status !== qStatus) return false
      if (qSubtitles && r.subtitles !== qSubtitles) return false
      if (qKind && r.kind !== qKind) return false
      if (qFrom && r.createdAt.slice(0, 10) < qFrom) return false
      if (qTo && r.createdAt.slice(0, 10) > qTo) return false
      return true
    })
  }, [qFrom, qKind, qStatus, qSubtitles, qTitle, qTo, qWork, rows])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length])

  const pageRows = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages)
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, totalPages])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const togglePublish = useCallback(
    (id: string) => {
      const row = rows.find((r) => r.id === id)
      if (!row) return
      const next = row.status === '公開' ? '非公開' : '公開'
      let ok = true
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
        ok = window.confirm(`${row.title} を「${next}」に切り替えますか？`)
      }
      if (!ok) return
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)))
    },
    [rows]
  )

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>動画一覧</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>検索・絞り込み</Text>
        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>動画タイトル</Text>
            <TextInput value={qTitle} onChangeText={setQTitle} placeholder="部分一致" style={styles.input} />
          </View>

          <SelectField
            label="作品名"
            value={qWork}
            placeholder="選択"
            options={works.map((w) => ({ label: w, value: w }))}
            onChange={setQWork}
          />

          <SelectField
            label="公開状態"
            value={qStatus}
            placeholder="選択"
            options={[
              { label: '全て', value: '' },
              { label: '公開', value: '公開' },
              { label: '非公開', value: '非公開' },
            ]}
            onChange={setQStatus}
          />

          <SelectField
            label="字幕"
            value={qSubtitles}
            placeholder="選択"
            options={[
              { label: '全て', value: '' },
              { label: '字幕あり', value: 'あり' },
              { label: '字幕なし', value: 'なし' },
            ]}
            onChange={setQSubtitles}
          />

          <SelectField
            label="動画種別"
            value={qKind}
            placeholder="選択"
            options={[
              { label: '全て', value: '' },
              { label: '本編', value: '本編' },
              { label: 'ショート', value: 'ショート' },
            ]}
            onChange={setQKind}
          />

          <View style={styles.field}>
            <Text style={styles.label}>登録日（開始）</Text>
            <TextInput value={qFrom} onChangeText={setQFrom} placeholder="YYYY-MM-DD" style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>登録日（終了）</Text>
            <TextInput value={qTo} onChangeText={setQTo} placeholder="YYYY-MM-DD" style={styles.input} />
          </View>
        </View>

        <View style={styles.filterActions}>
          <Pressable onPress={() => setPage(1)} style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>検索</Text>
          </Pressable>
          <Pressable onPress={reset} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>リセット</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>動画一覧</Text>
        <ScrollView horizontal style={styles.tableScroll}>
          <View style={styles.videoTable}>
            <View style={[styles.videoRow, styles.videoHeaderRow]}>
              {[
                '動画ID',
                'サムネイル',
                '動画タイトル',
                '作品名',
                '話数 / 種別',
                '字幕',
                '公開状態',
                '再生回数',
                '評価',
                '登録日',
                '操作',
              ].map((h) => (
                <Text key={h} style={[styles.videoCell, styles.videoHeaderCell]}>
                  {h}
                </Text>
              ))}
            </View>

            {pageRows.map((r) => (
              <View key={r.id} style={[styles.videoRow, r.status === '非公開' ? styles.videoRowDim : null]}>
                <Text style={styles.videoCell}>{r.id}</Text>
                <View style={styles.videoCell}>
                  <View style={styles.thumb} />
                </View>
                <Text style={styles.videoCell}>{r.title}</Text>
                <Text style={styles.videoCell}>{r.workName}</Text>
                <Text style={styles.videoCell}>{`${r.episodeLabel} / ${r.kind}`}</Text>
                <Text style={styles.videoCell}>{r.subtitles}</Text>
                <Text style={styles.videoCell}>{r.status}</Text>
                <Text style={styles.videoCell}>{String(r.views)}</Text>
                <Text style={styles.videoCell}>{r.rating.toFixed(1)}</Text>
                <Text style={styles.videoCell}>{r.createdAt}</Text>
                <View style={[styles.videoCell, styles.actionsCell]}>
                  <Pressable onPress={() => Platform.OS === 'web' && typeof window !== 'undefined' ? window.alert('未実装') : null} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>詳細</Text>
                  </Pressable>
                  <Pressable onPress={() => Platform.OS === 'web' && typeof window !== 'undefined' ? window.alert('未実装') : null} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>編集</Text>
                  </Pressable>
                  <Pressable onPress={() => togglePublish(r.id)} style={styles.smallBtnPrimary}>
                    <Text style={styles.smallBtnPrimaryText}>{r.status === '公開' ? '非公開' : '公開'}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.pagination}>
          <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))} style={styles.pageBtn}>
            <Text style={styles.pageBtnText}>前へ</Text>
          </Pressable>
          <View style={styles.pageJump}>
            <Text style={styles.pageInfo}>{`Page`}</Text>
            <TextInput
              value={pageInput}
              onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ''))}
              keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
              style={styles.pageInput}
              onBlur={() => {
                const n = Math.floor(Number(pageInput || '1'))
                if (!Number.isFinite(n)) {
                  setPageInput(String(page))
                  return
                }
                const next = Math.min(totalPages, Math.max(1, n))
                setPage(next)
              }}
            />
            <Text style={styles.pageInfo}>{`/ ${totalPages}`}</Text>
          </View>
          <Pressable onPress={() => setPage((p) => Math.min(totalPages, p + 1))} style={styles.pageBtn}>
            <Text style={styles.pageBtnText}>次へ</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function DevPage({
  token,
  devMode,
  apiBase,
  adminEmail,
  onSetDevMode,
  onSetApiBase,
  onSetAdminEmail,
  onSetToken,
  onClearToken,
  onNavigate,
  onOpenDevModal,
}: {
  token: string
  devMode: boolean
  apiBase: string
  adminEmail: string
  onSetDevMode: (v: boolean) => void
  onSetApiBase: (v: string) => void
  onSetAdminEmail: (v: string) => void
  onSetToken: (token: string, persist: boolean) => void
  onClearToken: () => void
  onNavigate: (id: RouteId) => void
  onOpenDevModal: () => void
}) {
  const [persist, setPersist] = useState(true)
  const [apiInput, setApiInput] = useState(apiBase)
  const [emailInput, setEmailInput] = useState(adminEmail)

  const routes = useMemo<Array<{ id: RouteId; label: string }>>(
    () => [
      { id: 'dashboard', label: 'ダッシュボード' },
      { id: 'works', label: '作品管理' },
      { id: 'videos', label: '動画一覧' },
      { id: 'castStaff', label: 'キャスト・スタッフ管理' },
      { id: 'comments', label: 'コメント管理' },
      { id: 'coin', label: 'コイン管理' },
      { id: 'users', label: 'ユーザー管理' },
      { id: 'inquiries', label: 'お問い合わせ管理' },
      { id: 'settings', label: '設定' },
    ],
    []
  )

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>/dev</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DEV モード</Text>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>DEV UI を有効化</Text>
          <Switch value={devMode} onValueChange={onSetDevMode} />
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>ログイン状態</Text>
          <Switch
            value={Boolean(token)}
            onValueChange={(v) => {
              if (v) onSetToken(`dev-token-${Math.random().toString(36).slice(2)}`, persist)
              else onClearToken()
            }}
          />
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>ログイン保持</Text>
          <Switch value={persist} onValueChange={setPersist} />
        </View>

        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>管理者メール</Text>
            <TextInput value={emailInput} onChangeText={setEmailInput} placeholder="admin@example.com" style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>API Base Override</Text>
            <TextInput value={apiInput} onChangeText={setApiInput} placeholder="https://..." style={styles.input} />
          </View>
        </View>

        <View style={styles.filterActions}>
          <Pressable
            onPress={() => {
              onSetAdminEmail(emailInput.trim())
              onSetApiBase(apiInput.trim())
            }}
            style={styles.btnPrimary}
          >
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
          <Pressable onPress={onOpenDevModal} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>DEV モーダルを開く</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ページ一覧</Text>
        <View style={styles.table}>
          {routes.map((r) => (
            <Pressable key={r.id} onPress={() => onNavigate(r.id)} style={styles.tableRow}>
              <Text style={styles.tableLabel}>{r.label}</Text>
              <Text style={styles.tableDetail}>{`/${r.id}`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function DevModal({
  visible,
  token,
  apiBase,
  adminEmail,
  onClose,
  onSetToken,
  onClearToken,
  onSetAdminEmail,
  onSetApiBase,
  onNavigate,
  onSkipLogin,
}: {
  visible: boolean
  token: string
  apiBase: string
  adminEmail: string
  onClose: () => void
  onSetToken: (token: string, persist: boolean) => void
  onClearToken: () => void
  onSetAdminEmail: (v: string) => void
  onSetApiBase: (v: string) => void
  onNavigate: (id: RouteId) => void
  onSkipLogin: (persist: boolean) => void
}) {
  const [persist, setPersist] = useState(true)
  const [apiInput, setApiInput] = useState(apiBase)
  const [emailInput, setEmailInput] = useState(adminEmail)

  const initialPos = useMemo(() => {
    const raw = safeLocalStorageGet(STORAGE_DEV_POS_KEY)
    const parsed = safeJsonParse<{ x: number; y: number }>(raw, { x: 24, y: 24 })
    return {
      x: Number.isFinite(parsed.x) ? parsed.x : 24,
      y: Number.isFinite(parsed.y) ? parsed.y : 24,
    }
  }, [])

  const pan = useRef(new Animated.ValueXY({ x: initialPos.x, y: initialPos.y })).current

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: () => {
          const v = (pan as any).__getValue ? (pan as any).__getValue() : { x: 24, y: 24 }
          safeLocalStorageSet(STORAGE_DEV_POS_KEY, JSON.stringify({ x: v.x, y: v.y }))
        },
      }),
    [pan]
  )

  useEffect(() => {
    setApiInput(apiBase)
  }, [apiBase])

  useEffect(() => {
    setEmailInput(adminEmail)
  }, [adminEmail])

  if (!visible) return null

  return (
    <View style={styles.devOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.devModal, { transform: pan.getTranslateTransform() }]} {...panResponder.panHandlers}>
        <View style={styles.devModalHeader}>
          <Text style={styles.devModalTitle}>DEV</Text>
          <Pressable onPress={onClose} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>閉じる</Text>
          </Pressable>
        </View>

        <View style={styles.devModalBody}>
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>ログイン状態</Text>
            <Switch
              value={Boolean(token)}
              onValueChange={(v) => {
                if (v) onSetToken(`dev-token-${Math.random().toString(36).slice(2)}`, persist)
                else onClearToken()
              }}
            />
          </View>

          <View style={styles.devRow}>
            <Text style={styles.devLabel}>ログイン保持</Text>
            <Switch value={persist} onValueChange={setPersist} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>管理者メール</Text>
            <TextInput value={emailInput} onChangeText={setEmailInput} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>API Base Override</Text>
            <TextInput value={apiInput} onChangeText={setApiInput} style={styles.input} />
          </View>

          <View style={styles.filterActions}>
            <Pressable
              onPress={() => {
                onSetAdminEmail(emailInput.trim())
                onSetApiBase(apiInput.trim())
              }}
              style={styles.btnPrimary}
            >
              <Text style={styles.btnPrimaryText}>保存</Text>
            </Pressable>
            <Pressable onPress={() => onNavigate('dev')} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>/dev</Text>
            </Pressable>
          </View>

          {!token ? (
            <Pressable onPress={() => onSkipLogin(persist)} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>ログインスキップ（DEBUG）</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  )
}

function AppShell({
  route,
  adminName,
  onLogout,
  onNavigate,
}: {
  route: RouteId
  adminName: string
  onLogout: () => void
  onNavigate: (id: RouteId) => void
}) {
  const menu = useMemo<SidebarItem[]>(
    () => [
      { id: 'dashboard', label: 'ダッシュボード' },
      { id: 'works', label: '作品管理' },
      { id: 'videos', label: '動画管理' },
      { id: 'castStaff', label: 'キャスト・スタッフ管理' },
      { id: 'comments', label: 'コメント管理' },
      { id: 'coin', label: 'コイン管理' },
      { id: 'users', label: 'ユーザー管理' },
      { id: 'inquiries', label: 'お問い合わせ管理' },
      { id: 'settings', label: '設定' },
    ],
    []
  )

  const content = useMemo(() => {
    switch (route) {
      case 'dev':
        return <PlaceholderScreen title="/dev" />
      case 'dashboard':
        return <DashboardScreen onNavigate={onNavigate} />
      case 'works':
        return <PlaceholderScreen title="作品管理" />
      case 'videos':
        return <VideoListScreen />
      case 'castStaff':
        return <PlaceholderScreen title="キャスト・スタッフ管理" />
      case 'comments':
        return <PlaceholderScreen title="コメント管理" />
      case 'coin':
        return <PlaceholderScreen title="コイン管理" />
      case 'users':
        return <PlaceholderScreen title="ユーザー管理" />
      case 'inquiries':
        return <PlaceholderScreen title="お問い合わせ管理" />
      case 'settings':
        return <PlaceholderScreen title="設定" />
      default:
        return <DashboardScreen onNavigate={onNavigate} />
    }
  }, [onNavigate, route])

  return (
    <View style={styles.dashboardRoot}>
      <Sidebar items={menu} activeId={route} onNavigate={onNavigate} />
      <View style={styles.main}>
        <AppHeader adminName={adminName} onLogout={onLogout} />
        {content}
      </View>
    </View>
  )
}

function LoginScreen({
  apiBase,
  onLoggedIn,
  initialBanner,
  showDebugTools,
  isLoggedIn,
  onDebugToggleLogin,
  onDebugSkipLogin,
  onOpenDevModal,
}: {
  apiBase: string
  onLoggedIn: (token: string, remember: boolean) => void
  initialBanner: string
  showDebugTools: boolean
  isLoggedIn: boolean
  onDebugToggleLogin: (next: boolean, persist: boolean) => void
  onDebugSkipLogin: (persist: boolean) => void
  onOpenDevModal: () => void
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, remember }),
    })

    const json = (await res.json().catch(() => ({}))) as any
    if (!res.ok) {
      throw new Error(json && json.error ? String(json.error) : 'メールアドレスまたはパスワードが違います')
    }

    const token = json && typeof json.token === 'string' ? json.token : ''
    if (!token) throw new Error('通信に失敗しました。時間をおいて再度お試しください')
    return token
  }, [apiBase, email, password, remember])

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
      let token = ''
      try {
        token = await loginViaApi()
      } catch {
        token = await loginMock()
      }
      safeLocalStorageSet(STORAGE_EMAIL_KEY, normalizedEmail)
      onLoggedIn(token, remember)
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }, [email, loginMock, loginViaApi, onLoggedIn, password, remember])

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
            <Pressable
              onPress={() => setRemember((v) => !v)}
              style={[styles.check, remember ? styles.checkOn : null]}
            >
              <View style={[styles.checkBox, remember ? styles.checkBoxOn : null]} />
              <Text style={styles.checkText}>ログイン状態を保持</Text>
            </Pressable>

            <Pressable
              onPress={() => setBanner('パスワード再発行は未実装です')}
              style={styles.linkBtn}
            >
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

            {showDebugTools ? (
              <View style={styles.debugBox}>
                <View style={styles.devRow}>
                  <Text style={styles.devLabel}>DEBUG ツール</Text>
                  <Pressable onPress={onOpenDevModal} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>モーダル</Text>
                  </Pressable>
                </View>

                <View style={styles.devRow}>
                  <Text style={styles.devLabel}>ログイン状態</Text>
                  <Switch value={isLoggedIn} onValueChange={(v) => onDebugToggleLogin(v, remember)} />
                </View>

                <Pressable onPress={() => onDebugSkipLogin(remember)} style={styles.btnSecondary}>
                  <Text style={styles.btnSecondaryText}>ログインスキップ（DEBUG）</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}

export default function App() {
  const apiBase = useMemo(() => getApiBaseFromLocation(), [])

  const [token, setToken] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [screen, setScreen] = useState<Screen>('login')
  const [route, setRoute] = useState<RouteId>('login')
  const [loginBanner, setLoginBanner] = useState('')

  const [devMode, setDevMode] = useState(false)
  const [devModalOpen, setDevModalOpen] = useState(false)

  useEffect(() => {
    const saved = safeLocalStorageGet(STORAGE_KEY)
    const savedEmail = safeLocalStorageGet(STORAGE_EMAIL_KEY)
    const savedDevMode = safeLocalStorageGet(STORAGE_DEV_MODE_KEY)
    const initialRoute = getRouteFromLocation()

    if (savedDevMode === '1') setDevMode(true)

    if (saved) {
      setToken(saved)
      setAdminEmail(savedEmail)
      setScreen('app')
      const initial = initialRoute === 'login' ? 'dashboard' : initialRoute
      setRoute(initial)
      setPathRoute(initial)
      if (initialRoute === 'login') setHashRoute('dashboard')
    } else {
      setRoute(initialRoute)
      setScreen(initialRoute === 'login' ? 'login' : 'app')
      setPathRoute(initialRoute)
      setHashRoute(initialRoute)
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const syncRoute = () => {
      const next = getRouteFromLocation()

      const allowUnauthed = next === 'login' || next === 'dev'

      if (!token && !allowUnauthed) {
        setRoute('login')
        setScreen('login')
        setPathRoute('login')
        setHashRoute('login')
        return
      }

      if (token && next === 'login') {
        setRoute('dashboard')
        setScreen('app')
        setPathRoute('dashboard')
        setHashRoute('dashboard')
        return
      }

      setRoute(next)
      setScreen(next === 'login' ? 'login' : 'app')
    }

    const onHashChange = () => syncRoute()
    const onPopState = () => syncRoute()

    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('popstate', onPopState)
    }
  }, [token])

  const onLoggedIn = useCallback((nextToken: string, remember: boolean) => {
    setToken(nextToken)
    if (remember) safeLocalStorageSet(STORAGE_KEY, nextToken)
    else safeLocalStorageRemove(STORAGE_KEY)
    setAdminEmail(safeLocalStorageGet(STORAGE_EMAIL_KEY))
    setLoginBanner('')
    setScreen('app')
    setRoute('dashboard')
    setPathRoute('dashboard')
    setHashRoute('dashboard')
  }, [])

  const onSkipLogin = useCallback(
    (persist: boolean) => {
      const savedEmail = safeLocalStorageGet(STORAGE_EMAIL_KEY)
      if (!savedEmail) safeLocalStorageSet(STORAGE_EMAIL_KEY, 'admin@example.com')
      onLoggedIn(`dev-token-${Math.random().toString(36).slice(2)}`, persist)
    },
    [onLoggedIn]
  )

  const onLogout = useCallback(() => {
    setToken('')
    setAdminEmail('')
    safeLocalStorageRemove(STORAGE_KEY)
    safeLocalStorageRemove(STORAGE_EMAIL_KEY)
    setRoute('login')
    setScreen('login')
    setLoginBanner('')
    setPathRoute('login')
    setHashRoute('login')
  }, [])

  const onNavigate = useCallback((next: RouteId) => {
    const allowUnauthed = next === 'login' || next === 'dev'
    if (!token && !allowUnauthed) {
      setLoginBanner('セッションが切れました')
      setRoute('login')
      setScreen('login')
      setPathRoute('login')
      setHashRoute('login')
      return
    }
    setRoute(next)
    setPathRoute(next)
    setHashRoute(next)
    setScreen(next === 'login' ? 'login' : 'app')
  }, [token])

  const showDevButton = useMemo(() => devMode || route === 'dev', [devMode, route])

  const onSetDevMode = useCallback((v: boolean) => {
    setDevMode(v)
    safeLocalStorageSet(STORAGE_DEV_MODE_KEY, v ? '1' : '0')
    if (v) setDevModalOpen(true)
  }, [])

  const onSetApiBase = useCallback((v: string) => {
    const next = v.trim().replace(/\/$/, '')
    if (!next) safeLocalStorageRemove(STORAGE_API_OVERRIDE_KEY)
    else safeLocalStorageSet(STORAGE_API_OVERRIDE_KEY, next)
  }, [])

  const onSetAdminEmail = useCallback((v: string) => {
    const next = v.trim()
    setAdminEmail(next)
    if (next) safeLocalStorageSet(STORAGE_EMAIL_KEY, next)
    else safeLocalStorageRemove(STORAGE_EMAIL_KEY)
  }, [])

  const onSetToken = useCallback((nextToken: string, persist: boolean) => {
    setToken(nextToken)
    if (persist) safeLocalStorageSet(STORAGE_KEY, nextToken)
    else safeLocalStorageRemove(STORAGE_KEY)
  }, [])

  const onClearToken = useCallback(() => {
    setToken('')
    safeLocalStorageRemove(STORAGE_KEY)
  }, [])

  const onDebugToggleLogin = useCallback(
    (next: boolean, persist: boolean) => {
      if (next) {
        onSkipLogin(persist)
        return
      }
      onLogout()
    },
    [onLogout, onSkipLogin]
  )

  return (
    <View style={styles.appRoot}>
      {screen === 'login' ? (
        <LoginScreen
          apiBase={apiBase}
          onLoggedIn={onLoggedIn}
          initialBanner={loginBanner}
          showDebugTools={showDevButton}
          isLoggedIn={Boolean(token)}
          onDebugToggleLogin={onDebugToggleLogin}
          onDebugSkipLogin={onSkipLogin}
          onOpenDevModal={() => setDevModalOpen(true)}
        />
      ) : null}
      {screen === 'app' ? (
        route === 'dev' ? (
          <View style={styles.dashboardRoot}>
            <Sidebar
              items={[
                { id: 'dashboard', label: 'ダッシュボード' },
                { id: 'works', label: '作品管理' },
                { id: 'videos', label: '動画管理' },
                { id: 'castStaff', label: 'キャスト・スタッフ管理' },
                { id: 'comments', label: 'コメント管理' },
                { id: 'coin', label: 'コイン管理' },
                { id: 'users', label: 'ユーザー管理' },
                { id: 'inquiries', label: 'お問い合わせ管理' },
                { id: 'settings', label: '設定' },
              ]}
              activeId={'dashboard'}
              onNavigate={onNavigate}
            />
            <View style={styles.main}>
              <AppHeader adminName={adminEmail} onLogout={onLogout} />
              <DevPage
                token={token}
                devMode={devMode}
                apiBase={apiBase}
                adminEmail={adminEmail}
                onSetDevMode={onSetDevMode}
                onSetApiBase={onSetApiBase}
                onSetAdminEmail={onSetAdminEmail}
                onSetToken={onSetToken}
                onClearToken={onClearToken}
                onNavigate={onNavigate}
                onOpenDevModal={() => setDevModalOpen(true)}
              />
            </View>
          </View>
        ) : (
          <AppShell
            route={route}
            adminName={adminEmail}
            onLogout={onLogout}
            onNavigate={onNavigate}
          />
        )
      ) : null}

      {showDevButton ? (
        <Pressable onPress={() => setDevModalOpen(true)} style={styles.devFab}>
          <Text style={styles.devFabText}>DEV</Text>
        </Pressable>
      ) : null}

      <DevModal
        visible={devModalOpen && showDevButton}
        token={token}
        apiBase={apiBase}
        adminEmail={adminEmail}
        onClose={() => setDevModalOpen(false)}
        onSetToken={onSetToken}
        onClearToken={onClearToken}
        onSetAdminEmail={onSetAdminEmail}
        onSetApiBase={onSetApiBase}
        onNavigate={onNavigate}
        onSkipLogin={onSkipLogin}
      />

      {/* token is intentionally unused for now; wiring to API will come later */}
      {token ? null : null}
      <StatusBar style="auto" />
    </View>
  )
}

const COLORS = {
  bg: '#f3f4f6',
  sidebarBg: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
  border: '#d1d5db',
  white: '#ffffff',
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    justifyContent: 'flex-end',
  },
  headerUser: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 280,
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
  },
  logoutText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },

  // Dashboard layout
  dashboardRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
  },
  sidebar: {
    width: '20%',
    minWidth: 220,
    backgroundColor: COLORS.sidebarBg,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  sidebarTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 12,
    marginBottom: 12,
  },
  sidebarList: {
    gap: 8,
  },
  sidebarItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.sidebarBg,
  },
  sidebarItemActive: {
    borderColor: COLORS.text,
    backgroundColor: COLORS.white,
  },
  sidebarItemText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sidebarItemTextActive: {
    fontWeight: '900',
  },
  main: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  devFab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  devFabText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },

  devOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  devModal: {
    width: 360,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  devModalHeader: {
    height: 42,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devModalTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  devModalBody: {
    padding: 12,
    gap: 10,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  devLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },

  debugBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },

  filtersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  filterActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btnSecondary: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  btnSecondaryText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },

  selectWrap: {
    position: 'relative',
  },
  selectBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  selectText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  selectMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    zIndex: 10,
    overflow: 'hidden',
  },
  selectMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectMenuText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },

  tableScroll: {
    width: '100%',
  },
  videoTable: {
    minWidth: 1180,
  },
  videoRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  videoHeaderRow: {
    backgroundColor: COLORS.bg,
  },
  videoRowDim: {
    opacity: 0.6,
  },
  videoCell: {
    width: 110,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  videoHeaderCell: {
    fontWeight: '900',
  },
  thumb: {
    width: 64,
    height: 36,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    backgroundColor: COLORS.bg,
  },
  actionsCell: {
    width: 240,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smallBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
  },
  smallBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  smallBtnPrimary: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.text,
  },
  smallBtnPrimaryText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },
  pagination: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  pageBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
  },
  pageBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  pageInfo: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },

  pageJump: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageInput: {
    width: 64,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },

  contentScroll: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  contentInner: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  pageTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
  },
  section: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    width: '31%',
    minWidth: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: COLORS.white,
    gap: 8,
  },
  kpiLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  kpiValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },

  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tableLeft: {
    flex: 1,
    gap: 4,
  },
  tableLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  tableDetail: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  tableRight: {
    marginLeft: 12,
    alignItems: 'flex-end',
    minWidth: 90,
  },
  pendingText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  pendingTextEmph: {
    color: COLORS.text,
    fontWeight: '900',
  },

  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shortcutCard: {
    width: '31%',
    minWidth: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
  },
  shortcutText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },

  placeholderBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 18,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  placeholderText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },

  // Login
  loginRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  loginCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 18,
    maxWidth: 520,
  },
  loginTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },
  loginDesc: {
    marginTop: 8,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  banner: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  form: {
    marginTop: 14,
    gap: 12,
  },
  field: {
    gap: 8,
  },
  label: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  checkOn: {
    borderColor: COLORS.text,
  },
  checkBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  checkBoxOn: {
    borderColor: COLORS.text,
    backgroundColor: COLORS.text,
  },
  checkText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  linkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  actions: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  btnPrimary: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.text,
  },
  btnPrimaryText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  footer: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
  },
})
