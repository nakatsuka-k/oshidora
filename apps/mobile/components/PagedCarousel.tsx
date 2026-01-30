import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native'
import { THEME } from './theme'
import { useWebDragToScroll } from '../utils/useWebDragToScroll'

export type PagedCarouselController = {
  scrollToIndex: (index: number, animated?: boolean) => void
}

type PagedCarouselProps<TItem> = {
  items: TItem[]
  index: number
  onIndexChange: (index: number) => void
  height?: number
  renderItem: (item: TItem, index: number, pageWidth: number) => ReactNode
  containerStyle?: StyleProp<ViewStyle>
  dotsStyle?: StyleProp<ViewStyle>
  controllerRef?: MutableRefObject<PagedCarouselController | null>
}

export function PagedCarousel<TItem>({
  items,
  index,
  onIndexChange,
  height,
  renderItem,
  containerStyle,
  dotsStyle,
  controllerRef,
}: PagedCarouselProps<TItem>) {
  const { width } = useWindowDimensions()
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const pageWidth = Math.max(1, containerWidth ?? width)

  const drag = useWebDragToScroll({ suppressPressMs: 250 })
  const scrollRef = drag.scrollRef
  const lastReportedIndexRef = useRef<number>(index)

  const safeIndex = useMemo(() => {
    if (items.length <= 0) return 0
    return Math.max(0, Math.min(index, items.length - 1))
  }, [index, items.length])

  const scrollToIndex = (nextIndex: number, animated = true) => {
    const clamped = Math.max(0, Math.min(nextIndex, Math.max(0, items.length - 1)))
    scrollRef.current?.scrollTo({ x: clamped * pageWidth, animated })
  }

  useEffect(() => {
    if (!controllerRef) return
    controllerRef.current = { scrollToIndex }
    return () => {
      controllerRef.current = null
    }
  }, [controllerRef, pageWidth, items.length])

  useEffect(() => {
    // Keep position in sync when parent updates index.
    // Avoid animation to prevent jitter on initial mount.
    scrollToIndex(safeIndex, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, pageWidth])

  useEffect(() => {
    lastReportedIndexRef.current = safeIndex
  }, [safeIndex])

  const onLayout = (e: LayoutChangeEvent) => {
    const nextWidth = Math.round(e.nativeEvent.layout.width)
    if (!Number.isFinite(nextWidth) || nextWidth <= 0) return
    setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth))
  }

  return (
    <View onLayout={onLayout} style={[styles.root, containerStyle, height ? { height } : null]}>
      <ScrollView
        ref={(r) => {
          scrollRef.current = r
        }}
        horizontal
        pagingEnabled
        snapToInterval={pageWidth}
        decelerationRate="fast"
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        style={[styles.scroll, Platform.OS === 'web' ? ({ cursor: 'grab' } as any) : null]}
        {...(Platform.OS === 'web'
          ? ({ onMouseDownCapture: drag.onMouseDown, onPointerDownCapture: drag.onPointerDown } as any)
          : null)}
        onStartShouldSetResponderCapture={drag.shouldSetResponderCapture}
        onResponderGrant={drag.onResponderGrant}
        onScroll={(e) => {
          drag.onScroll(e)
          const x = e?.nativeEvent?.contentOffset?.x
          if (typeof x !== 'number') return
          const next = Math.round(x / pageWidth)
          const clamped = Math.max(0, Math.min(next, Math.max(0, items.length - 1)))
          if (clamped !== lastReportedIndexRef.current) {
            lastReportedIndexRef.current = clamped
            onIndexChange(clamped)
          }
        }}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth)
          onIndexChange(next)
        }}
      >
        {items.map((item, i) => (
          <View key={i} style={[styles.page, { width: pageWidth }]}>
            {renderItem(item, i, pageWidth)}
          </View>
        ))}
      </ScrollView>

      {items.length > 1 ? (
        <View style={[styles.dots, dotsStyle]}>
          {items.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => {
                onIndexChange(i)
                scrollToIndex(i)
              }}
              hitSlop={10}
              style={[styles.dot, i === safeIndex ? styles.dotActive : null]}
              accessibilityRole="button"
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.outline,
  },
  dotActive: {
    backgroundColor: THEME.accent,
  },
})
