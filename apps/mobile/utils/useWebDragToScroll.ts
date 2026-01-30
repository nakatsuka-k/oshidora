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
  onMouseDown: (e: any) => void
  onPointerDown: (e: any) => void
  shouldSetResponderCapture: (e: any) => boolean
  allowPress: () => boolean
}

function isTouchLikeEvent(e: any): boolean {
  const ne = e?.nativeEvent ?? e

  // Pointer Events
  const pointerType = ne?.pointerType
  if (pointerType === 'touch') return true

  // Touch Events
  const touches = ne?.touches ?? ne?.changedTouches
  if (Array.isArray(touches) && touches.length > 0) return true

  return false
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

  const scrollToX = useCallback((x: number) => {
    const target: any = scrollRef.current
    if (!target) return x

    const getNode = (): any => {
      try {
        if (typeof target.getScrollableNode === 'function') return target.getScrollableNode()
      } catch {
        // ignore
      }
      if (typeof target.scrollLeft === 'number') return target
      return null
    }

    const node = getNode()
    const max = node && typeof node.scrollWidth === 'number' && typeof node.clientWidth === 'number'
      ? Math.max(0, node.scrollWidth - node.clientWidth)
      : null

    const clamped = typeof max === 'number' ? Math.max(0, Math.min(x, max)) : x

    // React Native ScrollView API
    if (typeof target.scrollTo === 'function') {
      try {
        target.scrollTo({ x: clamped, animated: false })
        return typeof node?.scrollLeft === 'number' ? node.scrollLeft : clamped
      } catch {
        // fallthrough
      }

      // DOM element API
      try {
        target.scrollTo({ left: clamped, top: 0, behavior: 'auto' })
        return typeof node?.scrollLeft === 'number' ? node.scrollLeft : clamped
      } catch {
        // fallthrough
      }
    }

    // Direct DOM node fallback.
    if (node) {
      try {
        if (typeof node.scrollTo === 'function') {
          node.scrollTo({ left: clamped, top: 0, behavior: 'auto' })
          return typeof node.scrollLeft === 'number' ? node.scrollLeft : clamped
        }
      } catch {
        // ignore
      }

      if (typeof node.scrollLeft === 'number') {
        node.scrollLeft = clamped
        return node.scrollLeft
      }
    }

    return clamped
  }, [])

  const getCurrentScrollX = useCallback((): number => {
    const target: any = scrollRef.current
    if (!target) return scrollXRef.current

    try {
      const node = typeof target.getScrollableNode === 'function' ? target.getScrollableNode() : null
      if (node && typeof node.scrollLeft === 'number') return node.scrollLeft
    } catch {
      // ignore
    }

    if (typeof target.scrollLeft === 'number') return target.scrollLeft
    return scrollXRef.current
  }, [])

  const allowPress = useCallback(() => {
    return Date.now() > suppressPressUntilRef.current
  }, [])

  const cleanupRef = useRef<null | (() => void)>(null)

  const startDrag = useCallback(
    (e: any) => {
      if (Platform.OS !== 'web') return
      if (typeof window === 'undefined') return

      // Prevent double-binding when multiple handlers fire (e.g. pointer + mouse).
      if (cleanupRef.current) return

      // On touch devices (including mobile browsers in "desktop site" mode),
      // let the browser handle native touch scrolling.
      if (isTouchLikeEvent(e)) return

      const ne = e?.nativeEvent ?? e
      const startX = ne?.pageX ?? ne?.clientX
      if (typeof startX !== 'number') return

      const pointerId: number | null = typeof ne?.pointerId === 'number' ? ne.pointerId : null

      if (typeof ne?.preventDefault === 'function') ne.preventDefault()
      if (typeof e?.preventDefault === 'function') e.preventDefault()

      const startScrollX = getCurrentScrollX()
      let moved = false

      const doc = typeof document !== 'undefined' ? document : null
      const prevUserSelect = doc?.body?.style?.userSelect
      if (doc?.body?.style) doc.body.style.userSelect = 'none'

      const cleanup = () => {
        if (!cleanupRef.current) return
        cleanupRef.current = null

        window.removeEventListener('mousemove', onMove as any)
        window.removeEventListener('mouseup', onUp as any)
        window.removeEventListener('pointermove', onPointerMove as any)
        window.removeEventListener('pointerup', onUp as any)
        window.removeEventListener('pointercancel', onUp as any)
        window.removeEventListener('blur', onUp as any)

        if (doc?.body?.style && typeof prevUserSelect === 'string') doc.body.style.userSelect = prevUserSelect
        if (moved) suppressPressUntilRef.current = Date.now() + suppressPressMs
      }

      const onMove = (ev: MouseEvent) => {
        const x = (ev as any).pageX ?? (ev as any).clientX
        if (typeof x !== 'number') return

        const dx = x - startX
        if (!moved && Math.abs(dx) >= dragThresholdPx) moved = true

        const nextX = startScrollX - dx
        const applied = scrollToX(nextX)
        scrollXRef.current = applied
        if (moved) suppressPressUntilRef.current = Date.now() + suppressPressMs

        if (typeof ev.preventDefault === 'function') ev.preventDefault()
      }

      const onPointerMove = (ev: PointerEvent) => {
        if (pointerId !== null && (ev as any).pointerId !== pointerId) return

        const x = (ev as any).pageX ?? (ev as any).clientX
        if (typeof x !== 'number') return

        const dx = x - startX
        if (!moved && Math.abs(dx) >= dragThresholdPx) moved = true

        const nextX = startScrollX - dx
        const applied = scrollToX(nextX)
        scrollXRef.current = applied
        if (moved) suppressPressUntilRef.current = Date.now() + suppressPressMs

        if (typeof ev.preventDefault === 'function') ev.preventDefault()
      }

      const onUp = () => cleanup()

      cleanupRef.current = cleanup

      window.addEventListener('mousemove', onMove as any, { passive: false } as any)
      window.addEventListener('mouseup', onUp as any)

      // Prefer pointer events when available, because we may start with pointerdown.
      window.addEventListener('pointermove', onPointerMove as any, { passive: false } as any)
      window.addEventListener('pointerup', onUp as any)
      window.addEventListener('pointercancel', onUp as any)

      // If the window loses focus, ensure we stop dragging.
      window.addEventListener('blur', onUp as any)
    },
    [dragThresholdPx, getCurrentScrollX, scrollToX, suppressPressMs]
  )

  const onResponderGrant = useCallback((e: any) => startDrag(e), [startDrag])
  const onMouseDown = useCallback((e: any) => startDrag(e), [startDrag])
  const onPointerDown = useCallback((e: any) => startDrag(e), [startDrag])

  const shouldSetResponderCapture = useCallback((e: any) => {
    if (Platform.OS !== 'web') return false
    return !isTouchLikeEvent(e)
  }, [])

  return { scrollRef, onScroll, onResponderGrant, onMouseDown, onPointerDown, shouldSetResponderCapture, allowPress }
}
