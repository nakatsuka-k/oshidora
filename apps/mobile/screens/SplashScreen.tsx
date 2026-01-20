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
      <View style={[styles.videoWrap, Platform.OS === 'web' ? styles.videoWrapWeb : null]}>
        {Platform.OS === 'web' ? (
          // Use a native <video> on web to reliably center the content.
          // react-native-web's style mapping doesn't always apply object-position to the <video> element.
          <video
            src={videoUri}
            autoPlay
            playsInline
            muted={shouldMute}
            controls={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center center',
              overflow: 'hidden',
              display: 'block',
            }}
            onEnded={() => finishOnce()}
            onError={() => finishOnce()}
          />
        ) : (
          <Video
            style={styles.video}
            source={{ uri: videoUri }}
            // Keep the full frame visible, centered within the container.
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping={false}
            useNativeControls={false}
            isMuted={shouldMute}
            volume={0}
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
        )}
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
    flex: 1,
  },
  videoWrapWeb: {
    maxWidth: 768,
    alignSelf: 'center',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  video: {
    width: '100%',
    height: '100%',
  },
})
