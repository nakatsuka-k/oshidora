export type MockNotice = {
  id: string
  title: string
  publishedAt: string
  excerpt: string
  bodyHtml: string
}

const MOCK_NOTICES: MockNotice[] = [
  {
    id: 'notice:welcome',
    title: '【重要】サービス開始のお知らせ',
    publishedAt: '2026-01-13',
    excerpt: '推しドラの提供を開始しました。利用規約・プライバシーポリシーをご確認ください。',
    bodyHtml: [
      '<p><strong>推しドラ</strong>をご利用いただきありがとうございます。</p>',
      '<p>本日よりサービス提供を開始しました。今後、機能追加や不具合修正を順次行っていきます。</p>',
      '<ul>',
      '  <li>動画再生</li>',
      '  <li>コメント投稿（管理者承認後に公開）</li>',
      '  <li>お気に入り</li>',
      '</ul>',
      '<p>詳細は <a href="https://example.com">こちら</a>（モックリンク）をご確認ください。</p>',
    ].join('\n'),
  },
  {
    id: 'notice:maintenance',
    title: 'メンテナンス予定（サンプル）',
    publishedAt: '2026-01-20',
    excerpt: 'メンテナンスのため、一時的にアクセスできない時間帯が発生します。',
    bodyHtml: [
      '<p>下記の時間帯でシステムメンテナンスを実施します。</p>',
      '<p><strong>2026-01-20 02:00〜03:00（予定）</strong></p>',
      '<p>メンテナンス中はアプリの一部機能をご利用いただけません。</p>',
      '<p>ご不便をおかけしますが、ご了承ください。</p>',
    ].join('\n'),
  },
]

export function getMockNoticeListItems(): Array<{
  id: string
  title: string
  publishedAt: string
  excerpt: string
}> {
  return MOCK_NOTICES.map(({ id, title, publishedAt, excerpt }) => ({ id, title, publishedAt, excerpt }))
}

export function getMockNoticeDetail(
  id: string
): { id: string; title: string; publishedAt: string; bodyHtml: string } | null {
  const found = MOCK_NOTICES.find((n) => n.id === id)
  if (!found) return null
  return { id: found.id, title: found.title, publishedAt: found.publishedAt, bodyHtml: found.bodyHtml }
}
