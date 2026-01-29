import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Chip, RowItem, ScreenContainer, TabBar, THEME } from '../components'
import { apiFetch } from '../utils/api'
import {
  type TabKey,
  type CastSearchScreenProps,
  type Cast,
  type CastResponse,
  type HistoryItem,
  HISTORY_KEY,
  HISTORY_MAX,
  normalize,
  uniqueHistory,
} from '../types/castSearchTypes'

import IconNotification from '../assets/icon_notification.svg'
import IconSearch from '../assets/icon_search.svg'

const LOGO_IMAGE = require('../assets/oshidora_logo.png')

export function CastSearchScreen({ apiBaseUrl, onPressTab, onOpenProfile, onOpenResults, onOpenNotice }: CastSearchScreenProps) {
  const [tab, setTab] = useState<'name' | 'content'>('name')

  const [casts, setCasts] = useState<Cast[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [keyword, setKeyword] = useState('')
  const [contentKeyword, setContentKeyword] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY)
      const json = raw ? (JSON.parse(raw) as unknown) : []
      const items = Array.isArray(json) ? (json as HistoryItem[]) : []
      setHistory(uniqueHistory(items))
    } catch {
      setHistory([])
    }
  }, [])

  const saveHistory = useCallback(async (next: HistoryItem[]) => {
    const cleaned = uniqueHistory(next)
    setHistory(cleaned)
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(cleaned))
    } catch {
      // ignore
    }
  }, [])

  const addHistory = useCallback(
    async (item: { type: HistoryItem['type']; keyword: string; targetId?: string }) => {
      const k = item.keyword.trim()
      if (!k) return
      const now = new Date().toISOString()
      await saveHistory([{ type: item.type, keyword: k, targetId: item.targetId, savedAt: now }, ...history])
    },
    [history, saveHistory]
  )

  const removeHistoryItem = useCallback(
    async (item: Pick<HistoryItem, 'type' | 'keyword' | 'targetId'>) => {
      const key =
        item.type === 'content'
          ? `${item.type}:${String(item.targetId || '').trim() || normalize(item.keyword)}`
          : `${item.type}:${normalize(item.keyword)}`
      await saveHistory(
        history.filter((h) => {
          const hKey =
            h.type === 'content'
              ? `${h.type}:${String(h.targetId || '').trim() || normalize(h.keyword)}`
              : `${h.type}:${normalize(h.keyword)}`
          return hKey !== key
        })
      )
    },
    [history, saveHistory]
  )

  const fetchCasts = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`${apiBaseUrl}/v1/cast`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CastResponse
      const items = Array.isArray(json.items) ? json.items : []
      setCasts(items)
    } catch (e) {
      setCasts([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    void loadHistory()
    void fetchCasts()
  }, [fetchCasts, loadHistory])

  const filtered = useMemo(() => {
    const q = normalize(keyword)
    const byKeyword = !q
      ? casts
      : casts.filter((c) => {
          const nameHit = normalize(c.name).includes(q)
          const roleHit = normalize(c.role).includes(q)
          const genresHit = Array.isArray(c.genres) && c.genres.some((g) => normalize(g).includes(q))
          return nameHit || roleHit || genresHit
        })

    if (!selectedGenre) return byKeyword
    const g = normalize(selectedGenre)
    return byKeyword.filter((c) => Array.isArray(c.genres) && c.genres.some((x) => normalize(x) === g))
  }, [casts, keyword, selectedGenre])

  const availableGenres = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const c of casts) {
      const gs = Array.isArray(c.genres) ? c.genres : []
      for (const g of gs) {
        const key = normalize(g)
        if (!key) continue
        if (seen.has(key)) continue
        seen.add(key)
        out.push(g)
      }
    }
    return out
  }, [casts])

  const renderHistory = useMemo(() => {
    const isName = tab === 'name'
    const inputEmpty = isName ? !keyword.trim() : !contentKeyword.trim()
    if (!inputEmpty) return null

    const items = history.filter((h) => h.type === (isName ? 'name' : 'content'))
    if (items.length === 0) return null

    return (
      <View style={styles.sectionTop}>
        <Text style={styles.sectionTitle}>検索履歴</Text>
        {items.map((h) => (
          <View key={`${h.savedAt}:${h.type}:${h.targetId ?? ''}:${h.keyword}`} style={styles.historyRowItem}>
            <Pressable
              style={styles.historyRowMain}
              onPress={() => {
                if (h.type === 'name') {
                  setKeyword(h.keyword)
                  onOpenResults(h.keyword)
                  return
                }

                setContentKeyword(h.keyword)
                onOpenResults(h.keyword)
              }}
            >
              <Text style={styles.historyRowText}>{h.keyword}</Text>
            </Pressable>
            <Pressable
              style={styles.historyRowDelete}
              onPress={() => {
                void removeHistoryItem({ type: h.type, keyword: h.keyword, targetId: h.targetId })
              }}
            >
              <Text style={styles.historyRowDeleteText}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
    )
  }, [contentKeyword, history, keyword, onOpenResults, removeHistoryItem, tab])

  return (
    <ScreenContainer
      headerLeft={<Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />}
      headerRight={
        <View style={styles.headerRightRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="お知らせ"
            onPress={() => onOpenNotice?.()}
            style={styles.headerIconButton}
            disabled={!onOpenNotice}
          >
            <IconNotification width={22} height={22} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="検索"
            onPress={() => onPressTab('search')}
            style={styles.headerIconButton}
          >
            <IconSearch width={22} height={22} />
          </Pressable>
        </View>
      }
      footer={<TabBar active="cast" onPress={onPressTab} />}
      footerPaddingHorizontal={0}
    >
      <View style={styles.root}>
        <View style={styles.topTabs}>
          <Pressable style={[styles.topTab, tab === 'name' ? styles.topTabActive : null]} onPress={() => setTab('name')}>
            <Text style={[styles.topTabText, tab === 'name' ? styles.topTabTextActive : null]}>名前から探す</Text>
          </Pressable>
          <View style={styles.topTabGap} />
          <Pressable style={[styles.topTab, tab === 'content' ? styles.topTabActive : null]} onPress={() => setTab('content')}>
            <Text style={[styles.topTabText, tab === 'content' ? styles.topTabTextActive : null]}>作品から探す</Text>
          </Pressable>
        </View>

        {tab === 'content' ? (
          <>
            <View style={styles.searchBox}>
              <TextInput
                value={contentKeyword}
                onChangeText={setContentKeyword}
                placeholder="作品名で検索"
                placeholderTextColor={THEME.textMuted}
                autoCapitalize="none"
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={() => {
                  void addHistory({ type: 'content', keyword: contentKeyword })
                  onOpenResults(contentKeyword)
                }}
              />
              <Pressable
                style={[styles.clearBtn, !contentKeyword.trim() ? styles.clearBtnDisabled : null]}
                disabled={!contentKeyword.trim()}
                onPress={() => {
                  setContentKeyword('')
                }}
              >
                <Text style={styles.clearBtnText}>クリア</Text>
              </Pressable>
            </View>

            {renderHistory}
            <View style={styles.sectionTop}>
              <Text style={styles.sectionTitle}>検索</Text>
              <Pressable
                style={[styles.searchActionBtn, !contentKeyword.trim() ? styles.searchActionBtnDisabled : null]}
                disabled={!contentKeyword.trim()}
                onPress={() => {
                  void addHistory({ type: 'content', keyword: contentKeyword })
                  onOpenResults(contentKeyword)
                }}
              >
                <Text style={styles.searchActionBtnText}>このキーワードで検索</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.searchBox}>
              <TextInput
                value={keyword}
                onChangeText={setKeyword}
                placeholder="名前・役割・ジャンルで検索"
                placeholderTextColor={THEME.textMuted}
                autoCapitalize="none"
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={() => {
                  void addHistory({ type: 'name', keyword })
                  onOpenResults(keyword)
                }}
              />
              <Pressable
                style={[styles.clearBtn, !keyword.trim() ? styles.clearBtnDisabled : null]}
                disabled={!keyword.trim()}
                onPress={() => setKeyword('')}
              >
                <Text style={styles.clearBtnText}>クリア</Text>
              </Pressable>
            </View>

            {availableGenres.length > 0 ? (
              <View style={styles.sectionTop}>
                <Text style={styles.sectionTitle}>ジャンル</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow}>
                  <Chip
                    label="すべて"
                    selected={!selectedGenre}
                    onPress={() => {
                      setSelectedGenre(null)
                    }}
                  />
                  {availableGenres.map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      selected={normalize(selectedGenre ?? '') === normalize(g)}
                      onPress={() => {
                        setSelectedGenre((prev) => (normalize(prev ?? '') === normalize(g) ? null : g))
                      }}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {renderHistory}

            {error ? <Text style={styles.loadNote}>取得に失敗しました</Text> : null}

            {busy ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator />
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(c) => c.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={<Text style={styles.sectionTitle}>一覧</Text>}
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
          </>
        )}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  logo: {
    width: 110,
    height: 36,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingBottom: 8,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '800',
  },
  topTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  topTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  topTabGap: {
    width: 10,
  },
  topTabActive: {
    borderColor: THEME.accent,
  },
  topTabText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  topTabTextActive: {
    color: THEME.text,
  },
  searchBox: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
  },
  clearBtn: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  clearBtnDisabled: {
    opacity: 0.5,
  },
  clearBtnText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  searchActionBtn: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.accent,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchActionBtnDisabled: {
    opacity: 0.5,
  },
  searchActionBtnText: {
    color: '#0B0B0B',
    fontSize: 12,
    fontWeight: '900',
  },
  sectionTop: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
  },
  historyRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  historyRowMain: {
    flex: 1,
  },
  historyRowText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  historyRowDelete: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    marginLeft: 10,
  },
  historyRowDeleteText: {
    color: THEME.textMuted,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 16,
  },
  historyRow: {
    gap: 10,
    paddingBottom: 2,
  },
  genreRow: {
    gap: 10,
    paddingBottom: 2,
  },
  historyChipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyChip: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyChipText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  historyDelete: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
  },
  historyDeleteText: {
    color: THEME.textMuted,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  loadingCenter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadNote: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 20,
    textAlign: 'center',
  },
  placeholderBox: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
  },
  placeholderTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  placeholderText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
})
