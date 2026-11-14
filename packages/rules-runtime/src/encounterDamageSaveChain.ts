import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  compareDamageSaveApplications,
  type ConcentrationDamageApplicationDto,
  type DamageSaveApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { massiveDamageSaveApplications } from './encounterMassiveDamage.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import type { EncounterDamageHit } from './events/encounterEventTable.js'
import { maintenanceLinkCapabilityRegistry } from './platformPolicyModules.js'

/** What a holder carries that the effect saves of a command's damage read. */
export type DamageSaveEffectHolder = {
  defeated: boolean
  effects: readonly ActiveRuleEffectRecord[]
  maximumHitPoints: number
}

/**
 * The one planner of the saves a command's finalized damage owes (D95, D167, ATTACK-16), for every
 * damage root: an action, an area, a Cleaving blow, a turn, and a movement's zone contacts. It raises
 * `DAMAGED(AFTER)` once per damaged holder, with one hit per damage source that reached it, and reads
 * every hook off that one discovery: a Concentration check per held Concentration for each source the
 * System's maintenance hook meets, an effect repeat save per source a holder effect's trigger meets
 * (D167), and the massive-damage save of each source over the rule's share. `effectSaves` is null for
 * a root that holds only Concentration checks. The chain is in canonical order.
 */
export function planDamageSaveChain(input: {
  gameSystemId: string
  applications: readonly ConcentrationDamageApplicationDto[]
  /** The Concentrations each damaged holder maintains, in casting order. */
  maintainedStates: ReadonlyMap<string, readonly { id: string; createdAt: string }[]>
  /** The command whose damage this is. An effect it placed never repeats against its own damage. */
  parentOccurrenceId: string
  /** Who dealt damage whose application names no damager. */
  damagerActorId: string | null
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
  effectSaves: {
    massiveRule: Parameters<typeof massiveDamageSaveApplications>[0]['rule']
    holders: ReadonlyMap<string, DamageSaveEffectHolder>
  } | null
}): DamageSaveApplicationDto[] {
  const { hooks } = maintenanceLinkCapabilityRegistry.require(input.gameSystemId)
  const chain: DamageSaveApplicationDto[] = []
  for (const holderActorId of new Set(
    input.applications.map(({ targetActorId }) => targetActorId)
  )) {
    const damage = input.applications.filter(({ targetActorId }) => targetActorId === holderActorId)
    const held = input.maintainedStates.get(holderActorId) ?? []
    const holder = input.effectSaves?.holders.get(holderActorId)
    const effects =
      holder && !holder.defeated
        ? holder.effects.filter(
            ({ definition: { origin } }) =>
              !(
                origin.kind === 'ENCOUNTER' &&
                origin.sourceOccurrenceId === input.parentOccurrenceId
              )
          )
        : []
    if (held.length === 0 && effects.length === 0) continue
    const hits: EncounterDamageHit[] = damage.map((application) => ({
      damagerActorId: application.damagerActorId ?? input.damagerActorId,
      damageTypeIds: [application.damageTypeId]
    }))
    const { maintenanceSaveHits, repeatSaves } = discoverEncounterEventHooks({
      maintenanceHooks: held.length > 0 ? hooks : [],
      effects,
      events: [{ kind: 'DAMAGED', phase: 'AFTER', hits, dispositions: input.dispositions }]
    })
    for (const index of maintenanceSaveHits)
      for (const { id, createdAt } of held)
        chain.push({ ...damage[index]!, maintainedStateId: id, castAt: createdAt })
    for (const { effect, hits: met } of repeatSaves)
      for (const { index } of met) chain.push({ ...damage[index]!, activeEffectId: effect.id })
  }
  if (input.effectSaves)
    chain.push(
      ...massiveDamageSaveApplications({
        rule: input.effectSaves.massiveRule,
        applications: input.applications,
        holders: input.effectSaves.holders
      })
    )
  return chain.sort(compareDamageSaveApplications)
}
