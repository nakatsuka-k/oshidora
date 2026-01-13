import { ResizeMode, Video } from 'expo-av'
import * as ScreenCapture from 'expo-screen-capture'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { IconButton, PrimaryButton, SecondaryButton, THEME } from '../components'
import { isDebugMockEnabled } from '../utils/api'

type Props = {
  apiBaseUrl: string
  videoIdNoSub: string
  videoIdWithSub?: string | null
  onBack: () => void
  nextEpisodeTitle?: string | null
  nextEpisodeThumbnailUrl?: string | null
  onPrevEpisode?: () => void
  onNextEpisode?: () => void
  canPrevEpisode?: boolean
  canNextEpisode?: boolean
}

const PUBLIC_FALLBACK_TEST_VIDEO_MP4 =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number } | { ok: false; status: -1 }> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return { ok: false, status: resp.status }
    const json = (await resp.json().catch(() => null)) as T | null
    if (!json) return { ok: false, status: resp.status }
    return { ok: true, data: json }
  } catch {
    return { ok: false, status: -1 }
  }
}

async function resolvePlaybackUrl(apiBaseUrl: string, videoId: string) {
  // ① HMAC-HS256 署名付きトークンを取得（推奨）
  const hmacSigned = await fetchJson<{
    token?: string
    hlsUrl?: string
    mp4Url?: string
    iframeUrl?: string
  }>(`${apiBaseUrl}/v1/stream/hmac-signed-playback/${encodeURIComponent(videoId)}`)

  if (hmacSigned.ok && hmacSigned.data?.hlsUrl) {
    return { url: hmacSigned.data.hlsUrl, kind: 'signed-hls' as const, token: hmacSigned.data.token, error: null as string | null }
  }

  if (hmacSigned.ok && hmacSigned.data?.mp4Url) {
    return { url: hmacSigned.data.mp4Url, kind: 'signed-mp4' as const, token: hmacSigned.data.token, error: null as string | null }
  }

  // ② フォールバック：RSA署名付きURL取得
  const rsaSigned = await fetchJson<{ hlsUrl?: string }>(
    `${apiBaseUrl}/v1/stream/signed-playback/${encodeURIComponent(videoId)}`
  )
  if (rsaSigned.ok && rsaSigned.data?.hlsUrl) {
    return { url: rsaSigned.data.hlsUrl, kind: 'signed-hls' as const, token: undefined, error: null as string | null }
  }

  // ③ フォールバック：署名なしの再生URL取得
  const info = await fetchJson<{ hlsUrl?: string; mp4Url?: string }>(
    `${apiBaseUrl}/v1/stream/playback/${encodeURIComponent(videoId)}`
  )
  if (info.ok) {
    if (info.data?.hlsUrl) return { url: info.data.hlsUrl, kind: 'hls' as const, token: undefined, error: null as string | null }
    if (info.data?.mp4Url) return { url: info.data.mp4Url, kind: 'mp4' as const, token: undefined, error: null as string | null }
  }

  // ④ エラー
  const status = hmacSigned.ok ? null : hmacSigned.status
  const reason =
    status === 500
      ? 'stream_signing_not_configured'
      : status === 401
        ? 'unauthorized'
        : status === -1
          ? 'network'
          : 'stream_error'

  const allowFallback = await isDebugMockEnabled()
  if (allowFallback) {
    return { url: PUBLIC_FALLBACK_TEST_VIDEO_MP4, kind: 'fallback' as const, token: undefined, error: reason }
  }

  return { url: null as string | null, kind: 'error' as const, token: undefined, error: reason }
}

export function VideoPlayerScreen({
  apiBaseUrl,
  videoIdNoSub,
  videoIdWithSub,
  onBack,
  nextEpisodeTitle,
  nextEpisodeThumbnailUrl,
  onPrevEpisode,
  onNextEpisode,
  canPrevEpisode,
  canNextEpisode,
}: Props) {
  const { width, height } = useWindowDimensions()

  const isWeb = Platform.OS === 'web'

  const [webViewport, setWebViewport] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return

    const vv = (window as any).visualViewport as
      | { width: number; height: number; addEventListener: any; removeEventListener: any }
      | undefined

    const read = () => {
      const w = Math.floor(Number(vv?.width ?? window.innerWidth))
      const h = Math.floor(Number(vv?.height ?? window.innerHeight))
      if (w > 0 && h > 0) setWebViewport({ width: w, height: h })
    }

    read()

    window.addEventListener('resize', read)
    window.addEventListener('orientationchange', read)
    vv?.addEventListener?.('resize', read)
    vv?.addEventListener?.('scroll', read)

    return () => {
      window.removeEventListener('resize', read)
      window.removeEventListener('orientationchange', read)
      vv?.removeEventListener?.('resize', read)
      vv?.removeEventListener?.('scroll', read)
    }
  }, [])

  // On web (especially iOS Safari), RN layout measurements can diverge from the *visible* viewport.
  // Treat `visualViewport` as the authoritative stage size.
  useEffect(() => {
    if (!isWeb) return
    if (!webViewport) return
    setStageSize({ width: webViewport.width, height: webViewport.height })
  }, [isWeb, webViewport?.height, webViewport?.width])

  const canSubOn = Boolean(videoIdWithSub && videoIdWithSub.trim().length > 0)

  const [subOn, setSubOn] = useState(false)
  const selectedVideoId = useMemo(() => {
    if (subOn && canSubOn) return (videoIdWithSub as string)
    return videoIdNoSub
  }, [canSubOn, subOn, videoIdNoSub, videoIdWithSub])

  const [hasStarted, setHasStarted] = useState(false)
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false)

  const [uiShouldPlay, setUiShouldPlay] = useState(false)
  const [playback, setPlayback] = useState<{
    isLoaded: boolean
    isPlaying: boolean
    positionMillis: number
    durationMillis: number
  }>({
    isLoaded: false,
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
  })

  const [seekBarWidth, setSeekBarWidth] = useState(0)

  const [controlsVisible, setControlsVisible] = useState(true)
  const autoHideTimerRef = useRef<any>(null)

  const [didFinish, setDidFinish] = useState(false)

  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)

  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null)

  const [pendingResume, setPendingResume] = useState<{
    positionMillis: number
    shouldPlay: boolean
  } | null>(null)

  const [playUrl, setPlayUrl] = useState<string | null>(null)
  const [playUrlKind, setPlayUrlKind] = useState<'signed-hls' | 'signed-mp4' | 'hls' | 'mp4' | 'fallback' | 'error' | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const videoRef = useRef<Video | null>(null)
  const videoWrapRef = useRef<any>(null)

  const fittedLayout = useMemo(() => {
    const fallbackW = isWeb ? webViewport?.width : width
    const fallbackH = isWeb ? webViewport?.height : height

    const stageW = Math.max(1, stageSize?.width ?? fallbackW ?? width)
    const stageH = Math.max(1, stageSize?.height ?? fallbackH ?? height)
    const maxW = stageW
    const maxH = stageH

    const srcW = naturalSize?.width ?? 0
    const srcH = naturalSize?.height ?? 0
    if (!(srcW > 0 && srcH > 0)) return { width: maxW, height: maxH }

    const ar = srcW / srcH
    const containerAr = maxW / maxH
    if (containerAr > ar) {
      // Container is wider -> fit by height
      return { width: Math.round(maxH * ar), height: maxH }
    }
    // Container is taller -> fit by width
    return { width: maxW, height: Math.round(maxW / ar) }
  }, [height, isWeb, naturalSize, stageSize, webViewport?.height, webViewport?.width, width])

  const load = useCallback(async () => {
    setPlayUrl(null)
    setPlayUrlKind(null)
    setLoadError(null)

    const resolved = await resolvePlaybackUrl(apiBaseUrl, selectedVideoId)
    setPlayUrl(resolved.url ?? null)
    setPlayUrlKind(resolved.kind)
    setLoadError(resolved.error)
  }, [apiBaseUrl, selectedVideoId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    // Best-effort: prevent screenshots / screen recording while playing.
    void ScreenCapture.preventScreenCaptureAsync().catch(() => {})
    // Allow device orientation changes while in the player.
    void ScreenOrientation.unlockAsync().catch(() => {})

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void videoRef.current?.pauseAsync?.().catch(() => {})
      }
    })

    return () => {
      sub.remove()
      void ScreenCapture.allowScreenCaptureAsync().catch(() => {})
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
    }
  }, [])

  const toggleSub = useCallback(async () => {
    if (!canSubOn) return

    // Keep position when switching files (best-effort).
    let positionMillis = 0
    let shouldPlay = true
    try {
      const status: any = await videoRef.current?.getStatusAsync?.()
      if (status?.isLoaded) {
        positionMillis = typeof status.positionMillis === 'number' ? status.positionMillis : 0
        shouldPlay = Boolean(status.isPlaying)
      }
    } catch {
      // ignore
    }

    setPendingResume({ positionMillis, shouldPlay })
    setSubOn((v) => !v)
  }, [canSubOn])

  const setSubOnValue = useCallback((next: boolean) => {
    if (!canSubOn) return
    if (next === subOn) return
    void toggleSub()
  }, [canSubOn, subOn, toggleSub])

  const showPrePlay = !hasStarted

  const clampMillis = useCallback((millis: number) => {
    const max = playback.durationMillis > 0 ? playback.durationMillis : 0
    return Math.max(0, Math.min(max, Math.floor(millis)))
  }, [playback.durationMillis])

  const setPositionMillis = useCallback(async (millis: number) => {
    const next = clampMillis(millis)
    try {
      const keepPlaying = uiShouldPlay
      // Prefer setStatusAsync to keep play/pause in sync.
      const anyRef: any = videoRef.current as any
      if (typeof anyRef?.setStatusAsync === 'function') {
        await anyRef.setStatusAsync({ positionMillis: next, shouldPlay: keepPlaying })
      } else {
        await videoRef.current?.setPositionAsync?.(next)
        if (keepPlaying) await videoRef.current?.playAsync?.()
      }
    } catch {
      // ignore
    }
  }, [clampMillis, uiShouldPlay])

  const seekRelative = useCallback((deltaMillis: number) => {
    void setPositionMillis(playback.positionMillis + deltaMillis)
  }, [playback.positionMillis, setPositionMillis])

  const togglePlayPause = useCallback(() => {
    const next = !uiShouldPlay
    setUiShouldPlay(next)
    if (next) void videoRef.current?.playAsync?.().catch(() => {})
    else void videoRef.current?.pauseAsync?.().catch(() => {})
  }, [uiShouldPlay])

  const setShouldPlay = useCallback((next: boolean) => {
    if (next) setDidFinish(false)
    setUiShouldPlay(next)
    if (next) void videoRef.current?.playAsync?.().catch(() => {})
    else void videoRef.current?.pauseAsync?.().catch(() => {})
  }, [])

  const scheduleAutoHide = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current)
      autoHideTimerRef.current = null
    }
    autoHideTimerRef.current = setTimeout(() => {
      setControlsVisible(false)
      autoHideTimerRef.current = null
    }, 3000)
  }, [])

  const cancelAutoHide = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current)
      autoHideTimerRef.current = null
    }
  }, [])

  const onStageTap = useCallback(() => {
    if (showPrePlay) return
    if (didFinish) return

    // If controls are hidden, first tap only reveals controls (no surprise pause).
    if (!controlsVisible) {
      setControlsVisible(true)
      if (uiShouldPlay) scheduleAutoHide()
      return
    }

    // If controls are visible, tap toggles play/pause.
    const next = !uiShouldPlay
    setControlsVisible(true)
    setShouldPlay(next)
    if (next) scheduleAutoHide()
    else cancelAutoHide()
  }, [cancelAutoHide, controlsVisible, didFinish, scheduleAutoHide, setShouldPlay, showPrePlay, uiShouldPlay])

  const iconColor = THEME.text
  const iconMutedColor = THEME.textMuted

  const CloseIcon = ({ color = iconColor }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6L18 18" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
      <Path d="M18 6L6 18" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
    </Svg>
  )

  const EyeOffIcon = ({ color = iconColor }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3l18 18"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
      />
      <Path
        d="M10.6 10.7a2 2 0 0 0 2.7 2.7"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
      />
      <Path
        d="M7.6 7.7C5.3 9.2 3.8 11.2 3 12c.9 1 2.8 3.2 5.6 4.8C9.8 17.5 11 18 12 18c.8 0 1.7-.3 2.6-.8"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.5 14.6c.8-.6 1.2-1.5 1.2-2.6 0-1.9-1.6-3.5-3.5-3.5-1 0-2 .4-2.6 1.2"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 6c3.8 0 7.2 2.6 9 6-.4.7-1.1 1.8-2.2 2.9"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )

  const CcIcon = ({ color = iconColor }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke={color}
        strokeWidth={2.25}
        strokeLinejoin="round"
      />
      <Path
        d="M8.6 14.2c-.4.4-.9.6-1.5.6-1.2 0-2.1-1-2.1-2.2 0-1.2.9-2.2 2.1-2.2.6 0 1.1.2 1.5.6"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
      />
      <Path
        d="M17 14.2c-.4.4-.9.6-1.5.6-1.2 0-2.1-1-2.1-2.2 0-1.2.9-2.2 2.1-2.2.6 0 1.1.2 1.5.6"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
      />
    </Svg>
  )

  const ChevronLeftIcon = ({ color = iconColor }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
  const ChevronRightIcon = ({ color = iconColor }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )

  const PlayIcon = ({ color = iconColor }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M10 8l8 4-8 4V8Z" fill={color} />
    </Svg>
  )
  const PauseIcon = ({ color = iconColor }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M7 6h3v12H7V6Z" fill={color} />
      <Path d="M14 6h3v12h-3V6Z" fill={color} />
    </Svg>
  )

  const Replay10Icon = ({ color = iconColor }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M7 7V4L3 8l4 4V9" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 9a8 8 0 1 1 2.3 5.7" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 10v5" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
      <Path d="M15 15v-5l-2 1" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
  const Forward10Icon = ({ color = iconColor }: { color?: string }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M17 7V4l4 4-4 4V9" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 9a8 8 0 1 0-2.3 5.7" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 10v5" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
      <Path d="M15 15v-5l-2 1" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )

  useEffect(() => {
    // Auto-hide controls once playback has started a bit.
    if (!hasStarted) return
    if (!controlsVisible) return
    if (!uiShouldPlay) return
    if (!(playback.positionMillis > 1200)) return
    scheduleAutoHide()
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current)
        autoHideTimerRef.current = null
      }
    }
  }, [controlsVisible, hasStarted, playback.positionMillis, scheduleAutoHide, uiShouldPlay])

  const seekProgress = useMemo(() => {
    const d = playback.durationMillis
    if (!(d > 0)) return 0
    return Math.max(0, Math.min(1, playback.positionMillis / d))
  }, [playback.durationMillis, playback.positionMillis])

  const formatTime = useCallback((millis: number) => {
    const totalSec = Math.max(0, Math.floor(millis / 1000))
    const mm = Math.floor(totalSec / 60)
    const ss = totalSec % 60
    return `${mm}:${String(ss).padStart(2, '0')}`
  }, [])

  return (
    <View
      style={[
        styles.root,
        isWeb && webViewport
          ? (({
              position: 'fixed',
              left: 0,
              top: 0,
              width: webViewport.width,
              height: webViewport.height,
            } as unknown) as any)
          : null,
      ]}
      onLayout={(e) => {
        if (isWeb) return
        const w = e.nativeEvent.layout.width
        const h = e.nativeEvent.layout.height
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
          setStageSize({ width: w, height: h })
        }
      }}
    >
      {/** Use a consistent stage basis for constraints */}
      <View
        ref={videoWrapRef}
        style={[
          styles.videoWrap,
          {
            width: fittedLayout.width,
            height: fittedLayout.height,
            maxWidth: stageSize?.width ?? (isWeb ? webViewport?.width ?? width : width),
            maxHeight: stageSize?.height ?? (isWeb ? webViewport?.height ?? height : height),
          },
        ]}
      >
        {playUrl ? (
          <Video
            key={`${selectedVideoId}:${playUrl}`}
            ref={(el) => {
              videoRef.current = el
            }}
            style={styles.video}
            videoStyle={styles.videoInner}
            source={{ uri: playUrl }}
            useNativeControls={false}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={uiShouldPlay}
            progressUpdateIntervalMillis={250}
            onLoad={() => {
              if (!pendingAutoPlay) return
              setPendingAutoPlay(false)
              void videoRef.current?.playAsync?.().catch(() => {})
            }}
            onReadyForDisplay={(e: any) => {
              const ns = e?.naturalSize
              const w = Number(ns?.width)
              const h = Number(ns?.height)
              if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
                setNaturalSize({ width: w, height: h })
              }
            }}
            onPlaybackStatusUpdate={(status: any) => {
              if (status?.isLoaded) {
                const positionMillis = typeof status.positionMillis === 'number' ? status.positionMillis : 0
                const durationMillis = typeof status.durationMillis === 'number' ? status.durationMillis : 0
                const isPlaying = Boolean(status.isPlaying)
                setPlayback({ isLoaded: true, isPlaying, positionMillis, durationMillis })
                // Keep uiShouldPlay aligned if platform paused/played (buffering, appstate, etc)
                if (typeof status.isPlaying === 'boolean' && status.isPlaying !== uiShouldPlay) {
                  setUiShouldPlay(Boolean(status.isPlaying))
                }

                if (status?.didJustFinish) {
                  setDidFinish(true)
                  setUiShouldPlay(false)
                  cancelAutoHide()
                  setControlsVisible(true)
                }
              } else {
                setPlayback((prev) => ({ ...prev, isLoaded: false }))
              }

              // Capture natural size from status when available (platform-dependent).
              const w = Number(status?.naturalSize?.width ?? status?.videoWidth)
              const h = Number(status?.naturalSize?.height ?? status?.videoHeight)
              if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
                setNaturalSize({ width: w, height: h })
              }

              if (pendingAutoPlay && status?.isLoaded) {
                setPendingAutoPlay(false)
                void videoRef.current?.playAsync?.().catch(() => {})
              }

              if (!pendingResume) return
              if (!status?.isLoaded) return

              const resume = pendingResume
              setPendingResume(null)
              setUiShouldPlay(resume.shouldPlay)
              void (async () => {
                try {
                  await videoRef.current?.setPositionAsync?.(resume.positionMillis)
                  if (resume.shouldPlay) await videoRef.current?.playAsync?.()
                  else await videoRef.current?.pauseAsync?.()
                } catch {
                  // ignore
                }
              })()
            }}
          />
        ) : (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>{loadError ? `再生URL取得に失敗しました（${loadError}）` : '読み込み中…'}</Text>
          </View>
        )}

        {/* Tap stage to toggle play/pause (behind controls) */}
        {hasStarted && playUrl ? (
          <Pressable
            onPress={onStageTap}
            style={StyleSheet.absoluteFillObject}
            accessibilityRole="button"
            accessibilityLabel={uiShouldPlay ? '一時停止' : '再生'}
          />
        ) : null}

        {/* Top bar */}
        {controlsVisible ? (
          <View style={styles.topBar} pointerEvents="box-none">
            <View style={styles.topLeft}>
              <IconButton
                label="閉じる"
                onPress={() => {
                  cancelAutoHide()
                  setControlsVisible(true)
                  onBack()
                }}
              >
                <CloseIcon />
              </IconButton>

              <IconButton
                label="UI非表示"
                onPress={() => {
                  cancelAutoHide()
                  setControlsVisible(false)
                }}
              >
                <EyeOffIcon />
              </IconButton>

              {canSubOn ? (
                <IconButton
                  label={subOn ? '字幕OFF' : '字幕ON'}
                  onPress={() => setSubOnValue(!subOn)}
                >
                  <CcIcon color={subOn ? iconColor : iconMutedColor} />
                </IconButton>
              ) : null}
            </View>

            {(onPrevEpisode || onNextEpisode) ? (
              <View style={styles.topRight}>
                {onPrevEpisode ? (
                  <IconButton
                    label="前のエピソード"
                    disabled={canPrevEpisode === false}
                    onPress={() => {
                      if (canPrevEpisode === false) return
                      setControlsVisible(true)
                      onPrevEpisode()
                    }}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                ) : null}

                {onNextEpisode ? (
                  <IconButton
                    label="次のエピソード"
                    disabled={canNextEpisode === false}
                    onPress={() => {
                      if (canNextEpisode === false) return
                      setControlsVisible(true)
                      onNextEpisode()
                    }}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Custom minimal controls */}
        {hasStarted && playUrl && controlsVisible ? (
          <View style={styles.controlsWrap} pointerEvents="box-none">
            <View style={styles.controlsCard}>
              <View style={styles.controlsRow}>
                <IconButton
                  label="10秒戻る"
                  onPress={() => {
                    setControlsVisible(true)
                    seekRelative(-10_000)
                    if (uiShouldPlay) scheduleAutoHide()
                  }}
                >
                  <Replay10Icon />
                </IconButton>

                <IconButton
                  label={uiShouldPlay ? '一時停止' : '再生'}
                  onPress={() => {
                    setControlsVisible(true)
                    togglePlayPause()
                    const next = !uiShouldPlay
                    if (next) scheduleAutoHide()
                    else cancelAutoHide()
                  }}
                >
                  {uiShouldPlay ? <PauseIcon /> : <PlayIcon />}
                </IconButton>

                <IconButton
                  label="10秒進む"
                  onPress={() => {
                    setControlsVisible(true)
                    seekRelative(10_000)
                    if (uiShouldPlay) scheduleAutoHide()
                  }}
                >
                  <Forward10Icon />
                </IconButton>

                <Text style={styles.timeText}>
                  {formatTime(playback.positionMillis)} / {formatTime(playback.durationMillis)}
                </Text>
              </View>

              <View
                style={styles.seekTrack}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width
                  if (Number.isFinite(w) && w > 0) setSeekBarWidth(w)
                }}
                onStartShouldSetResponder={() => true}
                onResponderGrant={() => {
                  setControlsVisible(true)
                  cancelAutoHide()
                }}
                onResponderRelease={(e: any) => {
                  if (!(seekBarWidth > 0)) return
                  const x = Number(e?.nativeEvent?.locationX)
                  if (!Number.isFinite(x)) return
                  const ratio = Math.max(0, Math.min(1, x / seekBarWidth))
                  const next = ratio * (playback.durationMillis || 0)
                  void setPositionMillis(next)
                  if (uiShouldPlay) scheduleAutoHide()
                }}
              >
                <View style={styles.seekTrackBg} />
                <View
                  style={[
                    styles.seekFill,
                    {
                      width: Math.max(0, Math.min(seekBarWidth, Math.round(seekProgress * seekBarWidth))),
                    },
                  ]}
                />
                <View
                  style={[
                    styles.seekKnob,
                    {
                      left: Math.max(
                        0,
                        Math.min(seekBarWidth - 12, Math.round(seekProgress * seekBarWidth) - 6)
                      ),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* Up next overlay */}
        {hasStarted && playUrl && didFinish ? (
          <View style={styles.upNextWrap} pointerEvents="box-none">
            <View style={styles.upNextCard}>
              <Text style={styles.upNextTitle}>再生終了</Text>

              {onNextEpisode && canNextEpisode !== false ? (
                <View style={styles.upNextRow}>
                  {nextEpisodeThumbnailUrl ? (
                    <Image
                      source={{ uri: nextEpisodeThumbnailUrl }}
                      style={styles.upNextThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.upNextThumbPlaceholder} />
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.upNextLabel}>次のエピソード</Text>
                    <Text style={styles.upNextEpisodeTitle} numberOfLines={2}>
                      {nextEpisodeTitle || '次のエピソード'}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.upNextActions}>
                <SecondaryButton
                  label="閉じる"
                  onPress={() => {
                    onBack()
                  }}
                />

                {onNextEpisode && canNextEpisode !== false ? (
                  <PrimaryButton
                    label="次へ"
                    onPress={() => {
                      setDidFinish(false)
                      onNextEpisode()
                    }}
                    fullWidth={false}
                  />
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {showPrePlay ? (
          <View style={styles.prePlayOverlay}>
            <View style={styles.prePlayCard}>
              <Text style={styles.prePlayTitle}>再生前オプション</Text>
              <Text style={styles.prePlaySub}>字幕を選択して再生を開始してください。</Text>

              <View style={styles.subRow}>
                <SecondaryButton
                  label="字幕なし"
                  onPress={() => setSubOnValue(false)}
                  disabled={subOn === false}
                />
                <View style={styles.gap} />
                <SecondaryButton
                  label="字幕あり"
                  onPress={() => setSubOnValue(true)}
                  disabled={!canSubOn || subOn === true}
                />
              </View>

              <View style={styles.gapH} />
              <PrimaryButton
                label="再生する"
                onPress={() => {
                  setHasStarted(true)
                  // Start playback exactly when the user presses play.
                  setPendingAutoPlay(true)
                  setUiShouldPlay(true)
                  void videoRef.current?.playAsync?.().catch(() => {})
                }}
                disabled={!playUrl || playUrlKind === 'error'}
              />

              {loadError && playUrlKind === 'fallback' ? (
                <Text style={styles.warnText}>
                  ※ Stream の非公開再生設定が未完了のため、テスト動画で再生します（{loadError}）。
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.bg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoWrap: {
    backgroundColor: THEME.bg,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  video: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  videoInner: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  loadingBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.bg,
  },
  loadingText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  topBar: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  showUiWrap: {
    position: 'absolute',
    top: 14,
    left: 14,
  },
  // topBar now uses IconButton
  controlsWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  controlsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    padding: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // bottom controls now use IconButton
  timeText: {
    marginLeft: 'auto',
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  seekTrack: {
    marginTop: 10,
    height: 18,
    justifyContent: 'center',
  },
  seekTrackBg: {
    height: 6,
    borderRadius: 999,
    backgroundColor: THEME.outline,
  },
  seekFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 999,
    backgroundColor: THEME.accent,
  },
  seekKnob: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: THEME.accent,
  },
  prePlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  prePlayCard: {
    width: '100%',
    maxWidth: 828,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    padding: 16,
  },
  prePlayTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  prePlaySub: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gap: {
    width: 10,
  },
  gapH: {
    height: 12,
  },
  warnText: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  hintBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
  },
  hintBarLandscape: {
    maxWidth: 828,
    alignSelf: 'center',
  },
  hintText: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  upNextWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  upNextCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    padding: 14,
  },
  upNextTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upNextThumb: {
    width: 92,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
  },
  upNextThumbPlaceholder: {
    width: 92,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
  },
  upNextLabel: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  upNextEpisodeTitle: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  upNextActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
})
