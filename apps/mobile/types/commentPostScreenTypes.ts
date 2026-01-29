/**
 * Comment post screen types and utilities
 */

export type CommentPostScreenProps = {
  onBack: () => void
  workId: string
  workTitle: string
  onSubmitted: (opts: { workId: string; body: string }) => Promise<void>
  onDone: () => void
}

export const MAX_LEN = 500
