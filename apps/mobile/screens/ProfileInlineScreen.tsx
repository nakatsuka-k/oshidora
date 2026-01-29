import { useMemo } from 'react'
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'

import {
  PaginationDots,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  THEME,
} from '../components'

import IconFavoriteOff from '../assets/icon_favorite_off.svg'
import IconFavoriteOn from '../assets/icon_favorite_on.svg'
import IconPen from '../assets/pen-icon.svg'
import IconShare from '../assets/icon_share.svg'
import IconStarEmpty from '../assets/none-start.svg'
import IconStarYellow from '../assets/star-yellow.svg'

import { detectSocialService } from '../utils/socialLinks'
import { apiFetch } from '../utils/api'

type Props = {
  styles: any

  apiBaseUrl: string

  selectedCast: any

  castProfileSlideIndex: number
  setCastProfileSlideIndex: (next: number) => void

  castReviewSummary: any
  selectedCastReview: any

  castFavorite: boolean
  setCastFavorite: React.Dispatch<React.SetStateAction<boolean>>

  requireLogin: (screen: any) => boolean
  goTo: (screen: any) => void
  goBack: () => void

  setCoinGrantTarget: (next: any) => void
  setCoinGrantPrimaryReturnTo: (next: any) => void
  setCoinGrantPrimaryLabel: (next: any) => void

  setFavoriteToastText: (next: string) => void
  setFavoriteToastVisible: (next: boolean) => void
  favoriteToastTimer: React.MutableRefObject<any>

  shareUrlForCast: (castId: string, castName: string) => string

  userProfile: any

  castCommentsExpanded: boolean
  setCastCommentsExpanded: (next: boolean) => void
  castLocalComments: any[]

  commentStarRating: (comment: any) => number
  truncateCommentBody: (body: string) => string

  castCommentRating: number
  setCastCommentRating: (next: number) => void
  castCommentDraft: string
  setCastCommentDraft: (next: string) => void

  fetchCastReviewSummary: (castId: string) => void
  setCastReviews: React.Dispatch<React.SetStateAction<any>>
  setCastLocalComments: React.Dispatch<React.SetStateAction<any[]>>
}

export function ProfileInlineScreen(props: Props) {
  const styles = props.styles

  if (!props.selectedCast?.id) {
    return (
      <ScreenContainer title="キャストプロフィール" onBack={props.goBack} scroll>
        <View style={styles.profileCard}>
          <Text style={styles.sectionTitle}>キャストが未選択です</Text>
          <Text style={styles.bodyText}>キャスト一覧からプロフィールを開いてください。</Text>
        </View>
      </ScreenContainer>
    )
  }

  const castName = String(props.selectedCast?.name ?? '').trim() || '—'
  const castId = String(props.selectedCast?.id ?? '').trim()

  const ratingText = useMemo(() => {
    const rating = props.castReviewSummary
      ? props.castReviewSummary.ratingAvg.toFixed(1)
      : props.selectedCastReview
        ? props.selectedCastReview.rating.toFixed(1)
        : '—'
    const count = props.castReviewSummary ? ` (${props.castReviewSummary.reviewCount}件)` : ''
    return rating === '—' ? '—' : `${rating}${count}`
  }, [props.castReviewSummary, props.selectedCastReview])

  const onToggleFavorite = () => {
    if (!props.requireLogin('profile')) return
    props.setCastFavorite((prev) => !prev)
    props.setFavoriteToastText(!props.castFavorite ? 'お気に入りに登録しました' : 'お気に入りから削除しました')
    props.setFavoriteToastVisible(true)
    if (props.favoriteToastTimer.current) clearTimeout(props.favoriteToastTimer.current)
    props.favoriteToastTimer.current = setTimeout(() => props.setFavoriteToastVisible(false), 2200)
  }

  const onShare = async () => {
    if (!props.requireLogin('profile')) return
    const url = props.shareUrlForCast(castId, castName)
    const message = `${castName}\n${url}`

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const nav: any = (window as any).navigator
      if (nav?.share) {
        try {
          await nav.share({ title: castName, text: message, url })
          return
        } catch {
          // fallthrough
        }
      }
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }

    try {
      const ShareLib = (await import('react-native-share')).default as any
      await ShareLib.open({ title: castName, message, url })
    } catch {
      const { Share } = await import('react-native')
      await Share.share({ message, url })
    }
  }

  const onSubmitComment = async () => {
    if (!props.requireLogin('profile')) return

    const author = props.userProfile?.displayName?.trim() || 'あなた'
    const body = props.castCommentDraft.trim()
    if (!body) {
      Alert.alert('入力してください', 'コメントを入力してください')
      return
    }
    if (props.castCommentRating <= 0) {
      Alert.alert('評価を選択してください', '星を選んで評価してください')
      return
    }

    try {
      const res = await apiFetch(`${props.apiBaseUrl}/v1/reviews/cast`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ castId, rating: props.castCommentRating, comment: body }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      void props.fetchCastReviewSummary(castId)
    } catch {
      props.setCastReviews((prev: any) => ({
        ...prev,
        [castId]: { rating: props.castCommentRating, comment: body, updatedAt: Date.now() },
      }))
    }

    props.setCastLocalComments((prev) => [
      { id: `local-${Date.now()}`, author, body, createdAt: new Date().toISOString() },
      ...prev,
    ])
    props.setCastCommentDraft('')
    props.setCastCommentRating(0)
  }

  return (
    <ScreenContainer title="キャストプロフィール" onBack={props.goBack} scroll>
      <View style={styles.castCarouselWrap}>
        <ScrollView
          horizontal
          decelerationRate="fast"
          snapToInterval={210 + 12}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.castCarouselContent}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x
            const step = 210 + 12
            const next = Math.round(x / step)
            props.setCastProfileSlideIndex(Math.max(0, Math.min(next, 4)))
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <View
              key={i}
              style={[styles.castCarouselCard, i === 4 ? null : { marginRight: 12 }]}
            >
              <View style={styles.castCarouselCardInner} />
            </View>
          ))}
        </ScrollView>

        <PaginationDots
          count={5}
          index={props.castProfileSlideIndex}
          style={styles.castCarouselDots}
          variant="plain"
          dotSize={6}
          activeColor={THEME.accent}
          inactiveColor={THEME.outline}
          onChange={(idx) => props.setCastProfileSlideIndex(idx)}
        />
      </View>

      <View style={styles.castTitleBlock}>
        <Text style={styles.castNameMain}>{castName}</Text>
        <Text style={styles.castNameSub}>
          {String(props.selectedCast?.roleLabel ?? '') || '—'}
        </Text>
        <View style={styles.castRatingRow}>
          <IconStarYellow width={14} height={14} />
          <Text style={styles.castRatingText}>{ratingText}</Text>
        </View>
      </View>

      <PrimaryButton
        label="推しポイント付与"
        onPress={() => {
          if (!props.requireLogin('coinGrant')) return
          props.setCoinGrantTarget({ id: castId, name: castName, roleLabel: props.selectedCast?.roleLabel })
          props.setCoinGrantPrimaryReturnTo('profile')
          props.setCoinGrantPrimaryLabel('プロフィールへ戻る')
          props.goTo('coinGrant')
        }}
      />

      <View style={styles.castActionRow}>
        <Pressable
          accessibilityRole="button"
          style={styles.castActionItem}
          onPress={() => {
            if (!props.requireLogin('castReview')) return
            props.goTo('castReview')
          }}
        >
          <IconPen width={18} height={18} />
          <Text style={styles.castActionLabel}>コメントする</Text>
        </Pressable>

        <Pressable accessibilityRole="button" style={styles.castActionItem} onPress={onToggleFavorite}>
          {props.castFavorite ? <IconFavoriteOn width={18} height={18} /> : <IconFavoriteOff width={18} height={18} />}
          <Text style={styles.castActionLabel}>お気に入り</Text>
        </Pressable>

        <Pressable accessibilityRole="button" style={styles.castActionItem} onPress={onShare}>
          <IconShare width={18} height={18} />
          <Text style={styles.castActionLabel}>共有する</Text>
        </Pressable>
      </View>

      <View style={styles.profileCard}>
        <Text style={styles.sectionTitle}>プロフィール</Text>
        <Text style={styles.bodyText}>プロフィール情報は準備中です。</Text>
      </View>

      <View style={styles.commentsBox}>
        <View style={styles.commentItem}>
          <Text style={styles.sectionTitle}>コメント（{props.castReviewSummary ? props.castReviewSummary.reviewCount : props.castLocalComments.length}件）</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <IconStarYellow key={idx} width={16} height={16} />
            ))}
            <Text style={[styles.metaTextBase, { color: '#E4A227', fontWeight: '900' }]}> {ratingText} </Text>
          </View>
        </View>

        {(props.castCommentsExpanded ? props.castLocalComments : props.castLocalComments.slice(0, 3)).map((c: any) => {
          const stars = props.commentStarRating(c)
          return (
            <View key={c.id} style={styles.commentItem}>
              <Text style={styles.commentAuthor}>{c.author}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                {Array.from({ length: 5 }).map((_, idx) => {
                  const active = idx < stars
                  return active ? (
                    <IconStarYellow key={idx} width={14} height={14} />
                  ) : (
                    <IconStarEmpty key={idx} width={14} height={14} />
                  )
                })}
              </View>
              <Text style={styles.commentBody}>{props.truncateCommentBody(c.body)}</Text>
            </View>
          )
        })}

        {!props.castCommentsExpanded && props.castLocalComments.length > 3 ? (
          <Pressable style={styles.moreRow} onPress={() => props.setCastCommentsExpanded(true)}>
            <Text style={styles.moreLink}>さらに表示</Text>
            <Text style={styles.moreLink}>›</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.profileCard}>
        <Text style={styles.sectionTitle}>コメント投稿</Text>
        <View style={styles.commentCtaWrap}>
          <View style={styles.commentRatingRow}>
            {Array.from({ length: 5 }).map((_, idx) => {
              const active = idx < props.castCommentRating
              return (
                <Pressable key={`cast-rating-${idx}`} onPress={() => props.setCastCommentRating(idx + 1)}>
                  {active ? <IconStarYellow width={18} height={18} /> : <IconStarEmpty width={18} height={18} />}
                </Pressable>
              )
            })}
          </View>

          <TextInput
            value={props.castCommentDraft}
            onChangeText={props.setCastCommentDraft}
            placeholder="コメントを記入する"
            placeholderTextColor={THEME.textMuted}
            multiline
            style={styles.commentInput}
          />

          <PrimaryButton label="コメントを投稿する" onPress={onSubmitComment} />
        </View>
      </View>
    </ScreenContainer>
  )
}
