import { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { MultiSelectField, type MultiSelectOption } from '../../app/components/MultiSelectField'
import { SelectField } from '../../app/components/SelectField'
import { styles } from '../../app/styles'
import type { CmsApiConfig } from '../../lib/cmsApi'
import { cmsFetchJson, useCmsApi } from '../../lib/cmsApi'
import { useBanner } from '../../lib/banner'
import { csvToIdList } from '../../lib/validation'
import { FixedBottomBar } from '../../ui/FixedBottomBar'
import { StreamCaptionsPanel } from './StreamCaptionsPanel'

export function VideoDetailScreen({
  id,
  onBack,
  onGoComments,
  onOpenVideo,
}: {
  id: string
  onBack: () => void
  onGoComments?: (workId: string, episodeId: string) => void
  onOpenVideo?: (id: string) => void
}) {
  const cfg = useCmsApi()
  const [title, setTitle] = useState('')
  const [workId, setWorkId] = useState('')
  const [desc, setDesc] = useState('')
  const [streamVideoId, setStreamVideoId] = useState('')
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
  const [banner, setBanner] = useBanner()
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
  }, [cfg])

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
            detail: `${c.enabled === false ? '無効' : ''}`,
          }))
        )
        setTagOptions(
          (tagsJson.items ?? []).map((t) => ({
            value: String(t.id ?? ''),
            label: String(t.name ?? '') || String(t.id ?? ''),
            detail: '',
          }))
        )
        setCastOptions(
          (castsJson.items ?? []).map((c) => ({
            value: String(c.id ?? ''),
            label: String(c.name ?? '') || String(c.id ?? ''),
            detail: `${c.role ? String(c.role) : ''}`,
          }))
        )
        setGenreOptions(
          (genresJson.items ?? []).map((g) => ({
            value: String(g.id ?? ''),
            label: String(g.name ?? '') || String(g.id ?? ''),
            detail: '',
          }))
        )
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg])

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
        setThumbnailUrl(json.item.thumbnailUrl || '')
        setScheduledAt(json.item.scheduledAt || '')
        const ep = (json.item as any).episodeNo
        setEpisodeNoText(ep === null || ep === undefined || !Number.isFinite(Number(ep)) ? '' : String(Number(ep)))
        setPublished(Boolean(json.item.published))
        setCategoryIdsText((json.item.categoryIds || []).join(', '))
        setTagIdsText((json.item.tagIds || []).join(', '))
        setCastIdsText((json.item.castIds || []).join(', '))

        setGenreIdsText(
          ((((json.item as any).genreIds as any[]) ?? [])
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .join(', '))
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
  }, [cfg, id])

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
  }, [cfg, id])

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
  }, [castIdsText, categoryIdsText, cfg, desc, episodeNoText, genreIdsText, id, published, scheduledAt, streamVideoId, tagIdsText, thumbnailUrl, title, workId])

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
  }, [cfg, recoSearchQ])

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
  }, [cfg, id, recommendations])

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.contentScroll} contentContainerStyle={[styles.contentInner, { paddingBottom: 110 }]}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>動画詳細・編集</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        <View style={styles.field}>
          <Text style={styles.label}>評価</Text>
          <Text
            style={styles.readonlyText}
          >{`${(Number(ratingAvg) || 0).toFixed(2)}（${Number(reviewCount) || 0}件） / 再生:${Number(playsCount) || 0} / コメント:${Number(commentsCount) || 0}`}</Text>
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
          <Text style={styles.label}>配信用ID（Stream）</Text>
          <TextInput value={streamVideoId} onChangeText={setStreamVideoId} style={styles.input} autoCapitalize="none" />
        </View>
        <StreamCaptionsPanel cfg={cfg as unknown as CmsApiConfig} streamVideoId={streamVideoId} />
        <View style={styles.field}>
          <Text style={styles.label}>サムネイル</Text>
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} style={styles.input} autoCapitalize="none" />
        </View>
        {thumbnailUrl.trim() ? (
          <View style={styles.field}>
            <Text style={styles.label}>プレビュー</Text>
            <Image
              source={{ uri: thumbnailUrl.trim() }}
              style={{ width: 240, height: 135, borderRadius: 10, backgroundColor: '#e5e7eb' }}
              resizeMode="cover"
            />
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>話数</Text>
          <TextInput value={episodeNoText} onChangeText={setEpisodeNoText} style={styles.input} keyboardType="numeric" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>配信予定日時</Text>
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
          onChange={(ids) => setCategoryIdsText(ids.join(', '))}
          searchPlaceholder="カテゴリ検索（名前）"
        />
        <MultiSelectField
          label="タグ（複数選択）"
          values={csvToIdList(tagIdsText)}
          placeholder="選択"
          options={tagOptions}
          onChange={(ids) => setTagIdsText(ids.join(', '))}
          searchPlaceholder="タグ検索（名前）"
        />
        <MultiSelectField
          label="出演者（複数選択）"
          values={csvToIdList(castIdsText)}
          placeholder="選択"
          options={castOptions}
          onChange={(ids) => setCastIdsText(ids.join(', '))}
          searchPlaceholder="出演者検索（名前）"
        />
        <MultiSelectField
          label="ジャンル（複数選択）"
          values={csvToIdList(genreIdsText)}
          placeholder="選択"
          options={genreOptions}
          onChange={(ids) => setGenreIdsText(ids.join(', '))}
          searchPlaceholder="ジャンル検索（名前）"
        />
        <View style={{ height: 8 }} />
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
            <TextInput value={recoSearchQ} onChangeText={setRecoSearchQ} style={[styles.input, { flex: 1 }]} placeholder="タイトル/作品/ID" />
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

      <FixedBottomBar>
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
      </FixedBottomBar>
    </View>
  )
}
