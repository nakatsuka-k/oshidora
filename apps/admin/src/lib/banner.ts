import { useEffect, useRef, useState } from 'react'

import { useDialog } from './dialog'

function shouldShowErrorDialogFromBanner(message: string): boolean {
  const m = String(message || '').trim()
  if (!m) return false
  if (/入力してください|選択してください|未入力|必須/.test(m)) return false
  if (/保存しました|保存完了|更新しました|作成しました|追加しました|登録しました|送信しました|送信完了/.test(m)) return false
  return true
}

export function useBanner(initialValue = '') {
  const dialog = useDialog()
  const [banner, setBanner] = useState(initialValue)
  const lastRef = useRef('')

  useEffect(() => {
    const m = String(banner || '').trim()
    if (!m) return
    if (m === lastRef.current) return
    lastRef.current = m
    if (!shouldShowErrorDialogFromBanner(m)) return

    void dialog.confirm(m, { title: 'エラー', okText: '閉じる', hideCancel: true, danger: true })
  }, [banner, dialog])

  return [banner, setBanner] as const
}
