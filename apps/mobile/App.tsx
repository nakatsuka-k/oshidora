import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'

import {
  Chip,
  ConfirmDialog,
  IconButton,
  NoticeBellButton,
  PaginationDots,
  PrimaryButton,
  RowItem,
  ScreenContainer,
  SecondaryButton,
  Section,
  Slideshow,
  TabBar,
  THEME,
} from './components'

import {
  DeveloperMenuScreen,
  EmailVerifyScreen,
  RegisterCompleteScreen,
  SignupScreen,
  Sms2faScreen,
  TabbedPlaceholderScreen,
  TermsScreen,
  TutorialScreen,
  TopScreen,
  VideoListScreen,
  WelcomeTopScreen,
  PrivacyPolicyScreen,
  PaidVideoPurchaseScreen,
  CommentPostScreen,
  VideoPlayerScreen,
  StaffCastReviewScreen,
  WorkReviewScreen,
  CastSearchScreen,
  VideoSearchScreen,
  CastSearchResultScreen,
  WorkSearchScreen,
  MyPageScreen,
  CastProfileRegisterScreen,
  UserProfileEditScreen,
  FavoriteCastsScreen,
  FavoriteCastsEditScreen,
  FavoritesSelectScreen,
  FavoriteVideosScreen,
  VideoWatchHistoryScreen,
  CoinPurchaseScreen,
  CoinGrantScreen,
  CoinGrantCompleteScreen,
  CoinExchangeDestScreen,
  CoinExchangePayPayScreen,
  CoinExchangeCompleteScreen,
  LogoutScreen,
  SplashScreen,
  SettingsScreen,
  WithdrawalRequestScreen,
  NoticeListScreen,
  NoticeDetailScreen,
  ContactScreen,
  FaqScreen,
} from './screens'

import { apiFetch, DEBUG_MOCK_KEY } from './utils/api'
import { getBoolean, setBoolean, getString, setString } from './utils/storage'
import { useIpAddress } from './utils/useIpAddress'
import { upsertWatchHistory } from './utils/watchHistory'

const FALLBACK_ALLOWED_IPS = [
  '223.135.200.51',
  '117.102.205.215',
  '133.232.96.225',
  '3.114.72.126',
  '133.200.10.97',
  '159.28.175.137',
]

const AUTH_TOKEN_KEY = 'auth_token'
const DEBUG_AUTH_BYPASS_KEY = 'debug_auth_bypass'
const DEBUG_AUTH_AUTOFILL_KEY = 'debug_auth_autofill'
const DEBUG_USER_TYPE_KEY = 'debug_user_type_v1'
const DEBUG_PAYPAY_LINKED_KEY = 'debug_paypay_linked_v1'

type Oshi = {
  id: string
  name: string
  created_at: string
}

type WorkDetailWork = {
  id: string
  title: string
  subtitle: string
  tags: string[]
  rating: number
  reviews: number
  story: string
  episodes: Array<{ id: string; title: string; priceCoin: number }>
  staff: Array<{ role: string; name: string }>
}

type WorkKey = 'doutcall' | 'mysteryX' | 'romanceY' | 'comedyZ' | 'actionW'

const WORK_ID_ALIASES: Record<WorkKey, string[]> = {
  doutcall: ['content-1', 'p1', 'p2', 'p3', 'r1', 'f1', 'v1', 'v2', 'v3'],
  mysteryX: ['content-2', 'r2', 'f2', 'v4'],
  romanceY: ['content-3', 'r3', 'f3', 'v5'],
  comedyZ: ['content-4', 'r4'],
  actionW: ['content-5', 'v7'],
}

function resolveWorkKeyById(id: string): WorkKey {
  const needle = String(id || '').trim()
  if (!needle) return 'doutcall'
  for (const key of Object.keys(WORK_ID_ALIASES) as WorkKey[]) {
    if (WORK_ID_ALIASES[key].includes(needle)) return key
  }
  return 'doutcall'
}

type Screen =
  | 'splash'
  | 'home'
  | 'welcome'
  | 'login'
  | 'tutorial'
  | 'terms'
  | 'privacy'
  | 'purchase'
  | 'coinPurchase'
  | 'coinGrant'
  | 'coinGrantComplete'
  | 'coinExchangeDest'
  | 'coinExchangePayPay'
  | 'coinExchangeComplete'
  | 'comment'
  | 'signup'
  | 'emailVerify'
  | 'sms2fa'
  | 'profileRegister'
  | 'registerComplete'
  | 'videoList'
  | 'cast'
  | 'castSearchResult'
  | 'search'
  | 'work'
  | 'mypage'
  | 'castProfileRegister'
  | 'profileEdit'
  | 'ranking'
  | 'favorites'
  | 'favoriteVideos'
  | 'favoriteCasts'
  | 'favoriteCastsEdit'
  | 'watchHistory'
  | 'notice'
  | 'noticeDetail'
  | 'contact'
  | 'faq'
  | 'phone'
  | 'otp'
  | 'top'
  | 'dev'
  | 'profile'
  | 'castReview'
  | 'workReview'
  | 'workDetail'
  | 'videoPlayer'
  | 'settings'
  | 'withdrawalRequest'
  | 'logout'

const WEB_DEFAULT_SCREEN: Screen = 'splash'

const TUTORIAL_SLIDE_COUNT = 3

function screenToWebHash(screen: Screen): string {
  switch (screen) {
    case 'splash':
      return '#/splash'
    case 'home':
      return '#/home'
    case 'videoList':
      return '#/videos'
    case 'cast':
      return '#/cast'
    case 'castSearchResult':
      return '#/cast-result'
    case 'search':
      return '#/search'
    case 'work':
      return '#/work-search'
    case 'mypage':
      return '#/mypage'
    case 'castProfileRegister':
      return '#/cast-profile-register'
    case 'profileEdit':
      return '#/profile-edit'
    case 'profileRegister':
      return '#/profile-register'
    case 'welcome':
      return '#/welcome'
    case 'login':
      return '#/login'
    case 'tutorial':
      return '#/tutorial/1'
    case 'terms':
      return '#/terms'
    case 'privacy':
      return '#/privacy'
    case 'purchase':
      return '#/purchase'
    case 'coinPurchase':
      return '#/coin-purchase'
    case 'coinGrant':
      return '#/coin-grant'
    case 'coinGrantComplete':
      return '#/coin-grant-complete'
    case 'coinExchangeDest':
      return '#/coin-exchange'
    case 'coinExchangePayPay':
      return '#/coin-exchange/paypay'
    case 'coinExchangeComplete':
      return '#/coin-exchange/complete'
    case 'comment':
      return '#/comment'
    case 'signup':
      return '#/signup'
    case 'emailVerify':
      return '#/email-verify'
    case 'sms2fa':
      return '#/sms-2fa'
    case 'registerComplete':
      return '#/register-complete'
    case 'phone':
      return '#/phone'
    case 'otp':
      return '#/otp'
    case 'ranking':
      return '#/ranking'
    case 'favorites':
      return '#/favorites'
    case 'favoriteVideos':
      return '#/favorites/videos'
    case 'favoriteCasts':
      return '#/favorites/casts'
    case 'favoriteCastsEdit':
      return '#/favorites/casts/edit'
    case 'watchHistory':
      return '#/watch-history'
    case 'settings':
      return '#/settings'
    case 'withdrawalRequest':
      return '#/withdrawal'
    case 'logout':
      return '#/logout'
    case 'notice':
      return '#/notice'
    case 'noticeDetail':
      return '#/notice-detail'
    case 'contact':
      return '#/contact'
    case 'faq':
      return '#/faq'
    case 'profile':
      return '#/profile'
    case 'castReview':
      return '#/cast-review'
    case 'workReview':
      return '#/work-review'
    case 'workDetail':
      return '#/work'
    case 'videoPlayer':
      return '#/play'
    case 'top':
      return '#/debug'
    case 'dev':
      return '#/dev'
    default:
      return '#/welcome'
  }
}

function tutorialIndexToWebHash(index: number): string {
  const safe = Math.max(0, Math.min(index, Math.max(0, TUTORIAL_SLIDE_COUNT - 1)))
  return `#/tutorial/${safe + 1}`
}

function parseTutorialIndexFromWebHash(hash: string): number | null {
  const value = (hash || '').trim()
  const path = value.startsWith('#') ? value.slice(1) : value
  if (!path.startsWith('/tutorial')) return null

  const parts = path.split('?')[0].split('/').filter(Boolean)
  // parts: ['tutorial', '2']
  if (parts.length >= 2) {
    const raw = Number(parts[1])
    if (Number.isFinite(raw)) {
      const zeroBased = Math.floor(raw) - 1
      return Math.max(0, Math.min(zeroBased, Math.max(0, TUTORIAL_SLIDE_COUNT - 1)))
    }
  }
  return 0
}

function webHashToScreen(hash: string): Screen {
  const value = (hash || '').trim()
  const raw = value.startsWith('#') ? value.slice(1) : value
  const path = raw.split('?')[0]

  switch (path) {
    case '/':
    case '/splash':
      return 'splash'
    case '/welcome':
      return 'welcome'
    case '/login':
      return 'login'
    case '/tutorial':
    case '/tutorial/':
      return 'tutorial'
    case '/terms':
      return 'terms'
    case '/privacy':
      return 'privacy'
    case '/purchase':
      return 'purchase'
    case '/coin-purchase':
      return 'coinPurchase'
    case '/coin-grant':
      return 'coinGrant'
    case '/coin-grant-complete':
      return 'coinGrantComplete'
    case '/coin-exchange':
      return 'coinExchangeDest'
    case '/coin-exchange/paypay':
      return 'coinExchangePayPay'
    case '/coin-exchange/complete':
      return 'coinExchangeComplete'
    case '/comment':
      return 'comment'
    case '/signup':
      return 'signup'
    case '/email-verify':
      return 'emailVerify'
    case '/profile-register':
      return 'profileRegister'
    case '/sms-2fa':
      return 'sms2fa'
    case '/register-complete':
      return 'registerComplete'
    case '/phone':
      return 'phone'
    case '/otp':
      return 'otp'
    case '/home':
      return 'home'
    case '/videos':
      return 'videoList'
    case '/cast':
      return 'cast'
    case '/cast-result':
      return 'castSearchResult'
    case '/search':
      return 'search'
    case '/work-search':
      return 'work'
    case '/mypage':
      return 'mypage'
    case '/cast-profile-register':
      return 'castProfileRegister'
    case '/profile-edit':
      return 'profileEdit'
    case '/ranking':
      return 'ranking'
    case '/favorites':
      return 'favorites'
    case '/favorites/videos':
      return 'favoriteVideos'
    case '/favorites/casts':
      return 'favoriteCasts'
    case '/favorites/casts/edit':
      return 'favoriteCastsEdit'
    case '/watch-history':
      return 'watchHistory'
    case '/settings':
      return 'settings'
    case '/withdrawal':
      return 'withdrawalRequest'
    case '/logout':
      return 'logout'
    case '/notice':
      return 'notice'
    case '/notice-detail':
      return 'noticeDetail'
    case '/contact':
      return 'contact'
    case '/faq':
      return 'faq'
    case '/profile':
      return 'profile'
    case '/cast-review':
      return 'castReview'
    case '/work-review':
      return 'workReview'
    case '/work':
      return 'workDetail'
    case '/play':
      return 'videoPlayer'
    case '/debug':
      return 'top'
    case '/dev':
      return 'dev'
    default:
      if (path.startsWith('/tutorial/')) return 'tutorial'
      return WEB_DEFAULT_SCREEN
  }
}

function screenToDocumentTitle(
  screen: Screen,
  opts?: { tutorialIndex?: number; tutorialCount?: number }
): string {
  const base = '推しドラ'
  switch (screen) {
    case 'splash':
      return base
    case 'welcome':
      return base
    case 'login':
      return `${base} | ログイン`
    case 'tutorial':
      if (typeof opts?.tutorialIndex === 'number' && typeof opts?.tutorialCount === 'number') {
        return `${base} | チュートリアル (${opts.tutorialIndex + 1}/${opts.tutorialCount})`
      }
      return `${base} | チュートリアル`
    case 'terms':
      return `${base} | 利用規約`
    case 'privacy':
      return `${base} | プライバシーポリシー`
    case 'purchase':
      return `${base} | 購入確認`
    case 'coinPurchase':
      return `${base} | コイン購入`
    case 'coinGrant':
      return `${base} | 推しポイント付与`
    case 'coinGrantComplete':
      return `${base} | コイン付与完了`
    case 'coinExchangeDest':
      return `${base} | コイン換金`
    case 'coinExchangePayPay':
      return `${base} | コイン換金`
    case 'coinExchangeComplete':
      return `${base} | コイン換金`
    case 'comment':
      return `${base} | コメント`
    case 'signup':
      return `${base} | 新規登録`
    case 'emailVerify':
      return `${base} | メール認証`
    case 'sms2fa':
      return `${base} | SMS認証`
    case 'profileRegister':
      return `${base} | プロフィール登録`
    case 'registerComplete':
      return `${base} | 登録完了`
    case 'phone':
      return `${base} | SMS認証（電話番号）`
    case 'otp':
      return `${base} | 2段階認証`
    case 'home':
      return `${base} | トップ`
    case 'videoList':
      return `${base} | 動画一覧`
    case 'cast':
      return `${base} | キャスト`
    case 'search':
      return `${base} | 検索`
    case 'work':
      return `${base} | 作品から探す`
    case 'mypage':
      return `${base} | マイページ`
    case 'castProfileRegister':
      return `${base} | キャストプロフィール登録`
    case 'ranking':
      return `${base} | ランキング`
    case 'favorites':
      return `${base} | お気に入り`
    case 'favoriteVideos':
      return `${base} | お気に入り（動画）`
    case 'favoriteCasts':
      return `${base} | お気に入り（キャスト）`
    case 'favoriteCastsEdit':
      return `${base} | お気に入りキャスト 編集`
    case 'watchHistory':
      return `${base} | 視聴履歴`
    case 'settings':
      return `${base} | 設定`
    case 'withdrawalRequest':
      return `${base} | 退会申請`
    case 'logout':
      return `${base} | ログアウト`
    case 'notice':
      return `${base} | お知らせ`
    case 'noticeDetail':
      return `${base} | お知らせ詳細`
    case 'contact':
      return `${base} | お問い合わせ`
    case 'faq':
      return `${base} | よくある質問`
    case 'profile':
      return `${base} | プロフィール`
    case 'castReview':
      return `${base} | 評価`
    case 'workReview':
      return `${base} | 評価`
    case 'workDetail':
      return `${base} | 作品詳細`
    case 'videoPlayer':
      return `${base} | 動画表示`
    case 'dev':
      return `${base} | Developer`
    case 'top':
      return `${base} | Debug`
    default:
      return base
  }
}

function isValidEmail(value: string) {
  const email = value.trim()
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function defaultApiBaseUrl() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1'
      if (isLocalhost) return 'http://localhost:8787'
    }
    return 'https://api.oshidra.com'
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787'
  return 'http://127.0.0.1:8787'
}

function resolveShareAppBaseUrl(apiBaseUrl?: string): string | null {
  // Prefer an explicit public web entrypoint when available.
  const env = (process.env.EXPO_PUBLIC_WEB_BASE_URL || '').trim()
  if (env) {
    return env.split('#')[0].replace(/\/$/, '')
  }

  // For web builds, default to the current web origin (not the API origin).
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '')
  }

  // As a last resort (e.g., native dev), use the API base host but still use hash routes.
  const fallback = (apiBaseUrl || '').trim().replace(/\/$/, '')
  return fallback ? fallback : null
}

export default function App() {
  const TUTORIAL_SEEN_KEY = 'tutorial_seen_v1'

  const apiBaseUrl = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_API_BASE_URL
    return env && env.trim().length > 0 ? env.trim() : defaultApiBaseUrl()
  }, [])

  const allowedIpSet = useMemo(() => {
    const raw = (process.env.EXPO_PUBLIC_ALLOWED_IPS || '').trim()
    const ips = raw
      ? raw
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : FALLBACK_ALLOWED_IPS
    return new Set(ips)
  }, [])

  const isLocalhostWeb =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '::1')

  const ipRestrictionEnabled = useMemo(() => {
    if (Platform.OS !== 'web' || isLocalhostWeb) return false
    const raw = String(process.env.EXPO_PUBLIC_IP_RESTRICTION_ENABLED ?? '').trim().toLowerCase()
    return raw === '1' || raw === 'true'
  }, [isLocalhostWeb])
  const { ipInfo, isLoading: ipLoading, error: ipError, refetch: refetchIp } = useIpAddress({ enabled: ipRestrictionEnabled })
  const ipAllowed = !ipRestrictionEnabled || (ipInfo?.ip ? allowedIpSet.has(ipInfo.ip) : false)

  const expectedLoginEmail = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_LOGIN_EMAIL
    const value = env && env.trim().length > 0 ? env.trim() : 'test@example.com'
    return value.toLowerCase()
  }, [])

  const expectedLoginPassword = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_LOGIN_PASSWORD
    return env && env.trim().length > 0 ? env : 'password'
  }, [])

  const streamSampleVideoId = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_CLOUDFLARE_STREAM_SAMPLE_VIDEO_ID
    return env && env.trim().length > 0 ? env.trim() : '75f3ddaf69ff44c43746c9492c3c4df5'
  }, [])

  // Player context (AXCMS-PL-001)
  const [playerVideoIdNoSub, setPlayerVideoIdNoSub] = useState<string>('75f3ddaf69ff44c43746c9492c3c4df5')
  const [playerVideoIdWithSub, setPlayerVideoIdWithSub] = useState<string | null>(null)

  const [screen, setScreen] = useState<Screen>('splash')
  const [history, setHistory] = useState<Screen[]>([])

  const [postLoginTarget, setPostLoginTarget] = useState<Screen | null>(null)

  const [tutorialIndex, setTutorialIndex] = useState<number>(0)

  const [termsReadOnly, setTermsReadOnly] = useState<boolean>(false)

  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('')

  const [videoListTag, setVideoListTag] = useState<string | null>(null)

  const [registerEmail, setRegisterEmail] = useState<string>('')
  const [registerPassword, setRegisterPassword] = useState<string>('')
  const [registerPhone, setRegisterPhone] = useState<string>('')

  const [userProfile, setUserProfile] = useState<{
    displayName: string
    email: string
    phone: string
    birthDate: string
    avatarUrl?: string
  }>({
    displayName: '',
    email: '',
    phone: '',
    birthDate: '',
    avatarUrl: undefined,
  })

  const goTo = useCallback((next: Screen) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = next === 'tutorial' ? tutorialIndexToWebHash(0) : screenToWebHash(next)
      return
    }

    setHistory((prev) => [...prev, screen])
    setScreen(next)
  }, [screen])

  const replaceWebHash = useCallback((hash: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    // Avoid growing history for tutorial swipes.
    try {
      window.history.replaceState(null, '', hash)
    } catch {
      window.location.hash = hash
    }
  }, [])

  const onTutorialIndexChange = useCallback((next: number) => {
    setTutorialIndex(next)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      replaceWebHash(tutorialIndexToWebHash(next))
    }
  }, [replaceWebHash])

  const goBack = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.location.hash = screenToWebHash(WEB_DEFAULT_SCREEN)
      }
      return
    }

    setHistory((prev) => {
      if (prev.length === 0) return prev
      const nextHistory = prev.slice(0, -1)
      const prevScreen = prev[prev.length - 1]
      setScreen(prevScreen)
      return nextHistory
    })
  }, [])

  const [health, setHealth] = useState<string>('')
  const [items, setItems] = useState<Oshi[]>([])
  const [name, setName] = useState<string>('')
  const [apiBusy, setApiBusy] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // Auth flow busy flag (login/phone/otp). Keep separate from apiBusy so auth buttons don't get disabled by
  // background health/data fetches on Pages production.
  const [authBusy, setAuthBusy] = useState<boolean>(false)

  const [loggedIn, setLoggedIn] = useState<boolean>(false)

  const [authToken, setAuthToken] = useState<string>('')
  const [authPendingToken, setAuthPendingToken] = useState<string>('')

  const [debugAuthBypass, setDebugAuthBypass] = useState<boolean>(false)
  const [debugAuthAutofill, setDebugAuthAutofill] = useState<boolean>(false)
  const [debugUserType, setDebugUserType] = useState<'user' | 'cast'>('user')
  const [debugPaypayLinked, setDebugPaypayLinked] = useState<boolean>(false)
  const [debugMock, setDebugMock] = useState<boolean>(true)
  const [debugPaypayMaskedLabel] = useState<string>('********')
  const [debugEmailCode, setDebugEmailCode] = useState<string>('')
  const [debugSmsCode, setDebugSmsCode] = useState<string>('')

  const [debugOverlayHidden, setDebugOverlayHidden] = useState<boolean>(false)
  const debugOverlayPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
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
          // keep current translation when starting a new drag
          const cur = (debugOverlayPan as any).__getValue?.() as { x: number; y: number } | undefined
          debugOverlayPan.setOffset({ x: cur?.x ?? 0, y: cur?.y ?? 0 })
          debugOverlayPan.setValue({ x: 0, y: 0 })
        },
        onPanResponderMove: Animated.event([null, { dx: debugOverlayPan.x, dy: debugOverlayPan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => {
          debugOverlayPan.flattenOffset()
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

        // keep current translation when starting a new drag
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

  useEffect(() => {
    void (async () => {
      try {
        const [token, bypass, autofill, userTypeValue, paypayLinked, mock] = await Promise.all([
          getString(AUTH_TOKEN_KEY),
          getBoolean(DEBUG_AUTH_BYPASS_KEY),
          getBoolean(DEBUG_AUTH_AUTOFILL_KEY),
          getString(DEBUG_USER_TYPE_KEY),
          getBoolean(DEBUG_PAYPAY_LINKED_KEY),
          getBoolean(DEBUG_MOCK_KEY),
        ])
        if (token) {
          setAuthToken(token)
          setLoggedIn(true)
        }
        setDebugAuthBypass(bypass)
        setDebugAuthAutofill(autofill)

        const t = (userTypeValue || '').trim()
        if (t === 'cast' || t === 'user') setDebugUserType(t)
        setDebugPaypayLinked(paypayLinked)
        setDebugMock(mock)
      } catch {
        // ignore
      }
    })()
  }, [])

  useEffect(() => {
    void setBoolean(DEBUG_AUTH_BYPASS_KEY, debugAuthBypass)
  }, [debugAuthBypass])

  useEffect(() => {
    void setBoolean(DEBUG_AUTH_AUTOFILL_KEY, debugAuthAutofill)
  }, [debugAuthAutofill])

  useEffect(() => {
    void setString(DEBUG_USER_TYPE_KEY, debugUserType)
  }, [debugUserType])

  useEffect(() => {
    void setBoolean(DEBUG_PAYPAY_LINKED_KEY, debugPaypayLinked)
  }, [debugPaypayLinked])

  useEffect(() => {
    void setBoolean(DEBUG_MOCK_KEY, debugMock)
  }, [debugMock])

  useEffect(() => {
    if (!authToken) return
    void setString(AUTH_TOKEN_KEY, authToken)
  }, [authToken])

  const setLoggedInState = useCallback(async (next: boolean) => {
    setLoggedIn(next)
    if (!next) {
      setAuthToken('')
      setAuthPendingToken('')
      try {
        await setString(AUTH_TOKEN_KEY, '')
      } catch {
        // ignore
      }
    }
  }, [])

  const resetToLogin = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = screenToWebHash('login')
      return
    }
    setHistory([])
    setScreen('login')
  }, [])

  const toggleDebugUserType = useCallback(() => {
    setDebugUserType((prev) => (prev === 'cast' ? 'user' : 'cast'))
  }, [])

  useEffect(() => {
    // Guard for direct navigation (e.g. web hash) to login-required screens.
    if (loggedIn || debugAuthBypass) return
    if (
      screen !== 'cast' &&
      screen !== 'castSearchResult' &&
      screen !== 'profile' &&
      screen !== 'castReview' &&
      screen !== 'favorites' &&
      screen !== 'favoriteVideos' &&
      screen !== 'favoriteCasts' &&
      screen !== 'favoriteCastsEdit'
    )
      return

    setPostLoginTarget(screen)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = screenToWebHash('login')
      return
    }
    setHistory([])
    setScreen('login')
  }, [loggedIn, screen])

  const requireLogin = useCallback((next: Screen): boolean => {
    if (loggedIn || debugAuthBypass) return true
    setPostLoginTarget(next)
    goTo('login')
    return false
  }, [debugAuthBypass, goTo, loggedIn])

  type ApprovedComment = { id: string; author: string; body: string; createdAt?: string }

  const [approvedComments, setApprovedComments] = useState<ApprovedComment[]>([])
  const [commentsBusy, setCommentsBusy] = useState(false)
  const [commentsError, setCommentsError] = useState('')
  const [commentsExpanded, setCommentsExpanded] = useState(false)

  const [workReviewSummary, setWorkReviewSummary] = useState<{ ratingAvg: number; reviewCount: number } | null>(null)
  const [workReviewError, setWorkReviewError] = useState('')

  const [castReviewSummary, setCastReviewSummary] = useState<{ ratingAvg: number; reviewCount: number } | null>(null)
  const [castReviewError, setCastReviewError] = useState('')

  const switchTab = useCallback((key: 'home' | 'video' | 'cast' | 'work' | 'search' | 'mypage') => {
    const next: Screen =
      key === 'home'
        ? 'home'
        : key === 'video'
          ? 'videoList'
          : key === 'cast'
            ? 'cast'
            : key === 'work'
              ? 'work'
              : key === 'search'
                ? 'search'
                : 'mypage'

    // Access control: videos are public; cast/staff search/list is login-required (AXCMS-CS-001).

    if (next === 'cast' && !requireLogin('cast')) return

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = screenToWebHash(next)
      return
    }

    setHistory([])
    setScreen(next)
  }, [requireLogin])

  const [debugDotsIndex, setDebugDotsIndex] = useState<number>(0)
  const [debugSlideIndex, setDebugSlideIndex] = useState<number>(0)

  const mockProfile = useMemo(
    () => ({
      id: 'cast-1',
      name: '松岡美沙',
      affiliation: 'フリーランス',
      genre: ['女優'],
      biography:
        '生年月日：1998年11月29日\n神奈川県出身\n趣味：映画・アニメ鑑賞・カフェ巡り\n特技：ダンス・歌',
      worksText:
        '・ダウトコール\n・ミステリーX\n・ラブストーリーY',
      snsLinks: [
        { label: 'X', url: 'https://x.com/' },
        { label: 'Instagram', url: 'https://www.instagram.com/' },
      ],
      selfPr:
        '作品の世界観を大切に、観る人の心に残るお芝居を目指しています。応援よろしくお願いします。',
    }),
    []
  )

  const [selectedCast, setSelectedCast] = useState<{ id: string; name: string; roleLabel?: string } | null>(null)
  const [castReviews, setCastReviews] = useState<Record<string, { rating: number; comment: string; updatedAt: number }>>({})

  const [workReviewTarget, setWorkReviewTarget] = useState<{ id: string; title: string; subtitle?: string } | null>(null)

  const [castSearchKeyword, setCastSearchKeyword] = useState<string>('')

  const selectedCastReview = useMemo(() => {
    if (!selectedCast) return null
    return castReviews[selectedCast.id] ?? null
  }, [castReviews, selectedCast])

  const mockWork = useMemo<WorkDetailWork>(
    () => ({
      id: 'content-1',
      title: 'ダウトコール',
      subtitle: 'あなた、浮気されてますよ。',
      tags: ['Drama', 'Mystery', 'Romance'],
      rating: 4.7,
      reviews: 128,
      story:
        '夫といつも通りの会話をしていると、突然スマホが鳴る。\nドキドキしながら手に取ると…「あなた、浮気されてますよ」\nと不気味な女から一言。\n\nそこから日々の調査は加速し、次々と“自分だけが知らない日常”が暴かれていく。\n結果として浮気しているのは誰なのか？浮気がばれてどんな復讐が待っているのか？',
      episodes: [
        { id: '01', title: '第01話', priceCoin: 0 },
        { id: '02', title: '第02話', priceCoin: 0 },
        { id: '03', title: '第03話', priceCoin: 30 },
      ],
      staff: [
        { role: '出演者', name: '松岡美沙' },
        { role: '出演者', name: '櫻井拓馬' },
        { role: '監督', name: '監督太郎' },
        { role: '制作プロダクション', name: 'Oshidora株式会社' },
      ],
    }),
    []
  )

  const mockWorksByKey = useMemo<Record<WorkKey, WorkDetailWork>>(
    () => ({
      doutcall: mockWork,
      mysteryX: {
        id: 'content-2',
        title: 'ミステリーX',
        subtitle: '目撃者は、あなた自身。',
        tags: ['Mystery', 'Drama'],
        rating: 4.4,
        reviews: 61,
        story:
          'ある夜、街の監視カメラに映ったのは“ありえない自分”。\n記憶の空白を埋めるため、あなたは手がかりを追い始める。\n\n真相に近づくほど、誰も信じられなくなっていく。',
        episodes: [
          { id: '01', title: '第01話', priceCoin: 0 },
          { id: '02', title: '第02話', priceCoin: 10 },
          { id: '03', title: '第03話', priceCoin: 30 },
        ],
        staff: [
          { role: '出演者', name: 'キャストA' },
          { role: '出演者', name: 'キャストB' },
          { role: '監督', name: '監督X' },
          { role: '制作プロダクション', name: 'Oshidora株式会社' },
        ],
      },
      romanceY: {
        id: 'content-3',
        title: 'ラブストーリーY',
        subtitle: 'すれ違いの先に、答えはある。',
        tags: ['Romance', 'Drama'],
        rating: 4.2,
        reviews: 43,
        story:
          '些細な嘘から始まったすれ違い。\nそれでも、心のどこかで相手を想い続けてしまう。\n\n言葉にできない気持ちが、二人の距離を揺らしていく。',
        episodes: [
          { id: '01', title: '第01話', priceCoin: 0 },
          { id: '02', title: '第02話', priceCoin: 10 },
          { id: '03', title: '第03話', priceCoin: 10 },
        ],
        staff: [
          { role: '出演者', name: 'キャストY1' },
          { role: '出演者', name: 'キャストY2' },
          { role: '監督', name: '監督Y' },
          { role: '制作プロダクション', name: 'Oshidora株式会社' },
        ],
      },
      comedyZ: {
        id: 'content-4',
        title: 'コメディZ',
        subtitle: '笑って、泣いて、また笑う。',
        tags: ['Comedy'],
        rating: 4.1,
        reviews: 38,
        story:
          'ドタバタの毎日に、予想外の出会い。\n笑いが起きた瞬間に、ちょっとだけ人生が動き出す。\n\n今日も何かが起きる、そんな物語。',
        episodes: [
          { id: '01', title: '第01話', priceCoin: 0 },
          { id: '02', title: '第02話', priceCoin: 0 },
          { id: '03', title: '第03話', priceCoin: 10 },
        ],
        staff: [
          { role: '出演者', name: 'キャストZ1' },
          { role: '出演者', name: 'キャストZ2' },
          { role: '監督', name: '監督Z' },
          { role: '制作プロダクション', name: 'Oshidora株式会社' },
        ],
      },
      actionW: {
        id: 'content-5',
        title: 'アクションW',
        subtitle: '止まらない追跡、迫るタイムリミット。',
        tags: ['Action'],
        rating: 4.3,
        reviews: 37,
        story:
          'ある任務をきっかけに、主人公は巨大な陰謀へ巻き込まれていく。\n\n逃げるほど追われ、近づくほど危険になる。\nそれでも、真実を掴むために走り続ける。',
        episodes: [
          { id: '01', title: '第01話', priceCoin: 0 },
          { id: '02', title: '第02話', priceCoin: 20 },
          { id: '03', title: '第03話', priceCoin: 20 },
        ],
        staff: [
          { role: '出演者', name: 'キャストW1' },
          { role: '出演者', name: 'キャストW2' },
          { role: '監督', name: '監督W' },
          { role: '制作プロダクション', name: 'Oshidora株式会社' },
        ],
      },
    }),
    [mockWork]
  )

  const [selectedWorkId, setSelectedWorkId] = useState<string>(mockWork.id)

  const workIdForDetail = useMemo(() => {
    const v = String(selectedWorkId || '').trim()
    return v || mockWork.id
  }, [mockWork.id, selectedWorkId])

  const workForDetail = useMemo<WorkDetailWork>(() => {
    const key = resolveWorkKeyById(workIdForDetail)
    const base = mockWorksByKey[key] ?? mockWork
    // Keep id consistent with the selected id for history/share/comments.
    return { ...base, id: workIdForDetail }
  }, [mockWork, mockWorksByKey, workIdForDetail])

  const openWorkDetail = useCallback(
    (id: string) => {
      const nextId = String(id || '').trim()
      if (nextId) setSelectedWorkId(nextId)
      goTo('workDetail')
    },
    [goTo]
  )

  const resolveCastAccountIdByName = useCallback((name: string): string | null => {
    const n = (name || '').trim()
    if (!n) return null
    // Current mock data only has one real cast profile.
    if (n === mockProfile.name) return mockProfile.id
    return null
  }, [mockProfile.id, mockProfile.name])

  const shareUrlForWork = useCallback((contentId: string, videoIdNoSub: string, title: string) => {
    // Use Cloudflare Stream thumbnail (public) for OG image when available.
    const thumb = `https://videodelivery.net/${encodeURIComponent(videoIdNoSub)}/thumbnails/thumbnail.jpg?time=1s`
    const appBase = resolveShareAppBaseUrl(apiBaseUrl)
    if (!appBase) return ''
    const params = new URLSearchParams()
    params.set('workId', contentId)
    params.set('title', title)
    params.set('thumb', thumb)
    return `${appBase}#/work?${params.toString()}`
  }, [apiBaseUrl])

  const shareUrlForCast = useCallback((castId: string, castName: string) => {
    const appBase = resolveShareAppBaseUrl(apiBaseUrl)
    if (!appBase) return ''
    const params = new URLSearchParams()
    params.set('castId', castId)
    params.set('title', castName)
    return `${appBase}#/profile?${params.toString()}`
  }, [apiBaseUrl])

  const mockApprovedComments = useMemo(
    () => [
      { id: 'c1', author: '匿名', body: 'めちゃくちゃ続きが気になる…！' },
      { id: 'c2', author: 'Misa', body: '演技が最高。表情の作り方がすごい。' },
      { id: 'c3', author: 'ユーザーA', body: 'BGMが良くて一気見しました。' },
      { id: 'c4', author: 'ユーザーB', body: 'ラストの展開が予想外で鳥肌…！！！' },
      { id: 'c5', author: 'ユーザーC', body: '好きなシーン何回も見返した。' },
      { id: 'c6', author: 'ユーザーD', body: '第3話から急に加速して面白い。' },
      { id: 'c7', author: 'ユーザーE', body: 'キャストが豪華。' },
      { id: 'c8', author: 'ユーザーF', body: '次回が待ちきれない。' },
      { id: 'c9', author: 'ユーザーG', body: '短いのに満足感ある。' },
      { id: 'c10', author: 'ユーザーH', body: '伏線回収が楽しみ。' },
      { id: 'c11', author: 'ユーザーI', body: '51文字以上のコメントは省略される仕様なので長めに書いてみます。これはテスト用の文章です。' },
    ],
    []
  )

  const [commentTarget, setCommentTarget] = useState<
    | {
        workId: string
        workTitle: string
      }
    | null
  >(null)
  const [commentJustSubmitted, setCommentJustSubmitted] = useState(false)

  const [ownedCoins, setOwnedCoins] = useState<number>(20)

  const [coinGrantTarget, setCoinGrantTarget] = useState<{ id: string; name: string; roleLabel?: string } | null>(null)
  const [coinGrantPrimaryReturnTo, setCoinGrantPrimaryReturnTo] = useState<Screen>('mypage')
  const [coinGrantPrimaryLabel, setCoinGrantPrimaryLabel] = useState<string>('マイページへ戻る')
  const [coinGrantReasonLabel, setCoinGrantReasonLabel] = useState<string>('')
  const [coinGrantAmount, setCoinGrantAmount] = useState<number>(0)
  const [coinGrantAt, setCoinGrantAt] = useState<number>(0)
  const [coinGrantBalanceAfter, setCoinGrantBalanceAfter] = useState<number>(0)

  const [coinExchangePendingCoins, setCoinExchangePendingCoins] = useState<number>(0)
  const [coinExchangeLastCoinAmount, setCoinExchangeLastCoinAmount] = useState<number>(0)
  const [coinExchangeLastPointAmount, setCoinExchangeLastPointAmount] = useState<number>(0)

  const [purchasedTargets, setPurchasedTargets] = useState<Set<string>>(() => new Set())
  const [purchaseTarget, setPurchaseTarget] = useState<
    | {
        targetType: 'episode'
        targetId: string
        title: string
        requiredCoins: number
        contentTypeLabel: string
      }
    | null
  >(null)

  const [episodePurchaseDialog, setEpisodePurchaseDialog] = useState<
    | {
        episodeId: string
        title: string
        requiredCoins: number
      }
    | null
  >(null)
  const [episodePurchaseBusy, setEpisodePurchaseBusy] = useState(false)
  const [episodePurchaseError, setEpisodePurchaseError] = useState('')


  const purchaseEpisode = useCallback(
    async (episodeId: string, requiredCoins: number) => {
      const key = `episode:${episodeId}`
      if (purchasedTargets.has(key)) return
      if (ownedCoins < requiredCoins) throw new Error('コインが不足しています')
      await new Promise((r) => setTimeout(r, 400))
      setOwnedCoins((v) => v - requiredCoins)
      setPurchasedTargets((prev) => {
        const next = new Set(prev)
        next.add(key)
        return next
      })
    },
    [ownedCoins, purchasedTargets]
  )

  const confirmEpisodePurchase = useCallback(
    (opts: { episodeId: string; title: string; requiredCoins: number }) => {
      const { episodeId, title, requiredCoins } = opts
      const key = `episode:${episodeId}`
      if (purchasedTargets.has(key)) return

      setEpisodePurchaseError('')
      setEpisodePurchaseDialog({ episodeId, title, requiredCoins })
    },
    [purchasedTargets]
  )

  const truncateCommentBody = useCallback((value: string) => {
    const v = String(value ?? '')
    if (v.length <= 50) return v
    return `${v.slice(0, 50)}...`
  }, [])

  const commentStarRating = useCallback((c: { id: string; author: string; body: string }): number => {
    const seed = `${c.id}|${c.author}|${c.body}`
    let sum = 0
    for (let i = 0; i < seed.length; i++) sum = (sum + seed.charCodeAt(i) * (i + 1)) % 100000
    return (sum % 5) + 1
  }, [])

  const [loginEmail, setLoginEmail] = useState<string>('')
  const [loginPassword, setLoginPassword] = useState<string>('')
  const [loginFieldErrors, setLoginFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [loginBannerError, setLoginBannerError] = useState<string>('')

  const watchHistoryUserKey = useMemo(() => {
    const key = (loginEmail || registerEmail || '').trim().toLowerCase()
    return key || 'user'
  }, [loginEmail, registerEmail])

  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [phoneFieldError, setPhoneFieldError] = useState<string>('')
  const [phoneBannerError, setPhoneBannerError] = useState<string>('')

  const OTP_LENGTH = 6
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''))
  const [otpFieldError, setOtpFieldError] = useState<string>('')
  const [otpBannerError, setOtpBannerError] = useState<string>('')
  const otpRefs = useRef<Array<TextInput | null>>([])

  const checkHealth = useCallback(async () => {
    setError('')
    setApiBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/health`)
      const text = await res.text()
      setHealth(`${res.status} ${text}`)
    } catch (e) {
      setHealth('')
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApiBusy(false)
    }
  }, [apiBaseUrl])

  const fetchApprovedComments = useCallback(
    async (contentId: string) => {
      setCommentsBusy(true)
      setCommentsError('')
      try {
        const u = new URL(`${apiBaseUrl}/v1/comments`)
        u.searchParams.set('content_id', contentId)
        u.searchParams.set('limit', '50')
        const res = await fetch(u.toString())
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { items?: ApprovedComment[] }
        const items = Array.isArray(json.items) ? json.items : []
        setApprovedComments(items)
      } catch (e) {
        setApprovedComments([])
        setCommentsError(e instanceof Error ? e.message : String(e))
      } finally {
        setCommentsBusy(false)
      }
    },
    [apiBaseUrl]
  )

  const fetchWorkReviewSummary = useCallback(
    async (contentId: string) => {
      setWorkReviewError('')
      try {
        const u = new URL(`${apiBaseUrl}/v1/reviews/work`)
        u.searchParams.set('content_id', contentId)
        const res = await fetch(u.toString())
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json().catch(() => ({}))) as any
        const s = json?.summary
        const ratingAvg = Number(s?.ratingAvg)
        const reviewCount = Number(s?.reviewCount)
        if (!Number.isFinite(ratingAvg) || !Number.isFinite(reviewCount)) {
          throw new Error('Invalid response')
        }
        setWorkReviewSummary({ ratingAvg, reviewCount })
      } catch (e) {
        setWorkReviewSummary(null)
        setWorkReviewError(e instanceof Error ? e.message : String(e))
      }
    },
    [apiBaseUrl]
  )

  const fetchCastReviewSummary = useCallback(
    async (castId: string) => {
      setCastReviewError('')
      try {
        const u = new URL(`${apiBaseUrl}/v1/reviews/cast`)
        u.searchParams.set('cast_id', castId)
        const res = await fetch(u.toString())
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json().catch(() => ({}))) as any
        const s = json?.summary
        const ratingAvg = Number(s?.ratingAvg)
        const reviewCount = Number(s?.reviewCount)
        if (!Number.isFinite(ratingAvg) || !Number.isFinite(reviewCount)) {
          throw new Error('Invalid response')
        }
        setCastReviewSummary({ ratingAvg, reviewCount })
      } catch (e) {
        setCastReviewSummary(null)
        setCastReviewError(e instanceof Error ? e.message : String(e))
      }
    },
    [apiBaseUrl]
  )

  useEffect(() => {
    if (screen !== 'workDetail') return
    setCommentsExpanded(false)
    void fetchApprovedComments(workIdForDetail)
    void fetchWorkReviewSummary(workIdForDetail)
  }, [fetchApprovedComments, fetchWorkReviewSummary, screen, workIdForDetail])

  useEffect(() => {
    if (screen !== 'profile') return
    if (!selectedCast) {
      setSelectedCast({ id: mockProfile.id, name: mockProfile.name, roleLabel: '出演者' })
      return
    }
    void fetchCastReviewSummary(selectedCast.id)
  }, [fetchCastReviewSummary, mockProfile.id, mockProfile.name, screen, selectedCast])

  useEffect(() => {
    if (screen !== 'castReview') return
    if (selectedCast) return
    setSelectedCast({ id: mockProfile.id, name: mockProfile.name, roleLabel: '出演者' })
  }, [mockProfile.id, mockProfile.name, screen, selectedCast])

  const loadOshi = useCallback(async () => {
    setError('')
    setApiBusy(true)
    try {
      const res = await apiFetch(`${apiBaseUrl}/v1/oshi`)
      const json = (await res.json()) as { items: Oshi[] }
      setItems(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApiBusy(false)
    }
  }, [apiBaseUrl])

  const addOshi = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) return

    setError('')
    setApiBusy(true)
    try {
      const res = await apiFetch(`${apiBaseUrl}/v1/oshi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${text}`)
      }
      setName('')
      await loadOshi()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApiBusy(false)
    }
  }, [apiBaseUrl, loadOshi, name])

  useEffect(() => {
    void (async () => {
      await checkHealth()
      await loadOshi()
    })()
  }, [checkHealth, loadOshi])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const syncFromHash = () => {
      const raw = (window.location.hash || '').trim()
      const hashBody = raw.startsWith('#') ? raw.slice(1) : raw
      const queryIndex = hashBody.indexOf('?')
      const queryString = queryIndex >= 0 ? hashBody.slice(queryIndex + 1) : ''
      const params = new URLSearchParams(queryString)

      const next = webHashToScreen(window.location.hash)
      if (next === 'tutorial') {
        const parsed = parseTutorialIndexFromWebHash(window.location.hash)
        if (typeof parsed === 'number') setTutorialIndex(parsed)
      }

      // Deep link hydration for share URLs.
      if (next === 'workDetail') {
        const workId = (params.get('workId') || '').trim()
        if (workId) setSelectedWorkId(workId)
      }
      if (next === 'profile') {
        const castId = (params.get('castId') || '').trim()
        if (castId) {
          const title = (params.get('title') || '').trim()
          setSelectedCast({ id: castId, name: title || castId, roleLabel: '出演者' })
        }
      }

      setHistory([])
      setScreen(next)
    }

    if (!window.location.hash) {
      window.location.hash = screenToWebHash(WEB_DEFAULT_SCREEN)
    } else {
      syncFromHash()
    }

    window.addEventListener('hashchange', syncFromHash)
    return () => {
      window.removeEventListener('hashchange', syncFromHash)
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    document.title =
      screen === 'tutorial'
        ? screenToDocumentTitle(screen, { tutorialIndex, tutorialCount: TUTORIAL_SLIDE_COUNT })
        : screenToDocumentTitle(screen)
  }, [screen, tutorialIndex])

  const resetAuthErrors = useCallback(() => {
    setLoginFieldErrors({})
    setLoginBannerError('')
    setPhoneFieldError('')
    setPhoneBannerError('')
    setOtpFieldError('')
    setOtpBannerError('')
  }, [])

  const onCancel = useCallback(() => {
    resetAuthErrors()
    goBack()
  }, [goBack, resetAuthErrors])

  const canLoginNext = useMemo(() => {
    return isValidEmail(loginEmail) && loginPassword.trim().length > 0 && !authBusy
  }, [authBusy, loginEmail, loginPassword])

  const onLoginNext = useCallback(async () => {
    resetAuthErrors()
    const email = loginEmail.trim()
    const password = loginPassword

    const nextErrors: { email?: string; password?: string } = {}
    if (!email) nextErrors.email = 'メールアドレスを入力してください'
    else if (!isValidEmail(email)) nextErrors.email = 'メールアドレスの形式が正しくありません'
    if (!password.trim()) nextErrors.password = 'パスワードを入力してください'

    if (Object.keys(nextErrors).length > 0) {
      setLoginFieldErrors(nextErrors)
      return
    }

    setAuthBusy(true)
    try {
      if (debugAuthBypass) {
        await new Promise((r) => setTimeout(r, 250))
        if (email.toLowerCase() !== expectedLoginEmail || password !== expectedLoginPassword) {
          setLoginBannerError('メールアドレスまたはパスワードが正しくありません')
          return
        }
        goTo('phone')
        return
      }

      const res = await apiFetch(`${apiBaseUrl}/v1/auth/login/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json().catch(() => ({}))) as any
      if (!res.ok) {
        const code = String(data?.error ?? '')
        if (code === 'invalid_credentials') {
          setLoginBannerError('メールアドレスまたはパスワードが正しくありません')
        } else if (code === 'email_not_verified') {
          setLoginBannerError('メール認証が完了していません')
        } else {
          setLoginBannerError('ログインに失敗しました')
        }
        return
      }

      setAuthPendingToken(String(data.token ?? ''))
      setDebugSmsCode('')
      goTo('phone')
    } finally {
      setAuthBusy(false)
    }
  }, [apiBaseUrl, debugAuthBypass, expectedLoginEmail, expectedLoginPassword, goTo, loginEmail, loginPassword, resetAuthErrors])

  const normalizedPhoneDigits = useMemo(() => digitsOnly(phoneNumber), [phoneNumber])

  const canPhoneNext = useMemo(() => {
    const len = normalizedPhoneDigits.length
    return len >= 10 && len <= 20 && !authBusy
  }, [authBusy, normalizedPhoneDigits.length])

  const onPhoneNext = useCallback(async () => {
    resetAuthErrors()
    const digits = normalizedPhoneDigits
    if (!digits) {
      setPhoneFieldError('電話番号を入力してください')
      return
    }
    if (digits.length < 10 || digits.length > 20) {
      setPhoneFieldError('電話番号の桁数が正しくありません')
      return
    }

    setAuthBusy(true)
    try {
      let sentDebugCode = ''
      if (debugAuthBypass) {
        await new Promise((r) => setTimeout(r, 250))
        if (digits.endsWith('0000')) {
          setPhoneBannerError('SMSの送信に失敗しました。時間をおいて再度お試しください。')
          return
        }
      } else {
        if (!authPendingToken) {
          setPhoneBannerError('認証セッションが切れました。最初からやり直してください。')
          return
        }
        const res = await apiFetch(`${apiBaseUrl}/v1/auth/sms/send`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${authPendingToken}`,
          },
          body: JSON.stringify({ phone: digits }),
        })
        const data = (await res.json().catch(() => ({}))) as any
        if (!res.ok) {
          const code = String(data?.error ?? '')
          if (code === 'phone_mismatch') {
            setPhoneBannerError('登録済みの電話番号と一致しません')
          } else {
            setPhoneBannerError('SMSの送信に失敗しました。時間をおいて再度お試しください。')
          }
          return
        }
        const dbg = String(data?.debugCode ?? '')
        setDebugSmsCode(dbg)
        sentDebugCode = dbg
      }

      if (!debugAuthBypass && debugAuthAutofill && sentDebugCode) {
        setOtpDigits(sentDebugCode.slice(0, OTP_LENGTH).split(''))
      } else {
        setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ''))
      }
      goTo('otp')
      setTimeout(() => otpRefs.current[0]?.focus?.(), 50)
    } finally {
      setAuthBusy(false)
    }
  }, [OTP_LENGTH, apiBaseUrl, authPendingToken, debugAuthAutofill, debugAuthBypass, goTo, normalizedPhoneDigits, resetAuthErrors])

  const otpValue = useMemo(() => otpDigits.join(''), [otpDigits])
  const otpComplete = useMemo(() => otpValue.length === OTP_LENGTH && !otpValue.includes(''), [OTP_LENGTH, otpValue])
  const canOtpNext = useMemo(
    () => otpValue.length === OTP_LENGTH && otpDigits.every((d) => d.length === 1) && !authBusy,
    [OTP_LENGTH, authBusy, otpDigits, otpValue.length]
  )

  const setOtpAt = useCallback((index: number, value: string) => {
    const digit = digitsOnly(value).slice(-1)
    setOtpDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus?.()
    }
  }, [OTP_LENGTH])

  const onOtpKeyPress = useCallback((index: number, key: string) => {
    if (key !== 'Backspace') return
    setOtpDigits((prev) => {
      const next = [...prev]
      if (next[index]) {
        next[index] = ''
      } else if (index > 0) {
        next[index - 1] = ''
        setTimeout(() => otpRefs.current[index - 1]?.focus?.(), 0)
      }
      return next
    })
  }, [])

  const onOtpNext = useCallback(async () => {
    resetAuthErrors()
    const code = otpDigits.join('')
    if (!otpDigits.every((d) => d.length === 1)) {
      setOtpFieldError('認証コードを入力してください')
      return
    }

    setAuthBusy(true)
    try {
      if (debugAuthBypass) {
        await new Promise((r) => setTimeout(r, 250))
        if (code === '000000') {
          setOtpBannerError('認証コードが正しくありません')
          return
        }
      } else {
        if (!authPendingToken) {
          setOtpBannerError('認証セッションが切れました。最初からやり直してください。')
          return
        }
        const res = await apiFetch(`${apiBaseUrl}/v1/auth/sms/verify`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${authPendingToken}`,
          },
          body: JSON.stringify({ phone: normalizedPhoneDigits, code }),
        })
        const data = (await res.json().catch(() => ({}))) as any
        if (!res.ok) {
          setOtpBannerError('認証コードが正しくありません')
          return
        }
        const token = String(data?.token ?? '')
        if (token) {
          setAuthToken(token)
          await setString(AUTH_TOKEN_KEY, token)
        }
        setAuthPendingToken('')
      }

      setLoggedIn(true)
      setHistory([])
      setScreen(postLoginTarget ?? 'home')
      setPostLoginTarget(null)
    } finally {
      setAuthBusy(false)
    }
  }, [apiBaseUrl, authPendingToken, debugAuthBypass, normalizedPhoneDigits, otpDigits, postLoginTarget, resetAuthErrors])

  // Show IP gate if IP restriction is enabled and checks are needed
  if (ipRestrictionEnabled) {
    if (ipLoading) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <ScreenContainer title="IP確認中">
            <View style={styles.ipGate}>
              <ActivityIndicator />
              <Text style={styles.ipGateText}>アクセス元IPを確認しています…</Text>
            </View>
          </ScreenContainer>
        </SafeAreaView>
      )
    }

    if (!ipAllowed) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <ScreenContainer title="Access Denied">
            <View style={styles.ipGate}>
              <Text style={styles.ipGateTitle}>このIPは許可されていません</Text>
              <Text style={styles.ipGateText}>許可IPに追加してください。</Text>
              <View style={styles.ipGateBox}>
                <Text style={styles.ipGateMono}>IP: {ipInfo?.ip || '(unknown)'}</Text>
                {ipInfo?.city || ipInfo?.region || ipInfo?.country ? (
                  <Text style={styles.ipGateMono}>
                    {ipInfo?.country || ''} {ipInfo?.region || ''} {ipInfo?.city || ''}
                  </Text>
                ) : null}
                {ipError ? <Text style={styles.ipGateError}>{ipError}</Text> : null}
              </View>
              <SecondaryButton label="再取得" onPress={refetchIp} />
            </View>
          </ScreenContainer>
        </SafeAreaView>
      )
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {screen === 'splash' ? (
        <SplashScreen
          videoUri="https://assets.oshidra.com/oshidora-splash.mp4"
          maxDurationMs={3000}
          onDone={() => {
            goTo('welcome')
          }}
        />
      ) : null}

      {screen === 'welcome' ? (
        <WelcomeTopScreen
          onLogin={() => goTo('login')}
          onStart={() => {
            setTutorialIndex(0)
            goTo('tutorial')
          }}
        />
      ) : null}

      {screen === 'tutorial' ? (
        <TutorialScreen
          initialIndex={tutorialIndex}
          onIndexChange={onTutorialIndexChange}
          onBack={goBack}
          onSkip={() => {
            void setBoolean(TUTORIAL_SEEN_KEY, true)
            setTermsReadOnly(false)
            goTo('terms')
          }}
          onDone={() => {
            void setBoolean(TUTORIAL_SEEN_KEY, true)
            setTermsReadOnly(false)
            goTo('terms')
          }}
        />
      ) : null}

      {screen === 'terms' ? (
        <TermsScreen
          onBack={goBack}
          onAgreeRegister={() => goTo('signup')}
          onOpenPrivacyPolicy={() => goTo('privacy')}
          readOnly={termsReadOnly}
        />
      ) : null}

      {screen === 'privacy' ? (
        <PrivacyPolicyScreen onBack={goBack} />
      ) : null}

      {screen === 'login' ? (
        <ScreenContainer title="ログイン">
          <View style={styles.authCenter}>
            <View style={styles.authContent}>
              <View style={styles.authTop}>
                <View style={styles.authLogoWrap}>
                  <Image
                    source={require('./assets/oshidora-logo.png')}
                    style={styles.authLogo}
                    resizeMode="contain"
                  />
                </View>

                {loginBannerError ? <Text style={styles.bannerError}>{loginBannerError}</Text> : null}

                <View style={styles.field}>
                  <TextInput
                    value={loginEmail}
                    onChangeText={(v) => setLoginEmail(v)}
                    placeholder="メールアドレス"
                    placeholderTextColor={THEME.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={[styles.input, loginFieldErrors.email ? styles.inputError : null]}
                  />
                  {loginFieldErrors.email ? <Text style={styles.fieldError}>{loginFieldErrors.email}</Text> : null}
                </View>

                <View style={styles.field}>
                  <TextInput
                    value={loginPassword}
                    onChangeText={(v) => setLoginPassword(v)}
                    placeholder="パスワード"
                    placeholderTextColor={THEME.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    style={[styles.input, loginFieldErrors.password ? styles.inputError : null]}
                  />
                  {loginFieldErrors.password ? (
                    <Text style={styles.fieldError}>{loginFieldErrors.password}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.authBottom}>
                <View style={styles.buttons}>
                  <View style={styles.buttonRow}>
                    <SecondaryButton label="キャンセル" onPress={onCancel} disabled={authBusy} />
                    <View style={styles.spacer} />
                    <PrimaryButton label="次へ" onPress={onLoginNext} disabled={!canLoginNext} fullWidth={false} />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'signup' ? (
        <SignupScreen
          onBack={goBack}
          onLogin={() => goTo('login')}
          onSendCode={async (email, password) => {
            setRegisterEmail(email)
            setRegisterPassword(password)
            if (debugAuthBypass) {
              await new Promise((r) => setTimeout(r, 250))
              if (email.toLowerCase().endsWith('@fail.example')) {
                throw new Error('認証コードの送信に失敗しました')
              }
              setDebugEmailCode('')
            } else {
              const res = await apiFetch(`${apiBaseUrl}/v1/auth/signup/start`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email, password }),
              })
              const data = (await res.json().catch(() => ({}))) as any
              if (!res.ok) {
                const code = String(data?.error ?? '')
                if (code === 'already_registered') throw new Error('すでに登録済みのメールアドレスです')
                throw new Error('認証コードの送信に失敗しました')
              }
              const dbg = String(data?.debugCode ?? '')
              setDebugEmailCode(dbg)
            }
            goTo('emailVerify')
          }}
        />
      ) : null}

      {screen === 'emailVerify' ? (
        <EmailVerifyScreen
          email={registerEmail}
          onBack={goBack}
          initialCode={!debugAuthBypass && debugAuthAutofill ? debugEmailCode : undefined}
          onResend={async () => {
            if (!registerEmail) throw new Error('メールアドレスが不明です')
            if (debugAuthBypass) {
              await new Promise((r) => setTimeout(r, 250))
              return
            }
            const res = await apiFetch(`${apiBaseUrl}/v1/auth/signup/email/resend`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email: registerEmail }),
            })
            const data = (await res.json().catch(() => ({}))) as any
            if (!res.ok) throw new Error('認証コードの再送に失敗しました')
            setDebugEmailCode(String(data?.debugCode ?? ''))
          }}
          onVerify={async (code) => {
            if (debugAuthBypass) {
              await new Promise((r) => setTimeout(r, 250))
              if (code === '000000') throw new Error('認証コードが正しくありません')
            } else {
              const res = await apiFetch(`${apiBaseUrl}/v1/auth/signup/email/verify`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email: registerEmail, code }),
              })
              const data = (await res.json().catch(() => ({}))) as any
              if (!res.ok) {
                throw new Error('認証コードが正しくありません')
              }
              setAuthPendingToken(String(data?.token ?? ''))
            }
            goTo('sms2fa')
          }}
        />
      ) : null}

      {screen === 'sms2fa' ? (
        <Sms2faScreen
          onBack={goBack}
          initialCode={!debugAuthBypass && debugAuthAutofill ? debugSmsCode : undefined}
          onSendCode={async (phone) => {
            if (debugAuthBypass) {
              await new Promise((r) => setTimeout(r, 250))
              return
            }
            if (!authPendingToken) throw new Error('認証セッションが切れました')
            const res = await apiFetch(`${apiBaseUrl}/v1/auth/sms/send`, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${authPendingToken}`,
              },
              body: JSON.stringify({ phone }),
            })
            const data = (await res.json().catch(() => ({}))) as any
            if (!res.ok) throw new Error('SMSの送信に失敗しました')
            setDebugSmsCode(String(data?.debugCode ?? ''))
          }}
          onVerifyCode={async (phone, code) => {
            if (debugAuthBypass) {
              await new Promise((r) => setTimeout(r, 250))
              if (code === '0000') throw new Error('認証コードが正しくありません')
              return
            }
            if (!authPendingToken) throw new Error('認証セッションが切れました')
            const res = await apiFetch(`${apiBaseUrl}/v1/auth/sms/verify`, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${authPendingToken}`,
              },
              body: JSON.stringify({ phone, code }),
            })
            const data = (await res.json().catch(() => ({}))) as any
            if (!res.ok) throw new Error('認証コードが正しくありません')
            const token = String(data?.token ?? '')
            if (token) {
              setAuthToken(token)
              await setString(AUTH_TOKEN_KEY, token)
            }
            setAuthPendingToken('')
          }}
          onComplete={(phone) => {
            setRegisterPhone(phone)
            goTo('profileRegister')
          }}
        />
      ) : null}

      {screen === 'profileRegister' ? (
        <UserProfileEditScreen
          apiBaseUrl={apiBaseUrl}
          isNewRegistration={true}
          onBack={goBack}
          initialEmail={registerEmail}
          initialPhone={registerPhone}
          onSave={async (opts) => {
            setUserProfile({
              displayName: opts.displayName,
              email: opts.email,
              phone: opts.phone,
              birthDate: opts.birthDate,
              avatarUrl: opts.avatarUrl,
            })
            goTo('registerComplete')
          }}
        />
      ) : null}

      {screen === 'registerComplete' ? (
        <RegisterCompleteScreen
          onGoVideos={() => {
            setLoggedIn(true)
            setHistory([])
            setScreen(postLoginTarget ?? 'home')
            setPostLoginTarget(null)
          }}
        />
      ) : null}

      {screen === 'videoList' ? (
        <VideoListScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenVideo={(id) => openWorkDetail(id)}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          tag={videoListTag}
          onChangeTag={setVideoListTag}
        />
      ) : null}

      {screen === 'home' ? (
        <TopScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenVideo={(id) => openWorkDetail(id)}
          onOpenRanking={() => goTo('ranking')}
          onOpenFavorites={() => goTo('favorites')}
          onOpenNotice={() => goTo('notice')}
        />
      ) : null}

      {screen === 'cast' ? (
        <CastSearchScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          onOpenProfile={(cast) => {
            if (!requireLogin('profile')) return
            setSelectedCast({ id: cast.id, name: cast.name, roleLabel: cast.role })
            goTo('profile')
          }}
          onOpenResults={(keyword) => {
            setCastSearchKeyword(keyword)
            goTo('castSearchResult')
          }}
        />
      ) : null}

      {screen === 'castSearchResult' ? (
        <CastSearchResultScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          keyword={castSearchKeyword}
          onBack={() => {
            goBack()
          }}
          onOpenProfile={(cast) => {
            if (!requireLogin('profile')) return
            setSelectedCast({ id: cast.id, name: cast.name, roleLabel: cast.role })
            goTo('profile')
          }}
        />
      ) : null}

      {screen === 'search' ? (
        <VideoSearchScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          onOpenVideo={(id) => openWorkDetail(id)}
          onOpenProfile={(cast) => {
            if (!requireLogin('profile')) return
            setSelectedCast({ id: cast.id, name: cast.name, roleLabel: cast.role })
            goTo('profile')
          }}
        />
      ) : null}

      {screen === 'work' ? (
        <WorkSearchScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          onOpenVideo={(id) => openWorkDetail(id)}
        />
      ) : null}

      {screen === 'mypage' ? (
        <MyPageScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          loggedIn={loggedIn}
          userEmail={loginEmail || registerEmail}
          userType={debugUserType}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          onNavigate={(screenKey) => {
            if (screenKey === 'coinPurchase') {
              setCoinGrantPrimaryReturnTo('mypage')
              setCoinGrantPrimaryLabel('マイページへ戻る')
            }
            if (screenKey === 'terms') {
              setTermsReadOnly(true)
            }
            goTo(screenKey as Screen)
          }}
        />
      ) : null}

      {screen === 'coinExchangeDest' ? (
        <CoinExchangeDestScreen
          ownedCoins={ownedCoins}
          exchangeableCoins={Math.max(0, ownedCoins - coinExchangePendingCoins)}
          paypayLinked={debugPaypayLinked}
          paypayMaskedLabel={debugPaypayMaskedLabel}
          onBack={goBack}
          onCancel={() => {
            setHistory([])
            setScreen('mypage')
          }}
          onLinkPaypay={async () => {
            await new Promise((r) => setTimeout(r, 350))
            setDebugPaypayLinked(true)
          }}
          onUnlinkPaypay={async () => {
            await new Promise((r) => setTimeout(r, 350))
            setDebugPaypayLinked(false)
          }}
          onNext={() => {
            goTo('coinExchangePayPay')
          }}
        />
      ) : null}

      {screen === 'coinExchangePayPay' ? (
        <CoinExchangePayPayScreen
          ownedCoins={ownedCoins}
          exchangeableCoins={Math.max(0, ownedCoins - coinExchangePendingCoins)}
          pendingCoins={coinExchangePendingCoins}
          paypayLinked={debugPaypayLinked}
          paypayMaskedLabel={debugPaypayMaskedLabel}
          onBack={goBack}
          onCancel={() => {
            setHistory([])
            setScreen('mypage')
          }}
          onChangeLink={() => {
            goTo('coinExchangeDest')
          }}
          onSubmit={async ({ coinAmount, pointAmount }) => {
            // NOTE: APIが整備されるまではモック。
            await new Promise((r) => setTimeout(r, 400))
            setCoinExchangePendingCoins(coinAmount)
            setCoinExchangeLastCoinAmount(coinAmount)
            setCoinExchangeLastPointAmount(pointAmount)
            goTo('coinExchangeComplete')
          }}
        />
      ) : null}

      {screen === 'coinExchangeComplete' ? (
        <CoinExchangeCompleteScreen
          coinAmount={coinExchangeLastCoinAmount}
          pointAmount={coinExchangeLastPointAmount}
          paypayMaskedLabel={debugPaypayMaskedLabel}
          onDone={() => {
            setHistory([])
            setScreen('mypage')
          }}
        />
      ) : null}

      {screen === 'castProfileRegister' ? (
        <CastProfileRegisterScreen
          apiBaseUrl={apiBaseUrl}
          onBack={goBack}
        />
      ) : null}

      {screen === 'profileEdit' ? (
        <UserProfileEditScreen
          apiBaseUrl={apiBaseUrl}
          onBack={goBack}
          initialDisplayName={userProfile.displayName}
          initialEmail={userProfile.email || loginEmail || registerEmail}
          initialPhone={userProfile.phone}
          initialBirthDate={userProfile.birthDate}
          initialAvatarUrl={userProfile.avatarUrl ?? ''}
          onSave={async (opts) => {
            setUserProfile({
              displayName: opts.displayName,
              email: opts.email,
              phone: opts.phone,
              birthDate: opts.birthDate,
              avatarUrl: opts.avatarUrl,
            })
            console.log('Profile saved:', opts)
            goBack()
          }}
        />
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen
          onBack={goBack}
          onGoLogout={() => {
            goTo('logout')
          }}
          onOpenWithdraw={() => {
            if (!requireLogin('withdrawalRequest')) return
            goTo('withdrawalRequest')
          }}
        />
      ) : null}

      {screen === 'withdrawalRequest' ? (
        <WithdrawalRequestScreen
          apiBaseUrl={apiBaseUrl}
          authToken={authToken}
          initialEmail={(userProfile.email || loginEmail || registerEmail || '').trim()}
          onBack={goBack}
          onDone={() => {
            goTo('settings')
          }}
        />
      ) : null}

      {screen === 'faq' ? (
        <FaqScreen onBack={goBack} />
      ) : null}

      {screen === 'contact' ? (
        <ContactScreen
          apiBaseUrl={apiBaseUrl}
          displayName={userProfile.displayName || 'ユーザー'}
          email={(userProfile.email || loginEmail || registerEmail || '').trim()}
          onBack={goBack}
          onGoFaq={() => goTo('faq')}
          onDone={() => goTo('mypage')}
        />
      ) : null}

      {screen === 'logout' ? (
        <LogoutScreen
          onCancel={goBack}
          onLogout={async () => {
            await setLoggedInState(false)
            setHistory([])
            setScreen('splash')
          }}
          onGoLogin={() => {
            setHistory([])
            setScreen('splash')
          }}
        />
      ) : null}

      {screen === 'ranking' ? (
        <ScreenContainer title="ランキング一覧" onBack={goBack}>
          <Text style={styles.centerText}>ランキング一覧（モック）</Text>
        </ScreenContainer>
      ) : null}

      {screen === 'favorites' ? (
        <FavoritesSelectScreen
          onBack={goBack}
          onSelectVideos={() => goTo('favoriteVideos')}
          onSelectCasts={() => goTo('favoriteCasts')}
        />
      ) : null}

      {screen === 'favoriteVideos' ? (
        <FavoriteVideosScreen
          apiBaseUrl={apiBaseUrl}
          onBack={goBack}
          onOpenVideo={(id) => {
            openWorkDetail(id)
          }}
        />
      ) : null}

      {screen === 'favoriteCasts' ? (
        <FavoriteCastsScreen
          apiBaseUrl={apiBaseUrl}
          authToken={authToken}
          loggedIn={loggedIn || debugAuthBypass}
          onBack={goBack}
          onEdit={() => goTo('favoriteCastsEdit')}
          onOpenProfile={(cast) => {
            if (!requireLogin('profile')) return
            setSelectedCast({ id: cast.id, name: cast.name, roleLabel: cast.role })
            goTo('profile')
          }}
        />
      ) : null}

      {screen === 'favoriteCastsEdit' ? (
        <FavoriteCastsEditScreen
          apiBaseUrl={apiBaseUrl}
          authToken={authToken}
          loggedIn={loggedIn || debugAuthBypass}
          onCancel={goBack}
          onDone={goBack}
        />
      ) : null}

      {screen === 'watchHistory' ? (
        <VideoWatchHistoryScreen
          userKey={watchHistoryUserKey}
          onBack={goBack}
          onOpenVideo={(contentId) => openWorkDetail(contentId)}
          onGoVideos={() => {
            setHistory([])
            setScreen('videoList')
          }}
        />
      ) : null}

      {screen === 'notice' ? (
        <NoticeListScreen
          apiBaseUrl={apiBaseUrl}
          loggedIn={loggedIn || debugAuthBypass}
          onBack={goBack}
          onOpenDetail={(id) => {
            setSelectedNoticeId(id)
            goTo('noticeDetail')
          }}
        />
      ) : null}

      {screen === 'noticeDetail' ? (
        <NoticeDetailScreen
          apiBaseUrl={apiBaseUrl}
          noticeId={selectedNoticeId}
          onBack={goBack}
        />
      ) : null}

      {screen === 'phone' ? (
        <ScreenContainer title="SMS認証" onBack={goBack}>

          {phoneBannerError ? <Text style={styles.bannerError}>{phoneBannerError}</Text> : null}

          <View style={styles.field}>
            <TextInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="電話番号"
              keyboardType="phone-pad"
              autoCapitalize="none"
              style={[styles.input, phoneFieldError ? styles.inputError : null]}
            />
            {phoneFieldError ? <Text style={styles.fieldError}>{phoneFieldError}</Text> : null}
          </View>

          <View style={styles.buttons}>
            <View style={styles.buttonRow}>
              <SecondaryButton label="キャンセル" onPress={onCancel} disabled={authBusy} />
              <View style={styles.spacer} />
              <PrimaryButton label="次へ" onPress={onPhoneNext} disabled={!canPhoneNext} fullWidth={false} />
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'otp' ? (
        <ScreenContainer title="2段階認証" onBack={goBack}>
          <Text style={styles.centerText}>電話番号(SMS)に送信された認証コードを入力して下さい</Text>

          {otpBannerError ? <Text style={styles.bannerError}>{otpBannerError}</Text> : null}

          <View style={styles.otpRow}>
            {otpDigits.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(el) => {
                  otpRefs.current[idx] = el
                }}
                value={digit}
                onChangeText={(v) => setOtpAt(idx, v)}
                onKeyPress={({ nativeEvent }) => onOtpKeyPress(idx, nativeEvent.key)}
                keyboardType="number-pad"
                autoCapitalize="none"
                maxLength={1}
                style={[styles.otpInput, otpFieldError ? styles.inputError : null]}
              />
            ))}
          </View>

          {otpFieldError ? <Text style={styles.fieldErrorCenter}>{otpFieldError}</Text> : null}

          <View style={styles.buttons}>
            <View style={styles.buttonRow}>
              <SecondaryButton label="キャンセル" onPress={onCancel} disabled={authBusy} />
              <View style={styles.spacer} />
              <PrimaryButton label="次へ" onPress={onOtpNext} disabled={!canOtpNext} fullWidth={false} />
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'top' ? (
        <ScreenContainer title="推しドラ">
          <View style={styles.header}>
            <Text style={styles.sub}>API: {apiBaseUrl}</Text>
            {health ? <Text style={styles.sub}>Health: {health}</Text> : null}
            {error ? <Text style={styles.error}>Error: {error}</Text> : null}
            {!loggedIn ? (
              <View style={styles.topLoginRow}>
                <PrimaryButton label="ログイン" onPress={() => goTo('login')} />
              </View>
            ) : null}
            <View style={styles.topNavRow}>
              <SecondaryButton label="プロフィール(ワイヤー)" onPress={() => goTo('profile')} />
              <View style={styles.spacer} />
              <SecondaryButton label="作品詳細(ワイヤー)" onPress={() => goTo('workDetail')} />
              <View style={styles.spacer} />
              <SecondaryButton label="Developer" onPress={() => goTo('dev')} />
            </View>
          </View>

          <View style={styles.row}>
            <SecondaryButton label="Health" onPress={checkHealth} />
            <View style={styles.spacer} />
            <SecondaryButton label="Reload" onPress={loadOshi} />
          </View>

          <View style={styles.header}>
            <Text style={styles.sub}>Components</Text>
            <Text style={styles.sub}>PaginationDots: {debugDotsIndex + 1}/5</Text>
          </View>
          <PaginationDots count={5} index={debugDotsIndex} onChange={setDebugDotsIndex} />

          <View style={styles.header}>
            <Text style={styles.sub}>Slideshow: {debugSlideIndex + 1}/3</Text>
          </View>
          <Slideshow
            images={[
              require('./assets/tutorial0.png'),
              require('./assets/tutorial1.png'),
              require('./assets/tutorial2.png'),
            ]}
            height={220}
            index={debugSlideIndex}
            onIndexChange={setDebugSlideIndex}
            resizeMode="cover"
          />

          <View style={styles.row}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="推しの名前"
              placeholderTextColor={THEME.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.spacer} />
            <PrimaryButton
              label="Add"
              onPress={addOshi}
              disabled={apiBusy || name.trim().length === 0}
              fullWidth={false}
            />
          </View>

          {apiBusy ? <ActivityIndicator style={styles.loading} /> : null}

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.item}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>{item.created_at}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.sub}>まだ登録がありません</Text>}
          />
        </ScreenContainer>
      ) : null}

      {screen === 'dev' ? (
        <DeveloperMenuScreen
          onBack={goBack}
          onGo={(key) => {
            goTo(key as Screen)
          }}
          loggedIn={loggedIn}
          onLoginToggle={() => {
            void setLoggedInState(!loggedIn)
          }}
          userType={debugUserType}
          onUserTypeToggle={toggleDebugUserType}
          mock={debugMock}
          onMockToggle={() => setDebugMock((v) => !v)}
        />
      ) : null}

      {screen === 'profile' ? (
        <ScreenContainer title="プロフィール" onBack={goBack} scroll>

          <View style={styles.heroImage}>
            <View style={styles.heroPlaceholder} />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.h1}>{selectedCast?.name ?? mockProfile.name}</Text>
            <Text style={styles.h2}>{mockProfile.affiliation || '—'}</Text>
          </View>

          <View style={styles.chipsWrap}>
            {mockProfile.genre.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              ★ {castReviewSummary ? castReviewSummary.ratingAvg.toFixed(1) : selectedCastReview ? selectedCastReview.rating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>
              {castReviewSummary ? `${castReviewSummary.reviewCount}件` : selectedCastReview ? '1件' : '0件'}
            </Text>
          </View>

          {castReviewError ? <Text style={styles.loadNote}>評価取得に失敗しました（モック表示）</Text> : null}

          <View style={styles.actionsRow}>
            <IconButton
              label="↗"
              onPress={async () => {
                if (!requireLogin('profile')) return
                const castId = selectedCast?.id ?? mockProfile.id
                const castName = selectedCast?.name ?? mockProfile.name
                const url = shareUrlForCast(castId, castName)
                const message = `${castName}\n${url}`

                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  const nav: any = (window as any).navigator
                  if (nav?.share) {
                    try {
                      await nav.share({ title: castName, text: message, url })
                      return
                    } catch {
                      // fallthrough
                    }
                  }
                  window.open(url, '_blank', 'noopener,noreferrer')
                  return
                }

                try {
                  const ShareLib = (await import('react-native-share')).default as any
                  await ShareLib.open({ title: castName, message, url })
                } catch {
                  const { Share } = await import('react-native')
                  await Share.share({ message, url })
                }
              }}
            />
            <View style={styles.spacer} />
            <IconButton
              label="★"
              onPress={() => {
                if (!requireLogin('castReview')) return
                if (!selectedCast) {
                  setSelectedCast({ id: mockProfile.id, name: mockProfile.name, roleLabel: '出演者' })
                }
                goTo('castReview')
              }}
            />
          </View>

          <PrimaryButton
            label="推しポイントを付与する"
            onPress={() => {
              if (!requireLogin('coinGrant')) return
              const castId = selectedCast?.id ?? mockProfile.id
              const castName = selectedCast?.name ?? mockProfile.name
              setCoinGrantTarget({ id: castId, name: castName, roleLabel: selectedCast?.roleLabel })
              setCoinGrantPrimaryReturnTo('profile')
              setCoinGrantPrimaryLabel('プロフィールへ戻る')
              goTo('coinGrant')
            }}
          />

          <Section title="経歴">
            <Text style={styles.bodyText}>{mockProfile.biography || '—'}</Text>
          </Section>

          <Section title="代表作">
            <Text style={styles.bodyText}>{mockProfile.worksText || '—'}</Text>
          </Section>

          <Section title="自己PR">
            <Text style={styles.bodyText}>{mockProfile.selfPr || '—'}</Text>
          </Section>

          <Section title="SNS">
            {mockProfile.snsLinks.length === 0 ? (
              <Text style={styles.bodyText}>—</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {mockProfile.snsLinks.map((l) => (
                  <Pressable
                    key={l.label}
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.open(l.url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: THEME.outline, backgroundColor: THEME.card }}
                  >
                    <Text style={{ color: THEME.text, fontSize: 12, fontWeight: '800' }}>{l.label}</Text>
                    <Text style={{ color: THEME.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{l.url}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Section>
        </ScreenContainer>
      ) : null}

      {screen === 'castReview' && selectedCast ? (
        <StaffCastReviewScreen
          onBack={goBack}
          cast={{ id: selectedCast.id, name: selectedCast.name, roleLabel: selectedCast.roleLabel, profileImageUrl: null }}
          initial={{ rating: selectedCastReview?.rating ?? null, comment: selectedCastReview?.comment ?? null }}
          onSubmit={async ({ castId, rating, comment }) => {
            try {
              const res = await apiFetch(`${apiBaseUrl}/v1/reviews/cast`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ castId, rating, comment }),
              })
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              void fetchCastReviewSummary(castId)
            } catch {
              // Fallback: local mock update
              await new Promise((r) => setTimeout(r, 300))
              setCastReviews((prev) => ({
                ...prev,
                [castId]: { rating, comment, updatedAt: Date.now() },
              }))
            }
          }}
          onDone={() => {
            goTo('profile')
          }}
        />
      ) : null}

      {screen === 'castReview' && !selectedCast ? (
        <ScreenContainer title="評価" onBack={goBack}>
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
            <Text style={styles.centerText}>対象のキャスト／スタッフが未選択です。{`\n`}プロフィールから「★」を押して開いてください。</Text>
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
              <SecondaryButton label="Developer" onPress={() => goTo('dev')} />
              <PrimaryButton label="ホームへ" onPress={() => goTo('home')} />
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'workDetail' ? (
        <ScreenContainer
          title="作品詳細"
          onBack={goBack}
          headerRight={loggedIn ? <NoticeBellButton onPress={() => goTo('notice')} /> : undefined}
          footer={<TabBar active="video" onPress={switchTab} />}
          footerPaddingHorizontal={0}
          scroll
          maxWidth={828}
        >

          <View style={styles.heroImage}>
            <Pressable
              onPress={() => {
                void upsertWatchHistory(watchHistoryUserKey, {
                  id: `content:${workIdForDetail}`,
                  contentId: workIdForDetail,
                  title: workForDetail.title,
                  kind: '映画',
                  durationSeconds: 25 * 60,
                  thumbnailUrl: `https://videodelivery.net/${encodeURIComponent(streamSampleVideoId)}/thumbnails/thumbnail.jpg?time=1s`,
                  lastPlayedAt: Date.now(),
                })
                setPlayerVideoIdNoSub(streamSampleVideoId)
                setPlayerVideoIdWithSub(null)
                goTo('videoPlayer')
              }}
              style={StyleSheet.absoluteFill}
            >
              <View style={styles.heroPlaceholder}>
                <View style={styles.playBadge}>
                  <Text style={styles.playBadgeText}>▶ 再生</Text>
                </View>
              </View>
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.h1}>{workForDetail.title || '—'}</Text>
            <Text style={styles.h2}>{workForDetail.subtitle || '—'}</Text>
          </View>

          <View style={styles.chipsWrap}>
            {workForDetail.tags.map((t) => (
              <Chip
                key={t}
                label={t}
                onPress={() => {
                  setVideoListTag(t)
                  goTo('videoList')
                }}
              />
            ))}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>★ {(workReviewSummary ? workReviewSummary.ratingAvg : workForDetail.rating).toFixed(1)}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{workReviewSummary ? workReviewSummary.reviewCount : workForDetail.reviews} reviews</Text>
          </View>

          {workReviewError ? <Text style={styles.loadNote}>評価取得に失敗しました（モック表示）</Text> : null}

          <Section title="ストーリー">
            <Text style={styles.bodyText}>{workForDetail.story || '—'}</Text>
          </Section>

          <View style={styles.actionsRow}>
            <IconButton label="♡" onPress={() => {}} />
            <View style={styles.spacer} />
            <IconButton
              label="☆"
              onPress={() => {
                if (!requireLogin('workDetail')) return
                setWorkReviewTarget({ id: workIdForDetail, title: workForDetail.title, subtitle: workForDetail.subtitle })
                goTo('workReview')
              }}
            />
            <View style={styles.spacer} />
            <IconButton
              label="↗"
              onPress={async () => {
                const url = shareUrlForWork(workIdForDetail, playerVideoIdNoSub, workForDetail.title)
                const title = workForDetail.title
                const message = `${title}\n${url}`

                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  const nav: any = (window as any).navigator
                  if (nav?.share) {
                    try {
                      await nav.share({ title, text: message, url })
                      return
                    } catch {
                      // fallthrough
                    }
                  }
                  window.open(url, '_blank', 'noopener,noreferrer')
                  return
                }

                try {
                  const ShareLib = (await import('react-native-share')).default as any
                  await ShareLib.open({ title, message, url })
                } catch {
                  const { Share } = await import('react-native')
                  await Share.share({ message, url })
                }
              }}
            />
          </View>
          <PrimaryButton
            label="本編を再生する"
            onPress={() => {
              void upsertWatchHistory(watchHistoryUserKey, {
                id: `content:${workIdForDetail}`,
                contentId: workIdForDetail,
                title: workForDetail.title,
                kind: '映画',
                durationSeconds: 25 * 60,
                thumbnailUrl: `https://videodelivery.net/${encodeURIComponent(streamSampleVideoId)}/thumbnails/thumbnail.jpg?time=1s`,
                lastPlayedAt: Date.now(),
              })
              setPlayerVideoIdNoSub(streamSampleVideoId)
              setPlayerVideoIdWithSub(null)
              goTo('videoPlayer')
            }}
          />

          <Section title="エピソード">
            {workForDetail.episodes.length === 0 ? (
              <Text style={styles.emptyText}>空です</Text>
            ) : (
              workForDetail.episodes.map((e) => (
                (() => {
                  const key = `episode:${e.id}`
                  const requiredCoins = typeof (e as any).priceCoin === 'number' ? (e as any).priceCoin : 0
                  const purchased = purchasedTargets.has(key)
                  const isPaid = requiredCoins > 0
                  const action = isPaid && !purchased ? '購入' : '再生'

                  return (
                <RowItem
                  key={e.id}
                  title={`${e.id} ${e.title}`}
                  actionLabel={action}
                  onAction={() => {
                    if (isPaid && !purchased) {
                      confirmEpisodePurchase({
                        episodeId: e.id,
                        title: `${workForDetail.title} ${e.title}`,
                        requiredCoins,
                      })
                      return
                    }
                    void upsertWatchHistory(watchHistoryUserKey, {
                      id: `content:${workIdForDetail}:episode:${e.id}`,
                      contentId: workIdForDetail,
                      title: `${workForDetail.title} ${e.title}`,
                      kind: 'エピソード',
                      durationSeconds: 10 * 60,
                      thumbnailUrl: `https://videodelivery.net/${encodeURIComponent(streamSampleVideoId)}/thumbnails/thumbnail.jpg?time=1s`,
                      lastPlayedAt: Date.now(),
                    })
                    setPlayerVideoIdNoSub(streamSampleVideoId)
                    setPlayerVideoIdWithSub(null)
                    goTo('videoPlayer')
                  }}
                />
                  )
                })()
              ))
            )}
          </Section>

          <Section title="出演者・スタッフ">
            {workForDetail.staff.length === 0 ? (
              <Text style={styles.emptyText}>空です</Text>
            ) : (
              workForDetail.staff.map((s, idx) => (
                <RowItem
                  key={`${s.role}-${idx}`}
                  title={`${s.role}：${s.name}`}
                  actionLabel="詳しく"
                  secondaryActionLabel="推しポイント付与"
                  secondaryActionDisabled={!resolveCastAccountIdByName(s.name)}
                  onSecondaryAction={() => {
                    const accountId = resolveCastAccountIdByName(s.name)
                    if (!accountId) return
                    if (!requireLogin('coinGrant')) return
                    setCoinGrantTarget({ id: accountId, name: s.name, roleLabel: s.role })
                    setCoinGrantPrimaryReturnTo('workDetail')
                    setCoinGrantPrimaryLabel('作品詳細へ戻る')
                    goTo('coinGrant')
                  }}
                  onAction={() => {
                    if (!requireLogin('profile')) return
                    setSelectedCast({
                      id: `cast:${s.name}`,
                      name: s.name,
                      roleLabel: s.role,
                    })
                    goTo('profile')
                  }}
                />
              ))
            )}
          </Section>

          <Section
            title={`コメント（${(commentsError ? mockApprovedComments : approvedComments).length}件）`}
          >
            <View style={styles.commentsBox}>
              {commentsBusy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator />
                </View>
              ) : null}

              {commentsError ? <Text style={styles.loadNote}>取得に失敗しました（モック表示）</Text> : null}

              {(commentsExpanded
                ? (commentsError ? mockApprovedComments : approvedComments)
                : (commentsError ? mockApprovedComments : approvedComments).slice(0, 10)
              ).map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentAuthor} numberOfLines={1} ellipsizeMode="tail">
                    {c.author}  ★{commentStarRating(c)}
                  </Text>
                  <Text style={styles.commentBody}>{truncateCommentBody(c.body)}</Text>
                </View>
              ))}

              {!commentsExpanded && (commentsError ? mockApprovedComments : approvedComments).length > 10 ? (
                <Pressable onPress={() => setCommentsExpanded(true)}>
                  <Text style={styles.moreLink}>もっと見る</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.commentCtaWrap}>
              <View style={styles.fakeInput}>
                <Text style={styles.fakeInputText}>コメントを書く</Text>
              </View>
              <PrimaryButton
                label="コメントを書く"
                onPress={() => {
                  setCommentJustSubmitted(false)
                  setCommentTarget({
                    workId: workIdForDetail,
                    workTitle: workForDetail.title,
                  })
                  goTo('comment')
                }}
              />
            </View>

            {commentJustSubmitted ? (
              <Text style={styles.commentNotice}>
                ※ コメントは管理者の確認後に公開されます。{`\n`}反映までお時間がかかる場合があります。
              </Text>
            ) : null}
          </Section>
        </ScreenContainer>
      ) : null}

      {screen === 'comment' && commentTarget ? (
        <CommentPostScreen
          onBack={goBack}
          workId={commentTarget.workId}
          workTitle={commentTarget.workTitle}
          onSubmitted={async ({ workId, body }) => {
            const trimmed = body.trim()
            if (!trimmed) throw new Error('コメントを入力してください')

            const safeAuthor = (userProfile.displayName || '').trim().slice(0, 50) || '匿名'
            const res = await apiFetch(`${apiBaseUrl}/v1/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentId: workId, episodeId: '', author: safeAuthor, body: trimmed }),
            })
            if (!res.ok) {
              const msg = await res.text().catch(() => '')
              throw new Error(msg ? `HTTP ${res.status}: ${msg}` : `HTTP ${res.status}`)
            }
          }}
          onDone={() => {
            setCommentJustSubmitted(true)
            goTo('workDetail')
          }}
        />
      ) : null}

      {screen === 'comment' && !commentTarget ? (
        <ScreenContainer title="コメント" onBack={goBack}>
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24, alignItems: 'center' }}>
            <View style={{ width: '100%', maxWidth: 420 }}>
              <Text style={styles.centerText}>対象の作品が未選択です。{`\n`}作品詳細から「コメントを書く」を開いてください。</Text>
              <View style={{ height: 16 }} />
              <View style={{ width: '100%' }}>
                <SecondaryButton label="Developer" onPress={() => goTo('dev')} />
                <View style={{ height: 10 }} />
                <PrimaryButton label="ホームへ" onPress={() => goTo('home')} />
              </View>
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'workReview' && workReviewTarget ? (
        <WorkReviewScreen
          onBack={goBack}
          work={workReviewTarget}
          onSubmit={async ({ contentId, rating, comment }) => {
            const res = await apiFetch(`${apiBaseUrl}/v1/reviews/work`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ contentId, rating, comment }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            void fetchWorkReviewSummary(contentId)
          }}
          onDone={() => {
            goTo('workDetail')
          }}
        />
      ) : null}

      {screen === 'workReview' && !workReviewTarget ? (
        <ScreenContainer title="評価" onBack={goBack}>
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
            <Text style={styles.centerText}>対象の作品が未選択です。{`\n`}作品詳細から「☆」を押して開いてください。</Text>
            <View style={{ height: 12 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
              <SecondaryButton label="Developer" onPress={() => goTo('dev')} />
              <PrimaryButton label="ホームへ" onPress={() => goTo('home')} />
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'purchase' && purchaseTarget ? (
        <PaidVideoPurchaseScreen
          onBack={goBack}
          targetType={purchaseTarget.targetType}
          targetId={purchaseTarget.targetId}
          title={purchaseTarget.title}
          contentTypeLabel={purchaseTarget.contentTypeLabel}
          requiredCoins={purchaseTarget.requiredCoins}
          ownedCoins={ownedCoins}
          purchased={purchasedTargets.has(`episode:${purchaseTarget.targetId}`)}
          onBuyCoins={() => {
            setCoinGrantPrimaryReturnTo('purchase')
            setCoinGrantPrimaryLabel('動画を購入する')
            goTo('coinPurchase')
          }}
          onPurchase={async ({ targetId, requiredCoins }) => {
            const key = `episode:${targetId}`
            if (purchasedTargets.has(key)) {
              goBack()
              return
            }
            if (ownedCoins < requiredCoins) {
              throw new Error('コインが不足しています')
            }
            // NOTE: 実運用は購入APIを呼び、結果を正として反映する。
            await new Promise((r) => setTimeout(r, 400))
            setOwnedCoins((v) => v - requiredCoins)
            setPurchasedTargets((prev) => {
              const next = new Set(prev)
              next.add(key)
              return next
            })
            goTo('workDetail')
          }}
        />
      ) : null}

      {screen === 'coinPurchase' ? (
        <CoinPurchaseScreen
          apiBaseUrl={apiBaseUrl}
          ownedCoins={ownedCoins}
          onBack={goBack}
          onStartCheckout={async ({ packId }) => {
            // NOTE: APIが整備されるまでは「購入開始→即時付与」のモック。
            // 将来的には /api/stripe/checkout/coin-pack を呼び出し、決済完了Webhook後に残高再取得する。
            const tryCheckout = async () => {
              const res = await apiFetch(`${apiBaseUrl}/api/stripe/checkout/coin-pack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packId }),
              })
              if (!res.ok) throw new Error('checkout failed')
              const json = (await res.json().catch(() => null)) as any
              const checkoutUrl = typeof json?.checkoutUrl === 'string' ? json.checkoutUrl : ''
              if (checkoutUrl) {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.location.href = checkoutUrl
                } else {
                  await Linking.openURL(checkoutUrl)
                }
              }
            }

            // attempt real API first; if unavailable, fall back to mock
            try {
              await tryCheckout()
            } catch {
              // ignore and proceed with mock
            }

            const packToCoins: Record<string, number> = {
              p100: 100,
              p300: 300,
              p500: 500,
            }
            const added = Number.isFinite(packToCoins[packId]) ? packToCoins[packId] : 100
            await new Promise((r) => setTimeout(r, 400))
            setCoinGrantReasonLabel('コイン購入')
            setCoinGrantAmount(added)
            setCoinGrantAt(Date.now())
            setOwnedCoins((v) => {
              const next = v + added
              setCoinGrantBalanceAfter(next)
              return next
            })
            goTo('coinGrantComplete')
          }}
        />
      ) : null}

      {screen === 'coinGrant' && coinGrantTarget ? (
        <CoinGrantScreen
          targetLabel={`${coinGrantTarget.roleLabel ? `${coinGrantTarget.roleLabel}：` : ''}${coinGrantTarget.name}`}
          ownedCoins={ownedCoins}
          onBack={goBack}
          onGrant={async (amount) => {
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('付与数を入力してください')
            if (amount > ownedCoins) throw new Error('コインが不足しています')
            await new Promise((r) => setTimeout(r, 350))
            setCoinGrantReasonLabel('推しポイント付与')
            setCoinGrantAmount(amount)
            setCoinGrantAt(Date.now())
            setOwnedCoins((v) => {
              const next = Math.max(0, v - amount)
              setCoinGrantBalanceAfter(next)
              return next
            })
            goTo('coinGrantComplete')
          }}
        />
      ) : null}

      {screen === 'coinGrantComplete' ? (
        <CoinGrantCompleteScreen
          grantedCoins={coinGrantAmount}
          reasonLabel={coinGrantReasonLabel}
          grantedAt={coinGrantAt}
          balanceAfter={coinGrantBalanceAfter}
          primaryAction={{
            label: coinGrantPrimaryLabel,
            onPress: () => {
              goTo(coinGrantPrimaryReturnTo)
            },
          }}
          showMyPageAction={coinGrantPrimaryReturnTo !== 'mypage'}
          onGoMyPage={() => {
            setHistory([])
            setScreen('mypage')
          }}
        />
      ) : null}

      {screen === 'videoPlayer' ? (
        <VideoPlayerScreen
          apiBaseUrl={apiBaseUrl}
          videoIdNoSub={playerVideoIdNoSub}
          videoIdWithSub={playerVideoIdWithSub}
          onBack={goBack}
        />
      ) : null}

      <ConfirmDialog
        visible={!!episodePurchaseDialog}
        title={ownedCoins < (episodePurchaseDialog?.requiredCoins ?? 0) ? 'コインが不足しています' : '購入確認'}
        message={(() => {
          if (!episodePurchaseDialog) return ''
          const required = episodePurchaseDialog.requiredCoins
          const after = ownedCoins - required
          if (ownedCoins < required) {
            return `${episodePurchaseDialog.title}\n\n必要コイン：${required}\n所持コイン：${ownedCoins}`
          }
          return `${episodePurchaseDialog.title}\n\n必要コイン：${required}\n所持コイン：${ownedCoins}\n購入後：${after}`
        })()}
        error={episodePurchaseError}
        onRequestClose={() => {
          if (episodePurchaseBusy) return
          setEpisodePurchaseError('')
          setEpisodePurchaseDialog(null)
        }}
        secondary={{
          label: 'キャンセル',
          disabled: episodePurchaseBusy,
          onPress: () => {
            setEpisodePurchaseError('')
            setEpisodePurchaseDialog(null)
          },
        }}
        primary={{
          label:
            ownedCoins < (episodePurchaseDialog?.requiredCoins ?? 0)
              ? 'コイン購入へ'
              : '購入する',
          disabled: episodePurchaseBusy,
          onPress: () => {
            if (!episodePurchaseDialog) return
            const required = episodePurchaseDialog.requiredCoins
            if (ownedCoins < required) {
              setEpisodePurchaseError('')
              setEpisodePurchaseDialog(null)
              setCoinGrantPrimaryReturnTo('workDetail')
              setCoinGrantPrimaryLabel('動画を購入する')
              goTo('coinPurchase')
              return
            }

            void (async () => {
              setEpisodePurchaseBusy(true)
              setEpisodePurchaseError('')
              try {
                await purchaseEpisode(episodePurchaseDialog.episodeId, required)
                setEpisodePurchaseDialog(null)
              } catch (e) {
                setEpisodePurchaseError(e instanceof Error ? e.message : String(e))
              } finally {
                setEpisodePurchaseBusy(false)
              }
            })()
          },
        }}
      />

      <View pointerEvents="box-none" style={styles.devOverlayWrap}>
        {debugOverlayHidden ? null : (
          <Animated.View
            style={[
              styles.devOverlayCard,
              {
                transform: debugOverlayPan.getTranslateTransform(),
              },
            ]}
          >
            <View
              style={[
                styles.devOverlayHeader,
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
              <Text style={styles.devOverlayHeaderText}>DEBUG</Text>
              <View style={styles.devOverlayHeaderRight}>
                <Text style={styles.devOverlayHeaderHint}>ドラッグ可</Text>
                <Pressable onPress={() => setDebugOverlayHidden(true)} style={styles.devOverlayClose}>
                  <Text style={styles.devOverlayCloseText}>×</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.devOverlayRow}>
              <Text style={styles.devOverlayLabel}>認証バイパス</Text>
              <Switch value={debugAuthBypass} onValueChange={setDebugAuthBypass} />
            </View>
            <View style={styles.devOverlayRow}>
              <Text style={styles.devOverlayLabel}>コード自動入力</Text>
              <Switch value={debugAuthAutofill} onValueChange={setDebugAuthAutofill} />
            </View>
            <View style={styles.devOverlayRow}>
              <Text style={styles.devOverlayLabel}>ログイン状態</Text>
              <Switch value={loggedIn} onValueChange={(v) => void setLoggedInState(v)} />
            </View>

            <View style={styles.devOverlayRow}>
              <Text style={styles.devOverlayLabel}>キャストユーザ</Text>
              <Switch value={debugUserType === 'cast'} onValueChange={toggleDebugUserType} />
            </View>
          </Animated.View>
        )}
      </View>

      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
    height: '100%',
  },
  devOverlayWrap: {
    position: 'absolute',
    right: 12,
    bottom: 24,
  },
  devOverlayCard: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  devOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  devOverlayHeaderText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  devOverlayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  devOverlayHeaderHint: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  devOverlayClose: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: THEME.outline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.card,
  },
  devOverlayCloseText: {
    color: THEME.textMuted,
    fontSize: 14,
    fontWeight: '900',
    marginTop: -1,
  },
  devOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  devOverlayLabel: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
  },
  ipGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  ipGateTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  ipGateText: {
    color: THEME.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  ipGateBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    padding: 12,
    marginVertical: 14,
  },
  ipGateMono: {
    color: THEME.text,
    fontSize: 12,
    lineHeight: 18,
  },
  ipGateError: {
    color: THEME.danger,
    fontSize: 12,
    marginTop: 8,
  },
  authCenter: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  authContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 828,
    flex: 1,
    justifyContent: 'space-between',
  },
  authTop: {
    paddingTop: 0,
  },
  authBottom: {
    paddingBottom: 8,
  },
  authLogoWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  authLogo: {
    width: 160,
    height: 80,
  },
  welcomeTitle: {
    color: THEME.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSub: {
    color: THEME.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  welcomeButtons: {
    width: '100%',
  },
  welcomeSpacer: {
    height: 12,
  },
  centerText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    color: THEME.textMuted,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    color: THEME.text,
  },
  sub: {
    fontSize: 12,
    marginBottom: 4,
    color: THEME.textMuted,
  },
  error: {
    fontSize: 12,
    marginBottom: 4,
    color: THEME.danger,
  },
  bannerError: {
    fontSize: 12,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.danger,
    backgroundColor: THEME.card,
    borderRadius: 8,
    color: THEME.text,
  },
  field: {
    marginBottom: 12,
    width: '100%',
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    color: THEME.danger,
  },
  fieldErrorCenter: {
    marginTop: 10,
    fontSize: 12,
    color: THEME.danger,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  spacer: {
    width: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    color: THEME.text,
    backgroundColor: THEME.card,
  },
  inputError: {
    borderColor: THEME.danger,
  },
  buttons: {
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  otpInput: {
    width: 44,
    height: 48,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    color: THEME.text,
    backgroundColor: THEME.card,
  },
  topLoginRow: {
    marginTop: 8,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  loading: {
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
  },
  item: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  itemName: {
    fontSize: 16,
    color: THEME.text,
  },
  itemMeta: {
    fontSize: 12,
    color: THEME.textMuted,
  },

  // Wireframe components
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  headerBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 22,
    backgroundColor: THEME.card,
  },
  headerBackText: {
    color: THEME.text,
    fontSize: 22,
    lineHeight: 22,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '600',
  },
  headerRightSpace: {
    width: 44,
    height: 44,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginBottom: 16,
  },
  heroPlaceholder: {
    flex: 1,
    backgroundColor: THEME.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  playBadgeText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  titleBlock: {
    marginBottom: 8,
  },
  h1: {
    color: THEME.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  h2: {
    color: THEME.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaText: {
    color: THEME.textMuted,
    fontSize: 12,
  },
  metaDot: {
    color: THEME.textMuted,
    marginHorizontal: 8,
  },
  bodyText: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 12,
  },

  commentsBox: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadNote: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  commentItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  commentAuthor: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  commentBody: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  moreLink: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  commentCtaWrap: {
    gap: 10,
  },
  fakeInput: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fakeInputDisabled: {
    opacity: 0.7,
  },
  fakeInputText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  fakeInputTextDisabled: {
    color: THEME.textMuted,
  },
  commentNotice: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
})

