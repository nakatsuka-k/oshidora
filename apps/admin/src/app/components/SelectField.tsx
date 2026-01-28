import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { COLORS, styles } from '../styles'

export function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  options: Array<{ label: string; value: string }>
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value)
    return hit ? hit.label : ''
  }, [options, value])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter((o) => `${o.label} ${o.value}`.toLowerCase().includes(needle))
  }, [options, q])

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.selectWrap}>
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.selectBtn}>
          <Text style={styles.selectText}>{selectedLabel || placeholder}</Text>
        </Pressable>

        <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
          <Pressable onPress={() => setOpen(false)} style={styles.pickerModalOverlay}>
            <Pressable onPress={() => {}} style={styles.pickerModalCard}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>{label}</Text>
                <Pressable onPress={() => setOpen(false)} style={styles.pickerModalClose}>
                  <Text style={styles.pickerModalCloseText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.selectSearchWrap}>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="検索（名前 / ID）"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                  style={styles.selectSearchInput}
                />
              </View>

              <ScrollView style={styles.pickerModalList} contentContainerStyle={styles.pickerModalListContent} keyboardShouldPersistTaps="handled">
                {filtered.map((o) => {
                  const selected = o.value === value
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => {
                        onChange(o.value)
                        setOpen(false)
                      }}
                      style={styles.pickerModalItem}
                    >
                      <Text style={styles.multiSelectCheck}>{selected ? '✓' : ' '}</Text>
                      <Text style={styles.pickerModalItemText}>{o.label}</Text>
                    </Pressable>
                  )
                })}
                {filtered.length === 0 ? (
                  <View style={styles.selectMenuEmpty}>
                    <Text style={styles.selectMenuDetailText}>該当なし</Text>
                  </View>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  )
}
