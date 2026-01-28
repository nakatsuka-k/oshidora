import { detectSocialService } from './utils/socialLinks'
import { StatusBar } from 'expo-status-bar'
import { LinearGradient } from 'expo-linear-gradient'
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
  ScrollView,
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
  PagedCarousel,
  PaginationDots,
  PrimaryButton,
  RowItem,
  ScreenContainer,
  SecondaryButton,
  Section,
  Slideshow,
  SubscriptionPromptModal,
  TabBar,
  THEME,
} from './components'

import IconShare from './assets/icon_share.svg'
import IconFavoriteOn from './assets/icon_favorite_on.svg'
import IconFavoriteOff from './assets/icon_favorite_off.svg'
import IconPen from './assets/pen-icon.svg'
import IconStarYellow from './assets/star-yellow.svg'
import IconHeartYellow from './assets/hairt-yellow.svg'
import IconStarEmpty from './assets/none-start.svg'
import IconPlayWhite from './assets/icon_play_white.svg'
import IconDown from './assets/icon_down.svg'
import IconNotification from './assets/icon_notification.svg'
import IconSearch from './assets/icon_search.svg'

import {
  DeveloperMenuScreen,
  EmailVerifyScreen,
  EmailChangeStartScreen,
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
  SubscriptionScreen,
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
  RankingScreen,
} from './screens'

import { apiFetch, DEBUG_MOCK_KEY } from './utils/api'
import { getBoolean, setBoolean, getString, setString } from './utils/storage'
import { useIpAddress } from './utils/useIpAddress'
import { upsertWatchHistory } from './utils/watchHistory'
import {
  getTutorialSlideCount,
  parseTutorialIndexFromPathname,
  screenToWebPath,
  splitPathname,
  tutorialIndexToWebPath,
  videoPlayerToWebUrl,
  webPathnameToScreen,
} from './utils/webRoutes'

const FALLBACK_ALLOWED_IPS = [
  '223.135.200.51',
  '117.102.205.215',
  '133.232.96.225',
  '3.114.72.126',
  '133.200.10.97',
  '159.28.175.137',
]

const CAST_PROFILE_CAROUSEL_CARD_WIDTH = 210
const CAST_PROFILE_CAROUSEL_GAP = 12

const AUTH_TOKEN_KEY = 'auth_token'
const DEBUG_AUTH_AUTOFILL_KEY = 'debug_auth_autofill'
const DEBUG_USER_TYPE_KEY = 'debug_user_type_v1'
const DEBUG_PAYPAY_LINKED_KEY = 'debug_paypay_linked_v1'
const SUBSCRIPTION_KEY = 'user_is_subscribed_v1'

const MOCK_LOGIN_EMAIL = 'demo@oshidora.jp'
const MOCK_LOGIN_PASSWORD = 'password123'

const TUTORIAL_SLIDE_COUNT = getTutorialSlideCount()

type Oshi = {
  id: string
  name: string
  created_at: string
}

type WorkDetailWork = {
  id: string
  title: string
  subtitle: string
  thumbnailUrl?: string | null
  tags: string[]
  rating: number
  reviews: number
  story: string
  episodes: Array<{
    id: string
    title: string
    priceCoin: number
    episodeNo?: number | null
    thumbnailUrl?: string | null
    streamVideoId?: string | null
    streamVideoIdClean?: string | null
    streamVideoIdSubtitled?: string | null
  }>
  staff: Array<{ role: string; name: string }>
}

type ApiWorkDetailResponse = {
  item?: {
    id?: string
    title?: string
    description?: string
    thumbnailUrl?: string
    tags?: string[]
    published?: boolean
  }
  episodes?: Array<{
    id?: string
    title?: string
    priceCoin?: number
    episodeNo?: number | null
    thumbnailUrl?: string
    streamVideoId?: string
    streamVideoIdClean?: string
    streamVideoIdSubtitled?: string
    published?: boolean
    scheduledAt?: string | null
  }>
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
  | 'subscription'
  | 'coinPurchase'
  | 'coinGrant'
  | 'coinGrantComplete'
  | 'coinExchangeDest'
  | 'coinExchangePayPay'
  | 'coinExchangeComplete'
  | 'comment'
  | 'signup'
  | 'emailVerify'
  | 'emailChangeStart'
  | 'emailChangeVerify'
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
  | 'phoneChange'
  | 'castReview'
  | 'workReview'
  | 'workDetail'
  | 'videoPlayer'
  | 'settings'
  | 'withdrawalRequest'
  | 'logout'

const WEB_DEFAULT_SCREEN: Screen = 'splash'

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
    case 'subscription':
      return `${base} | サブスク会員`
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
    case 'emailChangeStart':
      return `${base} | メール変更`
    case 'emailChangeVerify':
      return `${base} | メール変更（認証）`
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
    case 'phoneChange':
      return `${base} | 電話番号変更（SMS認証）`
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

function ensureWebDocumentBackground() {
  if (Platform.OS !== 'web') return
  const doc = (globalThis as any).document
  if (!doc) return
  try {
    if (doc.documentElement?.style) doc.documentElement.style.backgroundColor = THEME.bg
    if (doc.body?.style) doc.body.style.backgroundColor = THEME.bg
  } catch {
    // ignore
  }
}

export default function App() {
  const TUTORIAL_SEEN_KEY = 'tutorial_seen_v1'

  useEffect(() => {
    ensureWebDocumentBackground()
  }, [])

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

  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('')
  const [maintenanceCheckedOnce, setMaintenanceCheckedOnce] = useState<boolean>(false)

  const refreshMaintenance = useCallback(async () => {
    try {
      const res = await apiFetch(`${apiBaseUrl.replace(/\/$/, '')}/v1/settings`)
      if (!res.ok) throw new Error(`settings_http_${res.status}`)
      const json = (await res.json().catch(() => ({}))) as { maintenanceMode?: unknown; maintenanceMessage?: unknown }
      setMaintenanceMode(Boolean(json.maintenanceMode))
      setMaintenanceMessage(String(json.maintenanceMessage ?? ''))
    } catch {
      // ignore network errors; do not hard-block app
    } finally {
      setMaintenanceCheckedOnce(true)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      if (!mounted) return
      await refreshMaintenance()
    }
    void tick()
    const t = setInterval(() => void tick(), 30_000)
    return () => {
      mounted = false
      clearInterval(t)
    }
  }, [refreshMaintenance])

  // Player context (AXCMS-PL-001)
  const [playerVideoIdNoSub, setPlayerVideoIdNoSub] = useState<string>(() => '')
  const [playerVideoIdWithSub, setPlayerVideoIdWithSub] = useState<string | null>(null)
  const [playerEpisodeContext, setPlayerEpisodeContext] = useState<{
    workId: string
    episodeIds: string[]
    currentIndex: number
  } | null>(null)
  const [playerHydrating, setPlayerHydrating] = useState<boolean>(false)

  const [screen, setScreen] = useState<Screen>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const h = (window.location.hash || '').trim()
      // Migrate legacy hash-based URLs (/#/home) to clean paths (/home).
      if (h.startsWith('#/')) {
        try {
          window.history.replaceState(null, '', h.slice(1))
        } catch {
          // ignore
        }
      }
      return webPathnameToScreen(window.location.pathname) as Screen
    }
    return 'splash'
  })
  const [history, setHistory] = useState<Screen[]>([])

  const [postLoginTarget, setPostLoginTarget] = useState<Screen | null>(null)

  const [tutorialIndex, setTutorialIndex] = useState<number>(0)

  const [termsReadOnly, setTermsReadOnly] = useState<boolean>(false)

  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('')

  const [videoListTag, setVideoListTag] = useState<string | null>(null)

  const [registerEmail, setRegisterEmail] = useState<string>('')
  const [registerPassword, setRegisterPassword] = useState<string>('')
  const [registerPhone, setRegisterPhone] = useState<string>('')

  const [emailChangeEmail, setEmailChangeEmail] = useState<string>('')
  const [debugEmailChangeCode, setDebugEmailChangeCode] = useState<string>('')
  const [debugPhoneChangeCode, setDebugPhoneChangeCode] = useState<string>('')

  const [userProfile, setUserProfile] = useState<{
    displayName: string
    fullName: string
    fullNameKana: string
    email: string
    phone: string
    birthDate: string
    favoriteGenres: string[]
    avatarUrl?: string
  }>({
    displayName: '',
    fullName: '',
    fullNameKana: '',
    email: '',
    phone: '',
    birthDate: '',
    favoriteGenres: [],
    avatarUrl: undefined,
  })

  const pushWebUrl = useCallback((url: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    try {
      window.history.pushState(null, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch {
      window.location.assign(url)
    }
  }, [])

  const replaceWebUrl = useCallback((url: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    try {
      window.history.replaceState(null, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch {
      window.location.assign(url)
    }
  }, [])

  const goTo = useCallback(
    (next: Screen) => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (next === 'tutorial') {
          setTutorialIndex(0)
          pushWebUrl(tutorialIndexToWebPath(0))
          return
        }

        // Keep IDs in URL to avoid "refresh -> mock".
        // Work detail links should be created by the caller (e.g. openWorkDetail) with explicit IDs.
        if (next === 'workDetail') {
          pushWebUrl('/work')
          return
        }

        if (next === 'videoPlayer') {
          const wid = String(playerEpisodeContext?.workId ?? '').trim()
          const eid = wid
            ? String(playerEpisodeContext?.episodeIds?.[playerEpisodeContext.currentIndex] ?? '').trim()
            : ''
          pushWebUrl(wid ? videoPlayerToWebUrl({ workId: wid, episodeId: eid }) : '/play')
          return
        }

        pushWebUrl(screenToWebPath(next))
        return
      }

      setHistory((prev) => [...prev, screen])
      setScreen(next)
    },
    [playerEpisodeContext, pushWebUrl, screen]
  )

  const onTutorialIndexChange = useCallback((next: number) => {
    setTutorialIndex(next)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Avoid growing history for tutorial swipes.
      replaceWebUrl(tutorialIndexToWebPath(next))
    }
  }, [replaceWebUrl])

  const goBack = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        replaceWebUrl(screenToWebPath(WEB_DEFAULT_SCREEN))
        setHistory([])
        setScreen(WEB_DEFAULT_SCREEN)
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

  const [debugAuthAutofill, setDebugAuthAutofill] = useState<boolean>(false)
  const [debugUserType, setDebugUserType] = useState<'user' | 'cast'>('user')
  const [debugPaypayLinked, setDebugPaypayLinked] = useState<boolean>(false)
  const [debugMock, setDebugMock] = useState<boolean>(false)
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
        const [token, autofill, userTypeValue, paypayLinked] = await Promise.all([
          getString(AUTH_TOKEN_KEY),
          getBoolean(DEBUG_AUTH_AUTOFILL_KEY),
          getString(DEBUG_USER_TYPE_KEY),
          getBoolean(DEBUG_PAYPAY_LINKED_KEY),
        ])
        if (token) {
          setAuthToken(token)
          setLoggedIn(true)
        }
        setDebugAuthAutofill(autofill)

        const t = (userTypeValue || '').trim()
        if (t === 'cast' || t === 'user') setDebugUserType(t)
        setDebugPaypayLinked(paypayLinked)

        // Force-disable app-side mock mode even if previously enabled.
        setDebugMock(false)
        void setBoolean(DEBUG_MOCK_KEY, false)
      } catch {
        // ignore
      }
    })()
  }, [])

  useEffect(() => {
    void setBoolean(DEBUG_AUTH_AUTOFILL_KEY, debugAuthAutofill)
  }, [debugAuthAutofill])

  useEffect(() => {
    void setString(DEBUG_USER_TYPE_KEY, debugUserType)
  }, [debugUserType])

  useEffect(() => {
    void setBoolean(DEBUG_PAYPAY_LINKED_KEY, debugPaypayLinked)
  }, [debugPaypayLinked])

  // Do not persist DEBUG_MOCK_KEY; mock mode is disabled.

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
      replaceWebUrl(screenToWebPath('login'))
      return
    }
    setHistory([])
    setScreen('login')
  }, [replaceWebUrl])

  const toggleDebugUserType = useCallback(() => {
    setDebugUserType((prev) => (prev === 'cast' ? 'user' : 'cast'))
  }, [])

  useEffect(() => {
    // Guard for direct navigation (e.g. web hash) to login-required screens.
    if (loggedIn) return
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
      replaceWebUrl(screenToWebPath('login'))
      return
    }
    setHistory([])
    setScreen('login')
  }, [loggedIn, replaceWebUrl, screen])

  const requireLogin = useCallback((next: Screen): boolean => {
    if (loggedIn) return true
    setPostLoginTarget(next)
    goTo('login')
    return false
  }, [goTo, loggedIn])

  const hydratePlayerFromEpisodeId = useCallback(
    async (episodeId: string, opts?: { workId?: string }) => {
      const rawEpisodeId = String(episodeId ?? '').trim()
      if (!rawEpisodeId) {
        setPlayerVideoIdNoSub('')
        setPlayerVideoIdWithSub(null)
        setPlayerHydrating(false)
        return
      }

      setPlayerHydrating(true)

      try {
        const looksLikeStreamUid = /^[a-f0-9]{32}$/i.test(rawEpisodeId)
        if (looksLikeStreamUid) {
          setPlayerVideoIdNoSub(rawEpisodeId)
          setPlayerVideoIdWithSub(null)
          return
        }

        // Prefer resolving via work detail when workId is known.
        const requestedWorkId = String(opts?.workId ?? '').trim()
        if (requestedWorkId) {
          const workRes = await apiFetch(`${apiBaseUrl}/v1/works/${encodeURIComponent(requestedWorkId)}`)
          if (workRes.ok) {
            const workJson = (await workRes.json().catch(() => ({}))) as any
            const eps = Array.isArray(workJson?.episodes) ? workJson.episodes : []
            const ep = eps.find((e: any) => String(e?.id ?? '').trim() === rawEpisodeId)
            const chosenNoSub = String(ep?.streamVideoId || '').trim()
            if (chosenNoSub) {
              setSelectedWorkId(requestedWorkId)
              setPlayerVideoIdNoSub(chosenNoSub)
              setPlayerVideoIdWithSub(null)
              return
            }
          }
        }

        const res = await apiFetch(`${apiBaseUrl}/v1/videos/${encodeURIComponent(rawEpisodeId)}`)
        if (!res.ok) {
          setPlayerVideoIdNoSub('')
          setPlayerVideoIdWithSub(null)
          return
        }
        const json = (await res.json().catch(() => ({}))) as any
        const item = json?.item

        const resolvedWorkId = String(item?.workId ?? opts?.workId ?? '').trim()
        if (resolvedWorkId) setSelectedWorkId(resolvedWorkId)

        const chosenNoSub = String(item?.streamVideoId || '').trim()

        setPlayerVideoIdNoSub(chosenNoSub)
        setPlayerVideoIdWithSub(null)
      } catch {
        // ignore
        setPlayerVideoIdNoSub('')
        setPlayerVideoIdWithSub(null)
      } finally {
        setPlayerHydrating(false)
      }
    },
    [apiBaseUrl]
  )

  const hydratePlayerFromWorkId = useCallback(
    async (workId: string) => {
      const wid = String(workId ?? '').trim()
      if (!wid) return

      setPlayerHydrating(true)
      try {
        const workRes = await apiFetch(`${apiBaseUrl}/v1/works/${encodeURIComponent(wid)}`)
        if (!workRes.ok) {
          setPlayerVideoIdNoSub('')
          setPlayerVideoIdWithSub(null)
          return
        }

        const workJson = (await workRes.json().catch(() => ({}))) as any
        const eps = Array.isArray(workJson?.episodes) ? workJson.episodes : []
        const episodeIds = eps.map((e: any) => String(e?.id ?? '').trim()).filter(Boolean)
        const firstEpisodeId = String(episodeIds[0] ?? '').trim()

        setPlayerEpisodeContext({ workId: wid, episodeIds, currentIndex: 0 })

        if (firstEpisodeId) {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            pushWebUrl(videoPlayerToWebUrl({ workId: wid, episodeId: firstEpisodeId }))
          }
          await hydratePlayerFromEpisodeId(firstEpisodeId, { workId: wid })
        } else {
          setPlayerVideoIdNoSub('')
          setPlayerVideoIdWithSub(null)
        }
      } catch {
        setPlayerVideoIdNoSub('')
        setPlayerVideoIdWithSub(null)
      } finally {
        setPlayerHydrating(false)
      }
    },
    [apiBaseUrl, hydratePlayerFromEpisodeId]
  )

  type ApprovedComment = { id: string; author: string; body: string; createdAt?: string }

  const [approvedComments, setApprovedComments] = useState<ApprovedComment[]>([])
  const [commentsBusy, setCommentsBusy] = useState(false)
  const [commentsError, setCommentsError] = useState('')
  const [commentsExpanded, setCommentsExpanded] = useState(false)

  const [workReviewSummary, setWorkReviewSummary] = useState<{ ratingAvg: number; reviewCount: number } | null>(null)
  const [workReviewError, setWorkReviewError] = useState('')
  const [favoriteWorkIds, setFavoriteWorkIds] = useState<string[]>([])
  const [favoriteToastText, setFavoriteToastText] = useState('')
  const [favoriteToastVisible, setFavoriteToastVisible] = useState(false)
  const favoriteToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [workDetailTab, setWorkDetailTab] = useState<'episodes' | 'info'>('episodes')
  const [workDetailEpisodeIdFromHash, setWorkDetailEpisodeIdFromHash] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentRating, setCommentRating] = useState(0)

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
      pushWebUrl(screenToWebPath(next))
      return
    }

    setHistory([])
    setScreen(next)
  }, [pushWebUrl, requireLogin])

  const [debugDotsIndex, setDebugDotsIndex] = useState<number>(0)
  const [debugSlideIndex, setDebugSlideIndex] = useState<number>(0)

  const [castProfileSlideIndex, setCastProfileSlideIndex] = useState<number>(0)
  const [castCommentsExpanded, setCastCommentsExpanded] = useState(false)
  const [castCommentDraft, setCastCommentDraft] = useState('')
  const [castCommentRating, setCastCommentRating] = useState(0)
  const [castLocalComments, setCastLocalComments] = useState<ApprovedComment[]>([])
  const [castFavorite, setCastFavorite] = useState(false)

  const mockProfile = useMemo(
    () => ({
      id: 'cast-1',
      name: '松岡美沙',
      nameKana: 'マツオカミサ',
      nameEn: 'Misa Matsuoka',
      affiliation: 'フリーランス',
      genre: ['女優'],
      biography:
        '生年月日：1998年11月29日\n神奈川県出身\n趣味：映画・アニメ鑑賞・カフェ巡り\n特技：ダンス・歌',
      worksText:
        '・ダウトコール\n・ミステリーX\n・ラブストーリーY',
      snsLinks: ['https://x.com/', 'https://www.instagram.com/'],
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

  const [selectedWorkId, setSelectedWorkId] = useState<string>(() => (Platform.OS === 'web' ? '' : mockWork.id))
  const [guestWorkAuthCtaDismissed, setGuestWorkAuthCtaDismissed] = useState<boolean>(false)

  const [remoteWorkDetail, setRemoteWorkDetail] = useState<{ loading: boolean; error: string; work: WorkDetailWork | null }>(
    () => ({ loading: false, error: '', work: null })
  )

  const workIdForDetail = useMemo(() => {
    const v = String(selectedWorkId || '').trim()
    return v
  }, [selectedWorkId])

  const isWorkFavorite = useMemo(() => favoriteWorkIds.includes(workIdForDetail), [favoriteWorkIds, workIdForDetail])

  const workForDetail = useMemo<WorkDetailWork>(() => {
    if (remoteWorkDetail.work && remoteWorkDetail.work.id === workIdForDetail) return remoteWorkDetail.work
    const key = resolveWorkKeyById(workIdForDetail)
    const base = mockWorksByKey[key] ?? mockWork
    // Keep id consistent with the selected id for history/share/comments.
    return { ...base, id: workIdForDetail }
  }, [mockWork, mockWorksByKey, remoteWorkDetail.work, workIdForDetail])

  useEffect(() => {
    if (loggedIn) return
    setGuestWorkAuthCtaDismissed(false)
  }, [loggedIn, workIdForDetail])

  const workRatingAvg = workReviewSummary ? workReviewSummary.ratingAvg : workForDetail.rating
  const workReviewCount = workReviewSummary ? workReviewSummary.reviewCount : workForDetail.reviews
  const workLikeCount = Math.max(0, workReviewCount)
  const workRatingStars = Math.max(1, Math.min(5, Math.round(workRatingAvg)))
  const workReleaseYear = 2025
  const productionLabel = workForDetail.staff.find((s) => s.role.includes('制作プロダクション'))?.name ?? '—'
  const providerLabel = workForDetail.staff.find((s) => s.role.includes('提供'))?.name ?? '株式会社OO'

  const recommendedWorks = useMemo(
    () =>
      Object.values(mockWorksByKey)
        .filter((w) => w.id !== workIdForDetail)
        .slice(0, 5),
    [mockWorksByKey, workIdForDetail]
  )

  const openWorkDetail = useCallback(
    (id: string) => {
      const nextId = String(id || '').trim()
      if (!nextId) return
      setSelectedWorkId(nextId)
      setWorkDetailEpisodeIdFromHash(null)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        pushWebUrl(`/work?workId=${encodeURIComponent(nextId)}`)
        return
      }
      goTo('workDetail')
    },
    [goTo, pushWebUrl]
  )

  const workDetailHeroThumbnailUrl = useMemo(() => {
    const workThumb = typeof workForDetail.thumbnailUrl === 'string' ? workForDetail.thumbnailUrl.trim() : ''
    if (workThumb) return workThumb
    const epThumb = typeof workForDetail.episodes?.[0]?.thumbnailUrl === 'string' ? workForDetail.episodes[0].thumbnailUrl.trim() : ''
    if (epThumb) return epThumb
    const streamUid = String(workForDetail.episodes?.[0]?.streamVideoId || '').trim()
    if (/^[a-f0-9]{32}$/i.test(streamUid)) {
      return `https://videodelivery.net/${encodeURIComponent(streamUid)}/thumbnails/thumbnail.jpg?time=1s`
    }
    return ''
  }, [workForDetail.episodes, workForDetail.thumbnailUrl])

  const workDetailPreferredEpisodeId = useMemo(() => {
    const preferred = String(workDetailEpisodeIdFromHash || '').trim()
    if (preferred) return preferred
    const first = String(workForDetail.episodes?.[0]?.id ?? '').trim()
    return first || null
  }, [workDetailEpisodeIdFromHash, workForDetail.episodes])

  const workDetailPreferredEpisodeIndex = useMemo(() => {
    if (!workDetailPreferredEpisodeId) return 0
    const idx = workForDetail.episodes.map((x) => x.id).indexOf(workDetailPreferredEpisodeId)
    return idx >= 0 ? idx : 0
  }, [workDetailPreferredEpisodeId, workForDetail.episodes])

  const resolveCastAccountIdByName = useCallback((name: string): string | null => {
    const n = (name || '').trim()
    if (!n) return null
    // Current mock data only has one real cast profile.
    if (n === mockProfile.name) return mockProfile.id
    return null
  }, [mockProfile.id, mockProfile.name])

  const shareUrlForWork = useCallback((contentId: string, episodeId: string | null | undefined, title: string, thumbUrl?: string | null) => {
    const ep = String(episodeId || '').trim()
    const cleanedThumb = (() => {
      const explicit = typeof thumbUrl === 'string' ? thumbUrl.trim() : ''
      if (explicit) return explicit
      // Cloudflare Stream video uid is typically 32 hex chars.
      if (/^[a-f0-9]{32}$/i.test(ep)) {
        return `https://videodelivery.net/${encodeURIComponent(ep)}/thumbnails/thumbnail.jpg?time=1s`
      }
      return ''
    })()
    const appBase = resolveShareAppBaseUrl(apiBaseUrl)
    if (!appBase) return ''
    const params = new URLSearchParams()
    params.set('workId', contentId)
    params.set('title', title)
    if (cleanedThumb) params.set('thumb', cleanedThumb)
    const q = params.toString()
    // Prefer path-form deep link: /work/<episodeId>
    if (ep) return `${appBase}/work/${encodeURIComponent(ep)}${q ? `?${q}` : ''}`
    return `${appBase}/work${q ? `?${q}` : ''}`
  }, [apiBaseUrl])

  const shareUrlForCast = useCallback((castId: string, castName: string) => {
    const appBase = resolveShareAppBaseUrl(apiBaseUrl)
    if (!appBase) return ''
    const params = new URLSearchParams()
    params.set('castId', castId)
    params.set('title', castName)
    return `${appBase}/profile?${params.toString()}`
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

  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [subscriptionNote, setSubscriptionNote] = useState<string | null>(null)
  const [subscriptionReturnTo, setSubscriptionReturnTo] = useState<Screen>('mypage')
  const [subscriptionResume, setSubscriptionResume] = useState<{ workId: string; episodeId?: string | null } | null>(null)

  const [subscriptionPrompt, setSubscriptionPrompt] = useState<{
    visible: boolean
    workId?: string
    episodeId?: string
    workTitle?: string
    thumbnailUrl?: string
  }>({ visible: false })

  useEffect(() => {
    void (async () => {
      try {
        const v = await getBoolean(SUBSCRIPTION_KEY)
        setIsSubscribed(v)
      } catch {
        setIsSubscribed(false)
      }
    })()
  }, [])

  const refreshSubscriptionFromApi = useCallback(async (): Promise<boolean | null> => {
    if (!authToken) return null
    try {
      const res = await apiFetch(`${apiBaseUrl}/v1/me`, {
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })
      if (!res.ok) return null
      const json = (await res.json().catch(() => ({}))) as any
      const subscribed = Boolean(json?.isSubscribed)
      setIsSubscribed(subscribed)
      await setBoolean(SUBSCRIPTION_KEY, subscribed)

      const p = json?.profile
      if (p && typeof p === 'object') {
        const favoriteGenres = Array.isArray(p.favoriteGenres) ? p.favoriteGenres.map((v: any) => String(v ?? '').trim()).filter(Boolean) : []
        setUserProfile((prev) => ({
          ...prev,
          displayName: String(p.displayName ?? prev.displayName ?? ''),
          fullName: String(p.fullName ?? prev.fullName ?? ''),
          fullNameKana: String(p.fullNameKana ?? prev.fullNameKana ?? ''),
          birthDate: String(p.birthDate ?? prev.birthDate ?? ''),
          avatarUrl: String(p.avatarUrl ?? prev.avatarUrl ?? ''),
          favoriteGenres,
          email: String(json?.email ?? prev.email ?? ''),
          phone: String(json?.phone ?? prev.phone ?? ''),
        }))
      }
      return subscribed
    } catch {
      // ignore
      return null
    }
  }, [apiBaseUrl, authToken])

  const saveUserProfileToApi = useCallback(
    async (opts: {
      displayName: string
      fullName: string
      fullNameKana: string
      birthDate: string
      favoriteGenres: string[]
      avatarUrl?: string
    }) => {
      if (!authToken) throw new Error('ログイン情報が不明です')
      const res = await apiFetch(`${apiBaseUrl}/v1/me/profile`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          displayName: opts.displayName,
          fullName: opts.fullName,
          fullNameKana: opts.fullNameKana,
          birthDate: opts.birthDate,
          favoriteGenres: opts.favoriteGenres,
          avatarUrl: opts.avatarUrl,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as any
      if (!res.ok) throw new Error(String(json?.error ?? '保存に失敗しました'))
    },
    [apiBaseUrl, authToken]
  )

  const startEmailChange = useCallback(
    async (email: string): Promise<string | void> => {
      if (!authToken) throw new Error('ログイン情報が不明です')
      const res = await apiFetch(`${apiBaseUrl}/v1/me/email/change/start`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email }),
      })
      const json = (await res.json().catch(() => ({}))) as any
      if (!res.ok) {
        const code = String(json?.error ?? '')
        if (code === 'email_in_use') throw new Error('このメールアドレスはすでに使われています')
        throw new Error('認証コードの送信に失敗しました')
      }
      const dbg = String(json?.debugCode ?? '')
      setDebugEmailChangeCode(dbg)
      return dbg
    },
    [apiBaseUrl, authToken]
  )

  const resendEmailChange = useCallback(
    async (email: string): Promise<string | void> => {
      if (!authToken) throw new Error('ログイン情報が不明です')
      const res = await apiFetch(`${apiBaseUrl}/v1/me/email/change/resend`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email }),
      })
      const json = (await res.json().catch(() => ({}))) as any
      if (!res.ok) throw new Error('認証コードの再送に失敗しました')
      const dbg = String(json?.debugCode ?? '')
      setDebugEmailChangeCode(dbg)
      return dbg
    },
    [apiBaseUrl, authToken]
  )

  const verifyEmailChange = useCallback(
    async (email: string, code: string): Promise<void> => {
      if (!authToken) throw new Error('ログイン情報が不明です')
      const res = await apiFetch(`${apiBaseUrl}/v1/me/email/change/verify`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email, code }),
      })
      const json = (await res.json().catch(() => ({}))) as any
      if (!res.ok) {
        const err = String(json?.error ?? '')
        if (err === 'email_in_use') throw new Error('このメールアドレスはすでに使われています')
        throw new Error('認証コードが正しくありません')
      }
    },
    [apiBaseUrl, authToken]
  )

  const startPhoneChange = useCallback(
    async (phone: string): Promise<string | void> => {
      if (!authToken) throw new Error('ログイン情報が不明です')
      const res = await apiFetch(`${apiBaseUrl}/v1/me/phone/change/start`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ phone }),
      })
      const json = (await res.json().catch(() => ({}))) as any
      if (!res.ok) throw new Error('SMSの送信に失敗しました')
      const dbg = String(json?.debugCode ?? '')
      setDebugPhoneChangeCode(dbg)
      return dbg
    },
    [apiBaseUrl, authToken]
  )

  const verifyPhoneChange = useCallback(
    async (phone: string, code: string): Promise<void> => {
      if (!authToken) throw new Error('ログイン情報が不明です')
      const res = await apiFetch(`${apiBaseUrl}/v1/me/phone/change/verify`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ phone, code }),
      })
      const json = (await res.json().catch(() => ({}))) as any
      if (!res.ok) throw new Error('認証コードが正しくありません')
    },
    [apiBaseUrl, authToken]
  )

  useEffect(() => {
    void refreshSubscriptionFromApi()
  }, [refreshSubscriptionFromApi])

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

  const fetchFavoriteWorkIdsFromApi = useCallback(async () => {
    if (!authToken) {
      setFavoriteWorkIds([])
      return
    }

    try {
      const res = await apiFetch(`${apiBaseUrl}/api/favorites/videos`, {
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })
      if (!res.ok) return
      const json = (await res.json().catch(() => ({}))) as any
      const items = Array.isArray(json?.items) ? json.items : []
      const ids = items.map((it: any) => String(it?.id ?? '').trim()).filter(Boolean)
      setFavoriteWorkIds(Array.from(new Set(ids)))
    } catch {
      // ignore
    }
  }, [apiBaseUrl, authToken])

  const fetchWorkDetailFromApi = useCallback(
    async (workId: string) => {
      const trimmed = String(workId || '').trim()
      if (!trimmed) return

      setRemoteWorkDetail((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const res = await apiFetch(`${apiBaseUrl}/v1/works/${encodeURIComponent(trimmed)}`)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const json = (await res.json().catch(() => ({}))) as ApiWorkDetailResponse
        const item = json?.item
        const eps = Array.isArray(json?.episodes) ? json.episodes : []

        const title = String(item?.title ?? '').trim()
        const description = String(item?.description ?? '')
        const workThumbnailUrlRaw = String(item?.thumbnailUrl ?? '').trim()
        const workThumbnailUrl = workThumbnailUrlRaw ? workThumbnailUrlRaw : null
        const tags = Array.isArray(item?.tags) ? item?.tags.map((t) => String(t ?? '').trim()).filter(Boolean) : []

        // If API doesn't recognize the id, fall back to the existing mock mapping.
        if (!title) {
          setRemoteWorkDetail({ loading: false, error: 'not_found', work: null })
          return
        }

        const episodes = eps
          .map((e) => ({
            id: String(e?.id ?? '').trim(),
            title: String(e?.title ?? '').trim(),
            priceCoin: Number(e?.priceCoin ?? 0) || 0,
            episodeNo: e?.episodeNo == null ? null : Number(e.episodeNo),
            thumbnailUrl: (() => {
              const v = String(e?.thumbnailUrl ?? '').trim()
              return v ? v : null
            })(),
            streamVideoId: (() => {
              const v = String((e as any)?.streamVideoId ?? '').trim()
              return v ? v : null
            })(),
            streamVideoIdClean: (() => {
              const v = String((e as any)?.streamVideoIdClean ?? '').trim()
              return v ? v : null
            })(),
            streamVideoIdSubtitled: (() => {
              const v = String((e as any)?.streamVideoIdSubtitled ?? '').trim()
              return v ? v : null
            })(),
          }))
          .filter((e) => e.id && e.title)
          .sort((a, b) => {
            const an = a.episodeNo == null ? Number.POSITIVE_INFINITY : a.episodeNo
            const bn = b.episodeNo == null ? Number.POSITIVE_INFINITY : b.episodeNo
            if (an !== bn) return an - bn
            return a.title.localeCompare(b.title)
          })

        const work: WorkDetailWork = {
          id: trimmed,
          title,
          subtitle: '',
          thumbnailUrl: workThumbnailUrl,
          tags,
          rating: 0,
          reviews: 0,
          story: description,
          episodes,
          staff: [],
        }

        setRemoteWorkDetail({ loading: false, error: '', work })
      } catch (e) {
        setRemoteWorkDetail({ loading: false, error: e instanceof Error ? e.message : String(e), work: null })
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
    if (!workIdForDetail) {
      setCommentsExpanded(false)
      setRemoteWorkDetail({ loading: false, error: '', work: null })
      return
    }
    setCommentsExpanded(false)
    void fetchWorkDetailFromApi(workIdForDetail)
    void fetchApprovedComments(workIdForDetail)
    void fetchWorkReviewSummary(workIdForDetail)
    if (loggedIn) void fetchFavoriteWorkIdsFromApi()
  }, [fetchApprovedComments, fetchFavoriteWorkIdsFromApi, fetchWorkDetailFromApi, fetchWorkReviewSummary, loggedIn, screen, workIdForDetail])

  useEffect(() => {
    if (loggedIn) return
    setFavoriteWorkIds([])
  }, [loggedIn])

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
    // Self-heal: if we land on the player via deep link but video IDs are not resolved yet,
    // try hydrating again from URL/context.
    if (screen !== 'videoPlayer') return
    if (playerHydrating) return
    if (String(playerVideoIdNoSub || '').trim() || String(playerVideoIdWithSub || '').trim()) return

    // Prefer episodeId from stateful context.
    const ctxWorkId = String(playerEpisodeContext?.workId ?? '').trim()
    const ctxEpisodeId = playerEpisodeContext
      ? String(playerEpisodeContext.episodeIds?.[playerEpisodeContext.currentIndex] ?? '').trim()
      : ''

    if (ctxEpisodeId) {
      setPlayerHydrating(true)
      void hydratePlayerFromEpisodeId(ctxEpisodeId, { workId: ctxWorkId })
      return
    }

    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const params = new URLSearchParams((window.location.search || '').replace(/^\?/, ''))

    const pathSegments = splitPathname(window.location.pathname)
    const decode = (v: string) => {
      try {
        return decodeURIComponent(v)
      } catch {
        return v
      }
    }
    const pathPlay = (() => {
      if (pathSegments[0] !== 'play') return { workId: '', episodeId: '' }
      if (pathSegments.length >= 3) return { workId: decode(pathSegments[1] ?? ''), episodeId: decode(pathSegments[2] ?? '') }
      if (pathSegments.length >= 2) return { workId: '', episodeId: decode(pathSegments[1] ?? '') }
      return { workId: '', episodeId: '' }
    })()

    const workId = (params.get('workId') || pathPlay.workId || '').trim()
    const episodeIdRaw = (params.get('episodeId') || params.get('videoId') || pathPlay.episodeId || '').trim()
    if (episodeIdRaw) {
      setPlayerHydrating(true)
      void hydratePlayerFromEpisodeId(episodeIdRaw, { workId })
      return
    }
    if (workId) {
      void hydratePlayerFromWorkId(workId)
    }
  }, [hydratePlayerFromEpisodeId, hydratePlayerFromWorkId, playerEpisodeContext, playerHydrating, playerVideoIdNoSub, playerVideoIdWithSub, screen])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const syncFromLocation = () => {
      // Migrate legacy hash routes (/#/home) to clean paths (/home).
      const h = String(window.location.hash || '').trim()
      if (h.startsWith('#/')) {
        try {
          window.history.replaceState(null, '', h.slice(1))
        } catch {
          // ignore
        }
      }

      const params = new URLSearchParams((window.location.search || '').replace(/^\?/, ''))

      const pathSegments = splitPathname(window.location.pathname)

      // Path-form deep link parsing: /work/<episodeId>
      const pathEpisodeId = (() => {
        // pathSegments: ['work', '<episodeId>']
        if (pathSegments[0] !== 'work') return ''
        const rawId = pathSegments[1] ?? ''
        try {
          return decodeURIComponent(rawId)
        } catch {
          return rawId
        }
      })().trim()

      // Path-form deep link parsing for player: /play/<episodeId> or /play/<workId>/<episodeId>
      const pathPlay = (() => {
        if (pathSegments[0] !== 'play') return { workId: '', episodeId: '' }

        const decode = (v: string) => {
          try {
            return decodeURIComponent(v)
          } catch {
            return v
          }
        }

        // pathSegments: ['play', '<episodeId>'] OR ['play', '<workId>', '<episodeId>']
        if (pathSegments.length >= 3) {
          return { workId: decode(pathSegments[1] ?? ''), episodeId: decode(pathSegments[2] ?? '') }
        }
        if (pathSegments.length >= 2) {
          return { workId: '', episodeId: decode(pathSegments[1] ?? '') }
        }
        return { workId: '', episodeId: '' }
      })()

      const next = webPathnameToScreen(window.location.pathname) as Screen
      if (next === 'tutorial') {
        const parsed = parseTutorialIndexFromPathname(window.location.pathname)
        if (typeof parsed === 'number') setTutorialIndex(parsed)
      }

      // Deep link hydration for share URLs.
      if (next === 'workDetail') {
        const workId = (params.get('workId') || '').trim()
        const episodeId = ((params.get('episodeId') || '').trim() || pathEpisodeId).trim()

        // Shared URLs are intended to land on episodes.
        setWorkDetailTab('episodes')
        setWorkDetailEpisodeIdFromHash(episodeId || null)

        if (workId) {
          setSelectedWorkId(workId)
        } else if (episodeId) {
          // Resolve work id from episode id (video id).
          void (async () => {
            try {
              const res = await apiFetch(`${apiBaseUrl}/v1/videos/${encodeURIComponent(episodeId)}`)
              if (!res.ok) return
              const json = (await res.json().catch(() => ({}))) as any
              const resolved = String(json?.item?.workId ?? '').trim()
              if (resolved) setSelectedWorkId(resolved)
            } catch {
              // ignore
            }
          })()
        }
      }

      // Deep link hydration for player URLs (/play?workId=...&episodeId=...)
      if (next === 'videoPlayer') {
        const workId = (params.get('workId') || pathPlay.workId || '').trim()
        const episodeIdRaw = (params.get('episodeId') || params.get('videoId') || pathPlay.episodeId || '').trim()

        if (workId) setSelectedWorkId(workId)

        if (episodeIdRaw) {
          setPlayerHydrating(true)
          if (workId) {
            setPlayerEpisodeContext({ workId, episodeIds: [episodeIdRaw], currentIndex: 0 })
          } else {
            setPlayerEpisodeContext(null)
          }

          // Resolve and hydrate Stream UIDs.
          void hydratePlayerFromEpisodeId(episodeIdRaw, { workId })
        } else if (workId) {
          void hydratePlayerFromWorkId(workId)
        } else {
          setPlayerHydrating(false)
          setPlayerEpisodeContext(null)
        }
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

    syncFromLocation()

    window.addEventListener('popstate', syncFromLocation)
    // Also listen for hash changes to support old links that still use #/...
    window.addEventListener('hashchange', syncFromLocation)
    return () => {
      window.removeEventListener('popstate', syncFromLocation)
      window.removeEventListener('hashchange', syncFromLocation)
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

    if (email.toLowerCase() === MOCK_LOGIN_EMAIL && password === MOCK_LOGIN_PASSWORD) {
      setAuthToken('mock-token')
      await setString(AUTH_TOKEN_KEY, 'mock-token')
      setLoggedIn(true)
      setHistory([])
      setScreen(postLoginTarget ?? 'home')
      setPostLoginTarget(null)
      return
    }

    setAuthBusy(true)
    try {
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

      const token = String(data.token ?? '')
      const stage = String(data.stage ?? '')

      if (stage === 'full') {
        if (token) {
          setAuthToken(token)
          await setString(AUTH_TOKEN_KEY, token)
        }
        setAuthPendingToken('')
        setDebugSmsCode('')
        setLoggedIn(true)
        setHistory([])
        setScreen(postLoginTarget ?? 'home')
        setPostLoginTarget(null)
        return
      }

      setAuthPendingToken(token)
      setDebugSmsCode('')
      goTo('phone')
    } finally {
      setAuthBusy(false)
    }
  }, [apiBaseUrl, goTo, loginEmail, loginPassword, postLoginTarget, resetAuthErrors])

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

      if (debugAuthAutofill && sentDebugCode) {
        setOtpDigits(sentDebugCode.slice(0, OTP_LENGTH).split(''))
      } else {
        setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ''))
      }
      goTo('otp')
      setTimeout(() => otpRefs.current[0]?.focus?.(), 50)
    } finally {
      setAuthBusy(false)
    }
  }, [OTP_LENGTH, apiBaseUrl, authPendingToken, debugAuthAutofill, goTo, normalizedPhoneDigits, resetAuthErrors])

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

      setLoggedIn(true)
      setHistory([])
      setScreen(postLoginTarget ?? 'home')
      setPostLoginTarget(null)
    } finally {
      setAuthBusy(false)
    }
  }, [apiBaseUrl, authPendingToken, normalizedPhoneDigits, otpDigits, postLoginTarget, resetAuthErrors])

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

  if (maintenanceMode) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenContainer title="メンテナンス中">
          <View style={styles.ipGate}>
            <Text style={styles.ipGateTitle}>現在メンテナンス中です</Text>
            <Text style={styles.ipGateText}>{maintenanceMessage || 'しばらくお待ちください。'}</Text>
            <View style={{ height: 12 }} />
            <SecondaryButton label="再読み込み" onPress={refreshMaintenance} />
            {!maintenanceCheckedOnce ? <Text style={[styles.ipGateText, { marginTop: 10 }]}>状態を確認中…</Text> : null}
          </View>
        </ScreenContainer>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.appRoot}>
      <SafeAreaView style={styles.safeArea}>
        {screen === 'splash' ? (
          <WelcomeTopScreen
            onLogin={() => goTo('login')}
            onStart={() => {
              setTermsReadOnly(false)
              goTo('terms')
            }}
            onContinueAsGuest={() => {
              setLoggedIn(false)
              setHistory([])
              setScreen('home')
            }}
          />
        ) : null}

      {screen === 'welcome' ? (
        <WelcomeTopScreen
          onLogin={() => goTo('login')}
          onStart={() => {
            setTermsReadOnly(false)
            goTo('terms')
          }}
          onContinueAsGuest={() => {
            setLoggedIn(false)
            setHistory([])
            setScreen('home')
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
            goTo('welcome')
          }}
          onDone={() => {
            void setBoolean(TUTORIAL_SEEN_KEY, true)
            goTo('welcome')
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
            goTo('emailVerify')
          }}
        />
      ) : null}

      {screen === 'emailVerify' ? (
        <EmailVerifyScreen
          email={registerEmail}
          onBack={goBack}
          initialCode={debugAuthAutofill ? debugEmailCode : undefined}
          onResend={async () => {
            if (!registerEmail) throw new Error('メールアドレスが不明です')
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
            goTo('sms2fa')
          }}
        />
      ) : null}

      {screen === 'emailChangeStart' ? (
        <EmailChangeStartScreen
          initialEmail={(userProfile.email || loginEmail || registerEmail || '').trim()}
          onBack={goBack}
          onSendCode={async (email) => {
            const dbg = await startEmailChange(email)
            return dbg
          }}
          onSent={(email, initialCode) => {
            setEmailChangeEmail(email)
            if (typeof initialCode === 'string') setDebugEmailChangeCode(initialCode)
            goTo('emailChangeVerify')
          }}
        />
      ) : null}

      {screen === 'emailChangeVerify' ? (
        <EmailVerifyScreen
          email={emailChangeEmail}
          onBack={goBack}
          initialCode={debugAuthAutofill ? debugEmailChangeCode : undefined}
          onResend={async () => {
            if (!emailChangeEmail) throw new Error('メールアドレスが不明です')
            await resendEmailChange(emailChangeEmail)
          }}
          onVerify={async (code) => {
            if (!emailChangeEmail) throw new Error('メールアドレスが不明です')
            await verifyEmailChange(emailChangeEmail, code)
            await refreshSubscriptionFromApi()
            setEmailChangeEmail('')

            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              pushWebUrl(screenToWebPath('profileEdit'))
              return
            }
            setHistory([])
            setScreen('profileEdit')
          }}
        />
      ) : null}

      {screen === 'sms2fa' ? (
        <Sms2faScreen
          onBack={goBack}
          initialCode={debugAuthAutofill ? debugSmsCode : undefined}
          onSendCode={async (phone) => {
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

      {screen === 'phoneChange' ? (
        <Sms2faScreen
          onBack={goBack}
          initialCode={debugAuthAutofill ? debugPhoneChangeCode : undefined}
          onSendCode={async (phone) => {
            await startPhoneChange(phone)
          }}
          onVerifyCode={async (phone, code) => {
            await verifyPhoneChange(phone, code)
          }}
          onComplete={async () => {
            await refreshSubscriptionFromApi()
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              pushWebUrl(screenToWebPath('profileEdit'))
              return
            }
            setHistory([])
            setScreen('profileEdit')
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
            await saveUserProfileToApi({
              displayName: opts.displayName,
              fullName: opts.fullName,
              fullNameKana: opts.fullNameKana,
              birthDate: opts.birthDate,
              favoriteGenres: opts.favoriteGenres,
              avatarUrl: opts.avatarUrl,
            })
            setUserProfile({
              displayName: opts.displayName,
              fullName: opts.fullName,
              fullNameKana: opts.fullNameKana,
              email: opts.email,
              phone: opts.phone,
              birthDate: opts.birthDate,
              favoriteGenres: opts.favoriteGenres,
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
          onOpenNotice={loggedIn || debugMock ? () => goTo('notice') : undefined}
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
          onOpenNotice={loggedIn || debugMock ? () => goTo('notice') : undefined}
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
          onOpenNotice={loggedIn || debugMock ? () => goTo('notice') : undefined}
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
          onOpenNotice={loggedIn || debugMock ? () => goTo('notice') : undefined}
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
          onOpenNotice={loggedIn || debugMock ? () => goTo('notice') : undefined}
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
          subscribed={isSubscribed}
          onOpenNotice={loggedIn || debugMock ? () => goTo('notice') : undefined}
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

      {screen === 'subscription' ? (
        <SubscriptionScreen
          subscribed={isSubscribed}
          note={subscriptionNote}
          onBack={() => {
            setSubscriptionNote(null)
            setSubscriptionResume(null)
            goBack()
          }}
          onSubscribe={async () => {
            if (!loggedIn) {
              setSubscriptionNote('サブスク加入にはログインが必要です。')
              requireLogin('subscription')
              return
            }

            if (!authToken) {
              setSubscriptionNote('認証情報が不足しています。ログインをやり直してください。')
              requireLogin('subscription')
              return
            }

            const res = await apiFetch(`${apiBaseUrl}/api/stripe/checkout/subscription`, {
              method: 'POST',
              headers: {
                authorization: `Bearer ${authToken}`,
              },
            })
            if (!res.ok) {
              const msg = await res.text().catch(() => '')
              throw new Error(msg ? `HTTP ${res.status}: ${msg}` : `HTTP ${res.status}`)
            }
            const json = (await res.json().catch(() => ({}))) as any
            const checkoutUrl = String(json?.checkoutUrl ?? '').trim()
            if (!checkoutUrl) throw new Error('checkoutUrl is missing')

            setSubscriptionNote('ブラウザで決済ページを開きました。完了後にこの画面へ戻り「加入状況を更新」を押してください。')

            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.href = checkoutUrl
              return
            }
            await Linking.openURL(checkoutUrl)
          }}
          onRefresh={async () => {
            const subscribed = await refreshSubscriptionFromApi()

            if (!subscribed) {
              setSubscriptionNote('未加入のままです。決済が完了している場合は少し待ってから再度更新してください。')
              return
            }

            const resume = subscriptionResume
            setSubscriptionNote(null)
            setSubscriptionResume(null)

            if (resume?.workId) {
              setSelectedWorkId(resume.workId)

              if (resume.episodeId) {
                const key = resolveWorkKeyById(resume.workId)
                const base = mockWorksByKey[key] ?? mockWork
                const episodeIds = base.episodes.map((x) => x.id)
                const currentIndex = episodeIds.indexOf(resume.episodeId)

                setPlayerEpisodeContext(
                  currentIndex >= 0
                    ? {
                        workId: resume.workId,
                        episodeIds,
                        currentIndex,
                      }
                    : null
                )

                void hydratePlayerFromEpisodeId(resume.episodeId, { workId: resume.workId })

                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  pushWebUrl(videoPlayerToWebUrl({ workId: resume.workId, episodeId: resume.episodeId }))
                } else {
                  goTo('videoPlayer')
                }
                return
              }

              goTo('workDetail')
            }
          }}
          onCancel={async () => {
            if (!loggedIn) {
              setSubscriptionNote('ログインが必要です。')
              requireLogin('subscription')
              return
            }

            if (!authToken) {
              setSubscriptionNote('認証情報が不足しています。ログインをやり直してください。')
              requireLogin('subscription')
              return
            }

            const res = await apiFetch(`${apiBaseUrl}/api/stripe/portal`, {
              method: 'POST',
              headers: {
                authorization: `Bearer ${authToken}`,
              },
            })
            if (!res.ok) {
              const msg = await res.text().catch(() => '')
              throw new Error(msg ? `HTTP ${res.status}: ${msg}` : `HTTP ${res.status}`)
            }
            const json = (await res.json().catch(() => ({}))) as any
            const url = String(json?.url ?? '').trim()
            if (!url) throw new Error('url is missing')

            setSubscriptionNote('ブラウザでサブスク管理画面を開きました。変更後は「加入状況を更新」で反映してください。')

            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.open(url, '_blank', 'noopener,noreferrer')
              return
            }
            await Linking.openURL(url)

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
          authToken={authToken}
          onBack={goBack}
        />
      ) : null}

      {screen === 'profileEdit' ? (
        <UserProfileEditScreen
          apiBaseUrl={apiBaseUrl}
          onBack={goBack}
          onRequestEmailChange={() => {
            if (!requireLogin('emailChangeStart')) return
            goTo('emailChangeStart')
          }}
          onRequestPhoneChange={() => {
            if (!requireLogin('phoneChange')) return
            goTo('phoneChange')
          }}
          initialDisplayName={userProfile.displayName}
          initialFullName={userProfile.fullName}
          initialFullNameKana={userProfile.fullNameKana}
          initialEmail={userProfile.email || loginEmail || registerEmail}
          initialPhone={userProfile.phone}
          initialBirthDate={userProfile.birthDate}
          initialFavoriteGenres={userProfile.favoriteGenres}
          initialAvatarUrl={userProfile.avatarUrl ?? ''}
          onSave={async (opts) => {
            await saveUserProfileToApi({
              displayName: opts.displayName,
              fullName: opts.fullName,
              fullNameKana: opts.fullNameKana,
              birthDate: opts.birthDate,
              favoriteGenres: opts.favoriteGenres,
              avatarUrl: opts.avatarUrl,
            })
            setUserProfile({
              displayName: opts.displayName,
              fullName: opts.fullName,
              fullNameKana: opts.fullNameKana,
              email: opts.email,
              phone: opts.phone,
              birthDate: opts.birthDate,
              favoriteGenres: opts.favoriteGenres,
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
        <RankingScreen
          onBack={goBack}
          onPressTab={switchTab}
          onOpenVideo={(id) => {
            openWorkDetail(id)
          }}
        />
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
          authToken={authToken}
          loggedIn={loggedIn}
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
          loggedIn={loggedIn}
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
          loggedIn={loggedIn}
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
          loggedIn={loggedIn}
          mock={debugMock}
          onBack={goBack}
          onLogin={() => goTo('login')}
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
          mock={debugMock}
          onBack={goBack}
        />
      ) : null}

      {screen === 'phone' ? (
        <ScreenContainer
          title="SMS認証"
          onBack={goBack}
          backgroundColor={THEME.bg}
          background={
            <>
              <View style={styles.smsBgBase} />
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
                locations={[0, 0.45, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.7 }}
                style={styles.smsBgTopGlow}
              />
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.80)']}
                locations={[0, 0.6, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.smsBgVignette}
              />
            </>
          }
        >
          <View style={styles.smsSendRoot}>
            {phoneBannerError ? <Text style={styles.bannerError}>{phoneBannerError}</Text> : null}

            <View style={styles.smsField}>
              <Text style={styles.smsLabel}>電話番号</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="電話番号"
                placeholderTextColor={THEME.textMuted}
                keyboardType="phone-pad"
                autoCapitalize="none"
                style={[styles.smsInput, phoneFieldError ? styles.inputError : null]}
              />
              {phoneFieldError ? <Text style={styles.fieldError}>{phoneFieldError}</Text> : null}
            </View>

            <Text style={styles.smsHint}>登録用の認証コードを、SMS（携帯電話番号宛）に送信します。</Text>

            <View style={styles.smsButtonWrap}>
              <PrimaryButton label="認証コードを送信" onPress={onPhoneNext} disabled={!canPhoneNext} />
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
          userType={debugUserType}
          onUserTypeToggle={toggleDebugUserType}
          mock={debugMock}
          onMockToggle={() => setDebugMock(false)}
        />
      ) : null}

      {screen === 'profile' ? (
        <ScreenContainer title="キャストプロフィール" onBack={goBack} scroll>

          <View style={styles.castCarouselWrap}>
            <ScrollView
              horizontal
              decelerationRate="fast"
              snapToInterval={CAST_PROFILE_CAROUSEL_CARD_WIDTH + CAST_PROFILE_CAROUSEL_GAP}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.castCarouselContent}
              onMomentumScrollEnd={(e) => {
                const x = e.nativeEvent.contentOffset.x
                const step = CAST_PROFILE_CAROUSEL_CARD_WIDTH + CAST_PROFILE_CAROUSEL_GAP
                const next = Math.round(x / step)
                setCastProfileSlideIndex(Math.max(0, Math.min(next, 4)))
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.castCarouselCard,
                    i === 4 ? null : { marginRight: CAST_PROFILE_CAROUSEL_GAP },
                  ]}
                >
                  <View style={styles.castCarouselCardInner} />
                </View>
              ))}
            </ScrollView>
            <PaginationDots
              count={5}
              index={castProfileSlideIndex}
              style={styles.castCarouselDots}
              variant="plain"
              dotSize={6}
              activeColor={THEME.accent}
              inactiveColor={THEME.outline}
              onChange={(idx) => setCastProfileSlideIndex(idx)}
            />
          </View>

          <View style={styles.castTitleBlock}>
            <Text style={styles.castNameMain}>{selectedCast?.name ?? mockProfile.name}</Text>
            <Text style={styles.castNameSub}>
              {String((mockProfile as any).nameKana ?? '—')} / {String((mockProfile as any).nameEn ?? '—')}
            </Text>
            <View style={styles.castRatingRow}>
              <IconStarYellow width={14} height={14} />
              <Text style={styles.castRatingText}>
                {castReviewSummary
                  ? castReviewSummary.ratingAvg.toFixed(1)
                  : selectedCastReview
                    ? selectedCastReview.rating.toFixed(1)
                    : '4.7'}
                {castReviewSummary ? ` (${castReviewSummary.reviewCount}件)` : ' (375件)'}
              </Text>
            </View>
          </View>

          <PrimaryButton
            label="推しポイント付与"
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

          <View style={styles.castActionRow}>
            <Pressable
              accessibilityRole="button"
              style={styles.castActionItem}
              onPress={() => {
                if (!requireLogin('castReview')) return
                if (!selectedCast) {
                  setSelectedCast({ id: mockProfile.id, name: mockProfile.name, roleLabel: '出演者' })
                }
                goTo('castReview')
              }}
            >
              <IconPen width={18} height={18} />
              <Text style={styles.castActionLabel}>コメントする</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={styles.castActionItem}
              onPress={() => {
                if (!requireLogin('profile')) return
                setCastFavorite((prev) => !prev)
                setFavoriteToastText(!castFavorite ? 'お気に入りに登録しました' : 'お気に入りから削除しました')
                setFavoriteToastVisible(true)
                if (favoriteToastTimer.current) clearTimeout(favoriteToastTimer.current)
                favoriteToastTimer.current = setTimeout(() => setFavoriteToastVisible(false), 2200)
              }}
            >
              {castFavorite ? <IconFavoriteOn width={18} height={18} /> : <IconFavoriteOff width={18} height={18} />}
              <Text style={styles.castActionLabel}>お気に入り</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={styles.castActionItem}
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
            >
              <IconShare width={18} height={18} />
              <Text style={styles.castActionLabel}>共有する</Text>
            </Pressable>
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.sectionTitle}>プロフィール</Text>
            {[
              { label: 'ジャンル', value: (mockProfile.genre ?? []).join(' / ') || '—' },
              { label: '所属', value: mockProfile.affiliation || '—' },
              { label: '生年月日', value: '1998年11月29日' },
              { label: '出身地', value: '神奈川県（最寄駅：未指定）' },
              { label: '血液型', value: 'A型' },
              { label: '趣味', value: '映画・アニメ鑑賞・カフェ巡り・ホカンス' },
              { label: '特技', value: 'ダンス・歌・ラーメン作り・中華鍋' },
              { label: '資格', value: '英検1級' },
            ].map((it) => (
              <View key={it.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{it.label}</Text>
                <Text style={styles.infoValue}>{it.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.sectionTitle}>カテゴリ</Text>
            <View style={styles.castCategoryRow}>
              {['Drama', 'Comedy', 'Action'].map((t) => (
                <View key={t} style={styles.castCategoryChip}>
                  <Text style={styles.castCategoryChipText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.sectionTitle}>SNSリンク</Text>
            {mockProfile.snsLinks.length === 0 ? (
              <Text style={styles.bodyText}>—</Text>
            ) : (
              <View style={{ gap: 0 }}>
                {mockProfile.snsLinks.map((url, idx) => (
                  <Pressable
                    key={url}
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.open(url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    style={[styles.castSnsRow, idx === mockProfile.snsLinks.length - 1 ? styles.castSnsRowLast : null]}
                  >
                    <View style={styles.castSnsIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.castSnsLabel}>{detectSocialService(url).label}</Text>
                      <Text style={styles.castSnsUrl} numberOfLines={1}>
                        {url}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.sectionTitle}>自己PR</Text>
            <Text style={styles.bodyText}>{mockProfile.selfPr || '—'}</Text>
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.sectionTitle}>経歴・出演実績</Text>
            <Text style={styles.bodyText}>
              2014年、都内の養成所に入所し演技・ダンス・発声を学ぶ。{`\n`}
              2016年、Webドラマで役をデビュー。{`\n`}
              2018年、深夜ドラマでの繊細な演技が話題になり注目を集める。{`\n`}
              2020年、映画初主演。{`\n`}
              以降、ドラマ・映画・CMを中心に活動。
            </Text>
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.sectionTitle}>作品</Text>
            <Text style={styles.bodyText}>{mockProfile.worksText || '—'}</Text>
          </View>

          <View style={styles.commentsBox}>
            <View style={styles.commentItem}>
              <Text style={styles.sectionTitle}>
                コメント（{castReviewSummary ? castReviewSummary.reviewCount : 375}件）
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <IconStarYellow key={idx} width={16} height={16} />
                ))}
                <Text style={[styles.metaTextBase, { color: '#E4A227', fontWeight: '900' }]}>
                  {castReviewSummary
                    ? castReviewSummary.ratingAvg.toFixed(1)
                    : selectedCastReview
                      ? selectedCastReview.rating.toFixed(1)
                      : '4.7'}
                </Text>
              </View>
            </View>

            {(castCommentsExpanded
              ? [...castLocalComments, ...mockApprovedComments]
              : [...castLocalComments, ...mockApprovedComments].slice(0, 3)
            ).map((c) => {
              const stars = commentStarRating(c)
              return (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentAuthor}>{c.author}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const active = idx < stars
                      return active ? <IconStarYellow key={idx} width={14} height={14} /> : <IconStarEmpty key={idx} width={14} height={14} />
                    })}
                  </View>
                  <Text style={styles.commentBody}>{truncateCommentBody(c.body)}</Text>
                </View>
              )
            })}

            {!castCommentsExpanded && [...castLocalComments, ...mockApprovedComments].length > 3 ? (
              <Pressable style={styles.moreRow} onPress={() => setCastCommentsExpanded(true)}>
                <Text style={styles.moreLink}>さらに表示</Text>
                <Text style={styles.moreLink}>›</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.sectionTitle}>コメント投稿</Text>
            <View style={styles.commentCtaWrap}>
              <View style={styles.commentRatingRow}>
                {Array.from({ length: 5 }).map((_, idx) => {
                  const active = idx < castCommentRating
                  return (
                    <Pressable key={`cast-rating-${idx}`} onPress={() => setCastCommentRating(idx + 1)}>
                      {active ? <IconStarYellow width={18} height={18} /> : <IconStarEmpty width={18} height={18} />}
                    </Pressable>
                  )
                })}
              </View>

              <TextInput
                value={castCommentDraft}
                onChangeText={setCastCommentDraft}
                placeholder="コメントを記入する"
                placeholderTextColor={THEME.textMuted}
                multiline
                style={styles.commentInput}
              />

              <PrimaryButton
                label="コメントを投稿する"
                onPress={async () => {
                  if (!requireLogin('profile')) return
                  const castId = selectedCast?.id ?? mockProfile.id
                  const author = userProfile?.displayName?.trim() || 'あなた'
                  const body = castCommentDraft.trim()
                  if (!body) {
                    Alert.alert('入力してください', 'コメントを入力してください')
                    return
                  }
                  if (castCommentRating <= 0) {
                    Alert.alert('評価を選択してください', '星を選んで評価してください')
                    return
                  }

                  try {
                    const res = await apiFetch(`${apiBaseUrl}/v1/reviews/cast`, {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ castId, rating: castCommentRating, comment: body }),
                    })
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    void fetchCastReviewSummary(castId)
                  } catch {
                    setCastReviews((prev) => ({
                      ...prev,
                      [castId]: { rating: castCommentRating, comment: body, updatedAt: Date.now() },
                    }))
                  }

                  setCastLocalComments((prev) => [
                    { id: `local-${Date.now()}`, author, body, createdAt: new Date().toISOString() },
                    ...prev,
                  ])
                  setCastCommentDraft('')
                  setCastCommentRating(0)
                }}
              />
            </View>
          </View>

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
          headerLeft={<Image source={require('./assets/oshidora_logo.png')} style={styles.logo} resizeMode="contain" />}
          headerRight={
            <View style={styles.headerRightRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="お知らせ"
                onPress={() => goTo('notice')}
                style={styles.headerIconButton}
              >
                <IconNotification width={22} height={22} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="検索"
                onPress={() => switchTab('search')}
                style={styles.headerIconButton}
              >
                <IconSearch width={22} height={22} />
              </Pressable>
            </View>
          }
          onBack={goBack}
          footer={<TabBar active="video" onPress={switchTab} />}
          footerPaddingHorizontal={0}
          scroll
          maxWidth={768}
        >

          {!workIdForDetail ? (
            <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
              <Text style={styles.centerText}>作品が未指定です。{`\n`}一覧から作品を選択してください。</Text>
              <View style={{ height: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                <PrimaryButton label="ホームへ" onPress={() => goTo('home')} />
              </View>
            </View>
          ) : (

            <>

          {!loggedIn && !guestWorkAuthCtaDismissed ? (
            <View style={styles.guestCta}>
              <View style={styles.guestCtaHeaderRow}>
                <Text style={styles.guestCtaTitle}>ログインするともっと楽しめます</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="閉じる"
                  onPress={() => setGuestWorkAuthCtaDismissed(true)}
                  hitSlop={10}
                >
                  <Text style={styles.guestCtaClose}>×</Text>
                </Pressable>
              </View>

              <Text style={styles.guestCtaText}>会員限定エピソードの視聴・お気に入り・コメント投稿ができます。</Text>

              <View style={styles.guestCtaButtonsRow}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton
                    label="ログイン"
                    onPress={() => {
                      setPostLoginTarget('workDetail')
                      goTo('login')
                    }}
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="会員登録"
                    onPress={() => {
                      setPostLoginTarget('workDetail')
                      setTermsReadOnly(false)
                      goTo('terms')
                    }}
                  />
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.heroImage}>
            {workDetailHeroThumbnailUrl ? (
              <Image source={{ uri: workDetailHeroThumbnailUrl }} style={styles.heroImageThumb} resizeMode="cover" />
            ) : (
              <View style={styles.heroPlaceholder} />
            )}
            <Pressable
              onPress={() => {
                void upsertWatchHistory(watchHistoryUserKey, {
                  id: `content:${workIdForDetail}`,
                  contentId: workIdForDetail,
                  title: workForDetail.title,
                  kind: '映画',
                  durationSeconds: 25 * 60,
                  thumbnailUrl: workDetailHeroThumbnailUrl,
                  lastPlayedAt: Date.now(),
                })
                const preferredEpisode = workForDetail.episodes[workDetailPreferredEpisodeIndex]
                const chosenNoSub = String(preferredEpisode?.streamVideoId || '').trim()
                setPlayerVideoIdNoSub(chosenNoSub)
                setPlayerVideoIdWithSub(null)
                if (workForDetail.episodes.length > 0) {
                  setPlayerEpisodeContext({
                    workId: workIdForDetail,
                    episodeIds: workForDetail.episodes.map((x) => x.id),
                    currentIndex: workDetailPreferredEpisodeIndex,
                  })
                } else {
                  setPlayerEpisodeContext(null)
                }
                const firstEpisodeId = workDetailPreferredEpisodeId ?? workForDetail.episodes[0]?.id
                if (!chosenNoSub && firstEpisodeId) {
                  void hydratePlayerFromEpisodeId(firstEpisodeId, { workId: workIdForDetail })
                }
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  pushWebUrl(videoPlayerToWebUrl({ workId: workIdForDetail, episodeId: firstEpisodeId }))
                } else {
                  goTo('videoPlayer')
                }
              }}
              style={styles.heroPlayOverlay}
            >
              <IconPlayWhite width={44} height={44} />
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            {workForDetail.tags.includes('新着') ? (
              <View style={styles.badgeNew}>
                <Text style={styles.badgeNewText}>新着</Text>
              </View>
            ) : null}
            <Text style={styles.h1}>{workForDetail.title}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaTextBase}>{workReleaseYear}年</Text>
              </View>
              <View style={styles.metaItem}>
                <IconHeartYellow width={12} height={12} />
                <Text style={styles.metaTextAccent}>{workLikeCount}</Text>
              </View>
              <View style={styles.metaItem}>
                <IconStarYellow width={12} height={12} />
                <Text style={styles.metaTextAccent}>{workRatingAvg.toFixed(1)}（{workReviewCount}件）</Text>
              </View>
            </View>
          </View>

          {workReviewError ? <Text style={styles.loadNote}>評価取得に失敗しました（モック表示）</Text> : null}

          <PrimaryButton
            label="本編を再生する"
            onPress={() => {
              void upsertWatchHistory(watchHistoryUserKey, {
                id: `content:${workIdForDetail}`,
                contentId: workIdForDetail,
                title: workForDetail.title,
                kind: '映画',
                durationSeconds: 25 * 60,
                thumbnailUrl: workDetailHeroThumbnailUrl,
                lastPlayedAt: Date.now(),
              })
              const preferredEpisode = workForDetail.episodes[workDetailPreferredEpisodeIndex]
              const chosenNoSub = String(preferredEpisode?.streamVideoId || '').trim()
              setPlayerVideoIdNoSub(chosenNoSub)
              setPlayerVideoIdWithSub(null)
              if (workForDetail.episodes.length > 0) {
                setPlayerEpisodeContext({
                  workId: workIdForDetail,
                  episodeIds: workForDetail.episodes.map((x) => x.id),
                  currentIndex: workDetailPreferredEpisodeIndex,
                })
              } else {
                setPlayerEpisodeContext(null)
              }
              const firstEpisodeId = workDetailPreferredEpisodeId ?? workForDetail.episodes[0]?.id
              if (!chosenNoSub && firstEpisodeId) {
                void hydratePlayerFromEpisodeId(firstEpisodeId, { workId: workIdForDetail })
              }
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                pushWebUrl(videoPlayerToWebUrl({ workId: workIdForDetail, episodeId: firstEpisodeId }))
              } else {
                goTo('videoPlayer')
              }
            }}
          />

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.actionItem}
              onPress={() => {
                setCommentJustSubmitted(false)
                setCommentTarget({
                  workId: workIdForDetail,
                  workTitle: workForDetail.title,
                })
                goTo('comment')
              }}
            >
              <IconPen width={18} height={18} />
              <Text style={styles.actionLabel}>コメントする</Text>
            </Pressable>
            <Pressable
              style={styles.actionItem}
              onPress={() => {
                if (!requireLogin('workDetail')) return

                const targetId = String(workIdForDetail || '').trim()
                if (!targetId) return

                const wasFavorite = isWorkFavorite
                const next = !wasFavorite

                setFavoriteWorkIds((prev) => {
                  const s = new Set(prev)
                  if (next) s.add(targetId)
                  else s.delete(targetId)
                  return Array.from(s)
                })

                setFavoriteToastText(next ? 'お気に入りに登録しました' : 'お気に入りから削除しました')
                setFavoriteToastVisible(true)
                if (favoriteToastTimer.current) clearTimeout(favoriteToastTimer.current)
                favoriteToastTimer.current = setTimeout(() => {
                  setFavoriteToastVisible(false)
                }, 1600)

                void (async () => {
                  try {
                    if (!authToken) throw new Error('auth_token_missing')
                    const res = await apiFetch(`${apiBaseUrl}/api/favorites/videos`, {
                      method: next ? 'POST' : 'DELETE',
                      headers: {
                        'content-type': 'application/json',
                        authorization: `Bearer ${authToken}`,
                      },
                      body: JSON.stringify({ workIds: [targetId] }),
                    })
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                  } catch {
                    setFavoriteWorkIds((prev) => {
                      const s = new Set(prev)
                      if (wasFavorite) s.add(targetId)
                      else s.delete(targetId)
                      return Array.from(s)
                    })
                  }
                })()
              }}
            >
              {isWorkFavorite ? <IconFavoriteOn width={18} height={18} /> : <IconFavoriteOff width={18} height={18} />}
              <Text style={styles.actionLabel}>お気に入り</Text>
            </Pressable>
            <Pressable
              style={styles.actionItem}
              onPress={async () => {
                const shareEpisode = workDetailPreferredEpisodeId ?? workForDetail.episodes[0]?.id
                const shareThumb = workForDetail.thumbnailUrl ?? workForDetail.episodes[0]?.thumbnailUrl ?? null
                const url = shareUrlForWork(workIdForDetail, shareEpisode, workForDetail.title, shareThumb)
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
            >
              <IconShare width={18} height={18} />
              <Text style={styles.actionLabel}>共有する</Text>
            </Pressable>
          </View>

          <Text style={styles.bodyText}>{workForDetail.story || '—'}</Text>

          <View style={styles.tagList}>
            {workForDetail.tags.map((t) => (
              <Pressable
                key={t}
                style={styles.tagChip}
                onPress={() => {
                  setVideoListTag(t)
                  goTo('videoList')
                }}
              >
                <Text style={styles.tagChipText}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.workTabsWrap}>
            <View style={styles.workTabsRow}>
              <Pressable style={styles.workTabItem} onPress={() => setWorkDetailTab('episodes')}>
                <Text style={[styles.workTabText, workDetailTab === 'episodes' ? styles.workTabTextActive : null]}>エピソード</Text>
                {workDetailTab === 'episodes' ? <View style={styles.workTabUnderline} /> : null}
              </Pressable>
              <Pressable style={styles.workTabItem} onPress={() => setWorkDetailTab('info')}>
                <Text style={[styles.workTabText, workDetailTab === 'info' ? styles.workTabTextActive : null]}>作品情報</Text>
                {workDetailTab === 'info' ? <View style={styles.workTabUnderline} /> : null}
              </Pressable>
            </View>
            <View style={styles.workTabsBaseline} />
          </View>

          {workDetailTab === 'episodes' ? (
            <View style={styles.tabContent}>
              {workForDetail.episodes.length === 0 ? (
                <Text style={styles.emptyText}>空です</Text>
              ) : (
                workForDetail.episodes.map((e) => (
                  (() => {
                    const episodeIds = workForDetail.episodes.map((x) => x.id)
                    const currentIndex = episodeIds.indexOf(e.id)
                    const durationText = `${String(2 + (currentIndex % 3)).padStart(2, '0')}:${String(21 + (currentIndex % 4)).padStart(2, '0')}`
                    const requiredCoins = typeof (e as any).priceCoin === 'number' ? (e as any).priceCoin : 0
                    const isMemberOnly = requiredCoins > 0

                    const episodeNo = e.episodeNo == null ? null : e.episodeNo
                    const fallbackNo = currentIndex >= 0 ? currentIndex + 1 : null
                    const episodeLabel = episodeNo != null ? `第${String(episodeNo).padStart(2, '0')}話` : fallbackNo != null ? `第${String(fallbackNo).padStart(2, '0')}話` : null
                    const displayTitle = (() => {
                      const t = String(e.title || '').trim()
                      if (!episodeLabel) return t || 'エピソード'
                      // Avoid duplicating labels if API already includes them.
                      if (t.includes('第') && t.includes('話')) return t
                      return `${episodeLabel} ${t}`.trim()
                    })()

                    const episodeThumbUrl = (() => {
                      const t = typeof e.thumbnailUrl === 'string' ? e.thumbnailUrl.trim() : ''
                      return t || workDetailHeroThumbnailUrl
                    })()

                    return (
                      <Pressable
                        key={e.id}
                        style={styles.episodeRow}
                        onPress={() => {
                          if (isMemberOnly) {
                            setSubscriptionReturnTo('workDetail')
                            setSubscriptionResume({ workId: workIdForDetail, episodeId: e.id })
                            setSubscriptionPrompt({
                              visible: true,
                              workId: workIdForDetail,
                              episodeId: e.id,
                              workTitle: workForDetail.title,
                              thumbnailUrl: episodeThumbUrl,
                            })
                            return
                          }
                          void upsertWatchHistory(watchHistoryUserKey, {
                            id: `content:${workIdForDetail}:episode:${e.id}`,
                            contentId: workIdForDetail,
                            title: `${workForDetail.title} ${e.title}`,
                            kind: 'エピソード',
                            durationSeconds: 10 * 60,
                            thumbnailUrl: episodeThumbUrl,
                            lastPlayedAt: Date.now(),
                          })
                            const chosenNoSub = String((e as any).streamVideoId || '').trim()
                          setPlayerVideoIdNoSub(chosenNoSub)
                            setPlayerVideoIdWithSub(null)
                          if (!chosenNoSub) {
                            void hydratePlayerFromEpisodeId(e.id, { workId: workIdForDetail })
                          }
                          if (currentIndex >= 0) {
                            setPlayerEpisodeContext({
                              workId: workIdForDetail,
                              episodeIds,
                              currentIndex,
                            })
                          } else {
                            setPlayerEpisodeContext(null)
                          }
                          if (Platform.OS === 'web' && typeof window !== 'undefined') {
                            pushWebUrl(videoPlayerToWebUrl({ workId: workIdForDetail, episodeId: e.id }))
                          } else {
                            goTo('videoPlayer')
                          }
                        }}
                      >
                        <Image
                          source={{ uri: episodeThumbUrl }}
                          style={styles.episodeThumb}
                          resizeMode="cover"
                        />
                        <View style={styles.episodeMeta}>
                          <Text style={styles.episodeTitle} numberOfLines={1}>
                            {displayTitle}
                          </Text>
                          <Text style={styles.episodeDuration}>{durationText}</Text>
                        </View>
                      </Pressable>
                    )
                  })()
                ))
              )}

              <SubscriptionPromptModal
                visible={subscriptionPrompt.visible}
                workTitle={subscriptionPrompt.workTitle}
                thumbnailUrl={subscriptionPrompt.thumbnailUrl}
                onClose={() => setSubscriptionPrompt({ visible: false })}
                onStartTrial={() => {
                  setSubscriptionPrompt({ visible: false })

                  if (!loggedIn) {
                    setSubscriptionNote('このエピソードは会員限定です。ログイン後、サブスク会員に加入すると視聴できます。')
                    setSubscriptionReturnTo('workDetail')
                    if (subscriptionPrompt.workId && subscriptionPrompt.episodeId) {
                      setSubscriptionResume({ workId: subscriptionPrompt.workId, episodeId: subscriptionPrompt.episodeId })
                    }
                    requireLogin('subscription')
                    return
                  }

                  if (!isSubscribed) {
                    setSubscriptionNote('このエピソードは会員限定です。サブスク会員に加入してください。')
                    setSubscriptionReturnTo('workDetail')
                    if (subscriptionPrompt.workId && subscriptionPrompt.episodeId) {
                      setSubscriptionResume({ workId: subscriptionPrompt.workId, episodeId: subscriptionPrompt.episodeId })
                    }
                    goTo('subscription')
                  }
                }}
              />

              <Text style={styles.subSectionTitle}>おすすめドラマ一覧</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recoList}>
                {recommendedWorks.map((w) => (
                  <Pressable key={`reco-${w.id}`} style={styles.recoCard} onPress={() => openWorkDetail(w.id)}>
                    {(() => {
                      const workThumb = typeof (w as any)?.thumbnailUrl === 'string' ? String((w as any).thumbnailUrl).trim() : ''
                      if (workThumb) {
                        return <Image source={{ uri: workThumb }} style={styles.recoThumb} resizeMode="cover" />
                      }
                      const epThumb = typeof (w as any)?.episodes?.[0]?.thumbnailUrl === 'string' ? String((w as any).episodes[0].thumbnailUrl).trim() : ''
                      if (epThumb) {
                        return <Image source={{ uri: epThumb }} style={styles.recoThumb} resizeMode="cover" />
                      }
                      const streamUid = String((w as any)?.episodes?.[0]?.streamVideoId || '').trim()
                      if (/^[a-f0-9]{32}$/i.test(streamUid)) {
                        return (
                          <Image
                            source={{ uri: `https://videodelivery.net/${encodeURIComponent(streamUid)}/thumbnails/thumbnail.jpg?time=1s` }}
                            style={styles.recoThumb}
                            resizeMode="cover"
                          />
                        )
                      }
                      return <View style={[styles.recoThumb, { backgroundColor: THEME.placeholder }]} />
                    })()}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.tabContent}>
              <Text style={styles.subSectionTitle}>出演者</Text>
              {workForDetail.staff.filter((s) => s.role === '出演者').map((s, idx) => (
                <View key={`${s.role}-${idx}`} style={styles.castRow}
                >
                  <View style={styles.castAvatar} />
                  <View style={styles.castInfo}>
                    <Text style={styles.castRole}>{s.role}</Text>
                    <Text style={styles.castName}>{s.name}</Text>
                  </View>
                  <View style={styles.castActions}>
                    <Pressable
                      style={styles.castBtn}
                      onPress={() => {
                        const accountId = resolveCastAccountIdByName(s.name)
                        if (!accountId) return
                        if (!requireLogin('coinGrant')) return
                        setCoinGrantTarget({ id: accountId, name: s.name, roleLabel: s.role })
                        setCoinGrantPrimaryReturnTo('workDetail')
                        setCoinGrantPrimaryLabel('作品詳細へ戻る')
                        goTo('coinGrant')
                      }}
                    >
                      <Text style={styles.castBtnText}>推しポイント付与</Text>
                    </Pressable>
                    <Pressable
                      style={styles.castBtn}
                      onPress={() => {
                        if (!requireLogin('profile')) return
                        setSelectedCast({
                          id: `cast:${s.name}`,
                          name: s.name,
                          roleLabel: s.role,
                        })
                        goTo('profile')
                      }}
                    >
                      <Text style={styles.castBtnText}>詳しく</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              <Text style={styles.subSectionTitle}>スタッフ</Text>
              {workForDetail.staff
                .filter((s) => s.role !== '出演者' && !s.role.includes('制作プロダクション') && !s.role.includes('提供'))
                .map((s, idx) => (
                  <View key={`${s.role}-${idx}`} style={styles.castRow}
                  >
                    <View style={styles.castAvatar} />
                    <View style={styles.castInfo}>
                      <Text style={styles.castRole}>{s.role}</Text>
                      <Text style={styles.castName}>{s.name}</Text>
                    </View>
                    <View style={styles.castActions}>
                      <Pressable style={styles.castBtn}>
                        <Text style={styles.castBtnText}>推しポイント付与</Text>
                      </Pressable>
                      <Pressable style={styles.castBtn}>
                        <Text style={styles.castBtnText}>詳しく</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>制作プロダクション</Text>
                <Text style={styles.infoValue}>{productionLabel}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>提供元</Text>
                <Text style={styles.infoValue}>{providerLabel}</Text>
              </View>

              <PrimaryButton
                label="出演者・スタッフを探す"
                onPress={() => {
                  if (!requireLogin('cast')) return
                  goTo('cast')
                }}
              />
            </View>
          )}

          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>コメント（{(commentsError ? mockApprovedComments : approvedComments).length}件）</Text>
            <View style={styles.commentsBox}>
              {commentsBusy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator />
                </View>
              ) : null}

              {commentsError ? <Text style={styles.loadNote}>取得に失敗しました（モック表示）</Text> : null}

              {(commentsExpanded
                ? (commentsError ? mockApprovedComments : approvedComments)
                : (commentsError ? mockApprovedComments : approvedComments).slice(0, 5)
              ).map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentAuthor} numberOfLines={1} ellipsizeMode="tail">
                    {c.author}  ★{commentStarRating(c)}
                  </Text>
                  <Text style={styles.commentBody}>{truncateCommentBody(c.body)}</Text>
                </View>
              ))}

              {!commentsExpanded && (commentsError ? mockApprovedComments : approvedComments).length > 5 ? (
                <Pressable style={styles.moreRow} onPress={() => setCommentsExpanded(true)}>
                  <Text style={styles.moreLink}>さらに表示</Text>
                  <IconDown width={14} height={14} />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.subSectionTitle}>コメント投稿</Text>
            <View style={styles.commentCtaWrap}>
              <View style={styles.commentRatingRow}>
                {Array.from({ length: 5 }).map((_, idx) => {
                  const active = idx < commentRating
                  return (
                    <Pressable key={`rating-${idx}`} onPress={() => setCommentRating(idx + 1)}>
                      {active ? <IconStarYellow width={18} height={18} /> : <IconStarEmpty width={18} height={18} />}
                    </Pressable>
                  )
                })}
              </View>
              <TextInput
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder="コメントを書く"
                placeholderTextColor={THEME.textMuted}
                style={styles.commentInput}
                multiline
              />
              <PrimaryButton
                label="コメントを投稿する"
                onPress={async () => {
                  const trimmed = commentDraft.trim()
                  if (!trimmed) return
                  setCommentJustSubmitted(false)
                  try {
                    const safeAuthor = (userProfile.displayName || '').trim().slice(0, 50) || '匿名'
                    const res = await apiFetch(`${apiBaseUrl}/v1/comments`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ contentId: workIdForDetail, episodeId: '', author: safeAuthor, body: trimmed, rating: commentRating }),
                    })
                    if (!res.ok) {
                      const msg = await res.text().catch(() => '')
                      throw new Error(msg ? `HTTP ${res.status}: ${msg}` : `HTTP ${res.status}`)
                    }
                    setCommentDraft('')
                    setCommentRating(0)
                    setCommentJustSubmitted(true)
                  } catch {
                    setCommentJustSubmitted(true)
                  }
                }}
              />
            </View>

            {commentJustSubmitted ? (
              <Text style={styles.commentNotice}>
                ※ コメントは管理者の確認後に公開されます。{`\n`}反映までお時間がかかる場合があります。
              </Text>
            ) : null}
          </View>

          {favoriteToastVisible ? (
            <View style={styles.favoriteToastWrap} pointerEvents="none">
              <View style={styles.favoriteToast}>
                <Text style={styles.favoriteToastText}>{favoriteToastText}</Text>
              </View>
            </View>
          ) : null}

            </>
          )}
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
        !String(playerVideoIdNoSub || '').trim() && !String(playerVideoIdWithSub || '').trim() ? (
          <ScreenContainer title="再生" onBack={goBack}>
            <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
              {playerHydrating ? (
                <>
                  <ActivityIndicator />
                  <View style={{ height: 12 }} />
                  <Text style={styles.centerText}>動画情報を取得中です…</Text>
                </>
              ) : (
                <Text style={styles.centerText}>動画が未指定です。{`\n`}作品詳細から再生してください。</Text>
              )}
              <View style={{ height: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                <PrimaryButton label="ホームへ" onPress={() => goTo('home')} />
              </View>
            </View>
          </ScreenContainer>
        ) : (
        <VideoPlayerScreen
          apiBaseUrl={apiBaseUrl}
          authToken={authToken}
          videoIdNoSub={playerVideoIdNoSub}
          videoIdWithSub={playerVideoIdWithSub}
          onBack={goBack}
          currentEpisodeTitle={(() => {
            if (!playerEpisodeContext) return null
            if (playerEpisodeContext.workId !== workIdForDetail) return null
            const currentIndex = playerEpisodeContext.currentIndex
            if (currentIndex < 0 || currentIndex >= workForDetail.episodes.length) return null
            const ep = workForDetail.episodes[currentIndex]
            if (!ep) return null
            const episodeNo = ep.episodeNo == null ? null : ep.episodeNo
            const label = episodeNo != null ? `第${String(episodeNo).padStart(2, '0')}話` : `第${String(currentIndex + 1).padStart(2, '0')}話`
            const t = String(ep.title || '').trim()
            return t.includes('第') && t.includes('話') ? t : `${label} ${t}`.trim()
          })()}
          nextEpisodeTitle={(() => {
            if (!playerEpisodeContext) return null
            if (playerEpisodeContext.workId !== workIdForDetail) return null
            const nextIndex = playerEpisodeContext.currentIndex + 1
            if (nextIndex < 0 || nextIndex >= workForDetail.episodes.length) return null
            const ep = workForDetail.episodes[nextIndex]
            if (!ep) return null
            const episodeNo = ep.episodeNo == null ? null : ep.episodeNo
            const label = episodeNo != null ? `第${String(episodeNo).padStart(2, '0')}話` : `第${String(nextIndex + 1).padStart(2, '0')}話`
            const t = String(ep.title || '').trim()
            return t.includes('第') && t.includes('話') ? t : `${label} ${t}`.trim()
          })()}
          nextEpisodeThumbnailUrl={(() => {
            if (!playerEpisodeContext) return null
            const nextIndex = playerEpisodeContext.currentIndex + 1
            if (!Number.isFinite(nextIndex)) return null
            if (nextIndex < 0) return null
            if (playerEpisodeContext.workId !== workIdForDetail) return null
            if (nextIndex >= workForDetail.episodes.length) return null
            const ep = workForDetail.episodes[nextIndex]
            const t = typeof ep?.thumbnailUrl === 'string' ? ep.thumbnailUrl.trim() : ''
            return t || workDetailHeroThumbnailUrl
          })()}
          onPrevEpisode={
            playerEpisodeContext
              ? () => {
                  const nextIndex = playerEpisodeContext.currentIndex - 1
                  if (nextIndex < 0) return
                  setPlayerEpisodeContext((prev) => (prev ? { ...prev, currentIndex: nextIndex } : prev))
                  const nextEpisodeId = String(playerEpisodeContext.episodeIds?.[nextIndex] ?? '').trim()
                  if (nextEpisodeId) void hydratePlayerFromEpisodeId(nextEpisodeId, { workId: playerEpisodeContext.workId })
                }
              : undefined
          }
          onNextEpisode={
            playerEpisodeContext
              ? () => {
                  const nextIndex = playerEpisodeContext.currentIndex + 1
                  if (nextIndex >= playerEpisodeContext.episodeIds.length) return
                  setPlayerEpisodeContext((prev) => (prev ? { ...prev, currentIndex: nextIndex } : prev))
                  const nextEpisodeId = String(playerEpisodeContext.episodeIds?.[nextIndex] ?? '').trim()
                  if (nextEpisodeId) void hydratePlayerFromEpisodeId(nextEpisodeId, { workId: playerEpisodeContext.workId })
                }
              : undefined
          }
          canPrevEpisode={playerEpisodeContext ? playerEpisodeContext.currentIndex > 0 : undefined}
          canNextEpisode={
            playerEpisodeContext
              ? playerEpisodeContext.currentIndex < playerEpisodeContext.episodeIds.length - 1
              : undefined
          }
        />
        )
      ) : null}

      {null}

        <StatusBar style="auto" />
      </SafeAreaView>

      {screen === 'splash' ? (
        <SplashScreen
          maxDurationMs={2200}
          onDone={() => {
            void (async () => {
              try {
                const [token, tutorialSeen] = await Promise.all([
                  getString(AUTH_TOKEN_KEY),
                  getBoolean(TUTORIAL_SEEN_KEY),
                ])

                if (token) {
                  setAuthToken(token)
                  setLoggedIn(true)
                  setHistory([])
                  setScreen('home')
                  return
                }

                // Web版は初回導線でもチュートリアルへ自動遷移しない（トップ表示の安定化）。
                if (Platform.OS === 'web') {
                  goTo('welcome')
                  return
                }

                if (!tutorialSeen) {
                  setTutorialIndex(0)
                  goTo('tutorial')
                  return
                }

                goTo('welcome')
              } catch {
                // Fallback: keep current behavior.
                goTo('welcome')
              }
            })()
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: THEME.bg,
    position: 'relative',
  },
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
    maxWidth: 768,
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
  smsSendRoot: {
    width: '100%',
    flex: 1,
    paddingTop: 96,
  },
  smsBgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.bg,
  },
  smsBgTopGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  smsBgVignette: {
    ...StyleSheet.absoluteFillObject,
  },
  smsField: {
    width: '100%',
    marginBottom: 10,
  },
  smsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 10,
  },
  smsInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.60)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 4,
    color: THEME.text,
    backgroundColor: 'transparent',
  },
  smsHint: {
    fontSize: 12,
    lineHeight: 18,
    color: THEME.textMuted,
    marginTop: 8,
    marginBottom: 18,
  },
  smsButtonWrap: {
    width: '100%',
    marginTop: 4,
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
  logo: {
    width: 110,
    height: 36,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestCta: {
    width: '100%',
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  guestCtaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  guestCtaTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
  },
  guestCtaClose: {
    color: THEME.textMuted,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 18,
  },
  guestCtaText: {
    color: THEME.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  guestCtaButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: THEME.card,
  },
  castCarouselWrap: {
    width: '100%',
    marginBottom: 14,
  },
  castCarouselContent: {
    paddingHorizontal: 16,
  },
  castCarouselCard: {
    width: CAST_PROFILE_CAROUSEL_CARD_WIDTH,
    height: 300,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'hidden',
  },
  castCarouselCardInner: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  castCarouselDots: {
    marginTop: 10,
    marginBottom: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 6,
  },
  castTitleBlock: {
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  castNameMain: {
    color: '#E6E6E6',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  castNameSub: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  castRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  castRatingText: {
    color: '#E4A227',
    fontSize: 12,
    fontWeight: '900',
  },
  castActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginBottom: 12,
  },
  castActionItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  castActionLabel: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  profileCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
  },
  castCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  castCategoryChip: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  castCategoryChipText: {
    color: '#E6E6E6',
    fontSize: 11,
    fontWeight: '800',
  },
  castSnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  castSnsRowLast: {
    borderBottomWidth: 0,
  },
  castSnsIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.placeholder,
  },
  castSnsLabel: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 3,
  },
  castSnsUrl: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  profileHeaderCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    overflow: 'hidden',
    marginBottom: 14,
  },
  profileHero: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: THEME.card,
  },
  profileHeroPlaceholder: {
    flex: 1,
    backgroundColor: THEME.placeholder,
  },
  profileHeaderInner: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  profileName: {
    flex: 1,
    color: '#E6E6E6',
    fontSize: 18,
    fontWeight: '900',
  },
  profileAffiliation: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  profileStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  profileStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileStatText: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '900',
  },
  profileStatDivider: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  profileStatSub: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  profileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  profileYourReviewCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  profileYourReviewTitle: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  profileYourReviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  profileYourReviewRating: {
    marginLeft: 6,
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '900',
  },
  profileYourReviewBody: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  heroPlaceholder: {
    flex: 1,
    backgroundColor: THEME.placeholder,
  },
  heroImageThumb: {
    width: '100%',
    height: '100%',
  },
  heroPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    marginBottom: 12,
    gap: 6,
  },
  h1: {
    color: '#E6E6E6',
    fontSize: 18,
    fontWeight: '800',
  },
  h2: {
    color: THEME.textMuted,
    fontSize: 12,
  },
  badgeNew: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  badgeNewText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaTextBase: {
    color: '#E6E6E6',
    fontSize: 12,
  },
  metaTextAccent: {
    color: '#E4A227',
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
    marginTop: 8,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 20,
  },
  tagChip: {
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  tagChipText: {
    color: '#E6E6E6',
    fontSize: 11,
  },
  workTabsWrap: {
    marginBottom: 16,
    marginTop: 8,
  },
  workTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 4,
  },
  workTabItem: {
    width: '44%',
    margin: "auto",
  },
  workTabText: {
    color: THEME.textMuted,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  workTabTextActive: {
    color: THEME.accent,
  },
  workTabUnderline: {
    marginTop: 0,
    height: 1,
    borderRadius: 999,
    backgroundColor: THEME.accent,
  },
  workTabsBaseline: {
    height: 1,
    backgroundColor: THEME.outline,
  },
  tabContent: {
    gap: 8,
    marginBottom: 18,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  episodeThumb: {
    width: 92,
    height: 52,
    borderRadius: 8,
    backgroundColor: THEME.placeholder,
  },
  episodeMeta: {
    flex: 1,
    gap: 4,
  },
  episodeTitle: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '800',
  },
  episodeDuration: {
    color: THEME.textMuted,
    fontSize: 11,
  },
  episodeBadge: {
    color: '#E4A227',
    fontSize: 11,
    fontWeight: '800',
  },
  recoList: {
    gap: 12,
    paddingVertical: 4,
  },
  recoCard: {
    width: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  recoThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  recoTitle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#E6E6E6',
    fontSize: 11,
    fontWeight: '700',
  },
  subSectionTitle: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  infoLabel: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '800',
  },
  castRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  castAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.placeholder,
  },
  castInfo: {
    flex: 1,
  },
  castRole: {
    color: THEME.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  castName: {
    color: '#E6E6E6',
    fontSize: 13,
    fontWeight: '800',
  },
  castActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  castBtn: {
    borderWidth: 1,
    borderColor: '#E4A227',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  castBtnText: {
    color: '#E4A227',
    fontSize: 10,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    color: '#E6E6E6',
    fontSize: 10,
    fontWeight: '700',
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
    marginBottom: 16,
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
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentCtaWrap: {
    gap: 14,
  },
  commentRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E6E6E6',
    fontSize: 12,
    minHeight: 44,
  },
  commentRatingText: {
    marginLeft: 4,
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '800',
  },
  commentsSection: {
    marginTop: 14,
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
  favoriteToastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 72,
    alignItems: 'center',
  },
  favoriteToast: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  favoriteToastText: {
    color: '#1F1D1A',
    fontSize: 12,
    fontWeight: '800',
  },
})

