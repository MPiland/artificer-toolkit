import { describe, expect, it, vi } from 'vitest'

import type {
  ActiveRuleEffectDefinitionDto,
  ActiveRuleEffectLifecycleDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  SpatialRuleEffectPlacementDto,
  SpatialRuleEffectStateDto
} from '@artificer-toolkit/schema/shared/spatial'

import type { DBLike } from '../types/index.js'
import { checksumCanonicalJson } from '../utils/canonicalJson.js'

const sqlState = vi.hoisted(() => ({
  affected: [] as bigint[],
  rows: [] as Array<Array<Record<string, unknown>>>,
  text: [] as string[]
}))

vi.mock('kysely', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    execute: async () => {
      sqlState.text.push(
        strings
          .map((part, index) => `${part}${index < values.length ? String(values[index]) : ''}`)
          .join('')
      )
      return {
        rows: sqlState.rows.shift() ?? [],
        numAffectedRows: sqlState.affected.shift() ?? 0n
      }
    }
  })
}))

import {
  createSpatialRuleEffectRepository,
  SpatialRuleEffectCurrentnessError,
  SpatialRuleEffectLimitError
} from '../repositories/spatialRuleEffects.js'

const ids = {
  effect: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  scene: '00000000-0000-4000-8000-000000000003',
  actor: '00000000-0000-4000-8000-000000000009',
  occurrence: '00000000-0000-4000-8000-000000000004',
  authoredEffect: '00000000-0000-4000-8000-000000000005',
  entry: '00000000-0000-4000-8000-000000000006',
  system: '00000000-0000-4000-8000-000000000007',
  token: '00000000-0000-4000-8000-000000000008'
}

const definition: ActiveRuleEffectDefinitionDto = {
  schemaVersion: 1,
  origin: {
    kind: 'ENCOUNTER',
    sourceAggregateId: ids.encounter,
    sourceOccurrenceId: ids.occurrence,
    rootCommandId: ids.effect,
    sourceActorId: ids.actor
  },
  authoredEffectId: ids.authoredEffect,
  compiledEntryId: ids.entry,
  frozenGraphNodeId: 'entry',
  frozenGraph: {
    schemaVersion: 1,
    source: {
      definitionId: ids.authoredEffect,
      gameSystemId: ids.system,
      definitionFamilyKey: 'effect',
      checksum: 'a'.repeat(64)
    },
    capabilityContractVersion: 1,
    factContracts: [],
    nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
    sourceEntryBindings: [{ sourceEntryId: ids.entry, nodeId: 'entry' }],
    outputs: { result: { kind: 'LITERAL', value: true } }
  },
  adapterFacts: {},
  perceptionContributions: [],
  recurrence: {
    recurrenceStage: 'NONE',
    consumeOnFirstEvent: null,
    endOnEvents: [],
    lifetimeScope: 'ENCOUNTER',
    expiration: { kind: 'INDEFINITE' }
  }
}

const lifecycle: ActiveRuleEffectLifecycleDto = { schemaVersion: 1, remainingTicks: null }
const hiddenPlacement: SpatialRuleEffectPlacementDto = {
  schemaVersion: 1,
  anchorKind: 'TOKEN',
  sourceTokenId: ids.token,
  geometry: {
    frame: 'TOKEN_LOCAL',
    shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 5 }
  },
  triggerModes: ['ENTER', 'EXIT'],
  movementKinds: ['VOLUNTARY', 'FORCED'],
  activation: 'REPEATABLE',
  visibility: 'HIDDEN',
  revealOnTrigger: true
}
const state: SpatialRuleEffectStateDto = { schemaVersion: 1, revealed: false }

function row(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: ids.effect,
    encounter_id: ids.encounter,
    scene_id: ids.scene,
    created_ordinal: 1,
    version: 1,
    definition,
    definition_checksum: checksumCanonicalJson(definition),
    lifecycle,
    lifecycle_checksum: checksumCanonicalJson(lifecycle),
    placement: hiddenPlacement,
    placement_checksum: checksumCanonicalJson(hiddenPlacement),
    spatial_state: state,
    spatial_state_checksum: checksumCanonicalJson(state),
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T00:00:00.000Z',
    ...overrides
  }
}

function resetSql(): void {
  sqlState.affected = []
  sqlState.rows = []
  sqlState.text = []
}

function sceneScopeRow(): Record<string, unknown> {
  return { id: ids.scene, encounter_id: ids.encounter }
}

describe('Encounter/Scene spatial rule-effect repository', () => {
  it('reads a Scene-scoped snapshot without locking child roots', async () => {
    const repository = createSpatialRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[sceneScopeRow()], [row()]]
    const scope = await repository.lockScope({ encounterId: ids.encounter, sceneId: ids.scene })
    const snapshot = await scope!.snapshot()
    expect(snapshot).toHaveLength(1)
    expect(sqlState.text[1]).toContain('encounter_spatial_rule_effects')
    expect(sqlState.text[1]).not.toContain('FOR UPDATE')
  })

  it('rejects wrong Encounter provenance and target-bound recurrence before querying', async () => {
    const repository = createSpatialRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[sceneScopeRow()], [sceneScopeRow()]]
    const scope = await repository.lockScope({ encounterId: ids.encounter, sceneId: ids.scene })
    expect(scope).not.toBeNull()
    await expect(
      scope!.create({
        id: ids.effect,
        definition: {
          ...definition,
          origin: { ...definition.origin, sourceAggregateId: ids.scene }
        },
        lifecycle,
        placement: hiddenPlacement,
        spatialState: state
      })
    ).rejects.toThrow('same-Encounter origin')
    await expect(
      scope!.create({
        id: ids.effect,
        definition: {
          ...definition,
          recurrence: { ...definition.recurrence, recurrenceStage: 'START_OF_TURN' }
        },
        lifecycle,
        placement: hiddenPlacement,
        spatialState: state
      })
    ).rejects.toThrow('recurrence stage NONE')
    expect(sqlState.text).toHaveLength(1)
  })

  it('allocates monotonically per Scene and keeps immutable/current checksums separate', async () => {
    const repository = createSpatialRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [
      [sceneScopeRow()],
      [{ active_count: 2, next_ordinal: 9 }],
      [row({ created_ordinal: 10 })]
    ]
    const scope = await repository.lockScope({
      encounterId: ids.encounter.toUpperCase(),
      sceneId: ids.scene.toUpperCase()
    })
    const created = await scope!.create({
      id: ids.effect.toUpperCase(),
      definition,
      lifecycle,
      placement: hiddenPlacement,
      spatialState: state
    })
    expect(created).toMatchObject({ id: ids.effect, createdOrdinal: 10 })
    expect(sqlState.text[0]).toContain('FROM public.encounter_scene_bindings AS binding')
    expect(sqlState.text[0]).toContain('FOR UPDATE')
    expect(sqlState.text[2]).toContain('placement_checksum')
    expect(sqlState.text[2]).toContain('spatial_state_checksum')
  })

  it('enforces the per-Scene bound before insert', async () => {
    const repository = createSpatialRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[sceneScopeRow()], [{ active_count: 64, next_ordinal: 64 }]]
    const scope = await repository.lockScope({ encounterId: ids.encounter, sceneId: ids.scene })
    await expect(
      scope!.create({
        id: ids.effect,
        definition,
        lifecycle,
        placement: hiddenPlacement,
        spatialState: state
      })
    ).rejects.toBeInstanceOf(SpatialRuleEffectLimitError)
    expect(sqlState.text).toHaveLength(2)
  })

  it('returns no locked scope for a foreign/missing Scene and parses scoped rows on a real scope', async () => {
    const repository = createSpatialRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[], [sceneScopeRow()], [row()], [row({ placement_checksum: 'f'.repeat(64) })]]
    await expect(
      repository.lockScope({ encounterId: ids.encounter, sceneId: ids.scene })
    ).resolves.toBeNull()
    const scope = await repository.lockScope({ encounterId: ids.encounter, sceneId: ids.scene })
    await expect(scope!.list()).resolves.toHaveLength(1)
    await expect(
      repository.listByScene({ encounterId: ids.encounter, sceneId: ids.scene })
    ).rejects.toThrow('placement checksum')
    expect(sqlState.text[0]).toContain('FROM public.encounter_scene_bindings AS binding')
    expect(sqlState.text[1]).toContain('FOR UPDATE')
    expect(sqlState.text[2]).toContain('ORDER BY created_ordinal ASC, id ASC')
  })

  it('updates lifecycle and reveal state together through exact currentness and scoped locking', async () => {
    const repository = createSpatialRuleEffectRepository({} as DBLike)
    resetSql()
    const revealed = { schemaVersion: 1 as const, revealed: true }
    sqlState.rows = [
      [sceneScopeRow()],
      [row()],
      [
        row({
          version: 2,
          spatial_state: revealed,
          spatial_state_checksum: checksumCanonicalJson(revealed)
        })
      ]
    ]
    const scope = await repository.lockScope({ encounterId: ids.encounter, sceneId: ids.scene })
    const updated = await scope!.updateCurrentStateCas({
      id: ids.effect,
      expectedVersion: 1,
      lifecycle,
      spatialState: revealed
    })
    expect(updated).toMatchObject({ version: 2, spatialState: revealed })
    expect(sqlState.text[0]).toContain('FROM public.encounter_scene_bindings AS binding')
    expect(sqlState.text[1]).toContain('scene_id =')
    expect(sqlState.text[1]).toContain('FOR UPDATE')
    expect(sqlState.text[2]).toContain('lifecycle_checksum')
    expect(sqlState.text[2]).toContain('spatial_state_checksum')
  })

  it('rejects stale scoped deletion', async () => {
    const repository = createSpatialRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[sceneScopeRow()]]
    sqlState.affected = [0n]
    const scope = await repository.lockScope({ encounterId: ids.encounter, sceneId: ids.scene })
    await expect(
      scope!.deleteCas({
        id: ids.effect,
        expectedVersion: 2
      })
    ).rejects.toBeInstanceOf(SpatialRuleEffectCurrentnessError)
    expect(sqlState.text[1]).toContain('encounter_id =')
    expect(sqlState.text[1]).toContain('scene_id =')
  })
})
