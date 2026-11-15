import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  compareDamageSaveApplications,
  type ConcentrationDamageApplicationDto,
  type DamageSaveApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { massiveDamageSaveApplications } from './encounterMassiveDamage.js'
import {
  damagedHitRepeatTrigger,
  discoverEncounterEventHooks
} from './events/encounterEventHooks.js'
import type { EncounterDamageHit } from './events/encounterEventTable.js'
import { maintenanceLinkCapabilityRegistry } from './platformPolicyModules.js'

/** What a holder carries that the effect saves of a command's damage read. */
export type DamageSaveEffectHolder = {
  defeated: boolean
  /**
   * The holder's damaged discovery: the effects its one `DAMAGED(AFTER)` raise found owing a repeat
   * save (D167, D220), less every effect the command ended. Every room root carries its stages' own
   * discovery (`targetEndedEffects`); persistence re-derives it from the settled effects
   * (`settledRepeatSaveEffects`), which equals it.
   */
  repeatSaveEffects: readonly ActiveRuleEffectRecord[]
  maximumHitPoints: number
}

/** A root's damaged discovery per holder: what each of its raises for the holder found. */
export type DamagedDiscovery = ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>

/**
 * A root's raises joined into its damaged discovery, in raise order (D220): a root raises once per
 * holder for each turn-effect execution, turn-zone stage or Legendary Action that damaged it, and
 * the holder's damage-save chain consumes what all of them found, each effect once.
 */
export function joinDamagedDiscoveries(
  raises: Iterable<readonly [holderActorId: string, found: readonly ActiveRuleEffectRecord[]]>
): Map<string, ActiveRuleEffectRecord[]> {
  const joined = new Map<string, ActiveRuleEffectRecord[]>()
  for (const [holderActorId, found] of raises)
    joined.set(holderActorId, [
      ...(joined.get(holderActorId) ?? []).filter(
        ({ id }) => !found.some((effect) => effect.id === id)
      ),
      ...found
    ])
  return joined
}

/**
 * Whether a command placed this effect: its origin, of either kind, names one of the command's
 * occurrences (its own, or an entry occurrence it made per creature). Such an effect was not on its
 * holder when the command's damage landed, so it never repeats against that damage.
 */
export function placedByCommand(
  { definition: { origin } }: Pick<ActiveRuleEffectRecord, 'definition'>,
  commandOccurrenceIds: readonly string[]
) {
  return commandOccurrenceIds.includes(origin.sourceOccurrenceId)
}

/**
 * A holder's damaged discovery re-derived once its command settled: the effects it still carries,
 * less those the command placed, that one `DAMAGED(AFTER)` raise with a hit per damage application
 * finds owing a repeat save. An effect the command ended is gone from the settled effects, so this
 * equals the ends stage's discovery less what the command ended.
 */
export function settledRepeatSaveEffects(input: {
  holderActorId: string
  /** The effects the holder carries once the command settled. */
  effects: readonly ActiveRuleEffectRecord[]
  /**
   * The occurrences of the command whose damage this is: its own, then each entry occurrence it made.
   * An effect any of them placed never repeats against its own damage (`placedByCommand`).
   */
  commandOccurrenceIds: readonly string[]
  applications: readonly ConcentrationDamageApplicationDto[]
  /** Who dealt damage whose application names no damager. */
  damagerActorId: string | null
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
}): ActiveRuleEffectRecord[] {
  const hits: EncounterDamageHit[] = input.applications.flatMap((application) =>
    application.targetActorId === input.holderActorId
      ? [
          {
            damagerActorId: application.damagerActorId ?? input.damagerActorId,
            damageTypeIds: application.damageTypeIds
          }
        ]
      : []
  )
  return discoverEncounterEventHooks({
    effects: input.effects.filter((effect) => !placedByCommand(effect, input.commandOccurrenceIds)),
    events: [
      {
        kind: 'DAMAGED',
        phase: 'AFTER',
        holderActorId: input.holderActorId,
        hits,
        dispositions: input.dispositions
      }
    ]
  }).repeatSaves.map(({ effect }) => effect)
}

/**
 * The one planner of the saves a command's finalized damage owes (D95, D167, ATTACK-16), for every
 * damage root: an action, an area, a Cleaving blow, a turn, and a movement's zone contacts. For each
 * damaged holder, with one hit per damage source that reached it, it owes a Concentration check per
 * held Concentration for each hit the System's maintenance hook meets, an effect repeat save per hit
 * that meets a trigger of an effect in the holder's damaged discovery (D167; it reads the hits of the
 * raise that discovery came from and never raises the effects' event again), and the massive-damage
 * save of each source over the rule's share. The chain is in canonical order.
 */
export function planDamageSaveChain(input: {
  gameSystemId: string
  applications: readonly ConcentrationDamageApplicationDto[]
  /** The Concentrations each damaged holder maintains, in casting order. */
  maintainedStates: ReadonlyMap<string, readonly { id: string; createdAt: string }[]>
  /** Who dealt damage whose application names no damager. */
  damagerActorId: string | null
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
  effectSaves: {
    massiveRule: Parameters<typeof massiveDamageSaveApplications>[0]['rule']
    holders: ReadonlyMap<string, DamageSaveEffectHolder>
  }
}): DamageSaveApplicationDto[] {
  const { hooks } = maintenanceLinkCapabilityRegistry.require(input.gameSystemId)
  const chain: DamageSaveApplicationDto[] = []
  for (const holderActorId of new Set(
    input.applications.map(({ targetActorId }) => targetActorId)
  )) {
    const damage = input.applications.filter(({ targetActorId }) => targetActorId === holderActorId)
    const held = input.maintainedStates.get(holderActorId) ?? []
    const holder = input.effectSaves.holders.get(holderActorId)
    const effects = holder && !holder.defeated ? holder.repeatSaveEffects : []
    if (held.length === 0 && effects.length === 0) continue
    const hits: EncounterDamageHit[] = damage.map((application) => ({
      damagerActorId: application.damagerActorId ?? input.damagerActorId,
      damageTypeIds: application.damageTypeIds
    }))
    const { maintenanceSaveHits } = discoverEncounterEventHooks({
      maintenanceHooks: held.length > 0 ? hooks : [],
      events: [
        { kind: 'DAMAGED', phase: 'AFTER', holderActorId, hits, dispositions: input.dispositions }
      ]
    })
    for (const index of maintenanceSaveHits)
      for (const { id, createdAt } of held)
        chain.push({ ...damage[index]!, maintainedStateId: id, castAt: createdAt })
    for (const effect of effects)
      for (const [index, hit] of hits.entries())
        if (damagedHitRepeatTrigger(effect, hit, input.dispositions))
          chain.push({ ...damage[index]!, activeEffectId: effect.id })
  }
  chain.push(
    ...massiveDamageSaveApplications({
      rule: input.effectSaves.massiveRule,
      applications: input.applications,
      holders: input.effectSaves.holders
    })
  )
  return chain.sort(compareDamageSaveApplications)
}
