import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { useBanner } from '../../lib/banner'
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

type WorkRow = { id: string; title: string; published: boolean }

export function WorksListScreen({
  cfg,
  cmsFetchJson,
  styles,
  onOpenDetail,
  onNew,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  onOpenDetail: (id: string) => void
  onNew: () => void
}) {
  const [rows, setRows] = useState<WorkRow[]>([])
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<{ id: string; title: string; published: boolean }> }>(cfg, '/cms/works')
        if (!mounted) return
        setRows((json.items ?? []).map((w) => ({ id: w.id, title: w.title, published: Boolean(w.published) })))
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
  }, [cfg, cmsFetchJson])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>作品一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規作成</Text>
        </Pressable>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {busy ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読み込み中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.title}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${r.published ? '公開' : '非公開'}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
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
        <Text style={styles.pageTitle}>{title}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
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
          <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://..." style={styles.input} autoCapitalize="none" />
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
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}
