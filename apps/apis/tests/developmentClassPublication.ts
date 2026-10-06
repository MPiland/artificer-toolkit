import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import {
  authoredDraftDtoSchema,
  type AuthoredDraftResult
} from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredDetailResponseSchemas } from '@artificer-toolkit/schema/api/content'
import { api } from '../convex/_generated/api.js'

const lookup = (draft: AuthoredDraftResult) => ({
  subjectKind: 'CLASS' as const,
  subjectId: draft.subjectId
})
const publishInput = (draft: AuthoredDraftResult) =>
  authoredPublishDraftInputSchema.parse({
    ...lookup(draft),
    expectedDraftUpdatedAt: draft.updatedAt
  })

export async function verifyClassPublicationRaces({
  owner,
  fighterId,
  championId,
  fireballId,
  trackDraft
}: {
  owner: ConvexHttpClient
  fighterId: string
  championId: string
  fireballId: string
  trackDraft: (draft: AuthoredDraftResult) => void
}) {
  const publish = (draft: AuthoredDraftResult) =>
    owner.action(api.content.classPublicationActions.publishDraft, {
      ...publishInput(draft),
      subjectKind: 'CLASS'
    })
  for (const mode of ['DELETE', 'CONVERT'] as const) {
    const base = authoredDraftDtoSchema.parse(
      await owner.mutation(api.content.drafts.duplicate, {
        subjectKind: 'CLASS',
        subjectId: fighterId
      })
    )
    const child = authoredDraftDtoSchema.parse(
      await owner.mutation(api.content.drafts.duplicate, {
        subjectKind: 'CLASS',
        subjectId: championId
      })
    )
    trackDraft(base)
    trackDraft(child)
    await publish(base)
    const connected = authoredDraftDtoSchema.parse(
      await owner.mutation(api.content.drafts.save, {
        ...lookup(child),
        systemId: child.systemId,
        label: child.label,
        payload: { ...child.payload, parentClassId: base.subjectId }
      })
    )
    const parentOperation =
      mode === 'DELETE'
        ? owner.mutation(api.content.deletion.deleteActive, lookup(base), {
            skipQueue: true
          })
        : publish(
            authoredDraftDtoSchema.parse(
              await owner.mutation(api.content.drafts.save, {
                ...lookup(base),
                systemId: base.systemId,
                label: base.label,
                payload: { ...child.payload, parentClassId: fighterId }
              })
            )
          )
    const [childPublication, parentResult] = await Promise.allSettled([
      publish(connected),
      parentOperation
    ])
    const read = (draft: AuthoredDraftResult) =>
      owner.query(api.content.details.get, {
        subjectKind: 'CLASS',
        id: draft.publicId
      })
    const childActive = authoredDetailResponseSchemas.CLASS.parse(await read(child))
    const baseActive = authoredDetailResponseSchemas.CLASS.parse(await read(base))
    assert.equal(Boolean(childActive?.item), childPublication.status === 'fulfilled')
    if (mode === 'DELETE') {
      // A published subclass cannot veto its parent's deletion; it keeps its parent reference and
      // publishes only while that parent is live (ADR 0030).
      assert.equal(parentResult.status, 'fulfilled', 'Parent deletion must commit.')
      assert.equal(baseActive?.item ?? null, null)
    } else {
      assert.equal(
        [childPublication, parentResult].filter((result) => result.status === 'fulfilled').length,
        1,
        'CONVERT: exactly one conflicting mutation must commit.'
      )
      assert.equal(Boolean(childActive?.item), baseActive?.item?.category === 'BASE')
    }

    if (childActive) await owner.mutation(api.content.deletion.deleteActive, lookup(child))
    if (baseActive) await owner.mutation(api.content.deletion.deleteActive, lookup(base))
    for (const draft of [child, base]) {
      if (await owner.query(api.content.drafts.get, lookup(draft)))
        await owner.mutation(api.content.drafts.discard, lookup(draft))
    }
  }
  const base = authoredDraftDtoSchema.parse(
    await owner.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CLASS',
      subjectId: fighterId
    })
  )
  trackDraft(base)
  await publish(base)

  const spell = authoredDraftDtoSchema.parse(
    await owner.mutation(api.content.drafts.duplicate, {
      subjectKind: 'SPELL',
      subjectId: fireballId
    })
  )
  trackDraft(spell)
  const savedSpell = authoredDraftDtoSchema.parse(
    await owner.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: spell.subjectId,
      systemId: spell.systemId,
      label: spell.label,
      payload: { ...spell.payload, classIds: [base.subjectId] }
    })
  )
  if (!savedSpell.updatedAt) throw new Error('Fireball draft save did not return its revision.')
  await owner.mutation(api.content.publication.publishDraft, {
    subjectKind: 'SPELL',
    subjectId: savedSpell.subjectId,
    expectedDraftUpdatedAt: savedSpell.updatedAt
  })

  const readClass = async () =>
    authoredDetailResponseSchemas.CLASS.parse(
      await owner.query(api.content.details.get, {
        subjectKind: 'CLASS',
        id: base.publicId
      })
    )
  const readSpell = async () =>
    authoredDetailResponseSchemas.SPELL.parse(
      await owner.query(api.content.details.get, {
        subjectKind: 'SPELL',
        id: spell.publicId
      })
    )
  const spellBefore = await readSpell()
  assert.ok(spellBefore?.item)
  assert.deepEqual(spellBefore.item.classIds, [base.subjectId])
  const workingSpell = authoredDraftDtoSchema.parse(
    await owner.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: spell.subjectId,
      systemId: spell.systemId,
      label: spell.label,
      payload: { ...spell.payload, classIds: [base.subjectId] }
    })
  )
  if (!workingSpell.updatedAt)
    throw new Error('Spell working draft save did not return its revision.')
  // A published Spell cannot veto deleting its Class (ADR 0030): the deletion commits and the
  // Spell's published document keeps its reference. A republication racing it either commits or is
  // refused against the missing Class.
  const race = await Promise.allSettled([
    owner.mutation(
      api.content.publication.publishDraft,
      {
        subjectKind: 'SPELL',
        subjectId: workingSpell.subjectId,
        expectedDraftUpdatedAt: workingSpell.updatedAt
      },
      { skipQueue: true }
    ),
    owner.mutation(
      api.content.deletion.deleteActive,
      { subjectKind: 'CLASS', subjectId: base.subjectId },
      { skipQueue: true }
    )
  ])
  assert.equal(
    race[1]?.status,
    'fulfilled',
    'Class deletion must commit despite a Spell reference.'
  )
  assert.equal((await readClass())?.item ?? null, null)
  const spellAfter = await readSpell()
  assert.ok(spellAfter?.item)
  // The published Spell is judged by which side of the race the publication fell on.
  const publication = race[0]
  if (publication?.status === 'rejected') {
    assert.deepEqual(
      spellAfter.item,
      spellBefore.item,
      `A refused republication must leave the published Spell unchanged: ${String(publication.reason)}`
    )
  } else {
    assert.ok(
      spellAfter.item.classIds.every((id) => id === base.subjectId),
      'A committed republication may keep or drop the deleted Class, never add another.'
    )
  }
  console.log(
    `Spell republication ${publication?.status} against Class deletion; published Class references: ${JSON.stringify(spellAfter.item.classIds)}.`
  )
  await owner.mutation(api.content.deletion.deleteActive, {
    subjectKind: 'SPELL',
    subjectId: spell.subjectId
  })
  console.log('Managed Class parent races and retained Spell Class-reference deletion race passed.')
}
