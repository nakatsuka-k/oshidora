export type IpInfo = {
  ip?: string
  city?: string
  region?: string
  country?: string
}

export type Props = {
  styles: any
  ipInfo: IpInfo | null
  ipError: string | null
  onRetry: () => void
}
