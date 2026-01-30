import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { MultiSelectField, type MultiSelectOption } from '../../app/components/MultiSelectField'
import { SelectField } from '../../app/components/SelectField'
import { COLORS, styles } from '../../app/styles'
import type { CmsApiConfig } from '../../lib/cmsApi'
import { cmsFetchJson, cmsFetchJsonWithBase, useCmsApi } from '../../lib/cmsApi'
import { useBanner } from '../../lib/banner'
import { csvToIdList } from '../../lib/validation'
import { FixedBottomBar } from '../../ui/FixedBottomBar'
import { WebDropZone } from '../../ui/WebDropZone'
import { StreamCaptionsPanel } from './StreamCaptionsPanel'

const tus: typeof import('tus-js-client') | null = Platform.OS === 'web' ? (require('tus-js-client') as any) : null

export function VideoUploadScreen({ onBack }: { onBack: () => void }) {
  const cfg = useCmsApi()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [workId, setWorkId] = useState('')
  const [streamVideoId, setStreamVideoId] = useState('')
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
  }, [castIdsText, categoryIdsText, cfg, desc, episodeNoText, genreIdsText, publish, setBanner, streamVideoId, tagIdsText, thumbnailUrl, title, workId])

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
  }, [cfg, setBanner, thumbnailFile])

  const startStreamUpload = useCallback((file?: File | null) => {
    if (Platform.OS !== 'web') {
      setUploadState('error')
      setBanner('アップロードはWeb版管理画面のみ対応です')
      return
    }
    const f = file ?? uploadFile
    if (!f) {
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
    if (typeof f.size === 'number' && f.size > maxBytes) {
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

        const uploader = new tus.Upload(f, {
          endpoint: tusEndpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 50 * 1024 * 1024,
          metadata: {
            filename: f.name,
            filetype: f.type || 'application/octet-stream',
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
  }, [cfg, setBanner, uploadFile])

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
  }, [cfg, streamVideoId, uploadState])

  const canStartUpload = useMemo(
    () => !(uploadState === 'creating' || uploadState === 'uploading' || !uploadFile),
    [uploadFile, uploadState]
  )

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.contentScroll} contentContainerStyle={[styles.contentInner, { paddingBottom: 110 }]}>
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
                    startStreamUpload(f)
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
                  disabled={!canStartUpload}
                  onPress={() => startStreamUpload()}
                  style={[styles.btnSecondary, !canStartUpload ? styles.btnDisabled : null]}
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
            placeholderTextColor={COLORS.placeholder}
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
        <StreamCaptionsPanel cfg={cfg as unknown as CmsApiConfig} streamVideoId={streamVideoId} />
        <View style={styles.field}>
          <Text style={styles.label}>サムネイル</Text>
          <Text style={styles.selectMenuDetailText}>推奨サイズ: 16:9（例: 1280×720）</Text>
          {Platform.OS === 'web' ? (
            <View style={{ marginTop: 6 }}>
              <WebDropZone
                title="サムネ画像を追加"
                hint="16:9 推奨（例: 1280×720）"
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
                  style={[styles.btnSecondary, (thumbnailUploading || !thumbnailFile) ? styles.btnDisabled : null]}
                >
                  <Text style={styles.btnSecondaryText}>{thumbnailUploading ? '画像アップロード中…' : 'アップロード'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {thumbnailUrl.trim() ? (
            <Image
              source={{ uri: thumbnailUrl.trim() }}
              style={{ width: 240, height: 135, borderRadius: 10, backgroundColor: '#e5e7eb', marginTop: 10 }}
              resizeMode="cover"
            />
          ) : null}
          <Text style={[styles.selectMenuDetailText, { marginTop: 8 }]}>URLはアップロード後に自動で設定されます</Text>
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

    </ScrollView>

    <FixedBottomBar>
      <View style={styles.filterActions}>
        <Pressable disabled={busy} onPress={onCreate} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
          <Text style={styles.btnPrimaryText}>{busy ? '登録中…' : '登録'}</Text>
        </Pressable>
      </View>
    </FixedBottomBar>
    </View>
  )
}
