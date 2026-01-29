/**
 * Notice detail screen types
 */

export type NoticeDetailScreenProps = {
  apiBaseUrl: string
  noticeId: string
  onBack: () => void
}

export type NoticeDetail = {
  id: string
  title: string
  publishedAt: string
  bodyHtml: string
  tags?: string[]
}

export type NoticeDetailResponse = {
  item: NoticeDetail | null
}
