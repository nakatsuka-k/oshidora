import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Image,
  Linking,
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
  useSubscriptionUpsell,
} from '../components'

import IconFavoriteOff from '../assets/icon_favorite_off.svg'
import IconFavoriteOn from '../assets/icon_favorite_on.svg'
import IconPen from '../assets/pen-icon.svg'
import IconShare from '../assets/icon_share.svg'
import IconStarEmpty from '../assets/none-start.svg'
import IconStarYellow from '../assets/star-yellow.svg'

import IconSnsDiscord from '../assets/icon_sns/icon_sns_discord.svg'
import IconSnsFacebook from '../assets/icon_sns/icon_sns_facebook.svg'
import IconSnsInstagram from '../assets/icon_sns/icon_sns_instagram.svg'
import IconSnsLine from '../assets/icon_sns/icon_sns_line.svg'
import IconSnsLinkedin from '../assets/icon_sns/icon_sns_linkedin.svg'
import IconSnsNote from '../assets/icon_sns/icon_sns_note.svg'
import IconSnsSpotify from '../assets/icon_sns/icon_sns_spotify.svg'
import IconSnsThreads from '../assets/icon_sns/icon_sns_threads.svg'
import IconSnsTiktok from '../assets/icon_sns/icon_sns_tiktok.svg'
import IconSnsTwitch from '../assets/icon_sns/icon_sns_twitch.svg'
import IconSnsX from '../assets/icon_sns/icon_sns_x.svg'
import IconSnsYoutube from '../assets/icon_sns/icon_sns_youtube.svg'

import { detectSocialIconKey, detectSocialService, type SocialIconKey } from '../utils/socialLinks'
import { apiFetch } from '../utils/api'
import { useWebDragToScroll } from '../utils/useWebDragToScroll'

const SNS_ICONS: Record<SocialIconKey, any> = {
  x: IconSnsX,
  instagram: IconSnsInstagram,
  threads: IconSnsThreads,
  tiktok: IconSnsTiktok,
  youtube: IconSnsYoutube,
  line: IconSnsLine,
  facebook: IconSnsFacebook,
  note: IconSnsNote,
  linkedin: IconSnsLinkedin,
  discord: IconSnsDiscord,
  spotify: IconSnsSpotify,
  twitch: IconSnsTwitch,
}

function extractUrls(text: string): string[] {
  const s = String(text || '')
  const hits = s.match(/https?:\/\/[^\s)\]}>,"']+/g) || []
  const cleaned = hits
    .map((u) => u.replace(/[),\].>"']+$/g, ''))
    .map((u) => u.trim())
    .filter(Boolean)
  return Array.from(new Set(cleaned)).slice(0, 10)
}

async function openExternalUrl(url: string) {
  const raw = String(url || '').trim()
  if (!raw) return
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const can = await Linking.canOpenURL(normalized)
  if (!can) throw new Error('リンクを開けませんでした')
  await Linking.openURL(normalized)
}

type Props = {
  styles: any

  apiBaseUrl: string

  selectedCast: any

  isSubscribed: boolean

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

function splitParagraphs(text: string): string[] {
  const raw = String(text || '')
  const lines = raw.replace(/\r\n/g, '\n').split('\n')

  const out: string[] = []
  let buf: string[] = []
  const flush = () => {
    const s = buf.join('\n').trimEnd()
    if (s) out.push(s)
    buf = []
  }

  for (const line of lines) {
    const trimmed = line.trimEnd()
    if (!trimmed.trim()) {
      flush()
      continue
    }
    buf.push(trimmed)
  }
  flush()
  return out
}

function isAngleBracketHeading(text: string): boolean {
  const s = String(text || '').trim()
  return /^<[^<>]{1,80}>$/.test(s)
}

function ProfileRow(props: { styles: any; label: string; value: string }) {
  const { styles, label, value } = props
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue}>{value || '—'}</Text>
    </View>
  )
}

export function ProfileInlineScreen(props: Props) {
  const styles = props.styles
  const { open: openSubscriptionUpsell } = useSubscriptionUpsell()

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

  const [remote, setRemote] = useState<{
    loading: boolean
    error: string
    profileImages: string[]
    faceImageUrl: string
    nameKana: string
    nameEn: string
    birthDate: string
    birthplace: string
    bloodType: string
    hobbies: string
    specialSkills: string
    qualifications: string
    sns: { label: string; url: string }[]
    bio: string
    career: string
    achievementImages: string[]
  }>({
    loading: false,
    error: '',
    profileImages: [],
    faceImageUrl: '',
    nameKana: '',
    nameEn: '',
    birthDate: '',
    birthplace: '',
    bloodType: '',
    hobbies: '',
    specialSkills: '',
    qualifications: '',
    sns: [],
    bio: '',
    career: '',
    achievementImages: [],
  })

  useEffect(() => {
    let mounted = true

    const run = async () => {
      const base = String(props.apiBaseUrl || '').trim().replace(/\/+$/, '')
      if (!base || !castId) return

      setRemote((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const res = await apiFetch(`${base}/v1/cast/${encodeURIComponent(castId)}`)
        if (!res.ok) {
          const msg = await res.text().catch(() => '')
          throw new Error(msg ? `HTTP ${res.status}: ${msg}` : `HTTP ${res.status}`)
        }
        const json = (await res.json().catch(() => ({}))) as any
        const item = json?.item ?? {}
        const rawImages: unknown = item?.profileImages
        const profileImages: string[] = Array.isArray(rawImages) ? rawImages.filter((x) => typeof x === 'string' && x.trim()) : []
        const faceImageUrl = typeof item?.faceImageUrl === 'string' ? item.faceImageUrl.trim() : ''

        const nameKana = typeof item?.nameKana === 'string' ? item.nameKana.trim() : ''
        const nameEn = typeof item?.nameEn === 'string' ? item.nameEn.trim() : ''
        const birthDate = typeof item?.birthDate === 'string' ? item.birthDate.trim() : ''
        const birthplace = typeof item?.birthplace === 'string' ? item.birthplace.trim() : ''
        const bloodType = typeof item?.bloodType === 'string' ? item.bloodType.trim() : ''
        const hobbies = typeof item?.hobbies === 'string' ? item.hobbies.trim() : ''
        const specialSkills = typeof item?.specialSkills === 'string' ? item.specialSkills.trim() : ''
        const qualifications = typeof item?.qualifications === 'string' ? item.qualifications.trim() : ''
        const bio = typeof item?.bio === 'string' ? item.bio.trim() : ''
        const career = typeof item?.career === 'string' ? item.career.trim() : ''

        const rawAchievementImages: unknown = item?.achievementImages
        const achievementImages: string[] = Array.isArray(rawAchievementImages)
          ? rawAchievementImages
              .filter((x) => typeof x === 'string')
              .map((x) => String(x).trim())
              .filter(Boolean)
              .slice(0, 30)
          : []

        const rawSns: unknown = item?.sns
        const sns: { label: string; url: string }[] = Array.isArray(rawSns)
          ? rawSns
              .map((x) => {
                const label = typeof (x as any)?.label === 'string' ? String((x as any).label).trim() : ''
                const url = typeof (x as any)?.url === 'string' ? String((x as any).url).trim() : ''
                return { label, url }
              })
              .filter((v) => v.label || v.url)
              .slice(0, 20)
          : []

        if (!mounted) return
        setRemote({
          loading: false,
          error: '',
          profileImages: profileImages.slice(0, 10),
          faceImageUrl,
          nameKana,
          nameEn,
          birthDate,
          birthplace,
          bloodType,
          hobbies,
          specialSkills,
          qualifications,
          sns,
          bio,
          career,
          achievementImages,
        })
      } catch (e) {
        if (!mounted) return
        setRemote((prev) => ({ ...prev, loading: false, error: e instanceof Error ? e.message : String(e) }))
      }
    }

    void run()
    return () => {
      mounted = false
    }
  }, [castId, props.apiBaseUrl])

  const carouselImages = remote.profileImages
  const carouselCount = Math.max(1, carouselImages.length)
  const hasProfileImages = carouselImages.length > 0
  const castCarouselDrag = useWebDragToScroll({ suppressPressMs: 250 })
  const castCarouselRef = castCarouselDrag.scrollRef

  const carouselStep = 210 + 12

  useEffect(() => {
    if (!hasProfileImages) return
    const clamped = Math.max(0, Math.min(props.castProfileSlideIndex, carouselCount - 1))
    castCarouselRef.current?.scrollTo({ x: clamped * carouselStep, animated: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProfileImages, carouselCount])

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
      {hasProfileImages ? (
        <View style={styles.castCarouselWrap}>
          <ScrollView
            ref={(r) => {
              castCarouselRef.current = r
            }}
            horizontal
            decelerationRate="fast"
            snapToInterval={carouselStep}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.castCarouselContent}
            style={Platform.OS === 'web' ? ({ cursor: 'grab' } as any) : null}
            {...(Platform.OS === 'web'
              ? ({ onMouseDownCapture: castCarouselDrag.onMouseDown, onPointerDownCapture: castCarouselDrag.onPointerDown } as any)
              : null)}
            onStartShouldSetResponderCapture={castCarouselDrag.shouldSetResponderCapture}
            onResponderGrant={castCarouselDrag.onResponderGrant}
            onScroll={(e) => {
              castCarouselDrag.onScroll(e)
              const x = e?.nativeEvent?.contentOffset?.x
              if (typeof x !== 'number') return
              const next = Math.round(x / carouselStep)
              props.setCastProfileSlideIndex(Math.max(0, Math.min(next, carouselCount - 1)))
            }}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x
              const next = Math.round(x / carouselStep)
              props.setCastProfileSlideIndex(Math.max(0, Math.min(next, carouselCount - 1)))
            }}
          >
            {carouselImages.map((uri, i, arr) => (
              <View
                key={i}
                style={[styles.castCarouselCard, i === arr.length - 1 ? null : { marginRight: 12 }]}
              >
                <Image source={{ uri }} style={styles.castCarouselCardInner} resizeMode="cover" />
              </View>
            ))}
          </ScrollView>

          <PaginationDots
            count={carouselCount}
            index={props.castProfileSlideIndex}
            style={styles.castCarouselDots}
            variant="plain"
            dotSize={6}
            activeColor={THEME.accent}
            inactiveColor={THEME.outline}
            onChange={(idx) => {
              const clamped = Math.max(0, Math.min(idx, carouselCount - 1))
              props.setCastProfileSlideIndex(clamped)
              castCarouselRef.current?.scrollTo({ x: clamped * carouselStep, animated: true })
            }}
          />

          {remote.loading ? (
            <Text style={[styles.bodyText, { marginTop: 8 }]}>読み込み中...</Text>
          ) : remote.error ? (
            <Text style={[styles.bodyText, { marginTop: 8 }]}>読み込み失敗: {remote.error}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.castTitleBlock, !hasProfileImages ? { alignItems: 'center' } : null]}>
        <Text style={[styles.castNameMain, !hasProfileImages ? { textAlign: 'center' } : null]}>{castName}</Text>
        {remote.nameKana ? <Text style={[styles.castNameSub, !hasProfileImages ? { textAlign: 'center' } : null]}>{remote.nameKana}</Text> : null}
        {remote.nameEn ? <Text style={[styles.castNameSub, !hasProfileImages ? { textAlign: 'center' } : null]}>{remote.nameEn}</Text> : null}
        <View style={[styles.castRatingRow, !hasProfileImages ? { justifyContent: 'center' } : null]}>
          <IconStarYellow width={14} height={14} />
          <Text style={styles.castRatingText}>{ratingText}</Text>
        </View>
      </View>

      <PrimaryButton
        label="推しポイント付与"
        onPress={() => {
          if (!props.requireLogin('coinGrant')) return

          if (!props.isSubscribed) {
            const thumb = remote.profileImages?.[0] || remote.faceImageUrl || null
            openSubscriptionUpsell({ workTitle: castName, thumbnailUrl: thumb })
            return
          }

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

      <View style={{ marginTop: 18 }}>
        <Text style={styles.sectionTitle}>プロフィール</Text>
        <ProfileRow styles={styles} label="ジャンル" value={String(props.selectedCast?.role ?? '').trim()} />
        <ProfileRow styles={styles} label="所属" value={String(props.selectedCast?.roleLabel ?? '').trim()} />
        <ProfileRow styles={styles} label="生年月日" value={remote.birthDate} />
        <ProfileRow styles={styles} label="出身地" value={remote.birthplace} />
        <ProfileRow styles={styles} label="血液型" value={remote.bloodType} />
        <ProfileRow styles={styles} label="趣味" value={remote.hobbies} />
        <ProfileRow styles={styles} label="特技" value={remote.specialSkills} />
        <ProfileRow styles={styles} label="資格" value={remote.qualifications} />

        {remote.faceImageUrl ? (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.subSectionTitle}>顔画像</Text>
            <View style={{ width: 96, height: 96, borderRadius: 10, overflow: 'hidden', backgroundColor: THEME.placeholder }}>
              <Image source={{ uri: remote.faceImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.profileSectionDivider} />

      <View>
        <Text style={styles.sectionTitle}>カテゴリ</Text>
        <View style={styles.profileTagWrap}>
          {(Array.isArray(props.selectedCast?.genres) ? props.selectedCast.genres : [String(props.selectedCast?.role ?? '')])
            .map((x: any) => String(x ?? '').trim())
            .filter(Boolean)
            .slice(0, 20)
            .map((label: string) => (
              <View key={label} style={styles.profileTag}>
                <Text style={styles.profileTagText}>{label}</Text>
              </View>
            ))}
        </View>
        {(!props.selectedCast?.genres || props.selectedCast.genres.length === 0) && !String(props.selectedCast?.role ?? '').trim() ? (
          <Text style={styles.profileBodyText}>—</Text>
        ) : null}
      </View>

      <View style={styles.profileSectionDivider} />

      <View>
        <Text style={styles.sectionTitle}>SNSリンク</Text>
        {remote.sns.length ? (
          remote.sns.map((item, idx) => {
            const url = String(item.url || '').trim()
            const meta = detectSocialService(url)
            const iconKey = detectSocialIconKey(url)
            const IconComp = iconKey ? SNS_ICONS[iconKey] : null
            const label = String(item.label || '').trim() || meta.label

            return (
              <Pressable
                key={`${label}:${url}:${idx}`}
                style={[styles.castSnsRow, idx === remote.sns.length - 1 ? styles.castSnsRowLast : null]}
                onPress={async () => {
                  try {
                    await openExternalUrl(url)
                  } catch (e) {
                    Alert.alert('エラー', e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                <View style={[styles.castSnsIcon, { alignItems: 'center', justifyContent: 'center' }]}>
                  {IconComp ? (
                    <IconComp width={28} height={28} />
                  ) : (
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={styles.castSnsIconText}>{meta.iconText}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.castSnsLabel}>{label}</Text>
                  <Text style={styles.castSnsUrl} numberOfLines={1}>
                    {url || '—'}
                  </Text>
                </View>
              </Pressable>
            )
          })
        ) : (
          <Text style={styles.profileBodyText}>—</Text>
        )}
      </View>

      <View style={styles.profileSectionDivider} />

      <View>
        <Text style={styles.sectionTitle}>自己PR</Text>
        {(remote.bio ? splitParagraphs(remote.bio) : ['—']).map((p, i) => (
          <View key={`bio-${i}`} style={{ marginBottom: 12 }}>
            <Text style={styles.profileBodyText}>{p}</Text>
            {i === 0 && extractUrls(remote.bio).length ? (
              <View style={{ marginTop: 10, gap: 6 }}>
                {extractUrls(remote.bio).map((u) => (
                  <Pressable
                    key={u}
                    onPress={async () => {
                      try {
                        await openExternalUrl(u)
                      } catch (e) {
                        Alert.alert('エラー', e instanceof Error ? e.message : String(e))
                      }
                    }}
                  >
                    <Text style={styles.profileLinkText} numberOfLines={1}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.profileSectionDivider} />

      <View>
        <Text style={styles.sectionTitle}>経歴・出演実績</Text>
        {(remote.career ? splitParagraphs(remote.career) : ['—']).map((p, i) => {
          const heading = isAngleBracketHeading(p)
          return (
            <View key={`career-${i}`} style={{ marginBottom: 12 }}>
              <Text style={heading ? styles.profileSubHeadingText : styles.profileBodyText}>{p}</Text>
            </View>
          )
        })}
        {extractUrls(remote.career).length ? (
          <View style={{ marginTop: 4, gap: 6 }}>
            {extractUrls(remote.career).map((u) => (
              <Pressable
                key={u}
                onPress={async () => {
                  try {
                    await openExternalUrl(u)
                  } catch (e) {
                    Alert.alert('エラー', e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                <Text style={styles.profileLinkText} numberOfLines={1}>
                  {u}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {remote.achievementImages.length ? (
        <>
          <View style={styles.profileSectionDivider} />
          <View>
            <Text style={styles.sectionTitle}>実績画像</Text>
            <View style={styles.profileGrid}>
              {remote.achievementImages.map((uri, idx) => (
                <View key={`${uri}:${idx}`} style={styles.profileGridItem}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.profileSectionDivider} />


      <View>
        <View style={styles.profileCommentsHeaderRow}>
          <Text style={styles.sectionTitle}>コメント（{props.castReviewSummary ? props.castReviewSummary.reviewCount : props.castLocalComments.length}件）</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IconStarYellow width={14} height={14} />
            <Text style={styles.profileCommentsHeaderRating}>{ratingText}</Text>
          </View>
        </View>

        {(props.castCommentsExpanded ? props.castLocalComments : props.castLocalComments.slice(0, 3)).map((c: any) => {
          const stars = props.commentStarRating(c)
          return (
            <View key={c.id} style={styles.profileCommentItem}>
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
          <Pressable style={styles.profileMoreRow} onPress={() => props.setCastCommentsExpanded(true)}>
            <Text style={styles.moreLink}>さらに表示</Text>
            <Text style={styles.moreLink}>▼</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.profileSectionDivider} />

      <View>
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
            style={styles.profileCommentInput}
          />

          <PrimaryButton label="コメントを投稿する" onPress={onSubmitComment} />
        </View>
      </View>
    </ScreenContainer>
  )
}
