import { useCallback, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { COLORS, styles } from './styles'

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

              <ScrollView
                style={styles.pickerModalList}
                contentContainerStyle={styles.pickerModalListContent}
                keyboardShouldPersistTaps="handled"
              >
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

export type MultiSelectOption = { label: string; value: string; detail?: string }

export function MultiSelectField({
  label,
  values,
  placeholder,
  options,
  onChange,
  searchPlaceholder,
}: {
  label: string
  values: string[]
  placeholder: string
  options: MultiSelectOption[]
  onChange: (next: string[]) => void
  searchPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const selectedSet = useMemo(() => new Set(values), [values])

  const selectedOptions = useMemo(() => {
    if (!values.length) return [] as MultiSelectOption[]
    const byId = new Map(options.map((o) => [o.value, o] as const))
    return values.map((id) => byId.get(id) ?? { value: id, label: id }).filter(Boolean)
  }, [options, values])

  const summary = useMemo(() => {
    if (!values.length) return placeholder
    const first = selectedOptions
      .slice(0, 2)
      .map((o) => o.label)
      .join(' / ')
    const rest = values.length - Math.min(values.length, 2)
    return rest > 0 ? `${first} +${rest}` : first
  }, [placeholder, selectedOptions, values.length])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter((o) => `${o.label} ${o.value} ${o.detail ?? ''}`.toLowerCase().includes(needle))
  }, [options, q])

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(values)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onChange(Array.from(next))
    },
    [onChange, values]
  )

  const remove = useCallback(
    (id: string) => {
      const next = values.filter((v) => v !== id)
      onChange(next)
    },
    [onChange, values]
  )

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.selectWrap}>
        <Pressable onPress={() => setOpen((v) => !v)} style={styles.selectBtn}>
          <Text style={styles.selectText}>{summary}</Text>
        </Pressable>

        {values.length ? (
          <View style={styles.multiChipsWrap}>
            {selectedOptions.map((o) => (
              <Pressable key={o.value} onPress={() => remove(o.value)} style={styles.multiChip}>
                <Text style={styles.multiChipText} numberOfLines={1}>
                  {o.label}
                </Text>
                <Text style={styles.multiChipRemove}>×</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
                  placeholder={searchPlaceholder || '検索（名前 / ID）'}
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                  style={styles.selectSearchInput}
                />
              </View>

              <ScrollView
                style={styles.pickerModalList}
                contentContainerStyle={styles.pickerModalListContent}
                keyboardShouldPersistTaps="handled"
              >
                {filtered.map((o) => {
                  const selected = selectedSet.has(o.value)
                  return (
                    <Pressable key={o.value} onPress={() => toggle(o.value)} style={styles.pickerModalItem}>
                      <Text style={styles.multiSelectCheck}>{selected ? '✓' : ' '}</Text>
                      <View style={styles.multiSelectTextCol}>
                        <Text style={styles.pickerModalItemText}>{o.label}</Text>
                        {o.detail ? <Text style={styles.selectMenuDetailText}>{o.detail}</Text> : null}
                      </View>
                    </Pressable>
                  )
                })}
                {filtered.length === 0 ? (
                  <View style={styles.selectMenuEmpty}>
                    <Text style={styles.selectMenuDetailText}>該当なし</Text>
                  </View>
                ) : null}
              </ScrollView>

              <Pressable onPress={() => setOpen(false)} style={styles.pickerModalDoneBtn}>
                <Text style={styles.pickerModalDoneText}>完了</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  )
}
