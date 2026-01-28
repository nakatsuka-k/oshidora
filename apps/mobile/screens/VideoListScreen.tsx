import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, TabBar, THEME } from '../components'
import { apiFetch, isDebugMockEnabled } from '../utils/api'

import IconNotification from '../assets/icon_notification.svg'
import IconSearch from '../assets/icon_search.svg'

const LOGO_IMAGE = require('../assets/oshidora_logo.png')

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
    if (mode === 'more') {
      if (busyMore || busyInitial) return
      // No cursor means no next page; avoid endless requests when the list is empty.
      if (!nextCursor) return
    }

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
      const next = typeof json.nextCursor === 'string' && json.nextCursor.trim().length > 0 ? json.nextCursor : null
      setNextCursor(next)
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
  }, [buildVideosUrl, busyInitial, busyMore, mockVideos, nextCursor, selectedCategoryId, tag])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    setNextCursor(null)
    void fetchVideos('initial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, tag])

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
    const tags = Array.isArray(v.tags) ? v.tags : []
    const badgeLabel = isPaid ? '会員限定' : tags.includes('おすすめ') ? 'おすすめ' : tags.includes('新着') ? '新着' : ''
    const description = tags.length > 0 ? tags.join('・') : '作品の説明は準備中です。'
    return (
      <Pressable style={styles.videoRow} onPress={() => onOpenVideo(v.id)}>
        <View style={styles.rowThumbWrap}>
          <Image
            source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_VIDEO_IMAGE}
            style={styles.rowThumb}
            resizeMode="cover"
          />
          {badgeLabel ? (
            <View style={[styles.badge, badgeLabel === 'おすすめ' ? styles.badgeRecommend : badgeLabel === '新着' ? styles.badgeNew : styles.badgePremium]}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.rowTitle} numberOfLines={1} ellipsizeMode="tail">
            {v.title}
          </Text>
          <Text style={styles.rowRating}>
            ★ {Number.isFinite(v.ratingAvg) ? v.ratingAvg.toFixed(1) : '—'}（{Number.isFinite(v.reviewCount) ? v.reviewCount : 0}件）
          </Text>
          <Text style={styles.rowDesc} numberOfLines={2} ellipsizeMode="tail">
            {description}
          </Text>
        </View>
      </Pressable>
    )
  }, [onOpenVideo])

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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
              {categoryItems.map((c) => {
                const selected = c.id === selectedCategoryId
                return (
                  <Pressable key={c.id} style={styles.tabItem} onPress={() => setSelectedCategoryId(c.id)}>
                    <Text style={[styles.tabText, selected ? styles.tabTextActive : null]}>{c.name}</Text>
                    {selected ? <View style={styles.tabUnderline} /> : null}
                  </Pressable>
                )
              })}
            </ScrollView>
            <View style={styles.sortRow}>
              <Pressable style={styles.sortButton} accessibilityRole="button">
                <Text style={styles.sortText}>おすすめ順</Text>
                <Text style={styles.sortChevron}>▾</Text>
              </Pressable>
            </View>
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
            renderItem={({ item }) => renderVideo(item)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (!nextCursor) return
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
  tabRow: {
    gap: 18,
    paddingRight: 12,
  },
  tabItem: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  tabText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: THEME.accent,
  },
  tabUnderline: {
    marginTop: 6,
    width: 24,
    height: 2,
    borderRadius: 999,
    backgroundColor: THEME.accent,
  },
  sortRow: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  sortText: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  sortChevron: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
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
    paddingTop: 4,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  videoRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  rowThumbWrap: {
    width: 118,
    height: 74,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: THEME.card,
  },
  rowThumb: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  badgeNew: {
    backgroundColor: '#FF3B30',
  },
  badgeRecommend: {
    backgroundColor: '#F4B01B',
  },
  badgePremium: {
    backgroundColor: '#5B5CE6',
  },
  rowMeta: {
    flex: 1,
    paddingRight: 6,
  },
  rowTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  rowRating: {
    color: THEME.accent,
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 4,
  },
  rowDesc: {
    color: THEME.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  footerLoading: {
    paddingVertical: 12,
  },
  footerSpace: {
    height: 6,
  },
})
