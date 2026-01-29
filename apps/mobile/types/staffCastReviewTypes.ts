/**
 * Staff cast review screen types
 */

export type StaffCastReviewScreenProps = {
  onBack: () => void
  cast: {
    id: string
    name: string
    roleLabel?: string
    profileImageUrl?: string | null
  }
  initial?: {
    rating?: number | null
    comment?: string | null
  }
  onSubmit: (opts: { castId: string; rating: number; comment: string }) => Promise<void>
  onDone: () => void
}

export const MAX_COMMENT_LEN = 500
