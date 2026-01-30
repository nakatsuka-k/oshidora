import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { COLORS, styles as baseStyles } from '../app/styles'

type SectionBadge = {
  kind: 'dirty' | 'saved' | 'info'
  label: string
}

export function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  right,
  badges,
  children,
  styles,
}: {
  title: string
  subtitle?: string
  open: boolean
  onToggle: () => void
  right?: ReactNode
  badges?: SectionBadge[]
  children: ReactNode
  styles?: any
}) {
  const s = styles ?? baseStyles
  const headerBadges = (badges ?? []).filter((b) => b.label)

  return (
    <View style={[s.section, open ? (s.sectionActive ?? { borderColor: COLORS.primary }) : null]}>
      <Pressable onPress={onToggle} style={s.sectionHeaderPressable}>
        <View
          style={
            s.sectionHeaderRow ??
            ({ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 } as any)
          }
        >
          <View style={s.sectionTitleWrap ?? ({ flex: 1, minWidth: 0 } as any)}>
            <View
              style={
                s.sectionTitleRow ??
                ({ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' } as any)
              }
            >
              <Text style={s.sectionTitle}>{title}</Text>
              {headerBadges.length > 0 ? (
                <View style={s.sectionBadgeRow ?? ({ flexDirection: 'row', alignItems: 'center', gap: 6 } as any)}>
                  {headerBadges.map((b, idx) => (
                    <View
                      key={`${b.kind}:${b.label}:${idx}`}
                      style={[
                        s.sectionBadge,
                        b.kind === 'dirty' ? s.sectionBadgeDirty : null,
                        b.kind === 'saved' ? s.sectionBadgeSaved : null,
                      ]}
                    >
                      <Text
                        style={[
                          s.sectionBadgeText,
                          b.kind === 'dirty' ? s.sectionBadgeTextDirty : null,
                          b.kind === 'saved' ? s.sectionBadgeTextSaved : null,
                        ]}
                      >
                        {b.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            {subtitle ? <Text style={s.sectionSubtitle ?? baseStyles.sectionSubtitle}>{subtitle}</Text> : null}
          </View>
          <View
            style={
              s.sectionHeaderRight ??
              ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 22 } as any)
            }
          >
            {right}
            <Text style={s.sectionChevron ?? baseStyles.sectionChevron}>{open ? '−' : '+'}</Text>
          </View>
        </View>
      </Pressable>

      {open ? <View style={s.sectionBody ?? ({ gap: 12 } as any)}>{children}</View> : null}
    </View>
  )
}
