import { describe, expect, it } from 'vitest'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/initiativePolicy'
import { initiativeDeclarationFactsDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import { SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'

import { startInitiativeScoreBatch } from '../encounterInitiativeScoreBatch.js'
import {
  DND5E_INITIATIVE_FACT_KEYS,
  dnd5eInitiativeFactAdapter
} from '../systems/dnd5e/initiativeFactAdapter.js'
import { createSrdRulesRuntime } from '../testing/dnd5eSrdEncounter.js'
import { seededInitiativePolicySnapshot } from '../testing/initiativePolicySnapshot.js'
import { ACTOR_A, ACTOR_B, customSource, scriptedDice } from './encounterInitiativeFixtures.js'

/**
 * ENCOUNTER-4.T1: the seeded Speed Factor policy's Dexterity tie graph scores an actor only when
 * the actor's facts carry the Dexterity score the graph reads; any other actor falls to the
 * policy's manual path.
 */

const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000f001'
const { snapshot } = seededInitiativePolicySnapshot(
  SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID
)
const policy = initiativePolicyReusableDefinitionDocumentDtoSchema.parse(snapshot.policy.document)
const tieResolver = policy.tieResolvers[0]!

function scoreTie(facts: Readonly<Record<string, number>> | null) {
  return startInitiativeScoreBatch({
    runtime: createSrdRulesRuntime(),
    occurrenceId: OCCURRENCE_ID,
    gameSystemId: snapshot.gameSystemId,
    graph: snapshot.tieResolver,
    pin: tieResolver,
    procedure: 'DECLARED_ACTION_ROLL',
    phase: 'TIE_RESOLUTION',
    mode: 'AUTO_ROLL',
    entities: [
      {
        kind: 'ACTOR',
        id: ACTOR_A,
        binding: facts ? { automatic: true, facts } : { automatic: false }
      }
    ],
    integerSource: scriptedDice([]).next
  })
}

describe('the initiative score batch with a graph that reads actor facts (ENCOUNTER-4.3)', () => {
  it('scores an actor whose facts carry every fact the graph reads', async () => {
    const result = await scoreTie({ [DND5E_INITIATIVE_FACT_KEYS.dexterityScore]: 14 })

    expect(result.kind).toBe('COMPLETE')
    expect(result.completed.map(({ result: entry }) => entry)).toMatchObject([
      { kind: 'GRAPH_COMPLETE', execution: { score: 14 } }
    ])
  })

  it('leaves an actor that lacks a fact the graph reads to the manual path', async () => {
    const result = await scoreTie({ [DND5E_INITIATIVE_FACT_KEYS.modifier]: 2 })

    expect(result.completed.map(({ result: entry }) => entry.kind)).toEqual(['FACTS_UNAVAILABLE'])
  })

  it('binds a CUSTOM actor with no Dexterity score, so its tie score is unavailable', async () => {
    const binding = dnd5eInitiativeFactAdapter.bindDeclaredActor(
      customSource(ACTOR_B),
      initiativeDeclarationFactsDtoSchema.parse({
        actorSize: 'MEDIUM',
        primary: {
          kind: 'GM_ADJUDICATED',
          optionId: 'GM_ADJUDICATED',
          actorId: ACTOR_B,
          factorIds: [],
          spellLevel: null
        },
        bonus: null
      }),
      0
    )

    if (!binding.automatic) throw new Error('A GM-adjudicated declaration binds automatically.')
    expect(binding.facts).not.toHaveProperty(DND5E_INITIATIVE_FACT_KEYS.dexterityScore)
    const result = await startInitiativeScoreBatch({
      runtime: createSrdRulesRuntime(),
      occurrenceId: OCCURRENCE_ID,
      gameSystemId: snapshot.gameSystemId,
      graph: snapshot.tieResolver,
      pin: tieResolver,
      procedure: 'DECLARED_ACTION_ROLL',
      phase: 'TIE_RESOLUTION',
      mode: 'AUTO_ROLL',
      entities: [{ kind: 'ACTOR', id: ACTOR_B, binding }],
      integerSource: scriptedDice([]).next
    })
    expect(result.completed.map(({ result: entry }) => entry.kind)).toEqual(['FACTS_UNAVAILABLE'])
  })
})
