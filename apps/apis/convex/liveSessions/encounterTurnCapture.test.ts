import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { createSpatialPreparationFixture } from '../../tests/fixtures/spatialPreparation'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import { insertActiveLiveAuthority } from '../../tests/fixtures/liveSessionWorker'

const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')

async function setup() {
  const { base } = await createSpatialPreparationFixture()
  const epoch = crypto.randomUUID()
  const actorIds = base.run.actors.slice(0, 2).map((actor) => actor.id)
  if (actorIds.length !== 2) throw new Error('Missing fixture Encounter actors.')
  const tokenIds = base.tokens.slice(0, 2).map((token) => token.id.toLowerCase())
  await base.t.run(async (ctx) => {
    await insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: base.campaign.createdAt
    })
    for (const [index, actorId] of actorIds.entries())
      await ctx.db.insert('encounterActorTokenBindings', {
        encounterId: base.run.id,
        actorId,
        sceneId: base.sceneId,
        tokenId: tokenIds[index]!
      })
  })
  const input: LiveSessionEncounterRulesInput = {
    campaignId: base.campaign.id,
    authorityEpoch: epoch,
    expectedUserId: base.other.userId,
    expectedRole: 'OWNER',
    encounterId: base.run.id,
    expectedVersion: base.run.version,
    request: { kind: 'MAINTENANCE_STATE', stateId: crypto.randomUUID() }
  }
  return { ...base, input, actorIds, tokenIds }
}

it('rejects player, concentration-child, stale epoch, and stale Run scopes before raw turn reads', async () => {
  const base = await setup()
  const requests: LiveSessionEncounterRulesRequest[] = [
    { kind: 'MAINTENANCE_STATE', stateId: crypto.randomUUID() },
    {
      kind: 'SCENE_PERCEPTION',
      observerActorId: base.actorIds[0]!,
      subjectActorId: base.actorIds[1]!
    },
    {
      kind: 'SCENE_PERCEPTION_ENTITIES',
      page: {
        sceneId: base.sceneId,
        expectedVersion: 0,
        definitionSaveId: base.saveId,
        collection: 'tokens',
        numItems: 1,
        phase: 'BASE',
        afterOrdinal: null
      }
    },
    {
      kind: 'SCENE_SPATIAL_EFFECTS',
      sceneId: base.sceneId,
      expectedSceneVersion: 0,
      afterEffectId: null
    }
  ]
  const concentrationResponse = {
    type: 'RESOLVE_RULE_OCCURRENCE' as const,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: base.run.version,
    correlationId: null,
    occurrenceId: crypto.randomUUID(),
    expectedOccurrenceVersion: 0,
    resolution: {
      kind: 'SYSTEM_ROLL' as const,
      requestId: 'turn-capture-scope',
      rollId: crypto.randomUUID()
    }
  }
  for (const request of requests) {
    // A player reads turn inputs only under an admitted turn command of their own.
    await expect(
      base.owner.caller.query(capture, {
        ...base.input,
        expectedUserId: base.owner.userId,
        expectedRole: 'PLAYER',
        request
      })
    ).rejects.toThrow('Turn capture requires owner or admitted response scope.')
    await expect(
      base.owner.caller.query(capture, {
        ...base.input,
        expectedUserId: base.owner.userId,
        expectedRole: 'PLAYER',
        concentrationResponse,
        request
      })
    ).rejects.toThrow('Turn capture requires owner or admitted response scope.')
    await expect(
      base.other.caller.query(capture, { ...base.input, concentrationResponse, request })
    ).rejects.toThrow('Turn capture requires owner or admitted response scope.')
  }
  await expect(
    base.other.caller.query(capture, {
      ...base.input,
      authorityEpoch: crypto.randomUUID()
    })
  ).rejects.toThrow('stale')
  await expect(
    base.other.caller.query(capture, {
      ...base.input,
      expectedVersion: base.run.version + 1
    })
  ).rejects.toThrow('version mismatch')
})

it('reads only this Run’s maintained state and rejects its damaged stored checksum', async () => {
  const base = await setup()
  const stateId = crypto.randomUUID()
  const missing = await base.other.caller.query(capture, {
    ...base.input,
    request: { kind: 'MAINTENANCE_STATE', stateId }
  })
  expect(missing).toMatchObject({ kind: 'MAINTENANCE_STATE', state: null })
  const state = await base.t.run((ctx) =>
    createActiveRuleEffectStore(ctx).createMaintainedState({
      id: stateId,
      encounterId: base.run.id,
      ownerActorId: base.actorIds[0]!,
      descriptor: {
        schemaVersion: 2,
        maintenanceDefinitionId: crypto.randomUUID(),
        definitionChecksum: 'b'.repeat(64),
        sourceActionId: crypto.randomUUID(),
        sourceOccurrenceId: crypto.randomUUID(),
        sourceActorId: base.actorIds[0]!,
        replacementPolicy: 'REPLACE_SAME_DEFINITION',
        emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
      }
    })
  )
  const current = await base.other.caller.query(capture, {
    ...base.input,
    request: { kind: 'MAINTENANCE_STATE', stateId }
  })
  expect(current).toMatchObject({ kind: 'MAINTENANCE_STATE', state })
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', stateId))
      .unique()
  )
  if (!row) throw new Error('Missing fixture maintained state.')
  const foreignId = crypto.randomUUID()
  const { _id: _stateRowId, _creationTime: _stateCreatedAt, ...storedState } = row
  await base.t.run((ctx) =>
    ctx.db.insert('encounterMaintainedEffectStates', {
      ...storedState,
      id: foreignId,
      encounterId: crypto.randomUUID()
    })
  )
  await expect(
    base.other.caller.query(capture, {
      ...base.input,
      request: { kind: 'MAINTENANCE_STATE', stateId: foreignId }
    })
  ).resolves.toMatchObject({ state: null })
  await base.t.run((ctx) => ctx.db.patch(row._id, { descriptorChecksum: '0'.repeat(64) }))
  await expect(
    base.other.caller.query(capture, {
      ...base.input,
      request: { kind: 'MAINTENANCE_STATE', stateId }
    })
  ).rejects.toThrow('descriptor checksum')
})

it('captures bound perception identities and returns null for a missing actor binding', async () => {
  const base = await setup()
  const request = {
    kind: 'SCENE_PERCEPTION' as const,
    observerActorId: base.actorIds[0]!,
    subjectActorId: base.actorIds[1]!
  }
  const current = await base.other.caller.query(capture, { ...base.input, request })
  expect(current).toMatchObject({
    kind: 'SCENE_PERCEPTION',
    context: {
      header: { id: base.sceneId, campaignId: base.campaign.id, version: 0 },
      observerTokenId: base.tokenIds[0],
      subjectTokenId: base.tokenIds[1]
    }
  })
  await expect(
    base.other.caller.query(capture, {
      ...base.input,
      request: { ...request, subjectActorId: crypto.randomUUID() }
    })
  ).rejects.toThrow('not in the Encounter')
  const binding = await base.t.run((ctx) =>
    ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', base.run.id).eq('actorId', request.subjectActorId)
      )
      .unique()
  )
  if (!binding) throw new Error('Missing fixture actor-token binding.')
  await base.t.run((ctx) => ctx.db.delete(binding._id))
  await expect(base.other.caller.query(capture, { ...base.input, request })).resolves.toMatchObject(
    {
      context: null
    }
  )
})

it('keeps Scene entity pages bound to the current Scene version and base save', async () => {
  const base = await setup()
  const page = {
    sceneId: base.sceneId,
    expectedVersion: 0,
    definitionSaveId: base.saveId,
    collection: 'tokens' as const,
    numItems: 1,
    phase: 'BASE' as const,
    afterOrdinal: null
  }
  const first = await base.other.caller.query(capture, {
    ...base.input,
    request: { kind: 'SCENE_PERCEPTION_ENTITIES', page }
  })
  if (first.kind !== 'SCENE_PERCEPTION_ENTITIES') throw new Error('Missing first entity page.')
  expect(first.page.page).toHaveLength(1)
  expect(first.page.next).toEqual({ phase: 'BASE', afterOrdinal: 0 })
  const second = await base.other.caller.query(capture, {
    ...base.input,
    request: { kind: 'SCENE_PERCEPTION_ENTITIES', page: { ...page, ...first.page.next! } }
  })
  if (second.kind !== 'SCENE_PERCEPTION_ENTITIES') throw new Error('Missing second entity page.')
  expect(second.page.page).toHaveLength(1)
  expect(second.page.next).toEqual({ phase: 'APPENDED', afterOrdinal: null })
  const terminal = await base.other.caller.query(capture, {
    ...base.input,
    request: { kind: 'SCENE_PERCEPTION_ENTITIES', page: { ...page, ...second.page.next! } }
  })
  expect(terminal).toMatchObject({ page: { page: [], next: null } })
  for (const rejected of [
    { ...page, sceneId: crypto.randomUUID() },
    { ...page, expectedVersion: 1 },
    { ...page, definitionSaveId: crypto.randomUUID() },
    { ...page, numItems: 9 }
  ])
    await expect(
      base.other.caller.query(capture, {
        ...base.input,
        request: { kind: 'SCENE_PERCEPTION_ENTITIES', page: rejected }
      })
    ).rejects.toThrow()
  const source = await base.t.run((ctx) =>
    ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', base.saveId).eq('value.collection', 'tokens')
      )
      .first()
  )
  if (!source) throw new Error('Missing fixture Scene entity.')
  await base.t.run((ctx) => ctx.db.patch(source._id, { checksum: '0'.repeat(64) }))
  await expect(
    base.other.caller.query(capture, {
      ...base.input,
      request: { kind: 'SCENE_PERCEPTION_ENTITIES', page }
    })
  ).rejects.toThrow('source is inconsistent')
})

it('pages at most four bound spatial effects and checks stored integrity', async () => {
  const base = await setup()
  const request = {
    kind: 'SCENE_SPATIAL_EFFECTS' as const,
    sceneId: base.sceneId,
    expectedSceneVersion: 0,
    afterEffectId: null
  }
  const empty = await base.other.caller.query(capture, { ...base.input, request })
  expect(empty).toMatchObject({
    kind: 'SCENE_SPATIAL_EFFECTS',
    sceneId: base.sceneId,
    sceneVersion: 0,
    effects: [],
    continueAfter: null
  })
  const seeded = await seedSpatialEffect(base)
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_publicId', (q) => q.eq('id', seeded.id))
      .unique()
  )
  if (!row) throw new Error('Missing fixture spatial effect.')
  const { _id: _rowId, _creationTime: _rowCreatedAt, ...stored } = row
  await base.t.run(async (ctx) => {
    for (let ordinal = 2; ordinal <= 5; ordinal += 1)
      await ctx.db.insert('encounterSpatialRuleEffects', {
        ...stored,
        id: crypto.randomUUID(),
        createdOrdinal: ordinal
      })
  })
  const first = await base.other.caller.query(capture, { ...base.input, request })
  if (first.kind !== 'SCENE_SPATIAL_EFFECTS') throw new Error('Missing first spatial page.')
  expect(first.effects).toHaveLength(4)
  expect(first.continueAfter).toBe(first.effects[3]!.id)
  const second = await base.other.caller.query(capture, {
    ...base.input,
    request: { ...request, afterEffectId: first.continueAfter }
  })
  if (second.kind !== 'SCENE_SPATIAL_EFFECTS') throw new Error('Missing second spatial page.')
  expect(second.effects).toHaveLength(1)
  expect(second.continueAfter).toBeNull()
  expect(new Set([...first.effects, ...second.effects].map((effect) => effect.id)).size).toBe(5)
  await expect(
    base.other.caller.query(capture, {
      ...base.input,
      request: { ...request, afterEffectId: second.effects[0]!.id }
    })
  ).resolves.toMatchObject({ effects: [], continueAfter: null })
  for (const rejected of [
    { ...request, sceneId: crypto.randomUUID() },
    { ...request, expectedSceneVersion: 1 }
  ])
    await expect(
      base.other.caller.query(capture, { ...base.input, request: rejected })
    ).rejects.toThrow()
  const damaged = first.effects[0]!
  const damagedRow = await base.t.run((ctx) =>
    ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_publicId', (q) => q.eq('id', damaged.id))
      .unique()
  )
  if (!damagedRow) throw new Error('Missing fixture spatial page row.')
  await base.t.run((ctx) => ctx.db.patch(damagedRow._id, { definitionChecksum: '0'.repeat(64) }))
  await expect(base.other.caller.query(capture, { ...base.input, request })).rejects.toThrow(
    'definition checksum'
  )
})
