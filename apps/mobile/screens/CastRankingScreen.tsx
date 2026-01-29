import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, TabBar, THEME } from '../components'
import { apiFetch } from '../utils/api'
import type { CastRankingItem, CastRankingResponse, CastRankingScreenProps, CastRankingType } from '../types/castRankingTypes'

import IconNotification from '../assets/icon_notification.svg'

const FALLBACK_AVATAR = require('../assets/thumbnail-sample.png')
const NOTICE_LAST_READ_KEY = 'notice_last_read_at'

const TYPE_TABS: Array<{ type: CastRankingType; label: string; title: string }> = [
  { type: 'actors', label: '俳優', title: '人気俳優ランキング' },
  { type: 'directors', label: '監督', title: '人気監督ランキング' },
  { type: 'writers', label: '脚本', title: '人気脚本ランキング' },
]

export function CastRankingScreen({ apiBaseUrl, onBack, onPressTab, onOpenProfile, onOpenNotice }: CastRankingScreenProps) {
  const [type, setType] = useState<CastRankingType>('actors')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<CastRankingItem[]>([])

  const [hasUnreadNotice, setHasUnreadNotice] = useState(false)
  const [latestNoticeAt, setLatestNoticeAt] = useState<string>('')

  const title = useMemo(() => TYPE_TABS.find((t) => t.type === type)?.title ?? '人気ランキング', [type])

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
      const list = Array.isArray(json.items) ? json.items : []
      const latest = list.length ? list[0] : null
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

  const fetchRanking = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const u = new URL(`${apiBaseUrl}/v1/rankings/casts`)
      u.searchParams.set('type', type)
      u.searchParams.set('limit', '30')
      const res = await apiFetch(u.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json().catch(() => ({}))) as CastRankingResponse
      const list = Array.isArray(json.items) ? (json.items as CastRankingItem[]) : []
      setItems(list)
    } catch (e) {
      setItems([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, type])

  useEffect(() => {
    void fetchRanking()
  }, [fetchRanking])

  useEffect(() => {
    void fetchUnreadNotice()
  }, [fetchUnreadNotice])

  return (
    <ScreenContainer
      title={title}
      onBack={onBack}
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
      maxWidth={768}
    >
      <View style={styles.root}>
        <View style={styles.topTabsWrap}>
          <View style={styles.topTabsRow}>
            {TYPE_TABS.map((t) => (
              <Pressable key={t.type} style={styles.topTab} onPress={() => setType(t.type)}>
                <Text style={[styles.topTabText, type === t.type ? styles.topTabTextActive : null]}>{t.label}</Text>
                {type === t.type ? <View style={styles.topTabUnderline} /> : null}
              </Pressable>
            ))}
          </View>
          <View style={styles.topTabsBaseline} />
        </View>

        {busy ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text style={styles.noteText}>ランキングの取得に失敗しました</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {items.map((it) => (
              <Pressable
                key={`${it.rank}:${it.cast.id}`}
                style={styles.row}
                onPress={() => onOpenProfile({ id: it.cast.id, name: it.cast.name, role: it.cast.role })}
              >
                <Text style={styles.rankNo}>{it.rank}</Text>
                <Image
                  source={it.cast.thumbnailUrl ? { uri: it.cast.thumbnailUrl } : FALLBACK_AVATAR}
                  style={styles.avatar}
                  resizeMode="cover"
                />
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={1}>
                    {it.cast.name}
                  </Text>
                  {it.cast.role ? (
                    <Text style={styles.role} numberOfLines={1}>
                      {it.cast.role}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
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
  topTabsWrap: {
    marginBottom: 12,
  },
  topTabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 18,
  },
  topTab: {
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  topTabText: {
    color: THEME.textMuted,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  topTabTextActive: {
    color: THEME.accent,
  },
  topTabUnderline: {
    height: 2,
    width: '100%',
    backgroundColor: THEME.accent,
    borderRadius: 999,
  },
  topTabsBaseline: {
    height: 1,
    backgroundColor: THEME.outline,
  },
  loadingCenter: {
    paddingTop: 18,
    alignItems: 'center',
  },
  noteText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
    gap: 12,
  },
  rankNo: {
    width: 22,
    textAlign: 'center',
    color: THEME.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: THEME.placeholder,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 3,
  },
  role: {
    color: THEME.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    color: THEME.textMuted,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 20,
  },
})
