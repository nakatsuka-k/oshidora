import { Pressable, Text, View } from 'react-native'

import { styles } from '../styles'

export function AppHeader({ adminName, onLogout }: { adminName: string; onLogout: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerLogo}>oshidora</Text>

      <View style={styles.headerRight}>
        <Text style={styles.headerUser} numberOfLines={1}>
          {adminName || '管理者'}
        </Text>
        <Pressable onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>ログアウト</Text>
        </Pressable>
      </View>
    </View>
  )
}
