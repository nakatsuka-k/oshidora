type DateLike = string | number | Date | null | undefined

function parseAsJstWallClock(s: string): Date | null {
  // Accept: YYYY-MM-DD, YYYY-MM-DD HH:mm, YYYY-MM-DD HH:mm:ss
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = m[4] ? Number(m[4]) : 0
  const minute = m[5] ? Number(m[5]) : 0
  const second = m[6] ? Number(m[6]) : 0

  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null
  if (second < 0 || second > 59) return null

  // Interpret the input as Asia/Tokyo wall-clock time, then convert to an absolute instant.
  // JST is UTC+9 with no DST.
  const utcMs = Date.UTC(year, month - 1, day, hour - 9, minute, second)
  const d = new Date(utcMs)
  return Number.isNaN(d.getTime()) ? null : d
}

function toDate(value: DateLike): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(value).trim()
  if (!s) return null

  // If it's a plain "YYYY-MM-DD ..." without timezone, treat it as JST wall-clock.
  const asJst = parseAsJstWallClock(s)
  if (asJst) return asJst

  // Otherwise, let Date parse (handles ISO strings with timezone like Z / +09:00).
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatJaDateTime(value: DateLike, opts?: { withSeconds?: boolean }): string {
  const raw = value == null ? '' : String(value).trim()
  if (!raw) return ''
  const d = toDate(value)
  if (!d) return raw

  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(opts?.withSeconds ? { second: '2-digit' as const } : null),
    hour12: false,
  }).formatToParts(d)

  const map = parts.reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value
    return acc
  }, {} as Record<string, string>)

  const date = `${map.year ?? ''}年${map.month ?? ''}月${map.day ?? ''}日`
  const time = `${map.hour ?? ''}:${map.minute ?? ''}${opts?.withSeconds ? `:${map.second ?? ''}` : ''}`
  return `${date} ${time}`.trim()
}

export function formatJaDate(value: DateLike): string {
  const raw = value == null ? '' : String(value).trim()
  if (!raw) return ''
  const d = toDate(value)
  if (!d) return raw

  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
