import type { MutableRefObject } from 'react'
import { useCallback, useRef } from 'react'
import { Platform, type ScrollView } from 'react-native'

export type UseWebDragToScrollOptions = {
  suppressPressMs?: number
  dragThresholdPx?: number
}

export type WebDragToScroll = {
  scrollRef: MutableRefObject<ScrollView | null>
  onScroll: (e: any) => void
  onResponderGrant: (e: any) => void
  allowPress: () => boolean
}

export function useWebDragToScroll(options: UseWebDragToScrollOptions = {}): WebDragToScroll {
  const suppressPressMs = options.suppressPressMs ?? 250
  const dragThresholdPx = options.dragThresholdPx ?? 4

  const scrollRef = useRef<ScrollView | null>(null)
  const scrollXRef = useRef(0)
  const suppressPressUntilRef = useRef(0)

  const onScroll = useCallback((e: any) => {
    const x = e?.nativeEvent?.contentOffset?.x
    if (typeof x === 'number') scrollXRef.current = x
  }, [])

  const allowPress = useCallback(() => {
    return Date.now() > suppressPressUntilRef.current
  }, [])

  const onResponderGrant = useCallback(
    (e: any) => {
      if (Platform.OS !== 'web') return
      if (typeof window === 'undefined') return

      const startX = e?.nativeEvent?.pageX ?? e?.nativeEvent?.clientX ?? e?.pageX ?? e?.clientX
      if (typeof startX !== 'number') return

      if (typeof e?.preventDefault === 'function') e.preventDefault()

      const startScrollX = scrollXRef.current
      let moved = false

      const onMove = (ev: MouseEvent) => {
        const x = (ev as any).pageX ?? (ev as any).clientX
        if (typeof x !== 'number') return

        const dx = x - startX
        if (!moved && Math.abs(dx) >= dragThresholdPx) moved = true

        scrollRef.current?.scrollTo({ x: startScrollX - dx, animated: false })
        if (moved) suppressPressUntilRef.current = Date.now() + suppressPressMs

        if (typeof ev.preventDefault === 'function') ev.preventDefault()
      }

      const onUp = () => {
        window.removeEventListener('mousemove', onMove as any)
        window.removeEventListener('mouseup', onUp as any)
        if (moved) suppressPressUntilRef.current = Date.now() + suppressPressMs
      }

      window.addEventListener('mousemove', onMove as any, { passive: false } as any)
      window.addEventListener('mouseup', onUp as any)
    },
    [dragThresholdPx, suppressPressMs]
  )

  return { scrollRef, onScroll, onResponderGrant, allowPress }
}
