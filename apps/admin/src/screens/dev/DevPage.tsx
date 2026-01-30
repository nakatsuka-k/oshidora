import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { COLORS, styles } from '../../app/styles'
import type { RouteId } from '../../lib/routes'
import { CollapsibleSection } from '../../ui/CollapsibleSection'
import { FixedBottomBar } from '../../ui/FixedBottomBar'

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

  const [initialKey, setInitialKey] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const [openEnv, setOpenEnv] = useState(true)
  const [openPages, setOpenPages] = useState(true)

  const currentKey = JSON.stringify({
    apiBase: apiInput.trim(),
    uploaderBase: uploaderInput.trim(),
    adminEmail: emailInput.trim(),
  })
  const dirty = Boolean(initialKey) && initialKey !== currentKey
  const justSaved = Boolean(savedAt && Date.now() - savedAt < 1800)

  useEffect(() => {
    if (initialKey) return
    setApiInput(apiBase)
    setUploaderInput(uploaderBase)
    setEmailInput(adminEmail)
    setInitialKey(
      JSON.stringify({ apiBase: String(apiBase ?? ''), uploaderBase: String(uploaderBase ?? ''), adminEmail: String(adminEmail ?? '') })
    )
  }, [adminEmail, apiBase, initialKey, uploaderBase])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return
    if (!dirty) return
    const handler = (e: any) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const onSave = useCallback(() => {
    onSetAdminEmail(emailInput.trim())
    onSetApiBase(apiInput.trim())
    onSetUploaderBase(uploaderInput.trim())
    setInitialKey(JSON.stringify({ apiBase: apiInput.trim(), uploaderBase: uploaderInput.trim(), adminEmail: emailInput.trim() }))
    setSavedAt(Date.now())
  }, [apiInput, emailInput, onSetAdminEmail, onSetApiBase, onSetUploaderBase, uploaderInput])

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
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.contentScroll} contentContainerStyle={[styles.contentInner, { paddingBottom: 110 }] as any}>
        <View style={styles.pageHeaderRow}>
          <View style={{ flex: 1, gap: 6 } as any}>
            <Text style={styles.pageTitle}>開発</Text>
            <Text style={styles.pageSubtitle}>/dev</Text>
          </View>
          {dirty ? <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '800' } as any}>未保存</Text> : null}
        </View>

        <CollapsibleSection
          title="環境"
          subtitle="DEV"
          open={openEnv}
          onToggle={() => setOpenEnv((v) => !v)}
          styles={styles}
          badges={
            justSaved
              ? [{ kind: 'saved', label: '保存しました' }]
              : dirty
                ? [{ kind: 'dirty', label: '未保存' }]
                : undefined
          }
        >

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>DEV UI を有効化</Text>
          <Switch value={devMode} onValueChange={onSetDevMode} />
        </View>

        <View style={styles.filtersGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>管理者メール</Text>
            <TextInput
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="admin@example.com"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>API Base Override</Text>
            <TextInput
              value={apiInput}
              onChangeText={setApiInput}
              placeholder="https://..."
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Uploader Base Override</Text>
            <TextInput
              value={uploaderInput}
              onChangeText={setUploaderInput}
              placeholder="https://..."
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
            />
          </View>
        </View>

      </CollapsibleSection>

      <CollapsibleSection title="ページ" subtitle={`${routes.length}件`} open={openPages} onToggle={() => setOpenPages((v) => !v)} styles={styles}>
        <View style={styles.table}>
          {routes.map((r) => (
            <Pressable key={r.id} onPress={() => onNavigate(r.id)} style={styles.tableRow}>
              <Text style={styles.tableLabel}>{r.label}</Text>
              <Text style={styles.tableDetail}>{`/${r.id}`}</Text>
            </Pressable>
          ))}
        </View>
      </CollapsibleSection>
      </ScrollView>

      <FixedBottomBar>
        <View style={[styles.filterActions, { justifyContent: 'space-between' } as any]}>
          <Pressable onPress={() => onNavigate('dashboard')} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>戻る</Text>
          </Pressable>
          <Pressable disabled={!dirty} onPress={onSave} style={[styles.btnPrimary, !dirty ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>保存</Text>
          </Pressable>
        </View>
      </FixedBottomBar>
    </View>
  )
}
