import { describe, expect, it } from 'vitest'

import {
  spatialEffectInstanceDtoSchema,
  spatialMovementCandidateInputDtoSchema,
  spatialRuleEffectCurrentStateDtoSchema,
  spatialRuleEffectPlacementDtoSchema,
  spatialRuleEffectStateDtoSchema
} from '../shared/spatial.js'
import { VTT_SCENE_LIMITS, VTT_SPATIAL_LIMITS } from '@artificer-toolkit/shared/vtt'

const ids = {
  effect: '00000000-0000-4000-8000-000000000001',
  actor: '00000000-0000-4000-8000-000000000002',
  source: '00000000-0000-4000-8000-000000000003',
  moving: '00000000-0000-4000-8000-000000000004'
}

function effect() {
  return {
    anchorKind: 'TOKEN' as const,
    effectId: ids.effect,
    geometry: {
      frame: 'TOKEN_LOCAL' as const,
      shape: { kind: 'CIRCLE' as const, center: { x: 0, y: 0 }, radius: 10 }
    },
    movementKinds: ['VOLUNTARY' as const],
    sourceActorId: ids.actor,
    sourceTokenId: ids.source,
    triggerModes: ['ENTER' as const]
  }
}

function placement() {
  return {
    schemaVersion: 1 as const,
    anchorKind: 'TOKEN' as const,
    sourceTokenId: ids.source,
    geometry: {
      frame: 'TOKEN_LOCAL' as const,
      shape: { kind: 'CIRCLE' as const, center: { x: 0, y: 0 }, radius: 10 }
    },
    triggerModes: ['ENTER' as const, 'EXIT' as const],
    movementKinds: ['VOLUNTARY' as const, 'FORCED' as const],
    activation: 'REPEATABLE' as const,
    visibility: 'HIDDEN' as const,
    revealOnTrigger: true
  }
}

function effectDefinition() {
  return {
    schemaVersion: 2 as const,
    stateContributions: [],
    origin: {
      kind: 'ENCOUNTER' as const,
      sourceAggregateId: ids.effect,
      sourceOccurrenceId: ids.source,
      rootCommandId: ids.moving,
      sourceActorId: ids.actor
    },
    authoredEffectId: ids.effect,
    compiledEntryId: ids.source,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1 as const,
      source: {
        definitionId: ids.effect,
        gameSystemId: ids.actor,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: ids.source, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    recurrence: {
      recurrenceStage: 'NONE' as const,
      anchor: 'HOLDER' as const,
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'ENCOUNTER' as const,
      expiration: { kind: 'INDEFINITE' as const }
    }
  }
}

describe('spatial contracts', () => {
  it('accepts bounded UUID-backed token-local spatial descriptors', () => {
    expect(spatialEffectInstanceDtoSchema.parse(effect())).toMatchObject({ anchorKind: 'TOKEN' })
    expect(
      spatialMovementCandidateInputDtoSchema.parse({
        effects: [effect()],
        movementKind: 'VOLUNTARY',
        movingTokenId: ids.moving,
        path: [
          { x: -1, y: 0 },
          { x: 1, y: 0 }
        ],
        tokens: [
          { id: ids.source, actorId: ids.actor, position: { x: 0, y: 0 }, width: 1, height: 1 },
          { id: ids.moving, actorId: ids.actor, position: { x: -1, y: 0 }, width: 1, height: 1 }
        ]
      })
    ).toMatchObject({ movementKind: 'VOLUNTARY' })
  })

  it('persists a token zone that only answers melee hits, and refuses one with a fixed anchor (D153)', () => {
    const retaliating = { ...placement(), triggerModes: [], retaliatesMeleeHits: true as const }
    expect(spatialRuleEffectPlacementDtoSchema.parse(retaliating)).toMatchObject({
      retaliatesMeleeHits: true
    })
    expect(
      spatialEffectInstanceDtoSchema.parse({
        ...effect(),
        triggerModes: [],
        retaliatesMeleeHits: true
      })
    ).toMatchObject({ retaliatesMeleeHits: true })
    expect(
      spatialRuleEffectPlacementDtoSchema
        .safeParse({
          ...retaliating,
          anchorKind: 'FIXED',
          sourceTokenId: null,
          geometry: {
            frame: 'SCENE_ABSOLUTE',
            shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 10 }
          }
        })
        .error?.issues.map(({ path }) => path)
    ).toEqual([['retaliatesMeleeHits']])
  })

  it('persists a zone no creature interacts with, which has no trigger (D154 amendment)', () => {
    expect(
      spatialRuleEffectPlacementDtoSchema.safeParse({ ...placement(), triggerModes: [] }).success
    ).toBe(true)
    expect(
      spatialEffectInstanceDtoSchema.safeParse({ ...effect(), triggerModes: [] }).success
    ).toBe(true)
  })

  it('persists canonical fixed or token placement without silently reordering triggers', () => {
    expect(spatialRuleEffectPlacementDtoSchema.parse(placement())).toMatchObject({
      anchorKind: 'TOKEN',
      triggerModes: ['ENTER', 'EXIT']
    })
    expect(
      spatialRuleEffectPlacementDtoSchema.parse({
        ...placement(),
        anchorKind: 'FIXED',
        sourceTokenId: null,
        geometry: {
          frame: 'SCENE_ABSOLUTE',
          shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 10 }
        },
        visibility: 'PUBLIC',
        revealOnTrigger: false
      })
    ).toMatchObject({ anchorKind: 'FIXED', visibility: 'PUBLIC' })
    expect(
      spatialRuleEffectPlacementDtoSchema.parse({
        ...placement(),
        anchorKind: 'FIXED',
        sourceTokenId: null,
        geometry: {
          frame: 'SCENE_ABSOLUTE',
          shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 10 }
        },
        visibility: 'PUBLIC',
        revealOnTrigger: false,
        label: 'Caltrop field',
        bypassAtHalfSpeed: true
      })
    ).toMatchObject({ label: 'Caltrop field', bypassAtHalfSpeed: true })
    expect(spatialRuleEffectStateDtoSchema.parse({ schemaVersion: 1, revealed: false })).toEqual({
      schemaVersion: 1,
      revealed: false
    })
  })

  it('rejects noncanonical placement order, anchor mismatches, and public hidden-reveal behavior', () => {
    expect(
      spatialRuleEffectPlacementDtoSchema.safeParse({
        ...placement(),
        triggerModes: ['EXIT', 'ENTER']
      }).success
    ).toBe(false)
    expect(
      spatialRuleEffectPlacementDtoSchema.safeParse({
        ...placement(),
        movementKinds: ['FORCED', 'VOLUNTARY']
      }).success
    ).toBe(false)
    expect(
      spatialRuleEffectPlacementDtoSchema.safeParse({
        ...placement(),
        anchorKind: 'FIXED',
        sourceTokenId: null
      }).success
    ).toBe(false)
    expect(
      spatialRuleEffectPlacementDtoSchema.safeParse({
        ...placement(),
        visibility: 'PUBLIC',
        revealOnTrigger: true
      }).success
    ).toBe(false)
    expect(
      spatialRuleEffectCurrentStateDtoSchema.safeParse({
        definition: effectDefinition(),
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        placement: {
          ...placement(),
          visibility: 'PUBLIC',
          revealOnTrigger: false
        },
        spatialState: { schemaVersion: 1, revealed: false }
      }).success
    ).toBe(false)
  })

  it('keeps spot and disarm DCs on a zone fixed to the Scene, with who knows of it sorted (MOVE-3.3)', () => {
    const fixed = {
      ...placement(),
      anchorKind: 'FIXED' as const,
      sourceTokenId: null,
      geometry: {
        frame: 'SCENE_ABSOLUTE' as const,
        shape: { kind: 'CIRCLE' as const, center: { x: 0, y: 0 }, radius: 10 }
      },
      visibility: 'PUBLIC' as const,
      revealOnTrigger: false
    }
    const current = (
      placementInput: typeof fixed | ReturnType<typeof placement>,
      spatialState: object
    ) =>
      spatialRuleEffectCurrentStateDtoSchema.safeParse({
        definition: effectDefinition(),
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        placement: placementInput,
        spatialState: { schemaVersion: 1, revealed: true, ...spatialState }
      }).success
    const spotDc = { value: 15, source: 'PLACER_ROLL' }
    const disarmDc = { value: 12, source: 'FLAT' }

    expect(
      current(fixed, {
        concealment: { spotDc, knownByActorIds: [ids.actor, ids.source] },
        disarmDc
      })
    ).toBe(true)
    expect(current(fixed, { disarmDc })).toBe(true)
    expect(
      current(fixed, { concealment: { spotDc, knownByActorIds: [ids.source, ids.actor] } })
    ).toBe(false)
    expect(current(fixed, { disarmDc: { value: 0, source: 'FLAT' } })).toBe(false)
    expect(current(fixed, { disarmDc: { value: 12, source: 'SKILL' } })).toBe(false)
    expect(
      current({ ...placement(), visibility: 'PUBLIC', revealOnTrigger: false }, { disarmDc })
    ).toBe(false)
  })

  it('rejects invalid anchor/frame/source combinations, malformed geometry, and duplicate identities', () => {
    expect(
      spatialEffectInstanceDtoSchema.safeParse({ ...effect(), anchorKind: 'FIXED' }).success
    ).toBe(false)
    expect(
      spatialEffectInstanceDtoSchema.safeParse({
        ...effect(),
        geometry: {
          frame: 'TOKEN_LOCAL',
          shape: {
            kind: 'POLYGON',
            points: [
              { x: 0, y: 0 },
              { x: 4, y: 4 },
              { x: 0, y: 4 },
              { x: 4, y: 0 },
              { x: 4, y: -2 }
            ]
          }
        }
      }).success
    ).toBe(false)
    expect(
      spatialEffectInstanceDtoSchema.safeParse({
        ...effect(),
        geometry: {
          frame: 'TOKEN_LOCAL',
          shape: {
            kind: 'POLYGON',
            points: [
              { x: 0, y: 0 },
              { x: 4, y: 0 },
              { x: 4, y: 4 },
              { x: 1, y: 0 },
              { x: 3, y: 0 },
              { x: 0, y: 4 }
            ]
          }
        }
      }).success
    ).toBe(false)
    expect(
      spatialEffectInstanceDtoSchema.safeParse({
        ...effect(),
        geometry: {
          frame: 'TOKEN_LOCAL',
          shape: {
            kind: 'POLYGON',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
              { x: 2, y: 2 }
            ]
          }
        }
      }).success
    ).toBe(false)
    expect(
      spatialEffectInstanceDtoSchema.safeParse({
        ...effect(),
        geometry: {
          frame: 'TOKEN_LOCAL',
          shape: {
            kind: 'CIRCLE',
            center: { x: 0, y: 0 },
            radius: VTT_SPATIAL_LIMITS.minimumDistance / 2
          }
        }
      }).success
    ).toBe(false)
    expect(
      spatialMovementCandidateInputDtoSchema.safeParse({
        effects: [effect()],
        movementKind: 'VOLUNTARY',
        movingTokenId: ids.moving,
        path: [
          { x: -1, y: 0 },
          { x: 1, y: 0 }
        ],
        tokens: [
          { id: ids.source, actorId: ids.actor, position: { x: 0, y: 0 }, width: 1, height: 1 },
          {
            id: ids.moving,
            actorId: ids.actor,
            position: { x: -1, y: 0 },
            width: VTT_SPATIAL_LIMITS.minimumDistance / 2,
            height: 1
          }
        ]
      }).success
    ).toBe(false)
    expect(
      spatialMovementCandidateInputDtoSchema.safeParse({
        effects: [effect(), effect()],
        movementKind: 'VOLUNTARY',
        movingTokenId: ids.moving,
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ],
        tokens: [
          { id: ids.moving, actorId: ids.actor, position: { x: 0, y: 0 }, width: 1, height: 1 }
        ]
      }).success
    ).toBe(false)
    expect(
      spatialMovementCandidateInputDtoSchema.safeParse({
        effects: [effect()],
        movementKind: 'VOLUNTARY',
        movingTokenId: ids.moving,
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ],
        tokens: [
          {
            id: ids.moving,
            actorId: ids.actor,
            position: { x: 0, y: 0 },
            width: 1,
            height: 1
          }
        ]
      }).success
    ).toBe(false)
    expect(
      spatialMovementCandidateInputDtoSchema.safeParse({
        effects: [effect()],
        movementKind: 'VOLUNTARY',
        movingTokenId: ids.moving,
        path: [
          { x: -1, y: 0 },
          { x: VTT_SCENE_LIMITS.coordinateMagnitude + 1, y: 0 }
        ],
        tokens: [
          { id: ids.source, actorId: ids.actor, position: { x: 0, y: 0 }, width: 1, height: 1 },
          {
            id: ids.moving,
            actorId: ids.actor,
            position: { x: -1, y: 0 },
            width: VTT_SCENE_LIMITS.coordinateMagnitude + 1,
            height: 1
          }
        ]
      }).success
    ).toBe(false)
    expect(
      spatialMovementCandidateInputDtoSchema.safeParse({
        effects: [effect()],
        movementKind: 'TELEPORT',
        movingTokenId: ids.moving,
        path: [
          { x: -1, y: 0 },
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ],
        tokens: [
          { id: ids.source, actorId: ids.actor, position: { x: 0, y: 0 }, width: 1, height: 1 },
          { id: ids.moving, actorId: ids.actor, position: { x: -1, y: 0 }, width: 1, height: 1 }
        ]
      }).success
    ).toBe(false)
  })
})
