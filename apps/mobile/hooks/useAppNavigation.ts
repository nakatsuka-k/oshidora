import { useCallback, useState } from 'react'
import { Platform } from 'react-native'
import type { Screen } from '../App'
import {
  screenToWebPath,
  tutorialIndexToWebPath,
  webPathnameToScreen,
  workDetailToWebUrl,
  videoPlayerToWebUrl,
} from '../utils/webRoutes'

const WEB_DEFAULT_SCREEN: Screen = 'splash'

/**
 * Manages screen navigation state and history for the app
 */
export function useAppNavigation() {
  const [screen, setScreen] = useState<Screen>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const h = (window.location.hash || '').trim()
      if (h.startsWith('#/')) {
        try {
          window.history.replaceState(null, '', h.slice(1))
        } catch {
          // ignore
        }
      }
      return webPathnameToScreen(window.location.pathname) as Screen
    }
    return 'splash'
  })

  const [history, setHistory] = useState<Screen[]>([])
  const [tutorialIndex, setTutorialIndex] = useState<number>(0)

  const pushWebUrl = useCallback((url: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    try {
      window.history.pushState(null, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch {
      window.location.assign(url)
    }
  }, [])

  const replaceWebUrl = useCallback((url: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    try {
      window.history.replaceState(null, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch {
      window.location.assign(url)
    }
  }, [])

  const goTo = useCallback(
    (next: Screen, context?: { selectedWorkId?: string; workDetailEpisodeIdFromHash?: string; playerEpisodeContext?: any }) => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (next === 'tutorial') {
          setTutorialIndex(0)
          pushWebUrl(tutorialIndexToWebPath(0))
          return
        }

        if (next === 'workDetail') {
          const workId = String(context?.selectedWorkId ?? '').trim()
          const episodeId = String(context?.workDetailEpisodeIdFromHash ?? '').trim()
          pushWebUrl(workDetailToWebUrl({ workId, episodeId: episodeId || null }))
          return
        }

        if (next === 'videoPlayer') {
          const playerCtx = context?.playerEpisodeContext
          const wid = String(playerCtx?.workId ?? '').trim()
          const eid = wid ? String(playerCtx?.episodeIds?.[playerCtx.currentIndex] ?? '').trim() : ''
          pushWebUrl(wid ? videoPlayerToWebUrl({ workId: wid, episodeId: eid }) : '/play')
          return
        }

        pushWebUrl(screenToWebPath(next))
        return
      }

      setHistory((prev) => [...prev, screen])
      setScreen(next)
    },
    [screen, pushWebUrl]
  )

  const onTutorialIndexChange = useCallback(
    (next: number) => {
      setTutorialIndex(next)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        replaceWebUrl(tutorialIndexToWebPath(next))
      }
    },
    [replaceWebUrl]
  )

  const goBack = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        replaceWebUrl(screenToWebPath(WEB_DEFAULT_SCREEN))
        setHistory([])
        setScreen(WEB_DEFAULT_SCREEN)
      }
      return
    }

    setHistory((prev) => {
      if (prev.length === 0) return prev
      const nextHistory = prev.slice(0, -1)
      const prevScreen = prev[prev.length - 1]
      setScreen(prevScreen)
      return nextHistory
    })
  }, [replaceWebUrl])

  return {
    screen,
    setScreen,
    history,
    setHistory,
    tutorialIndex,
    setTutorialIndex,
    goTo,
    goBack,
    onTutorialIndexChange,
    pushWebUrl,
    replaceWebUrl,
  }
}
