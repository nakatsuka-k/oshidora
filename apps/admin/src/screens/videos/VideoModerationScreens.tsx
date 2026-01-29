import { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { useBanner } from '../../lib/banner'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
  mock: boolean
}

type CmsFetchJson = <T = any>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

type ConfirmFn = (
  message: string,
  opts?: {
    title?: string
    okText?: string
    cancelText?: string
    danger?: boolean
  }
) => Promise<boolean>

type UnapprovedVideoRow = {
  id: string
  requestedAt: string
  title: string
  submitter: string
  desiredScheduledAt: string
  status: '未承認'
}

type UnapprovedActorAccountRow = {
  id: string
  submittedAt: string
  name: string
  email: string
  status: '未承認'
}

export function UnapprovedActorAccountsListScreen({
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
  const [rows, setRows] = useState<UnapprovedActorAccountRow[]>([])
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<{ id: string; name: string; email: string; submittedAt: string; status: string }> }>(
          cfg,
          '/cms/cast-profiles/unapproved'
        )
        if (!mounted) return
        setRows(
          (json.items || []).map((r) => ({
            id: String(r.id ?? ''),
            submittedAt: (String((r as any).submittedAt ?? '') || '').slice(0, 19).replace('T', ' ') || '—',
            name: String(r.name ?? '') || '—',
            email: String(r.email ?? '') || '—',
            status: '未承認',
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
  }, [cfg, cmsFetchJson])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>未承認俳優アカウント一覧</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>未承認アカウントはありません</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{`${r.submittedAt} / ${r.email} / ${r.status}`}</Text>
              </View>
              <View style={styles.tableRight}>
                <Text style={styles.linkText}>詳細</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

export function UnapprovedActorAccountDetailScreen({
  cfg,
  cmsFetchJson,
  confirm,
  styles,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  confirm: ConfirmFn
  styles: any
  id: string
  onBack: () => void
}) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState<null | { id: string; name: string; email: string; submittedAt: string; draft: any }>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/cast-profiles/unapproved/${encodeURIComponent(id)}`)
        if (!mounted) return
        setItem({
          id: String(json.item?.id ?? ''),
          name: String(json.item?.name ?? ''),
          email: String(json.item?.email ?? ''),
          submittedAt: String(json.item?.submittedAt ?? ''),
          draft: json.item?.draft ?? null,
        })
        setRejectReason(String(json.item?.rejectionReason ?? ''))
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

  const approve = useCallback(async () => {
    const ok = await confirm('この俳優アカウントを承認しますか？', { title: '承認' })
    if (!ok) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/cast-profiles/unapproved/${encodeURIComponent(id)}/approve`, { method: 'POST' })
        onBack()
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, confirm, id, onBack])

  const reject = useCallback(async () => {
    const reason = rejectReason.trim()
    if (!reason) {
      setBanner('否認コメントを入力してください')
      return
    }
    const ok = await confirm('この俳優アカウントを否認しますか？', { title: '否認', danger: true, okText: '否認' })
    if (!ok) return

    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/cast-profiles/unapproved/${encodeURIComponent(id)}/reject`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
        onBack()
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, confirm, id, onBack, rejectReason])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>俳優アカウント詳細</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>申請情報</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>氏名</Text>
          <Text style={styles.readonlyText}>{item?.name || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>メール</Text>
          <Text style={styles.readonlyText}>{item?.email || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>申請日時</Text>
          <Text style={styles.readonlyText}>{(item?.submittedAt || '').slice(0, 19).replace('T', ' ') || '—'}</Text>
        </View>
        {item?.draft ? (
          <View style={styles.field}>
            <Text style={styles.label}>申請内容（JSON）</Text>
            <Text style={styles.readonlyText}>{JSON.stringify(item.draft)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>操作</Text>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={() => void approve()} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '処理中…' : '承認'}</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>否認コメント（必須）</Text>
          <TextInput value={rejectReason} onChangeText={setRejectReason} style={[styles.input, { minHeight: 90 }]} multiline />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={() => void reject()} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>{busy ? '処理中…' : '否認'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

export function UnapprovedVideosListScreen({
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
  const [rows, setRows] = useState<UnapprovedVideoRow[]>([])
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{
          items: Array<{ id: string; title: string; approvalRequestedAt: string | null; scheduledAt: string | null; submitterEmail: string }>
        }>(cfg, '/cms/videos/unapproved')
        if (!mounted) return
        setRows(
          json.items.map((v) => ({
            id: v.id,
            requestedAt: (v.approvalRequestedAt || '').slice(0, 19).replace('T', ' ') || '—',
            title: v.title || '—',
            submitter: v.submitterEmail || '—',
            desiredScheduledAt: (v.scheduledAt || '').slice(0, 19).replace('T', ' ') || '—',
            status: '未承認',
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
  }, [cfg, cmsFetchJson])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>未承認動画一覧</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>未承認動画はありません</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.title}</Text>
                <Text style={styles.tableDetail}>{`${r.requestedAt} / ${r.submitter} / 希望: ${r.desiredScheduledAt} / ${r.status}`}</Text>
              </View>
              <View style={styles.tableRight}>
                <Text style={styles.linkText}>詳細</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

export function UnapprovedVideoDetailScreen({
  cfg,
  cmsFetchJson,
  confirm,
  styles,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  confirm: ConfirmFn
  styles: any
  id: string
  onBack: () => void
}) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [item, setItem] = useState<
    | null
    | {
        id: string
        title: string
        description: string
        submitterEmail: string
        approvalRequestedAt: string | null
        scheduledAt: string | null
        thumbnailUrl: string
        streamVideoId: string
      }
  >(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/videos/unapproved/${encodeURIComponent(id)}`)
        if (!mounted) return
        setItem({
          id: String(json.item?.id ?? ''),
          title: String(json.item?.title ?? ''),
          description: String(json.item?.description ?? ''),
          submitterEmail: String(json.item?.submitterEmail ?? ''),
          approvalRequestedAt: json.item?.approvalRequestedAt ?? null,
          scheduledAt: json.item?.scheduledAt ?? null,
          thumbnailUrl: String(json.item?.thumbnailUrl ?? ''),
          streamVideoId: String(json.item?.streamVideoId ?? ''),
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
  }, [cfg, cmsFetchJson, id])

  const approve = useCallback(async () => {
    const ok = await confirm('この動画を承認しますか？', { title: '承認' })
    if (!ok) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/unapproved/${encodeURIComponent(id)}/approve`, { method: 'POST' })
        onBack()
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, confirm, id, onBack])

  const reject = useCallback(async () => {
    const reason = rejectReason.trim()
    if (!reason) {
      setBanner('否認理由を入力してください')
      return
    }
    const ok = await confirm('この動画を否認しますか？', { title: '否認', danger: true, okText: '否認' })
    if (!ok) return

    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/unapproved/${encodeURIComponent(id)}/reject`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
        onBack()
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, confirm, id, onBack, rejectReason])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>未承認動画 詳細</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>動画情報</Text>
        <View style={styles.field}>
          <Text style={styles.label}>動画ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>タイトル</Text>
          <Text style={styles.readonlyText}>{item?.title || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <Text style={styles.readonlyText}>{item?.description || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>提出者</Text>
          <Text style={styles.readonlyText}>{item?.submitterEmail || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>承認依頼日</Text>
          <Text style={styles.readonlyText}>{(item?.approvalRequestedAt || '').slice(0, 19).replace('T', ' ') || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>配信希望日</Text>
          <Text style={styles.readonlyText}>{(item?.scheduledAt || '').slice(0, 19).replace('T', ' ') || '—'}</Text>
        </View>
        {item?.thumbnailUrl ? (
          <View style={styles.field}>
            <Text style={styles.label}>サムネ</Text>
            <Image source={{ uri: item.thumbnailUrl }} style={{ width: 240, height: 135, borderRadius: 8, backgroundColor: '#111' }} />
          </View>
        ) : null}
        {item?.streamVideoId ? (
          <View style={styles.field}>
            <Text style={styles.label}>Stream Video ID</Text>
            <Text style={styles.readonlyText}>{item.streamVideoId}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>操作</Text>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={() => void approve()} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '処理中…' : '承認'}</Text>
          </Pressable>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>否認理由（必須）</Text>
          <TextInput value={rejectReason} onChangeText={setRejectReason} style={[styles.input, { minHeight: 90 }]} multiline />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={() => void reject()} style={[styles.btnSecondary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnSecondaryText}>{busy ? '処理中…' : '否認'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

type ScheduledVideoRow = { id: string; title: string; scheduledAt: string; status: '配信予約' | '取消' }

export function ScheduledVideosListScreen({
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
  const [rows, setRows] = useState<ScheduledVideoRow[]>([])

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: Array<{ id: string; title: string; scheduledAt: string | null; status: string }> }>(
        cfg,
        '/cms/videos/scheduled'
      )
      setRows(
        (json.items ?? []).map((r) => {
          const status = String((r as any).status ?? 'scheduled')
          const scheduledAtRaw = (r as any).scheduledAt
          const scheduledAt = scheduledAtRaw ? String(scheduledAtRaw).slice(0, 19).replace('T', ' ') : ''
          return {
            id: String((r as any).id ?? ''),
            title: String((r as any).title ?? ''),
            scheduledAt,
            status: status === 'cancelled' ? '取消' : '配信予約',
          }
        })
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg, cmsFetchJson])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>配信予定動画一覧</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {busy ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.title}</Text>
                <Text style={styles.tableDetail}>{`${r.scheduledAt} / ${r.status}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>配信予定がありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

export function ScheduledVideoDetailScreen({
  cfg,
  cmsFetchJson,
  styles,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  styles: any
  id: string
  onBack: () => void
}) {
  const [scheduledAt, setScheduledAt] = useState('')
  const [canceled, setCanceled] = useState(false)
  const [title, setTitle] = useState('')
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/videos/scheduled/${encodeURIComponent(id)}`)
        if (!mounted) return
        const it = json.item
        setTitle(String(it?.title ?? ''))
        setScheduledAt(it?.scheduledAt ? String(it.scheduledAt).slice(0, 19).replace('T', ' ') : '')
        setCanceled(String(it?.status ?? 'scheduled') === 'cancelled')
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

  const onSave = useCallback(() => {
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/videos/scheduled/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scheduledAt: scheduledAt.trim() || null, status: canceled ? 'cancelled' : 'scheduled' }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [canceled, cfg, cmsFetchJson, id, scheduledAt])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>配信予定動画 詳細・編集</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>表示/編集</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>タイトル</Text>
          <Text style={styles.readonlyText}>{title || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>配信予定日時</Text>
          <TextInput value={scheduledAt} onChangeText={setScheduledAt} style={styles.input} />
        </View>
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>配信キャンセル</Text>
          <Switch value={canceled} onValueChange={setCanceled} />
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
