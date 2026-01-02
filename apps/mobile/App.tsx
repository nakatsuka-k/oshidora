import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Button,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

type Oshi = {
  id: string
  name: string
  created_at: string
}

function defaultApiBaseUrl() {
  if (Platform.OS === 'web') return 'http://localhost:8787'
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787'
  return 'http://127.0.0.1:8787'
}

export default function App() {
  const apiBaseUrl = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_API_BASE_URL
    return env && env.trim().length > 0 ? env.trim() : defaultApiBaseUrl()
  }, [])

  const [health, setHealth] = useState<string>('')
  const [items, setItems] = useState<Oshi[]>([])
  const [name, setName] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const checkHealth = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/health`)
      const text = await res.text()
      setHealth(`${res.status} ${text}`)
    } catch (e) {
      setHealth('')
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl])

  const loadOshi = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/v1/oshi`)
      const json = (await res.json()) as { items: Oshi[] }
      setItems(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl])

  const addOshi = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) return

    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/v1/oshi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${text}`)
      }
      setName('')
      await loadOshi()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl, loadOshi, name])

  useEffect(() => {
    void (async () => {
      await checkHealth()
      await loadOshi()
    })()
  }, [checkHealth, loadOshi])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>推しドラ</Text>
        <Text style={styles.sub}>API: {apiBaseUrl}</Text>
        {health ? <Text style={styles.sub}>Health: {health}</Text> : null}
        {error ? <Text style={styles.error}>Error: {error}</Text> : null}
      </View>

      <View style={styles.row}>
        <Button title="Health" onPress={checkHealth} />
        <View style={styles.spacer} />
        <Button title="Reload" onPress={loadOshi} />
      </View>

      <View style={styles.row}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="推しの名前"
          autoCapitalize="none"
          style={styles.input}
        />
        <View style={styles.spacer} />
        <Button title="Add" onPress={addOshi} />
      </View>

      {busy ? <ActivityIndicator style={styles.loading} /> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>{item.created_at}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.sub}>まだ登録がありません</Text>}
      />

      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  sub: {
    fontSize: 12,
    marginBottom: 4,
  },
  error: {
    fontSize: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  spacer: {
    width: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  loading: {
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
  },
  item: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemName: {
    fontSize: 16,
  },
  itemMeta: {
    fontSize: 12,
  },
})

