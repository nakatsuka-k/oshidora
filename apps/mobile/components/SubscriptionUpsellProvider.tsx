import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { SubscriptionPromptModal } from './SubscriptionPromptModal'

type SubscriptionUpsellPayload = {
  thumbnailUrl?: string | null
  workTitle?: string | null
}

type SubscriptionUpsellContextValue = {
  open: (payload?: SubscriptionUpsellPayload) => void
  close: () => void
}

const SubscriptionUpsellContext = createContext<SubscriptionUpsellContextValue | null>(null)

export function SubscriptionUpsellProvider({
  children,
  onStartTrial,
}: {
  children: ReactNode
  onStartTrial: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [payload, setPayload] = useState<SubscriptionUpsellPayload>({})

  const close = useCallback(() => {
    setVisible(false)
  }, [])

  const open = useCallback((next?: SubscriptionUpsellPayload) => {
    setPayload(next ?? {})
    setVisible(true)
  }, [])

  const value = useMemo<SubscriptionUpsellContextValue>(() => ({ open, close }), [close, open])

  return (
    <SubscriptionUpsellContext.Provider value={value}>
      {children}
      <SubscriptionPromptModal
        visible={visible}
        thumbnailUrl={payload.thumbnailUrl ?? null}
        workTitle={payload.workTitle ?? null}
        onClose={close}
        onStartTrial={() => {
          close()
          onStartTrial()
        }}
      />
    </SubscriptionUpsellContext.Provider>
  )
}

export function useSubscriptionUpsell() {
  const ctx = useContext(SubscriptionUpsellContext)
  if (!ctx) throw new Error('useSubscriptionUpsell must be used within SubscriptionUpsellProvider')
  return ctx
}
