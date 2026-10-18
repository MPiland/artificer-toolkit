import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { meleeRetaliationDamage } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import {
  planEncounterMeleeRetaliation,
  selectMeleeRetaliationContacts
} from '@artificer-toolkit/rules-runtime/encounterMeleeRetaliation'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'
import { readNativeLiveSpatialEffects } from './nativeTurnEffectPerception.js'

type ActionToken = NonNullable<
  Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_SCENE' }>['context']
>['sourceToken']

/**
 * Plans the zones a melee hit sets off against its attacker (D153) from the Scene the action
 * captured. Null when no zone the hit creature holds contains the attacker.
 */
export async function planNativeLiveMeleeRetaliation(input: {
  state: EncounterRunState
  scene: { sceneId: string; sceneVersion: number; attacker: ActionToken; hit: ActionToken }
  /** The Run's actors when the attack was made, so a source the hit defeats still retaliates. */
  initialActors: readonly EncounterRunActorState[]
  /** The attacker as the action and its maintenance left it. */
  attacker: MovementTarget<PreparedLiveCharacterSheet>
  occurrenceId: string
  sourceCommandId: string
  occurredAt: string
  userId: string
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
  runtime: RulesRuntimeService
  random: (maximum: number) => number
}) {
  const { state, scene } = input
  const selected = selectMeleeRetaliationContacts({
    actors: input.initialActors,
    attacker: scene.attacker,
    hit: scene.hit,
    effects: await readNativeLiveSpatialEffects({
      encounterId: state.id,
      sceneId: scene.sceneId,
      sceneVersion: scene.sceneVersion,
      capture: input.capture
    })
  })
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
    random: input.random
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
