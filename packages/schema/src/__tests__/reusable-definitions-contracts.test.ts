import { describe, expect, it } from 'vitest'

import {
  createReusableDefinitionInputDtoSchema,
  reusableDefinitionWorkspaceDtoSchema,
  saveReusableDefinitionDraftInputDtoSchema
} from '../api/reusableDefinitions.js'
import {
  reusableDefinitionCurrentDtoSchema,
  reusableDefinitionDraftDtoSchema,
  reusableDefinitionDocumentDtoSchema
} from '../shared/reusableDefinitions.js'

const systemId = '11111111-1111-4111-8111-111111111111'
const definitionId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'
const actorId = '44444444-4444-4444-8444-444444444444'
const tieDefinitionId = '55555555-5555-4555-8555-555555555555'
const orderChoiceDefinitionId = '66666666-6666-4666-8666-666666666666'
const document = {
  schemaVersion: 1,
  id: definitionId,
  gameSystemId: systemId,
  definitionFamilyKey: 'rules-runtime-graph',
  nodes: [{ id: 'value', operation: { key: 'number.add', contractVersion: 1 }, inputs: {} }],
  outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'value', port: 'value' } }
}

describe('reusable definition contracts', () => {
  it('keeps authoring inputs and workspaces strict and UUID-backed', () => {
    expect(
      createReusableDefinitionInputDtoSchema.parse({
        gameSystemId: systemId.toUpperCase(),
        definitionFamilyKey: 'sense',
        label: '  Echolocation  '
      })
    ).toEqual({
      gameSystemId: systemId,
      definitionFamilyKey: 'sense',
      label: 'Echolocation',
      description: null
    })

    expect(
      reusableDefinitionWorkspaceDtoSchema.parse({
        id: definitionId,
        gameSystemId: systemId,
        contentSourceId: sourceId,
        definitionFamilyKey: 'sense',
        label: 'Echolocation',
        description: null,
        version: 0,
        sourceKind: 'USER',
        editable: true,
        currentVersion: null,
        draftVersion: null,
        current: null,
        draft: null
      })
    ).toMatchObject({ id: definitionId, editable: true, current: null, draft: null })

    expect(() =>
      saveReusableDefinitionDraftInputDtoSchema.parse({
        definitionId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: { ...document, extra: true }
      })
    ).toThrow()
  })

  it('keeps current documents UUID-backed and bounded', () => {
    expect(
      reusableDefinitionCurrentDtoSchema.parse({
        id: definitionId.toUpperCase(),
        gameSystemId: systemId,
        contentSourceId: sourceId,
        definitionFamilyKey: 'rules-runtime-graph',
        label: 'Runtime graph',
        description: null,
        document,
        checksum: 'a'.repeat(64),
        contractVersion: 1,
        version: 1,
        publishedAt: '2026-08-25T00:00:00.000Z',
        publishedBy: actorId
      })
    ).toMatchObject({ id: definitionId })
  })

  it('rejects malformed draft documents and noncanonical checksums', () => {
    expect(() =>
      reusableDefinitionDraftDtoSchema.parse({
        definitionId,
        gameSystemId: systemId,
        authorUserId: actorId,
        document: { ...document, id: 'not-a-uuid' },
        checksum: 'A'.repeat(64),
        baseDefinitionVersion: 0,
        version: 0,
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z'
      })
    ).toThrow()
  })

  it('accepts a strict UUID-backed sense document and rejects invalid capability access grades', () => {
    const sense = {
      schemaVersion: 1,
      kind: 'SENSE' as const,
      id: definitionId,
      gameSystemId: systemId,
      capabilities: [
        {
          channel: 'NONVISUAL' as const,
          accessGrade: 'PRECISE' as const,
          satisfies: ['SEE'] as const,
          illuminationAccess: 'IGNORE' as const,
          obscurementAccess: 'IGNORE' as const,
          perceivesInvisible: true,
          physicalConstraints: []
        }
      ]
    }
    expect(reusableDefinitionDocumentDtoSchema.parse(sense)).toEqual(sense)
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...sense,
        capabilities: [{ ...sense.capabilities[0], accessGrade: 'LOCATED' }]
      })
    ).toThrow(/PRECISE and SEE require a PRECISE capability/)
    expect(() => reusableDefinitionDocumentDtoSchema.parse({ ...sense, extra: true })).toThrow()
  })

  it('accepts strict capability and condition rule-state documents', () => {
    const capability = reusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: definitionId,
      gameSystemId: systemId,
      usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
    })
    expect(capability).toMatchObject({ kind: 'RULE_CAPABILITY', usage: { maximum: 1 } })

    const condition = {
      schemaVersion: 1,
      kind: 'CONDITION_RULE_STATE' as const,
      id: definitionId,
      gameSystemId: systemId,
      capabilitySuppressions: [
        {
          id: actorId,
          order: 0,
          kind: 'CAPABILITY_SUPPRESS' as const,
          capabilityDefinitionIds: [sourceId]
        }
      ],
      perceptionContributions: [],
      mechanics: []
    }
    expect(reusableDefinitionDocumentDtoSchema.parse(condition)).toEqual(condition)
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...condition,
        capabilitySuppressions: [
          ...condition.capabilitySuppressions,
          { ...condition.capabilitySuppressions[0], order: 1 }
        ]
      })
    ).toThrow(/identities must be unique/)
  })

  it('accepts maintenance documents and binds persisted envelopes to their family', () => {
    const maintenance = {
      schemaVersion: 1,
      kind: 'RULE_MAINTENANCE' as const,
      id: definitionId,
      gameSystemId: systemId,
      replacementPolicy: 'REPLACE_SAME_DEFINITION' as const,
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY' as const,
      damageCheckDefinitionId: tieDefinitionId
    }
    expect(reusableDefinitionDocumentDtoSchema.parse(maintenance)).toEqual(maintenance)

    const current = {
      id: definitionId,
      gameSystemId: systemId,
      contentSourceId: sourceId,
      definitionFamilyKey: 'rule-maintenance',
      label: 'Concentration',
      description: null,
      document: maintenance,
      checksum: 'a'.repeat(64),
      contractVersion: 1,
      version: 1,
      publishedAt: '2026-08-25T00:00:00.000Z',
      publishedBy: actorId
    }
    expect(reusableDefinitionCurrentDtoSchema.parse(current)).toEqual(current)
    expect(() =>
      reusableDefinitionCurrentDtoSchema.parse({
        ...current,
        definitionFamilyKey: 'rules-runtime-graph'
      })
    ).toThrow(/family must match/)
  })

  it('requires bounded exact graph pins and an in-policy initiative tie resolver', () => {
    const policy = {
      schemaVersion: 1,
      kind: 'INITIATIVE_POLICY' as const,
      id: definitionId,
      gameSystemId: systemId,
      procedure: 'ACTOR_ROLL' as const,
      cadence: 'ENCOUNTER_START' as const,
      evaluationGraph: {
        definitionId: sourceId,
        definitionVersion: 1,
        definitionChecksum: 'b'.repeat(64),
        scoreOutput: 'value',
        sortDirection: 'DESCENDING' as const,
        automaticOutput: 'available'
      },
      orderChoiceGraph: {
        definitionId: orderChoiceDefinitionId,
        definitionVersion: 1,
        definitionChecksum: 'd'.repeat(64),
        selectionOutput: 'value',
        minimumIndexFact: 'initiative.choice-min-index',
        maximumIndexFact: 'initiative.choice-max-index'
      },
      tieResolvers: [
        {
          definitionId: tieDefinitionId,
          definitionVersion: 2,
          definitionChecksum: 'c'.repeat(64),
          scoreOutput: 'value',
          sortDirection: 'DESCENDING' as const,
          automaticOutput: 'available',
          repeatOnTie: false,
          maximumAttempts: 1
        }
      ],
      defaultTieResolverDefinitionId: tieDefinitionId
    }
    expect(reusableDefinitionDocumentDtoSchema.parse(policy)).toEqual(policy)
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...policy,
        defaultTieResolverDefinitionId: actorId
      })
    ).toThrow(/default tie resolver/)
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...policy,
        tieResolvers: [{ ...policy.tieResolvers[0], definitionChecksum: 'D'.repeat(64) }]
      })
    ).toThrow()
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...policy,
        evaluationGraph: { ...policy.evaluationGraph, scoreOutput: undefined }
      })
    ).toThrow()
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...policy,
        tieResolvers: [{ ...policy.tieResolvers[0], maximumAttempts: 2 }]
      })
    ).toThrow(/non-repeating initiative tie resolver/)
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...policy,
        tieResolvers: [{ ...policy.tieResolvers[0], repeatOnTie: true, maximumAttempts: 1 }]
      })
    ).toThrow(/repeating initiative tie resolver/)
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...policy,
        evaluationGraph: { ...policy.evaluationGraph, automaticOutput: undefined }
      })
    ).toThrow()
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...policy,
        orderChoiceGraph: { ...policy.orderChoiceGraph, minimumIndexFact: undefined }
      })
    ).toThrow()
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...policy,
        orderChoiceGraph: {
          ...policy.orderChoiceGraph,
          maximumIndexFact: policy.orderChoiceGraph.minimumIndexFact
        }
      })
    ).toThrow(/distinct System fact keys/)
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...policy,
        tieResolvers: [{ ...policy.tieResolvers[0], sortDirection: 'INVALID' }]
      })
    ).toThrow()
  })

  it('accepts only strict D&D encounter lifecycle policy documents', () => {
    const graphPin = {
      definitionId: sourceId,
      definitionVersion: 1,
      definitionChecksum: 'e'.repeat(64)
    }
    const legendaryAction = {
      schemaVersion: 1,
      kind: 'LEGENDARY_ACTION' as const,
      id: definitionId,
      gameSystemId: systemId,
      eligibilityGraph: { ...graphPin, eligibleOutput: 'eligible' },
      windowStage: 'END_OF_OTHER_ACTOR_TURN' as const,
      refreshStage: 'START_OF_TURN' as const,
      resourceRecovery: 'FULL' as const,
      maximumActionsPerWindow: 1 as const
    }
    expect(reusableDefinitionDocumentDtoSchema.parse(legendaryAction)).toEqual(legendaryAction)
    expect(
      reusableDefinitionDocumentDtoSchema.parse({
        schemaVersion: 1,
        kind: 'LEGENDARY_RESISTANCE',
        id: definitionId,
        gameSystemId: systemId,
        choiceGraph: { ...graphPin, useOutput: 'use' },
        interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
        replacement: 'SAVE_SUCCESS'
      })
    ).toMatchObject({ kind: 'LEGENDARY_RESISTANCE' })
    expect(
      reusableDefinitionDocumentDtoSchema.parse({
        schemaVersion: 1,
        kind: 'RECHARGE',
        id: definitionId,
        gameSystemId: systemId,
        rechargeGraph: { ...graphPin, rechargedOutput: 'recharged' },
        boundary: 'START_OF_TURN',
        recovery: 'FULL'
      })
    ).toMatchObject({ kind: 'RECHARGE' })
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...legendaryAction,
        maximumActionsPerWindow: 2
      })
    ).toThrow()
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({
        ...legendaryAction,
        eligibilityGraph: {
          ...legendaryAction.eligibilityGraph,
          definitionChecksum: 'E'.repeat(64)
        }
      })
    ).toThrow()
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({ ...legendaryAction, chargeCost: 1 })
    ).toThrow()
    expect(() =>
      reusableDefinitionDocumentDtoSchema.parse({ ...legendaryAction, resourceRecovery: 'PARTIAL' })
    ).toThrow()
  })

  it('rejects persisted envelopes whose document identity, System, or family differs', () => {
    const current = {
      id: definitionId,
      gameSystemId: systemId,
      contentSourceId: sourceId,
      definitionFamilyKey: 'rules-runtime-graph',
      label: 'Runtime graph',
      description: null,
      document,
      checksum: 'a'.repeat(64),
      contractVersion: 1,
      version: 1,
      publishedAt: '2026-08-25T00:00:00.000Z',
      publishedBy: actorId
    }
    expect(() =>
      reusableDefinitionCurrentDtoSchema.parse({ ...current, definitionFamilyKey: 'sense' })
    ).toThrow(/family must match/)
    expect(() =>
      reusableDefinitionCurrentDtoSchema.parse({
        ...current,
        document: { ...document, id: actorId }
      })
    ).toThrow(/ID must match/)
    expect(() =>
      reusableDefinitionCurrentDtoSchema.parse({
        ...current,
        document: { ...document, gameSystemId: actorId }
      })
    ).toThrow(/Game System must match/)
    expect(() =>
      reusableDefinitionDraftDtoSchema.parse({
        definitionId,
        gameSystemId: systemId,
        authorUserId: actorId,
        document: { ...document, id: actorId },
        checksum: 'a'.repeat(64),
        baseDefinitionVersion: 0,
        version: 0,
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z'
      })
    ).toThrow(/draft ID must match/)
  })
})
