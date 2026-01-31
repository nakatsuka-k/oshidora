import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { COLORS } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { CollapsibleSection } from '../../ui/CollapsibleSection'
import { WebDropZone } from '../../ui/WebDropZone'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
}

type CmsFetchJson = <T = any>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

type CmsFetchJsonWithBase = <T = any>(cfg: CmsApiConfig, baseUrl: string, path: string, init?: RequestInit) => Promise<T>

type CsvToIdListFn = (csv: string) => string[]

type MultiSelectOption = { value: string; label: string; detail?: string }

type MultiSelectFieldComponent = (props: any) => any

type ConfirmOptions = {
  title?: string
  okText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>

type WorkRow = {
  id: string
  title: string
  published: boolean
  thumbnailUrl?: string
  updatedAt?: string
  createdAt?: string
}

function formatYmd(isoLike: string | undefined): string {
  if (!isoLike) return '—'
  const d = new Date(isoLike)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function WorksListScreen({
  cfg,
  cmsFetchJson,
  confirm,
  styles,
  onOpenPreview,
  onOpenEdit,
  onNew,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  confirm?: ConfirmFn
  styles: any
  onOpenPreview: (id: string) => void
  onOpenEdit: (id: string) => void
  onNew: () => void
}) {
  const [rows, setRows] = useState<WorkRow[]>([])
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()
  const [openControls, setOpenControls] = useState(true)
  const [openList, setOpenList] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'updated_desc' | 'created_desc' | 'published_first'>('updated_desc')

  const [detailRequested, setDetailRequested] = useState<Record<string, true>>({})

  const [rowBusy, setRowBusy] = useState<{ id: string; action: 'publish' | 'unpublish' } | null>(null)
  const [reloadSeq, setReloadSeq] = useState(0)

  const runConfirm = useCallback(
    async (message: string, options: ConfirmOptions): Promise<boolean> => {
      try {
        if (confirm) return await confirm(message, options)
      } catch {
        // fallback below
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
        return window.confirm(message)
      }
      return true
    },
    [confirm]
  )

  const reload = useCallback(() => {
    setReloadSeq((v) => v + 1)
  }, [])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{
          items: Array<{
            id: string
            title: string
            published: boolean
            thumbnailUrl?: string
            updatedAt?: string
            createdAt?: string
          }>
        }>(cfg, '/cms/works')
        if (!mounted) return
        setRows(
          (json.items ?? []).map((w) => ({
            id: String(w.id),
            title: String(w.title ?? ''),
            published: Boolean(w.published),
            thumbnailUrl: w.thumbnailUrl ? String(w.thumbnailUrl) : '',
            updatedAt: w.updatedAt ? String(w.updatedAt) : '',
            createdAt: w.createdAt ? String(w.createdAt) : '',
          }))
        )
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
  }, [cfg, cmsFetchJson, reloadSeq, setBanner])

  const visibleRows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let next = rows
    if (needle) {
      next = next.filter((r) => `${r.title} ${r.id}`.toLowerCase().includes(needle))
    }

    const sorted = [...next]
    if (sort === 'updated_desc') {
      sorted.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    } else if (sort === 'created_desc') {
      sorted.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    } else if (sort === 'published_first') {
      sorted.sort((a, b) => Number(Boolean(b.published)) - Number(Boolean(a.published)))
    }
    return sorted
  }, [q, rows, sort])

  const visibleCounts = useMemo(() => {
    let publishedCount = 0
    let unpublishedCount = 0
    for (const r of visibleRows) {
      if (r.published) publishedCount += 1
      else unpublishedCount += 1
    }
    return {
      total: visibleRows.length,
      published: publishedCount,
      unpublished: unpublishedCount,
    }
  }, [visibleRows])

  useEffect(() => {
    if (busy) return
    if (visibleRows.length === 0) return

    const needIds = visibleRows
      .filter((r) => {
        if (detailRequested[r.id]) return false
        const missingThumb = !String(r.thumbnailUrl || '').trim()
        const missingUpdated = !String(r.updatedAt || '').trim()
        return missingThumb || missingUpdated
      })
      .slice(0, 12)
      .map((r) => r.id)

    if (needIds.length === 0) return
    setDetailRequested((prev) => {
      const next = { ...prev }
      for (const id of needIds) next[id] = true
      return next
    })

    let canceled = false
    void (async () => {
      await Promise.all(
        needIds.map(async (id) => {
          try {
            const json = await cmsFetchJson<{
              item: {
                id: string
                thumbnailUrl?: string
                updatedAt?: string
                createdAt?: string
              }
            }>(cfg, `/cms/works/${encodeURIComponent(id)}`)
            if (canceled) return
            setRows((prev) =>
              prev.map((r) => {
                if (r.id !== id) return r
                return {
                  ...r,
                  thumbnailUrl: String(r.thumbnailUrl || '').trim() ? r.thumbnailUrl : String(json.item.thumbnailUrl || ''),
                  updatedAt: String(r.updatedAt || '').trim() ? r.updatedAt : String(json.item.updatedAt || ''),
                  createdAt: String(r.createdAt || '').trim() ? r.createdAt : String(json.item.createdAt || ''),
                }
              })
            )
          } catch {
            // ignore
          }
        })
      )
    })()

    return () => {
      canceled = true
    }
  }, [busy, cfg, cmsFetchJson, detailRequested, visibleRows])

  const togglePublish = useCallback(
    async (id: string, nextPublished: boolean) => {
      const current = rows.find((r) => r.id === id)
      if (!current) return

      const ok = await runConfirm(
        nextPublished
          ? 'この作品を「公開中」に変更します。よろしいですか？'
          : 'この作品を「非公開」に変更します。よろしいですか？',
        {
          title: nextPublished ? '公開の確認' : '非公開の確認',
          okText: nextPublished ? '公開する' : '非公開にする',
          cancelText: 'キャンセル',
          danger: false,
        }
      )
      if (!ok) return

      setRowBusy({ id, action: nextPublished ? 'publish' : 'unpublish' })
      setBanner('')
      try {
        const detail = await cmsFetchJson<{
          item: {
            id: string
            title: string
            description: string
            thumbnailUrl: string
            published: boolean
            categoryIds: string[]
            tagIds: string[]
            castIds: string[]
          }
        }>(cfg, `/cms/works/${encodeURIComponent(id)}`)

        const payload = {
          title: detail.item.title,
          description: detail.item.description,
          thumbnailUrl: detail.item.thumbnailUrl,
          published: nextPublished,
          categoryIds: detail.item.categoryIds || [],
          tagIds: detail.item.tagIds || [],
          castIds: detail.item.castIds || [],
        }

        await cmsFetchJson(cfg, `/cms/works/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })

        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, published: nextPublished } : r)))
        setBanner(nextPublished ? '公開にしました' : '非公開にしました')
        reload()
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setRowBusy(null)
      }
    },
    [cfg, cmsFetchJson, reload, rows, runConfirm, setBanner]
  )

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>作品一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規作成</Text>
        </Pressable>
      </View>
      <Text style={styles.pageSubtitle}>状態を見て、編集・プレビュー・公開切替</Text>
      <Text style={styles.helperText}>
        この画面では、作品の公開状態を確認し、編集・プレビュー・公開切替を行えます。
      </Text>
      <Text style={styles.helperText}>{`表示中：公開中 ${visibleCounts.published}件 / 非公開 ${visibleCounts.unpublished}件（全${visibleCounts.total}件）`}</Text>

      <CollapsibleSection
        styles={styles}
        title="管理コントロール"
        subtitle="検索 / 並び替え"
        open={openControls}
        onToggle={() => setOpenControls((v: boolean) => !v)}
      >
        <View style={styles.filtersGrid}>
          <View style={[styles.field, { flex: 1, minWidth: 260 } as any]}>
            <Text style={styles.label}>検索（タイトル / 作品ID）</Text>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="例）seed_work_001 / 推しの挑戦"
              placeholderTextColor={COLORS.placeholder}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={[styles.field, { minWidth: 220 } as any]}>
            <Text style={styles.label}>並び替え</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 } as any}>
              <Pressable
                onPress={() => setSort('updated_desc')}
                style={[styles.smallBtn, sort === 'updated_desc' ? { borderColor: COLORS.primary } : null]}
              >
                <Text style={[styles.smallBtnText, sort === 'updated_desc' ? { color: COLORS.primary } : null]}>更新日</Text>
              </Pressable>
              <Pressable
                onPress={() => setSort('created_desc')}
                style={[styles.smallBtn, sort === 'created_desc' ? { borderColor: COLORS.primary } : null]}
              >
                <Text style={[styles.smallBtnText, sort === 'created_desc' ? { color: COLORS.primary } : null]}>作成日</Text>
              </Pressable>
              <Pressable
                onPress={() => setSort('published_first')}
                style={[styles.smallBtn, sort === 'published_first' ? { borderColor: COLORS.primary } : null]}
              >
                <Text style={[styles.smallBtnText, sort === 'published_first' ? { color: COLORS.primary } : null]}>公開状態</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.filterActions}>
          <Pressable
            onPress={() => {
              setQ('')
              setSort('updated_desc')
            }}
            style={styles.btnSecondary}
          >
            <Text style={styles.btnSecondaryText}>リセット</Text>
          </Pressable>
          <Pressable onPress={reload} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>再読み込み</Text>
          </Pressable>
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        styles={styles}
        title="一覧"
        subtitle="状態 / 更新日 / 操作"
        open={openList}
        onToggle={() => setOpenList((v: boolean) => !v)}
        badges={busy ? [{ kind: 'info', label: '読込中' }] : []}
      >
        <View style={styles.workListWrap}>
          {busy ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読み込み中…</Text>
            </View>
          ) : null}

          {visibleRows.map((r) => {
            const statusText = r.published ? '状態：公開中' : '状態：非公開'
            const pillStyle = r.published ? styles.statusPillPublished : styles.statusPillUnpublished
            const isRowBusy = rowBusy?.id === r.id
            const toggleLabel = r.published ? '非公開にする' : '公開する'
            const toggleStyle = r.published ? styles.workActionBtn : styles.workActionBtnPrimary
            const toggleTextStyle = r.published ? styles.workActionBtnText : styles.workActionBtnPrimaryText

            return (
              <View key={r.id} style={[styles.workCard, !r.published ? styles.workCardUnpublished : null]}>
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
                      <View style={[styles.statusPill, pillStyle]}>
                        <Text style={styles.statusPillText}>{statusText}</Text>
                      </View>
                    </View>

                    <View style={styles.workMetaRow}>
                      <Text style={styles.workMetaText}>ID: {r.id}</Text>
                      <Text style={styles.workMetaText}>更新日: {formatYmd(r.updatedAt)}</Text>
                    </View>
                  </View>

                  <View style={styles.workActionCol}>
                    <View style={styles.workActionsRow}>
                      <Pressable onPress={() => onOpenEdit(r.id)} style={styles.workActionBtnPrimary} disabled={isRowBusy}>
                        <Text style={styles.workActionBtnPrimaryText}>編集</Text>
                      </Pressable>
                      <Pressable onPress={() => onOpenPreview(r.id)} style={styles.workActionBtn} disabled={isRowBusy}>
                        <Text style={styles.workActionBtnText}>プレビュー</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => togglePublish(r.id, !r.published)}
                        style={[toggleStyle, isRowBusy ? { opacity: 0.6 } : null]}
                        disabled={isRowBusy}
                      >
                        <Text style={toggleTextStyle}>{isRowBusy ? '切替中…' : toggleLabel}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            )
          })}

          {!busy && visibleRows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>該当する作品がありません</Text>
            </View>
          ) : null}
        </View>
      </CollapsibleSection>
    </ScrollView>
  )
}

export function WorkPreviewScreen({
  cfg,
  cmsFetchJson,
  styles,
  id,
  onBack,
  onEdit,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  id: string
  onBack: () => void
  onEdit: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()
  const [item, setItem] = useState<{
    id: string
    title: string
    description: string
    thumbnailUrl: string
    published: boolean
    updatedAt?: string
    createdAt?: string
  } | null>(null)

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
            title: string
            description: string
            thumbnailUrl: string
            published: boolean
            updatedAt?: string
            createdAt?: string
          }
        }>(cfg, `/cms/works/${encodeURIComponent(id)}`)
        if (!mounted) return
        setItem({
          id: String(json.item.id),
          title: String(json.item.title || ''),
          description: String(json.item.description || ''),
          thumbnailUrl: String(json.item.thumbnailUrl || ''),
          published: Boolean(json.item.published),
          updatedAt: json.item.updatedAt ? String(json.item.updatedAt) : '',
          createdAt: json.item.createdAt ? String(json.item.createdAt) : '',
        })
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
  }, [cfg, cmsFetchJson, id, setBanner])

  const statusText = item?.published ? '公開中' : '非公開'
  const pillStyle = item?.published ? styles.statusPillPublished : styles.statusPillUnpublished

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>作品プレビュー</Text>
        <Pressable onPress={onEdit} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>編集へ</Text>
        </Pressable>
      </View>
      <Text style={styles.pageSubtitle}>一覧＝判断と操作 / 詳細＝編集</Text>

      <CollapsibleSection
        styles={styles}
        title="表示"
        subtitle="サムネイル / タイトル / 状態"
        open={true}
        onToggle={() => {}}
        badges={busy ? [{ kind: 'info', label: '読込中' }] : []}
      >
        {!item ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>{busy ? '読み込み中…' : '作品が見つかりません'}</Text>
          </View>
        ) : (
          <View style={{ gap: 12 } as any}>
            <View style={styles.workPreviewHero}>
              <View style={styles.workPreviewThumb}>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.workPreviewThumbImage} resizeMode="cover" />
                ) : (
                  <View style={styles.workThumbPlaceholder}>
                    <Text style={styles.workThumbPlaceholderText}>No image</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 8 } as any}>
                <Text style={styles.workTitle}>{item.title || '（無題）'}</Text>
                <View style={styles.workMetaRow}>
                  <Text style={styles.workMetaText}>ID: {item.id}</Text>
                  <Text style={styles.workMetaText}>状態:</Text>
                  <View style={[styles.statusPill, pillStyle]}>
                    <Text style={styles.statusPillText}>{statusText}</Text>
                  </View>
                  <Text style={styles.workMetaText}>更新日: {formatYmd(item.updatedAt)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.table}>
              <View style={[styles.tableRow, { borderTopWidth: 0 } as any]}>
                <View style={styles.tableLeft}>
                  <Text style={styles.tableLabel}>説明</Text>
                  <Text style={styles.tableDetail}>{item.description || '—'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </CollapsibleSection>
    </ScrollView>
  )
}

export function WorkEditScreen({
  cfg,
  cmsFetchJson,
  cmsFetchJsonWithBase,
  csvToIdList,
  styles,
  MultiSelectField,
  title,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  cmsFetchJsonWithBase: CmsFetchJsonWithBase
  csvToIdList: CsvToIdListFn
  styles: any
  MultiSelectField: MultiSelectFieldComponent
  title: string
  id: string
  onBack: () => void
}) {
  const [workTitle, setWorkTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const [categoryIdsText, setCategoryIdsText] = useState('')
  const [tagIdsText, setTagIdsText] = useState('')
  const [castIdsText, setCastIdsText] = useState('')
  const [published, setPublished] = useState(false)
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  const [initialKey, setInitialKey] = useState('')
  const [openBasics, setOpenBasics] = useState(true)
  const [openThumbnail, setOpenThumbnail] = useState(true)
  const [openPublish, setOpenPublish] = useState(true)
  const [openRelations, setOpenRelations] = useState(false)

  const [categoryOptions, setCategoryOptions] = useState<MultiSelectOption[]>([])
  const [tagOptions, setTagOptions] = useState<MultiSelectOption[]>([])
  const [castOptions, setCastOptions] = useState<MultiSelectOption[]>([])

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
            title: string
            description: string
            thumbnailUrl: string
            published: boolean
            categoryIds: string[]
            tagIds: string[]
            castIds: string[]
          }
        }>(cfg, `/cms/works/${encodeURIComponent(id)}`)
        if (!mounted) return
        setWorkTitle(json.item.title || '')
        setDesc(json.item.description || '')
        setThumbnailUrl(json.item.thumbnailUrl || '')
        setPublished(Boolean(json.item.published))
        setCategoryIdsText((json.item.categoryIds || []).join(', '))
        setTagIdsText((json.item.tagIds || []).join(', '))
        setCastIdsText((json.item.castIds || []).join(', '))

        setInitialKey(
          JSON.stringify({
            title: String(json.item.title || ''),
            description: String(json.item.description || ''),
            thumbnailUrl: String(json.item.thumbnailUrl || ''),
            published: Boolean(json.item.published),
            categoryIdsText: (json.item.categoryIds || []).join(', '),
            tagIdsText: (json.item.tagIds || []).join(', '),
            castIdsText: (json.item.castIds || []).join(', '),
          })
        )
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
    if (id) return
    setInitialKey(
      JSON.stringify({
        title: '',
        description: '',
        thumbnailUrl: '',
        published: false,
        categoryIdsText: '',
        tagIdsText: '',
        castIdsText: '',
      })
    )
  }, [id])

  const currentKey = JSON.stringify({
    title: workTitle,
    description: desc,
    thumbnailUrl,
    published,
    categoryIdsText,
    tagIdsText,
    castIdsText,
  })
  const dirty = Boolean(initialKey) && currentKey !== initialKey

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return
    const handler = (e: any) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const [catsJson, tagsJson, castsJson] = await Promise.all([
          cmsFetchJson<{ items: Array<{ id: string; name: string; enabled?: boolean }> }>(cfg, '/cms/categories'),
          cmsFetchJson<{ items: Array<{ id: string; name: string }> }>(cfg, '/cms/tags'),
          cmsFetchJson<{ items: Array<{ id: string; name: string; role?: string }> }>(cfg, '/cms/casts'),
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
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg, cmsFetchJson])

  const onSave = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const payload = {
          title: workTitle,
          description: desc,
          thumbnailUrl,
          published,
          categoryIds: csvToIdList(categoryIdsText),
          tagIds: csvToIdList(tagIdsText),
          castIds: csvToIdList(castIdsText),
        }
        if (id) {
          await cmsFetchJson(cfg, `/cms/works/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/works', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }

        setInitialKey(
          JSON.stringify({
            title: workTitle,
            description: desc,
            thumbnailUrl,
            published,
            categoryIdsText,
            tagIdsText,
            castIdsText,
          })
        )
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [castIdsText, categoryIdsText, cfg, cmsFetchJson, csvToIdList, desc, id, published, tagIdsText, thumbnailUrl, workTitle])

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

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 } as any}>
          <Text style={styles.pageTitle}>{title}</Text>
          <Text style={styles.pageSubtitle}>表示・公開・分類をまとめて編集</Text>
        </View>
        {dirty ? <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '900' } as any}>未保存</Text> : null}
      </View>

      <CollapsibleSection
        styles={styles}
        title="基本"
        subtitle="作品名 / 説明"
        open={openBasics}
        onToggle={() => setOpenBasics((v: boolean) => !v)}
        badges={dirty ? [{ kind: 'dirty', label: '未保存' }] : []}
      >
        {id ? (
          <View style={styles.field}>
            <Text style={styles.label}>作品ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>作品名</Text>
          <TextInput value={workTitle} onChangeText={setWorkTitle} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <TextInput value={desc} onChangeText={setDesc} style={[styles.input, { minHeight: 110 }]} multiline />
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        styles={styles}
        title="サムネ"
        subtitle="16:9 推奨"
        open={openThumbnail}
        onToggle={() => setOpenThumbnail((v: boolean) => !v)}
        badges={thumbnailUploading ? [{ kind: 'info', label: 'アップロード中' }] : []}
      >
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
                  if (f) setThumbnailFile(f)
                }}
              />
              <View style={[styles.filterActions, { marginTop: 10, justifyContent: 'flex-start' }]}>
                <Pressable
                  disabled={thumbnailUploading || !thumbnailFile}
                  onPress={uploadThumbnail}
                  style={[styles.btnSecondary, thumbnailUploading || !thumbnailFile ? styles.btnDisabled : null]}
                >
                  <Text style={styles.btnSecondaryText}>
                    {thumbnailUploading ? '画像アップロード中…' : '画像をアップロードしてURLに反映'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <TextInput
            value={thumbnailUrl}
            onChangeText={setThumbnailUrl}
            placeholder="https://..."
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        styles={styles}
        title="公開"
        subtitle="公開 / 非公開"
        open={openPublish}
        onToggle={() => setOpenPublish((v: boolean) => !v)}
      >
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>公開</Text>
          <Switch value={published} onValueChange={setPublished} />
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        styles={styles}
        title="分類"
        subtitle="カテゴリ / タグ / 出演者"
        open={openRelations}
        onToggle={() => setOpenRelations((v: boolean) => !v)}
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
      </CollapsibleSection>

      <View style={styles.filterActions}>
        {dirty && !busy ? (
          <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '800' } as any}>未保存の変更があります</Text>
        ) : null}
        <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
          <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
