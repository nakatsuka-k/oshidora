import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type ScreenContainerProps = {
  title?: string
  onBack?: () => void
  scroll?: boolean
  footer?: ReactNode
  maxWidth?: number
  padding?: number
  children: ReactNode
}

export function ScreenContainer({ title, onBack, scroll, footer, maxWidth, padding = 16, children }: ScreenContainerProps) {
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

  const header = onBack ? (
    <View style={headerOuterStyle({ bottom: 0 })}>
      <View style={[styles.contentInner, maxWidth ? { maxWidth } : null]}>
        <View style={styles.headerBackOnly}>
          <Pressable onPress={onBack} style={styles.headerBack}>
            <Text style={styles.headerBackText}>‹</Text>
          </Pressable>
        </View>
      </View>
    </View>
  ) : null

  const body = (
    <View style={onBack ? outerStyle({ top: 0 }) : outerStyle()}>
      <View style={[styles.contentInner, maxWidth ? { maxWidth } : null]}>
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  )

  if (scroll) {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {body}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.main}>
        {header}
        {body}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
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
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  body: {
    flex: 1,
  },
  footer: {
    width: '100%',
  },
  headerBackOnly: {
    paddingVertical: 4,
    marginBottom: 10,
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
})
