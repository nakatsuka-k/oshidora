import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import { SelectField } from '../../app/components/SelectField'
import { useBanner } from '../../lib/banner'

type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
}

type CmsFetchJson = <T>(cfg: CmsApiConfig, path: string, init?: RequestInit) => Promise<T>

type TagRow = { id: string; name: string }

export function TagsListScreen({
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
  const [rows, setRows] = useState<TagRow[]>([])
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  const load = useCallback(async () => {
    setBusy(true)
    setBanner('')
    try {
      const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/tags')
      setRows((json.items ?? []).map((t) => ({ id: String(t.id ?? ''), name: String(t.name ?? '') })))
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
        <Text style={styles.pageTitle}>タグ一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
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
                <Text style={styles.tableDetail}>{r.id}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>タグがありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

export function TagEditScreen({
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
  const [categoryId, setCategoryId] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<Array<{ label: string; value: string }>>([{ label: '（なし）', value: '' }])
  const [busy, setBusy] = useState(false)
  const [, setBanner] = useBanner()

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const catsJson = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/categories')
        if (!mounted) return
        const options = (catsJson.items ?? [])
          .map((c) => ({ id: String(c.id ?? ''), name: String(c.name ?? '') }))
          .filter((c) => c.id)
          .map((c) => ({ label: c.name || c.id, value: c.id }))
        setCategoryOptions([{ label: '（なし）', value: '' }, ...options])

        if (!id) {
          setName('')
          setCategoryId('')
          return
        }

        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/tags/${encodeURIComponent(id)}`)
        if (!mounted) return
        setName(String(json.item?.name ?? ''))
        setCategoryId(String(json.item?.categoryId ?? ''))
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
        const payload = { name: name.trim(), categoryId }
        if (id) {
          await cmsFetchJson(cfg, `/cms/tags/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/tags', {
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
  }, [categoryId, cfg, id, name, onBack])

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
          <Text style={styles.label}>タグ名</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>

        <SelectField label="表示カテゴリ" value={categoryId} placeholder="（なし）" options={categoryOptions} onChange={setCategoryId} />
        <View style={styles.filterActions}>
          <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
            <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : '保存'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}
