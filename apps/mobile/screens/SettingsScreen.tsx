import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, THEME } from '../components'
import { getBoolean, setBoolean } from '../utils/storage'

type Props = {
  onBack: () => void
  onGoLogout: () => void
  onOpenWithdraw: () => void
}

const KEY_NEW_RELEASE = 'settings_notify_new_release_v1'
const KEY_RANKING_UPDATE = 'settings_notify_ranking_update_v1'
const KEY_IMPORTANT = 'settings_notify_important_v1'

type SettingRowProps = {
  label: string
  value: boolean
  onChange: (next: boolean) => void
  description?: string
  disabled?: boolean
}

function SettingSwitchRow({ label, value, onChange, description, disabled }: SettingRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  )
}

export function SettingsScreen({ onBack, onGoLogout, onOpenWithdraw }: Props) {
  const [loading, setLoading] = useState(true)

  const [notifyNewRelease, setNotifyNewRelease] = useState<boolean>(true)
  const [notifyRankingUpdate, setNotifyRankingUpdate] = useState<boolean>(true)
  const notifyImportant = true

  const hasAnyWorkEnabled = useMemo(
    () => Boolean(notifyNewRelease || notifyRankingUpdate),
    [notifyNewRelease, notifyRankingUpdate]
  )

  useEffect(() => {
    void (async () => {
      try {
        const [a, b, c] = await Promise.all([
          getBoolean(KEY_NEW_RELEASE),
          getBoolean(KEY_RANKING_UPDATE),
          getBoolean(KEY_IMPORTANT),
        ])
        setNotifyNewRelease(a)
        setNotifyRankingUpdate(b)
        // 重要通知は原則ON（OFF不可）。過去に保存されたOFFがあっても強制的にON扱いにする。
        if (c === false) {
          void setBoolean(KEY_IMPORTANT, true)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (loading) return
    void setBoolean(KEY_NEW_RELEASE, notifyNewRelease)
  }, [loading, notifyNewRelease])

  useEffect(() => {
    if (loading) return
    void setBoolean(KEY_RANKING_UPDATE, notifyRankingUpdate)
  }, [loading, notifyRankingUpdate])

  useEffect(() => {
    if (loading) return
    // 重要通知は常にON
    void setBoolean(KEY_IMPORTANT, true)
  }, [loading])

  return (
    <ScreenContainer title="設定" onBack={onBack}>
      <View style={styles.root}>
        <Text style={styles.sectionTitle}>通知設定</Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={styles.card}>
            <SettingSwitchRow
              label="新作公開通知"
              value={notifyNewRelease}
              onChange={setNotifyNewRelease}
            />
            <SettingSwitchRow
              label="ランキング更新通知"
              value={notifyRankingUpdate}
              onChange={setNotifyRankingUpdate}
            />
            <SettingSwitchRow
              label="運営からの重要通知"
              value={notifyImportant}
              onChange={() => {
                // OFF不可
              }}
              description="原則ON（OFF不可）"
              disabled={true}
            />
          </View>
        )}

        {!loading && !hasAnyWorkEnabled ? (
          <Text style={styles.note}>作品のお知らせがOFFになっています</Text>
        ) : null}

        <View style={{ height: 20 }} />
        <Text style={styles.sectionTitle}>アカウント</Text>
        <View style={styles.card}>
          <Text style={styles.note}>退会をご希望の場合は退会申請へお進みください</Text>
          <View style={{ height: 10 }} />
          <Pressable style={styles.linkRow} onPress={onOpenWithdraw}>
            <Text style={styles.linkLabel}>退会申請</Text>
            <Text style={styles.linkArrow}>›</Text>
          </Pressable>
        </View>

        <View style={{ height: 20 }} />
        <Text style={styles.sectionTitle}>ログアウト</Text>
        <View style={styles.card}>
          <Text style={styles.note}>アカウントからログアウトします</Text>
          <View style={{ height: 10 }} />
          <PrimaryButton label="ログアウト" onPress={onGoLogout} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
    minHeight: 44,
  },
  rowLeft: {
    flex: 1,
  },
  rowLabel: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
  },
  rowDesc: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  note: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    backgroundColor: THEME.bg,
    minHeight: 44,
  },
  linkLabel: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
  },
  linkArrow: {
    color: THEME.textMuted,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 18,
  },
})
