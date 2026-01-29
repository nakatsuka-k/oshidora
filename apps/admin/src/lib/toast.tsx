import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

type ToastKind = 'info' | 'success' | 'warning' | 'error'

type ToastItem = {
  id: string
  message: string
  kind: ToastKind
}

type ToastOptions = {
  kind?: ToastKind
  durationMs?: number
}

type ToastApi = {
  show: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastApi | null>(null)

function colorsForKind(kind: ToastKind): { bg: string; border: string; text: string } {
  switch (kind) {
    case 'success':
      return { bg: '#ecfdf5', border: '#10b981', text: '#065f46' }
    case 'warning':
      return { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' }
    case 'error':
      return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' }
    default:
      return { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' }
  }
}

function normalizeMessage(v: unknown): string {
  return String(v ?? '').trim()
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timersRef = useRef<Record<string, any>>({})

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
    const t = timersRef.current[id]
    if (t) {
      clearTimeout(t)
      delete timersRef.current[id]
    }
  }, [])

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      const m = normalizeMessage(message)
      if (!m) return

      const kind = options?.kind ?? 'info'
      const durationMs = Math.max(1500, Math.min(15000, Number(options?.durationMs ?? 4500) || 4500))
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`

      setItems((prev) => {
        const next = prev.length >= 5 ? prev.slice(prev.length - 4) : prev
        return [...next, { id, message: m, kind }]
      })

      timersRef.current[id] = setTimeout(() => remove(id), durationMs)
    },
    [remove]
  )

  const value = useMemo<ToastApi>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.stack}>
          {items.map((t) => {
            const c = colorsForKind(t.kind)
            return (
              <Pressable
                key={t.id}
                onPress={() => remove(t.id)}
                style={[styles.toast, { backgroundColor: c.bg, borderColor: c.border }]}
              >
                <Text style={[styles.toastText, { color: c.text }]} numberOfLines={5}>
                  {t.message}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Provider無しでも落ちないように（ただし表示されない）
    return { show: () => {} }
  }
  return ctx
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  stack: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: Platform.OS === 'web' ? 380 : 320,
    maxWidth: '90%',
    gap: 10 as any,
  },
  toast: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  toastText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
})
