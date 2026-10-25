import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import * as nodeRuntime from '@artificer-toolkit/authoring/nodeRuntime'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { sorcerer } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  authoredPublicationNameBackfillInputSchema,
  authoredPublishDraftInputSchema,
  type AuthoredPublicationNameBackfillInput,
  type AuthoredPublicationNameBackfillResult,
  type AuthoredDeleteActiveInput,
  type AuthoredPublicationResult,
  type AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import type { AuthoredCatalogueSearchBackfillResult } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { compileSubjectWithMechanicsIndex } from '@artificer-toolkit/shared/subjects/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api, components, internal } from '../_generated/api'
import {
  classDerivedArgs,
  importedSubject,
  importSeededSubjects,
  publicationFixture,
  setVersionCompilation,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { readVisibleCatalogue } from '../../tests/fixtures/contentSnapshotReaders'
import { assertPreparedClassDocument, readPublicationState } from './publicationPersistence'
import { readStoredAuthoredVersionDocument } from './documents'

const equipmentIds = new Set([
  '00000000-0000-0000-0060-002f00000000',
  '00000000-0000-0000-0060-002700000000',
  '00000000-0000-0000-0060-002400000000',
  '00000000-0000-0000-0060-006300000000',
  '00000000-0000-0000-0060-000b00000000',
  '00000000-0000-0000-0060-006500000000',
  '00000000-0000-0000-0060-000400000000',
  '00000000-0000-0000-0060-00b800000000',
  '00000000-0000-0000-0060-00ba00000000'
])

const publish = makeFunctionReference<
  'action',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/classPublicationActions:publishDraft')
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)
const nameBackfill = makeFunctionReference<
  'mutation',
  AuthoredPublicationNameBackfillInput,
  AuthoredPublicationNameBackfillResult
>('content/publicationNames:backfill')

const fighterSubject = importedSubject({
  subjectKind: 'CLASS',
  ...fighter,
  document: fighter
})
const championSubject = importedSubject({
  subjectKind: 'CLASS',
  ...championMartialArchetype,
  document: championMartialArchetype
})

const classDerived = classDerivedArgs
const fighterDerived = classDerived(fighterSubject)

async function fixture() {
  const result = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        fighterSubject,
        ...srdBaselineContent.subjects.equipment
          .filter((item) => equipmentIds.has(item.id))
          .map((item) =>
            importedSubject({
              subjectKind: 'EQUIPMENT',
              ...item,
              document: item
            })
          )
      ],
      [championSubject]
    ]
  )
  await result.t.mutation(internal.content.import.syncClassDerived, fighterDerived)
  await result.t.mutation(internal.content.import.syncClassDerived, classDerived(championSubject))
  return result
}

async function copyDraft(
  caller: Awaited<ReturnType<typeof fixture>>['first']['caller'],
  subjectId: string
) {
  return caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'CLASS',
    subjectId
  })
}

function publicationInput(draft: AuthoredDraftResult) {
  return authoredPublishDraftInputSchema.parse({
    subjectKind: 'CLASS',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

async function importCrossSystemBase(t: Awaited<ReturnType<typeof fixture>>['t']) {
  const systemId = crypto.randomUUID()
  const sourceId = crypto.randomUUID()
  const catalogueId = crypto.randomUUID()
  const classId = crypto.randomUUID()
  const system = { ...srdSystemRecord, id: systemId }
  await t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: systemId,
        document: jsonValueSchema.parse(JSON.parse(JSON.stringify(system))),
        checksum: checksumRuleDocument(system)
      }
    ],
    contentSource: {
      ...SRD_CONTENT_SOURCE,
      id: sourceId,
      gameSystemId: systemId
    },
    catalogue: {
      ...SRD_RULES_CATALOGUE,
      id: catalogueId,
      gameSystemId: systemId
    }
  })
  await importSeededSubjects(t, {
    contentSourceId: sourceId,
    subjects: [
      importedSubject({
        subjectKind: 'CLASS',
        id: classId,
        systemId,
        label: fighter.label,
        document: { ...fighter, id: classId, systemId }
      })
    ]
  })
  return classId
}

describe('native Class publication', () => {
  it('renames only UUID-family catalogue keys and rolls back the entire rename if a child is invalid', async () => {
    const { t, first, second } = await fixture()
    const base = await copyDraft(first.caller, fighter.id)
    await first.caller.action(publish, publicationInput(base))
    const copied = await copyDraft(first.caller, championMartialArchetype.id)
    const child = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: copied.subjectId,
      systemId: copied.systemId,
      label: 'Independent child name',
      payload: { ...copied.payload, parentClassId: base.subjectId }
    })
    await first.caller.action(publish, publicationInput(child))
    const workingDraft = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: child.subjectId,
      systemId: child.systemId,
      label: 'Unsaved publication working draft',
      payload: child.payload
    })
    const readChild = () =>
      t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', child.subjectId))
          .unique()
        if (!root) throw new Error('Missing child')
        return {
          root,
          version: await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
        }
      })
    const before = await readChild()
    const renamed = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: 'Aardvark',
      payload: base.payload
    })
    await first.caller.action(publish, publicationInput(renamed))
    const after = await readChild()
    expect(after).toEqual({
      ...before,
      root: {
        ...before.root,
        catalogueFamily: { id: base.subjectId, nameKey: 'aardvark' }
      }
    })
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'CLASS',
        subjectId: child.subjectId
      })
    ).toEqual(workingDraft)
    const listed = await readVisibleCatalogue(t, first.caller, 'CLASS', {
      source: 'OWNED'
    })
    expect(listed.find((item) => item.id === child.subjectId)).toMatchObject({
      label: 'Independent child name',
      parentClassId: base.subjectId,
      parentClassLabel: 'Aardvark'
    })
    expect(
      await readVisibleCatalogue(t, second.caller, 'CLASS', {
        source: 'OWNED'
      })
    ).toEqual([])

    await t.run((ctx) =>
      ctx.db.patch(after.root._id, {
        catalogue: { ...after.root.catalogue!, category: 'BASE' }
      })
    )
    const failedRename = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: 'Zebra',
      payload: base.payload
    })
    const parentBefore = await t.run((ctx) =>
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', base.subjectId))
        .unique()
    )
    await expect(first.caller.action(publish, publicationInput(failedRename))).rejects.toThrow(
      'Class parent projection is invalid'
    )
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', base.subjectId))
          .unique()
      )
    ).toEqual(parentBefore)
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'CLASS',
        subjectId: base.subjectId
      })
    ).toEqual(failedRename)
  }, 30_000)

  it('allows the 499th subclass but rejects the 500th in the final publication guard', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller, championMartialArchetype.id)
    // Only indexed membership matters to the admission guard; canonical content is retained unchanged.
    const membershipIds = await t.run(async (ctx) => {
      const sample = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', championMartialArchetype.id))
        .unique()
      if (!sample) throw new Error('Missing subclass fixture')
      const { _id, _creationTime, ...fields } = sample
      const inserted = []
      for (let index = 0; index < 497; index++)
        inserted.push(
          await ctx.db.insert('authoredRoots', {
            ...fields,
            id: crypto.randomUUID()
          })
        )
      return inserted
    })
    const check = () =>
      first.caller.run(async (ctx) => {
        const state = await readPublicationState(ctx, publicationInput(draft))
        return assertPreparedClassDocument(ctx, state, {
          ...draft.payload,
          status: 'ACTIVE'
        })
      })
    await expect(check()).resolves.toHaveProperty('subjectKind', 'CLASS')
    await t.run(async (ctx) => {
      const sample = await ctx.db.get(membershipIds[0]!)
      if (!sample) throw new Error('Missing membership fixture')
      const { _id, _creationTime, ...fields } = sample
      await ctx.db.insert('authoredRoots', {
        ...fields,
        id: crypto.randomUUID()
      })
    })
    await expect(check()).rejects.toThrow('500-record authoring limit')
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'CLASS',
        subjectId: draft.subjectId
      })
    ).toEqual(draft)
  }, 30_000)

  it('publishes a BASE and its SUBCLASS with normalized equipment, compiled projections, and private ownership', async () => {
    const { t, first, second } = await fixture()
    const base = await copyDraft(first.caller, fighter.id)
    await expect(t.action(publish, publicationInput(base))).rejects.toThrow()
    await expect(second.caller.action(publish, publicationInput(base))).rejects.toThrow()
    await first.caller.action(publish, publicationInput(base))
    const subclass = await copyDraft(first.caller, championMartialArchetype.id)
    const connected = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: subclass.subjectId,
      systemId: subclass.systemId,
      label: subclass.label,
      payload: { ...subclass.payload, parentClassId: base.subjectId }
    })
    const result = await first.caller.action(publish, publicationInput(connected))
    const stored = await t.run(async (ctx) => {
      const roots = await Promise.all(
        [base.subjectId, connected.subjectId].map((id) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
        )
      )
      return Promise.all(
        roots.map(async (root) => {
          const version =
            root && (await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId)))
          return {
            root,
            version,
            document: version && (await readStoredAuthoredVersionDocument(ctx, version))
          }
        })
      )
    })
    expect(stored.map(({ root }) => root?.parentClassId)).toEqual([null, base.subjectId])
    for (const { version, document: storedDocument } of stored) {
      if (!version?.compilation || !storedDocument) throw new Error('Missing Class compilation')
      const document = classAuthoredDtoSchema.parse(storedDocument)
      expect(JSON.parse(version.compilation.projectionJson)).toEqual(
        JSON.parse(
          JSON.stringify(
            compileSubjectWithMechanicsIndex({
              subjectKind: 'CLASS',
              authored: document
            }).compiled
          )
        )
      )
      expect(version.compilation.projectionChecksum).toBe(
        checksumRuleDocument(JSON.parse(version.compilation.projectionJson))
      )
    }
    const publishedBase = classAuthoredDtoSchema.parse(stored[0].document)
    if (publishedBase.category !== 'BASE') throw new Error('Expected published BASE Class')
    expect(publishedBase.proficiencies).toEqual(base.payload.proficiencies)
    const publishedEquipment = JSON.stringify(publishedBase.startingEquipment)
    const draftEquipment = JSON.stringify(base.payload.startingEquipment)
    for (const equipmentId of equipmentIds) {
      if (draftEquipment.includes(equipmentId)) expect(publishedEquipment).toContain(equipmentId)
    }
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'CLASS',
        subjectId: base.subjectId
      })
    ).toBeNull()
    expect(
      await t.query(api.content.details.get, {
        subjectKind: 'CLASS',
        id: base.subjectId
      })
    ).toBeNull()
    expect(
      await second.caller.query(api.content.details.get, {
        subjectKind: 'CLASS',
        id: result.subjectId
      })
    ).toBeNull()
  }, 30_000)

  it('keeps the current version and draft when a Class publish is stale or invalid, then replaces it atomically', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller, fighter.id)
    const stale = publicationInput(draft)
    const saved = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Edited',
      payload: draft.payload
    })
    await expect(first.caller.action(publish, stale)).rejects.toThrow(
      'draft or published content changed'
    )
    await first.caller.action(publish, publicationInput(saved))
    const broken = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Broken',
      payload: { ...draft.payload, details: [null] }
    })
    const before = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(2)
    )
    await expect(first.caller.action(publish, publicationInput(broken))).rejects.toThrow()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredVersions')
          .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
          .take(2)
      )
    ).toEqual(before)
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'CLASS',
        subjectId: draft.subjectId
      })
    ).toEqual(broken)
    const replacement = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Replacement',
      payload: { ...draft.payload, features: [] }
    })
    await first.caller.action(publish, publicationInput(replacement))
    const versions = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(2)
    )
    expect(versions).toHaveLength(1)
    expect(versions[0]?.version).toBe(2)
    expect(await t.run((ctx) => ctx.db.get(before[0]!._id))).toBeNull()
  })

  it('deletes an owned Class while retaining published Spell references and trusted backfill markers', async () => {
    const { t, first, second } = await fixture()
    const spellClasses = [sorcerer, wizard].map((document) =>
      importedSubject({ subjectKind: 'CLASS', ...document, document })
    )
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        ...spellClasses,
        importedSubject({
          subjectKind: 'SPELL',
          ...fireball,
          document: fireball
        })
      ]
    })
    for (const subject of spellClasses)
      await t.mutation(internal.content.import.syncClassDerived, classDerived(subject))
    const base = await copyDraft(first.caller, fighter.id)
    await first.caller.action(publish, publicationInput(base))
    await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: base.label,
      payload: base.payload
    })
    const spellDraft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'SPELL',
      subjectId: fireball.id
    })
    const linkedSpell = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: spellDraft.subjectId,
      systemId: spellDraft.systemId,
      label: spellDraft.label,
      payload: { ...spellDraft.payload, classIds: [base.subjectId] }
    })
    await first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'SPELL',
      subjectId: linkedSpell.subjectId,
      expectedDraftUpdatedAt: authoredPublishDraftInputSchema.shape.expectedDraftUpdatedAt.parse(
        linkedSpell.updatedAt
      )
    })
    const snapshot = () =>
      t.run(async (ctx) => ({
        roots: await ctx.db.query('authoredRoots').collect(),
        versions: await ctx.db.query('authoredVersions').collect(),
        drafts: await ctx.db.query('authoredDrafts').collect(),
        routes: await ctx.db.query('authoredRouteIds').collect(),
        classes: await ctx.db.query('authoredSpellClasses').collect(),
        counts: await ctx.db.query('authoredCatalogueCounts').collect(),
        ownerCounts: await ctx.db.query('authoredCatalogueOwnerCounts').collect(),
        usage: await ctx.db.query('accountUsageEntries').collect(),
        jobs: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    const before = await snapshot()
    await expect(
      t.mutation(deleteActive, {
        subjectKind: 'CLASS',
        subjectId: base.subjectId
      })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      second.caller.mutation(deleteActive, {
        subjectKind: 'CLASS',
        subjectId: base.subjectId
      })
    ).rejects.toThrow('Authored content cannot be deleted')
    expect(await snapshot()).toEqual(before)

    await first.caller.mutation(deleteActive, {
      subjectKind: 'CLASS',
      subjectId: base.subjectId
    })
    const after = await snapshot()
    expect(after.roots.find((root) => root.id === base.subjectId)).toBeUndefined()
    expect(after.versions.some((version) => version.id === base.subjectId)).toBe(false)
    expect(after.drafts.find((draft) => draft.subjectId === base.subjectId)).toMatchObject({
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null,
      basePublishedChecksum: null
    })
    expect(after.roots.find((root) => root.id === linkedSpell.subjectId)).toEqual(
      expect.objectContaining({
        catalogue: expect.objectContaining({
          deletedReferences: [
            expect.objectContaining({
              subjectKind: 'CLASS',
              subjectId: base.subjectId,
              label: base.label
            })
          ]
        })
      })
    )
    expect(after.versions.find((version) => version.id === linkedSpell.subjectId)).toEqual(
      before.versions.find((version) => version.id === linkedSpell.subjectId)
    )
    expect(after.classes).toEqual(before.classes)
    // The list row joins Class labels from the visible entries, so the deleted Class is left off.
    expect(await readVisibleCatalogue(t, first.caller, 'SPELL', { source: 'OWNED' })).toEqual([
      expect.objectContaining({
        id: linkedSpell.subjectId,
        classIds: [],
        classLabels: []
      })
    ])

    const backfill = await fixture()
    await importSeededSubjects(backfill.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        ...spellClasses,
        importedSubject({
          subjectKind: 'SPELL',
          ...fireball,
          document: fireball
        })
      ]
    })
    for (const subject of spellClasses)
      await backfill.t.mutation(internal.content.import.syncClassDerived, classDerived(subject))
    const backfillClass = await copyDraft(backfill.first.caller, fighter.id)
    await backfill.first.caller.action(publish, publicationInput(backfillClass))
    const backfillSpellDraft = await backfill.first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'SPELL',
      subjectId: fireball.id
    })
    const backfillSpell = await backfill.first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: backfillSpellDraft.subjectId,
      systemId: backfillSpellDraft.systemId,
      label: backfillSpellDraft.label,
      payload: {
        ...backfillSpellDraft.payload,
        classIds: [backfillClass.subjectId]
      }
    })
    await backfill.first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'SPELL',
      subjectId: backfillSpell.subjectId,
      expectedDraftUpdatedAt: authoredPublishDraftInputSchema.shape.expectedDraftUpdatedAt.parse(
        backfillSpell.updatedAt
      )
    })
    await backfill.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', backfillSpell.subjectId))
        .unique()
      if (!root) throw new Error('Missing independent Spell publication.')
      await ctx.db.patch(root._id, { spellClassesIndexed: undefined })
      for (const link of await ctx.db
        .query('authoredSpellClasses')
        .withIndex('by_spellId', (q) => q.eq('spellId', root.id))
        .collect())
        await ctx.db.delete(link._id)
    })
    await backfill.first.caller.mutation(deleteActive, {
      subjectKind: 'CLASS',
      subjectId: backfillClass.subjectId
    })
    let cursor: string | null = null
    let done = false
    for (let page = 0; page < 32 && !done; page++) {
      const result: AuthoredCatalogueSearchBackfillResult = await backfill.t.mutation(
        internal.content.catalogueSearchBackfill.backfill,
        { paginationOpts: { cursor, numItems: 8 } }
      )
      cursor = result.continueCursor
      done = result.isDone
    }
    expect(done).toBe(true)
    const retainedRoot = await backfill.t.run((ctx) =>
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', backfillSpell.subjectId))
        .unique()
    )
    expect(retainedRoot?.catalogue?.deletedReferences).toEqual([
      expect.objectContaining({
        subjectKind: 'CLASS',
        subjectId: backfillClass.subjectId,
        label: backfillClass.label
      })
    ])
  }, 30_000)
  it('keeps another account published source after native owner deletion', async () => {
    const { t, first, second } = await fixture()
    const deleting = await copyDraft(first.caller, fighter.id)
    const retained = await copyDraft(second.caller, fighter.id)
    await first.caller.action(publish, publicationInput(deleting))
    await second.caller.action(publish, publicationInput(retained))
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
    )
    if (!profile) throw new Error('Missing deleting author profile.')
    await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }]
        },
        onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
      })
    )
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', retained.subjectId))
          .unique()
      )
    ).toMatchObject({ id: retained.subjectId, ownerUserId: second.userId })
  }, 30_000)
  it('rejects inaccessible or invalid subclass parents and protects parent deletion until children are gone', async () => {
    const { t, first, second } = await fixture()
    const base = await copyDraft(first.caller, fighter.id)
    await first.caller.action(publish, publicationInput(base))
    const subclass = await copyDraft(first.caller, championMartialArchetype.id)
    const foreignBase = await copyDraft(second.caller, fighter.id)
    await second.caller.action(publish, publicationInput(foreignBase))
    const crossSystemBaseId = await importCrossSystemBase(t)
    for (const parentClassId of [
      subclass.subjectId,
      crypto.randomUUID(),
      championMartialArchetype.id,
      foreignBase.subjectId,
      crossSystemBaseId
    ]) {
      const invalid = await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'CLASS',
        subjectId: subclass.subjectId,
        systemId: subclass.systemId,
        label: subclass.label,
        payload: { ...subclass.payload, parentClassId }
      })
      await expect(first.caller.action(publish, publicationInput(invalid))).rejects.toThrow(
        'A readable base class in the same System is required.'
      )
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', subclass.subjectId))
            .unique()
        )
      ).toBeNull()
    }
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', base.subjectId))
        .unique()
      const canonical = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
        .unique()
      if (!root || !canonical) throw new Error('Missing Class parent fixture')
      await ctx.db.patch(root._id, {
        currentVersionId: canonical.currentVersionId
      })
    })
    const corruptedParent = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: subclass.subjectId,
      systemId: subclass.systemId,
      label: subclass.label,
      payload: { ...subclass.payload, parentClassId: base.subjectId }
    })
    await expect(first.caller.action(publish, publicationInput(corruptedParent))).rejects.toThrow(
      'Stored authored content identity mismatch.'
    )
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', base.subjectId))
        .unique()
      const version = await ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', base.subjectId).eq('version', 1))
        .unique()
      if (!root || !version) throw new Error('Missing owned Class fixture')
      await ctx.db.patch(root._id, {
        currentVersionId: version._id,
        currentVersionPublicId: version.versionId
      })
    })
    const valid = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: subclass.subjectId,
      systemId: subclass.systemId,
      label: subclass.label,
      payload: { ...subclass.payload, parentClassId: base.subjectId }
    })
    await first.caller.action(publish, publicationInput(valid))
    const converted = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: base.label,
      payload: {
        ...championMartialArchetype,
        id: base.subjectId,
        userId: base.userId,
        parentClassId: fighter.id
      }
    })
    await expect(first.caller.action(publish, publicationInput(converted))).rejects.toThrow(
      'A class with published subclasses cannot be deleted or made a subclass.'
    )
    await expect(
      t.mutation(deleteActive, {
        subjectKind: 'CLASS',
        subjectId: base.subjectId
      })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      second.caller.mutation(deleteActive, {
        subjectKind: 'CLASS',
        subjectId: base.subjectId
      })
    ).rejects.toThrow('cannot be deleted')
    const childBefore = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', valid.subjectId))
        .unique()
      if (!root) throw new Error('Missing published subclass.')
      return {
        root,
        version: await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      }
    })
    await first.caller.mutation(deleteActive, {
      subjectKind: 'CLASS',
      subjectId: base.subjectId
    })
    const childAfter = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', valid.subjectId))
        .unique()
      if (!root) throw new Error('Missing retained subclass.')
      return {
        root,
        version: await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      }
    })
    expect(childAfter.version).toEqual(childBefore.version)
    expect(childAfter.root.catalogue?.deletedReferences).toContainEqual({
      subjectKind: 'CLASS',
      subjectId: base.subjectId,
      label: base.label
    })
  }, 30_000)

  it('scopes normalized subclass names to their published parent class', async () => {
    const { first } = await fixture()
    const firstBaseDraft = await copyDraft(first.caller, fighter.id)
    const firstBase = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: firstBaseDraft.subjectId,
      systemId: firstBaseDraft.systemId,
      label: 'First parent class',
      payload: firstBaseDraft.payload
    })
    await first.caller.action(publish, publicationInput(firstBase))
    const secondBaseDraft = await copyDraft(first.caller, fighter.id)
    const secondBase = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: secondBaseDraft.subjectId,
      systemId: secondBaseDraft.systemId,
      label: 'Second parent class',
      payload: secondBaseDraft.payload
    })
    await first.caller.action(publish, publicationInput(secondBase))

    for (const parentClassId of [firstBase.subjectId, secondBase.subjectId]) {
      const draft = await copyDraft(first.caller, championMartialArchetype.id)
      const subclass = await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'CLASS',
        subjectId: draft.subjectId,
        systemId: draft.systemId,
        label: 'Shared subclass',
        payload: { ...draft.payload, parentClassId }
      })
      await first.caller.action(publish, publicationInput(subclass))
    }

    const conflictingDraft = await copyDraft(first.caller, championMartialArchetype.id)
    const conflictingSubclass = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: conflictingDraft.subjectId,
      systemId: conflictingDraft.systemId,
      label: ' shared SUBCLASS ',
      payload: {
        ...conflictingDraft.payload,
        parentClassId: firstBase.subjectId
      }
    })
    await expect(
      first.caller.action(publish, publicationInput(conflictingSubclass))
    ).rejects.toThrow('PARENT_CLASS')
  }, 30_000)

  it('rolls back name backfill when a subclass parent is no longer readable', async () => {
    const { t, first } = await fixture()
    const base = await copyDraft(first.caller, fighter.id)
    await first.caller.action(publish, publicationInput(base))
    const subclassDraft = await copyDraft(first.caller, championMartialArchetype.id)
    const subclass = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CLASS',
      subjectId: subclassDraft.subjectId,
      systemId: subclassDraft.systemId,
      label: subclassDraft.label,
      payload: { ...subclassDraft.payload, parentClassId: base.subjectId }
    })
    await first.caller.action(publish, publicationInput(subclass))
    await t.run(async (ctx) => {
      const [baseRoot, subclassRoot] = await Promise.all(
        [base.subjectId, subclass.subjectId].map((id) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', id))
            .unique()
        )
      )
      if (!baseRoot || !subclassRoot) throw new Error('Missing Class fixture')
      await ctx.db.delete(baseRoot._id)
      await ctx.db.patch(subclassRoot._id, { activeNameKey: undefined })
    })
    const input = authoredPublicationNameBackfillInputSchema.parse({
      ownerUserId: first.userId,
      systemId: subclass.systemId,
      subjectKind: 'CLASS',
      cursor: null
    })
    await expect(t.mutation(nameBackfill, input)).rejects.toThrow(
      'A readable base class in the same System is required.'
    )
    expect(
      await t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', subclass.subjectId))
          .unique()
        return root?.activeNameKey
      })
    ).toBeNull()
  })

  it('fails closed on missing Class metadata and rolls back conflicting canonical replay', async () => {
    const { t, first } = await fixture()
    const base = await copyDraft(first.caller, fighter.id)
    await first.caller.action(publish, publicationInput(base))
    await t.run(async (ctx) => {
      const canonical = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
        .unique()
      if (!canonical) throw new Error('Missing canonical Class fixture')
      const version = await versionWithCompilation(
        ctx,
        await ctx.db.get(canonical.currentVersionId)
      )
      if (!version?.compilation) throw new Error('Missing canonical Class compilation')
      await ctx.db.patch(canonical._id, { parentClassId: undefined })
      await setVersionCompilation(ctx, version, {
        ...version.compilation,
        projectionChecksum: '0'.repeat(64)
      })
    })
    const corruptedCanonical = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
        .unique()
      return (
        root && {
          root,
          version: await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
        }
      )
    })
    await first.caller.mutation(deleteActive, {
      subjectKind: 'CLASS',
      subjectId: base.subjectId
    })
    expect(
      await t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
          .unique()
        return (
          root && {
            root,
            version: await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
          }
        )
      })
    ).toEqual(corruptedCanonical)
    await expect(
      t.mutation(internal.content.import.syncClassDerived, fighterDerived)
    ).rejects.toThrow('Canonical content conflict.')
    const afterRollback = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
        .unique()
      return (
        root && {
          root,
          version: await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
        }
      )
    })
    expect(afterRollback?.root.parentClassId).toBeUndefined()
    await t.run(async (ctx) => {
      if (!afterRollback?.version) throw new Error('Missing conflicted Class fixture')
      await setVersionCompilation(ctx, afterRollback.version, undefined)
    })
    await t.mutation(internal.content.import.syncClassDerived, fighterDerived)
    const restored = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fighter.id))
        .unique()
      return (
        root && {
          root,
          version: await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
        }
      )
    })
    expect(restored?.root.parentClassId).toBeNull()
    expect(restored?.version?.compilation).toBeDefined()
    await expect(
      t.query(internal.content.import.readClassDerived, {
        id: fighterSubject.id,
        checksum: fighterSubject.checksum
      })
    ).resolves.toEqual({
      parentClassId: fighterDerived.parentClassId,
      compilation: fighterDerived.compilation
    })
    await t.run(async (ctx) => {
      if (!restored) throw new Error('Missing restored Class fixture')
      await ctx.db.patch(restored.root._id, {
        parentClassId: crypto.randomUUID()
      })
    })
    await expect(
      t.mutation(internal.content.import.syncClassDerived, fighterDerived)
    ).rejects.toThrow('Canonical content conflict.')
    await expect(
      t.query(internal.content.import.readClassDerived, {
        id: fighterSubject.id,
        checksum: fighterSubject.checksum
      })
    ).rejects.toThrow('Canonical content conflict.')
  })

  it('rejects a Class publish when an observed source changes before commit', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller, fighter.id)
    const originalNormalize = nodeRuntime.normalizeIngressValues
    const normalizeSpy = vi
      .spyOn(nodeRuntime, 'normalizeIngressValues')
      .mockImplementation(async (...args) => {
        const normalized = await originalNormalize(...args)
        await t.run(async (ctx) => {
          const system = await ctx.db
            .query('systems')
            .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
            .unique()
          if (!system) throw new Error('Missing System fixture')
          const document = {
            ...srdSystemRecord,
            skills: srdSystemRecord.skills.map((skill, index) =>
              index === 0 ? { ...skill, label: `${skill.label} (changed)` } : skill
            )
          }
          await ctx.db.patch(system._id, {
            document: jsonValueSchema.parse(JSON.parse(JSON.stringify(document))),
            checksum: checksumRuleDocument(document)
          })
        })
        return normalized
      })

    try {
      await expect(first.caller.action(publish, publicationInput(draft))).rejects.toThrow(
        'Authoring sources changed'
      )
    } finally {
      normalizeSpy.mockRestore()
    }

    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'CLASS',
        subjectId: draft.subjectId
      })
    ).toEqual(draft)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
          .unique()
      )
    ).toBeNull()

    await first.caller.action(publish, publicationInput(draft))
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
          .unique()
      )
    ).not.toBeNull()
  }, 15_000)
})
