import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import type { RouteId } from '../lib/routes'
import { useBanner } from '../lib/banner'
import { cmsFetchJson, useCmsApi } from '../lib/cmsApi'
import { styles } from '../app/styles'

type KPIItem = {
  id: string
  label: string
  value: string
  route: RouteId
}

type ActivityItem = {
  id: string
  label: string
  detail: string
  pendingCount?: number
  route: RouteId
}

export function DashboardScreen({
  onNavigate,
  onOpenScheduledDetail,
}: {
  onNavigate: (id: RouteId) => void
  onOpenScheduledDetail?: (id: string) => void
}) {
  const cfg = useCmsApi()
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  const [scheduledRows, setScheduledRows] = useState<Array<{ id: string; title: string; scheduledAt: string; status: string }>>([])

  const [kpis, setKpis] = useState<KPIItem[]>(() => [
    { id: 'users_total', label: '総ユーザー数', value: '—', route: 'users' },
    { id: 'users_today', label: '本日の新規登録', value: '—', route: 'users' },
    { id: 'works_published', label: '公開中作品数', value: '—', route: 'works' },
    { id: 'videos_published', label: '公開中動画数', value: '—', route: 'videos' },
    { id: 'plays_today', label: '本日の再生回数', value: '—', route: 'videos' },
    { id: 'coins_spent_today', label: '本日のコイン消費', value: '—', route: 'coin' },
  ])

  const [activities, setActivities] = useState<ActivityItem[]>(() => [
    { id: 'a_unapproved_videos', label: '未承認動画', detail: '承認待ち', pendingCount: 0, route: 'unapproved-videos' },
    { id: 'a_unapproved_comments', label: '未承認コメント', detail: '承認待ち', pendingCount: 0, route: 'comments-pending' },
    { id: 'a_unapproved_actors', label: '未承認俳優アカウント', detail: '審査待ち', pendingCount: 0, route: 'unapproved-actor-accounts' },
  ])

  const shortcuts = useMemo<Array<{ id: string; label: string; route: RouteId }>>(
    () => [
      { id: 's_add_work', label: '作品を追加', route: 'works' },
      { id: 's_add_video', label: '動画を追加', route: 'videos' },
      { id: 's_comment_approve', label: 'コメント承認', route: 'comments-pending' },
      { id: 's_cast_register', label: 'キャスト登録', route: 'castStaff' },
      { id: 's_coin_withdraw', label: 'コイン換金処理', route: 'coin' },
      { id: 's_inquiries', label: 'お問い合わせ確認', route: 'inquiries' },
    ],
    []
  )

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const [summaryRes, videosRes, commentsRes, actorsRes, scheduledRes] = await Promise.allSettled([
          cmsFetchJson<any>(cfg, '/cms/dashboard/summary'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/videos/unapproved'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/comments?status=pending'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/cast-profiles/unapproved'),
          cmsFetchJson<{ items: any[] }>(cfg, '/cms/videos/scheduled'),
        ])
        if (!mounted) return

        if (summaryRes.status !== 'fulfilled') {
          throw summaryRes.reason
        }

        const summary = summaryRes.value
        const videos = videosRes.status === 'fulfilled' ? videosRes.value : { items: [] as any[] }
        const comments = commentsRes.status === 'fulfilled' ? commentsRes.value : { items: [] as any[] }
        const actors = actorsRes.status === 'fulfilled' ? actorsRes.value : { items: [] as any[] }
        const scheduled = scheduledRes.status === 'fulfilled' ? scheduledRes.value : { items: [] as any[] }

        setKpis([
          { id: 'users_total', label: '総ユーザー数', value: String(summary?.usersTotal ?? 0), route: 'users' },
          { id: 'users_today', label: '本日の新規登録', value: String(summary?.usersToday ?? 0), route: 'users' },
          { id: 'works_published', label: '公開中作品数', value: String(summary?.worksPublished ?? 0), route: 'works' },
          { id: 'videos_published', label: '公開中動画数', value: String(summary?.videosPublished ?? 0), route: 'videos' },
          { id: 'plays_today', label: '本日の再生回数', value: String(summary?.playsToday ?? 0), route: 'videos' },
          { id: 'coins_spent_today', label: '本日のコイン消費', value: String(summary?.coinsSpentToday ?? 0), route: 'coin' },
        ])

        setActivities([
          {
            id: 'a_unapproved_videos',
            label: '未承認動画',
            detail: '承認待ち',
            pendingCount: (videos.items || []).length,
            route: 'unapproved-videos',
          },
          {
            id: 'a_unapproved_comments',
            label: '未承認コメント',
            detail: '承認待ち',
            pendingCount: (comments.items || []).length,
            route: 'comments-pending',
          },
          {
            id: 'a_unapproved_actors',
            label: '未承認俳優アカウント',
            detail: '審査待ち',
            pendingCount: (actors.items || []).length,
            route: 'unapproved-actor-accounts',
          },
        ])

        setScheduledRows(
          (scheduled.items ?? []).map((r) => {
            const scheduledAtRaw = (r as any).scheduledAt
            const scheduledAt = scheduledAtRaw ? String(scheduledAtRaw).slice(0, 19).replace('T', ' ') : ''
            const status = String((r as any).status ?? 'scheduled')
            return {
              id: String((r as any).id ?? ''),
              title: String((r as any).title ?? ''),
              scheduledAt,
              status: status === 'cancelled' ? '取消' : '配信予約',
            }
          })
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
      <Text style={styles.pageTitle}>ダッシュボード</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>サマリー情報</Text>
        <View style={styles.kpiGrid}>
          {kpis.map((it) => (
            <Pressable key={it.id} onPress={() => onNavigate(it.route)} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{it.label}</Text>
              <Text style={styles.kpiValue}>{it.value}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.pageHeaderRow}>
          <Text style={styles.sectionTitle}>配信予定動画（直近）</Text>
          <Pressable onPress={() => onNavigate('videos-scheduled')} style={styles.smallBtnPrimary}>
            <Text style={styles.smallBtnPrimaryText}>一覧へ</Text>
          </Pressable>
        </View>

        <View style={styles.table}>
          {busy && scheduledRows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}

          {scheduledRows.slice(0, 5).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => (onOpenScheduledDetail ? onOpenScheduledDetail(r.id) : onNavigate('videos-scheduled'))}
              style={styles.tableRow}
            >
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.title || r.id}</Text>
                <Text style={styles.tableDetail}>{`${r.scheduledAt || '—'} / ${r.status}`}</Text>
              </View>
              <View style={styles.tableRight}>
                <Text style={styles.linkText}>詳細</Text>
              </View>
            </Pressable>
          ))}

          {!busy && scheduledRows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>配信予定がありません</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近のアクティビティ</Text>
        <View style={styles.table}>
          {busy && activities.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {activities.map((a) => (
            <Pressable key={a.id} onPress={() => onNavigate(a.route)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{a.label}</Text>
                <Text style={styles.tableDetail}>{a.detail}</Text>
              </View>
              <View style={styles.tableRight}>
                {typeof a.pendingCount === 'number' ? (
                  <Text style={[styles.pendingText, a.pendingCount > 0 ? styles.pendingTextEmph : null]}>未対応 {a.pendingCount}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>管理ショートカット</Text>
        <View style={styles.shortcutGrid}>
          {shortcuts.map((s) => (
            <Pressable key={s.id} onPress={() => onNavigate(s.route)} style={styles.shortcutCard}>
              <Text style={styles.shortcutText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}
