import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  creatureFeature,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { evaluateNativeLiveActionEconomy } from '../src/nativeEncounterActionEconomy.js'
import { captureEnvelope, captureFake, testUuid } from '../src/testing/liveCaptureFixture.js'

/**
 * MOVE-1.T1a: the child a movement reaction runs is charged as one reaction, whatever its source's
 * own activation, as a delegated attack is. A Wolf's Bite is an Action attack: answering a move, it
 * spends the reaction it was offered under and opens no Attack action.
 */

const WOLF_ID = testUuid(0x7a01)
const MOVER_ID = testUuid(0x7a02)

async function charge(input: { currentActorId: string; offeredAllowanceDefinitionId?: string }) {
  const wolf = srdCreatureActor({ id: WOLF_ID, creature: srdByLabel(SRD.creatures, 'Wolf') })
  const mover = srdCreatureActor({
    id: MOVER_ID,
    creature: srdByLabel(SRD.creatures, 'Goblin'),
    disposition: 'FRIENDLY'
  })
  const bite = creatureFeature(srdByLabel(SRD.creatures, 'Wolf'), 'Bite')
  const capability = discoverEncounterFeatureActionCapabilities({
    spells: new Map(),
    actor: wolf,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
  }).find((entry) => entry.ownerFeatureId === bite.id)
  if (!capability) throw new Error('The Wolf’s Bite was not discovered.')
  const actors = [wolf, mover]
  const state = srdEncounterState({ actors, currentActorId: input.currentActorId })
  const movementTargets = new Map(actors.map((actor) => [actor.id, srdCreatureTarget(actor)]))
  const prepared = await prepareEncounterActionMechanics({
    state,
    actor: wolf,
    target: mover,
    actors,
    actionId: capability.actionId,
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: true,
    movementTargets,
    loadSource: async (source) =>
      resolveEncounterActionSource({ spells: new Map(), ...source, system: srdSystemRecord }),
    loadRelationshipFacts: async () => []
  })
  // Fake: the capture serves the published SRD definitions the room would read from Convex.
  const { capture } = captureFake(async (request) => {
    if (request.kind !== 'DEFINITION') throw new Error(`Unexpected ${request.kind} capture.`)
    return {
      kind: 'DEFINITION',
      ...captureEnvelope,
      definition: await srdDefinitions.requireCurrent(request.definitionId)
    }
  })
  return evaluateNativeLiveActionEconomy({
    prepared,
    state,
    actionId: capability.actionId,
    sourceTarget: movementTargets.get(WOLF_ID),
    targetIds: [MOVER_ID],
    capture,
    offeredAllowanceDefinitionId: input.offeredAllowanceDefinitionId
  })
}

describe('a movement reaction child’s charge', () => {
  it('spends an Action and opens the Attack action on the attacker’s own turn', async () => {
    const own = await charge({ currentActorId: WOLF_ID })
    expect(own.activationCode).toBe('ACTION')
    expect(own.economy?.consumption.definitionId).toBe(SRD_ACTION_ALLOWANCE_DEFINITION_ID)
    expect(own.attackAction).not.toBeNull()
  })

  it('spends the offered reaction and opens no Attack action when it answers a move', async () => {
    const child = await charge({
      currentActorId: MOVER_ID,
      offeredAllowanceDefinitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID
    })
    expect(child.activationCode).toBe('REACTION')
    expect(child.economy).toMatchObject({
      available: true,
      consumption: { definitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID, beforeUsed: 0 }
    })
    expect(child.attackAction).toBeNull()
  })
})
