import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { cmsFetchJson, type CmsApiConfig } from '../../lib/cmsApi'
import { SelectField } from '../../ui/fields'
import { CollapsibleSection } from '../../ui/CollapsibleSection'

export function InquiriesListScreen({ cfg, onOpenDetail }: { cfg: CmsApiConfig; onOpenDetail: (id: string) => void }) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Array<{ id: string; subject: string; status: string; createdAt?: string }>>([])

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ list: true })

  const statusLabel = useCallback((s: string) => {
    switch (String(s || '').toLowerCase()) {
      case 'open':
        return '未対応'
      case 'in_progress':
        return '対応中'
      case 'closed':
        return '完了'
      default:
        return s || '—'
    }
  }, [])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/inquiries')
        if (!mounted) return
        setRows(
          (json.items ?? []).map((r) => ({
            id: String(r.id ?? ''),
            subject: String(r.subject ?? ''),
            status: String(r.status ?? ''),
            createdAt: r.createdAt ? String(r.createdAt) : '',
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
  }, [cfg])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>お問い合わせ一覧</Text>

      <Text style={styles.pageSubtitle}>未対応を探す</Text>

      <CollapsibleSection
        title="一覧"
        subtitle="選んで詳細へ"
        open={openSections.list}
        onToggle={() => setOpenSections((p) => ({ ...p, list: !p.list }))}
      >
        <View style={styles.table}>
          {busy ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読み込み中…</Text>
            </View>
          ) : null}

          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.subject || '（件名なし）'}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${statusLabel(r.status)}`}</Text>
              </View>
            </Pressable>
          ))}

          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>お問い合わせがありません</Text>
            </View>
          ) : null}
        </View>
      </CollapsibleSection>
    </ScrollView>
  )
}

export function InquiryDetailScreen({ cfg, id, onBack }: { cfg: CmsApiConfig; id: string; onBack: () => void }) {
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('open')
  const [createdAt, setCreatedAt] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    content: true,
    status: true,
    internal: false,
  })

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/inquiries/${encodeURIComponent(id)}`)
        if (!mounted) return
        const item = json.item
        setSubject(String(item?.subject ?? ''))
        setBody(String(item?.body ?? ''))
        setStatus(String(item?.status ?? 'open'))
        setCreatedAt(String(item?.createdAt ?? ''))
        setUpdatedAt(String(item?.updatedAt ?? ''))
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

  const onSave = useCallback(() => {
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, `/cms/inquiries/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, id, status])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>お問い合わせ詳細</Text>
      </View>

      <Text style={styles.pageSubtitle}>内容と対応状況</Text>

      <CollapsibleSection
        title="内容"
        subtitle="問い合わせの本文"
        open={openSections.content}
        onToggle={() => setOpenSections((p) => ({ ...p, content: !p.content }))}
      >
        <View style={styles.field}>
          <Text style={styles.label}>件名</Text>
          <Text style={styles.readonlyText}>{subject || '—'}</Text>
        </View>

        {busy ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>読み込み中…</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>本文</Text>
          <Text style={styles.readonlyText}>{body || '—'}</Text>
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        title="対応状況"
        subtitle="ステータスを更新"
        open={openSections.status}
        onToggle={() => setOpenSections((p) => ({ ...p, status: !p.status }))}
      >
        <SelectField
          label="対応ステータス"
          value={status}
          placeholder="選択"
          options={[
            { label: '未対応', value: 'open' },
            { label: '対応中', value: 'in_progress' },
            { label: '完了', value: 'closed' },
          ]}
          onChange={setStatus}
        />

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        title="内部情報"
        subtitle="管理用"
        open={openSections.internal}
        onToggle={() => setOpenSections((p) => ({ ...p, internal: !p.internal }))}
      >
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>作成日時</Text>
          <Text style={styles.readonlyText}>{createdAt || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>更新日時</Text>
          <Text style={styles.readonlyText}>{updatedAt || '—'}</Text>
        </View>
      </CollapsibleSection>
    </ScrollView>
  )
}
