import { describe, expect, it, vi } from 'vitest'

import { persistMovementSettlements } from '../movementSettlementPersistence.js'

/**
 * A retained contact's Concentration end (D95) must be settled by its own settlement step: a
 * planner that omits it must not be able to commit the movement.
 */

const OCCURRENCE_ID = '00000000-0000-4000-8000-000000000001'
const COMMAND_ID = '00000000-0000-4000-8000-000000000002'
const END_ID = '00000000-0000-4000-8000-000000000003'

type Input = Parameters<typeof persistMovementSettlements>[1]
type Callbacks = Parameters<typeof persistMovementSettlements>[2]

const end = {
  sourceCommandId: COMMAND_ID,
  result: {
    occurrenceId: END_ID,
    applicationOutputs: { cleanup: { characterOwnerTransitions: [] } }
  },
  ownerTransitions: []
}
const reaction = {
  option: { candidate: { pathDistance: 1 } },
  characterTransitions: [],
  concentrationEnd: end
}
const { concentrationEnd: _end, ...reactionEvidence } = reaction

function settle(settlements: unknown[], automationMode?: 'MANUAL') {
  const callbacks = {
    persistReaction: vi.fn(async () => [{ id: 'mover' }]),
    persistConcentrationEnd: vi.fn(async () => [{ id: 'mover' }]),
    endHolderGrants: vi.fn(async () => {})
  }
  const persisted = persistMovementSettlements(
    {} as Parameters<typeof persistMovementSettlements>[0],
    {
      state: { version: 1, automationMode },
      actors: [],
      authorizedCharacterIds: new Set<string>(),
      save: { commandId: COMMAND_ID },
      preparation: {
        occurrenceId: OCCURRENCE_ID,
        occurredAt: '2026-10-08T00:00:00.000Z',
        outcome: {
          kind: 'TERMINAL',
          result: { status: 'BATCH_COMPLETE', executions: [], reactionExecutions: [reaction] }
        }
      },
      settlements,
      userId: 'user'
    } as unknown as Input,
    callbacks as unknown as Callbacks
  )
  return { persisted, callbacks }
}

describe('persistMovementSettlements Concentration ends', () => {
  it('settles a retained end through its own step', async () => {
    const { persisted, callbacks } = settle([
      { kind: 'REACTION', execution: reactionEvidence },
      { kind: 'CONCENTRATION_END', execution: end }
    ])

    await expect(persisted).resolves.toMatchObject({ mechanicsChanged: true })
    expect(callbacks.persistConcentrationEnd).toHaveBeenCalledOnce()
  })

  it('refuses a settlement list that omits a retained end', async () => {
    const { persisted, callbacks } = settle([{ kind: 'REACTION', execution: reactionEvidence }])

    await expect(persisted).rejects.toThrow('Movement settlement is incomplete.')
    expect(callbacks.persistConcentrationEnd).not.toHaveBeenCalled()
  })
})

describe('persistMovementSettlements holder-state grant ends', () => {
  const settlements = [
    { kind: 'REACTION', execution: reactionEvidence },
    { kind: 'CONCENTRATION_END', execution: end }
  ]

  it('ends each settled actor state-bound grants once the pass has settled', async () => {
    const { persisted, callbacks } = settle(settlements)

    await persisted
    expect(callbacks.endHolderGrants).toHaveBeenCalledOnce()
    expect(callbacks.endHolderGrants).toHaveBeenCalledWith({
      state: { version: 1, automationMode: undefined },
      actor: { id: 'mover' },
      occurrenceId: OCCURRENCE_ID,
      userId: 'user'
    })
  })

  it('ends nothing in a MANUAL Run', async () => {
    const { persisted, callbacks } = settle(settlements, 'MANUAL')

    await persisted
    expect(callbacks.endHolderGrants).not.toHaveBeenCalled()
  })
})
