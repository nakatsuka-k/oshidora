import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { useBanner } from '../../lib/banner'
import { WebDropZone } from '../../ui/WebDropZone'

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
  onOpenDetail,
  onGoUpload,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  confirm: ConfirmFn
  styles: any
  SelectField: SelectFieldComponent
  onOpenDetail: (id: string) => void
  onGoUpload: () => void
}) {
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

  const [rows, setRows] = useState<VideoRow[]>([])
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>検索・絞り込み</Text>
        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>検索</Text>
            <TextInput value={qText} onChangeText={setQText} placeholder="タイトル / 説明 / 作品" style={styles.input} />
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

          <View style={styles.field}>
            <Text style={styles.label}>登録日（開始）</Text>
            <TextInput value={qFrom} onChangeText={setQFrom} placeholder="YYYY-MM-DD" style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>登録日（終了）</Text>
            <TextInput value={qTo} onChangeText={setQTo} placeholder="YYYY-MM-DD" style={styles.input} />
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>動画一覧</Text>
        <ScrollView horizontal style={styles.tableScroll}>
          <View style={styles.videoTable}>
            <View style={[styles.videoRow, styles.videoHeaderRow]}>
              {[
                '操作',
                'サムネイル',
                '動画タイトル',
                '作品名',
                '話数',
                '字幕',
                '公開状態',
                '評価',
                '登録日',
                '削除',
              ].map((h) => (
                <Text key={h} style={[styles.videoCell, styles.videoHeaderCell]}>
                  {h}
                </Text>
              ))}
            </View>

            {pageRows.map((r) => (
              <View key={r.id} style={[styles.videoRow, r.status === '非公開' ? styles.videoRowDim : null]}>
                <View style={[styles.videoCell, styles.actionsCell]}>
                  <Pressable onPress={() => onOpenDetail(r.id)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>詳細</Text>
                  </Pressable>
                  <Pressable onPress={() => onOpenDetail(r.id)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>編集</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void togglePublish(r.id)}
                    style={[styles.smallBtnPrimary, busy ? styles.btnDisabled : null]}
                  >
                    <Text style={styles.smallBtnPrimaryText}>{r.status === '公開' ? '非公開' : '公開'}</Text>
                  </Pressable>
                </View>
                <View style={styles.videoCell}>
                  {r.thumbnailUrl ? <Image source={{ uri: r.thumbnailUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
                </View>
                <Text style={styles.videoCell}>{r.title}</Text>
                <Text style={styles.videoCell}>{r.workName}</Text>
                <Text style={styles.videoCell}>{r.episodeLabel}</Text>
                <Text style={styles.videoCell}>{r.subtitles}</Text>
                <Text style={styles.videoCell}>{r.status}</Text>
                <Text style={styles.videoCell}>{`${r.rating.toFixed(1)} (${r.reviewCount})`}</Text>
                <Text style={styles.videoCell}>{r.createdAt}</Text>
                <View style={[styles.videoCell, styles.actionsCell]}>
                  <Pressable
                    disabled={busy}
                    onPress={() => void deleteVideo(r.id)}
                    style={[styles.smallBtnDanger, busy ? styles.btnDisabled : null]}
                  >
                    <Text style={styles.smallBtnDangerText}>削除</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.pagination}>
          <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))} style={styles.pageBtn}>
            <Text style={styles.pageBtnText}>前へ</Text>
          </Pressable>
          <View style={styles.pageJump}>
            <Text style={styles.pageInfo}>{`Page`}</Text>
            <TextInput
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
      </View>
    </ScrollView>
  )
}

export function VideoDetailScreen({
  cfg,
  cmsFetchJson,
  cmsFetchJsonWithBase,
  csvToIdList,
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

  const [recommendations, setRecommendations] = useState<
    Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string }>
  >([])
  const [recoSearchQ, setRecoSearchQ] = useState('')
  const [recoSearchBusy, setRecoSearchBusy] = useState(false)
  const [recoSearchRows, setRecoSearchRows] = useState<
    Array<{ id: string; title: string; workTitle: string; thumbnailUrl: string }>
  >([])
  const [manualRecoVideoId, setManualRecoVideoId] = useState('')

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
        setCategoryIdsText((json.item.categoryIds || []).join(', '))
        setTagIdsText((json.item.tagIds || []).join(', '))
        setCastIdsText((json.item.castIds || []).join(', '))

        setGenreIdsText(
          (((json.item as any).genreIds as any[]) ?? [])
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .join(', ')
        )

        setRatingAvg(Number((json.item as any).ratingAvg ?? 0) || 0)
        setReviewCount(Number((json.item as any).reviewCount ?? 0) || 0)
        setPlaysCount(Number((json as any).stats?.playsCount ?? 0) || 0)
        setCommentsCount(Number((json as any).stats?.commentsCount ?? 0) || 0)
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

  useEffect(() => {
    if (!id) return
    let mounted = true
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/videos/${encodeURIComponent(id)}/recommendations`)
        if (!mounted) return
        setRecommendations(
          (json.items ?? []).map((r) => ({
            id: String(r.id ?? ''),
            title: String(r.title ?? ''),
            workTitle: String(r.workTitle ?? ''),
            thumbnailUrl: String(r.thumbnailUrl ?? ''),
          }))
        )
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg, cmsFetchJson, id])

  const onSave = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workId,
            title,
            description: desc,
            streamVideoId,
            subtitleUrl,
            thumbnailUrl,
            scheduledAt,
            episodeNo: episodeNoText.trim() ? Number(episodeNoText) : null,
            published,
            categoryIds: csvToIdList(categoryIdsText),
            tagIds: csvToIdList(tagIdsText),
            castIds: csvToIdList(castIdsText),
            genreIds: csvToIdList(genreIdsText),
          }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [castIdsText, categoryIdsText, cfg, cmsFetchJson, desc, episodeNoText, genreIdsText, id, published, scheduledAt, streamVideoId, subtitleUrl, tagIdsText, thumbnailUrl, title, workId, csvToIdList])

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
        setBanner('画像アップロード完了')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setThumbnailUploading(false)
      }
    })()
  }, [cfg, cmsFetchJsonWithBase, setBanner, thumbnailFile])

  const [subtitleFile, setSubtitleFile] = useState<File | null>(null)
  const [subtitleUploading, setSubtitleUploading] = useState(false)
  const uploadSubtitle = useCallback((file?: File | null) => {
    if (Platform.OS !== 'web') {
      setBanner('字幕ファイルアップロードはWeb版管理画面のみ対応です')
      return
    }
    const f = file ?? subtitleFile
    if (!f) {
      setBanner('字幕ファイル（.vtt）を選択してください')
      return
    }

    const name = String(f.name || '').toLowerCase()
    if (!name.endsWith('.vtt')) {
      setBanner('WebVTT（.vtt）ファイルを選択してください')
      return
    }

    setSubtitleUploading(true)
    setBanner('字幕ファイルアップロード中…')
    void (async () => {
      try {
        const res = await cmsFetchJsonWithBase<{ error: string | null; data: { fileId: string; url: string } | null }>(
          cfg,
          cfg.uploaderBase,
          '/cms/files',
          {
            method: 'PUT',
            headers: {
              'content-type': f.type || 'text/vtt',
            },
            body: f,
          }
        )

        if (res.error || !res.data?.url) {
          throw new Error(res.error || '字幕ファイルアップロードに失敗しました')
        }

        setSubtitleUrl(res.data.url)
        setBanner('字幕ファイルアップロード完了')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setSubtitleUploading(false)
      }
    })()
  }, [cfg, cmsFetchJsonWithBase, setBanner, subtitleFile])

  const [playback, setPlayback] = useState<{
    loading: boolean
    iframeUrl: string
    mp4Url: string
    hlsUrl: string
    error: string
  }>({ loading: false, iframeUrl: '', mp4Url: '', hlsUrl: '', error: '' })

  useEffect(() => {
    const vid = String(streamVideoId || '').trim()
    if (!vid) {
      setPlayback({ loading: false, iframeUrl: '', mp4Url: '', hlsUrl: '', error: '' })
      return
    }
    let cancelled = false
    setPlayback((p) => ({ ...p, loading: true, error: '' }))
    void (async () => {
      try {
        const json = await cmsFetchJson<any>(cfg, `/v1/stream/playback/${encodeURIComponent(vid)}`)
        if (cancelled) return
        setPlayback({
          loading: false,
          iframeUrl: String(json?.iframeUrl ?? ''),
          mp4Url: String(json?.mp4Url ?? ''),
          hlsUrl: String(json?.hlsUrl ?? ''),
          error: '',
        })
      } catch (e) {
        if (cancelled) return
        setPlayback({ loading: false, iframeUrl: '', mp4Url: '', hlsUrl: '', error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cfg, cmsFetchJson, streamVideoId])

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
  }, [])

  const onSearchReco = useCallback(() => {
    const q = recoSearchQ.trim()
    if (!q) {
      setRecoSearchRows([])
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
      } catch {
        // ignore
      } finally {
        setRecoSearchBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, recoSearchQ])

  const onSaveReco = useCallback(() => {
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/${encodeURIComponent(id)}/recommendations`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ videoIds: recommendations.map((v) => v.id) }),
        })
        setBanner('おすすめを保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, id, recommendations])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>動画詳細・編集</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        <View style={styles.field}>
          <Text style={styles.label}>動画ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>評価</Text>
          <Text style={styles.readonlyText}>{`${(Number(ratingAvg) || 0).toFixed(2)}（${Number(reviewCount) || 0}件） / 再生:${Number(playsCount) || 0} / コメント:${Number(commentsCount) || 0}`}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>プレビュー</Text>
          {Platform.OS === 'web' ? (
            <View>
              {playback.loading ? <Text style={styles.selectMenuDetailText}>再生情報取得中…</Text> : null}
              {playback.error ? <Text style={styles.selectMenuDetailText}>{`再生情報エラー: ${playback.error}`}</Text> : null}
              {playback.mp4Url ? (
                <View style={{ marginTop: 8 }}>
                  <video style={{ width: '100%', maxWidth: 720, backgroundColor: '#111', borderRadius: 10 }} controls preload="metadata">
                    <source src={playback.mp4Url} type="video/mp4" />
                    {subtitleUrl.trim() ? <track src={subtitleUrl.trim()} kind="subtitles" srcLang="ja" label="日本語" default /> : null}
                  </video>
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
        <SelectField label="作品" value={workId} placeholder="選択" options={workOptions} onChange={setWorkId} />
        <View style={styles.field}>
          <Text style={styles.label}>タイトル</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <TextInput value={desc} onChangeText={setDesc} style={[styles.input, { minHeight: 110 }]} multiline />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネURL</Text>
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>サムネイル</Text>
          {Platform.OS === 'web' ? (
            <View style={{ marginTop: 6 }}>
              <WebDropZone
                title="サムネ画像を差し替え"
                hint="16:9 推奨（例: 1280×720）"
                accept="image/png,image/jpeg,image/webp"
                multiple={false}
                onFiles={(files) => {
                  const f = files?.[0] ?? null
                  if (!f) return
                  setThumbnailFile(f)
                  uploadThumbnail(f)
                }}
              />
              <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                <Pressable
                  disabled={thumbnailUploading || !thumbnailFile}
                  onPress={() => uploadThumbnail()}
                  style={[styles.btnSecondary, thumbnailUploading || !thumbnailFile ? styles.btnDisabled : null]}
                >
                  <Text style={styles.btnSecondaryText}>{thumbnailUploading ? '画像アップロード中…' : '再アップロード'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
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

        <View style={styles.field}>
          <Text style={styles.label}>字幕ファイル（WebVTT）</Text>
          <Text style={styles.selectMenuDetailText}>字幕は .vtt ファイルをURLとして保持します</Text>
          {subtitleUrl.trim() ? (
            <Pressable
              onPress={() => {
                try {
                  const u = subtitleUrl.trim()
                  if (!u) return
                  ;(globalThis as any)?.window?.open?.(u, '_blank')
                } catch {
                  // ignore
                }
              }}
              style={{ marginTop: 6 }}
            >
              <Text style={styles.linkText}>{subtitleUrl.trim()}</Text>
            </Pressable>
          ) : (
            <Text style={[styles.selectMenuDetailText, { marginTop: 6 }]}>未設定</Text>
          )}

          {Platform.OS === 'web' ? (
            <View style={{ marginTop: 10 }}>
              <WebDropZone
                title="字幕ファイル（.vtt）を差し替え"
                hint="WebVTT（.vtt）"
                accept=".vtt,text/vtt"
                multiple={false}
                onFiles={(files) => {
                  const f = files?.[0] ?? null
                  if (!f) return
                  setSubtitleFile(f)
                  uploadSubtitle(f)
                }}
              />
              <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                <Pressable
                  disabled={subtitleUploading || !subtitleFile}
                  onPress={() => uploadSubtitle()}
                  style={[styles.btnSecondary, subtitleUploading || !subtitleFile ? styles.btnDisabled : null]}
                >
                  <Text style={styles.btnSecondaryText}>{subtitleUploading ? '字幕アップロード中…' : '再アップロード'}</Text>
                </Pressable>
                {subtitleUrl.trim() ? (
                  <Pressable
                    onPress={() => setSubtitleUrl('')}
                    style={styles.btnSecondary}
                  >
                    <Text style={styles.btnSecondaryText}>字幕URLをクリア</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>話数（episodeNo）</Text>
          <TextInput value={episodeNoText} onChangeText={setEpisodeNoText} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>配信予定日時（ISO文字列）</Text>
          <TextInput
            value={scheduledAt}
            onChangeText={setScheduledAt}
            placeholder="2026-01-15T20:00:00Z"
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>公開</Text>
          <Switch value={published} onValueChange={setPublished} />
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
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
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
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{`この動画のおすすめ（${recommendations.length}件）`}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>手動追加（動画ID）</Text>
          <View style={styles.row}>
            <TextInput
              value={manualRecoVideoId}
              onChangeText={setManualRecoVideoId}
              style={[styles.input, { flex: 1 }]}
              autoCapitalize="none"
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

        <View style={styles.field}>
          <Text style={styles.label}>検索して追加</Text>
          <View style={styles.row}>
            <TextInput
              value={recoSearchQ}
              onChangeText={setRecoSearchQ}
              style={[styles.input, { flex: 1 }]}
              placeholder="タイトル/作品/ID"
            />
            <Pressable
              disabled={recoSearchBusy}
              onPress={onSearchReco}
              style={[styles.smallBtn, recoSearchBusy ? styles.btnDisabled : null]}
            >
              <Text style={styles.smallBtnText}>{recoSearchBusy ? '検索中…' : '検索'}</Text>
            </Pressable>
          </View>
          {recoSearchRows.length ? (
            <View style={styles.table}>
              {recoSearchRows.map((v) => (
                <View key={v.id} style={styles.tableRow}>
                  {onOpenVideo ? (
                    <Pressable onPress={() => onOpenVideo(v.id)} style={styles.tableLeft}>
                      <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                      <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : ''}`}</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.tableLeft}>
                      <Text style={styles.tableLabel}>{v.title || v.id}</Text>
                      <Text style={styles.tableDetail}>{`${v.id}${v.workTitle ? ` / ${v.workTitle}` : ''}`}</Text>
                    </View>
                  )}
                  <Pressable onPress={() => addReco(v)} style={styles.smallBtnPrimary}>
                    <Text style={styles.smallBtnPrimaryText}>追加</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.table}>
          {recommendations.map((v, idx) => (
            <View key={v.id} style={styles.tableRow}>
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
              <View style={styles.row}>
                <Pressable onPress={() => moveReco(v.id, -1)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>↑</Text>
                </Pressable>
                <Pressable onPress={() => moveReco(v.id, 1)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>↓</Text>
                </Pressable>
                <Pressable onPress={() => removeReco(v.id)} style={styles.smallBtnDanger}>
                  <Text style={styles.smallBtnDangerText}>削除</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!recommendations.length ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>おすすめがありません</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSaveReco} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : 'おすすめ保存'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
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
          chunkSize: 50 * 1024 * 1024,
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
                const m = (location || '').match(/\/stream\/([a-f0-9]{32})/i)
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
            setBanner(err instanceof Error ? err.message : String(err))
          },
          onProgress: (bytesUploaded: number, bytesTotal: number) => {
            const pct = bytesTotal > 0 ? Math.floor((bytesUploaded / bytesTotal) * 100) : 0
            setUploadPct(pct)
          },
          onSuccess: () => {
            if (!createdUid) {
              try {
                const url = String((uploader as any).url || '').trim()
                const m = url.match(/\/stream\/([a-f0-9]{32})/i)
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
                              : streamProbe.status
                                ? `エンコード中…（status: ${streamProbe.status}）`
                                : 'エンコード中…'}
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
          <TextInput value={title} onChangeText={setTitle} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <TextInput value={desc} onChangeText={setDesc} style={[styles.input, { minHeight: 110 }]} multiline />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID</Text>
          <TextInput
            value={streamVideoId}
            onChangeText={setStreamVideoId}
            placeholder="Cloudflare Stream の videoId"
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID（クリーン）</Text>
          <TextInput value={streamVideoIdClean} onChangeText={setStreamVideoIdClean} style={styles.input} autoCapitalize="none" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stream Video ID（字幕）</Text>
          <TextInput
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
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://..." style={styles.input} autoCapitalize="none" />
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
