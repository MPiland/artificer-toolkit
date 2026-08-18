import { describe, expect, it } from 'vitest'

import type { AuthoredVersionRecord } from '@artificer-toolkit/db'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'

import {
  assertCharacterCommittedSheetSourceIdentity,
  CharacterCommittedSheetSourcesError,
  pruneCharacterCommittedSheetSourcesRoots
} from './characterCommittedSheetSources.js'

const entry: AuthoredVersionVector[number] = {
  subjectKind: 'EQUIPMENT',
  subjectId: 'equipment-1',
  versionId: 'equipment-version-1',
  version: 1,
  checksum: 'a'.repeat(64)
}

const creatureEntry: AuthoredVersionVector[number] = {
  subjectKind: 'CREATURE',
  subjectId: 'creature-1',
  versionId: 'creature-version-1',
  version: 1,
  checksum: 'd'.repeat(64)
}

function createRecord(
  dependencies: readonly AuthoredVersionVector[number][] = []
): AuthoredVersionRecord {
  return {
    authored: {
      subjectKind: 'EQUIPMENT',
      subjectId: entry.subjectId,
      versionId: entry.versionId,
      version: entry.version,
      checksum: entry.checksum,
      documentSchemaVersion: 1,
      document: {
        kind: 'EQUIPMENT',
        id: entry.subjectId,
        label: 'Equipment',
        description: null,
        rarityId: 'common',
        category: 'WEAPON',
        properties: [],
        userId: 'user-1',
        systemId: 'system-1'
      }
    },
    compiled: {
      subjectKind: entry.subjectKind,
      subjectId: entry.subjectId,
      authoredVersionId: entry.versionId,
      authoredVersion: entry.version,
      authoredChecksum: entry.checksum,
      projectionSchemaVersion: 1,
      compilerVersion: 'subject-compiler-v1',
      vocabularySnapshotId: 'snapshot-1',
      vocabularySnapshotVersion: 1,
      vocabularySnapshotChecksum: 'b'.repeat(64),
      authoredDependencies: [...dependencies],
      projectionChecksum: 'c'.repeat(64),
      projection: {}
    }
  }
}

function createCreatureRecord(
  dependencies: readonly AuthoredVersionVector[number][] = []
): AuthoredVersionRecord {
  return {
    authored: {
      subjectKind: 'CREATURE',
      subjectId: creatureEntry.subjectId,
      versionId: creatureEntry.versionId,
      version: creatureEntry.version,
      checksum: creatureEntry.checksum,
      documentSchemaVersion: 1,
      document: {
        id: creatureEntry.subjectId,
        label: 'Creature',
        userId: 'user-1',
        systemId: 'system-1',
        category: 'COMPANION',
        creatureTypeId: 'creature-type-1',
        size: 'SMALL',
        abilityScores: {
          STRENGTH: 3,
          DEXTERITY: 13,
          CONSTITUTION: 10,
          INTELLIGENCE: 2,
          WISDOM: 12,
          CHARISMA: 7
        },
        armorClass: 11,
        hitPoints: 3,
        speeds: []
      }
    },
    compiled: {
      subjectKind: creatureEntry.subjectKind,
      subjectId: creatureEntry.subjectId,
      authoredVersionId: creatureEntry.versionId,
      authoredVersion: creatureEntry.version,
      authoredChecksum: creatureEntry.checksum,
      projectionSchemaVersion: 1,
      compilerVersion: 'subject-compiler-v1',
      vocabularySnapshotId: 'snapshot-1',
      vocabularySnapshotVersion: 1,
      vocabularySnapshotChecksum: 'b'.repeat(64),
      authoredDependencies: [...dependencies],
      projectionChecksum: 'c'.repeat(64),
      projection: {}
    }
  }
}

const mechanics = {
  characterId: 'character-1',
  authoredVersionVector: [entry],
  systemVocabularySnapshotId: 'snapshot-1',
  systemVocabularySnapshotVersion: 1,
  systemVocabularySnapshotChecksum: 'b'.repeat(64)
}

const vocabularySnapshot = {
  snapshotId: 'snapshot-1',
  systemId: 'system-1',
  snapshotVersion: 1,
  schemaVersion: 1,
  checksum: 'b'.repeat(64),
  document: {
    id: 'system-1',
    label: 'System',
    rulesetCode: 'rules',
    rulesetVersion: '1',
    alignments: [],
    challengeRatings: [],
    conditionTypes: [],
    creatureTypes: [],
    currencies: [],
    damageTypes: [],
    heritages: [],
    languages: [],
    lifestyles: [],
    magicSchools: [],
    passives: [],
    rarities: [],
    senses: [],
    skills: [],
    speeds: [],
    terrains: [],
    userId: 'user-1'
  }
}

describe('Character committed Sheet sources', () => {
  it('accepts exact authored records and the exact pinned vocabulary snapshot', () => {
    expect(() =>
      assertCharacterCommittedSheetSourceIdentity({
        mechanics,
        recordsByRoot: new Map([['EQUIPMENT:equipment-1', createRecord()]]),
        vocabularySnapshot
      })
    ).not.toThrow()
  })

  it('fails closed when a compiled authored dependency is absent from the mechanics vector', () => {
    expect(() =>
      assertCharacterCommittedSheetSourceIdentity({
        mechanics,
        recordsByRoot: new Map([
          [
            'EQUIPMENT:equipment-1',
            createRecord([
              {
                subjectKind: 'EQUIPMENT',
                subjectId: 'equipment-parent',
                versionId: 'equipment-parent-version-1',
                version: 1,
                checksum: 'd'.repeat(64)
              }
            ])
          ]
        ]),
        vocabularySnapshot
      })
    ).toThrow(CharacterCommittedSheetSourcesError)
  })

  it('fails closed when the pinned vocabulary snapshot no longer matches', () => {
    expect(() =>
      assertCharacterCommittedSheetSourceIdentity({
        mechanics,
        recordsByRoot: new Map([['EQUIPMENT:equipment-1', createRecord()]]),
        vocabularySnapshot: { ...vocabularySnapshot, checksum: 'e'.repeat(64) }
      })
    ).toThrow(CharacterCommittedSheetSourcesError)
  })

  it('prunes an unreferenced Creature root without mutating the input sources', () => {
    const sources = {
      mechanics: {
        ...mechanics,
        authoredVersionVector: [creatureEntry]
      } as CharacterMechanicsProjection,
      recordsByRoot: new Map([['CREATURE:creature-1', createCreatureRecord()]]),
      vocabularySnapshot
    }

    const pruned = pruneCharacterCommittedSheetSourcesRoots({
      sources,
      roots: [{ subjectKind: 'CREATURE', subjectId: 'creature-1' }]
    })

    expect(pruned.mechanics.authoredVersionVector).toEqual([])
    expect(pruned.recordsByRoot.size).toBe(0)
    expect(sources.mechanics.authoredVersionVector).toEqual([creatureEntry])
    expect(sources.recordsByRoot.size).toBe(1)
  })

  it('fails closed when pruning a Creature root with authored dependencies', () => {
    const dependency = {
      subjectKind: 'EQUIPMENT' as const,
      subjectId: 'equipment-2',
      versionId: 'equipment-version-2',
      version: 1,
      checksum: 'e'.repeat(64)
    }
    const sources = {
      mechanics: {
        ...mechanics,
        authoredVersionVector: [creatureEntry, dependency]
      } as CharacterMechanicsProjection,
      recordsByRoot: new Map([
        ['CREATURE:creature-1', createCreatureRecord([dependency])],
        ['EQUIPMENT:equipment-2', createRecord()]
      ]),
      vocabularySnapshot
    }

    expect(() =>
      pruneCharacterCommittedSheetSourcesRoots({
        sources,
        roots: [{ subjectKind: 'CREATURE', subjectId: 'creature-1' }]
      })
    ).toThrow('cannot prune CREATURE:creature-1 while it has authored dependencies')
  })
})
