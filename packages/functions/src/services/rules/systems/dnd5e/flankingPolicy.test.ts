import { checksumCanonicalJson } from '@artificer-toolkit/db'
import {
  DND5E_FLANKING_DEFINITION_ID,
  DND5E_FLANKING_OPERATION_KEY,
  DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { SceneGrid, SceneToken } from '@artificer-toolkit/shared/vtt'
import { describe, expect, it } from 'vitest'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eRulesRuntimeRegistration } from './characterActionRuntime.js'
import {
  DND5E_FLANKING_POLICY_MODULE,
  resolveDnd5eFlankingContributor,
  type Dnd5eFlankingCandidate
} from './flankingPolicy.js'

const ids = {
  attackerActor: '00000000-0000-4000-8000-000000000101',
  attackerToken: '00000000-0000-4000-8000-000000000111',
  allyActor: '00000000-0000-4000-8000-000000000102',
  allyToken: '00000000-0000-4000-8000-000000000112',
  allyTwoActor: '00000000-0000-4000-8000-000000000103',
  allyTwoToken: '00000000-0000-4000-8000-000000000113',
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

function token(input: {
  actorId?: string
  id: string
  x: number
  y: number
  width?: number
  height?: number
}) {
  return {
    id: input.id,
    position: { x: input.x, y: input.y },
    width: input.width ?? 100,
    height: input.height ?? 100
  } satisfies Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>
}

function capability(input: { available?: boolean; definitionId?: string; systemId?: string } = {}) {
  const document = {
    schemaVersion: 1 as const,
    kind: 'RULE_CAPABILITY' as const,
    id: input.definitionId ?? DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID,
    gameSystemId: input.systemId ?? DND5E_SYSTEM_ID,
    usage: null
  }
  const availability = {
    capability: {
      capabilityDefinitionId: document.id,
      definitionVersion: 1,
      definitionContractVersion: 1,
      definitionChecksum: checksumRuleDocument(document),
      document
    },
    available: input.available ?? true,
    suppressingConditionDefinitionIds: [],
    suppressingActiveEffectIds: [],
    contributionIds: []
  }
  return { availability, availabilityChecksum: checksumRuleDocument(availability) }
}

function snapshot(input: { moduleKey?: string; systemId?: string } = {}) {
  const document = {
    schemaVersion: 1 as const,
    kind: 'FLANKING' as const,
    id: DND5E_FLANKING_DEFINITION_ID,
    gameSystemId: input.systemId ?? DND5E_SYSTEM_ID,
    module: {
      policyModuleKey: input.moduleKey ?? DND5E_FLANKING_OPERATION_KEY,
      contractVersion: 1
    },
    parameters: {
      kind: 'FLANKING' as const,
      participantCapabilityDefinitionId: DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID
    },
    mutuallyExclusiveGroup: null
  }
  return {
    schemaVersion: 1 as const,
    gameSystemId: input.systemId ?? DND5E_SYSTEM_ID,
    definitions: [
      {
        definitionId: document.id,
        contentSourceId: ids.source,
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(document),
        contractVersion: 1,
        label: 'This label cannot select flanking mechanics',
        document
      }
    ]
  } satisfies EncounterOptionalCombatSnapshotDto
}

function baseInput() {
  const optionalCombatSnapshot = snapshot()
  return {
    attackClassification: 'MELEE' as const,
    automationMode: 'ASSISTED' as const,
    gameSystemId: DND5E_SYSTEM_ID,
    grid,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    attacker: {
      actorId: ids.attackerActor,
      token: token({ id: ids.attackerToken, x: 50, y: 150 }),
      canSeeTarget: true,
      targetRelationship: 'HOSTILE' as const,
      participantCapability: capability()
    },
    target: {
      actorId: ids.targetActor,
      token: token({ id: ids.targetToken, x: 150, y: 150 })
    },
    alliedCandidates: [
      {
        actorId: ids.allyActor,
        token: token({ actorId: ids.allyActor, id: ids.allyToken, x: 250, y: 150 }),
        attackerRelationship: 'ALLIED' as const,
        targetRelationship: 'HOSTILE' as const,
        canSeeTarget: true,
        participantCapability: capability()
      }
    ] satisfies readonly Dnd5eFlankingCandidate[]
  }
}

describe('D&D flanking optional-combat policy', () => {
  it('registers the exact policy module without declaring a runtime graph operation', () => {
    expect(DND5E_FLANKING_POLICY_MODULE).toEqual({
      key: DND5E_FLANKING_OPERATION_KEY,
      contractVersion: 1
    })
    expect(dnd5eRulesRuntimeRegistration.policyModules).toContainEqual(DND5E_FLANKING_POLICY_MODULE)
    expect(dnd5eRulesRuntimeRegistration.operations).not.toContainEqual(
      expect.objectContaining({ key: DND5E_FLANKING_OPERATION_KEY })
    )
  })

  it('emits canonical advantage identity and geometry evidence for exact side opposition', () => {
    const resolved = resolveDnd5eFlankingContributor(baseInput())

    expect(resolved.contributor).toMatchObject({
      sourceId: DND5E_FLANKING_DEFINITION_ID,
      grantId: null,
      domainKey: DND5E_FLANKING_OPERATION_KEY,
      influence: 'ADVANTAGE',
      geometry: {
        attackerSector: 'WEST',
        alliedSector: 'EAST',
        alliedActorId: ids.allyActor,
        targetActorId: ids.targetActor,
        participantCapabilityDefinitionId: DND5E_FLANKING_PARTICIPANT_CAPABILITY_DEFINITION_ID
      }
    })
  })

  it('accepts opposite corner placement and exact large-footprint occupied cells', () => {
    const originalCorner = baseInput()
    const corner = {
      ...originalCorner,
      attacker: {
        ...originalCorner.attacker,
        token: token({ actorId: ids.attackerActor, id: ids.attackerToken, x: 50, y: 50 })
      },
      alliedCandidates: [
        {
          ...originalCorner.alliedCandidates[0]!,
          token: token({ actorId: ids.allyActor, id: ids.allyToken, x: 250, y: 250 })
        }
      ]
    }
    expect(resolveDnd5eFlankingContributor(corner).contributor?.geometry).toMatchObject({
      attackerSector: 'NORTH_WEST',
      alliedSector: 'SOUTH_EAST'
    })

    const originalLarge = baseInput()
    const large = {
      ...originalLarge,
      target: {
        ...originalLarge.target,
        token: token({
          actorId: ids.targetActor,
          id: ids.targetToken,
          x: 200,
          y: 200,
          width: 200,
          height: 200
        })
      },
      attacker: {
        ...originalLarge.attacker,
        token: token({ actorId: ids.attackerActor, id: ids.attackerToken, x: 50, y: 150 })
      },
      alliedCandidates: [
        {
          ...originalLarge.alliedCandidates[0]!,
          token: token({ actorId: ids.allyActor, id: ids.allyToken, x: 350, y: 250 })
        }
      ]
    }
    expect(resolveDnd5eFlankingContributor(large).contributor).not.toBeNull()
  })

  it('does not substitute reach for adjacency or award non-melee attacks', () => {
    const originalDistant = baseInput()
    const distant = {
      ...originalDistant,
      attacker: {
        ...originalDistant.attacker,
        token: token({ actorId: ids.attackerActor, id: ids.attackerToken, x: -50, y: 150 })
      }
    }
    expect(resolveDnd5eFlankingContributor(distant).contributor).toBeNull()
    expect(
      resolveDnd5eFlankingContributor({ ...baseInput(), attackClassification: 'OTHER' }).contributor
    ).toBeNull()
  })

  it('fails closed for unavailable/suppressed participants, sight failures, and wrong relationships', () => {
    const unavailableAttackerSource = baseInput()
    const unavailableAttacker = {
      ...unavailableAttackerSource,
      attacker: {
        ...unavailableAttackerSource.attacker,
        participantCapability: capability({ available: false })
      }
    }
    expect(resolveDnd5eFlankingContributor(unavailableAttacker).contributor).toBeNull()

    const unavailableSource = baseInput()
    const unavailable = {
      ...unavailableSource,
      alliedCandidates: [
        {
          ...unavailableSource.alliedCandidates[0]!,
          participantCapability: capability({ available: false })
        }
      ]
    }
    expect(resolveDnd5eFlankingContributor(unavailable).contributor).toBeNull()

    const noSightSource = baseInput()
    const noSight = {
      ...noSightSource,
      alliedCandidates: [{ ...noSightSource.alliedCandidates[0]!, canSeeTarget: false }]
    }
    expect(resolveDnd5eFlankingContributor(noSight).contributor).toBeNull()

    const hostileAllySource = baseInput()
    const hostileAlly = {
      ...hostileAllySource,
      alliedCandidates: [
        { ...hostileAllySource.alliedCandidates[0]!, attackerRelationship: 'HOSTILE' as const }
      ]
    }
    expect(resolveDnd5eFlankingContributor(hostileAlly).contributor).toBeNull()
  })

  it('fails closed for duplicate/invalid actor-token facts and invalid/foreign source pins', () => {
    const duplicateSource = baseInput()
    const duplicate = {
      ...duplicateSource,
      alliedCandidates: [
        ...duplicateSource.alliedCandidates,
        {
          ...duplicateSource.alliedCandidates[0]!,
          actorId: ids.allyTwoActor,
          token: token({ actorId: ids.allyTwoActor, id: ids.allyToken, x: 250, y: 150 })
        }
      ]
    }
    expect(resolveDnd5eFlankingContributor(duplicate).contributor).toBeNull()

    const missingSource = baseInput()
    const missing = {
      ...missingSource,
      alliedCandidates: [
        {
          ...missingSource.alliedCandidates[0]!,
          actorId: 'not-a-uuid'
        }
      ]
    }
    expect(resolveDnd5eFlankingContributor(missing).contributor).toBeNull()

    const invalidChecksum = { ...baseInput(), optionalCombatSnapshotChecksum: 'a'.repeat(64) }
    expect(resolveDnd5eFlankingContributor(invalidChecksum).contributor).toBeNull()

    const foreign = {
      ...baseInput(),
      gameSystemId: '00000000-0000-4000-8000-000000000199'
    }
    expect(resolveDnd5eFlankingContributor(foreign).contributor).toBeNull()

    const invalidModuleSource = baseInput()
    const invalidModuleSnapshot = snapshot({ moduleKey: 'd20.attack.untrusted' })
    const invalidModule = {
      ...invalidModuleSource,
      optionalCombatSnapshot: invalidModuleSnapshot,
      optionalCombatSnapshotChecksum: checksumCanonicalJson(invalidModuleSnapshot)
    }
    expect(resolveDnd5eFlankingContributor(invalidModule).contributor).toBeNull()

    const invalidCapabilitySource = baseInput()
    const invalidCapability = {
      ...invalidCapabilitySource,
      alliedCandidates: [
        {
          ...invalidCapabilitySource.alliedCandidates[0]!,
          participantCapability: capability({
            definitionId: '00000000-0000-4000-8000-000000000198'
          })
        }
      ]
    }
    expect(resolveDnd5eFlankingContributor(invalidCapability).contributor).toBeNull()
  })

  it('fails closed for gridless and off-grid geometry', () => {
    expect(
      resolveDnd5eFlankingContributor({
        ...baseInput(),
        grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
      }).contributor
    ).toBeNull()
    const offGridSource = baseInput()
    const offGrid = {
      ...offGridSource,
      attacker: {
        ...offGridSource.attacker,
        token: token({ actorId: ids.attackerActor, id: ids.attackerToken, x: 51, y: 150 })
      }
    }
    expect(resolveDnd5eFlankingContributor(offGrid).contributor).toBeNull()
  })

  it('is inactive in Manual mode and deterministically chooses the first qualifying ally identity', () => {
    const manual = { ...baseInput(), automationMode: 'MANUAL' as const }
    expect(resolveDnd5eFlankingContributor(manual).contributor).toBeNull()

    const multipleSource = baseInput()
    const multiple = {
      ...multipleSource,
      alliedCandidates: [
        {
          ...multipleSource.alliedCandidates[0]!,
          actorId: ids.allyTwoActor,
          token: token({ actorId: ids.allyTwoActor, id: ids.allyTwoToken, x: 250, y: 150 })
        },
        multipleSource.alliedCandidates[0]!
      ]
    }
    expect(resolveDnd5eFlankingContributor(multiple).contributor?.geometry.alliedActorId).toBe(
      ids.allyActor
    )
  })
})
