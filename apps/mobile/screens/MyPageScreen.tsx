import { useCallback, useMemo, useState } from 'react'
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { RowItem, ScreenContainer, TabBar, THEME } from '../components'

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type MyPageScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  loggedIn: boolean
  userEmail?: string
  userType?: 'user' | 'cast' // 'user' = 一般、'cast' = キャスト
  onNavigate: (screen: string) => void
}

type MenuItem = {
  key: string
  title: string
  subtitle?: string
  isCastOnly?: boolean
}

export function MyPageScreen({ apiBaseUrl, onPressTab, loggedIn, userEmail, userType, onNavigate }: MyPageScreenProps) {
  // If not logged in, redirect
  if (!loggedIn) {
    return (
      <ScreenContainer title="マイページ" footer={<TabBar active="mypage" onPress={onPressTab} />} maxWidth={520}>
        <View style={styles.root}>
          <Text style={styles.centerText}>ログインしてください</Text>
        </View>
      </ScreenContainer>
    )
  }

  const isCastUser = userType === 'cast'

  const menuItems: MenuItem[] = useMemo(
    () => [
      { key: 'profileEdit', title: 'ユーザープロフィール編集', subtitle: userEmail ? `${userEmail}` : '編集' },
      { key: 'castRegister', title: 'キャストプロフィール登録', subtitle: '未登録' },
      { key: 'favorites', title: 'お気に入り', subtitle: '動画・キャスト管理' },
      { key: 'watchHistory', title: '動画視聴履歴', subtitle: '最大20件' },
      { key: 'coinPurchase', title: 'コイン購入', subtitle: 'Stripe決済対応' },
      ...(isCastUser ? [{ key: 'coinExchange', title: 'コイン換金', subtitle: 'キャストのみ', isCastOnly: true }] : []),
      { key: 'settings', title: '設定', subtitle: '通知・ログアウト' },
      { key: 'terms', title: '利用規約', subtitle: '確認' },
    ],
    [isCastUser, userEmail]
  )

  const handleMenuPress = useCallback(
    (key: string) => {
      switch (key) {
        case 'profileEdit':
          onNavigate('profileEdit')
          break
        case 'castRegister':
          onNavigate('castProfileRegister')
          break
        case 'favorites':
          onNavigate('favorites')
          break
        case 'watchHistory':
          // TODO: 視聴履歴画面へ遷移
          break
        case 'coinPurchase':
          // TODO: コイン購入画面へ遷移
          break
        case 'coinExchange':
          // TODO: コイン換金画面へ遷移
          break
        case 'settings':
          // TODO: 設定画面へ遷移
          break
        case 'terms':
          onNavigate('terms')
          break
      }
    },
    [onNavigate]
  )

  return (
    <ScreenContainer footer={<TabBar active="mypage" onPress={onPressTab} />} maxWidth={520}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>マイページ</Text>
          {userEmail ? <Text style={styles.userLabel}>{userEmail}</Text> : null}
          {isCastUser ? <Text style={styles.castBadge}>キャスト</Text> : null}
        </View>

        <FlatList
          data={menuItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <RowItem
              title={item.title}
              subtitle={item.subtitle}
              actionLabel="開く"
              onAction={() => handleMenuPress(item.key)}
            />
          )}
        />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '800',
  },
  userLabel: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  castBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: THEME.accent,
    color: THEME.card,
    fontSize: 10,
    fontWeight: '800',
    alignSelf: 'flex-start',
  },
  listContent: {
    paddingBottom: 16,
  },
  centerText: {
    color: THEME.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
})
