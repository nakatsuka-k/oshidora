/**
 * Work review screen types
 */

export type WorkReviewScreenProps = {
  onBack: () => void
  work: {
    id: string
    title: string
    subtitle?: string
  }
  initial?: {
    rating?: number | null
    comment?: string | null
  }
  onSubmit: (opts: { contentId: string; rating: number; comment: string }) => Promise<void>
  onDone: () => void
}

export const MAX_COMMENT_LEN = 500
