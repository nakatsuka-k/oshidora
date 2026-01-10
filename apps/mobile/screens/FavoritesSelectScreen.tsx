import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, THEME } from '../components'

type Props = {
  onBack: () => void
  onSelectVideos: () => void
  onSelectCasts: () => void
}

export function FavoritesSelectScreen({ onBack, onSelectVideos, onSelectCasts }: Props) {
  return (
    <ScreenContainer title="お気に入り" onBack={onBack}>
      <View style={styles.root}>
        <Text style={styles.lead}>お気に入りの種類を選択してください</Text>

        <View style={styles.card}>
          <Pressable style={styles.row} onPress={onSelectVideos}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>動画のお気に入り</Text>
              <Text style={styles.rowSub}>お気に入り登録した作品・動画の一覧</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <Pressable style={[styles.row, styles.rowLast]} onPress={onSelectCasts}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>キャストのお気に入り</Text>
              <Text style={styles.rowSub}>お気に入り登録したキャストの一覧</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 10,
  },
  lead: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
    gap: 12,
    minHeight: 56,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flex: 1,
  },
  rowTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  rowSub: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  chevron: {
    color: THEME.textMuted,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
    marginTop: -1,
  },
})
