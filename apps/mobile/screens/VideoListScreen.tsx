import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { NoticeBellButton, ScreenContainer, TabBar, THEME } from '../components'
import { apiFetch, isDebugMockEnabled } from '../utils/api'

type VideoListScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: 'home' | 'video' | 'cast' | 'search' | 'mypage') => void
  onOpenVideo: (id: string) => void
  onOpenNotice?: () => void
  tag?: string | null
  onChangeTag?: (tag: string | null) => void
}

type Video = {
  id: string
  title: string
  ratingAvg: number
  reviewCount: number
  priceCoin?: number
  thumbnailUrl?: string
  tags?: string[]
}

type Category = { id: string; name: string }

type VideosResponse = { items: Video[]; nextCursor?: string | null }
type CategoriesResponse = { items: Category[] }

const FALLBACK_VIDEO_IMAGE = require('../assets/thumbnail-sample.png')

const PAGE_SIZE = 20

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

export function VideoListScreen({ apiBaseUrl, onPressTab, onOpenVideo, onOpenNotice, tag, onChangeTag }: VideoListScreenProps) {
  const mockCategories = useMemo<Category[]>(
    () => [
      { id: 'c1', name: 'ドラマ' },
      { id: 'c2', name: 'ミステリー' },
      { id: 'c3', name: '恋愛' },
      { id: 'c4', name: 'コメディ' },
      { id: 'c5', name: 'アクション' },
    ],
    []
  )

  const mockVideos = useMemo<Video[]>(
    () => [
      { id: 'content-1', title: 'ダウトコール', ratingAvg: 4.7, reviewCount: 128, priceCoin: 30, tags: ['Drama', 'Mystery'] },
      { id: 'content-2', title: 'ミステリーX', ratingAvg: 4.4, reviewCount: 61, priceCoin: 30, tags: ['Mystery', 'Drama'] },
      { id: 'content-3', title: 'ラブストーリーY', ratingAvg: 4.2, reviewCount: 43, priceCoin: 10, tags: ['Romance', 'Drama'] },
      { id: 'content-4', title: 'コメディZ', ratingAvg: 4.1, reviewCount: 22, priceCoin: 10, tags: ['Comedy'] },
      { id: 'content-5', title: 'アクションW', ratingAvg: 4.3, reviewCount: 37, priceCoin: 20, tags: ['Action'] },
    ],
    []
  )

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesError, setCategoriesError] = useState<string>('')
  const [categoriesFallbackUsed, setCategoriesFallbackUsed] = useState(false)

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')

  const [videos, setVideos] = useState<Video[]>([])
  const [videosError, setVideosError] = useState<string>('')
  const [videosFallbackUsed, setVideosFallbackUsed] = useState(false)
  const [busyInitial, setBusyInitial] = useState(false)
  const [busyMore, setBusyMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setCategoriesError('')
    setCategoriesFallbackUsed(false)
    try {
      const res = await apiFetch(`${apiBaseUrl}/v1/categories`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as CategoriesResponse
      const items = Array.isArray(json.items) ? json.items : []
      setCategories(items)
    } catch (e) {
      const mock = await isDebugMockEnabled()
      setCategoriesFallbackUsed(mock)
      setCategories(mock ? mockCategories : [])
      setCategoriesError(e instanceof Error ? e.message : String(e))
    }
  }, [apiBaseUrl, mockCategories])

  const buildVideosUrl = useCallback((opts: { categoryId: string; tag?: string | null; cursor?: string | null }) => {
    const u = new URL(`${apiBaseUrl}/v1/works`)
    if (opts.categoryId && opts.categoryId !== 'all') u.searchParams.set('category_id', opts.categoryId)
    if (opts.tag) u.searchParams.set('tag', opts.tag)
    u.searchParams.set('limit', String(PAGE_SIZE))
    if (opts.cursor) u.searchParams.set('cursor', opts.cursor)
    return u.toString()
  }, [apiBaseUrl])

  const fetchVideos = useCallback(async (mode: 'initial' | 'more') => {
    if (mode === 'more' && (busyMore || busyInitial)) return
    if (mode === 'more' && nextCursor === null && videos.length > 0) return

    mode === 'initial' ? setBusyInitial(true) : setBusyMore(true)
    if (mode === 'initial') {
      setVideosError('')
      setVideosFallbackUsed(false)
    }

    try {
      const url = buildVideosUrl({ categoryId: selectedCategoryId, tag, cursor: mode === 'more' ? nextCursor : null })
      const res = await apiFetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as VideosResponse
      const items = Array.isArray(json.items) ? json.items : []

      const filteredByTag = tag
        ? items.filter((v) => {
            const tags = Array.isArray((v as any).tags) ? ((v as any).tags as string[]) : []
            if (tags.some((t) => normalizeText(t) === normalizeText(tag))) return true
            return normalizeText(String(v.title ?? '')).includes(normalizeText(tag))
          })
        : items

      if (mode === 'initial') {
        setVideos(filteredByTag)
      } else {
        setVideos((prev) => [...prev, ...filteredByTag])
      }
      setNextCursor(typeof json.nextCursor === 'string' ? json.nextCursor : null)
    } catch (e) {
      if (mode === 'initial') {
        const mock = await isDebugMockEnabled()
        setVideosFallbackUsed(mock)
        setVideos(mock ? mockVideos : [])
        setNextCursor(null)
        setVideosError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      mode === 'initial' ? setBusyInitial(false) : setBusyMore(false)
    }
  }, [buildVideosUrl, busyInitial, busyMore, mockVideos, nextCursor, selectedCategoryId, videos.length])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    setNextCursor(null)
    void fetchVideos('initial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, tag])

  useEffect(() => {
    if (videos.length === 0) void fetchVideos('initial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categoryItems = useMemo(() => {
    const base = [{ id: 'all', name: '全て' }, ...categories]
    const seen = new Set<string>()
    return base.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  }, [categories])

  const renderVideo = useCallback((v: Video) => {
    const isPaid = typeof v.priceCoin === 'number' ? v.priceCoin > 0 : false
    return (
      <Pressable style={styles.videoCard} onPress={() => onOpenVideo(v.id)}>
        <View style={styles.thumbWrap}>
          <Image
            source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_VIDEO_IMAGE}
            style={styles.videoThumb}
            resizeMode="cover"
          />
          {isPaid ? (
            <View style={styles.paidBadge}>
              <Text style={styles.paidBadgeText}>有料</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.videoMeta}>
          <Text style={styles.videoTitle} numberOfLines={2} ellipsizeMode="tail">
            {v.title}
          </Text>
          <Text style={styles.videoRating}>
            ★ {Number.isFinite(v.ratingAvg) ? v.ratingAvg.toFixed(1) : '—'}（{Number.isFinite(v.reviewCount) ? v.reviewCount : 0}件）
          </Text>
        </View>
      </Pressable>
    )
  }, [onOpenVideo])

  return (
    <ScreenContainer
      title="作品一覧"
      headerRight={onOpenNotice ? <NoticeBellButton onPress={onOpenNotice} /> : undefined}
      footer={<TabBar active="video" onPress={onPressTab} />}
      footerPaddingHorizontal={0}
    >
      <View style={styles.root}>
        {tag ? (
          <View style={styles.tagRow}>
            <Text style={styles.tagLabel}>タグ：</Text>
            <Pressable
              style={styles.tagChip}
              onPress={() => {
                onChangeTag?.(null)
              }}
            >
              <Text style={styles.tagChipText}>{tag} ×</Text>
            </Pressable>
          </View>
        ) : null}

        {/* カテゴリ一覧 */}
        {categoryItems.length > 1 ? (
          <View style={styles.sectionTop}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {categoryItems.map((c) => {
                const selected = c.id === selectedCategoryId
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.chip, selected ? styles.chipSelected : null]}
                    onPress={() => setSelectedCategoryId(c.id)}
                  >
                    <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{c.name}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>
            {categoriesError ? (
              <Text style={styles.loadNote}>カテゴリ取得に失敗しました{categoriesFallbackUsed ? '（モック表示）' : ''}</Text>
            ) : null}
          </View>
        ) : null}

        {busyInitial ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={videos}
            keyExtractor={(v) => v.id}
            numColumns={2}
            renderItem={({ item }) => renderVideo(item)}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.column}
            showsVerticalScrollIndicator={false}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              void fetchVideos('more')
            }}
            ListHeaderComponent={
              videosError ? (
                <Text style={styles.loadNote}>作品取得に失敗しました{videosFallbackUsed ? '（モック表示）' : ''}</Text>
              ) : null
            }
            ListFooterComponent={
              busyMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator />
                </View>
              ) : (
                <View style={styles.footerSpace} />
              )
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
  topTabGap: {
    width: 10,
  },
  topTab: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTabActive: {
    borderColor: THEME.accent,
  },
  topTabText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  topTabTextActive: {
    color: THEME.accent,
  },
  sectionTop: {
    marginBottom: 10,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tagLabel: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tagChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.accent,
  },
  tagChipText: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  chipSelected: {
    borderColor: THEME.accent,
  },
  chipText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: THEME.accent,
  },
  loadNote: {
    marginTop: 8,
    color: THEME.textMuted,
    fontSize: 10,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  column: {
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  videoCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'hidden',
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: THEME.card,
    overflow: 'hidden',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  paidBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  paidBadgeText: {
    color: THEME.text,
    fontSize: 10,
    fontWeight: '800',
  },
  videoMeta: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  videoTitle: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  videoRating: {
    color: THEME.textMuted,
    fontSize: 10,
  },
  footerLoading: {
    paddingVertical: 12,
  },
  footerSpace: {
    height: 6,
  },
})
