import { ResizeMode, Video } from 'expo-av'
import * as ScreenCapture from 'expo-screen-capture'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { PrimaryButton, SecondaryButton, THEME } from '../components'

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
  const signed = await fetchJson<{ hlsUrl?: string }>(
    `${apiBaseUrl}/v1/stream/signed-playback/${encodeURIComponent(videoId)}`
  )
  if (signed.ok && signed.data?.hlsUrl) {
    return { url: signed.data.hlsUrl, kind: 'signed-hls' as const, error: null as string | null }
  }

  const info = await fetchJson<{ hlsUrl?: string; mp4Url?: string }>(
    `${apiBaseUrl}/v1/stream/playback/${encodeURIComponent(videoId)}`
  )
  if (info.ok) {
    if (info.data?.hlsUrl) return { url: info.data.hlsUrl, kind: 'hls' as const, error: null as string | null }
    if (info.data?.mp4Url) return { url: info.data.mp4Url, kind: 'mp4' as const, error: null as string | null }
  }

  const status = signed.ok ? null : signed.status
  const reason = status === 500 ? 'stream_not_configured' : status === 401 ? 'unauthorized' : status === -1 ? 'network' : 'stream_error'
  return { url: PUBLIC_FALLBACK_TEST_VIDEO_MP4, kind: 'fallback' as const, error: reason }
}

export function VideoPlayerScreen({ apiBaseUrl, videoIdNoSub, videoIdWithSub, onBack }: Props) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const canSubOn = Boolean(videoIdWithSub && videoIdWithSub.trim().length > 0)

  const [subOn, setSubOn] = useState(false)
  const selectedVideoId = useMemo(() => {
    if (subOn && canSubOn) return (videoIdWithSub as string)
    return videoIdNoSub
  }, [canSubOn, subOn, videoIdNoSub, videoIdWithSub])

  const [hasStarted, setHasStarted] = useState(false)

  const [pendingResume, setPendingResume] = useState<{
    positionMillis: number
    shouldPlay: boolean
  } | null>(null)

  const [playUrl, setPlayUrl] = useState<string | null>(null)
  const [playUrlKind, setPlayUrlKind] = useState<'signed-hls' | 'hls' | 'mp4' | 'fallback' | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const videoRef = useRef<Video | null>(null)

  const load = useCallback(async () => {
    setPlayUrl(null)
    setPlayUrlKind(null)
    setLoadError(null)

    const resolved = await resolvePlaybackUrl(apiBaseUrl, selectedVideoId)
    setPlayUrl(resolved.url)
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
    <View style={styles.root}>
      <View style={styles.videoWrap}>
        {playUrl ? (
          <Video
            key={`${selectedVideoId}:${playUrl}`}
            ref={(el) => {
              videoRef.current = el
            }}
            style={StyleSheet.absoluteFill}
            source={{ uri: playUrl }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={hasStarted}
            onPlaybackStatusUpdate={(status: any) => {
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
            <Text style={styles.loadingText}>読み込み中…</Text>
          </View>
        )}

        {/* Overlay controls (minimal) */}
        <View style={styles.topBar}>
          <Pressable onPress={onBack} style={styles.topButton}>
            <Text style={styles.topButtonText}>戻る</Text>
          </Pressable>

          <View style={styles.topRight}>
            <Pressable onPress={toggleSub} style={[styles.topButton, !canSubOn ? styles.topButtonDisabled : null]}>
              <Text style={styles.topButtonText}>{subOn ? '字幕あり' : '字幕なし'}</Text>
            </Pressable>
          </View>
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
              <PrimaryButton label="再生する" onPress={() => setHasStarted(true)} />

              {loadError ? (
                <Text style={styles.warnText}>
                  ※ Stream の非公開再生設定が未完了のため、テスト動画で再生します（{loadError}）。
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {Platform.OS === 'web' ? (
          <View style={[styles.hintBar, isLandscape ? styles.hintBarLandscape : null]}>
            <Text style={styles.hintText}>回転で縦横に自動追従します</Text>
            {playUrlKind ? <Text style={styles.hintText}>source: {playUrlKind}</Text> : null}
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
  },
  videoWrap: {
    flex: 1,
    backgroundColor: THEME.bg,
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
    maxWidth: 520,
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
    maxWidth: 520,
    alignSelf: 'center',
  },
  hintText: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
})
