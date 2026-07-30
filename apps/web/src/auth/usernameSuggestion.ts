import type { AccountUsernameStatusDto } from '@artificer-toolkit/schema/api/account'

type GetUsernameStatus = (username: string) => Promise<AccountUsernameStatusDto>

function usernameBase(email: string): string {
  const source = email.split('@')[0] || ''
  const normalized = source
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
    .replace(/_+$/g, '')

  return normalized.length >= 3 ? normalized : 'player'
}

export async function suggestUsername(
  email: string,
  getStatus: GetUsernameStatus,
  random: () => number = Math.random
): Promise<string | null> {
  const base = usernameBase(email)
  const initialStatus = await getStatus(base)
  if (initialStatus.status === 'available') return base

  const suffixBase = initialStatus.status === 'not_allowed' ? 'player' : base
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = ((Math.floor(random() * 10_000) + attempt) % 10_000).toString().padStart(4, '0')
    const candidate = `${suffixBase.slice(0, 25).replace(/_+$/g, '')}_${suffix}`
    if ((await getStatus(candidate)).status === 'available') return candidate
  }

  return null
}
