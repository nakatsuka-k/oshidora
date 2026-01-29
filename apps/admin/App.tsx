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

import {
  CategoriesListScreen as CatalogCategoriesListScreen,
  CategoryEditScreen as CatalogCategoryEditScreen,
} from './src/screens/catalog/CategoriesScreens'
import {
  TagsListScreen as CatalogTagsListScreen,
  TagEditScreen as CatalogTagEditScreen,
} from './src/screens/catalog/TagsScreens'
import {
  GenresListScreen as CatalogGenresListScreen,
  GenreEditScreen as CatalogGenreEditScreen,
} from './src/screens/catalog/GenresScreens'
import {
  CastCategoriesListScreen as CatalogCastCategoriesListScreen,
  CastCategoryEditScreen as CatalogCastCategoryEditScreen,
} from './src/screens/catalog/CastCategoriesScreens'
import { RankingsScreen as ExtractedRankingsScreen } from './src/screens/rankings/RankingsScreen'
import {
  CommentApproveScreen as ExtractedCommentApproveScreen,
  CommentEditScreen as ExtractedCommentEditScreen,
  CommentsListScreen as ExtractedCommentsListScreen,
  CommentsPendingListScreen as ExtractedCommentsPendingListScreen,
} from './src/screens/comments/CommentScreens'
import {
  NoticeEditScreen as ExtractedNoticeEditScreen,
  NoticesListScreen as ExtractedNoticesListScreen,
} from './src/screens/notices/NoticeScreens'
import {
  AdminEditScreen as ExtractedAdminEditScreen,
  AdminsListScreen as ExtractedAdminsListScreen,
} from './src/screens/admins/AdminsScreens'
import {
  InquiriesListScreen as ExtractedInquiriesListScreen,
  InquiryDetailScreen as ExtractedInquiryDetailScreen,
} from './src/screens/inquiries/InquiriesScreens'
import {
  UserCreateScreen as ExtractedUserCreateScreen,
  UserDetailScreen as ExtractedUserDetailScreen,
  UsersListScreen as ExtractedUsersListScreen,
} from './src/screens/users/UserScreens'
import {
  VideoDetailScreen as ExtractedVideoDetailScreen,
  VideoListScreen as ExtractedVideoListScreen,
  VideoUploadScreen as ExtractedVideoUploadScreen,
} from './src/screens/videos/VideoScreens'
import {
  ScheduledVideoDetailScreen as ExtractedScheduledVideoDetailScreen,
  ScheduledVideosListScreen as ExtractedScheduledVideosListScreen,
  UnapprovedActorAccountDetailScreen as ExtractedUnapprovedActorAccountDetailScreen,
  UnapprovedActorAccountsListScreen as ExtractedUnapprovedActorAccountsListScreen,
  UnapprovedVideoDetailScreen as ExtractedUnapprovedVideoDetailScreen,
  UnapprovedVideosListScreen as ExtractedUnapprovedVideosListScreen,
} from './src/screens/videos/VideoModerationScreens'
import {
  WorkEditScreen as ExtractedWorkEditScreen,
  WorksListScreen as ExtractedWorksListScreen,
} from './src/screens/works/WorkScreens'

const tus: typeof import('tus-js-client') | null =
  Platform.OS === 'web' ? (require('tus-js-client') as any) : null

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
        // empty
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
              <Pressable
                onPress={() => close(true)}
                style={[
                  styles.dialogBtn,
                  state.options.danger ? styles.dialogBtnDanger : styles.dialogBtnOk,
                ]}
              >
                <Text style={[styles.dialogBtnText, styles.dialogBtnOkText]}>
                  {state.options.okText || 'OK'}
                </Text>
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

async function cmsFetchJsonWithBase<T>(
  cfg: CmsApiConfig,
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
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
            // empty
          }
        }

        unauthorizedEventEmitted = dispatched
      }
    }
    throw new Error('セッションが切れました')
  }

  if (!res.ok) {
    const DEFAULT_ERROR = '通信に失敗しました。時間をおいて再度お試しください'
    const msg = json && json.error ? String(json.error) : DEFAULT_ERROR
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

  return 'https://api.oshidra.com'
}

function getUploaderBaseFromLocation(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''

  const override = safeLocalStorageGet(STORAGE_UPLOADER_OVERRIDE_KEY).trim()
  if (override) return override.replace(/\/$/, '')

  const url = new URL(window.location.href)
  const q = String(url.searchParams.get('uploader') || '').trim()
  if (q) return q.replace(/\/$/, '')

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
    // empty
  }
}

function safeLocalStorageRemove(key: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // empty
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

function Sidebar({
  entries,
  activeId,
  onNavigate,
}: {
  entries: SidebarEntry[]
  activeId: RouteId
  onNavigate: (id: RouteId) => void
}) {
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
              <Text
                style={[
                  styles.sidebarItemText,
                  activeId === it.id ? styles.sidebarItemTextActive : null,
                ]}
              >
                {it.label}
              </Text>
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

  type ScheduledRow = { id: string; title: string; scheduledAt: string; status: string }
  const [scheduledRows, setScheduledRows] = useState<ScheduledRow[]>([])

  const [kpis, setKpis] = useState<KPIItem[]>(() => [
    { id: 'users_total', label: '総ユーザー数', value: '—', route: 'users' },
    { id: 'users_today', label: '本日の新規登録', value: '—', route: 'users' },
    { id: 'works_published', label: '公開中作品数', value: '—', route: 'works' },
    { id: 'videos_published', label: '公開中動画数', value: '—', route: 'videos' },
    { id: 'plays_today', label: '本日の再生回数', value: '—', route: 'videos' },
    { id: 'coins_spent_today', label: '本日のコイン消費', value: '—', route: 'coin' },
  ])

  const [activities, setActivities] = useState<ActivityItem[]>(() => [
    {
      id: 'a_unapproved_videos',
      label: '未承認動画',
      detail: '承認待ち',
      pendingCount: 0,
      route: 'unapproved-videos',
    },
    {
      id: 'a_unapproved_comments',
      label: '未承認コメント',
      detail: '承認待ち',
      pendingCount: 0,
      route: 'comments-pending',
    },
    {
      id: 'a_unapproved_actors',
      label: '未承認俳優アカウント',
      detail: '審査待ち',
      pendingCount: 0,
      route: 'unapproved-actor-accounts',
    },
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
          {
            id: 'users_total',
            label: '総ユーザー数',
            value: String(summary?.usersTotal ?? 0),
            route: 'users',
          },
          {
            id: 'users_today',
            label: '本日の新規登録',
            value: String(summary?.usersToday ?? 0),
            route: 'users',
          },
          {
            id: 'works_published',
            label: '公開中作品数',
            value: String(summary?.worksPublished ?? 0),
            route: 'works',
          },
          {
            id: 'videos_published',
            label: '公開中動画数',
            value: String(summary?.videosPublished ?? 0),
            route: 'videos',
          },
          {
            id: 'plays_today',
            label: '本日の再生回数',
            value: String(summary?.playsToday ?? 0),
            route: 'videos',
          },
          {
            id: 'coins_spent_today',
            label: '本日のコイン消費',
            value: String(summary?.coinsSpentToday ?? 0),
            route: 'coin',
          },
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

/* LEGACY: extracted to ./src/screens/**
 * Kept temporarily for reference during refactor; safe to delete once confirmed.
 */

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

  type ActorAccount = {
    id: string
    name: string
    email: string
    submittedAt: string
    draft: any
  }
  const [item, setItem] = useState<null | ActorAccount>(null)
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
        type UnapprovedVideoItem = {
          id: string
          title: string
          approvalRequestedAt: string | null
          scheduledAt: string | null
          submitterEmail: string
        }
        const json = await cmsFetchJson<{ items: UnapprovedVideoItem[] }>(
          cfg,
          '/cms/videos/unapproved',
        )
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
        // empty
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

function getTokenFromLocation(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''

  try {
    const url = new URL(window.location.href)
    const q = String(url.searchParams.get('token') || '').trim()
    if (q) return q
  } catch {
    // empty
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

  const cfg = useCmsApi()
  const { confirm } = useDialog()

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
          <ExtractedWorksListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
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
        return (
          <ExtractedWorkEditScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            cmsFetchJsonWithBase={cmsFetchJsonWithBase}
            csvToIdList={csvToIdList}
            styles={styles}
            MultiSelectField={MultiSelectField}
            title="作品詳細・編集"
            id={selectedWorkId}
            onBack={() => onNavigate('works')}
          />
        )
      case 'work-new':
        return (
          <ExtractedWorkEditScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            cmsFetchJsonWithBase={cmsFetchJsonWithBase}
            csvToIdList={csvToIdList}
            styles={styles}
            MultiSelectField={MultiSelectField}
            title="作品新規作成"
            id=""
            onBack={() => onNavigate('works')}
          />
        )

      case 'videos-scheduled':
        return (
          <ExtractedScheduledVideosListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
            onOpenDetail={(id) => {
              setSelectedScheduledVideoId(id)
              onNavigate('videos-scheduled-detail')
            }}
          />
        )
      case 'videos-scheduled-detail':
        return (
          <ExtractedScheduledVideoDetailScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
            id={selectedScheduledVideoId}
            onBack={() => onNavigate('videos-scheduled')}
          />
        )

      case 'videos':
        return (
          <ExtractedVideoListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            confirm={confirm}
            styles={styles}
            SelectField={SelectField}
            onGoUpload={() => onNavigate('video-upload')}
            onOpenDetail={(id) => {
              setSelectedVideoId(id)
              onNavigate('video-detail')
            }}
          />
        )

      case 'video-categories':
        return (
          <CatalogCategoriesListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
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
          <CatalogTagsListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
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
          <ExtractedVideoDetailScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            csvToIdList={csvToIdList}
            styles={styles}
            SelectField={SelectField}
            MultiSelectField={MultiSelectField}
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
        return (
          <ExtractedVideoUploadScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            cmsFetchJsonWithBase={cmsFetchJsonWithBase}
            csvToIdList={csvToIdList}
            tus={tus}
            styles={styles}
            SelectField={SelectField}
            MultiSelectField={MultiSelectField}
            onBack={() => onNavigate('videos')}
          />
        )
      case 'unapproved-videos':
        return (
          <ExtractedUnapprovedVideosListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
            onOpenDetail={(id) => {
              setSelectedUnapprovedVideoId(id)
              onNavigate('unapproved-video-detail')
            }}
          />
        )
      case 'unapproved-video-detail':
        return (
          <ExtractedUnapprovedVideoDetailScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            confirm={confirm}
            styles={styles}
            id={selectedUnapprovedVideoId}
            onBack={() => onNavigate('unapproved-videos')}
          />
        )

      case 'unapproved-actor-accounts':
        return (
          <ExtractedUnapprovedActorAccountsListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
            onOpenDetail={(id) => {
              setSelectedUnapprovedActorAccountId(id)
              onNavigate('unapproved-actor-account-detail')
            }}
          />
        )
      case 'unapproved-actor-account-detail':
        return (
          <ExtractedUnapprovedActorAccountDetailScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            confirm={confirm}
            styles={styles}
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
          <ExtractedCommentsPendingListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
            onOpenDetail={(id) => {
              setSelectedCommentId(id)
              onNavigate('comment-approve')
            }}
          />
        )
      case 'comment-approve':
        return (
          <ExtractedCommentApproveScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
            SelectField={SelectField}
            id={selectedCommentId}
            onBack={() => onNavigate('comments-pending')}
          />
        )
      case 'comments':
        return (
          <ExtractedCommentsListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
            SelectField={SelectField}
            initialContentId={commentsFilterContentId}
            initialEpisodeId={commentsFilterEpisodeId}
            onOpenEdit={(id) => {
              setSelectedCommentId(id)
              onNavigate('comment-edit')
            }}
          />
        )
      case 'comment-edit':
        return (
          <ExtractedCommentEditScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
            SelectField={SelectField}
            id={selectedCommentId}
            onBack={() => onNavigate('comments')}
          />
        )

      case 'users':
        return (
          <ExtractedUsersListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
            SelectField={SelectField}
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
        return (
          <ExtractedUserDetailScreen cfg={cfg} cmsFetchJson={cmsFetchJson} styles={styles} id={selectedUserId} onBack={() => onNavigate(userBackRoute)} />
        )
      case 'user-new':
        return (
          <ExtractedUserCreateScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            isValidEmail={isValidEmail}
            styles={styles}
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
          <ExtractedNoticesListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            styles={styles}
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
        return (
          <ExtractedNoticeEditScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            confirm={confirm}
            csvToIdList={csvToIdList}
            styles={styles}
            SelectField={SelectField}
            title="お知らせ詳細・編集"
            id={selectedNoticeId}
            onBack={() => onNavigate('notices')}
          />
        )
      case 'notice-new':
        return (
          <ExtractedNoticeEditScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
            confirm={confirm}
            csvToIdList={csvToIdList}
            styles={styles}
            SelectField={SelectField}
            title="お知らせ新規作成"
            id=""
            onBack={() => onNavigate('notices')}
          />
        )

      case 'ranking-videos':
        return <ExtractedRankingsScreen cfg={cfg} cmsFetchJson={cmsFetchJson} type="videos" title="動画ランキング" />
      case 'ranking-coins':
        return <ExtractedRankingsScreen cfg={cfg} cmsFetchJson={cmsFetchJson} type="coins" title="獲得コインランキング" />
      case 'ranking-actors':
        return <ExtractedRankingsScreen cfg={cfg} cmsFetchJson={cmsFetchJson} type="actors" title="主演ランキング" />
      case 'ranking-directors':
        return <ExtractedRankingsScreen cfg={cfg} cmsFetchJson={cmsFetchJson} type="directors" title="監督ランキング" />
      case 'ranking-writers':
        return <ExtractedRankingsScreen cfg={cfg} cmsFetchJson={cmsFetchJson} type="writers" title="脚本ランキング" />

      case 'categories':
        return (
          <CatalogCategoriesListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
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
          <CatalogCategoryEditScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
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
          <CatalogCategoryEditScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
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
          <CatalogTagsListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
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
        return <CatalogTagEditScreen cfg={cfg} cmsFetchJson={cmsFetchJson} title="タグ編集" id={selectedTagId} onBack={() => onNavigate(tagBackRoute)} />
      case 'tag-new':
        return <CatalogTagEditScreen cfg={cfg} cmsFetchJson={cmsFetchJson} title="タグ新規作成" id="" onBack={() => onNavigate(tagBackRoute)} />

      case 'genres':
        return (
          <CatalogGenresListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
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
        return <CatalogGenreEditScreen cfg={cfg} cmsFetchJson={cmsFetchJson} title="ジャンル編集" id={selectedGenreId} onBack={() => onNavigate(genreBackRoute)} />
      case 'genre-new':
        return <CatalogGenreEditScreen cfg={cfg} cmsFetchJson={cmsFetchJson} title="ジャンル新規作成" id="" onBack={() => onNavigate(genreBackRoute)} />

      case 'cast-categories':
        return (
          <CatalogCastCategoriesListScreen
            cfg={cfg}
            cmsFetchJson={cmsFetchJson}
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
        return <CatalogCastCategoryEditScreen cfg={cfg} cmsFetchJson={cmsFetchJson} title="キャストカテゴリ編集" id={selectedCastCategoryId} onBack={() => onNavigate(castCategoryBackRoute)} />
      case 'cast-category-new':
        return <CatalogCastCategoryEditScreen cfg={cfg} cmsFetchJson={cmsFetchJson} title="キャストカテゴリ新規作成" id="" onBack={() => onNavigate(castCategoryBackRoute)} />

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
          <ExtractedAdminsListScreen
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
        return <ExtractedAdminEditScreen title="管理者詳細・編集" id={selectedAdminId} onBack={() => onNavigate('admins')} />
      case 'admin-new':
        return <ExtractedAdminEditScreen title="管理者新規作成" id="" onBack={() => onNavigate('admins')} />

      case 'inquiries':
        return (
          <ExtractedInquiriesListScreen
            onOpenDetail={(id) => {
              setSelectedInquiryId(id)
              onNavigate('inquiry-detail')
            }}
          />
        )
      case 'inquiry-detail':
        return <ExtractedInquiryDetailScreen id={selectedInquiryId} onBack={() => onNavigate('inquiries')} />

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

  const onSetDevMode = useCallback((v: boolean) => {
    setDevMode(v)
    safeLocalStorageSet(STORAGE_DEV_MODE_KEY, v ? '1' : '0')
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
            </View>
          </Animated.View>
        ) : null}
      </View>

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
