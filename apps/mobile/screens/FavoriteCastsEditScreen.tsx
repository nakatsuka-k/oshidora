import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native'
import { CheckboxRow, ScreenContainer, THEME } from '../components'
import { apiFetch } from '../utils/api'
import { type FavoriteCastsEditScreenProps, type Cast, type CastResponse, confirmAction } from '../types/favoriteCastsEditTypes'

export function FavoriteCastsEditScreen({ apiBaseUrl, authToken, loggedIn, onCancel, onDone }: FavoriteCastsEditScreenProps) {
  const [casts, setCasts] = useState<Cast[]>([])
  const [busy, setBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [error, setError] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const selectedCount = selectedIds.size

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
      setSelectedIds(new Set())
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

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleCancel = useCallback(async () => {
    if (selectedCount > 0) {
      const ok = await confirmAction('変更を破棄して戻りますか？')
      if (!ok) return
    }
    onCancel()
  }, [onCancel, selectedCount])

  const handleDone = useCallback(() => {
    onDone()
  }, [onDone])

  const deleteSelected = useCallback(async () => {
    if (selectedCount === 0 || deleteBusy) return

    const ok = await confirmAction(`選択した${selectedCount}件をお気に入りから削除しますか？`)
    if (!ok) return

    const castIds = Array.from(selectedIds)

    setDeleteBusy(true)
    setError('')
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/favorites/casts`, {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ castIds }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setCasts((prev) => prev.filter((c) => !selectedIds.has(c.id)))
      setSelectedIds(new Set())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        window.alert(`削除に失敗しました: ${msg}`)
      } else {
        Alert.alert('エラー', `削除に失敗しました: ${msg}`)
      }
      // Keep selection on failure
    } finally {
      setDeleteBusy(false)
    }
  }, [apiBaseUrl, authToken, deleteBusy, selectedCount, selectedIds])

  const showFooter = casts.length > 0

  return (
    <ScreenContainer
      scroll
      footer={
        showFooter ? (
          <View style={styles.footer}>
            <Text style={styles.footerCount}>選択中：{selectedCount}件</Text>
            <Pressable onPress={clearSelection} style={styles.footerButton} accessibilityRole="button">
              <Text style={styles.footerButtonText}>選択を解除</Text>
            </Pressable>
            <Pressable
              onPress={deleteSelected}
              disabled={selectedCount === 0 || deleteBusy}
              style={[styles.footerButton, styles.deleteButton, selectedCount === 0 || deleteBusy ? styles.disabled : null]}
              accessibilityRole="button"
            >
              <Text style={[styles.footerButtonText, styles.deleteButtonText]}>削除</Text>
            </Pressable>
          </View>
        ) : null
      }
    >
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleCancel} disabled={busy || deleteBusy} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>お気に入りキャスト 編集</Text>
          <Pressable onPress={handleDone} disabled={busy || deleteBusy} style={styles.headerAction} accessibilityRole="button">
            <Text style={styles.headerActionText}>完了</Text>
          </Pressable>
        </View>

        {showLoginPrompt ? <Text style={styles.emptyText}>ログインしてお気に入りキャストを編集してください</Text> : null}

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
            renderItem={({ item }) => {
              const checked = selectedIds.has(item.id)
              return (
                <View style={styles.row}>
                  <CheckboxRow checked={checked} onToggle={() => toggle(item.id)}>
                    <View style={styles.card}>
                      {item.thumbnailUrl ? (
                        <Image source={{ uri: item.thumbnailUrl }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarPlaceholder} />
                      )}
                      <View style={styles.cardText}>
                        <Text style={styles.name} numberOfLines={2}>
                          {item.name}
                        </Text>
                        {item.role ? (
                          <Text style={styles.meta} numberOfLines={1}>
                            {item.role}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </CheckboxRow>
                </View>
              )
            }}
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
    paddingBottom: 90,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.card,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  cardText: {
    flex: 1,
  },
  name: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  meta: {
    color: THEME.textMuted,
    fontSize: 12,
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 12,
    paddingVertical: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
    backgroundColor: THEME.bg,
  },
  footerCount: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
  },
  footerButton: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.card,
  },
  footerButtonText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    borderColor: THEME.outline,
  },
  deleteButtonText: {
    color: THEME.danger,
  },
  disabled: {
    opacity: 0.5,
  },
})
