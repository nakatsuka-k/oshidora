import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

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

type CsvToIdListFn = (csv: string) => string[]

type SelectFieldComponent = (props: any) => any

type NoticeStatus = 'draft' | 'scheduled' | 'sent' | 'cancelled'

type NoticeRow = {
  id: string
  subject: string
  body: string
  createdByLabel: string
  sentAt: string
  status: NoticeStatus
  push: boolean
  tags: string[]
}

function noticeStatusLabel(v: NoticeStatus): string {
  switch (v) {
    case 'draft':
      return '下書き'
    case 'scheduled':
      return '予約'
    case 'sent':
      return '送信済み'
    case 'cancelled':
      return '取消'
    default:
      return '下書き'
  }
}

export function NoticesListScreen({
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
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<NoticeRow[]>([])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: Array<any> }>(cfg, '/cms/notices')
        if (!mounted) return
        setRows(
          (json.items ?? []).map((n) => ({
            id: String(n.id ?? ''),
            subject: String(n.subject ?? ''),
            body: String((n as any).body ?? ''),
            createdByLabel: (() => {
              const cb = (n as any).createdBy
              const email = cb?.email ? String(cb.email) : ''
              const name = cb?.name ? String(cb.name) : ''
              const id = cb?.id ? String(cb.id) : ''
              const label = name || email || id
              return label ? `登録者: ${label}` : ''
            })(),
            sentAt: String((n as any).sentAt ?? ''),
            status: (String((n as any).status ?? 'draft') as NoticeStatus) || 'draft',
            push: Boolean((n as any).push),
            tags: Array.isArray((n as any).tags) ? (n as any).tags.map((t: any) => String(t ?? '').trim()).filter(Boolean) : [],
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
        <Text style={styles.pageTitle}>お知らせ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規作成</Text>
        </Pressable>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

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
                <Text style={styles.tableLabel}>{r.subject}</Text>
                <Text
                  style={styles.tableDetail}
                >{`${r.sentAt || '—'} / ${noticeStatusLabel(r.status)}${r.tags.length ? ` / タグ: ${r.tags.join(',')}` : ''}`}</Text>
                {r.createdByLabel ? <Text style={styles.tableDetail}>{r.createdByLabel}</Text> : null}
                {r.body ? (
                  <Text style={styles.tableDetail}>{`本文: ${r.body.slice(0, 80)}${r.body.length > 80 ? '…' : ''}`}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>お知らせがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

export function NoticeEditScreen({
  cfg,
  cmsFetchJson,
  confirm,
  csvToIdList,
  styles,
  SelectField,
  title,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  confirm: ConfirmFn
  csvToIdList: CsvToIdListFn
  styles: any
  SelectField: SelectFieldComponent
  title: string
  id: string
  onBack: () => void
}) {
  const noticeTagTemplates = useMemo(() => ['お知らせ', 'メンテナンス'], [])
  const [sentAt, setSentAt] = useState('2026-01-12 03:00')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [tagsCsv, setTagsCsv] = useState('')
  const [push, setPush] = useState(false)
  const [pushTitle, setPushTitle] = useState('')
  const [pushBody, setPushBody] = useState('')

  const [mailEnabled, setMailEnabled] = useState(false)
  const [mailFormat, setMailFormat] = useState<'text' | 'html'>('text')
  const [mailText, setMailText] = useState('')
  const [mailHtml, setMailHtml] = useState('')
  const [status, setStatus] = useState<NoticeStatus>('draft')

  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const appliedTags = useMemo(() => csvToIdList(tagsCsv), [csvToIdList, tagsCsv])
  const addTemplateTag = useCallback(
    (tag: string) => {
      const next = Array.from(new Set([...appliedTags, tag]))
      setTagsCsv(next.join(','))
    },
    [appliedTags]
  )

  useEffect(() => {
    if (!id) {
      setSentAt('')
      setSubject('')
      setBody('')
      setTagsCsv('')
      setPush(false)
      setPushTitle('')
      setPushBody('')
      setMailEnabled(false)
      setMailFormat('text')
      setMailText('')
      setMailHtml('')
      setStatus('draft')
      return
    }

    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/notices/${encodeURIComponent(id)}`)
        if (!mounted) return
        const n = json.item
        setSentAt(String(n?.sentAt ?? ''))
        setSubject(String(n?.subject ?? ''))
        setBody(String(n?.body ?? ''))
        setPush(Boolean(n?.push))
        setTagsCsv(Array.isArray(n?.tags) ? (n.tags as any[]).map((t) => String(t ?? '').trim()).filter(Boolean).join(',') : '')
        setPushTitle(String(n?.pushTitle ?? ''))
        setPushBody(String(n?.pushBody ?? ''))
        setMailEnabled(Boolean(n?.mailEnabled))
        setMailFormat(((String(n?.mailFormat ?? 'text') as any) === 'html' ? 'html' : 'text') as 'text' | 'html')
        setMailText(String(n?.mailText ?? ''))
        setMailHtml(String(n?.mailHtml ?? ''))
        setStatus((String(n?.status ?? 'draft') as NoticeStatus) || 'draft')
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
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const payload = {
          sentAt,
          subject,
          body,
          push,
          tags: csvToIdList(tagsCsv),
          pushTitle,
          pushBody,
          mailEnabled,
          mailFormat,
          mailText,
          mailHtml,
          status,
        }
        if (id) {
          await cmsFetchJson(cfg, `/cms/notices/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/notices', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [body, cfg, cmsFetchJson, csvToIdList, id, mailEnabled, mailFormat, mailHtml, mailText, onBack, push, pushBody, pushTitle, sentAt, status, subject, tagsCsv])

  const onSendEmailNow = useCallback(() => {
    if (!id) {
      setBanner('先に保存してください')
      return
    }
    void (async () => {
      const ok = await confirm('メール送信を実行しますか？（対象: メール認証済みユーザー、上限50件）', {
        title: 'メール送信',
        okText: '送信',
      })
      if (!ok) return

      setBusy(true)
      setBanner('')
      try {
        const json = await cmsFetchJson<any>(cfg, `/cms/notices/${encodeURIComponent(id)}/send-email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limit: 50 }),
        })
        const sent = typeof json?.sent === 'number' ? json.sent : 0
        const recipients = typeof json?.recipients === 'number' ? json.recipients : 0
        const warning = json?.warning ? `（${String(json.warning)}）` : ''
        setBanner(`メール送信: ${sent}/${recipients} ${warning}`.trim())
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, confirm, id])

  const onSendPushNow = useCallback(() => {
    if (!id) {
      setBanner('先に保存してください')
      return
    }
    void (async () => {
      const ok = await confirm('プッシュ送信を実行しますか？', { title: 'プッシュ送信', okText: '送信' })
      if (!ok) return

      setBusy(true)
      setBanner('')
      try {
        const json = await cmsFetchJson<any>(cfg, `/cms/notices/${encodeURIComponent(id)}/send-push`, {
          method: 'POST',
        })
        const warning = json?.warning ? `（${String(json.warning)}）` : ''
        setBanner(`プッシュ送信: OK ${warning}`.trim())
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, cmsFetchJson, confirm, id])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        <SelectField
          label="ステータス"
          value={status}
          placeholder="選択"
          options={[
            { label: '下書き', value: 'draft' },
            { label: '予約', value: 'scheduled' },
            { label: '送信済み', value: 'sent' },
            { label: '取消', value: 'cancelled' },
          ]}
          onChange={(v: any) => setStatus(v as NoticeStatus)}
        />
        <View style={styles.field}>
          <Text style={styles.label}>配信日時</Text>
          <TextInput value={sentAt} onChangeText={setSentAt} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>件名</Text>
          <TextInput value={subject} onChangeText={setSubject} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>本文</Text>
          <TextInput value={body} onChangeText={setBody} style={[styles.input, { minHeight: 160 }]} multiline />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>カテゴリ（タグ）</Text>
          <View style={styles.tagTemplateRow}>
            {noticeTagTemplates.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => addTemplateTag(tag)}
                style={[styles.tagTemplateButton, appliedTags.includes(tag) ? styles.tagTemplateButtonActive : null]}
              >
                <Text style={[styles.tagTemplateText, appliedTags.includes(tag) ? styles.tagTemplateTextActive : null]}>{tag}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={tagsCsv} onChangeText={setTagsCsv} placeholder="例: お知らせ,メンテナンス" style={styles.input} />
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>プッシュ通知送信</Text>
          <Switch value={push} onValueChange={setPush} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>プッシュ通知タイトル</Text>
          <TextInput value={pushTitle} onChangeText={setPushTitle} placeholder="（未入力なら件名）" style={styles.input} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>プッシュ通知本文</Text>
          <TextInput
            value={pushBody}
            onChangeText={setPushBody}
            placeholder="（未入力なら本文）"
            style={[styles.input, { minHeight: 80 }]}
            multiline
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>メール</Text>
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>メール送信</Text>
            <Switch value={mailEnabled} onValueChange={setMailEnabled} />
          </View>

          <SelectField
            label="メール形式"
            value={mailFormat}
            placeholder="選択"
            options={[
              { label: 'テキスト', value: 'text' },
              { label: 'HTML', value: 'html' },
            ]}
            onChange={(v: any) => setMailFormat(v as 'text' | 'html')}
          />

          <View style={styles.field}>
            <Text style={styles.label}>メール本文（テキスト）</Text>
            <TextInput value={mailText} onChangeText={setMailText} style={[styles.input, { minHeight: 120 }]} multiline />
          </View>

          {mailFormat === 'html' ? (
            <View style={styles.field}>
              <Text style={styles.label}>メール本文（HTML）</Text>
              <TextInput value={mailHtml} onChangeText={setMailHtml} style={[styles.input, { minHeight: 120 }]} multiline />
            </View>
          ) : null}
        </View>

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>

          <Pressable
            disabled={busy || !id}
            onPress={onSendEmailNow}
            style={[styles.btnSecondary, busy || !id ? styles.btnDisabled : null]}
          >
            <Text style={styles.btnSecondaryText}>メール送信</Text>
          </Pressable>

          <Pressable
            disabled={busy || !id}
            onPress={onSendPushNow}
            style={[styles.btnSecondary, busy || !id ? styles.btnDisabled : null]}
          >
            <Text style={styles.btnSecondaryText}>プッシュ送信</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}
