import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type ScreenContainerProps = {
  title?: string
  onBack?: () => void
  scroll?: boolean
  footer?: ReactNode
  maxWidth?: number
  children: ReactNode
}

export function ScreenContainer({ title, onBack, scroll, footer, maxWidth, children }: ScreenContainerProps) {
  const content = (
    <View style={styles.contentOuter}>
      <View style={[styles.contentInner, maxWidth ? { maxWidth } : null]}>
        {title ? (
          <View style={styles.headerBar}>
            {onBack ? (
              <Pressable onPress={onBack} style={styles.headerBack}>
                <Text style={styles.headerBackText}>‹</Text>
              </Pressable>
            ) : (
              <View style={styles.headerRightSpace} />
            )}
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.headerRightSpace} />
          </View>
        ) : null}
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  )

  if (scroll) {
    return (
      <View style={styles.root}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {content}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.main}>{content}</View>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 16,
  },
  headerBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 22,
    backgroundColor: THEME.card,
  },
  headerBackText: {
    color: THEME.text,
    fontSize: 22,
    lineHeight: 22,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '600',
  },
  headerRightSpace: {
    width: 44,
    height: 44,
  },
})
