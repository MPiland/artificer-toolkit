import { afterEach, expect, it, vi } from 'vitest'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { resolveEquipmentAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import { createCharacterBuilderCatalog } from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'
import * as relationships from '../content/equipmentRelationships'
import { loadCharacterBuilderContext } from './builderContext'

afterEach(() => vi.restoreAllMocks())

it.each([
  ['missing parent', 'Readable parent Equipment in the same System is required.'],
  ['metadata mismatch', 'Stored Equipment parent metadata mismatch.']
] as const)('rejects catalogue inheritance with %s', async (failure, message) => {
  const child = { ...clubPlus1, parentEquipmentId: backpack.id }
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [backpack, child].map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      )
    ]
  )
  await t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) =>
        q.eq('id', failure === 'missing parent' ? backpack.id : child.id)
      )
      .unique()
    if (!root) throw new Error('Missing Equipment fixture.')
    if (failure === 'missing parent') await ctx.db.delete(root._id)
    else await ctx.db.patch(root._id, { parentEquipmentId: null })
  })
  const character = createEmptyCharacterAuthored({
    id: crypto.randomUUID(),
    systemId: srdSystemRecord.id,
    userId: first.userId
  })
  await expect(
    t.run((ctx) => loadCharacterBuilderContext(ctx, character, first.userId, 'resolution'))
  ).rejects.toThrow(message)
})

it('resolves the complete authorized Equipment catalogue without compiling unused mechanics', async () => {
  const base = { ...backpack, label: 'Z parent', maxStack: 5 }
  const child = {
    ...clubPlus1,
    label: 'A child',
    parentEquipmentId: base.id,
    requiresAttunement: true
  }
  const grandchild = {
    ...clubPlus1,
    id: crypto.randomUUID(),
    label: 'A grandchild',
    parentEquipmentId: child.id
  }
  const documents = [base, child, grandchild]
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      documents.map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      )
    ]
  )
  const character = createEmptyCharacterAuthored({
    id: crypto.randomUUID(),
    systemId: srdSystemRecord.id,
    userId: first.userId
  })
  const compile = vi.spyOn(relationships, 'compileCurrentEquipment')
  const result = await t.run(async (ctx) => {
    const queries = vi.spyOn(ctx.db, 'query')
    const context = await loadCharacterBuilderContext(ctx, character, first.userId, 'resolution')
    // Platform and owned source sets are read once, not again for each catalogue item.
    expect(queries.mock.calls.filter(([table]) => table === 'contentSources')).toHaveLength(2)
    return context.catalog.equipment
  })
  const expected = createCharacterBuilderCatalog({
    system: srdSystemRecord,
    races: [],
    classes: [],
    backgrounds: [],
    equipment: [...documents]
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((document) =>
        resolveEquipmentAuthored(document, (id) => documents.find((parent) => parent.id === id))
      ),
    feats: [],
    spells: []
  }).equipment
  expect(result).toEqual(expected)
  expect(result.find((row) => row.id === grandchild.id)).toMatchObject({
    category: 'ADVENTURING_GEAR',
    isContainer: true,
    maxStack: 5,
    requiresAttunement: true,
    properties: ['CONTAINER', 'MAGIC']
  })
  expect(compile).not.toHaveBeenCalled()
})

async function materializeEquipment(
  t: Awaited<ReturnType<typeof publicationFixture>>['t'],
  documents: readonly { id: string }[]
) {
  for (const document of documents)
    await t.mutation(internal.content.import.syncEquipmentDerived, {
      id: document.id,
      checksum: checksumRuleDocument(document)
    })
}

it('uses materialized Equipment catalogue facts without reading unselected versions', async () => {
  const base = { ...backpack, label: 'Z parent', maxStack: 5 }
  const child = {
    ...clubPlus1,
    label: 'A child',
    parentEquipmentId: base.id,
    requiresAttunement: true
  }
  const grandchild = {
    ...clubPlus1,
    id: crypto.randomUUID(),
    label: 'A grandchild',
    parentEquipmentId: child.id
  }
  const unselected = { ...backpack, id: crypto.randomUUID(), label: 'Unused pack' }
  const documents = [base, child, grandchild, unselected]
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      documents.map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      )
    ]
  )
  await materializeEquipment(t, documents)
  const empty = createEmptyCharacterAuthored({
    id: crypto.randomUUID(),
    systemId: srdSystemRecord.id,
    userId: first.userId
  })
  const character = {
    ...empty,
    state: {
      ...empty.state,
      equipment: {
        ...empty.state.equipment,
        inventory: [{ id: crypto.randomUUID(), equipmentId: grandchild.id, quantity: 1 }]
      }
    }
  }
  const result = await t.run(async (ctx) => {
    const unselectedRoot = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', unselected.id))
      .unique()
    const selectedRoot = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', grandchild.id))
      .unique()
    if (!unselectedRoot || !selectedRoot) throw new Error('Missing Equipment fixture.')
    const reads = vi.spyOn(ctx.db, 'get')
    const context = await loadCharacterBuilderContext(ctx, character, first.userId, 'resolution')
    const versionReads = reads.mock.calls.map(([id]) => id)
    return {
      catalogue: context.catalog.equipment,
      selectedEquipment: context.registry.equipment.map((equipment) => equipment.id),
      unselectedVersionReads: versionReads.filter((id) => id === unselectedRoot.currentVersionId),
      selectedVersionReads: versionReads.filter((id) => id === selectedRoot.currentVersionId)
    }
  })
  const expected = createCharacterBuilderCatalog({
    system: srdSystemRecord,
    races: [],
    classes: [],
    backgrounds: [],
    equipment: [...documents]
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((document) =>
        resolveEquipmentAuthored(document, (id) => documents.find((parent) => parent.id === id))
      ),
    feats: [],
    spells: []
  }).equipment
  expect(result.catalogue).toEqual(expected)
  expect(result.unselectedVersionReads).toEqual([])
  expect(result.selectedVersionReads).toHaveLength(1)
  expect(result.selectedEquipment).toEqual([grandchild.id])
})

it.each([
  ['missing parent', 'Readable parent Equipment in the same System is required.'],
  ['cycle', 'Equipment variant cycle detected.'],
  ['metadata mismatch', 'Stored Equipment parent metadata mismatch.'],
  ['checksum mismatch', 'Stored Equipment builder facts are missing or stale.']
] as const)(
  'rejects invalid materialized Equipment catalogue facts: %s',
  async (failure, message) => {
    const base = { ...backpack, label: 'Base pack' }
    const child = { ...clubPlus1, parentEquipmentId: base.id }
    const documents = [base, child]
    const { t, first } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        documents.map((document) =>
          importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
        )
      ]
    )
    await materializeEquipment(t, documents)
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', child.id))
        .unique()
      if (!root?.equipmentOptions?.builder) throw new Error('Missing Equipment projection fixture.')
      if (failure === 'missing parent') {
        const parent = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', base.id))
          .unique()
        if (!parent) throw new Error('Missing parent fixture.')
        await ctx.db.delete(parent._id)
      } else if (failure === 'cycle') {
        await ctx.db.patch(root._id, {
          parentEquipmentId: child.id,
          equipmentOptions: {
            ...root.equipmentOptions,
            builder: { ...root.equipmentOptions.builder, parentEquipmentId: child.id }
          }
        })
      } else if (failure === 'metadata mismatch') {
        await ctx.db.patch(root._id, { parentEquipmentId: null })
      } else {
        await ctx.db.patch(root._id, {
          equipmentOptions: { ...root.equipmentOptions, checksum: '0'.repeat(64) }
        })
      }
    })
    const character = createEmptyCharacterAuthored({
      id: crypto.randomUUID(),
      systemId: srdSystemRecord.id,
      userId: first.userId
    })
    await expect(
      t.run((ctx) => loadCharacterBuilderContext(ctx, character, first.userId, 'resolution'))
    ).rejects.toThrow(message)
  }
)

it('fails closed when any Equipment catalogue fact lacks its builder projection', async () => {
  const base = { ...backpack, label: 'Z parent', maxStack: 5 }
  const child = { ...clubPlus1, label: 'A child', parentEquipmentId: base.id }
  const documents = [base, child]
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      documents.map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      )
    ]
  )
  await materializeEquipment(t, documents)
  await t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', child.id))
      .unique()
    if (!root?.equipmentOptions) throw new Error('Missing Equipment projection fixture.')
    const { builder: _builder, ...legacyFacts } = root.equipmentOptions
    await ctx.db.patch(root._id, { equipmentOptions: legacyFacts })
  })
  const character = createEmptyCharacterAuthored({
    id: crypto.randomUUID(),
    systemId: srdSystemRecord.id,
    userId: first.userId
  })
  // D163: the catalogue reads stored builder facts only and never falls back to payloads.
  await expect(
    t.run((ctx) => loadCharacterBuilderContext(ctx, character, first.userId, 'resolution'))
  ).rejects.toThrow('Stored Equipment builder facts are missing or stale.')
})
it('rejects corrupt materialized facts even when another Equipment root needs backfill', async () => {
  const base = { ...backpack, label: 'Z parent' }
  const child = { ...clubPlus1, label: 'A child', parentEquipmentId: base.id }
  const documents = [base, child]
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      documents.map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      )
    ]
  )
  await materializeEquipment(t, documents)
  await t.run(async (ctx) => {
    const [parent, variant] = await Promise.all(
      [base.id, child.id].map((id) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    )
    if (!parent?.equipmentOptions || !variant?.equipmentOptions) {
      throw new Error('Missing Equipment projection fixture.')
    }
    const { builder: _builder, ...legacyFacts } = variant.equipmentOptions
    await ctx.db.patch(variant._id, { equipmentOptions: legacyFacts })
    await ctx.db.patch(parent._id, {
      equipmentOptions: { ...parent.equipmentOptions, checksum: '0'.repeat(64) }
    })
  })
  const character = createEmptyCharacterAuthored({
    id: crypto.randomUUID(),
    systemId: srdSystemRecord.id,
    userId: first.userId
  })
  await expect(
    t.run((ctx) => loadCharacterBuilderContext(ctx, character, first.userId, 'resolution'))
  ).rejects.toThrow('Stored Equipment builder facts are missing or stale.')
})
