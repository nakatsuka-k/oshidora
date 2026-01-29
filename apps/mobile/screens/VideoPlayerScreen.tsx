import { ResizeMode, Video } from 'expo-av'
import * as ScreenCapture from 'expo-screen-capture'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { PrimaryButton, SecondaryButton, THEME } from '../components'
import {
  parseVttTimestampToMs,
  parseVttCues,
  findActiveCueText,
  deriveStreamSubtitleUrl,
  proxyStreamSubtitleUrl,
  fetchJson,
  applyQualityToPlaybackUrl,
  resolvePlaybackUrl,
  type VttCue,
  type QualityValue,
} from '../utils/videoPlayerUtils'
import IconArrow from '../assets/icon_arrow.svg'
import IconCheck from '../assets/icon_check.svg'
import IconClose from '../assets/icon_close.svg'
import IconEpisode from '../assets/icon_episode.svg'
import IconFavoriteOff from '../assets/icon_favorite_off.svg'
import IconFavoriteOn from '../assets/icon_favorite_on.svg'
import IconPause from '../assets/icon_pause.svg'
import IconPlayBlack from '../assets/icon_play_black.svg'
import IconPlay from '../assets/icon_play_white.svg'
import IconShare from '../assets/icon_share.svg'
import IconSkipBack from '../assets/icon_skipback10s.svg'
import IconSkipForward from '../assets/icon_skipforward10s.svg'
import IconSubtitleOff from '../assets/icon_subtitle_off.svg'
import IconSubtitleOn from '../assets/icon_subtitle_on.svg'
import IconSetting from '../assets/setting-icon.svg'
import IconSound from '../assets/sound-icon.svg'

type Props = {
  apiBaseUrl: string
  authToken?: string
  videoIdNoSub: string
  videoIdWithSub?: string | null
  onBack: () => void
  currentEpisodeTitle?: string | null
  nextEpisodeTitle?: string | null
  nextEpisodeThumbnailUrl?: string | null
  onPrevEpisode?: () => void
  onNextEpisode?: () => void
  canPrevEpisode?: boolean
  canNextEpisode?: boolean
}

export function VideoPlayerScreen({
  apiBaseUrl,
  authToken,
  videoIdNoSub,
  videoIdWithSub,
  onBack,
  currentEpisodeTitle,
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

  const envSubtitleUrl = useMemo(() => {
    return (process.env.EXPO_PUBLIC_SUBTITLE_VTT_URL || '').trim()
  }, [])

  const hasAltSubVideo = Boolean(videoIdWithSub && videoIdWithSub.trim().length > 0 && videoIdWithSub !== videoIdNoSub)

  const [subOn, setSubOn] = useState(Boolean(envSubtitleUrl))
  const [showSubtitleModal, setShowSubtitleModal] = useState(false)
  const selectedVideoId = useMemo(() => {
    if (subOn && hasAltSubVideo) return (videoIdWithSub as string)
    return videoIdNoSub
  }, [hasAltSubVideo, subOn, videoIdNoSub, videoIdWithSub])

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
  const [volumeBarWidth, setVolumeBarWidth] = useState(0)
  const [volume, setVolume] = useState<number>(1)

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
  const [playUrlKind, setPlayUrlKind] = useState<'signed-hls' | 'signed-mp4' | 'signed-iframe' | 'hls' | 'mp4' | 'iframe' | 'error' | 'unsigned-hls' | 'unsigned-mp4' | 'unsigned-iframe' | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [resolvedSubtitleUrl, setResolvedSubtitleUrl] = useState<string>('')

  const [webIframeTried, setWebIframeTried] = useState(false)
  const isIframePlayback = isWeb && (playUrlKind === 'signed-iframe' || playUrlKind === 'iframe')

  const subtitleTrackUrlRaw = envSubtitleUrl || resolvedSubtitleUrl
  const subtitleProxyBaseUrl = useMemo(() => {
    const env = String(process.env.EXPO_PUBLIC_SUBTITLE_PROXY_BASE_URL || '').trim()
    return env || apiBaseUrl
  }, [apiBaseUrl])
  const subtitleTrackUrl = useMemo(() => {
    if (!subtitleTrackUrlRaw) return ''
    if (!isWeb) return subtitleTrackUrlRaw
    return proxyStreamSubtitleUrl({ proxyBaseUrl: subtitleProxyBaseUrl, subtitleUrl: subtitleTrackUrlRaw })
  }, [isWeb, subtitleProxyBaseUrl, subtitleTrackUrlRaw])
  const canSubOn = Boolean(hasAltSubVideo || subtitleTrackUrl)

  const vttCacheRef = useRef<{ url: string; cues: VttCue[] } | null>(null)
  const [vttCues, setVttCues] = useState<VttCue[] | null>(null)
  const [vttLoading, setVttLoading] = useState(false)

  const [captureWarning, setCaptureWarning] = useState<string>('')

  const [isFavorite, setIsFavorite] = useState(false)
  const playbackRates = useMemo(() => [0.5, 0.75, 1.0, 1.25, 1.5], [])
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showPlaybackRateModal, setShowPlaybackRateModal] = useState(false)

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showQualityModal, setShowQualityModal] = useState(false)
  const qualityOptions = useMemo(
    () => [
      { value: 'auto' as const, label: '自動（推奨）' },
      { value: 'high' as const, label: '高画質' },
      { value: 'saver' as const, label: 'データセーバー' },
    ],
    []
  )
  const [quality, setQuality] = useState<(typeof qualityOptions)[number]['value']>('auto')

  const effectivePlayUrl = useMemo(() => {
    if (!playUrl) return null
    return applyQualityToPlaybackUrl(playUrl, quality)
  }, [playUrl, quality])

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
    setWebIframeTried(false)
    setResolvedSubtitleUrl('')

    const resolved = await resolvePlaybackUrl(apiBaseUrl, selectedVideoId, authToken, {
      // On web, HLS playback is not supported by most browsers (except Safari) without hls.js.
      // Prefer MP4 for widest compatibility.
      preferMp4: Platform.OS === 'web',
    })
    setPlayUrl(resolved.url ?? null)
    setPlayUrlKind(resolved.kind)
    setLoadError(resolved.error)

    if (
      resolved.url &&
      (resolved.kind === 'signed-hls' ||
        resolved.kind === 'signed-mp4' ||
        resolved.kind === 'signed-iframe' ||
        resolved.kind === 'hls' ||
        resolved.kind === 'mp4' ||
        resolved.kind === 'iframe')
    ) {
      setResolvedSubtitleUrl(
        deriveStreamSubtitleUrl({
          playbackUrl: resolved.url,
          fallbackVideoId: selectedVideoId,
        })
      )
    }
  }, [apiBaseUrl, authToken, selectedVideoId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    // Best-effort: prevent screenshots / screen recording while playing.
    void ScreenCapture.preventScreenCaptureAsync().catch(() => {})

    // Best-effort: prevent content snapshots from appearing in the app switcher.
    // (Especially useful on iOS where full capture prevention is limited.)
    void ScreenCapture.enableAppSwitcherProtectionAsync?.(0.5).catch(() => {})

    // Allow device orientation changes while in the player.
    void ScreenOrientation.unlockAsync().catch(() => {})

    // Best-effort: react to screenshots (can’t block the already-taken screenshot).
    // NOTE: On web, expo-screen-capture may expose the API but crash internally (no native module).
    let screenshotSub: any = null
    if (Platform.OS !== 'web') {
      void (async () => {
        try {
          const ok = await ScreenCapture.isAvailableAsync?.().catch(() => false)
          if (!ok) return
          screenshotSub = ScreenCapture.addScreenshotListener?.(() => {
            setCaptureWarning('画面キャプチャはできません')
            void videoRef.current?.pauseAsync?.().catch(() => {})
            setTimeout(() => {
              setCaptureWarning('')
            }, 2500)
          })
        } catch {
          // ignore
        }
      })()
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void videoRef.current?.pauseAsync?.().catch(() => {})
      }
    })

    return () => {
      sub.remove()
      try {
        if (screenshotSub?.remove) screenshotSub.remove()
        else if (screenshotSub) ScreenCapture.removeScreenshotListener?.(screenshotSub)
      } catch {
        // ignore
      }
      void ScreenCapture.allowScreenCaptureAsync().catch(() => {})
      void ScreenCapture.disableAppSwitcherProtectionAsync?.().catch(() => {})
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

  const setQualityValue = useCallback(
    async (next: QualityValue) => {
      if (next === quality) return

      // Keep position when switching manifest parameters (best-effort).
      let positionMillis = 0
      let shouldPlay = uiShouldPlay
      try {
        const status: any = await videoRef.current?.getStatusAsync?.()
        if (status?.isLoaded) {
          positionMillis = typeof status.positionMillis === 'number' ? status.positionMillis : 0
          shouldPlay = typeof status.isPlaying === 'boolean' ? Boolean(status.isPlaying) : uiShouldPlay
        }
      } catch {
        // ignore
      }

      setPendingResume({ positionMillis, shouldPlay })
      setQuality(next)
    },
    [quality, uiShouldPlay]
  )

  const setSubOnValue = useCallback((next: boolean) => {
    if (!canSubOn) return
    if (next === subOn) return
    if (hasAltSubVideo) {
      void toggleSub()
      return
    }
    setSubOn(next)
  }, [canSubOn, hasAltSubVideo, subOn, toggleSub])

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

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((prev) => {
      const idx = playbackRates.findIndex((r) => r === prev)
      const next = playbackRates[(idx + 1) % playbackRates.length]
      return next
    })
  }, [playbackRates])

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

  useEffect(() => {
    void videoRef.current?.setRateAsync?.(playbackRate, true).catch(() => {})
  }, [playbackRate])

  useEffect(() => {
    const next = Math.max(0, Math.min(1, Number(volume)))
    const anyRef: any = videoRef.current as any
    if (typeof anyRef?.setVolumeAsync === 'function') {
      void anyRef.setVolumeAsync(next).catch(() => {})
      return
    }
    if (typeof anyRef?.setStatusAsync === 'function') {
      void anyRef.setStatusAsync({ volume: next }).catch(() => {})
    }
  }, [volume])

  useEffect(() => {
    if (!envSubtitleUrl) return
    setSubOn(true)
  }, [envSubtitleUrl])

  useEffect(() => {
    // When using separate subtitle-baked video, no VTT overlay is needed.
    // However, on web, native text tracks are not consistently supported by expo-av.
    // As a fallback, still attempt VTT overlay even if `videoIdWithSub` exists.
    if (!subOn) {
      setVttCues(null)
      setVttLoading(false)
      return
    }
    if (hasAltSubVideo && !isWeb) {
      setVttCues(null)
      setVttLoading(false)
      return
    }
    const url = String(subtitleTrackUrl || '').trim()
    if (!url) {
      setVttCues(null)
      setVttLoading(false)
      return
    }

    if (vttCacheRef.current?.url === url) {
      setVttCues(vttCacheRef.current.cues)
      setVttLoading(false)
      return
    }

    let mounted = true
    setVttLoading(true)
    void (async () => {
      try {
        if (Platform.OS === 'web') {
          // eslint-disable-next-line no-console
          console.info('[subtitle] vtt fetch start', { url })
        }

        const res = await fetch(url)
        if (!res.ok) {
          if (Platform.OS === 'web') {
            // eslint-disable-next-line no-console
            console.warn('[subtitle] vtt fetch http error', {
              url,
              status: res.status,
              statusText: (res as any)?.statusText,
            })
          }
          throw new Error(`vtt_http_${res.status}`)
        }

        const text = await res.text()
        const cues = parseVttCues(text)
        if (Platform.OS === 'web') {
          // eslint-disable-next-line no-console
          console.info('[subtitle] vtt fetch ok', { url, bytes: text.length, cues: cues.length })
        }
        if (!mounted) return
        vttCacheRef.current = { url, cues }
        setVttCues(cues)
      } catch {
        if (Platform.OS === 'web') {
          // eslint-disable-next-line no-console
          console.warn('[subtitle] vtt fetch failed', { url })
        }
        if (!mounted) return
        setVttCues([])
      } finally {
        if (!mounted) return
        setVttLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [hasAltSubVideo, isWeb, subOn, subtitleTrackUrl])

  const activeSubtitleText = useMemo(() => {
    if (!subOn) return null
    if (!vttCues) return null
    if (!playback.isLoaded) return null
    return findActiveCueText(vttCues, playback.positionMillis)
  }, [playback.isLoaded, playback.positionMillis, subOn, vttCues])

  useEffect(() => {
    // Auto-hide controls once playback has started a bit.
    if (!hasStarted) return
    if (!controlsVisible) return
    if (!uiShouldPlay) return
    scheduleAutoHide()
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current)
        autoHideTimerRef.current = null
      }
    }
  }, [controlsVisible, hasStarted, scheduleAutoHide, uiShouldPlay])

  const seekProgress = useMemo(() => {
    const d = playback.durationMillis
    if (!(d > 0)) return 0
    return Math.max(0, Math.min(1, playback.positionMillis / d))
  }, [playback.durationMillis, playback.positionMillis])

  const volumeProgress = useMemo(() => {
    return Math.max(0, Math.min(1, Number(volume)))
  }, [volume])

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
        {...(isWeb
          ? ({
              // Web best-effort: stop trivial right-click/save flows (not a real protection).
              onContextMenu: (e: any) => {
                e?.preventDefault?.()
              },
            } as any)
          : null)}
      >
        {effectivePlayUrl ? (
          isIframePlayback ? (
            <iframe
              key={`${selectedVideoId}:${effectivePlayUrl}`}
              src={effectivePlayUrl}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          ) : (
            <Video
              key={`${selectedVideoId}:${effectivePlayUrl}`}
              ref={(el) => {
                videoRef.current = el
              }}
              style={styles.video}
              videoStyle={styles.videoInner}
              source={{ uri: effectivePlayUrl }}
              {...(subtitleTrackUrl
                ? ({
                    textTracks: [
                      {
                        title: '日本語',
                        language: 'ja',
                        type: 'text/vtt',
                        uri: subtitleTrackUrl,
                      },
                    ],
                    selectedTextTrack: subOn ? { type: 'language', value: 'ja' } : { type: 'disabled' },
                  } as any)
                : null)}
              useNativeControls={false}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={uiShouldPlay}
              progressUpdateIntervalMillis={250}
              onError={async () => {
                // Web resiliency:
                // - MP4 downloads may be disabled on Stream, which results in 404.
                // - If MP4 fails, try HLS; if HLS fails too, fall back to Stream iframe.
                if (!isWeb) return

                try {
                  if (playUrlKind === 'signed-mp4' || playUrlKind === 'mp4') {
                    const resolved = await resolvePlaybackUrl(apiBaseUrl, selectedVideoId, authToken, { preferMp4: false })
                    if (resolved.url) {
                      setPlayUrl(resolved.url)
                      setPlayUrlKind(resolved.kind)
                      setLoadError(null)
                      if (
                        resolved.url &&
                        (resolved.kind === 'signed-hls' ||
                          resolved.kind === 'signed-mp4' ||
                          resolved.kind === 'signed-iframe' ||
                          resolved.kind === 'hls' ||
                          resolved.kind === 'mp4' ||
                          resolved.kind === 'iframe')
                      ) {
                        setResolvedSubtitleUrl(
                          deriveStreamSubtitleUrl({
                            playbackUrl: resolved.url,
                            fallbackVideoId: selectedVideoId,
                          })
                        )
                      } else {
                        setResolvedSubtitleUrl('')
                      }
                      return
                    }
                  }

                  if ((playUrlKind === 'signed-hls' || playUrlKind === 'hls') && !webIframeTried) {
                    setWebIframeTried(true)
                    const resolved = await resolvePlaybackUrl(apiBaseUrl, selectedVideoId, authToken, { preferIframe: true })
                    if (resolved.url) {
                      setUiShouldPlay(false)
                      setPlayUrl(resolved.url)
                      setPlayUrlKind(resolved.kind)
                      setLoadError(null)
                      if (
                        resolved.url &&
                        (resolved.kind === 'signed-hls' ||
                          resolved.kind === 'signed-mp4' ||
                          resolved.kind === 'signed-iframe' ||
                          resolved.kind === 'hls' ||
                          resolved.kind === 'mp4' ||
                          resolved.kind === 'iframe')
                      ) {
                        setResolvedSubtitleUrl(
                          deriveStreamSubtitleUrl({
                            playbackUrl: resolved.url,
                            fallbackVideoId: selectedVideoId,
                          })
                        )
                      } else {
                        setResolvedSubtitleUrl('')
                      }
                      return
                    }
                  }
                } catch {
                  // ignore
                }
              }}
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
          )
        ) : (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>{loadError ? `再生URL取得に失敗しました（${loadError}）` : '読み込み中…'}</Text>
          </View>
        )}

        {captureWarning ? (
          <View pointerEvents="none" style={styles.captureWarningLayer}>
            <Text style={styles.captureWarningText}>{captureWarning}</Text>
          </View>
        ) : null}

        {hasStarted && playUrl && !uiShouldPlay && !isIframePlayback ? (
          <View pointerEvents="none" style={styles.pauseDim} />
        ) : null}

        {subOn && (!hasAltSubVideo || isWeb) && !isIframePlayback && (activeSubtitleText || vttLoading) ? (
          <View pointerEvents="none" style={styles.subtitleOverlay}>
            <Text style={styles.subtitleOverlayText}>
              {activeSubtitleText || (vttLoading ? '字幕を読み込み中…' : '')}
            </Text>
          </View>
        ) : null}

        {/* Tap stage to toggle play/pause (behind controls) */}
        {hasStarted && playUrl && !isIframePlayback ? (
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
            <Pressable
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="戻る"
              onPress={() => {
                cancelAutoHide()
                setControlsVisible(true)
                onBack()
              }}
            >
              <IconArrow width={18} height={18} />
            </Pressable>
            <Text style={styles.topTitle} numberOfLines={1}>
              {currentEpisodeTitle || '動画タイトル'}
            </Text>
          </View>
        ) : null}

        {hasStarted && playUrl && !uiShouldPlay ? (
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']}
            locations={[0, 1]}
            style={styles.pauseTitleGradient}
            pointerEvents="none"
          />
        ) : null}

        {/* Right actions */}
        {controlsVisible && !showPrePlay && !isIframePlayback ? (
          <View style={styles.sideActions} pointerEvents="box-none">
            <Pressable style={styles.sideAction} accessibilityRole="button" accessibilityLabel="エピソード">
              <IconEpisode width={20} height={20} />
              <Text style={styles.sideActionText}>エピソード</Text>
            </Pressable>
            <Pressable style={styles.sideAction} accessibilityRole="button" accessibilityLabel="共有">
              <IconShare width={20} height={20} />
              <Text style={styles.sideActionText}>共有する</Text>
            </Pressable>
            <Pressable
              style={styles.sideAction}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'お気に入り済み' : 'お気に入り'}
              onPress={() => setIsFavorite((v) => !v)}
            >
              {isFavorite ? <IconFavoriteOn width={20} height={20} /> : <IconFavoriteOff width={20} height={20} />}
              <Text style={styles.sideActionText}>お気に入り</Text>
            </Pressable>
            <Pressable
              style={styles.sideAction}
              accessibilityRole="button"
              accessibilityLabel="設定"
              onPress={() => {
                setControlsVisible(true)
                cancelAutoHide()
                setShowSettingsModal(true)
              }}
            >
              <IconSetting width={20} height={20} />
              <Text style={styles.sideActionText}>設定</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Center controls */}
        {hasStarted && playUrl && controlsVisible && !isIframePlayback ? (
          <View style={styles.centerControls} pointerEvents="box-none">
            <Pressable
              style={styles.centerButton}
              accessibilityRole="button"
              accessibilityLabel="10秒戻る"
              onPress={() => {
                setControlsVisible(true)
                seekRelative(-10_000)
                if (uiShouldPlay) scheduleAutoHide()
              }}
            >
              <IconSkipBack width={28} height={28} />
            </Pressable>

            <Pressable
              style={styles.playButton}
              accessibilityRole="button"
              accessibilityLabel={uiShouldPlay ? '一時停止' : '再生'}
              onPress={() => {
                setControlsVisible(true)
                togglePlayPause()
                const next = !uiShouldPlay
                if (next) scheduleAutoHide()
                else cancelAutoHide()
              }}
            >
              {uiShouldPlay ? <IconPause width={44} height={44} /> : <IconPlay width={44} height={44} />}
            </Pressable>

            <Pressable
              style={styles.centerButton}
              accessibilityRole="button"
              accessibilityLabel="10秒進む"
              onPress={() => {
                setControlsVisible(true)
                seekRelative(10_000)
                if (uiShouldPlay) scheduleAutoHide()
              }}
            >
              <IconSkipForward width={28} height={28} />
            </Pressable>
          </View>
        ) : null}

        {/* Bottom controls */}
        {hasStarted && playUrl && controlsVisible && !isIframePlayback ? (
          <View style={styles.bottomControls} pointerEvents="box-none">
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

            <View style={styles.seekMetaRow}>
              <View style={styles.volumeGroup}>
                <IconSound width={22} height={22} />
                <View
                  style={styles.volumeTrack}
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width
                    if (Number.isFinite(w) && w > 0) setVolumeBarWidth(w)
                  }}
                  onStartShouldSetResponder={() => true}
                  onResponderGrant={() => {
                    setControlsVisible(true)
                    cancelAutoHide()
                  }}
                  onResponderRelease={(e: any) => {
                    if (!(volumeBarWidth > 0)) return
                    const x = Number(e?.nativeEvent?.locationX)
                    if (!Number.isFinite(x)) return
                    const ratio = Math.max(0, Math.min(1, x / volumeBarWidth))
                    setVolume(ratio)
                    if (uiShouldPlay) scheduleAutoHide()
                  }}
                >
                  <View style={styles.volumeTrackBg} />
                  <View
                    style={[
                      styles.volumeFill,
                      {
                        width: Math.max(0, Math.min(volumeBarWidth, Math.round(volumeProgress * volumeBarWidth))),
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.volumeKnob,
                      {
                        left: Math.max(0, Math.min(volumeBarWidth - 10, Math.round(volumeProgress * volumeBarWidth) - 5)),
                      },
                    ]}
                  />
                </View>
              </View>

              <Text style={styles.timeLabel}>
                {formatTime(playback.positionMillis)} / {formatTime(playback.durationMillis)}
              </Text>
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

        {showSubtitleModal ? (
          <View style={styles.subtitleModalWrap} pointerEvents="box-none">
            <Pressable
              style={styles.subtitleModalScrim}
              onPress={() => {
                setShowSubtitleModal(false)
                if (uiShouldPlay) scheduleAutoHide()
              }}
            />
            <View style={styles.subtitleModalCard}>
              <View style={styles.subtitleModalHeader}>
                <Pressable
                  style={styles.modalBack}
                  accessibilityRole="button"
                  accessibilityLabel="設定に戻る"
                  onPress={() => {
                    setShowSubtitleModal(false)
                    setShowSettingsModal(true)
                  }}
                >
                  <IconArrow width={16} height={16} />
                </Pressable>
                <Text style={styles.subtitleModalTitle}>字幕</Text>
                <Pressable
                  style={styles.subtitleModalClose}
                  accessibilityRole="button"
                  accessibilityLabel="閉じる"
                  onPress={() => {
                    setShowSubtitleModal(false)
                    if (uiShouldPlay) scheduleAutoHide()
                  }}
                >
                  <IconClose width={16} height={16} />
                </Pressable>
              </View>

              <Pressable
                style={styles.subtitleOption}
                accessibilityRole="button"
                accessibilityLabel="字幕オフ"
                onPress={() => {
                  setSubOnValue(false)
                  setShowSubtitleModal(false)
                  if (uiShouldPlay) scheduleAutoHide()
                }}
              >
                <View style={styles.subtitleOptionLeft}>
                  {subOn === false ? (
                    <IconCheck width={12} height={12} />
                  ) : (
                    <View style={styles.subtitleOptionIconPlaceholder} />
                  )}
                  <Text style={styles.subtitleOptionText}>オフ</Text>
                </View>
              </Pressable>

              <Pressable
                style={[styles.subtitleOption, !canSubOn && styles.subtitleOptionDisabled]}
                accessibilityRole="button"
                accessibilityLabel="日本語(字幕ガイド)"
                onPress={() => {
                  if (!canSubOn) return
                  setSubOnValue(true)
                  setShowSubtitleModal(false)
                  if (uiShouldPlay) scheduleAutoHide()
                }}
                disabled={!canSubOn}
              >
                <View style={styles.subtitleOptionLeft}>
                  {subOn === true ? (
                    <IconCheck width={12} height={12} />
                  ) : (
                    <View style={styles.subtitleOptionIconPlaceholder} />
                  )}
                  <Text style={styles.subtitleOptionText}>日本語(字幕ガイド)</Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}

        {showPlaybackRateModal ? (
          <View style={styles.rateModalWrap} pointerEvents="box-none">
            <Pressable
              style={styles.rateModalScrim}
              onPress={() => {
                setShowPlaybackRateModal(false)
                if (uiShouldPlay) scheduleAutoHide()
              }}
            />
            <View style={styles.rateModalCard}>
              <View style={styles.rateModalHeader}>
                <Pressable
                  style={styles.modalBack}
                  accessibilityRole="button"
                  accessibilityLabel="設定に戻る"
                  onPress={() => {
                    setShowPlaybackRateModal(false)
                    setShowSettingsModal(true)
                  }}
                >
                  <IconArrow width={16} height={16} />
                </Pressable>
                <Text style={styles.rateModalTitle}>再生速度</Text>
                <Pressable
                  style={styles.rateModalClose}
                  accessibilityRole="button"
                  accessibilityLabel="閉じる"
                  onPress={() => {
                    setShowPlaybackRateModal(false)
                    if (uiShouldPlay) scheduleAutoHide()
                  }}
                >
                  <IconClose width={16} height={16} />
                </Pressable>
              </View>

              {playbackRates.map((rate) => {
                const isActive = rate === playbackRate
                const label = `${rate.toFixed(2).replace(/\.00$/, '')}x${rate === 1 ? '（標準）' : ''}`
                return (
                  <Pressable
                    key={`rate-${rate}`}
                    style={styles.rateOption}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    onPress={() => {
                      setPlaybackRate(rate)
                      setShowPlaybackRateModal(false)
                      if (uiShouldPlay) scheduleAutoHide()
                    }}
                  >
                    <View style={styles.rateOptionLeft}>
                      {isActive ? <IconCheck width={12} height={12} /> : <View style={styles.rateOptionIconPlaceholder} />}
                      <Text style={styles.rateOptionText}>{label}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : null}

        {showSettingsModal ? (
          <View style={styles.settingsModalWrap} pointerEvents="box-none">
            <Pressable
              style={styles.settingsModalScrim}
              onPress={() => {
                setShowSettingsModal(false)
                if (uiShouldPlay) scheduleAutoHide()
              }}
            />
            <View style={styles.settingsModalCard}>
              <View style={styles.settingsModalHeader}>
                <View style={styles.modalBack} />
                <Text style={styles.settingsModalTitle}>設定</Text>
                <Pressable
                  style={styles.settingsModalClose}
                  accessibilityRole="button"
                  accessibilityLabel="閉じる"
                  onPress={() => {
                    setShowSettingsModal(false)
                    if (uiShouldPlay) scheduleAutoHide()
                  }}
                >
                  <IconClose width={16} height={16} />
                </Pressable>
              </View>

              <Pressable
                style={styles.settingsOption}
                accessibilityRole="button"
                accessibilityLabel="字幕"
                onPress={() => {
                  setShowSettingsModal(false)
                  setShowSubtitleModal(true)
                }}
              >
                <Text style={styles.settingsOptionText}>字幕</Text>
                <View style={styles.settingsOptionRight}>
                  <Text style={styles.settingsOptionValue}>{subOn ? '日本語(字幕ガイド)' : 'オフ'}</Text>
                  <Text style={styles.settingsOptionChevron}>›</Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.settingsOption}
                accessibilityRole="button"
                accessibilityLabel="画質"
                onPress={() => {
                  setShowSettingsModal(false)
                  setShowQualityModal(true)
                }}
              >
                <Text style={styles.settingsOptionText}>画質</Text>
                <View style={styles.settingsOptionRight}>
                  <Text style={styles.settingsOptionValue}>
                    {qualityOptions.find((o) => o.value === quality)?.label ?? '自動（推奨）'}
                  </Text>
                  <Text style={styles.settingsOptionChevron}>›</Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.settingsOption}
                accessibilityRole="button"
                accessibilityLabel="再生速度"
                onPress={() => {
                  setShowSettingsModal(false)
                  setShowPlaybackRateModal(true)
                }}
              >
                <Text style={styles.settingsOptionText}>再生速度</Text>
                <View style={styles.settingsOptionRight}>
                  <Text style={styles.settingsOptionValue}>{`${playbackRate.toFixed(2).replace(/\.00$/, '')}x`}</Text>
                  <Text style={styles.settingsOptionChevron}>›</Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}

        {showQualityModal ? (
          <View style={styles.qualityModalWrap} pointerEvents="box-none">
            <Pressable
              style={styles.qualityModalScrim}
              onPress={() => {
                setShowQualityModal(false)
                if (uiShouldPlay) scheduleAutoHide()
              }}
            />
            <View style={styles.qualityModalCard}>
              <View style={styles.qualityModalHeader}>
                <Pressable
                  style={styles.modalBack}
                  accessibilityRole="button"
                  accessibilityLabel="設定に戻る"
                  onPress={() => {
                    setShowQualityModal(false)
                    setShowSettingsModal(true)
                  }}
                >
                  <IconArrow width={16} height={16} />
                </Pressable>
                <Text style={styles.qualityModalTitle}>画質</Text>
                <Pressable
                  style={styles.qualityModalClose}
                  accessibilityRole="button"
                  accessibilityLabel="閉じる"
                  onPress={() => {
                    setShowQualityModal(false)
                    if (uiShouldPlay) scheduleAutoHide()
                  }}
                >
                  <IconClose width={16} height={16} />
                </Pressable>
              </View>

              {qualityOptions.map((opt) => {
                const isActive = opt.value === quality
                return (
                  <Pressable
                    key={`quality-${opt.value}`}
                    style={styles.qualityOption}
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                    onPress={() => {
                      void setQualityValue(opt.value as QualityValue)
                      setShowQualityModal(false)
                      if (uiShouldPlay) scheduleAutoHide()
                    }}
                  >
                    <View style={styles.qualityOptionLeft}>
                      {isActive ? <IconCheck width={12} height={12} /> : <View style={styles.qualityOptionIconPlaceholder} />}
                      <Text style={styles.qualityOptionText}>{opt.label}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : null}

        {showPrePlay ? (
          <View style={styles.prePlayOverlay} pointerEvents="box-none">
            <View style={styles.prePlayScrim} pointerEvents="none" />
            <LinearGradient
              colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0)']}
              locations={[0, 1]}
              style={styles.prePlayTopGradient}
              pointerEvents="none"
            />
            <View style={styles.prePlayCard} pointerEvents="auto">
              <Pressable
                style={styles.prePlayClose}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
                hitSlop={10}
                onPress={() => {
                  setHasStarted(true)
                  setPendingAutoPlay(true)
                  setUiShouldPlay(true)
                  setControlsVisible(false)
                  cancelAutoHide()
                  void videoRef.current?.playAsync?.().catch(() => {})
                }}
              >
                <IconClose width={16} height={16} />
              </Pressable>
              <Text style={styles.prePlayTitle}>再生前オプション</Text>
              <Text style={styles.prePlaySub}>字幕を選択して再生を開始してください。</Text>

              <View style={styles.prePlayOptions}>
                <Pressable
                  style={styles.prePlayOption}
                  accessibilityRole="button"
                  accessibilityLabel="字幕なし"
                  onPress={() => setSubOnValue(false)}
                  disabled={subOn === false}
                >
                  <View style={styles.prePlayOptionLeft}>
                    {subOn === false ? <IconCheck width={10} height={10} /> : <View style={styles.prePlayOptionIconPlaceholder} />}
                    <Text style={styles.prePlayOptionText}>字幕なし</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.prePlayOption}
                  accessibilityRole="button"
                  accessibilityLabel="字幕あり"
                  onPress={() => setSubOnValue(true)}
                  disabled={!canSubOn || subOn === true}
                >
                  <View style={styles.prePlayOptionLeft}>
                    {subOn === true ? <IconCheck width={10} height={10} /> : <View style={styles.prePlayOptionIconPlaceholder} />}
                    <Text style={styles.prePlayOptionText}>字幕あり</Text>
                  </View>
                </Pressable>
              </View>

              <Pressable
                style={styles.prePlayButton}
                accessibilityRole="button"
                accessibilityLabel="再生する"
                onPress={() => {
                  setHasStarted(true)
                  // Start playback exactly when the user presses play.
                  setPendingAutoPlay(true)
                  setUiShouldPlay(true)
                  setControlsVisible(false)
                  cancelAutoHide()
                  void videoRef.current?.playAsync?.().catch(() => {})
                }}
                disabled={!playUrl || playUrlKind === 'error'}
              >
                {isWeb ? (
                  <View style={styles.prePlayButtonBlur}>
                    <View style={styles.prePlayButtonInner}>
                      <IconPlayBlack width={16} height={16} />
                      <Text style={styles.prePlayButtonText}>再生する</Text>
                    </View>
                  </View>
                ) : (
                  <BlurView intensity={35} tint="dark" style={styles.prePlayButtonBlur}>
                    <View style={styles.prePlayButtonInner}>
                      <IconPlayBlack width={16} height={16} />
                      <Text style={styles.prePlayButtonText}>再生する</Text>
                    </View>
                  </BlurView>
                )}
              </Pressable>

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
  captureWarningLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  captureWarningText: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '900',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pauseDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  subtitleOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 98,
    alignItems: 'center',
    zIndex: 3,
  },
  subtitleOverlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
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
    alignItems: 'center',
    zIndex: 3,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  sideActions: {
    position: 'absolute',
    right: 14,
    top: '56%',
    alignItems: 'center',
    gap: 18,
  },
  sideAction: {
    alignItems: 'center',
    gap: 6,
  },
  sideActionText: {
    color: THEME.text,
    fontSize: 10,
    fontWeight: '700',
  },
  centerControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
  },
  centerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateButton: {
    minWidth: 60,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
  },
  rateText: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '800',
  },
  timeLabel: {
    color: THEME.text,
    fontSize: 12,
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
    backgroundColor: 'rgba(255,255,255,0.25)',
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
  seekMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  volumeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 12,
  },
  volumeTrack: {
    width: 140,
    height: 16,
    justifyContent: 'center',
  },
  volumeTrackBg: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  volumeFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 999,
    backgroundColor: THEME.text,
  },
  volumeKnob: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: THEME.text,
  },
  subtitleModalWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 3,
  },
  subtitleModalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  subtitleModalCard: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  subtitleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subtitleModalTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  subtitleModalClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBack: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitleOption: {
    paddingVertical: 12,
  },
  subtitleOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subtitleOptionText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
  },
  subtitleOptionIconPlaceholder: {
    width: 12,
    height: 12,
  },
  subtitleOptionDisabled: {
    opacity: 0.4,
  },
  rateModalWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 3,
  },
  rateModalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  rateModalCard: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  rateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rateModalTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  rateModalClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateOption: {
    paddingVertical: 12,
  },
  rateOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rateOptionText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rateOptionIconPlaceholder: {
    width: 12,
    height: 12,
  },

  settingsModalWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 3,
  },
  settingsModalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  settingsModalCard: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  settingsModalTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  settingsModalClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsOption: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsOptionText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '700',
  },
  settingsOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsOptionValue: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  settingsOptionChevron: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 20,
    fontWeight: '900',
    marginTop: -1,
  },

  qualityModalWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 3,
  },
  qualityModalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  qualityModalCard: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  qualityModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  qualityModalTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  qualityModalClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityOption: {
    paddingVertical: 12,
  },
  qualityOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qualityOptionText: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
  },
  qualityOptionIconPlaceholder: {
    width: 12,
    height: 12,
  },
  prePlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  prePlayScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    pointerEvents: 'none',
  },
  prePlayTopGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 120,
    zIndex: 0,
  },
  prePlayCard: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    position: 'relative',
    zIndex: 2,
  },
  prePlayClose: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    elevation: 3,
  },
  prePlayTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
  },
  prePlaySub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
  },
  prePlayOptions: {
    gap: 8,
  },
  prePlayOption: {
    paddingVertical: 6,
  },
  prePlayOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prePlayOptionIconPlaceholder: {
    width: 10,
    height: 10,
  },
  prePlayOptionText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
  },
  prePlayButton: {
    marginTop: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  prePlayButtonBlur: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 176, 27, 0.92)',
    shadowColor: '#F4B01B',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pauseTitleGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 120,
    zIndex: 1,
  },
  prePlayButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prePlayButtonText: {
    color: '#1B1B1B',
    fontSize: 14,
    fontWeight: '900',
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
    maxWidth: 768,
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
