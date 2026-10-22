import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { serverRuleExecutionPendingApplicationContextDtoSchema } from '../shared/rulesExecution.js'

const ids = {
  action: '00000000-0000-4000-8000-000000000001',
  sourceActor: '00000000-0000-4000-8000-000000000002',
  targetActor: '00000000-0000-4000-8000-000000000003',
  sourceCharacter: '00000000-0000-4000-8000-000000000004',
  targetCharacter: '00000000-0000-4000-8000-000000000005',
  optionalDefinition: '00000000-0000-4000-8000-000000000006',
  graphDefinition: '00000000-0000-4000-8000-000000000007',
  heldItem: '00000000-0000-4000-8000-000000000008',
  check: '00000000-0000-4000-8000-000000000009',
  published: '00000000-0000-4000-8000-00000000000a',
  scene: '00000000-0000-4000-8000-00000000000b',
  targetToken: '00000000-0000-4000-8000-00000000000c'
} as const

const checksum = (character: string) => character.repeat(64)

function context() {
  const contributors: [] = []
  return {
    kind: 'ENCOUNTER_CONTEST_CHECK' as const,
    schemaVersion: 1 as const,
    origin: {
      kind: 'OPTIONAL_COMBAT' as const,
      actionKind: 'DISARM' as const,
      pin: {
        snapshotChecksum: checksum('a'),
        definitionId: ids.optionalDefinition,
        definitionVersion: 1,
        definitionChecksum: checksum('b'),
        moduleKey: 'd20.action.disarm',
        moduleContractVersion: 1
      },
      optionId: checksum('e'),
      selectionContractChecksum: checksum('f'),
      resolvedSelectionChecksum: checksum('0'),
      selection: {
        kind: 'DISARM' as const,
        heldItemId: ids.heldItem,
        defenderCheckDefinitionId: ids.check,
        heldItemStateChecksum: checksum('7')
      }
    },
    actionId: 'disarm',
    sourceActorId: ids.sourceActor,
    targetActorId: ids.targetActor,
    initiatorControllerCharacterId: ids.sourceCharacter,
    sceneContext: null,
    positionalDependencyChecksum: null,
    contestGraph: {
      definitionId: ids.graphDefinition,
      checksum: checksum('c'),
      identityChecksum: checksum('d')
    },
    source: {
      kind: 'CHARACTER_ACTION' as const,
      characterId: ids.sourceCharacter,
      streamVersion: 2,
      projectionChecksum: checksum('1'),
      mechanicalContextChecksum: checksum('2'),
      publishedDefinitionId: ids.published,
      publishedDefinitionChecksum: checksum('3')
    },
    target: {
      kind: 'CHARACTER' as const,
      characterId: ids.targetCharacter,
      streamVersion: 3,
      projectionChecksum: checksum('4'),
      mechanicalContextChecksum: checksum('5'),
      stateChecksum: checksum('6')
    },
    initiator: {
      actorId: ids.sourceActor,
      requestNodeId: 'initiator_d20',
      rollMode: 'NORMAL' as const,
      keep: 'FIRST' as const,
      contributors,
      contributorChecksum: checksumRuleDocument(contributors),
      modifier: 4
    },
    defender: {
      actorId: ids.targetActor,
      requestNodeId: 'target_d20',
      checks: [
        {
          checkDefinitionId: ids.check,
          label: 'Strength (Athletics)',
          rollMode: 'NORMAL' as const,
          keep: 'FIRST' as const,
          contributors,
          contributorChecksum: checksumRuleDocument(contributors),
          modifier: 2
        }
      ]
    },
    rollEvidence: { initiator: null, defender: null },
    actionEconomy: null
  }
}

describe('optional-combat contest pending context contract', () => {
  it('round-trips a sealed Disarm context', () => {
    const parsed = serverRuleExecutionPendingApplicationContextDtoSchema.parse(context())
    expect(parsed).toEqual(context())
  })

  it('rejects mismatched participants, selected check, contributor checksum, and unknown fields', () => {
    const valid = context()
    for (const invalid of [
      { ...valid, targetActorId: ids.sourceActor },
      {
        ...valid,
        defender: {
          ...valid.defender,
          checks: [{ ...valid.defender.checks[0]!, checkDefinitionId: ids.published }]
        }
      },
      { ...valid, initiator: { ...valid.initiator, contributorChecksum: checksum('8') } },
      { ...valid, extra: true }
    ]) {
      expect(serverRuleExecutionPendingApplicationContextDtoSchema.safeParse(invalid).success).toBe(
        false
      )
    }
  })

  it('round-trips the sealed Shove Aside destination and rejects mixed action selections', () => {
    const disarm = context()
    const shoveAside = {
      ...disarm,
      actionId: ids.optionalDefinition,
      source: {
        kind: 'OPTIONAL_COMBAT_DEFINITION' as const,
        definitionId: ids.optionalDefinition,
        definitionVersion: 1,
        definitionChecksum: checksum('b'),
        moduleKey: 'd20.action.shove-aside',
        moduleContractVersion: 1
      },
      origin: {
        ...disarm.origin,
        actionKind: 'SHOVE_ASIDE' as const,
        selection: {
          kind: 'SHOVE_ASIDE' as const,
          defenderCheckDefinitionId: ids.check,
          destination: { x: 15, y: 20 },
          displacement: { amount: 5 as const, unit: 'FEET' as const, sceneUnits: 5 },
          sceneId: ids.scene,
          sceneVersion: 4,
          targetTokenId: ids.targetToken,
          stateChecksum: checksum('9')
        }
      }
    }

    expect(serverRuleExecutionPendingApplicationContextDtoSchema.parse(shoveAside)).toEqual(
      shoveAside
    )
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse({
        ...shoveAside,
        origin: { ...shoveAside.origin, selection: disarm.origin.selection }
      }).success
    ).toBe(false)
  })
})
