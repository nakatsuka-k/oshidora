export type Oshi = { id: string; name: string; created_at: string }

export type Props = {
  styles: any

  apiBaseUrl: string
  health: string
  error: string
  loggedIn: boolean

  onGoLogin: () => void
  onGoProfile: () => void
  onGoWorkDetail: () => void
  onGoDev: () => void

  onCheckHealth: () => void
  onReload: () => void

  debugDotsIndex: number
  onChangeDebugDotsIndex: (next: number) => void

  debugSlideIndex: number
  onChangeDebugSlideIndex: (next: number) => void

  name: string
  onChangeName: (next: string) => void
  onAddOshi: () => void
  apiBusy: boolean
  items: Oshi[]
}

export const tutorialImages = [
  require('../assets/tutorial0.png'),
  require('../assets/tutorial1.png'),
  require('../assets/tutorial2.png'),
]
