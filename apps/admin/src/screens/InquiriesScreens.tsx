import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { SelectField } from '../app/components/SelectField'
import { styles } from '../app/styles'
import { useBanner } from '../lib/banner'
import { cmsFetchJson, useCmsApi } from '../lib/cmsApi'

export function InquiriesListScreen({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const cfg = useCmsApi()
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Array<{ id: string; subject: string; status: string; createdAt?: string }>>([])

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
    </ScrollView>
  )
}

export function InquiryDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const cfg = useCmsApi()
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('open')
  const [createdAt, setCreatedAt] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')

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
        await cmsFetchJson(cfg, `/cms/inquiries/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status }),
          }
        )
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>内容</Text>
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{id || '—'}</Text>
        </View>

        {busy ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>読み込み中…</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>件名</Text>
          <Text style={styles.readonlyText}>{subject || '—'}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>本文</Text>
          <Text style={styles.readonlyText}>{body || '—'}</Text>
        </View>

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

        <View style={styles.field}>
          <Text style={styles.label}>作成日時</Text>
          <Text style={styles.readonlyText}>{createdAt || '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>更新日時</Text>
          <Text style={styles.readonlyText}>{updatedAt || '—'}</Text>
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
