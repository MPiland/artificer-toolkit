import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import { srdRaces } from '@artificer-toolkit/source-data/srd/races/index.js'
import {
  authoredPublishDraftInputSchema,
  type AuthoredDeleteActiveInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import type { TableNames } from '../_generated/dataModel'
import { api, internal } from '../_generated/api'
import schema from '../schema'
import {
  corruptPublishedVersionPayload,
  importedSubject,
  publicationFixture
} from '../../tests/fixtures/publication'

const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)
const equipmentBase = importedSubject({ subjectKind: 'EQUIPMENT', ...club, document: club })
const equipmentChild = importedSubject({
  subjectKind: 'EQUIPMENT',
  ...clubPlus1,
  document: clubPlus1
})
const raceBase = srdRaces.find((race) =>
  srdRaces.some(
    (candidate) => candidate.category === 'SUBRACE' && candidate.parentRaceId === race.id
  )
)
const raceChild = srdRaces.find(
  (race) => race.category === 'SUBRACE' && race.parentRaceId === raceBase?.id
)
if (!raceBase || !raceChild) throw new Error('Missing canonical Race parent fixture.')
const canonicalRaceBase = importedSubject({ subjectKind: 'RACE', ...raceBase, document: raceBase })
const canonicalRaceChild = importedSubject({
  subjectKind: 'RACE',
  ...raceChild,
  document: raceChild
})

async function fixture() {
  const result = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [[equipmentBase, equipmentChild, canonicalRaceBase, canonicalRaceChild]]
  )
  await result.t.mutation(internal.content.raceRelationships.syncDerived, {
    id: canonicalRaceBase.id,
    checksum: canonicalRaceBase.checksum
  })
  await result.t.mutation(internal.content.raceRelationships.syncDerived, {
    id: canonicalRaceChild.id,
    checksum: canonicalRaceChild.checksum
  })
  return result
}

function publishInput(
  subjectKind: 'EQUIPMENT' | 'RACE',
  draft: { subjectId: string; updatedAt?: string }
) {
  const input = authoredPublishDraftInputSchema.parse({
    subjectKind,
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: authoredPublishDraftInputSchema.shape.expectedDraftUpdatedAt.parse(
      draft.updatedAt
    )
  })
  return { ...input, subjectKind }
}

async function fullSnapshot(t: Awaited<ReturnType<typeof fixture>>['t']) {
  const tables = Object.keys(schema.tables) as TableNames[]
  return t.run(async (ctx) => ({
    app: Object.fromEntries(
      await Promise.all(tables.map(async (table) => [table, await ctx.db.query(table).collect()]))
    ),
    schedules: await ctx.db.system.query('_scheduled_functions').collect()
  }))
}

async function readChild(t: Awaited<ReturnType<typeof fixture>>['t'], subjectId: string) {
  return t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', subjectId))
      .unique()
    if (!root) throw new Error('Missing retained child.')
    return {
      root,
      version: await ctx.db.get(root.currentVersionId),
      draft: await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', subjectId))
        .unique()
    }
  })
}

describe('owner deletion retained authored references', () => {
  it('rejects a malformed owned source document with exact transaction rollback', async () => {
    const { t, first } = await fixture()
    const draft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: equipmentBase.id
    })
    await first.caller.mutation(
      api.content.publication.publishDraft,
      publishInput('EQUIPMENT', draft)
    )
    await t.run((ctx) => corruptPublishedVersionPayload(ctx, draft.subjectId))
    const before = await fullSnapshot(t)
    await expect(
      first.caller.mutation(deleteActive, {
        subjectKind: 'EQUIPMENT',
        subjectId: draft.subjectId
      })
    ).rejects.toThrow('Stored authored content checksum mismatch.')
    expect(await fullSnapshot(t)).toEqual(before)
  }, 30_000)

  it('retains a same-owner Equipment variant document, version, compilation, draft, and parent marker', async () => {
    const { t, first } = await fixture()
    const parent = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: equipmentBase.id
    })
    await first.caller.mutation(
      api.content.publication.publishDraft,
      publishInput('EQUIPMENT', parent)
    )
    const copied = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: equipmentChild.id
    })
    const variant = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: copied.subjectId,
      systemId: copied.systemId,
      label: copied.label,
      payload: { ...copied.payload, parentEquipmentId: parent.subjectId }
    })
    await first.caller.mutation(
      api.content.publication.publishDraft,
      publishInput('EQUIPMENT', variant)
    )
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: variant.subjectId,
      systemId: variant.systemId,
      label: variant.label,
      payload: variant.payload
    })
    const before = await readChild(t, variant.subjectId)
    await first.caller.mutation(deleteActive, {
      subjectKind: 'EQUIPMENT',
      subjectId: parent.subjectId
    })
    const after = await readChild(t, variant.subjectId)
    expect(after.version).toEqual(before.version)
    expect(after.draft).toEqual(before.draft)
    expect(after.version?.compilation).toEqual(before.version?.compilation)
    expect(after.root.catalogue?.deletedReferences).toContainEqual({
      subjectKind: 'EQUIPMENT',
      subjectId: parent.subjectId,
      label: parent.label
    })
    expect(working.subjectId).toBe(variant.subjectId)
  }, 30_000)

  it('retains a same-owner Race subrace and rolls back the complete parent transaction', async () => {
    const { t, first, second } = await fixture()
    const parent = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: canonicalRaceBase.id
    })
    await first.caller.mutation(api.content.publication.publishDraft, publishInput('RACE', parent))
    const copied = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: canonicalRaceChild.id
    })
    const subrace = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: copied.subjectId,
      systemId: copied.systemId,
      label: copied.label,
      payload: { ...copied.payload, parentRaceId: parent.subjectId }
    })
    await first.caller.mutation(api.content.publication.publishDraft, publishInput('RACE', subrace))
    await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: subrace.subjectId,
      systemId: subrace.systemId,
      label: subrace.label,
      payload: raceAuthoredDtoSchema.parse(subrace.payload)
    })
    const before = await fullSnapshot(t)
    await expect(
      t.mutation(deleteActive, { subjectKind: 'RACE', subjectId: parent.subjectId })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      second.caller.mutation(deleteActive, { subjectKind: 'RACE', subjectId: parent.subjectId })
    ).rejects.toThrow('cannot be deleted')
    expect(await fullSnapshot(t)).toEqual(before)
    await expect(
      first.caller.run(async (ctx) => {
        await ctx.runMutation(deleteActive, { subjectKind: 'RACE', subjectId: parent.subjectId })
        throw new Error('Injected outer owner deletion failure')
      })
    ).rejects.toThrow('Injected outer owner deletion failure')
    expect(await fullSnapshot(t)).toEqual(before)
    const childBefore = await readChild(t, subrace.subjectId)
    await first.caller.mutation(deleteActive, { subjectKind: 'RACE', subjectId: parent.subjectId })
    const childAfter = await readChild(t, subrace.subjectId)
    expect(childAfter.version).toEqual(childBefore.version)
    expect(childAfter.draft).toEqual(childBefore.draft)
    expect(childAfter.version?.compilation).toEqual(childBefore.version?.compilation)
    expect(childAfter.root.catalogue?.deletedReferences).toContainEqual({
      subjectKind: 'RACE',
      subjectId: parent.subjectId,
      label: parent.label
    })
  }, 30_000)
})
