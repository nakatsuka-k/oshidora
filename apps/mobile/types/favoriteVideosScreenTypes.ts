/**
 * Favorite videos screen types
 */

export type Props = {
  apiBaseUrl: string
  authToken: string | null
  loggedIn: boolean
  onBack: () => void
  onOpenVideo: (id: string) => void
}

export type VideoItem = {
  id: string
  title: string
  thumbnailUrl?: string
}

export type FavoritesResponse = {
  items: VideoItem[]
}
