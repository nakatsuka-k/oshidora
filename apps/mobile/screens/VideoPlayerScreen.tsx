import { ResizeMode, Video } from 'expo-av'
import * as ScreenCapture from 'expo-screen-capture'
import * as ScreenOrientation from 'expo-screen-orientation'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { PrimaryButton, SecondaryButton, THEME } from '../components'
import { isDebugMockEnabled } from '../utils/api'

type Props = {
  apiBaseUrl: string
  videoIdNoSub: string
  videoIdWithSub?: string | null
  onBack: () => void
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

export function VideoPlayerScreen({ apiBaseUrl, videoIdNoSub, videoIdWithSub, onBack }: Props) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const isWeb = Platform.OS === 'web'

  const canSubOn = Boolean(videoIdWithSub && videoIdWithSub.trim().length > 0)

  const [subOn, setSubOn] = useState(false)
  const selectedVideoId = useMemo(() => {
    if (subOn && canSubOn) return (videoIdWithSub as string)
    return videoIdNoSub
  }, [canSubOn, subOn, videoIdNoSub, videoIdWithSub])

  const [hasStarted, setHasStarted] = useState(false)
  const [fullscreenRequested, setFullscreenRequested] = useState(false)

  const [pendingResume, setPendingResume] = useState<{
    positionMillis: number
    shouldPlay: boolean
  } | null>(null)

  const [playUrl, setPlayUrl] = useState<string | null>(null)
  const [playToken, setPlayToken] = useState<string | null>(null)
  const [playUrlKind, setPlayUrlKind] = useState<'signed-hls' | 'signed-mp4' | 'hls' | 'mp4' | 'fallback' | 'error' | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const videoRef = useRef<Video | null>(null)
  const videoWrapRef = useRef<any>(null)

  const requestFullscreen = useCallback(() => {
    // Best-effort fullscreen. Web APIs require a user gesture.
    if (Platform.OS === 'web') {
      const el = videoWrapRef.current as any
      const fn = el?.requestFullscreen || el?.webkitRequestFullscreen || el?.msRequestFullscreen
      if (typeof fn === 'function') {
        try {
          void fn.call(el)
        } catch {
          // ignore
        }
      }
      return
    }

    try {
      // expo-av: present native fullscreen player (best-effort).
      void (videoRef.current as any)?.presentFullscreenPlayer?.()
    } catch {
      // ignore
    }
  }, [])

  const load = useCallback(async () => {
    setPlayUrl(null)
    setPlayToken(null)
    setPlayUrlKind(null)
    setLoadError(null)

    const resolved = await resolvePlaybackUrl(apiBaseUrl, selectedVideoId)
    setPlayUrl(resolved.url ?? null)
    setPlayToken(resolved.token || null)
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

  const showPrePlay = !hasStarted

  return (
    <View style={[styles.root, isWeb ? { width, height } : null]}>
      <StatusBar hidden />
      <View ref={videoWrapRef} style={[styles.videoWrap, isWeb ? { width, height } : null]}>
        {playUrl ? (
          <Video
            key={`${selectedVideoId}:${playUrl}`}
            ref={(el) => {
              videoRef.current = el
            }}
            style={styles.video}
            source={{ uri: playUrl }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={hasStarted}
            onPlaybackStatusUpdate={(status: any) => {
              if (fullscreenRequested && status?.isLoaded) {
                setFullscreenRequested(false)
                requestFullscreen()
              }

              if (!pendingResume) return
              if (!status?.isLoaded) return

              const resume = pendingResume
              setPendingResume(null)
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

        {/* Overlay controls (minimal) */}
        <View style={styles.topBar}>
          <Pressable onPress={onBack} style={styles.topButton}>
            <Text style={styles.topButtonText}>戻る</Text>
          </Pressable>
        </View>

        {showPrePlay ? (
          <View style={styles.prePlayOverlay}>
            <View style={styles.prePlayCard}>
              <Text style={styles.prePlayTitle}>再生前オプション</Text>
              <Text style={styles.prePlaySub}>字幕を選択して再生を開始してください。</Text>

              <View style={styles.subRow}>
                <SecondaryButton
                  label="字幕なし"
                  onPress={() => setSubOn(false)}
                  disabled={subOn === false}
                />
                <View style={styles.gap} />
                <SecondaryButton
                  label="字幕あり"
                  onPress={() => setSubOn(true)}
                  disabled={!canSubOn || subOn === true}
                />
              </View>

              <View style={styles.gapH} />
              <PrimaryButton
                label="再生する"
                onPress={() => {
                  setFullscreenRequested(true)
                  setHasStarted(true)
                  requestFullscreen()
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
  },
  videoWrap: {
    flex: 1,
    backgroundColor: THEME.bg,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  video: {
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
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
  },
  topButtonDisabled: {
    opacity: 0.5,
  },
  topButtonText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
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
})
