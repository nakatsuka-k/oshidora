import { StatusBar } from 'expo-status-bar'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Image,
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
  // 動画管理
  | 'videos-scheduled'
  | 'videos-scheduled-detail'
  | 'videos'
  | 'video-categories'
  | 'video-tags'
  | 'video-detail'
  | 'video-upload'
  | 'unapproved-videos'
  | 'unapproved-video-detail'
  | 'recommend'
  | 'pickup'
  // 作品管理
  | 'works'
  | 'work-detail'
  | 'work-new'
  // コメント管理
  | 'comments-pending'
  | 'comment-approve'
  | 'comments'
  | 'comment-edit'
  // ユーザー管理
  | 'users'
  | 'user-detail'
  // お知らせ
  | 'notices'
  | 'notice-detail'
  | 'notice-new'
  // ランキング
  | 'ranking-videos'
  | 'ranking-coins'
  | 'ranking-actors'
  | 'ranking-directors'
  | 'ranking-writers'
  // マスタ管理
  | 'categories'
  | 'category-detail'
  | 'category-new'
  | 'tags'
  | 'tag-edit'
  | 'tag-new'
  | 'coin'
  | 'coin-setting-detail'
  | 'coin-setting-new'
  // 管理者
  | 'admins'
  | 'admin-detail'
  | 'admin-new'
  // その他
  | 'castStaff'
  | 'inquiries'
  | 'inquiry-detail'
  | 'settings'

type SidebarEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; id: RouteId; label: string; indent?: number }

const STORAGE_KEY = 'oshidra_admin_token_v1'
const STORAGE_EMAIL_KEY = 'oshidra_admin_email_v1'
const STORAGE_DEV_MODE_KEY = 'oshidra_admin_dev_mode_v1'
const STORAGE_API_OVERRIDE_KEY = 'oshidra_admin_api_base_override_v1'
const STORAGE_DEV_POS_KEY = 'oshidra_admin_dev_pos_v1'
const STORAGE_DEBUG_OVERLAY_POS_KEY = 'oshidra_admin_debug_overlay_pos_v1'

type CmsApiConfig = {
  apiBase: string
  token: string
}

const CmsApiContext = createContext<CmsApiConfig | null>(null)

function useCmsApi() {
  const v = useContext(CmsApiContext)
  if (!v) throw new Error('CMS API is not configured')
  return v
}

function csvToIdList(text: string): string[] {
  return (text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function cmsFetchJson<T>(cfg: CmsApiConfig, path: string, init?: RequestInit): Promise<T> {
  const base = (cfg.apiBase || '').replace(/\/$/, '')
  if (!base) throw new Error('API Base が未設定です')
  if (!cfg.token) throw new Error('セッションが切れました')

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${cfg.token}`,
    },
  })
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok) {
    const msg = json && json.error ? String(json.error) : '通信に失敗しました。時間をおいて再度お試しください'
    throw new Error(msg)
  }
  return json as T
}

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
    case 'videos-scheduled':
      return 'videos-scheduled'
    case 'videos-scheduled-detail':
      return 'videos-scheduled-detail'
    case 'works':
      return 'works'
    case 'work-detail':
      return 'work-detail'
    case 'work-new':
      return 'work-new'
    case 'videos':
      return 'videos'
    case 'video-categories':
      return 'video-categories'
    case 'video-tags':
      return 'video-tags'
    case 'video-detail':
      return 'video-detail'
    case 'video-upload':
      return 'video-upload'
    case 'unapproved-videos':
      return 'unapproved-videos'
    case 'unapproved-video-detail':
      return 'unapproved-video-detail'
    case 'recommend':
      return 'recommend'
    case 'pickup':
      return 'pickup'
    case 'caststaff':
      return 'castStaff'
    case 'comments-pending':
      return 'comments-pending'
    case 'comment-approve':
      return 'comment-approve'
    case 'comments':
      return 'comments'
    case 'comment-edit':
      return 'comment-edit'
    case 'coin':
      return 'coin'
    case 'coin-setting-detail':
      return 'coin-setting-detail'
    case 'coin-setting-new':
      return 'coin-setting-new'
    case 'users':
      return 'users'
    case 'user-detail':
      return 'user-detail'
    case 'notices':
      return 'notices'
    case 'notice-detail':
      return 'notice-detail'
    case 'notice-new':
      return 'notice-new'
    case 'ranking-videos':
      return 'ranking-videos'
    case 'ranking-coins':
      return 'ranking-coins'
    case 'ranking-actors':
      return 'ranking-actors'
    case 'ranking-directors':
      return 'ranking-directors'
    case 'ranking-writers':
      return 'ranking-writers'
    case 'categories':
      return 'categories'
    case 'category-detail':
      return 'category-detail'
    case 'category-new':
      return 'category-new'
    case 'tags':
      return 'tags'
    case 'tag-edit':
      return 'tag-edit'
    case 'tag-new':
      return 'tag-new'
    case 'admins':
      return 'admins'
    case 'admin-detail':
      return 'admin-detail'
    case 'admin-new':
      return 'admin-new'
    case 'inquiries':
      return 'inquiries'
    case 'inquiry-detail':
      return 'inquiry-detail'
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
    case 'videos-scheduled':
      return 'videos-scheduled'
    case 'videos-scheduled-detail':
      return 'videos-scheduled-detail'
    case 'works':
      return 'works'
    case 'work-detail':
      return 'work-detail'
    case 'work-new':
      return 'work-new'
    case 'videos':
      return 'videos'
    case 'video-detail':
      return 'video-detail'
    case 'video-upload':
      return 'video-upload'
    case 'unapproved-videos':
      return 'unapproved-videos'
    case 'unapproved-video-detail':
      return 'unapproved-video-detail'
    case 'recommend':
      return 'recommend'
    case 'pickup':
      return 'pickup'
    case 'caststaff':
      return 'castStaff'
    case 'comments-pending':
      return 'comments-pending'
    case 'comment-approve':
      return 'comment-approve'
    case 'comments':
      return 'comments'
    case 'comment-edit':
      return 'comment-edit'
    case 'coin':
      return 'coin'
    case 'coin-setting-detail':
      return 'coin-setting-detail'
    case 'coin-setting-new':
      return 'coin-setting-new'
    case 'users':
      return 'users'
    case 'user-detail':
      return 'user-detail'
    case 'notices':
      return 'notices'
    case 'notice-detail':
      return 'notice-detail'
    case 'notice-new':
      return 'notice-new'
    case 'ranking-videos':
      return 'ranking-videos'
    case 'ranking-coins':
      return 'ranking-coins'
    case 'ranking-actors':
      return 'ranking-actors'
    case 'ranking-directors':
      return 'ranking-directors'
    case 'ranking-writers':
      return 'ranking-writers'
    case 'categories':
      return 'categories'
    case 'category-detail':
      return 'category-detail'
    case 'category-new':
      return 'category-new'
    case 'tags':
      return 'tags'
    case 'tag-edit':
      return 'tag-edit'
    case 'tag-new':
      return 'tag-new'
    case 'admins':
      return 'admins'
    case 'admin-detail':
      return 'admin-detail'
    case 'admin-new':
      return 'admin-new'
    case 'inquiries':
      return 'inquiries'
    case 'inquiry-detail':
      return 'inquiry-detail'
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
  if (q) return q.replace(/\/$/, '')

  // Default (production)
  // Local development can override via ?api=http://localhost:8787 or API Base Override in /dev.
  return 'https://api.oshidra.com'
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

function Sidebar({ entries, activeId, onNavigate }: { entries: SidebarEntry[]; activeId: RouteId; onNavigate: (id: RouteId) => void }) {
  return (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>管理メニュー</Text>
      <View style={styles.sidebarDivider} />
      <ScrollView
        style={[styles.sidebarList, Platform.OS === 'web' ? ({ overflowY: 'auto' } as any) : null]}
        contentContainerStyle={styles.sidebarListContent}
        showsVerticalScrollIndicator
      >
        {entries.map((it, idx) => {
          if (it.kind === 'group') {
            return (
              <Text key={`group-${idx}-${it.label}`} style={styles.sidebarGroupTitle}>
                {it.label}
              </Text>
            )
          }

          return (
            <Pressable
              key={it.id}
              onPress={() => onNavigate(it.id)}
              style={[
                styles.sidebarItem,
                it.indent ? { paddingLeft: 18 + it.indent * 12 } : null,
                activeId === it.id ? styles.sidebarItemActive : null,
              ]}
            >
              <Text style={[styles.sidebarItemText, activeId === it.id ? styles.sidebarItemTextActive : null]}>{it.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

function sidebarActiveRoute(route: RouteId): RouteId {
  switch (route) {
    case 'videos-scheduled-detail':
      return 'videos-scheduled'
    case 'video-detail':
      return 'videos'
    case 'unapproved-video-detail':
      return 'unapproved-videos'
    case 'work-detail':
    case 'work-new':
      return 'works'
    case 'comment-approve':
      return 'comments-pending'
    case 'comment-edit':
      return 'comments'
    case 'user-detail':
      return 'users'
    case 'notice-detail':
    case 'notice-new':
      return 'notices'
    case 'category-detail':
    case 'category-new':
      return 'categories'
    case 'tag-edit':
    case 'tag-new':
      return 'tags'
    case 'coin-setting-detail':
    case 'coin-setting-new':
      return 'coin'
    case 'admin-detail':
    case 'admin-new':
      return 'admins'
    case 'inquiry-detail':
      return 'inquiries'
    default:
      return route
  }
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
  thumbnailUrl: string
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

function VideoListScreen({ onOpenDetail, onGoUpload }: { onOpenDetail: (id: string) => void; onGoUpload: () => void }) {
  const cfg = useCmsApi()
  const [works, setWorks] = useState<Array<{ id: string; title: string }>>([])
  const workNames = useMemo(() => ['全て', ...works.map((w) => w.title || w.id)], [works])

  const [qTitle, setQTitle] = useState('')
  const [qWork, setQWork] = useState('')
  const [qStatus, setQStatus] = useState('')
  const [qSubtitles, setQSubtitles] = useState('')
  const [qKind, setQKind] = useState('')
  const [qFrom, setQFrom] = useState('')
  const [qTo, setQTo] = useState('')

  const [rows, setRows] = useState<VideoRow[]>([])
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const [worksJson, videosJson] = await Promise.all([
          cmsFetchJson<{ items: Array<{ id: string; title: string }> }>(cfg, '/cms/works'),
          cmsFetchJson<{
            items: Array<{ id: string; title: string; workId: string; workTitle: string; thumbnailUrl: string; published: boolean; createdAt: string }>
          }>(cfg, '/cms/videos'),
        ])
        if (!mounted) return
        setWorks(worksJson.items)
        setRows(
          videosJson.items.map((v) => ({
            id: v.id,
            thumbnailUrl: v.thumbnailUrl || '',
            title: v.title,
            workName: v.workTitle || v.workId,
            episodeLabel: '—',
            kind: '本編',
            subtitles: 'なし',
            status: v.published ? '公開' : '非公開',
            views: 0,
            rating: 0,
            createdAt: String(v.createdAt || '').slice(0, 19).replace('T', ' '),
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

      setBusy(true)
      setBanner('')
      void (async () => {
        try {
          await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ published: next === '公開' }),
          })
          setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)))
        } catch (e) {
          setBanner(e instanceof Error ? e.message : String(e))
        } finally {
          setBusy(false)
        }
      })()
    },
    [cfg, rows]
  )

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>動画一覧</Text>
        <Pressable onPress={onGoUpload} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>動画アップロード</Text>
        </Pressable>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

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
            options={workNames.map((w) => ({ label: w, value: w }))}
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
                  {r.thumbnailUrl ? (
                    <Image source={{ uri: r.thumbnailUrl }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumb} />
                  )}
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
                  <Pressable onPress={() => onOpenDetail(r.id)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>詳細</Text>
                  </Pressable>
                  <Pressable onPress={() => onOpenDetail(r.id)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>編集</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => togglePublish(r.id)} style={[styles.smallBtnPrimary, busy ? styles.btnDisabled : null]}>
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

type UnapprovedVideoRow = {
  id: string
  requestedAt: string
  title: string
  submitter: string
  desiredScheduledAt: string
  status: '未承認'
}

function UnapprovedVideosListScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const cfg = useCmsApi()
  const [rows, setRows] = useState<UnapprovedVideoRow[]>([])
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{
          items: Array<{ id: string; title: string; approvalRequestedAt: string | null; scheduledAt: string | null; submitterEmail: string }>
        }>(cfg, '/cms/videos/unapproved')
        if (!mounted) return
        setRows(
          json.items.map((v) => ({
            id: v.id,
            requestedAt: (v.approvalRequestedAt || '').slice(0, 19).replace('T', ' ') || '—',
            title: v.title || '—',
            submitter: v.submitterEmail || '—',
            desiredScheduledAt: (v.scheduledAt || '').slice(0, 19).replace('T', ' ') || '—',
            status: '未承認',
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
        <Text style={styles.pageTitle}>未承認動画一覧</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>未承認動画はありません</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.title}</Text>
                <Text style={styles.tableDetail}>{`${r.requestedAt} / ${r.submitter} / 希望: ${r.desiredScheduledAt} / ${r.status}`}</Text>
              </View>
              <View style={styles.tableRight}>
                <Text style={styles.linkText}>詳細</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function UnapprovedVideoDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState<
    | null
    | {
        id: string
        title: string
        description: string
        submitterEmail: string
        approvalRequestedAt: string | null
        scheduledAt: string | null
        thumbnailUrl: string
        streamVideoId: string
      }
  >(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/videos/unapproved/${encodeURIComponent(id)}`)
        if (!mounted) return
        setItem({
          id: String(json.item?.id ?? ''),
          title: String(json.item?.title ?? ''),
          description: String(json.item?.description ?? ''),
          submitterEmail: String(json.item?.submitterEmail ?? ''),
          approvalRequestedAt: json.item?.approvalRequestedAt ?? null,
          scheduledAt: json.item?.scheduledAt ?? null,
          thumbnailUrl: String(json.item?.thumbnailUrl ?? ''),
          streamVideoId: String(json.item?.streamVideoId ?? ''),
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
  }, [cfg, id])

  const approve = useCallback(() => {
    let ok = true
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      ok = window.confirm('この動画を承認しますか？')
    }
    if (!ok) return

    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/unapproved/${encodeURIComponent(id)}/approve`, { method: 'POST' })
        onBack()
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, id, onBack])

  const reject = useCallback(() => {
    const reason = rejectReason.trim()
    if (!reason) {
      setBanner('否認理由を入力してください')
      return
    }
    let ok = true
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      ok = window.confirm('この動画を否認しますか？')
    }
    if (!ok) return

    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/unapproved/${encodeURIComponent(id)}/reject`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
        onBack()
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, id, onBack, rejectReason])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>未承認動画 詳細</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>動画情報</Text>
        <View style={styles.field}>
          <Text style={styles.label}>動画ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>タイトル</Text>
          <Text style={styles.readonlyText}>{item?.title || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <Text style={styles.readonlyText}>{item?.description || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>提出者</Text>
          <Text style={styles.readonlyText}>{item?.submitterEmail || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>承認依頼日</Text>
          <Text style={styles.readonlyText}>{(item?.approvalRequestedAt || '').slice(0, 19).replace('T', ' ') || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>配信希望日</Text>
          <Text style={styles.readonlyText}>{(item?.scheduledAt || '').slice(0, 19).replace('T', ' ') || '—'}</Text>
        </View>
        {item?.thumbnailUrl ? (
          <View style={styles.field}>
            <Text style={styles.label}>サムネ</Text>
            <Image source={{ uri: item.thumbnailUrl }} style={{ width: 240, height: 135, borderRadius: 8, backgroundColor: '#111' }} />
          </View>
        ) : null}
        {item?.streamVideoId ? (
          <View style={styles.field}>
            <Text style={styles.label}>Stream Video ID</Text>
            <Text style={styles.readonlyText}>{item.streamVideoId}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>操作</Text>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={approve} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '処理中…' : '承認'}</Text>
          </Pressable>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>否認理由（必須）</Text>
          <TextInput value={rejectReason} onChangeText={setRejectReason} style={[styles.input, { minHeight: 90 }]} multiline />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={reject} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>{busy ? '処理中…' : '否認'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type ScheduledVideoRow = { id: string; title: string; scheduledAt: string; status: '配信予約' | '取消' }

function ScheduledVideosListScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const [rows] = useState<ScheduledVideoRow[]>(() => [
    { id: 'S0001', title: '配信予定：作品A 第1話', scheduledAt: '2026-01-15 20:00', status: '配信予約' },
    { id: 'S0002', title: '配信予定：作品B 第2話', scheduledAt: '2026-01-16 21:30', status: '配信予約' },
  ])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>配信予定動画一覧</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.title}</Text>
                <Text style={styles.tableDetail}>{`${r.scheduledAt} / ${r.status}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function ScheduledVideoDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [scheduledAt, setScheduledAt] = useState('2026-01-15 20:00')
  const [canceled, setCanceled] = useState(false)

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>配信予定動画 詳細・編集</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>表示/編集</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>配信予定日時</Text>
          <TextInput value={scheduledAt} onChangeText={setScheduledAt} style={styles.input} />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>配信キャンセル</Text>
          <Switch value={canceled} onValueChange={setCanceled} />
        </View>
        <View style={styles.filterActions}>
          <Pressable style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function VideoDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [title, setTitle] = useState('')
  const [workId, setWorkId] = useState('')
  const [desc, setDesc] = useState('')
  const [streamVideoId, setStreamVideoId] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [categoryIdsText, setCategoryIdsText] = useState('')
  const [tagIdsText, setTagIdsText] = useState('')
  const [castIdsText, setCastIdsText] = useState('')
  const [published, setPublished] = useState(true)
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const [workOptions, setWorkOptions] = useState<Array<{ label: string; value: string }>>([])
  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<{ id: string; title: string }> }>(cfg, '/cms/works')
        if (!mounted) return
        setWorkOptions(json.items.map((w) => ({ label: w.title || w.id, value: w.id })))
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg])

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{
          item: {
            id: string
            workId: string
            title: string
            description: string
            streamVideoId: string
            thumbnailUrl: string
            scheduledAt: string | null
            published: boolean
            categoryIds: string[]
            tagIds: string[]
            castIds: string[]
          }
        }>(cfg, `/cms/videos/${encodeURIComponent(id)}`)
        if (!mounted) return
        setWorkId(json.item.workId || '')
        setTitle(json.item.title || '')
        setDesc(json.item.description || '')
        setStreamVideoId(json.item.streamVideoId || '')
        setThumbnailUrl(json.item.thumbnailUrl || '')
        setScheduledAt(json.item.scheduledAt || '')
        setPublished(Boolean(json.item.published))
        setCategoryIdsText((json.item.categoryIds || []).join(', '))
        setTagIdsText((json.item.tagIds || []).join(', '))
        setCastIdsText((json.item.castIds || []).join(', '))
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
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workId,
            title,
            description: desc,
            streamVideoId,
            thumbnailUrl,
            scheduledAt,
            published,
            categoryIds: csvToIdList(categoryIdsText),
            tagIds: csvToIdList(tagIdsText),
            castIds: csvToIdList(castIdsText),
          }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [castIdsText, categoryIdsText, cfg, desc, id, published, scheduledAt, streamVideoId, tagIdsText, thumbnailUrl, title, workId])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>動画詳細・編集</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        <View style={styles.field}>
          <Text style={styles.label}>動画ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <SelectField label="作品" value={workId} placeholder="選択" options={workOptions} onChange={setWorkId} />
        <View style={styles.field}>
          <Text style={styles.label}>タイトル</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <TextInput value={desc} onChangeText={setDesc} style={[styles.input, { minHeight: 110 }]} multiline />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID</Text>
          <TextInput value={streamVideoId} onChangeText={setStreamVideoId} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネURL</Text>
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>配信予定日時（ISO文字列）</Text>
          <TextInput value={scheduledAt} onChangeText={setScheduledAt} placeholder="2026-01-15T20:00:00Z" style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>公開</Text>
          <Switch value={published} onValueChange={setPublished} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>カテゴリID（カンマ区切り）</Text>
          <TextInput value={categoryIdsText} onChangeText={setCategoryIdsText} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>タグID（カンマ区切り）</Text>
          <TextInput value={tagIdsText} onChangeText={setTagIdsText} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>出演者ID（カンマ区切り）</Text>
          <TextInput value={castIdsText} onChangeText={setCastIdsText} style={styles.input} autoCapitalize="none" />
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

function VideoUploadScreen({ onBack }: { onBack: () => void }) {
  const cfg = useCmsApi()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [workId, setWorkId] = useState('')
  const [streamVideoId, setStreamVideoId] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [publish, setPublish] = useState(false)

  const [categoryIdsText, setCategoryIdsText] = useState('')
  const [tagIdsText, setTagIdsText] = useState('')
  const [castIdsText, setCastIdsText] = useState('')

  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const [workOptions, setWorkOptions] = useState<Array<{ label: string; value: string }>>([])
  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<{ id: string; title: string }> }>(cfg, '/cms/works')
        if (!mounted) return
        setWorkOptions(json.items.map((w) => ({ label: w.title || w.id, value: w.id })))
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg])

  const onCreate = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, '/cms/videos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workId,
            title,
            description: desc,
            streamVideoId,
            thumbnailUrl,
            published: publish,
            categoryIds: csvToIdList(categoryIdsText),
            tagIds: csvToIdList(tagIdsText),
            castIds: csvToIdList(castIdsText),
          }),
        })
        setBanner('登録しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [castIdsText, categoryIdsText, cfg, desc, publish, streamVideoId, tagIdsText, thumbnailUrl, title, workId])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>動画アップロード</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>入力</Text>
        <SelectField label="作品" value={workId} placeholder="選択" options={workOptions} onChange={setWorkId} />
        <View style={styles.field}>
          <Text style={styles.label}>タイトル</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <TextInput value={desc} onChangeText={setDesc} style={[styles.input, { minHeight: 110 }]} multiline />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID</Text>
          <TextInput value={streamVideoId} onChangeText={setStreamVideoId} placeholder="Cloudflare Stream の videoId" style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネURL</Text>
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://..." style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>公開（簡易）</Text>
          <Switch value={publish} onValueChange={setPublish} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>カテゴリID（カンマ区切り）</Text>
          <TextInput value={categoryIdsText} onChangeText={setCategoryIdsText} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>タグID（カンマ区切り）</Text>
          <TextInput value={tagIdsText} onChangeText={setTagIdsText} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>出演者ID（カンマ区切り）</Text>
          <TextInput value={castIdsText} onChangeText={setCastIdsText} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onCreate} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '登録中…' : '登録'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type WorkRow = { id: string; title: string; published: boolean }

function WorksListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew: () => void }) {
  const cfg = useCmsApi()
  const [rows, setRows] = useState<WorkRow[]>([])
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<{ id: string; title: string; published: boolean }> }>(cfg, '/cms/works')
        if (!mounted) return
        setRows(json.items.map((w) => ({ id: w.id, title: w.title, published: Boolean(w.published) })))
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
        <Text style={styles.pageTitle}>作品一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規作成</Text>
        </Pressable>
      </View>
      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}
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
                <Text style={styles.tableLabel}>{r.title}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${r.published ? '公開' : '非公開'}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function WorkEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [workTitle, setWorkTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [categoryIdsText, setCategoryIdsText] = useState('')
  const [tagIdsText, setTagIdsText] = useState('')
  const [castIdsText, setCastIdsText] = useState('')
  const [published, setPublished] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{
          item: {
            id: string
            title: string
            description: string
            thumbnailUrl: string
            published: boolean
            categoryIds: string[]
            tagIds: string[]
            castIds: string[]
          }
        }>(cfg, `/cms/works/${encodeURIComponent(id)}`)
        if (!mounted) return
        setWorkTitle(json.item.title || '')
        setDesc(json.item.description || '')
        setThumbnailUrl(json.item.thumbnailUrl || '')
        setPublished(Boolean(json.item.published))
        setCategoryIdsText((json.item.categoryIds || []).join(', '))
        setTagIdsText((json.item.tagIds || []).join(', '))
        setCastIdsText((json.item.castIds || []).join(', '))
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
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const payload = {
          title: workTitle,
          description: desc,
          thumbnailUrl,
          published,
          categoryIds: csvToIdList(categoryIdsText),
          tagIds: csvToIdList(tagIdsText),
          castIds: csvToIdList(castIdsText),
        }
        if (id) {
          await cmsFetchJson(cfg, `/cms/works/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/works', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [castIdsText, categoryIdsText, cfg, desc, id, published, tagIdsText, thumbnailUrl, workTitle])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        {id ? (
          <View style={styles.field}>
            <Text style={styles.label}>作品ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>作品名</Text>
          <TextInput value={workTitle} onChangeText={setWorkTitle} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <TextInput value={desc} onChangeText={setDesc} style={[styles.input, { minHeight: 110 }]} multiline />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネURL</Text>
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://..." style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>公開</Text>
          <Switch value={published} onValueChange={setPublished} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>カテゴリID（カンマ区切り）</Text>
          <TextInput value={categoryIdsText} onChangeText={setCategoryIdsText} placeholder="cat_... , cat_..." style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>タグID（カンマ区切り）</Text>
          <TextInput value={tagIdsText} onChangeText={setTagIdsText} placeholder="tag_... , tag_..." style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>出演者ID（カンマ区切り）</Text>
          <TextInput value={castIdsText} onChangeText={setCastIdsText} placeholder="cast_... , cast_..." style={styles.input} autoCapitalize="none" />
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

type CommentRow = {
  id: string
  targetTitle: string
  author: string
  body: string
  createdAt: string
  status: '未対応非公開' | '公開済み' | '対応済み非公開'
}

function CommentsPendingListScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const [rows] = useState<CommentRow[]>(() => [
    {
      id: 'C0001',
      targetTitle: '作品A 第1話',
      author: '匿名',
      body: 'めちゃくちゃ続きが気になる…！',
      createdAt: '2026-01-10 12:00',
      status: '未対応非公開',
    },
    {
      id: 'C0002',
      targetTitle: '作品B 第2話',
      author: 'ユーザーA',
      body: 'BGMが良くて一気見しました。',
      createdAt: '2026-01-10 09:30',
      status: '未対応非公開',
    },
  ])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>未承認/未対応コメント一覧</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{`${r.targetTitle} / ${r.author}`}</Text>
                <Text style={styles.tableDetail}>{`${r.createdAt} / ${r.status}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function CommentApproveScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [decision, setDecision] = useState<'公開済み' | '対応済み非公開' | ''>('')
  const [reason, setReason] = useState('')

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>コメント詳細（承認/否認）</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>表示</Text>
        <View style={styles.field}>
          <Text style={styles.label}>コメントID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>対象/本文/投稿者/日時の詳細表示は後続実装</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>操作</Text>
        <SelectField
          label="ステータス"
          value={decision}
          placeholder="選択"
          options={[
            { label: '公開（承認）', value: '公開済み' },
            { label: '非公開（否認/取り下げ）', value: '対応済み非公開' },
          ]}
          onChange={(v) => setDecision(v as any)}
        />
        {decision === '対応済み非公開' ? (
          <View style={styles.field}>
            <Text style={styles.label}>否認理由（任意）</Text>
            <TextInput value={reason} onChangeText={setReason} style={[styles.input, { minHeight: 90 }]} multiline />
          </View>
        ) : null}
        <View style={styles.filterActions}>
          <Pressable style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>確定</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function CommentsListScreen({ onOpenEdit }: { onOpenEdit: (id: string) => void }) {
  const [qStatus, setQStatus] = useState('')
  const [rows] = useState<CommentRow[]>(() => [
    {
      id: 'C0001',
      targetTitle: '作品A 第1話',
      author: '匿名',
      body: 'めちゃくちゃ続きが気になる…！',
      createdAt: '2026-01-10 12:00',
      status: '公開済み',
    },
    {
      id: 'C0009',
      targetTitle: '作品B 第2話',
      author: 'ユーザーB',
      body: 'ラストの展開が予想外で鳥肌…！！！',
      createdAt: '2026-01-09 10:15',
      status: '対応済み非公開',
    },
  ])

  const filtered = useMemo(() => {
    if (!qStatus) return rows
    return rows.filter((r) => r.status === qStatus)
  }, [qStatus, rows])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>コメント一覧</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>検索</Text>
        <SelectField
          label="ステータス"
          value={qStatus}
          placeholder="全て"
          options={[
            { label: '全て', value: '' },
            { label: '未対応非公開', value: '未対応非公開' },
            { label: '公開済み', value: '公開済み' },
            { label: '対応済み非公開', value: '対応済み非公開' },
          ]}
          onChange={setQStatus}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {filtered.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenEdit(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{`${r.targetTitle} / ${r.author}`}</Text>
                <Text style={styles.tableDetail}>{`${r.createdAt} / ${r.status}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function CommentEditScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [status, setStatus] = useState<'公開済み' | '対応済み非公開'>('公開済み')
  const [deleted, setDeleted] = useState(false)

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>コメント編集</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>操作</Text>
        <View style={styles.field}>
          <Text style={styles.label}>コメントID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <SelectField
          label="ステータス"
          value={status}
          placeholder="選択"
          options={[
            { label: '公開', value: '公開済み' },
            { label: '非公開', value: '対応済み非公開' },
          ]}
          onChange={(v) => setStatus(v as any)}
        />
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>削除（論理削除）</Text>
          <Switch value={deleted} onValueChange={setDeleted} />
        </View>
        <View style={styles.filterActions}>
          <Pressable style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type UserRow = { id: string; name: string; email: string; kind: 'ユーザー' | 'キャスト'; createdAt: string }

function UsersListScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const [rows] = useState<UserRow[]>(() => [
    { id: 'U0001', name: 'ユーザーA', email: 'usera@example.com', kind: 'ユーザー', createdAt: '2026-01-10' },
    { id: 'U0002', name: 'キャストB', email: 'castb@example.com', kind: 'キャスト', createdAt: '2026-01-09' },
  ])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>ユーザー一覧</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{`${r.name}（${r.kind}）`}</Text>
                <Text style={styles.tableDetail}>{`${r.email} / ${r.createdAt}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function UserDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>ユーザー詳細</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本情報</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ユーザーID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>プロフィール/履歴/お気に入り等は後続実装</Text>
        </View>
      </View>
    </ScrollView>
  )
}

type NoticeRow = { id: string; subject: string; sentAt: string; status: '下書き' | '予約' | '送信済み' | '取消' }

function NoticesListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew: () => void }) {
  const [rows] = useState<NoticeRow[]>(() => [
    { id: 'N0001', subject: 'メンテナンスのお知らせ', sentAt: '2026-01-12 03:00', status: '予約' },
    { id: 'N0002', subject: '新作公開', sentAt: '2026-01-10 12:00', status: '送信済み' },
  ])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>お知らせ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規作成</Text>
        </Pressable>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.subject}</Text>
                <Text style={styles.tableDetail}>{`${r.sentAt} / ${r.status}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function NoticeEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const [sentAt, setSentAt] = useState('2026-01-12 03:00')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [push, setPush] = useState(false)

  useEffect(() => {
    if (!id) return
    setSubject(`(${id}) お知らせ件名`)
  }, [id])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        <View style={styles.field}>
          <Text style={styles.label}>配信日時</Text>
          <TextInput value={sentAt} onChangeText={setSentAt} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>件名</Text>
          <TextInput value={subject} onChangeText={setSubject} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>本文</Text>
          <TextInput value={body} onChangeText={setBody} style={[styles.input, { minHeight: 160 }]} multiline />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>プッシュ通知送信</Text>
          <Switch value={push} onValueChange={setPush} />
        </View>
        <View style={styles.filterActions}>
          <Pressable style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type CategoryRow = { id: string; name: string; enabled: boolean }

function CategoriesListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew: () => void }) {
  const [rows] = useState<CategoryRow[]>(() => [
    { id: 'CAT001', name: '恋愛', enabled: true },
    { id: 'CAT002', name: 'ミステリー', enabled: true },
  ])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>カテゴリ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${r.enabled ? '有効' : '無効'}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function CategoryEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (!id) return
    setName(`カテゴリ(${id})`)
  }, [id])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        {id ? (
          <View style={styles.field}>
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>カテゴリ名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>有効</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        <View style={styles.filterActions}>
          <Pressable style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type TagRow = { id: string; name: string }

function TagsListScreen({ onOpenEdit, onNew }: { onOpenEdit: (id: string) => void; onNew: () => void }) {
  const [rows] = useState<TagRow[]>(() => [
    { id: 'TAG001', name: '胸キュン' },
    { id: 'TAG002', name: '感動' },
  ])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>タグ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenEdit(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{r.id}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function TagEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (!id) return
    setName(`タグ(${id})`)
  }, [id])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        {id ? (
          <View style={styles.field}>
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>タグ名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>
        <View style={styles.filterActions}>
          <Pressable style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type CoinSettingRow = { id: string; price: string; place: string; target: string; period: string }

function CoinSettingsListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew: () => void }) {
  const [rows] = useState<CoinSettingRow[]>(() => [
    { id: 'COIN001', price: '¥480', place: 'アプリ', target: '全ユーザー', period: '常時' },
    { id: 'COIN002', price: '¥1200', place: 'アプリ', target: '全ユーザー', period: '常時' },
  ])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>コイン設定一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{`${r.price} / ${r.target}`}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${r.place} / ${r.period}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function CoinSettingEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const [price, setPrice] = useState('')

  useEffect(() => {
    if (!id) return
    setPrice('¥480')
  }, [id])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        {id ? (
          <View style={styles.field}>
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>価格</Text>
          <TextInput value={price} onChangeText={setPrice} style={styles.input} />
        </View>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>表示場所/対象/期間などは後続実装</Text>
        </View>
        <View style={styles.filterActions}>
          <Pressable style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type AdminRow = { id: string; name: string; email: string; role: 'Admin' }

function AdminsListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew: () => void }) {
  const [rows] = useState<AdminRow[]>(() => [{ id: 'A0001', name: '運営管理者', email: 'admin@example.com', role: 'Admin' }])

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
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{`${r.email} / ${r.role}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function AdminEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!id) return
    setName('運営管理者')
    setEmail('admin@example.com')
  }, [id])

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
        <View style={styles.filterActions}>
          <Pressable style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function RankingPlaceholderScreen({ title }: { title: string }) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>{title}</Text>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>ランキング算出/日次更新は後続実装</Text>
      </View>
    </ScrollView>
  )
}

function InquiriesListScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>お問い合わせ一覧</Text>
      <View style={styles.table}>
        <Pressable onPress={() => onOpenDetail('IQ0001')} style={styles.tableRow}>
          <View style={styles.tableLeft}>
            <Text style={styles.tableLabel}>お問い合わせ（サンプル）</Text>
            <Text style={styles.tableDetail}>IQ0001 / 未対応</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  )
}

function InquiryDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>お問い合わせ詳細</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>内容</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>本文/対応ステータス更新は後続実装</Text>
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
  onSetLoggedInState,
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
  onSetLoggedInState: (next: boolean, persist: boolean) => void
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
              onSetLoggedInState(v, persist)
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
  onSetAdminEmail,
  onSetApiBase,
  onNavigate,
  onSkipLogin,
  onSetLoggedInState,
}: {
  visible: boolean
  token: string
  apiBase: string
  adminEmail: string
  onClose: () => void
  onSetAdminEmail: (v: string) => void
  onSetApiBase: (v: string) => void
  onNavigate: (id: RouteId) => void
  onSkipLogin: (persist: boolean) => void
  onSetLoggedInState: (next: boolean, persist: boolean) => void
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
                onSetLoggedInState(v, persist)
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
  const [selectedWorkId, setSelectedWorkId] = useState('')
  const [selectedScheduledVideoId, setSelectedScheduledVideoId] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedUnapprovedVideoId, setSelectedUnapprovedVideoId] = useState('')
  const [selectedCommentId, setSelectedCommentId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedNoticeId, setSelectedNoticeId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [categoryBackRoute, setCategoryBackRoute] = useState<RouteId>('categories')
  const [selectedTagId, setSelectedTagId] = useState('')
  const [tagBackRoute, setTagBackRoute] = useState<RouteId>('tags')
  const [selectedCoinSettingId, setSelectedCoinSettingId] = useState('')
  const [selectedAdminId, setSelectedAdminId] = useState('')
  const [selectedInquiryId, setSelectedInquiryId] = useState('')

  const menu = useMemo<SidebarEntry[]>(
    () => [
      { kind: 'item', id: 'dashboard', label: 'ダッシュボード' },

      { kind: 'group', label: '動画管理' },
      { kind: 'item', id: 'videos-scheduled', label: '配信予定動画一覧' },
      { kind: 'item', id: 'videos', label: '動画一覧' },
      { kind: 'item', id: 'video-categories', label: '動画カテゴリ一覧' },
      { kind: 'item', id: 'video-tags', label: '動画タグ一覧' },
      { kind: 'item', id: 'unapproved-videos', label: '未承認動画一覧' },
      { kind: 'item', id: 'recommend', label: 'おすすめ動画' },
      { kind: 'item', id: 'pickup', label: 'ピックアップ' },

      { kind: 'group', label: '作品管理' },
      { kind: 'item', id: 'works', label: '作品一覧' },

      { kind: 'group', label: 'コメント管理' },
      { kind: 'item', id: 'comments-pending', label: '未承認コメント一覧' },
      { kind: 'item', id: 'comments', label: 'コメント一覧' },

      { kind: 'group', label: 'ユーザー管理' },
      { kind: 'item', id: 'users', label: 'ユーザー一覧' },

      { kind: 'group', label: 'お知らせ' },
      { kind: 'item', id: 'notices', label: 'お知らせ一覧' },

      { kind: 'group', label: 'ランキング' },
      { kind: 'item', id: 'ranking-videos', label: '動画ランキング' },
      { kind: 'item', id: 'ranking-coins', label: '獲得コインランキング' },
      { kind: 'item', id: 'ranking-actors', label: '主演ランキング' },
      { kind: 'item', id: 'ranking-directors', label: '監督ランキング' },
      { kind: 'item', id: 'ranking-writers', label: '脚本ランキング' },

      { kind: 'group', label: 'マスタ管理' },
      { kind: 'item', id: 'categories', label: 'カテゴリ一覧' },
      { kind: 'item', id: 'tags', label: 'タグ一覧' },
      { kind: 'item', id: 'coin', label: 'コイン設定一覧' },

      { kind: 'group', label: '管理者' },
      { kind: 'item', id: 'admins', label: '管理者一覧' },

      { kind: 'group', label: 'その他' },
      { kind: 'item', id: 'castStaff', label: 'キャスト・スタッフ管理' },
      { kind: 'item', id: 'inquiries', label: 'お問い合わせ一覧' },
      { kind: 'item', id: 'settings', label: '設定' },
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
        return (
          <WorksListScreen
            onNew={() => {
              setSelectedWorkId('')
              onNavigate('work-new')
            }}
            onOpenDetail={(id) => {
              setSelectedWorkId(id)
              onNavigate('work-detail')
            }}
          />
        )
      case 'work-detail':
        return <WorkEditScreen title="作品詳細・編集" id={selectedWorkId} onBack={() => onNavigate('works')} />
      case 'work-new':
        return <WorkEditScreen title="作品新規作成" id="" onBack={() => onNavigate('works')} />

      case 'videos-scheduled':
        return (
          <ScheduledVideosListScreen
            onOpenDetail={(id) => {
              setSelectedScheduledVideoId(id)
              onNavigate('videos-scheduled-detail')
            }}
          />
        )
      case 'videos-scheduled-detail':
        return <ScheduledVideoDetailScreen id={selectedScheduledVideoId} onBack={() => onNavigate('videos-scheduled')} />

      case 'videos':
        return (
          <VideoListScreen
            onGoUpload={() => onNavigate('video-upload')}
            onOpenDetail={(id) => {
              setSelectedVideoId(id)
              onNavigate('video-detail')
            }}
          />
        )

      case 'video-categories':
        return (
          <CategoriesListScreen
            onNew={() => {
              setSelectedCategoryId('')
              setCategoryBackRoute('video-categories')
              onNavigate('category-new')
            }}
            onOpenDetail={(id) => {
              setSelectedCategoryId(id)
              setCategoryBackRoute('video-categories')
              onNavigate('category-detail')
            }}
          />
        )

      case 'video-tags':
        return (
          <TagsListScreen
            onNew={() => {
              setSelectedTagId('')
              setTagBackRoute('video-tags')
              onNavigate('tag-new')
            }}
            onOpenEdit={(id) => {
              setSelectedTagId(id)
              setTagBackRoute('video-tags')
              onNavigate('tag-edit')
            }}
          />
        )
      case 'video-detail':
        return <VideoDetailScreen id={selectedVideoId} onBack={() => onNavigate('videos')} />
      case 'video-upload':
        return <VideoUploadScreen onBack={() => onNavigate('videos')} />
      case 'unapproved-videos':
        return (
          <UnapprovedVideosListScreen
            onOpenDetail={(id) => {
              setSelectedUnapprovedVideoId(id)
              onNavigate('unapproved-video-detail')
            }}
          />
        )
      case 'unapproved-video-detail':
        return <UnapprovedVideoDetailScreen id={selectedUnapprovedVideoId} onBack={() => onNavigate('unapproved-videos')} />
      case 'recommend':
        return <PlaceholderScreen title="おすすめ動画" />
      case 'pickup':
        return <PlaceholderScreen title="ピックアップ" />

      case 'castStaff':
        return <PlaceholderScreen title="キャスト・スタッフ管理" />

      case 'comments-pending':
        return (
          <CommentsPendingListScreen
            onOpenDetail={(id) => {
              setSelectedCommentId(id)
              onNavigate('comment-approve')
            }}
          />
        )
      case 'comment-approve':
        return <CommentApproveScreen id={selectedCommentId} onBack={() => onNavigate('comments-pending')} />
      case 'comments':
        return (
          <CommentsListScreen
            onOpenEdit={(id) => {
              setSelectedCommentId(id)
              onNavigate('comment-edit')
            }}
          />
        )
      case 'comment-edit':
        return <CommentEditScreen id={selectedCommentId} onBack={() => onNavigate('comments')} />

      case 'users':
        return (
          <UsersListScreen
            onOpenDetail={(id) => {
              setSelectedUserId(id)
              onNavigate('user-detail')
            }}
          />
        )
      case 'user-detail':
        return <UserDetailScreen id={selectedUserId} onBack={() => onNavigate('users')} />

      case 'notices':
        return (
          <NoticesListScreen
            onNew={() => {
              setSelectedNoticeId('')
              onNavigate('notice-new')
            }}
            onOpenDetail={(id) => {
              setSelectedNoticeId(id)
              onNavigate('notice-detail')
            }}
          />
        )
      case 'notice-detail':
        return <NoticeEditScreen title="お知らせ詳細・編集" id={selectedNoticeId} onBack={() => onNavigate('notices')} />
      case 'notice-new':
        return <NoticeEditScreen title="お知らせ新規作成" id="" onBack={() => onNavigate('notices')} />

      case 'ranking-videos':
        return <RankingPlaceholderScreen title="動画ランキング" />
      case 'ranking-coins':
        return <RankingPlaceholderScreen title="獲得コインランキング" />
      case 'ranking-actors':
        return <RankingPlaceholderScreen title="主演ランキング" />
      case 'ranking-directors':
        return <RankingPlaceholderScreen title="監督ランキング" />
      case 'ranking-writers':
        return <RankingPlaceholderScreen title="脚本ランキング" />

      case 'categories':
        return (
          <CategoriesListScreen
            onNew={() => {
              setSelectedCategoryId('')
              setCategoryBackRoute('categories')
              onNavigate('category-new')
            }}
            onOpenDetail={(id) => {
              setSelectedCategoryId(id)
              setCategoryBackRoute('categories')
              onNavigate('category-detail')
            }}
          />
        )
      case 'category-detail':
        return (
          <CategoryEditScreen title="カテゴリ詳細・編集" id={selectedCategoryId} onBack={() => onNavigate(categoryBackRoute)} />
        )
      case 'category-new':
        return <CategoryEditScreen title="カテゴリ新規作成" id="" onBack={() => onNavigate(categoryBackRoute)} />

      case 'tags':
        return (
          <TagsListScreen
            onNew={() => {
              setSelectedTagId('')
              setTagBackRoute('tags')
              onNavigate('tag-new')
            }}
            onOpenEdit={(id) => {
              setSelectedTagId(id)
              setTagBackRoute('tags')
              onNavigate('tag-edit')
            }}
          />
        )
      case 'tag-edit':
        return <TagEditScreen title="タグ編集" id={selectedTagId} onBack={() => onNavigate(tagBackRoute)} />
      case 'tag-new':
        return <TagEditScreen title="タグ新規作成" id="" onBack={() => onNavigate(tagBackRoute)} />

      case 'coin':
        return (
          <CoinSettingsListScreen
            onNew={() => {
              setSelectedCoinSettingId('')
              onNavigate('coin-setting-new')
            }}
            onOpenDetail={(id) => {
              setSelectedCoinSettingId(id)
              onNavigate('coin-setting-detail')
            }}
          />
        )
      case 'coin-setting-detail':
        return <CoinSettingEditScreen title="コイン設定 詳細・編集" id={selectedCoinSettingId} onBack={() => onNavigate('coin')} />
      case 'coin-setting-new':
        return <CoinSettingEditScreen title="コイン設定 新規作成" id="" onBack={() => onNavigate('coin')} />

      case 'admins':
        return (
          <AdminsListScreen
            onNew={() => {
              setSelectedAdminId('')
              onNavigate('admin-new')
            }}
            onOpenDetail={(id) => {
              setSelectedAdminId(id)
              onNavigate('admin-detail')
            }}
          />
        )
      case 'admin-detail':
        return <AdminEditScreen title="管理者詳細・編集" id={selectedAdminId} onBack={() => onNavigate('admins')} />
      case 'admin-new':
        return <AdminEditScreen title="管理者新規作成" id="" onBack={() => onNavigate('admins')} />

      case 'inquiries':
        return (
          <InquiriesListScreen
            onOpenDetail={(id) => {
              setSelectedInquiryId(id)
              onNavigate('inquiry-detail')
            }}
          />
        )
      case 'inquiry-detail':
        return <InquiryDetailScreen id={selectedInquiryId} onBack={() => onNavigate('inquiries')} />

      case 'settings':
        return <PlaceholderScreen title="設定" />
      default:
        return <DashboardScreen onNavigate={onNavigate} />
    }
  }, [
    onNavigate,
    route,
    selectedAdminId,
    selectedCategoryId,
    selectedCoinSettingId,
    selectedCommentId,
    selectedInquiryId,
    selectedNoticeId,
    selectedScheduledVideoId,
    selectedTagId,
    selectedUserId,
    selectedVideoId,
    selectedUnapprovedVideoId,
    selectedWorkId,
    categoryBackRoute,
    tagBackRoute,
  ])

  return (
    <View style={styles.dashboardRoot}>
      <Sidebar entries={menu} activeId={sidebarActiveRoute(route)} onNavigate={onNavigate} />
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

  const [devMode, setDevMode] = useState(true)
  const [devModalOpen, setDevModalOpen] = useState(false)
  const [debugOverlayHidden, setDebugOverlayHidden] = useState(false)

  useEffect(() => {
    const saved = safeLocalStorageGet(STORAGE_KEY)
    const savedEmail = safeLocalStorageGet(STORAGE_EMAIL_KEY)
    const savedDevMode = safeLocalStorageGet(STORAGE_DEV_MODE_KEY)
    const initialRoute = getRouteFromLocation()

    if (savedDevMode === '1') setDevMode(true)
    if (savedDevMode === '0') setDevMode(false)

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

  const onSetLoggedInState = useCallback(
    (next: boolean, persist: boolean) => {
      if (next) {
        setLoginBanner('')
        onSkipLogin(persist)
        return
      }
      onLogout()
    },
    [onLogout, onSkipLogin]
  )

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
    setLoginBanner('')
  }, [])

  const onClearToken = useCallback(() => {
    setToken('')
    safeLocalStorageRemove(STORAGE_KEY)
  }, [])

  const onDebugToggleLogin = useCallback(
    (next: boolean, persist: boolean) => {
      onSetLoggedInState(next, persist)
    },
    [onSetLoggedInState]
  )

  const debugOverlayInitialPos = useMemo(() => {
    const raw = safeLocalStorageGet(STORAGE_DEBUG_OVERLAY_POS_KEY)
    const parsed = safeJsonParse<{ x: number; y: number }>(raw, { x: 0, y: 0 })
    return {
      x: Number.isFinite(parsed.x) ? parsed.x : 0,
      y: Number.isFinite(parsed.y) ? parsed.y : 0,
    }
  }, [])

  const debugOverlayPan = useRef(new Animated.ValueXY({ x: debugOverlayInitialPos.x, y: debugOverlayInitialPos.y })).current

  const debugOverlayWebDragRef = useRef<{
    active: boolean
    pointerId?: number
    startClientX: number
    startClientY: number
  }>({ active: false, startClientX: 0, startClientY: 0 })

  const debugOverlayPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const cur = (debugOverlayPan as any).__getValue?.() as { x: number; y: number } | undefined
          debugOverlayPan.setOffset({ x: cur?.x ?? 0, y: cur?.y ?? 0 })
          debugOverlayPan.setValue({ x: 0, y: 0 })
        },
        onPanResponderMove: Animated.event([null, { dx: debugOverlayPan.x, dy: debugOverlayPan.y }], { useNativeDriver: false }),
        onPanResponderRelease: () => {
          debugOverlayPan.flattenOffset()
          const v = (debugOverlayPan as any).__getValue?.() as { x: number; y: number } | undefined
          safeLocalStorageSet(STORAGE_DEBUG_OVERLAY_POS_KEY, JSON.stringify({ x: v?.x ?? 0, y: v?.y ?? 0 }))
        },
        onPanResponderTerminate: () => {
          debugOverlayPan.flattenOffset()
        },
      }),
    [debugOverlayPan]
  )

  const debugOverlayWebDragHandlers = useMemo(() => {
    if (Platform.OS !== 'web') return null
    return {
      onPointerDown: (e: any) => {
        if (typeof e?.button === 'number' && e.button !== 0) return
        e?.preventDefault?.()

        const pointerId: number | undefined = typeof e?.pointerId === 'number' ? e.pointerId : undefined
        debugOverlayWebDragRef.current = {
          active: true,
          pointerId,
          startClientX: e?.clientX ?? 0,
          startClientY: e?.clientY ?? 0,
        }

        const cur = (debugOverlayPan as any).__getValue?.() as { x: number; y: number } | undefined
        debugOverlayPan.setOffset({ x: cur?.x ?? 0, y: cur?.y ?? 0 })
        debugOverlayPan.setValue({ x: 0, y: 0 })

        e?.currentTarget?.setPointerCapture?.(pointerId)
      },
      onPointerMove: (e: any) => {
        const st = debugOverlayWebDragRef.current
        if (!st.active) return
        if (typeof st.pointerId === 'number' && typeof e?.pointerId === 'number' && e.pointerId !== st.pointerId) return
        e?.preventDefault?.()

        const dx = (e?.clientX ?? 0) - st.startClientX
        const dy = (e?.clientY ?? 0) - st.startClientY
        debugOverlayPan.setValue({ x: dx, y: dy })
      },
      onPointerUp: (e: any) => {
        const st = debugOverlayWebDragRef.current
        if (!st.active) return
        if (typeof st.pointerId === 'number' && typeof e?.pointerId === 'number' && e.pointerId !== st.pointerId) return
        e?.preventDefault?.()

        debugOverlayWebDragRef.current = { active: false, startClientX: 0, startClientY: 0 }
        debugOverlayPan.flattenOffset()
        const v = (debugOverlayPan as any).__getValue?.() as { x: number; y: number } | undefined
        safeLocalStorageSet(STORAGE_DEBUG_OVERLAY_POS_KEY, JSON.stringify({ x: v?.x ?? 0, y: v?.y ?? 0 }))

        const pointerId: number | undefined = typeof e?.pointerId === 'number' ? e.pointerId : st.pointerId
        e?.currentTarget?.releasePointerCapture?.(pointerId)
      },
      onPointerCancel: (e: any) => {
        const st = debugOverlayWebDragRef.current
        if (!st.active) return
        if (typeof st.pointerId === 'number' && typeof e?.pointerId === 'number' && e.pointerId !== st.pointerId) return
        e?.preventDefault?.()

        debugOverlayWebDragRef.current = { active: false, startClientX: 0, startClientY: 0 }
        debugOverlayPan.flattenOffset()
      },
    }
  }, [debugOverlayPan])

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
              entries={[
                { kind: 'item', id: 'dashboard', label: 'ダッシュボード' },
                { kind: 'item', id: 'works', label: '作品管理' },
                { kind: 'item', id: 'videos', label: '動画管理' },
                { kind: 'item', id: 'castStaff', label: 'キャスト・スタッフ管理' },
                { kind: 'item', id: 'comments', label: 'コメント管理' },
                { kind: 'item', id: 'coin', label: 'コイン管理' },
                { kind: 'item', id: 'users', label: 'ユーザー管理' },
                { kind: 'item', id: 'inquiries', label: 'お問い合わせ管理' },
                { kind: 'item', id: 'settings', label: '設定' },
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
                onSetLoggedInState={onSetLoggedInState}
                onNavigate={onNavigate}
                onOpenDevModal={() => setDevModalOpen(true)}
              />
            </View>
          </View>
        ) : (
          <CmsApiContext.Provider value={{ apiBase, token }}>
            <AppShell route={route} adminName={adminEmail} onLogout={onLogout} onNavigate={onNavigate} />
          </CmsApiContext.Provider>
        )
      ) : null}

      <DevModal
        visible={devModalOpen && showDevButton}
        token={token}
        apiBase={apiBase}
        adminEmail={adminEmail}
        onClose={() => setDevModalOpen(false)}
        onSetAdminEmail={onSetAdminEmail}
        onSetApiBase={onSetApiBase}
        onNavigate={onNavigate}
        onSkipLogin={onSkipLogin}
        onSetLoggedInState={onSetLoggedInState}
      />

      <View pointerEvents="box-none" style={styles.debugOverlayWrap}>
        {devMode && debugOverlayHidden ? (
          <Pressable onPress={() => setDebugOverlayHidden(false)} style={styles.debugOverlayReopen}>
            <Text style={styles.debugOverlayReopenText}>DEBUG</Text>
          </Pressable>
        ) : null}

        {devMode && !debugOverlayHidden ? (
          <Animated.View style={[styles.debugOverlayCard, { transform: debugOverlayPan.getTranslateTransform() }]}>
            <View style={styles.debugOverlayHeader}>
              <View
                style={[
                  styles.debugOverlayHeaderDragArea,
                  Platform.OS === 'web'
                    ? (({
                        cursor: debugOverlayWebDragRef.current.active ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        touchAction: 'none',
                      } as unknown) as any)
                    : null,
                ]}
                {...(Platform.OS === 'web' && debugOverlayWebDragHandlers
                  ? debugOverlayWebDragHandlers
                  : debugOverlayPanResponder.panHandlers)}
              >
                <Text style={styles.debugOverlayHeaderText}>DEBUG</Text>
                <Text style={styles.debugOverlayHeaderHint}>ドラッグ可</Text>
              </View>

              <Pressable onPress={() => setDebugOverlayHidden(true)} style={styles.debugOverlayClose}>
                <Text style={styles.debugOverlayCloseText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.debugOverlayRow}>
              <Text style={styles.debugOverlayLabel}>ログイン状態</Text>
              <Switch value={Boolean(token)} onValueChange={(v) => onSetLoggedInState(v, true)} />
            </View>

            <View style={styles.debugOverlayRow}>
              <Text style={styles.debugOverlayLabel}>DEV モーダル</Text>
              <Pressable onPress={() => setDevModalOpen(true)} style={styles.debugOverlayBtn}>
                <Text style={styles.debugOverlayBtnText}>開く</Text>
              </Pressable>
            </View>

            {!token ? (
              <Pressable onPress={() => onSkipLogin(true)} style={styles.debugOverlayBtnWide}>
                <Text style={styles.debugOverlayBtnWideText}>ログインスキップ（DEBUG）</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </View>

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
  sidebarGroupTitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: -2,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 12,
    marginBottom: 12,
  },
  sidebarList: {
    flex: 1,
  },
  sidebarListContent: {
    gap: 8,
    paddingBottom: 16,
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

  debugOverlayWrap: {
    position: 'absolute',
    right: 12,
    bottom: 18,
  },
  debugOverlayCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    width: 260,
  },
  debugOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  debugOverlayHeaderDragArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  debugOverlayHeaderText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  debugOverlayHeaderHint: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  debugOverlayClose: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  debugOverlayCloseText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '900',
    marginTop: -1,
  },
  debugOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  debugOverlayLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  debugOverlayBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
  },
  debugOverlayBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  debugOverlayBtnWide: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  debugOverlayBtnWideText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  debugOverlayReopen: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-end',
  },
  debugOverlayReopenText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
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
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  readonlyText: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    backgroundColor: COLORS.bg,
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
