import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, THEME } from '../components'
import { apiFetch } from '../utils/api'
import { getMockNoticeListItems } from '../utils/mockNotices'

type NoticeListScreenProps = {
  apiBaseUrl: string
  loggedIn: boolean
  mock: boolean
  onBack: () => void
  onOpenDetail: (id: string) => void
}

type NoticeListItem = {
  id: string
  title: string
  publishedAt: string
  excerpt: string
}

type NoticeListResponse = {
  items: NoticeListItem[]
}

export function NoticeListScreen({ apiBaseUrl, loggedIn, mock, onBack, onOpenDetail }: NoticeListScreenProps) {
  const [items, setItems] = useState<NoticeListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const emptyState = useMemo(() => {
    if (!loggedIn) {
      return {
        title: 'お知らせはありません',
        body: '未ログインのため、お知らせ一覧は表示されません。',
      }
    }
    return {
      title: 'お知らせはありません',
      body: '現在表示できるお知らせがありません。',
    }
  }, [loggedIn])

  useEffect(() => {
    let cancelled = false

    if (mock) {
      setItems(getMockNoticeListItems())
      setLoading(false)
      setError('')
      return
    }

    if (!loggedIn) {
      setItems([])
      setLoading(false)
      setError('')
      return
    }

    void (async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiFetch(`${apiBaseUrl}/v1/notices`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as NoticeListResponse
        if (!cancelled) setItems(Array.isArray(json.items) ? json.items : [])
      } catch (e) {
        if (!cancelled) {
          setItems([])
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, loggedIn, mock])

  return (
    <ScreenContainer title="お知らせ" onBack={onBack} scroll>
      <View style={styles.root}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={THEME.accent} />
            <Text style={styles.centerText}>読み込み中...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.bannerError}>
            <Text style={styles.bannerErrorText}>一覧を取得できませんでした（{error}）</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyTitle}>{emptyState.title}</Text>
            <Text style={styles.emptyBody}>{emptyState.body}</Text>
          </View>
        ) : null}

        {!loading && items.length > 0 ? (
          <ScrollView contentContainerStyle={styles.list}>
            {items.map((n) => (
              <Pressable key={n.id} style={styles.card} onPress={() => onOpenDetail(n.id)}>
                <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                  {n.title}
                </Text>
                <Text style={styles.meta}>{n.publishedAt}</Text>
                <Text style={styles.excerpt} numberOfLines={3} ellipsizeMode="tail">
                  {n.excerpt}
                </Text>
                <Text style={styles.link}>詳細へ</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bannerError: {
    borderWidth: 1,
    borderColor: THEME.danger,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  bannerErrorText: {
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  centerText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyBody: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  list: {
    paddingBottom: 12,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  title: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  meta: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  excerpt: {
    color: THEME.text,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  link: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
})
