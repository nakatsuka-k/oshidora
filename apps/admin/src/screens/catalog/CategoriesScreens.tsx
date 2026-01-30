import { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { COLORS, styles } from '../../app/styles'
import { SelectField } from '../../app/components/SelectField'
import { useBanner } from '../../lib/banner'
import { CollapsibleSection } from '../../ui/CollapsibleSection'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
}

type CmsFetchJson = <T>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

type CategoryRow = { id: string; name: string; enabled: boolean }

export function CategoriesListScreen({
  cfg,
  cmsFetchJson,
  onOpenDetail,
  onNew,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  onOpenDetail: (row: { id: string; name: string }) => void
  onNew: () => void
}) {
  const [rows, setRows] = useState<CategoryRow[]>([])
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ list: true })

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/categories')
      setRows(
        (json.items ?? []).map((c) => ({
          id: String(c.id ?? ''),
          name: String(c.name ?? ''),
          enabled: Boolean(c.enabled),
        }))
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>カテゴリ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>
      <Text style={styles.pageSubtitle}>カテゴリを選んで編集</Text>

      <CollapsibleSection
        title="一覧"
        subtitle="選んで編集へ"
        open={openSections.list}
        onToggle={() => setOpenSections((p) => ({ ...p, list: !p.list }))}
      >
        <View style={styles.table}>
          {busy ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail({ id: r.id, name: r.name })} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{r.enabled ? '有効' : '無効'}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>カテゴリがありません</Text>
            </View>
          ) : null}
        </View>
      </CollapsibleSection>
    </ScrollView>
  )
}

export function CategoryEditScreen({
  cfg,
  cmsFetchJson,
  title,
  id,
  onBack,
  onLoadedCategory,
  onOpenVideo,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  title: string
  id: string
  onBack: () => void
  onLoadedCategory?: (cat: { id: string; name: string }) => void
  onOpenVideo?: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [parentId, setParentId] = useState('')
  const [parentOptions, setParentOptions] = useState<Array<{ label: string; value: string }>>([{ label: '（なし）', value: '' }])
  const [linkedVideos, setLinkedVideos] = useState<
    Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string; createdAt: string }>
  >([])
  const [videoSearchQ, setVideoSearchQ] = useState('')
  const [videoSearchBusy, setVideoSearchBusy] = useState(false)
  const [videoSearchRows, setVideoSearchRows] = useState<Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string }>>([])
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const catsJson = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/categories')
        if (!mounted) return

        const options = (catsJson.items ?? [])
          .map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? '') }))
          .filter((c) => c.id)
          .filter((c) => (id ? c.id !== id : true))
          .map((c) => ({ label: c.name || c.id, value: c.id }))
        setParentOptions([{ label: '（なし）', value: '' }, ...options])

        if (!id) {
          setName('')
          setEnabled(true)
          setParentId('')
          setLinkedVideos([])
          return
        }

        const [json, videosJson] = await Promise.all([
          cmsFetchJson<{ item: any }>(cfg, `/cms/categories/${encodeURIComponent(id)}`),
          cmsFetchJson<{ items: any[] }>(cfg, `/cms/categories/${encodeURIComponent(id)}/videos`),
        ])
        if (!mounted) return
        const loadedName = String(json.item?.name ?? '')
        setName(loadedName)
        setEnabled(Boolean(json.item?.enabled))
        const nextParentId = String(json.item?.parentId ?? '')
        setParentId(nextParentId && nextParentId !== id ? nextParentId : '')
        setLinkedVideos(
          (videosJson.items ?? []).map((v) => ({
            id: String(v.id ?? ''),
            title: String(v.title ?? ''),
            workTitle: String(v.workTitle ?? ''),
            thumbnailUrl: String(v.thumbnailUrl ?? ''),
            createdAt: String(v.createdAt ?? ''),
          }))
        )
        onLoadedCategory?.({ id, name: loadedName })
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
        const payload = { name: name.trim(), enabled, parentId }
        if (id) {
          await cmsFetchJson(cfg, `/cms/categories/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/categories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, enabled, id, name, onBack, parentId])

  const persistLinkedVideos = useCallback(
    (next: Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string; createdAt: string }>, message: string) => {
      if (!id) return
      setBusy(true)
      setBanner('')
      void (async () => {
        try {
          await cmsFetchJson(cfg, `/cms/categories/${encodeURIComponent(id)}/videos`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ videoIds: next.map((v) => v.id) }),
          })
          const videosJson = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/categories/${encodeURIComponent(id)}/videos`)
          setLinkedVideos(
            (videosJson.items ?? []).map((v) => ({
              id: String(v.id ?? ''),
              title: String(v.title ?? ''),
              workTitle: String(v.workTitle ?? ''),
              thumbnailUrl: String(v.thumbnailUrl ?? ''),
              createdAt: String(v.createdAt ?? ''),
            }))
          )
          setBanner(message)
        } catch (e) {
          setBanner(e instanceof Error ? e.message : String(e))
        } finally {
          setBusy(false)
        }
      })()
    },
    [cfg, id]
  )

  const moveLinkedVideo = useCallback((videoId: string, dir: -1 | 1) => {
    setLinkedVideos((prev) => {
      const i = prev.findIndex((v) => v.id === videoId)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = prev.slice()
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
      persistLinkedVideos(next, '並び順を更新しました')
      return next
    })
  }, [persistLinkedVideos])

  const removeLinkedVideo = useCallback((videoId: string) => {
    setLinkedVideos((prev) => {
      const next = prev.filter((v) => v.id !== videoId)
      persistLinkedVideos(next, '削除しました')
      return next
    })
  }, [persistLinkedVideos])

  const addLinkedVideo = useCallback(
    (row: { id: string; title: string; workTitle: string; thumbnailUrl: string }) => {
      const vid = String(row.id || '').trim()
      if (!vid) return
      setLinkedVideos((prev) => {
        if (prev.some((v) => v.id === vid)) return prev
        const next = [
          ...prev,
          {
            id: vid,
            title: String(row.title ?? ''),
            workTitle: String(row.workTitle ?? ''),
            thumbnailUrl: String(row.thumbnailUrl ?? ''),
            createdAt: '',
          },
        ]
        persistLinkedVideos(next, '追加しました')
        return next
      })
    },
    [persistLinkedVideos]
  )

  const onSearchVideos = useCallback(() => {
    const q = videoSearchQ.trim()
    if (!q) {
      setVideoSearchRows([])
      return
    }
    setVideoSearchBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/videos?q=${encodeURIComponent(q)}&limit=50`)
        setVideoSearchRows(
          (json.items ?? []).map((v) => ({
            id: String(v.id ?? ''),
            title: String(v.title ?? ''),
            workTitle: String(v.workTitle ?? ''),
            thumbnailUrl: String(v.thumbnailUrl ?? ''),
          }))
        )
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setVideoSearchBusy(false)
      }
    })()
  }, [cfg, videoSearchQ])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        <View style={styles.field}>
          <Text style={styles.label}>カテゴリ名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>

        <SelectField label="親カテゴリ" value={parentId} placeholder="（なし）" options={parentOptions} onChange={setParentId} />

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>有効</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>

      {id ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{`このカテゴリの動画（${linkedVideos.length}件）`}</Text>
          <Text style={[styles.tableDetail, { marginBottom: 8 }]}>検索結果から選んで追加できます（追加/削除/並び替えは自動で反映されます）</Text>

          <View style={styles.filtersGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>動画検索（タイトル/説明）</Text>
              <TextInput
                value={videoSearchQ}
                onChangeText={setVideoSearchQ}
                placeholder="キーワード"
                placeholderTextColor={COLORS.placeholder}
                style={styles.input}
              />
            </View>
            <View style={styles.filterActions}>
              <Pressable
                disabled={videoSearchBusy}
                onPress={onSearchVideos}
                style={[styles.btnSecondary, videoSearchBusy ? styles.btnDisabled : null]}
              >
                <Text style={styles.btnSecondaryText}>{videoSearchBusy ? '検索中…' : '検索'}</Text>
              </Pressable>
            </View>
          </View>

          {videoSearchRows.length ? (
            <View style={styles.table}>
              {videoSearchRows.map((v) => {
                const exists = linkedVideos.some((x) => x.id === v.id)
                return (
                  <View key={`sr-${v.id}`} style={styles.tableRow}>
                    <View style={styles.tableLeft}>
                      <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                      <Text style={styles.tableDetail}>{v.workTitle || '—'}</Text>
                    </View>
                    <View style={[styles.tableRight, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                      {v.thumbnailUrl ? (
                        <Image
                          source={{ uri: v.thumbnailUrl }}
                          style={{ width: 64, height: 36, borderRadius: 6, backgroundColor: COLORS.white }}
                        />
                      ) : null}
                      <Pressable
                        disabled={busy || exists}
                        onPress={() => addLinkedVideo(v)}
                        style={[styles.smallBtnPrimary, busy || exists ? styles.btnDisabled : null]}
                      >
                        <Text style={styles.smallBtnPrimaryText}>{exists ? '追加済' : '追加'}</Text>
                      </Pressable>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : null}

          <View style={styles.table}>
            {busy && linkedVideos.length === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>読込中…</Text>
              </View>
            ) : null}

            {linkedVideos.map((v) => (
              <View key={v.id} style={styles.tableRow}>
                <View style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                  <Text style={styles.tableDetail}>{`${v.workTitle || '—'} / ${(v.createdAt || '').slice(0, 19).replace('T', ' ') || '—'}`}</Text>
                </View>
                <View style={[styles.tableRight, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
                  {v.thumbnailUrl ? (
                    <Image
                      source={{ uri: v.thumbnailUrl }}
                      style={{ width: 64, height: 36, borderRadius: 6, backgroundColor: COLORS.white }}
                    />
                  ) : null}
                  <Pressable
                    disabled={busy}
                    onPress={() => moveLinkedVideo(v.id, -1)}
                    style={[styles.smallBtn, busy ? styles.btnDisabled : null]}
                  >
                    <Text style={styles.smallBtnText}>↑</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => moveLinkedVideo(v.id, 1)}
                    style={[styles.smallBtn, busy ? styles.btnDisabled : null]}
                  >
                    <Text style={styles.smallBtnText}>↓</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => removeLinkedVideo(v.id)}
                    style={[styles.smallBtn, busy ? styles.btnDisabled : null]}
                  >
                    <Text style={styles.smallBtnText}>削除</Text>
                  </Pressable>
                  {onOpenVideo ? (
                    <Pressable
                      disabled={busy}
                      onPress={() => onOpenVideo(v.id)}
                      style={[styles.smallBtnPrimary, busy ? styles.btnDisabled : null]}
                    >
                      <Text style={styles.smallBtnPrimaryText}>詳細</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}

            {!busy && linkedVideos.length === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>このカテゴリの動画はありません</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}
