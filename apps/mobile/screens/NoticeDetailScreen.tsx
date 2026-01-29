import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import RenderHtml from 'react-native-render-html'
import { ScreenContainer, THEME } from '../components'
import { apiFetch } from '../utils/api'
import { getMockNoticeDetail } from '../utils/mockNotices'
import { type NoticeDetailScreenProps, type NoticeDetail, type NoticeDetailResponse } from '../types/noticeDetailScreenTypes'

export function NoticeDetailScreen({ apiBaseUrl, noticeId, mock, onBack }: NoticeDetailScreenProps) {
  const { width } = useWindowDimensions()
  const contentWidth = Math.max(1, Math.min(768, Math.round(width - 32)))

  const [item, setItem] = useState<NoticeDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!noticeId) {
      setItem(null)
      setLoading(false)
      setError('')
      return
    }

    if (mock) {
      setItem(getMockNoticeDetail(noticeId))
      setLoading(false)
      setError('')
      return
    }

    void (async () => {
      setLoading(true)
      setError('')
      setItem(null)
      try {
        const res = await apiFetch(`${apiBaseUrl}/v1/notices/${encodeURIComponent(noticeId)}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as NoticeDetailResponse
        if (!cancelled) setItem(json.item ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, noticeId, mock])

  const htmlSource = useMemo(() => ({ html: item?.bodyHtml ?? '' }), [item?.bodyHtml])

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
            <Text style={styles.bannerErrorText}>詳細を取得できませんでした（{error}）</Text>
          </View>
        ) : null}

        {!loading && !error && !item ? (
          <View style={styles.centerBox}>
            <Text style={styles.centerText}>お知らせが見つかりません</Text>
          </View>
        ) : null}

        {!loading && item ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{item.publishedAt}</Text>
              <View style={styles.tagBadge}>
                <Text style={styles.tagText}>{item.tags?.[0] ?? 'お知らせ'}</Text>
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <RenderHtml
              contentWidth={contentWidth}
              source={htmlSource}
              baseStyle={styles.htmlBase}
              tagsStyles={htmlTagStyles}
            />
          </ScrollView>
        ) : null}
      </View>
    </ScreenContainer>
  )
}

const htmlTagStyles = {
  p: { marginTop: 0, marginBottom: 12 },
  a: { color: THEME.accent },
  strong: { fontWeight: '900' },
} as const

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
  content: {
    paddingBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  meta: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tagBadge: {
    backgroundColor: '#585858',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    color: '#E6E6E6',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 26,
    marginBottom: 14,
  },
  htmlBase: {
    color: THEME.text,
    fontSize: 13,
    lineHeight: 20,
  },
})
