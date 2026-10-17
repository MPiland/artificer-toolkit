import { describe, expect, it, vi } from 'vitest'
import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import { turnCoordinatorRootDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'

import { prepareEncounterTurnDeathSave } from '../encounterTurnDeathSave.js'
import { createDnd5eDeathSaveDefinition } from '../systems/dnd5e/encounterLifecyclePolicy.js'
import {
  characterActor,
  createSrdRulesRuntime,
  creatureActor,
  srdEncounterState
} from '../testing/dnd5eSrdEncounter.js'

const ARIA_ID = '00000000-0000-4000-8000-00000000d001'
const ARIA_CHARACTER_ID = '00000000-0000-4000-8000-00000000d002'
const WOLF_ID = '00000000-0000-4000-8000-00000000d003'
const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000d004'
const USER_ID = '00000000-0000-4000-8000-00000000d005'

const aria = characterActor({ id: ARIA_ID, characterId: ARIA_CHARACTER_ID })
const wolf = creatureActor({ id: WOLF_ID, snapshot: {} })

function root(currentActorId: string | null) {
  return turnCoordinatorRootDtoSchema.parse({
    rootCommandId: '00000000-0000-4000-8000-00000000d010',
    commandFingerprint: 'c'.repeat(64),
    commandType: 'ADVANCE_TURN',
    initiatorUserId: USER_ID,
    requestedByUserId: USER_ID,
    correlationId: null,
    expectedEncounterVersion: 7,
    proposedTerminalTransition: { status: 'ACTIVE', round: 2, currentActorId }
  })
}

function prepare(input: {
  currentActorId: string | null
  automationMode?: AutomationModeDto
  rollD20?: () => number
  pending?: Parameters<typeof prepareEncounterTurnDeathSave>[0]['pending']
  rawDie?: number
}) {
  const actors = [aria, wolf]
  const loadTarget = vi.fn(async () => undefined)
  return {
    loadTarget,
    result: prepareEncounterTurnDeathSave({
      state: srdEncounterState({
        actors,
        currentActorId: WOLF_ID,
        ...(input.automationMode ? { automationMode: input.automationMode } : {})
      }),
      userId: USER_ID,
      root: root(input.currentActorId),
      occurrenceId: OCCURRENCE_ID,
      actors,
      movementTargets: new Map(),
      loadTarget,
      autoRoll: true,
      createRuntime: async () => createSrdRulesRuntime(),
      rollD20: input.rollD20 ?? (() => 20),
      ...(input.pending ? { pending: input.pending } : {}),
      ...(input.rawDie === undefined ? {} : { rawDie: input.rawDie })
    })
  }
}

describe('start-of-turn death save stage', () => {
  it('makes no save at a Creature’s turn start or at the end of combat', async () => {
    for (const currentActorId of [WOLF_ID, null]) {
      const rollD20 = vi.fn(() => 12)
      const { result, loadTarget } = prepare({ currentActorId, rollD20 })
      expect(await result).toEqual({ kind: 'COMPLETE', plan: null, target: null })
      expect(loadTarget).not.toHaveBeenCalled()
      expect(rollD20).not.toHaveBeenCalled()
    }
  })

  it('makes no save in a Manual Encounter', async () => {
    const rollD20 = vi.fn(() => 1)
    const { result, loadTarget } = prepare({
      currentActorId: ARIA_ID,
      automationMode: 'MANUAL',
      rollD20
    })
    expect(await result).toEqual({ kind: 'COMPLETE', plan: null, target: null })
    expect(loadTarget).not.toHaveBeenCalled()
    expect(rollD20).not.toHaveBeenCalled()
  })

  it('refuses a die entered without a pending request', async () => {
    await expect(prepare({ currentActorId: ARIA_ID, rawDie: 12 }).result).rejects.toThrow(
      'Death save evidence has no pending request.'
    )
  })
})

describe('death save graph', () => {
  async function start() {
    const published = createDnd5eDeathSaveDefinition()
    const runtime = createSrdRulesRuntime()
    const started = await runtime.executeResolved({
      command: { definitionId: published.id, occurrenceId: OCCURRENCE_ID, facts: {} },
      published
    })
    if (started.status !== 'PAUSED') throw new Error('The death save graph must ask for a d20.')
    return { runtime, continuation: started.continuation }
  }

  it('asks for one d20 from 1 to 20 and outputs the raw die', async () => {
    const { runtime, continuation } = await start()
    expect(continuation.request).toMatchObject({ kind: 'INTEGER_RANGE', min: 1, max: 20 })
    for (const die of [1, 9, 10, 20]) {
      const execution = await runtime.resume({
        continuation,
        response: { requestId: continuation.request.requestId, value: die }
      })
      expect(execution).toMatchObject({ status: 'COMPLETE', outputs: { rawDie: die } })
    }
  })

  it('refuses a die outside 1 to 20', async () => {
    const { runtime, continuation } = await start()
    for (const die of [0, 21]) {
      await expect(
        runtime.resume({
          continuation,
          response: { requestId: continuation.request.requestId, value: die }
        })
      ).rejects.toThrow()
    }
  })
})
