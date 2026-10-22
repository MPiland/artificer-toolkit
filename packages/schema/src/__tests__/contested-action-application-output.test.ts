import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { serverRuleExecutionApplicationOutputsDtoSchema } from '../shared/rulesExecution.js'

const ids = {
  occurrence: '00000000-0000-4000-8000-000000000001',
  sourceActor: '00000000-0000-4000-8000-000000000002',
  targetActor: '00000000-0000-4000-8000-000000000003',
  character: '00000000-0000-4000-8000-000000000004',
  item: '00000000-0000-4000-8000-000000000005',
  definition: '00000000-0000-4000-8000-000000000006',
  graph: '00000000-0000-4000-8000-000000000007',
  loadout: '00000000-0000-4000-8000-000000000008',
  condition: '00000000-0000-4000-8000-000000000009',
  effect: '00000000-0000-4000-8000-00000000000a'
} as const
const checksum = (character: string) => character.repeat(64)

function roll(actorId: string, requestNodeId: 'initiator_d20' | 'target_d20', selected: number) {
  const contributors: [] = []
  return {
    actorId,
    requestNodeId,
    rollMode: 'NORMAL' as const,
    keep: 'FIRST' as const,
    rawFaces: [selected],
    selectedNatural: selected,
    contributors,
    contributorChecksum: checksumRuleDocument(contributors),
    modifier: 2,
    total: selected + 2
  }
}

function receipt() {
  return {
    kind: 'CONTESTED_ACTION' as const,
    schemaVersion: 1 as const,
    occurrenceId: ids.occurrence,
    sourceActorId: ids.sourceActor,
    targetActorId: ids.targetActor,
    sealedContextChecksum: checksum('a'),
    policy: {
      definitionId: ids.definition,
      definitionVersion: 1,
      definitionChecksum: checksum('b'),
      moduleKey: 'd20.action.disarm',
      moduleContractVersion: 1
    },
    contestGraph: {
      definitionId: ids.graph,
      checksum: checksum('c'),
      identityChecksum: checksum('d')
    },
    sourceRoll: roll(ids.sourceActor, 'initiator_d20', 15),
    targetRoll: roll(ids.targetActor, 'target_d20', 10),
    outcome: 'SOURCE_WIN' as const,
    stateTransition: {
      kind: 'CHARACTER_ITEM_USE_STATE' as const,
      characterId: ids.character,
      itemInstanceId: ids.item,
      fromState: 'EQUIPPED' as const,
      toState: 'CARRIED' as const,
      beforeStreamVersion: 4,
      afterStreamVersion: 5,
      beforeStateChecksum: checksum('e'),
      afterStateChecksum: checksum('f')
    },
    actionEconomyTransition: {
      definitionId: ids.definition,
      definitionVersion: 1,
      definitionChecksum: checksum('0'),
      maximum: 1,
      beforeUsed: 0,
      afterUsed: 1
    },
    sourceApplications: []
  }
}

describe('contested-action application output', () => {
  it('accepts Character and Encounter-actor wins plus target win or tie with no transition', () => {
    expect(serverRuleExecutionApplicationOutputsDtoSchema.parse(receipt()).kind).toBe(
      'CONTESTED_ACTION'
    )
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...receipt(),
        stateTransition: {
          kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
          actorId: ids.targetActor,
          loadoutEntryId: ids.loadout,
          equipmentId: ids.item,
          fromState: 'OFF_HAND',
          toState: 'CARRIED',
          beforeStateChecksum: checksum('e'),
          afterStateChecksum: checksum('f')
        }
      }).kind
    ).toBe('CONTESTED_ACTION')
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...receipt(),
        sourceRoll: roll(ids.sourceActor, 'initiator_d20', 10),
        targetRoll: roll(ids.targetActor, 'target_d20', 10),
        outcome: 'TARGET_WIN_OR_TIE',
        stateTransition: { kind: 'NONE' },
        actionEconomyTransition: null
      }).kind
    ).toBe('CONTESTED_ACTION')
  })

  it('rejects invalid roll bindings, totals, checksums, outcomes, and transitions', () => {
    const valid = receipt()
    const invalid = [
      { ...valid, sourceRoll: { ...valid.sourceRoll, actorId: ids.targetActor } },
      {
        ...valid,
        targetRoll: { ...valid.targetRoll, requestNodeId: valid.sourceRoll.requestNodeId }
      },
      { ...valid, sourceRoll: { ...valid.sourceRoll, rawFaces: [15, 12] } },
      { ...valid, sourceRoll: { ...valid.sourceRoll, total: 99 } },
      { ...valid, sourceRoll: { ...valid.sourceRoll, contributorChecksum: checksum('9') } },
      { ...valid, outcome: 'TARGET_WIN_OR_TIE', stateTransition: { kind: 'NONE' } },
      { ...valid, stateTransition: { kind: 'NONE' } },
      {
        ...valid,
        sourceRoll: roll(ids.sourceActor, 'initiator_d20', 10),
        targetRoll: roll(ids.targetActor, 'target_d20', 10),
        outcome: 'TARGET_WIN_OR_TIE',
        stateTransition: valid.stateTransition
      },
      {
        ...valid,
        stateTransition: { ...valid.stateTransition, afterStreamVersion: 4 }
      },
      {
        ...valid,
        actionEconomyTransition: { ...valid.actionEconomyTransition, afterUsed: 2 }
      }
    ]
    for (const value of invalid)
      expect(serverRuleExecutionApplicationOutputsDtoSchema.safeParse(value).success).toBe(false)
  })

  describe('a won contest’s outcome on its target (D173)', () => {
    const pushed = {
      kind: 'TARGET_OUTCOME' as const,
      mechanics: null,
      forcedMovements: [{ direction: 'AWAY_FROM_SOURCE' as const, feet: 5, upTo: false }]
    }

    it('accepts one generic transition and refuses one that settles nothing', () => {
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.parse({
          ...receipt(),
          policy: null,
          stateTransition: pushed
        })
      ).toMatchObject({ stateTransition: pushed })
      const empty = serverRuleExecutionApplicationOutputsDtoSchema.safeParse({
        ...receipt(),
        policy: null,
        stateTransition: { ...pushed, forcedMovements: [] }
      })
      expect(empty.error?.issues.map(({ message }) => message)).toContain(
        'A contest outcome settles mechanics or a forced movement on its target.'
      )
    })

    it.each([
      ['CONDITIONS_APPLIED', { appliedConditionIds: [ids.condition] }],
      ['FORCED_MOVEMENT', { direction: 'AWAY_FROM_SOURCE', feet: 5, upTo: false }]
    ])(
      'fails a stored receipt of the removed %s kind closed, with a named schema error',
      (kind, fields) => {
        const stored = { ...receipt(), policy: null, stateTransition: { kind, ...fields } }
        expect(() => serverRuleExecutionApplicationOutputsDtoSchema.parse(stored)).toThrow(
          expect.objectContaining({ name: '$ZodError' })
        )
        const { error } = serverRuleExecutionApplicationOutputsDtoSchema.safeParse(stored)
        expect(error?.issues).toContainEqual(
          expect.objectContaining({
            code: 'invalid_union',
            note: 'No matching discriminator',
            path: ['stateTransition', 'kind']
          })
        )
      }
    )
  })

  describe('conditions the initiator’s ended effects released (SPELLS-27.T2b)', () => {
    const release = (ordinal: number) => ({
      ordinal,
      kind: 'CONDITION_REMOVE' as const,
      conditionId: ids.condition,
      sourceActiveEffectId: ids.effect,
      beforePresent: true,
      afterPresent: false,
      applied: true,
      sourceNodeId: 'effect-node',
      sourceOperationKey: 'active-effect.ended',
      authoredPath: null,
      resolvedPath: null
    })

    it('requires the field, empty when nothing was released', () => {
      const { sourceApplications: _omitted, ...missing } = receipt()
      expect(serverRuleExecutionApplicationOutputsDtoSchema.safeParse(missing).success).toBe(false)
    })

    it('accepts contiguous condition releases and rejects any other application', () => {
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.parse({
          ...receipt(),
          sourceApplications: [release(0)]
        })
      ).toMatchObject({ sourceApplications: [{ kind: 'CONDITION_REMOVE', applied: true }] })
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.safeParse({
          ...receipt(),
          sourceApplications: [release(1)]
        }).success
      ).toBe(false)
    })
  })
})
