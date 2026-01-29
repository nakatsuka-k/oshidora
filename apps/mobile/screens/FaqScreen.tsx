import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, THEME } from '../components'
import type { FaqScreenProps } from '../types/faqScreenTypes'
import { FAQ_ITEMS } from '../types/faqScreenTypes'

export function FaqScreen({ onBack }: FaqScreenProps) {
  return (
    <ScreenContainer title="よくある質問" onBack={onBack} scroll>
      <View style={styles.root}>
        <Text style={styles.lead}>よくあるご質問をまとめました。</Text>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {FAQ_ITEMS.map((item) => (
            <View key={item.q} style={styles.card}>
              <Text style={styles.q}>Q. {item.q}</Text>
              <View style={styles.divider} />
              <Text style={styles.a}>A. {item.a}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 4,
  },
  lead: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    paddingBottom: 12,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  q: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 20,
  },
  a: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.divider,
    marginVertical: 10,
  },
})
