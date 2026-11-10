/**
 * The one spend rule of a Resource pool, for a Sheet command and an Encounter action alike
 * (QUALITY-12.1). A spend the pool cannot cover is refused: null. Only the Encounter's logged
 * "Do it anyway" makes a spend `overridable` (D11): it then takes what remains, and the caller
 * records the shortfall. The Sheet offers no override, so its spends are never overridable.
 */
export function resourcePoolSpend(
  pool: { used: number; remaining: number },
  cost: number,
  overridable: boolean
): { spent: number; afterUsed: number; afterRemaining: number } | null {
  if (!overridable && pool.remaining < cost) return null
  const spent = Math.min(cost, pool.remaining)
  return { spent, afterUsed: pool.used + spent, afterRemaining: pool.remaining - spent }
}
