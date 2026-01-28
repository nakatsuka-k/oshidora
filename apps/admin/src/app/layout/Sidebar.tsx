import { Platform, Pressable, ScrollView, Text, View } from 'react-native'

import type { RouteId } from '../../lib/routes'
import { styles } from '../styles'

export type SidebarEntry =
  | { kind: 'group'; label: string }
  | { kind: 'item'; id: RouteId; label: string; indent?: number }

export function Sidebar({
  entries,
  activeId,
  onNavigate,
}: {
  entries: SidebarEntry[]
  activeId: RouteId
  onNavigate: (id: RouteId) => void
}) {
  return (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>管理メニュー</Text>
      <View style={styles.sidebarDivider} />
      <ScrollView
        style={[styles.sidebarList, Platform.OS === 'web' ? ({ overflowY: 'auto' } as any) : null]}
        contentContainerStyle={styles.sidebarListContent}
        showsVerticalScrollIndicator
      >
        {entries.map((it, idx) => {
          if (it.kind === 'group') {
            return (
              <Text key={`group-${idx}-${it.label}`} style={styles.sidebarGroupTitle}>
                {it.label}
              </Text>
            )
          }

          return (
            <Pressable
              key={it.id}
              onPress={() => onNavigate(it.id)}
              style={[
                styles.sidebarItem,
                it.indent ? { paddingLeft: 18 + it.indent * 12 } : null,
                activeId === it.id ? styles.sidebarItemActive : null,
              ]}
            >
              <Text style={[styles.sidebarItemText, activeId === it.id ? styles.sidebarItemTextActive : null]}>{it.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

export function sidebarActiveRoute(route: RouteId): RouteId {
  switch (route) {
    case 'not-found':
      return 'dashboard'
    case 'videos-scheduled-detail':
      return 'videos-scheduled'
    case 'video-detail':
      return 'videos'
    case 'unapproved-video-detail':
      return 'unapproved-videos'
    case 'unapproved-actor-account-detail':
      return 'unapproved-actor-accounts'
    case 'work-detail':
    case 'work-new':
      return 'works'
    case 'comment-approve':
      return 'comments-pending'
    case 'comment-edit':
      return 'comments'
    case 'user-detail':
      return 'users'
    case 'notice-detail':
    case 'notice-new':
      return 'notices'
    case 'category-detail':
    case 'category-new':
      return 'categories'
    case 'tag-edit':
    case 'tag-new':
      return 'tags'
    case 'genre-detail':
    case 'genre-new':
      return 'genres'
    case 'cast-category-detail':
    case 'cast-category-new':
      return 'cast-categories'
    case 'coin-setting-detail':
    case 'coin-setting-new':
      return 'coin'
    case 'admin-detail':
    case 'admin-new':
      return 'admins'
    case 'inquiry-detail':
      return 'inquiries'
    default:
      return route
  }
}
