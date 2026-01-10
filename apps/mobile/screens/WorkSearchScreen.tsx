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
import { NoticeBellButton, RowItem, ScreenContainer, TabBar, THEME } from '../components'

type TabKey = 'home' | 'video' | 'cast' | 'work' | 'search' | 'mypage'

type WorkSearchScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  onOpenVideo: (id: string) => void
  onOpenNotice?: () => void
}

type Work = {
  id: string
  title: string
  ratingAvg: number
  reviewCount: number
  priceCoin?: number
  thumbnailUrl?: string
}

type WorkResponse = { items: Work[] }

type HistoryItem = {
  type: 'title'
  keyword: string
  savedAt: string
}

const FALLBACK_VIDEO_IMAGE = require('../assets/thumbnail-sample.png')
const HISTORY_KEY = 'work_search_history_v1'
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

export function WorkSearchScreen({ apiBaseUrl, onPressTab, onOpenVideo, onOpenNotice }: WorkSearchScreenProps) {
  const [keyword, setKeyword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [works, setWorks] = useState<Work[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])

  const mockWorks = useMemo<Work[]>(
    () => [
      { id: 'w1', title: 'ダウトコール', ratingAvg: 4.7, reviewCount: 382, priceCoin: 0 },
      { id: 'w2', title: 'ミステリーX', ratingAvg: 4.4, reviewCount: 195, priceCoin: 0 },
      { id: 'w3', title: 'ラブストーリーY', ratingAvg: 4.2, reviewCount: 108, priceCoin: 0 },
    ],
    []
  )

  const loadHistory = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(HISTORY_KEY)
      const items = (json ? JSON.parse(json) : []) as HistoryItem[]
      setHistory(uniqueHistory(items))
    } catch {
      setHistory([])
    }
  }, [])

  const saveToHistory = useCallback(
    async (kw: string) => {
      if (!kw.trim()) return
      const now = new Date().toISOString()
      const item: HistoryItem = { type: 'title', keyword: kw, savedAt: now }
      const next = [item, ...history].slice(0, HISTORY_MAX)
      setHistory(next)
      try {
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
    },
    [history]
  )

  const clearHistory = useCallback(async () => {
    setHistory([])
    try {
      await AsyncStorage.removeItem(HISTORY_KEY)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const canSearch = useMemo(() => keyword.trim().length > 0, [keyword])

  const runSearch = useCallback(async () => {
    const q = normalize(keyword)
    if (!q) return

    setBusy(true)
    setError('')
    try {
      const u = new URL(`${apiBaseUrl}/v1/works`)
      u.searchParams.set('q', q)
      const res = await fetch(u.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as WorkResponse
      setWorks(Array.isArray(json.items) ? json.items : mockWorks)
      void saveToHistory(keyword)
    } catch (e) {
      setWorks(mockWorks)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, keyword, mockWorks, saveToHistory])

  const handleSearchPress = useCallback(() => {
    void runSearch()
  }, [runSearch])

  const handleHistoryPress = useCallback(
    (kw: string) => {
      setKeyword(kw)
      setTimeout(() => {
        void runSearch()
      }, 0)
    },
    [runSearch]
  )

  const handleDeleteHistory = useCallback(
    async (kw: string) => {
      const next = history.filter((it) => normalize(it.keyword) !== normalize(kw))
      setHistory(next)
      try {
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
    },
    [history]
  )

  const showResults = works.length > 0
  const showHistory = !showResults && history.length > 0

  return (
    <ScreenContainer
      title="作品"
      headerRight={onOpenNotice ? <NoticeBellButton onPress={onOpenNotice} /> : undefined}
      footer={<TabBar active="search" onPress={(key) => onPressTab(key as TabKey)} />}
    >
      <View style={styles.root}>
        {/* Search Bar */}
        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="作品を検索"
            placeholderTextColor={THEME.textMuted}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearchPress}
            returnKeyType="search"
          />
          <Pressable onPress={handleSearchPress} disabled={!canSearch || busy} style={styles.searchButton}>
            <Text style={[styles.searchButtonText, !canSearch || busy ? styles.searchButtonTextDisabled : null]}>
              検索
            </Text>
          </Pressable>
        </View>

        {/* Results or History */}
        {showResults ? (
          <ScrollView style={styles.resultsBox}>
            <Text style={styles.resultCountText}>{works.length} 件</Text>
            <FlatList
              scrollEnabled={false}
              data={works}
              keyExtractor={(it) => it.id}
              renderItem={({ item }) => (
                <RowItem
                  key={item.id}
                  title={item.title}
                  subtitle={`★${item.ratingAvg} (${item.reviewCount})`}
                  actionLabel="詳細"
                  onAction={() => onOpenVideo(item.id)}
                />
              )}
            />
            {busy && <ActivityIndicator size="large" color={THEME.accent} style={styles.loader} />}
            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>
        ) : showHistory ? (
          <ScrollView style={styles.historyBox}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>検索履歴</Text>
              <Pressable onPress={clearHistory}>
                <Text style={styles.clearHistoryText}>すべて削除</Text>
              </Pressable>
            </View>
            {history.map((it, idx) => (
              <View key={idx} style={styles.historyItem}>
                <Pressable onPress={() => handleHistoryPress(it.keyword)} style={styles.historyItemContent}>
                  <Text style={styles.historyItemText}>{it.keyword}</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteHistory(it.keyword)} style={styles.historyDeleteButton}>
                  <Text style={styles.historyDeleteText}>削除</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>作品タイトルで検索できます</Text>
          </View>
        )}

        {busy && <ActivityIndicator size="large" color={THEME.accent} style={styles.loaderOverlay} />}

      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  searchBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 12,
    fontSize: 14,
    color: THEME.text,
  },
  searchButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: THEME.accent,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  searchButtonTextDisabled: {
    opacity: 0.5,
  },
  resultsBox: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultCountText: {
    fontSize: 12,
    color: THEME.textMuted,
    marginVertical: 8,
  },
  historyBox: {
    flex: 1,
    paddingHorizontal: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  clearHistoryText: {
    fontSize: 12,
    color: THEME.accent,
    fontWeight: '700',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.outline,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemText: {
    fontSize: 14,
    color: THEME.text,
  },
  historyDeleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  historyDeleteText: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: '700',
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: THEME.textMuted,
  },
  errorText: {
    fontSize: 12,
    color: THEME.danger,
    marginVertical: 12,
  },
  loader: {
    marginVertical: 20,
  },
  loaderOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
  },
})
