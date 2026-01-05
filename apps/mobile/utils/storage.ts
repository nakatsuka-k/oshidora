import AsyncStorage from '@react-native-async-storage/async-storage'

export async function getBoolean(key: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(key)
  return value === '1'
}

export async function setBoolean(key: string, value: boolean): Promise<void> {
  await AsyncStorage.setItem(key, value ? '1' : '0')
}
