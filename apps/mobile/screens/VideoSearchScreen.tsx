import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { IconButton, NoticeBellButton, ScreenContainer, TabBar, THEME } from '../components'
import { apiFetch } from '../utils/api'

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type VideoSearchScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  onOpenVideo: (id: string) => void
  onOpenProfile: (cast: { id: string; name: string; role: string }) => void
  onOpenNotice?: () => void
}

type Video = {
  id: string
  title: string
  ratingAvg: number
  reviewCount: number
  priceCoin?: number
  thumbnailUrl?: string
}

type Cast = {
  id: string
  name: string
  role: string
  thumbnailUrl?: string
}

type SearchResponse = {
  videos: Video[]
  casts: Cast[]
}

const FALLBACK_VIDEO_IMAGE = require('../assets/thumbnail-sample.png')

function normalize(value: string) {
  return value.trim()
}

export function VideoSearchScreen({ apiBaseUrl, onPressTab, onOpenVideo, onOpenProfile, onOpenNotice }: VideoSearchScreenProps) {
  const [keyword, setKeyword] = useState('')
  const [searchedKeyword, setSearchedKeyword] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [videos, setVideos] = useState<Video[]>([])
  const [casts, setCasts] = useState<Cast[]>([])

  const canSearch = useMemo(() => normalize(keyword).length > 0, [keyword])

  const runSearch = useCallback(async () => {
    const q = normalize(keyword)
    setSearchedKeyword(q)
    if (!q) {
      setVideos([])
      setCasts([])
      setError('')
      return
    }

    setBusy(true)
    setError('')
    try {
      const u = new URL(`${apiBaseUrl}/v1/search`)
      u.searchParams.set('q', q)
      const res = await apiFetch(u.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as SearchResponse
      setVideos(Array.isArray(json.videos) ? json.videos : [])
      setCasts(Array.isArray(json.casts) ? json.casts : [])
    } catch (e) {
      setVideos([])
      setCasts([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, keyword])

  const showResults = searchedKeyword !== null

  return (
    <ScreenContainer
      title="検索"
      headerRight={onOpenNotice ? <NoticeBellButton onPress={onOpenNotice} /> : undefined}
      footer={<TabBar active="search" onPress={onPressTab} />}
      footerPaddingHorizontal={0}
    >
      <View style={styles.root}>
        <View style={styles.searchBox}>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="キーワードで検索"
            placeholderTextColor={THEME.textMuted}
            autoCapitalize="none"
            style={styles.searchInput}
            returnKeyType="search"
            maxLength={100}
            onSubmitEditing={() => {
              void runSearch()
            }}
          />
          <View style={styles.searchIconWrap}>
            <IconButton
              label="検索"
              onPress={() => {
                void runSearch()
              }}
            />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>通信に失敗しました: {error}</Text> : null}

        {busy ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator />
          </View>
        ) : showResults ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.resultsContent}>
            <Text style={styles.sectionTitle}>検索結果</Text>

            {videos.length === 0 && casts.length === 0 ? (
              <Text style={styles.emptyText}>該当する結果がありません</Text>
            ) : null}

            {videos.map((v) => (
              <Pressable
                key={v.id}
                style={styles.videoCard}
                onPress={() => {
                  onOpenVideo(v.id)
                }}
              >
                <Image
                  source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_VIDEO_IMAGE}
                  style={styles.videoThumb}
                />
                <View style={styles.videoTextArea}>
                  <Text style={styles.videoTitle} numberOfLines={2}>
                    {v.title}
                  </Text>
                  {typeof v.priceCoin === 'number' && v.priceCoin > 0 ? (
                    <Text style={styles.videoPrice}>{v.priceCoin}コイン</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}

            {casts.length > 0 ? (
              <View style={styles.castSection}>
                <Text style={styles.sectionTitle}>キャスト</Text>
                {casts.map((c) => (
                  <Pressable
                    key={c.id}
                    style={styles.castRow}
                    onPress={() => {
                      onOpenProfile({ id: c.id, name: c.name, role: c.role })
                    }}
                  >
                    <Text style={styles.castName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.castRole} numberOfLines={1}>
                      {c.role}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderTitle}>キーワードで検索</Text>
            <Text style={styles.placeholderText}>検索入力後、確定で検索結果を表示します。</Text>
          </View>
        )}
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
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    backgroundColor: THEME.card,
  },
  searchInput: {
    flex: 1,
    color: THEME.text,
    fontSize: 14,
  },
  searchIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 10,
    color: THEME.danger,
    fontSize: 12,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  resultsContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 13,
    paddingVertical: 12,
  },
  videoCard: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
    alignItems: 'center',
  },
  videoThumb: {
    width: 96,
    height: 54,
    borderRadius: 10,
    backgroundColor: THEME.card,
  },
  videoTextArea: {
    flex: 1,
  },
  videoTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  videoPrice: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  castSection: {
    paddingTop: 16,
  },
  castRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
    gap: 12,
  },
  castName: {
    flex: 1,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
  },
  castRole: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  placeholderBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 14,
  },
  placeholderTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  placeholderText: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
})
