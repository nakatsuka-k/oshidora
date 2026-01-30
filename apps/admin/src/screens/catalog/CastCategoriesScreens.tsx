import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { CollapsibleSection } from '../../ui/CollapsibleSection'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
}

type CmsFetchJson = <T>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

type CastCategoryRow = { id: string; name: string; enabled: boolean }

export function CastCategoriesListScreen({
  cfg,
  cmsFetchJson,
  onOpenEdit,
  onNew,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  onOpenEdit: (id: string) => void
  onNew: () => void
}) {
  const [rows, setRows] = useState<CastCategoryRow[]>([])
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ list: true })

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/cast-categories')
      setRows(
        (json.items ?? []).map((g) => ({
          id: String(g.id ?? ''),
          name: String(g.name ?? ''),
          enabled: g.enabled === undefined ? true : Boolean(g.enabled),
        }))
      )
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [cfg])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>キャストカテゴリ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>

      <Text style={styles.pageSubtitle}>カテゴリを選んで編集</Text>

      <CollapsibleSection
        title="一覧"
        subtitle="選んで編集へ"
        open={openSections.list}
        onToggle={() => setOpenSections((p) => ({ ...p, list: !p.list }))}
      >
        <View style={styles.table}>
          {busy ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読込中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenEdit(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{r.name}</Text>
                <Text style={styles.tableDetail}>{`${r.id}${r.enabled ? '' : ' / 無効'}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>キャストカテゴリがありません</Text>
            </View>
          ) : null}
        </View>
      </CollapsibleSection>
    </ScrollView>
  )
}

export function CastCategoryEditScreen({
  cfg,
  cmsFetchJson,
  title,
  id,
  onBack,
}: {
  cfg: CmsApiConfig
  cmsFetchJson: CmsFetchJson
  title: string
  id: string
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  useEffect(() => {
    if (!id) {
      setName('')
      setEnabled(true)
      return
    }
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/cast-categories/${encodeURIComponent(id)}`)
        if (!mounted) return
        setName(String(json.item?.name ?? ''))
        setEnabled(json.item?.enabled === undefined ? true : Boolean(json.item?.enabled))
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
  }, [cfg, id])

  const onSave = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const payload = { name: name.trim(), enabled }
        if (id) {
          await cmsFetchJson(cfg, `/cms/cast-categories/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/cast-categories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          onBack()
          return
        }
        setBanner('保存しました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [cfg, enabled, id, name, onBack])

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={onBack} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>戻る</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>編集</Text>
        {id ? (
          <View style={styles.field}>
            <Text style={styles.label}>ID</Text>
            <Text style={styles.readonlyText}>{id}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>カテゴリ名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>有効</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
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
