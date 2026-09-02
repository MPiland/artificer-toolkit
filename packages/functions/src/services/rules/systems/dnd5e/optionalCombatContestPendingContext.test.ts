import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { ServerOptionalCombatContestPendingApplicationContextDto } from '@artificer-toolkit/schema/shared/rulesExecution'

import {
  isDnd5eOptionalCombatContestPendingContextCurrent,
  prepareDnd5eOptionalCombatContestPendingContext,
  requireDnd5eOptionalCombatContestRequestParticipant
} from './optionalCombatContestPendingContext.js'

const ids = {
  sourceActor: '00000000-0000-4000-8000-000000000001',
  targetActor: '00000000-0000-4000-8000-000000000002',
  sourceCharacter: '00000000-0000-4000-8000-000000000003',
  targetCharacter: '00000000-0000-4000-8000-000000000004',
  definition: '00000000-0000-4000-8000-000000000005',
  graph: '00000000-0000-4000-8000-000000000006',
  heldItem: '00000000-0000-4000-8000-000000000007',
  check: '00000000-0000-4000-8000-000000000008',
  published: '00000000-0000-4000-8000-000000000009'
} as const

const checksum = (character: string) => character.repeat(64)
type Prepared = Omit<
  ServerOptionalCombatContestPendingApplicationContextDto,
  'kind' | 'schemaVersion'
>

function prepared(): Prepared {
  const contributors: [] = []
  return {
    actionKind: 'DISARM',
    actionId: 'disarm',
    sourceActorId: ids.sourceActor,
    targetActorId: ids.targetActor,
    initiatorControllerCharacterId: ids.sourceCharacter,
    sceneContext: null,
    positionalDependencyChecksum: null,
    optionalCombat: {
      snapshotChecksum: checksum('a'),
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
    optionId: checksum('e'),
    selectionContractChecksum: checksum('f'),
    resolvedSelectionChecksum: checksum('0'),
    source: {
      kind: 'CHARACTER_ACTION',
      characterId: ids.sourceCharacter,
      streamVersion: 1,
      projectionChecksum: checksum('1'),
      mechanicalContextChecksum: checksum('2'),
      publishedDefinitionId: ids.published,
      publishedDefinitionChecksum: checksum('3')
    },
    target: {
      kind: 'CHARACTER',
      characterId: ids.targetCharacter,
      streamVersion: 1,
      projectionChecksum: checksum('4'),
      mechanicalContextChecksum: checksum('5'),
      stateChecksum: checksum('6')
    },
    initiator: {
      actorId: ids.sourceActor,
      requestNodeId: 'initiator_d20',
      rollMode: 'NORMAL',
      contributors,
      contributorChecksum: checksumRuleDocument(contributors),
      modifier: 4
    },
    defender: {
      actorId: ids.targetActor,
      requestNodeId: 'target_d20',
      rollMode: 'NORMAL',
      contributors,
      contributorChecksum: checksumRuleDocument(contributors),
      modifier: 2,
      checkDefinitionId: ids.check
    },
    rollEvidence: { initiator: null, defender: null },
    selection: {
      kind: 'DISARM',
      heldItemId: ids.heldItem,
      defenderCheckDefinitionId: ids.check,
      heldItemStateChecksum: checksum('7')
    },
    actionEconomy: null
  }
}

describe('D&D optional-combat contest pending context', () => {
  it('creates deterministic sealed contexts and detects changed locked currentness', () => {
    const locked = prepared()
    if (locked.selection.kind !== 'DISARM') throw new Error('Expected a Disarm fixture.')
    const first = prepareDnd5eOptionalCombatContestPendingContext(locked)
    const second = prepareDnd5eOptionalCombatContestPendingContext(locked)
    expect(first).toEqual(second)
    expect(checksumRuleDocument(first)).toBe(checksumRuleDocument(second))
    expect(
      isDnd5eOptionalCombatContestPendingContextCurrent({ pending: first, current: locked })
    ).toBe(true)
    expect(
      isDnd5eOptionalCombatContestPendingContextCurrent({
        pending: first,
        current: {
          ...locked,
          selection: { ...locked.selection, heldItemStateChecksum: checksum('8') }
        }
      })
    ).toBe(false)
    const changedSource = prepared()
    if (changedSource.source.kind !== 'CHARACTER_ACTION')
      throw new Error('Expected a Character action source fixture.')
    changedSource.source = { ...changedSource.source, streamVersion: 2 }
    expect(
      isDnd5eOptionalCombatContestPendingContextCurrent({ pending: first, current: changedSource })
    ).toBe(false)
  })

  it('assigns only the sealed contest d20 nodes to participants', () => {
    const pending = prepareDnd5eOptionalCombatContestPendingContext(prepared())
    expect(
      requireDnd5eOptionalCombatContestRequestParticipant({
        pending,
        requestNodeId: 'initiator_d20'
      })
    ).toBe('INITIATOR')
    expect(
      requireDnd5eOptionalCombatContestRequestParticipant({ pending, requestNodeId: 'target_d20' })
    ).toBe('DEFENDER')
    expect(() =>
      requireDnd5eOptionalCombatContestRequestParticipant({ pending, requestNodeId: 'other_d20' })
    ).toThrow('unsupported evidence node')
  })
})
