import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Platform, Pressable, StyleSheet, Text, View, Alert } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { clearWatchHistory, loadWatchHistory, removeWatchHistoryItem, saveWatchHistory, WatchHistoryItem } from '../utils/watchHistory'
import { type Props, pad2, formatMmSs, formatYmd, confirmAction } from '../types/videoWatchHistoryTypes'

const FALLBACK_THUMB = require('../assets/thumbnail-sample.png')

function TrashIconButton({ onPress }: { onPress: (e?: any) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="削除"
      onPress={onPress}
      style={styles.iconBtn}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M9 3h6l1 2h5v2H3V5h5l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9Zm-1 12h12a2 2 0 0 0 2-2V9H4v11a2 2 0 0 0 2 2Z"
          fill={THEME.accent}
        />
      </Svg>
    </Pressable>
  )
}

export function VideoWatchHistoryScreen({ userKey, onBack, onOpenVideo, onGoVideos }: Props) {
  const [items, setItems] = useState<WatchHistoryItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const loaded = await loadWatchHistory(userKey)
      setItems(loaded)
    } catch (e) {
      setItems([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [userKey])

  useEffect(() => {
    void load()
  }, [load])

  const deleteOne = useCallback(async (id: string) => {
    const ok = await confirmAction('この履歴を削除しますか？')
    if (!ok) return

    try {
      const next = await removeWatchHistoryItem(userKey, id)
      setItems(next)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        window.alert(`削除に失敗しました: ${msg}`)
      } else {
        Alert.alert('エラー', `削除に失敗しました: ${msg}`)
      }
    }
  }, [userKey])

  const deleteAll = useCallback(async () => {
    if (items.length === 0) return
    const ok = await confirmAction('視聴履歴をすべて削除します。よろしいですか？')
    if (!ok) return

    try {
      await clearWatchHistory(userKey)
      setItems([])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        window.alert(`削除に失敗しました: ${msg}`)
      } else {
        Alert.alert('エラー', `削除に失敗しました: ${msg}`)
      }
    }
  }, [items.length, userKey])

  const footer = useMemo(() => {
    if (busy) return null
    if (items.length === 0) return null

    return (
      <View style={styles.footer}>
        <Pressable onPress={deleteAll} style={styles.deleteAllBtn} accessibilityRole="button">
          <Text style={styles.deleteAllText}>履歴をすべて削除</Text>
        </Pressable>
      </View>
    )
  }, [busy, deleteAll, items.length])

  return (
    <ScreenContainer scroll>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>視聴履歴</Text>
          <View style={styles.headerRight} />
        </View>

        {error ? <Text style={styles.error}>通信に失敗しました: {error}</Text> : null}

        {busy ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>視聴履歴はありません</Text>
            <View style={styles.emptyButtons}>
              <PrimaryButton label="動画を探す" onPress={onGoVideos} />
            </View>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(v) => v.id}
            showsVerticalScrollIndicator={Platform.OS !== 'web'}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onOpenVideo(item.contentId)}>
                <View style={styles.thumbWrap}>
                  <Image
                    source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : FALLBACK_THUMB}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                </View>

                <View style={styles.rowBody}>
                  <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                    {item.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.kind}</Text>
                    </View>
                    <Text style={styles.metaText}>{formatMmSs(item.durationSeconds)}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.metaText}>{formatYmd(item.lastPlayedAt)}</Text>
                    {item.status ? (
                      <>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaText}>{item.status}</Text>
                      </>
                    ) : null}
                  </View>

                  {item.episodeLabel ? <Text style={styles.episodeText}>{item.episodeLabel}</Text> : null}
                </View>

                <View style={styles.rowActions}>
                  <TrashIconButton
                    onPress={(e) => {
                      ;(e as any)?.stopPropagation?.()
                      void deleteOne(item.id)
                    }}
                  />
                </View>
              </Pressable>
            )}
            ListFooterComponent={footer}
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
  headerRight: {
    width: 40,
    height: 40,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyWrap: {
    paddingVertical: 18,
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 12,
    paddingVertical: 14,
    textAlign: 'center',
  },
  emptyButtons: {
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 14,
    backgroundColor: THEME.card,
    padding: 10,
    alignItems: 'center',
  },
  thumbWrap: {
    width: 96,
    height: 54,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: THEME.bg,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  rowBody: {
    flex: 1,
  },
  title: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
  },
  badgeText: {
    color: THEME.text,
    fontSize: 10,
    fontWeight: '800',
  },
  metaText: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  metaDot: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  episodeText: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  rowActions: {
    marginLeft: 4,
  },
  footer: {
    paddingTop: 10,
  },
  deleteAllBtn: {
    borderWidth: 1,
    borderColor: THEME.danger,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAllText: {
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '800',
  },
})
