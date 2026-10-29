import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import {
  evaluateEncounterBasicActionCheck,
  freezeEncounterActorCheck,
  startEncounterBasicActionCheck
} from '../../encounterBasicActionCheck.js'
import type { ProjectableCharacterFacts } from '../../encounterActionProjection.js'
import { buildMovementTarget } from '../../encounterMovementTargets.js'
import { createPlatformRulesRuntime } from '../../platformRulesRuntime.js'
import { tracerActiveEffect, tracerCreatureActor } from './encounter.js'
import {
  TRACER_APPROACH_DEFINITION_IDS,
  TRACER_ROLL_MODE,
  TRACER_SYSTEM_ID,
  tracerSystem
} from './system.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000fa101'
const SIDE_ID = '00000000-0000-4000-8000-0000000fc101'
const CAMPAIGN_ID = '00000000-0000-4000-8000-0000000fc102'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000fd101'
const DC = 12
const ASPECT_ID = '00000000-0000-4000-8000-0000000fd102'

const runtime = createPlatformRulesRuntime({
  definitions: {
    requireCurrent() {
      throw new Error('The tracer check publishes its own graph.')
    }
  }
})

function thug(activeEffects: ActiveRuleEffectRecord[] = []) {
  return buildMovementTarget<ProjectableCharacterFacts>({
    actor: tracerCreatureActor({
      id: ACTOR_ID,
      sideId: SIDE_ID,
      ratings: { CAREFUL: 1, CLEVER: 2, FLASHY: 0, FORCEFUL: 3, QUICK: 1, SNEAKY: -1 }
    }),
    activeEffects,
    characterFacts: null,
    campaignId: CAMPAIGN_ID,
    gameSystemId: TRACER_SYSTEM_ID
  })
}

function freezeForceful(activeEffects: ActiveRuleEffectRecord[] = []) {
  return freezeEncounterActorCheck({
    gameSystemId: TRACER_SYSTEM_ID,
    system: tracerSystem,
    check: { checkKind: 'ABILITY', checkDefinitionId: TRACER_APPROACH_DEFINITION_IDS.FORCEFUL },
    actor: thug(activeEffects)
  })
}

async function settle(frozen: ReturnType<typeof freezeForceful>, faces: number[]) {
  const continuation = await startEncounterBasicActionCheck({
    runtime,
    gameSystemId: TRACER_SYSTEM_ID,
    occurrenceId: OCCURRENCE_ID
  })
  return evaluateEncounterBasicActionCheck({
    gameSystemId: TRACER_SYSTEM_ID,
    runtime,
    context: { d20: frozen.d20, check: { dc: DC } },
    continuation,
    answer: {
      kind: 'ENTER_DICE',
      requestId: continuation.request.requestId,
      rawFaces: faces,
      rollMode: frozen.d20.rollMode
    },
    rollD20: () => {
      throw new Error('An entered roll never rolls.')
    },
    expectedOccurrenceId: OCCURRENCE_ID
  })
}

describe('a tracer approach check on the neutral d20 settlement (RULES-2.T12b)', () => {
  it('freezes the approach rating as the modifier, in the tracer roll mode', () => {
    expect(freezeForceful().d20).toMatchObject({ rollMode: TRACER_ROLL_MODE, modifier: 3 })
  })

  it('settles through the tracer graph: one die plus the rating against the DC', async () => {
    const frozen = freezeForceful()
    const reached = await settle(frozen, [9])
    expect(reached.d20).toMatchObject({ total: 12, dc: DC, selectedNatural: 9 })
    expect(reached.reachesDc).toBe(true)
    const missed = await settle(frozen, [8])
    expect(missed.d20.total).toBe(11)
    expect(missed.reachesDc).toBe(false)
  })

  it('a check spends an aspect invoked on it, through the tracer event vocabulary', () => {
    const aspect = tracerActiveEffect({
      id: ASPECT_ID,
      holderActorId: ACTOR_ID,
      endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'INVOKED' }]
    })
    expect(freezeForceful([aspect]).consumedGrants).toEqual([aspect])
  })

  it('an aspect that ends only on stress or defeat survives the check', () => {
    const aspect = tracerActiveEffect({
      id: ASPECT_ID,
      holderActorId: ACTOR_ID,
      endTriggers: [
        { event: 'LIFECYCLE', timing: 'END', code: 'STRESSED' },
        { event: 'LIFECYCLE', timing: 'END', code: 'TAKEN_OUT' }
      ]
    })
    expect(freezeForceful([aspect]).consumedGrants).toEqual([])
  })

  it('refuses a D&D lifecycle code the tracer vocabulary does not have', () => {
    const aspect = tracerActiveEffect({
      id: ASPECT_ID,
      holderActorId: ACTOR_ID,
      endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }]
    })
    expect(() => freezeForceful([aspect])).toThrow(
      'The tracer event vocabulary has no lifecycle event "ON_ATTACK_ROLL".'
    )
  })
})
