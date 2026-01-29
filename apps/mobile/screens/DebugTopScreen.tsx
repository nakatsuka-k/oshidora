import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, View } from 'react-native'

import { PaginationDots, PrimaryButton, ScreenContainer, SecondaryButton, Slideshow, THEME } from '../components'
import type { Oshi, Props } from '../types/debugTopScreenTypes'
import { tutorialImages } from '../types/debugTopScreenTypes'

export function DebugTopScreen(props: Props) {
  const styles = props.styles

  return (
    <ScreenContainer title="推しドラ">
      <View style={styles.header}>
        <Text style={styles.sub}>API: {props.apiBaseUrl}</Text>
        {props.health ? <Text style={styles.sub}>Health: {props.health}</Text> : null}
        {props.error ? <Text style={styles.error}>Error: {props.error}</Text> : null}
        {!props.loggedIn ? (
          <View style={styles.topLoginRow}>
            <PrimaryButton label="ログイン" onPress={props.onGoLogin} />
          </View>
        ) : null}
        <View style={styles.topNavRow}>
          <SecondaryButton label="プロフィール(ワイヤー)" onPress={props.onGoProfile} />
          <View style={styles.spacer} />
          <SecondaryButton label="作品詳細(ワイヤー)" onPress={props.onGoWorkDetail} />
          <View style={styles.spacer} />
          <SecondaryButton label="Developer" onPress={props.onGoDev} />
        </View>
      </View>

      <View style={styles.row}>
        <SecondaryButton label="Health" onPress={props.onCheckHealth} />
        <View style={styles.spacer} />
        <SecondaryButton label="Reload" onPress={props.onReload} />
      </View>

      <View style={styles.header}>
        <Text style={styles.sub}>Components</Text>
        <Text style={styles.sub}>PaginationDots: {props.debugDotsIndex + 1}/5</Text>
      </View>
      <PaginationDots count={5} index={props.debugDotsIndex} onChange={props.onChangeDebugDotsIndex} />

      <View style={styles.header}>
        <Text style={styles.sub}>Slideshow: {props.debugSlideIndex + 1}/{tutorialImages.length}</Text>
      </View>
      <Slideshow
        images={tutorialImages}
        height={220}
        index={props.debugSlideIndex}
        onIndexChange={props.onChangeDebugSlideIndex}
        resizeMode="cover"
      />

      <View style={styles.row}>
        <TextInput
          value={props.name}
          onChangeText={props.onChangeName}
          placeholder="推しの名前"
          placeholderTextColor={THEME.textMuted}
          autoCapitalize="none"
          style={styles.input}
        />
        <View style={styles.spacer} />
        <PrimaryButton
          label="Add"
          onPress={props.onAddOshi}
          disabled={props.apiBusy || props.name.trim().length === 0}
          fullWidth={false}
        />
      </View>

      {props.apiBusy ? <ActivityIndicator style={styles.loading} /> : null}

      <FlatList
        data={props.items}
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

      <View style={localStyles.noteWrap}>
        <Image source={require('../assets/oshidora_logo.png')} style={localStyles.noteLogo} resizeMode="contain" />
      </View>
    </ScreenContainer>
  )
}

const localStyles = StyleSheet.create({
  noteWrap: {
    marginTop: 18,
    alignItems: 'center',
    opacity: 0.25,
  },
  noteLogo: {
    width: 120,
    height: 40,
  },
})
