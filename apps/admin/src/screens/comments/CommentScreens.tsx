import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { COLORS } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { formatJaDateTime } from '../../utils/datetime'
import { CollapsibleSection } from '../../ui/CollapsibleSection'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
}

type CmsFetchJson = <T = any>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

type SelectFieldComponent = (props: any) => any

type ConfirmFn = (
  message: string,
  opts?: {
    title?: string
    okText?: string
    cancelText?: string
    danger?: boolean
  }
) => Promise<boolean>

type CommentRow = {
  id: string
  contentTitle?: string
  contentId?: string
  episodeId?: string
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
  confirm,
  styles,
  onOpenDetail,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  confirm: ConfirmFn
  styles: any
  onOpenDetail: (id: string) => void
}) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<CommentRow[]>([])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ list: true })

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
            contentTitle: String(c.contentTitle ?? ''),
            contentId: String(c.contentId ?? ''),
            episodeId: String(c.episodeId ?? ''),
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

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allIds = useMemo(() => rows.map((r) => r.id).filter(Boolean), [rows])
  const allSelected = useMemo(() => allIds.length > 0 && allIds.every((id) => selectedIds.has(id)), [allIds, selectedIds])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) return new Set()
      for (const id of allIds) next.add(id)
      return next
    })
  }, [allIds, allSelected])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = String(a.createdAt || '')
      const bv = String(b.createdAt || '')
      if (av === bv) return 0
      return sortDir === 'desc' ? (av > bv ? -1 : 1) : av > bv ? 1 : -1
    })
    return copy
  }, [rows, sortDir])

  const approveOne = useCallback(
    async (id: string) => {
      const row = rows.find((r) => r.id === id)
      if (!row) return
      const ok = await confirm('このコメントを承認して公開しますか？', { title: '承認' })
      if (!ok) return

      setBusy(true)
      setBanner('')
      void (async () => {
        try {
          await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}/approve`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ note: '' }),
          })
          setRows((prev) => prev.filter((r) => r.id !== id))
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        } catch (e) {
          setBanner(e instanceof Error ? e.message : String(e))
        } finally {
          setBusy(false)
        }
      })()
    },
    [cfg, cmsFetchJson, confirm, rows, setBanner]
  )

  const rejectOne = useCallback(
    async (id: string) => {
      const row = rows.find((r) => r.id === id)
      if (!row) return
      const ok = await confirm('このコメントを却下して非公開にしますか？', { title: '却下', danger: true, okText: '却下' })
      if (!ok) return

      setBusy(true)
      setBanner('')
      void (async () => {
        try {
          await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}/reject`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ note: '' }),
          })
          setRows((prev) => prev.filter((r) => r.id !== id))
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        } catch (e) {
          setBanner(e instanceof Error ? e.message : String(e))
        } finally {
          setBusy(false)
        }
      })()
    },
    [cfg, cmsFetchJson, confirm, rows, setBanner]
  )

  const bulkApprove = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const ok = await confirm(`${ids.length}件を承認して公開しますか？`, { title: '一括承認', okText: '承認' })
    if (!ok) return

    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        for (const id of ids) {
          await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}/approve`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ note: '' }),
          })
        }
        setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)))
        setSelectedIds(new Set())
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, confirm, selectedIds, setBanner])

  const bulkReject = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const ok = await confirm(`${ids.length}件を却下して非公開にしますか？`, { title: '一括却下', danger: true, okText: '却下' })
    if (!ok) return

    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        for (const id of ids) {
          await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}/reject`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ note: '' }),
          })
        }
        setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)))
        setSelectedIds(new Set())
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, confirm, selectedIds, setBanner])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>未承認/未対応コメント一覧</Text>

      <Text style={styles.pageLead}>投稿日で優先度を判断して処理</Text>

      <CollapsibleSection
        title="一覧"
        subtitle="投稿日 / 作品 / 話数 / ユーザー / 状態 / 操作"
        open={openSections.list}
        onToggle={() => setOpenSections((p) => ({ ...p, list: !p.list }))}
        styles={styles}
      >
        <View style={styles.table}>
          <ScrollView horizontal>
            <View style={{ minWidth: 980 } as any}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <View style={[styles.tableCell, styles.tableCellCheck]}>
                  <Pressable
                    onPress={toggleSelectAll}
                    style={[styles.tableCheckbox, allSelected ? styles.tableCheckboxOn : null]}
                  >
                    <Text style={[styles.tableCheckboxText, allSelected ? styles.tableCheckboxTextOn : null]}>
                      ✓
                    </Text>
                  </Pressable>
                </View>
                <View style={[styles.tableCell, { width: 170 } as any]}>
                  <Pressable onPress={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
                    <Text style={styles.tableHeaderText}>{`投稿日 ${sortDir === 'desc' ? '↓' : '↑'}`}</Text>
                  </Pressable>
                </View>
                <View style={[styles.tableCell, { width: 260 } as any]}>
                  <Text style={styles.tableHeaderText}>作品</Text>
                </View>
                <View style={[styles.tableCell, { width: 90 } as any]}>
                  <Text style={styles.tableHeaderText}>話数</Text>
                </View>
                <View style={[styles.tableCell, { width: 140 } as any]}>
                  <Text style={styles.tableHeaderText}>ユーザー</Text>
                </View>
                <View style={[styles.tableCell, { width: 140 } as any]}>
                  <Text style={styles.tableHeaderText}>状態</Text>
                </View>
                <View style={[styles.tableCell, { width: 280 } as any]}>
                  <Text style={styles.tableHeaderText}>操作</Text>
                </View>
              </View>

              {busy ? (
                <View style={styles.placeholderBox}>
                  <Text style={styles.placeholderText}>読み込み中…</Text>
                </View>
              ) : null}

              {sortedRows.map((r) => {
                const workTitle = String(r.contentTitle || r.contentId || '—')
                const ep = String(r.episodeId || '').trim()
                const epLabel = ep ? `第${ep}話` : '—'
                const checked = selectedIds.has(r.id)

                return (
                  <View key={r.id} style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.tableCellCheck]}>
                      <Pressable onPress={() => toggleSelect(r.id)} style={[styles.tableCheckbox, checked ? styles.tableCheckboxOn : null]}>
                        <Text style={[styles.tableCheckboxText, checked ? styles.tableCheckboxTextOn : null]}>✓</Text>
                      </Pressable>
                    </View>
                    <View style={[styles.tableCell, { width: 170 } as any]}>
                      <Text style={styles.tableCellText}>{formatJaDateTime(r.createdAt, { withSeconds: true }) || '—'}</Text>
                    </View>
                    <View style={[styles.tableCell, { width: 260 } as any]}>
                      <Pressable onPress={() => onOpenDetail(r.id)}>
                        <Text style={styles.tableCellText} numberOfLines={1}>
                          {workTitle}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={[styles.tableCell, { width: 90 } as any]}>
                      <Text style={styles.tableCellText}>{epLabel}</Text>
                    </View>
                    <View style={[styles.tableCell, { width: 140 } as any]}>
                      <Text style={styles.tableCellMuted} numberOfLines={1}>
                        {r.author || '—'}
                      </Text>
                    </View>
                    <View style={[styles.tableCell, { width: 140 } as any]}>
                      <View style={[styles.statusPill, styles.statusPillWarning]}>
                        <Text style={[styles.statusPillText, styles.statusPillTextWarning]}>未承認</Text>
                      </View>
                    </View>
                    <View style={[styles.tableCell, { width: 280 } as any]}>
                      <View style={styles.tableRowActions}>
                        <Pressable onPress={() => onOpenDetail(r.id)} style={styles.smallBtn}>
                          <Text style={styles.smallBtnText}>確認</Text>
                        </Pressable>
                        <Pressable disabled={busy} onPress={() => void approveOne(r.id)} style={[styles.smallBtnPrimary, busy ? styles.btnDisabled : null]}>
                          <Text style={styles.smallBtnPrimaryText}>承認</Text>
                        </Pressable>
                        <Pressable disabled={busy} onPress={() => void rejectOne(r.id)} style={[styles.smallBtnDangerOutline, busy ? styles.btnDisabled : null]}>
                          <Text style={styles.smallBtnDangerOutlineText}>却下</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )
              })}

              {!busy && rows.length === 0 ? (
                <View style={styles.placeholderBox}>
                  <Text style={styles.placeholderText}>未対応コメントがありません</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>

        {selectedIds.size > 0 ? (
          <View style={styles.stickyBar ?? ({ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 } as any)}>
            <View style={styles.stickyBarInner ?? ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 } as any)}>
              <Text style={styles.stickyBarHint ?? styles.helperText}>{`${selectedIds.size}件 選択中`}</Text>
              <View style={styles.stickyBarActions ?? ({ flexDirection: 'row', alignItems: 'center', gap: 10 } as any)}>
                <Pressable disabled={busy} onPress={() => void bulkApprove()} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
                  <Text style={styles.btnPrimaryText}>一括承認</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={() => void bulkReject()} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
                  <Text style={styles.btnSecondaryText}>一括却下</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </CollapsibleSection>
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
          <Text style={styles.readonlyText}>{formatJaDateTime(item?.createdAt, { withSeconds: true }) || (busy ? '—' : '—')}</Text>
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
  confirm,
  initialContentId,
  initialEpisodeId,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  SelectField: SelectFieldComponent
  onOpenEdit: (id: string) => void
  confirm?: ConfirmFn
  initialContentId?: string
  initialEpisodeId?: string
}) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [qStatus, setQStatus] = useState<'' | 'pending' | 'approved' | 'rejected'>('')
  const [qContentId, setQContentId] = useState(initialContentId ? String(initialContentId) : '')
  const [qEpisodeId, setQEpisodeId] = useState(initialEpisodeId ? String(initialEpisodeId) : '')
  const [rows, setRows] = useState<CommentRow[]>([])

  const [reloadSeq, setReloadSeq] = useState(0)

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ search: true, list: true })

  const qStatusLabel = useMemo(() => (qStatus ? commentStatusLabel(qStatus) : '全て'), [qStatus])

  const runConfirm = useCallback(
    async (message: string, opts?: Parameters<ConfirmFn>[1]): Promise<boolean> => {
      if (confirm) return await confirm(message, opts)
      if (Platform.OS === 'web' && typeof window !== 'undefined') return window.confirm(message)
      return false
    },
    [confirm]
  )

  const updateComment = useCallback(
    async (id: string, patch: any) => {
      setBusy(true)
      setBanner('')
      try {
        await cmsFetchJson(cfg, `/cms/comments/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        })
        setReloadSeq((n) => n + 1)
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [cfg, cmsFetchJson, setBanner]
  )

  const onUnpublish = useCallback(
    async (id: string) => {
      const ok = await runConfirm('このコメントを非公開にしますか？', { title: '非公開', okText: '非公開' })
      if (!ok) return
      await updateComment(id, { status: 'rejected', deleted: false })
      setBanner('非公開にしました')
    },
    [runConfirm, setBanner, updateComment]
  )

  const onDelete = useCallback(
    async (id: string) => {
      const ok = await runConfirm('このコメントを削除しますか？\n元に戻せない場合があります。', {
        title: '削除',
        okText: '削除',
        danger: true,
      })
      if (!ok) return
      await updateComment(id, { deleted: true })
      setBanner('削除しました')
    },
    [runConfirm, setBanner, updateComment]
  )

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
  }, [cfg, cmsFetchJson, qContentId, qEpisodeId, qStatus, reloadSeq, setBanner])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <View style={{ flex: 1, gap: 6 } as any}>
          <Text style={styles.pageTitle}>コメント</Text>
          <Text style={styles.pageSubtitle ?? styles.pageLead}>確認・管理</Text>
        </View>
      </View>

      <Text style={styles.pageLead}>ユーザーが投稿したコメントを確認し、公開状態の管理や削除を行います。</Text>

      <CollapsibleSection
        title="検索"
        subtitle="条件"
        open={openSections.search}
        onToggle={() => setOpenSections((p) => ({ ...p, search: !p.search }))}
        styles={styles}
      >
        <View
          style={
            {
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 12,
              padding: 12,
              backgroundColor: COLORS.white,
              gap: 6,
            } as any
          }
        >
          <Text style={{ color: '#111827', fontSize: 13, fontWeight: '900' } as any}>現在の検索条件</Text>
          <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' } as any}>{`・ステータス: ${qStatusLabel}`}</Text>
          <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' } as any}>{`・作品ID（管理用ID）: ${qContentId.trim() ? qContentId.trim() : '未指定'}`}</Text>
          <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' } as any}>{`・エピソードID（動画 / 話数）: ${qEpisodeId.trim() ? qEpisodeId.trim() : '未指定'}`}</Text>
        </View>

        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' } as any}>※ IDが分からない場合は未入力のまま検索できます</Text>

        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>作品ID（管理用ID）</Text>
            <TextInput
              value={qContentId}
              onChangeText={setQContentId}
              placeholder="例）work_12345"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>エピソードID（動画 / 話数）</Text>
            <TextInput
              value={qEpisodeId}
              onChangeText={setQEpisodeId}
              placeholder="例）episode_01"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              autoCapitalize="none"
            />
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
      </CollapsibleSection>

      <CollapsibleSection
        title="一覧"
        subtitle={rows.length ? `${rows.length}件` : '—'}
        open={openSections.list}
        onToggle={() => setOpenSections((p) => ({ ...p, list: !p.list }))}
        styles={styles}
      >
        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' } as any}>
          ※ コメントを削除・非公開にすると、元に戻せない場合があります。内容を確認してから操作してください。
        </Text>

        {busy ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>読み込み中…</Text>
          </View>
        ) : null}

        {!busy && rows.length === 0 ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>コメントがありません</Text>
          </View>
        ) : null}

        <View style={{ gap: 12 } as any}>
          {rows.map((r) => {
            const statusText = commentStatusLabel(r.status)
            const badgeBg = r.status === 'approved' ? '#ecfdf5' : r.status === 'pending' ? '#fffbeb' : '#f3f4f6'
            const badgeBorder = r.status === 'approved' ? '#a7f3d0' : r.status === 'pending' ? '#fde68a' : '#e5e7eb'
            const badgeText = r.status === 'approved' ? '#047857' : r.status === 'pending' ? '#b45309' : '#374151'
            return (
              <View
                key={r.id}
                style={
                  {
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: COLORS.white,
                    gap: 10,
                  } as any
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 } as any}>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 } as any}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '900' } as any}>{r.targetTitle}</Text>
                    <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' } as any}>{`ユーザー: ${r.author || '—'}`}</Text>
                    <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' } as any}>{`投稿日: ${formatJaDateTime(r.createdAt, { withSeconds: true }) || '—'}`}</Text>
                  </View>

                  <View
                    style={
                      {
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: badgeBg,
                        borderWidth: 1,
                        borderColor: badgeBorder,
                      } as any
                    }
                  >
                    <Text style={{ color: badgeText, fontSize: 12, fontWeight: '900' } as any}>{statusText}</Text>
                  </View>
                </View>

                {r.body ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 } as any}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '800', lineHeight: 20 } as any}>
                      {`「${r.body}」`}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' } as any}>
                  <Pressable disabled={busy} onPress={() => onOpenEdit(r.id)} style={styles.smallBtnPrimary}>
                    <Text style={styles.smallBtnPrimaryText}>詳細を見る</Text>
                  </Pressable>
                  <Pressable disabled={busy || r.status === 'rejected'} onPress={() => void onUnpublish(r.id)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>非公開にする</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => void onDelete(r.id)} style={styles.smallBtnDanger}>
                    <Text style={styles.smallBtnDangerText}>削除</Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </View>
      </CollapsibleSection>
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
