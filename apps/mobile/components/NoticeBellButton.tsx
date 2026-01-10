import { Pressable, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { THEME } from './theme'

type NoticeBellButtonProps = {
  onPress: () => void
}

export function NoticeBellButton({ onPress }: NoticeBellButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="お知らせ"
      onPress={onPress}
      style={styles.button}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V3a2 2 0 1 0-4 0v1.29A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Zm-2 2H7v-.17L8.59 16H15.4L17 17.83V18Zm-1.76-4H8.76V11a5.24 5.24 0 0 1 10.48 0v3Z"
          fill={THEME.text}
        />
      </Svg>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
