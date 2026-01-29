import { useEffect, useRef, useState } from 'react'

import { useToast } from './toast'

function guessKind(message: string): 'info' | 'success' | 'warning' | 'error' {
  const m = String(message || '').trim()
  if (!m) return 'info'
  if (/保存しました|保存完了|更新しました|作成しました|追加しました|登録しました|送信しました|送信完了|削除しました|完了/.test(m)) {
    return 'success'
  }
  if (/入力してください|選択してください|未入力|必須|不正|一致しません/.test(m)) return 'warning'
  if (/エラー|失敗|できません|例外|invalid|forbidden|unauthorized|not found|timeout/i.test(m)) return 'error'
  return 'info'
}

export function useBanner(initialValue = '') {
  const toast = useToast()
  const [banner, setBanner] = useState(initialValue)
  const lastRef = useRef('')

  useEffect(() => {
    const m = String(banner || '').trim()
    if (!m) return
    if (m === lastRef.current) return
    lastRef.current = m
    toast.show(m, { kind: guessKind(m) })
    setBanner('')
  }, [banner, toast])

  // 画面上のバナーは表示しない（トーストに寄せる）
  return ['', setBanner] as const
}
