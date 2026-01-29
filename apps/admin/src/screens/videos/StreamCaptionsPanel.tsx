import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, Switch, Text, TextInput, View } from 'react-native'

import type { CmsApiConfig } from '../../lib/cmsApi'
import { useBanner } from '../../lib/banner'
import { cmsFetchJson } from '../../lib/cmsApi'
import { styles } from '../../app/styles'

export function StreamCaptionsPanel({ cfg, streamVideoId }: { cfg: CmsApiConfig; streamVideoId: string }) {
  const videoId = String(streamVideoId || '').trim()
  const [items, setItems] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  const [lang, setLang] = useState('ja')
  const [label, setLabel] = useState('日本語')
  const [isDefault, setIsDefault] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

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

      const form = new FormData()
      form.append('file', file)
      form.append('language', (lang || 'ja').trim() || 'ja')
      form.append('label', (label || '').trim() || (lang || 'ja').trim() || 'ja')
      form.append('default', isDefault ? '1' : '0')

      const res = await fetch(`${base}/cms/stream/captions/${encodeURIComponent(videoId)}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cfg.token}`,
          ...(cfg.mock ? { 'X-Mock': '1' } : {}),
        },
        body: form,
      })
      const json = (await res.json().catch(() => ({}))) as any
      if (!res.ok) {
        throw new Error(String(json?.error || `HTTP ${res.status}`))
      }

      setBanner('字幕をアップロードしました')
      await refresh()
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }, [cfg.apiBase, cfg.mock, cfg.token, file, isDefault, label, lang, refresh, setBanner, videoId])

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
          {Platform.OS === 'web' ? (
            <View style={{ marginTop: 6 }}>
              {
                // eslint-disable-next-line react/no-unknown-property
              }
              <input
                type="file"
                accept=".vtt,text/vtt"
                onChange={(e: any) => {
                  const f = e?.target?.files?.[0] ?? null
                  setFile(f)
                  setBanner('')
                }}
              />
            </View>
          ) : null}

          <View style={[styles.field, { marginTop: 10 }]}>
            <Text style={styles.label}>言語</Text>
            <TextInput value={lang} onChangeText={setLang} placeholder="ja" style={styles.input} autoCapitalize="none" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>表示名</Text>
            <TextInput value={label} onChangeText={setLabel} placeholder="日本語" style={styles.input} />
          </View>
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>デフォルト</Text>
            <Switch value={isDefault} onValueChange={setIsDefault} />
          </View>

          <View style={[styles.filterActions, { justifyContent: 'flex-start' }]}>
            <Pressable
              disabled={uploading || !videoId}
              onPress={upload}
              style={[styles.btnSecondary, (uploading || !videoId) ? styles.btnDisabled : null]}
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
              const def = Boolean(c?.default)
              return (
                <View key={`${language}-${display}-${idx}`} style={styles.tableRow}>
                  <View style={styles.tableLeft}>
                    <Text style={styles.tableLabel}>{`${display || '—'}${def ? '（既定）' : ''}`}</Text>
                    <Text style={styles.tableDetail}>{language || '—'}</Text>
                  </View>
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
