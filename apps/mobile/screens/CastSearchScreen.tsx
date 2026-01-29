import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { ScreenContainer, TabBar, THEME } from '../components'
import { apiFetch } from '../utils/api'
import {
  type CastSearchScreenProps,
  normalize,
} from '../types/castSearchTypes'
import IconNotification from '../assets/icon_notification.svg'
import IconSearch from '../assets/icon_search.svg'

const FALLBACK_AVATAR = require('../assets/thumbnail-sample.png')
const NOTICE_LAST_READ_KEY = 'notice_last_read_at'

type RankingItem = {
  rank: number
  cast: { id: string; name: string; role: string; thumbnailUrl?: string }
}

type RankingResponse = {
  asOf?: string
  items?: RankingItem[]
}

const CATEGORY_GROUPS: Array<{ key: string; label: string; tags: string[] }> = [
  {
    key: 'classic',
    label: '定番・王道ジャンル',
    tags: ['アクション', 'アドベンチャー', 'SF', 'ファンタジー', 'ミステリー', 'サスペンス', 'スリラー', 'ホラー', 'パニック', 'クライム（犯罪）', 'スパイ・諜報もの'],
  },
  {
    key: 'drama',
    label: '感情・人間ドラマ',
    tags: ['恋愛', '青春', '家族', 'ヒューマンドラマ', '社会派', '伝記'],
  },
  {
    key: 'comedy',
    label: 'コメディ・ライト',
    tags: ['コメディ', 'ラブコメ', '学園', '日常', 'ライト'],
  },
]

export function CastSearchScreen({ apiBaseUrl, onPressTab, onOpenProfile, onOpenResults, onOpenCastRanking, onOpenNotice }: CastSearchScreenProps) {
  const [tab, setTab] = useState<'name' | 'content'>('name')

  const [keyword, setKeyword] = useState('')
  const [contentKeyword, setContentKeyword] = useState('')

  const [rankingBusy, setRankingBusy] = useState(false)
  const [rankingError, setRankingError] = useState('')
  const [rankingItems, setRankingItems] = useState<RankingItem[]>([])

  const [categoryTab, setCategoryTab] = useState(CATEGORY_GROUPS[0]?.key ?? 'classic')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const [hasUnreadNotice, setHasUnreadNotice] = useState(false)
  const [latestNoticeAt, setLatestNoticeAt] = useState<string>('')

  const fetchRanking = useCallback(async () => {
    setRankingBusy(true)
    setRankingError('')
    try {
      const u = new URL(`${apiBaseUrl}/v1/rankings/casts`)
      u.searchParams.set('type', 'actors')
      u.searchParams.set('limit', '10')
      const res = await apiFetch(u.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json().catch(() => ({}))) as RankingResponse
      const items = Array.isArray(json.items) ? json.items : []
      setRankingItems(items)
    } catch (e) {
      setRankingItems([])
      setRankingError(e instanceof Error ? e.message : String(e))
    } finally {
      setRankingBusy(false)
    }
  }, [apiBaseUrl])

  const parseNoticeTime = useCallback((value: string) => {
    const d = new Date(value)
    const t = d.getTime()
    return Number.isFinite(t) ? t : 0
  }, [])

  const fetchUnreadNotice = useCallback(async () => {
    if (!onOpenNotice) {
      setHasUnreadNotice(false)
      return
    }
    try {
      const res = await apiFetch(`${apiBaseUrl}/v1/notices`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json().catch(() => ({}))) as { items?: any[] }
      const items = Array.isArray(json.items) ? json.items : []
      const latest = items.length ? items[0] : null
      const latestAt = String(latest?.publishedAt ?? '').trim()
      setLatestNoticeAt(latestAt)
      const lastRead = await AsyncStorage.getItem(NOTICE_LAST_READ_KEY)
      const unread = parseNoticeTime(latestAt) > parseNoticeTime(String(lastRead ?? ''))
      setHasUnreadNotice(unread)
    } catch {
      setHasUnreadNotice(false)
      setLatestNoticeAt('')
    }
  }, [apiBaseUrl, onOpenNotice, parseNoticeTime])

  useEffect(() => {
    void fetchRanking()
  }, [fetchRanking])

  useEffect(() => {
    void fetchUnreadNotice()
  }, [fetchUnreadNotice])

  const activeCategory = useMemo(() => CATEGORY_GROUPS.find((g) => g.key === categoryTab) ?? CATEGORY_GROUPS[0], [categoryTab])
  const categoryTabs = useMemo(() => CATEGORY_GROUPS, [])

  return (
    <ScreenContainer
      title="キャスト"
      headerRight={
        onOpenNotice ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="お知らせ"
            onPress={async () => {
              if (latestNoticeAt) await AsyncStorage.setItem(NOTICE_LAST_READ_KEY, latestNoticeAt)
              setHasUnreadNotice(false)
              onOpenNotice()
            }}
            style={styles.headerIconButton}
          >
            <View style={styles.noticeBellWrap}>
              <IconNotification width={22} height={22} />
              {hasUnreadNotice ? <View style={styles.noticeDot} /> : null}
            </View>
          </Pressable>
        ) : undefined
      }
      footer={<TabBar active="cast" onPress={onPressTab} />}
      footerPaddingHorizontal={0}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.root}>
          <View style={styles.topTabsWrap}>
            <View style={styles.topTabsRow}>
              <Pressable style={styles.topTab} onPress={() => setTab('name')}>
                <Text style={[styles.topTabText, tab === 'name' ? styles.topTabTextActive : null]}>名前から探す</Text>
                <View style={[styles.topTabUnderline, tab === 'name' ? styles.topTabUnderlineActive : null]} />
              </Pressable>
              <Pressable style={styles.topTab} onPress={() => setTab('content')}>
                <Text style={[styles.topTabText, tab === 'content' ? styles.topTabTextActive : null]}>作品から探す</Text>
                <View style={[styles.topTabUnderline, tab === 'content' ? styles.topTabUnderlineActive : null]} />
              </Pressable>
            </View>
            <View style={styles.topTabsBaseline} />
          </View>

          <View style={styles.searchBar}>
            <View style={styles.searchIcon}>
              <IconSearch width={18} height={18} />
            </View>
            <TextInput
              value={tab === 'name' ? keyword : contentKeyword}
              onChangeText={tab === 'name' ? setKeyword : setContentKeyword}
              placeholder={tab === 'name' ? '名前・役柄・ジャンルで検索' : '作品名で検索'}
              placeholderTextColor={THEME.textMuted}
              autoCapitalize="none"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => {
                const q = (tab === 'name' ? keyword : contentKeyword).trim()
                onOpenResults(q)
              }}
            />
          </View>

          {tab === 'name' ? (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>人気俳優ランキング</Text>
                  <Pressable accessibilityRole="button" onPress={() => onOpenCastRanking?.()} style={styles.sectionChevronBtn}>
                    <Text style={styles.sectionChevron}>›</Text>
                  </Pressable>
                </View>

                {rankingBusy ? (
                  <View style={styles.rankingLoading}>
                    <ActivityIndicator />
                  </View>
                ) : rankingError ? (
                  <Text style={styles.noteText}>ランキングの取得に失敗しました</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rankingRow}>
                    {rankingItems.slice(0, 10).map((it) => (
                      <Pressable
                        key={`${it.rank}:${it.cast.id}`}
                        style={styles.rankItem}
                        onPress={() => onOpenProfile({ id: it.cast.id, name: it.cast.name, role: it.cast.role })}
                      >
                        <View style={styles.avatarWrap}>
                          <Image
                            source={it.cast.thumbnailUrl ? { uri: it.cast.thumbnailUrl } : FALLBACK_AVATAR}
                            style={styles.avatar}
                            resizeMode="cover"
                          />
                          <View style={styles.rankBadge}>
                            <Text style={styles.rankNumber}>{it.rank}</Text>
                          </View>
                        </View>
                        <Text style={styles.rankName} numberOfLines={1}>
                          {it.cast.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>カテゴリ</Text>

                <View style={styles.subTabsWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabsRow}>
                    {categoryTabs.map((t) => (
                      <Pressable key={t.key} style={styles.subTab} onPress={() => setCategoryTab(t.key)}>
                        <Text style={[styles.subTabText, categoryTab === t.key ? styles.subTabTextActive : null]}>{t.label}</Text>
                        <View style={[styles.subTabUnderline, categoryTab === t.key ? styles.subTabUnderlineActive : null]} />
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={styles.subTabsBaseline} />
                </View>

                <View style={styles.tagWrap}>
                  {(activeCategory?.tags ?? []).map((t) => {
                    const selected = normalize(selectedTag ?? '') === normalize(t)
                    return (
                      <Pressable
                        key={t}
                        style={[styles.tag, selected ? styles.tagSelected : null]}
                        onPress={() => {
                          const next = selected ? null : t
                          setSelectedTag(next)
                          if (next) onOpenResults(next)
                        }}
                      >
                        <Text style={[styles.tagText, selected ? styles.tagTextSelected : null]}>{t}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBellWrap: {
    width: 22,
    height: 22,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FF3B30',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  topTabsWrap: {
    marginBottom: 12,
  },
  topTabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topTab: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 0,
    alignItems: 'center',
  },
  topTabText: {
    color: THEME.textMuted,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  topTabTextActive: {
    color: THEME.accent,
  },
  topTabUnderline: {
    height: 2,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    borderRadius: 999,
  },
  topTabUnderlineActive: {
    backgroundColor: THEME.accent,
  },
  topTabsBaseline: {
    height: 1,
    backgroundColor: THEME.outline,
  },
  searchBar: {
    height: 44,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 18,
    backgroundColor: 'transparent',
  },
  searchIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionChevronBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionChevron: {
    color: THEME.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 20,
  },
  rankingRow: {
    gap: 18,
    paddingBottom: 2,
  },
  rankingLoading: {
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  noteText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  rankItem: {
    width: 86,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: THEME.placeholder,
  },
  rankBadge: {
    position: 'absolute',
    left: -2,
    bottom: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  rankNumber: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  rankName: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  subTabsWrap: {
    marginBottom: 12,
  },
  subTabsRow: {
    gap: 18,
    paddingBottom: 0,
  },
  subTab: {
    alignItems: 'flex-start',
  },
  subTabText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  subTabTextActive: {
    color: THEME.accent,
  },
  subTabUnderline: {
    height: 2,
    backgroundColor: 'transparent',
    width: '100%',
    borderRadius: 999,
  },
  subTabUnderlineActive: {
    backgroundColor: THEME.accent,
  },
  subTabsBaseline: {
    height: 1,
    backgroundColor: THEME.outline,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  tagSelected: {
    borderColor: THEME.accent,
  },
  tagText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  tagTextSelected: {
    color: THEME.accent,
  },
})
