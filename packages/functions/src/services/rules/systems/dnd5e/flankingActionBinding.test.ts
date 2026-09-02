import { checksumCanonicalJson } from '@artificer-toolkit/db'
import {
  DND5E_FLANKING_DEFINITION_ID,
  DND5E_FLANKING_OPERATION_KEY,
  DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { describe, expect, it } from 'vitest'

import type { CharacterActionCapabilityDescriptor } from '../../characterActionCapabilityDiscovery.js'
import type { CharacterRuleActionPositionalFacts } from '../../characterRuleActionSystemAdapter.js'
import {
  compileDnd5eEffectAction,
  dnd5eCharacterRuleActionSystemAdapter
} from './effectActionCompiler.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'

const ids = {
  attackerActor: '00000000-0000-4000-8000-000000000101',
  attackerToken: '00000000-0000-4000-8000-000000000111',
  allyActor: '00000000-0000-4000-8000-000000000102',
  allyToken: '00000000-0000-4000-8000-000000000112',
  source: '00000000-0000-4000-8000-000000000104',
  targetActor: '00000000-0000-4000-8000-000000000105',
  targetToken: '00000000-0000-4000-8000-000000000115'
}

const grid = {
  kind: 'SQUARE' as const,
  cellSize: 100,
  diagonalPolicy: 'EQUAL' as const,
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET' as const
} satisfies SceneGrid

function flankingSnapshot(
  input: { capabilityDefinitionId?: string } = {}
): EncounterOptionalCombatSnapshotDto {
  const document = {
    schemaVersion: 1 as const,
    kind: 'FLANKING' as const,
    id: DND5E_FLANKING_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    module: { policyModuleKey: DND5E_FLANKING_OPERATION_KEY, contractVersion: 1 },
    parameters: {
      kind: 'FLANKING' as const,
      participantCapabilityDefinitionId:
        input.capabilityDefinitionId ?? DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID
    },
    mutuallyExclusiveGroup: null
  }
  return {
    schemaVersion: 1,
    gameSystemId: DND5E_SYSTEM_ID,
    definitions: [
      {
        definitionId: document.id,
        contentSourceId: ids.source,
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(document),
        contractVersion: 1,
        label: 'Flanking',
        document
      }
    ]
  }
}

function capabilityState(input: { available?: boolean; definitionId?: string } = {}) {
  const document = {
    schemaVersion: 1 as const,
    kind: 'RULE_CAPABILITY' as const,
    id: input.definitionId ?? DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    usage: null
  }
  const capability = {
    capabilityDefinitionId: document.id,
    definitionVersion: 1,
    definitionContractVersion: 1,
    definitionChecksum: checksumRuleDocument(document),
    document
  }
  const availability = {
    capability,
    available: input.available ?? true,
    contributionIds: [],
    suppressingConditionDefinitionIds: [],
    suppressingActiveEffectIds: []
  }
  return {
    schemaVersion: 1 as const,
    gameSystemId: DND5E_SYSTEM_ID,
    conditionDefinitions: [],
    capabilities: [availability],
    checksum: checksumRuleDocument({ availability, gameSystemId: DND5E_SYSTEM_ID })
  }
}

function positionalFacts(
  input: {
    automationMode?: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
    available?: boolean
    canSeeTarget?: boolean
    capabilityDefinitionId?: string
    snapshotChecksum?: string | null
  } = {}
): CharacterRuleActionPositionalFacts {
  const snapshot = flankingSnapshot({ capabilityDefinitionId: input.capabilityDefinitionId })
  const sourceCapabilityState = capabilityState({
    available: input.available,
    definitionId: input.capabilityDefinitionId
  })
  const candidateCapabilityState = capabilityState({
    available: input.available,
    definitionId: input.capabilityDefinitionId
  })
  return {
    automationMode: input.automationMode ?? 'ASSISTED',
    candidates: [
      {
        actorId: ids.allyActor,
        capabilityState: candidateCapabilityState,
        capabilityStateChecksum: candidateCapabilityState.checksum,
        canSeeTarget: input.canSeeTarget ?? true,
        perceptionChecksum: 'b'.repeat(64),
        sourceRelationship: 'ALLIED',
        targetRelationship: 'HOSTILE',
        token: {
          actorId: ids.allyActor,
          height: 100,
          position: { x: 250, y: 150 },
          rotationDegrees: 0,
          tokenId: ids.allyToken,
          width: 100
        }
      }
    ],
    dependencyChecksum: 'c'.repeat(64),
    optionalCombatSnapshot: snapshot,
    optionalCombatSnapshotChecksum:
      input.snapshotChecksum === undefined
        ? checksumCanonicalJson(snapshot)
        : input.snapshotChecksum,
    sourceCapabilityState,
    sourceCapabilityStateChecksum: sourceCapabilityState.checksum,
    sourceCanSeeTarget: input.canSeeTarget ?? true,
    sourcePerceptionChecksum: 'd'.repeat(64),
    sourceTargetRelationship: 'HOSTILE',
    targetCapabilityState: capabilityState(),
    targetCapabilityStateChecksum: 'e'.repeat(64)
  }
}

function action(): CharacterActionCapabilityDescriptor {
  return {
    kind: 'CHARACTER_ACTION',
    gameSystemId: DND5E_SYSTEM_ID,
    authoredRootKind: 'effect',
    entryPointDefinitionId: ids.source,
    effectId: ids.source,
    actionId: `source:ACTION:${ids.source}`,
    sourceId: ids.source,
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: ids.source,
      sourceInstanceId: ids.source
    },
    mechanicsOwner: { kind: 'FEATURE', id: ids.source },
    activationSourceKind: 'ACTIVE_SOURCE',
    mechanicFacts: {
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { rangeKind: RANGE_KIND.UNLIMITED, amount: null, unit: null },
        reactionMovementTrigger: null,
        savingThrow: null
      },
      outcomes: []
    },
    compiledEffect: compileEffect({
      id: ids.source,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: 'hit',
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'damage',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'damage',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: ids.source,
                valueKind: 'FIXED',
                scalingKind: 'NONE',
                amount: 1
              }
            ]
          }
        }
      ]
    })
  }
}

function bind(input: {
  attackKind?: 'MELEE' | 'RANGED'
  positionalFacts?: CharacterRuleActionPositionalFacts | null
  sceneContext?: 'PRESENT' | 'ABSENT'
  contributors?: readonly {
    sourceId: string
    grantId: string
    domainKey: string
    influence: 'ADVANTAGE' | 'DISADVANTAGE'
  }[]
}) {
  const candidate = action()
  return dnd5eCharacterRuleActionSystemAdapter.bindFacts({
    actionMechanic: {
      attackBonus: 5,
      attackKind: input.attackKind ?? 'MELEE',
      attackRollMode: 'NORMAL'
    },
    published: compileDnd5eEffectAction({ action: candidate }),
    sourceDerivedFacts: {
      rollContributorEvidence: { attacks: { MELEE: input.contributors ?? [] } }
    },
    targetActorId: ids.targetActor,
    targetDerivedFacts: { derivedStats: { armorClass: { effective: 15 } } },
    targetConditionIds: [],
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    targetScalarValues: {},
    defenses: [],
    sceneContext:
      input.sceneContext === 'ABSENT'
        ? null
        : {
            sceneId: ids.source,
            sceneVersion: 1,
            sourceToken: {
              actorId: ids.attackerActor,
              height: 100,
              position: { x: 50, y: 150 },
              rotationDegrees: 0,
              tokenId: ids.attackerToken,
              width: 100
            },
            targetToken: {
              actorId: ids.targetActor,
              height: 100,
              position: { x: 150, y: 150 },
              rotationDegrees: 0,
              tokenId: ids.targetToken,
              width: 100
            },
            grid
          },
    positionalFacts: input.positionalFacts
  })
}

describe('D&D flanking action binding', () => {
  it('adds the canonical flanking contributor and cancels it with an existing disadvantage', () => {
    const bound = bind({
      positionalFacts: positionalFacts(),
      contributors: [
        {
          sourceId: 'condition-source',
          grantId: 'condition-grant',
          domainKey: 'attack-disadvantage',
          influence: 'DISADVANTAGE'
        }
      ]
    })

    expect(bound.d20RollMode).toBe('NORMAL')
    expect(bound.d20Audit?.contributors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: DND5E_FLANKING_DEFINITION_ID,
          grantId: null,
          domainKey: DND5E_FLANKING_OPERATION_KEY,
          influence: 'ADVANTAGE'
        }),
        expect.objectContaining({ influence: 'DISADVANTAGE' })
      ])
    )
    expect(bound.d20Audit?.contributorChecksum).toBe(
      checksumRuleDocument(bound.d20Audit?.contributors)
    )
  })

  it.each([
    ['manual automation', { automationMode: 'MANUAL' as const }],
    ['suppressed positional support', { available: false }],
    ['missing perception', { canSeeTarget: false }],
    ['stale optional policy pin', { snapshotChecksum: 'a'.repeat(64) }]
  ])('fails closed without a flanking contributor for %s', (_label, facts) => {
    const bound = bind({ positionalFacts: positionalFacts(facts) })

    expect(bound.d20RollMode).toBe('NORMAL')
    expect(bound.d20Audit?.contributors).not.toContainEqual(
      expect.objectContaining({ sourceId: DND5E_FLANKING_DEFINITION_ID })
    )
  })

  it('does not use flanking for a non-melee action or absent Scene facts', () => {
    const ranged = bind({ attackKind: 'RANGED', positionalFacts: positionalFacts() })
    const noSceneFacts = bind({ positionalFacts: positionalFacts(), sceneContext: 'ABSENT' })

    expect(ranged.d20Audit?.contributors).toEqual([])
    expect(noSceneFacts.d20Audit?.contributors).toEqual([])
  })

  it('requests and binds the exact frozen definition-selected capability identity', () => {
    const alternateCapabilityDefinitionId = '00000000-0000-4000-8000-0000000001d5'
    const facts = positionalFacts({ capabilityDefinitionId: alternateCapabilityDefinitionId })
    const requested = dnd5eCharacterRuleActionSystemAdapter.positionalCapabilityDefinitionIds?.({
      automationMode: facts.automationMode,
      optionalCombatSnapshot: facts.optionalCombatSnapshot,
      optionalCombatSnapshotChecksum: facts.optionalCombatSnapshotChecksum
    })

    expect(requested).toEqual([alternateCapabilityDefinitionId])
    expect(bind({ positionalFacts: facts }).d20Audit?.contributors).toContainEqual(
      expect.objectContaining({
        sourceId: DND5E_FLANKING_DEFINITION_ID,
        influence: 'ADVANTAGE'
      })
    )
  })

  it('requests no capability for a stale frozen flanking definition', () => {
    const facts = positionalFacts()

    expect(
      dnd5eCharacterRuleActionSystemAdapter.positionalCapabilityDefinitionIds?.({
        automationMode: facts.automationMode,
        optionalCombatSnapshot: facts.optionalCombatSnapshot,
        optionalCombatSnapshotChecksum: 'a'.repeat(64)
      })
    ).toEqual([])
  })
})
