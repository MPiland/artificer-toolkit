import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredDetailResponseSchemas } from '@artificer-toolkit/schema/api/content'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api } from '../convex/_generated/api.js'

// The driver owns both disposable accounts and cleanup, including failed publications.
export async function verifyPublication({
  owner,
  other,
  anonymous,
  draft
}: {
  owner: ConvexHttpClient
  other: ConvexHttpClient
  anonymous: ConvexHttpClient
  draft: AuthoredDraftResult
}) {
  const subjectKind = authoredPublishDraftInputSchema.shape.subjectKind.parse(draft.subjectKind)
  const lookup = { subjectKind, subjectId: draft.subjectId }
  const scope = { subjectKind, systemId: draft.systemId }
  const input = (saved: AuthoredDraftResult) =>
    authoredPublishDraftInputSchema.parse({
      ...lookup,
      expectedDraftUpdatedAt: saved.updatedAt
    })
  const publish = (client: ConvexHttpClient, saved: AuthoredDraftResult, concurrent = false) => {
    const prepared = input(saved)
    if (subjectKind === 'CLASS')
      return client.action(api.content.classPublicationActions.publishDraft, {
        ...prepared,
        subjectKind
      })
    const mutationInput = { ...prepared, subjectKind }
    return concurrent
      ? client.mutation(api.content.publication.publishDraft, mutationInput, {
          skipQueue: true
        })
      : client.mutation(api.content.publication.publishDraft, mutationInput)
  }
  const readActive = async () =>
    authoredDetailResponseSchemas[subjectKind].parse(
      await owner.query(api.content.details.get, {
        subjectKind,
        id: draft.publicId
      })
    )
  const countsBefore = await owner.query(api.content.catalogue.counts, scope)
  assert.equal(countsBefore.ownedCount, 0)
  for (const client of [anonymous, other]) {
    await assert.rejects(publish(client, draft))
  }

  const attempts = await Promise.allSettled([
    publish(owner, draft, true),
    publish(owner, draft, true)
  ])
  assert.equal(
    attempts.filter((result) => result.status === 'fulfilled').length,
    1,
    'Exactly one concurrent publication may consume the saved draft.'
  )
  assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1)
  const rejection = attempts.find((result) => result.status === 'rejected')
  assert.ok(rejection?.status === 'rejected' && rejection.reason instanceof Error)
  assert.match(rejection.reason.message, /cannot be published by the current user/)
  const publication = attempts.find((result) => result.status === 'fulfilled')
  assert.ok(publication?.status === 'fulfilled')
  let active = await readActive()
  assert.ok(active?.item)
  assert.equal(active.item.id, draft.subjectId)
  assert.equal(active.item.systemId, draft.systemId)
  assert.equal(active.item.userId, draft.userId)
  assert.equal(active.item.status, 'ACTIVE')
  assert.equal(active.publicId, draft.publicId)
  assert.equal(checksumRuleDocument(active.item), publication.value.checksum)
  assert.equal(active.activeUpdatedAt, publication.value.activeUpdatedAt)
  assert.equal(await owner.query(api.content.drafts.get, lookup), null)
  for (const client of [anonymous, other]) {
    assert.equal(
      await client.query(api.content.details.get, {
        subjectKind,
        id: draft.publicId
      }),
      null
    )
    await assert.rejects(client.mutation(api.content.deletion.deleteActive, lookup))
  }
  assert.equal((await owner.query(api.content.catalogue.counts, scope)).ownedCount, 1)

  const changed = await owner.mutation(api.content.drafts.save, {
    ...lookup,
    systemId: draft.systemId,
    label: 'Publication proof working edit',
    payload: draft.payload
  })
  assert.equal(changed.draftState, 'ACTIVE_WITH_DRAFT')
  assert.equal(changed.baseActiveUpdatedAt, active.activeUpdatedAt)
  assert.deepEqual(
    (await readActive())?.item,
    active.item,
    'Working edits must not alter publication.'
  )
  await owner.mutation(api.content.drafts.discard, lookup)
  assert.deepEqual(await readActive(), active, 'Discard must preserve the active record and alias.')

  const broken = await owner.mutation(api.content.drafts.save, {
    ...lookup,
    systemId: draft.systemId,
    label: 'Invalid publication proof',
    payload: { ...draft.payload, features: [null] }
  })
  await assert.rejects(publish(owner, broken))
  assert.deepEqual((await readActive())?.item, active.item)
  assert.deepEqual(await owner.query(api.content.drafts.get, lookup), broken)
  const repaired = await owner.mutation(api.content.drafts.save, {
    ...lookup,
    systemId: draft.systemId,
    label: 'Publication proof replacement',
    payload: { ...draft.payload, features: [] }
  })
  await assert.rejects(publish(owner, broken))
  assert.deepEqual(await owner.query(api.content.drafts.get, lookup), repaired)
  const replacement = await publish(owner, repaired)
  active = await readActive()
  assert.ok(active?.item)
  assert.equal(active.item.label, repaired.label)
  assert.equal('features' in active.item ? (active.item.features?.length ?? 0) : 0, 0)
  assert.equal(checksumRuleDocument(active.item), replacement.checksum)
  assert.notEqual(replacement.checksum, publication.value.checksum)
  assert.equal(active.publicId, draft.publicId)
  assert.equal(await owner.query(api.content.drafts.get, lookup), null)
  assert.equal((await owner.query(api.content.catalogue.counts, scope)).ownedCount, 1)

  // Class deletion must fit with both the full published graph and full working edits.
  if (subjectKind === 'CLASS') {
    const restored = await owner.mutation(api.content.drafts.save, {
      ...lookup,
      systemId: draft.systemId,
      label: repaired.label,
      payload: draft.payload
    })
    await publish(owner, restored)
    active = await readActive()
    assert.ok(active?.item)
  }
  const working = await owner.mutation(api.content.drafts.save, {
    ...lookup,
    systemId: draft.systemId,
    label: 'Working copy must survive active deletion',
    payload: {
      ...(subjectKind === 'CLASS' ? draft.payload : repaired.payload),
      description: 'Unpublished, owner-only text.'
    }
  })
  const copy = await owner.mutation(api.content.drafts.duplicate, lookup)
  assert.notEqual(copy.subjectId, draft.subjectId)
  assert.notEqual(copy.publicId, draft.publicId)
  assert.equal(copy.label, `${repaired.label} Copy`)
  assert.equal(copy.payload.description, active.item.description)
  assert.equal(copy.userId, draft.userId)
  assert.deepEqual(await owner.query(api.content.drafts.get, lookup), working)
  await owner.mutation(api.content.drafts.discard, {
    ...lookup,
    subjectId: copy.subjectId
  })

  await owner.mutation(api.content.deletion.deleteActive, lookup)
  const remaining = await owner.query(api.content.drafts.get, lookup)
  assert.ok(remaining)
  assert.equal(remaining.draftState, 'DRAFT_ONLY')
  assert.equal(remaining.baseActiveUpdatedAt, null)
  assert.equal(remaining.publicId, draft.publicId)
  assert.deepEqual(remaining.payload, working.payload)
  assert.notEqual(remaining.updatedAt, working.updatedAt)
  assert.equal(await readActive(), null)
  await assert.rejects(publish(owner, working))
  assert.deepEqual(await owner.query(api.content.catalogue.counts, scope), countsBefore)
  const preview = authoredDetailResponseSchemas[subjectKind].parse(
    await owner.query(api.content.details.get, {
      subjectKind,
      id: draft.publicId,
      view: 'draft'
    })
  )
  assert.equal(preview?.item?.label, working.label)
  await owner.mutation(api.content.drafts.discard, lookup)
  assert.equal(await owner.query(api.content.drafts.get, lookup), null)
  assert.equal(
    await owner.query(api.content.details.get, {
      subjectKind,
      id: draft.publicId,
      view: 'draft'
    }),
    null
  )
  console.log(
    `Managed ${subjectKind} publication passed: concurrent consumption, private active reads, invalid/stale rejection, replacement/checksums, owned copy, discard, and deletion preserving working edits.`
  )
}
