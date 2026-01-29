import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { cmsFetchJson, useCmsApi } from '../../lib/cmsApi'

type CoinSettingRow = { id: string; price: string; place: string; target: string; period: string }

export function CoinSettingsListScreen({
  onOpenDetail,
  onNew,
}: {
  onOpenDetail: (id: string) => void
  onNew: () => void
}) {
  const cfg = useCmsApi()
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<CoinSettingRow[]>([])

  useEffect(() => {
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ items: any[] }>(cfg, '/cms/coin-settings')
        if (!mounted) return
        setRows(
          (json.items ?? []).map((r) => ({
            id: String(r.id ?? ''),
            price: `¥${Number(r.priceYen ?? 0).toLocaleString('ja-JP')}`,
            place: String(r.place ?? ''),
            target: String(r.target ?? ''),
            period: String(r.period ?? ''),
          }))
        )
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

  return (
    <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentInner}>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageTitle}>コイン設定一覧</Text>
        <Pressable onPress={onNew} style={styles.smallBtnPrimary}>
          <Text style={styles.smallBtnPrimaryText}>新規</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一覧</Text>
        <View style={styles.table}>
          {busy ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>読み込み中…</Text>
            </View>
          ) : null}
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpenDetail(r.id)} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <Text style={styles.tableLabel}>{`${r.price} / ${r.target}`}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${r.place} / ${r.period}`}</Text>
              </View>
            </Pressable>
          ))}
          {!busy && rows.length === 0 ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>コイン設定がありません</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  )
}

export function CoinSettingEditScreen({
  title,
  id,
  onBack,
}: {
  title: string
  id: string
  onBack: () => void
}) {
  const cfg = useCmsApi()
  const [, setBanner] = useBanner()
  const [busy, setBusy] = useState(false)

  const [priceYenText, setPriceYenText] = useState('')
  const [place, setPlace] = useState('')
  const [target, setTarget] = useState('')
  const [period, setPeriod] = useState('')

  useEffect(() => {
    if (!id) {
      setPriceYenText('')
      setPlace('')
      setTarget('')
      setPeriod('')
      return
    }

    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<{ item: any }>(cfg, `/cms/coin-settings/${encodeURIComponent(id)}`)
        if (!mounted) return
        const it = json.item
        setPriceYenText(String(it?.priceYen ?? ''))
        setPlace(String(it?.place ?? ''))
        setTarget(String(it?.target ?? ''))
        setPeriod(String(it?.period ?? ''))
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
    const priceYen = Math.floor(Number(priceYenText || 0))
    if (!Number.isFinite(priceYen) || priceYen <= 0) {
      setBanner('価格（円）を入力してください')
      return
    }
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const payload = { priceYen, place, target, period }
        if (id) {
          await cmsFetchJson(cfg, `/cms/coin-settings/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          await cmsFetchJson(cfg, '/cms/coin-settings', {
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
  }, [cfg, id, onBack, period, place, priceYenText, target])

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
          <Text style={styles.label}>価格（円）</Text>
          <TextInput
            value={priceYenText}
            onChangeText={setPriceYenText}
            style={styles.input}
            keyboardType={Platform.OS === 'web' ? undefined : 'number-pad'}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>表示場所</Text>
          <TextInput value={place} onChangeText={setPlace} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>対象</Text>
          <TextInput value={target} onChangeText={setTarget} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>期間</Text>
          <TextInput value={period} onChangeText={setPeriod} style={styles.input} />
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
