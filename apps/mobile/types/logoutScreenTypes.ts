/**
 * Logout screen types
 */

export type Props = {
  onCancel: () => void
  onLogout: () => Promise<void> | void
  onGoLogin: () => void
}
