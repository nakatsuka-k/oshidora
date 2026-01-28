import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'

import { styles } from '../ui/styles'

type ConfirmOptions = {
  title?: string
  okText?: string
  cancelText?: string
  danger?: boolean
  hideCancel?: boolean
}

type DialogContextValue = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function useDialog() {
  const v = useContext(DialogContext)
  if (!v) throw new Error('Dialog is not configured')
  return v
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean
    message: string
    options: ConfirmOptions
    resolve: ((v: boolean) => void) | null
  }>({ open: false, message: '', options: {}, resolve: null })

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, message, options, resolve })
    })
  }, [])

  const close = useCallback((result: boolean) => {
    setState((prev) => {
      try {
        prev.resolve?.(result)
      } catch {
        // ignore
      }
      return { open: false, message: '', options: {}, resolve: null }
    })
  }, [])

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}

      <Modal transparent animationType="fade" visible={state.open} onRequestClose={() => close(false)}>
        <Pressable onPress={() => close(false)} style={styles.dialogOverlay}>
          <Pressable onPress={() => {}} style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>{state.options.title || '確認'}</Text>
            <Text style={styles.dialogMessage}>{state.message}</Text>
            <View style={styles.dialogActionsRow}>
              {state.options.hideCancel ? null : (
                <Pressable onPress={() => close(false)} style={styles.dialogBtn}>
                  <Text style={styles.dialogBtnText}>{state.options.cancelText || 'キャンセル'}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => close(true)}
                style={[styles.dialogBtn, state.options.danger ? styles.dialogBtnDanger : styles.dialogBtnOk]}
              >
                <Text style={[styles.dialogBtnText, styles.dialogBtnOkText]}>{state.options.okText || 'OK'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  )
}
