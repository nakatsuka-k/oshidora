import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { COLORS } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { CollapsibleSection } from '../../ui/CollapsibleSection'
import { WebDropZone } from '../../ui/WebDropZone'
import { StreamCaptionsPanel } from './StreamCaptionsPanel'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
}

type CmsFetchJson = <T = any>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

type CmsFetchJsonWithBase = <T = any>(cfg: CmsApiConfig, baseUrl: string, path: string, init?: RequestInit) => Promise<T>

type ConfirmFn = (
  message: string,
  opts?: {
    title?: string
    okText?: string
    cancelText?: string
    danger?: boolean
  }
) => Promise<boolean>

type SelectFieldComponent = (props: any) => any

type MultiSelectFieldComponent = (props: any) => any

type MultiSelectOption = { value: string; label: string; detail?: string }

type VideoDetailSectionId = 'preview' | 'basics' | 'replace' | 'publish' | 'meta' | 'reco' | 'advanced'

function VideoDetailSection({
  id,
  title,
  description,
  warning,
  dirty,
  children,
  openSections,
  activeSectionId,
  styles,
  savedFlash,
  markActive,
  toggleSection,
  setSectionY,
}: {
  id: VideoDetailSectionId
  title: string
  description: string
  warning?: string
  dirty?: boolean
  children: any
  openSections: Record<VideoDetailSectionId, boolean>
  activeSectionId: VideoDetailSectionId | null
  styles: any
  savedFlash: { section: VideoDetailSectionId | 'all'; at: number } | null
  markActive: (id: VideoDetailSectionId) => void
  toggleSection: (id: VideoDetailSectionId) => void
  setSectionY: any
}) {
  const open = Boolean(openSections[id])
  const active = activeSectionId === id
  const important = id === 'preview' || id === 'basics'
  const justSaved = savedFlash?.section === id && Date.now() - Number(savedFlash?.at ?? 0) < 1800

  return (
    <View
      style={{
        paddingTop: 18,
        marginTop: 18,
        borderTopWidth: 2,
        borderTopColor: active ? COLORS.primary : '#e5e7eb',
      }}
      onTouchStart={() => markActive(id)}
      onLayout={(e) => {
        const y = Number(e?.nativeEvent?.layout?.y ?? 0) || 0
        setSectionY((prev: any) => (prev?.[id] === y ? prev : { ...(prev ?? {}), [id]: y }))
      }}
      {...(Platform.OS === 'web' ? ({ onMouseDown: () => markActive(id) } as any) : null)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 } as any}>
        <Pressable onPress={() => toggleSection(id)} style={{ flex: 1 } as any}>
          <Text
            style={{
              fontSize: important ? 19 : 18,
              fontWeight: active ? ('900' as any) : ('800' as any),
              color: active ? COLORS.primary : '#111827',
            }}
          >
            {title}
          </Text>
        </Pressable>

        {justSaved ? (
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: '#ecfdf5',
              borderWidth: 1,
              borderColor: '#a7f3d0',
            }}
          >
            <Text style={{ color: '#047857', fontSize: 12, fontWeight: '800' }}>保存しました</Text>
          </View>
        ) : null}

        {dirty ? (
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: '#fffbeb',
              borderWidth: 1,
              borderColor: '#fde68a',
            }}
          >
            <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '800' }}>未保存</Text>
          </View>
        ) : null}

        {warning ? (
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: '#fef2f2',
              borderWidth: 1,
              borderColor: '#fecaca',
            }}
          >
            <Text style={{ color: '#b91c1c', fontSize: 12, fontWeight: '800' }}>{warning}</Text>
          </View>
        ) : null}

        <Pressable onPress={() => toggleSection(id)} style={styles.smallBtn}>
          <Text style={[styles.smallBtnText, { fontWeight: '900' }]}>{open ? '−' : '+'}</Text>
        </Pressable>
      </View>

      <Text style={{ marginTop: 8, color: '#6b7280', fontSize: 14, lineHeight: 20 }}>{description}</Text>

      {open ? <View style={{ marginTop: 14 }}>{children}</View> : null}
    </View>
  )
}

type VideoRow = {
  id: string
  thumbnailUrl: string
  title: string
  workId: string
  workName: string
  episodeLabel: string
  subtitles: 'あり' | 'なし'
  status: '公開' | '非公開'
  rating: number
  reviewCount: number
  createdAt: string
}

export function VideoListScreen({
  cfg,
  cmsFetchJson,
  confirm,
  styles,
  SelectField,
  onOpenEdit,
  onOpenPreview,
  onGoUpload,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  confirm: ConfirmFn
  styles: any
  SelectField: SelectFieldComponent
  onOpenEdit: (id: string) => void
  onOpenPreview: (id: string) => void
  onGoUpload: () => void
}) {
  const actionColWidth = (styles?.actionsCell as any)?.width ?? 240

  const webDateInputStyle = useMemo(
    () =>
      ({
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#d1d5db',
        borderRadius: 10,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 14,
        fontWeight: 700,
        color: '#111827',
        backgroundColor: '#ffffff',
      }) as any,
    []
  )

  const [works, setWorks] = useState<Array<{ id: string; title: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([])
  const [casts, setCasts] = useState<Array<{ id: string; name: string }>>([])
  const [genres, setGenres] = useState<Array<{ id: string; name: string }>>([])

  const workOptions = useMemo(
    () => [{ label: '全て', value: '' }, ...works.map((w) => ({ label: w.title || w.id, value: w.id }))],
    [works]
  )
  const categoryOptions = useMemo(
    () => [{ label: '全て', value: '' }, ...categories.map((c) => ({ label: c.name || c.id, value: c.id }))],
    [categories]
  )
  const tagOptions = useMemo(
    () => [{ label: '全て', value: '' }, ...tags.map((t) => ({ label: t.name || t.id, value: t.id }))],
    [tags]
  )
  const castOptions = useMemo(
    () => [{ label: '全て', value: '' }, ...casts.map((c) => ({ label: c.name || c.id, value: c.id }))],
    [casts]
  )
  const genreOptions = useMemo(
    () => [{ label: '全て', value: '' }, ...genres.map((g) => ({ label: g.name || g.id, value: g.id }))],
    [genres]
  )

  const [qText, setQText] = useState('')
  const [qWorkId, setQWorkId] = useState('')
  const [qStatus, setQStatus] = useState('')
  const [qCategoryId, setQCategoryId] = useState('')
  const [qTagId, setQTagId] = useState('')
  const [qCastId, setQCastId] = useState('')
  const [qGenreId, setQGenreId] = useState('')
  const [qSort, setQSort] = useState<'created_desc' | 'created_asc' | 'scheduled_asc' | 'title_asc'>('created_desc')
  const [qFrom, setQFrom] = useState('')
  const [qTo, setQTo] = useState('')

  const [openFilters, setOpenFilters] = useState(false)
  const [openList, setOpenList] = useState(true)

  const [rows, setRows] = useState<VideoRow[]>([])
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  const filterSummary = useMemo(() => {
    const parts: string[] = []

    if (qStatus === '公開') parts.push('公開中')
    if (qStatus === '非公開') parts.push('非公開')

    const workLabel = qWorkId ? workOptions.find((o) => o.value === qWorkId)?.label : ''
    if (workLabel) parts.push(String(workLabel))

    const q = qText.trim()
    if (q) parts.push(q)

    const catLabel = qCategoryId ? categoryOptions.find((o) => o.value === qCategoryId)?.label : ''
    if (catLabel) parts.push(`カテゴリ:${String(catLabel)}`)

    const tagLabel = qTagId ? tagOptions.find((o) => o.value === qTagId)?.label : ''
    if (tagLabel) parts.push(`タグ:${String(tagLabel)}`)

    const castLabel = qCastId ? castOptions.find((o) => o.value === qCastId)?.label : ''
    if (castLabel) parts.push(`キャスト:${String(castLabel)}`)

    const genreLabel = qGenreId ? genreOptions.find((o) => o.value === qGenreId)?.label : ''
    if (genreLabel) parts.push(`ジャンル:${String(genreLabel)}`)

    const from = qFrom.trim()
    const to = qTo.trim()
    if (from || to) parts.push(`登録日:${from || '—'}〜${to || '—'}`)

    return parts.length ? `検索条件：${parts.join(' / ')}` : '検索条件：なし'
  }, [categoryOptions, castOptions, genreOptions, qCategoryId, qCastId, qFrom, qGenreId, qStatus, qTagId, qText, qTo, qWorkId, tagOptions, workOptions])

  const deleteVideo = useCallback(
    async (id: string) => {
      const row = rows.find((r) => r.id === id)
      if (!row) return

      const ok = await confirm(`${row.title || 'この動画'} を削除しますか？`, {
        title: '削除',
        okText: '削除',
        cancelText: 'キャンセル',
        danger: true,
      })
      if (!ok) return

      setBusy(true)
      setBanner('')
      void (async () => {
        try {
          await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ deleted: 1 }),
          })
          setRows((prev) => prev.filter((r) => r.id !== id))
        } catch (e) {
          setBanner(e instanceof Error ? e.message : String(e))
        } finally {
          setBusy(false)
        }
      })()
    },
    [cfg, cmsFetchJson, confirm, rows, setBanner]
  )

  const loadVideos = useCallback(
    async (opts?: {
      q?: string
      workId?: string
      published?: '' | '0' | '1'
      categoryId?: string
      tagId?: string
      castId?: string
      genreId?: string
      sort?: string
    }) => {
      const qs = new URLSearchParams()
      const q = (opts?.q ?? '').trim()
      if (q) qs.set('q', q)
      const workId = (opts?.workId ?? '').trim()
      if (workId) qs.set('workId', workId)
      const published = opts?.published ?? ''
      if (published) qs.set('published', published)
      const categoryId = (opts?.categoryId ?? '').trim()
      if (categoryId) qs.set('categoryId', categoryId)
      const tagId = (opts?.tagId ?? '').trim()
      if (tagId) qs.set('tagId', tagId)
      const castId = (opts?.castId ?? '').trim()
      if (castId) qs.set('castId', castId)
      const genreId = (opts?.genreId ?? '').trim()
      if (genreId) qs.set('genreId', genreId)
      const sort = (opts?.sort ?? '').trim()
      if (sort) qs.set('sort', sort)
      qs.set('limit', '500')

      const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/videos${qs.toString() ? `?${qs.toString()}` : ''}`)
      setRows(
        (json.items ?? []).map((v) => {
          const createdAt = String(v.createdAt || '').slice(0, 19).replace('T', ' ')
          const episodeNo = v.episodeNo === null || v.episodeNo === undefined ? null : Number(v.episodeNo)
          const episodeLabel = episodeNo === null || !Number.isFinite(episodeNo) ? '—' : `#${episodeNo}`
          const subtitles = String(v.subtitleUrl ?? '').trim() ? 'あり' : 'なし'
          return {
            id: String(v.id ?? ''),
            thumbnailUrl: String(v.thumbnailUrl ?? ''),
            title: String(v.title ?? ''),
            workId: String(v.workId ?? ''),
            workName: String(v.workTitle ?? v.workId ?? ''),
            episodeLabel,
            subtitles,
            status: v.published ? '公開' : '非公開',
            rating: Number(v.ratingAvg ?? 0) || 0,
            reviewCount: Number(v.reviewCount ?? 0) || 0,
            createdAt,
          }
        })
      )
    },
    [cfg, cmsFetchJson]
  )

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const [worksJson, catsJson, tagsJson, castsJson, genresJson] = await Promise.all([
          cmsFetchJson<{ items: Array<{ id: string; title: string }> }>(cfg, '/cms/works'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/categories'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/tags'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/casts'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/genres'),
        ])
        if (!mounted) return
        setWorks(worksJson.items)
        setCategories(
          (catsJson.items ?? [])
            .map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? '') }))
            .filter((c) => c.id)
        )
        setTags(
          (tagsJson.items ?? [])
            .map((t) => ({ id: String(t.id ?? ''), name: String(t.name ?? '') }))
            .filter((t) => t.id)
        )
        setCasts(
          (castsJson.items ?? [])
            .map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? '') }))
            .filter((c) => c.id)
        )
        setGenres(
          (genresJson.items ?? [])
            .map((g) => ({ id: String(g.id ?? ''), name: String(g.name ?? '') }))
            .filter((g) => g.id)
        )

        await loadVideos({ q: '', sort: 'created_desc' })
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
  }, [cfg, cmsFetchJson, loadVideos])

  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const pageSize = 20

  const reset = useCallback(() => {
    setQText('')
    setQWorkId('')
    setQStatus('')
    setQCategoryId('')
    setQTagId('')
    setQCastId('')
    setQGenreId('')
    setQSort('created_desc')
    setQFrom('')
    setQTo('')
    setPage(1)
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (qFrom && r.createdAt.slice(0, 10) < qFrom) return false
      if (qTo && r.createdAt.slice(0, 10) > qTo) return false
      return true
    })
  }, [qFrom, qTo, rows])

  const listCounts = useMemo(() => {
    let publishedCount = 0
    let unpublishedCount = 0
    for (const r of filtered) {
      if (r.status === '公開') publishedCount += 1
      else unpublishedCount += 1
    }
    return { published: publishedCount, unpublished: unpublishedCount, total: filtered.length }
  }, [filtered])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length])

  const pageRows = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages)
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, totalPages])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const togglePublish = useCallback(
    async (id: string) => {
      const row = rows.find((r) => r.id === id)
      if (!row) return
      const next = row.status === '公開' ? '非公開' : '公開'
      const ok = await confirm(`${row.title} を「${next}」に切り替えますか？`, { title: '公開状態の変更' })
      if (!ok) return

      setBusy(true)
      setBanner('')
      void (async () => {
        try {
          await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ published: next === '公開' }),
          })
          setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)))
        } catch (e) {
          setBanner(e instanceof Error ? e.message : String(e))
        } finally {
          setBusy(false)
        }
      })()
    },
    [cfg, cmsFetchJson, confirm, rows]
  )

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>動画一覧</Text>
        <Pressable onPress={onGoUpload} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>動画アップロード</Text>
        </Pressable>
      </View>

      <Text style={styles.pageSubtitle}>状態を見て、編集・プレビュー・公開切替</Text>
      <Text style={styles.helperText}>一覧＝判断と操作 / 詳細＝編集</Text>
      <Text style={styles.helperText}>{`表示中：公開中 ${listCounts.published}件 / 非公開 ${listCounts.unpublished}件（全${listCounts.total}件）`}</Text>

      <CollapsibleSection
        styles={styles}
        title="検索"
        subtitle={filterSummary}
        open={openFilters}
        onToggle={() => setOpenFilters((v) => !v)}
      >
        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>検索</Text>
            <TextInput
              nativeID="admin-videos-filter-q"
              value={qText}
              onChangeText={setQText}
              placeholder="タイトル / 説明 / 作品"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
            />
          </View>

          <SelectField label="作品名" value={qWorkId} placeholder="選択" options={workOptions} onChange={setQWorkId} />

          <SelectField
            label="公開状態"
            value={qStatus}
            placeholder="選択"
            options={[
              { label: '全て', value: '' },
              { label: '公開', value: '公開' },
              { label: '非公開', value: '非公開' },
            ]}
            onChange={setQStatus}
          />

          <SelectField label="カテゴリ" value={qCategoryId} placeholder="選択" options={categoryOptions} onChange={setQCategoryId} />

          <SelectField label="タグ" value={qTagId} placeholder="選択" options={tagOptions} onChange={setQTagId} />

          <SelectField label="キャスト" value={qCastId} placeholder="選択" options={castOptions} onChange={setQCastId} />

          <SelectField label="ジャンル" value={qGenreId} placeholder="選択" options={genreOptions} onChange={setQGenreId} />

          <SelectField
            label="並び順"
            value={qSort}
            placeholder="選択"
            options={[
              { label: '登録日（新しい順）', value: 'created_desc' },
              { label: '登録日（古い順）', value: 'created_asc' },
              { label: '公開予定日（早い順）', value: 'scheduled_asc' },
              { label: 'タイトル（昇順）', value: 'title_asc' },
            ]}
            onChange={(v: any) => setQSort(v)}
          />

          <View style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <View style={[styles.field, { flex: 1, minWidth: 220 }]}>
                <Text style={styles.label}>登録日（開始）</Text>
                {Platform.OS === 'web' ? (
                  <input
                    id="admin-videos-filter-from"
                    name="admin-videos-filter-from"
                    type="date"
                    value={qFrom}
                    onChange={(e: any) => setQFrom(String(e?.target?.value ?? ''))}
                    style={webDateInputStyle}
                  />
                ) : (
                  <TextInput
                    nativeID="admin-videos-filter-from"
                    value={qFrom}
                    onChangeText={setQFrom}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.placeholder}
                    style={styles.input}
                  />
                )}
              </View>

              <View style={[styles.field, { flex: 1, minWidth: 220 }]}>
                <Text style={styles.label}>登録日（終了）</Text>
                {Platform.OS === 'web' ? (
                  <input
                    id="admin-videos-filter-to"
                    name="admin-videos-filter-to"
                    type="date"
                    value={qTo}
                    onChange={(e: any) => setQTo(String(e?.target?.value ?? ''))}
                    style={webDateInputStyle}
                  />
                ) : (
                  <TextInput
                    nativeID="admin-videos-filter-to"
                    value={qTo}
                    onChangeText={setQTo}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.placeholder}
                    style={styles.input}
                  />
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.filterActions}>
          <Pressable
            disabled={busy}
            onPress={() => {
              setPage(1)
              setBusy(true)
              setBanner('')
              void (async () => {
                try {
                  const published = qStatus === '公開' ? '1' : qStatus === '非公開' ? '0' : ''
                  await loadVideos({
                    q: qText,
                    workId: qWorkId,
                    published,
                    categoryId: qCategoryId,
                    tagId: qTagId,
                    castId: qCastId,
                    genreId: qGenreId,
                    sort: qSort,
                  })
                } catch (e) {
                  setBanner(e instanceof Error ? e.message : String(e))
                } finally {
                  setBusy(false)
                }
              })()
            }}
            style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}
          >
            <Text style={styles.btnPrimaryText}>検索</Text>
          </Pressable>
          <Pressable onPress={reset} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>リセット</Text>
          </Pressable>
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        styles={styles}
        title="一覧"
        subtitle="状態 / 作品・話数 / 操作"
        open={openList}
        onToggle={() => setOpenList((v) => !v)}
        badges={busy ? [{ kind: 'info', label: '読込中' }] : []}
      >
        <View style={styles.workListWrap}>
          {pageRows.map((r) => {
            const published = r.status === '公開'
            const statusText = published ? '状態：公開中' : '状態：非公開'
            const statusStyle = published ? styles.statusPillPublished : styles.statusPillDanger
            const toggleLabel = published ? '非公開にする' : '公開する'
            const toggleBtnStyle = published ? styles.workActionBtnDanger : styles.workActionBtnPrimary
            const toggleTextStyle = published ? styles.workActionBtnDangerText : styles.workActionBtnPrimaryText

            return (
              <View key={r.id} style={[styles.workCard, !published ? styles.workCardUnpublished : null]}>
                <Pressable onPress={() => onOpenPreview(r.id)} style={styles.workThumb}>
                  {r.thumbnailUrl ? (
                    <Image source={{ uri: r.thumbnailUrl }} style={styles.workThumbImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.workThumbPlaceholder}>
                      <Text style={styles.workThumbPlaceholderText}>No image</Text>
                    </View>
                  )}
                </Pressable>

                <View style={styles.workCardBody}>
                  <View style={styles.workInfoCol}>
                    <View style={styles.workTitleRow}>
                      <Pressable onPress={() => onOpenPreview(r.id)} style={{ flex: 1, minWidth: 0 } as any}>
                        <Text style={styles.workTitle} numberOfLines={2}>
                          {r.title || '（無題）'}
                        </Text>
                      </Pressable>
                      <View style={[styles.statusPill, statusStyle]}>
                        <Text style={styles.statusPillText}>{statusText}</Text>
                      </View>
                    </View>

                    <View style={styles.workMetaRow}>
                      <Text style={styles.workMetaText}>{`${r.workName || r.workId || '—'} / ${r.episodeLabel || '—'}`}</Text>
                      <Text style={styles.workMetaText}>{`字幕:${r.subtitles}`}</Text>
                      <Text style={styles.workMetaText}>{`登録日:${String(r.createdAt || '').slice(0, 10) || '—'}`}</Text>
                    </View>
                  </View>

                  <View style={styles.workActionCol}>
                    <View style={styles.workActionsRow}>
                      <Pressable onPress={() => onOpenEdit(r.id)} style={styles.workActionBtnPrimary} disabled={busy}>
                        <Text style={styles.workActionBtnPrimaryText}>編集</Text>
                      </Pressable>
                      <Pressable onPress={() => onOpenPreview(r.id)} style={styles.workActionBtn} disabled={busy}>
                        <Text style={styles.workActionBtnText}>プレビュー</Text>
                      </Pressable>
                      <Pressable
                        disabled={busy}
                        onPress={() => void togglePublish(r.id)}
                        style={[toggleBtnStyle, busy ? styles.btnDisabled : null]}
                      >
                        <Text style={toggleTextStyle}>{toggleLabel}</Text>
                      </Pressable>
                      <Pressable
                        disabled={busy}
                        onPress={() => void deleteVideo(r.id)}
                        style={[styles.workActionBtnDangerOutline, busy ? styles.btnDisabled : null]}
                      >
                        <Text style={styles.workActionBtnDangerOutlineText}>削除</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            )
          })}

          {!busy && pageRows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>該当する動画がありません</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.pagination}>
          <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))} style={styles.pageBtn}>
            <Text style={styles.pageBtnText}>前へ</Text>
          </Pressable>
          <View style={styles.pageJump}>
            <Text style={styles.pageInfo}>{`Page`}</Text>
            <TextInput
              nativeID="admin-videos-pagination-page"
              value={pageInput}
              onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ''))}
              keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
              style={styles.pageInput}
              onBlur={() => {
                const n = Math.floor(Number(pageInput || '1'))
                if (!Number.isFinite(n)) {
                  setPageInput(String(page))
                  return
                }
                const next = Math.min(totalPages, Math.max(1, n))
                setPage(next)
              }}
            />
            <Text style={styles.pageInfo}>{`/ ${totalPages}`}</Text>
          </View>
          <Pressable onPress={() => setPage((p) => Math.min(totalPages, p + 1))} style={styles.pageBtn}>
            <Text style={styles.pageBtnText}>次へ</Text>
          </Pressable>
        </View>
      </CollapsibleSection>
    </ScrollView>
  )
}

export function VideoDetailScreen({
  cfg,
  cmsFetchJson,
  cmsFetchJsonWithBase,
  csvToIdList,
  tus,
  styles,
  SelectField,
  MultiSelectField,
  id,
  onBack,
  onGoComments,
  onOpenVideo,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  cmsFetchJsonWithBase: CmsFetchJsonWithBase
  csvToIdList: (csv: string) => string[]
  tus: any
  styles: any
  SelectField: SelectFieldComponent
  MultiSelectField: MultiSelectFieldComponent
  id: string
  onBack: () => void
  onGoComments?: (workId: string, episodeId: string) => void
  onOpenVideo?: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [workId, setWorkId] = useState('')
  const [desc, setDesc] = useState('')
  const [streamVideoId, setStreamVideoId] = useState('')
  const [subtitleUrl, setSubtitleUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [episodeNoText, setEpisodeNoText] = useState('')
  const [categoryIdsText, setCategoryIdsText] = useState('')
  const [tagIdsText, setTagIdsText] = useState('')
  const [castIdsText, setCastIdsText] = useState('')
  const [genreIdsText, setGenreIdsText] = useState('')
  const [published, setPublished] = useState(true)
  const [ratingAvg, setRatingAvg] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [playsCount, setPlaysCount] = useState(0)
  const [commentsCount, setCommentsCount] = useState(0)
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  const initialRef = useRef<any>(null)

  type SectionId = VideoDetailSectionId
  const scrollRef = useRef<any>(null)
  const [sectionY, setSectionY] = useState<Record<SectionId, number>>({
    preview: 0,
    basics: 0,
    replace: 0,
    publish: 0,
    meta: 0,
    reco: 0,
    advanced: 0,
  })
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    preview: true,
    basics: true,
    replace: false,
    publish: false,
    meta: false,
    reco: false,
    advanced: false,
  })
  const [activeSectionId, setActiveSectionId] = useState<SectionId | null>(null)
  const didInitSectionsRef = useRef(false)
  const lastInteractionAtRef = useRef(0)
  const scrollYRef = useRef(0)
  const editingTextInputRef = useRef(false)
  const editingScrollYRef = useRef<number | null>(null)

  const getCurrentScrollY = useCallback((): number => {
    const fallback = Number(scrollYRef.current ?? 0) || 0
    if (Platform.OS !== 'web') return fallback
    try {
      const node =
        (scrollRef.current?.getScrollableNode?.() as any) ??
        (scrollRef.current?.getScrollResponder?.()?.getScrollableNode?.() as any) ??
        (scrollRef.current as any)
      const y = Number(node?.scrollTop)
      if (Number.isFinite(y)) return y
    } catch {
      // ignore
    }
    return fallback
  }, [])

  const [savedFlash, setSavedFlash] = useState<{ section: SectionId | 'all'; at: number } | null>(null)
  const savedFlashTimerRef = useRef<any>(null)
  const flashSaved = useCallback((section: SectionId | 'all') => {
    setSavedFlash({ section, at: Date.now() })
    try {
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current)
    } catch {
      // ignore
    }
    savedFlashTimerRef.current = setTimeout(() => {
      setSavedFlash(null)
      savedFlashTimerRef.current = null
    }, 1800)
  }, [])

  useEffect(() => {
    return () => {
      try {
        if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current)
      } catch {
        // ignore
      }
    }
  }, [])

  const patchInitial = useCallback((partial: any) => {
    if (!initialRef.current) return
    initialRef.current = { ...initialRef.current, ...partial }
  }, [])

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const openSection = useCallback((id: SectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: true }))
  }, [])

  const markActive = useCallback((id: SectionId) => {
    lastInteractionAtRef.current = Date.now()
    setActiveSectionId(id)
  }, [])

  const scrollToSection = useCallback(
    (id: SectionId) => {
      openSection(id)
      markActive(id)
      const y = Number(sectionY[id] ?? 0) || 0
      try {
        ;(globalThis as any)?.requestAnimationFrame?.(() => {
          scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 12), animated: true })
        })
      } catch {
        // ignore
      }
    },
    [markActive, openSection, sectionY]
  )

  const didScrollFromQueryRef = useRef(false)
  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (didScrollFromQueryRef.current) return

    let section: string | null = null
    try {
      section = new URL(globalThis.location?.href || '').searchParams.get('section')
    } catch {
      section = null
    }

    if (!section) return
    const sid = section as SectionId
    if (!['preview', 'basics', 'replace', 'publish', 'meta', 'reco', 'advanced'].includes(section)) return

    const y = Number(sectionY[sid] ?? 0) || 0
    if (y <= 0) return

    didScrollFromQueryRef.current = true
    scrollToSection(sid)
  }, [scrollToSection, sectionY])

  const onScroll = useCallback(
    (e: any) => {
      const y = Number(e?.nativeEvent?.contentOffset?.y ?? 0) || 0
      scrollYRef.current = y
      if (Date.now() - lastInteractionAtRef.current < 1000) return
      const entries: Array<[SectionId, number]> = (Object.entries(sectionY) as any).filter(
        ([sid, sy]: [SectionId, number]) => sid === 'preview' || Number(sy) > 0
      )
      entries.sort((a, b) => a[1] - b[1])
      const threshold = y + 24
      let current: SectionId | null = null
      for (const [sid, sy] of entries) {
        if (sy <= threshold) current = sid
      }
      if (current && current !== activeSectionId) setActiveSectionId(current)
    },
    [activeSectionId, sectionY]
  )

  // Workaround (web): prevent occasional scroll-to-top while typing by restoring scroll position.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!editingTextInputRef.current) return
    const targetY = Number(editingScrollYRef.current ?? NaN)
    if (!Number.isFinite(targetY)) return

    const currentY = getCurrentScrollY()
    // Only restore when we detect an unintended jump upward (e.g. to top).
    if (currentY >= targetY - 12) return
    try {
      ;(globalThis as any)?.requestAnimationFrame?.(() => {
        scrollRef.current?.scrollTo?.({ y: targetY, animated: false })
      })
    } catch {
      // ignore
    }
  }, [desc, getCurrentScrollY, title])

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadState, setUploadState] = useState<'idle' | 'creating' | 'uploading' | 'done' | 'error'>('idle')
  const uploadRef = useRef<any>(null)

  const [recommendations, setRecommendations] = useState<
    Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string }>
  >([])
  const [recoCheckedIds, setRecoCheckedIds] = useState<string[]>([])
  const [recoSearchQ, setRecoSearchQ] = useState('')
  const [recoSearchBusy, setRecoSearchBusy] = useState(false)
  const [recoSearchRows, setRecoSearchRows] = useState<
    Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string }>
  >([])
  const [recoSearchSelectedIds, setRecoSearchSelectedIds] = useState<string[]>([])
  const [manualRecoVideoId, setManualRecoVideoId] = useState('')
  const [openRecoAdvanced, setOpenRecoAdvanced] = useState(false)
  const recoSearchInputRef = useRef<any>(null)

  const [workOptions, setWorkOptions] = useState<Array<{ label: string; value: string }>>([])
  const [categoryOptions, setCategoryOptions] = useState<MultiSelectOption[]>([])
  const [tagOptions, setTagOptions] = useState<MultiSelectOption[]>([])
  const [castOptions, setCastOptions] = useState<MultiSelectOption[]>([])
  const [genreOptions, setGenreOptions] = useState<MultiSelectOption[]>([])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<{ id: string; title: string }> }>(cfg, '/cms/works')
        if (!mounted) return
        setWorkOptions(json.items.map((w) => ({ label: w.title || w.id, value: w.id })))
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg, cmsFetchJson])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const [catsJson, tagsJson, castsJson, genresJson] = await Promise.all([
          cmsFetchJson<{ items: Array<{ id: string; name: string; enabled?: boolean }> }>(cfg, '/cms/categories'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/tags'),
          cmsFetchJson<{ items: Array<{ id: string; name: string; role?: string }> }>(cfg, '/cms/casts'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/genres'),
        ])
        if (!mounted) return
        setCategoryOptions(
          (catsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.enabled === false ? ' / 無効' : ''}`,
          }))
        )
        setTagOptions(
          (tagsJson.items ?? []).map((t) => ({
            value: String(t.id ?? ''),
            label: String(t.name ?? '') || String(t.id ?? ''),
            detail: String(t.id ?? ''),
          }))
        )
        setCastOptions(
          (castsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.role ? ` / ${String(c.role)}` : ''}`,
          }))
        )
        setGenreOptions(
          (genresJson.items ?? []).map((g) => ({
            value: String(g.id ?? ''),
            label: String(g.name ?? '') || String(g.id ?? ''),
            detail: String(g.id ?? ''),
          }))
        )
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg, cmsFetchJson])

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{
          item: {
            id: string
            workId: string
            title: string
            description: string
            streamVideoId: string
            streamVideoIdClean?: string
            streamVideoIdSubtitled?: string
            thumbnailUrl: string
            scheduledAt: string | null
            episodeNo?: number | null
            published: boolean
            categoryIds: string[]
            tagIds: string[]
            castIds: string[]
            genreIds?: string[]
            ratingAvg?: number
            reviewCount?: number
          }
          stats?: { playsCount?: number; commentsCount?: number }
        }>(cfg, `/cms/videos/${encodeURIComponent(id)}`)
        if (!mounted) return
        setWorkId(json.item.workId || '')
        setTitle(json.item.title || '')
        setDesc(json.item.description || '')
        setStreamVideoId(json.item.streamVideoId || '')
        setSubtitleUrl(String((json.item as any).subtitleUrl ?? ''))
        setThumbnailUrl(json.item.thumbnailUrl || '')
        setScheduledAt(json.item.scheduledAt || '')
        const ep = (json.item as any).episodeNo
        setEpisodeNoText(ep === null || ep === undefined || !Number.isFinite(Number(ep)) ? '' : String(Number(ep)))
        setPublished(Boolean(json.item.published))
        const nextCategoryIdsText = (json.item.categoryIds || []).join(', ')
        const nextTagIdsText = (json.item.tagIds || []).join(', ')
        const nextCastIdsText = (json.item.castIds || []).join(', ')
        setCategoryIdsText(nextCategoryIdsText)
        setTagIdsText(nextTagIdsText)
        setCastIdsText(nextCastIdsText)

        const nextGenreIdsText =
          (((json.item as any).genreIds as any[]) ?? [])
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .join(', ')
        setGenreIdsText(nextGenreIdsText)

        setRatingAvg(Number((json.item as any).ratingAvg ?? 0) || 0)
        setReviewCount(Number((json.item as any).reviewCount ?? 0) || 0)
        setPlaysCount(Number((json as any).stats?.playsCount ?? 0) || 0)
        setCommentsCount(Number((json as any).stats?.commentsCount ?? 0) || 0)

        // Snapshot for "未保存" detection and better UX.
        initialRef.current = {
          workId: String(json.item.workId || ''),
          title: String(json.item.title || ''),
          desc: String(json.item.description || ''),
          streamVideoId: String(json.item.streamVideoId || ''),
          subtitleUrl: String((json.item as any).subtitleUrl ?? ''),
          thumbnailUrl: String(json.item.thumbnailUrl || ''),
          scheduledAt: String(json.item.scheduledAt || ''),
          episodeNoText: ep === null || ep === undefined || !Number.isFinite(Number(ep)) ? '' : String(Number(ep)),
          published: Boolean(json.item.published),
          categoryIdsText: nextCategoryIdsText,
          tagIdsText: nextTagIdsText,
          castIdsText: nextCastIdsText,
          genreIdsText: nextGenreIdsText,
        }
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
  }, [cfg, cmsFetchJson, id])

  // Initialize section open state once per load.
  useEffect(() => {
    if (didInitSectionsRef.current) return
    if (!initialRef.current) return
    didInitSectionsRef.current = true
    setOpenSections({
      preview: true,
      basics: true,
      replace: false,
      publish: false,
      meta: false,
      reco: false,
      advanced: false,
    })
    setActiveSectionId('preview')
  }, [id, streamVideoId])

  const basicsDirty = useMemo(() => {
    const init = initialRef.current
    if (!init) return false
    return (
      init.workId !== workId ||
      init.title !== title ||
      init.desc !== desc ||
      init.thumbnailUrl !== thumbnailUrl
    )
  }, [desc, thumbnailUrl, title, workId])

  const publishDirty = useMemo(() => {
    const init = initialRef.current
    if (!init) return false
    return init.scheduledAt !== scheduledAt || init.episodeNoText !== episodeNoText || init.published !== published
  }, [episodeNoText, published, scheduledAt])

  const metaDirty = useMemo(() => {
    const init = initialRef.current
    if (!init) return false
    return (
      init.categoryIdsText !== categoryIdsText ||
      init.tagIdsText !== tagIdsText ||
      init.castIdsText !== castIdsText ||
      init.genreIdsText !== genreIdsText
    )
  }, [categoryIdsText, castIdsText, genreIdsText, tagIdsText])

  const advancedDirty = useMemo(() => {
    const init = initialRef.current
    if (!init) return false
    return init.streamVideoId !== streamVideoId || init.subtitleUrl !== subtitleUrl
  }, [streamVideoId, subtitleUrl])

  const initialRecoIdsRef = useRef<string>('')
  const recoDirty = useMemo(() => {
    const init = String(initialRecoIdsRef.current || '')
    const now = recommendations.map((v) => v.id).join(',')
    return Boolean(init) && init !== now
  }, [recommendations])

  const dirty = basicsDirty || publishDirty || metaDirty || advancedDirty || recoDirty

  const missingBasics = useMemo(() => {
    const miss: string[] = []
    if (!workId.trim()) miss.push('作品')
    if (!title.trim()) miss.push('タイトル')
    if (!thumbnailUrl.trim()) miss.push('サムネ')
    return miss
  }, [thumbnailUrl, title, workId])

  const missingContent = useMemo(() => {
    const miss: string[] = []
    if (!streamVideoId.trim()) miss.push('Stream連携（動画ファイル）')
    return miss
  }, [streamVideoId])

  useEffect(() => {
    if (!id) return
    let mounted = true
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/videos/${encodeURIComponent(id)}/recommendations`)
        if (!mounted) return
        const next = (json.items ?? []).map((r) => ({
          id: String(r.id ?? ''),
          title: String(r.title ?? ''),
          workTitle: String(r.workTitle ?? ''),
          thumbnailUrl: String(r.thumbnailUrl ?? ''),
        }))
        setRecommendations(next)
        setRecoCheckedIds(next.map((v) => v.id))
        initialRecoIdsRef.current = next.map((v) => v.id).join(',')
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg, cmsFetchJson, id])

  // Keep checkbox state in sync when list changes (add/move/apply).
  useEffect(() => {
    setRecoCheckedIds((prev) => {
      const ids = recommendations.map((r) => r.id)
      const next = ids.filter((x) => prev.includes(x))
      for (const x of ids) if (!next.includes(x)) next.push(x)
      return next
    })
  }, [recommendations])

  const toggleRecoChecked = useCallback((videoId: string) => {
    const vid = String(videoId || '').trim()
    if (!vid) return
    setRecoCheckedIds((prev) => (prev.includes(vid) ? prev.filter((x) => x !== vid) : [...prev, vid]))
  }, [])

  const applyRecoChecked = useCallback(() => {
    setRecommendations((prev) => prev.filter((v) => recoCheckedIds.includes(v.id)))
  }, [recoCheckedIds])

  const saveVideoPartial = useCallback(
    async (payload: any, patch: any) => {
      await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      patchInitial(patch)
    },
    [cfg, cmsFetchJson, id, patchInitial]
  )

  const saveReco = useCallback(async () => {
    if (!id) return
    await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}/recommendations`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoIds: recommendations.map((v) => v.id) }),
    })
    initialRecoIdsRef.current = recommendations.map((v) => v.id).join(',')
  }, [cfg, cmsFetchJson, id, recommendations])

  const onSaveBasics = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await saveVideoPartial(
          { workId, title, description: desc, thumbnailUrl },
          { workId, title, desc, thumbnailUrl }
        )
        flashSaved('basics')
        setBanner('このセクションを保存しました（表示内容）')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [desc, flashSaved, saveVideoPartial, setBanner, thumbnailUrl, title, workId])

  const onSavePublish = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await saveVideoPartial(
          {
            published,
            scheduledAt,
            episodeNo: episodeNoText.trim() ? Number(episodeNoText) : null,
          },
          { published, scheduledAt, episodeNoText }
        )
        flashSaved('publish')
        setBanner('このセクションを保存しました（公開設定）')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [episodeNoText, flashSaved, published, saveVideoPartial, scheduledAt, setBanner])

  const onSaveMeta = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await saveVideoPartial(
          {
            categoryIds: csvToIdList(categoryIdsText),
            tagIds: csvToIdList(tagIdsText),
            castIds: csvToIdList(castIdsText),
            genreIds: csvToIdList(genreIdsText),
          },
          { categoryIdsText, tagIdsText, castIdsText, genreIdsText }
        )
        flashSaved('meta')
        setBanner('このセクションを保存しました（分類）')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [castIdsText, categoryIdsText, csvToIdList, flashSaved, genreIdsText, saveVideoPartial, setBanner, tagIdsText])

  const onSaveAdvanced = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await saveVideoPartial({ streamVideoId, subtitleUrl }, { streamVideoId, subtitleUrl })
        flashSaved('advanced')
        setBanner('このセクションを保存しました（詳細設定）')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [flashSaved, saveVideoPartial, setBanner, streamVideoId, subtitleUrl])

  const onSaveReco = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await saveReco()
        flashSaved('reco')
        setBanner('このセクションを保存しました（おすすめ）')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [flashSaved, saveReco, setBanner])

  const onSaveAll = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      const saved: string[] = []
      try {
        if (basicsDirty) {
          await saveVideoPartial({ workId, title, description: desc, thumbnailUrl }, { workId, title, desc, thumbnailUrl })
          saved.push('表示内容')
        }
        if (publishDirty) {
          await saveVideoPartial(
            { published, scheduledAt, episodeNo: episodeNoText.trim() ? Number(episodeNoText) : null },
            { published, scheduledAt, episodeNoText }
          )
          saved.push('公開設定')
        }
        if (metaDirty) {
          await saveVideoPartial(
            {
              categoryIds: csvToIdList(categoryIdsText),
              tagIds: csvToIdList(tagIdsText),
              castIds: csvToIdList(castIdsText),
              genreIds: csvToIdList(genreIdsText),
            },
            { categoryIdsText, tagIdsText, castIdsText, genreIdsText }
          )
          saved.push('分類')
        }
        if (advancedDirty) {
          await saveVideoPartial({ streamVideoId, subtitleUrl }, { streamVideoId, subtitleUrl })
          saved.push('詳細設定')
        }
        if (recoDirty) {
          await saveReco()
          saved.push('おすすめ')
        }

        if (!saved.length) {
          setBanner('保存済みです')
          return
        }

        flashSaved('all')
        setBanner(`すべて保存しました（${saved.join(' / ')}）`)
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [advancedDirty, basicsDirty, castIdsText, categoryIdsText, csvToIdList, desc, episodeNoText, flashSaved, genreIdsText, metaDirty, publishDirty, published, recoDirty, saveReco, saveVideoPartial, scheduledAt, setBanner, streamVideoId, subtitleUrl, tagIdsText, thumbnailUrl, title, workId])

  const stopUpload = useCallback(() => {
    try {
      if (uploadRef.current && typeof uploadRef.current.abort === 'function') {
        uploadRef.current.abort(true)
      }
    } catch {
      // ignore
    }
    uploadRef.current = null
    setUploadState('idle')
    setUploadPct(0)
    setBanner('アップロードを中止しました')
  }, [setBanner])

  const startStreamUpload = useCallback(() => {
    if (!id) {
      setUploadState('error')
      setBanner('動画IDが指定されていません')
      return
    }
    if (Platform.OS !== 'web') {
      setUploadState('error')
      setBanner('アップロードはWeb版管理画面のみ対応です')
      return
    }
    if (!uploadFile) {
      setUploadState('error')
      setBanner('動画ファイルを選択してください')
      return
    }
    if (!tus) {
      setUploadState('error')
      setBanner('tus uploader が初期化できませんでした')
      return
    }

    const maxBytes = 30 * 1024 * 1024 * 1024
    if (typeof uploadFile.size === 'number' && uploadFile.size > maxBytes) {
      setUploadState('error')
      setBanner('ファイルが大きすぎます（最大30GB）')
      return
    }

    setUploadState('creating')
    setUploadPct(0)
    setBanner('アップロードURL発行中…')

    void (async () => {
      try {
        const tusEndpoint = new URL('/cms/stream/tus', cfg.uploaderBase).toString()
        const uploaderBase = String(cfg.uploaderBase || '').replace(/\/$/, '')
        let createdUid = ''

        setUploadState('uploading')
        setBanner('アップロード開始中…')

        const uploader = new tus.Upload(uploadFile, {
          endpoint: tusEndpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          // Smaller chunks are more reliable (less likely to hit proxy/body/time limits)
          // and also provide more frequent progress updates.
          chunkSize: 10 * 1024 * 1024,
          metadata: {
            filename: uploadFile.name,
            filetype: uploadFile.type || 'application/octet-stream',
          },
          onBeforeRequest: (req: any) => {
            try {
              const url = typeof req?.getURL === 'function' ? String(req.getURL() || '') : ''
              if (uploaderBase && url.startsWith(uploaderBase) && typeof req?.setHeader === 'function') {
                req.setHeader('Authorization', `Bearer ${cfg.token}`)
              }
            } catch {
              // ignore
            }
          },
          onAfterResponse: (_req: any, res: any) => {
            if (createdUid) return
            try {
              const getHeader = (name: string): string => {
                if (res && typeof res.getHeader === 'function') return String(res.getHeader(name) || '')
                if (res && typeof res.getResponseHeader === 'function') return String(res.getResponseHeader(name) || '')
                return ''
              }

              const mediaId = (getHeader('Stream-Media-ID') || getHeader('stream-media-id')).trim()
              const location = (getHeader('Location') || getHeader('location')).trim()

              const inferred = (() => {
                // Cloudflare Stream tus Location is typically like:
                // - https://upload.cloudflarestream.com/tus/<UID>
                // - .../<UID>
                const m = (location || '').match(/\/([a-f0-9]{32})(?:\b|\/|$)/i)
                return m?.[1] || ''
              })()

              const uid = (mediaId || inferred).trim()
              if (uid) {
                createdUid = uid
                setStreamVideoId(uid)
              }
            } catch {
              // ignore
            }
          },
          onError: (err: any) => {
            setUploadState('error')
            try {
              const req = (err as any)?.originalRequest
              const status = typeof req?.getStatus === 'function' ? req.getStatus() : undefined
              const body = typeof req?.getResponseText === 'function' ? String(req.getResponseText() || '') : ''
              const base = err instanceof Error ? err.message : String(err)
              const extra = [status ? `status=${status}` : '', body ? body.slice(0, 300) : ''].filter(Boolean).join(' ')
              setBanner(extra ? `${base} (${extra})` : base)
            } catch {
              setBanner(err instanceof Error ? err.message : String(err))
            }
          },
          onShouldRetry: (_err: any, retryAttempt: number) => {
            // Keep users informed when it retries (otherwise it looks like it stalled).
            if (retryAttempt >= 1) setBanner(`アップロードが失敗しました。再試行中…（${retryAttempt}回目）`)
            return true
          },
          onProgress: (bytesUploaded: number, bytesTotal: number) => {
            const pct = bytesTotal > 0 ? Math.floor((bytesUploaded / bytesTotal) * 100) : 0
            setUploadPct(pct)
          },
          onSuccess: () => {
            if (!createdUid) {
              try {
                const url = String((uploader as any).url || '').trim()
                const m = url.match(/\/([a-f0-9]{32})(?:\b|\/|$)/i)
                const uid = (m?.[1] || '').trim()
                if (uid) {
                  createdUid = uid
                  setStreamVideoId(uid)
                }
              } catch {
                // ignore
              }
            }
            setUploadState('done')
            setUploadPct(100)
            setBanner('アップロード完了（動画に紐付け中…）')

            void (async () => {
              try {
                if (!createdUid) return
                await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}`, {
                  method: 'PUT',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ streamVideoId: createdUid }),
                })
                setBanner('アップロード完了（動画に紐付けました）')
              } catch (e) {
                setBanner(e instanceof Error ? e.message : String(e))
              }
            })()
          },
        })

        uploadRef.current = uploader
        uploader.start()
      } catch (e) {
        setUploadState('error')
        setBanner(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [cfg, cmsFetchJson, id, setBanner, tus, uploadFile])

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const uploadThumbnail = useCallback((file?: File | null) => {
    if (Platform.OS !== 'web') {
      setBanner('サムネイル画像アップロードはWeb版管理画面のみ対応です')
      return
    }
    const f = file ?? thumbnailFile
    if (!f) {
      setBanner('画像ファイルを選択してください')
      return
    }

    setThumbnailUploading(true)
    setBanner('画像アップロード中…')
    void (async () => {
      try {
        const res = await cmsFetchJsonWithBase<{ error: string | null; data: { fileId: string; url: string } | null }>(
          cfg,
          cfg.uploaderBase,
          '/cms/images',
          {
            method: 'PUT',
            headers: {
              'content-type': f.type || 'application/octet-stream',
            },
            body: f,
          }
        )

        if (res.error || !res.data?.url) {
          throw new Error(res.error || '画像アップロードに失敗しました')
        }

        setThumbnailUrl(res.data.url)
        setThumbnailFile(null)
        setBanner('画像アップロード完了')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setThumbnailUploading(false)
      }
    })()
  }, [cfg, cmsFetchJsonWithBase, setBanner, thumbnailFile])

  const [playback, setPlayback] = useState<{
    loading: boolean
    iframeUrl: string
    mp4Url: string
    hlsUrl: string
    error: string
    readyToStream: boolean | null
    status: string | null
  }>({ loading: false, iframeUrl: '', mp4Url: '', hlsUrl: '', error: '', readyToStream: null, status: null })

  const [streamProbe, setStreamProbe] = useState<{
    loading: boolean
    configured: boolean | null
    readyToStream: boolean | null
    status: string | null
    error: string | null
  }>({ loading: false, configured: null, readyToStream: null, status: null, error: null })

  const [playbackRefreshKey, setPlaybackRefreshKey] = useState(0)

  useEffect(() => {
    const vid = String(streamVideoId || '').trim()
    if (!vid) {
      setStreamProbe({ loading: false, configured: null, readyToStream: null, status: null, error: null })
      return
    }

    // Mirror the behavior of the new-upload screen: only auto-poll after a fresh upload succeeded.
    if (uploadState !== 'done') return

    let cancelled = false
    let timer: any = null
    const startedAt = Date.now()

    const tick = async () => {
      if (cancelled) return
      setStreamProbe((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const json = await cmsFetchJson<{
          configured?: boolean
          readyToStream?: boolean | null
          status?: string | null
        }>(cfg, `/v1/stream/playback/${encodeURIComponent(vid)}`)

        if (cancelled) return
        const configured = json.configured !== undefined ? Boolean(json.configured) : true
        const readyToStream = json.readyToStream === null || json.readyToStream === undefined ? null : Boolean(json.readyToStream)
        const status = json.status === null || json.status === undefined ? null : String(json.status)

        setStreamProbe({ loading: false, configured, readyToStream, status, error: null })

        // Once ready, refresh playback info once.
        if (readyToStream === true) {
          setPlaybackRefreshKey((k) => k + 1)
          return
        }
      } catch (e) {
        if (cancelled) return
        setStreamProbe((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }))
      }

      // Avoid polling forever.
      if (Date.now() - startedAt > 30 * 60 * 1000) return
      timer = setTimeout(tick, 5000)
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [cfg, cmsFetchJson, streamVideoId, uploadState])

  useEffect(() => {
    const vid = String(streamVideoId || '').trim()
    if (!vid) {
      setPlayback({ loading: false, iframeUrl: '', mp4Url: '', hlsUrl: '', error: '', readyToStream: null, status: null })
      return
    }
    let cancelled = false
    setPlayback((p) => ({ ...p, loading: true, error: '' }))
    void (async () => {
      try {
        let json: any
        try {
          // Production Stream often requires signed URLs; prefer those for preview.
          json = await cmsFetchJson<any>(cfg, `/v1/stream/hmac-signed-playback/${encodeURIComponent(vid)}`)
        } catch {
          // Fallback: unsigned URLs (works when signed URLs are not required / local dev).
          json = await cmsFetchJson<any>(cfg, `/v1/stream/playback/${encodeURIComponent(vid)}`)
        }
        if (cancelled) return
        // Also fetch Stream processing status (best-effort).
        let readyToStream: boolean | null = null
        let status: string | null = null
        try {
          const probe = await cmsFetchJson<any>(cfg, `/v1/stream/playback/${encodeURIComponent(vid)}`)
          readyToStream = probe?.readyToStream === null || probe?.readyToStream === undefined ? null : Boolean(probe.readyToStream)
          status = probe?.status === null || probe?.status === undefined ? null : String(probe.status)
        } catch {
          // ignore
        }

        setPlayback({
          loading: false,
          iframeUrl: String(json?.iframeUrl ?? ''),
          mp4Url: String(json?.mp4Url ?? ''),
          hlsUrl: String(json?.hlsUrl ?? ''),
          error: '',
          readyToStream,
          status,
        })
      } catch (e) {
        if (cancelled) return
        setPlayback({
          loading: false,
          iframeUrl: '',
          mp4Url: '',
          hlsUrl: '',
          error: e instanceof Error ? e.message : String(e),
          readyToStream: null,
          status: null,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cfg, cmsFetchJson, streamVideoId, playbackRefreshKey])

  const moveReco = useCallback((videoId: string, dir: -1 | 1) => {
    setRecommendations((prev) => {
      const i = prev.findIndex((v) => v.id === videoId)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = prev.slice()
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
      return next
    })
  }, [])

  const removeReco = useCallback((videoId: string) => {
    setRecommendations((prev) => prev.filter((v) => v.id !== videoId))
  }, [])

  const addReco = useCallback((row: { id: string; title: string; workTitle: string; thumbnailUrl: string }) => {
    const vid = String(row.id || '').trim()
    if (!vid) return
    if (vid === String(id || '').trim()) return
    setRecommendations((prev) => {
      if (prev.some((v) => v.id === vid)) return prev
      return [
        ...prev,
        {
          id: vid,
          title: String(row.title ?? ''),
          workTitle: String(row.workTitle ?? ''),
          thumbnailUrl: String(row.thumbnailUrl ?? ''),
        },
      ]
    })
  }, [id])

  const toggleRecoSearchSelect = useCallback((videoId: string) => {
    const vid = String(videoId || '').trim()
    if (!vid) return
    setRecoSearchSelectedIds((prev) => (prev.includes(vid) ? prev.filter((x) => x !== vid) : [...prev, vid]))
  }, [])

  const addSelectedReco = useCallback(() => {
    if (!recoSearchSelectedIds.length) return
    const byId = new Map(recoSearchRows.map((r) => [r.id, r]))
    for (const vid of recoSearchSelectedIds) {
      const row = byId.get(vid)
      if (!row) continue
      addReco(row)
    }
    setRecoSearchSelectedIds([])
  }, [addReco, recoSearchRows, recoSearchSelectedIds])

  const onSearchReco = useCallback(() => {
    const q = recoSearchQ.trim()
    if (!q) {
      setRecoSearchRows([])
      setRecoSearchSelectedIds([])
      return
    }
    setRecoSearchBusy(true)
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/videos?q=${encodeURIComponent(q)}&limit=50`)
        setRecoSearchRows(
          (json.items ?? []).map((v) => ({
            id: String(v.id ?? ''),
            title: String(v.title ?? ''),
            workTitle: String(v.workTitle ?? ''),
            thumbnailUrl: String(v.thumbnailUrl ?? ''),
          }))
        )
        setRecoSearchSelectedIds([])
      } catch {
        // ignore
      } finally {
        setRecoSearchBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, recoSearchQ])

  // onSaveReco is defined above (section save + all save)

  const sectionProps = useMemo(
    () => ({
      openSections,
      activeSectionId,
      styles,
      savedFlash,
      markActive,
      toggleSection,
      setSectionY,
    }),
    [activeSectionId, markActive, openSections, savedFlash, styles, toggleSection]
  )

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.contentScroll}
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.contentInner, Platform.OS === 'web' ? ({ paddingBottom: 110 } as any) : null]}
      >
        <View style={styles.pageHeaderRow}>
          <Pressable onPress={onBack} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>戻る</Text>
          </Pressable>
          <Text style={styles.pageTitle}>この動画を編集する</Text>
        </View>

        <View style={{ marginTop: 10 }}>
          {dirty ? (
            <Text style={{ marginTop: 6, color: '#b45309', fontSize: 13 }}>未保存の変更があります</Text>
          ) : null}
        </View>

        <VideoDetailSection {...(sectionProps as any)}
          id="preview"
          title="動画プレビュー"
          description="再生できるかを確認します（処理中は少し待ってから更新）"
        >
          {!streamVideoId.trim() ? (
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: '#eff6ff',
                borderWidth: 1,
                borderColor: '#93c5fd',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#1d4ed8', fontWeight: '900' }}>ℹ️ Stream連携が未設定です</Text>
              <Text style={{ color: '#334155', marginTop: 6, lineHeight: 20 } as any}>
                動画ファイルをアップロードすると自動で設定されます。以下の手順で進めると迷いません。
              </Text>
              <View style={{ marginTop: 10 }}>
                <Text style={{ color: '#0f172a', fontWeight: '900' }}>STEP 1</Text>
                <Text style={{ color: '#334155', marginTop: 2 } as any}>動画ファイルをアップロード</Text>
                <Text style={{ color: '#0f172a', fontWeight: '900', marginTop: 8 } as any}>STEP 2</Text>
                <Text style={{ color: '#334155', marginTop: 2 } as any}>この画面で再生できるか確認</Text>
                <Text style={{ color: '#0f172a', fontWeight: '900', marginTop: 8 } as any}>STEP 3（任意）</Text>
                <Text style={{ color: '#334155', marginTop: 2 } as any}>字幕（WebVTT）を登録</Text>
              </View>
              <View style={[styles.filterActions, { justifyContent: 'flex-start', marginTop: 12 }]}>
                <Pressable
                  onPress={() => {
                    scrollToSection('replace')
                  }}
                  style={styles.btnPrimary}
                >
                  <Text style={styles.btnPrimaryText}>STEP 1へ：動画ファイルをアップロード</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>現在のStream連携</Text>
            <Text style={styles.selectMenuDetailText}>
              {streamVideoId.trim()
                ? '連携済み（必要なら「詳細設定」でStream Video IDを編集できます）'
                : '未連携です。「動画ファイル差し替え」でアップロードすると自動で紐付きます'}
            </Text>
            {streamVideoId.trim() ? (
              <Text style={styles.readonlyText} numberOfLines={1}>
                {streamVideoId.trim()}
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>プレビュー</Text>
            {Platform.OS === 'web' ? (
              <View>
                {playback.loading ? <Text style={styles.selectMenuDetailText}>再生情報取得中…</Text> : null}
                {playback.error ? <Text style={styles.selectMenuDetailText}>{`再生情報エラー: ${playback.error}`}</Text> : null}
                <View style={[styles.filterActions, { marginTop: 6, justifyContent: 'flex-start' }]}>
                  <Pressable onPress={() => setPlaybackRefreshKey((k) => k + 1)} style={styles.btnSecondary}>
                    <Text style={styles.btnSecondaryText}>再生情報を更新</Text>
                  </Pressable>
                  {uploadState === 'done' ? (
                    <Text style={[styles.selectMenuDetailText, { marginLeft: 10 }]}>
                      {streamProbe.loading
                        ? 'Stream状況確認中…'
                        : streamProbe.error
                          ? `Stream状況取得エラー: ${streamProbe.error}`
                          : streamProbe.configured === false
                            ? 'Stream設定が未構成の可能性があります'
                            : streamProbe.readyToStream === true
                              ? 'エンコード完了（再生可能）'
                              : 'エンコード中…（しばらく待ってください）'}
                    </Text>
                  ) : null}
                </View>

                {playback.iframeUrl || playback.hlsUrl || playback.mp4Url ? (
                  <View style={{ marginTop: 8 }}>
                    {playback.iframeUrl ? (
                      <iframe
                        title="stream-preview"
                        src={playback.iframeUrl}
                        style={{ width: '100%', maxWidth: 720, aspectRatio: '16 / 9', border: 0, borderRadius: 10, backgroundColor: '#111' }}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    ) : null}
                    {!playback.iframeUrl && playback.mp4Url ? (
                      <video style={{ width: '100%', maxWidth: 720, backgroundColor: '#111', borderRadius: 10 }} controls preload="metadata">
                        <source src={playback.mp4Url} type="video/mp4" />
                        {subtitleUrl.trim() ? <track src={subtitleUrl.trim()} kind="subtitles" srcLang="ja" label="日本語" default /> : null}
                      </video>
                    ) : null}
                    <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                      <Pressable
                        onPress={() => {
                          try {
                            const url = (playback.iframeUrl || playback.hlsUrl || playback.mp4Url || '').trim()
                            if (!url) return
                            ;(globalThis as any)?.window?.open?.(url, '_blank')
                          } catch {
                            // ignore
                          }
                        }}
                        style={styles.btnSecondary}
                      >
                        <Text style={styles.btnSecondaryText}>別タブで開く</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selectMenuDetailText}>Stream Video ID 未設定、または再生URLが取得できません</Text>
                )}
              </View>
            ) : (
              <Text style={styles.selectMenuDetailText}>Web版管理画面でプレビューできます</Text>
            )}
          </View>
        </VideoDetailSection>

        <VideoDetailSection {...(sectionProps as any)}
          id="basics"
          title="視聴者に表示される内容"
          description="タイトル・説明・サムネを編集します。"
          warning={missingBasics.length ? `未設定: ${missingBasics.join(' / ')}` : undefined}
          dirty={basicsDirty}
        >
          <View onTouchStart={() => markActive('basics')}>
            <SelectField label="作品" value={workId} placeholder="選択" options={workOptions} onChange={setWorkId} />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { fontSize: 15, fontWeight: '900', color: '#111827' }]}>タイトル（重要）</Text>
            <TextInput
              nativeID={`admin-video-${String(id || 'new')}-title`}
              value={title}
              onChangeText={setTitle}
              style={[styles.input, { fontSize: 16, paddingVertical: 12, borderColor: '#93c5fd' }]}
              onFocus={() => {
                editingTextInputRef.current = true
                editingScrollYRef.current = getCurrentScrollY()
                markActive('basics')
              }}
              onBlur={() => {
                editingTextInputRef.current = false
                editingScrollYRef.current = null
              }}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { fontSize: 15, fontWeight: '900', color: '#111827' }]}>説明（重要）</Text>
            <TextInput
              nativeID={`admin-video-${String(id || 'new')}-desc`}
              value={desc}
              onChangeText={setDesc}
              style={[styles.input, { minHeight: 120, fontSize: 15, borderColor: '#93c5fd' }]}
              multiline
              onFocus={() => {
                editingTextInputRef.current = true
                editingScrollYRef.current = getCurrentScrollY()
                markActive('basics')
              }}
              onBlur={() => {
                editingTextInputRef.current = false
                editingScrollYRef.current = null
              }}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { fontSize: 15, fontWeight: '900', color: '#111827' }]}>サムネ（重要）</Text>
            <Text style={styles.selectMenuDetailText}>一覧や詳細で最初に目に入る画像です（16:9 推奨）</Text>
            {Platform.OS === 'web' ? (
              <View style={{ marginTop: 8 }}>
                <WebDropZone
                  title="サムネ画像を選択"
                  hint="PNG/JPEG/WebP"
                  accept="image/png,image/jpeg,image/webp"
                  multiple={false}
                  disabled={thumbnailUploading}
                  onFiles={(files) => {
                    const f = files?.[0] ?? null
                    if (!f) return
                    setThumbnailFile(f)
                    setBanner('')
                  }}
                />
                {thumbnailFile ? (
                  <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10 } as any}>
                    <Text style={styles.selectMenuDetailText} numberOfLines={1}>
                      選択中: {thumbnailFile.name}（{Math.max(1, Math.round(thumbnailFile.size / 1024))}KB）
                    </Text>
                    <Pressable onPress={() => setThumbnailFile(null)} style={styles.btnSecondary}>
                      <Text style={styles.btnSecondaryText}>選択解除</Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                  <Pressable
                    disabled={thumbnailUploading || !thumbnailFile}
                    onPress={() => uploadThumbnail()}
                    style={[styles.btnSecondary, thumbnailUploading || !thumbnailFile ? styles.btnDisabled : null]}
                  >
                    <Text style={styles.btnSecondaryText}>{thumbnailUploading ? '画像アップロード中…' : 'アップロードして反映'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>サムネURL</Text>
              <TextInput
                value={thumbnailUrl}
                onChangeText={setThumbnailUrl}
                style={[styles.input, { borderColor: '#93c5fd' }]}
                autoCapitalize="none"
                onFocus={() => markActive('basics')}
              />
            </View>

            {thumbnailUrl.trim() ? (
              <Pressable
                onPress={() => {
                  try {
                    const u = thumbnailUrl.trim()
                    if (!u) return
                    ;(globalThis as any)?.window?.open?.(u, '_blank')
                  } catch {
                    // ignore
                  }
                }}
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
              >
                <Image
                  source={{ uri: thumbnailUrl.trim() }}
                  style={{ width: 240, height: 135, borderRadius: 10, backgroundColor: '#e5e7eb' }}
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.filterActions, { justifyContent: 'flex-start' }]}>
            <Pressable disabled={busy} onPress={onSaveBasics} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
              <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : 'このセクションを保存'}</Text>
            </Pressable>
          </View>

        </VideoDetailSection>

        <VideoDetailSection {...(sectionProps as any)}
          id="replace"
          title="動画ファイル差し替え"
          description="通常は自動処理されますが、差し替えが必要な場合のみ使用してください。"
        >
          <View
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontWeight: '900', color: '#0f172a' }}>STEP 1：動画ファイルをアップロード</Text>
            <Text style={{ color: '#475569', marginTop: 6, lineHeight: 20 } as any}>ファイルを選択するとアップロードを開始できます（最大30GB）。</Text>

            <View style={[styles.field, { marginTop: 10 }]}>
              <Text style={styles.label}>動画アップロード（Cloudflare Stream）</Text>
              <Text style={styles.selectMenuDetailText}>動画ファイルを選び、アップロードを開始します</Text>

              {Platform.OS === 'web' ? (
                <View style={{ marginTop: 10 }}>
                  <WebDropZone
                    title="動画ファイルを選択"
                    hint="ドラッグ&ドロップ対応（最大30GB）"
                    accept="video/*"
                    multiple={false}
                    onFiles={(files) => {
                      const f = files?.[0] ?? null
                      if (!f) return
                      setUploadFile(f)
                      setUploadPct(0)
                      setUploadState('idle')
                      setBanner('')
                    }}
                  />

                  {uploadFile ? (
                    <Text style={[styles.selectMenuDetailText, { marginTop: 6 }]}>
                      {`選択: ${uploadFile.name} / ${(uploadFile.size / (1024 * 1024)).toFixed(1)}MB`}
                    </Text>
                  ) : (
                    <Text style={[styles.selectMenuDetailText, { marginTop: 6 }]}>動画ファイルを選択するとアップロードを開始できます</Text>
                  )}

                  <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                    <Pressable
                      disabled={uploadState === 'creating' || uploadState === 'uploading' || !uploadFile}
                      onPress={startStreamUpload}
                      style={[
                        styles.btnPrimary,
                        uploadState === 'creating' || uploadState === 'uploading' || !uploadFile ? styles.btnDisabled : null,
                      ]}
                    >
                      <Text style={styles.btnPrimaryText}>
                        {uploadState === 'creating'
                          ? 'URL発行中…'
                          : uploadState === 'uploading'
                            ? `アップロード中… ${uploadPct}%`
                            : uploadState === 'done'
                              ? '再アップロード'
                              : 'アップロード開始'}
                      </Text>
                    </Pressable>
                    {uploadState === 'uploading' ? (
                      <Pressable onPress={stopUpload} style={styles.btnSecondary}>
                        <Text style={styles.btnSecondaryText}>中止</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {uploadState === 'creating' || uploadState === 'uploading' ? (
                    <Text style={[styles.selectMenuDetailText, { marginTop: 8 }]}>アップロードには時間がかかる場合があります（完了までこの画面で待機できます）</Text>
                  ) : null}

                  {uploadState === 'uploading' || uploadState === 'done' ? (
                    <View style={styles.uploadBarOuter}>
                      <View style={[styles.uploadBarInner, { width: `${Math.min(100, Math.max(0, uploadPct))}%` }]} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.selectMenuDetailText, { marginTop: 6 }]}>Web版管理画面でアップロードできます</Text>
              )}
            </View>
          </View>

          <View
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontWeight: '900', color: '#0f172a' }}>STEP 2：プレビューに戻って確認</Text>
            <Text style={{ color: '#475569', marginTop: 6, lineHeight: 20 } as any}>
              アップロード後は「プレビュー」セクションで、再生できるか・想定の動画になっているかを確認してください。
            </Text>
            <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
              <Pressable onPress={() => scrollToSection('preview')} style={styles.btnSecondary}>
                <Text style={styles.btnSecondaryText}>STEP 2へ：プレビューを開く</Text>
              </Pressable>
            </View>
          </View>

          <View
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontWeight: '900', color: '#0f172a' }}>STEP 3：字幕（WebVTT）を登録（任意）</Text>
            <Text style={{ color: '#475569', marginTop: 6, lineHeight: 20 } as any}>※ 動画アップロード完了後に設定できます</Text>
            <View style={{ marginTop: 10 }}>
              <StreamCaptionsPanel cfg={cfg as unknown as CmsApiConfig} streamVideoId={streamVideoId} />
            </View>
          </View>
        </VideoDetailSection>

        <VideoDetailSection {...(sectionProps as any)}
          id="publish"
          title="視聴者に公開する設定"
          description="公開/非公開、配信予定日時、話数を設定します。"
          dirty={publishDirty}
        >
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>公開</Text>
            <Switch value={published} onValueChange={setPublished} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>配信予定日時（ISO文字列）</Text>
            <TextInput
              nativeID={`admin-video-${String(id || 'new')}-scheduledAt`}
              value={scheduledAt}
              onChangeText={setScheduledAt}
              placeholder="2026-01-15T20:00:00Z"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              autoCapitalize="none"
              onFocus={() => markActive('publish')}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>話数（episodeNo）</Text>
            <TextInput
              nativeID={`admin-video-${String(id || 'new')}-episodeNo`}
              value={episodeNoText}
              onChangeText={setEpisodeNoText}
              style={styles.input}
              keyboardType="numeric"
              onFocus={() => markActive('publish')}
            />
          </View>

          <View style={[styles.filterActions, { justifyContent: 'flex-start' }]}>
            <Pressable disabled={busy} onPress={onSavePublish} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
              <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : 'このセクションを保存'}</Text>
            </Pressable>
          </View>
        </VideoDetailSection>

        <VideoDetailSection {...(sectionProps as any)}
          id="meta"
          title="検索や一覧に使う分類"
          description="カテゴリ・タグ・出演者・ジャンルを設定します。"
          dirty={metaDirty}
        >
          <MultiSelectField
            label="カテゴリ（複数選択）"
            values={csvToIdList(categoryIdsText)}
            placeholder="選択"
            options={categoryOptions}
            onChange={(ids: string[]) => setCategoryIdsText(ids.join(', '))}
            searchPlaceholder="カテゴリ検索（名前 / ID）"
          />
          <MultiSelectField
            label="タグ（複数選択）"
            values={csvToIdList(tagIdsText)}
            placeholder="選択"
            options={tagOptions}
            onChange={(ids: string[]) => setTagIdsText(ids.join(', '))}
            searchPlaceholder="タグ検索（名前 / ID）"
          />
          <MultiSelectField
            label="出演者（複数選択）"
            values={csvToIdList(castIdsText)}
            placeholder="選択"
            options={castOptions}
            onChange={(ids: string[]) => setCastIdsText(ids.join(', '))}
            searchPlaceholder="出演者検索（名前 / ID）"
          />
          <MultiSelectField
            label="ジャンル（複数選択）"
            values={csvToIdList(genreIdsText)}
            placeholder="選択"
            options={genreOptions}
            onChange={(ids: string[]) => setGenreIdsText(ids.join(', '))}
            searchPlaceholder="ジャンル検索（名前 / ID）"
          />

          <View style={[styles.filterActions, { justifyContent: 'flex-start' }]}>
            <Pressable disabled={busy} onPress={onSaveMeta} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
              <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : 'このセクションを保存'}</Text>
            </Pressable>
          </View>
        </VideoDetailSection>

        <VideoDetailSection {...(sectionProps as any)}
          id="advanced"
          title="詳細設定（通常は触りません）"
          description="Stream Video ID や内部IDなど、必要なときだけ確認・編集します。"
          dirty={advancedDirty}
        >
          <View style={styles.field}>
            <Text style={styles.label}>動画ID（内部ID）</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Stream Video ID</Text>
            <Text style={styles.selectMenuDetailText}>通常は動画アップロードで自動設定されます</Text>
            <TextInput
              nativeID={`admin-video-${String(id || 'new')}-advanced-streamVideoId`}
              value={streamVideoId}
              onChangeText={setStreamVideoId}
              placeholder="32桁のID"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              autoCapitalize="none"
              onFocus={() => markActive('advanced')}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>字幕URL（旧）</Text>
            <Text style={styles.selectMenuDetailText}>現在は「Stream字幕（日本語）」の利用を推奨します</Text>
            <TextInput
              nativeID={`admin-video-${String(id || 'new')}-advanced-subtitleUrl`}
              value={subtitleUrl}
              onChangeText={setSubtitleUrl}
              style={styles.input}
              autoCapitalize="none"
              onFocus={() => markActive('advanced')}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>評価 / 再生 / コメント（参考）</Text>
            <Text style={styles.readonlyText}>{`${(Number(ratingAvg) || 0).toFixed(2)}（${Number(reviewCount) || 0}件） / 再生:${Number(playsCount) || 0} / コメント:${Number(commentsCount) || 0}`}</Text>
          </View>
          <View style={[styles.filterActions, { justifyContent: 'flex-start' }]}> 
            <Pressable disabled={busy} onPress={onSaveAdvanced} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
              <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : 'このセクションを保存'}</Text>
            </Pressable>
          </View>
        </VideoDetailSection>

        <VideoDetailSection {...(sectionProps as any)}
          id="reco"
          title={`この動画のおすすめ（${recommendations.length}件）`}
          description="視聴者に表示されるおすすめ動画の並び順を調整します。"
          dirty={recoDirty}
        >
          <View style={styles.field}>
            <Text style={styles.label}>検索して追加（メイン導線）</Text>
            <Text style={styles.selectMenuDetailText}>タイトル/作品名/IDで検索して、サムネとタイトルを見ながら複数選択できます。</Text>
            <View style={[styles.filterActions, { justifyContent: 'flex-start', marginTop: 8 }]}> 
              <Pressable
                disabled={recoSearchBusy}
                onPress={() => {
                  if (!recoSearchQ.trim()) {
                    try {
                      recoSearchInputRef.current?.focus?.()
                    } catch {
                      // ignore
                    }
                    return
                  }
                  onSearchReco()
                }}
                style={[styles.btnPrimary, recoSearchBusy ? styles.btnDisabled : null]}
              >
                <Text style={styles.btnPrimaryText}>{recoSearchBusy ? '検索中…' : '検索して追加'}</Text>
              </Pressable>
              {recoSearchSelectedIds.length ? (
                <Pressable onPress={addSelectedReco} style={styles.btnSecondary}>
                  <Text style={styles.btnSecondaryText}>{`選択した${recoSearchSelectedIds.length}件を追加`}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={[styles.row, { marginTop: 10 }]}>
              <TextInput
                ref={recoSearchInputRef}
                nativeID={`admin-video-${String(id || 'new')}-reco-search`}
                value={recoSearchQ}
                onChangeText={(v) => {
                  setRecoSearchQ(v)
                  if (!String(v || '').trim()) {
                    setRecoSearchRows([])
                    setRecoSearchSelectedIds([])
                  }
                }}
                style={[styles.input, { flex: 1 }]}
                placeholder="タイトル/作品/ID"
                placeholderTextColor={COLORS.placeholder}
                autoCapitalize="none"
              />
              <Pressable
                disabled={recoSearchBusy}
                onPress={onSearchReco}
                style={[styles.smallBtnPrimary, recoSearchBusy ? styles.btnDisabled : null]}
              >
                <Text style={styles.smallBtnPrimaryText}>{recoSearchBusy ? '検索中…' : '検索'}</Text>
              </Pressable>
            </View>

            {recoSearchRows.length ? (
              <View style={[styles.table, { marginTop: 10 }]}>
                {recoSearchRows
                  .filter((v) => String(v.id || '').trim() && String(v.id || '').trim() !== String(id || '').trim())
                  .map((v) => {
                    const selected = recoSearchSelectedIds.includes(v.id)
                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => toggleRecoSearchSelect(v.id)}
                        style={[
                          styles.tableRow,
                          selected ? ({ backgroundColor: '#ecfdf5' } as any) : null,
                          Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          {v.thumbnailUrl ? (
                            <Image
                              source={{ uri: v.thumbnailUrl }}
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
                            <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                            <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : ''}`}</Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
                          <Text style={{ color: selected ? '#047857' : '#6b7280', fontWeight: '900' }}>{selected ? '✓ 選択' : '未選択'}</Text>
                          {onOpenVideo ? (
                            <Pressable onPress={() => onOpenVideo(v.id)} style={[styles.smallBtn, { marginTop: 6 }]}>
                              <Text style={styles.smallBtnText}>詳細</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </Pressable>
                    )
                  })}
              </View>
            ) : null}
          </View>

          <CollapsibleSection
            title="上級者向け: 動画IDで追加"
            subtitle="基本は「検索して追加」を使ってください"
            open={openRecoAdvanced}
            onToggle={() => setOpenRecoAdvanced((v) => !v)}
          >
            <View style={styles.field}>
              <Text style={styles.label}>動画ID</Text>
              <View style={styles.row}>
                <TextInput
                  nativeID={`admin-video-${String(id || 'new')}-reco-manual-id`}
                  value={manualRecoVideoId}
                  onChangeText={setManualRecoVideoId}
                  style={[styles.input, { flex: 1 }]}
                  autoCapitalize="none"
                  placeholder="動画ID"
                  placeholderTextColor={COLORS.placeholder}
                />
                <Pressable
                  onPress={() => {
                    const vid = manualRecoVideoId.trim()
                    if (!vid) return
                    addReco({ id: vid, title: '', workTitle: '', thumbnailUrl: '' })
                    setManualRecoVideoId('')
                  }}
                  style={styles.smallBtnPrimary}
                >
                  <Text style={styles.smallBtnPrimaryText}>追加</Text>
                </Pressable>
              </View>
            </View>
          </CollapsibleSection>

          <View style={styles.table}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
              <Text style={styles.tableDetail}>チェックを外したおすすめは「OK」で削除扱いになります（削除ボタンはありません）</Text>
              <View style={[styles.filterActions, { justifyContent: 'flex-start', marginTop: 8 }]}> 
                <Pressable onPress={() => setRecoCheckedIds(recommendations.map((v) => v.id))} style={styles.btnSecondary}>
                  <Text style={styles.btnSecondaryText}>全てチェック</Text>
                </Pressable>
                <Pressable onPress={() => setRecoCheckedIds([])} style={styles.btnSecondary}>
                  <Text style={styles.btnSecondaryText}>全て外す</Text>
                </Pressable>
                <Pressable onPress={applyRecoChecked} style={styles.btnPrimary}>
                  <Text style={styles.btnPrimaryText}>OK</Text>
                </Pressable>
              </View>
            </View>
            {recommendations.map((v, idx) => (
              <View key={v.id} style={styles.tableRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <Pressable
                    onPress={() => toggleRecoChecked(v.id)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: '#94a3b8',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: recoCheckedIds.includes(v.id) ? '#ecfdf5' : '#ffffff',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '900',
                        color: recoCheckedIds.includes(v.id) ? '#047857' : '#ffffff',
                      }}
                    >
                      ✓
                    </Text>
                  </Pressable>
                  {v.thumbnailUrl ? (
                    <Image
                      source={{ uri: v.thumbnailUrl }}
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

                  {onOpenVideo ? (
                    <Pressable onPress={() => onOpenVideo(v.id)} style={styles.tableLeft}>
                      <Text style={styles.tableLabel}>{`${idx + 1}. ${v.title || v.id}`}</Text>
                      <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : ''}`}</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.tableLeft}>
                      <Text style={styles.tableLabel}>{`${idx + 1}. ${v.title || v.id}`}</Text>
                      <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : ''}`}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.row}>
                  <Pressable onPress={() => moveReco(v.id, -1)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>↑</Text>
                  </Pressable>
                  <Pressable onPress={() => moveReco(v.id, 1)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>↓</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {!recommendations.length ? (
              <View style={styles.placeholderBox}>
                <Text style={[styles.placeholderText, { fontWeight: '900' }]}>おすすめがありません</Text>
                <Text style={[styles.selectMenuDetailText, { marginTop: 6 }]}>視聴者に表示するおすすめ動画を、検索から追加できます（複数選択可）。</Text>
                <View style={[styles.filterActions, { justifyContent: 'center', marginTop: 10 }]}> 
                  <Pressable
                    onPress={() => {
                      try {
                        recoSearchInputRef.current?.focus?.()
                      } catch {
                        // ignore
                      }
                    }}
                    style={styles.btnPrimary}
                  >
                    <Text style={styles.btnPrimaryText}>検索して追加</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          <View style={[styles.filterActions, { justifyContent: 'flex-start' }]}>
            <Pressable disabled={busy} onPress={onSaveReco} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
              <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : 'このセクションを保存'}</Text>
            </Pressable>
          </View>
        </VideoDetailSection>
      </ScrollView>

      {Platform.OS === 'web' ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            backgroundColor: 'rgba(255,255,255,0.98)',
          }}
        >
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' } as any}>
            <Pressable disabled={busy} onPress={onSaveAll} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
              <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : 'すべて保存'}</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => {
                scrollToSection('replace')
              }}
              style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}
            >
              <Text style={styles.btnSecondaryText}>動画ファイルを差し替え</Text>
            </Pressable>
            {onGoComments && workId && id ? (
              <Pressable
                disabled={busy}
                onPress={() => onGoComments(workId, id)}
                style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}
              >
                <Text style={styles.btnSecondaryText}>コメント一覧へ</Text>
              </Pressable>
            ) : null}
            {savedFlash?.section === 'all' && Date.now() - Number(savedFlash?.at ?? 0) < 1800 ? (
              <Text style={{ color: '#047857', fontSize: 12, fontWeight: '800' }}>保存しました</Text>
            ) : null}
            {basicsDirty ? <Text style={{ color: '#b45309', fontSize: 12 }}>表示 未保存</Text> : null}
            {publishDirty ? <Text style={{ color: '#b45309', fontSize: 12 }}>公開 未保存</Text> : null}
            {metaDirty ? <Text style={{ color: '#b45309', fontSize: 12 }}>分類 未保存</Text> : null}
            {advancedDirty ? <Text style={{ color: '#b45309', fontSize: 12 }}>詳細 未保存</Text> : null}
            {recoDirty ? <Text style={{ color: '#b45309', fontSize: 12 }}>おすすめ 未保存</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  )
}

export function VideoUploadScreen({
  cfg,
  cmsFetchJson,
  cmsFetchJsonWithBase,
  csvToIdList,
  tus,
  styles,
  SelectField,
  MultiSelectField,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  cmsFetchJsonWithBase: CmsFetchJsonWithBase
  csvToIdList: (csv: string) => string[]
  tus: any
  styles: any
  SelectField: SelectFieldComponent
  MultiSelectField: MultiSelectFieldComponent
  onBack: () => void
}) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [workId, setWorkId] = useState('')
  const [streamVideoId, setStreamVideoId] = useState('')
  const [streamVideoIdClean, setStreamVideoIdClean] = useState('')
  const [streamVideoIdSubtitled, setStreamVideoIdSubtitled] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [episodeNoText, setEpisodeNoText] = useState('')
  const [publish, setPublish] = useState(false)

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadState, setUploadState] = useState<'idle' | 'creating' | 'uploading' | 'done' | 'error'>('idle')
  const uploadRef = useRef<any>(null)

  const [streamProbe, setStreamProbe] = useState<{
    loading: boolean
    configured: boolean | null
    readyToStream: boolean | null
    status: string | null
    error: string | null
  }>({ loading: false, configured: null, readyToStream: null, status: null, error: null })

  const [categoryIdsText, setCategoryIdsText] = useState('')
  const [tagIdsText, setTagIdsText] = useState('')
  const [castIdsText, setCastIdsText] = useState('')
  const [genreIdsText, setGenreIdsText] = useState('')

  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  const [workOptions, setWorkOptions] = useState<Array<{ label: string; value: string }>>([])
  const [categoryOptions, setCategoryOptions] = useState<MultiSelectOption[]>([])
  const [tagOptions, setTagOptions] = useState<MultiSelectOption[]>([])
  const [castOptions, setCastOptions] = useState<MultiSelectOption[]>([])
  const [genreOptions, setGenreOptions] = useState<MultiSelectOption[]>([])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<{ id: string; title: string }> }>(cfg, '/cms/works')
        if (!mounted) return
        setWorkOptions(json.items.map((w) => ({ label: w.title || w.id, value: w.id })))
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg, cmsFetchJson])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const [catsJson, tagsJson, castsJson, genresJson] = await Promise.all([
          cmsFetchJson<{ items: Array<{ id: string; name: string; enabled?: boolean }> }>(cfg, '/cms/categories'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/tags'),
          cmsFetchJson<{ items: Array<{ id: string; name: string; role?: string }> }>(cfg, '/cms/casts'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/genres'),
        ])
        if (!mounted) return
        setCategoryOptions(
          (catsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.enabled === false ? ' / 無効' : ''}`,
          }))
        )
        setTagOptions(
          (tagsJson.items ?? []).map((t) => ({
            value: String(t.id ?? ''),
            label: String(t.name ?? '') || String(t.id ?? ''),
            detail: String(t.id ?? ''),
          }))
        )
        setCastOptions(
          (castsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${String(c.id ?? '')}${c.role ? ` / ${String(c.role)}` : ''}`,
          }))
        )
        setGenreOptions(
          (genresJson.items ?? []).map((g) => ({
            value: String(g.id ?? ''),
            label: String(g.name ?? '') || String(g.id ?? ''),
            detail: String(g.id ?? ''),
          }))
        )
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg, cmsFetchJson])

  const onCreate = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, '/cms/videos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workId,
            title,
            description: desc,
            streamVideoId,
            streamVideoIdClean,
            streamVideoIdSubtitled,
            thumbnailUrl,
            published: publish,
            episodeNo: episodeNoText.trim() ? Number(episodeNoText) : null,
            categoryIds: csvToIdList(categoryIdsText),
            tagIds: csvToIdList(tagIdsText),
            castIds: csvToIdList(castIdsText),
            genreIds: csvToIdList(genreIdsText),
          }),
        })
        setBanner('登録しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [
    castIdsText,
    categoryIdsText,
    cfg,
    cmsFetchJson,
    csvToIdList,
    desc,
    episodeNoText,
    genreIdsText,
    publish,
    streamVideoId,
    streamVideoIdClean,
    streamVideoIdSubtitled,
    tagIdsText,
    thumbnailUrl,
    title,
    workId,
  ])

  const stopUpload = useCallback(() => {
    try {
      if (uploadRef.current && typeof uploadRef.current.abort === 'function') {
        uploadRef.current.abort(true)
      }
    } catch {
      // ignore
    }
    uploadRef.current = null
    setUploadState('idle')
    setUploadPct(0)
    setBanner('アップロードを中止しました')
  }, [setBanner])

  const uploadThumbnail = useCallback(() => {
    if (Platform.OS !== 'web') {
      setBanner('サムネイル画像アップロードはWeb版管理画面のみ対応です')
      return
    }
    if (!thumbnailFile) {
      setBanner('画像ファイルを選択してください')
      return
    }

    setThumbnailUploading(true)
    setBanner('画像アップロード中…')
    void (async () => {
      try {
        const res = await cmsFetchJsonWithBase<{ error: string | null; data: { fileId: string; url: string } | null }>(
          cfg,
          cfg.uploaderBase,
          '/cms/images',
          {
            method: 'PUT',
            headers: {
              'content-type': thumbnailFile.type || 'application/octet-stream',
            },
            body: thumbnailFile,
          }
        )

        if (res.error || !res.data?.url) {
          throw new Error(res.error || '画像アップロードに失敗しました')
        }

        setThumbnailUrl(res.data.url)
        setBanner('画像アップロード完了')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setThumbnailUploading(false)
      }
    })()
  }, [cfg, cmsFetchJsonWithBase, setBanner, thumbnailFile])

  const startStreamUpload = useCallback(() => {
    if (Platform.OS !== 'web') {
      setUploadState('error')
      setBanner('アップロードはWeb版管理画面のみ対応です')
      return
    }
    if (!uploadFile) {
      setUploadState('error')
      setBanner('動画ファイルを選択してください')
      return
    }
    if (!tus) {
      setUploadState('error')
      setBanner('tus uploader が初期化できませんでした')
      return
    }

    const maxBytes = 30 * 1024 * 1024 * 1024
    if (typeof uploadFile.size === 'number' && uploadFile.size > maxBytes) {
      setUploadState('error')
      setBanner('ファイルが大きすぎます（最大30GB）')
      return
    }

    setUploadState('creating')
    setUploadPct(0)
    setBanner('アップロードURL発行中…')

    void (async () => {
      try {
        const tusEndpoint = new URL('/cms/stream/tus', cfg.uploaderBase).toString()
        const uploaderBase = String(cfg.uploaderBase || '').replace(/\/$/, '')
        let createdUid = ''

        setUploadState('uploading')
        setBanner('アップロード開始中…')

        const uploader = new tus.Upload(uploadFile, {
          endpoint: tusEndpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          // Smaller chunks are more reliable (less likely to hit proxy/body/time limits)
          // and also provide more frequent progress updates.
          chunkSize: 10 * 1024 * 1024,
          metadata: {
            filename: uploadFile.name,
            filetype: uploadFile.type || 'application/octet-stream',
          },
          onBeforeRequest: (req: any) => {
            // Only attach CMS token when calling our uploader Worker. Do not leak it to upload.cloudflarestream.com.
            try {
              const url = typeof req?.getURL === 'function' ? String(req.getURL() || '') : ''
              if (uploaderBase && url.startsWith(uploaderBase) && typeof req?.setHeader === 'function') {
                req.setHeader('Authorization', `Bearer ${cfg.token}`)
              }
            } catch {
              // ignore
            }
          },
          onAfterResponse: (_req: any, res: any) => {
            if (createdUid) return
            try {
              const getHeader = (name: string): string => {
                if (res && typeof res.getHeader === 'function') return String(res.getHeader(name) || '')
                if (res && typeof res.getResponseHeader === 'function') return String(res.getResponseHeader(name) || '')
                return ''
              }

              const mediaId = (getHeader('Stream-Media-ID') || getHeader('stream-media-id')).trim()
              const location = (getHeader('Location') || getHeader('location')).trim()

              const inferred = (() => {
                const m = (location || '').match(/\/([a-f0-9]{32})(?:\b|\/|$)/i)
                return m?.[1] || ''
              })()

              const uid = (mediaId || inferred).trim()
              if (uid) {
                createdUid = uid
                setStreamVideoId(uid)
              }
            } catch {
              // ignore
            }
          },
          onError: (err: any) => {
            setUploadState('error')
            try {
              const req = (err as any)?.originalRequest
              const status = typeof req?.getStatus === 'function' ? req.getStatus() : undefined
              const body = typeof req?.getResponseText === 'function' ? String(req.getResponseText() || '') : ''
              const base = err instanceof Error ? err.message : String(err)
              const extra = [status ? `status=${status}` : '', body ? body.slice(0, 300) : ''].filter(Boolean).join(' ')
              setBanner(extra ? `${base} (${extra})` : base)
            } catch {
              setBanner(err instanceof Error ? err.message : String(err))
            }
          },
          onShouldRetry: (_err: any, retryAttempt: number) => {
            if (retryAttempt >= 1) setBanner(`アップロードが失敗しました。再試行中…（${retryAttempt}回目）`)
            return true
          },
          onProgress: (bytesUploaded: number, bytesTotal: number) => {
            const pct = bytesTotal > 0 ? Math.floor((bytesUploaded / bytesTotal) * 100) : 0
            setUploadPct(pct)
          },
          onSuccess: () => {
            if (!createdUid) {
              try {
                const url = String((uploader as any).url || '').trim()
                const m = url.match(/\/([a-f0-9]{32})(?:\b|\/|$)/i)
                const uid = (m?.[1] || '').trim()
                if (uid) {
                  createdUid = uid
                  setStreamVideoId(uid)
                }
              } catch {
                // ignore
              }
            }
            setUploadState('done')
            setUploadPct(100)
            setBanner('アップロード完了（Stream側の処理が終わるまで少し待つ場合があります）')
          },
        })

        uploadRef.current = uploader
        uploader.start()
      } catch (e) {
        setUploadState('error')
        setBanner(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [cfg, setBanner, tus, uploadFile])

  useEffect(() => {
    if (!streamVideoId.trim()) {
      setStreamProbe({ loading: false, configured: null, readyToStream: null, status: null, error: null })
      return
    }

    // Only auto-poll after a fresh upload succeeded.
    if (uploadState !== 'done') return

    let cancelled = false
    let timer: any = null
    const startedAt = Date.now()

    const tick = async () => {
      if (cancelled) return
      setStreamProbe((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const json = await cmsFetchJson<{
          configured?: boolean
          readyToStream?: boolean | null
          status?: string | null
        }>(cfg, `/v1/stream/playback/${encodeURIComponent(streamVideoId.trim())}`)

        if (cancelled) return
        const configured = json.configured !== undefined ? Boolean(json.configured) : true
        const readyToStream = json.readyToStream === null || json.readyToStream === undefined ? null : Boolean(json.readyToStream)
        const status = json.status === null || json.status === undefined ? null : String(json.status)

        setStreamProbe({ loading: false, configured, readyToStream, status, error: null })

        // Stop polling once the video is ready.
        if (readyToStream === true) return
      } catch (e) {
        if (cancelled) return
        setStreamProbe((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }))
      }

      // Avoid polling forever.
      if (Date.now() - startedAt > 30 * 60 * 1000) return

      timer = setTimeout(tick, 5000)
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [cfg, cmsFetchJson, streamVideoId, uploadState])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>動画アップロード</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>入力</Text>
        <SelectField label="作品" value={workId} placeholder="選択" options={workOptions} onChange={setWorkId} />

        <View style={styles.field}>
          <Text style={styles.label}>Cloudflare Streamへアップロード（最大30GB）</Text>
          {Platform.OS === 'web' ? (
            <View>
              <View style={{ marginTop: 6 }}>
                <WebDropZone
                  title="動画ファイルを選択"
                  hint="ドラッグ&ドロップ対応（最大30GB）"
                  accept="video/*"
                  multiple={false}
                  onFiles={(files) => {
                    const f = files?.[0] ?? null
                    if (!f) return
                    setUploadFile(f)
                    setUploadPct(0)
                    setUploadState('idle')
                    setBanner('')
                  }}
                />
              </View>

              {uploadFile ? (
                <Text style={[styles.selectMenuDetailText, { marginTop: 6 }]}>
                  {`選択: ${uploadFile.name} / ${(uploadFile.size / (1024 * 1024)).toFixed(1)}MB`}
                </Text>
              ) : (
                <Text style={[styles.selectMenuDetailText, { marginTop: 6 }]}>動画ファイルを選択してください</Text>
              )}

              <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                <Pressable
                  disabled={uploadState === 'creating' || uploadState === 'uploading' || !uploadFile}
                  onPress={startStreamUpload}
                  style={[
                    styles.btnSecondary,
                    uploadState === 'creating' || uploadState === 'uploading' || !uploadFile ? styles.btnDisabled : null,
                  ]}
                >
                  <Text style={styles.btnSecondaryText}>
                    {uploadState === 'creating'
                      ? 'URL発行中…'
                      : uploadState === 'uploading'
                        ? `アップロード中… ${uploadPct}%`
                        : uploadState === 'done'
                          ? '再アップロード'
                          : 'アップロード開始'}
                  </Text>
                </Pressable>
                {uploadState === 'uploading' ? (
                  <Pressable onPress={stopUpload} style={styles.btnSecondary}>
                    <Text style={styles.btnSecondaryText}>中止</Text>
                  </Pressable>
                ) : null}
              </View>

              {uploadState === 'uploading' || uploadState === 'done' ? (
                <View style={styles.uploadBarOuter}>
                  <View style={[styles.uploadBarInner, { width: `${Math.min(100, Math.max(0, uploadPct))}%` }]} />
                </View>
              ) : null}

              {streamVideoId ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.selectMenuDetailText}>{`Stream Video ID: ${streamVideoId}`}</Text>
                  {uploadState === 'done' ? (
                    <Text style={[styles.selectMenuDetailText, { marginTop: 4 }]}>
                      {streamProbe.loading
                        ? 'Stream状況確認中…'
                        : streamProbe.error
                          ? `Stream状況取得エラー: ${streamProbe.error}`
                          : streamProbe.configured === false
                            ? 'Stream設定が未構成の可能性があります'
                            : streamProbe.readyToStream === true
                              ? 'エンコード完了（再生可能）'
                              : 'エンコード中…（しばらく待ってください）'}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.selectMenuDetailText}>Web版管理画面でアップロードできます</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>タイトル</Text>
          <TextInput nativeID="admin-video-upload-title" value={title} onChangeText={setTitle} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <TextInput nativeID="admin-video-upload-desc" value={desc} onChangeText={setDesc} style={[styles.input, { minHeight: 110 }]} multiline />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID</Text>
          <TextInput
            nativeID="admin-video-upload-streamVideoId"
            value={streamVideoId}
            onChangeText={setStreamVideoId}
            placeholder="Cloudflare Stream の videoId"
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            autoCapitalize="none"
          />
        </View>

        <StreamCaptionsPanel cfg={cfg as unknown as CmsApiConfig} streamVideoId={streamVideoId} />
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID（クリーン）</Text>
          <TextInput nativeID="admin-video-upload-streamVideoIdClean" value={streamVideoIdClean} onChangeText={setStreamVideoIdClean} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID（字幕）</Text>
          <TextInput
            nativeID="admin-video-upload-streamVideoIdSubtitled"
            value={streamVideoIdSubtitled}
            onChangeText={setStreamVideoIdSubtitled}
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネURL</Text>
          <Text style={styles.selectMenuDetailText}>推奨サイズ: 16:9（例: 1280×720）</Text>
          {Platform.OS === 'web' ? (
            <View style={{ marginTop: 6 }}>
              <WebDropZone
                title="サムネ画像を追加"
                hint="16:9 推奨（例: 1280×720）"
                accept="image/png,image/jpeg,image/webp"
                multiple={false}
                onFiles={(files) => {
                  const f = files?.[0] ?? null
                  if (!f) return
                  setThumbnailFile(f)
                  setBanner('')
                }}
              />
              <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                <Pressable
                  disabled={thumbnailUploading || !thumbnailFile}
                  onPress={uploadThumbnail}
                  style={[styles.btnSecondary, thumbnailUploading || !thumbnailFile ? styles.btnDisabled : null]}
                >
                  <Text style={styles.btnSecondaryText}>{thumbnailUploading ? '画像アップロード中…' : '画像をアップロードしてURLに反映'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <TextInput
            nativeID="admin-video-upload-thumbnailUrl"
            value={thumbnailUrl}
            onChangeText={setThumbnailUrl}
            placeholder="https://..."
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>話数（episodeNo）</Text>
          <TextInput value={episodeNoText} onChangeText={setEpisodeNoText} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>公開（簡易）</Text>
          <Switch value={publish} onValueChange={setPublish} />
        </View>
        <MultiSelectField
          label="カテゴリ（複数選択）"
          values={csvToIdList(categoryIdsText)}
          placeholder="選択"
          options={categoryOptions}
          onChange={(ids: string[]) => setCategoryIdsText(ids.join(', '))}
          searchPlaceholder="カテゴリ検索（名前 / ID）"
        />
        <MultiSelectField
          label="タグ（複数選択）"
          values={csvToIdList(tagIdsText)}
          placeholder="選択"
          options={tagOptions}
          onChange={(ids: string[]) => setTagIdsText(ids.join(', '))}
          searchPlaceholder="タグ検索（名前 / ID）"
        />
        <MultiSelectField
          label="出演者（複数選択）"
          values={csvToIdList(castIdsText)}
          placeholder="選択"
          options={castOptions}
          onChange={(ids: string[]) => setCastIdsText(ids.join(', '))}
          searchPlaceholder="出演者検索（名前 / ID）"
        />
        <MultiSelectField
          label="ジャンル（複数選択）"
          values={csvToIdList(genreIdsText)}
          placeholder="選択"
          options={genreOptions}
          onChange={(ids: string[]) => setGenreIdsText(ids.join(', '))}
          searchPlaceholder="ジャンル検索（名前 / ID）"
        />
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onCreate} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '登録中…' : '登録'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}
