import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { useBanner } from '../../lib/banner'
import { cmsFetchJson, useCmsApi } from '../../lib/cmsApi'
import { SelectField } from '../../ui/fields'
import { COLORS, styles } from '../../ui/styles'
import { formatJaDateTime } from '../../utils/datetime'

type UserRow = {
  id: string
  name: string
  email: string
  createdAt: string
  kind: 'user' | 'cast'
  isSubscribed: boolean
  subscriptionStatus: string
  permission: 'admin' | 'user'
}

export function UsersListScreen({
  onOpenDetail,
  onOpenEdit,
  onNew,
}: {
  onOpenDetail: (id: string) => void
  onOpenEdit: (id: string) => void
  onNew?: () => void
}) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<UserRow[]>([])

  const [total, setTotal] = useState(0)

  const [qText, setQText] = useState('')
  const [qTextDebounced, setQTextDebounced] = useState('')
  const [qKind, setQKind] = useState<'' | 'user' | 'cast'>('')
  const [qPermission, setQPermission] = useState<'' | 'admin' | 'user'>('')
  const [qSubscribed, setQSubscribed] = useState<'' | '1' | '0'>('')
  const [qSubscriptionStatus, setQSubscriptionStatus] = useState<'' | 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete'>('')

  const [qSortBy, setQSortBy] = useState<'createdAt' | 'name' | 'email' | 'subscribed' | 'permission' | 'isCast'>('createdAt')
  const [qSortDir, setQSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const t = setTimeout(() => setQTextDebounced(qText), 300)
    return () => clearTimeout(t)
  }, [qText])

  const setSort = useCallback((by: 'createdAt' | 'name' | 'email' | 'subscribed' | 'permission' | 'isCast') => {
    setQSortBy((prev) => {
      if (prev !== by) {
        setQSortDir('desc')
        return by
      }
      setQSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return prev
    })
  }, [])

  const sortMark = useCallback(
    (by: 'createdAt' | 'name' | 'email' | 'subscribed' | 'permission' | 'isCast') => {
      if (qSortBy !== by) return ''
      return qSortDir === 'asc' ? ' ▲' : ' ▼'
    },
    [qSortBy, qSortDir]
  )

  const dateLabel = useCallback((v: string) => {
    return formatJaDateTime(v) || ''
  }, [])

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const params = new URLSearchParams()
      if (qTextDebounced.trim()) params.set('q', qTextDebounced.trim())
      if (qKind) params.set('kind', qKind)
      if (qPermission) params.set('permission', qPermission)
      if (qSubscribed) params.set('subscribed', qSubscribed)
      if (qSubscriptionStatus) params.set('subscriptionStatus', qSubscriptionStatus)
      params.set('sortBy', qSortBy)
      params.set('sortDir', qSortDir)
      const qs = params.toString()
      const path = qs ? `/cms/users?${qs}` : '/cms/users'

      const json = await cmsFetchJson<{ items: Array<any>; total?: unknown }>(cfg, path)
      const items = Array.isArray(json.items) ? json.items : []
      setTotal(Number((json as any).total ?? items.length) || 0)
      setRows(
        items.map((u: any) => ({
          id: String(u?.id ?? ''),
          name: String(u?.name ?? ''),
          email: String(u?.email ?? ''),
          createdAt: String(u?.createdAt ?? ''),
          kind: String(u?.kind ?? 'user') === 'cast' ? 'cast' : 'user',
          isSubscribed: Boolean(u?.isSubscribed),
          subscriptionStatus: String(u?.subscriptionStatus ?? ''),
          permission: String(u?.permission ?? 'user') === 'admin' ? 'admin' : 'user',
        }))
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg, qKind, qPermission, qSortBy, qSortDir, qSubscribed, qSubscriptionStatus, qTextDebounced, setBanner])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>ユーザー一覧</Text>
        {onNew ? (
          <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
            <Text style={styles.smallBtnPrimaryText}>新規作成</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>フィルタ</Text>
        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>検索（名前 / メール）</Text>
            <TextInput
              value={qText}
              onChangeText={setQText}
              placeholder="user@example.com"
              placeholderTextColor={COLORS.placeholder}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
          <SelectField
            label="キャスト"
            value={qKind}
            placeholder="すべて"
            options={[
              { label: 'すべて', value: '' },
              { label: '一般ユーザー', value: 'user' },
              { label: 'キャスト', value: 'cast' },
            ]}
            onChange={(v) => setQKind(v as any)}
          />
          <SelectField
            label="権限"
            value={qPermission}
            placeholder="すべて"
            options={[
              { label: 'すべて', value: '' },
              { label: '管理人', value: 'admin' },
              { label: '一般', value: 'user' },
            ]}
            onChange={(v) => setQPermission(v as any)}
          />
          <SelectField
            label="サブスク"
            value={qSubscribed}
            placeholder="すべて"
            options={[
              { label: 'すべて', value: '' },
              { label: '有効', value: '1' },
              { label: 'なし', value: '0' },
            ]}
            onChange={(v) => setQSubscribed(v as any)}
          />
          <SelectField
            label="Stripe状態"
            value={qSubscriptionStatus}
            placeholder="すべて"
            options={[
              { label: 'すべて', value: '' },
              { label: 'active', value: 'active' },
              { label: 'trialing', value: 'trialing' },
              { label: 'past_due', value: 'past_due' },
              { label: 'incomplete', value: 'incomplete' },
              { label: 'canceled', value: 'canceled' },
            ]}
            onChange={(v) => setQSubscriptionStatus(v as any)}
          />
        </View>
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={() => void load()} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '読込中…' : '更新'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setQText('')
              setQKind('')
              setQPermission('')
              setQSubscribed('')
              setQSubscriptionStatus('')
              setQSortBy('createdAt')
              setQSortDir('desc')
            }}
            style={styles.btnSecondary}
          >
            <Text style={styles.btnSecondaryText}>リセット</Text>
          </Pressable>
        </View>
        <Text style={styles.miniHelpText}>{`件数: ${total}（表示: ${rows.length}） / カラム名クリックでソート`}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Pressable onPress={() => setSort('name')} style={[styles.tableHeaderCell, styles.colName]}>
              <Text style={styles.tableHeaderText}>{`名前${sortMark('name')}`}</Text>
            </Pressable>
            <Pressable onPress={() => setSort('email')} style={[styles.tableHeaderCell, styles.colEmail]}>
              <Text style={styles.tableHeaderText}>{`メール${sortMark('email')}`}</Text>
            </Pressable>
            <Pressable onPress={() => setSort('createdAt')} style={[styles.tableHeaderCell, styles.colCreatedAt]}>
              <Text style={styles.tableHeaderText}>{`日付${sortMark('createdAt')}`}</Text>
            </Pressable>
            <Pressable onPress={() => setSort('subscribed')} style={[styles.tableHeaderCell, styles.colSubscribed]}>
              <Text style={styles.tableHeaderText}>{`サブスク${sortMark('subscribed')}`}</Text>
            </Pressable>
            <Pressable onPress={() => setSort('permission')} style={[styles.tableHeaderCell, styles.colPermission]}>
              <Text style={styles.tableHeaderText}>{`権限${sortMark('permission')}`}</Text>
            </Pressable>
            <Pressable onPress={() => setSort('isCast')} style={[styles.tableHeaderCell, styles.colCast]}>
              <Text style={styles.tableHeaderText}>{`キャスト${sortMark('isCast')}`}</Text>
            </Pressable>
            <View style={[styles.tableHeaderCell, styles.colActions]}>
              <Text style={styles.tableHeaderText}>操作</Text>
            </View>
          </View>
          {busy ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読み込み中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <View key={r.id} style={styles.tableRow}>
              <View style={styles.tableRowInner}>
                <View style={styles.colName}>
                  <Text style={styles.tableCellText} numberOfLines={1}>
                    {r.name || '—'}
                  </Text>
                </View>
                <View style={styles.colEmail}>
                  <Text style={styles.tableCellText} numberOfLines={1}>
                    {r.email || '—'}
                  </Text>
                </View>
                <View style={styles.colCreatedAt}>
                  <Text style={styles.tableCellText} numberOfLines={1}>
                    {dateLabel(r.createdAt) || '—'}
                  </Text>
                </View>
                <View style={styles.colSubscribed}>
                  <Text style={styles.tableCellText} numberOfLines={1}>
                    {r.isSubscribed ? '有効' : 'なし'}
                  </Text>
                  {r.subscriptionStatus ? (
                    <Text style={styles.tableDetail} numberOfLines={1}>
                      {r.subscriptionStatus}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.colPermission}>
                  <Text style={styles.tableCellText} numberOfLines={1}>
                    {r.permission === 'admin' ? '管理人' : '一般'}
                  </Text>
                </View>
                <View style={styles.colCast}>
                  <Text style={styles.tableCellText} numberOfLines={1}>
                    {r.kind === 'cast' ? 'はい' : 'いいえ'}
                  </Text>
                </View>
                <View style={styles.colActions}>
                  <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' } as any}>
                    <Pressable onPress={() => onOpenDetail(r.id)} style={styles.smallBtn}>
                      <Text style={styles.smallBtnText}>詳細</Text>
                    </Pressable>
                    <Pressable onPress={() => onOpenEdit(r.id)} style={styles.smallBtnPrimary}>
                      <Text style={styles.smallBtnPrimaryText}>編集</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>ユーザーがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}
