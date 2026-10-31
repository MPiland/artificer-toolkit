import migrations from '@convex-dev/migrations/test'
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { arrows } from '@artificer-toolkit/source-data/srd/equipment/arrows.js'
import { arrowsPlus1 } from '@artificer-toolkit/source-data/srd/equipment/arrows-plus-1.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { dwarf, hillDwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts'
import { SUBJECT_COMPILER_VERSION } from '@artificer-toolkit/schema/api/authoredPublication'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { characterCollectionRecord } from '@artificer-toolkit/schema/projections/characterOperationalState'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { equipmentPresentation } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import {
  resolveEquipmentAuthored,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import { collectReferenceIds } from '@artificer-toolkit/shared/utils'
import {
  classDerivedArgs,
  importedSubject,
  makePublishedRootOwned,
  publicationFixture
} from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import {
  readAuthoredVersionCompilation,
  readAuthoredVersionCompilationRow,
  readStoredAuthoredVersionDocument,
  syncCanonicalCompilation
} from './documents'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'
import { readStoredSourceFacts, writeSourceFacts } from './sourceFacts'

/** The runner migrates one row per scheduled batch, so a full pass exceeds convex-test's 100. */
const MIGRATION_BATCHES = 2000
const runMigration = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'content/compilationMigration:run'
)

const sources = [
  { subjectKind: 'BACKGROUND' as const, document: acolyte },
  { subjectKind: 'CLASS' as const, document: fighter },
  { subjectKind: 'EQUIPMENT' as const, document: arrows },
  { subjectKind: 'EQUIPMENT' as const, document: arrowsPlus1 },
  { subjectKind: 'RACE' as const, document: dwarf },
  { subjectKind: 'RACE' as const, document: hillDwarf }
]
const sourceIds = new Set(sources.map(({ document }) => document.id))
const documents = sources.map(({ document }) => document)
const spellIds = new Set(collectReferenceIds(documents, 'spellId', 'spellIds'))
const equipmentIds = new Set(collectReferenceIds(documents, 'equipmentId', 'equipmentIds'))
const referenced = [
  ...srdSpells
    .filter((spell) => spellIds.has(spell.id))
    .map((spell) => importedSubject({ subjectKind: 'SPELL', ...spell, document: spell })),
  ...srdEquipment
    .filter((equipment) => equipmentIds.has(equipment.id) && !sourceIds.has(equipment.id))
    .map((equipment) =>
      importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })
    )
]

function stored(document: unknown) {
  return jsonValueSchema.parse(JSON.parse(JSON.stringify(document)))
}

/** The current compilation each subject's publication stores, from the real compilers. */
function currentCompilation(source: (typeof sources)[number]) {
  const subject = parsePublicationDocument(source.subjectKind, stored(source.document))
  if (subject.subjectKind === 'EQUIPMENT')
    return compilePublicationDocument(
      subject,
      resolveEquipmentAuthored(source.document as typeof arrowsPlus1, (id) =>
        id === arrows.id ? arrows : undefined
      )
    )
  if (subject.subjectKind === 'RACE')
    return compilePublicationDocument(
      subject,
      resolveRaceAuthored(source.document as typeof hillDwarf, (id) =>
        id === dwarf.id ? dwarf : undefined
      )
    )
  return compilePublicationDocument(subject)
}

async function readVersion(ctx: MutationCtx, id: string) {
  const version = await ctx.db
    .query('authoredVersions')
    .withIndex('by_id_version', (query) => query.eq('id', id))
    .unique()
  if (!version) throw new Error(`${id} was not imported.`)
  return version
}

/** Rewrites each source's stored compilation as an older compiler left it. */
async function supersede(ctx: MutationCtx, current: ReturnType<typeof currentCompilation>[]) {
  for (const [index, { document }] of sources.entries()) {
    const version = await readVersion(ctx, document.id)
    const superseded = {
      ...current[index]!,
      compilerVersion: 'subject-compiler-v1' as const,
      projectionJson: '{}'
    }
    const row = await readAuthoredVersionCompilationRow(ctx, version)
    if (row) await ctx.db.patch(row._id, { compilation: superseded })
    else
      await ctx.db.insert('authoredVersionCompilations', {
        subjectId: version.id,
        systemId: version.systemId,
        versionId: version.versionId,
        compilation: superseded
      })
  }
}

function fixtureBatches() {
  return [
    sources.map((source) =>
      importedSubject({ ...source, ...source.document, document: source.document })
    ),
    ...Array.from({ length: Math.ceil(referenced.length / 10) }, (_, index) =>
      referenced.slice(index * 10, index * 10 + 10)
    )
  ]
}

it('re-seeds superseded canonical compilations and refuses to re-seed authored content', async () => {
  const { t } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    fixtureBatches()
  )
  const current = sources.map(currentCompilation)
  const ownerUserId = crypto.randomUUID()
  await t.run(async (ctx) => {
    await makePublishedRootOwned(ctx, acolyte.id, ownerUserId)
    await supersede(ctx, current)
  })

  // The seed replays every canonical subject, then runs its derived syncs, in its order.
  for (const subject of fixtureBatches()[0]!.filter(({ id }) => id !== acolyte.id))
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [subject]
    })
  await t.mutation(
    internal.content.import.syncClassDerived,
    classDerivedArgs(importedSubject({ subjectKind: 'CLASS', ...fighter, document: fighter }))
  )
  for (const race of [dwarf, hillDwarf])
    await t.mutation(internal.content.raceRelationships.syncDerived, {
      id: race.id,
      checksum: (await t.run((ctx) => readVersion(ctx, race.id))).checksum
    })
  for (const equipment of [arrows, arrowsPlus1])
    await t.mutation(internal.content.import.syncEquipmentDerived, {
      id: equipment.id,
      checksum: (await t.run((ctx) => readVersion(ctx, equipment.id))).checksum
    })

  const reseeded = await t.run(async (ctx) =>
    Promise.all(
      sources.map(async ({ document }) =>
        readAuthoredVersionCompilationRow(ctx, await readVersion(ctx, document.id)).then(
          (row) => row?.compilation
        )
      )
    )
  )
  // The seed re-syncs no Background; the owned Acolyte keeps the compilation an older compiler left.
  expect(reseeded).toEqual([
    expect.objectContaining({ compilerVersion: 'subject-compiler-v1' }),
    ...current.slice(1)
  ])

  await t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (query) => query.eq('id', acolyte.id))
      .unique()
    if (!root) throw new Error('Acolyte was not imported.')
    const version = await readVersion(ctx, acolyte.id)
    await expect(syncCanonicalCompilation(ctx, root, version, current[0]!)).rejects.toThrow(
      'Only canonical content re-seeds its compilation.'
    )
    await expect(readAuthoredVersionCompilation(ctx, version)).rejects.toThrow(
      'Stored compilation is superseded; run content/compilationMigration.'
    )
  })
})

it('re-derives the unversioned source facts of an authored row from its stored document', async ({
  onTestFinished
}) => {
  const { t } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    fixtureBatches()
  )
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(t)
  const ownerUserId = crypto.randomUUID()
  const expected = await t.run(async (ctx) => {
    await makePublishedRootOwned(ctx, acolyte.id, ownerUserId)
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (query) => query.eq('id', acolyte.id))
      .unique()
    if (!root) throw new Error('Acolyte was not imported.')
    const version = await readVersion(ctx, acolyte.id)
    const facts = authoredSourceFacts({
      ...parsePublicationDocument(
        'BACKGROUND',
        await readStoredAuthoredVersionDocument(ctx, version)
      ),
      checksum: root.checksum
    })
    // An older derivation left no version and no rows for a table the current one derives.
    const tables = Object.keys(facts.rows)
    expect(tables.length).toBeGreaterThan(1)
    await writeSourceFacts(ctx, root.id, {
      checksum: root.checksum,
      rows: Object.fromEntries(
        Object.entries(facts.rows).filter(([table]) => table !== tables.at(-1))
      )
    })
    return facts
  })

  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)

  const migrated = await t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (query) => query.eq('id', acolyte.id))
      .unique()
    return { root, facts: root && (await readStoredSourceFacts(ctx, root)) }
  })
  expect(migrated.root?.ownerUserId).toBe(ownerUserId)
  expect(migrated.facts).toEqual(expected)
})

it('recompiles every superseded stored compilation at the current compiler version', async ({
  onTestFinished
}) => {
  const { t } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    fixtureBatches()
  )
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(t)

  const current = sources.map(currentCompilation)
  expect(current.map((compilation) => compilation.compilerVersion)).toEqual(
    sources.map(() => SUBJECT_COMPILER_VERSION)
  )
  await t.run((ctx) => supersede(ctx, current))

  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)
  // A second pass proves the migration leaves current rows alone.
  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)

  const migrated = await t.run(async (ctx) =>
    Promise.all(
      sources.map(async ({ document }) =>
        readAuthoredVersionCompilationRow(ctx, await readVersion(ctx, document.id)).then(
          (row) => row?.compilation
        )
      )
    )
  )
  expect(migrated).toEqual(current)
})

it('backfills the root ACTIVE fact, picker facts and Equipment quote of roots stored before them (D163)', async ({
  onTestFinished
}) => {
  const { t } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    fixtureBatches()
  )
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(t)
  const catalogues = () =>
    t.run(async (ctx) =>
      (await ctx.db.query('authoredRoots').collect()).map((root) => ({
        id: root.id,
        subjectKind: root.subjectKind,
        catalogue: root.catalogue
      }))
    )
  const published = await catalogues()
  expect(
    published.filter(
      ({ catalogue }) => catalogue?.race ?? catalogue?.class ?? catalogue?.background
    )
  ).toHaveLength(sources.filter(({ subjectKind }) => subjectKind !== 'EQUIPMENT').length)
  // Every Equipment root, the fixture's and those its sources reference, carries the quote fact.
  const equipmentRoots = published.filter(({ subjectKind }) => subjectKind === 'EQUIPMENT')
  expect(equipmentRoots.length).toBeGreaterThanOrEqual(
    sources.filter(({ subjectKind }) => subjectKind === 'EQUIPMENT').length
  )
  expect(published.filter(({ catalogue }) => catalogue?.equipment)).toEqual(equipmentRoots)
  await t.run(async (ctx) => {
    for (const root of await ctx.db.query('authoredRoots').collect()) {
      if (!root.catalogue) continue
      const {
        publishedActive: _publishedActive,
        race: _race,
        class: _class,
        background: _background,
        equipment: _equipment,
        ...stored
      } = root.catalogue
      await ctx.db.patch(root._id, { catalogue: stored })
    }
  })

  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)
  expect(await catalogues()).toEqual(published)
})

it('repins legacy retained rules to the stored compilation of the same version, with its prose', async ({
  onTestFinished
}) => {
  const { t } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [arrows, arrowsPlus1].map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      )
    ]
  )
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  migrations.register(t)
  // As the seed does, the variant compiles once its parent exists.
  const variant = await t.run((ctx) => readVersion(ctx, arrowsPlus1.id))
  await t.mutation(internal.content.import.syncEquipmentDerived, {
    id: arrowsPlus1.id,
    checksum: variant.checksum
  })
  const characterId = crypto.randomUUID()
  const itemId = crypto.randomUUID()

  const { leaf, legacyJson } = await t.run(async (ctx) => {
    const pinned = await Promise.all(
      [arrowsPlus1, arrows].map(async (document) => {
        const version = await readVersion(ctx, document.id)
        const compilation = await readAuthoredVersionCompilation(ctx, version)
        if (!compilation) throw new Error(`${document.id} has no stored compilation.`)
        return {
          identity: {
            subjectKind: 'EQUIPMENT' as const,
            subjectId: document.id,
            versionId: version.versionId,
            version: version.version,
            checksum: compilation.authoredChecksum
          },
          compilation,
          document,
          systemId: version.systemId
        }
      })
    )
    const legacyJson = JSON.stringify({
      equipmentId: arrowsPlus1.id,
      systemId: pinned[0]!.systemId,
      sources: pinned.map(({ identity, document }) => ({
        ...identity,
        documentJson: JSON.stringify(document)
      }))
    })
    await ctx.db.insert(
      'characterInventoryItems',
      characterCollectionRecord(characterId, itemId, 0, {
        id: itemId,
        equipmentId: arrowsPlus1.id,
        quantity: 1,
        retainedRulesJson: legacyJson
      })
    )
    return { leaf: pinned[0]!, legacyJson }
  })
  expect(acquiredEquipmentRulesSchema.safeParse(JSON.parse(legacyJson)).success).toBe(false)

  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)
  const readRow = () =>
    t.run((ctx) =>
      ctx.db
        .query('characterInventoryItems')
        .withIndex('by_characterId_id', (query) =>
          query.eq('characterId', characterId).eq('id', itemId)
        )
        .unique()
    )
  const row = await readRow()
  if (!row?.value.retainedRulesJson) throw new Error('Retained rules were lost.')
  // The variant's parent is folded into the leaf's resolved compilation, so only the leaf stays.
  expect(acquiredEquipmentRulesSchema.parse(JSON.parse(row.value.retainedRulesJson))).toEqual({
    equipmentId: arrowsPlus1.id,
    systemId: leaf.systemId,
    sources: [
      {
        ...leaf.identity,
        compilation: leaf.compilation,
        presentation: equipmentPresentation(arrowsPlus1)
      }
    ]
  })
  expect(row.checksum).toBe(
    characterCollectionRecord(row.characterId, row.id, row.position, row.value).checksum
  )

  // A second pass leaves pinned rows alone.
  await t.mutation(runMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers, MIGRATION_BATCHES)
  expect(await readRow()).toEqual(row)
})
