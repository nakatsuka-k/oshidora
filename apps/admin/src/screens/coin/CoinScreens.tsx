import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { styles } from '../../app/styles'
import { useBanner } from '../../lib/banner'
import { cmsFetchJson, useCmsApi } from '../../lib/cmsApi'

type CoinSettingRow = { id: string; price: string; coinAmount: string; period: string }

function formatCoinPeriod(startsAt: unknown, endsAt: unknown) {
  const s = String(startsAt ?? '').trim()
  const e = String(endsAt ?? '').trim()
  if (!s && !e) return '常時'
  if (s && e) return `${s} 〜 ${e}`
  if (s) return `${s} 〜`
  return `〜 ${e}`
}

function isValidYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function DateInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.input as any}>
        {
          // eslint-disable-next-line react/no-unknown-property
        }
        <input
          type="date"
          value={value}
          disabled={Boolean(disabled)}
          onChange={(e: any) => onChange(String(e?.target?.value ?? ''))}
          style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'inherit', font: 'inherit' } as any}
        />
      </View>
    )
  }
  return <TextInput value={value} onChangeText={onChange} style={styles.input} editable={!disabled} placeholder="YYYY-MM-DD" />
}

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
            coinAmount: `${Number(r.coinAmount ?? 0).toLocaleString('ja-JP')}pt`,
            period: formatCoinPeriod(r.startsAt, r.endsAt),
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
                <Text style={styles.tableLabel}>{`${r.price} / ${r.coinAmount}`}</Text>
                <Text style={styles.tableDetail}>{`${r.id} / ${r.period}`}</Text>
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
  const [coinAmountText, setCoinAmountText] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [noPeriod, setNoPeriod] = useState(true)

  useEffect(() => {
    if (!id) {
      setPriceYenText('')
      setCoinAmountText('')
      setStartsAt('')
      setEndsAt('')
      setNoPeriod(true)
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
        setCoinAmountText(String(it?.coinAmount ?? ''))
        const s = String(it?.startsAt ?? '').trim()
        const e = String(it?.endsAt ?? '').trim()
        setStartsAt(s)
        setEndsAt(e)
        setNoPeriod(!s && !e)
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

    const coinAmount = Math.floor(Number(coinAmountText || 0))
    if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
      setBanner('取得ポイントを入力してください')
      return
    }

    const s = noPeriod ? '' : String(startsAt || '').trim()
    const e = noPeriod ? '' : String(endsAt || '').trim()
    if ((s && !isValidYmd(s)) || (e && !isValidYmd(e))) {
      setBanner('開始日/終了日は YYYY-MM-DD 形式で入力してください')
      return
    }
    if (s && e && e < s) {
      setBanner('終了日は開始日以降を指定してください')
      return
    }
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const payload = { priceYen, coinAmount, startsAt: s, endsAt: e }
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
  }, [cfg, coinAmountText, endsAt, id, noPeriod, onBack, priceYenText, startsAt])

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
          <Text style={styles.label}>取得ポイント</Text>
          <TextInput
            value={coinAmountText}
            onChangeText={setCoinAmountText}
            style={styles.input}
            keyboardType={Platform.OS === 'web' ? undefined : 'number-pad'}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>期間</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 } as any}>
            <Pressable
              onPress={() => {
                setNoPeriod((v) => {
                  const next = !v
                  if (next) {
                    setStartsAt('')
                    setEndsAt('')
                  }
                  return next
                })
              }}
              style={[styles.smallBtn, { paddingVertical: 8 } as any]}
            >
              <Text style={styles.smallBtnText}>{noPeriod ? '期間指定なし' : '期間指定あり'}</Text>
            </Pressable>
            <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' } as any}>{noPeriod ? '常時有効' : '開始/終了日を指定'}</Text>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>開始日</Text>
          <DateInput value={startsAt} onChange={setStartsAt} disabled={noPeriod} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>終了日</Text>
          <DateInput value={endsAt} onChange={setEndsAt} disabled={noPeriod} />
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
