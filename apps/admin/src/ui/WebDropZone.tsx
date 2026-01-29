import { useCallback, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'

export function WebDropZone(props: {
  title: string
  hint?: string
  disabled?: boolean
  accept?: string
  multiple?: boolean
  maxFilesLabel?: string
  onFiles: (files: File[]) => void | Promise<void>
}) {
  const { title, hint, disabled = false, accept, multiple = true, maxFilesLabel, onFiles } = props

  const [dragging, setDragging] = useState(false)
  const dragDepthRef = useRef(0)

  const inputRef = useRef<HTMLInputElement | null>(null)

  const borderColor = useMemo(() => {
    if (disabled) return '#d1d5db'
    if (dragging) return '#2563eb'
    return '#9ca3af'
  }, [disabled, dragging])

  const bgColor = useMemo(() => {
    if (disabled) return '#f9fafb'
    if (dragging) return 'rgba(37, 99, 235, 0.08)'
    return '#fff'
  }, [disabled, dragging])

  const pickFiles = useCallback(() => {
    if (disabled) return
    inputRef.current?.click()
  }, [disabled])

  const handleFiles = useCallback(
    (files: File[]) => {
      const normalized = (files || []).filter((f) => f && typeof f === 'object')
      if (!normalized.length) return
      void onFiles(normalized)
    },
    [onFiles]
  )

  const onDragEnter = useCallback(
    (e: any) => {
      if (disabled) return
      e?.preventDefault?.()
      dragDepthRef.current += 1
      setDragging(true)
    },
    [disabled]
  )

  const onDragLeave = useCallback(
    (e: any) => {
      if (disabled) return
      e?.preventDefault?.()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setDragging(false)
    },
    [disabled]
  )

  const onDragOver = useCallback(
    (e: any) => {
      if (disabled) return
      e?.preventDefault?.()
      try {
        if (e?.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      } catch {
        // ignore
      }
    },
    [disabled]
  )

  const onDrop = useCallback(
    (e: any) => {
      if (disabled) return
      e?.preventDefault?.()
      dragDepthRef.current = 0
      setDragging(false)

      const list = (e?.dataTransfer?.files as FileList | undefined) ?? undefined
      const files = Array.from(list ?? [])
      handleFiles(files)
    },
    [disabled, handleFiles]
  )

  if (Platform.OS !== 'web') return null

  return (
    <div
      style={
        {
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor,
          borderRadius: 12,
          backgroundColor: bgColor,
          padding: 14,
        } as any
      }
      onDragEnter={onDragEnter as any}
      onDragLeave={onDragLeave as any}
      onDragOver={onDragOver as any}
      onDrop={onDrop as any}
    >
      <View style={{ gap: 6 } as any}>
        <Pressable disabled={disabled} onPress={pickFiles} style={{ gap: 6 } as any}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: disabled ? '#9ca3af' : '#111827' } as any}>{title}</Text>
          <Text style={{ fontSize: 12, color: disabled ? '#9ca3af' : '#374151' } as any}>
            {dragging ? 'ここにドロップしてください' : 'ここにドラッグ&ドロップ、またはクリックでファイル選択'}
          </Text>
          {maxFilesLabel ? <Text style={{ fontSize: 12, color: '#6b7280' } as any}>{maxFilesLabel}</Text> : null}
          {hint ? <Text style={{ fontSize: 12, color: '#6b7280' } as any}>{hint}</Text> : null}
        </Pressable>

        <input
          ref={(el) => {
            inputRef.current = el
          }}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          style={{ display: 'none' }}
          onChange={(e: any) => {
            const files = Array.from((e?.target?.files as FileList | undefined) ?? []) as File[]
            if (files.length) handleFiles(files)
            try {
              if (e?.target) e.target.value = ''
            } catch {
              // ignore
            }
          }}
        />
      </View>
    </div>
  )
}
