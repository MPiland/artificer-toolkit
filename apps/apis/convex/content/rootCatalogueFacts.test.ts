import { expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import { collectReferenceIds } from '@artificer-toolkit/shared/utils'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { readRootCatalogue } from './catalogueMetadata'
import { readPublishedRootDocument } from './documents'

const equipmentIds = new Set(collectReferenceIds([acolyte], 'equipmentId', 'equipmentIds'))
const referenced = srdEquipment
  .filter((equipment) => equipmentIds.has(equipment.id))
  .map((equipment) => importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment }))

function acolyteWithStatus(status: 'ACTIVE' | 'DRAFT') {
  return importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: { ...acolyte, status } })
}

it('keeps the root ACTIVE fact equal to the current payload status across every status write (D163)', async () => {
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    Array.from({ length: Math.ceil(referenced.length / 10) }, (_, index) =>
      referenced.slice(index * 10, index * 10 + 10)
    )
  )
  const importAcolyte = (status: 'ACTIVE' | 'DRAFT') =>
    t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [acolyteWithStatus(status)]
    })
  /** Every root's stored fact beside its current payload's status. */
  const facts = () =>
    t.run(async (ctx) =>
      Promise.all(
        (await ctx.db.query('authoredRoots').collect()).map(async (root) => {
          const { document } = await readPublishedRootDocument(ctx, root)
          return {
            id: root.id,
            publishedActive: readRootCatalogue(root).publishedActive,
            payloadStatus: (document as { status?: 'ACTIVE' | 'DRAFT' }).status
          }
        })
      )
    )
  const expectMatching = async (acolyteActive: boolean) => {
    const stored = await facts()
    // Canonical SRD documents carry no status and count as active; only a DRAFT payload is not.
    expect(stored.filter((fact) => fact.payloadStatus === undefined).length).toBeGreaterThan(0)
    for (const fact of stored) expect(fact.publishedActive).toBe(fact.payloadStatus !== 'DRAFT')
    expect(stored.find((fact) => fact.id === acolyte.id)?.publishedActive).toBe(acolyteActive)
  }

  // Import inserts a DRAFT root, replaces it with an ACTIVE version, then with a DRAFT one again.
  expect(await importAcolyte('DRAFT')).toMatchObject({ inserted: 1 })
  await expectMatching(false)
  expect(await importAcolyte('ACTIVE')).toMatchObject({ replaced: 1 })
  await expectMatching(true)

  // Publication of an owned copy is always ACTIVE.
  const copy = await first.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
  await first.caller.mutation(api.content.publication.publishDraft, {
    ...authoredPublishDraftInputSchema.parse({
      subjectKind: 'BACKGROUND',
      subjectId: copy.subjectId,
      expectedDraftUpdatedAt: copy.updatedAt
    }),
    subjectKind: 'BACKGROUND'
  })
  const owned = (await facts()).find((fact) => fact.id === copy.subjectId)
  expect(owned).toEqual({ id: copy.subjectId, publishedActive: true, payloadStatus: 'ACTIVE' })

  expect(await importAcolyte('DRAFT')).toMatchObject({ replaced: 1 })
  await expectMatching(false)
})
