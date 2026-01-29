export type Screen = 'login' | 'app'

export type RouteId =
  | 'login'
  | 'password-reset'
  | 'not-found'
  | 'dev'
  | 'dashboard'
  // 動画管理
  | 'videos-scheduled'
  | 'videos-scheduled-detail'
  | 'videos'
  | 'video-categories'
  | 'video-tags'
  | 'video-detail'
  | 'video-upload'
  | 'unapproved-videos'
  | 'unapproved-video-detail'
  | 'unapproved-actor-accounts'
  | 'unapproved-actor-account-detail'
  | 'recommend'
  | 'pickup'
  // 作品管理
  | 'works'
  | 'work-detail'
  | 'work-new'
  // コメント管理
  | 'comments-pending'
  | 'comment-approve'
  | 'comments'
  | 'comment-edit'
  // ユーザー管理
  | 'users'
  | 'user-detail'
  | 'user-new'
  // お知らせ
  | 'notices'
  | 'notice-detail'
  | 'notice-new'
  // ランキング
  | 'ranking-videos'
  | 'ranking-coins'
  | 'ranking-actors'
  | 'ranking-directors'
  | 'ranking-writers'
  // マスタ管理
  | 'categories'
  | 'category-detail'
  | 'category-new'
  | 'tags'
  | 'tag-edit'
  | 'tag-new'
  | 'genres'
  | 'genre-detail'
  | 'genre-new'
  | 'cast-categories'
  | 'cast-category-detail'
  | 'cast-category-new'
  | 'coin'
  | 'coin-setting-detail'
  | 'coin-setting-new'
  // 管理者
  | 'admins'
  | 'admin-detail'
  | 'admin-new'
  // その他
  | 'castStaff'
  | 'castStaff-detail'
  | 'castStaff-new'
  | 'inquiries'
  | 'inquiry-detail'
  | 'settings'

export type SidebarEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; id: RouteId; label: string; indent?: number }

export type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
  mock: boolean
}

export type ConfirmOptions = {
  title?: string
  okText?: string
  cancelText?: string
  danger?: boolean
}

export type DialogContextValue = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>
}

export type KPIItem = {
  id: string
  label: string
  value: string
  route?: RouteId
}

export type ActivityItem = {
  id: string
  type: 'video' | 'user' | 'admin' | 'comment'
  description: string
  timestamp: number
}

export type MultiSelectOption = { label: string; value: string; detail?: string }

export type UnapprovedVideoRow = {
  id: string
  title: string
  uploadedBy: string
  uploadedAt: string
}

export type UnapprovedActorAccountRow = {
  id: string
  name: string
  appliedAt: string
}
