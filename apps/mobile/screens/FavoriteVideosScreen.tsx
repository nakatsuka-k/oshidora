import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, THEME } from '../components'
import { apiFetch, isDebugMockEnabled } from '../utils/api'

type Props = {
  apiBaseUrl: string
  authToken: string | null
  loggedIn: boolean
  onBack: () => void
  onOpenVideo: (id: string) => void
}

type VideoItem = {
  id: string
  title: string
  thumbnailUrl?: string
}

type FavoritesResponse = {
  items: VideoItem[]
}

export function FavoriteVideosScreen({ apiBaseUrl, authToken, loggedIn, onBack, onOpenVideo }: Props) {
  const mockData = useMemo<FavoritesResponse>(() => ({ items: [] }), [])

  const [favorites, setFavorites] = useState<VideoItem[]>(mockData.items)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fallbackUsed, setFallbackUsed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      setFallbackUsed(false)

      if (!loggedIn || !authToken) {
        if (!cancelled) {
          setFavorites([])
          setLoading(false)
        }
        return
      }

      try {
        const res = await apiFetch(`${apiBaseUrl}/api/favorites/videos`, {
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json().catch(() => ({}))) as FavoritesResponse
        const list = Array.isArray(json?.items) ? json.items : []
        if (!cancelled) setFavorites(list)
      } catch (e) {
        if (!cancelled) {
          const mock = await isDebugMockEnabled()
          setFallbackUsed(mock)
          setFavorites(mock ? mockData.items : [])
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, authToken, loggedIn, mockData.items])

  return (
    <ScreenContainer title="お気に入り（動画）" onBack={onBack}>
      <View style={styles.root}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : favorites.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>お気に入り動画がありません</Text>
            <Text style={styles.emptyDesc}>作品・動画の詳細からお気に入り登録してください</Text>
            {!loggedIn ? <Text style={styles.emptyDesc}>ログインするとお気に入り動画を確認できます</Text> : null}
            {error ? <Text style={styles.error}>読み込み失敗{fallbackUsed ? '（モック表示）' : ''}：{error}</Text> : null}
          </View>
        ) : (
          <View style={styles.card}>
            <ScrollView>
              {favorites.map((v, idx) => (
                <Pressable
                  key={`${v.id}_${idx}`}
                  style={[styles.row, idx === favorites.length - 1 ? styles.rowLast : null]}
                  onPress={() => onOpenVideo(v.id)}
                >
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {v.title}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
            {error ? <Text style={styles.error}>読み込み失敗{fallbackUsed ? '（モック表示）' : ''}：{error}</Text> : null}
          </View>
        )}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 10,
  },
  loading: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
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
  rowTitle: {
    flex: 1,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
  },
  chevron: {
    color: THEME.textMuted,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
    marginTop: -1,
  },
  empty: {
    paddingVertical: 8,
  },
  emptyTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  emptyDesc: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  error: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
})
