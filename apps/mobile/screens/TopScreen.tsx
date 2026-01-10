import { useEffect, useMemo, useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { NoticeBellButton, PagedCarousel, ScreenContainer, TabBar, THEME } from '../components'

// NOTE: Notice bell is shared across screens via NoticeBellButton.

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type TopScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  onOpenVideo: (id: string) => void
  onOpenRanking: () => void
  onOpenFavorites: () => void
  onOpenNotice: () => void
}

type VideoItem = {
  id: string
  title: string
  thumbnailUrl?: string
}

type TopData = {
  pickup: VideoItem[]
  notice: { id: string; body: string }
  ranking: VideoItem[]
  favorites: VideoItem[]
}

const FALLBACK_IMAGE = require('../assets/thumbnail-sample.png')

export function TopScreen({ apiBaseUrl, onPressTab, onOpenVideo, onOpenRanking, onOpenFavorites, onOpenNotice }: TopScreenProps) {
  const { width } = useWindowDimensions()
  const [contentWidth, setContentWidth] = useState<number | null>(null)
  const bannerWidth = Math.max(1, contentWidth ?? (width - 32))
  const bannerHeight = Math.round(bannerWidth * (9 / 16))
  const [bannerIndex, setBannerIndex] = useState(0)

  const mockData = useMemo<TopData>(
    () => ({
      pickup: [
        { id: 'p1', title: 'ピックアップ：ダウトコール 第01話' },
        { id: 'p2', title: 'ピックアップ：ダウトコール 第02話' },
        { id: 'p3', title: 'ピックアップ：ダウトコール 第03話' },
      ],
      notice: {
        id: 'n1',
        body: '本日より新機能を追加しました。より快適に視聴できるよう改善しています。詳細はアプリ内のお知らせをご確認ください。',
      },
      ranking: [
        { id: 'r1', title: 'ランキング 1位：ダウトコール' },
        { id: 'r2', title: 'ランキング 2位：ミステリーX' },
        { id: 'r3', title: 'ランキング 3位：ラブストーリーY' },
        { id: 'r4', title: 'ランキング 4位：コメディZ' },
      ],
      favorites: [
        { id: 'f1', title: 'お気に入り：ダウトコール' },
        { id: 'f2', title: 'お気に入り：ミステリーX' },
        { id: 'f3', title: 'お気に入り：ラブストーリーY' },
      ],
    }),
    []
  )

  const [data, setData] = useState<TopData>(mockData)
  const [loadError, setLoadError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadError('')
      try {
        const res = await fetch(`${apiBaseUrl}/v1/top`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as TopData
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) {
          setData(mockData)
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, mockData])

  const favorites = data.favorites

  return (
    <ScreenContainer
      title="トップ"
      headerRight={<NoticeBellButton onPress={onOpenNotice} />}
      maxWidth={828}
      footer={<TabBar active="home" onPress={onPressTab} />}
    >
      <View
        style={styles.root}
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.width)
          if (!Number.isFinite(next) || next <= 0) return
          setContentWidth((prev) => (prev === next ? prev : next))
        }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 1. ピックアップ */}
          <View style={styles.sectionTop}>
            <PagedCarousel
              items={data.pickup.slice(0, 3)}
              index={bannerIndex}
              onIndexChange={setBannerIndex}
              height={bannerHeight + 44}
              dotsStyle={styles.bannerDots}
              renderItem={(v, _i, pageWidth) => {
                const h = Math.round(pageWidth * (9 / 16))
                return (
                <Pressable
                  onPress={() => onOpenVideo(v.id)}
                  style={[styles.bannerWrap, { width: pageWidth, height: h }]}
                >
                  <Image source={FALLBACK_IMAGE} style={styles.bannerImage} resizeMode="cover" />
                  <View style={styles.bannerOverlay}>
                    <Text style={styles.bannerTitle} numberOfLines={2} ellipsizeMode="tail">
                      {v.title}
                    </Text>
                  </View>
                </Pressable>
                )
              }}
            />
          </View>

          {/* 2. お知らせ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>お知らせ</Text>
            <Pressable style={styles.noticeCard} onPress={onOpenNotice}>
              <Text style={styles.noticeText} numberOfLines={3} ellipsizeMode="tail">
                {data.notice.body}
              </Text>
              {loadError ? <Text style={styles.noticeMeta}>読み込み失敗（モック表示）</Text> : null}
            </Pressable>
          </View>

          {/* 3. ランキング */}
          <View style={styles.section}>
            <Pressable style={styles.sectionHeaderRow} onPress={onOpenRanking}>
              <Text style={styles.sectionTitle}>ランキング</Text>
              <Text style={styles.sectionLink}>＞</Text>
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {data.ranking.slice(0, 4).map((v) => (
                <Pressable key={v.id} style={styles.hCard} onPress={() => onOpenVideo(v.id)}>
                  <View style={styles.hThumbWrap}>
                    <Image source={FALLBACK_IMAGE} style={styles.hThumb} resizeMode="cover" />
                  </View>
                  <Text style={styles.hTitle} numberOfLines={2} ellipsizeMode="tail">
                    {v.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* 4. お気に入り（存在しない場合は非表示） */}
          {favorites.length > 0 ? (
            <View style={styles.section}>
              <Pressable style={styles.sectionHeaderRow} onPress={onOpenFavorites}>
                <Text style={styles.sectionTitle}>お気に入り</Text>
                <Text style={styles.sectionLink}>＞</Text>
              </Pressable>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
                {favorites.slice(0, 3).map((v) => (
                  <Pressable key={v.id} style={styles.hCard} onPress={() => onOpenVideo(v.id)}>
                    <View style={styles.hThumbWrap}>
                      <Image source={FALLBACK_IMAGE} style={styles.hThumb} resizeMode="cover" />
                    </View>
                    <Text style={styles.hTitle} numberOfLines={2} ellipsizeMode="tail">
                      {v.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '800',
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionTop: {
    marginBottom: 16,
  },
  bannerCarousel: {
    paddingHorizontal: 16,
  },
  bannerDots: {
    marginTop: 10,
    marginBottom: 0,
  },
  section: {
    marginBottom: 16,
  },
  bannerWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bannerTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLink: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: '900',
  },
  noticeCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  noticeText: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  noticeMeta: {
    marginTop: 8,
    color: THEME.textMuted,
    fontSize: 10,
  },
  hList: {
    gap: 12,
    paddingRight: 8,
  },
  hCard: {
    width: 150,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'hidden',
  },
  hThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: THEME.card,
    overflow: 'hidden',
  },
  hThumb: {
    width: '100%',
    height: '100%',
  },
  hTitle: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
})
