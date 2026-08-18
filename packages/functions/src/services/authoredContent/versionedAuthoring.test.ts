import { beforeEach, describe, expect, it, vi } from 'vitest'

import { srdBaselineContent, type DBLike } from '@artificer-toolkit/db'
import {
  compileBackground,
  compileEquipment,
  compileSpell,
  resolveEquipmentAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { publishVersionedAuthoredAggregate } from './versionedAuthoring.js'

const mocks = vi.hoisted(() => ({
  authoredVersionRepositoryDbs: [] as unknown[],
  authoredVersionRepository: { findActive: vi.fn(), publish: vi.fn() },
  vocabularySnapshotRepositoryDbs: [] as unknown[],
  vocabularySnapshotRepository: { findActive: vi.fn() },
  syncSpellCatalogClassIndex: vi.fn(),
  upsertAuthoredRootEnvelope: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createAuthoredVersionRepository: (db: unknown) => {
    mocks.authoredVersionRepositoryDbs.push(db)
    return mocks.authoredVersionRepository
  },
  createSystemVocabularySnapshotRepository: (db: unknown) => {
    mocks.vocabularySnapshotRepositoryDbs.push(db)
    return mocks.vocabularySnapshotRepository
  },
  syncSpellCatalogClassIndex: mocks.syncSpellCatalogClassIndex,
  upsertAuthoredRootEnvelope: mocks.upsertAuthoredRootEnvelope
}))

describe('publishVersionedAuthoredAggregate', () => {
  const db = { isTransaction: true } as unknown as DBLike

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.authoredVersionRepositoryDbs.length = 0
    mocks.vocabularySnapshotRepositoryDbs.length = 0
    mocks.vocabularySnapshotRepository.findActive.mockResolvedValue({
      checksum: 'a'.repeat(64),
      snapshotId: 'snapshot-1',
      snapshotVersion: 1,
      systemId: 'system-1'
    })
  })

  it('publishes a validated, checksummed source aggregate and compiled projection', async () => {
    const authored = srdBaselineContent.subjects.backgrounds[0]
    if (!authored) throw new Error('SRD background fixture is missing.')

    await publishVersionedAuthoredAggregate({
      db,
      subjectKind: 'BACKGROUND',
      authored,
      compiled: compileBackground(authored)
    })

    expect(mocks.vocabularySnapshotRepository.findActive).toHaveBeenCalledWith(authored.systemId)
    expect(mocks.upsertAuthoredRootEnvelope).toHaveBeenCalledWith(db, {
      document: authored,
      subjectKind: 'BACKGROUND'
    })
    expect(mocks.authoredVersionRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectKind: 'BACKGROUND',
        subjectId: authored.id,
        document: authored,
        compiledDocument: compileBackground(authored),
        authoredDependencies: [],
        authoredChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        vocabularySnapshotId: 'snapshot-1'
      })
    )
  })

  it('owns a transaction when a caller has not supplied one', async () => {
    const authored = srdBaselineContent.subjects.backgrounds[0]
    if (!authored) throw new Error('SRD background fixture is missing.')
    const transactionDb = { isTransaction: true } as unknown as DBLike
    const execute = vi.fn(async (callback: (trx: DBLike) => Promise<unknown>) => callback(transactionDb))
    const outerDb = {
      isTransaction: false,
      transaction: () => ({ execute })
    } as unknown as DBLike

    await publishVersionedAuthoredAggregate({
      db: outerDb,
      subjectKind: 'BACKGROUND',
      authored,
      compiled: compileBackground(authored)
    })

    expect(execute).toHaveBeenCalledOnce()
    expect(mocks.vocabularySnapshotRepository.findActive).toHaveBeenCalledWith(authored.systemId)
    expect(mocks.upsertAuthoredRootEnvelope).toHaveBeenCalledWith(transactionDb, {
      document: authored,
      subjectKind: 'BACKGROUND'
    })
    expect(mocks.authoredVersionRepositoryDbs).toEqual([transactionDb])
    expect(mocks.vocabularySnapshotRepositoryDbs).toEqual([transactionDb])
  })

  it('pins and compiles an equipment variant from its active parent version', async () => {
    const parent = srdBaselineContent.subjects.equipment.find(
      (equipment) => equipment.category !== 'VARIANT'
    )
    if (!parent) throw new Error('SRD base equipment fixture is missing.')
    const parentVersion = {
      authored: {
        subjectKind: 'EQUIPMENT' as const,
        subjectId: parent.id,
        versionId: 'parent-equipment-version-1',
        version: 1,
        documentSchemaVersion: 1,
        checksum: 'b'.repeat(64),
        document: parent
      }
    }
    const variant: EquipmentAuthored = {
      kind: 'EQUIPMENT',
      id: 'equipment-variant-1',
      label: `${parent.label} +1`,
      description: null,
      rarityId: parent.rarityId,
      category: 'VARIANT',
      parentEquipmentId: parent.id,
      userId: parent.userId,
      systemId: parent.systemId
    }
    mocks.authoredVersionRepository.findActive.mockResolvedValue(parentVersion)

    await publishVersionedAuthoredAggregate({
      db,
      subjectKind: 'EQUIPMENT',
      authored: variant,
      compiled: compileEquipment(resolveEquipmentAuthored(variant, () => parent))
    })

    expect(mocks.authoredVersionRepository.findActive).toHaveBeenCalledWith({
      subjectKind: 'EQUIPMENT',
      subjectId: parent.id
    })
    expect(mocks.authoredVersionRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectKind: 'EQUIPMENT',
        subjectId: variant.id,
        authoredDependencies: [
          {
            subjectKind: 'EQUIPMENT',
            subjectId: parent.id,
            versionId: 'parent-equipment-version-1',
            version: 1,
            checksum: 'b'.repeat(64)
          }
        ],
        compiledDocument: compileEquipment(resolveEquipmentAuthored(variant, () => parent))
      })
    )
  })

  it('publishes the exact Spell-version class index in the owning transaction', async () => {
    const spell = srdBaselineContent.subjects.spells[0]
    if (!spell) throw new Error('SRD spell fixture is missing.')
    mocks.authoredVersionRepository.publish.mockResolvedValue({
      authored: { versionId: 'spell-version-1' }
    })

    await publishVersionedAuthoredAggregate({
      db,
      subjectKind: 'SPELL',
      authored: spell,
      compiled: compileSpell(spell)
    })

    expect(mocks.syncSpellCatalogClassIndex).toHaveBeenCalledWith(db, {
      authoredVersionId: 'spell-version-1',
      classIds: spell.classIds,
      spellId: spell.id
    })
  })

  it('rolls back Spell publication when its synchronous class index fails', async () => {
    const spell = srdBaselineContent.subjects.spells[0]
    if (!spell) throw new Error('SRD spell fixture is missing.')
    const transactionDb = { isTransaction: true } as unknown as DBLike
    const execute = vi.fn(async (callback: (trx: DBLike) => Promise<unknown>) => callback(transactionDb))
    const outerDb = {
      isTransaction: false,
      transaction: () => ({ execute })
    } as unknown as DBLike
    mocks.authoredVersionRepository.publish.mockResolvedValue({
      authored: { versionId: 'spell-version-1' }
    })
    mocks.syncSpellCatalogClassIndex.mockRejectedValue(new Error('catalogue index failed'))

    await expect(
      publishVersionedAuthoredAggregate({
        db: outerDb,
        subjectKind: 'SPELL',
        authored: spell,
        compiled: compileSpell(spell)
      })
    ).rejects.toThrow('catalogue index failed')

    expect(execute).toHaveBeenCalledOnce()
    expect(mocks.authoredVersionRepositoryDbs).toEqual([transactionDb])
    expect(mocks.syncSpellCatalogClassIndex).toHaveBeenCalledWith(
      transactionDb,
      expect.objectContaining({ spellId: spell.id })
    )
  })
})
