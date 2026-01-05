import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type SectionProps = {
  title: string
  children: ReactNode
}

export function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
    paddingTop: 16,
    marginTop: 16,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionBody: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
  },
})
