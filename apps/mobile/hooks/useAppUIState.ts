import { useState } from 'react'

/**
 * Manages general UI state for screens and data
 */
export function useAppUIState() {
  const [health, setHealth] = useState<string>('')
  const [items, setItems] = useState<any[]>([])
  const [name, setName] = useState<string>('')
  const [apiBusy, setApiBusy] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('')
  const [videoListTag, setVideoListTag] = useState<string | null>(null)

  return {
    health,
    setHealth,
    items,
    setItems,
    name,
    setName,
    apiBusy,
    setApiBusy,
    error,
    setError,
    selectedNoticeId,
    setSelectedNoticeId,
    videoListTag,
    setVideoListTag,
  }
}
