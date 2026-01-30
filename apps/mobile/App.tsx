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
  SubscriptionUpsellProvider,
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
  CastRankingScreen,
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
  LoginScreen,
  PhoneScreen,
  OtpScreen,
  ProfileInlineScreen,
  WorkDetailScreen,
  DebugTopScreen,
  CastReviewMissingTargetScreen,
  CommentMissingTargetScreen,
  WorkReviewMissingTargetScreen,
  VideoPlayerMissingTargetScreen,
  IpCheckingScreen,
  IpDeniedScreen,
  MaintenanceScreen,
} from './screens'

import { apiFetch } from './utils/api'
import { getBoolean, setBoolean, getString, setString } from './utils/storage'
import { upsertWatchHistory } from './utils/watchHistory'
import {
  useAppNavigation,
  useAuthState,
  AUTH_TOKEN_KEY,
  DEBUG_AUTH_AUTOFILL_KEY,
  DEBUG_USER_TYPE_KEY,
  DEBUG_PAYPAY_LINKED_KEY,
  useUserState,
  useDebugOverlay,
  usePlayerState,
  useAppUIState,
} from './hooks'
import {
  getTutorialSlideCount,
  parseTutorialIndexFromPathname,
  profileToWebUrl,
  screenToWebPath,
  splitPathname,
  tutorialIndexToWebPath,
  workDetailToWebUrl,
  videoPlayerToWebUrl,
  webPathnameToScreen,
} from './utils/webRoutes'
import { isLoginRequiredScreen } from './utils/screenAccess'
import {
  screenToDocumentTitle,
  isValidEmail,
  digitsOnly,
  defaultApiBaseUrl,
  resolveShareAppBaseUrl,
  ensureWebDocumentBackground,
} from './utils/appHelpers'
import type { Oshi, WorkDetailWork, ApprovedComment, ApiWorkDetailResponse } from './types/appTypes'

const CAST_PROFILE_CAROUSEL_CARD_WIDTH = 210
const CAST_PROFILE_CAROUSEL_GAP = 12

const SUBSCRIPTION_KEY = 'user_is_subscribed_v1'

const TUTORIAL_SLIDE_COUNT = getTutorialSlideCount()

export type Screen =
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
  | 'castRanking'
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

export default function App() {
  const TUTORIAL_SEEN_KEY = 'tutorial_seen_v1'

  useEffect(() => {
    ensureWebDocumentBackground()
  }, [])

  const apiBaseUrl = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_API_BASE_URL
    return env && env.trim().length > 0 ? env.trim() : defaultApiBaseUrl()
  }, [])

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
  const playerHydrationAttemptKeyRef = useRef<string>('')

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
        if (next === 'workDetail') {
          const workId = String(selectedWorkId ?? '').trim()
          const episodeId = String(workDetailEpisodeIdFromHash ?? '').trim()
          pushWebUrl(workDetailToWebUrl({ workId, episodeId: episodeId || null }))
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
    // Guard for direct navigation (e.g. web URL) to login-required screens.
    if (loggedIn) return
    if (!isLoginRequiredScreen(screen)) return

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

        setPlayerEpisodeContext(firstEpisodeId ? { workId: wid, episodeIds, currentIndex: 0 } : null)

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

    // Access control for tabs.
    if (isLoginRequiredScreen(next) && !requireLogin(next)) return

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

  const [selectedCast, setSelectedCast] = useState<{ id: string; name: string; roleLabel?: string } | null>(null)
  const [castReviews, setCastReviews] = useState<Record<string, { rating: number; comment: string; updatedAt: number }>>({})

  const [workReviewTarget, setWorkReviewTarget] = useState<{ id: string; title: string; subtitle?: string } | null>(null)

  const [castSearchKeyword, setCastSearchKeyword] = useState<string>('')

  const selectedCastReview = useMemo(() => {
    if (!selectedCast) return null
    return castReviews[selectedCast.id] ?? null
  }, [castReviews, selectedCast])

  const [selectedWorkId, setSelectedWorkId] = useState<string>('')
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
    return {
      id: workIdForDetail,
      title: '',
      subtitle: '',
      thumbnailUrl: null,
      tags: [],
      rating: 0,
      reviews: 0,
      story: '',
      episodes: [],
      staff: [],
    }
  }, [remoteWorkDetail.work, workIdForDetail])

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

  const recommendedWorks = useMemo<WorkDetailWork[]>(() => [], [workIdForDetail])

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

  const resolveCastAccountIdByName = useCallback(
    (name: string): string | null => {
      const n = (name || '').trim()
      if (!n) return null
      const selectedName = String(selectedCast?.name ?? '').trim()
      const selectedId = String(selectedCast?.id ?? '').trim()
      if (selectedId && selectedName && n === selectedName) return selectedId
      return null
    },
    [selectedCast]
  )

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
    return `${appBase}${profileToWebUrl({ castId, title: castName })}`
  }, [apiBaseUrl])

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
    if (!selectedCast) return
    void fetchCastReviewSummary(selectedCast.id)
  }, [fetchCastReviewSummary, screen, selectedCast])

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
    // Reset attempt key when (re-)entering the player.
    if (screen !== 'videoPlayer') return
    playerHydrationAttemptKeyRef.current = ''
  }, [screen])

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
      const attemptKey = `episode:${ctxWorkId}:${ctxEpisodeId}`
      if (playerHydrationAttemptKeyRef.current === attemptKey) return
      playerHydrationAttemptKeyRef.current = attemptKey
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
      const attemptKey = `episode:${workId}:${episodeIdRaw}`
      if (playerHydrationAttemptKeyRef.current === attemptKey) return
      playerHydrationAttemptKeyRef.current = attemptKey
      setPlayerHydrating(true)
      void hydratePlayerFromEpisodeId(episodeIdRaw, { workId })
      return
    }
    if (workId) {
      const attemptKey = `work:${workId}`
      if (playerHydrationAttemptKeyRef.current === attemptKey) return
      playerHydrationAttemptKeyRef.current = attemptKey
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
        const decode = (v: string) => {
          try {
            return decodeURIComponent(v)
          } catch {
            return v
          }
        }

        const pathCastId = pathSegments[0] === 'profile' && pathSegments.length >= 2 ? decode(pathSegments[1] ?? '') : ''
        const castId = (params.get('castId') || pathCastId || '').trim()
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

  const onWorkDetailToggleFavorite = useCallback(() => {
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
  }, [apiBaseUrl, authToken, favoriteToastTimer, isWorkFavorite, requireLogin, workIdForDetail])

  const onWorkDetailPlayMain = useCallback(() => {
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
  }, [goTo, hydratePlayerFromEpisodeId, pushWebUrl, workDetailHeroThumbnailUrl, workDetailPreferredEpisodeId, workDetailPreferredEpisodeIndex, workForDetail.episodes, workForDetail.title, workIdForDetail, watchHistoryUserKey])

  const onWorkDetailPressComment = useCallback(() => {
    setCommentJustSubmitted(false)
    setCommentTarget({
      workId: workIdForDetail,
      workTitle: workForDetail.title,
    })
    if (!requireLogin('comment')) return
    goTo('comment')
  }, [goTo, requireLogin, workForDetail.title, workIdForDetail])

  const onWorkDetailShare = useCallback(async () => {
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
  }, [shareUrlForWork, workDetailPreferredEpisodeId, workForDetail.episodes, workForDetail.thumbnailUrl, workForDetail.title, workIdForDetail])

  const onWorkDetailStartTrialFromPrompt = useCallback(() => {
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
  }, [goTo, isSubscribed, loggedIn, requireLogin, subscriptionPrompt.episodeId, subscriptionPrompt.workId])

  const onWorkDetailPressEpisode = useCallback(
    ({ id, thumbnailUrl, isMemberOnly }: { id: string; thumbnailUrl: string; isMemberOnly: boolean }) => {
      const episodeIds = workForDetail.episodes.map((x) => x.id)
      const currentIndex = episodeIds.indexOf(id)

      if (isMemberOnly) {
        setSubscriptionReturnTo('workDetail')
        setSubscriptionResume({ workId: workIdForDetail, episodeId: id })
        setSubscriptionPrompt({
          visible: true,
          workId: workIdForDetail,
          episodeId: id,
          workTitle: workForDetail.title,
          thumbnailUrl,
        })
        return
      }

      void upsertWatchHistory(watchHistoryUserKey, {
        id: `content:${workIdForDetail}:episode:${id}`,
        contentId: workIdForDetail,
        title: `${workForDetail.title} ${String(workForDetail.episodes.find((x) => x.id === id)?.title ?? '')}`,
        kind: 'エピソード',
        durationSeconds: 10 * 60,
        thumbnailUrl,
        lastPlayedAt: Date.now(),
      })

      const selectedEpisode = workForDetail.episodes.find((x) => x.id === id)
      const chosenNoSub = String((selectedEpisode as any)?.streamVideoId || '').trim()
      setPlayerVideoIdNoSub(chosenNoSub)
      setPlayerVideoIdWithSub(null)
      if (!chosenNoSub) {
        void hydratePlayerFromEpisodeId(id, { workId: workIdForDetail })
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
        pushWebUrl(videoPlayerToWebUrl({ workId: workIdForDetail, episodeId: id }))
      } else {
        goTo('videoPlayer')
      }
    },
    [goTo, hydratePlayerFromEpisodeId, pushWebUrl, workForDetail.episodes, workForDetail.title, workIdForDetail, watchHistoryUserKey]
  )

  const onWorkDetailDismissGuestCta = useCallback(() => {
    setGuestWorkAuthCtaDismissed(true)
  }, [])

  const onWorkDetailLoginFromGuestCta = useCallback(() => {
    setPostLoginTarget('workDetail')
    goTo('login')
  }, [goTo])

  const onWorkDetailSignupFromGuestCta = useCallback(() => {
    setPostLoginTarget('workDetail')
    setTermsReadOnly(false)
    goTo('terms')
  }, [goTo])

  const onWorkDetailGoCoinGrantForCast = useCallback(
    ({ accountId, name, roleLabel }: { accountId: string; name: string; roleLabel: string }) => {
      if (!requireLogin('coinGrant')) return
      setCoinGrantTarget({ id: accountId, name, roleLabel })
      setCoinGrantPrimaryReturnTo('workDetail')
      setCoinGrantPrimaryLabel('作品詳細へ戻る')
      goTo('coinGrant')
    },
    [goTo, requireLogin]
  )

  const onStartTrialFromCoinGrantUpsell = useCallback(() => {
    if (!loggedIn) {
      setSubscriptionNote('推しポイント付与にはログインが必要です。')
      requireLogin('subscription')
      return
    }

    setSubscriptionNote('推しポイント付与にはサブスク会員への加入が必要です。')
    goTo('subscription')
  }, [goTo, loggedIn, requireLogin])

  const onWorkDetailOpenProfileForStaff = useCallback(
    ({ id, name, roleLabel }: { id: string; name: string; roleLabel: string }) => {
      setSelectedCast({ id, name, roleLabel })
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        pushWebUrl(profileToWebUrl({ castId: id, title: name }))
        return
      }
      goTo('profile')
    },
    [goTo, pushWebUrl]
  )

  const onWorkDetailSubmitInlineComment = useCallback(async () => {
    if (!loggedIn) {
      Alert.alert('ログインが必要です', 'コメント投稿にはログインが必要です。', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログイン',
          onPress: () => {
            setPostLoginTarget('workDetail')
            goTo('login')
          },
        },
      ])
      return
    }

    const trimmed = commentDraft.trim()
    if (!trimmed) return
    setCommentJustSubmitted(false)
    try {
      const safeAuthor = (userProfile.displayName || '').trim().slice(0, 50) || '匿名'
      const res = await apiFetch(`${apiBaseUrl}/v1/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { authorization: `Bearer ${authToken}` } : null),
        },
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
  }, [apiBaseUrl, authToken, commentDraft, commentRating, goTo, loggedIn, userProfile.displayName, workIdForDetail])

  const onRegisterCompleteGoVideos = useCallback(() => {
    setLoggedIn(true)
    setHistory([])
    setScreen(postLoginTarget ?? 'home')
    setPostLoginTarget(null)
  }, [postLoginTarget])

  const onCastOpenProfile = useCallback(
    (cast: { id: string; name: string; role: string }) => {
      setSelectedCast({ id: cast.id, name: cast.name, roleLabel: cast.role })
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        pushWebUrl(profileToWebUrl({ castId: cast.id, title: cast.name }))
        return
      }
      goTo('profile')
    },
    [goTo, pushWebUrl]
  )

  const onCastSearchOpenResults = useCallback(
    (keyword: string) => {
      setCastSearchKeyword(keyword)
      goTo('castSearchResult')
    },
    [goTo]
  )

  const onCastSearchResultBack = useCallback(() => {
    goBack()
  }, [goBack])

  const onMyPageNavigate = useCallback(
    (screenKey: string) => {
      if (screenKey === 'coinPurchase') {
        setCoinGrantPrimaryReturnTo('mypage')
        setCoinGrantPrimaryLabel('マイページへ戻る')
      }
      if (screenKey === 'terms') {
        setTermsReadOnly(true)
      }
      goTo(screenKey as Screen)
    },
    [goTo]
  )

  const onCoinExchangeCancelToMyPage = useCallback(() => {
    setHistory([])
    setScreen('mypage')
  }, [])

  const onCoinExchangeLinkPaypay = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 350))
    setDebugPaypayLinked(true)
  }, [])

  const onCoinExchangeUnlinkPaypay = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 350))
    setDebugPaypayLinked(false)
  }, [])

  const onCoinExchangeToPaypayStep = useCallback(() => {
    goTo('coinExchangePayPay')
  }, [goTo])

  const onCoinExchangeChangeLink = useCallback(() => {
    goTo('coinExchangeDest')
  }, [goTo])

  const onCoinExchangeSubmit = useCallback(async ({ coinAmount, pointAmount }: { coinAmount: number; pointAmount: number }) => {
    // NOTE: APIが整備されるまではモック。
    await new Promise((r) => setTimeout(r, 400))
    setCoinExchangePendingCoins(coinAmount)
    setCoinExchangeLastCoinAmount(coinAmount)
    setCoinExchangeLastPointAmount(pointAmount)
    goTo('coinExchangeComplete')
  }, [goTo])

  const onCoinExchangeCompleteDone = useCallback(() => {
    setHistory([])
    setScreen('mypage')
  }, [])

  const onNoticeOpenDetail = useCallback(
    (id: string) => {
      setSelectedNoticeId(id)
      goTo('noticeDetail')
    },
    [goTo]
  )

  const onDevGo = useCallback(
    (key: string) => {
      goTo(key as Screen)
    },
    [goTo]
  )

  const onCoinGrantCompletePrimaryPress = useCallback(() => {
    goTo(coinGrantPrimaryReturnTo)
  }, [coinGrantPrimaryReturnTo, goTo])

  const coinGrantCompletePrimaryAction = useMemo(
    () => ({
      label: coinGrantPrimaryLabel,
      onPress: onCoinGrantCompletePrimaryPress,
    }),
    [coinGrantPrimaryLabel, onCoinGrantCompletePrimaryPress]
  )

  const onCoinGrantCompleteGoMyPage = useCallback(() => {
    setHistory([])
    setScreen('mypage')
  }, [])

  const onSplashDone = useCallback(() => {
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

          // Web版（特にローカル開発）は、保存済みトークンがあっても自動でホームへ遷移しない。
          // ただし / (splash) からは離脱して welcome を表示する。
          if (Platform.OS === 'web') {
            if (screen === 'splash') goTo('welcome')
            return
          }

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
  }, [goTo, screen])

  const onSubscriptionBack = useCallback(() => {
    setSubscriptionNote(null)
    setSubscriptionResume(null)
    goBack()
  }, [goBack])

  const onSubscriptionSubscribe = useCallback(async () => {
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
  }, [apiBaseUrl, authToken, loggedIn, requireLogin])

  const onSubscriptionRefresh = useCallback(async () => {
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
        // Episode context (next/prev navigation) requires a full episode list.
        // We intentionally avoid mock episode lists; hydrate by episodeId only.
        setPlayerEpisodeContext(null)

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
  }, [goTo, hydratePlayerFromEpisodeId, pushWebUrl, refreshSubscriptionFromApi, subscriptionResume])

  const onSubscriptionCancel = useCallback(async () => {
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
  }, [apiBaseUrl, authToken, loggedIn, requireLogin])

  const onStaffCastReviewSubmit = useCallback(
    async ({ castId, rating, comment }: { castId: string; rating: number; comment: string }) => {
      try {
        const res = await apiFetch(`${apiBaseUrl}/v1/reviews/cast`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ castId, rating, comment }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        void fetchCastReviewSummary(castId)
      } catch {
        await new Promise((r) => setTimeout(r, 300))
        setCastReviews((prev) => ({
          ...prev,
          [castId]: { rating, comment, updatedAt: Date.now() },
        }))
      }
    },
    [apiBaseUrl, fetchCastReviewSummary]
  )

  const onStaffCastReviewDone = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const castId = String(selectedCast?.id ?? '').trim()
      const title = String(selectedCast?.name ?? '').trim()
      pushWebUrl(profileToWebUrl({ castId: castId || null, title: title || null }))
      return
    }
    goTo('profile')
  }, [goTo, pushWebUrl, selectedCast])

  const onCommentPostSubmitted = useCallback(
    async ({ workId, body }: { workId: string; body: string }) => {
      if (!loggedIn) {
        requireLogin('comment')
        throw new Error('ログインが必要です')
      }

      const trimmed = body.trim()
      if (!trimmed) throw new Error('コメントを入力してください')

      const safeAuthor = (userProfile.displayName || '').trim().slice(0, 50) || '匿名'
      const res = await apiFetch(`${apiBaseUrl}/v1/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { authorization: `Bearer ${authToken}` } : null),
        },
        body: JSON.stringify({ contentId: workId, episodeId: '', author: safeAuthor, body: trimmed }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg ? `HTTP ${res.status}: ${msg}` : `HTTP ${res.status}`)
      }
    },
    [apiBaseUrl, authToken, loggedIn, requireLogin, userProfile.displayName]
  )

  const onCommentPostDone = useCallback(() => {
    setCommentJustSubmitted(true)
    goTo('workDetail')
  }, [goTo])

  const onWorkReviewSubmit = useCallback(
    async ({ contentId, rating, comment }: { contentId: string; rating: number; comment: string }) => {
      const res = await apiFetch(`${apiBaseUrl}/v1/reviews/work`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentId, rating, comment }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      void fetchWorkReviewSummary(contentId)
    },
    [apiBaseUrl, fetchWorkReviewSummary]
  )

  const onWorkReviewDone = useCallback(() => {
    goTo('workDetail')
  }, [goTo])

  const onCoinPurchaseStartCheckout = useCallback(
    async ({ packId }: { packId: string }) => {
      let added = 100
      try {
        const res = await apiFetch(`${apiBaseUrl}/api/coin-packs`)
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as any
          const items = Array.isArray(json?.items) ? (json.items as any[]) : []
          const found = items.find((v) => String(v?.packId ?? '') === packId)
          const n = Number(found?.coinAmount ?? NaN)
          if (Number.isFinite(n) && n > 0) added = Math.floor(n)
        }
      } catch {
        // ignore
      }

      if (added === 100) {
        const packToCoins: Record<string, number> = {
          p100: 100,
          p300: 300,
          p500: 500,
        }
        if (Number.isFinite(packToCoins[packId])) added = packToCoins[packId]
      }
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
    },
    [apiBaseUrl, goTo]
  )

  const onCoinGrant = useCallback(
    async (amount: number) => {
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
    },
    [goTo, ownedCoins]
  )

  const playerCurrentEpisodeTitle = useMemo(() => {
    if (!playerEpisodeContext) return null
    if (playerEpisodeContext.workId !== workIdForDetail) return null
    const currentIndex = playerEpisodeContext.currentIndex
    if (currentIndex < 0 || currentIndex >= workForDetail.episodes.length) return null
    const ep = workForDetail.episodes[currentIndex]
    if (!ep) return null
    const episodeNo = ep.episodeNo == null ? null : ep.episodeNo
    const label =
      episodeNo != null
        ? `第${String(episodeNo).padStart(2, '0')}話`
        : `第${String(currentIndex + 1).padStart(2, '0')}話`
    const t = String(ep.title || '').trim()
    return t.includes('第') && t.includes('話') ? t : `${label} ${t}`.trim()
  }, [playerEpisodeContext, workForDetail.episodes, workIdForDetail])

  const playerNextEpisodeTitle = useMemo(() => {
    if (!playerEpisodeContext) return null
    if (playerEpisodeContext.workId !== workIdForDetail) return null
    const nextIndex = playerEpisodeContext.currentIndex + 1
    if (nextIndex < 0 || nextIndex >= workForDetail.episodes.length) return null
    const ep = workForDetail.episodes[nextIndex]
    if (!ep) return null
    const episodeNo = ep.episodeNo == null ? null : ep.episodeNo
    const label =
      episodeNo != null ? `第${String(episodeNo).padStart(2, '0')}話` : `第${String(nextIndex + 1).padStart(2, '0')}話`
    const t = String(ep.title || '').trim()
    return t.includes('第') && t.includes('話') ? t : `${label} ${t}`.trim()
  }, [playerEpisodeContext, workForDetail.episodes, workIdForDetail])

  const playerNextEpisodeThumbnailUrl = useMemo(() => {
    if (!playerEpisodeContext) return null
    const nextIndex = playerEpisodeContext.currentIndex + 1
    if (!Number.isFinite(nextIndex)) return null
    if (nextIndex < 0) return null
    if (playerEpisodeContext.workId !== workIdForDetail) return null
    if (nextIndex >= workForDetail.episodes.length) return null
    const ep = workForDetail.episodes[nextIndex]
    const t = typeof ep?.thumbnailUrl === 'string' ? ep.thumbnailUrl.trim() : ''
    return t || workDetailHeroThumbnailUrl
  }, [playerEpisodeContext, workDetailHeroThumbnailUrl, workForDetail.episodes, workIdForDetail])

  const onPlayerPrevEpisode = useCallback(() => {
    if (!playerEpisodeContext) return
    const nextIndex = playerEpisodeContext.currentIndex - 1
    if (nextIndex < 0) return
    setPlayerEpisodeContext((prev) => (prev ? { ...prev, currentIndex: nextIndex } : prev))
    const nextEpisodeId = String(playerEpisodeContext.episodeIds?.[nextIndex] ?? '').trim()
    if (nextEpisodeId) void hydratePlayerFromEpisodeId(nextEpisodeId, { workId: playerEpisodeContext.workId })
  }, [hydratePlayerFromEpisodeId, playerEpisodeContext])

  const onPlayerNextEpisode = useCallback(() => {
    if (!playerEpisodeContext) return
    const nextIndex = playerEpisodeContext.currentIndex + 1
    if (nextIndex >= playerEpisodeContext.episodeIds.length) return
    setPlayerEpisodeContext((prev) => (prev ? { ...prev, currentIndex: nextIndex } : prev))
    const nextEpisodeId = String(playerEpisodeContext.episodeIds?.[nextIndex] ?? '').trim()
    if (nextEpisodeId) void hydratePlayerFromEpisodeId(nextEpisodeId, { workId: playerEpisodeContext.workId })
  }, [hydratePlayerFromEpisodeId, playerEpisodeContext])

  const playerCanPrevEpisode = playerEpisodeContext ? playerEpisodeContext.currentIndex > 0 : undefined
  const playerCanNextEpisode = playerEpisodeContext
    ? playerEpisodeContext.currentIndex < playerEpisodeContext.episodeIds.length - 1
    : undefined

  if (maintenanceMode) {
    return (
      <MaintenanceScreen
        styles={styles}
        message={maintenanceMessage}
        checkedOnce={maintenanceCheckedOnce}
        onReload={refreshMaintenance}
      />
    )
  }

  return (
    <View style={styles.appRoot}>
      <SubscriptionUpsellProvider onStartTrial={onStartTrialFromCoinGrantUpsell}>
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
        <LoginScreen
          email={loginEmail}
          password={loginPassword}
          fieldErrors={loginFieldErrors}
          bannerError={loginBannerError}
          busy={authBusy}
          canNext={canLoginNext}
          onChangeEmail={setLoginEmail}
          onChangePassword={setLoginPassword}
          onCancel={onCancel}
          onNext={onLoginNext}
        />
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
          onGoVideos={onRegisterCompleteGoVideos}
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
          onOpenCastProfile={({ id, name }) => onCastOpenProfile({ id, name, role: '俳優' })}
          onOpenFavorites={() => goTo('favorites')}
          onOpenNotice={() => goTo('notice')}
        />
      ) : null}

      {screen === 'cast' ? (
        <CastSearchScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          onOpenProfile={onCastOpenProfile}
          onOpenResults={onCastSearchOpenResults}
          onOpenCastRanking={() => {
            if (!requireLogin('castRanking')) return
            goTo('castRanking')
          }}
        />
      ) : null}

      {screen === 'castRanking' ? (
        <CastRankingScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onBack={goBack}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          onOpenProfile={onCastOpenProfile}
        />
      ) : null}

      {screen === 'castSearchResult' ? (
        <CastSearchResultScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          keyword={castSearchKeyword}
          onBack={onCastSearchResultBack}
          onOpenProfile={onCastOpenProfile}
        />
      ) : null}

      {screen === 'search' ? (
        <VideoSearchScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          onOpenVideo={(id) => openWorkDetail(id)}
          onOpenProfile={onCastOpenProfile}
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
          subscribed={isSubscribed}
          onOpenNotice={loggedIn ? () => goTo('notice') : undefined}
          onNavigate={onMyPageNavigate}
        />
      ) : null}

      {screen === 'subscription' ? (
        <SubscriptionScreen
          subscribed={isSubscribed}
          note={subscriptionNote}
          onBack={onSubscriptionBack}
          onSubscribe={onSubscriptionSubscribe}
          onRefresh={onSubscriptionRefresh}
          onCancel={onSubscriptionCancel}
        />
      ) : null}

      {screen === 'coinExchangeDest' ? (
        <CoinExchangeDestScreen
          ownedCoins={ownedCoins}
          exchangeableCoins={Math.max(0, ownedCoins - coinExchangePendingCoins)}
          paypayLinked={debugPaypayLinked}
          paypayMaskedLabel={debugPaypayMaskedLabel}
          onBack={goBack}
          onCancel={onCoinExchangeCancelToMyPage}
          onLinkPaypay={onCoinExchangeLinkPaypay}
          onUnlinkPaypay={onCoinExchangeUnlinkPaypay}
          onNext={onCoinExchangeToPaypayStep}
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
          onCancel={onCoinExchangeCancelToMyPage}
          onChangeLink={onCoinExchangeChangeLink}
          onSubmit={onCoinExchangeSubmit}
        />
      ) : null}

      {screen === 'coinExchangeComplete' ? (
        <CoinExchangeCompleteScreen
          coinAmount={coinExchangeLastCoinAmount}
          pointAmount={coinExchangeLastPointAmount}
          paypayMaskedLabel={debugPaypayMaskedLabel}
          onDone={onCoinExchangeCompleteDone}
        />
      ) : null}

      {screen === 'castProfileRegister' ? (
        <CastProfileRegisterScreen
          apiBaseUrl={apiBaseUrl}
          authToken={authToken}
          onBack={goBack}
          activeTab="cast"
          onPressTab={(tabKey) => switchTab(tabKey as any)}
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
          onBack={goBack}
          onLogin={() => goTo('login')}
          onOpenDetail={onNoticeOpenDetail}
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
        <PhoneScreen
          phoneNumber={phoneNumber}
          onChangePhoneNumber={setPhoneNumber}
          fieldError={phoneFieldError}
          bannerError={phoneBannerError}
          canNext={canPhoneNext}
          onBack={goBack}
          onNext={onPhoneNext}
        />
      ) : null}

      {screen === 'otp' ? (
        <OtpScreen
          otpDigits={otpDigits}
          otpRefs={otpRefs}
          bannerError={otpBannerError}
          fieldError={otpFieldError}
          busy={authBusy}
          canNext={canOtpNext}
          onBack={goBack}
          onCancel={onCancel}
          onNext={onOtpNext}
          onChangeDigit={setOtpAt}
          onKeyPress={onOtpKeyPress}
        />
      ) : null}

      {screen === 'top' ? (
        <DebugTopScreen
          styles={styles}
          apiBaseUrl={apiBaseUrl}
          health={health}
          error={error}
          loggedIn={loggedIn}
          onGoLogin={() => goTo('login')}
          onGoProfile={() => goTo('profile')}
          onGoWorkDetail={() => goTo('workDetail')}
          onGoDev={() => goTo('dev')}
          onCheckHealth={checkHealth}
          onReload={loadOshi}
          debugDotsIndex={debugDotsIndex}
          onChangeDebugDotsIndex={setDebugDotsIndex}
          debugSlideIndex={debugSlideIndex}
          onChangeDebugSlideIndex={setDebugSlideIndex}
          name={name}
          onChangeName={setName}
          onAddOshi={addOshi}
          apiBusy={apiBusy}
          items={items}
        />
      ) : null}

      {screen === 'dev' ? (
        <DeveloperMenuScreen
          onBack={goBack}
          onGo={onDevGo}
          userType={debugUserType}
          onUserTypeToggle={toggleDebugUserType}
        />
      ) : null}

      {screen === 'profile' ? (
        <ProfileInlineScreen
          styles={styles}
          apiBaseUrl={apiBaseUrl}
          selectedCast={selectedCast}
          isSubscribed={isSubscribed}
          castProfileSlideIndex={castProfileSlideIndex}
          setCastProfileSlideIndex={setCastProfileSlideIndex}
          castReviewSummary={castReviewSummary}
          selectedCastReview={selectedCastReview}
          castFavorite={castFavorite}
          setCastFavorite={setCastFavorite}
          requireLogin={requireLogin}
          goTo={goTo}
          goBack={goBack}
          setCoinGrantTarget={setCoinGrantTarget}
          setCoinGrantPrimaryReturnTo={setCoinGrantPrimaryReturnTo}
          setCoinGrantPrimaryLabel={setCoinGrantPrimaryLabel}
          setFavoriteToastText={setFavoriteToastText}
          setFavoriteToastVisible={setFavoriteToastVisible}
          favoriteToastTimer={favoriteToastTimer}
          shareUrlForCast={shareUrlForCast}
          userProfile={userProfile}
          castCommentsExpanded={castCommentsExpanded}
          setCastCommentsExpanded={setCastCommentsExpanded}
          castLocalComments={castLocalComments}
          commentStarRating={commentStarRating}
          truncateCommentBody={truncateCommentBody}
          castCommentRating={castCommentRating}
          setCastCommentRating={setCastCommentRating}
          castCommentDraft={castCommentDraft}
          setCastCommentDraft={setCastCommentDraft}
          fetchCastReviewSummary={fetchCastReviewSummary}
          setCastReviews={setCastReviews}
          setCastLocalComments={setCastLocalComments}
        />
      ) : null}

      {screen === 'castReview' && selectedCast ? (
        <StaffCastReviewScreen
          onBack={goBack}
          cast={{ id: selectedCast.id, name: selectedCast.name, roleLabel: selectedCast.roleLabel, profileImageUrl: null }}
          initial={{ rating: selectedCastReview?.rating ?? null, comment: selectedCastReview?.comment ?? null }}
          onSubmit={onStaffCastReviewSubmit}
          onDone={onStaffCastReviewDone}
        />
      ) : null}

      {screen === 'castReview' && !selectedCast ? (
        <CastReviewMissingTargetScreen
          styles={styles}
          onBack={goBack}
          onGoDev={() => goTo('dev')}
          onGoHome={() => goTo('home')}
        />
      ) : null}

      {screen === 'workDetail' ? (
        <WorkDetailScreen
          apiBaseUrl={apiBaseUrl}
          authToken={authToken}
          loggedIn={loggedIn}
          isSubscribed={isSubscribed}
          workIdForDetail={workIdForDetail}
          workForDetail={workForDetail}
          workDetailHeroThumbnailUrl={workDetailHeroThumbnailUrl}
          workReleaseYear={workReleaseYear}
          workLikeCount={workLikeCount}
          workRatingAvg={workRatingAvg}
          workReviewCount={workReviewCount}
          isWorkFavorite={isWorkFavorite}
          onToggleFavorite={onWorkDetailToggleFavorite}
          guestWorkAuthCtaDismissed={guestWorkAuthCtaDismissed}
          onDismissGuestCta={onWorkDetailDismissGuestCta}
          onLoginFromGuestCta={onWorkDetailLoginFromGuestCta}
          onSignupFromGuestCta={onWorkDetailSignupFromGuestCta}
          onBack={goBack}
          onGoHome={() => goTo('home')}
          onOpenNotice={() => goTo('notice')}
          onOpenSearch={() => switchTab('cast')}
          onPressTab={(tabKey) => switchTab(tabKey as any)}
          onPlayMain={onWorkDetailPlayMain}
          onPressComment={onWorkDetailPressComment}
          shareWork={onWorkDetailShare}
          videoListTagSetter={setVideoListTag}
          onGoVideoList={() => goTo('videoList')}
          workDetailTab={workDetailTab}
          onChangeWorkDetailTab={setWorkDetailTab}
          recommendedWorks={recommendedWorks}
          openWorkDetail={openWorkDetail}
          subscriptionPrompt={subscriptionPrompt}
          onCloseSubscriptionPrompt={() => setSubscriptionPrompt({ visible: false })}
          onStartTrialFromPrompt={onWorkDetailStartTrialFromPrompt}
          onPressEpisode={onWorkDetailPressEpisode}
          productionLabel={productionLabel}
          providerLabel={providerLabel}
          resolveCastAccountIdByName={resolveCastAccountIdByName}
          requireLogin={(screenKey) => requireLogin(screenKey as any)}
          onGoCoinGrantForCast={onWorkDetailGoCoinGrantForCast}
          onOpenProfileForStaff={onWorkDetailOpenProfileForStaff}
          commentsBusy={commentsBusy}
          commentsError={Boolean(commentsError)}
          commentsExpanded={commentsExpanded}
          onExpandComments={() => setCommentsExpanded(true)}
          approvedComments={approvedComments}
          commentStarRating={commentStarRating}
          truncateCommentBody={truncateCommentBody}
          commentRating={commentRating}
          onChangeCommentRating={(rating) => setCommentRating(rating)}
          commentDraft={commentDraft}
          onChangeCommentDraft={setCommentDraft}
          onSubmitInlineComment={onWorkDetailSubmitInlineComment}
          commentJustSubmitted={commentJustSubmitted}
          favoriteToastVisible={favoriteToastVisible}
          favoriteToastText={favoriteToastText}
        />
      ) : null}

      {screen === 'comment' && commentTarget ? (
        <CommentPostScreen
          onBack={goBack}
          workId={commentTarget.workId}
          workTitle={commentTarget.workTitle}
          onSubmitted={onCommentPostSubmitted}
          onDone={onCommentPostDone}
        />
      ) : null}

      {screen === 'comment' && !commentTarget ? (
        <CommentMissingTargetScreen
          styles={styles}
          onBack={goBack}
          onGoDev={() => goTo('dev')}
          onGoHome={() => goTo('home')}
        />
      ) : null}

      {screen === 'workReview' && workReviewTarget ? (
        <WorkReviewScreen
          onBack={goBack}
          work={workReviewTarget}
          onSubmit={onWorkReviewSubmit}
          onDone={onWorkReviewDone}
        />
      ) : null}

      {screen === 'workReview' && !workReviewTarget ? (
        <WorkReviewMissingTargetScreen
          styles={styles}
          onBack={goBack}
          onGoDev={() => goTo('dev')}
          onGoHome={() => goTo('home')}
        />
      ) : null}

      {screen === 'coinPurchase' ? (
        <CoinPurchaseScreen
          apiBaseUrl={apiBaseUrl}
          ownedCoins={ownedCoins}
          onBack={goBack}
          onStartCheckout={onCoinPurchaseStartCheckout}
        />
      ) : null}

      {screen === 'coinGrant' && coinGrantTarget ? (
        <CoinGrantScreen
          targetLabel={`${coinGrantTarget.roleLabel ? `${coinGrantTarget.roleLabel}：` : ''}${coinGrantTarget.name}`}
          ownedCoins={ownedCoins}
          onBack={goBack}
          onGrant={onCoinGrant}
        />
      ) : null}

      {screen === 'coinGrantComplete' ? (
        <CoinGrantCompleteScreen
          grantedCoins={coinGrantAmount}
          reasonLabel={coinGrantReasonLabel}
          grantedAt={coinGrantAt}
          balanceAfter={coinGrantBalanceAfter}
          primaryAction={coinGrantCompletePrimaryAction}
          showMyPageAction={coinGrantPrimaryReturnTo !== 'mypage'}
          onGoMyPage={onCoinGrantCompleteGoMyPage}
        />
      ) : null}

      {screen === 'videoPlayer' ? (
        !String(playerVideoIdNoSub || '').trim() && !String(playerVideoIdWithSub || '').trim() ? (
          <VideoPlayerMissingTargetScreen
            styles={styles}
            hydrating={playerHydrating}
            onBack={goBack}
            onGoHome={() => goTo('home')}
          />
        ) : (
        <VideoPlayerScreen
          apiBaseUrl={apiBaseUrl}
          authToken={authToken}
          videoIdNoSub={playerVideoIdNoSub}
          videoIdWithSub={playerVideoIdWithSub}
          onBack={goBack}
          currentEpisodeTitle={playerCurrentEpisodeTitle}
          nextEpisodeTitle={playerNextEpisodeTitle}
          nextEpisodeThumbnailUrl={playerNextEpisodeThumbnailUrl}
          onPrevEpisode={playerEpisodeContext ? onPlayerPrevEpisode : undefined}
          onNextEpisode={playerEpisodeContext ? onPlayerNextEpisode : undefined}
          canPrevEpisode={playerCanPrevEpisode}
          canNextEpisode={playerCanNextEpisode}
        />
        )
      ) : null}

      {null}

        <StatusBar style="auto" />
      </SafeAreaView>

      {screen === 'splash' ? (
        <SplashScreen
          maxDurationMs={2200}
          onDone={onSplashDone}
        />
      ) : null}
      </SubscriptionUpsellProvider>
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

  profileSectionDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 18,
    marginBottom: 18,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  profileRowLabel: {
    width: 96,
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  profileRowValue: {
    flex: 1,
    flexShrink: 1,
    color: '#E6E6E6',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  profileTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  profileTag: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  profileTagText: {
    color: '#E6E6E6',
    fontSize: 11,
    fontWeight: '700',
  },
  profileBodyText: {
    color: '#E6E6E6',
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '600',
  },
  profileSubHeadingText: {
    color: '#E6E6E6',
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '900',
  },
  profileLinkText: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  profileGridItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: THEME.placeholder,
  },
  profileCommentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileCommentsHeaderRating: {
    color: '#E4A227',
    fontSize: 12,
    fontWeight: '900',
  },
  profileCommentItem: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  profileMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  profileCommentInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E6E6E6',
    fontSize: 12,
    minHeight: 44,
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  castSnsRowLast: {
    borderBottomWidth: 0,
  },
  castSnsIcon: {
    width: 28,
    height: 28,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  castSnsIconText: {
    color: '#E6E6E6',
    fontSize: 11,
    fontWeight: '900',
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

