import { useCallback, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, Platform } from 'react-native'

/**
 * Manages debug overlay state and interactions
 */
export function useDebugOverlay() {
  const [debugOverlayHidden, setDebugOverlayHidden] = useState<boolean>(false)
  const [debugEmailCode, setDebugEmailCode] = useState<string>('')
  const [debugSmsCode, setDebugSmsCode] = useState<string>('')
  const [debugPaypayMaskedLabel] = useState<string>('********')
  const [debugDotsIndex, setDebugDotsIndex] = useState<number>(0)
  const [debugSlideIndex, setDebugSlideIndex] = useState<number>(0)

  const debugOverlayPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const debugOverlayWebDragRef = useRef<{
    active: boolean
    pointerId?: number
    startClientX: number
    startClientY: number
  }>({ active: false, startClientX: 0, startClientY: 0 })

  const debugOverlayPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const cur = (debugOverlayPan as any).__getValue?.() as { x: number; y: number } | undefined
          debugOverlayPan.setOffset({ x: cur?.x ?? 0, y: cur?.y ?? 0 })
          debugOverlayPan.setValue({ x: 0, y: 0 })
        },
        onPanResponderMove: Animated.event([null, { dx: debugOverlayPan.x, dy: debugOverlayPan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: () => {
          debugOverlayPan.flattenOffset()
        },
        onPanResponderTerminate: () => {
          debugOverlayPan.flattenOffset()
        },
      }),
    [debugOverlayPan]
  )

  const debugOverlayWebDragHandlers = useMemo(() => {
    if (Platform.OS !== 'web') return null
    return {
      onPointerDown: (e: any) => {
        if (typeof e?.button === 'number' && e.button !== 0) return
        e?.preventDefault?.()

        const pointerId: number | undefined = typeof e?.pointerId === 'number' ? e.pointerId : undefined
        debugOverlayWebDragRef.current = {
          active: true,
          pointerId,
          startClientX: e?.clientX ?? 0,
          startClientY: e?.clientY ?? 0,
        }

        const cur = (debugOverlayPan as any).__getValue?.() as { x: number; y: number } | undefined
        debugOverlayPan.setOffset({ x: cur?.x ?? 0, y: cur?.y ?? 0 })
        debugOverlayPan.setValue({ x: 0, y: 0 })

        e?.currentTarget?.setPointerCapture?.(pointerId)
      },
      onPointerMove: (e: any) => {
        const st = debugOverlayWebDragRef.current
        if (!st.active) return
        if (typeof st.pointerId === 'number' && typeof e?.pointerId === 'number' && e.pointerId !== st.pointerId) return
        e?.preventDefault?.()

        const dx = (e?.clientX ?? 0) - st.startClientX
        const dy = (e?.clientY ?? 0) - st.startClientY
        debugOverlayPan.setValue({ x: dx, y: dy })
      },
      onPointerUp: (e: any) => {
        const st = debugOverlayWebDragRef.current
        if (!st.active) return
        if (typeof st.pointerId === 'number' && typeof e?.pointerId === 'number' && e.pointerId !== st.pointerId) return
        e?.preventDefault?.()

        debugOverlayWebDragRef.current = { active: false, startClientX: 0, startClientY: 0 }
        debugOverlayPan.flattenOffset()

        const pointerId: number | undefined = typeof e?.pointerId === 'number' ? e.pointerId : st.pointerId
        e?.currentTarget?.releasePointerCapture?.(pointerId)
      },
      onPointerCancel: (e: any) => {
        const st = debugOverlayWebDragRef.current
        if (!st.active) return
        if (typeof st.pointerId === 'number' && typeof e?.pointerId === 'number' && e.pointerId !== st.pointerId) return
        e?.preventDefault?.()

        debugOverlayWebDragRef.current = { active: false, startClientX: 0, startClientY: 0 }
        debugOverlayPan.flattenOffset()
      },
    }
  }, [debugOverlayPan])

  return {
    debugOverlayHidden,
    setDebugOverlayHidden,
    debugEmailCode,
    setDebugEmailCode,
    debugSmsCode,
    setDebugSmsCode,
    debugPaypayMaskedLabel,
    debugDotsIndex,
    setDebugDotsIndex,
    debugSlideIndex,
    setDebugSlideIndex,
    debugOverlayPan,
    debugOverlayPanResponder,
    debugOverlayWebDragHandlers,
  }
}
