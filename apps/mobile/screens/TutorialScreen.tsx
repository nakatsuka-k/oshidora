import { useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { PrimaryButton, ScreenContainer, THEME } from '../components'

type TutorialScreenProps = {
  onSkip: () => void
  onDone: () => void
}

type Slide = {
  title: string
  desc: string
}

export function TutorialScreen({ onSkip, onDone }: TutorialScreenProps) {
  const { width } = useWindowDimensions()
  const scrollRef = useRef<ScrollView | null>(null)
  const [index, setIndex] = useState(0)

  const slides = useMemo<Slide[]>(
    () => [
      { title: '推しドラを発見', desc: 'おすすめやランキングから好みの作品に出会える' },
      { title: '作品を購入して視聴', desc: 'コインで購入し、いつでも楽しめる' },
      { title: 'お気に入り＆通知', desc: '推しの新作や更新を見逃さない' },
    ],
    []
  )

  const isLast = index === slides.length - 1

  return (
    <ScreenContainer title="チュートリアル">
      <View style={styles.root}>
        <View style={styles.topRight}>
          <Pressable onPress={onSkip}>
            <Text style={styles.skip}>スキップ</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={(r) => {
            scrollRef.current = r
          }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / width)
            setIndex(next)
          }}
          style={styles.scroll}
        >
          {slides.map((s, i) => (
            <View key={s.title} style={[styles.slide, { width }]}>
              <View style={styles.image} />
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.desc}>{s.desc}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>

        <View style={styles.bottom}>
          <PrimaryButton
            label={isLast ? 'はじめる' : '次へ'}
            onPress={() => {
              if (isLast) {
                onDone()
                return
              }
              const next = Math.min(index + 1, slides.length - 1)
              scrollRef.current?.scrollTo({ x: next * width, animated: true })
              setIndex(next)
            }}
          />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topRight: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  skip: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 220,
    height: 160,
    borderRadius: 16,
    backgroundColor: THEME.placeholder,
    marginBottom: 24,
  },
  title: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  desc: {
    color: THEME.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.outline,
  },
  dotActive: {
    backgroundColor: THEME.accent,
  },
  bottom: {
    paddingTop: 8,
    paddingBottom: 8,
  },
})
