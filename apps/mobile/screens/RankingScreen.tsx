import { useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, TabBar, THEME } from '../components'

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type RankingScreenProps = {
  onBack: () => void
  onPressTab: (key: TabKey) => void
  onOpenVideo: (id: string) => void
}

type RankingItem = {
  id: string
  title: string
  ratingAvg: number
  reviewCount: number
  description: string
  badge?: '新着' | 'おすすめ' | 'プレミア'
  thumbnailUrl?: string
}

type RankingTab = 'views' | 'rating' | 'total'

const FALLBACK_VIDEO_IMAGE = require('../assets/thumbnail-sample.png')

export function RankingScreen({ onBack, onPressTab, onOpenVideo }: RankingScreenProps) {
  const [tab, setTab] = useState<RankingTab>('views')

  const mockItems = useMemo<Record<RankingTab, RankingItem[]>>(
    () => ({
      views: [
        {
          id: 'content-1',
          title: 'カランコエの花',
          ratingAvg: 4.7,
          reviewCount: 375,
          description: 'ただ、あなたを守りたかった。',
          badge: '新着',
        },
        {
          id: 'content-2',
          title: '爽子の衝動',
          ratingAvg: 4.4,
          reviewCount: 61,
          description: 'ただ、あなたを守りたかった。',
          badge: 'おすすめ',
        },
        {
          id: 'content-3',
          title: '影の交渉人',
          ratingAvg: 4.3,
          reviewCount: 22,
          description: 'ただ、あなたを守りたかった。',
          badge: '新着',
        },
        {
          id: 'content-4',
          title: '蔵のある街',
          ratingAvg: 4.1,
          reviewCount: 43,
          description: 'ただ、あなたを守りたかった。',
          badge: 'プレミア',
        },
        {
          id: 'content-5',
          title: 'ROUTE 29',
          ratingAvg: 4.3,
          reviewCount: 37,
          description: '大丈夫。きっとふたりなら。',
        },
        {
          id: 'content-6',
          title: 'BAUS 映画館から始出した恋',
          ratingAvg: 4.5,
          reviewCount: 61,
          description: 'ただ、あなたを守りたかった。',
        },
      ],
      rating: [
        {
          id: 'content-7',
          title: 'ミステリーX',
          ratingAvg: 4.9,
          reviewCount: 128,
          description: 'ただ、あなたを守りたかった。',
          badge: 'おすすめ',
        },
        {
          id: 'content-8',
          title: 'ダウトコール',
          ratingAvg: 4.8,
          reviewCount: 156,
          description: 'ただ、あなたを守りたかった。',
          badge: 'プレミア',
        },
        {
          id: 'content-9',
          title: 'ラブストーリーY',
          ratingAvg: 4.7,
          reviewCount: 94,
          description: 'ただ、あなたを守りたかった。',
        },
        {
          id: 'content-10',
          title: 'アクションW',
          ratingAvg: 4.6,
          reviewCount: 88,
          description: 'ただ、あなたを守りたかった。',
        },
        {
          id: 'content-11',
          title: 'コメディZ',
          ratingAvg: 4.5,
          reviewCount: 52,
          description: 'ただ、あなたを守りたかった。',
        },
      ],
      total: [
        {
          id: 'content-12',
          title: 'ダウトコール',
          ratingAvg: 4.8,
          reviewCount: 156,
          description: 'ただ、あなたを守りたかった。',
          badge: 'おすすめ',
        },
        {
          id: 'content-13',
          title: 'ミステリーX',
          ratingAvg: 4.6,
          reviewCount: 120,
          description: 'ただ、あなたを守りたかった。',
        },
        {
          id: 'content-14',
          title: 'ラブストーリーY',
          ratingAvg: 4.5,
          reviewCount: 88,
          description: 'ただ、あなたを守りたかった。',
        },
        {
          id: 'content-15',
          title: 'コメディZ',
          ratingAvg: 4.3,
          reviewCount: 63,
          description: 'ただ、あなたを守りたかった。',
          badge: '新着',
        },
        {
          id: 'content-16',
          title: 'アクションW',
          ratingAvg: 4.2,
          reviewCount: 40,
          description: 'ただ、あなたを守りたかった。',
        },
      ],
    }),
    []
  )

  const items = mockItems[tab]

  return (
    <ScreenContainer title="作品一覧" onBack={onBack} footer={<TabBar active="video" onPress={onPressTab} />} footerPaddingHorizontal={0}>
      <View style={styles.root}>
        <View style={styles.tabsWrap}>
          <View style={styles.tabsRow}>
            <Pressable style={styles.tabItem} onPress={() => setTab('views')}>
            <Text style={[styles.tabText, tab === 'views' ? styles.tabTextActive : null]}>再生数ランキング</Text>
            {tab === 'views' ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
            <Pressable style={styles.tabItem} onPress={() => setTab('rating')}>
            <Text style={[styles.tabText, tab === 'rating' ? styles.tabTextActive : null]}>評価ランキング</Text>
            {tab === 'rating' ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
            <Pressable style={styles.tabItem} onPress={() => setTab('total')}>
            <Text style={[styles.tabText, tab === 'total' ? styles.tabTextActive : null]}>総合ランキング</Text>
            {tab === 'total' ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          </View>
          <View style={styles.tabsBaseline} />
        </View>

        <ScrollView contentContainerStyle={styles.listContent}>
          {items.map((item, idx) => (
            <Pressable key={item.id} style={styles.rankRow} onPress={() => onOpenVideo(item.id)}>
              <View style={styles.thumbWrap}>
                <Text style={styles.rankNumber}>{idx + 1}</Text>
                <View style={styles.thumbClip}>
                  <Image
                    source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : FALLBACK_VIDEO_IMAGE}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                </View>
                {item.badge ? (
                  <View
                    style={[
                      styles.badge,
                      item.badge === 'おすすめ'
                        ? styles.badgeRecommend
                        : item.badge === '新着'
                          ? styles.badgeNew
                          : styles.badgePremium,
                    ]}
                  >
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                  {item.title}
                </Text>
                <Text style={styles.rating}>
                  ★{item.ratingAvg.toFixed(1)}（{item.reviewCount}件）
                </Text>
                <Text style={styles.desc} numberOfLines={2} ellipsizeMode="tail">
                  {item.description}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabsWrap: {
    paddingHorizontal: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tabsBaseline: {
    height: 1,
    backgroundColor: THEME.outline,
  },
  tabItem: {
    alignItems: 'flex-start',
  },
  tabText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  tabTextActive: {
    color: THEME.accent,
  },
  tabUnderline: {
    height: 1,
    borderRadius: 999,
    backgroundColor: THEME.accent,
    width: '100%',
    alignSelf: 'flex-start',
  },
  listContent: {
    paddingBottom: 24,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  rankNumber: {
    position: 'absolute',
    left: -18,
    bottom: 2,
    color: '#E6E6E6',
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    zIndex: 0,
  },
  thumbWrap: {
    width: 132,
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'visible',
    backgroundColor: THEME.card,
    position: 'relative',
  },
  thumbClip: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 1,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
    zIndex: 2,
  },
  badgeNew: {
    backgroundColor: '#FF3B30',
  },
  badgeRecommend: {
    backgroundColor: THEME.accent,
  },
  badgePremium: {
    backgroundColor: '#6C5CE7',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#E6E6E6',
    fontSize: 13,
    fontWeight: '800',
  },
  rating: {
    color: THEME.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  desc: {
    color: THEME.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
})
