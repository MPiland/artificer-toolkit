import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '../types/index.js'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'

import {
  checksumCompiledAuthoredProjection,
  checksumSystemVocabularySnapshot
} from '../utils/index.js'

const wrapperCalls: string[] = []
const wrapperDatabases: unknown[] = []
const versionState = vi.hoisted(() => ({
  activeBySubject: new Map<string, {
    authored: {
      checksum: string
      document: unknown
      subjectId: string
      subjectKind: string
      version: number
      versionId: string
    }
  }>(),
  findActiveForPublication: vi.fn(),
  publish: vi.fn(),
  syncSpellCatalogClassIndex: vi.fn(),
  vocabularyFindActiveForPublication: vi.fn(),
  vocabularyPublish: vi.fn()
}))

vi.mock('../domains/index.js', () => {
  const track = (name: string) =>
    vi.fn(async (db: unknown) => {
      wrapperCalls.push(name)
      wrapperDatabases.push(db)
    })

  return {
    upsertBackground: track('upsertBackground'),
    upsertCharge: track('upsertCharge'),
    upsertClass: track('upsertClass'),
    upsertClassRoot: track('upsertClassRoot'),
    upsertCreature: track('upsertCreature'),
    upsertDetail: track('upsertDetail'),
    upsertEffect: track('upsertEffect'),
    upsertEquipment: track('upsertEquipment'),
    upsertFeat: track('upsertFeat'),
    upsertFeatGrant: track('upsertFeatGrant'),
    upsertFeature: track('upsertFeature'),
    upsertModifierGrant: track('upsertModifierGrant'),
    upsertOption: track('upsertOption'),
    upsertProficiencyGrant: track('upsertProficiencyGrant'),
    upsertRace: track('upsertRace'),
    upsertSavingThrow: track('upsertSavingThrow'),
    upsertSenseGrant: track('upsertSenseGrant'),
    upsertSpell: track('upsertSpell'),
    upsertSpellGrant: track('upsertSpellGrant'),
    upsertStartingEquipment: track('upsertStartingEquipment'),
    upsertSystem: track('upsertSystem'),
    upsertVehicle: track('upsertVehicle')
  }
})

vi.mock('../repositories/index.js', () => ({
  createAuthoredRouteIdRepository: vi.fn(() => ({
    seedSrdSubjects: vi.fn()
  })),
  createAuthoredVersionRepository: vi.fn(() => ({
    findActive: vi.fn(async (input: { subjectId: string; subjectKind: string }) =>
      versionState.activeBySubject.get(`${input.subjectKind}:${input.subjectId}`) ?? null
    ),
    findActiveForPublication: versionState.findActiveForPublication,
    publish: versionState.publish
  })),
  createSystemVocabularySnapshotRepository: vi.fn(() => ({
    findActiveForPublication: versionState.vocabularyFindActiveForPublication,
    publish: versionState.vocabularyPublish
  })),
  syncSpellCatalogClassIndex: versionState.syncSpellCatalogClassIndex,
  upsertAuthoredRootEnvelope: vi.fn()
}))

import { seedBaselineContent } from '../seed/baseline.js'
import { defineBaselineContentBundle } from '../source-data/content.js'
import { srdBaselineContent } from '../source-data/srd/index.js'

type SeedRow = Record<string, unknown>
type SeedTables = Record<string, SeedRow[]>
type WhereOperator = '=' | 'in' | 'not in'

function createSeedTransactionDb(initialTables: SeedTables = {}) {
  const tables = structuredClone(initialTables)
  const operations: Array<{ operation: string; table: string }> = []

  const createQuery = (operation: 'select' | 'delete' | 'update', table: string) => {
    const predicates: Array<(row: SeedRow) => boolean> = []
    let update: SeedRow = {}
    const query = {
      select() {
        return query
      },
      set(values: SeedRow) {
        update = values
        return query
      },
      where(column: string, operator: WhereOperator, value: unknown) {
        predicates.push((row) => {
          if (operator === '=') return row[column] === value
          const values = value as readonly unknown[]
          return operator === 'in' ? values.includes(row[column]) : !values.includes(row[column])
        })
        return query
      },
      async execute() {
        operations.push({ operation, table })
        const rows = tables[table] ?? []
        const matches = (row: SeedRow) => predicates.every((predicate) => predicate(row))

        if (operation === 'select') return rows.filter(matches).map((row) => ({ ...row }))
        if (operation === 'delete') {
          tables[table] = rows.filter((row) => !matches(row))
          return []
        }

        for (const row of rows.filter(matches)) Object.assign(row, update)
        return []
      }
    }
    return query
  }

  const db = {
    isTransaction: true,
    selectFrom: (table: string) => createQuery('select', table),
    deleteFrom: (table: string) => createQuery('delete', table),
    updateTable: (table: string) => createQuery('update', table)
  }

  return { db, operations, tables }
}

function createEmptyBundle(systemId = 'system-1') {
  return defineBaselineContentBundle({
    vocabulary: {
      systems: [
        {
          id: systemId,
          label: 'System',
          description: null,
          rulesetCode: 'dnd5e',
          rulesetVersion: '2014',
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
      ]
    },
    shared: {
      charges: [],
      details: [],
      savingThrows: [],
      startingEquipment: []
    },
    effects: { effects: [] },
    features: { features: [], options: [] },
    grants: {
      feats: [],
      modifiers: [],
      proficiencies: [],
      senses: [],
      spells: []
    },
    subjects: {
      backgrounds: [],
      classes: [],
      creatures: [],
      equipment: [],
      feats: [],
      races: [],
      spells: [],
      vehicles: []
    }
  })
}

describe('seedBaselineContent', () => {
  beforeEach(() => {
    wrapperCalls.length = 0
    wrapperDatabases.length = 0
    versionState.activeBySubject.clear()
    versionState.findActiveForPublication.mockReset()
    versionState.findActiveForPublication.mockResolvedValue(null)
    versionState.publish.mockReset()
    versionState.syncSpellCatalogClassIndex.mockReset()
    versionState.vocabularyFindActiveForPublication.mockReset()
    versionState.vocabularyFindActiveForPublication.mockResolvedValue(null)
    versionState.vocabularyPublish.mockReset()
    versionState.vocabularyPublish.mockImplementation(async (input: {
      document: unknown
      schemaVersion: number
      snapshotId: string
      systemId: string
    }) => ({
      checksum: 'a'.repeat(64),
      document: input.document,
      schemaVersion: input.schemaVersion,
      snapshotId: input.snapshotId,
      snapshotVersion: 1,
      systemId: input.systemId
    }))
    versionState.publish.mockImplementation(async (input: {
      authoredChecksum: string
      document: unknown
      subjectId: string
      subjectKind: string
      versionId: string
    }) => {
      versionState.activeBySubject.set(`${input.subjectKind}:${input.subjectId}`, {
        authored: {
          checksum: input.authoredChecksum,
          document: input.document,
          subjectId: input.subjectId,
          subjectKind: input.subjectKind,
          version: 1,
          versionId: input.versionId
        }
      })
      return { authored: { versionId: input.versionId } }
    })
  })

  it('seeds systems before system-scoped content and returns counts', async () => {
    const bundle = defineBaselineContentBundle({
      vocabulary: {
        systems: [
          {
            id: 'system-1',
            label: 'System',
            description: null,
            rulesetCode: 'dnd5e',
            rulesetVersion: '2014',
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
        ]
      },
      shared: {
        charges: [
          {
            id: 'charge-1',
            scalingKind: 'NONE',
            resetKind: 'LONG_REST',
            limitKind: 'FIXED_AMOUNT',
            amount: 1
          }
        ],
        details: [{ id: 'detail-1', label: 'Detail', description: 'Description', order: 1 }],
        savingThrows: [{ id: 'save-1', ability: 'DEXTERITY', dcMethod: 'FIXED_DC', baseDc: 14 }],
        startingEquipment: [{ id: 'se-1', sets: [] }]
      },
      effects: {
        effects: []
      },
      features: {
        features: [],
        options: []
      },
      grants: {
        feats: [],
        modifiers: [],
        proficiencies: [],
        senses: [],
        spells: []
      },
      subjects: {
        backgrounds: [],
        classes: [],
        creatures: [],
        equipment: [],
        feats: [],
        races: [],
        spells: [],
        vehicles: []
      }
    })

    const { db } = createSeedTransactionDb()
    const result = await seedBaselineContent(
      { db: db as unknown as DBLike, systemId: 'system-1' },
      bundle
    )

    expect(wrapperCalls).toEqual([
      'upsertSystem'
    ])
    expect(result).toEqual({
      systems: 1,
      domainRoots: 0
    })
  })

  it('pins an equipment variant to the exact published parent version', async () => {
    const variant = srdBaselineContent.subjects.equipment.find(
      (equipment) => equipment.category === 'VARIANT'
    )
    if (!variant || variant.category !== 'VARIANT') {
      throw new Error('SRD fixture is missing an equipment variant.')
    }
    const parent = srdBaselineContent.subjects.equipment.find(
      (equipment) => equipment.id === variant.parentEquipmentId
    )
    if (!parent || parent.category === 'VARIANT') {
      throw new Error('SRD fixture is missing the equipment variant parent.')
    }

    const bundle = createEmptyBundle(variant.systemId)
    bundle.subjects.equipment.push(variant, parent)

    const { db } = createSeedTransactionDb()
    await seedBaselineContent({ db: db as unknown as DBLike, systemId: variant.systemId }, bundle)

    const parentVersion = versionState.activeBySubject.get(`EQUIPMENT:${parent.id}`)
    const variantPublish = versionState.publish.mock.calls
      .map(([input]) => input)
      .find((input) => input.subjectId === variant.id)

    expect(parentVersion).toBeDefined()
    expect(variantPublish).toEqual(
      expect.objectContaining({
        subjectKind: 'EQUIPMENT',
        subjectId: variant.id,
        authoredDependencies: [
          {
            subjectKind: 'EQUIPMENT',
            subjectId: parent.id,
            versionId: parentVersion?.authored.versionId,
            version: parentVersion?.authored.version,
            checksum: parentVersion?.authored.checksum
          }
        ]
      })
    )
  })

  it('writes the seeded Spell index against the exact published version', async () => {
    const spell = srdBaselineContent.subjects.spells[0]
    if (!spell) throw new Error('SRD spell fixture is missing.')
    const bundle = createEmptyBundle(spell.systemId)
    bundle.subjects.spells.push(spell)
    const { db } = createSeedTransactionDb()

    await seedBaselineContent({ db: db as unknown as DBLike, systemId: spell.systemId }, bundle)

    const published = versionState.activeBySubject.get(`SPELL:${spell.id}`)
    expect(published).toBeDefined()
    expect(versionState.syncSpellCatalogClassIndex).toHaveBeenCalledWith(db, {
      authoredVersionId: published?.authored.versionId,
      classIds: spell.classIds,
      spellId: spell.id
    })
  })

  it('repairs the indexed Spell version without republishing an unchanged seed', async () => {
    const spell = srdBaselineContent.subjects.spells[0]
    if (!spell) throw new Error('SRD spell fixture is missing.')
    const bundle = createEmptyBundle(spell.systemId)
    bundle.subjects.spells.push(spell)
    const system = bundle.vocabulary.systems[0]
    if (!system) throw new Error('Baseline system fixture is missing.')
    const vocabularyDocument = systemVocabularySnapshotSchema.parse({
      snapshotId: 'snapshot-1',
      systemId: system.id,
      snapshotVersion: 1,
      schemaVersion: 1,
      checksum: '0'.repeat(64),
      document: system
    }).document
    const vocabularySnapshot = {
      checksum: checksumSystemVocabularySnapshot({
        snapshotId: 'snapshot-1',
        systemId: system.id,
        snapshotVersion: 1,
        schemaVersion: 1,
        document: vocabularyDocument
      }),
      document: vocabularyDocument,
      schemaVersion: 1,
      snapshotId: 'snapshot-1',
      snapshotVersion: 1,
      systemId: system.id
    }
    versionState.vocabularyPublish.mockResolvedValue(vocabularySnapshot)
    const { db } = createSeedTransactionDb()

    await seedBaselineContent({ db: db as unknown as DBLike, systemId: spell.systemId }, bundle)

    const [[publishInput]] = versionState.publish.mock.calls
    if (!publishInput) throw new Error('Spell seed did not publish an authored version.')
    versionState.vocabularyFindActiveForPublication.mockResolvedValue(vocabularySnapshot)
    const activeVersion = {
      authored: {
        checksum: publishInput.authoredChecksum,
        document: publishInput.document,
        subjectId: publishInput.subjectId,
        subjectKind: publishInput.subjectKind,
        version: 1,
        versionId: publishInput.versionId
      },
      compiled: {
        compilerVersion: publishInput.compilerVersion,
        projectionChecksum: checksumCompiledAuthoredProjection({
          authoredChecksum: publishInput.authoredChecksum,
          authoredDependencies: publishInput.authoredDependencies,
          authoredVersion: 1,
          authoredVersionId: publishInput.versionId,
          compilerVersion: publishInput.compilerVersion,
          projection: publishInput.compiledDocument,
          projectionSchemaVersion: publishInput.projectionSchemaVersion,
          subjectId: publishInput.subjectId,
          subjectKind: publishInput.subjectKind,
          vocabularySnapshotChecksum: publishInput.vocabularySnapshotChecksum,
          vocabularySnapshotId: publishInput.vocabularySnapshotId,
          vocabularySnapshotVersion: publishInput.vocabularySnapshotVersion
        }),
        vocabularySnapshotId: publishInput.vocabularySnapshotId
      }
    }
    versionState.findActiveForPublication.mockResolvedValue(activeVersion)

    await seedBaselineContent({ db: db as unknown as DBLike, systemId: spell.systemId }, bundle)

    expect(versionState.vocabularyPublish).toHaveBeenCalledOnce()
    expect(versionState.publish).toHaveBeenCalledOnce()
    expect(versionState.syncSpellCatalogClassIndex).toHaveBeenCalledTimes(2)
    expect(versionState.syncSpellCatalogClassIndex).toHaveBeenLastCalledWith(db, {
      authoredVersionId: publishInput.versionId,
      classIds: spell.classIds,
      spellId: spell.id
    })
  })

  it('throws when the requested system is missing from the bundle', async () => {
    const bundle = defineBaselineContentBundle({
      vocabulary: {
        systems: []
      },
      shared: {
        charges: [],
        details: [],
        savingThrows: [],
        startingEquipment: []
      },
      effects: {
        effects: []
      },
      features: {
        features: [],
        options: []
      },
      grants: {
        feats: [],
        modifiers: [],
        proficiencies: [],
        senses: [],
        spells: []
      },
      subjects: {
        backgrounds: [],
        classes: [],
        creatures: [],
        equipment: [],
        feats: [],
        races: [],
        spells: [],
        vehicles: []
      }
    })

    const { db } = createSeedTransactionDb()
    await expect(
      seedBaselineContent({ db: db as unknown as DBLike, systemId: 'missing-system' }, bundle)
    ).rejects.toThrow('Missing system seed record')
  })

  it('removes stale master subjects across every root domain while preserving owned, current, and other-system records', async () => {
    const bundle = createEmptyBundle()
    bundle.subjects.backgrounds.push({
      kind: 'BACKGROUND',
      id: 'current-background',
      label: 'Current background',
      description: 'Current background description',
      systemId: 'system-1',
      userId: 'user-1'
    })

    const staleSubjects = [
      ['backgrounds', 'BACKGROUND'],
      ['classes', 'CLASS'],
      ['creatures', 'CREATURE'],
      ['equipment', 'EQUIPMENT'],
      ['feats', 'FEAT'],
      ['races', 'RACE'],
      ['spells', 'SPELL'],
      ['vehicles', 'VEHICLE']
    ] as const
    const initialTables: SeedTables = {
      backgrounds: [
        { id: 'stale-backgrounds', system_id: 'system-1', is_master: true },
        { id: 'current-background', system_id: 'system-1', is_master: true },
        { id: 'owned-background', system_id: 'system-1', is_master: false },
        { id: 'other-system-background', system_id: 'system-2', is_master: true }
      ],
      authored_route_ids: [
        { subject_id: 'current-background', subject_kind: 'BACKGROUND' },
        { subject_id: 'owned-background', subject_kind: 'BACKGROUND' }
      ]
    }

    for (const [table, subjectKind] of staleSubjects) {
      if (table !== 'backgrounds') {
        initialTables[table] = [{ id: `stale-${table}`, system_id: 'system-1', is_master: true }]
      }
      initialTables.authored_route_ids?.push({
        subject_id: `stale-${table}`,
        subject_kind: subjectKind
      })
    }

    const { db, tables } = createSeedTransactionDb(initialTables)
    await seedBaselineContent({ db: db as unknown as DBLike, systemId: 'system-1' }, bundle)

    for (const [table] of staleSubjects) {
      expect(tables[table]).not.toContainEqual(expect.objectContaining({ id: `stale-${table}` }))
    }
    expect(tables.backgrounds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'current-background' }),
        expect.objectContaining({ id: 'owned-background', is_master: false }),
        expect.objectContaining({ id: 'other-system-background', system_id: 'system-2' })
      ])
    )
    expect(tables.authored_route_ids).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subject_id: 'current-background' }),
        expect.objectContaining({ subject_id: 'owned-background' })
      ])
    )
    expect(tables.authored_route_ids).toHaveLength(2)
  })

  it('runs pruning and all writes through one outer transaction', async () => {
    const bundle = createEmptyBundle()
    const transaction = createSeedTransactionDb()
    const execute = vi.fn(async (callback: (db: unknown) => Promise<unknown>) =>
      callback(transaction.db)
    )
    const db = {
      isTransaction: false,
      transaction: () => ({ execute })
    }

    await seedBaselineContent({ db: db as unknown as DBLike, systemId: 'system-1' }, bundle)

    expect(execute).toHaveBeenCalledOnce()
    expect(wrapperDatabases).not.toHaveLength(0)
    expect(wrapperDatabases.every((wrapperDb) => wrapperDb === transaction.db)).toBe(true)
    expect(transaction.operations[0]).toEqual({ operation: 'select', table: 'backgrounds' })
  })
})
