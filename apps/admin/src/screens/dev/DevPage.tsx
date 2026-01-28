import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import type { RouteId } from '../../lib/routes'

export function DevPage({
  devMode,
  apiBase,
  uploaderBase,
  adminEmail,
  onSetDevMode,
  onSetApiBase,
  onSetUploaderBase,
  onSetAdminEmail,
  onNavigate,
}: {
  devMode: boolean
  apiBase: string
  uploaderBase: string
  adminEmail: string
  onSetDevMode: (v: boolean) => void
  onSetApiBase: (v: string) => void
  onSetUploaderBase: (v: string) => void
  onSetAdminEmail: (v: string) => void
  onNavigate: (id: RouteId) => void
}) {
  const [apiInput, setApiInput] = useState(apiBase)
  const [uploaderInput, setUploaderInput] = useState(uploaderBase)
  const [emailInput, setEmailInput] = useState(adminEmail)

  const routes = useMemo<Array<{ id: RouteId; label: string }>>(
    () => [
      { id: 'dashboard', label: 'ダッシュボード' },
      { id: 'works', label: '作品管理' },
      { id: 'videos', label: '動画一覧' },
      { id: 'castStaff', label: 'キャスト・スタッフ管理' },
      { id: 'comments', label: 'コメント管理' },
      { id: 'coin', label: 'コイン管理' },
      { id: 'users', label: 'ユーザー管理' },
      { id: 'inquiries', label: 'お問い合わせ管理' },
      { id: 'settings', label: '設定' },
    ],
    []
  )

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>/dev</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DEV モード</Text>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>DEV UI を有効化</Text>
          <Switch value={devMode} onValueChange={onSetDevMode} />
        </View>

        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>管理者メール</Text>
            <TextInput value={emailInput} onChangeText={setEmailInput} placeholder="admin@example.com" style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>API Base Override</Text>
            <TextInput value={apiInput} onChangeText={setApiInput} placeholder="https://..." style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Uploader Base Override</Text>
            <TextInput value={uploaderInput} onChangeText={setUploaderInput} placeholder="https://..." style={styles.input} />
          </View>
        </View>

        <View style={styles.filterActions}>
          <Pressable
            onPress={() => {
              onSetAdminEmail(emailInput.trim())
              onSetApiBase(apiInput.trim())
              onSetUploaderBase(uploaderInput.trim())
            }}
            style={styles.btnPrimary}
          >
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ページ一覧</Text>
        <View style={styles.table}>
          {routes.map((r) => (
            <Pressable key={r.id} onPress={() => onNavigate(r.id)} style={styles.tableRow}>
              <Text style={styles.tableLabel}>{r.label}</Text>
              <Text style={styles.tableDetail}>{`/${r.id}`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}
