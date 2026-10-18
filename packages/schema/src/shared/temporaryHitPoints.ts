/**
 * A creature's temporary hit points and the active effect that gave them, null when no effect did
 * (D156). Temporary hit points never stack, so the pool has at most one source, and an effect's
 * temporary hit points are lost when it ends. The Character and Run actor paths and the receipt
 * validators all move the pool through these rules.
 */
export interface TemporaryHitPointsPool {
  amount: number
  sourceEffectId: string | null
}

/** A grant replaces the pool only when it is larger, and the pool then names the grant's source. */
export function temporaryHitPointsAfterGrant(
  pool: TemporaryHitPointsPool,
  grant: TemporaryHitPointsPool
): TemporaryHitPointsPool {
  return grant.amount > pool.amount ? grant : pool
}

/** Damage spends the pool and keeps its source while any of it remains. */
export function temporaryHitPointsAfterLoss(
  pool: TemporaryHitPointsPool,
  lost: number
): TemporaryHitPointsPool {
  const amount = pool.amount - lost
  return { amount, sourceEffectId: amount > 0 ? pool.sourceEffectId : null }
}

/** An ended effect takes the pool with it only while it is still the pool's source. */
export function temporaryHitPointsAfterRelease(
  pool: TemporaryHitPointsPool,
  endedEffectId: string
): TemporaryHitPointsPool {
  return pool.sourceEffectId === endedEffectId ? { amount: 0, sourceEffectId: null } : pool
}

/** Effects that end together release the pool when one of them is its source. */
export function temporaryHitPointsAfterEffectsEnd(
  pool: TemporaryHitPointsPool,
  endedEffectIds: readonly string[]
): TemporaryHitPointsPool {
  return endedEffectIds.reduce(temporaryHitPointsAfterRelease, pool)
}

/** A manual edit or a rest sets the amount outright; the pool then belongs to no effect. */
export function temporaryHitPointsSet(amount: number): TemporaryHitPointsPool {
  return { amount, sourceEffectId: null }
}

/** A Run actor or form with its pool replaced; the source key is stored only while an effect holds the pool. */
export function withActorTemporaryHitPoints<
  T extends { tempHitPoints: number; tempHitPointsSourceEffectId?: string }
>(holder: T, pool: TemporaryHitPointsPool): T {
  const { tempHitPointsSourceEffectId: _prior, ...rest } = holder
  return {
    ...rest,
    tempHitPoints: pool.amount,
    ...(pool.sourceEffectId === null ? {} : { tempHitPointsSourceEffectId: pool.sourceEffectId })
  } as T
}

/** A Character's hit points with the pool replaced; the source key is stored only while an effect holds it. */
export function withCharacterTemporaryHitPoints<
  T extends { temp: number; tempSourceEffectId?: string }
>(hitpoints: T, pool: TemporaryHitPointsPool): T {
  const { tempSourceEffectId: _prior, ...rest } = hitpoints
  return {
    ...rest,
    temp: pool.amount,
    ...(pool.sourceEffectId === null ? {} : { tempSourceEffectId: pool.sourceEffectId })
  } as T
}