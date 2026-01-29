import { useState } from 'react'

/**
 * Manages video player state and episode context
 */
export function usePlayerState() {
  const [playerVideoIdNoSub, setPlayerVideoIdNoSub] = useState<string>(() => '')
  const [playerVideoIdWithSub, setPlayerVideoIdWithSub] = useState<string | null>(null)
  const [playerEpisodeContext, setPlayerEpisodeContext] = useState<{
    workId: string
    episodeIds: string[]
    currentIndex: number
  } | null>(null)
  const [playerHydrating, setPlayerHydrating] = useState<boolean>(false)

  return {
    playerVideoIdNoSub,
    setPlayerVideoIdNoSub,
    playerVideoIdWithSub,
    setPlayerVideoIdWithSub,
    playerEpisodeContext,
    setPlayerEpisodeContext,
    playerHydrating,
    setPlayerHydrating,
  }
}
