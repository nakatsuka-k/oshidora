import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { RowItem, ScreenContainer, TabBar, THEME } from '../components'

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type CastSearchScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  onOpenProfile: (cast: { id: string; name: string; role: string }) => void
  onOpenResults: (keyword: string) => void
}

type Cast = {
  id: string
  name: string
  role: string
  thumbnailUrl?: string
}

type CastResponse = { items: Cast[] }

type HistoryItem = {
  type: 'name'
  keyword: string
  savedAt: string
}

const HISTORY_KEY = 'cast_search_history_v1'
const HISTORY_MAX = 20

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function uniqueHistory(items: HistoryItem[]): HistoryItem[] {
  const seen = new Set<string>()
  const out: HistoryItem[] = []
  for (const it of items) {
    const key = `${it.type}:${normalize(it.keyword)}`
    if (!it.keyword.trim()) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
    if (out.length >= HISTORY_MAX) break
  }
  return out
}

export function CastSearchScreen({ apiBaseUrl, onPressTab, onOpenProfile, onOpenResults }: CastSearchScreenProps) {
  const [tab, setTab] = useState<'name' | 'content'>('name')

  const [casts, setCasts] = useState<Cast[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])

  const mockCasts = useMemo<Cast[]>(
    () => [
      { id: 'a1', name: '松岡美沙', role: '出演者' },
      { id: 'a2', name: '櫻井拓馬', role: '出演者' },
      { id: 'a3', name: '監督太郎', role: '監督' },
      { id: 'a4', name: 'Oshidora株式会社', role: '制作' },
    ],
    []
  )

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

  const addHistoryKeyword = useCallback(
    async (value: string) => {
      const k = value.trim()
      if (!k) return
      const now = new Date().toISOString()
      await saveHistory([{ type: 'name', keyword: k, savedAt: now }, ...history])
    },
    [history, saveHistory]
  )

  const removeHistoryKeyword = useCallback(
    async (value: string) => {
      const key = normalize(value)
      await saveHistory(history.filter((h) => normalize(h.keyword) !== key))
    },
    [history, saveHistory]
  )

  const fetchCasts = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${apiBaseUrl}/v1/cast`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CastResponse
      const items = Array.isArray(json.items) ? json.items : []
      setCasts(items)
    } catch (e) {
      setCasts(mockCasts)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, mockCasts])

  useEffect(() => {
    void loadHistory()
    void fetchCasts()
  }, [fetchCasts, loadHistory])

  const filtered = useMemo(() => {
    const q = normalize(keyword)
    if (!q) return casts
    return casts.filter((c) => normalize(c.name).includes(q) || normalize(c.role).includes(q))
  }, [casts, keyword])

  const renderHistory = useMemo(() => {
    if (tab !== 'name') return null
    if (keyword.trim()) return null
    if (history.length === 0) return null

    return (
      <View style={styles.sectionTop}>
        <Text style={styles.sectionTitle}>検索履歴</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRow}>
          {history.map((h) => (
            <View key={h.savedAt + h.keyword} style={styles.historyChipWrap}>
              <Pressable
                style={styles.historyChip}
                onPress={() => {
                  setKeyword(h.keyword)
                  onOpenResults(h.keyword)
                }}
              >
                <Text style={styles.historyChipText}>{h.keyword}</Text>
              </Pressable>
              <Pressable
                style={styles.historyDelete}
                onPress={() => {
                  void removeHistoryKeyword(h.keyword)
                }}
              >
                <Text style={styles.historyDeleteText}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }, [history, keyword, removeHistoryKeyword, tab])

  return (
    <ScreenContainer footer={<TabBar active="cast" onPress={onPressTab} />}>
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
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderTitle}>作品から探す（PH2以降）</Text>
            <Text style={styles.placeholderText}>現時点では「名前から探す」のみ対応しています。</Text>
          </View>
        ) : (
          <>
            <View style={styles.searchBox}>
              <TextInput
                value={keyword}
                onChangeText={setKeyword}
                placeholder="名前で検索"
                placeholderTextColor={THEME.textMuted}
                autoCapitalize="none"
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={() => {
                  void addHistoryKeyword(keyword)
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

            {renderHistory}

            {error ? <Text style={styles.loadNote}>取得に失敗しました（モック表示）</Text> : null}

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
                      void addHistoryKeyword(keyword)
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
  sectionTop: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
  },
  historyRow: {
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
