import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type ScreenContainerProps = {
  title?: string
  onBack?: () => void
  scroll?: boolean
  children: ReactNode
}

export function ScreenContainer({ title, onBack, scroll, children }: ScreenContainerProps) {
  const content = (
    <View style={styles.content}>
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
  )

  if (scroll) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
        {content}
      </ScrollView>
    )
  }

  return <View style={styles.root}>{content}</View>
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  body: {
    flex: 1,
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
