import { useEffect, useMemo, useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { ScreenContainer, TabBar, THEME } from '../components'

type VideoListScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: 'home' | 'video' | 'cast' | 'search' | 'mypage') => void
  onOpenVideo: (id: string) => void
}

type Video = {
  id: string
  title: string
  rating: number
  ratingCount: number
  thumbnailUrl?: string
}

type Category = { id: string; name: string }
type CastStaff = { id: string; name: string; role: string; thumbnailUrl?: string }

type VideosResponse = { items: Video[] }
type CategoriesResponse = { items: Category[] }
type CastResponse = { items: CastStaff[] }

const FALLBACK_IMAGE = require('../assets/oshidora-logo.png')

export function VideoListScreen({ apiBaseUrl, onPressTab, onOpenVideo }: VideoListScreenProps) {
  const mockCategories = useMemo<Category[]>(
    () => [
      { id: 'c1', name: 'ドラマ' },
      { id: 'c2', name: 'ミステリー' },
      { id: 'c3', name: '恋愛' },
      { id: 'c4', name: 'コメディ' },
      { id: 'c5', name: 'アクション' },
    ],
    []
  )

  const mockCast = useMemo<CastStaff[]>(
    () => [
      { id: 'a1', name: '松岡美沙', role: '出演者' },
      { id: 'a2', name: '櫻井拓馬', role: '出演者' },
      { id: 'a3', name: '監督太郎', role: '監督' },
      { id: 'a4', name: 'Oshidora株式会社', role: '制作' },
    ],
    []
  )

  const mockVideos = useMemo<Video[]>(
    () => [
      { id: 'v1', title: 'ダウトコール 第01話', rating: 4.7, ratingCount: 128 },
      { id: 'v2', title: 'ダウトコール 第02話', rating: 4.6, ratingCount: 94 },
      { id: 'v3', title: 'ダウトコール 第03話', rating: 4.8, ratingCount: 156 },
      { id: 'v4', title: 'ミステリーX 第01話', rating: 4.4, ratingCount: 61 },
      { id: 'v5', title: 'ラブストーリーY 第01話', rating: 4.2, ratingCount: 43 },
    ],
    []
  )

  const [categories, setCategories] = useState<Category[]>(mockCategories)
  const [cast, setCast] = useState<CastStaff[]>(mockCast)
  const [videos, setVideos] = useState<Video[]>(mockVideos)
  const [loadError, setLoadError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadError('')
      try {
        const [catRes, castRes, vidsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/v1/categories`),
          fetch(`${apiBaseUrl}/v1/cast`),
          fetch(`${apiBaseUrl}/v1/videos`),
        ])
        if (!catRes.ok || !castRes.ok || !vidsRes.ok) {
          throw new Error('データ取得に失敗しました')
        }
        const cats = (await catRes.json()) as CategoriesResponse
        const c = (await castRes.json()) as CastResponse
        const v = (await vidsRes.json()) as VideosResponse
        if (!cancelled) {
          setCategories(Array.isArray(cats.items) ? cats.items : mockCategories)
          setCast(Array.isArray(c.items) ? c.items : mockCast)
          setVideos(Array.isArray(v.items) ? v.items : mockVideos)
        }
      } catch (e) {
        if (!cancelled) {
          setCategories(mockCategories)
          setCast(mockCast)
          setVideos(mockVideos)
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, mockCast, mockCategories, mockVideos])

  return (
    <ScreenContainer>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>動画一覧</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* カテゴリ一覧 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>カテゴリ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {categories.map((c) => (
                <Pressable key={c.id} style={styles.chip} onPress={() => {}}>
                  <Text style={styles.chipText}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* キャスト・スタッフ一覧 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>キャスト・スタッフ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {cast.map((p) => (
                <Pressable key={p.id} style={styles.personCard} onPress={() => {}}>
                  <Image source={FALLBACK_IMAGE} style={styles.personThumb} resizeMode="cover" />
                  <Text style={styles.personName} numberOfLines={1} ellipsizeMode="tail">
                    {p.name}
                  </Text>
                  <Text style={styles.personRole} numberOfLines={1} ellipsizeMode="tail">
                    {p.role}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* 動画一覧 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>動画</Text>
            {loadError ? <Text style={styles.loadError}>読み込みに失敗しました（モック表示）</Text> : null}

            <View style={styles.videoGrid}>
              {videos.map((v) => (
                <Pressable key={v.id} style={styles.videoCard} onPress={() => onOpenVideo(v.id)}>
                  <Image source={FALLBACK_IMAGE} style={styles.videoThumb} resizeMode="cover" />
                  <View style={styles.videoMeta}>
                    <Text style={styles.videoTitle} numberOfLines={2} ellipsizeMode="tail">
                      {v.title}
                    </Text>
                    <Text style={styles.videoRating}>
                      ★ {v.rating.toFixed(1)}（{v.ratingCount}）
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <TabBar active="video" onPress={onPressTab} />
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
  headerTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '800',
  },
  scrollContent: {
    paddingBottom: 96,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
    marginTop: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  chipText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
  },
  hList: {
    gap: 12,
    paddingRight: 8,
  },
  personCard: {
    width: 132,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  personThumb: {
    width: '100%',
    height: 84,
  },
  personName: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  personRole: {
    color: THEME.textMuted,
    fontSize: 10,
    paddingHorizontal: 10,
    paddingTop: 2,
  },
  loadError: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 10,
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  videoCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    overflow: 'hidden',
  },
  videoThumb: {
    width: '100%',
    height: 96,
  },
  videoMeta: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  videoTitle: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  videoRating: {
    color: THEME.textMuted,
    fontSize: 10,
  },
})
