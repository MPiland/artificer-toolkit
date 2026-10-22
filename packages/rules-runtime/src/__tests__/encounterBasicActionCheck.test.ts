import { describe, expect, it } from 'vitest'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import {
  SRD_MEDICINE_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  completeEncounterBasicActionCheckResult,
  encounterBasicActionCheckPendingSnapshot,
  encounterBasicActionCheckTrigger,
  evaluateEncounterBasicActionCheck,
  prepareEncounterBasicActionCheck,
  startEncounterBasicActionCheck
} from '../encounterBasicActionCheck.js'
import { encounterBasicActionCheckLabel } from '../encounterMovementPassagePreparation.js'
import type { MovementTarget } from '../encounterMovementTargets.js'
import {
  SRD_SYSTEM_ID,
  characterActor,
  createSrdRulesRuntime,
  creatureActor,
  creatureRuleFacts,
  srdCreatureActor,
  srdCreatureTarget,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { helpEffect } from './antitoxinEffectFixture.js'
import { GOBLIN } from './encounterActiveEffectFixtures.js'

const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
const FIRST_AID_ID = '00000000-0000-4000-8000-000000000b09'
const HELP_EFFECT_ID = '00000000-0000-4000-8000-00000000c0c1'
const OCCURRENCE_ID = testUuid(900)
const COMMAND_ID = testUuid(901)
const CHECK = { checkKind: 'SKILL' as const, checkDefinitionId: SRD_MEDICINE_SKILL_ID, dc: 10 }
const DEFINITION = { id: FIRST_AID_ID, version: 1, checksum: 'a'.repeat(64), label: 'First Aid' }
const scores = {
  STRENGTH: 10,
  DEXTERITY: 10,
  CONSTITUTION: 10,
  INTELLIGENCE: 10,
  WISDOM: 14,
  CHARISMA: 10
}

/** A friendly SRD Goblin whose check totals are exactly the given ones. */
function helperActor(
  id: string,
  checkTotals: Record<string, number> = { [SRD_MEDICINE_SKILL_ID]: 3 }
) {
  const goblin = srdCreatureActor({ id, creature: GOBLIN, disposition: 'FRIENDLY' })
  if (
    typeof goblin.snapshot !== 'object' ||
    goblin.snapshot === null ||
    Array.isArray(goblin.snapshot)
  )
    throw new Error('The fixture Creature snapshot must be an object.')
  return {
    ...goblin,
    snapshot: {
      ...goblin.snapshot,
      ruleFacts: { ...creatureRuleFacts(scores), checkTotals }
    }
  }
}

const helper = helperActor(testUuid(1))
const ally = helperActor(testUuid(2))
const hero = characterActor({ id: testUuid(3), characterId: testUuid(4) })

/**
 * The Character target at a given hit point state. Its Character facts are platform data this
 * module never reads (only the actor's kind, source and death state), so a Creature's target
 * carries the Character actor.
 */
function heroTarget(state: MovementTarget['state']): MovementTarget {
  return { ...srdCreatureTarget(ally), actor: hero, state }
}

function dyingHero(): MovementTarget {
  return heroTarget({
    current: 0,
    temporary: 0,
    conditions: [],
    deathSaves: { successes: 1, failures: 2, stable: false }
  })
}

function prepare(overrides: Partial<Parameters<typeof prepareEncounterBasicActionCheck>[0]> = {}) {
  return prepareEncounterBasicActionCheck({
    gameSystemId: SRD_SYSTEM_ID,
    commandId: COMMAND_ID,
    commandFingerprint: 'b'.repeat(64),
    definition: DEFINITION,
    system,
    check: CHECK,
    checkLabel: encounterBasicActionCheckLabel(system, SRD_MEDICINE_SKILL_ID),
    helper: srdCreatureTarget(helper),
    target: dyingHero(),
    ...overrides
  })
}

/** The First Aid helper holding the Help grant an ally's Help action planned for it. */
function helpedHelper(): MovementTarget {
  return {
    ...srdCreatureTarget(helper),
    activeEffects: [helpEffect({ id: HELP_EFFECT_ID, holderActorId: helper.id })]
  }
}

async function settle(
  prepared: NonNullable<ReturnType<typeof prepare>>,
  faces: number[],
  targetStillDying = true
) {
  const runtime = createSrdRulesRuntime()
  const continuation = await startEncounterBasicActionCheck({
    runtime,
    gameSystemId: SRD_SYSTEM_ID,
    occurrenceId: OCCURRENCE_ID
  })
  const evaluated = await evaluateEncounterBasicActionCheck({
    gameSystemId: SRD_SYSTEM_ID,
    runtime,
    context: prepared.context,
    continuation,
    answer: {
      kind: 'ENTER_DICE',
      requestId: continuation.request.requestId,
      rawFaces: faces,
      rollMode: prepared.context.d20.rollMode
    },
    rollD20: () => {
      throw new Error('An entered roll never rolls.')
    },
    expectedOccurrenceId: OCCURRENCE_ID
  })
  return { runtime, continuation, evaluated, targetStillDying }
}

describe('First Aid check', () => {
  it('names the check from the System: Wisdom (Medicine)', () => {
    expect(encounterBasicActionCheckLabel(system, SRD_MEDICINE_SKILL_ID)).toBe('Wisdom (Medicine)')
    expect(() => encounterBasicActionCheckLabel(system, testUuid(77))).toThrow()
  })

  it('freezes the helper’s Medicine total and names its trigger', () => {
    const prepared = prepare()!
    expect(prepared.context).toMatchObject({
      helperActorId: helper.id,
      targetActorId: hero.id,
      targetCharacterId: hero.sourceId,
      check: {
        checkDefinitionId: CHECK.checkDefinitionId,
        dc: CHECK.dc,
        label: 'Wisdom (Medicine)'
      },
      d20: { rollMode: 'NORMAL', modifier: 3 }
    })
    expect(prepared.context.consumedGrants).toEqual([])
    expect(encounterBasicActionCheckTrigger(prepared.context)).toEqual({
      kind: 'BASIC_ACTION_CHECK',
      actionLabel: 'First Aid',
      checkLabel: 'Wisdom (Medicine)',
      dc: 10
    })
  })

  it('makes no check for a target that is not dying', () => {
    expect(
      prepare({
        target: heroTarget({ current: 4, temporary: 0, conditions: [], deathSaves: null })
      })
    ).toBeNull()
  })

  it('refuses a custom helper and a helper with no Medicine total', () => {
    const custom = creatureActor({ id: testUuid(5), kind: 'CUSTOM', snapshot: {} })
    expect(() => prepare({ helper: { ...srdCreatureTarget(helper), actor: custom } })).toThrow(
      'custom actor'
    )
    expect(() => prepare({ helper: srdCreatureTarget(helperActor(testUuid(6), {})) })).toThrow(
      'no total'
    )
  })

  it('makes no check for a Creature, which is defeated rather than dying', () => {
    expect(prepare({ target: srdCreatureTarget(ally) })).toBeNull()
  })

  it('applies the Help grant the helper holds: advantage, and the grant is reported as used', () => {
    const helped = helpedHelper()
    const prepared = prepare({ helper: helped })!
    expect(prepared.context.d20.rollMode).toBe('ADVANTAGE')
    expect(prepared.context.consumedGrants).toEqual(helped.activeEffects)
  })

  it('reaching the DC stabilizes and a miss changes nothing', async () => {
    const prepared = prepare()!
    const reached = await settle(prepared, [7])
    expect(reached.evaluated.d20).toMatchObject({ total: 10, dc: 10, selectedNatural: 7 })
    expect(reached.evaluated.reachesDc).toBe(true)
    const missed = await settle(prepared, [6])
    expect(missed.evaluated.d20.total).toBe(9)
    expect(missed.evaluated.reachesDc).toBe(false)
    const result = completeEncounterBasicActionCheckResult({
      context: prepared.context,
      continuation: missed.continuation,
      evaluated: missed.evaluated,
      targetStillDying: true,
      transition: null,
      occurrenceVersion: 2,
      initialFactsChecksum: 'c'.repeat(64)
    })
    expect(result.applicationOutputs).toMatchObject({ outcome: 'FAILED', targetTransition: null })
  })

  it('advantage keeps the higher of two entered dice', async () => {
    const prepared = prepare({ helper: helpedHelper() })!
    const rolled = await settle(prepared, [2, 9])
    expect(rolled.evaluated.d20).toMatchObject({
      selectedNatural: 9,
      total: 12,
      rollMode: 'ADVANTAGE'
    })
  })

  it('a target no longer dying at resolution is not stabilized', async () => {
    const prepared = prepare()!
    const rolled = await settle(prepared, [20])
    const result = completeEncounterBasicActionCheckResult({
      context: prepared.context,
      continuation: rolled.continuation,
      evaluated: rolled.evaluated,
      targetStillDying: false,
      transition: null,
      occurrenceVersion: 2,
      initialFactsChecksum: 'c'.repeat(64)
    })
    expect(result.applicationOutputs.outcome).toBe('NOT_DYING')
  })

  it('a prompted check waits on a kernel snapshot carrying its frozen context', async () => {
    const prepared = prepare()!
    const runtime = createSrdRulesRuntime()
    const continuation = await startEncounterBasicActionCheck({
      runtime,
      gameSystemId: SRD_SYSTEM_ID,
      occurrenceId: OCCURRENCE_ID
    })
    expect(
      encounterBasicActionCheckPendingSnapshot({
        continuation,
        context: prepared.context,
        optionalCombatSnapshotChecksum: 'd'.repeat(64)
      })
    ).toMatchObject({
      snapshotKind: 'KERNEL_EVIDENCE',
      optionalCombatSnapshotChecksum: 'd'.repeat(64),
      applicationContext: { kind: 'ENCOUNTER_BASIC_ACTION_CHECK', helperActorId: helper.id }
    })
  })
})
