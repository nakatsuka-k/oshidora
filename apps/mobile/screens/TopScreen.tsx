import { useEffect, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { NoticeBellButton, ScreenContainer, TabBar, THEME } from '../components'

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
  recommended: VideoItem[]
  rankings: {
    byViews: VideoItem[]
    byRating: VideoItem[]
    overall: VideoItem[]
  }
}

const FALLBACK_IMAGE = require('../assets/thumbnail-sample.png')

export function TopScreen({ apiBaseUrl, onPressTab, onOpenVideo, onOpenRanking, onOpenFavorites, onOpenNotice }: TopScreenProps) {
  const mockData = useMemo<TopData>(
    () => ({
      pickup: [
        { id: 'content-1', title: 'ダウトコール' },
        { id: 'content-2', title: 'ミステリーX' },
        { id: 'content-3', title: 'ラブストーリーY' },
        { id: 'content-4', title: 'コメディZ' },
        { id: 'content-5', title: 'アクションW' },
      ],
      recommended: [
        { id: 'content-1', title: 'ダウトコール' },
        { id: 'content-2', title: 'ミステリーX' },
        { id: 'content-3', title: 'ラブストーリーY' },
        { id: 'content-4', title: 'コメディZ' },
        { id: 'content-5', title: 'アクションW' },
      ],
      rankings: {
        byViews: [
          { id: 'content-1', title: 'ダウトコール' },
          { id: 'content-2', title: 'ミステリーX' },
          { id: 'content-3', title: 'ラブストーリーY' },
          { id: 'content-4', title: 'コメディZ' },
          { id: 'content-5', title: 'アクションW' },
        ],
        byRating: [
          { id: 'content-1', title: 'ダウトコール' },
          { id: 'content-2', title: 'ミステリーX' },
          { id: 'content-3', title: 'ラブストーリーY' },
          { id: 'content-4', title: 'コメディZ' },
          { id: 'content-5', title: 'アクションW' },
        ],
        overall: [
          { id: 'content-1', title: 'ダウトコール' },
          { id: 'content-2', title: 'ミステリーX' },
          { id: 'content-3', title: 'ラブストーリーY' },
          { id: 'content-4', title: 'コメディZ' },
          { id: 'content-5', title: 'アクションW' },
        ],
      },
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

  return (
    <ScreenContainer
      title="ホーム"
      maxWidth={828}
      headerRight={<NoticeBellButton onPress={onOpenNotice} />}
      footer={<TabBar active="home" onPress={onPressTab} />}
      footerPaddingHorizontal={0}
    >
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ピックアップ動画 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ピックアップ</Text>
              {loadError ? <Text style={styles.sectionMeta}>読み込み失敗（モック表示）</Text> : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {data.pickup.slice(0, 6).map((v) => (
                <Pressable key={v.id} style={styles.pickupCard} onPress={() => onOpenVideo(v.id)}>
                  <View style={styles.pickupThumbWrap}>
                    <Image
                      source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_IMAGE}
                      style={styles.hThumb}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.pickupTitle} numberOfLines={2} ellipsizeMode="tail">
                    {v.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* おすすめ動画 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>おすすめ</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {data.recommended.slice(0, 6).map((v) => (
                <Pressable key={v.id} style={styles.hCard} onPress={() => onOpenVideo(v.id)}>
                  <View style={styles.hThumbWrap}>
                    <Image
                      source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_IMAGE}
                      style={styles.hThumb}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.hTitle} numberOfLines={2} ellipsizeMode="tail">
                    {v.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ランキング（再生数） */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ランキング（再生数）</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {data.rankings.byViews.slice(0, 5).map((v, idx) => (
                <Pressable key={v.id} style={styles.hCard} onPress={() => onOpenVideo(v.id)}>
                  <View style={styles.hThumbWrap}>
                    <Image
                      source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_IMAGE}
                      style={styles.hThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>{idx + 1}位</Text>
                    </View>
                  </View>
                  <Text style={styles.hTitle} numberOfLines={2} ellipsizeMode="tail">
                    {v.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ランキング（評価） */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ランキング（評価）</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {data.rankings.byRating.slice(0, 5).map((v, idx) => (
                <Pressable key={v.id} style={styles.hCard} onPress={() => onOpenVideo(v.id)}>
                  <View style={styles.hThumbWrap}>
                    <Image
                      source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_IMAGE}
                      style={styles.hThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>{idx + 1}位</Text>
                    </View>
                  </View>
                  <Text style={styles.hTitle} numberOfLines={2} ellipsizeMode="tail">
                    {v.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ランキング（総合） */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ランキング（総合）</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {data.rankings.overall.slice(0, 5).map((v, idx) => (
                <Pressable key={v.id} style={styles.hCard} onPress={() => onOpenVideo(v.id)}>
                  <View style={styles.hThumbWrap}>
                    <Image
                      source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_IMAGE}
                      style={styles.hThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>{idx + 1}位</Text>
                    </View>
                  </View>
                  <Text style={styles.hTitle} numberOfLines={2} ellipsizeMode="tail">
                    {v.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionMeta: {
    color: THEME.textMuted,
    fontSize: 10,
  },
  hList: {
    gap: 12,
    paddingLeft: 16,
    paddingRight: 16,
  },
  hCard: {
    width: 150,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'hidden',
  },
  pickupCard: {
    width: 280,
    borderRadius: 18,
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
  pickupThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: THEME.card,
    overflow: 'hidden',
  },
  hThumb: {
    width: '100%',
    height: '100%',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: THEME.accent,
  },
  rankBadgeText: {
    color: THEME.card,
    fontSize: 10,
    fontWeight: '900',
  },
  hTitle: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pickupTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
})
