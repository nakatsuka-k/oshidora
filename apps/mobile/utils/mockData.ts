import type { ApprovedComment, WorkDetailWork, WorkKey } from '../types/appTypes'

export const MOCK_LOGIN_EMAIL = 'demo@oshidora.jp'
export const MOCK_LOGIN_PASSWORD = 'password123'

export const mockWork: WorkDetailWork = {
  id: 'content-1',
  title: 'ダウトコール',
  subtitle: 'あなた、浮気されてますよ。',
  tags: ['Drama', 'Mystery', 'Romance'],
  rating: 4.7,
  reviews: 128,
  story:
    '夫といつも通りの会話をしていると、突然スマホが鳴る。\nドキドキしながら手に取ると…「あなた、浮気されてますよ」\nと不気味な女から一言。\n\nそこから日々の調査は加速し、次々と"自分だけが知らない日常"が暴かれていく。\n結果として浮気しているのは誰なのか？浮気がばれてどんな復讐が待っているのか？',
  episodes: [
    { id: '01', title: '第01話', priceCoin: 0 },
    { id: '02', title: '第02話', priceCoin: 0 },
    { id: '03', title: '第03話', priceCoin: 30 },
  ],
  staff: [
    { role: '出演者', name: '松岡美沙' },
    { role: '出演者', name: '櫻井拓馬' },
    { role: '監督', name: '監督太郎' },
    { role: '制作プロダクション', name: 'Oshidora株式会社' },
  ],
}

export const createMockWorksByKey = (mockWorkData: WorkDetailWork): Record<WorkKey, WorkDetailWork> => ({
  doutcall: mockWorkData,
  mysteryX: {
    id: 'content-2',
    title: 'ミステリーX',
    subtitle: '目撃者は、あなた自身。',
    tags: ['Mystery', 'Drama'],
    rating: 4.4,
    reviews: 61,
    story:
      'ある夜、街の監視カメラに映ったのは"ありえない自分"。\n記憶の空白を埋めるため、あなたは手がかりを追い始める。\n\n真相に近づくほど、誰も信じられなくなっていく。',
    episodes: [
      { id: '01', title: '第01話', priceCoin: 0 },
      { id: '02', title: '第02話', priceCoin: 10 },
      { id: '03', title: '第03話', priceCoin: 30 },
    ],
    staff: [
      { role: '出演者', name: 'キャストA' },
      { role: '出演者', name: 'キャストB' },
      { role: '監督', name: '監督X' },
      { role: '制作プロダクション', name: 'Oshidora株式会社' },
    ],
  },
  romanceY: {
    id: 'content-3',
    title: 'ラブストーリーY',
    subtitle: 'すれ違いの先に、答えはある。',
    tags: ['Romance', 'Drama'],
    rating: 4.2,
    reviews: 43,
    story:
      '些細な嘘から始まったすれ違い。\nそれでも、心のどこかで相手を想い続けてしまう。\n\n言葉にできない気持ちが、二人の距離を揺らしていく。',
    episodes: [
      { id: '01', title: '第01話', priceCoin: 0 },
      { id: '02', title: '第02話', priceCoin: 10 },
      { id: '03', title: '第03話', priceCoin: 10 },
    ],
    staff: [
      { role: '出演者', name: 'キャストY1' },
      { role: '出演者', name: 'キャストY2' },
      { role: '監督', name: '監督Y' },
      { role: '制作プロダクション', name: 'Oshidora株式会社' },
    ],
  },
  comedyZ: {
    id: 'content-4',
    title: 'コメディZ',
    subtitle: '笑って、泣いて、また笑う。',
    tags: ['Comedy'],
    rating: 4.1,
    reviews: 38,
    story:
      'ドタバタの毎日に、予想外の出会い。\n笑いが起きた瞬間に、ちょっとだけ人生が動き出す。\n\n今日も何かが起きる、そんな物語。',
    episodes: [
      { id: '01', title: '第01話', priceCoin: 0 },
      { id: '02', title: '第02話', priceCoin: 0 },
      { id: '03', title: '第03話', priceCoin: 10 },
    ],
    staff: [
      { role: '出演者', name: 'キャストZ1' },
      { role: '出演者', name: 'キャストZ2' },
      { role: '監督', name: '監督Z' },
      { role: '制作プロダクション', name: 'Oshidora株式会社' },
    ],
  },
  actionW: {
    id: 'content-5',
    title: 'アクションW',
    subtitle: '止まらない追跡、迫るタイムリミット。',
    tags: ['Action'],
    rating: 4.3,
    reviews: 37,
    story:
      'ある任務をきっかけに、主人公は巨大な陰謀へ巻き込まれていく。\n\n逃げるほど追われ、近づくほど危険になる。\nそれでも、真実を掴むために走り続ける。',
    episodes: [
      { id: '01', title: '第01話', priceCoin: 0 },
      { id: '02', title: '第02話', priceCoin: 20 },
      { id: '03', title: '第03話', priceCoin: 20 },
    ],
    staff: [
      { role: '出演者', name: 'キャストW1' },
      { role: '出演者', name: 'キャストW2' },
      { role: '監督', name: '監督W' },
      { role: '制作プロダクション', name: 'Oshidora株式会社' },
    ],
  },
})

export const mockApprovedComments: ApprovedComment[] = [
  { id: 'c1', author: '匿名', body: 'めちゃくちゃ続きが気になる…！' },
  { id: 'c2', author: 'Misa', body: '演技が最高。表情の作り方がすごい。' },
  { id: 'c3', author: 'ユーザーA', body: 'BGMが良くて一気見しました。' },
  { id: 'c4', author: 'ユーザーB', body: 'ラストの展開が予想外で鳥肌…！！！' },
  { id: 'c5', author: 'ユーザーC', body: '好きなシーン何回も見返した。' },
  { id: 'c6', author: 'ユーザーD', body: '第3話から急に加速して面白い。' },
  { id: 'c7', author: 'ユーザーE', body: 'キャストが豪華。' },
  { id: 'c8', author: 'ユーザーF', body: '次回が待ちきれない。' },
  { id: 'c9', author: 'ユーザーG', body: '短いのに満足感ある。' },
  { id: 'c10', author: 'ユーザーH', body: '伏線回収が楽しみ。' },
  { id: 'c11', author: 'ユーザーI', body: '51文字以上のコメントは省略される仕様なので長めに書いてみます。これはテスト用の文章です。' },
]
