import { useCallback, useMemo, useState } from 'react'
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { RowItem, ScreenContainer, TabBar, THEME } from '../components'

import IconNotification from '../assets/icon_notification.svg'
import IconSearch from '../assets/icon_search.svg'

const LOGO_IMAGE = require('../assets/oshidora_logo.png')

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type MyPageScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  loggedIn: boolean
  userEmail?: string
  userType?: 'user' | 'cast' // 'user' = 一般、'cast' = キャスト
  subscribed?: boolean
  onNavigate: (screen: string) => void
  onOpenNotice?: () => void
}

type MenuItem = {
  key: string
  title: string
  subtitle?: string
  isCastOnly?: boolean
}

export function MyPageScreen({ apiBaseUrl, onPressTab, loggedIn, userEmail, userType, subscribed, onNavigate, onOpenNotice }: MyPageScreenProps) {
  // If not logged in, redirect
  if (!loggedIn) {
    return (
      <ScreenContainer
        headerLeft={<Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />}
        headerRight={
          <View style={styles.headerRightRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="お知らせ"
              onPress={() => onOpenNotice?.()}
              style={styles.headerIconButton}
              disabled={!onOpenNotice}
            >
              <IconNotification width={22} height={22} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="検索"
              onPress={() => onPressTab('cast')}
              style={styles.headerIconButton}
            >
              <IconSearch width={22} height={22} />
            </Pressable>
          </View>
        }
        footer={<TabBar active="mypage" onPress={onPressTab} />}
        footerPaddingHorizontal={0}
        maxWidth={768}
      >
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
      { key: 'subscription', title: 'サブスク会員', subtitle: subscribed ? '加入中（動画視聴OK）' : '未加入（動画視聴には加入が必要）' },
      { key: 'favorites', title: 'お気に入り', subtitle: '動画・キャスト管理' },
      { key: 'watchHistory', title: '動画視聴履歴', subtitle: '最大20件' },
      { key: 'coinPurchase', title: 'コイン購入', subtitle: '推しポイント付与用' },
      ...(isCastUser ? [{ key: 'coinExchange', title: 'コイン換金', subtitle: 'キャストのみ', isCastOnly: true }] : []),
      { key: 'settings', title: '設定', subtitle: '通知・ログアウト' },
      { key: 'logout', title: 'ログアウト', subtitle: 'アカウントからログアウト' },
      { key: 'faq', title: 'よくある質問', subtitle: 'FAQ' },
      { key: 'contact', title: 'お問い合わせ', subtitle: 'フォーム' },
      { key: 'terms', title: '利用規約', subtitle: '確認' },
    ],
    [isCastUser, subscribed, userEmail]
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
        case 'subscription':
          onNavigate('subscription')
          break
        case 'favorites':
          onNavigate('favorites')
          break
        case 'watchHistory':
          onNavigate('watchHistory')
          break
        case 'coinPurchase':
          onNavigate('coinPurchase')
          break
        case 'coinExchange':
          onNavigate('coinExchangeDest')
          break
        case 'settings':
          onNavigate('settings')
          break
        case 'logout':
          onNavigate('logout')
          break
        case 'faq':
          onNavigate('faq')
          break
        case 'contact':
          onNavigate('contact')
          break
        case 'terms':
          onNavigate('terms')
          break
      }
    },
    [onNavigate]
  )

  return (
    <ScreenContainer
      headerLeft={<Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />}
      headerRight={
        <View style={styles.headerRightRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="お知らせ"
            onPress={() => onOpenNotice?.()}
            style={styles.headerIconButton}
            disabled={!onOpenNotice}
          >
            <IconNotification width={22} height={22} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="検索"
            onPress={() => onPressTab('cast')}
            style={styles.headerIconButton}
          >
            <IconSearch width={22} height={22} />
          </Pressable>
        </View>
      }
      footer={<TabBar active="mypage" onPress={onPressTab} />}
      footerPaddingHorizontal={0}
      maxWidth={768}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          {userEmail ? <Text style={styles.userLabel}>{userEmail}</Text> : null}
          {isCastUser ? <Text style={styles.castBadge}>キャスト</Text> : null}
        </View>

        <FlatList
          data={menuItems}
          keyExtractor={(item) => item.key}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  logo: {
    width: 110,
    height: 36,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 16,
    paddingBottom: 8,
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
