import { describe, expect, it, vi } from 'vitest'
import type { EncounterActorRecord } from '@artificer-toolkit/db'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000001',
  equipment: '00000000-0000-4000-8000-000000000002',
  loadout: '00000000-0000-4000-8000-000000000003',
  system: '00000000-0000-4000-8000-000000000004',
  vocabulary: '00000000-0000-4000-8000-000000000005',
  version: '00000000-0000-4000-8000-000000000006'
}

vi.mock('../rules/encounterCreatureEquipmentSources.js', () => ({
  snapshotCreatureEquipmentLoadout: (actor: EncounterActorRecord) => {
    const snapshot = actor.snapshot as unknown as {
      equipmentLoadoutOverride?: readonly unknown[]
      payload: { equipmentLoadout: readonly unknown[] }
    }
    return (snapshot.equipmentLoadoutOverride ?? snapshot.payload.equipmentLoadout) as readonly {
      id: string
      equipmentId: string
      useState: 'CARRIED' | 'HELD' | 'WORN'
    }[]
  },
  snapshotCreatureEquipmentSources: () => [
    {
      loadoutEntryId: ids.loadout,
      equipmentId: ids.equipment,
      sourceRevision: 2,
      sourceVersionId: ids.version,
      sourceChecksum: 'a'.repeat(64),
      compiled: { properties: ['LIGHT'] }
    }
  ]
}))

import {
  applyEncounterActorOptionalContestSuccess,
  prepareEncounterActorOptionalContestFacts,
  prepareEncounterActorOptionalContestContext
} from './encounterActorOptionalContestContext.js'

function actor(): EncounterActorRecord {
  return {
    id: ids.actor,
    encounterId: '00000000-0000-4000-8000-000000000007',
    kind: 'CREATURE',
    sourceId: '00000000-0000-4000-8000-000000000008',
    sourceRevision: 1,
    label: 'Creature',
    systemId: ids.system,
    stableTieKey: 'creature',
    public: true,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    conditions: [],
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    snapshot: {
      payload: {
        size: 'MEDIUM',
        equipmentLoadout: [
          {
            id: ids.loadout,
            equipmentId: ids.equipment,
            quantity: 1,
            useState: 'HELD',
            attuned: false,
            actionFeatureIds: []
          }
        ]
      },
      ruleFacts: {
        gameSystemId: ids.system,
        vocabularySnapshotId: ids.vocabulary,
        vocabularySnapshotVersion: 1,
        vocabularySnapshotChecksum: 'b'.repeat(64),
        abilityScores: { '00000000-0000-4000-8000-000000000009': 14 },
        checkTotals: { '00000000-0000-4000-8000-000000000010': 4 },
        resourceAbilityScores: {},
        initiativeAbilityDefinitionId: '00000000-0000-4000-8000-000000000009'
      }
    }
  }
}

function targets(value: EncounterActorRecord): LockedEncounterActiveEffectTargets {
  return {
    characterIds: [],
    encounterActorIds: [value.id],
    lockedCharacters: new Map(),
    encounterActors: new Map([[value.id, value]]),
    activeEffectsByActorId: new Map(),
    encounterActorRules: null
  }
}

describe('Encounter actor optional-contest context', () => {
  it('returns only pinned Creature facts for the exact held loadout entry', () => {
    const context = prepareEncounterActorOptionalContestContext({
      targets: targets(actor()),
      loadoutEntryId: ids.loadout,
      targetActorId: ids.actor
    })

    expect(context).toMatchObject({
      actorId: ids.actor,
      equipment: {
        equipmentId: ids.equipment,
        loadoutEntryId: ids.loadout,
        sourceRevision: 2,
        sourceVersionId: ids.version,
        state: 'HELD'
      },
      ruleFacts: { checkTotals: { '00000000-0000-4000-8000-000000000010': 4 } },
      size: 'MEDIUM'
    })
  })

  it('fails closed for a missing held entry and Custom actor', () => {
    expect(
      prepareEncounterActorOptionalContestContext({
        targets: targets(actor()),
        loadoutEntryId: ids.version,
        targetActorId: ids.actor
      })
    ).toBeNull()
    expect(
      prepareEncounterActorOptionalContestContext({
        targets: targets({
          ...actor(),
          kind: 'CUSTOM',
          systemId: null,
          sourceId: null,
          sourceRevision: null
        }),
        loadoutEntryId: ids.loadout,
        targetActorId: ids.actor
      })
    ).toBeNull()
  })

  it('reads Creature-level contest facts before a held item is selected', () => {
    const current = actor()
    const snapshot = current.snapshot as unknown as {
      payload: { equipmentLoadout: readonly unknown[] }
    }
    current.snapshot = {
      ...snapshot,
      payload: {
        ...snapshot.payload,
        equipmentLoadout: [
          ...snapshot.payload.equipmentLoadout,
          {
            id: ids.version,
            equipmentId: ids.equipment,
            quantity: 1,
            useState: 'HELD',
            attuned: false,
            actionFeatureIds: []
          }
        ]
      }
    } as unknown as EncounterActorRecord['snapshot']

    expect(
      prepareEncounterActorOptionalContestFacts({
        targets: targets(current),
        targetActorId: ids.actor
      })
    ).toMatchObject({
      actorId: ids.actor,
      ruleFacts: { checkTotals: { '00000000-0000-4000-8000-000000000010': 4 } },
      size: 'MEDIUM'
    })
  })

  it('transitions only the exact held entry and rejects stale context', () => {
    const current = actor()
    const context = prepareEncounterActorOptionalContestContext({
      targets: targets(current),
      loadoutEntryId: ids.loadout,
      targetActorId: ids.actor
    })
    expect(context).not.toBeNull()
    const applied = applyEncounterActorOptionalContestSuccess({ context: context!, actor: current })
    const snapshot = applied.actor.snapshot as unknown as {
      equipmentLoadoutOverride: readonly { useState: string }[]
    }
    expect(snapshot.equipmentLoadoutOverride[0]?.useState).toBe('CARRIED')
    expect(applied.beforeStateChecksum).not.toBe(applied.afterStateChecksum)
    expect(() =>
      applyEncounterActorOptionalContestSuccess({ context: context!, actor: applied.actor })
    ).toThrow('changed before application')
  })
})
