import { describe, expect, it, vi } from 'vitest'

import type {
  ActiveRuleEffectDefinitionDto,
  ActiveRuleEffectLifecycleDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { DBLike } from '../types/index.js'
import { checksumCanonicalJson } from '../utils/canonicalJson.js'

const sqlState = vi.hoisted(() => ({
  rows: [] as Array<Array<Record<string, unknown>>>,
  affected: [] as bigint[],
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
  ActiveRuleEffectCurrentnessError,
  ActiveRuleEffectLimitError,
  MaintainedRuleEffectDependentLimitError,
  MaintainedRuleEffectStateLimitError,
  createActiveRuleEffectRepository
} from '../repositories/activeRuleEffects.js'

const ids = {
  character: '00000000-0000-4000-8000-000000000001',
  secondCharacter: '00000000-0000-4000-8000-000000000009',
  encounter: '00000000-0000-4000-8000-000000000002',
  actor: '00000000-0000-4000-8000-000000000003',
  effect: '00000000-0000-4000-8000-000000000004',
  occurrence: '00000000-0000-4000-8000-000000000005',
  definition: '00000000-0000-4000-8000-000000000006',
  entry: '00000000-0000-4000-8000-000000000007',
  system: '00000000-0000-4000-8000-000000000008',
  maintained: '00000000-0000-4000-8000-000000000011',
  maintenanceDefinition: '00000000-0000-4000-8000-000000000012'
}

const ownerDefinition: ActiveRuleEffectDefinitionDto = {
  schemaVersion: 1,
  origin: {
    kind: 'CHARACTER',
    sourceAggregateId: ids.character,
    sourceOccurrenceId: ids.occurrence,
    rootCommandId: ids.effect
  },
  authoredEffectId: ids.definition,
  compiledEntryId: ids.entry,
  frozenGraphNodeId: 'entry',
  frozenGraph: {
    schemaVersion: 1,
    source: {
      definitionId: ids.definition,
      gameSystemId: ids.system,
      definitionFamilyKey: 'effect',
      checksum: 'a'.repeat(64)
    },
    capabilityContractVersion: 1,
    factContracts: [],
    nodes: [
      {
        id: 'entry',
        operation: { key: 'comparison', contractVersion: 1 },
        inputs: {}
      }
    ],
    sourceEntryBindings: [{ sourceEntryId: ids.entry, nodeId: 'entry' }],
    outputs: { result: { kind: 'LITERAL', value: true } }
  },
  adapterFacts: {},
  perceptionContributions: [],
  recurrence: {
    recurrenceStage: 'NONE',
    consumeOnFirstEvent: null,
    endOnEvents: [],
    lifetimeScope: 'OWNER',
    expiration: { kind: 'INDEFINITE' }
  }
}

const ownerLifecycle: ActiveRuleEffectLifecycleDto = {
  schemaVersion: 1,
  remainingTicks: null
}

const encounterDefinition: ActiveRuleEffectDefinitionDto = {
  ...ownerDefinition,
  origin: {
    kind: 'ENCOUNTER',
    sourceAggregateId: ids.encounter,
    sourceOccurrenceId: ids.occurrence,
    rootCommandId: ids.effect,
    sourceActorId: ids.actor
  },
  recurrence: {
    ...ownerDefinition.recurrence,
    lifetimeScope: 'ENCOUNTER',
    expiration: {
      kind: 'TICKS',
      initialRemaining: 3,
      decrementStage: 'END_OF_TURN'
    }
  }
}
const encounterLifecycle: ActiveRuleEffectLifecycleDto = {
  schemaVersion: 1,
  remainingTicks: 3
}

function row(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: ids.effect,
    created_ordinal: 3,
    version: 1,
    definition: ownerDefinition,
    definition_checksum: checksumCanonicalJson(ownerDefinition),
    lifecycle: ownerLifecycle,
    lifecycle_checksum: checksumCanonicalJson(ownerLifecycle),
    source_encounter_id: null,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
    ...overrides
  }
}

function resetSql(): void {
  sqlState.rows = []
  sqlState.affected = []
  sqlState.text = []
}

function maintainedRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const descriptor = {
    schemaVersion: 2 as const,
    maintenanceDefinitionId: ids.maintenanceDefinition,
    definitionChecksum: 'b'.repeat(64),
    sourceActionId: ids.effect,
    sourceOccurrenceId: ids.occurrence,
    sourceActorId: ids.actor,
    replacementPolicy: 'REPLACE_SAME_DEFINITION' as const,
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY' as const
  }
  return {
    id: ids.maintained,
    encounter_id: ids.encounter,
    owner_actor_id: ids.actor,
    maintenance_definition_id: ids.maintenanceDefinition,
    descriptor,
    descriptor_checksum: checksumCanonicalJson(descriptor),
    version: 1,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
    ...overrides
  }
}

describe('active rule-effect repository', () => {
  it('rejects immutable identity/tampering and lifecycle-definition mismatch before querying', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    await expect(
      repository.create({
        id: ids.effect,
        owner: { kind: 'CHARACTER', characterId: ids.character },
        definition: {
          ...ownerDefinition,
          authoredEffectId: ids.effect
        },
        lifecycle: ownerLifecycle
      })
    ).rejects.toThrow()
    await expect(
      repository.create({
        id: ids.effect,
        owner: { kind: 'CHARACTER', characterId: ids.character },
        definition: ownerDefinition,
        lifecycle: { schemaVersion: 1, remainingTicks: 1 }
      })
    ).rejects.toThrow()
    expect(sqlState.text).toEqual([])
  })

  it('allocates per owner and persists separate definition/lifecycle checksums', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[{ active_count: 2, next_ordinal: 7 }], [row({ created_ordinal: 8 })]]
    const created = await repository.create({
      id: ids.effect.toUpperCase(),
      owner: { kind: 'CHARACTER', characterId: ids.character.toUpperCase() },
      definition: ownerDefinition,
      lifecycle: ownerLifecycle
    })
    expect(created.id).toBe(ids.effect)
    expect(created.createdOrdinal).toBe(8)
    expect(sqlState.text[1]).toContain('definition_checksum')
    expect(sqlState.text[1]).toContain('lifecycle_checksum')
    expect(sqlState.text[1]).toContain(checksumCanonicalJson(ownerDefinition))
    expect(sqlState.text[1]).toContain(checksumCanonicalJson(ownerLifecycle))
  })

  it('creates and locks the exact Encounter maintained slot before attaching a dependent', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [
      [maintainedRow()],
      [maintainedRow()],
      [{ state_count: 0, dependent_effect_count: 0 }],
      [{ active_count: 0, next_ordinal: 0 }],
      [
        row({
          definition: encounterDefinition,
          definition_checksum: checksumCanonicalJson(encounterDefinition),
          lifecycle: encounterLifecycle,
          lifecycle_checksum: checksumCanonicalJson(encounterLifecycle),
          source_encounter_id: ids.encounter,
          maintained_effect_state_id: ids.maintained
        })
      ]
    ]
    const state = await repository.lockMaintainedState({
      encounterId: ids.encounter,
      ownerActorId: ids.actor,
      maintenanceDefinitionId: ids.maintenanceDefinition
    })
    expect(state).toMatchObject({ id: ids.maintained, version: 1 })
    const effect = await repository.create({
      id: ids.effect,
      owner: { kind: 'CHARACTER', characterId: ids.character },
      definition: encounterDefinition,
      lifecycle: encounterLifecycle,
      maintainedEffectStateId: ids.maintained
    })
    expect(effect.maintainedEffectStateId).toBe(ids.maintained)
    expect(sqlState.text[0]).toContain('FOR UPDATE')
    expect(sqlState.text[4]).toContain('maintained_effect_state_id')
  })

  it('rejects a maintained-state allocation before insert', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[{ state_count: 64, dependent_effect_count: 0 }]]
    await expect(
      repository.createMaintainedState({
        id: ids.maintained,
        encounterId: ids.encounter,
        ownerActorId: ids.actor,
        descriptor: {
          schemaVersion: 2,
          sourceActorId: ids.actor,
          maintenanceDefinitionId: ids.maintenanceDefinition,
          definitionChecksum: 'a'.repeat(64),
          sourceActionId: ids.effect,
          sourceOccurrenceId: ids.occurrence,
          replacementPolicy: 'REPLACE_SAME_DEFINITION',
          emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
        }
      })
    ).rejects.toBeInstanceOf(MaintainedRuleEffectStateLimitError)
    expect(sqlState.text).toHaveLength(1)
  })

  it('rejects a maintained-dependent allocation before insert', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[maintainedRow()], [{ state_count: 1, dependent_effect_count: 64 }]]
    await expect(
      repository.create({
        id: ids.effect,
        owner: { kind: 'CHARACTER', characterId: ids.character },
        definition: encounterDefinition,
        lifecycle: encounterLifecycle,
        maintainedEffectStateId: ids.maintained
      })
    ).rejects.toBeInstanceOf(MaintainedRuleEffectDependentLimitError)
    expect(sqlState.text).toHaveLength(2)
  })

  it.each([
    [
      'owner',
      (() => {
        const descriptor = {
          schemaVersion: 2,
          maintenanceDefinitionId: ids.maintenanceDefinition,
          definitionChecksum: 'b'.repeat(64),
          sourceActionId: ids.effect,
          sourceOccurrenceId: ids.occurrence,
          sourceActorId: ids.secondCharacter,
          replacementPolicy: 'REPLACE_SAME_DEFINITION',
          emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
        } as const
        return maintainedRow({
          owner_actor_id: ids.secondCharacter,
          descriptor,
          descriptor_checksum: checksumCanonicalJson(descriptor)
        })
      })()
    ],
    ['Encounter', maintainedRow({ encounter_id: '00000000-0000-4000-8000-000000000010' })]
  ])(
    'rejects a maintained state with mismatched % identity before allocation or insert',
    async (_kind, row) => {
      const repository = createActiveRuleEffectRepository({} as DBLike)
      resetSql()
      sqlState.rows = [[row]]
      await expect(
        repository.create({
          id: ids.effect,
          owner: { kind: 'CHARACTER', characterId: ids.character },
          definition: encounterDefinition,
          lifecycle: encounterLifecycle,
          maintainedEffectStateId: ids.maintained
        })
      ).rejects.toBeInstanceOf(ActiveRuleEffectCurrentnessError)
      expect(sqlState.text).toHaveLength(1)
    }
  )

  it('rejects max allocation before insert', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[{ active_count: 64, next_ordinal: 64 }]]
    await expect(
      repository.create({
        id: ids.effect,
        owner: { kind: 'CHARACTER', characterId: ids.character },
        definition: ownerDefinition,
        lifecycle: ownerLifecycle
      })
    ).rejects.toBeInstanceOf(ActiveRuleEffectLimitError)
    expect(sqlState.text).toHaveLength(1)
  })

  it('binds Encounter-actor Encounter-lifetime definitions to the owning Encounter', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    await expect(
      repository.create({
        id: ids.effect,
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId: '00000000-0000-4000-8000-000000000010',
          targetActorId: ids.actor
        },
        definition: encounterDefinition,
        lifecycle: encounterLifecycle
      })
    ).rejects.toThrow('owning Encounter provenance')
    expect(sqlState.text).toEqual([])

    sqlState.rows = [
      [{ active_count: 0, next_ordinal: 0 }],
      [
        row({
          definition: encounterDefinition,
          definition_checksum: checksumCanonicalJson(encounterDefinition),
          lifecycle: encounterLifecycle,
          lifecycle_checksum: checksumCanonicalJson(encounterLifecycle)
        })
      ]
    ]
    await expect(
      repository.create({
        id: ids.effect,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ids.encounter, targetActorId: ids.actor },
        definition: encounterDefinition,
        lifecycle: encounterLifecycle
      })
    ).resolves.toMatchObject({ owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ids.encounter } })
  })

  it('rejects a persisted Encounter-actor definition from another Encounter', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    const foreign = {
      ...encounterDefinition,
      origin: {
        ...encounterDefinition.origin,
        sourceAggregateId: '00000000-0000-4000-8000-000000000010'
      }
    }
    sqlState.rows = [
      [
        row({
          definition: foreign,
          definition_checksum: checksumCanonicalJson(foreign),
          lifecycle: encounterLifecycle,
          lifecycle_checksum: checksumCanonicalJson(encounterLifecycle)
        })
      ]
    ]
    await expect(
      repository.list({
        kind: 'ENCOUNTER_ACTOR',
        encounterId: ids.encounter,
        targetActorId: ids.actor
      })
    ).rejects.toThrow('owning Encounter provenance')
  })

  it('scopes ordered reads, validates persisted checksums, and locks encounter cleanup by source', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [
      [row({ created_ordinal: 1 }), row({ created_ordinal: 2 })],
      [
        row({
          definition: encounterDefinition,
          definition_checksum: checksumCanonicalJson(encounterDefinition),
          lifecycle: encounterLifecycle,
          lifecycle_checksum: checksumCanonicalJson(encounterLifecycle),
          source_encounter_id: ids.encounter
        })
      ]
    ]
    const listed = await repository.list({
      kind: 'CHARACTER',
      characterId: ids.character
    })
    expect(listed.map((effect) => effect.createdOrdinal)).toEqual([1, 2])
    expect(sqlState.text[0]).toContain('ORDER BY created_ordinal ASC, id ASC')

    const cleanup = await repository.lockCharacterEffectsForEncounterCleanup({
      characterId: ids.character,
      sourceEncounterId: ids.encounter
    })
    expect(cleanup[0]?.sourceEncounterId).toBe(ids.encounter)
    expect(sqlState.text[1]).toContain('source_encounter_id = ')
    expect(sqlState.text[1]).toContain('FOR UPDATE')

    sqlState.rows = [[row({ lifecycle_checksum: 'a'.repeat(64) })]]
    await expect(
      repository.lockById({ kind: 'CHARACTER', characterId: ids.character }, ids.effect)
    ).rejects.toThrow('lifecycle checksum')
  })

  it('discovers distinct sorted Character owners from an Encounter without actor state or row locks', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [
      [
        { character_id: ids.secondCharacter.toUpperCase() },
        { character_id: ids.character.toUpperCase() },
        { character_id: ids.secondCharacter }
      ]
    ]
    await expect(
      repository.listCharacterOwnersForEncounterCleanup(ids.encounter.toUpperCase())
    ).resolves.toEqual([ids.character, ids.secondCharacter])
    expect(sqlState.text[0]).toContain('SELECT DISTINCT character_id')
    expect(sqlState.text[0]).toContain('source_encounter_id = ')
    expect(sqlState.text[0]).toContain(ids.encounter)
    expect(sqlState.text[0]).toContain('ORDER BY character_id ASC')
    expect(sqlState.text[0]).not.toContain('FOR UPDATE')
    expect(sqlState.text[0]).not.toContain('encounter_actors')
  })

  it('locates actor-removal Character owners through maintained-state identities without locks', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [[{ character_id: ids.character }, { character_id: ids.secondCharacter }]]
    await expect(
      repository.listCharacterOwnersForActorRemovalCleanup({
        encounterId: ids.encounter,
        removedActorId: ids.actor
      })
    ).resolves.toEqual([ids.character, ids.secondCharacter])
    expect(sqlState.text[0]).toContain('encounter_maintained_effect_states owned_state')
    expect(sqlState.text[0]).toContain('encounter_maintained_effect_states foreign_state')
    expect(sqlState.text[0]).toContain('actor_effect.target_actor_id')
    expect(sqlState.text[0]).toContain('UNION')
    expect(sqlState.text[0]).toContain('ORDER BY character_id ASC')
    expect(sqlState.text[0]).not.toContain('FOR UPDATE')
  })

  it('keeps dependent owner locators out of strict active-effect row parsing', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    sqlState.rows = [
      [
        row({
          character_id: ids.character,
          maintained_effect_state_id: ids.maintained,
          source_encounter_id: ids.encounter,
          definition: encounterDefinition,
          definition_checksum: checksumCanonicalJson(encounterDefinition),
          lifecycle: encounterLifecycle,
          lifecycle_checksum: checksumCanonicalJson(encounterLifecycle)
        })
      ],
      [
        row({
          target_actor_id: ids.actor,
          maintained_effect_state_id: ids.maintained,
          definition: encounterDefinition,
          definition_checksum: checksumCanonicalJson(encounterDefinition),
          lifecycle: encounterLifecycle,
          lifecycle_checksum: checksumCanonicalJson(encounterLifecycle),
          source_encounter_id: undefined
        })
      ]
    ]

    const effects = await repository.lockDependentEffects({
      stateId: ids.maintained,
      encounterId: ids.encounter
    })

    expect(effects).toHaveLength(2)
    expect(effects.map(({ owner }) => owner)).toEqual([
      { kind: 'CHARACTER', characterId: ids.character },
      { kind: 'ENCOUNTER_ACTOR', encounterId: ids.encounter, targetActorId: ids.actor }
    ])
    expect(sqlState.text).toHaveLength(2)
  })

  it('performs lifecycle-only CAS and rejects stale/mismatched updates', async () => {
    const repository = createActiveRuleEffectRepository({} as DBLike)
    resetSql()
    const tickDefinition: ActiveRuleEffectDefinitionDto = {
      ...ownerDefinition,
      recurrence: {
        ...ownerDefinition.recurrence,
        expiration: {
          kind: 'TICKS',
          initialRemaining: 2,
          decrementStage: 'END_OF_TURN'
        }
      }
    }
    const initialLifecycle = { schemaVersion: 1 as const, remainingTicks: 2 }
    const nextLifecycle = { schemaVersion: 1 as const, remainingTicks: 1 }
    sqlState.rows = [
      [
        row({
          definition: tickDefinition,
          definition_checksum: checksumCanonicalJson(tickDefinition),
          lifecycle: initialLifecycle,
          lifecycle_checksum: checksumCanonicalJson(initialLifecycle)
        })
      ],
      [
        row({
          version: 2,
          definition: tickDefinition,
          definition_checksum: checksumCanonicalJson(tickDefinition),
          lifecycle: nextLifecycle,
          lifecycle_checksum: checksumCanonicalJson(nextLifecycle)
        })
      ],
      []
    ]
    const updated = await repository.updateLifecycleCas({
      id: ids.effect,
      owner: { kind: 'CHARACTER', characterId: ids.character },
      expectedVersion: 1,
      lifecycle: nextLifecycle
    })
    expect(updated.version).toBe(2)
    expect(sqlState.text[1]).toContain('SET version = version + 1, lifecycle =')
    expect(sqlState.text[1]).not.toContain('definition =')
    await expect(
      repository.updateLifecycleCas({
        id: ids.effect,
        owner: { kind: 'CHARACTER', characterId: ids.character },
        expectedVersion: 2,
        lifecycle: nextLifecycle
      })
    ).rejects.toBeInstanceOf(ActiveRuleEffectCurrentnessError)
  })
})
