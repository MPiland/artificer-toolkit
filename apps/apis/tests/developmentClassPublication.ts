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
    const results = await Promise.allSettled([publish(connected), parentOperation])
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
      `${mode}: exactly one conflicting mutation must commit.`
    )
    const read = (draft: AuthoredDraftResult) =>
      owner.query(api.content.details.get, {
        subjectKind: 'CLASS',
        id: draft.publicId
      })
    const childActive = authoredDetailResponseSchemas.CLASS.parse(await read(child))
    const baseActive = authoredDetailResponseSchemas.CLASS.parse(await read(base))
    assert.equal(Boolean(childActive), baseActive?.item?.category === 'BASE')

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
  const classBefore = await readClass()
  const spellBefore = await readSpell()
  assert.ok(classBefore?.item)
  assert.ok(spellBefore?.item)
  assert.deepEqual(spellBefore.item.classIds, [base.subjectId])
  await assert.rejects(
    owner.mutation(api.content.deletion.deleteActive, {
      subjectKind: 'CLASS',
      subjectId: base.subjectId
    }),
    /referenced by published Spells/
  )
  assert.deepEqual(await readClass(), classBefore)
  assert.deepEqual(await readSpell(), spellBefore)

  const workingSpell = authoredDraftDtoSchema.parse(
    await owner.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: spell.subjectId,
      systemId: spell.systemId,
      label: spell.label,
      payload: { ...spell.payload, classIds: [base.subjectId] }
    })
  )
  await owner.mutation(api.content.deletion.deleteActive, {
    subjectKind: 'SPELL',
    subjectId: spell.subjectId
  })
  const remainingSpell = authoredDraftDtoSchema.parse(
    await owner.query(api.content.drafts.get, {
      subjectKind: 'SPELL',
      subjectId: spell.subjectId
    })
  )
  if (!remainingSpell.updatedAt) throw new Error('Spell draft retention lost its revision.')
  const publication = owner.mutation(
    api.content.publication.publishDraft,
    {
      subjectKind: 'SPELL',
      subjectId: workingSpell.subjectId,
      expectedDraftUpdatedAt: remainingSpell.updatedAt
    },
    { skipQueue: true }
  )
  const deletion = owner.mutation(
    api.content.deletion.deleteActive,
    {
      subjectKind: 'CLASS',
      subjectId: base.subjectId
    },
    { skipQueue: true }
  )
  const race = await Promise.allSettled([publication, deletion])
  assert.equal(
    race[0]?.status,
    'fulfilled',
    'Spell publication must succeed when racing Class deletion.'
  )
  const classAfter = await readClass()
  const spellAfter = await readSpell()
  assert.ok(spellAfter?.item)
  const classExists = Boolean(classAfter?.item)
  assert.equal(spellAfter.item.classIds.includes(base.subjectId), classExists)
  assert.equal(race[1]?.status, classExists ? 'rejected' : 'fulfilled')
  if (race[1]?.status === 'rejected')
    assert.match(String(race[1].reason), /referenced by published Spells/)
  await owner.mutation(api.content.deletion.deleteActive, {
    subjectKind: 'SPELL',
    subjectId: spell.subjectId
  })
  if (classAfter)
    await owner.mutation(api.content.deletion.deleteActive, {
      subjectKind: 'CLASS',
      subjectId: base.subjectId
    })
  console.log('Managed Class parent races and Spell Class-reference deletion race passed.')
}
