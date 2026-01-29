import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { cmsFetchJson, useCmsApi } from '../../lib/cmsApi'

type CastStaffRow = {
  id: string
  name: string
  role: string
  thumbnailUrl: string
  createdAt: string
  updatedAt: string
}

export function CastStaffListScreen({
  onOpenDetail,
  onNew,
}: {
  onOpenDetail: (id: string) => void
  onNew: () => void
}) {
  const cfg = useCmsApi()
  const [qName, setQName] = useState('')
  const [rows, setRows] = useState<CastStaffRow[]>([])
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: CastStaffRow[] }>(cfg, '/cms/casts')
        if (!mounted) return
        setRows(json.items || [])
      } catch (e) {
        if (!mounted) return
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        if (!mounted) return
        setBusy(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg])

  const filtered = useMemo(() => {
    const name = qName.trim()
    if (!name) return rows
    return rows.filter((r) => r.name.includes(name) || r.id.includes(name))
  }, [qName, rows])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>キャスト・スタッフ管理</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>検索</Text>
        <View style={styles.field}>
          <Text style={styles.label}>氏名 / ID</Text>
          <TextInput value={qName} onChangeText={setQName} placeholder="例: cast_ / 山田" style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.filterActions}>
          <Pressable onPress={() => setQName((v) => v.trim())} style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>検索</Text>
          </Pressable>
          <Pressable onPress={() => setQName('')} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>リセット</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{`一覧${busy ? '（読み込み中）' : ''}`}</Text>
        <View style={styles.table}>
          {filtered.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {r.thumbnailUrl ? <Image source={{ uri: r.thumbnailUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tableLabel}>{r.name || '—'}</Text>
                    <Text style={styles.tableDetail}>{`${r.id} / ${r.role || '—'}`}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
          {!busy && filtered.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>該当データがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

type CastStaffDetailResponse = {
  item: CastStaffRow
  stats: { favoritesCount: number; worksCount: number; videosCount: number }
  works: Array<{ id: string; title: string; roleName: string }>
  videos: Array<{ id: string; title: string; workId: string; workTitle: string; roleName: string }>
}

export function CastStaffDetailScreen({
  title,
  id,
  onBack,
  onSaved,
  onOpenWork,
  onOpenVideo,
}: {
  title: string
  id: string
  onBack: () => void
  onSaved: (id: string) => void
  onOpenWork: (id: string) => void
  onOpenVideo: (id: string) => void
}) {
  const cfg = useCmsApi()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [stats, setStats] = useState<{ favoritesCount: number; worksCount: number; videosCount: number } | null>(null)
  const [works, setWorks] = useState<Array<{ id: string; title: string; roleName: string }>>([])
  const [videos, setVideos] = useState<Array<{ id: string; title: string; workId: string; workTitle: string; roleName: string }>>([])
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) {
      setStats(null)
      setWorks([])
      setVideos([])
      return
    }

    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<CastStaffDetailResponse>(cfg, `/cms/casts/${encodeURIComponent(id)}`)
        if (!mounted) return
        setName(json.item?.name || '')
        setRole(json.item?.role || '')
        setThumbnailUrl(json.item?.thumbnailUrl || '')
        setStats(json.stats || null)
        setWorks(json.works || [])
        setVideos(json.videos || [])
      } catch (e) {
        if (!mounted) return
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        if (!mounted) return
        setBusy(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg, id])

  const onSave = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        if (!name.trim()) throw new Error('name is required')

        if (id) {
          await cmsFetchJson(cfg, `/cms/casts/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, role, thumbnailUrl }),
          })
          setBanner('保存しました')
          return
        }

        const created = await cmsFetchJson<{ ok: true; id: string }>(cfg, '/cms/casts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, role, thumbnailUrl }),
        })
        const nextId = String(created.id || '')
        if (!nextId) throw new Error('作成に失敗しました')
        setBanner('作成しました')
        onSaved(nextId)
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, id, name, onSaved, role, thumbnailUrl])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>プロフィール</Text>
        {id ? (
          <View style={styles.field}>
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>氏名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>役割（例: 俳優/監督/脚本）</Text>
          <TextInput value={role} onChangeText={setRole} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネURL</Text>
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>プレビュー</Text>
          {thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
        </View>

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>

      {id ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>集計</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>お気に入り数</Text>
                <Text style={styles.tableDetail}>{String(stats?.favoritesCount ?? 0)}</Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>出演作品数（作品）</Text>
                <Text style={styles.tableDetail}>{String(stats?.worksCount ?? 0)}</Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>出演作品数（動画）</Text>
                <Text style={styles.tableDetail}>{String(stats?.videosCount ?? 0)}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {id ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>関連作品（作品）</Text>
          <View style={styles.table}>
            {works.map((w) => (
              <Pressable key={w.id} onPress={() => onOpenWork(w.id)} style={styles.tableRow}>
                <View style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>{w.title || w.id}</Text>
                  <Text style={styles.tableDetail}>{`${w.id}${w.roleName ? ` / ${w.roleName}` : ''}`}</Text>
                </View>
              </Pressable>
            ))}
            {works.length === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>紐づく作品がありません</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {id ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>関連作品（動画）</Text>
          <View style={styles.table}>
            {videos.map((v) => (
              <Pressable key={v.id} onPress={() => onOpenVideo(v.id)} style={styles.tableRow}>
                <View style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                  <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : v.workId ? ` / ${v.workId}` : ''}${v.roleName ? ` / ${v.roleName}` : ''}`}</Text>
                </View>
              </Pressable>
            ))}
            {videos.length === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>紐づく動画がありません</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}
