/**
 * User profile edit screen types and utilities
 */

export type UserProfileEditScreenProps = {
  apiBaseUrl: string
  onBack: () => void
  onRequestEmailChange?: () => void
  onRequestPhoneChange?: () => void
  onSave: (opts: {
    displayName: string
    fullName: string
    fullNameKana: string
    email: string
    phone: string
    birthDate: string
    favoriteGenres: string[]
    password?: string
    avatarUrl?: string
  }) => Promise<void>
  initialDisplayName?: string
  initialFullName?: string
  initialFullNameKana?: string
  initialEmail?: string
  initialPhone?: string
  initialBirthDate?: string
  initialFavoriteGenres?: string[]
  initialAvatarUrl?: string
  initialUserId?: string
  isNewRegistration?: boolean
}

export const GENRE_GROUPS: Array<{ title: string; options: string[] }> = [
  {
    title: '🎬 定番・王道ジャンル',
    options: ['アクション', 'アドベンチャー', 'SF', 'ファンタジー', 'ミステリー', 'サスペンス', 'スリラー', 'ホラー', 'パニック', 'クライム（犯罪）', 'スパイ・諜報もの'],
  },
  {
    title: '❤️ 感情・人間ドラマ系',
    options: ['恋愛（ラブストーリー）', 'ヒューマンドラマ', '家族ドラマ', '青春', '成長物語', '感動系', '切ない系', '泣ける作品', '心温まる系'],
  },
  {
    title: '😂 コメディ・ライト系',
    options: ['コメディ', 'ラブコメ', 'ブラックコメディ', 'ドタバタコメディ', '日常系', 'ゆる系', 'ほのぼの系'],
  },
  {
    title: '🧠 知的・重厚系',
    options: ['社会派', '政治ドラマ', '法廷ドラマ', '医療ドラマ', '経済・ビジネス', '実話・実録ベース', '歴史ドラマ', '時代劇'],
  },
  {
    title: '🔮 特殊設定・尖り系',
    options: ['タイムトラベル', 'パラレルワールド', 'デスゲーム', 'サバイバル', 'ディストピア', '終末世界', 'クローズドサークル', '一話完結型', '群像劇'],
  },
  {
    title: '🧑‍🤝‍🧑 キャラクター・関係性重視',
    options: ['バディもの', 'チームもの', '群像劇', 'ライバル関係', '師弟関係', '女性主人公', '男性主人公', '子供が活躍する作品'],
  },
  {
    title: '🌍 世界観・舞台別',
    options: ['日本作品', '海外作品', 'アジアドラマ', '韓国ドラマ', '中国ドラマ', 'ヨーロッパ作品', 'ハリウッド映画'],
  },
  {
    title: '🎥 フォーマット・作風',
    options: ['短編ドラマ', '長編映画', 'シリーズもの', 'シーズン制', '原作あり（漫画・小説）', 'オリジナル作品', '低予算インディーズ', 'アート系・実験的'],
  },
  {
    title: '🔥 テーマ・刺激強め',
    options: ['バイオレンス強め', 'ダークな世界観', '心理描写重視', '倫理観を問う', 'どんでん返し系', '考察したくなる作品'],
  },
  {
    title: '👨‍👩‍👧‍👦 視聴シーン別（地味に便利）',
    options: ['一人でじっくり観たい', '家族で観られる', '子供と一緒に観たい', '気軽に流し見', '一気見したい', '寝る前に観たい'],
  },
]
