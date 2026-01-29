/**
 * Work detail screen types
 */

export type WorkStaff = { role: string; name: string }

export type WorkEpisode = {
  id: string
  title: string
  episodeNo?: number | null
  thumbnailUrl?: string | null
  streamVideoId?: string | null
  priceCoin?: number
}

export type WorkDetailWork = {
  id: string
  title: string
  subtitle: string
  thumbnailUrl?: string | null
  tags: string[]
  rating: number
  reviews: number
  story: string
  episodes: WorkEpisode[]
  staff: WorkStaff[]
}

export type CommentItem = { id: string; author: string; body: string }

export type SubscriptionPromptState = {
  visible: boolean
  workId?: string
  episodeId?: string
  workTitle?: string
  thumbnailUrl?: string
}

export type WorkDetailScreenProps = {
  apiBaseUrl: string
  authToken: string

  loggedIn: boolean
  isSubscribed: boolean

  workIdForDetail: string
  workForDetail: WorkDetailWork

  workDetailHeroThumbnailUrl: string

  workReleaseYear: number
  workLikeCount: number
  workRatingAvg: number
  workReviewCount: number

  isWorkFavorite: boolean
  onToggleFavorite: () => void

  guestWorkAuthCtaDismissed: boolean
  onDismissGuestCta: () => void
  onLoginFromGuestCta: () => void
  onSignupFromGuestCta: () => void

  onBack: () => void
  onGoHome: () => void
  onOpenNotice: () => void
  onOpenSearch: () => void
  onPressTab: (tabKey: string) => void

  onPlayMain: () => void
  onPressComment: () => void
  shareWork: () => Promise<void>

  videoListTagSetter: (tag: string) => void
  onGoVideoList: () => void

  workDetailTab: 'episodes' | 'info'
  onChangeWorkDetailTab: (tab: 'episodes' | 'info') => void

  recommendedWorks: Array<{ id: string; thumbnailUrl?: string | null; episodes?: Array<{ thumbnailUrl?: string | null; streamVideoId?: string | null }> }>
  openWorkDetail: (workId: string) => void

  subscriptionPrompt: SubscriptionPromptState
  onCloseSubscriptionPrompt: () => void
  onStartTrialFromPrompt: () => void

  onPressEpisode: (episode: { id: string; thumbnailUrl: string; isMemberOnly: boolean }) => void

  productionLabel: string
  providerLabel: string

  resolveCastAccountIdByName: (name: string) => string | null
  requireLogin: (screenKey: string) => boolean
  onGoCoinGrantForCast: (opts: { accountId: string; name: string; roleLabel: string }) => void
  onOpenProfileForStaff: (opts: { id: string; name: string; roleLabel: string }) => void

  commentsBusy: boolean
  commentsError: boolean
  commentsExpanded: boolean
  onExpandComments: () => void
  approvedComments: CommentItem[]
  commentStarRating: (c: CommentItem) => number
  truncateCommentBody: (body: string) => string

  commentRating: number
  onChangeCommentRating: (rating: number) => void
  commentDraft: string
  onChangeCommentDraft: (value: string) => void
  onSubmitInlineComment: () => Promise<void>
  commentJustSubmitted: boolean

  favoriteToastVisible: boolean
  favoriteToastText: string
}
