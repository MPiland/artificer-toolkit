import assert from 'node:assert/strict'
import type { DevelopmentClient } from './developmentClient'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredDetailResponseSchemas } from '@artificer-toolkit/schema/api/content'
import { api } from '../convex/_generated/api.js'

export async function cleanupEquipmentCapacity(owner: DevelopmentClient, ids: readonly string[]) {
  for (const id of [...ids].reverse()) {
    const lookup = { subjectKind: 'EQUIPMENT' as const, subjectId: id }
    const detail = { subjectKind: 'EQUIPMENT' as const, id }
    // One provider-error retry is safe because each attempt first re-reads the exact UUID.
    for (let attempt = 0; ; attempt++) {
      try {
        if (await owner.query(api.content.details.get, detail))
          await owner.mutation(api.content.deletion.deleteActive, lookup)
        if (await owner.query(api.content.drafts.get, lookup))
          await owner.mutation(api.content.drafts.discard, lookup)
        assert.equal(await owner.query(api.content.details.get, detail), null)
        assert.equal(await owner.query(api.content.drafts.get, lookup), null)
        break
      } catch (error) {
        if (attempt || !(error instanceof Error) || !error.message.includes('InternalServerError'))
          throw error
      }
    }
  }
}

export async function verifyEquipmentCapacity({
  owner,
  userId
}: {
  owner: DevelopmentClient
  userId: string
}) {
  const systemId = club.systemId
  const baseline = await owner.query(api.content.equipmentOptions.list, { systemId })
  const owned = await owner.query(api.content.catalogue.counts, {
    subjectKind: 'EQUIPMENT',
    systemId
  })
  assert.equal(owned.ownedCount, 0, 'Capacity proof requires a fresh disposable author.')
  const size = 500 - baseline.length
  assert.ok(size >= 2, 'Capacity proof requires room for a parent and descendant.')
  // Register UUIDs before requests: cleanup also covers a committed request whose response failed.
  const ids = Array.from({ length: size }, () => crypto.randomUUID())
  const lookup = (subjectId: string) => ({ subjectKind: 'EQUIPMENT' as const, subjectId })
  const read = (id: string) =>
    owner
      .query(api.content.details.get, { subjectKind: 'EQUIPMENT', id })
      .then((value) => authoredDetailResponseSchemas.EQUIPMENT.parse(value))
  const publish = async (draft: AuthoredDraftResult) => {
    assert.ok(draft.updatedAt)
    await owner.mutation(api.content.publication.publishDraft, {
      ...lookup(draft.subjectId),
      expectedDraftUpdatedAt: draft.updatedAt
    })
  }
  const base = {
    kind: 'EQUIPMENT' as const,
    id: ids[0]!,
    label: 'Capacity generation 0',
    description: null,
    category: 'ADVENTURING_GEAR' as const,
    properties: [],
    rarityId: club.rarityId,
    systemId,
    userId,
    weight: { amount: 2, unit: 'POUNDS' as const }
  }
  try {
    for (const [index, id] of ids.entries()) {
      const draft = await owner.mutation(api.content.drafts.save, {
        ...lookup(id),
        systemId,
        label: `Capacity generation ${index}`,
        payload: {
          ...base,
          id,
          ...(index ? { category: 'VARIANT', parentEquipmentId: ids[index - 1]! } : {})
        }
      })
      await publish(draft)
    }
    const options = await owner.query(api.content.equipmentOptions.list, { systemId })
    assert.equal(options.length, 500)
    assert.deepEqual(
      options.map((item) => item.value).sort(),
      [...baseline.map((item) => item.value), ...ids].sort()
    )
    const leafId = ids.at(-1)!
    const before = await read(leafId)
    assert.ok(before?.item)
    const started = performance.now()
    await publish(
      await owner.mutation(api.content.drafts.save, {
        ...lookup(base.id),
        systemId,
        label: base.label,
        payload: { ...base, weight: { amount: 9, unit: 'POUNDS' } }
      })
    )
    const replacementMs = Math.round(performance.now() - started)
    assert.deepEqual(
      await read(leafId),
      before,
      'Recompilation must preserve descendant source identity.'
    )
    await publish(
      await owner.mutation(api.content.drafts.save, {
        ...lookup(leafId),
        systemId,
        label: before.item.label,
        payload: before.item
      })
    )

    assert.equal((await owner.query(api.content.equipmentOptions.list, { systemId })).length, 500)
    console.log(
      `Equipment capacity: 500 exact visible options; ${size}-generation public chain, root replacement (${replacementMs} ms), deepest publication passed. This does not prove a 500-generation managed chain or percentile headroom.`
    )
  } finally {
    await cleanupEquipmentCapacity(owner, ids)
    assert.deepEqual(await owner.query(api.content.equipmentOptions.list, { systemId }), baseline)
    console.log(
      `Equipment capacity cleanup: all ${ids.length} registered UUIDs absent; original option set restored.`
    )
  }
}
