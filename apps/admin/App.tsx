import { StatusBar } from 'expo-status-bar'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  Image,
  Modal,
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

const tus: typeof import('tus-js-client') | null = Platform.OS === 'web' ? (require('tus-js-client') as any) : null

type Screen = 'login' | 'app'

type RouteId =
  | 'login'
  | 'password-reset'
  | 'not-found'
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
  | 'unapproved-actor-accounts'
  | 'unapproved-actor-account-detail'
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
  | 'user-new'
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
  | 'genres'
  | 'genre-detail'
  | 'genre-new'
  | 'cast-categories'
  | 'cast-category-detail'
  | 'cast-category-new'
  | 'coin'
  | 'coin-setting-detail'
  | 'coin-setting-new'
  // 管理者
  | 'admins'
  | 'admin-detail'
  | 'admin-new'
  // その他
  | 'castStaff'
  | 'castStaff-detail'
  | 'castStaff-new'
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
const STORAGE_UPLOADER_OVERRIDE_KEY = 'oshidra_admin_uploader_base_override_v1'
const STORAGE_DEV_POS_KEY = 'oshidra_admin_dev_pos_v1'
const STORAGE_DEBUG_OVERLAY_POS_KEY = 'oshidra_admin_debug_overlay_pos_v1'
const STORAGE_MOCK_KEY = 'oshidra_admin_mock_v1'

const UNAUTHORIZED_EVENT = 'oshidra-admin:unauthorized'
let unauthorizedEventEmitted = false

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
  mock: boolean
}

const CmsApiContext = createContext<CmsApiConfig | null>(null)

type ConfirmOptions = {
  title?: string
  okText?: string
  cancelText?: string
  danger?: boolean
}

type DialogContextValue = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>
}

const DialogContext = createContext<DialogContextValue | null>(null)

function useDialog() {
  const v = useContext(DialogContext)
  if (!v) throw new Error('Dialog is not configured')
  return v
}

function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean
    message: string
    options: ConfirmOptions
    resolve: ((v: boolean) => void) | null
  }>({ open: false, message: '', options: {}, resolve: null })

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, message, options, resolve })
    })
  }, [])

  const close = useCallback((result: boolean) => {
    setState((prev) => {
      try {
        prev.resolve?.(result)
      } catch {
        // ignore
      }
      return { open: false, message: '', options: {}, resolve: null }
    })
  }, [])

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      <Modal transparent animationType="fade" visible={state.open} onRequestClose={() => close(false)}>
        <Pressable onPress={() => close(false)} style={styles.dialogOverlay}>
          <Pressable onPress={() => {}} style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>{state.options.title || '確認'}</Text>
            <Text style={styles.dialogMessage}>{state.message}</Text>
            <View style={styles.dialogActionsRow}>
              <Pressable onPress={() => close(false)} style={styles.dialogBtn}>
                <Text style={styles.dialogBtnText}>{state.options.cancelText || 'キャンセル'}</Text>
              </Pressable>
              <Pressable onPress={() => close(true)} style={[styles.dialogBtn, state.options.danger ? styles.dialogBtnDanger : styles.dialogBtnOk]}>
                <Text style={[styles.dialogBtnText, styles.dialogBtnOkText]}>{state.options.okText || 'OK'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  )
}

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

async function cmsFetchJsonWithBase<T>(cfg: CmsApiConfig, baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const base = (baseUrl || '').replace(/\/$/, '')
  if (!base) throw new Error('API Base が未設定です')
  if (!cfg.token) throw new Error('セッションが切れました')

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${cfg.token}`,
      ...(cfg.mock ? { 'X-Mock': '1' } : {}),
    },
  })
  const json = (await res.json().catch(() => ({}))) as any

  if (res.status === 401) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Ensure a bad/expired remembered token doesn't keep auto-logging in.
      safeLocalStorageRemove(STORAGE_KEY)

      if (!unauthorizedEventEmitted) {
        let dispatched = false
        try {
          window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { path } }))
          dispatched = true
        } catch {
          try {
            window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
            dispatched = true
          } catch {
            dispatched = false
          }
        }

        if (!dispatched) {
          try {
            window.location.href = '/login'
          } catch {
            // ignore
          }
        }

        // Only suppress future emissions if we actually notified the app.
        unauthorizedEventEmitted = dispatched
      }
    }
    throw new Error('セッションが切れました')
  }

  if (!res.ok) {
    const msg = json && json.error ? String(json.error) : '通信に失敗しました。時間をおいて再度お試しください'
    throw new Error(msg)
  }
  return json as T
}

async function cmsFetchJson<T>(cfg: CmsApiConfig, path: string, init?: RequestInit): Promise<T> {
  return cmsFetchJsonWithBase<T>(cfg, cfg.apiBase, path, init)
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
    case 'unapproved-actor-accounts':
      return 'unapproved-actor-accounts'
    case 'unapproved-actor-account-detail':
      return 'unapproved-actor-account-detail'
    case 'recommend':
      return 'recommend'
    case 'pickup':
      return 'pickup'
    case 'caststaff':
      return 'castStaff'
    case 'caststaff-detail':
      return 'castStaff-detail'
    case 'caststaff-new':
      return 'castStaff-new'
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
    case 'password-reset':
      return 'password-reset'
    case 'not-found':
      return 'not-found'
    default:
      return key === 'login' ? 'login' : 'not-found'
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
    case 'password-reset':
      return 'password-reset'
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
    case 'unapproved-actor-accounts':
      return 'unapproved-actor-accounts'
    case 'unapproved-actor-account-detail':
      return 'unapproved-actor-account-detail'
    case 'recommend':
      return 'recommend'
    case 'pickup':
      return 'pickup'
    case 'caststaff':
      return 'castStaff'
    case 'caststaff-detail':
      return 'castStaff-detail'
    case 'caststaff-new':
      return 'castStaff-new'
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
    case 'not-found':
      return 'not-found'
    default:
      return 'not-found'
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

function getUploaderBaseFromLocation(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''

  const override = safeLocalStorageGet(STORAGE_UPLOADER_OVERRIDE_KEY).trim()
  if (override) return override.replace(/\/$/, '')

  const url = new URL(window.location.href)
  const q = String(url.searchParams.get('uploader') || '').trim()
  if (q) return q.replace(/\/$/, '')

  // Default (production)
  // Local development can override via ?uploader=http://localhost:8788 or Uploader Base Override in /dev.
  return 'https://assets-uploader.oshidra.com'
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
    case 'not-found':
      return 'dashboard'
    case 'videos-scheduled-detail':
      return 'videos-scheduled'
    case 'video-detail':
      return 'videos'
    case 'unapproved-video-detail':
      return 'unapproved-videos'
    case 'unapproved-actor-account-detail':
      return 'unapproved-actor-accounts'
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

function DashboardScreen({
  onNavigate,
  onOpenScheduledDetail,
}: {
  onNavigate: (id: RouteId) => void
  onOpenScheduledDetail?: (id: string) => void
}) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const [scheduledRows, setScheduledRows] = useState<Array<{ id: string; title: string; scheduledAt: string; status: string }>>([])

  const [kpis, setKpis] = useState<KPIItem[]>(() => [
    { id: 'users_total', label: '総ユーザー数', value: '—', route: 'users' },
    { id: 'users_today', label: '本日の新規登録', value: '—', route: 'users' },
    { id: 'works_published', label: '公開中作品数', value: '—', route: 'works' },
    { id: 'videos_published', label: '公開中動画数', value: '—', route: 'videos' },
    { id: 'plays_today', label: '本日の再生回数', value: '—', route: 'videos' },
    { id: 'coins_spent_today', label: '本日のコイン消費', value: '—', route: 'coin' },
  ])

  const [activities, setActivities] = useState<ActivityItem[]>(() => [
    { id: 'a_unapproved_videos', label: '未承認動画', detail: '承認待ち', pendingCount: 0, route: 'unapproved-videos' },
    { id: 'a_unapproved_comments', label: '未承認コメント', detail: '承認待ち', pendingCount: 0, route: 'comments-pending' },
    { id: 'a_unapproved_actors', label: '未承認俳優アカウント', detail: '審査待ち', pendingCount: 0, route: 'unapproved-actor-accounts' },
  ])

  const shortcuts = useMemo<Array<{ id: string; label: string; route: RouteId }>>(
    () => [
      { id: 's_add_work', label: '作品を追加', route: 'works' },
      { id: 's_add_video', label: '動画を追加', route: 'videos' },
      { id: 's_comment_approve', label: 'コメント承認', route: 'comments-pending' },
      { id: 's_cast_register', label: 'キャスト登録', route: 'castStaff' },
      { id: 's_coin_withdraw', label: 'コイン換金処理', route: 'coin' },
      { id: 's_inquiries', label: 'お問い合わせ確認', route: 'inquiries' },
    ],
    []
  )

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const [summaryRes, videosRes, commentsRes, actorsRes, scheduledRes] = await Promise.allSettled([
          cmsFetchJson<any>(cfg, '/cms/dashboard/summary'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/videos/unapproved'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/comments?status=pending'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/cast-profiles/unapproved'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/videos/scheduled'),
        ])
        if (!mounted) return

        if (summaryRes.status !== 'fulfilled') {
          throw summaryRes.reason
        }

        const summary = summaryRes.value
        const videos = videosRes.status === 'fulfilled' ? videosRes.value : { items: [] as any[] }
        const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : { items: [] as any[] }
        const actors = actorsRes.status === 'fulfilled' ? actorsRes.value : { items: [] as any[] }
        const scheduled = scheduledRes.status === 'fulfilled' ? scheduledRes.value : { items: [] as any[] }

        setKpis([
          { id: 'users_total', label: '総ユーザー数', value: String(summary?.usersTotal ?? 0), route: 'users' },
          { id: 'users_today', label: '本日の新規登録', value: String(summary?.usersToday ?? 0), route: 'users' },
          { id: 'works_published', label: '公開中作品数', value: String(summary?.worksPublished ?? 0), route: 'works' },
          { id: 'videos_published', label: '公開中動画数', value: String(summary?.videosPublished ?? 0), route: 'videos' },
          { id: 'plays_today', label: '本日の再生回数', value: String(summary?.playsToday ?? 0), route: 'videos' },
          { id: 'coins_spent_today', label: '本日のコイン消費', value: String(summary?.coinsSpentToday ?? 0), route: 'coin' },
        ])

        setActivities([
          {
            id: 'a_unapproved_videos',
            label: '未承認動画',
            detail: '承認待ち',
            pendingCount: (videos.items || []).length,
            route: 'unapproved-videos',
          },
          {
            id: 'a_unapproved_comments',
            label: '未承認コメント',
            detail: '承認待ち',
            pendingCount: (comments.items || []).length,
            route: 'comments-pending',
          },
          {
            id: 'a_unapproved_actors',
            label: '未承認俳優アカウント',
            detail: '審査待ち',
            pendingCount: (actors.items || []).length,
            route: 'unapproved-actor-accounts',
          },
        ])

        setScheduledRows(
          (scheduled.items ?? []).map((r) => {
            const scheduledAtRaw = (r as any).scheduledAt
            const scheduledAt = scheduledAtRaw ? String(scheduledAtRaw).slice(0, 19).replace('T', ' ') : ''
            const status = String((r as any).status ?? 'scheduled')
            return {
              id: String((r as any).id ?? ''),
              title: String((r as any).title ?? ''),
              scheduledAt,
              status: status === 'cancelled' ? '取消' : '配信予約',
            }
          })
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
      <Text style={styles.pageTitle}>ダッシュボード</Text>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

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
        <View style={styles.pageHeaderRow}>
          <Text style={styles.sectionTitle}>配信予定動画（直近）</Text>
          <Pressable onPress={() => onNavigate('videos-scheduled')} style={styles.smallBtnPrimary}>
            <Text style={styles.smallBtnPrimaryText}>一覧へ</Text>
          </Pressable>
        </View>

        <View style={styles.table}>
          {busy && scheduledRows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}

          {scheduledRows.slice(0, 5).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => (onOpenScheduledDetail ? onOpenScheduledDetail(r.id) : onNavigate('videos-scheduled'))}
              style={styles.tableRow}
            >
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.title || r.id}</Text>
                <Text style={styles.tableDetail}>{`${r.scheduledAt || '—'} / ${r.status}`}</Text>
              </View>
              <View style={styles.tableRight}>
                <Text style={styles.linkText}>詳細</Text>
              </View>
            </Pressable>
          ))}

          {!busy && scheduledRows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>配信予定がありません</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近のアクティビティ</Text>
        <View style={styles.table}>
          {busy && activities.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
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

function NotFoundScreen({ onGoDashboard }: { onGoDashboard: () => void }) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>404</Text>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>ページが見つかりません</Text>
        <View style={styles.filterActions}>
          <Pressable onPress={onGoDashboard} style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>ダッシュボードへ戻る</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function MaintenanceModeScreen({ message, onGoSettings }: { message: string; onGoSettings: () => void }) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>メンテナンス中</Text>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>{message || 'メンテナンス中です。しばらくお待ちください。'}</Text>
        <View style={styles.filterActions}>
          <Pressable onPress={onGoSettings} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>設定へ</Text>
          </Pressable>
        </View>
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
  const [q, setQ] = useState('')
  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value)
    return hit ? hit.label : ''
  }, [options, value])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter((o) => `${o.label} ${o.value}`.toLowerCase().includes(needle))
  }, [options, q])

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.selectWrap}>
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.selectBtn}>
          <Text style={styles.selectText}>{selectedLabel || placeholder}</Text>
        </Pressable>

        <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
          <Pressable onPress={() => setOpen(false)} style={styles.pickerModalOverlay}>
            <Pressable onPress={() => {}} style={styles.pickerModalCard}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>{label}</Text>
                <Pressable onPress={() => setOpen(false)} style={styles.pickerModalClose}>
                  <Text style={styles.pickerModalCloseText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.selectSearchWrap}>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="検索（名前 / ID）"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                  style={styles.selectSearchInput}
                />
              </View>

              <ScrollView style={styles.pickerModalList} contentContainerStyle={styles.pickerModalListContent} keyboardShouldPersistTaps="handled">
                {filtered.map((o) => {
                  const selected = o.value === value
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => {
                        onChange(o.value)
                        setOpen(false)
                      }}
                      style={styles.pickerModalItem}
                    >
                      <Text style={styles.multiSelectCheck}>{selected ? '✓' : ' '}</Text>
                      <Text style={styles.pickerModalItemText}>{o.label}</Text>
                    </Pressable>
                  )
                })}
                {filtered.length === 0 ? (
                  <View style={styles.selectMenuEmpty}>
                    <Text style={styles.selectMenuDetailText}>該当なし</Text>
                  </View>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  )
}

type MultiSelectOption = { label: string; value: string; detail?: string }

function MultiSelectField({
  label,
  values,
  placeholder,
  options,
  onChange,
  searchPlaceholder,
}: {
  label: string
  values: string[]
  placeholder: string
  options: MultiSelectOption[]
  onChange: (next: string[]) => void
  searchPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const selectedSet = useMemo(() => new Set(values), [values])

  const selectedOptions = useMemo(() => {
    if (!values.length) return [] as MultiSelectOption[]
    const byId = new Map(options.map((o) => [o.value, o] as const))
    return values.map((id) => byId.get(id) ?? { value: id, label: id }).filter(Boolean)
  }, [options, values])

  const summary = useMemo(() => {
    if (!values.length) return placeholder
    const first = selectedOptions.slice(0, 2).map((o) => o.label).join(' / ')
    const rest = values.length - Math.min(values.length, 2)
    return rest > 0 ? `${first} +${rest}` : first
  }, [placeholder, selectedOptions, values.length])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter((o) => `${o.label} ${o.value} ${o.detail ?? ''}`.toLowerCase().includes(needle))
  }, [options, q])

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(values)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onChange(Array.from(next))
    },
    [onChange, values]
  )

  const remove = useCallback(
    (id: string) => {
      const next = values.filter((v) => v !== id)
      onChange(next)
    },
    [onChange, values]
  )

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.selectWrap}>
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.selectBtn}>
          <Text style={styles.selectText}>{summary}</Text>
        </Pressable>

        {values.length ? (
          <View style={styles.multiChipsWrap}>
            {selectedOptions.map((o) => (
              <Pressable key={o.value} onPress={() => remove(o.value)} style={styles.multiChip}>
                <Text style={styles.multiChipText} numberOfLines={1}>
                  {o.label}
                </Text>
                <Text style={styles.multiChipRemove}>×</Text>
              </Pressable>
            ))}
          </View>
        ) : null}


        <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
          <Pressable onPress={() => setOpen(false)} style={styles.pickerModalOverlay}>
            <Pressable onPress={() => {}} style={styles.pickerModalCard}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>{label}</Text>
                <Pressable onPress={() => setOpen(false)} style={styles.pickerModalClose}>
                  <Text style={styles.pickerModalCloseText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.selectSearchWrap}>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={searchPlaceholder || '検索（名前 / ID）'}
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                  style={styles.selectSearchInput}
                />
              </View>

              <ScrollView style={styles.pickerModalList} contentContainerStyle={styles.pickerModalListContent} keyboardShouldPersistTaps="handled">
                {filtered.map((o) => {
                  const selected = selectedSet.has(o.value)
                  return (
                    <Pressable key={o.value} onPress={() => toggle(o.value)} style={styles.pickerModalItem}>
                      <Text style={styles.multiSelectCheck}>{selected ? '✓' : ' '}</Text>
                      <View style={styles.multiSelectTextCol}>
                        <Text style={styles.pickerModalItemText}>{o.label}</Text>
                        {o.detail ? <Text style={styles.selectMenuDetailText}>{o.detail}</Text> : null}
                      </View>
                    </Pressable>
                  )
                })}
                {filtered.length === 0 ? (
                  <View style={styles.selectMenuEmpty}>
                    <Text style={styles.selectMenuDetailText}>該当なし</Text>
                  </View>
                ) : null}
              </ScrollView>

              <Pressable onPress={() => setOpen(false)} style={styles.pickerModalDoneBtn}>
                <Text style={styles.pickerModalDoneText}>完了</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  )
}

type VideoRow = {
  id: string
  thumbnailUrl: string
  title: string
  workId: string
  workName: string
  episodeLabel: string
  subtitles: 'あり' | 'なし'
  status: '公開' | '非公開'
  rating: number
  reviewCount: number
  createdAt: string
}

function VideoListScreen({ onOpenDetail, onGoUpload }: { onOpenDetail: (id: string) => void; onGoUpload: () => void }) {
  const cfg = useCmsApi()
  const { confirm } = useDialog()
  const [works, setWorks] = useState<Array<{ id: string; title: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([])
  const [casts, setCasts] = useState<Array<{ id: string; name: string }>>([])
  const [genres, setGenres] = useState<Array<{ id: string; name: string }>>([])

  const workOptions = useMemo(
    () => [{ label: '全て', value: '' }, ...works.map((w) => ({ label: w.title || w.id, value: w.id }))],
    [works]
  )
  const categoryOptions = useMemo(
    () => [{ label: '全て', value: '' }, ...categories.map((c) => ({ label: c.name || c.id, value: c.id }))],
    [categories]
  )
  const tagOptions = useMemo(() => [{ label: '全て', value: '' }, ...tags.map((t) => ({ label: t.name || t.id, value: t.id }))], [tags])
  const castOptions = useMemo(() => [{ label: '全て', value: '' }, ...casts.map((c) => ({ label: c.name || c.id, value: c.id }))], [casts])
  const genreOptions = useMemo(
    () => [{ label: '全て', value: '' }, ...genres.map((g) => ({ label: g.name || g.id, value: g.id }))],
    [genres]
  )

  const [qText, setQText] = useState('')
  const [qWorkId, setQWorkId] = useState('')
  const [qStatus, setQStatus] = useState('')
  const [qCategoryId, setQCategoryId] = useState('')
  const [qTagId, setQTagId] = useState('')
  const [qCastId, setQCastId] = useState('')
  const [qGenreId, setQGenreId] = useState('')
  const [qSort, setQSort] = useState<'created_desc' | 'created_asc' | 'scheduled_asc' | 'title_asc'>('created_desc')
  const [qFrom, setQFrom] = useState('')
  const [qTo, setQTo] = useState('')

  const [rows, setRows] = useState<VideoRow[]>([])
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const loadVideos = useCallback(
    async (opts?: { q?: string; workId?: string; published?: '' | '0' | '1'; categoryId?: string; tagId?: string; castId?: string; genreId?: string; sort?: string }) => {
      const qs = new URLSearchParams()
      const q = (opts?.q ?? '').trim()
      if (q) qs.set('q', q)
      const workId = (opts?.workId ?? '').trim()
      if (workId) qs.set('workId', workId)
      const published = opts?.published ?? ''
      if (published) qs.set('published', published)
      const categoryId = (opts?.categoryId ?? '').trim()
      if (categoryId) qs.set('categoryId', categoryId)
      const tagId = (opts?.tagId ?? '').trim()
      if (tagId) qs.set('tagId', tagId)
      const castId = (opts?.castId ?? '').trim()
      if (castId) qs.set('castId', castId)
      const genreId = (opts?.genreId ?? '').trim()
      if (genreId) qs.set('genreId', genreId)
      const sort = (opts?.sort ?? '').trim()
      if (sort) qs.set('sort', sort)
      qs.set('limit', '500')

      const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/videos${qs.toString() ? `?${qs.toString()}` : ''}`)
      setRows(
        (json.items ?? []).map((v) => {
          const createdAt = String(v.createdAt || '').slice(0, 19).replace('T', ' ')
          const episodeNo = v.episodeNo === null || v.episodeNo === undefined ? null : Number(v.episodeNo)
          const episodeLabel = episodeNo === null || !Number.isFinite(episodeNo) ? '—' : `#${episodeNo}`
          const subtitles = String(v.streamVideoIdSubtitled ?? '') ? 'あり' : 'なし'
          return {
            id: String(v.id ?? ''),
            thumbnailUrl: String(v.thumbnailUrl ?? ''),
            title: String(v.title ?? ''),
            workId: String(v.workId ?? ''),
            workName: String(v.workTitle ?? v.workId ?? ''),
            episodeLabel,
            subtitles,
            status: v.published ? '公開' : '非公開',
            rating: Number(v.ratingAvg ?? 0) || 0,
            reviewCount: Number(v.reviewCount ?? 0) || 0,
            createdAt,
          }
        })
      )
    },
    [cfg]
  )

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const [worksJson, catsJson, tagsJson, castsJson, genresJson] = await Promise.all([
          cmsFetchJson<{ items: Array<{ id: string; title: string }> }>(cfg, '/cms/works'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/categories'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/tags'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/casts'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/genres'),
        ])
        if (!mounted) return
        setWorks(worksJson.items)
        setCategories((catsJson.items ?? []).map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? '') })).filter((c) => c.id))
        setTags((tagsJson.items ?? []).map((t) => ({ id: String(t.id ?? ''), name: String(t.name ?? '') })).filter((t) => t.id))
        setCasts((castsJson.items ?? []).map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? '') })).filter((c) => c.id))
        setGenres((genresJson.items ?? []).map((g) => ({ id: String(g.id ?? ''), name: String(g.name ?? '') })).filter((g) => g.id))

        await loadVideos({ q: '', sort: 'created_desc' })
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
  }, [cfg, loadVideos])

  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const pageSize = 20

  const reset = useCallback(() => {
    setQText('')
    setQWorkId('')
    setQStatus('')
    setQCategoryId('')
    setQTagId('')
    setQCastId('')
    setQGenreId('')
    setQSort('created_desc')
    setQFrom('')
    setQTo('')
    setPage(1)
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (qFrom && r.createdAt.slice(0, 10) < qFrom) return false
      if (qTo && r.createdAt.slice(0, 10) > qTo) return false
      return true
    })
  }, [qFrom, qTo, rows])

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
    async (id: string) => {
      const row = rows.find((r) => r.id === id)
      if (!row) return
      const next = row.status === '公開' ? '非公開' : '公開'
      const ok = await confirm(`${row.title} を「${next}」に切り替えますか？`, { title: '公開状態の変更' })
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
    [cfg, confirm, rows]
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
            <Text style={styles.label}>検索</Text>
            <TextInput value={qText} onChangeText={setQText} placeholder="タイトル / 説明 / 作品" style={styles.input} />
          </View>

          <SelectField
            label="作品名"
            value={qWorkId}
            placeholder="選択"
            options={workOptions}
            onChange={setQWorkId}
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
            label="カテゴリ"
            value={qCategoryId}
            placeholder="選択"
            options={categoryOptions}
            onChange={setQCategoryId}
          />

          <SelectField label="タグ" value={qTagId} placeholder="選択" options={tagOptions} onChange={setQTagId} />

          <SelectField label="キャスト" value={qCastId} placeholder="選択" options={castOptions} onChange={setQCastId} />

          <SelectField label="ジャンル" value={qGenreId} placeholder="選択" options={genreOptions} onChange={setQGenreId} />

          <SelectField
            label="並び順"
            value={qSort}
            placeholder="選択"
            options={[
              { label: '登録日（新しい順）', value: 'created_desc' },
              { label: '登録日（古い順）', value: 'created_asc' },
              { label: '公開予定日（早い順）', value: 'scheduled_asc' },
              { label: 'タイトル（昇順）', value: 'title_asc' },
            ]}
            onChange={(v) => setQSort(v as any)}
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
          <Pressable
            disabled={busy}
            onPress={() => {
              setPage(1)
              setBusy(true)
              setBanner('')
              void (async () => {
                try {
                  const published = qStatus === '公開' ? '1' : qStatus === '非公開' ? '0' : ''
                  await loadVideos({
                    q: qText,
                    workId: qWorkId,
                    published,
                    categoryId: qCategoryId,
                    tagId: qTagId,
                    castId: qCastId,
                    genreId: qGenreId,
                    sort: qSort,
                  })
                } catch (e) {
                  setBanner(e instanceof Error ? e.message : String(e))
                } finally {
                  setBusy(false)
                }
              })()
            }}
            style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}
          >
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
                '話数',
                '字幕',
                '公開状態',
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
                <Text style={styles.videoCell}>{r.episodeLabel}</Text>
                <Text style={styles.videoCell}>{r.subtitles}</Text>
                <Text style={styles.videoCell}>{r.status}</Text>
                <Text style={styles.videoCell}>{`${r.rating.toFixed(1)} (${r.reviewCount})`}</Text>
                <Text style={styles.videoCell}>{r.createdAt}</Text>
                <View style={[styles.videoCell, styles.actionsCell]}>
                  <Pressable onPress={() => onOpenDetail(r.id)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>詳細</Text>
                  </Pressable>
                  <Pressable onPress={() => onOpenDetail(r.id)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>編集</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => void togglePublish(r.id)} style={[styles.smallBtnPrimary, busy ? styles.btnDisabled : null]}>
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

type UnapprovedActorAccountRow = {
  id: string
  submittedAt: string
  name: string
  email: string
  status: '未承認'
}

function UnapprovedActorAccountsListScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const cfg = useCmsApi()
  const [rows, setRows] = useState<UnapprovedActorAccountRow[]>([])
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<{ id: string; name: string; email: string; submittedAt: string; status: string }> }>(
          cfg,
          '/cms/cast-profiles/unapproved'
        )
        if (!mounted) return
        setRows(
          (json.items || []).map((r) => ({
            id: String(r.id ?? ''),
            submittedAt: (String((r as any).submittedAt ?? '') || '').slice(0, 19).replace('T', ' ') || '—',
            name: String(r.name ?? '') || '—',
            email: String(r.email ?? '') || '—',
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
        <Text style={styles.pageTitle}>未承認俳優アカウント一覧</Text>
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
              <Text style={styles.placeholderText}>未承認アカウントはありません</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{`${r.submittedAt} / ${r.email} / ${r.status}`}</Text>
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

function UnapprovedActorAccountDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const { confirm } = useDialog()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState<null | { id: string; name: string; email: string; submittedAt: string; draft: any }>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/cast-profiles/unapproved/${encodeURIComponent(id)}`)
        if (!mounted) return
        setItem({
          id: String(json.item?.id ?? ''),
          name: String(json.item?.name ?? ''),
          email: String(json.item?.email ?? ''),
          submittedAt: String(json.item?.submittedAt ?? ''),
          draft: json.item?.draft ?? null,
        })
        setRejectReason(String(json.item?.rejectionReason ?? ''))
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

  const approve = useCallback(async () => {
    const ok = await confirm('この俳優アカウントを承認しますか？', { title: '承認' })
    if (!ok) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/cast-profiles/unapproved/${encodeURIComponent(id)}/approve`, { method: 'POST' })
        onBack()
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, confirm, id, onBack])

  const reject = useCallback(async () => {
    const reason = rejectReason.trim()
    if (!reason) {
      setBanner('否認コメントを入力してください')
      return
    }
    const ok = await confirm('この俳優アカウントを否認しますか？', { title: '否認', danger: true, okText: '否認' })
    if (!ok) return

    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/cast-profiles/unapproved/${encodeURIComponent(id)}/reject`, {
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
  }, [cfg, confirm, id, onBack, rejectReason])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>俳優アカウント詳細</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>申請情報</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>氏名</Text>
          <Text style={styles.readonlyText}>{item?.name || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>メール</Text>
          <Text style={styles.readonlyText}>{item?.email || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>申請日時</Text>
          <Text style={styles.readonlyText}>{(item?.submittedAt || '').slice(0, 19).replace('T', ' ') || '—'}</Text>
        </View>
        {item?.draft ? (
          <View style={styles.field}>
            <Text style={styles.label}>申請内容（JSON）</Text>
            <Text style={styles.readonlyText}>{JSON.stringify(item.draft)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>操作</Text>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={() => void approve()} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '処理中…' : '承認'}</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>否認コメント（必須）</Text>
          <TextInput value={rejectReason} onChangeText={setRejectReason} style={[styles.input, { minHeight: 90 }]} multiline />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={() => void reject()} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>{busy ? '処理中…' : '否認'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
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
  const { confirm } = useDialog()
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

  const approve = useCallback(async () => {
    const ok = await confirm('この動画を承認しますか？', { title: '承認' })
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
  }, [cfg, confirm, id, onBack])

  const reject = useCallback(async () => {
    const reason = rejectReason.trim()
    if (!reason) {
      setBanner('否認理由を入力してください')
      return
    }
    const ok = await confirm('この動画を否認しますか？', { title: '否認', danger: true, okText: '否認' })
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
  }, [cfg, confirm, id, onBack, rejectReason])

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
          <Pressable disabled={busy} onPress={() => void approve()} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '処理中…' : '承認'}</Text>
          </Pressable>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>否認理由（必須）</Text>
          <TextInput value={rejectReason} onChangeText={setRejectReason} style={[styles.input, { minHeight: 90 }]} multiline />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={() => void reject()} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>{busy ? '処理中…' : '否認'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type ScheduledVideoRow = { id: string; title: string; scheduledAt: string; status: '配信予約' | '取消' }

function ScheduledVideosListScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<ScheduledVideoRow[]>([])

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: Array<{ id: string; title: string; scheduledAt: string | null; status: string }> }>(
        cfg,
        '/cms/videos/scheduled'
      )
      setRows(
        (json.items ?? []).map((r) => {
          const status = String((r as any).status ?? 'scheduled')
          const scheduledAtRaw = (r as any).scheduledAt
          const scheduledAt = scheduledAtRaw ? String(scheduledAtRaw).slice(0, 19).replace('T', ' ') : ''
          return {
            id: String((r as any).id ?? ''),
            title: String((r as any).title ?? ''),
            scheduledAt,
            status: status === 'cancelled' ? '取消' : '配信予約',
          }
        })
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>配信予定動画一覧</Text>

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
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.title}</Text>
                <Text style={styles.tableDetail}>{`${r.scheduledAt} / ${r.status}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>配信予定がありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function ScheduledVideoDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [scheduledAt, setScheduledAt] = useState('')
  const [canceled, setCanceled] = useState(false)
  const [title, setTitle] = useState('')
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/videos/scheduled/${encodeURIComponent(id)}`)
        if (!mounted) return
        const it = json.item
        setTitle(String(it?.title ?? ''))
        setScheduledAt(it?.scheduledAt ? String(it.scheduledAt).slice(0, 19).replace('T', ' ') : '')
        setCanceled(String(it?.status ?? 'scheduled') === 'cancelled')
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
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/scheduled/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scheduledAt: scheduledAt.trim() || null, status: canceled ? 'cancelled' : 'scheduled' }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, canceled, id, scheduledAt])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>配信予定動画 詳細・編集</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>表示/編集</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>タイトル</Text>
          <Text style={styles.readonlyText}>{title || '—'}</Text>
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
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function VideoDetailScreen({
  id,
  onBack,
  onGoComments,
  onOpenVideo,
}: {
  id: string
  onBack: () => void
  onGoComments?: (workId: string, episodeId: string) => void
  onOpenVideo?: (id: string) => void
}) {
  const cfg = useCmsApi()
  const [title, setTitle] = useState('')
  const [workId, setWorkId] = useState('')
  const [desc, setDesc] = useState('')
  const [streamVideoId, setStreamVideoId] = useState('')
  const [streamVideoIdClean, setStreamVideoIdClean] = useState('')
  const [streamVideoIdSubtitled, setStreamVideoIdSubtitled] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [episodeNoText, setEpisodeNoText] = useState('')
  const [categoryIdsText, setCategoryIdsText] = useState('')
  const [tagIdsText, setTagIdsText] = useState('')
  const [castIdsText, setCastIdsText] = useState('')
  const [genreIdsText, setGenreIdsText] = useState('')
  const [published, setPublished] = useState(true)
  const [ratingAvg, setRatingAvg] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [playsCount, setPlaysCount] = useState(0)
  const [commentsCount, setCommentsCount] = useState(0)
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const [recommendations, setRecommendations] = useState<
    Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string }>
  >([])
  const [recoSearchQ, setRecoSearchQ] = useState('')
  const [recoSearchBusy, setRecoSearchBusy] = useState(false)
  const [recoSearchRows, setRecoSearchRows] = useState<
    Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string }>
  >([])
  const [manualRecoVideoId, setManualRecoVideoId] = useState('')

  const [workOptions, setWorkOptions] = useState<Array<{ label: string; value: string }>>([])
  const [categoryOptions, setCategoryOptions] = useState<MultiSelectOption[]>([])
  const [tagOptions, setTagOptions] = useState<MultiSelectOption[]>([])
  const [castOptions, setCastOptions] = useState<MultiSelectOption[]>([])
  const [genreOptions, setGenreOptions] = useState<MultiSelectOption[]>([])
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
    let mounted = true
    void (async () => {
      try {
        const [catsJson, tagsJson, castsJson, genresJson] = await Promise.all([
          cmsFetchJson<{ items: Array<{ id: string; name: string; enabled?: boolean }> }>(cfg, '/cms/categories'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/tags'),
          cmsFetchJson<{ items: Array<{ id: string; name: string; role?: string }> }>(cfg, '/cms/casts'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/genres'),
        ])
        if (!mounted) return
        setCategoryOptions(
          (catsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.enabled === false ? ' / 無効' : ''}`,
          }))
        )
        setTagOptions(
          (tagsJson.items ?? []).map((t) => ({
            value: String(t.id ?? ''),
            label: String(t.name ?? '') || String(t.id ?? ''),
            detail: String(t.id ?? ''),
          }))
        )
        setCastOptions(
          (castsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.role ? ` / ${String(c.role)}` : ''}`,
          }))
        )

        setGenreOptions(
          (genresJson.items ?? []).map((g) => ({
            value: String(g.id ?? ''),
            label: String(g.name ?? '') || String(g.id ?? ''),
            detail: String(g.id ?? ''),
          }))
        )
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
            streamVideoIdClean?: string
            streamVideoIdSubtitled?: string
            thumbnailUrl: string
            scheduledAt: string | null
            episodeNo?: number | null
            published: boolean
            categoryIds: string[]
            tagIds: string[]
            castIds: string[]
            genreIds?: string[]
            ratingAvg?: number
            reviewCount?: number
          }
          stats?: { playsCount?: number; commentsCount?: number }
        }>(cfg, `/cms/videos/${encodeURIComponent(id)}`)
        if (!mounted) return
        setWorkId(json.item.workId || '')
        setTitle(json.item.title || '')
        setDesc(json.item.description || '')
        setStreamVideoId(json.item.streamVideoId || '')
        setStreamVideoIdClean(String((json.item as any).streamVideoIdClean ?? ''))
        setStreamVideoIdSubtitled(String((json.item as any).streamVideoIdSubtitled ?? ''))
        setThumbnailUrl(json.item.thumbnailUrl || '')
        setScheduledAt(json.item.scheduledAt || '')
        const ep = (json.item as any).episodeNo
        setEpisodeNoText(ep === null || ep === undefined || !Number.isFinite(Number(ep)) ? '' : String(Number(ep)))
        setPublished(Boolean(json.item.published))
        setCategoryIdsText((json.item.categoryIds || []).join(', '))
        setTagIdsText((json.item.tagIds || []).join(', '))
        setCastIdsText((json.item.castIds || []).join(', '))

        setGenreIdsText((((json.item as any).genreIds as any[]) ?? []).map((v) => String(v ?? '').trim()).filter(Boolean).join(', '))

        setRatingAvg(Number((json.item as any).ratingAvg ?? 0) || 0)
        setReviewCount(Number((json.item as any).reviewCount ?? 0) || 0)
        setPlaysCount(Number((json as any).stats?.playsCount ?? 0) || 0)
        setCommentsCount(Number((json as any).stats?.commentsCount ?? 0) || 0)
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

  useEffect(() => {
    if (!id) return
    let mounted = true
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/videos/${encodeURIComponent(id)}/recommendations`)
        if (!mounted) return
        setRecommendations(
          (json.items ?? []).map((r) => ({
            id: String(r.id ?? ''),
            title: String(r.title ?? ''),
            workTitle: String(r.workTitle ?? ''),
            thumbnailUrl: String(r.thumbnailUrl ?? ''),
          }))
        )
      } catch {
        // ignore
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
            streamVideoIdClean,
            streamVideoIdSubtitled,
            thumbnailUrl,
            scheduledAt,
            episodeNo: episodeNoText.trim() ? Number(episodeNoText) : null,
            published,
            categoryIds: csvToIdList(categoryIdsText),
            tagIds: csvToIdList(tagIdsText),
            castIds: csvToIdList(castIdsText),
            genreIds: csvToIdList(genreIdsText),
          }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [castIdsText, categoryIdsText, cfg, desc, episodeNoText, genreIdsText, id, published, scheduledAt, streamVideoId, streamVideoIdClean, streamVideoIdSubtitled, tagIdsText, thumbnailUrl, title, workId])

  const moveReco = useCallback((videoId: string, dir: -1 | 1) => {
    setRecommendations((prev) => {
      const i = prev.findIndex((v) => v.id === videoId)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = prev.slice()
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
      return next
    })
  }, [])

  const removeReco = useCallback((videoId: string) => {
    setRecommendations((prev) => prev.filter((v) => v.id !== videoId))
  }, [])

  const addReco = useCallback((row: { id: string; title: string; workTitle: string; thumbnailUrl: string }) => {
    const vid = String(row.id || '').trim()
    if (!vid) return
    setRecommendations((prev) => {
      if (prev.some((v) => v.id === vid)) return prev
      return [...prev, { id: vid, title: String(row.title ?? ''), workTitle: String(row.workTitle ?? ''), thumbnailUrl: String(row.thumbnailUrl ?? '') }]
    })
  }, [])

  const onSearchReco = useCallback(() => {
    const q = recoSearchQ.trim()
    if (!q) {
      setRecoSearchRows([])
      return
    }
    setRecoSearchBusy(true)
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/videos?q=${encodeURIComponent(q)}&limit=50`)
        setRecoSearchRows(
          (json.items ?? []).map((v) => ({
            id: String(v.id ?? ''),
            title: String(v.title ?? ''),
            workTitle: String(v.workTitle ?? ''),
            thumbnailUrl: String(v.thumbnailUrl ?? ''),
          }))
        )
      } catch {
        // ignore
      } finally {
        setRecoSearchBusy(false)
      }
    })()
  }, [cfg, recoSearchQ])

  const onSaveReco = useCallback(() => {
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}/recommendations`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ videoIds: recommendations.map((v) => v.id) }),
        })
        setBanner('おすすめを保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, id, recommendations])

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
        <View style={styles.field}>
          <Text style={styles.label}>評価</Text>
          <Text style={styles.readonlyText}>{`${(Number(ratingAvg) || 0).toFixed(2)}（${Number(reviewCount) || 0}件） / 再生:${Number(playsCount) || 0} / コメント:${Number(commentsCount) || 0}`}</Text>
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
          <Text style={styles.label}>Stream Video ID（クリーン）</Text>
          <TextInput value={streamVideoIdClean} onChangeText={setStreamVideoIdClean} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID（字幕）</Text>
          <TextInput value={streamVideoIdSubtitled} onChangeText={setStreamVideoIdSubtitled} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネURL</Text>
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>話数（episodeNo）</Text>
          <TextInput value={episodeNoText} onChangeText={setEpisodeNoText} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>配信予定日時（ISO文字列）</Text>
          <TextInput value={scheduledAt} onChangeText={setScheduledAt} placeholder="2026-01-15T20:00:00Z" style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>公開</Text>
          <Switch value={published} onValueChange={setPublished} />
        </View>
        <MultiSelectField
          label="カテゴリ（複数選択）"
          values={csvToIdList(categoryIdsText)}
          placeholder="選択"
          options={categoryOptions}
          onChange={(ids) => setCategoryIdsText(ids.join(', '))}
          searchPlaceholder="カテゴリ検索（名前 / ID）"
        />
        <MultiSelectField
          label="タグ（複数選択）"
          values={csvToIdList(tagIdsText)}
          placeholder="選択"
          options={tagOptions}
          onChange={(ids) => setTagIdsText(ids.join(', '))}
          searchPlaceholder="タグ検索（名前 / ID）"
        />
        <MultiSelectField
          label="出演者（複数選択）"
          values={csvToIdList(castIdsText)}
          placeholder="選択"
          options={castOptions}
          onChange={(ids) => setCastIdsText(ids.join(', '))}
          searchPlaceholder="出演者検索（名前 / ID）"
        />
        <MultiSelectField
          label="ジャンル（複数選択）"
          values={csvToIdList(genreIdsText)}
          placeholder="選択"
          options={genreOptions}
          onChange={(ids) => setGenreIdsText(ids.join(', '))}
          searchPlaceholder="ジャンル検索（名前 / ID）"
        />
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
          {onGoComments && workId && id ? (
            <Pressable
              disabled={busy}
              onPress={() => onGoComments(workId, id)}
              style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}
            >
              <Text style={styles.btnSecondaryText}>コメント一覧へ</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{`この動画のおすすめ（${recommendations.length}件）`}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>手動追加（動画ID）</Text>
          <View style={styles.row}>
            <TextInput value={manualRecoVideoId} onChangeText={setManualRecoVideoId} style={[styles.input, { flex: 1 }]} autoCapitalize="none" />
            <Pressable
              onPress={() => {
                const vid = manualRecoVideoId.trim()
                if (!vid) return
                addReco({ id: vid, title: '', workTitle: '', thumbnailUrl: '' })
                setManualRecoVideoId('')
              }}
              style={styles.smallBtnPrimary}
            >
              <Text style={styles.smallBtnPrimaryText}>追加</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>検索して追加</Text>
          <View style={styles.row}>
            <TextInput value={recoSearchQ} onChangeText={setRecoSearchQ} style={[styles.input, { flex: 1 }]} placeholder="タイトル/作品/ID" />
            <Pressable disabled={recoSearchBusy} onPress={onSearchReco} style={[styles.smallBtn, recoSearchBusy ? styles.btnDisabled : null]}>
              <Text style={styles.smallBtnText}>{recoSearchBusy ? '検索中…' : '検索'}</Text>
            </Pressable>
          </View>
          {recoSearchRows.length ? (
            <View style={styles.table}>
              {recoSearchRows.map((v) => (
                <View key={v.id} style={styles.tableRow}>
                  {onOpenVideo ? (
                    <Pressable onPress={() => onOpenVideo(v.id)} style={styles.tableLeft}>
                      <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                      <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : ''}`}</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.tableLeft}>
                      <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                      <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : ''}`}</Text>
                    </View>
                  )}
                  <Pressable onPress={() => addReco(v)} style={styles.smallBtnPrimary}>
                    <Text style={styles.smallBtnPrimaryText}>追加</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.table}>
          {recommendations.map((v, idx) => (
            <View key={v.id} style={styles.tableRow}>
              {onOpenVideo ? (
                <Pressable onPress={() => onOpenVideo(v.id)} style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>{`${idx + 1}. ${v.title || v.id}`}</Text>
                  <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : ''}`}</Text>
                </Pressable>
              ) : (
                <View style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>{`${idx + 1}. ${v.title || v.id}`}</Text>
                  <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : ''}`}</Text>
                </View>
              )}
              <View style={styles.row}>
                <Pressable onPress={() => moveReco(v.id, -1)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>↑</Text>
                </Pressable>
                <Pressable onPress={() => moveReco(v.id, 1)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>↓</Text>
                </Pressable>
                <Pressable onPress={() => removeReco(v.id)} style={styles.smallBtnDanger}>
                  <Text style={styles.smallBtnDangerText}>削除</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!recommendations.length ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>おすすめがありません</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSaveReco} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : 'おすすめ保存'}</Text>
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
  const [streamVideoIdClean, setStreamVideoIdClean] = useState('')
  const [streamVideoIdSubtitled, setStreamVideoIdSubtitled] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [episodeNoText, setEpisodeNoText] = useState('')
  const [publish, setPublish] = useState(false)

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const [thumbnailUploadMsg, setThumbnailUploadMsg] = useState('')

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadState, setUploadState] = useState<'idle' | 'creating' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadMsg, setUploadMsg] = useState('')
  const uploadRef = useRef<any>(null)

  const [streamProbe, setStreamProbe] = useState<{
    loading: boolean
    configured: boolean | null
    readyToStream: boolean | null
    status: string | null
    error: string | null
  }>({ loading: false, configured: null, readyToStream: null, status: null, error: null })

  const [categoryIdsText, setCategoryIdsText] = useState('')
  const [tagIdsText, setTagIdsText] = useState('')
  const [castIdsText, setCastIdsText] = useState('')
  const [genreIdsText, setGenreIdsText] = useState('')

  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const [workOptions, setWorkOptions] = useState<Array<{ label: string; value: string }>>([])
  const [categoryOptions, setCategoryOptions] = useState<MultiSelectOption[]>([])
  const [tagOptions, setTagOptions] = useState<MultiSelectOption[]>([])
  const [castOptions, setCastOptions] = useState<MultiSelectOption[]>([])
  const [genreOptions, setGenreOptions] = useState<MultiSelectOption[]>([])
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
    let mounted = true
    void (async () => {
      try {
        const [catsJson, tagsJson, castsJson, genresJson] = await Promise.all([
          cmsFetchJson<{ items: Array<{ id: string; name: string; enabled?: boolean }> }>(cfg, '/cms/categories'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/tags'),
          cmsFetchJson<{ items: Array<{ id: string; name: string; role?: string }> }>(cfg, '/cms/casts'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/genres'),
        ])
        if (!mounted) return
        setCategoryOptions(
          (catsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.enabled === false ? ' / 無効' : ''}`,
          }))
        )
        setTagOptions(
          (tagsJson.items ?? []).map((t) => ({
            value: String(t.id ?? ''),
            label: String(t.name ?? '') || String(t.id ?? ''),
            detail: String(t.id ?? ''),
          }))
        )
        setCastOptions(
          (castsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.role ? ` / ${String(c.role)}` : ''}`,
          }))
        )

        setGenreOptions(
          (genresJson.items ?? []).map((g) => ({
            value: String(g.id ?? ''),
            label: String(g.name ?? '') || String(g.id ?? ''),
            detail: String(g.id ?? ''),
          }))
        )
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
            streamVideoIdClean,
            streamVideoIdSubtitled,
            thumbnailUrl,
            published: publish,
            episodeNo: episodeNoText.trim() ? Number(episodeNoText) : null,
            categoryIds: csvToIdList(categoryIdsText),
            tagIds: csvToIdList(tagIdsText),
            castIds: csvToIdList(castIdsText),
            genreIds: csvToIdList(genreIdsText),
          }),
        })
        setBanner('登録しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [castIdsText, categoryIdsText, cfg, desc, episodeNoText, genreIdsText, publish, streamVideoId, streamVideoIdClean, streamVideoIdSubtitled, tagIdsText, thumbnailUrl, title, workId])

  const stopUpload = useCallback(() => {
    try {
      if (uploadRef.current && typeof uploadRef.current.abort === 'function') {
        uploadRef.current.abort(true)
      }
    } catch {
      // ignore
    }
    uploadRef.current = null
    setUploadState('idle')
    setUploadPct(0)
    setUploadMsg('')
  }, [])

  const uploadThumbnail = useCallback(() => {
    if (Platform.OS !== 'web') {
      setThumbnailUploadMsg('サムネイル画像アップロードはWeb版管理画面のみ対応です')
      return
    }
    if (!thumbnailFile) {
      setThumbnailUploadMsg('画像ファイルを選択してください')
      return
    }

    setThumbnailUploading(true)
    setThumbnailUploadMsg('画像アップロード中…')
    void (async () => {
      try {
        const res = await cmsFetchJsonWithBase<{ error: string | null; data: { fileId: string; url: string } | null }>(
          cfg,
          cfg.uploaderBase,
          '/cms/images',
          {
            method: 'PUT',
            headers: {
              'content-type': thumbnailFile.type || 'application/octet-stream',
            },
            body: thumbnailFile,
          }
        )

        if (res.error || !res.data?.url) {
          throw new Error(res.error || '画像アップロードに失敗しました')
        }

        setThumbnailUrl(res.data.url)
        setThumbnailUploadMsg('画像アップロード完了')
      } catch (e) {
        setThumbnailUploadMsg(e instanceof Error ? e.message : String(e))
      } finally {
        setThumbnailUploading(false)
      }
    })()
  }, [cfg, thumbnailFile])

  const startStreamUpload = useCallback(() => {
    if (Platform.OS !== 'web') {
      setUploadState('error')
      setUploadMsg('アップロードはWeb版管理画面のみ対応です')
      return
    }
    if (!uploadFile) {
      setUploadState('error')
      setUploadMsg('動画ファイルを選択してください')
      return
    }
    if (!tus) {
      setUploadState('error')
      setUploadMsg('tus uploader が初期化できませんでした')
      return
    }

    const maxBytes = 30 * 1024 * 1024 * 1024
    if (typeof uploadFile.size === 'number' && uploadFile.size > maxBytes) {
      setUploadState('error')
      setUploadMsg('ファイルが大きすぎます（最大30GB）')
      return
    }

    setUploadState('creating')
    setUploadPct(0)
    setUploadMsg('アップロードURL発行中…')

    void (async () => {
      try {
        const tusEndpoint = new URL('/cms/stream/tus', cfg.uploaderBase).toString()
        const uploaderBase = String(cfg.uploaderBase || '').replace(/\/$/, '')
        let createdUid = ''

        setUploadState('uploading')
        setUploadMsg('アップロード開始中…')

        const uploader = new tus.Upload(uploadFile, {
          endpoint: tusEndpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 50 * 1024 * 1024,
          metadata: {
            filename: uploadFile.name,
            filetype: uploadFile.type || 'application/octet-stream',
          },
          onBeforeRequest: (req: any) => {
            // Only attach CMS token when calling our uploader Worker. Do not leak it to upload.cloudflarestream.com.
            try {
              const url = typeof req?.getURL === 'function' ? String(req.getURL() || '') : ''
              if (uploaderBase && url.startsWith(uploaderBase) && typeof req?.setHeader === 'function') {
                req.setHeader('Authorization', `Bearer ${cfg.token}`)
              }
            } catch {
              // ignore
            }
          },
          onAfterResponse: (_req: any, res: any) => {
            if (createdUid) return
            try {
              const getHeader = (name: string): string => {
                if (res && typeof res.getHeader === 'function') return String(res.getHeader(name) || '')
                if (res && typeof res.getResponseHeader === 'function') return String(res.getResponseHeader(name) || '')
                return ''
              }

              const mediaId = (getHeader('Stream-Media-ID') || getHeader('stream-media-id')).trim()
              const location = (getHeader('Location') || getHeader('location')).trim()

              const inferred = (() => {
                const m = (location || '').match(/\/stream\/([a-f0-9]{32})/i)
                return m?.[1] || ''
              })()

              const uid = (mediaId || inferred).trim()
              if (uid) {
                createdUid = uid
                setStreamVideoId(uid)
              }
            } catch {
              // ignore
            }
          },
          onError: (err: any) => {
            setUploadState('error')
            setUploadMsg(err instanceof Error ? err.message : String(err))
          },
          onProgress: (bytesUploaded: number, bytesTotal: number) => {
            const pct = bytesTotal > 0 ? Math.floor((bytesUploaded / bytesTotal) * 100) : 0
            setUploadPct(pct)
          },
          onSuccess: () => {
            if (!createdUid) {
              try {
                const url = String((uploader as any).url || '').trim()
                const m = url.match(/\/stream\/([a-f0-9]{32})/i)
                const uid = (m?.[1] || '').trim()
                if (uid) {
                  createdUid = uid
                  setStreamVideoId(uid)
                }
              } catch {
                // ignore
              }
            }
            setUploadState('done')
            setUploadPct(100)
            setUploadMsg('アップロード完了（Stream側の処理が終わるまで少し待つ場合があります）')
          },
        })

        uploadRef.current = uploader
        uploader.start()
      } catch (e) {
        setUploadState('error')
        setUploadMsg(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [cfg, uploadFile])

  useEffect(() => {
    if (!streamVideoId.trim()) {
      setStreamProbe({ loading: false, configured: null, readyToStream: null, status: null, error: null })
      return
    }

    // Only auto-poll after a fresh upload succeeded.
    if (uploadState !== 'done') return

    let cancelled = false
    let timer: any = null
    const startedAt = Date.now()

    const tick = async () => {
      if (cancelled) return
      setStreamProbe((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const json = await cmsFetchJson<{
          configured?: boolean
          readyToStream?: boolean | null
          status?: string | null
        }>(cfg, `/v1/stream/playback/${encodeURIComponent(streamVideoId.trim())}`)

        if (cancelled) return
        const configured = json.configured !== undefined ? Boolean(json.configured) : true
        const readyToStream = json.readyToStream === null || json.readyToStream === undefined ? null : Boolean(json.readyToStream)
        const status = json.status === null || json.status === undefined ? null : String(json.status)

        setStreamProbe({ loading: false, configured, readyToStream, status, error: null })

        // Stop polling once the video is ready.
        if (readyToStream === true) return
      } catch (e) {
        if (cancelled) return
        setStreamProbe((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }))
      }

      // Avoid polling forever.
      if (Date.now() - startedAt > 30 * 60 * 1000) return

      timer = setTimeout(tick, 5000)
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [cfg, streamVideoId, uploadState])

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
          <Text style={styles.label}>Cloudflare Streamへアップロード（最大30GB）</Text>
          {Platform.OS === 'web' ? (
            <View>
              <View style={{ marginTop: 6 }}>
                {
                  // Use native file input for web.
                  // eslint-disable-next-line react/no-unknown-property
                }
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e: any) => {
                    const file = e?.target?.files?.[0] ?? null
                    setUploadFile(file)
                    setUploadPct(0)
                    setUploadState('idle')
                    setUploadMsg('')
                  }}
                />
              </View>

              {uploadFile ? (
                <Text style={[styles.selectMenuDetailText, { marginTop: 6 }]}>
                  {`選択: ${uploadFile.name} / ${(uploadFile.size / (1024 * 1024)).toFixed(1)}MB`}
                </Text>
              ) : (
                <Text style={[styles.selectMenuDetailText, { marginTop: 6 }]}>動画ファイルを選択してください</Text>
              )}

              <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                <Pressable
                  disabled={uploadState === 'creating' || uploadState === 'uploading' || !uploadFile}
                  onPress={startStreamUpload}
                  style={[styles.btnSecondary, (uploadState === 'creating' || uploadState === 'uploading' || !uploadFile) ? styles.btnDisabled : null]}
                >
                  <Text style={styles.btnSecondaryText}>
                    {uploadState === 'creating'
                      ? 'URL発行中…'
                      : uploadState === 'uploading'
                        ? `アップロード中… ${uploadPct}%`
                        : uploadState === 'done'
                          ? '再アップロード'
                          : 'アップロード開始'}
                  </Text>
                </Pressable>
                {uploadState === 'uploading' ? (
                  <Pressable onPress={stopUpload} style={styles.btnSecondary}>
                    <Text style={styles.btnSecondaryText}>中止</Text>
                  </Pressable>
                ) : null}
              </View>

              {uploadState === 'uploading' || uploadState === 'done' ? (
                <View style={styles.uploadBarOuter}>
                  <View style={[styles.uploadBarInner, { width: `${Math.min(100, Math.max(0, uploadPct))}%` }]} />
                </View>
              ) : null}

              {uploadMsg ? <Text style={[styles.selectMenuDetailText, { marginTop: 8 }]}>{uploadMsg}</Text> : null}
              {streamVideoId ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.selectMenuDetailText}>{`Stream Video ID: ${streamVideoId}`}</Text>
                  {uploadState === 'done' ? (
                    <Text style={[styles.selectMenuDetailText, { marginTop: 4 }]}>
                      {streamProbe.loading
                        ? 'Stream状況確認中…'
                        : streamProbe.error
                          ? `Stream状況取得エラー: ${streamProbe.error}`
                          : streamProbe.configured === false
                            ? 'Stream設定が未構成の可能性があります'
                            : streamProbe.readyToStream === true
                              ? 'エンコード完了（再生可能）'
                              : streamProbe.status
                                ? `エンコード中…（status: ${streamProbe.status}）`
                                : 'エンコード中…'}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.selectMenuDetailText}>Web版管理画面でアップロードできます</Text>
          )}
        </View>

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
          <Text style={styles.label}>Stream Video ID（クリーン）</Text>
          <TextInput value={streamVideoIdClean} onChangeText={setStreamVideoIdClean} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID（字幕）</Text>
          <TextInput value={streamVideoIdSubtitled} onChangeText={setStreamVideoIdSubtitled} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネURL</Text>
          <Text style={styles.selectMenuDetailText}>推奨サイズ: 16:9（例: 1280×720）</Text>
          {Platform.OS === 'web' ? (
            <View style={{ marginTop: 6 }}>
              {
                // eslint-disable-next-line react/no-unknown-property
              }
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e: any) => {
                  const file = e?.target?.files?.[0] ?? null
                  setThumbnailFile(file)
                  setThumbnailUploadMsg('')
                }}
              />
              <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}
              >
                <Pressable
                  disabled={thumbnailUploading || !thumbnailFile}
                  onPress={uploadThumbnail}
                  style={[styles.btnSecondary, (thumbnailUploading || !thumbnailFile) ? styles.btnDisabled : null]}
                >
                  <Text style={styles.btnSecondaryText}>{thumbnailUploading ? '画像アップロード中…' : '画像をアップロードしてURLに反映'}</Text>
                </Pressable>
                {thumbnailUploadMsg ? (
                  <Text style={[styles.selectMenuDetailText, { marginLeft: 10, alignSelf: 'center' }]}>{thumbnailUploadMsg}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://..." style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>話数（episodeNo）</Text>
          <TextInput value={episodeNoText} onChangeText={setEpisodeNoText} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>公開（簡易）</Text>
          <Switch value={publish} onValueChange={setPublish} />
        </View>
        <MultiSelectField
          label="カテゴリ（複数選択）"
          values={csvToIdList(categoryIdsText)}
          placeholder="選択"
          options={categoryOptions}
          onChange={(ids) => setCategoryIdsText(ids.join(', '))}
          searchPlaceholder="カテゴリ検索（名前 / ID）"
        />
        <MultiSelectField
          label="タグ（複数選択）"
          values={csvToIdList(tagIdsText)}
          placeholder="選択"
          options={tagOptions}
          onChange={(ids) => setTagIdsText(ids.join(', '))}
          searchPlaceholder="タグ検索（名前 / ID）"
        />
        <MultiSelectField
          label="出演者（複数選択）"
          values={csvToIdList(castIdsText)}
          placeholder="選択"
          options={castOptions}
          onChange={(ids) => setCastIdsText(ids.join(', '))}
          searchPlaceholder="出演者検索（名前 / ID）"
        />
        <MultiSelectField
          label="ジャンル（複数選択）"
          values={csvToIdList(genreIdsText)}
          placeholder="選択"
          options={genreOptions}
          onChange={(ids) => setGenreIdsText(ids.join(', '))}
          searchPlaceholder="ジャンル検索（名前 / ID）"
        />
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
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const [thumbnailUploadMsg, setThumbnailUploadMsg] = useState('')
  const [categoryIdsText, setCategoryIdsText] = useState('')
  const [tagIdsText, setTagIdsText] = useState('')
  const [castIdsText, setCastIdsText] = useState('')
  const [published, setPublished] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  const [categoryOptions, setCategoryOptions] = useState<MultiSelectOption[]>([])
  const [tagOptions, setTagOptions] = useState<MultiSelectOption[]>([])
  const [castOptions, setCastOptions] = useState<MultiSelectOption[]>([])

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

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const [catsJson, tagsJson, castsJson] = await Promise.all([
          cmsFetchJson<{ items: Array<{ id: string; name: string; enabled?: boolean }> }>(cfg, '/cms/categories'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/tags'),
          cmsFetchJson<{ items: Array<{ id: string; name: string; role?: string }> }>(cfg, '/cms/casts'),
        ])
        if (!mounted) return
        setCategoryOptions(
          (catsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.enabled === false ? ' / 無効' : ''}`,
          }))
        )
        setTagOptions(
          (tagsJson.items ?? []).map((t) => ({
            value: String(t.id ?? ''),
            label: String(t.name ?? '') || String(t.id ?? ''),
            detail: String(t.id ?? ''),
          }))
        )
        setCastOptions(
          (castsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.role ? ` / ${String(c.role)}` : ''}`,
          }))
        )
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg])

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

  const uploadThumbnail = useCallback(() => {
    if (Platform.OS !== 'web') {
      setThumbnailUploadMsg('サムネイル画像アップロードはWeb版管理画面のみ対応です')
      return
    }
    if (!thumbnailFile) {
      setThumbnailUploadMsg('画像ファイルを選択してください')
      return
    }

    setThumbnailUploading(true)
    setThumbnailUploadMsg('画像アップロード中…')
    void (async () => {
      try {
        const res = await cmsFetchJsonWithBase<{ error: string | null; data: { fileId: string; url: string } | null }>(
          cfg,
          cfg.uploaderBase,
          '/cms/images',
          {
            method: 'PUT',
            headers: {
              'content-type': thumbnailFile.type || 'application/octet-stream',
            },
            body: thumbnailFile,
          }
        )

        if (res.error || !res.data?.url) {
          throw new Error(res.error || '画像アップロードに失敗しました')
        }

        setThumbnailUrl(res.data.url)
        setThumbnailUploadMsg('画像アップロード完了')
      } catch (e) {
        setThumbnailUploadMsg(e instanceof Error ? e.message : String(e))
      } finally {
        setThumbnailUploading(false)
      }
    })()
  }, [cfg, thumbnailFile])

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
          <Text style={styles.selectMenuDetailText}>推奨サイズ: 16:9（例: 1280×720）</Text>
          {Platform.OS === 'web' ? (
            <View style={{ marginTop: 6 }}>
              {
                // eslint-disable-next-line react/no-unknown-property
              }
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e: any) => {
                  const file = e?.target?.files?.[0] ?? null
                  setThumbnailFile(file)
                  setThumbnailUploadMsg('')
                }}
              />
              <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                <Pressable
                  disabled={thumbnailUploading || !thumbnailFile}
                  onPress={uploadThumbnail}
                  style={[styles.btnSecondary, (thumbnailUploading || !thumbnailFile) ? styles.btnDisabled : null]}
                >
                  <Text style={styles.btnSecondaryText}>{thumbnailUploading ? '画像アップロード中…' : '画像をアップロードしてURLに反映'}</Text>
                </Pressable>
                {thumbnailUploadMsg ? (
                  <Text style={[styles.selectMenuDetailText, { marginLeft: 10, alignSelf: 'center' }]}>{thumbnailUploadMsg}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://..." style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>公開</Text>
          <Switch value={published} onValueChange={setPublished} />
        </View>
        <MultiSelectField
          label="カテゴリ（複数選択）"
          values={csvToIdList(categoryIdsText)}
          placeholder="選択"
          options={categoryOptions}
          onChange={(ids) => setCategoryIdsText(ids.join(', '))}
          searchPlaceholder="カテゴリ検索（名前 / ID）"
        />
        <MultiSelectField
          label="タグ（複数選択）"
          values={csvToIdList(tagIdsText)}
          placeholder="選択"
          options={tagOptions}
          onChange={(ids) => setTagIdsText(ids.join(', '))}
          searchPlaceholder="タグ検索（名前 / ID）"
        />
        <MultiSelectField
          label="出演者（複数選択）"
          values={csvToIdList(castIdsText)}
          placeholder="選択"
          options={castOptions}
          onChange={(ids) => setCastIdsText(ids.join(', '))}
          searchPlaceholder="出演者検索（名前 / ID）"
        />
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
  status: 'pending' | 'approved' | 'rejected'
}

function commentStatusLabel(v: CommentRow['status']): string {
  switch (v) {
    case 'pending':
      return '未対応非公開'
    case 'approved':
      return '公開済み'
    case 'rejected':
      return '対応済み非公開'
    default:
      return '未対応非公開'
  }
}

function commentTargetTitle(contentTitle: string, contentId: string, episodeId: string): string {
  const base = contentTitle || contentId || '—'
  const ep = (episodeId || '').trim()
  return ep ? `${base} 第${ep}話` : base
}

function CommentsPendingListScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<CommentRow[]>([])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/comments?status=pending')
        if (!mounted) return
        setRows(
          (json.items ?? []).map((c) => ({
            id: String(c.id ?? ''),
            targetTitle: commentTargetTitle(String(c.contentTitle ?? ''), String(c.contentId ?? ''), String(c.episodeId ?? '')),
            author: String(c.author ?? ''),
            body: String(c.body ?? ''),
            createdAt: String(c.createdAt ?? ''),
            status: (String(c.status ?? 'pending') as any) as CommentRow['status'],
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
      <Text style={styles.pageTitle}>未承認/未対応コメント一覧</Text>

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
                <Text style={styles.tableLabel}>{`${r.targetTitle} / ${r.author}`}</Text>
                <Text style={styles.tableDetail}>{`${r.createdAt} / ${commentStatusLabel(r.status)}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>未対応コメントがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function CommentApproveScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [decision, setDecision] = useState<'公開済み' | '対応済み非公開' | ''>('')
  const [reason, setReason] = useState('')
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState<null | { id: string; targetTitle: string; author: string; body: string; createdAt: string; status: CommentRow['status'] }>(null)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/comments/${encodeURIComponent(id)}`)
        if (!mounted) return
        const c = json.item
        setItem({
          id: String(c?.id ?? id),
          targetTitle: commentTargetTitle(String(c?.contentTitle ?? ''), String(c?.contentId ?? ''), String(c?.episodeId ?? '')),
          author: String(c?.author ?? ''),
          body: String(c?.body ?? ''),
          createdAt: String(c?.createdAt ?? ''),
          status: (String(c?.status ?? 'pending') as any) as CommentRow['status'],
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

  const onSubmit = useCallback(() => {
    if (!decision) {
      setBanner('ステータスを選択してください')
      return
    }
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        if (decision === '公開済み') {
          await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}/approve`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ note: reason }),
          })
        } else {
          await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}/reject`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ note: reason }),
          })
        }
        setBanner('更新しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, decision, id, reason])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>コメント詳細（承認/否認）</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>表示</Text>
        <View style={styles.field}>
          <Text style={styles.label}>コメントID</Text>
          <Text style={styles.readonlyText}>{item?.id || id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>対象</Text>
          <Text style={styles.readonlyText}>{item?.targetTitle || (busy ? '—' : '—')}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>投稿者</Text>
          <Text style={styles.readonlyText}>{item?.author || (busy ? '—' : '—')}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>本文</Text>
          <Text style={styles.readonlyText}>{item?.body || (busy ? '—' : '—')}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>投稿日時</Text>
          <Text style={styles.readonlyText}>{item?.createdAt || (busy ? '—' : '—')}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>現在ステータス</Text>
          <Text style={styles.readonlyText}>{item ? commentStatusLabel(item.status) : busy ? '—' : '—'}</Text>
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
          <Pressable disabled={busy} onPress={onSubmit} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '更新中…' : '確定'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function CommentsListScreen({
  onOpenEdit,
  initialContentId,
  initialEpisodeId,
}: {
  onOpenEdit: (id: string) => void
  initialContentId?: string
  initialEpisodeId?: string
}) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [qStatus, setQStatus] = useState<'' | 'pending' | 'approved' | 'rejected'>('')
  const [qContentId, setQContentId] = useState(initialContentId ? String(initialContentId) : '')
  const [qEpisodeId, setQEpisodeId] = useState(initialEpisodeId ? String(initialEpisodeId) : '')
  const [rows, setRows] = useState<CommentRow[]>([])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const params = new URLSearchParams()
        if (qStatus) params.set('status', qStatus)
        if (qContentId.trim()) params.set('contentId', qContentId.trim())
        if (qEpisodeId.trim()) params.set('episodeId', qEpisodeId.trim())
        const qs = params.toString() ? `?${params.toString()}` : ''
        const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/comments${qs}`)
        if (!mounted) return
        setRows(
          (json.items ?? []).map((c) => ({
            id: String(c.id ?? ''),
            targetTitle: commentTargetTitle(String(c.contentTitle ?? ''), String(c.contentId ?? ''), String(c.episodeId ?? '')),
            author: String(c.author ?? ''),
            body: String(c.body ?? ''),
            createdAt: String(c.createdAt ?? ''),
            status: (String(c.status ?? 'pending') as any) as CommentRow['status'],
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
  }, [cfg, qContentId, qEpisodeId, qStatus])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>コメント一覧</Text>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>検索</Text>
        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>作品ID（contentId）</Text>
            <TextInput value={qContentId} onChangeText={setQContentId} placeholder="work_..." style={styles.input} autoCapitalize="none" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>エピソードID/話数（episodeId）</Text>
            <TextInput value={qEpisodeId} onChangeText={setQEpisodeId} placeholder="video_... / 1" style={styles.input} autoCapitalize="none" />
          </View>
        </View>
        <SelectField
          label="ステータス"
          value={qStatus}
          placeholder="全て"
          options={[
            { label: '全て', value: '' },
            { label: '未対応非公開', value: 'pending' },
            { label: '公開済み', value: 'approved' },
            { label: '対応済み非公開', value: 'rejected' },
          ]}
          onChange={(v) => setQStatus(v as any)}
        />
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
            <Pressable key={r.id} onPress={() => onOpenEdit(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{`${r.targetTitle} / ${r.author}`}</Text>
                <Text style={styles.tableDetail}>{`${r.createdAt} / ${commentStatusLabel(r.status)}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>コメントがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function CommentEditScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [status, setStatus] = useState<'approved' | 'rejected'>('approved')
  const [deleted, setDeleted] = useState(false)
  const [note, setNote] = useState('')
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/comments/${encodeURIComponent(id)}`)
        if (!mounted) return
        const c = json.item
        const st = String(c?.status ?? 'approved')
        setStatus(st === 'rejected' ? 'rejected' : 'approved')
        setDeleted(Boolean(c?.deleted))
        setNote(String(c?.moderationNote ?? ''))
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
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status, deleted, note }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, deleted, id, note, status])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>コメント編集</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

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
            { label: '公開', value: 'approved' },
            { label: '非公開', value: 'rejected' },
          ]}
          onChange={(v) => setStatus(v as any)}
        />
        <View style={styles.field}>
          <Text style={styles.label}>メモ（任意）</Text>
          <TextInput value={note} onChangeText={setNote} style={[styles.input, { minHeight: 90 }]} multiline />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>削除（論理削除）</Text>
          <Switch value={deleted} onValueChange={setDeleted} />
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

type UserRow = { id: string; email: string; emailVerified: boolean; phone: string; phoneVerified: boolean; createdAt: string; kind: 'user' | 'cast' }

function UsersListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew?: () => void }) {
  const cfg = useCmsApi()
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
  }, [cfg, qKind, qSort])

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
            onChange={(v) => setQKind(v as any)}
          />
          <SelectField
            label="並び順"
            value={qSort}
            placeholder="作成日（新しい順）"
            options={[
              { label: '作成日（新しい順）', value: '' },
              { label: '区分→作成日', value: 'kind' },
            ]}
            onChange={(v) => setQSort(v as any)}
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

function UserCreateScreen({
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
  }, [cfg, email, onCreated, password, phone])

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

function UserDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState<null | { id: string; email: string; emailVerified: boolean; phone: string; phoneVerified: boolean; createdAt: string; updatedAt: string }>(null)

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
  }, [cfg, id])

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

type NoticeStatus = 'draft' | 'scheduled' | 'sent' | 'cancelled'
type NoticeRow = {
  id: string
  subject: string
  body: string
  createdByLabel: string
  sentAt: string
  status: NoticeStatus
  push: boolean
  tags: string[]
}

function noticeStatusLabel(v: NoticeStatus): string {
  switch (v) {
    case 'draft':
      return '下書き'
    case 'scheduled':
      return '予約'
    case 'sent':
      return '送信済み'
    case 'cancelled':
      return '取消'
    default:
      return '下書き'
  }
}

function NoticesListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew: () => void }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<NoticeRow[]>([])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<any> }>(
          cfg,
          '/cms/notices'
        )
        if (!mounted) return
        setRows(
          (json.items ?? []).map((n) => ({
            id: String(n.id ?? ''),
            subject: String(n.subject ?? ''),
            body: String((n as any).body ?? ''),
            createdByLabel: (() => {
              const cb = (n as any).createdBy
              const email = cb?.email ? String(cb.email) : ''
              const name = cb?.name ? String(cb.name) : ''
              const id = cb?.id ? String(cb.id) : ''
              const label = name || email || id
              return label ? `登録者: ${label}` : ''
            })(),
            sentAt: String((n as any).sentAt ?? ''),
            status: (String((n as any).status ?? 'draft') as NoticeStatus) || 'draft',
            push: Boolean((n as any).push),
            tags: Array.isArray((n as any).tags) ? (n as any).tags.map((t: any) => String(t ?? '').trim()).filter(Boolean) : [],
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
        <Text style={styles.pageTitle}>お知らせ一覧</Text>
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
                <Text style={styles.tableLabel}>{r.subject}</Text>
                <Text style={styles.tableDetail}>{`${r.sentAt || '—'} / ${noticeStatusLabel(r.status)}${r.tags.length ? ` / タグ: ${r.tags.join(',')}` : ''}`}</Text>
                {r.createdByLabel ? <Text style={styles.tableDetail}>{r.createdByLabel}</Text> : null}
                {r.body ? <Text style={styles.tableDetail}>{`本文: ${r.body.slice(0, 80)}${r.body.length > 80 ? '…' : ''}`}</Text> : null}
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>お知らせがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function NoticeEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const { confirm } = useDialog()
  const noticeTagTemplates = useMemo(() => ['お知らせ', 'メンテナンス'], [])
  const [sentAt, setSentAt] = useState('2026-01-12 03:00')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [tagsCsv, setTagsCsv] = useState('')
  const [push, setPush] = useState(false)
  const [pushTitle, setPushTitle] = useState('')
  const [pushBody, setPushBody] = useState('')

  const [mailEnabled, setMailEnabled] = useState(false)
  const [mailFormat, setMailFormat] = useState<'text' | 'html'>('text')
  const [mailText, setMailText] = useState('')
  const [mailHtml, setMailHtml] = useState('')
  const [status, setStatus] = useState<NoticeStatus>('draft')

  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const appliedTags = useMemo(() => csvToIdList(tagsCsv), [tagsCsv])
  const addTemplateTag = useCallback(
    (tag: string) => {
      const next = Array.from(new Set([...appliedTags, tag]))
      setTagsCsv(next.join(','))
    },
    [appliedTags]
  )

  useEffect(() => {
    if (!id) {
      setSentAt('')
      setSubject('')
      setBody('')
      setTagsCsv('')
      setPush(false)
      setPushTitle('')
      setPushBody('')
      setMailEnabled(false)
      setMailFormat('text')
      setMailText('')
      setMailHtml('')
      setStatus('draft')
      return
    }

    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/notices/${encodeURIComponent(id)}`)
        if (!mounted) return
        const n = json.item
        setSentAt(String(n?.sentAt ?? ''))
        setSubject(String(n?.subject ?? ''))
        setBody(String(n?.body ?? ''))
        setPush(Boolean(n?.push))
        setTagsCsv(Array.isArray(n?.tags) ? (n.tags as any[]).map((t) => String(t ?? '').trim()).filter(Boolean).join(',') : '')
        setPushTitle(String(n?.pushTitle ?? ''))
        setPushBody(String(n?.pushBody ?? ''))
        setMailEnabled(Boolean(n?.mailEnabled))
        setMailFormat(((String(n?.mailFormat ?? 'text') as any) === 'html' ? 'html' : 'text') as 'text' | 'html')
        setMailText(String(n?.mailText ?? ''))
        setMailHtml(String(n?.mailHtml ?? ''))
        setStatus((String(n?.status ?? 'draft') as NoticeStatus) || 'draft')
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
          sentAt,
          subject,
          body,
          push,
          tags: csvToIdList(tagsCsv),
          pushTitle,
          pushBody,
          mailEnabled,
          mailFormat,
          mailText,
          mailHtml,
          status,
        }
        if (id) {
          await cmsFetchJson(cfg, `/cms/notices/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/notices', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [body, cfg, id, onBack, push, sentAt, status, subject])

  const onSendEmailNow = useCallback(() => {
    if (!id) {
      setBanner('先に保存してください')
      return
    }
    void (async () => {
      const ok = await confirm('メール送信を実行しますか？（対象: メール認証済みユーザー、上限50件）', { title: 'メール送信', okText: '送信' })
      if (!ok) return

      setBusy(true)
      setBanner('')
      try {
        const json = await cmsFetchJson<any>(cfg, `/cms/notices/${encodeURIComponent(id)}/send-email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limit: 50 }),
        })
        const sent = typeof json?.sent === 'number' ? json.sent : 0
        const recipients = typeof json?.recipients === 'number' ? json.recipients : 0
        const warning = json?.warning ? `（${String(json.warning)}）` : ''
        setBanner(`メール送信: ${sent}/${recipients} ${warning}`.trim())
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, confirm, id])

  const onSendPushNow = useCallback(() => {
    if (!id) {
      setBanner('先に保存してください')
      return
    }
    void (async () => {
      const ok = await confirm('プッシュ送信を実行しますか？', { title: 'プッシュ送信', okText: '送信' })
      if (!ok) return

      setBusy(true)
      setBanner('')
      try {
        const json = await cmsFetchJson<any>(cfg, `/cms/notices/${encodeURIComponent(id)}/send-push`, {
          method: 'POST',
        })
        const warning = json?.warning ? `（${String(json.warning)}）` : ''
        setBanner(`プッシュ送信: OK ${warning}`.trim())
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, confirm, id])

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
        <SelectField
          label="ステータス"
          value={status}
          placeholder="選択"
          options={[
            { label: '下書き', value: 'draft' },
            { label: '予約', value: 'scheduled' },
            { label: '送信済み', value: 'sent' },
            { label: '取消', value: 'cancelled' },
          ]}
          onChange={(v) => setStatus(v as NoticeStatus)}
        />
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

        <View style={styles.field}>
          <Text style={styles.label}>カテゴリ（タグ）</Text>
          <View style={styles.tagTemplateRow}>
            {noticeTagTemplates.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => addTemplateTag(tag)}
                style={[styles.tagTemplateButton, appliedTags.includes(tag) ? styles.tagTemplateButtonActive : null]}
              >
                <Text style={[styles.tagTemplateText, appliedTags.includes(tag) ? styles.tagTemplateTextActive : null]}>{tag}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={tagsCsv} onChangeText={setTagsCsv} placeholder="例: お知らせ,メンテナンス" style={styles.input} />
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>プッシュ通知送信</Text>
          <Switch value={push} onValueChange={setPush} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>プッシュ通知タイトル</Text>
          <TextInput value={pushTitle} onChangeText={setPushTitle} placeholder="（未入力なら件名）" style={styles.input} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>プッシュ通知本文</Text>
          <TextInput
            value={pushBody}
            onChangeText={setPushBody}
            placeholder="（未入力なら本文）"
            style={[styles.input, { minHeight: 80 }]}
            multiline
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>メール</Text>
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>メール送信</Text>
            <Switch value={mailEnabled} onValueChange={setMailEnabled} />
          </View>

          <SelectField
            label="メール形式"
            value={mailFormat}
            placeholder="選択"
            options={[
              { label: 'テキスト', value: 'text' },
              { label: 'HTML', value: 'html' },
            ]}
            onChange={(v) => setMailFormat(v as 'text' | 'html')}
          />

          <View style={styles.field}>
            <Text style={styles.label}>メール本文（テキスト）</Text>
            <TextInput value={mailText} onChangeText={setMailText} style={[styles.input, { minHeight: 120 }]} multiline />
          </View>

          {mailFormat === 'html' ? (
            <View style={styles.field}>
              <Text style={styles.label}>メール本文（HTML）</Text>
              <TextInput value={mailHtml} onChangeText={setMailHtml} style={[styles.input, { minHeight: 120 }]} multiline />
            </View>
          ) : null}
        </View>

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>

          <Pressable disabled={busy || !id} onPress={onSendEmailNow} style={[styles.btnSecondary, busy || !id ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>メール送信</Text>
          </Pressable>

          <Pressable disabled={busy || !id} onPress={onSendPushNow} style={[styles.btnSecondary, busy || !id ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>プッシュ送信</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function CmsMaintenanceGate({
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
  const cfg = useCmsApi()
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        const json = await cmsFetchJson<{ maintenanceMode: boolean; maintenanceMessage: string }>(cfg, '/cms/settings')
        if (!mounted) return
        setMaintenanceMode(Boolean(json.maintenanceMode))
        setMaintenanceMessage(String(json.maintenanceMessage ?? ''))
      } catch {
        // ignore
      }
    }
    void tick()
    const t = setInterval(() => void tick(), 30_000)
    return () => {
      mounted = false
      clearInterval(t)
    }
  }, [cfg])

  if (maintenanceMode && route !== 'settings' && route !== 'dev') {
    return <MaintenanceModeScreen message={maintenanceMessage} onGoSettings={() => onNavigate('settings')} />
  }

  return <AppShell route={route} adminName={adminName} onLogout={onLogout} onNavigate={onNavigate} />
}

type CategoryRow = { id: string; name: string; enabled: boolean }

function CategoriesListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew: () => void }) {
  const cfg = useCmsApi()
  const [rows, setRows] = useState<CategoryRow[]>([])
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/categories')
      setRows(
        (json.items ?? []).map((c) => ({
          id: String(c.id ?? ''),
          name: String(c.name ?? ''),
          enabled: Boolean(c.enabled),
        }))
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>カテゴリ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
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
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${r.enabled ? '有効' : '無効'}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>カテゴリがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function CategoryEditScreen({
  title,
  id,
  onBack,
  onOpenVideo,
}: {
  title: string
  id: string
  onBack: () => void
  onOpenVideo?: (id: string) => void
}) {
  const cfg = useCmsApi()
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [parentId, setParentId] = useState('')
  const [parentOptions, setParentOptions] = useState<Array<{ label: string; value: string }>>([{ label: '（なし）', value: '' }])
  const [linkedVideos, setLinkedVideos] = useState<
    Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string; createdAt: string }>
  >([])
  const [videoSearchQ, setVideoSearchQ] = useState('')
  const [videoSearchBusy, setVideoSearchBusy] = useState(false)
  const [videoSearchRows, setVideoSearchRows] = useState<Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string }>>([])
  const [manualVideoId, setManualVideoId] = useState('')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const catsJson = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/categories')
        if (!mounted) return

        const options = (catsJson.items ?? [])
          .map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? '') }))
          .filter((c) => c.id)
          .filter((c) => (id ? c.id !== id : true))
          .map((c) => ({ label: c.name || c.id, value: c.id }))
        setParentOptions([{ label: '（なし）', value: '' }, ...options])

        if (!id) {
          setName('')
          setEnabled(true)
          setParentId('')
          setLinkedVideos([])
          return
        }

        const [json, videosJson] = await Promise.all([
          cmsFetchJson<{ item: any }>(cfg, `/cms/categories/${encodeURIComponent(id)}`),
          cmsFetchJson<{ items: any[] }>(cfg, `/cms/categories/${encodeURIComponent(id)}/videos`),
        ])
        if (!mounted) return
        setName(String(json.item?.name ?? ''))
        setEnabled(Boolean(json.item?.enabled))
        const nextParentId = String(json.item?.parentId ?? '')
        setParentId(nextParentId && nextParentId !== id ? nextParentId : '')
        setLinkedVideos(
          (videosJson.items ?? []).map((v) => ({
            id: String(v.id ?? ''),
            title: String(v.title ?? ''),
            workTitle: String(v.workTitle ?? ''),
            thumbnailUrl: String(v.thumbnailUrl ?? ''),
            createdAt: String(v.createdAt ?? ''),
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
  }, [cfg, id])

  const onSave = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const payload = { name: name.trim(), enabled, parentId }
        if (id) {
          await cmsFetchJson(cfg, `/cms/categories/${encodeURIComponent(id)}`,
            {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            }
          )
        } else {
          await cmsFetchJson(cfg, '/cms/categories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, enabled, id, name, onBack, parentId])

  const onSaveLinks = useCallback(() => {
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/categories/${encodeURIComponent(id)}/videos`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ videoIds: linkedVideos.map((v) => v.id) }),
        })
        const videosJson = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/categories/${encodeURIComponent(id)}/videos`)
        setLinkedVideos(
          (videosJson.items ?? []).map((v) => ({
            id: String(v.id ?? ''),
            title: String(v.title ?? ''),
            workTitle: String(v.workTitle ?? ''),
            thumbnailUrl: String(v.thumbnailUrl ?? ''),
            createdAt: String(v.createdAt ?? ''),
          }))
        )
        setBanner('紐付けを保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, id, linkedVideos])

  const moveLinkedVideo = useCallback((videoId: string, dir: -1 | 1) => {
    setLinkedVideos((prev) => {
      const i = prev.findIndex((v) => v.id === videoId)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = prev.slice()
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
      return next
    })
  }, [])

  const removeLinkedVideo = useCallback((videoId: string) => {
    setLinkedVideos((prev) => prev.filter((v) => v.id !== videoId))
  }, [])

  const addLinkedVideo = useCallback((row: { id: string; title: string; workTitle: string; thumbnailUrl: string }) => {
    const vid = String(row.id || '').trim()
    if (!vid) return
    setLinkedVideos((prev) => {
      if (prev.some((v) => v.id === vid)) return prev
      return [
        ...prev,
        {
          id: vid,
          title: String(row.title ?? ''),
          workTitle: String(row.workTitle ?? ''),
          thumbnailUrl: String(row.thumbnailUrl ?? ''),
          createdAt: '',
        },
      ]
    })
  }, [])

  const onSearchVideos = useCallback(() => {
    const q = videoSearchQ.trim()
    if (!q) {
      setVideoSearchRows([])
      return
    }
    setVideoSearchBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/videos?q=${encodeURIComponent(q)}&limit=50`)
        setVideoSearchRows(
          (json.items ?? []).map((v) => ({
            id: String(v.id ?? ''),
            title: String(v.title ?? ''),
            workTitle: String(v.workTitle ?? ''),
            thumbnailUrl: String(v.thumbnailUrl ?? ''),
          }))
        )
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setVideoSearchBusy(false)
      }
    })()
  }, [cfg, videoSearchQ])

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
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>カテゴリ名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>

        <SelectField label="親カテゴリ" value={parentId} placeholder="（なし）" options={parentOptions} onChange={setParentId} />

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>有効</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>

      {id ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{`紐付く動画（${linkedVideos.length}件）`}</Text>
          <View style={styles.filtersGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>動画ID（直接追加）</Text>
              <TextInput value={manualVideoId} onChangeText={setManualVideoId} placeholder="vid_..." style={styles.input} autoCapitalize="none" />
            </View>
            <View style={styles.filterActions}>
              <Pressable
                disabled={busy || !manualVideoId.trim()}
                onPress={() => {
                  const vid = manualVideoId.trim()
                  addLinkedVideo({ id: vid, title: '', workTitle: '', thumbnailUrl: '' })
                  setManualVideoId('')
                }}
                style={[styles.btnSecondary, busy || !manualVideoId.trim() ? styles.btnDisabled : null]}
              >
                <Text style={styles.btnSecondaryText}>追加</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={onSaveLinks} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
                <Text style={styles.btnPrimaryText}>紐付け保存</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.filtersGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>動画検索（タイトル/説明）</Text>
              <TextInput value={videoSearchQ} onChangeText={setVideoSearchQ} placeholder="キーワード" style={styles.input} />
            </View>
            <View style={styles.filterActions}>
              <Pressable disabled={videoSearchBusy} onPress={onSearchVideos} style={[styles.btnSecondary, videoSearchBusy ? styles.btnDisabled : null]}>
                <Text style={styles.btnSecondaryText}>{videoSearchBusy ? '検索中…' : '検索'}</Text>
              </Pressable>
            </View>
          </View>

          {videoSearchRows.length ? (
            <View style={styles.table}>
              {videoSearchRows.map((v) => {
                const exists = linkedVideos.some((x) => x.id === v.id)
                return (
                  <View key={`sr-${v.id}`} style={styles.tableRow}>
                    <View style={styles.tableLeft}>
                      <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                      <Text style={styles.tableDetail}>{`${v.workTitle || '—'} / ${v.id}`}</Text>
                    </View>
                    <View style={[styles.tableRight, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                      <Pressable
                        disabled={busy || exists}
                        onPress={() => addLinkedVideo(v)}
                        style={[styles.smallBtnPrimary, busy || exists ? styles.btnDisabled : null]}
                      >
                        <Text style={styles.smallBtnPrimaryText}>{exists ? '追加済' : '追加'}</Text>
                      </Pressable>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : null}

          <View style={styles.table}>
            {busy && linkedVideos.length === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>読込中…</Text>
              </View>
            ) : null}

            {linkedVideos.map((v) => (
              <View key={v.id} style={styles.tableRow}>
                <View style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                  <Text style={styles.tableDetail}>
                    {`${v.workTitle || '—'} / ${(v.createdAt || '').slice(0, 19).replace('T', ' ') || '—'} / ${v.id}`}
                  </Text>
                </View>
                <View style={[styles.tableRight, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
                  {v.thumbnailUrl ? (
                    <Image source={{ uri: v.thumbnailUrl }} style={{ width: 64, height: 36, borderRadius: 6, backgroundColor: COLORS.white }} />
                  ) : null}
                  <Pressable disabled={busy} onPress={() => moveLinkedVideo(v.id, -1)} style={[styles.smallBtn, busy ? styles.btnDisabled : null]}>
                    <Text style={styles.smallBtnText}>↑</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => moveLinkedVideo(v.id, 1)} style={[styles.smallBtn, busy ? styles.btnDisabled : null]}>
                    <Text style={styles.smallBtnText}>↓</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => removeLinkedVideo(v.id)} style={[styles.smallBtn, busy ? styles.btnDisabled : null]}>
                    <Text style={styles.smallBtnText}>削除</Text>
                  </Pressable>
                  {onOpenVideo ? (
                    <Pressable disabled={busy} onPress={() => onOpenVideo(v.id)} style={[styles.smallBtnPrimary, busy ? styles.btnDisabled : null]}>
                      <Text style={styles.smallBtnPrimaryText}>詳細</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}

            {!busy && linkedVideos.length === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>このカテゴリに紐付く動画はありません</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}

type TagRow = { id: string; name: string }

function TagsListScreen({ onOpenEdit, onNew }: { onOpenEdit: (id: string) => void; onNew: () => void }) {
  const cfg = useCmsApi()
  const [rows, setRows] = useState<TagRow[]>([])
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/tags')
      setRows((json.items ?? []).map((t) => ({ id: String(t.id ?? ''), name: String(t.name ?? '') })))
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>タグ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
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
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenEdit(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{r.id}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>タグがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function TagEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<Array<{ label: string; value: string }>>([{ label: '（なし）', value: '' }])
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const catsJson = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/categories')
        if (!mounted) return
        const options = (catsJson.items ?? [])
          .map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? '') }))
          .filter((c) => c.id)
          .map((c) => ({ label: c.name || c.id, value: c.id }))
        setCategoryOptions([{ label: '（なし）', value: '' }, ...options])

        if (!id) {
          setName('')
          setCategoryId('')
          return
        }

        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/tags/${encodeURIComponent(id)}`)
        if (!mounted) return
        setName(String(json.item?.name ?? ''))
        setCategoryId(String(json.item?.categoryId ?? ''))
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
        const payload = { name: name.trim(), categoryId }
        if (id) {
          await cmsFetchJson(cfg, `/cms/tags/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/tags', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [categoryId, cfg, id, name, onBack])

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
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>タグ名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>

        <SelectField label="表示カテゴリ" value={categoryId} placeholder="（なし）" options={categoryOptions} onChange={setCategoryId} />
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type GenreRow = { id: string; name: string; enabled: boolean }

function GenresListScreen({ onOpenEdit, onNew }: { onOpenEdit: (id: string) => void; onNew: () => void }) {
  const cfg = useCmsApi()
  const [rows, setRows] = useState<GenreRow[]>([])
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/genres')
      setRows(
        (json.items ?? []).map((g) => ({
          id: String(g.id ?? ''),
          name: String(g.name ?? ''),
          enabled: g.enabled === undefined ? true : Boolean(g.enabled),
        }))
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>ジャンル一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
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
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenEdit(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{`${r.id}${r.enabled ? '' : ' / 無効'}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>ジャンルがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function GenreEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    if (!id) {
      setName('')
      setEnabled(true)
      return
    }
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/genres/${encodeURIComponent(id)}`)
        if (!mounted) return
        setName(String(json.item?.name ?? ''))
        setEnabled(json.item?.enabled === undefined ? true : Boolean(json.item?.enabled))
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
        const payload = { name: name.trim(), enabled }
        if (id) {
          await cmsFetchJson(cfg, `/cms/genres/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/genres', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, enabled, id, name, onBack])

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
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>ジャンル名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>有効</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
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

type CastCategoryRow = { id: string; name: string; enabled: boolean }

function CastCategoriesListScreen({ onOpenEdit, onNew }: { onOpenEdit: (id: string) => void; onNew: () => void }) {
  const cfg = useCmsApi()
  const [rows, setRows] = useState<CastCategoryRow[]>([])
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/cast-categories')
      setRows(
        (json.items ?? []).map((g) => ({
          id: String(g.id ?? ''),
          name: String(g.name ?? ''),
          enabled: g.enabled === undefined ? true : Boolean(g.enabled),
        }))
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>キャストカテゴリ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
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
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenEdit(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{`${r.id}${r.enabled ? '' : ' / 無効'}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>キャストカテゴリがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function CastCategoryEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    if (!id) {
      setName('')
      setEnabled(true)
      return
    }
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/cast-categories/${encodeURIComponent(id)}`)
        if (!mounted) return
        setName(String(json.item?.name ?? ''))
        setEnabled(json.item?.enabled === undefined ? true : Boolean(json.item?.enabled))
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
        const payload = { name: name.trim(), enabled }
        if (id) {
          await cmsFetchJson(cfg, `/cms/cast-categories/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/cast-categories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, enabled, id, name, onBack])

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
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

function RankingsScreen({ type, title }: { type: 'videos' | 'coins' | 'actors' | 'directors' | 'writers'; title: string }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [asOf, setAsOf] = useState('')
  const [items, setItems] = useState<Array<{ rank: number; label: string; value: number }>>([])

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[]; asOf: string }>(cfg, `/cms/rankings/${encodeURIComponent(type)}`)
      setAsOf(String((json as any).asOf ?? ''))
      setItems(
        (json.items ?? []).map((r) => ({
          rank: Number((r as any).rank ?? 0),
          label: String((r as any).label ?? ''),
          value: Number((r as any).value ?? 0),
        }))
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg, type])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>{title}</Text>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>集計日時</Text>
        <Text style={styles.tableDetail}>{asOf || '—'}</Text>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={load} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>{busy ? '更新中…' : '更新'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ランキング</Text>
        <View style={styles.table}>
          {busy && items.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {items.map((r) => (
            <View key={`${r.rank}-${r.label}`} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{`${r.rank}位 ${r.label}`}</Text>
                <Text style={styles.tableDetail}>{`値: ${r.value}`}</Text>
              </View>
            </View>
          ))}
          {!busy && items.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>データがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

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

function PasswordResetScreen({ apiBase, mock, onGoLogin }: { apiBase: string; mock: boolean; onGoLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')

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
      setBanner('再設定用のメールを送信しました（届かない場合は設定やメールアドレスを確認してください）')
      if (json?.debugLink) setBanner(`再設定用のメールを送信しました（DEBUG: ${String(json.debugLink)}）`)
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

        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}

        {!token ? (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>メールアドレス</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="admin@example.com" autoCapitalize="none" style={styles.input} />
            </View>
            <View style={styles.actions}>
              <Pressable disabled={busy || !email.trim()} onPress={() => void requestReset()} style={[styles.btnPrimary, busy || !email.trim() ? styles.btnDisabled : null]}>
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

type FeaturedVideoItem = {
  id: string
  workId: string
  workTitle: string
  title: string
  thumbnailUrl: string
  castNames: string
  categoryNames: string
  tagNames: string
}

function FeaturedVideosScreen({ slot, title }: { slot: string; title: string }) {
  const cfg = useCmsApi()

  const [q, setQ] = useState('')
  const [qCast, setQCast] = useState('')
  const [qCategory, setQCategory] = useState('')
  const [qTag, setQTag] = useState('')

  const [searchRows, setSearchRows] = useState<FeaturedVideoItem[]>([])
  const [selectedRows, setSelectedRows] = useState<FeaturedVideoItem[]>([])
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadSelected = useCallback(async () => {
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: FeaturedVideoItem[] }>(
        cfg,
        `/cms/featured/videos?slot=${encodeURIComponent(slot)}`
      )
      setSelectedRows(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    }
  }, [cfg, slot])

  useEffect(() => {
    void loadSelected()
  }, [loadSelected])

  const runSearch = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (qCast.trim()) params.set('cast', qCast.trim())
      if (qCategory.trim()) params.set('category', qCategory.trim())
      if (qTag.trim()) params.set('tag', qTag.trim())
      params.set('limit', '80')

      const json = await cmsFetchJson<{ items: FeaturedVideoItem[] }>(cfg, `/cms/videos/search?${params.toString()}`)
      setSearchRows(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg, q, qCast, qCategory, qTag])

  const reset = useCallback(() => {
    setQ('')
    setQCast('')
    setQCategory('')
    setQTag('')
    setSearchRows([])
    setBanner('')
  }, [])

  const addSelected = useCallback((it: FeaturedVideoItem) => {
    setSelectedRows((prev) => {
      if (prev.some((p) => p.id === it.id)) return prev
      return [...prev, it]
    })
  }, [])

  const removeSelected = useCallback((id: string) => {
    setSelectedRows((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const moveSelected = useCallback((from: number, to: number) => {
    setSelectedRows((prev) => {
      if (from < 0 || from >= prev.length) return prev
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [picked] = next.splice(from, 1)
      next.splice(to, 0, picked)
      return next
    })
  }, [])

  const onSave = useCallback(async () => {
    setSaving(true)
    setBanner('')
    try {
      await cmsFetchJson<{ ok: boolean }>(cfg, `/cms/featured/videos?slot=${encodeURIComponent(slot)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds: selectedRows.map((r) => r.id) }),
      })
      setBanner('保存しました')
      await loadSelected()
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [cfg, loadSelected, selectedRows])

  const selectedIds = useMemo(() => new Set(selectedRows.map((r) => r.id)), [selectedRows])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>{title}</Text>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>検索</Text>
        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>タイトル</Text>
            <TextInput value={q} onChangeText={setQ} placeholder="部分一致" style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>出演者</Text>
            <TextInput value={qCast} onChangeText={setQCast} placeholder="部分一致" style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>カテゴリ</Text>
            <TextInput value={qCategory} onChangeText={setQCategory} placeholder="部分一致" style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>タグ</Text>
            <TextInput value={qTag} onChangeText={setQTag} placeholder="部分一致" style={styles.input} />
          </View>
        </View>

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={runSearch} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '検索中…' : '検索'}</Text>
          </Pressable>
          <Pressable onPress={reset} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>リセット</Text>
          </Pressable>
        </View>

        <View style={styles.table}>
          {searchRows.length === 0 ? (
            <View style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableDetail}>検索結果がありません</Text>
              </View>
            </View>
          ) : (
            searchRows.map((r) => (
              <View key={r.id} style={styles.tableRow}>
                <View style={[styles.tableLeft, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  {r.thumbnailUrl ? <Image source={{ uri: r.thumbnailUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.tableLabel}>{r.title || '—'}</Text>
                    <Text style={styles.tableDetail}>{`${r.id} / ${r.workTitle || '—'}`}</Text>
                    <Text style={styles.tableDetail}>{`出演者: ${r.castNames || '—'}`}</Text>
                    <Text style={styles.tableDetail}>{`カテゴリ: ${r.categoryNames || '—'} / タグ: ${r.tagNames || '—'}`}</Text>
                  </View>
                </View>
                <View style={styles.tableRight}>
                  <Pressable
                    disabled={selectedIds.has(r.id)}
                    onPress={() => addSelected(r)}
                    style={[styles.smallBtnPrimary, selectedIds.has(r.id) ? styles.btnDisabled : null]}
                  >
                    <Text style={styles.smallBtnPrimaryText}>{selectedIds.has(r.id) ? '追加済み' : '追加'}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.pageHeaderRow}>
          <Text style={styles.sectionTitle}>{`選定済み（${selectedRows.length}件）`}</Text>
          <Pressable disabled={saving} onPress={onSave} style={[styles.btnPrimary, saving ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{saving ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>

        <View style={styles.table}>
          {selectedRows.length === 0 ? (
            <View style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableDetail}>未選定です</Text>
              </View>
            </View>
          ) : (
            selectedRows.map((r, idx) => (
              <View key={r.id} style={styles.tableRow}>
                <View style={[styles.tableLeft, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  {r.thumbnailUrl ? <Image source={{ uri: r.thumbnailUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.tableLabel}>{`${idx + 1}. ${r.title || '—'}`}</Text>
                    <Text style={styles.tableDetail}>{`${r.id} / ${r.workTitle || '—'}`}</Text>
                    <Text style={styles.tableDetail}>{`出演者: ${r.castNames || '—'}`}</Text>
                    <Text style={styles.tableDetail}>{`カテゴリ: ${r.categoryNames || '—'} / タグ: ${r.tagNames || '—'}`}</Text>
                  </View>
                </View>
                <View style={[styles.tableRight, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                  <Pressable disabled={idx === 0} onPress={() => moveSelected(idx, idx - 1)} style={[styles.smallBtn, idx === 0 ? styles.btnDisabled : null]}>
                    <Text style={styles.smallBtnText}>上へ</Text>
                  </Pressable>
                  <Pressable
                    disabled={idx === selectedRows.length - 1}
                    onPress={() => moveSelected(idx, idx + 1)}
                    style={[styles.smallBtn, idx === selectedRows.length - 1 ? styles.btnDisabled : null]}
                  >
                    <Text style={styles.smallBtnText}>下へ</Text>
                  </Pressable>
                  <Pressable onPress={() => removeSelected(r.id)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>削除</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  )
}

function RecommendVideosScreen() {
  return <FeaturedVideosScreen slot="recommend" title="おすすめ動画" />
}

function PickupVideosScreen() {
  return <FeaturedVideosScreen slot="pickup" title="ピックアップ動画" />
}

type CastStaffRow = {
  id: string
  name: string
  role: string
  thumbnailUrl: string
  createdAt: string
  updatedAt: string
}

function CastStaffListScreen({
  onOpenDetail,
  onNew,
}: {
  onOpenDetail: (id: string) => void
  onNew: () => void
}) {
  const cfg = useCmsApi()
  const [qName, setQName] = useState('')
  const [rows, setRows] = useState<CastStaffRow[]>([])
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: CastStaffRow[] }>(cfg, '/cms/casts')
        if (!mounted) return
        setRows(json.items || [])
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

  const filtered = useMemo(() => {
    const name = qName.trim()
    if (!name) return rows
    return rows.filter((r) => r.name.includes(name) || r.id.includes(name))
  }, [qName, rows])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>キャスト・スタッフ管理</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>検索</Text>
        <View style={styles.field}>
          <Text style={styles.label}>氏名 / ID</Text>
          <TextInput value={qName} onChangeText={setQName} placeholder="例: cast_ / 山田" style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.filterActions}>
          <Pressable onPress={() => setQName((v) => v.trim())} style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>検索</Text>
          </Pressable>
          <Pressable onPress={() => setQName('')} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>リセット</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{`一覧${busy ? '（読み込み中）' : ''}`}</Text>
        <View style={styles.table}>
          {filtered.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {r.thumbnailUrl ? <Image source={{ uri: r.thumbnailUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tableLabel}>{r.name || '—'}</Text>
                    <Text style={styles.tableDetail}>{`${r.id} / ${r.role || '—'}`}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
          {!busy && filtered.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>該当データがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

type CastStaffDetailResponse = {
  item: CastStaffRow
  stats: { favoritesCount: number; worksCount: number; videosCount: number }
  works: Array<{ id: string; title: string; roleName: string }>
  videos: Array<{ id: string; title: string; workId: string; workTitle: string; roleName: string }>
}

function CastStaffDetailScreen({
  title,
  id,
  onBack,
  onSaved,
  onOpenWork,
  onOpenVideo,
}: {
  title: string
  id: string
  onBack: () => void
  onSaved: (id: string) => void
  onOpenWork: (id: string) => void
  onOpenVideo: (id: string) => void
}) {
  const cfg = useCmsApi()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [stats, setStats] = useState<{ favoritesCount: number; worksCount: number; videosCount: number } | null>(null)
  const [works, setWorks] = useState<Array<{ id: string; title: string; roleName: string }>>([])
  const [videos, setVideos] = useState<Array<{ id: string; title: string; workId: string; workTitle: string; roleName: string }>>([])
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) {
      setStats(null)
      setWorks([])
      setVideos([])
      return
    }

    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<CastStaffDetailResponse>(cfg, `/cms/casts/${encodeURIComponent(id)}`)
        if (!mounted) return
        setName(json.item?.name || '')
        setRole(json.item?.role || '')
        setThumbnailUrl(json.item?.thumbnailUrl || '')
        setStats(json.stats || null)
        setWorks(json.works || [])
        setVideos(json.videos || [])
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
        if (!name.trim()) throw new Error('name is required')

        if (id) {
          await cmsFetchJson(cfg, `/cms/casts/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, role, thumbnailUrl }),
          })
          setBanner('保存しました')
          return
        }

        const created = await cmsFetchJson<{ ok: true; id: string }>(cfg, '/cms/casts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, role, thumbnailUrl }),
        })
        const nextId = String(created.id || '')
        if (!nextId) throw new Error('作成に失敗しました')
        setBanner('作成しました')
        onSaved(nextId)
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, id, name, onSaved, role, thumbnailUrl])

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
        <Text style={styles.sectionTitle}>プロフィール</Text>
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
          <Text style={styles.label}>役割（例: 俳優/監督/脚本）</Text>
          <TextInput value={role} onChangeText={setRole} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネURL</Text>
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>プレビュー</Text>
          {thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
        </View>

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>

      {id ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>集計</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>お気に入り数</Text>
                <Text style={styles.tableDetail}>{String(stats?.favoritesCount ?? 0)}</Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>出演作品数（作品）</Text>
                <Text style={styles.tableDetail}>{String(stats?.worksCount ?? 0)}</Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>出演作品数（動画）</Text>
                <Text style={styles.tableDetail}>{String(stats?.videosCount ?? 0)}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {id ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>関連作品（作品）</Text>
          <View style={styles.table}>
            {works.map((w) => (
              <Pressable key={w.id} onPress={() => onOpenWork(w.id)} style={styles.tableRow}>
                <View style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>{w.title || w.id}</Text>
                  <Text style={styles.tableDetail}>{`${w.id}${w.roleName ? ` / ${w.roleName}` : ''}`}</Text>
                </View>
              </Pressable>
            ))}
            {works.length === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>紐づく作品がありません</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {id ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>関連作品（動画）</Text>
          <View style={styles.table}>
            {videos.map((v) => (
              <Pressable key={v.id} onPress={() => onOpenVideo(v.id)} style={styles.tableRow}>
                <View style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                  <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : v.workId ? ` / ${v.workId}` : ''}${v.roleName ? ` / ${v.roleName}` : ''}`}</Text>
                </View>
              </Pressable>
            ))}
            {videos.length === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>紐づく動画がありません</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}

type CoinSettingRow = { id: string; price: string; place: string; target: string; period: string }

function CoinSettingsListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew: () => void }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<CoinSettingRow[]>([])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/coin-settings')
        if (!mounted) return
        setRows(
          (json.items ?? []).map((r) => ({
            id: String(r.id ?? ''),
            price: `¥${Number(r.priceYen ?? 0).toLocaleString('ja-JP')}`,
            place: String(r.place ?? ''),
            target: String(r.target ?? ''),
            period: String(r.period ?? ''),
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
        <Text style={styles.pageTitle}>コイン設定一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
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
                <Text style={styles.tableLabel}>{`${r.price} / ${r.target}`}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${r.place} / ${r.period}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>コイン設定がありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

function CoinSettingEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const [priceYenText, setPriceYenText] = useState('')
  const [place, setPlace] = useState('')
  const [target, setTarget] = useState('')
  const [period, setPeriod] = useState('')

  useEffect(() => {
    if (!id) {
      setPriceYenText('')
      setPlace('')
      setTarget('')
      setPeriod('')
      return
    }

    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/coin-settings/${encodeURIComponent(id)}`)
        if (!mounted) return
        const it = json.item
        setPriceYenText(String(it?.priceYen ?? ''))
        setPlace(String(it?.place ?? ''))
        setTarget(String(it?.target ?? ''))
        setPeriod(String(it?.period ?? ''))
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
    const priceYen = Math.floor(Number(priceYenText || 0))
    if (!Number.isFinite(priceYen) || priceYen <= 0) {
      setBanner('価格（円）を入力してください')
      return
    }
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const payload = { priceYen, place, target, period }
        if (id) {
          await cmsFetchJson(cfg, `/cms/coin-settings/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/coin-settings', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, id, onBack, period, place, priceYenText, target])

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
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>価格（円）</Text>
          <TextInput value={priceYenText} onChangeText={setPriceYenText} style={styles.input} keyboardType={Platform.OS === 'web' ? undefined : 'number-pad'} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>表示場所</Text>
          <TextInput value={place} onChangeText={setPlace} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>対象</Text>
          <TextInput value={target} onChangeText={setTarget} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>期間</Text>
          <TextInput value={period} onChangeText={setPeriod} style={styles.input} />
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

type AdminRow = { id: string; name: string; email: string; role: string; disabled: boolean }

function AdminsListScreen({ onOpenDetail, onNew }: { onOpenDetail: (id: string) => void; onNew: () => void }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
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

function AdminEditScreen({ title, id, onBack }: { title: string; id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Admin')
  const [disabled, setDisabled] = useState(false)
  const [password, setPassword] = useState('')

  const [banner, setBanner] = useState('')
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

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

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
        <SelectField
          label="権限"
          value={role}
          placeholder="選択"
          options={[{ label: 'Admin', value: 'Admin' }]}
          onChange={setRole}
        />
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
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Array<{ id: string; subject: string; status: string; createdAt?: string }>>([])

  const statusLabel = useCallback((s: string) => {
    switch (String(s || '').toLowerCase()) {
      case 'open':
        return '未対応'
      case 'in_progress':
        return '対応中'
      case 'closed':
        return '完了'
      default:
        return s || '—'
    }
  }, [])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/inquiries')
        if (!mounted) return
        setRows(
          (json.items ?? []).map((r) => ({
            id: String(r.id ?? ''),
            subject: String(r.subject ?? ''),
            status: String(r.status ?? ''),
            createdAt: r.createdAt ? String(r.createdAt) : '',
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
      <Text style={styles.pageTitle}>お問い合わせ一覧</Text>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.table}>
        {busy ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>読み込み中…</Text>
          </View>
        ) : null}

        {rows.map((r) => (
          <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
            <View style={styles.tableLeft}>
              <Text style={styles.tableLabel}>{r.subject || '（件名なし）'}</Text>
              <Text style={styles.tableDetail}>{`${r.id} / ${statusLabel(r.status)}`}</Text>
            </View>
          </Pressable>
        ))}

        {!busy && rows.length === 0 ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>お問い合わせがありません</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}

function InquiryDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('open')
  const [createdAt, setCreatedAt] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/inquiries/${encodeURIComponent(id)}`)
        if (!mounted) return
        const item = json.item
        setSubject(String(item?.subject ?? ''))
        setBody(String(item?.body ?? ''))
        setStatus(String(item?.status ?? 'open'))
        setCreatedAt(String(item?.createdAt ?? ''))
        setUpdatedAt(String(item?.updatedAt ?? ''))
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
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/inquiries/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, id, status])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>お問い合わせ詳細</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>内容</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>

        {busy ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>読み込み中…</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>件名</Text>
          <Text style={styles.readonlyText}>{subject || '—'}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>本文</Text>
          <Text style={styles.readonlyText}>{body || '—'}</Text>
        </View>

        <SelectField
          label="対応ステータス"
          value={status}
          placeholder="選択"
          options={[
            { label: '未対応', value: 'open' },
            { label: '対応中', value: 'in_progress' },
            { label: '完了', value: 'closed' },
          ]}
          onChange={setStatus}
        />

        <View style={styles.field}>
          <Text style={styles.label}>作成日時</Text>
          <Text style={styles.readonlyText}>{createdAt || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>更新日時</Text>
          <Text style={styles.readonlyText}>{updatedAt || '—'}</Text>
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

function SettingsScreen() {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ maintenanceMode: boolean; maintenanceMessage: string }>(cfg, '/cms/settings')
        if (!mounted) return
        setMaintenanceMode(Boolean(json.maintenanceMode))
        setMaintenanceMessage(String(json.maintenanceMessage ?? ''))
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

  const onSave = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, '/cms/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ maintenanceMode, maintenanceMessage }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, maintenanceMessage, maintenanceMode])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>設定</Text>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>メンテナンス</Text>

        {busy ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>読み込み中…</Text>
          </View>
        ) : null}

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>メンテナンスモード</Text>
          <Switch value={maintenanceMode} onValueChange={setMaintenanceMode} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>メッセージ</Text>
          <TextInput
            value={maintenanceMessage}
            onChangeText={setMaintenanceMessage}
            style={[styles.input, { height: 88, textAlignVertical: 'top' }]}
            multiline
          />
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

function DevPage({
  devMode,
  apiBase,
  uploaderBase,
  adminEmail,
  onSetDevMode,
  onSetApiBase,
  onSetUploaderBase,
  onSetAdminEmail,
  onNavigate,
  onOpenDevModal,
}: {
  devMode: boolean
  apiBase: string
  uploaderBase: string
  adminEmail: string
  onSetDevMode: (v: boolean) => void
  onSetApiBase: (v: string) => void
  onSetUploaderBase: (v: string) => void
  onSetAdminEmail: (v: string) => void
  onNavigate: (id: RouteId) => void
  onOpenDevModal: () => void
}) {
  const [apiInput, setApiInput] = useState(apiBase)
  const [uploaderInput, setUploaderInput] = useState(uploaderBase)
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

        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>管理者メール</Text>
            <TextInput value={emailInput} onChangeText={setEmailInput} placeholder="admin@example.com" style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>API Base Override</Text>
            <TextInput value={apiInput} onChangeText={setApiInput} placeholder="https://..." style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Uploader Base Override</Text>
            <TextInput value={uploaderInput} onChangeText={setUploaderInput} placeholder="https://..." style={styles.input} />
          </View>
        </View>

        <View style={styles.filterActions}>
          <Pressable
            onPress={() => {
              onSetAdminEmail(emailInput.trim())
              onSetApiBase(apiInput.trim())
              onSetUploaderBase(uploaderInput.trim())
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
  apiBase,
  uploaderBase,
  adminEmail,
  mock,
  onClose,
  onSetAdminEmail,
  onSetApiBase,
  onSetUploaderBase,
  onSetMock,
  onNavigate,
}: {
  visible: boolean
  apiBase: string
  uploaderBase: string
  adminEmail: string
  mock: boolean
  onClose: () => void
  onSetAdminEmail: (v: string) => void
  onSetApiBase: (v: string) => void
  onSetUploaderBase: (v: string) => void
  onSetMock: (v: boolean) => void
  onNavigate: (id: RouteId) => void
}) {
  const [apiInput, setApiInput] = useState(apiBase)
  const [uploaderInput, setUploaderInput] = useState(uploaderBase)
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
    setUploaderInput(uploaderBase)
  }, [uploaderBase])

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
            <Text style={styles.devLabel}>MOCK</Text>
            <Switch value={mock} onValueChange={onSetMock} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>管理者メール</Text>
            <TextInput value={emailInput} onChangeText={setEmailInput} style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>API Base Override</Text>
            <TextInput value={apiInput} onChangeText={setApiInput} style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Uploader Base Override</Text>
            <TextInput value={uploaderInput} onChangeText={setUploaderInput} style={styles.input} />
          </View>

          <View style={styles.filterActions}>
            <Pressable
              onPress={() => {
                onSetAdminEmail(emailInput.trim())
                onSetApiBase(apiInput.trim())
                onSetUploaderBase(uploaderInput.trim())
              }}
              style={styles.btnPrimary}
            >
              <Text style={styles.btnPrimaryText}>保存</Text>
            </Pressable>
            <Pressable onPress={() => onNavigate('dev')} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>/dev</Text>
            </Pressable>
          </View>

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
  const [selectedUnapprovedActorAccountId, setSelectedUnapprovedActorAccountId] = useState('')
  const [selectedCommentId, setSelectedCommentId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userBackRoute, setUserBackRoute] = useState<RouteId>('users')
  const [selectedNoticeId, setSelectedNoticeId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [categoryBackRoute, setCategoryBackRoute] = useState<RouteId>('categories')
  const [selectedTagId, setSelectedTagId] = useState('')
  const [tagBackRoute, setTagBackRoute] = useState<RouteId>('tags')
  const [selectedGenreId, setSelectedGenreId] = useState('')
  const [genreBackRoute, setGenreBackRoute] = useState<RouteId>('genres')
  const [selectedCastCategoryId, setSelectedCastCategoryId] = useState('')
  const [castCategoryBackRoute, setCastCategoryBackRoute] = useState<RouteId>('cast-categories')

  const [commentsFilterContentId, setCommentsFilterContentId] = useState('')
  const [commentsFilterEpisodeId, setCommentsFilterEpisodeId] = useState('')
  const [selectedCoinSettingId, setSelectedCoinSettingId] = useState('')
  const [selectedAdminId, setSelectedAdminId] = useState('')
  const [selectedInquiryId, setSelectedInquiryId] = useState('')
  const [selectedCastStaffId, setSelectedCastStaffId] = useState('')

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
      { kind: 'item', id: 'user-new', label: 'ユーザー新規作成' },
      { kind: 'item', id: 'unapproved-actor-accounts', label: '未承認俳優アカウント一覧' },

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
      { kind: 'item', id: 'genres', label: 'ジャンル一覧' },
      { kind: 'item', id: 'cast-categories', label: 'キャストカテゴリ一覧' },
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
      case 'not-found':
        return <NotFoundScreen onGoDashboard={() => onNavigate('dashboard')} />
      case 'dev':
        return <PlaceholderScreen title="/dev" />
      case 'dashboard':
        return (
          <DashboardScreen
            onNavigate={onNavigate}
            onOpenScheduledDetail={(id) => {
              setSelectedScheduledVideoId(id)
              onNavigate('videos-scheduled-detail')
            }}
          />
        )
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
        return (
          <VideoDetailScreen
            id={selectedVideoId}
            onBack={() => onNavigate('videos')}
            onGoComments={(contentId, episodeId) => {
              setCommentsFilterContentId(contentId)
              setCommentsFilterEpisodeId(episodeId)
              onNavigate('comments')
            }}
            onOpenVideo={(id) => {
              setSelectedVideoId(id)
              onNavigate('video-detail')
            }}
          />
        )
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

      case 'unapproved-actor-accounts':
        return (
          <UnapprovedActorAccountsListScreen
            onOpenDetail={(id) => {
              setSelectedUnapprovedActorAccountId(id)
              onNavigate('unapproved-actor-account-detail')
            }}
          />
        )
      case 'unapproved-actor-account-detail':
        return (
          <UnapprovedActorAccountDetailScreen
            id={selectedUnapprovedActorAccountId}
            onBack={() => onNavigate('unapproved-actor-accounts')}
          />
        )
      case 'recommend':
        return <RecommendVideosScreen />
      case 'pickup':
        return <PickupVideosScreen />

      case 'castStaff':
        return (
          <CastStaffListScreen
            onNew={() => {
              setSelectedCastStaffId('')
              onNavigate('castStaff-new')
            }}
            onOpenDetail={(id) => {
              setSelectedCastStaffId(id)
              onNavigate('castStaff-detail')
            }}
          />
        )

      case 'castStaff-detail':
        return (
          <CastStaffDetailScreen
            title="キャスト・スタッフ詳細"
            id={selectedCastStaffId}
            onBack={() => onNavigate('castStaff')}
            onSaved={(id) => {
              setSelectedCastStaffId(id)
            }}
            onOpenWork={(id) => {
              setSelectedWorkId(id)
              onNavigate('work-detail')
            }}
            onOpenVideo={(id) => {
              setSelectedVideoId(id)
              onNavigate('video-detail')
            }}
          />
        )

      case 'castStaff-new':
        return (
          <CastStaffDetailScreen
            title="キャスト・スタッフ新規作成"
            id=""
            onBack={() => onNavigate('castStaff')}
            onSaved={(id) => {
              setSelectedCastStaffId(id)
              onNavigate('castStaff-detail')
            }}
            onOpenWork={(id) => {
              setSelectedWorkId(id)
              onNavigate('work-detail')
            }}
            onOpenVideo={(id) => {
              setSelectedVideoId(id)
              onNavigate('video-detail')
            }}
          />
        )

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
            initialContentId={commentsFilterContentId}
            initialEpisodeId={commentsFilterEpisodeId}
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
            onNew={() => {
              onNavigate('user-new')
            }}
            onOpenDetail={(id) => {
              setSelectedUserId(id)
              setUserBackRoute('users')
              onNavigate('user-detail')
            }}
          />
        )
      case 'user-detail':
        return <UserDetailScreen id={selectedUserId} onBack={() => onNavigate(userBackRoute)} />
      case 'user-new':
        return (
          <UserCreateScreen
            onBack={() => onNavigate('users')}
            onCreated={(id) => {
              setSelectedUserId(id)
              setUserBackRoute('users')
              onNavigate('user-detail')
            }}
          />
        )

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
        return <RankingsScreen type="videos" title="動画ランキング" />
      case 'ranking-coins':
        return <RankingsScreen type="coins" title="獲得コインランキング" />
      case 'ranking-actors':
        return <RankingsScreen type="actors" title="主演ランキング" />
      case 'ranking-directors':
        return <RankingsScreen type="directors" title="監督ランキング" />
      case 'ranking-writers':
        return <RankingsScreen type="writers" title="脚本ランキング" />

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
          <CategoryEditScreen
            title="カテゴリ詳細・編集"
            id={selectedCategoryId}
            onBack={() => onNavigate(categoryBackRoute)}
            onOpenVideo={(id) => {
              setSelectedVideoId(id)
              onNavigate('video-detail')
            }}
          />
        )
      case 'category-new':
        return (
          <CategoryEditScreen
            title="カテゴリ新規作成"
            id=""
            onBack={() => onNavigate(categoryBackRoute)}
            onOpenVideo={(id) => {
              setSelectedVideoId(id)
              onNavigate('video-detail')
            }}
          />
        )

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

      case 'genres':
        return (
          <GenresListScreen
            onNew={() => {
              setSelectedGenreId('')
              setGenreBackRoute('genres')
              onNavigate('genre-new')
            }}
            onOpenEdit={(id) => {
              setSelectedGenreId(id)
              setGenreBackRoute('genres')
              onNavigate('genre-detail')
            }}
          />
        )
      case 'genre-detail':
        return <GenreEditScreen title="ジャンル編集" id={selectedGenreId} onBack={() => onNavigate(genreBackRoute)} />
      case 'genre-new':
        return <GenreEditScreen title="ジャンル新規作成" id="" onBack={() => onNavigate(genreBackRoute)} />

      case 'cast-categories':
        return (
          <CastCategoriesListScreen
            onNew={() => {
              setSelectedCastCategoryId('')
              setCastCategoryBackRoute('cast-categories')
              onNavigate('cast-category-new')
            }}
            onOpenEdit={(id) => {
              setSelectedCastCategoryId(id)
              setCastCategoryBackRoute('cast-categories')
              onNavigate('cast-category-detail')
            }}
          />
        )
      case 'cast-category-detail':
        return <CastCategoryEditScreen title="キャストカテゴリ編集" id={selectedCastCategoryId} onBack={() => onNavigate(castCategoryBackRoute)} />
      case 'cast-category-new':
        return <CastCategoryEditScreen title="キャストカテゴリ新規作成" id="" onBack={() => onNavigate(castCategoryBackRoute)} />

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
        return <SettingsScreen />
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
    userBackRoute,
    selectedVideoId,
    selectedUnapprovedVideoId,
    selectedUnapprovedActorAccountId,
    selectedWorkId,
    categoryBackRoute,
    tagBackRoute,
    selectedGenreId,
    genreBackRoute,
    selectedCastCategoryId,
    castCategoryBackRoute,
    commentsFilterContentId,
    commentsFilterEpisodeId,
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
  mock,
  onLoggedIn,
  initialBanner,
  onForgotPassword,
  onOpenDevModal,
}: {
  apiBase: string
  mock: boolean
  onLoggedIn: (token: string, remember: boolean) => void
  initialBanner: string
  onForgotPassword: () => void
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
            <Pressable
              onPress={() => setRemember((v) => !v)}
              style={[styles.check, remember ? styles.checkOn : null]}
            >
              <View style={[styles.checkBox, remember ? styles.checkBoxOn : null]} />
              <Text style={styles.checkText}>ログイン状態を保持</Text>
            </Pressable>

            <Pressable
              onPress={onForgotPassword}
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

          </View>
        </View>
      </View>
    </View>
  )
}

export default function App() {
  const apiBase = useMemo(() => getApiBaseFromLocation(), [])
  const uploaderBase = useMemo(() => getUploaderBaseFromLocation(), [])

  const [token, setToken] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [screen, setScreen] = useState<Screen>('login')
  const [route, setRoute] = useState<RouteId>('login')
  const [loginBanner, setLoginBanner] = useState('')

  const [devMode, setDevMode] = useState(true)
  const [devModalOpen, setDevModalOpen] = useState(false)
  const [debugOverlayHidden, setDebugOverlayHidden] = useState(false)
  const [mockMode, setMockMode] = useState(false)

  useEffect(() => {
    const saved = safeLocalStorageGet(STORAGE_KEY)
    const savedEmail = safeLocalStorageGet(STORAGE_EMAIL_KEY)
    const savedDevMode = safeLocalStorageGet(STORAGE_DEV_MODE_KEY)
    const savedMock = safeLocalStorageGet(STORAGE_MOCK_KEY)
    const initialRoute = getRouteFromLocation()

    if (savedDevMode === '1') setDevMode(true)
    if (savedDevMode === '0') setDevMode(false)

    if (savedMock === '1') setMockMode(true)
    if (savedMock === '0') setMockMode(false)

    if (saved) {
      setToken(saved)
      setAdminEmail(savedEmail)
      setScreen('app')
      const initial = initialRoute === 'login' ? 'dashboard' : initialRoute
      setRoute(initial)
      setPathRoute(initial)
      if (initialRoute === 'login') setHashRoute('dashboard')
    } else {
      const allowUnauthed = initialRoute === 'login' || initialRoute === 'dev' || initialRoute === 'password-reset'
      const initial = allowUnauthed ? initialRoute : 'login'
      setRoute(initial)
      setScreen(initial === 'login' ? 'login' : 'app')
      setPathRoute(initial)
      setHashRoute(initial)
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const syncRoute = () => {
      const next = getRouteFromLocation()

      const allowUnauthed = next === 'login' || next === 'dev' || next === 'password-reset'

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
      setScreen(next === 'login' || next === 'password-reset' ? 'login' : 'app')
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

  const onSessionExpired = useCallback(() => {
    unauthorizedEventEmitted = false
    onLogout()
    setLoginBanner('セッションが切れました')
  }, [onLogout])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const handler = () => onSessionExpired()
    window.addEventListener(UNAUTHORIZED_EVENT, handler as any)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler as any)
  }, [onSessionExpired])

  const onNavigate = useCallback((next: RouteId) => {
    const allowUnauthed = next === 'login' || next === 'dev' || next === 'password-reset'
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
    setScreen(next === 'login' || next === 'password-reset' ? 'login' : 'app')
  }, [token])

  const showDevButton = useMemo(() => devMode || route === 'dev', [devMode, route])

  const onSetDevMode = useCallback((v: boolean) => {
    setDevMode(v)
    safeLocalStorageSet(STORAGE_DEV_MODE_KEY, v ? '1' : '0')
    if (v) setDevModalOpen(true)
  }, [])

  const onSetMockMode = useCallback((v: boolean) => {
    setMockMode(v)
    safeLocalStorageSet(STORAGE_MOCK_KEY, v ? '1' : '0')
  }, [])

  const onSetApiBase = useCallback((v: string) => {
    const next = v.trim().replace(/\/$/, '')
    if (!next) safeLocalStorageRemove(STORAGE_API_OVERRIDE_KEY)
    else safeLocalStorageSet(STORAGE_API_OVERRIDE_KEY, next)
  }, [])

  const onSetUploaderBase = useCallback((v: string) => {
    const next = v.trim().replace(/\/$/, '')
    if (!next) safeLocalStorageRemove(STORAGE_UPLOADER_OVERRIDE_KEY)
    else safeLocalStorageSet(STORAGE_UPLOADER_OVERRIDE_KEY, next)
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
        route === 'password-reset' ? (
          <PasswordResetScreen apiBase={apiBase} mock={mockMode} onGoLogin={() => onNavigate('login')} />
        ) : (
          <LoginScreen
            apiBase={apiBase}
            mock={mockMode}
            onLoggedIn={onLoggedIn}
            initialBanner={loginBanner}
            onForgotPassword={() => onNavigate('password-reset')}
            onOpenDevModal={() => setDevModalOpen(true)}
          />
        )
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
                devMode={devMode}
                apiBase={apiBase}
                uploaderBase={uploaderBase}
                adminEmail={adminEmail}
                onSetDevMode={onSetDevMode}
                onSetApiBase={onSetApiBase}
                onSetUploaderBase={onSetUploaderBase}
                onSetAdminEmail={onSetAdminEmail}
                onNavigate={onNavigate}
                onOpenDevModal={() => setDevModalOpen(true)}
              />
            </View>
          </View>
        ) : (
          <DialogProvider>
            <CmsApiContext.Provider value={{ apiBase, uploaderBase, token, mock: mockMode }}>
              <CmsMaintenanceGate route={route} adminName={adminEmail} onLogout={onLogout} onNavigate={onNavigate} />
            </CmsApiContext.Provider>
          </DialogProvider>
        )
      ) : null}

      <DevModal
        visible={devModalOpen && showDevButton}
        apiBase={apiBase}
        uploaderBase={uploaderBase}
        adminEmail={adminEmail}
        mock={mockMode}
        onClose={() => setDevModalOpen(false)}
        onSetAdminEmail={onSetAdminEmail}
        onSetApiBase={onSetApiBase}
        onSetUploaderBase={onSetUploaderBase}
        onSetMock={onSetMockMode}
        onNavigate={onNavigate}
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
              <Text style={styles.debugOverlayLabel}>MOCK</Text>
              <Switch value={mockMode} onValueChange={onSetMockMode} />
            </View>

            <View style={styles.debugOverlayRow}>
              <Text style={styles.debugOverlayLabel}>DEV モーダル</Text>
              <Pressable onPress={() => setDevModalOpen(true)} style={styles.debugOverlayBtn}>
                <Text style={styles.debugOverlayBtnText}>開く</Text>
              </Pressable>
            </View>

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
    zIndex: 9999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  selectMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectMenuItemFirst: {
    borderTopWidth: 0,
  },
  selectMenuText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },

  selectSearchWrap: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  selectSearchInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  selectMenuScroll: {
    maxHeight: 280,
  },
  selectMenuScrollContent: {
    paddingBottom: 6,
  },
  selectMenuDetailText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  selectMenuEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectMenuFooterBtn: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
  },
  selectMenuFooterText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },

  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    padding: 14,
  },
  dialogTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  dialogMessage: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  dialogActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  dialogBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  dialogBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  dialogBtnOk: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  dialogBtnDanger: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  dialogBtnOkText: {
    color: COLORS.white,
  },

  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalCard: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  pickerModalHeader: {
    height: 46,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerModalTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
  },
  pickerModalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerModalCloseText: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: '900',
    marginTop: -1,
  },
  pickerModalList: {
    maxHeight: 420,
  },
  pickerModalListContent: {
    paddingBottom: 6,
  },
  pickerModalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  pickerModalItemText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  pickerModalDoneBtn: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.text,
  },
  pickerModalDoneText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },

  uploadBarOuter: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  uploadBarInner: {
    height: '100%',
    backgroundColor: COLORS.text,
  },

  multiChipsWrap: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  multiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
    marginRight: 8,
    marginBottom: 8,
  },
  multiChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 260,
  },
  multiChipRemove: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 8,
  },
  multiSelectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  multiSelectCheck: {
    width: 18,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
    textAlign: 'center',
  },
  multiSelectTextCol: {
    flex: 1,
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
  tagTemplateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  tagTemplateButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.bg,
  },
  tagTemplateButtonActive: {
    borderColor: COLORS.text,
    backgroundColor: COLORS.text,
  },
  tagTemplateText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  tagTemplateTextActive: {
    color: COLORS.white,
  },
  smallBtnDanger: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#b91c1c',
  },
  smallBtnDangerText: {
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
