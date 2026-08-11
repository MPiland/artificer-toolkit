export function latestAdultBirthDate(now = new Date()): string {
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  const year = cutoff.getFullYear()
  const month = String(cutoff.getMonth() + 1).padStart(2, '0')
  const day = String(cutoff.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
