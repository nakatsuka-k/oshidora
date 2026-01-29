import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { ScreenContainer, TabBar, THEME } from '../components'
import { apiFetch } from '../utils/api'
import { getString, setString } from '../utils/storage'
import {
  type TabKey,
  type TopScreenProps,
  type VideoItem,
  type CastItem,
  type TopData,
  type NoticeListItem,
  type NoticeListResponse,
  EMPTY_TOP_DATA,
  parseNoticeTime,
} from '../types/topScreenTypes'

import IconNotification from '../assets/icon_notification.svg'
import IconSearch from '../assets/icon_search.svg'

const LOGO_IMAGE = require('../assets/oshidora_logo.png')
const FALLBACK_IMAGE = require('../assets/thumbnail-sample.png')
const NOTICE_LAST_READ_AT_KEY = 'notice_last_read_at'

export function TopScreen({ apiBaseUrl, onPressTab, onOpenVideo, onOpenRanking, onOpenFavorites, onOpenNotice }: TopScreenProps) {
  const { width } = useWindowDimensions()
  const [data, setData] = useState<TopData>(EMPTY_TOP_DATA)
  const [loadError, setLoadError] = useState<string>('')
  const [pickupIndex, setPickupIndex] = useState(0)
  const [hasUnreadNotice, setHasUnreadNotice] = useState(false)
  const [latestNoticeAt, setLatestNoticeAt] = useState<string>('')

  const pickupCardWidth = Math.min(340, Math.max(260, Math.round(width - 32)))
  const pickupSnap = pickupCardWidth + 12

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadError('')
      try {
        const res = await apiFetch(`${apiBaseUrl}/v1/top`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as TopData
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) {
          setData(EMPTY_TOP_DATA)
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(`${apiBaseUrl}/v1/notices`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as NoticeListResponse
        const latest = Array.isArray(json.items) && json.items.length > 0 ? json.items[0] : null
        const latestMillis = latest ? parseNoticeTime(latest.publishedAt) : 0
        if (!cancelled) setLatestNoticeAt(latest?.publishedAt ?? '')
        const lastReadRaw = await getString(NOTICE_LAST_READ_AT_KEY)
        const lastReadMillis = lastReadRaw ? parseNoticeTime(lastReadRaw) : 0
        const unread = latestMillis > 0 && latestMillis > lastReadMillis
        if (!cancelled) setHasUnreadNotice(unread)
      } catch {
        if (!cancelled) {
          setHasUnreadNotice(false)
          setLatestNoticeAt('')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl])

  return (
    <ScreenContainer
      headerLeft={<Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />}
      maxWidth={768}
      headerRight={
        <View style={styles.headerRightRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="お知らせ"
            onPress={async () => {
              if (latestNoticeAt) await setString(NOTICE_LAST_READ_AT_KEY, latestNoticeAt)
              setHasUnreadNotice(false)
              onOpenNotice()
            }}
            style={styles.headerIconButton}
          >
            <IconNotification width={22} height={22} />
            {hasUnreadNotice ? <View style={styles.noticeDot} /> : null}
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
      footer={<TabBar active="home" onPress={onPressTab} />}
      footerPaddingHorizontal={0}
    >
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ピックアップ動画 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ピックアップ</Text>
              {loadError ? (
                <Text style={styles.sectionMeta}>読み込み失敗</Text>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickupList}
              snapToInterval={pickupSnap}
              decelerationRate="fast"
              onMomentumScrollEnd={(e) => {
                const x = e.nativeEvent.contentOffset.x
                const next = Math.round(x / pickupSnap)
                setPickupIndex(Math.max(0, Math.min(next, data.pickup.length - 1)))
              }}
            >
              {data.pickup.slice(0, 6).map((v) => (
                <Pressable
                  key={v.id}
                  style={[styles.pickupCard, { width: pickupCardWidth }]}
                  onPress={() => onOpenVideo(v.id)}
                >
                  <View style={styles.pickupThumbWrap}>
                    <Image
                      source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_IMAGE}
                      style={styles.pickupThumb}
                      resizeMode="cover"
                    />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.pickupDots}>
              {data.pickup.slice(0, 6).map((_, idx) => (
                <View key={`dot-${idx}`} style={[styles.pickupDot, idx === pickupIndex ? styles.pickupDotActive : null]} />
              ))}
            </View>
          </View>

          {/* おすすめ動画 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>おすすめ</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {data.recommended.slice(0, 6).map((v) => (
                <Pressable key={v.id} style={styles.recommendCard} onPress={() => onOpenVideo(v.id)}>
                  <View style={styles.recommendThumbWrap}>
                    <Image
                      source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_IMAGE}
                      style={styles.recommendThumb}
                      resizeMode="cover"
                    />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ランキング（再生数） */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>再生数ランキング</Text>
              <Pressable style={styles.sectionAction} onPress={onOpenRanking}>
                <Text style={styles.sectionActionText}>›</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {data.rankings.byViews.slice(0, 5).map((v, idx) => (
                <Pressable key={v.id} style={styles.rankCard} onPress={() => onOpenVideo(v.id)}>
                  <View style={styles.rankThumbWrap}>
                    <Text style={styles.rankNumber}>{idx + 1}</Text>
                    <View style={styles.rankThumbClip}>
                      <Image
                        source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_IMAGE}
                        style={styles.rankThumb}
                        resizeMode="cover"
                      />
                    </View>
                    {idx === 0 ? (
                      <View style={styles.rankLabelNew}>
                        <Text style={styles.rankLabelText}>新着</Text>
                      </View>
                    ) : idx === 1 ? (
                      <View style={styles.rankLabelRecommend}>
                        <Text style={styles.rankLabelText}>おすすめ</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* 人気俳優ランキング */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>人気俳優ランキング</Text>
              <Pressable style={styles.sectionAction} onPress={onOpenRanking}>
                <Text style={styles.sectionActionText}>›</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.castList}>
              {data.popularCasts.slice(0, 5).map((c, idx) => (
                <Pressable key={c.id} style={styles.castCard} onPress={onOpenRanking}>
                  <View style={styles.castThumbWrap}>
                    <View style={styles.castThumbClip}>
                      <Image
                        source={c.thumbnailUrl ? { uri: c.thumbnailUrl } : FALLBACK_IMAGE}
                        style={styles.castThumb}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.castRankWrap}>
                      <Text style={styles.castRankNumberStroke}>{idx + 1}</Text>
                      <Text style={styles.castRankNumberFill}>{idx + 1}</Text>
                    </View>
                  </View>
                  <Text style={styles.castName} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* 評価ランキング */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>評価ランキング</Text>
              <Pressable style={styles.sectionAction} onPress={onOpenRanking}>
                <Text style={styles.sectionActionText}>›</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {data.rankings.byRating.slice(0, 5).map((v, idx) => (
                <Pressable key={v.id} style={styles.rankCard} onPress={() => onOpenVideo(v.id)}>
                  <View style={styles.rankThumbWrap}>
                    <Image
                      source={v.thumbnailUrl ? { uri: v.thumbnailUrl } : FALLBACK_IMAGE}
                      style={styles.rankThumb}
                      resizeMode="cover"
                    />
                    {idx === 0 ? (
                      <View style={styles.rankLabelNew}>
                        <Text style={styles.rankLabelText}>新着</Text>
                      </View>
                    ) : idx === 1 ? (
                      <View style={styles.rankLabelRecommend}>
                        <Text style={styles.rankLabelText}>おすすめ</Text>
                      </View>
                    ) : null}
                    <Text style={styles.rankNumber}>{idx + 1}</Text>
                  </View>
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
  noticeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FF3B30',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#E6E6E6',
    fontSize: 15,
    fontWeight: '900',
  },
  sectionMeta: {
    color: THEME.textMuted,
    fontSize: 10,
  },
  sectionAction: {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionActionText: {
    color: THEME.textMuted,
    fontSize: 20,
    fontWeight: '700',
  },
  hList: {
    gap: 36,
    paddingLeft: 32,
    paddingRight: 32,
  },
  pickupList: {
    gap: 12,
    paddingLeft: 16,
    paddingRight: 16,
  },
  pickupCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: THEME.card,
  },
  pickupThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: THEME.card,
  },
  pickupThumb: {
    width: '100%',
    height: '100%',
  },
  pickupDots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingTop: 10,
  },
  pickupDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pickupDotActive: {
    backgroundColor: THEME.accent,
    width: 16,
    borderRadius: 999,
  },
  recommendCard: {
    width: 160,
    borderRadius: 14,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'hidden',
  },
  recommendThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: THEME.card,
    overflow: 'hidden',
  },
  recommendThumb: {
    width: '100%',
    height: '100%',
  },
  rankCard: {
    width: 160,
    borderRadius: 14,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'visible',
  },
  rankThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: THEME.card,
    overflow: 'visible',
    position: 'relative',
  },
  rankThumbClip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 14,
    zIndex: 1,
  },
  rankThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  rankLabelNew: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: '#FF3B30',
  },
  rankLabelRecommend: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: THEME.accent,
  },
  rankLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  rankNumber: {
    position: 'absolute',
    left: -18,
    bottom: 4,
    color: '#E6E6E6',
    fontSize: 32,
    fontWeight: '900',
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
    zIndex: 0,
  },
  castList: {
    gap: 16,
    paddingLeft: 16,
    paddingRight: 16,
  },
  castCard: {
    alignItems: 'center',
    width: 86,
  },
  castThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    overflow: 'visible',
    marginBottom: 8,
    position: 'relative',
  },
  castThumbClip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 999,
  },
  castThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  castRankWrap: {
    position: 'absolute',
    left: -10,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  castRankNumberStroke: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  castRankNumberFill: {
    color: 'transparent',
    fontSize: 24,
    fontWeight: '900',
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  castName: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '700',
  },
})
