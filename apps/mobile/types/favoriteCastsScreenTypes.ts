/**
 * Favorite casts screen types
 */

export type FavoriteCastsScreenProps = {
  apiBaseUrl: string
  authToken: string
  loggedIn: boolean
  onBack: () => void
  onEdit: () => void
  onOpenProfile: (cast: { id: string; name: string; role: string }) => void
}

export type Cast = {
  id: string
  name: string
  role: string
  thumbnailUrl?: string
}

export type CastResponse = { items: Cast[] }
