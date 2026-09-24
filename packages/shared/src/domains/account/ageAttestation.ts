export function isAtLeast18(birthDate: string, now: Date): boolean {
  const parsed = new Date(`${birthDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate)
    return false

  const birthdayPending =
    now.getUTCMonth() < parsed.getUTCMonth() ||
    (now.getUTCMonth() === parsed.getUTCMonth() && now.getUTCDate() < parsed.getUTCDate())
  return now.getUTCFullYear() - parsed.getUTCFullYear() - Number(birthdayPending) >= 18
}
