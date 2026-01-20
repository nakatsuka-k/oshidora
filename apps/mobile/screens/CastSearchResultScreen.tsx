import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { NoticeBellButton, RowItem, ScreenContainer, TabBar, THEME } from '../components'
import { apiFetch } from '../utils/api'

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type CastSearchResultScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  keyword: string
  onBack: () => void
  onOpenProfile: (cast: { id: string; name: string; role: string }) => void
  onOpenNotice?: () => void
}

type Cast = {
  id: string
  name: string
  role: string
  thumbnailUrl?: string
}

type CastResponse = { items: Cast[] }

export function CastSearchResultScreen({ apiBaseUrl, onPressTab, keyword, onBack, onOpenProfile, onOpenNotice }: CastSearchResultScreenProps) {
  const q = useMemo(() => keyword.trim(), [keyword])

  const [casts, setCasts] = useState<Cast[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fetchResults = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const u = new URL(`${apiBaseUrl}/v1/cast`)
      if (q) u.searchParams.set('q', q)
      const res = await apiFetch(u.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CastResponse
      setCasts(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setCasts([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, q])

  useEffect(() => {
    void fetchResults()
  }, [fetchResults])

  return (
    <ScreenContainer
      title="検索結果"
      onBack={onBack}
      headerRight={onOpenNotice ? <NoticeBellButton onPress={onOpenNotice} /> : undefined}
      footer={<TabBar active="cast" onPress={onPressTab} />}
      footerPaddingHorizontal={0}
      maxWidth={768}
    >
      <View style={styles.root}>
        <Text style={styles.keyword} numberOfLines={2}>
          {q ? `「${q}」の検索結果` : 'キーワードを入力してください'}
        </Text>

        {error ? <Text style={styles.error}>通信に失敗しました: {error}</Text> : null}

        {busy ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={casts}
            keyExtractor={(c) => c.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <RowItem
                title={item.name}
                subtitle={item.role}
                actionLabel="詳しく"
                onAction={() => {
                  onOpenProfile({ id: item.id, name: item.name, role: item.role })
                }}
              />
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>該当するキャストが見つかりません</Text>}
          />
        )}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyword: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },
  error: {
    color: THEME.danger,
    fontSize: 12,
    marginBottom: 10,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 12,
    paddingVertical: 14,
  },
})
