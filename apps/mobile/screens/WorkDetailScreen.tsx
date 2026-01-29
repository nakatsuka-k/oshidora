import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import {
  PrimaryButton,
  SecondaryButton,
  SubscriptionPromptModal,
  TabBar,
  THEME,
  ScreenContainer,
} from '../components'

import {
  type WorkStaff,
  type WorkEpisode,
  type WorkDetailWork,
  type CommentItem,
  type SubscriptionPromptState,
  type WorkDetailScreenProps,
} from '../types/workDetailTypes'

import IconNotification from '../assets/icon_notification.svg'
import IconSearch from '../assets/icon_search.svg'
import IconPlayWhite from '../assets/icon_play_white.svg'
import IconStarYellow from '../assets/star-yellow.svg'
import IconStarEmpty from '../assets/none-start.svg'
import IconHeartYellow from '../assets/hairt-yellow.svg'
import IconPen from '../assets/pen-icon.svg'
import IconFavoriteOn from '../assets/icon_favorite_on.svg'
import IconFavoriteOff from '../assets/icon_favorite_off.svg'
import IconShare from '../assets/icon_share.svg'
import IconDown from '../assets/icon_down.svg'

type Props = WorkDetailScreenProps

export function WorkDetailScreen(props: Props) {
  const commentList = useMemo(() => props.approvedComments, [props.approvedComments])

  const slicedComments = useMemo(
    () => (props.commentsExpanded ? commentList : commentList.slice(0, 5)),
    [commentList, props.commentsExpanded]
  )

  return (
    <ScreenContainer
      headerLeft={<Image source={require('../assets/oshidora_logo.png')} style={styles.logo} resizeMode="contain" />}
      headerRight={
        <View style={styles.headerRightRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="お知らせ" onPress={props.onOpenNotice} style={styles.headerIconButton}>
            <IconNotification width={22} height={22} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="検索" onPress={props.onOpenSearch} style={styles.headerIconButton}>
            <IconSearch width={22} height={22} />
          </Pressable>
        </View>
      }
      onBack={props.onBack}
      footer={<TabBar active="video" onPress={(k) => props.onPressTab(k)} />}
      footerPaddingHorizontal={0}
      scroll
      maxWidth={768}
    >
      {!props.workIdForDetail ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
          <Text style={styles.centerText}>作品が未指定です。{`\n`}一覧から作品を選択してください。</Text>
          <View style={{ height: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
            <PrimaryButton label="ホームへ" onPress={props.onGoHome} />
          </View>
        </View>
      ) : (
        <>
          {!props.loggedIn && !props.guestWorkAuthCtaDismissed ? (
            <View style={styles.guestCta}>
              <View style={styles.guestCtaHeaderRow}>
                <Text style={styles.guestCtaTitle}>ログインするともっと楽しめます</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="閉じる" onPress={props.onDismissGuestCta} hitSlop={10}>
                  <Text style={styles.guestCtaClose}>×</Text>
                </Pressable>
              </View>

              <Text style={styles.guestCtaText}>会員限定エピソードの視聴・お気に入り・コメント投稿ができます。</Text>

              <View style={styles.guestCtaButtonsRow}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton label="ログイン" onPress={props.onLoginFromGuestCta} />
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="会員登録" onPress={props.onSignupFromGuestCta} />
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.heroImage}>
            {props.workDetailHeroThumbnailUrl ? (
              <Image source={{ uri: props.workDetailHeroThumbnailUrl }} style={styles.heroImageThumb} resizeMode="cover" />
            ) : (
              <View style={styles.heroPlaceholder} />
            )}
            <Pressable onPress={props.onPlayMain} style={styles.heroPlayOverlay}>
              <IconPlayWhite width={44} height={44} />
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            {props.workForDetail.tags.includes('新着') ? (
              <View style={styles.badgeNew}>
                <Text style={styles.badgeNewText}>新着</Text>
              </View>
            ) : null}
            <Text style={styles.h1}>{props.workForDetail.title}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaTextBase}>{props.workReleaseYear}年</Text>
              </View>
              <View style={styles.metaItem}>
                <IconHeartYellow width={12} height={12} />
                <Text style={styles.metaTextAccent}>{props.workLikeCount}</Text>
              </View>
              <View style={styles.metaItem}>
                <IconStarYellow width={12} height={12} />
                <Text style={styles.metaTextAccent}>
                  {props.workRatingAvg.toFixed(1)}（{props.workReviewCount}件）
                </Text>
              </View>
            </View>
          </View>

          <PrimaryButton label="本編を再生する" onPress={props.onPlayMain} />

          <View style={styles.actionsRow}>
            <Pressable style={styles.actionItem} onPress={props.onPressComment}>
              <IconPen width={18} height={18} />
              <Text style={styles.actionLabel}>コメントする</Text>
            </Pressable>
            <Pressable style={styles.actionItem} onPress={props.onToggleFavorite}>
              {props.isWorkFavorite ? <IconFavoriteOn width={18} height={18} /> : <IconFavoriteOff width={18} height={18} />}
              <Text style={styles.actionLabel}>お気に入り</Text>
            </Pressable>
            <Pressable style={styles.actionItem} onPress={props.shareWork}>
              <IconShare width={18} height={18} />
              <Text style={styles.actionLabel}>共有する</Text>
            </Pressable>
          </View>

          <Text style={styles.bodyText}>{props.workForDetail.story || '—'}</Text>

          <View style={styles.tagList}>
            {props.workForDetail.tags.map((t) => (
              <Pressable
                key={t}
                style={styles.tagChip}
                onPress={() => {
                  props.videoListTagSetter(t)
                  props.onGoVideoList()
                }}
              >
                <Text style={styles.tagChipText}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.workTabsWrap}>
            <View style={styles.workTabsRow}>
              <Pressable style={styles.workTabItem} onPress={() => props.onChangeWorkDetailTab('episodes')}>
                <Text style={[styles.workTabText, props.workDetailTab === 'episodes' ? styles.workTabTextActive : null]}>エピソード</Text>
                {props.workDetailTab === 'episodes' ? <View style={styles.workTabUnderline} /> : null}
              </Pressable>
              <Pressable style={styles.workTabItem} onPress={() => props.onChangeWorkDetailTab('info')}>
                <Text style={[styles.workTabText, props.workDetailTab === 'info' ? styles.workTabTextActive : null]}>作品情報</Text>
                {props.workDetailTab === 'info' ? <View style={styles.workTabUnderline} /> : null}
              </Pressable>
            </View>
            <View style={styles.workTabsBaseline} />
          </View>

          {props.workDetailTab === 'episodes' ? (
            <View style={styles.tabContent}>
              {props.workForDetail.episodes.length === 0 ? (
                <Text style={styles.emptyText}>空です</Text>
              ) : (
                props.workForDetail.episodes.map((e, idx) => {
                  const requiredCoins = typeof e.priceCoin === 'number' ? e.priceCoin : 0
                  const isMemberOnly = requiredCoins > 0

                  const episodeNo = e.episodeNo == null ? null : e.episodeNo
                  const fallbackNo = idx + 1
                  const episodeLabel = episodeNo != null ? `第${String(episodeNo).padStart(2, '0')}話` : `第${String(fallbackNo).padStart(2, '0')}話`
                  const displayTitle = (() => {
                    const t = String(e.title || '').trim()
                    if (t.includes('第') && t.includes('話')) return t
                    return `${episodeLabel} ${t}`.trim()
                  })()

                  const episodeThumbUrl = (() => {
                    const t = typeof e.thumbnailUrl === 'string' ? e.thumbnailUrl.trim() : ''
                    return t || props.workDetailHeroThumbnailUrl
                  })()

                  const durationText = `${String(2 + (idx % 3)).padStart(2, '0')}:${String(21 + (idx % 4)).padStart(2, '0')}`

                  return (
                    <Pressable
                      key={e.id}
                      style={styles.episodeRow}
                      onPress={() => props.onPressEpisode({ id: e.id, thumbnailUrl: episodeThumbUrl, isMemberOnly })}
                    >
                      <Image source={{ uri: episodeThumbUrl }} style={styles.episodeThumb} resizeMode="cover" />
                      <View style={styles.episodeMeta}>
                        <Text style={styles.episodeTitle} numberOfLines={1}>
                          {displayTitle}
                        </Text>
                        <Text style={styles.episodeDuration}>{durationText}</Text>
                        {isMemberOnly ? <Text style={styles.episodeBadge}>会員限定</Text> : null}
                      </View>
                    </Pressable>
                  )
                })
              )}

              <SubscriptionPromptModal
                visible={props.subscriptionPrompt.visible}
                workTitle={props.subscriptionPrompt.workTitle}
                thumbnailUrl={props.subscriptionPrompt.thumbnailUrl}
                onClose={props.onCloseSubscriptionPrompt}
                onStartTrial={props.onStartTrialFromPrompt}
              />

              <Text style={styles.subSectionTitle}>おすすめドラマ一覧</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recoList}>
                {props.recommendedWorks.map((w) => (
                  <Pressable key={`reco-${w.id}`} style={styles.recoCard} onPress={() => props.openWorkDetail(w.id)}>
                    {(() => {
                      const workThumb = typeof w.thumbnailUrl === 'string' ? w.thumbnailUrl.trim() : ''
                      if (workThumb) return <Image source={{ uri: workThumb }} style={styles.recoThumb} resizeMode="cover" />
                      const epThumb = typeof w.episodes?.[0]?.thumbnailUrl === 'string' ? String(w.episodes?.[0]?.thumbnailUrl).trim() : ''
                      if (epThumb) return <Image source={{ uri: epThumb }} style={styles.recoThumb} resizeMode="cover" />
                      const streamUid = String(w.episodes?.[0]?.streamVideoId || '').trim()
                      if (/^[a-f0-9]{32}$/i.test(streamUid)) {
                        return (
                          <Image
                            source={{ uri: `https://videodelivery.net/${encodeURIComponent(streamUid)}/thumbnails/thumbnail.jpg?time=1s` }}
                            style={styles.recoThumb}
                            resizeMode="cover"
                          />
                        )
                      }
                      return <View style={[styles.recoThumb, { backgroundColor: THEME.placeholder }]} />
                    })()}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.tabContent}>
              <Text style={styles.subSectionTitle}>出演者</Text>
              {props.workForDetail.staff
                .filter((s) => s.role === '出演者')
                .map((s, idx) => (
                  <View key={`${s.role}-${idx}`} style={styles.castRow}>
                    <View style={styles.castAvatar} />
                    <View style={styles.castInfo}>
                      <Text style={styles.castRole}>{s.role}</Text>
                      <Text style={styles.castName}>{s.name}</Text>
                    </View>
                    <View style={styles.castActions}>
                      <Pressable
                        style={styles.castBtn}
                        onPress={() => {
                          const accountId = props.resolveCastAccountIdByName(s.name)
                          if (!accountId) return
                          if (!props.requireLogin('coinGrant')) return
                          props.onGoCoinGrantForCast({ accountId, name: s.name, roleLabel: s.role })
                        }}
                      >
                        <Text style={styles.castBtnText}>推しポイント付与</Text>
                      </Pressable>
                      <Pressable
                        style={styles.castBtn}
                        onPress={() => {
                          if (!props.requireLogin('profile')) return
                          props.onOpenProfileForStaff({ id: `cast:${s.name}`, name: s.name, roleLabel: s.role })
                        }}
                      >
                        <Text style={styles.castBtnText}>詳しく</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

              <Text style={styles.subSectionTitle}>スタッフ</Text>
              {props.workForDetail.staff
                .filter((s) => s.role !== '出演者' && !s.role.includes('制作プロダクション') && !s.role.includes('提供'))
                .map((s, idx) => (
                  <View key={`${s.role}-${idx}`} style={styles.castRow}>
                    <View style={styles.castAvatar} />
                    <View style={styles.castInfo}>
                      <Text style={styles.castRole}>{s.role}</Text>
                      <Text style={styles.castName}>{s.name}</Text>
                    </View>
                    <View style={styles.castActions}>
                      <Pressable style={styles.castBtn}>
                        <Text style={styles.castBtnText}>推しポイント付与</Text>
                      </Pressable>
                      <Pressable style={styles.castBtn}>
                        <Text style={styles.castBtnText}>詳しく</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>制作プロダクション</Text>
                <Text style={styles.infoValue}>{props.productionLabel}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>提供元</Text>
                <Text style={styles.infoValue}>{props.providerLabel}</Text>
              </View>

              <PrimaryButton
                label="出演者・スタッフを探す"
                onPress={() => {
                  if (!props.requireLogin('cast')) return
                  props.onPressTab('cast')
                }}
              />
            </View>
          )}

          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>コメント（{commentList.length}件）</Text>
            <View style={styles.commentsBox}>
              {props.commentsBusy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator />
                </View>
              ) : null}

              {props.commentsError ? <Text style={styles.loadNote}>取得に失敗しました（モック表示）</Text> : null}

              {slicedComments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentAuthor} numberOfLines={1} ellipsizeMode="tail">
                    {c.author}  ★{props.commentStarRating(c)}
                  </Text>
                  <Text style={styles.commentBody}>{props.truncateCommentBody(c.body)}</Text>
                </View>
              ))}

              {!props.commentsExpanded && commentList.length > 5 ? (
                <Pressable style={styles.moreRow} onPress={props.onExpandComments}>
                  <Text style={styles.moreLink}>さらに表示</Text>
                  <IconDown width={14} height={14} />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.subSectionTitle}>コメント投稿</Text>
            <View style={styles.commentCtaWrap}>
              <View style={styles.commentRatingRow}>
                {Array.from({ length: 5 }).map((_, idx) => {
                  const active = idx < props.commentRating
                  return (
                    <Pressable key={`rating-${idx}`} onPress={() => props.onChangeCommentRating(idx + 1)}>
                      {active ? <IconStarYellow width={18} height={18} /> : <IconStarEmpty width={18} height={18} />}
                    </Pressable>
                  )
                })}
              </View>
              <TextInput
                value={props.commentDraft}
                onChangeText={props.onChangeCommentDraft}
                placeholder="コメントを書く"
                placeholderTextColor={THEME.textMuted}
                style={styles.commentInput}
                multiline
              />
              <PrimaryButton
                label="コメントを投稿する"
                onPress={async () => {
                  await props.onSubmitInlineComment()
                }}
              />
            </View>

            {props.commentJustSubmitted ? (
              <Text style={styles.commentNotice}>
                ※ コメントは管理者の確認後に公開されます。{`\n`}反映までお時間がかかる場合があります。
              </Text>
            ) : null}
          </View>

          {props.favoriteToastVisible ? (
            <View style={styles.favoriteToastWrap} pointerEvents="none">
              <View style={styles.favoriteToast}>
                <Text style={styles.favoriteToastText}>{props.favoriteToastText}</Text>
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  centerText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    color: THEME.textMuted,
  },
  logo: {
    width: 110,
    height: 36,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestCta: {
    width: '100%',
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  guestCtaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  guestCtaTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
  },
  guestCtaClose: {
    color: THEME.textMuted,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 18,
  },
  guestCtaText: {
    color: THEME.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  guestCtaButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: THEME.card,
  },
  heroPlaceholder: {
    flex: 1,
    backgroundColor: THEME.placeholder,
  },
  heroImageThumb: {
    width: '100%',
    height: '100%',
  },
  heroPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    marginBottom: 12,
    gap: 6,
  },
  h1: {
    color: '#E6E6E6',
    fontSize: 18,
    fontWeight: '800',
  },
  badgeNew: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  badgeNewText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaTextBase: {
    color: '#E6E6E6',
    fontSize: 12,
  },
  metaTextAccent: {
    color: '#E4A227',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    color: '#E6E6E6',
    fontSize: 10,
    fontWeight: '700',
  },
  bodyText: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 20,
  },
  tagChip: {
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  tagChipText: {
    color: '#E6E6E6',
    fontSize: 11,
  },
  workTabsWrap: {
    marginBottom: 16,
    marginTop: 8,
  },
  workTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 4,
  },
  workTabItem: {
    width: '44%',
    margin: 'auto',
  },
  workTabText: {
    color: THEME.textMuted,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  workTabTextActive: {
    color: THEME.accent,
  },
  workTabUnderline: {
    marginTop: 0,
    height: 1,
    borderRadius: 999,
    backgroundColor: THEME.accent,
  },
  workTabsBaseline: {
    height: 1,
    backgroundColor: THEME.outline,
  },
  tabContent: {
    gap: 8,
    marginBottom: 18,
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 12,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  episodeThumb: {
    width: 92,
    height: 52,
    borderRadius: 8,
    backgroundColor: THEME.placeholder,
  },
  episodeMeta: {
    flex: 1,
    gap: 4,
  },
  episodeTitle: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '800',
  },
  episodeDuration: {
    color: THEME.textMuted,
    fontSize: 11,
  },
  episodeBadge: {
    color: '#E4A227',
    fontSize: 11,
    fontWeight: '800',
  },
  subSectionTitle: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  recoList: {
    gap: 12,
    paddingVertical: 4,
  },
  recoCard: {
    width: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  recoThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  castRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  castAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.placeholder,
  },
  castInfo: {
    flex: 1,
  },
  castRole: {
    color: THEME.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  castName: {
    color: '#E6E6E6',
    fontSize: 13,
    fontWeight: '800',
  },
  castActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  castBtn: {
    borderWidth: 1,
    borderColor: '#E4A227',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  castBtnText: {
    color: '#E4A227',
    fontSize: 10,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  infoLabel: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '800',
  },
  commentsSection: {
    marginTop: 14,
  },
  sectionTitle: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  commentsBox: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  loadingRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadNote: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  commentItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  commentAuthor: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  commentBody: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  moreLink: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentCtaWrap: {
    gap: 14,
  },
  commentRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E6E6E6',
    fontSize: 12,
    minHeight: 44,
  },
  commentNotice: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  favoriteToastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 72,
    alignItems: 'center',
  },
  favoriteToast: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  favoriteToastText: {
    color: '#1F1D1A',
    fontSize: 12,
    fontWeight: '800',
  },
})
