import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { cmsFetchJson, useCmsApi } from '../../lib/cmsApi'
import { useBanner } from '../../lib/banner'
import { FixedBottomBar } from '../../ui/FixedBottomBar'
import { styles } from '../../ui/styles'

export function UserDetailScreen({
  id,
  onBack,
  startInEdit,
}: {
  id: string
  onBack: () => void
  startInEdit?: boolean
}) {
  const cfg = useCmsApi()
  const [banner, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  type FavoriteCastItem = {
    castId: string
    name: string
    role: string
    thumbnailUrl: string
    favoritedAt: string
  }

  type WatchHistoryItem = {
    videoId: string
    videoTitle: string
    workId: string
    workTitle: string
    watchedAt: string
  }

  type CommentHistoryItem = {
    id: string
    contentId: string
    contentTitle: string
    episodeId: string
    author: string
    body: string
    status: string
    createdAt: string
  }

  type UserDetailItem = {
    id: string
    email: string
    emailVerified: boolean
    phone: string
    phoneVerified: boolean
    smsAuthSkip: boolean
    createdAt: string
    updatedAt: string
    isSubscribed: boolean
    subscription: {
      status: string
      startedAt: string | null
      endedAt: string | null
      stripeCustomerId: string | null
      stripeSubscriptionId: string | null
    }
    profile: {
      displayName: string
      avatarUrl: string
      fullName: string
      fullNameKana: string
      birthDate: string
      favoriteGenres: string[]
    }
    coins: {
      acquiredTotal: number | null
      balance: number | null
      spentTotal: number
    }
    favorites: {
      casts: FavoriteCastItem[]
      videos: Array<any>
    }
    watchHistory: WatchHistoryItem[]
    comments: {
      inferredByAuthorMatch: boolean
      items: CommentHistoryItem[]
    }
    castProfile:
      | null
      | {
          requestId: string
          name: string
          email: string
          submittedAt: string
          decidedAt: string | null
          decidedByAdminId: string | null
          draft: any
        }
  }

  const [item, setItem] = useState<null | UserDetailItem>(null)

  const [editMode, setEditMode] = useState(Boolean(startInEdit))
  const [editEmail, setEditEmail] = useState('')
  const [editEmailVerified, setEditEmailVerified] = useState(false)
  const [editPhone, setEditPhone] = useState('')
  const [editPhoneVerified, setEditPhoneVerified] = useState(false)
  const [editSmsAuthSkip, setEditSmsAuthSkip] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const [editFullName, setEditFullName] = useState('')
  const [editFullNameKana, setEditFullNameKana] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [editFavoriteGenres, setEditFavoriteGenres] = useState('')

  const resetFormFromItem = useCallback((u: UserDetailItem | null) => {
    if (!u) return
    setEditEmail(String(u.email ?? ''))
    setEditEmailVerified(Boolean(u.emailVerified))
    setEditPhone(String(u.phone ?? ''))
    setEditPhoneVerified(Boolean(u.phoneVerified))
    setEditSmsAuthSkip(Boolean(u.smsAuthSkip))
    setEditDisplayName(String(u.profile?.displayName ?? ''))
    setEditAvatarUrl(String(u.profile?.avatarUrl ?? ''))
    setEditFullName(String(u.profile?.fullName ?? ''))
    setEditFullNameKana(String(u.profile?.fullNameKana ?? ''))
    setEditBirthDate(String(u.profile?.birthDate ?? ''))
    setEditFavoriteGenres(Array.isArray(u.profile?.favoriteGenres) ? u.profile.favoriteGenres.join('\n') : '')
  }, [])

  const dateLabel = useCallback((iso: string) => {
    const s = String(iso ?? '')
    if (!s) return ''
    return s.length >= 19 ? s.replace('T', ' ').slice(0, 19) : s
  }, [])

  const safeText = useCallback((v: unknown) => {
    const s = String(v ?? '')
    return s.trim() ? s : '—'
  }, [])

  const prettyDraft = useCallback((draft: any): string => {
    if (!draft || typeof draft !== 'object') return ''
    const lines: string[] = []
    const push = (label: string, value: unknown) => {
      const s =
        Array.isArray(value)
          ? value
              .map((x) => String(x ?? '').trim())
              .filter(Boolean)
              .join(' / ')
          : String(value ?? '').trim()
      if (s) lines.push(`${label}: ${s}`)
    }

    push('所属/事務所', (draft as any).affiliation ?? (draft as any).agency ?? '')
    push('管理者', (draft as any).manager ?? (draft as any).admin ?? '')
    push('ジャンル', (draft as any).genres ?? '')
    push('出演作品', (draft as any).representativeWorks ?? (draft as any).works ?? '')
    push('自己PR', (draft as any).selfPr ?? '')
    push('プロフィール', (draft as any).biography ?? '')
    return lines.join('\n')
  }, [])

  useEffect(() => {
    if (!id) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: UserDetailItem }>(cfg, `/cms/users/${encodeURIComponent(id)}`)
        if (!mounted) return
        setItem(json.item)
        if (startInEdit) {
          resetFormFromItem(json.item)
          setEditMode(true)
        } else {
          setEditMode(false)
        }
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
  }, [cfg, id, resetFormFromItem, startInEdit])

  useEffect(() => {
    if (!startInEdit) return
    if (!item) return
    resetFormFromItem(item)
    setEditMode(true)
  }, [item, resetFormFromItem, startInEdit])

  const onSave = useCallback(() => {
    if (!id) return
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const favoriteGenres = editFavoriteGenres
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)

        await cmsFetchJson(cfg, `/cms/users/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: editEmail.trim(),
            emailVerified: editEmailVerified,
            phone: editPhone.trim(),
            phoneVerified: editPhoneVerified,
            smsAuthSkip: editSmsAuthSkip,
            profile: {
              displayName: editDisplayName,
              avatarUrl: editAvatarUrl,
              fullName: editFullName,
              fullNameKana: editFullNameKana,
              birthDate: editBirthDate,
              favoriteGenres,
            },
          }),
        })

        const json = await cmsFetchJson<{ item: UserDetailItem }>(cfg, `/cms/users/${encodeURIComponent(id)}`)
        setItem(json.item)
        setBanner('保存しました')
        setEditMode(false)
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, editAvatarUrl, editBirthDate, editDisplayName, editEmail, editEmailVerified, editFavoriteGenres, editFullName, editFullNameKana, editPhone, editPhoneVerified, editSmsAuthSkip, id])

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.contentScroll} contentContainerStyle={[styles.contentInner, { paddingBottom: editMode ? 110 : 24 }]}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>ユーザー詳細</Text>
        <View style={{ flex: 1 }} />
        {editMode ? (
          <Pressable
            onPress={() => {
              resetFormFromItem(item)
              setEditMode(false)
            }}
            style={styles.smallBtn}
          >
            <Text style={styles.smallBtnText}>キャンセル</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              resetFormFromItem(item)
              setEditMode(true)
            }}
            style={styles.smallBtnPrimary}
          >
            <Text style={styles.smallBtnPrimaryText}>編集</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本情報</Text>
        <View style={styles.field}>
          <Text style={styles.label}>メールアドレス</Text>
          {editMode ? (
            <TextInput value={editEmail} onChangeText={setEditEmail} autoCapitalize="none" style={styles.input} />
          ) : (
            <Text style={styles.readonlyText}>{safeText(item?.email)}</Text>
          )}
        </View>
        {editMode ? (
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>メール認証</Text>
            <Switch value={editEmailVerified} onValueChange={setEditEmailVerified} />
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>メール認証</Text>
            <Text style={styles.readonlyText}>{item ? (item.emailVerified ? '済' : '未') : busy ? '—' : '—'}</Text>
          </View>
        )}
        <View style={styles.field}>
          <Text style={styles.label}>電話番号</Text>
          {editMode ? (
            <TextInput value={editPhone} onChangeText={setEditPhone} autoCapitalize="none" style={styles.input} />
          ) : (
            <Text style={styles.readonlyText}>{safeText(item?.phone)}</Text>
          )}
        </View>

        {editMode ? (
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>電話番号認証</Text>
            <Switch value={editPhoneVerified} onValueChange={setEditPhoneVerified} />
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>電話番号認証</Text>
            <Text style={styles.readonlyText}>{item ? (item.phoneVerified ? '済' : '未') : '—'}</Text>
          </View>
        )}

        {editMode ? (
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>SMS認証スキップ</Text>
            <Switch value={editSmsAuthSkip} onValueChange={setEditSmsAuthSkip} />
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>SMS認証スキップ</Text>
            <Text style={styles.readonlyText}>{item ? (item.smsAuthSkip ? 'はい' : 'いいえ') : '—'}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>作成日時</Text>
          <Text style={styles.readonlyText}>{safeText(dateLabel(item?.createdAt || ''))}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>更新日時</Text>
          <Text style={styles.readonlyText}>{safeText(dateLabel(item?.updatedAt || ''))}</Text>
        </View>
      </View>

      {editMode ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>操作</Text>
          <View style={{ height: 8 }} />
        </View>
      ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>サブスク</Text>
          <View style={styles.field}>
            <Text style={styles.label}>サブスク会員</Text>
            <Text style={styles.readonlyText}>{item ? (item.isSubscribed ? 'はい' : 'いいえ') : '—'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Stripe状態</Text>
            <Text style={styles.readonlyText}>{safeText(item?.subscription?.status)}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>開始日時</Text>
            <Text style={styles.readonlyText}>{safeText(dateLabel(item?.subscription?.startedAt || ''))}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>終了日時</Text>
            <Text style={styles.readonlyText}>{safeText(dateLabel(item?.subscription?.endedAt || ''))}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Stripe customer id</Text>
            <Text style={styles.readonlyText}>{safeText(item?.subscription?.stripeCustomerId)}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Stripe subscription id</Text>
            <Text style={styles.readonlyText}>{safeText(item?.subscription?.stripeSubscriptionId)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>コイン</Text>
          <View style={styles.field}>
            <Text style={styles.label}>獲得コイン数</Text>
            <Text style={styles.readonlyText}>{item?.coins?.acquiredTotal ?? '—'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>保持コイン数</Text>
            <Text style={styles.readonlyText}>{item?.coins?.balance ?? '—'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>消費コイン合計</Text>
            <Text style={styles.readonlyText}>{String(item?.coins?.spentTotal ?? 0)}</Text>
          </View>
          <Text style={styles.miniHelpText}>※獲得/保持はDB未実装のため現状「—」です</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>お気に入り</Text>
          <Text style={styles.miniHelpText}>お気に入り動画は現在DBに保存していないため表示できません</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.tableHeaderCell, styles.colName]}>
                <Text style={styles.tableHeaderText}>お気に入りキャスト</Text>
              </View>
              <View style={[styles.tableHeaderCell, styles.colCast]}>
                <Text style={styles.tableHeaderText}>種別</Text>
              </View>
              <View style={[styles.tableHeaderCell, styles.colCreatedAt]}>
                <Text style={styles.tableHeaderText}>登録日</Text>
              </View>
            </View>
            {(item?.favorites?.casts ?? []).map((r) => (
              <View key={`${r.castId}_${r.favoritedAt}`} style={styles.tableRow}>
                <View style={styles.tableRowInner}>
                  <View style={styles.colName}>
                    <Text style={styles.tableCellText} numberOfLines={1}>
                      {r.name || r.castId || '—'}
                    </Text>
                    {r.castId ? (
                      <Text style={styles.tableDetail} numberOfLines={1}>
                        {r.castId}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.colCast}>
                    <Text style={styles.tableCellText} numberOfLines={1}>
                      {r.role || '—'}
                    </Text>
                  </View>
                  <View style={styles.colCreatedAt}>
                    <Text style={styles.tableCellText} numberOfLines={1}>
                      {dateLabel(r.favoritedAt) || '—'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {!busy && (item?.favorites?.casts?.length ?? 0) === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>お気に入りキャストがありません</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>視聴履歴</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.tableHeaderCell, styles.colName]}>
                <Text style={styles.tableHeaderText}>作品 / 動画</Text>
              </View>
              <View style={[styles.tableHeaderCell, styles.colCreatedAt]}>
                <Text style={styles.tableHeaderText}>日時</Text>
              </View>
            </View>
            {(item?.watchHistory ?? []).map((h, idx) => (
              <View key={`${h.videoId}_${h.watchedAt}_${idx}`} style={styles.tableRow}>
                <View style={styles.tableRowInner}>
                  <View style={styles.colName}>
                    <Text style={styles.tableCellText} numberOfLines={1}>
                      {(h.workTitle || h.workId)
                        ? `${h.workTitle || h.workId} / ${h.videoTitle || h.videoId || '—'}`
                        : h.videoTitle || h.videoId || '—'}
                    </Text>
                    <Text style={styles.tableDetail} numberOfLines={1}>
                      {h.videoId}
                    </Text>
                  </View>
                  <View style={styles.colCreatedAt}>
                    <Text style={styles.tableCellText} numberOfLines={1}>
                      {dateLabel(h.watchedAt) || '—'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {!busy && (item?.watchHistory?.length ?? 0) === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>視聴履歴がありません</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>コメント履歴</Text>
          <Text style={styles.miniHelpText}>※ユーザーIDで紐付いていないため、作者名（表示名/氏名）一致で推定表示しています</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.tableHeaderCell, styles.colName]}>
                <Text style={styles.tableHeaderText}>作品 / コメント</Text>
              </View>
              <View style={[styles.tableHeaderCell, styles.colCreatedAt]}>
                <Text style={styles.tableHeaderText}>日時</Text>
              </View>
            </View>
            {(item?.comments?.items ?? []).map((c, idx) => (
              <View key={`${c.id}_${idx}`} style={styles.tableRow}>
                <View style={styles.tableRowInner}>
                  <View style={styles.colName}>
                    <Text style={styles.tableCellText} numberOfLines={2}>
                      {c.contentTitle || c.contentId ? `${c.contentTitle || c.contentId}: ${c.body}` : c.body}
                    </Text>
                    <Text style={styles.tableDetail} numberOfLines={1}>{`${c.status}${c.episodeId ? ` / ep:${c.episodeId}` : ''}`}</Text>
                  </View>
                  <View style={styles.colCreatedAt}>
                    <Text style={styles.tableCellText} numberOfLines={1}>
                      {dateLabel(c.createdAt) || '—'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {!busy && (item?.comments?.items?.length ?? 0) === 0 ? (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>コメント履歴がありません</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>キャストプロフィール</Text>
          {item?.castProfile ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>申請ID</Text>
                <Text style={styles.readonlyText}>{safeText(item.castProfile.requestId)}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>名前</Text>
                <Text style={styles.readonlyText}>{safeText(item.castProfile.name)}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>メール</Text>
                <Text style={styles.readonlyText}>{safeText(item.castProfile.email)}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>申請日時</Text>
                <Text style={styles.readonlyText}>{safeText(dateLabel(item.castProfile.submittedAt))}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>承認日時</Text>
                <Text style={styles.readonlyText}>{safeText(dateLabel(item.castProfile.decidedAt || ''))}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>承認者（管理者ID）</Text>
                <Text style={styles.readonlyText}>{safeText(item.castProfile.decidedByAdminId)}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>プロフィール内容</Text>
                <Text style={[styles.readonlyText, { whiteSpace: 'pre-wrap' } as any]}>{prettyDraft(item.castProfile.draft) || '—'}</Text>
              </View>
            </>
          ) : (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>承認済みキャストプロフィールがありません</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {editMode ? (
        <FixedBottomBar>
          <View style={styles.filterActions}>
            <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
              <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                resetFormFromItem(item)
                setEditMode(false)
              }}
              style={styles.btnSecondary}
            >
              <Text style={styles.btnSecondaryText}>キャンセル</Text>
            </Pressable>
          </View>
        </FixedBottomBar>
      ) : null}
    </View>
  )
}
