import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { PagedCarousel, type PagedCarouselController, PrimaryButton, ScreenContainer, THEME } from '../components'

type TutorialScreenProps = {
  onBack?: () => void
  onSkip: () => void
  onDone: () => void
  initialIndex?: number
  onIndexChange?: (index: number) => void
}

type Slide = {
  title: string
  desc: string
  image: ReturnType<typeof require>
}

export function TutorialScreen({ onBack, onSkip, onDone, initialIndex = 0, onIndexChange }: TutorialScreenProps) {
  const { height } = useWindowDimensions()
  const carouselRef = useRef<PagedCarouselController | null>(null)
  const [index, setIndex] = useState(initialIndex)

  const slides = useMemo<Slide[]>(
    () => [
      {
        title: '推しドラを発見',
        desc: 'おすすめやランキングから好みの作品に出会える',
        image: require('../assets/tutorial0.png'),
      },
      {
        title: '作品を購入して視聴',
        desc: 'コインで購入し、いつでも楽しめる',
        image: require('../assets/tutorial1.png'),
      },
      {
        title: 'お気に入り＆通知',
        desc: '推しの新作や更新を見逃さない',
        image: require('../assets/tutorial2.png'),
      },
    ],
    []
  )

  const isLast = index === slides.length - 1
  const canPrev = index > 0

  const imageHeight = Math.max(240, Math.min(Math.round(height * 0.78), 720))

  const setIndexSafe = (next: number) => {
    setIndex(next)
    onIndexChange?.(next)
  }

  useEffect(() => {
    setIndex(initialIndex)
    carouselRef.current?.scrollToIndex(initialIndex, false)
  }, [initialIndex])

  return (
    <ScreenContainer maxWidth={520}>
      <View style={styles.root}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              if (canPrev) {
                const prev = Math.max(index - 1, 0)
                carouselRef.current?.scrollToIndex(prev)
                setIndexSafe(prev)
                return
              }
              onBack?.()
            }}
            style={styles.backButton}
            accessibilityRole="button"
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.topSpacer} />

          <Pressable onPress={onSkip} accessibilityRole="button">
            <Text style={styles.skip}>スキップ</Text>
          </Pressable>
        </View>

        <PagedCarousel
          controllerRef={carouselRef}
          items={slides}
          index={index}
          onIndexChange={setIndexSafe}
          dotsStyle={styles.dots}
          renderItem={(s) => (
            <View style={styles.slide}>
              <Image source={s.image} style={[styles.image, { height: imageHeight }]} resizeMode="contain" />
            </View>
          )}
        />

        <View style={styles.bottom}>
          <View style={styles.bottomRow}>
            <Pressable
              onPress={() => {
                const prev = Math.max(index - 1, 0)
                carouselRef.current?.scrollToIndex(prev)
                setIndexSafe(prev)
              }}
              disabled={!canPrev}
              style={[styles.prevButton, !canPrev ? styles.prevButtonDisabled : null]}
            >
              <Text style={[styles.prevText, !canPrev ? styles.prevTextDisabled : null]}>戻る</Text>
            </Pressable>

            <View style={styles.bottomSpacer} />

            <PrimaryButton
              label={isLast ? 'はじめる' : '次へ'}
              onPress={() => {
                if (isLast) {
                  onDone()
                  return
                }
                const next = Math.min(index + 1, slides.length - 1)
                carouselRef.current?.scrollToIndex(next)
                setIndexSafe(next)
              }}
              fullWidth={false}
            />
          </View>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  topSpacer: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 20,
    backgroundColor: THEME.card,
  },
  backText: {
    color: THEME.text,
    fontSize: 20,
    lineHeight: 20,
  },
  skip: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  slide: {
    flex: 1,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    borderRadius: 0,
    backgroundColor: THEME.placeholder,
  },
  dots: {
    marginTop: 10,
  },
  bottom: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomSpacer: {
    width: 12,
  },
  prevButton: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevButtonDisabled: {
    opacity: 0.5,
  },
  prevText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
  },
  prevTextDisabled: {
    color: THEME.textMuted,
  },
})
