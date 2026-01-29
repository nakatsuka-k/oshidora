import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import { cmsFetchJson, useCmsApi } from '../../lib/cmsApi'

export function SettingsScreen() {
  const cfg = useCmsApi()
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ maintenanceMode: boolean; maintenanceMessage: string }>(cfg, '/cms/settings')
        if (!mounted) return
        setMaintenanceMode(Boolean(json.maintenanceMode))
        setMaintenanceMessage(String(json.maintenanceMessage ?? ''))
      } catch (e) {
        if (!mounted) return
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        if (!mounted) return
        setBusy(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [cfg])

  const onSave = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        await cmsFetchJson(cfg, '/cms/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ maintenanceMode, maintenanceMessage }),
        })
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, maintenanceMessage, maintenanceMode])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <Text style={styles.pageTitle}>設定</Text>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>メンテナンス</Text>

        {busy ? (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>読み込み中…</Text>
          </View>
        ) : null}

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>メンテナンスモード</Text>
          <Switch value={maintenanceMode} onValueChange={setMaintenanceMode} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>メッセージ</Text>
          <TextInput
            value={maintenanceMessage}
            onChangeText={setMaintenanceMessage}
            style={[styles.input, { height: 88, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}
