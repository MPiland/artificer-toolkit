import { describe, expect, it } from 'vitest'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import {
  SRD_MEDICINE_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  encounterBasicActionCheckTrigger,
  evaluateEncounterBasicActionCheck,
  freezeEncounterActorCheck,
  startEncounterBasicActionCheck
} from '../encounterBasicActionCheck.js'
import { encounterBasicActionCheckLabel } from '../encounterMovementPassagePreparation.js'
import type { MovementTarget } from '../encounterMovementTargets.js'
import {
  SRD_SYSTEM_ID,
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
const HELP_EFFECT_ID = '00000000-0000-4000-8000-00000000c0c1'
const OCCURRENCE_ID = testUuid(900)
const CHECK = { checkKind: 'SKILL' as const, checkDefinitionId: SRD_MEDICINE_SKILL_ID }
const DC = 10
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

/** Freezes the First Aid helper's Wisdom (Medicine) check, as a check action does (D173). */
function freeze(actor: MovementTarget = srdCreatureTarget(helper)) {
  return freezeEncounterActorCheck({ gameSystemId: SRD_SYSTEM_ID, system, check: CHECK, actor })
}

/** The First Aid helper holding the Help grant an ally's Help action planned for it. */
function helpedHelper(): MovementTarget {
  return {
    ...srdCreatureTarget(helper),
    activeEffects: [helpEffect({ id: HELP_EFFECT_ID, holderActorId: helper.id })]
  }
}

async function settle(frozen: ReturnType<typeof freeze>, faces: number[]) {
  const runtime = createSrdRulesRuntime()
  const continuation = await startEncounterBasicActionCheck({
    runtime,
    gameSystemId: SRD_SYSTEM_ID,
    occurrenceId: OCCURRENCE_ID
  })
  return evaluateEncounterBasicActionCheck({
    gameSystemId: SRD_SYSTEM_ID,
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

describe('First Aid’s check, on the generic check flow (D173)', () => {
  it('names the check from the System: Wisdom (Medicine)', () => {
    expect(encounterBasicActionCheckLabel(system, SRD_MEDICINE_SKILL_ID)).toBe('Wisdom (Medicine)')
    expect(() => encounterBasicActionCheckLabel(system, testUuid(77))).toThrow()
  })

  it('freezes the helper’s Medicine total and names its trigger', () => {
    const frozen = freeze()
    expect(frozen.d20).toMatchObject({ rollMode: 'NORMAL', modifier: 3 })
    expect(frozen.consumedGrants).toEqual([])
    expect(
      encounterBasicActionCheckTrigger({
        actionLabel: 'First Aid',
        check: { label: encounterBasicActionCheckLabel(system, SRD_MEDICINE_SKILL_ID), dc: DC }
      })
    ).toEqual({
      kind: 'BASIC_ACTION_CHECK',
      actionLabel: 'First Aid',
      checkLabel: 'Wisdom (Medicine)',
      dc: 10
    })
  })

  it('refuses a custom helper and a helper with no Medicine total', () => {
    const custom = creatureActor({ id: testUuid(5), kind: 'CUSTOM', snapshot: {} })
    expect(() => freeze({ ...srdCreatureTarget(helper), actor: custom })).toThrow('custom actor')
    expect(() => freeze(srdCreatureTarget(helperActor(testUuid(6), {})))).toThrow('no total')
  })

  it('applies the Help grant the helper holds: advantage, and the grant is reported as used', () => {
    const helped = helpedHelper()
    const frozen = freeze(helped)
    expect(frozen.d20.rollMode).toBe('ADVANTAGE')
    expect(frozen.consumedGrants).toEqual(helped.activeEffects)
  })

  it('reaches the DC on a total of 10 and misses on 9', async () => {
    const frozen = freeze()
    const reached = await settle(frozen, [7])
    expect(reached.d20).toMatchObject({ total: 10, dc: 10, selectedNatural: 7 })
    expect(reached.reachesDc).toBe(true)
    const missed = await settle(frozen, [6])
    expect(missed.d20.total).toBe(9)
    expect(missed.reachesDc).toBe(false)
  })

  it('advantage keeps the higher of two entered dice', async () => {
    const rolled = await settle(freeze(helpedHelper()), [2, 9])
    expect(rolled.d20).toMatchObject({ selectedNatural: 9, total: 12, rollMode: 'ADVANTAGE' })
  })
})
