import type { EncounterD20RollModeDto } from '@artificer-toolkit/schema/api/encounters'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

/** A concealment an actor holds: the Stealth total it froze and the observers it is still hidden from. */
export type EncounterConcealment = {
  effect: ActiveRuleEffectRecord
  stealthTotal: number
  observerActorIds: readonly string[]
}

/** The concealment an actor's effects hold, if any (an actor holds at most one). */
export function encounterConcealmentOf(
  effects: readonly ActiveRuleEffectRecord[]
): EncounterConcealment | null {
  for (const effect of effects) {
    if (effect.definition.schemaVersion !== 2) continue
    const contribution = effect.definition.stateContributions.find(
      ({ kind }) => kind === 'LOCATION_CONCEALMENT'
    )
    if (contribution?.kind === 'LOCATION_CONCEALMENT')
      return {
        effect,
        stealthTotal: contribution.stealthTotal,
        observerActorIds: effect.lifecycle.concealedFromActorIds ?? []
      }
  }
  return null
}

/** The concealment's lifecycle once it hides its holder from exactly these observers (sorted, unique). */
export const concealmentLifecycleFor = (
  effect: ActiveRuleEffectRecord,
  observerActorIds: readonly string[]
) => ({ ...effect.lifecycle, concealedFromActorIds: [...new Set(observerActorIds)].sort() })

/** Whether the effects hide their holder from this observer. */
export const isConcealedFrom = (
  effects: readonly ActiveRuleEffectRecord[],
  observerActorId: string
) => encounterConcealmentOf(effects)?.observerActorIds.includes(observerActorId) ?? false

/**
 * The System skill a passive score is built on: the skill whose code the passive's code names
 * (`PASSIVE_PERCEPTION` is built on `PERCEPTION`). Null when the System has no such pair.
 */
export function passiveSkillDefinitionId(system: SystemAuthoredDto, passiveDefinitionId: string) {
  const code = system.passives.find(({ id }) => id === passiveDefinitionId)?.code
  const skillCode = code?.replace(/^PASSIVE_/, '')
  return (code && system.skills.find((skill) => skill.code === skillCode)?.id) ?? null
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
  stealthTotal: number,
  observers: readonly { actorId: string; passiveScore: number }[]
) =>
  observers
    .filter(({ passiveScore }) => stealthTotal > passiveScore)
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
      ({ observerActorIds, stealthTotal }) =>
        observerActorIds.includes(input.searcherActorId) && input.searchTotal >= stealthTotal
    )
    .map((concealment) => ({
      ...concealment,
      remainingObserverActorIds: concealment.observerActorIds.filter(
        (actorId) => actorId !== input.searcherActorId
      )
    }))
}
