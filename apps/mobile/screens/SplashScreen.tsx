import { ResizeMode, Video } from 'expo-av'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useEffect, useMemo, useRef } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { THEME } from '../components'

type Props = {
  videoUri: string
  maxDurationMs?: number
  onDone: () => void
}

export function SplashScreen({ videoUri, maxDurationMs = 3000, onDone }: Props) {
  const doneRef = useRef(false)
  const videoRef = useRef<Video | null>(null)

  const finishOnce = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  const shouldMute = useMemo(() => true, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        // Fixed orientation while splash is shown (spec: does not follow rotation).
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
      } catch {
        // ignore
      }
    })()

    const t = setTimeout(() => {
      if (cancelled) return
      finishOnce()
    }, Math.max(0, maxDurationMs))

    return () => {
      cancelled = true
      clearTimeout(t)
      void (async () => {
        try {
          await ScreenOrientation.unlockAsync()
        } catch {
          // ignore
        }
      })()
    }
  }, [maxDurationMs])

  return (
    <View style={styles.root}>
      <View style={styles.videoWrap}>
        <Video
          ref={(el) => {
            videoRef.current = el
          }}
          style={styles.video}
          source={{ uri: videoUri }}
          // Keep the full frame visible, centered within the container.
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping={false}
          useNativeControls={false}
          isMuted={shouldMute}
          volume={0}
          // Web autoplay generally requires muted+inline.
          // @ts-expect-error (web-only prop)
          playsInline={Platform.OS === 'web'}
          onPlaybackStatusUpdate={(status: any) => {
            if (!status?.isLoaded) return
            if (status.didJustFinish) {
              finishOnce()
            }
          }}
          onError={() => {
            // If video fails, proceed to next screen (spec: do not block).
            finishOnce()
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoWrap: {
    width: '100%',
    maxWidth: 828,
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
})
