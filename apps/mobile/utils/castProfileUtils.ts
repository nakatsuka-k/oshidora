import { Alert, Platform } from 'react-native'

export type CastProfileDraft = {
  profileImages: any[]
  faceImageUrl: string
  name: string
  nameKana: string
  nameAlphabet: string
  affiliation: string
  genres: string[]
  birthDate: string
  birthplace: string
  bloodType: string
  hobbies: string
  specialSkills: string
  qualifications: string
  categories: string[]
  socialLinks: Array<{ url: string }>
  bio: string
  career: string
  privatePdfUrl: string
}

export type CastProfileStatus = 'unregistered' | 'pending' | 'published' | 'rejected'

export type SocialLink = { url: string }

export type StoredCastProfile = {
  status: CastProfileStatus
  approvedAt?: string
  rejectionReason?: string
  draft: CastProfileDraft
}

export type CastProfileRegisterScreenProps = {
  apiBaseUrl: string
  authToken?: string
  onBack: () => void
  activeTab?: 'home' | 'video' | 'cast' | 'search' | 'mypage'
  onPressTab?: (tabKey: 'home' | 'video' | 'cast' | 'search' | 'mypage') => void
}

export const STORAGE_KEY = 'cast_profile_me_v1'
export const GENRE_OPTIONS = ['女優', '俳優', '脚本', '演出', '制作', 'その他']
export const STANDARD_CATEGORY_OPTIONS = ['感情・人間ドラマ', 'コメディ・ライト']
export const GENRE_TAG_OPTIONS = [
  'アクション',
  'アドベンチャー',
  'SF',
  'ファンタジー',
  'ミステリー',
  'サスペンス',
  'スリラー',
  'ホラー',
  'パニック',
  'クライム（犯罪）',
  'スパイ・諜報もの',
]

export function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`)
    return
  }
  Alert.alert(title, message)
}

export function confirmDiscard(message: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message)
  }
  // native confirm handled by Alert in caller
  return false
}

export function emptyDraft(): CastProfileDraft {
  return {
    profileImages: [],
    faceImageUrl: '',
    name: '',
    nameKana: '',
    nameAlphabet: '',
    affiliation: '',
    genres: [],
    birthDate: '',
    birthplace: '',
    bloodType: '',
    hobbies: '',
    specialSkills: '',
    qualifications: '',
    categories: [],
    socialLinks: [{ url: '' }],
    bio: '',
    career: '',
    privatePdfUrl: '',
  }
}

export function statusLabel(status: CastProfileStatus): string {
  switch (status) {
    case 'unregistered':
      return '未登録'
    case 'pending':
      return '承認待ち'
    case 'published':
      return '公開中'
    case 'rejected':
      return '差し戻し'
    default:
      return String(status)
  }
}
