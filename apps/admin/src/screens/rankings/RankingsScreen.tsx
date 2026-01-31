import { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'

import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { CollapsibleSection } from '../../ui/CollapsibleSection'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
}

type CmsFetchJson = <T>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

function formatJaDateTime(value: string): string {
  const s = String(value ?? '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

type RankingVideo = {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  createdAt?: string
}

type RankingCast = {
  id: string
  name: string
  role: string
  thumbnailUrl: string
}

type RankingItem = {
  rank: number
  entityId: string
  label: string
  value: number
  video?: RankingVideo
  cast?: RankingCast
}

export function RankingsScreen({
  cfg,
  cmsFetchJson,
  type,
  title,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  type: 'videos' | 'coins' | 'actors' | 'directors' | 'writers'
  title: string
}) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [asOf, setAsOf] = useState('')
  const [items, setItems] = useState<RankingItem[]>([])
  const [openMeta, setOpenMeta] = useState(false)
  const [openList, setOpenList] = useState(true)

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[]; asOf: string }>(cfg, `/cms/rankings/${encodeURIComponent(type)}`)
      setAsOf(String((json as any).asOf ?? ''))
      setItems(
        (json.items ?? []).map((r) => {
          const video = (r as any).video
          const cast = (r as any).cast
          const item: RankingItem = {
            rank: Number((r as any).rank ?? 0),
            entityId: String((r as any).entityId ?? ''),
            label: String((r as any).label ?? ''),
            value: Number((r as any).value ?? 0),
          }
          if (video) {
            item.video = {
              id: String(video.id ?? ''),
              title: String(video.title ?? ''),
              description: String(video.description ?? ''),
              thumbnailUrl: String(video.thumbnailUrl ?? ''),
              createdAt: video.createdAt ? String(video.createdAt ?? '') : undefined,
            }
          }
          if (cast) {
            item.cast = {
              id: String(cast.id ?? ''),
              name: String(cast.name ?? ''),
              role: String(cast.role ?? ''),
              thumbnailUrl: String(cast.thumbnailUrl ?? ''),
            }
          }
          return item
        })
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg, type])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageSubtitle}>ランキングと集計時点</Text>

      <CollapsibleSection
        title="集計日時"
        subtitle="更新ボタンで再取得"
        open={openMeta}
        onToggle={() => setOpenMeta((v) => !v)}
      >
        <Text style={styles.tableDetail}>{formatJaDateTime(asOf) || '—'}</Text>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={load} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>{busy ? '更新中…' : '更新'}</Text>
          </Pressable>
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        title="ランキング"
        subtitle={type === 'videos' ? 'サムネ / タイトル' : '順位'}
        open={openList}
        onToggle={() => setOpenList((v) => !v)}
        badges={busy && items.length === 0 ? [{ kind: 'info', label: '読込中' }] : []}
      >
        <View style={styles.table}>
          {busy && items.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {items.map((r) => (
            <View key={`${r.rank}-${r.entityId || r.label}`} style={styles.tableRow}>
              {type === 'videos' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {r.video?.thumbnailUrl ? (
                    <Image
                      source={{ uri: r.video.thumbnailUrl }}
                      style={{ width: 56, height: 36, borderRadius: 8, backgroundColor: '#e5e7eb' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 56,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: '#e5e7eb',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '800' }}>No Img</Text>
                    </View>
                  )}

                  <View style={styles.tableLeft}>
                    <Text style={styles.tableLabel}>{`${r.rank}位 ${r.video?.title || r.label || '—'}`}</Text>
                    <Text style={styles.tableDetail}>{formatJaDateTime(String(r.video?.createdAt ?? '')) || '—'}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>{`${r.rank}位 ${r.label}`}</Text>
                </View>
              )}
            </View>
          ))}
          {!busy && items.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>データがありません</Text>
            </View>
          ) : null}
        </View>
      </CollapsibleSection>
    </ScrollView>
  )
}
