import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'

import type { CmsApiConfig } from '../../lib/cmsApi'
import { useBanner } from '../../lib/banner'
import { cmsFetchJson } from '../../lib/cmsApi'
import { styles } from '../../app/styles'
import { WebDropZone } from '../../ui/WebDropZone'

export function StreamCaptionsPanel({ cfg, streamVideoId }: { cfg: CmsApiConfig; streamVideoId: string }) {
  const videoId = String(streamVideoId || '').trim()
  const [items, setItems] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  const fixedLangTag = 'ja'
  const fixedLabel = '日本語'
  const fixedDefault = true
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const [deletingLang, setDeletingLang] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!videoId) return
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/stream/captions/${encodeURIComponent(videoId)}`)
      setItems(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg, setBanner, videoId])

  const upload = useCallback(async () => {
    if (Platform.OS !== 'web') {
      setBanner('字幕アップロードはWeb版管理画面のみ対応です')
      return
    }
    if (!videoId) {
      setBanner('Stream Video ID を設定してください')
      return
    }
    if (!file) {
      setBanner('WebVTT（.vtt）ファイルを選択してください')
      return
    }

    setUploading(true)
    setBanner('字幕アップロード中…')
    try {
      const base = String(cfg.apiBase || '').replace(/\/$/, '')
      if (!base) throw new Error('API Base が未設定です')
      if (!cfg.token) throw new Error('セッションが切れました')

      const langTag = fixedLangTag

      const form = new FormData()
      form.append('file', file)
      // Best-effort: Cloudflare supports label/default metadata. If ignored, it is harmless.
      form.append('label', fixedLabel)
      form.append('default', fixedDefault ? '1' : '0')

      const res = await fetch(`${base}/cms/stream/captions/${encodeURIComponent(videoId)}/${encodeURIComponent(langTag)}`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${cfg.token}`,
        },
        body: form,
      })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok) {
        const error = String(json?.error || `HTTP ${res.status}`)
        const hint = json?.hint ? String(json.hint) : ''
        const status = typeof json?.status === 'number' ? String(json.status) : ''
        const errors = Array.isArray(json?.errors) ? JSON.stringify(json.errors).slice(0, 300) : ''
        const extra = [status ? `status=${status}` : '', hint ? `hint=${hint}` : '', errors ? `errors=${errors}` : '']
          .filter(Boolean)
          .join(' ')
        throw new Error(extra ? `${error} (${extra})` : error)
      }

      setBanner('字幕をアップロードしました')
      await refresh()
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }, [cfg.apiBase, cfg.token, file, fixedDefault, fixedLabel, fixedLangTag, refresh, setBanner, videoId])

  const downloadVtt = useCallback(
    async (language: string) => {
      if (Platform.OS !== 'web') {
        setBanner('この操作はWeb版管理画面のみ対応です')
        return
      }
      if (!videoId) return
      const base = String(cfg.apiBase || '').replace(/\/$/, '')
      if (!base) throw new Error('API Base が未設定です')
      if (!cfg.token) throw new Error('セッションが切れました')

      const res = await fetch(
        `${base}/cms/stream/captions/${encodeURIComponent(videoId)}/${encodeURIComponent(language)}/vtt`,
        {
          headers: { authorization: `Bearer ${cfg.token}` },
        }
      )
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `HTTP ${res.status}`)
      }
      const vtt = await res.text().catch(() => '')
      const blob = new Blob([vtt], { type: 'text/vtt' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${videoId}_${language}.vtt`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
    [cfg.apiBase, cfg.token, setBanner, videoId]
  )

  const deleteCaption = useCallback(
    async (language: string) => {
      if (Platform.OS !== 'web') {
        setBanner('この操作はWeb版管理画面のみ対応です')
        return
      }
      if (!videoId) return

      setDeletingLang(language)
      setBanner('字幕を削除中…')
      try {
        const base = String(cfg.apiBase || '').replace(/\/$/, '')
        if (!base) throw new Error('API Base が未設定です')
        if (!cfg.token) throw new Error('セッションが切れました')

        const res = await fetch(
          `${base}/cms/stream/captions/${encodeURIComponent(videoId)}/${encodeURIComponent(language)}`,
          {
            method: 'DELETE',
            headers: { authorization: `Bearer ${cfg.token}` },
          }
        )
        const json = (await res.json().catch(() => null)) as any
        if (!res.ok) {
          throw new Error(String(json?.error || `HTTP ${res.status}`))
        }

        setBanner('字幕を削除しました')
        await refresh()
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setDeletingLang(null)
      }
    },
    [cfg.apiBase, cfg.token, refresh, setBanner, videoId]
  )

  useEffect(() => {
    if (!videoId) return
    void refresh()
  }, [refresh, videoId])

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>字幕（WebVTT）</Text>
      {!videoId ? (
        <Text style={styles.selectMenuDetailText}>Stream Video ID を設定すると字幕（.vtt）を登録できます</Text>
      ) : (
        <>
          <Text style={styles.selectMenuDetailText}>Cloudflare Stream字幕として登録します（言語: ja 固定）</Text>
          {Platform.OS === 'web' ? (
            <View style={{ marginTop: 6 }}>
              <WebDropZone
                title="字幕ファイル（.vtt）を選択"
                hint="ドラッグ&ドロップ対応"
                accept=".vtt,text/vtt"
                multiple={false}
                onFiles={(files) => {
                  const f = files?.[0] ?? null
                  if (!f) return
                  setFile(f)
                  setBanner('')
                }}
              />
              {file ? (
                <View
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    backgroundColor: '#f9fafb',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  } as any}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6Z"
                        stroke="#111827"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 2v6h6"
                        stroke="#111827"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 13h8M8 17h8"
                        stroke="#111827"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectMenuDetailText} numberOfLines={1}>
                      選択中: {file.name}
                    </Text>
                    <Text style={styles.selectMenuDetailText}>
                      {Math.max(1, Math.round(file.size / 1024))}KB / ja（日本語）
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setFile(null)}
                    style={styles.btnSecondary}
                  >
                    <Text style={styles.btnSecondaryText}>選択解除</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.filterActions, { justifyContent: 'flex-start' }]}>
            <Pressable
              disabled={uploading || !videoId || !file}
              onPress={upload}
              style={[styles.btnSecondary, (uploading || !videoId || !file) ? styles.btnDisabled : null]}
            >
              <Text style={styles.btnSecondaryText}>{uploading ? '字幕アップロード中…' : '字幕をアップロード'}</Text>
            </Pressable>
            <Pressable
              disabled={busy || !videoId}
              onPress={() => void refresh()}
              style={[styles.btnSecondary, (busy || !videoId) ? styles.btnDisabled : null]}
            >
              <Text style={styles.btnSecondaryText}>{busy ? '取得中…' : '字幕一覧を更新'}</Text>
            </Pressable>
          </View>

          <View style={[styles.table, { marginTop: 10 }]}>
            {(items ?? []).map((c: any, idx: number) => {
              const language = String(c?.language ?? '')
              const display = String(c?.label ?? '')
              const generated = Boolean(c?.generated)
              const status = String(c?.status ?? '')
              const def = Boolean(c?.default)
              return (
                <View key={`${language}-${display}-${idx}`} style={styles.tableRow}>
                  <View style={styles.tableLeft}>
                    <Text style={styles.tableLabel}>{`${display || '—'}${def ? '（既定）' : ''}`}</Text>
                    <Text style={styles.tableDetail}>
                      {(language || '—') + (generated ? ' / generated' : '') + (status ? ` / ${status}` : '')}
                    </Text>
                  </View>
                  {Platform.OS === 'web' ? (
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Pressable
                        onPress={() => {
                          void downloadVtt(language)
                        }}
                        style={styles.btnSecondary}
                      >
                        <Text style={styles.btnSecondaryText}>VTT取得</Text>
                      </Pressable>
                      <Pressable
                        disabled={!language || deletingLang === language}
                        onPress={() => {
                          void deleteCaption(language)
                        }}
                        style={[styles.btnSecondary, (!language || deletingLang === language) ? styles.btnDisabled : null]}
                      >
                        <Text style={styles.btnSecondaryText}>{deletingLang === language ? '削除中…' : '削除'}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )
            })}
            {!items?.length ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>字幕がありません</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </View>
  )
}
