import { Pressable, ScrollView, Text, View } from 'react-native'

import { styles } from '../app/styles'

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>{title}</Text>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>未実装</Text>
      </View>
    </ScrollView>
  )
}

export function NotFoundScreen({ onGoDashboard }: { onGoDashboard: () => void }) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>404</Text>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>ページが見つかりません</Text>
        <View style={styles.filterActions}>
          <Pressable onPress={onGoDashboard} style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>ダッシュボードへ戻る</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

export function MaintenanceModeScreen({
  message,
  onGoSettings,
}: {
  message: string
  onGoSettings: () => void
}) {
  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>メンテナンス中</Text>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>{message || 'メンテナンス中です。しばらくお待ちください。'}</Text>
        <View style={styles.filterActions}>
          <Pressable onPress={onGoSettings} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>設定へ</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}
