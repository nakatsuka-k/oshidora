import type { ReactNode } from 'react'
import Svg, { Path } from 'react-native-svg'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type ScreenContainerProps = {
  title?: string
  onBack?: () => void
  scroll?: boolean
  footer?: ReactNode
  headerRight?: ReactNode
  headerLeft?: ReactNode
  maxWidth?: number
  padding?: number
  footerPaddingHorizontal?: number
  backgroundColor?: string
  background?: ReactNode
  children: ReactNode
}

const DEFAULT_MAX_WIDTH = 768

export function ScreenContainer({
  title,
  onBack,
  scroll,
  footer,
  headerRight,
  headerLeft,
  maxWidth,
  padding = 16,
  footerPaddingHorizontal,
  backgroundColor,
  background,
  children,
}: ScreenContainerProps) {
  const resolvedMaxWidth = maxWidth ?? DEFAULT_MAX_WIDTH
  const outerStyle = (opts?: { top?: number; bottom?: number }) => {
    if (padding === 16 && !opts) return styles.contentOuter
    const top = opts?.top ?? padding
    const bottom = opts?.bottom ?? padding
    return {
      paddingLeft: padding,
      paddingRight: padding,
      paddingTop: top,
      paddingBottom: bottom,
      flex: 1,
    } as const
  }

  const headerOuterStyle = (opts?: { top?: number; bottom?: number }) => {
    const top = opts?.top ?? padding
    const bottom = opts?.bottom ?? padding
    return {
      paddingLeft: padding,
      paddingRight: padding,
      paddingTop: top,
      paddingBottom: bottom,
    } as const
  }

  const showHeader = Boolean(onBack || title || headerRight || headerLeft)
  const header = showHeader ? (
    <View style={headerOuterStyle({ bottom: 0 })}>
      <View style={[styles.contentInner, { maxWidth: resolvedMaxWidth }]}>
        <View style={styles.headerRow}>
          {headerLeft ? (
            <View style={styles.headerLeft}>{headerLeft}</View>
          ) : onBack ? (
            <Pressable onPress={onBack} style={styles.headerBack} accessibilityRole="button">
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15.5 5.5 8.5 12l7 6.5"
                  stroke={THEME.text}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          ) : (
            <View style={styles.headerBackSpacer} />
          )}

          <View style={styles.headerTitleWrap}>
            {title ? (
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerRight}>
            {headerRight ?? <View style={styles.headerBackSpacer} />}
          </View>
        </View>
      </View>
    </View>
  ) : null

  const body = (
    <View style={onBack ? outerStyle({ top: 0 }) : outerStyle()}>
      <View style={[styles.contentInner, { maxWidth: resolvedMaxWidth }]}>
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  )

  const footerNode = footer ? (
    <View
      style={[
        styles.footerOuter,
        {
          paddingLeft: typeof footerPaddingHorizontal === 'number' ? footerPaddingHorizontal : padding,
          paddingRight: typeof footerPaddingHorizontal === 'number' ? footerPaddingHorizontal : padding,
        },
      ]}
    >
      <View style={[styles.contentInner, { maxWidth: resolvedMaxWidth }]}>{footer}</View>
    </View>
  ) : null

  if (scroll) {
    return (
      <View style={[styles.root, typeof backgroundColor === 'string' ? { backgroundColor } : null]}>
        {background ? <View pointerEvents="none" style={styles.background} children={background} /> : null}
        {header}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {body}
        </ScrollView>
        {footerNode}
      </View>
    )
  }

  return (
    <View style={[styles.root, typeof backgroundColor === 'string' ? { backgroundColor } : null]}>
      {background ? <View pointerEvents="none" style={styles.background} children={background} /> : null}
      <View style={styles.main}>
        {header}
        {body}
      </View>
      {footerNode}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    backgroundColor: THEME.bg,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  main: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  contentOuter: {
    flex: 1,
    padding: 16,
  },
  contentInner: {
    flexGrow: 1,
    flexShrink: 1,
    width: '100%',
    alignSelf: 'center',
  },
  body: {
    flex: 1,
  },
  footerOuter: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 10,
    minHeight: 44,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  headerBackSpacer: {
    width: 40,
    height: 40,
  },
  headerLeft: {
    minWidth: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
})
