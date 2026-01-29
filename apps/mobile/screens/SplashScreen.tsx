import * as ScreenOrientation from 'expo-screen-orientation'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native'
import { THEME } from '../components'
import { type Props } from '../types/splashScreenTypes'

export function SplashScreen({ videoUri, maxDurationMs = 3000, onDone }: Props) {
  const doneRef = useRef(false)
  const bgOpacity = useRef(new Animated.Value(1)).current
  const contentOpacity = useRef(new Animated.Value(1)).current

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

    const fadeMs = 700
    const startFadeAt = Math.max(0, maxDurationMs - fadeMs)

    const t = setTimeout(() => {
      if (cancelled) return
      const contentFadeDelayMs = 80
      const contentFadeMs = 200

      Animated.parallel([
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: fadeMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(contentFadeDelayMs),
          Animated.timing(contentOpacity, {
            toValue: 0,
            duration: contentFadeMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        if (cancelled) return
        finishOnce()
      })
    }, startFadeAt)

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
    <View style={styles.root} pointerEvents="auto">
      <StatusBar hidden />
      <Animated.View style={[styles.bg, { opacity: bgOpacity }]} />
      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        {videoUri && Platform.OS === 'web' ? (
          <View style={[styles.videoWrap, styles.videoWrapWeb]}>
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
          </View>
        ) : (
          <View style={styles.logoWrap}>
            <Image source={require('../assets/oshidora-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    elevation: 9999,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.bg,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: '100%',
    maxWidth: 768,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    width: '70%',
    maxWidth: 260,
    aspectRatio: 260 / 120,
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
})
