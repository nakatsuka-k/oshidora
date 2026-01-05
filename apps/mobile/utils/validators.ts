export function isValidEmail(value: string) {
  const email = value.trim()
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}
