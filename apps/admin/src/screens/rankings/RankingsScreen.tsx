import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
  mock: boolean
}

type CmsFetchJson = <T>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

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
  const [items, setItems] = useState<Array<{ rank: number; label: string; value: number }>>([])

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[]; asOf: string }>(cfg, `/cms/rankings/${encodeURIComponent(type)}`)
      setAsOf(String((json as any).asOf ?? ''))
      setItems(
        (json.items ?? []).map((r) => ({
          rank: Number((r as any).rank ?? 0),
          label: String((r as any).label ?? ''),
          value: Number((r as any).value ?? 0),
        }))
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>集計日時</Text>
        <Text style={styles.tableDetail}>{asOf || '—'}</Text>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={load} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>{busy ? '更新中…' : '更新'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ランキング</Text>
        <View style={styles.table}>
          {busy && items.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {items.map((r) => (
            <View key={`${r.rank}-${r.label}`} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{`${r.rank}位 ${r.label}`}</Text>
                <Text style={styles.tableDetail}>{`値: ${r.value}`}</Text>
              </View>
            </View>
          ))}
          {!busy && items.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>データがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}
