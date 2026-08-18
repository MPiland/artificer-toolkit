import type { AuthoredVersionRecord, DBLike } from '@artificer-toolkit/db'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const checksum = (value: string) => value.repeat(64)

const mocks = vi.hoisted(() => ({
  findActive: vi.fn(),
  findActiveByIds: vi.fn(),
  findById: vi.fn(),
  findExactVersions: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createAuthoredVersionRepository: () => ({
    findActive: mocks.findActive,
    findActiveByIds: mocks.findActiveByIds,
    findExactVersions: mocks.findExactVersions
  }),
  createSystemVocabularySnapshotRepository: () => ({ findById: mocks.findById })
}))

const {
  extendCharacterCommittedSheetSourcesWithActiveRoots,
  loadCharacterCommittedSheetSources
} = await import('./characterCommittedSheetSources.js')

const entry = {
  subjectKind: 'EQUIPMENT' as const,
  subjectId: 'equipment-1',
  versionId: 'equipment-version-1',
  version: 1,
  checksum: checksum('a')
}

const mechanics = {
  characterId: 'character-1',
  authoredVersionVector: [entry],
  systemVocabularySnapshotId: 'snapshot-1',
  systemVocabularySnapshotVersion: 1,
  systemVocabularySnapshotChecksum: checksum('b')
} as CharacterMechanicsProjection

const vocabularySnapshot = {
  snapshotId: 'snapshot-1',
  systemId: 'system-1',
  snapshotVersion: 1,
  schemaVersion: 1,
  checksum: checksum('b'),
  document: {
    id: 'system-1',
    label: 'System',
    rulesetCode: 'dnd5e',
    rulesetVersion: '2014',
    userId: 'user-1',
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
    terrains: []
  }
} satisfies SystemVocabularySnapshot

const pinnedRecord = {
  authored: {
    subjectKind: entry.subjectKind,
    subjectId: entry.subjectId,
    versionId: entry.versionId,
    version: entry.version,
    documentSchemaVersion: 1,
    checksum: entry.checksum,
    document: {
      kind: 'EQUIPMENT',
      id: entry.subjectId,
      label: 'Pinned equipment',
      description: null,
      rarityId: 'common',
      category: 'WEAPON',
      properties: [],
      systemId: 'system-1',
      userId: 'user-1'
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
    vocabularySnapshotId: vocabularySnapshot.snapshotId,
    vocabularySnapshotVersion: vocabularySnapshot.snapshotVersion,
    vocabularySnapshotChecksum: vocabularySnapshot.checksum,
    authoredDependencies: [],
    projectionChecksum: checksum('c'),
    projection: {}
  }
} satisfies AuthoredVersionRecord

describe('loadCharacterCommittedSheetSources', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findActive.mockResolvedValue({
      ...pinnedRecord,
      authored: { ...pinnedRecord.authored, versionId: 'equipment-version-2', version: 2 }
    })
    mocks.findById.mockResolvedValue(vocabularySnapshot)
    mocks.findExactVersions.mockResolvedValue(
      new Map([[`${entry.subjectKind}:${entry.subjectId}`, pinnedRecord]])
    )
    mocks.findActiveByIds.mockResolvedValue(new Map())
  })

  it('uses the pinned authored version after the root has a newer active version', async () => {
    const sources = await loadCharacterCommittedSheetSources({
      db: {} as DBLike,
      mechanics
    })

    expect(mocks.findExactVersions).toHaveBeenCalledWith({
      entries: mechanics.authoredVersionVector,
      verifyCompiledDependencies: false
    })
    expect(mocks.findActive).not.toHaveBeenCalled()
    expect(sources.recordsByRoot.get('EQUIPMENT:equipment-1')?.authored.document.label).toBe(
      'Pinned equipment'
    )
  })

  it('extends the exact vector with an explicitly selected active root', async () => {
    const dependency = {
      subjectKind: 'EQUIPMENT' as const,
      subjectId: 'equipment-parent',
      versionId: 'equipment-parent-version-1',
      version: 1,
      checksum: checksum('d')
    }
    const dependencyRecord = {
      ...pinnedRecord,
      authored: {
        ...pinnedRecord.authored,
        subjectId: dependency.subjectId,
        versionId: dependency.versionId,
        checksum: dependency.checksum,
        document: { ...pinnedRecord.authored.document, id: dependency.subjectId }
      },
      compiled: {
        ...pinnedRecord.compiled,
        subjectId: dependency.subjectId,
        authoredVersionId: dependency.versionId,
        authoredChecksum: dependency.checksum
      }
    } satisfies AuthoredVersionRecord
    const activeRecord = {
      ...pinnedRecord,
      authored: {
        ...pinnedRecord.authored,
        subjectId: 'equipment-2',
        versionId: 'equipment-version-2',
        document: { ...pinnedRecord.authored.document, id: 'equipment-2' }
      },
      compiled: {
        ...pinnedRecord.compiled,
        subjectId: 'equipment-2',
        authoredVersionId: 'equipment-version-2',
        authoredDependencies: [dependency]
      }
    } satisfies AuthoredVersionRecord
    mocks.findActiveByIds.mockResolvedValue(new Map([['equipment-2', activeRecord]]))
    mocks.findExactVersions.mockResolvedValue(
      new Map([[`${dependency.subjectKind}:${dependency.subjectId}`, dependencyRecord]])
    )

    const sources = await extendCharacterCommittedSheetSourcesWithActiveRoots({
      db: {} as DBLike,
      sources: {
        mechanics,
        recordsByRoot: new Map([['EQUIPMENT:equipment-1', pinnedRecord]]),
        vocabularySnapshot
      },
      roots: [{ subjectKind: 'EQUIPMENT', subjectId: 'equipment-2' }],
      systemId: 'system-1',
      userId: 'user-1'
    })

    expect(mocks.findActiveByIds).toHaveBeenCalledWith({
      subjectKind: 'EQUIPMENT',
      subjectIds: ['equipment-2'],
      systemId: 'system-1',
      userId: 'user-1',
      includeMaster: true
    })
    expect(sources.mechanics.authoredVersionVector).toContainEqual({
      subjectKind: 'EQUIPMENT',
      subjectId: 'equipment-2',
      versionId: 'equipment-version-2',
      version: 1,
      checksum: entry.checksum
    })
    expect(sources.mechanics.authoredVersionVector).toContainEqual(dependency)
  })

  it('fails closed when a selected active root conflicts with an existing pin', async () => {
    mocks.findActiveByIds.mockResolvedValue(
      new Map([
        [
          entry.subjectId,
          {
            ...pinnedRecord,
            authored: {
              ...pinnedRecord.authored,
              versionId: 'equipment-version-2',
              version: 2
            }
          }
        ]
      ])
    )

    await expect(
      extendCharacterCommittedSheetSourcesWithActiveRoots({
        db: {} as DBLike,
        sources: {
          mechanics,
          recordsByRoot: new Map([['EQUIPMENT:equipment-1', pinnedRecord]]),
          vocabularySnapshot
        },
        roots: [{ subjectKind: 'EQUIPMENT', subjectId: entry.subjectId }],
        systemId: 'system-1',
        userId: 'user-1'
      })
    ).rejects.toThrow('requires an explicit content upgrade')
  })
})
