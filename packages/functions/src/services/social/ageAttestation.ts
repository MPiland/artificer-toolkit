export function isAtLeast18(birthDate: string, now: Date): boolean {
  const parsed = new Date(`${birthDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) {
    return false
  }

  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()))
  return parsed <= cutoff
}
