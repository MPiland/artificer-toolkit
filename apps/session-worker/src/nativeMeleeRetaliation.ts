import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { MeleeRetaliationEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'
import { meleeRetaliationDamage } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import {
  planEncounterMeleeRetaliation,
  selectMeleeRetaliationContacts,
  type MeleeRetaliationToken
} from '@artificer-toolkit/rules-runtime/encounterMeleeRetaliation'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'

/**
 * Plans the zones a melee hit sets off against its attacker (D153) from the Scene's zones and the
 * two tokens where the hit landed. Null when no zone the hit creature holds contains the attacker.
 */
export async function planNativeLiveMeleeRetaliation(input: {
  state: EncounterRunState
  attackerToken: MeleeRetaliationToken
  hitToken: MeleeRetaliationToken
  effects: readonly EncounterSpatialRuleEffectRecord[]
  /** The Run's actors when the attack was made, so a source the hit defeats still retaliates. */
  initialActors: readonly EncounterRunActorState[]
  /** The attacker as the action and its maintenance left it. */
  attacker: MovementTarget<PreparedLiveCharacterSheet>
  occurrenceId: string
  sourceCommandId: string
  occurredAt: string
  userId: string
  runtime: RulesRuntimeService
  random: (maximum: number) => number
  /** The replayed attack's recorded retaliation, rolled again from its dice. */
  retained?: MeleeRetaliationEvidenceDto
}) {
  const { state } = input
  const selected = selectMeleeRetaliationContacts({
    actors: input.initialActors,
    attacker: input.attackerToken,
    hit: input.hitToken,
    effects: input.effects
  })
  if (!selected && input.retained) throw new Error('Retained melee retaliation evidence is stale.')
  if (!selected) return null
  const planned = await planEncounterMeleeRetaliation({
    selected,
    attacker: input.attacker,
    encounter: {
      id: state.id,
      version: state.version,
      campaignId: state.campaignId,
      gameSystemId: state.gameSystemId
    },
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.sourceCommandId,
    occurredAt: input.occurredAt,
    userId: input.userId,
    runtime: input.runtime,
    random: input.random,
    damageEnds: {
      turnActorId: state.currentActorId,
      dispositions: new Map(input.initialActors.map(({ id, disposition }) => [id, disposition]))
    },
    ...(input.retained ? { retained: input.retained } : {})
  })
  return {
    ...planned,
    /** Each zone's damage to the attacker as its own Concentration source, named after the zone. */
    damage: meleeRetaliationDamage(planned.evidence).map((batch, index) => ({
      ...batch,
      sourceLabel: selected.effects[index]!.placement.label ?? null
    }))
  }
}
