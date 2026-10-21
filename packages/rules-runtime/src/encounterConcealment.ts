import type { EncounterD20RollModeDto } from '@artificer-toolkit/schema/api/encounters'
import type { ConcealmentListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

/** A concealment an actor holds: the Stealth total it froze and the observers it is still hidden from. */
export type EncounterConcealment = {
  effect: ActiveRuleEffectRecord
  concealmentTotal: number
  observerActorIds: readonly string[]
}

/** The concealment an actor's effects hold, if any (an actor holds at most one). */
export function encounterConcealmentOf(
  effects: readonly ActiveRuleEffectRecord[]
): EncounterConcealment | null {
  for (const effect of effects) {
    const contribution = effect.definition.stateContributions.find(
      ({ kind }) => kind === 'LOCATION_CONCEALMENT'
    )
    if (contribution?.kind === 'LOCATION_CONCEALMENT')
      return {
        effect,
        concealmentTotal: contribution.concealmentTotal,
        observerActorIds: effect.lifecycle.concealedFromActorIds ?? []
      }
  }
  return null
}

/** The concealment an actor's effects hold, as the GM's projection lists it (D116); null when it holds none. */
export function listConcealment(
  effects: readonly ActiveRuleEffectRecord[]
): ConcealmentListingDto | null {
  const concealment = encounterConcealmentOf(effects)
  return (
    concealment && {
      effectId: concealment.effect.id,
      concealmentTotal: concealment.concealmentTotal,
      observerActorIds: [...concealment.observerActorIds]
    }
  )
}

/** An observer set as a concealment stores it: unique and sorted, so two equal sets compare equal. */
export const normalizeObserverActorIds = (observerActorIds: readonly string[]) =>
  [...new Set(observerActorIds)].sort()

/** Whether two normalized observer sets hold the same actors. */
export const sameObserverActorIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])

/** The concealment's lifecycle once it hides its holder from exactly these observers. */
export const concealmentLifecycleFor = (
  effect: ActiveRuleEffectRecord,
  observerActorIds: readonly string[]
) => ({ ...effect.lifecycle, concealedFromActorIds: normalizeObserverActorIds(observerActorIds) })

/** Whether the effects hide their holder from this observer. */
export const isConcealedFrom = (
  effects: readonly ActiveRuleEffectRecord[],
  observerActorId: string
) => encounterConcealmentOf(effects)?.observerActorIds.includes(observerActorId) ?? false

/** The System skill a passive score is built on, as the System authors it; null when it names none. */
export function passiveSkillDefinitionId(system: SystemAuthoredDto, passiveDefinitionId: string) {
  const passives: readonly { id: string; skillDefinitionId?: string | null }[] = system.passives
  return passives.find(({ id }) => id === passiveDefinitionId)?.skillDefinitionId ?? null
}

const PASSIVE_ROLL_MODE_ADJUSTMENT = { NORMAL: 0, ADVANTAGE: 5, DISADVANTAGE: -5 } as const

/** A passive score: 10 plus the skill's check modifier, 5 more with advantage and 5 less with disadvantage. */
export const encounterPassiveScore = (skillModifier: number, rollMode: EncounterD20RollModeDto) =>
  10 + skillModifier + PASSIVE_ROLL_MODE_ADJUSTMENT[rollMode]

/**
 * The observers a Stealth total hides its roller from. Ties go to the observer: an observer
 * notices a hider whose total only equals its score.
 */
export const observersHiddenFrom = (
  concealmentTotal: number,
  observers: readonly { actorId: string; passiveScore: number }[]
) =>
  observers
    .filter(({ passiveScore }) => concealmentTotal > passiveScore)
    .map(({ actorId }) => actorId)
    .sort()

/**
 * What a search total finds: each concealment that still hides its holder from the searcher and
 * whose Stealth total the search reaches. Ties go to the searcher, as to every observer.
 */
export function concealmentsFoundBy(input: {
  searcherActorId: string
  searchTotal: number
  concealments: readonly (EncounterConcealment & { holderActorId: string })[]
}) {
  return input.concealments
    .filter(
      ({ observerActorIds, concealmentTotal }) =>
        observerActorIds.includes(input.searcherActorId) && input.searchTotal >= concealmentTotal
    )
    .map((concealment) => ({
      ...concealment,
      remainingObserverActorIds: concealment.observerActorIds.filter(
        (actorId) => actorId !== input.searcherActorId
      )
    }))
}
