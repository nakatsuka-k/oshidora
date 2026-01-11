import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { RowItem, ScreenContainer, THEME } from '../components'
import { apiFetch } from '../utils/api'

type FavoriteCastsScreenProps = {
  apiBaseUrl: string
  authToken: string
  loggedIn: boolean
  onBack: () => void
  onEdit: () => void
  onOpenProfile: (cast: { id: string; name: string; role: string }) => void
}

type Cast = {
  id: string
  name: string
  role: string
  thumbnailUrl?: string
}

type CastResponse = { items: Cast[] }

export function FavoriteCastsScreen({ apiBaseUrl, authToken, loggedIn, onBack, onEdit, onOpenProfile }: FavoriteCastsScreenProps) {
  const [casts, setCasts] = useState<Cast[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canFetch = useMemo(() => !!authToken.trim(), [authToken])
  const showLoginPrompt = useMemo(() => !loggedIn, [loggedIn])

  const fetchFavorites = useCallback(async () => {
    if (!canFetch) return
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/favorites/casts`, {
        headers: { authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CastResponse
      setCasts(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setCasts([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, authToken, canFetch])

  useEffect(() => {
    void fetchFavorites()
  }, [fetchFavorites])

  return (
    <ScreenContainer scroll>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>お気に入りキャスト</Text>
          <Pressable onPress={onEdit} style={styles.headerAction} accessibilityRole="button">
            <Text style={styles.headerActionText}>編集</Text>
          </Pressable>
        </View>

        {showLoginPrompt ? <Text style={styles.emptyText}>ログインしてお気に入りキャストを確認してください</Text> : null}

        {error ? <Text style={styles.error}>通信に失敗しました: {error}</Text> : null}

        {busy ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={casts}
            keyExtractor={(c) => c.id}
            showsVerticalScrollIndicator={Platform.OS !== 'web'}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <RowItem
                title={item.name}
                subtitle={item.role}
                actionLabel="詳しく"
                onAction={() => onOpenProfile({ id: item.id, name: item.name, role: item.role })}
              />
            )}
            ListEmptyComponent={
              loggedIn ? <Text style={styles.emptyText}>お気に入りキャストがありません</Text> : null
            }
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 6,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 20,
    backgroundColor: THEME.card,
  },
  backText: {
    color: THEME.text,
    fontSize: 20,
    lineHeight: 20,
  },
  headerTitle: {
    flex: 1,
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerAction: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: THEME.card,
  },
  headerActionText: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '800',
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
