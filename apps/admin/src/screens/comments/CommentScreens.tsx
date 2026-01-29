import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { useBanner } from '../../lib/banner'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
}

type CmsFetchJson = <T = any>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

type SelectFieldComponent = (props: any) => any

type CommentRow = {
  id: string
  targetTitle: string
  author: string
  body: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
}

function commentStatusLabel(v: CommentRow['status']): string {
  switch (v) {
    case 'pending':
      return '未対応非公開'
    case 'approved':
      return '公開済み'
    case 'rejected':
      return '対応済み非公開'
    default:
      return '未対応非公開'
  }
}

function commentTargetTitle(contentTitle: string, contentId: string, episodeId: string): string {
  const base = contentTitle || contentId || '—'
  const ep = (episodeId || '').trim()
  return ep ? `${base} 第${ep}話` : base
}

export function CommentsPendingListScreen({
  cfg,
  cmsFetchJson,
  styles,
  onOpenDetail,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  onOpenDetail: (id: string) => void
}) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<CommentRow[]>([])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/comments?status=pending')
        if (!mounted) return
        setRows(
          (json.items ?? []).map((c) => ({
            id: String(c.id ?? ''),
            targetTitle: commentTargetTitle(String(c.contentTitle ?? ''), String(c.contentId ?? ''), String(c.episodeId ?? '')),
            author: String(c.author ?? ''),
            body: String(c.body ?? ''),
            createdAt: String(c.createdAt ?? ''),
            status: (String(c.status ?? 'pending') as any) as CommentRow['status'],
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
  }, [cfg, cmsFetchJson, setBanner])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>未承認/未対応コメント一覧</Text>

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
                <Text style={styles.tableLabel}>{`${r.targetTitle} / ${r.author}`}</Text>
                <Text style={styles.tableDetail}>{`${r.createdAt} / ${commentStatusLabel(r.status)}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>未対応コメントがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

export function CommentApproveScreen({
  cfg,
  cmsFetchJson,
  styles,
  SelectField,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  SelectField: SelectFieldComponent
  id: string
  onBack: () => void
}) {
  const [decision, setDecision] = useState<'公開済み' | '対応済み非公開' | ''>('')
  const [reason, setReason] = useState('')
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState<null | { id: string; targetTitle: string; author: string; body: string; createdAt: string; status: CommentRow['status'] }>(
    null
  )

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/comments/${encodeURIComponent(id)}`)
        if (!mounted) return
        const c = json.item
        setItem({
          id: String(c?.id ?? id),
          targetTitle: commentTargetTitle(String(c?.contentTitle ?? ''), String(c?.contentId ?? ''), String(c?.episodeId ?? '')),
          author: String(c?.author ?? ''),
          body: String(c?.body ?? ''),
          createdAt: String(c?.createdAt ?? ''),
          status: (String(c?.status ?? 'pending') as any) as CommentRow['status'],
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

  const onSubmit = useCallback(() => {
    if (!decision) {
      setBanner('ステータスを選択してください')
      return
    }
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        if (decision === '公開済み') {
          await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}/approve`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ note: reason }),
          })
        } else {
          await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}/reject`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ note: reason }),
          })
        }
        setBanner('更新しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, decision, id, reason, setBanner])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>コメント詳細（承認/否認）</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>表示</Text>
        <View style={styles.field}>
          <Text style={styles.label}>コメントID</Text>
          <Text style={styles.readonlyText}>{item?.id || id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>対象</Text>
          <Text style={styles.readonlyText}>{item?.targetTitle || (busy ? '—' : '—')}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>投稿者</Text>
          <Text style={styles.readonlyText}>{item?.author || (busy ? '—' : '—')}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>本文</Text>
          <Text style={styles.readonlyText}>{item?.body || (busy ? '—' : '—')}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>投稿日時</Text>
          <Text style={styles.readonlyText}>{item?.createdAt || (busy ? '—' : '—')}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>現在ステータス</Text>
          <Text style={styles.readonlyText}>{item ? commentStatusLabel(item.status) : busy ? '—' : '—'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>操作</Text>
        <SelectField
          label="ステータス"
          value={decision}
          placeholder="選択"
          options={[
            { label: '公開（承認）', value: '公開済み' },
            { label: '非公開（否認/取り下げ）', value: '対応済み非公開' },
          ]}
          onChange={(v: any) => setDecision(v as any)}
        />
        {decision === '対応済み非公開' ? (
          <View style={styles.field}>
            <Text style={styles.label}>否認理由（任意）</Text>
            <TextInput value={reason} onChangeText={setReason} style={[styles.input, { minHeight: 90 }]} multiline />
          </View>
        ) : null}
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSubmit} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '更新中…' : '確定'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

export function CommentsListScreen({
  cfg,
  cmsFetchJson,
  styles,
  SelectField,
  onOpenEdit,
  initialContentId,
  initialEpisodeId,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  SelectField: SelectFieldComponent
  onOpenEdit: (id: string) => void
  initialContentId?: string
  initialEpisodeId?: string
}) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [qStatus, setQStatus] = useState<'' | 'pending' | 'approved' | 'rejected'>('')
  const [qContentId, setQContentId] = useState(initialContentId ? String(initialContentId) : '')
  const [qEpisodeId, setQEpisodeId] = useState(initialEpisodeId ? String(initialEpisodeId) : '')
  const [rows, setRows] = useState<CommentRow[]>([])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const params = new URLSearchParams()
        if (qStatus) params.set('status', qStatus)
        if (qContentId.trim()) params.set('contentId', qContentId.trim())
        if (qEpisodeId.trim()) params.set('episodeId', qEpisodeId.trim())
        const qs = params.toString() ? `?${params.toString()}` : ''
        const json = await cmsFetchJson<{ items: any[] }>(cfg, `/cms/comments${qs}`)
        if (!mounted) return
        setRows(
          (json.items ?? []).map((c) => ({
            id: String(c.id ?? ''),
            targetTitle: commentTargetTitle(String(c.contentTitle ?? ''), String(c.contentId ?? ''), String(c.episodeId ?? '')),
            author: String(c.author ?? ''),
            body: String(c.body ?? ''),
            createdAt: String(c.createdAt ?? ''),
            status: (String(c.status ?? 'pending') as any) as CommentRow['status'],
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
  }, [cfg, cmsFetchJson, qContentId, qEpisodeId, qStatus, setBanner])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>コメント一覧</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>検索</Text>
        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>作品ID（contentId）</Text>
            <TextInput value={qContentId} onChangeText={setQContentId} placeholder="work_..." style={styles.input} autoCapitalize="none" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>エピソードID/話数（episodeId）</Text>
            <TextInput value={qEpisodeId} onChangeText={setQEpisodeId} placeholder="video_... / 1" style={styles.input} autoCapitalize="none" />
          </View>
        </View>
        <SelectField
          label="ステータス"
          value={qStatus}
          placeholder="全て"
          options={[
            { label: '全て', value: '' },
            { label: '未対応非公開', value: 'pending' },
            { label: '公開済み', value: 'approved' },
            { label: '対応済み非公開', value: 'rejected' },
          ]}
          onChange={(v: any) => setQStatus(v as any)}
        />
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
            <Pressable key={r.id} onPress={() => onOpenEdit(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{`${r.targetTitle} / ${r.author}`}</Text>
                <Text style={styles.tableDetail}>{`${r.createdAt} / ${commentStatusLabel(r.status)}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>コメントがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

export function CommentEditScreen({
  cfg,
  cmsFetchJson,
  styles,
  SelectField,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  SelectField: SelectFieldComponent
  id: string
  onBack: () => void
}) {
  const [status, setStatus] = useState<'approved' | 'rejected'>('approved')
  const [deleted, setDeleted] = useState(false)
  const [note, setNote] = useState('')
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/comments/${encodeURIComponent(id)}`)
        if (!mounted) return
        const c = json.item
        const st = String(c?.status ?? 'approved')
        setStatus(st === 'rejected' ? 'rejected' : 'approved')
        setDeleted(Boolean(c?.deleted))
        setNote(String(c?.moderationNote ?? ''))
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

  const onSave = useCallback(() => {
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status, deleted, note }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, deleted, id, note, status])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>コメント編集</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>操作</Text>
        <View style={styles.field}>
          <Text style={styles.label}>コメントID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <SelectField
          label="ステータス"
          value={status}
          placeholder="選択"
          options={[
            { label: '公開', value: 'approved' },
            { label: '非公開', value: 'rejected' },
          ]}
          onChange={(v: any) => setStatus(v as any)}
        />
        <View style={styles.field}>
          <Text style={styles.label}>メモ（任意）</Text>
          <TextInput value={note} onChangeText={setNote} style={[styles.input, { minHeight: 90 }]} multiline />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>削除（論理削除）</Text>
          <Switch value={deleted} onValueChange={setDeleted} />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}
