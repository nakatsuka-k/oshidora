import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import RenderHtml from 'react-native-render-html'
import { ScreenContainer, THEME } from '../components'
import { apiFetch } from '../utils/api'
import { getMockNoticeDetail } from '../utils/mockNotices'

type NoticeDetailScreenProps = {
  apiBaseUrl: string
  noticeId: string
  mock: boolean
  onBack: () => void
}

type NoticeDetail = {
  id: string
  title: string
  publishedAt: string
  bodyHtml: string
}

type NoticeDetailResponse = {
  item: NoticeDetail | null
}

export function NoticeDetailScreen({ apiBaseUrl, noticeId, mock, onBack }: NoticeDetailScreenProps) {
  const { width } = useWindowDimensions()
  const contentWidth = Math.max(1, Math.min(828, Math.round(width - 32)))

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

  const title = item?.title ?? 'お知らせ詳細'

  const htmlSource = useMemo(() => ({ html: item?.bodyHtml ?? '' }), [item?.bodyHtml])

  return (
    <ScreenContainer title={title} onBack={onBack} scroll>
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
            <Text style={styles.meta}>{item.publishedAt}</Text>
            <View style={styles.htmlWrap}>
              <RenderHtml
                contentWidth={contentWidth}
                source={htmlSource}
                baseStyle={styles.htmlBase}
                tagsStyles={htmlTagStyles}
              />
            </View>
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
  meta: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  htmlWrap: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  htmlBase: {
    color: THEME.text,
    fontSize: 13,
    lineHeight: 20,
  },
})
