import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, THEME } from '../components'
import { apiFetch } from '../utils/api'
import { setString } from '../utils/storage'

const NOTICE_LAST_READ_AT_KEY = 'notice_last_read_at'

type NoticeListScreenProps = {
  apiBaseUrl: string
  loggedIn: boolean
  onBack: () => void
  onOpenDetail: (id: string) => void
  onLogin: () => void
}

type NoticeListItem = {
  id: string
  title: string
  publishedAt: string
  excerpt: string
  tags?: string[]
}

type NoticeListResponse = {
  items: NoticeListItem[]
}

export function NoticeListScreen({ apiBaseUrl, loggedIn, onBack, onOpenDetail, onLogin }: NoticeListScreenProps) {
  const [items, setItems] = useState<NoticeListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const emptyState = useMemo(() => {
    return {
      title: 'お知らせはありません',
      body: !loggedIn ? 'ログインすると、\n通知として受け取れます。' : '現在表示できるお知らせがありません。',
    }
  }, [loggedIn])

  useEffect(() => {
    let cancelled = false

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
  }, [apiBaseUrl, loggedIn])

  useEffect(() => {
    const latest = items[0]
    if (!latest?.publishedAt) return
    void setString(NOTICE_LAST_READ_AT_KEY, latest.publishedAt)
  }, [items])

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
            {!loggedIn ? (
              <View style={styles.loginCta}>
                <PrimaryButton label="ログイン画面へ" onPress={onLogin} />
              </View>
            ) : null}
          </View>
        ) : null}

        {!loading && items.length > 0 ? (
          <ScrollView contentContainerStyle={styles.list}>
            {items.map((n, idx) => {
              const tag = n.tags?.[0] || 'お知らせ'
              return (
                <Pressable key={n.id} style={[styles.row, idx === 0 ? styles.rowFirst : null]} onPress={() => onOpenDetail(n.id)}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowMeta}>
                      <Text style={styles.meta}>{n.publishedAt}</Text>
                      <View style={styles.tagBadge}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    </View>
                    <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                      {n.title}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              )
            })}
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
    flex: 1,
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
  loginCta: {
    width: '100%',
    maxWidth: 260,
    marginTop: 16,
  },
  list: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  meta: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  rowFirst: {
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
  },
  rowMain: {
    flex: 1,
    paddingRight: 12,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  tagBadge: {
    backgroundColor: THEME.card,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
  },
  chevron: {
    color: THEME.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
})
