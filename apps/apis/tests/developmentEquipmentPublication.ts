import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredDetailResponseSchemas } from '@artificer-toolkit/schema/api/content'
import { api } from '../convex/_generated/api.js'

export async function verifyEquipmentPublicationRaces({
  owner,
  trackDraft
}: {
  owner: ConvexHttpClient
  trackDraft: (draft: AuthoredDraftResult) => void
}) {
  const lookup = (draft: AuthoredDraftResult) => ({
    subjectKind: 'EQUIPMENT' as const,
    subjectId: draft.subjectId
  })
  const publish = (draft: AuthoredDraftResult) => {
    assert.ok(draft.updatedAt)
    return owner.mutation(
      api.content.publication.publishDraft,
      {
        ...lookup(draft),
        expectedDraftUpdatedAt: draft.updatedAt
      },
      { skipQueue: true }
    )
  }
  const read = (draft: AuthoredDraftResult) =>
    owner
      .query(api.content.details.get, {
        subjectKind: 'EQUIPMENT',
        id: draft.publicId
      })
      .then((value) => authoredDetailResponseSchemas.EQUIPMENT.parse(value))

  const base = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'EQUIPMENT',
    subjectId: club.id
  })
  const copied = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'EQUIPMENT',
    subjectId: clubPlus1.id
  })
  trackDraft(base)
  trackDraft(copied)
  await publish(base)
  const child = await owner.mutation(api.content.drafts.save, {
    ...lookup(copied),
    systemId: copied.systemId,
    label: copied.label,
    payload: { ...copied.payload, parentEquipmentId: base.subjectId }
  })
  // A variant cannot veto its parent's deletion (ADR 0030): the deletion commits, and the variant is
  // published only if its publication, which requires a live parent, committed first.
  const [publication, deletion] = await Promise.allSettled([
    publish(child),
    owner.mutation(api.content.deletion.deleteActive, lookup(base), { skipQueue: true })
  ])
  assert.equal(deletion.status, 'fulfilled', 'Parent deletion must commit.')
  const [baseActive, childActive] = await Promise.all([read(base), read(child)])
  assert.equal(baseActive?.item ?? null, null)
  assert.equal(Boolean(childActive?.item), publication.status === 'fulfilled')
  if (childActive) await owner.mutation(api.content.deletion.deleteActive, lookup(child))
  if (baseActive) await owner.mutation(api.content.deletion.deleteActive, lookup(base))
  for (const draft of [child, base])
    if (await owner.query(api.content.drafts.get, lookup(draft)))
      await owner.mutation(api.content.drafts.discard, lookup(draft))

  const parent = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'EQUIPMENT',
    subjectId: club.id
  })
  trackDraft(parent)
  await publish(parent)
  const descendants: AuthoredDraftResult[] = []
  for (let index = 0; index < 2; index++) {
    const draft = await owner.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: clubPlus1.id
    })
    trackDraft(draft)
    const saved = await owner.mutation(api.content.drafts.save, {
      ...lookup(draft),
      systemId: draft.systemId,
      label: `Equipment proof generation ${index + 1}`,
      payload: {
        ...draft.payload,
        parentEquipmentId: descendants.at(-1)?.subjectId ?? parent.subjectId
      }
    })
    await publish(saved)
    descendants.push(saved)
  }
  const before = await Promise.all(descendants.map(read))
  const working = await owner.mutation(api.content.drafts.save, {
    ...lookup(descendants[0]!),
    systemId: parent.systemId,
    label: 'Private descendant working edit',
    payload: descendants[0]!.payload
  })
  const replacement = await owner.mutation(api.content.drafts.save, {
    ...lookup(parent),
    systemId: parent.systemId,
    label: parent.label,
    payload: { ...parent.payload, weight: { amount: 9, unit: 'POUNDS' } }
  })
  await publish(replacement)
  const after = await Promise.all(descendants.map(read))
  for (const [index, detail] of after.entries()) {
    assert.deepEqual(detail?.item, before[index]?.item)
    assert.equal(detail?.activeUpdatedAt, before[index]?.activeUpdatedAt)
  }
  assert.deepEqual(await owner.query(api.content.drafts.get, lookup(working)), working)
  const cycle = await owner.mutation(api.content.drafts.save, {
    ...lookup(parent),
    systemId: parent.systemId,
    label: parent.label,
    payload: {
      ...parent.payload,
      category: 'VARIANT',
      parentEquipmentId: descendants[1]!.subjectId
    }
  })
  await assert.rejects(publish(cycle), /cycle/i)
  assert.deepEqual(await owner.query(api.content.drafts.get, lookup(cycle)), cycle)
  // Deleting the parent keeps its published variants unchanged.
  await owner.mutation(api.content.deletion.deleteActive, lookup(parent))
  assert.equal((await read(parent))?.item ?? null, null)
  assert.deepEqual(
    (await Promise.all(descendants.map(read))).map((detail) => detail?.item),
    after.map((detail) => detail?.item)
  )
  if (await owner.query(api.content.drafts.get, lookup(parent)))
    await owner.mutation(api.content.drafts.discard, lookup(parent))
  for (const draft of [...descendants].reverse()) {
    await owner.mutation(api.content.deletion.deleteActive, lookup(draft))
    if (await owner.query(api.content.drafts.get, lookup(draft)))
      await owner.mutation(api.content.drafts.discard, lookup(draft))
  }
  console.log(
    'Managed Equipment parent deletion race, retained variant chain, current-parent replacement, draft isolation and cycle rejection passed; derived mechanics are covered by the local compilation tests.'
  )
}
