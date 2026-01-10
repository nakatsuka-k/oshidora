import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type ScreenContainerProps = {
  title?: string
  onBack?: () => void
  scroll?: boolean
  footer?: ReactNode
  headerRight?: ReactNode
  maxWidth?: number
  padding?: number
  children: ReactNode
}

const DEFAULT_MAX_WIDTH = 828

export function ScreenContainer({ title, onBack, scroll, footer, headerRight, maxWidth, padding = 16, children }: ScreenContainerProps) {
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

  const showHeader = Boolean(onBack || title || headerRight)
  const header = showHeader ? (
    <View style={headerOuterStyle({ bottom: 0 })}>
      <View style={[styles.contentInner, { maxWidth: resolvedMaxWidth }]}>
        <View style={styles.headerRow}>
          {onBack ? (
            <Pressable onPress={onBack} style={styles.headerBack} accessibilityRole="button">
              <Text style={styles.headerBackText}>‹</Text>
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
    <View style={[styles.footerOuter, { paddingLeft: padding, paddingRight: padding }]}> 
      <View style={[styles.contentInner, { maxWidth: resolvedMaxWidth }]}>{footer}</View>
    </View>
  ) : null

  if (scroll) {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {body}
        </ScrollView>
        {footerNode}
      </View>
    )
  }

  return (
    <View style={styles.root}>
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
    backgroundColor: THEME.bg,
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
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 20,
    backgroundColor: THEME.card,
  },
  headerBackText: {
    color: THEME.text,
    fontSize: 20,
    lineHeight: 20,
  },
  headerBackSpacer: {
    width: 40,
    height: 40,
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
