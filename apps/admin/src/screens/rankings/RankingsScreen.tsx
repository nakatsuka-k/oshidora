import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { CollapsibleSection } from '../../ui/CollapsibleSection'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
}

type CmsFetchJson = <T>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

function isValidYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim())
}

function getInitialDateFromLocation(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''
  try {
    const params = new URLSearchParams(window.location.search)
    const v = String(params.get('date') ?? '').trim()
    return isValidYmd(v) ? v : ''
  } catch {
    return ''
  }
}

function setDateInLocation(dateYmd: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const v = String(dateYmd || '').trim()
    if (v) params.set('date', v)
    else params.delete('date')
    const qs = params.toString()
    const next = window.location.pathname + (qs ? `?${qs}` : '') + (window.location.hash || '')
    window.history.replaceState({}, '', next)
  } catch {
    // ignore
  }
}

function DateInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.input as any}>
        {
          // eslint-disable-next-line react/no-unknown-property
        }
        <input
          type="date"
          value={value}
          disabled={Boolean(disabled)}
          onChange={(e: any) => onChange(String(e?.target?.value ?? ''))}
          style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'inherit', font: 'inherit' } as any}
        />
      </View>
    )
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      style={styles.input}
      editable={!disabled}
      placeholder="YYYY-MM-DD"
      autoCapitalize="none"
    />
  )
}

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

function ymdFromIso(value: string): string {
  const s = String(value ?? '').trim()
  if (s.length >= 10 && isValidYmd(s.slice(0, 10))) return s.slice(0, 10)
  return ''
}

function prevYmd(ymd: string): string {
  const s = String(ymd ?? '').trim()
  if (!isValidYmd(s)) return ''
  const d = new Date(`${s}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return ''
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function getRankingBasisText(type: 'videos' | 'coins' | 'actors' | 'directors' | 'writers'): string {
  switch (type) {
    case 'videos':
      return '再生回数を基準にしたランキング（日次集計 / UTC）'
    case 'coins':
      return 'コイン消費合計を基準にしたランキング（日次集計 / UTC）'
    case 'actors':
      return '再生回数（出演）を基準にしたランキング（日次集計 / UTC）'
    case 'directors':
      return '再生回数（監督）を基準にしたランキング（日次集計 / UTC）'
    case 'writers':
      return '再生回数（脚本）を基準にしたランキング（日次集計 / UTC）'
  }
}

export function RankingsScreen({
  cfg,
  cmsFetchJson,
  type,
  title,
  onOpenVideo,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  type: 'videos' | 'coins' | 'actors' | 'directors' | 'writers'
  title: string
  onOpenVideo?: (videoId: string) => void
}) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [asOf, setAsOf] = useState('')
  const [dateYmd, setDateYmd] = useState(() => getInitialDateFromLocation())
  const [items, setItems] = useState<RankingItem[]>([])
  const [prevAsOf, setPrevAsOf] = useState('')
  const [prevRankByEntityId, setPrevRankByEntityId] = useState<Record<string, number> | null>(null)
  const [openMeta, setOpenMeta] = useState(false)
  const [openList, setOpenList] = useState(true)

  const basisText = useMemo(() => getRankingBasisText(type), [type])

  const load = useCallback(async () => {
    const cleaned = String(dateYmd || '').trim()
    if (cleaned && !isValidYmd(cleaned)) return
    setBusy(true)
    setBanner('')
    try {
      const qs = new URLSearchParams()
      if (cleaned) qs.set('date', cleaned)
      const path = `/cms/rankings/${encodeURIComponent(type)}${qs.toString() ? `?${qs.toString()}` : ''}`
      const json = await cmsFetchJson<{ items: any[]; asOf: string }>(cfg, path)
      const nextAsOf = String((json as any).asOf ?? '')
      const nextItems: RankingItem[] = (json.items ?? []).map((r) => {
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

      setAsOf(nextAsOf)
      setItems(nextItems)

      // Optional: compute rank change vs previous day. If previous ranking is missing, just hide indicators.
      setPrevAsOf('')
      setPrevRankByEntityId(null)
      const curYmd = cleaned || ymdFromIso(nextAsOf)
      const pYmd = prevYmd(curYmd)
      if (pYmd) {
        try {
          const pQs = new URLSearchParams()
          pQs.set('date', pYmd)
          const pPath = `/cms/rankings/${encodeURIComponent(type)}?${pQs.toString()}`
          const prevJson = await cmsFetchJson<{ items: any[]; asOf: string }>(cfg, pPath)
          const map: Record<string, number> = {}
          for (const r of prevJson.items ?? []) {
            const entityId = String((r as any).entityId ?? '').trim()
            const rank = Number((r as any).rank ?? 0)
            if (!entityId || !rank) continue
            map[entityId] = rank
          }
          if (Object.keys(map).length) {
            setPrevAsOf(String((prevJson as any).asOf ?? ''))
            setPrevRankByEntityId(map)
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg, cmsFetchJson, dateYmd, setBanner, type])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const cleaned = String(dateYmd || '').trim()
    if (cleaned && !isValidYmd(cleaned)) return
    setDateInLocation(cleaned)
  }, [dateYmd])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageSubtitle}>ランキングと集計時点</Text>
      <Text style={styles.helperText}>{basisText}</Text>

      <CollapsibleSection
        title="集計日時"
        subtitle="日付で絞り込みできます（空=最新）"
        open={openMeta}
        onToggle={() => setOpenMeta((v) => !v)}
      >
        <Text style={styles.tableDetail}>{formatJaDateTime(asOf) || '—'}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>日付</Text>
          <DateInput value={dateYmd} disabled={busy} onChange={setDateYmd} />
          {dateYmd && !isValidYmd(dateYmd) ? (
            <Text style={[styles.tableDetail, { color: '#b91c1c' }]}>{'YYYY-MM-DD 形式で入力してください'}</Text>
          ) : null}
        </View>

        <View style={styles.filterActions}>
          <Pressable
            disabled={busy || !dateYmd}
            onPress={() => setDateYmd('')}
            style={[styles.btnSecondary, busy || !dateYmd ? styles.btnDisabled : null]}
          >
            <Text style={styles.btnSecondaryText}>最新</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={load} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>{busy ? '更新中…' : '更新'}</Text>
          </Pressable>
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        title="ランキング"
        subtitle={
          type === 'videos'
            ? prevRankByEntityId
              ? 'サムネ / タイトル（前日比）'
              : 'サムネ / タイトル'
            : prevRankByEntityId
              ? '順位（前日比）'
              : '順位'
        }
        open={openList}
        onToggle={() => setOpenList((v) => !v)}
        badges={busy && items.length === 0 ? [{ kind: 'info', label: '読込中' }] : []}
      >
        <View style={styles.table}>
          {prevAsOf ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
              <Text style={styles.tableDetail}>{`前日比（前回: ${ymdFromIso(prevAsOf)}）`}</Text>
            </View>
          ) : null}
          {busy && items.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {items.map((r) => {
            const prevRank = prevRankByEntityId ? prevRankByEntityId[r.entityId] : undefined
            const canOpenVideo = type === 'videos' && Boolean(onOpenVideo) && Boolean(r.video?.id)
            const delta = typeof prevRank === 'number' && prevRank > 0 ? prevRank - r.rank : null

            const RowComponent: any = canOpenVideo ? Pressable : View
            const rowProps = canOpenVideo
              ? {
                  onPress: () => onOpenVideo?.(String(r.video?.id ?? '').trim()),
                  style: [
                    styles.tableRow,
                    Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
                    // subtle affordance
                    { backgroundColor: '#ffffff' },
                  ],
                }
              : { style: styles.tableRow }

            return (
              <RowComponent key={`${r.rank}-${r.entityId || r.label}`} {...rowProps}>
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

                {prevRankByEntityId ? (
                  <View style={{ marginLeft: 12, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <View
                      style={[
                        styles.sectionBadge,
                        delta !== null && delta < 0 ? styles.sectionBadgeDirty : null,
                        delta !== null && delta > 0 ? styles.sectionBadgeSaved : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sectionBadgeText,
                          delta !== null && delta < 0 ? styles.sectionBadgeTextDirty : null,
                          delta !== null && delta > 0 ? styles.sectionBadgeTextSaved : null,
                        ]}
                      >
                        {delta === null ? 'NEW' : delta === 0 ? '＝' : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </RowComponent>
            )
          })}
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
