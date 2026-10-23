import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type { ContentSnapshotHead } from '@artificer-toolkit/schema/api/contentSnapshots'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  ShareCampaignContentInput,
  leaveCampaignInputSchema,
  campaignMembershipDepartureResultSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  liveRoomActorSourceSchema,
  liveRoomInputsResponseSchema,
  type LiveRoomInputsInput,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  MAX_ROOM_INPUT_PAGE_DOCUMENTS,
  readRoomInputsBatch
} from '@artificer-toolkit/schema/api/liveRoomInputsBatch'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { absoluteMinute } from '@artificer-toolkit/rules-runtime/campaignClock'
import { createSceneDefinitionFixture, publishScene } from '../../tests/fixtures/sceneDefinitions'
import { readLiveSceneForUser } from '../scenes/liveDocuments'
import { advanceLiveState } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  attachFixtureRoom,
  checkpointRoom,
  executeSceneInRoom,
  insertActiveLiveAuthority,
  readLiveAuthorityEpoch,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { api } from '../_generated/api'
import {
  campaignRollNonceFingerprint,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { insertConversationEntry } from '../campaigns/conversationDocuments'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { requireDefaultUserContentSource } from '../content/sources'
import { encodeDefinitionDocument } from '../content/definitionDocumentJson'

useLocalRoomWorker()

const read = makeFunctionReference<'query', LiveRoomInputsInput, LiveRoomInputsResponse>(
  'liveSessions/roomInputs:read'
)
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const shareContent = makeFunctionReference<'mutation', ShareCampaignContentInput, unknown>(
  'campaigns/contentShares:share'
)
const leave = makeFunctionReference<
  'mutation',
  z.input<typeof leaveCampaignInputSchema>,
  z.output<typeof campaignMembershipDepartureResultSchema>
>('campaigns/membershipDeparture:leave')
const secret = 'private-room-inputs-test-secret-at-least-32-bytes'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function setup() {
  const base = await setupCharacterRun()
  // Raw publication fixtures need transport heads. These references exercise manifest delivery;
  // they do not claim a matching object has been built or stored in R2.
  await base.t.run(async (ctx) => {
    const sources = await ctx.db
      .query('contentSources')
      .withIndex('by_gameSystemId', (q) => q.eq('gameSystemId', srdSystemRecord.id))
      .collect()
    for (const source of sources) {
      const head = await ctx.db
        .query('contentSnapshotHeads')
        .withIndex('by_scope_scopeId', (q) => q.eq('scope', 'SOURCE').eq('scopeId', source.id))
        .unique()
      if (head) continue
      const roots = await ctx.db
        .query('authoredRoots')
        .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
          q.eq('contentSourceId', source.id)
        )
        .collect()
      if (!roots.length) continue
      const kinds: ContentSnapshotHead['kinds'] = {}
      for (const root of roots) {
        const reference = (part: string) => ({
          sha256: checksumRuleDocument({
            fixtureSourceId: source.id,
            kind: root.subjectKind,
            part
          }),
          byteLength: 1,
          rootCount: (kinds[root.subjectKind]?.documents.rootCount ?? 0) + 1
        })
        kinds[root.subjectKind] = {
          index: reference('index'),
          list: reference('list'),
          documents: reference('documents')
        }
      }
      await ctx.db.insert('contentSnapshotHeads', {
        scope: 'SOURCE',
        scopeId: source.id,
        revision: 1,
        builtRevision: 1,
        kinds
      })
    }
  })
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: new Date().toISOString()
    })
  )
  const request = (scope: LiveRoomInputsScope) => ({
    campaignId: base.campaign.id,
    epoch,
    scope
  })
  /** Every page of the Run, in the order the room reads them. */
  async function runPages() {
    const pages: Extract<LiveRoomInputsResponse, { kind: 'RUN' }>[] = []
    let cursor: Extract<LiveRoomInputsScope, { kind: 'RUN' }>['cursor'] = null
    do {
      const page: LiveRoomInputsResponse = await base.t.query(
        read,
        request({ kind: 'RUN', encounterId: base.run.id, cursor })
      )
      if (page.kind !== 'RUN') throw new Error('Expected a Run page.')
      pages.push(page)
      cursor = page.continueCursor
    } while (cursor)
    return pages
  }
  const characters = (
    cursor: Extract<LiveRoomInputsScope, { kind: 'CHARACTERS' }>['cursor'] = null
  ) => request({ kind: 'CHARACTERS', characterIds: [base.character.id], cursor })
  return { ...base, epoch, request, characters, runPages }
}

async function setupScene(withGeometry = false) {
  const base = await createSceneDefinitionFixture()
  // A seeing token the room can move, so its checkpoint writes the live, command and fog families.
  const token = {
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: [base.other.userId],
    height: 1,
    hidden: false,
    label: 'Native token',
    locked: false,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    senses: [],
    vision: { angleDegrees: 360, brightRange: 0, dimRange: 5, directionDegrees: 0, enabled: true },
    width: 1
  }
  const scene = await publishScene(base, { tokens: withGeometry ? [token] : [] })
  const presentation = await base.owner.caller.mutation(api.scenes.presentations.set, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId: scene.sceneId
  })
  let epoch: string = crypto.randomUUID()
  if (withGeometry) {
    // The real room claims the Campaign's authority with its first command; read its epoch back.
    await attachFixtureRoom(base.t, base.campaign.id)
    await executeSceneInRoom(base.owner.caller, {
      type: 'MOVE_SCENE_TOKEN',
      commandId: crypto.randomUUID(),
      sceneId: scene.sceneId,
      tokenId: token.id,
      expectedSceneVersion: 0,
      expectedEncounterVersion: null,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      path: [token.position, { x: 900, y: 100 }]
    })
    await checkpointRoom(base.campaign.id)
    epoch = await readLiveAuthorityEpoch(base.t, base.campaign.id)
  } else {
    await base.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: base.campaign.id,
        epoch,
        createdAt: new Date().toISOString()
      })
    )
  }
  const request = (
    cursor: Extract<LiveRoomInputsScope, { kind: 'SCENE' }>['cursor'] = null
  ): LiveRoomInputsInput => ({
    campaignId: base.campaign.id,
    epoch,
    scope: { kind: 'SCENE', sceneId: scene.sceneId, cursor }
  })
  const page = async (cursor: Extract<LiveRoomInputsScope, { kind: 'SCENE' }>['cursor'] = null) => {
    const response = await base.t.query(read, request(cursor))
    if (response.kind !== 'SCENE') throw new Error('Expected Scene inputs.')
    return response
  }
  return { ...base, ...scene, epoch, presentation, request, page }
}

describe('raw room Scene inputs', () => {
  it('hydrates paged immutable definition geometry with exact pins and refuses stale or foreign scope', async () => {
    const base = await createSceneDefinitionFixture()
    const counts = { ...base.input.counts, barriers: MAX_ROOM_INPUT_PAGE_DOCUMENTS + 1 }
    const save = await base.owner.caller.mutation(api.scenes.definitions.begin, {
      ...base.input,
      counts
    })
    if (!save.liveSceneId) throw new Error('Missing live Scene fixture.')
    const sceneId = save.liveSceneId
    const expected = Array.from({ length: counts.barriers }, (_, ordinal) => {
      const entityId = crypto.randomUUID()
      const value = {
        collection: 'barriers' as const,
        entity: {
          id: entityId,
          kind: 'WALL' as const,
          a: { x: ordinal, y: 0 },
          b: { x: ordinal, y: 10 },
          blocksLight: true,
          blocksMovement: true
        }
      }
      return sceneStoredDefinitionEntitySchema.parse({
        saveId: save.saveId,
        entityId,
        ordinal,
        value,
        checksum: checksumCanonicalJson(value)
      })
    })
    await base.t.run(async (ctx) => {
      for (const entity of expected) await ctx.db.insert('sceneDefinitionEntities', entity)
      await ctx.db.insert('sceneDefinitionEntities', {
        ...expected[0]!,
        saveId: crypto.randomUUID()
      })
      const row = await ctx.db
        .query('sceneDefinitionSaves')
        .withIndex('by_publicId', (q) => q.eq('id', save.saveId))
        .unique()
      if (!row) throw new Error('Missing definition save fixture.')
      await ctx.db.patch(row._id, { received: counts })
    })
    await base.owner.caller.mutation(api.scenes.definitions.publish, { saveId: save.saveId })
    const presentation = await base.owner.caller.mutation(api.scenes.presentations.set, {
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
      commandId: crypto.randomUUID(),
      expectedPresentationVersion: null,
      campaignId: base.campaign.id,
      sceneId
    })
    const epoch = crypto.randomUUID()
    await base.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: base.campaign.id,
        epoch,
        createdAt: new Date().toISOString()
      })
    )
    const input: LiveRoomInputsInput = {
      campaignId: base.campaign.id,
      epoch,
      scope: { kind: 'SCENE_DEFINITION', sceneId, cursor: null }
    }
    const first = await base.t.query(read, input)
    if (first.kind !== 'SCENE_DEFINITION') throw new Error('Expected definition inputs.')
    expect(first.entities).toHaveLength(MAX_ROOM_INPUT_PAGE_DOCUMENTS)
    expect(first.continueCursor).toMatchObject({ position: 0 })
    expect(first.source).toEqual({
      sceneId,
      definitionSaveId: save.saveId,
      definitionVersion: 1,
      presentationVersion: presentation.version
    })
    expect(first.header).toMatchObject({
      id: sceneId,
      definitionSaveId: save.saveId,
      definitionVersion: 1,
      version: 0,
      counts,
      currentCounts: { ...counts, measurements: 0 }
    })
    const second = await base.t.query(read, {
      ...input,
      scope: { kind: 'SCENE_DEFINITION', sceneId, cursor: first.continueCursor }
    })
    if (second.kind !== 'SCENE_DEFINITION') throw new Error('Expected definition inputs.')
    expect(second.entities).toHaveLength(1)
    expect(second.continueCursor).toBeNull()
    expect(second.source).toEqual(first.source)
    expect(second.header).toEqual(first.header)
    expect([...first.entities, ...second.entities]).toEqual(expected)
    expect(first.entities[0]).not.toHaveProperty('_id')
    expect(first.entities[0]).not.toHaveProperty('_creationTime')
    await expect(
      base.t.query(read, {
        ...input,
        scope: {
          kind: 'SCENE_DEFINITION',
          sceneId,
          cursor: { position: 1, paginationCursor: null }
        }
      })
    ).rejects.toThrow('cursor is invalid')
    await expect(base.t.query(read, { ...input, epoch: crypto.randomUUID() })).rejects.toThrow(
      'authority is stale'
    )
    await expect(
      base.t.query(read, {
        ...input,
        scope: { kind: 'SCENE_DEFINITION', sceneId: crypto.randomUUID(), cursor: null }
      })
    ).rejects.toThrow('not presented')
    const other = await base.other.caller.mutation(createCampaign, {
      name: 'Foreign definition Campaign',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const otherEpoch = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      await insertActiveLiveAuthority(ctx, {
        campaignId: other.id,
        epoch: otherEpoch,
        createdAt: new Date().toISOString()
      })
      await ctx.db.insert('campaignScenePresentations', {
        campaignId: other.id,
        sceneId,
        version: 1,
        activeMapAssetId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    })
    await expect(
      base.t.query(read, { ...input, campaignId: other.id, epoch: otherEpoch })
    ).rejects.toThrow()
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_ordinal', (q) =>
          q.eq('saveId', save.saveId).eq('value.collection', 'barriers').eq('ordinal', 0)
        )
        .unique()
      if (!row) throw new Error('Missing definition entity fixture.')
      await ctx.db.patch(row._id, { checksum: checksumCanonicalJson({ corrupted: true }) })
    })
    await expect(base.t.query(read, input)).rejects.toThrow('entity is inconsistent')
  })

  it('reads an empty materialized Scene with exact source pins and no synthesized live rows', async () => {
    const base = await setupScene()
    const response = await readRoomInputsBatch((input) => base.t.query(read, input), base.request())
    expect(response).toEqual({
      kind: 'SCENE',
      source: {
        sceneId: base.sceneId,
        definitionSaveId: base.save.saveId,
        definitionVersion: 1,
        presentationVersion: base.presentation.version
      },
      sceneVersion: 0,
      documents: [],
      continueCursor: null
    })
  })

  it('paginates native tombstones without composing token vision or dropping counters', async () => {
    const base = await setupScene()
    await base.t.run(async (ctx) => {
      const { header } = await readLiveSceneForUser(ctx, base.sceneId, 'OWNER', base.owner.userId)
      await ctx.db.insert('sceneLiveStates', advanceLiveState(header, null))
      for (let index = 0; index <= MAX_ROOM_INPUT_PAGE_DOCUMENTS; index += 1) {
        const fields = {
          sceneId: base.sceneId,
          collection: 'tokens' as const,
          entityId: crypto.randomUUID(),
          version: 1,
          ordinal: null,
          value: null
        }
        await ctx.db.insert('sceneLiveEntities', {
          ...fields,
          checksum: checksumCanonicalJson(fields)
        })
      }
    })
    const state = await base.page()
    expect(state.documents).toMatchObject([
      { table: 'sceneLiveStates', fields: { version: 1, nextFogOrdinal: 0 } }
    ])
    const first = await base.page(state.continueCursor)
    expect(first.documents).toHaveLength(MAX_ROOM_INPUT_PAGE_DOCUMENTS)
    expect(first.continueCursor).toMatchObject({ position: 1, fogSave: null })
    const second = await base.page(first.continueCursor)
    expect(second.documents).toHaveLength(1)
    expect(second.continueCursor).toEqual({ position: 2, paginationCursor: null, fogSave: null })
    expect(new Set([...first.documents, ...second.documents].map((row) => row.id)).size).toBe(
      MAX_ROOM_INPUT_PAGE_DOCUMENTS + 1
    )
    expect(first.documents[0]?.fields).toMatchObject({ value: null, ordinal: null })
    expect(first.documents[0]?.fields).not.toHaveProperty('_id')
  })

  it('continues byte-limited fog chunks within a save, then advances to the next scoped save', async () => {
    const base = await setupScene()
    const saveIds: string[] = []
    await base.t.run(async (ctx) => {
      for (const [saveIndex, chunkCount] of [120, 1].entries()) {
        const saveId = crypto.randomUUID()
        saveIds.push(saveId)
        const chunks = Array.from({ length: chunkCount }, (_, ordinal) => ({
          index: ordinal,
          x: 0,
          y: 0,
          width: 512,
          height: 512,
          data: Buffer.alloc((512 * 512) / 8).toString('base64')
        }))
        const input = {
          type: 'PATCH_SCENE_FOG' as const,
          sceneId: base.sceneId,
          commandId: `00000000-0000-4000-8000-${String(saveIndex).padStart(12, '0')}`,
          expectedSceneVersion: 0,
          layer: { ownerUserId: null, width: 512, height: 512 },
          chunkManifest: chunks.map((chunk) => ({
            index: chunk.index,
            checksum: checksumCanonicalJson(chunk)
          }))
        }
        await ctx.db.insert('sceneFogSaves', {
          id: saveId,
          sceneId: base.sceneId,
          commandId: input.commandId,
          actorUserId: base.owner.userId,
          input,
          inputChecksum: checksumCanonicalJson(input),
          status: 'PUBLISHED',
          receivedChunks: chunks.length,
          expiresAt: Date.now() + 1000,
          chunksRemoved: false
        })
        for (const [ordinal, chunk] of chunks.entries())
          await ctx.db.insert('sceneFogChunks', {
            saveId,
            ordinal,
            chunk,
            checksum: checksumCanonicalJson(chunk)
          })
      }
    })
    const selected = await base.page({ position: 4, paginationCursor: null, fogSave: null })
    expect(selected.documents).toEqual([])
    expect(selected.continueCursor?.fogSave).toMatchObject({ id: saveIds[0], isLast: false })
    const first = await base.page(selected.continueCursor)
    expect(first.documents.length).toBeGreaterThan(0)
    expect(first.documents.length).toBeLessThan(120)
    expect(first.continueCursor?.fogSave?.id).toBe(saveIds[0])
    const second = await base.page(first.continueCursor)
    expect(first.documents.length + second.documents.length).toBe(120)
    expect(second.continueCursor?.fogSave).toBeNull()
    const nextSave = await base.page(second.continueCursor)
    expect(nextSave.continueCursor?.fogSave).toMatchObject({ id: saveIds[1], isLast: true })
    const final = await base.page(nextSave.continueCursor)
    expect(final.documents).toHaveLength(1)
    expect(final.documents[0]?.fields.saveId).toBe(saveIds[1])
    expect(final.continueCursor).toBeNull()
    const outsideSave = crypto.randomUUID()
    await expect(
      base.page({
        position: 4,
        paginationCursor: null,
        fogSave: { id: outsideSave, nextCursor: null, isLast: true }
      })
    ).rejects.toThrow('fog save is unavailable')
    await base.t.run(async (ctx) => {
      const save = await ctx.db
        .query('sceneFogSaves')
        .withIndex('by_publicId', (q) => q.eq('id', saveIds[1]!))
        .unique()
      if (!save) throw new Error('Missing save fixture.')
      await ctx.db.patch(save._id, { status: 'RECEIVING' })
    })
    const saves = await base.page({ position: 3, paginationCursor: null, fogSave: null })
    expect(saves.documents.map((row) => row.fields.id)).toEqual([saveIds[0]])
    await expect(base.page(nextSave.continueCursor)).rejects.toThrow('save is inconsistent')
  })

  it('refuses unpresented and other-Campaign Scenes even under an active epoch', async () => {
    const base = await setupScene()
    await expect(
      base.t.query(read, {
        ...base.request(),
        scope: { kind: 'SCENE', sceneId: crypto.randomUUID(), cursor: null }
      })
    ).rejects.toThrow('not presented')
    await expect(
      base.t.query(read, { ...base.request(), epoch: crypto.randomUUID() })
    ).rejects.toThrow('authority is stale')
    const other = await base.other.caller.mutation(createCampaign, {
      name: 'Other Scene Campaign',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const epoch = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      await insertActiveLiveAuthority(ctx, {
        campaignId: other.id,
        epoch,
        createdAt: new Date().toISOString()
      })
      await ctx.db.insert('campaignScenePresentations', {
        campaignId: other.id,
        sceneId: base.sceneId,
        version: 1,
        activeMapAssetId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    })
    await expect(
      base.t.query(read, { ...base.request(), campaignId: other.id, epoch })
    ).rejects.toThrow()
  })

  it.each([
    'sceneVersion',
    'definitionSaveId',
    'definitionVersion',
    'presentationVersion'
  ] as const)('leaves a page with a changed %s pin for the next response', async (pin) => {
    const base = await setupScene()
    const first = await base.page()
    const changed = {
      ...first,
      source: {
        ...first.source,
        ...(pin === 'definitionSaveId' ? { definitionSaveId: crypto.randomUUID() } : {}),
        ...(pin === 'definitionVersion'
          ? { definitionVersion: first.source.definitionVersion + 1 }
          : {}),
        ...(pin === 'presentationVersion'
          ? { presentationVersion: first.source.presentationVersion + 1 }
          : {})
      },
      sceneVersion: first.sceneVersion + (pin === 'sceneVersion' ? 1 : 0)
    }
    const readPage = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(changed)
    expect(await readRoomInputsBatch(readPage, base.request())).toEqual(first)
    expect(readPage).toHaveBeenLastCalledWith(base.request(first.continueCursor))
  })
})

describe('raw room Scene inputs from the real room', () => {
  it('returns all five native families after a committed geometry and fog change', async () => {
    // The Worker's HTTP and socket calls need real timers.
    vi.useRealTimers()
    const base = await setupScene(true)
    const response = await readRoomInputsBatch((input) => base.t.query(read, input), base.request())
    if (response.kind !== 'SCENE') throw new Error('Expected Scene inputs.')
    expect(response.sceneVersion).toBe(1)
    expect(response.continueCursor).toBeNull()
    // The room writes every chunk of the explored layer, so chunk rows repeat at the end.
    expect([...new Set(response.documents.map((document) => document.table))]).toEqual([
      'sceneLiveStates',
      'sceneLiveEntities',
      'sceneFogLayers',
      'sceneFogSaves',
      'sceneFogChunks'
    ])
    expect(
      response.documents.find((document) => document.table === 'sceneLiveEntities')?.fields.value
    ).toMatchObject({
      collection: 'tokens',
      entity: { label: 'Native token', position: { x: 900, y: 100 } }
    })
  })
})

describe('raw room chat metadata inputs', () => {
  it('pages native access and nonce metadata without historical payloads or foreign Campaign rows', async () => {
    const base = await setup()
    const other = await base.player.caller.mutation(createCampaign, {
      name: 'Foreign chat metadata',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const stored = await base.t.run(async (ctx) => {
      const now = new Date().toISOString()
      let rollEntryId = ''
      let rollFingerprint = ''
      for (const [campaignId, authorUserId, count] of [
        [base.campaign.id, base.owner.userId, MAX_ROOM_INPUT_PAGE_DOCUMENTS + 1],
        [other.id, base.player.userId, 1]
      ] as const) {
        const conversationId = crypto.randomUUID()
        await ctx.db.insert('campaignConversations', {
          id: conversationId,
          campaignId,
          kind: 'TABLE',
          participantUserIds: [],
          createdAt: now
        })
        await ctx.db.insert('campaignConversationMembers', {
          conversationId,
          campaignId,
          userId: authorUserId,
          accessStartedAt: now,
          lastReadAt: null
        })
        for (let index = 0; index < count; index += 1) {
          const id = crypto.randomUUID()
          const roll =
            index === 0
              ? {
                  id: crypto.randomUUID(),
                  normalizedExpression: '1d20',
                  characterId: null,
                  characterLabel: 'Private retained roll evidence',
                  source: { kind: 'MANUAL', label: 'Private roll label' },
                  ruleset: { systemId: 'srd', code: 'srd', version: '1' },
                  createdAt: now,
                  evidence: {
                    terms: [{ count: 1, die: 20, rolls: [10], subtotal: 10 }],
                    modifier: 0,
                    mode: 'NORMAL',
                    keep: 'FIRST',
                    subtotal: 10,
                    transform: { kind: 'NONE' },
                    total: 10
                  }
                }
              : null
          const payload = campaignStoredEntryPayloadSchema.parse({
            entryId: id,
            kind: roll ? 'ROLL' : 'CHAT',
            mode: roll ? null : 'OOC',
            body: roll ? null : `Private historical body ${index}`,
            roll,
            revealedByGm: false,
            authorUsername: 'Room metadata author',
            characterId: null,
            characterLabel: null,
            editedAt: null,
            unsentAt: null,
            consumedAt: null
          })
          await insertConversationEntry(
            ctx,
            {
              id,
              campaignId,
              conversationId,
              authorUserId,
              clientNonce: crypto.randomUUID(),
              createdAt: now
            },
            payload
          )
          if (campaignId === base.campaign.id && index === 0) {
            rollEntryId = id
            rollFingerprint = campaignRollNonceFingerprint(payload)
          }
        }
      }
      return {
        rollEntryId,
        rollFingerprint,
        conversations: await ctx.db
          .query('campaignConversations')
          .withIndex('by_campaignId_kind', (q) => q.eq('campaignId', base.campaign.id))
          .collect(),
        members: await ctx.db
          .query('campaignConversationMembers')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
          .collect(),
        entries: await ctx.db
          .query('campaignConversationEntries')
          .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
            q.eq('campaignId', base.campaign.id)
          )
          .collect()
      }
    })
    const pages: Extract<LiveRoomInputsResponse, { kind: 'CHAT_METADATA' }>[] = []
    let cursor: Extract<LiveRoomInputsScope, { kind: 'CHAT_METADATA' }>['cursor'] = null
    do {
      const page: LiveRoomInputsResponse = await base.t.query(
        read,
        base.request({ kind: 'CHAT_METADATA', cursor })
      )
      if (page.kind !== 'CHAT_METADATA') throw new Error('Expected chat metadata.')
      expect(page.documents.length).toBeLessThanOrEqual(MAX_ROOM_INPUT_PAGE_DOCUMENTS)
      if (page.continueCursor) expect(page.continueCursor).not.toEqual(cursor)
      pages.push(page)
      cursor = page.continueCursor
    } while (cursor)
    const documents = pages.flatMap((page) => page.documents)
    for (const [table, rows] of [
      ['campaignConversations', stored.conversations],
      ['campaignConversationMembers', stored.members],
      ['campaignConversationEntries', stored.entries]
    ] as const)
      expect(documents.filter((document) => document.table === table)).toEqual(
        rows.map(({ _id, _creationTime, ...fields }) => ({
          table,
          id: _id,
          creationTime: _creationTime,
          fields
        }))
      )
    expect(
      pages.filter((page) => page.documents[0]?.table === 'campaignConversationEntries')
    ).toHaveLength(2)
    const rollHeader = documents.find((document) => document.fields.id === stored.rollEntryId)
    expect(rollHeader?.fields).toMatchObject({
      kind: 'ROLL',
      rollNonceFingerprint: stored.rollFingerprint
    })
    expect(
      documents
        .filter((document) => document.fields.kind === 'CHAT')
        .every((document) => document.fields.rollNonceFingerprint === null)
    ).toBe(true)
    expect(documents.every((document) => document.fields.campaignId === base.campaign.id)).toBe(
      true
    )
    expect(
      documents.every(
        (document) =>
          !Object.hasOwn(document.fields, '_id') && !Object.hasOwn(document.fields, '_creationTime')
      )
    ).toBe(true)
    expect(JSON.stringify(documents)).not.toMatch(
      /Private historical body|Private retained roll evidence|Private roll label/
    )
    expect(
      documents.some((document) => document.table === 'campaignConversationEntryPayloads')
    ).toBe(false)
    await expect(
      base.t.query(read, {
        ...base.request({ kind: 'CHAT_METADATA', cursor: null }),
        epoch: crypto.randomUUID()
      })
    ).rejects.toThrow('stale')
    await expect(
      base.t.query(read, {
        ...base.request({ kind: 'CHAT_METADATA', cursor: null }),
        campaignId: other.id
      })
    ).rejects.toThrow('stale')
  })

  it('skips empty metadata families and refuses a cursor beyond the fixed family list', async () => {
    const base = await setup()
    const page = await base.t.query(read, base.request({ kind: 'CHAT_METADATA', cursor: null }))
    expect(page).toEqual({ kind: 'CHAT_METADATA', documents: [], continueCursor: null })
    await expect(
      base.t.query(
        read,
        base.request({
          kind: 'CHAT_METADATA',
          cursor: { position: 3, paginationCursor: null }
        })
      )
    ).rejects.toThrow('cursor is invalid')
  })
})

describe('raw room authority inputs', () => {
  it('preserves native Campaign, membership and assignment identities and excludes foreign rows', async () => {
    const base = await setup()
    const other = await base.player.caller.mutation(createCampaign, {
      name: 'Foreign authority inputs',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const stored = await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign fixture.')
      const now = new Date().toISOString()
      const foreignMembershipId = await ctx.db.insert('campaignMemberships', {
        campaignId: other.id,
        userId: crypto.randomUUID(),
        role: 'PLAYER',
        status: 'LEFT',
        accessStartedAt: now,
        joinedAt: now,
        leftAt: now
      })
      const foreignAssignmentId = await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: other.id,
        userId: crypto.randomUUID(),
        characterId: crypto.randomUUID(),
        assignedAt: now
      })
      return {
        campaign,
        memberships: await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaign.id))
          .collect(),
        assignments: await ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
          .collect(),
        foreignMembershipId,
        foreignAssignmentId
      }
    })
    const first = await base.t.query(read, base.request({ kind: 'AUTHORITY', cursor: null }))
    if (first.kind !== 'AUTHORITY') throw new Error('Expected authority inputs.')
    expect(first.accountUserIds).toEqual([])
    expect(first.continueCursor).toEqual({ position: 1, paginationCursor: null })
    const memberships = await base.t.query(
      read,
      base.request({ kind: 'AUTHORITY', cursor: first.continueCursor })
    )
    if (memberships.kind !== 'AUTHORITY') throw new Error('Expected memberships.')
    expect(memberships.continueCursor).toEqual({ position: 2, paginationCursor: null })
    const assignments = await base.t.query(
      read,
      base.request({ kind: 'AUTHORITY', cursor: memberships.continueCursor })
    )
    if (assignments.kind !== 'AUTHORITY') throw new Error('Expected assignments.')
    expect(assignments.accountUserIds).toEqual([])
    expect(assignments.continueCursor).toBeNull()
    const documents = [...first.documents, ...memberships.documents, ...assignments.documents]
    for (const [table, rows] of [
      ['campaigns', [stored.campaign]],
      ['campaignMemberships', stored.memberships],
      ['campaignCharacterAssignments', stored.assignments]
    ] as const) {
      expect(documents.filter((document) => document.table === table)).toEqual(
        rows.map(({ _id, _creationTime, ...fields }) => ({
          table,
          id: _id,
          creationTime: _creationTime,
          fields
        }))
      )
    }
    expect(documents.every((document) => !Object.hasOwn(document.fields, '_id'))).toBe(true)
    expect(documents.every((document) => !Object.hasOwn(document.fields, '_creationTime'))).toBe(
      true
    )
    expect(documents.map((document) => document.id)).not.toContain(stored.foreignMembershipId)
    expect(documents.map((document) => document.id)).not.toContain(stored.foreignAssignmentId)
    expect(JSON.stringify(documents)).not.toContain(other.id)
    expect(first.revisions).toEqual(memberships.revisions)
    expect(first.revisions).toEqual(assignments.revisions)
    expect(first.revisions.map((revision) => revision.scope)).toEqual(['SYSTEM', 'CAMPAIGN'])
    await expect(
      base.t.query(read, {
        campaignId: other.id,
        epoch: base.epoch,
        scope: { kind: 'AUTHORITY', cursor: null }
      })
    ).rejects.toThrow()
  })

  it('reports a LEFT member account only while its native user profile remains', async () => {
    const base = await setup()
    const profileId = await base.t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
        )
        .unique()
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.player.userId))
        .unique()
      if (!member || !profile) throw new Error('Missing member account fixture.')
      await ctx.db.patch(member._id, { status: 'LEFT', leftAt: new Date().toISOString() })
      return profile._id
    })
    const request = base.request({
      kind: 'AUTHORITY',
      cursor: { position: 1, paginationCursor: null }
    })
    const present = await base.t.query(read, request)
    if (present.kind !== 'AUTHORITY') throw new Error('Expected authority inputs.')
    expect(present.accountUserIds).toContain(base.player.userId)
    expect(present.documents).toContainEqual(
      expect.objectContaining({
        table: 'campaignMemberships',
        fields: expect.objectContaining({ userId: base.player.userId, status: 'LEFT' })
      })
    )
    await base.t.run((ctx) => ctx.db.delete(profileId))
    const absent = await base.t.query(read, request)
    if (absent.kind !== 'AUTHORITY') throw new Error('Expected authority inputs.')
    expect(absent.accountUserIds).not.toContain(base.player.userId)
    expect(absent.accountUserIds).toContain(base.owner.userId)
    expect(absent.documents).toEqual(present.documents)
  })

  it('pages all membership statuses and assignments without a lifetime row cap', async () => {
    const base = await setup()
    const initial = await base.t.run(async (ctx) => {
      const memberships = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_status', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
      const assignments = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
      const now = new Date().toISOString()
      for (let index = 0; index <= MAX_ROOM_INPUT_PAGE_DOCUMENTS; index += 1) {
        const userId = crypto.randomUUID()
        const left = index % 2 === 1
        await ctx.db.insert('campaignMemberships', {
          campaignId: base.campaign.id,
          userId,
          role: 'PLAYER',
          status: left ? 'LEFT' : 'ACTIVE',
          accessStartedAt: now,
          joinedAt: now,
          leftAt: left ? now : null
        })
        await ctx.db.insert('campaignCharacterAssignments', {
          campaignId: base.campaign.id,
          userId,
          characterId: crypto.randomUUID(),
          assignedAt: now
        })
      }
      return { memberships: memberships.length, assignments: assignments.length }
    })
    const pages: Extract<LiveRoomInputsResponse, { kind: 'AUTHORITY' }>[] = []
    let cursor: Extract<LiveRoomInputsScope, { kind: 'AUTHORITY' }>['cursor'] = null
    do {
      const page: LiveRoomInputsResponse = await base.t.query(
        read,
        base.request({ kind: 'AUTHORITY', cursor })
      )
      if (page.kind !== 'AUTHORITY') throw new Error('Expected authority inputs.')
      expect(page.documents.length).toBeLessThanOrEqual(MAX_ROOM_INPUT_PAGE_DOCUMENTS)
      if (page.continueCursor) expect(page.continueCursor).not.toEqual(cursor)
      pages.push(page)
      cursor = page.continueCursor
    } while (cursor)
    const documents = pages.flatMap((page) => page.documents)
    expect(documents.filter((document) => document.table === 'campaigns')).toHaveLength(1)
    expect(documents.filter((document) => document.table === 'campaignMemberships')).toHaveLength(
      initial.memberships + MAX_ROOM_INPUT_PAGE_DOCUMENTS + 1
    )
    expect(
      documents.filter((document) => document.table === 'campaignCharacterAssignments')
    ).toHaveLength(initial.assignments + MAX_ROOM_INPUT_PAGE_DOCUMENTS + 1)
    expect(new Set(documents.map((document) => document.id)).size).toBe(documents.length)
    expect(
      new Set(
        documents
          .filter((document) => document.table === 'campaignMemberships')
          .map((document) => document.fields.status)
      )
    ).toEqual(new Set(['ACTIVE', 'LEFT']))
    expect(
      pages.filter((page) => page.documents.length === MAX_ROOM_INPUT_PAGE_DOCUMENTS)
    ).toHaveLength(2)
  })

  it('pins Campaign/System revisions on every page and rejects invalid cursors and stale epochs', async () => {
    const base = await setup()
    const first = await base.t.query(read, base.request({ kind: 'AUTHORITY', cursor: null }))
    if (first.kind !== 'AUTHORITY') throw new Error('Expected authority inputs.')
    const revision = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'CAMPAIGN').eq('id', base.campaign.id))
        .unique()
      if (row) await ctx.db.patch(row._id, { revision })
      else
        await ctx.db.insert('sceneVisionRevisions', {
          scope: 'CAMPAIGN',
          id: base.campaign.id,
          revision
        })
    })
    const next = await base.t.query(
      read,
      base.request({ kind: 'AUTHORITY', cursor: first.continueCursor })
    )
    if (next.kind !== 'AUTHORITY') throw new Error('Expected authority inputs.')
    expect(next.revisions).not.toEqual(first.revisions)
    expect(next.revisions).toContainEqual({ scope: 'CAMPAIGN', id: base.campaign.id, revision })
    expect(next.revisions.find((entry) => entry.scope === 'SYSTEM')).toEqual(
      first.revisions.find((entry) => entry.scope === 'SYSTEM')
    )
    for (const cursor of [
      { position: 3, paginationCursor: null },
      { position: 0, paginationCursor: 'not-a-Campaign-cursor' }
    ])
      await expect(base.t.query(read, base.request({ kind: 'AUTHORITY', cursor }))).rejects.toThrow(
        'cursor is invalid'
      )
    await expect(
      base.t.query(read, {
        ...base.request({ kind: 'AUTHORITY', cursor: null }),
        epoch: crypto.randomUUID()
      })
    ).rejects.toThrow('stale')
  })
})

describe('live room inputs (ADR 0035 S2)', () => {
  it('returns proven-empty heads for a new Campaign and a source without content', async () => {
    const base = await setup()
    const sourceId = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: sourceId,
        kind: 'USER',
        ownerUserId: base.owner.userId,
        code: sourceId
      })
      const head = await ctx.db
        .query('contentSnapshotHeads')
        .withIndex('by_scope_scopeId', (q) =>
          q.eq('scope', 'CAMPAIGN').eq('scopeId', base.campaign.id)
        )
        .unique()
      if (head) await ctx.db.delete(head._id)
    })
    const response = await base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))
    if (response.kind !== 'CAMPAIGN_PLAY') throw new Error('Expected Campaign play inputs.')
    expect(
      response.contentSnapshots.sources.find((source) => source.contentSourceId === sourceId)?.head
    ).toEqual({ scope: 'SOURCE', scopeId: sourceId, revision: 0, builtRevision: 0, kinds: {} })
    expect(response.contentSnapshots.campaign?.head).toEqual({
      scope: 'CAMPAIGN',
      scopeId: base.campaign.id,
      revision: 0,
      builtRevision: 0,
      kinds: {}
    })
  })

  it.each(['SOURCE', 'CAMPAIGN'] as const)(
    'refuses a missing %s head when that scope contains content',
    async (scope) => {
      const base = await setup()
      if (scope === 'CAMPAIGN') {
        const draft = await base.owner.caller.mutation(api.content.drafts.duplicate, {
          subjectKind: 'BACKGROUND',
          subjectId: acolyte.id
        })
        const saved = await base.owner.caller.mutation(api.content.drafts.save, {
          subjectKind: 'BACKGROUND',
          subjectId: draft.subjectId,
          systemId: draft.systemId,
          label: 'Shared room background',
          payload: { ...draft.payload, label: 'Shared room background' }
        })
        await base.owner.caller.mutation(api.content.publication.publishDraft, {
          subjectKind: 'BACKGROUND',
          subjectId: draft.subjectId,
          expectedDraftUpdatedAt: saved.updatedAt!
        })
        await base.owner.caller.mutation(shareContent, {
          campaignId: base.campaign.id,
          subjectKind: 'BACKGROUND',
          subjectId: draft.subjectId
        })
      }
      await base.t.run(async (ctx) => {
        const scopeId = scope === 'SOURCE' ? SRD_CONTENT_SOURCE.id : base.campaign.id
        const head = await ctx.db
          .query('contentSnapshotHeads')
          .withIndex('by_scope_scopeId', (q) => q.eq('scope', scope).eq('scopeId', scopeId))
          .unique()
        if (head) await ctx.db.delete(head._id)
        if (scope === 'SOURCE') {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
              q.eq('contentSourceId', scopeId)
            )
            .first()
          expect(root).not.toBeNull()
        } else {
          const share = await ctx.db
            .query('campaignContentShares')
            .withIndex('by_campaignId_subjectKind_subjectId', (q) => q.eq('campaignId', scopeId))
            .first()
          expect(share).not.toBeNull()
        }
      })
      await expect(base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))).rejects.toThrow(
        'Room content snapshot has not been built.'
      )
      await expect(base.t.query(read, base.characters())).rejects.toThrow(
        'Room content snapshot has not been built.'
      )
    }
  )
  it('pages the whole Run aggregate, with the Run itself on the first page only', async () => {
    const base = await setup()
    const pages = await base.runPages()
    const documents = pages.flatMap((page) => page.documents)

    expect(documents[0]).toMatchObject({ table: 'encounterRuns', id: expect.any(String) })
    expect(documents.filter((document) => document.table === 'encounterRuns')).toHaveLength(1)
    expect(new Set(pages.map((page) => page.encounterVersion)).size).toBe(1)
    // Empty tables are skipped. Receipt bodies use one row per page plus a terminal empty page;
    // other small fixture tables fit one page, the Run rides the first, and one final page skips
    // any remaining empty tables.
    const receiptTables = new Set(['encounterRunCommands', 'encounterRuleReceipts'])
    const receipts = documents.filter((row) => receiptTables.has(row.table))
    const otherTables = new Set(
      documents
        .filter((row) => row.table !== 'encounterRuns' && !receiptTables.has(row.table))
        .map((row) => row.table)
    )
    expect(pages.length).toBeLessThanOrEqual(
      otherTables.size + receipts.length + new Set(receipts.map((row) => row.table)).size + 1
    )

    const stored = await base.t.run(async (ctx) => ({
      actors: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
        .collect(),
      snapshots: await ctx.db
        .query('encounterActorSnapshots')
        .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', base.run.id))
        .collect()
    }))
    const idsOf = (table: string) =>
      documents
        .filter((document) => document.table === table)
        .map((document) => document.id)
        .sort()
    expect(idsOf('encounterRunActors')).toEqual(stored.actors.map((row) => row._id).sort())
    expect(idsOf('encounterActorSnapshots')).toEqual(stored.snapshots.map((row) => row._id).sort())
    expect(stored.actors.length).toBeGreaterThan(1)
  })

  // The Worker's `fakeConvex` (apps/session-worker/src/roomInputs.test.ts) mimics these page
  // properties over mutable state; this proves the real handler has them.
  it('keeps the page properties the Worker fake relies on: continuation, revision stamping and page shape', async () => {
    const base = await setup()
    const scopeRevisions = (revisions: readonly { scope: string }[]) =>
      revisions.map(({ scope }) => scope).sort()

    const pages = await base.runPages()
    expect(pages.length).toBeGreaterThan(1)
    pages.forEach((page, index) => {
      // Each page names the next table position, or null on the last; the Run rides page one only.
      expect(page.maintenanceCharacterOwners === null).toBe(index > 0)
      expect(page.documents.some((document) => document.table === 'encounterRuns')).toBe(
        index === 0
      )
      expect(page.continueCursor === null).toBe(index === pages.length - 1)
      expect(page.encounterVersion).toBe(pages[0]!.encounterVersion)
    })

    const authority = await base.t.query(read, base.request({ kind: 'AUTHORITY', cursor: null }))
    if (authority.kind !== 'AUTHORITY') throw new Error('Expected authority inputs.')
    expect(authority.documents.map((document) => document.table)).toEqual(['campaigns'])
    expect(authority.continueCursor).toEqual({ position: 1, paginationCursor: null })
    expect(scopeRevisions(authority.revisions)).toEqual(['CAMPAIGN', 'SYSTEM'])

    const definitions = await base.t.query(
      read,
      base.request({ kind: 'DEFINITIONS', cursor: null })
    )
    if (definitions.kind !== 'DEFINITIONS') throw new Error('Expected definition inputs.')
    expect(scopeRevisions(definitions.revisions)).toEqual(['CAMPAIGN', 'SYSTEM'])

    // Only the play-scoped reads carry the PLAY revision the room's checkpoint moves.
    const play = await base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))
    if (play.kind !== 'CAMPAIGN_PLAY') throw new Error('Expected Campaign play inputs.')
    expect(scopeRevisions(play.revisions)).toEqual(['CAMPAIGN', 'PLAY', 'SYSTEM'])
    const system = await base.t.query(read, base.request({ kind: 'SYSTEM', part: 'SYSTEM' }))
    if (system.kind !== 'SYSTEM') throw new Error('Expected System inputs.')
    expect(scopeRevisions(system.revisions)).toEqual(['CAMPAIGN', 'PLAY', 'SYSTEM'])
  })

  it('rejects a cursor past the table list', async () => {
    const base = await setup()
    await expect(
      base.t.query(
        read,
        base.request({
          kind: 'RUN',
          encounterId: base.run.id,
          cursor: { position: 999, paginationCursor: null }
        })
      )
    ).rejects.toThrow('cursor is invalid')
  })

  it('serves a Character as one part, with its inputs on the first page only', async () => {
    const base = await setup()
    const first = await base.t.query(read, base.characters())
    if (first.kind !== 'CHARACTERS') throw new Error('Expected a Characters page.')
    const [part] = first.parts
    if (part?.status !== 'ASSIGNED') throw new Error('Expected an assigned Character.')
    expect(part.characterId).toBe(base.character.id)
    expect(part.contentSnapshots).toMatchObject({
      systemId: srdSystemRecord.id,
      campaign: { id: base.campaign.id }
    })
    expect(part.inputs).toMatchObject({
      owner: expect.objectContaining({ id: base.character.id }),
      campaign: { id: base.campaign.id }
    })
    expect(first.continueCursor).toBeNull()
    expect(part.revisions.map(({ scope }) => scope).sort()).toEqual([
      'CAMPAIGN',
      'CHARACTER',
      'SYSTEM'
    ])
    expect(part.revisions).toContainEqual(
      expect.objectContaining({ scope: 'CHARACTER', id: base.character.id })
    )
  })

  it('carries Character inputs and authorized content only on the first effect part', async () => {
    const base = await setup()
    const now = new Date().toISOString()
    await base.t.run(async (ctx) => {
      for (let index = 0; index <= MAX_ROOM_INPUT_PAGE_DOCUMENTS; index += 1)
        await ctx.db.insert('characterActiveRuleEffects', {
          id: crypto.randomUUID(),
          characterId: base.character.id,
          createdOrdinal: index,
          version: 1,
          concentrationCasterCharacterId: null,
          maintainedEffectStateId: null,
          sourceEncounterId: null,
          definitionJson: '{}',
          definitionChecksum: checksumRuleDocument({}),
          lifecycle: { schemaVersion: 1, remainingTicks: null },
          lifecycleChecksum: checksumRuleDocument({ schemaVersion: 1, remainingTicks: null }),
          createdAt: now,
          updatedAt: now
        })
    })
    const first = await base.t.query(read, base.characters())
    if (
      first.kind !== 'CHARACTERS' ||
      !first.continueCursor ||
      first.parts[0]?.status !== 'ASSIGNED'
    )
      throw new Error('Expected first Character part.')
    expect(first.parts[0].inputs).not.toBeNull()
    expect(first.parts[0].contentSnapshots).not.toBeNull()
    const next = await base.t.query(read, base.characters(first.continueCursor))
    if (next.kind !== 'CHARACTERS' || next.parts[0]?.status !== 'ASSIGNED')
      throw new Error('Expected continued Character part.')
    expect(next.parts[0].inputs).toBeNull()
    expect(next.parts[0].contentSnapshots).toBeNull()
    expect(next.parts[0].documents.length).toBeGreaterThan(0)
    expect(next.continueCursor).toBeNull()
  })

  it('scopes content hashes to selected Campaign catalogues and each input owner', async () => {
    const base = await setup()
    const gmSourceId = crypto.randomUUID()
    const playerSourceId = crypto.randomUUID()
    const excludedSourceId = crypto.randomUUID()
    const otherCampaignId = crypto.randomUUID()
    const references = (scopeId: string) => ({
      index: {
        sha256: checksumRuleDocument({ scopeId, part: 'index' }),
        byteLength: 100,
        rootCount: 1
      },
      list: {
        sha256: checksumRuleDocument({ scopeId, part: 'list' }),
        byteLength: 200,
        rootCount: 1
      },
      documents: {
        sha256: checksumRuleDocument({ scopeId, part: 'documents' }),
        byteLength: 300,
        rootCount: 1
      }
    })
    await base.t.run(async (ctx) => {
      for (const [id, userId] of [
        [gmSourceId, base.owner.userId],
        [playerSourceId, base.player.userId]
      ] as const)
        await ctx.db.insert('contentSources', {
          ...SRD_CONTENT_SOURCE,
          id,
          kind: 'USER',
          ownerUserId: userId,
          code: id
        })
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: excludedSourceId,
        code: excludedSourceId
      })
      await ctx.db.insert('rulesCatalogues', {
        ...SRD_RULES_CATALOGUE,
        id: crypto.randomUUID(),
        code: excludedSourceId,
        contentSourceIds: [excludedSourceId]
      })
      for (const [scope, scopeId] of [
        ['SOURCE', SRD_CONTENT_SOURCE.id],
        ['SOURCE', gmSourceId],
        ['SOURCE', playerSourceId],
        ['SOURCE', excludedSourceId],
        ['CAMPAIGN', base.campaign.id],
        ['CAMPAIGN', otherCampaignId]
      ] as const) {
        const existing = await ctx.db
          .query('contentSnapshotHeads')
          .withIndex('by_scope_scopeId', (q) => q.eq('scope', scope).eq('scopeId', scopeId))
          .unique()
        const fields = { revision: 7, builtRevision: 6, kinds: { BACKGROUND: references(scopeId) } }
        if (existing) await ctx.db.patch(existing._id, fields)
        else await ctx.db.insert('contentSnapshotHeads', { scope, scopeId, ...fields })
      }
    })
    const play = await base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))
    const characters = await base.t.query(read, base.characters())
    if (
      play.kind !== 'CAMPAIGN_PLAY' ||
      characters.kind !== 'CHARACTERS' ||
      characters.parts[0]?.status !== 'ASSIGNED' ||
      !characters.parts[0].contentSnapshots
    )
      throw new Error('Missing content manifests.')
    for (const [manifest, ownSourceId, excludedUserSourceId] of [
      [play.contentSnapshots, gmSourceId, playerSourceId],
      [characters.parts[0].contentSnapshots, playerSourceId, gmSourceId]
    ] as const) {
      expect(
        manifest.sources
          .filter((source) => source.kind === 'PLATFORM')
          .map((source) => source.contentSourceId)
      ).toEqual([SRD_CONTENT_SOURCE.id])
      expect(manifest.sources.map((source) => source.contentSourceId)).toContain(ownSourceId)
      expect(manifest.sources.map((source) => source.contentSourceId)).not.toContain(
        excludedUserSourceId
      )
      expect(manifest.sources.map((source) => source.contentSourceId)).not.toContain(
        excludedSourceId
      )
      for (const source of manifest.sources.filter(
        (source) =>
          source.contentSourceId === ownSourceId || source.contentSourceId === SRD_CONTENT_SOURCE.id
      ))
        expect(source.head).toEqual({
          scope: 'SOURCE',
          scopeId: source.contentSourceId,
          revision: 7,
          builtRevision: 6,
          kinds: { BACKGROUND: references(source.contentSourceId) }
        })
      expect(manifest.campaign).toEqual({
        id: base.campaign.id,
        contentMaturity: base.campaign.contentMaturity,
        head: {
          scope: 'CAMPAIGN',
          scopeId: base.campaign.id,
          revision: 7,
          builtRevision: 6,
          kinds: { BACKGROUND: references(base.campaign.id) }
        }
      })
      expect(JSON.stringify(manifest)).not.toContain(otherCampaignId)
    }
  })

  it('rejects a Characters cursor past the requested list', async () => {
    const base = await setup()
    await expect(
      base.t.query(read, base.characters({ position: 1, paginationCursor: null }))
    ).rejects.toThrow('cursor is invalid')
  })

  it('serves a route response as one call with every Run page joined', async () => {
    const base = await setup()
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
    const post = (body: LiveRoomInputsInput) =>
      base.owner.caller.fetch('/live-sessions/room-inputs', {
        method: 'POST',
        headers: { 'x-artificer-live-session-secret': secret },
        body: JSON.stringify(body)
      })
    const response = await post(
      base.request({ kind: 'RUN', encounterId: base.run.id, cursor: null })
    )
    expect(response.status).toBe(200)
    const batched = liveRoomInputsResponseSchema.parse(await response.json())
    if (batched.kind !== 'RUN') throw new Error('Expected a Run response.')
    const pages = await base.runPages()
    expect(pages.length).toBeGreaterThan(1)
    expect(batched.continueCursor).toBeNull()
    expect(batched.documents).toEqual(pages.flatMap((page) => page.documents))

    const characters = await post(base.characters())
    expect(characters.status).toBe(200)
    expect(liveRoomInputsResponseSchema.parse(await characters.json())).toMatchObject({
      kind: 'CHARACTERS',
      parts: [{ status: 'ASSIGNED', characterId: base.character.id }],
      continueCursor: null
    })
  })

  describe('a Character that left the Campaign', () => {
    async function departed() {
      const base = await setup()
      const { version, accessStartedAt } = await base.t.run(async (ctx) => {
        const campaign = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
          .unique()
        const membership = await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
          )
          .unique()
        if (!campaign || !membership) throw new Error('Fixture Campaign is unavailable.')
        return { version: campaign.version, accessStartedAt: membership.accessStartedAt }
      })
      await base.player.caller.mutation(leave, {
        campaignId: base.campaign.id,
        expectedCampaignVersion: version,
        expectedMembershipAccessStartedAt: accessStartedAt,
        commandId: crypto.randomUUID()
      })
      return base
    }

    it('reads as UNASSIGNED while its Run actor holds the frozen state', async () => {
      const base = await departed()
      expect(await base.t.query(read, base.characters())).toEqual({
        kind: 'CHARACTERS',
        parts: [{ status: 'UNASSIGNED', characterId: base.character.id }],
        continueCursor: null
      })

      const actors = (await base.runPages())
        .flatMap((page) => page.documents)
        .filter((document) => document.table === 'encounterRunActors')
        .map((document) =>
          liveRoomActorSourceSchema.parse(JSON.parse(String(document.fields.stateJson)))
        )
      expect(actors).toContainEqual(
        expect.objectContaining({
          kind: 'CHARACTER',
          sourceId: base.character.id,
          frozenState: expect.any(Object)
        })
      )
    })

    it('reads as DELETED once the Character no longer exists', async () => {
      const base = await departed()
      await base.t.run(async (ctx) => {
        const row = await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
          .unique()
        if (!row) throw new Error('Expected the departed Character.')
        await ctx.db.delete(row._id)
      })
      expect(await base.t.query(read, base.characters())).toEqual({
        kind: 'CHARACTERS',
        parts: [{ status: 'DELETED', characterId: base.character.id }],
        continueCursor: null
      })
    })
  })

  it('serves the Campaign play scope, the System and its vocabulary', async () => {
    const base = await setup()
    const play = await base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))
    expect(play).toMatchObject({
      kind: 'CAMPAIGN_PLAY',
      campaign: {
        id: base.campaign.id,
        gameSystemId: srdSystemRecord.id,
        ownerUserId: base.owner.userId
      }
    })
    const system = await base.t.query(read, base.request({ kind: 'SYSTEM', part: 'SYSTEM' }))
    expect(system).toMatchObject({ kind: 'SYSTEM', system: { id: srdSystemRecord.id } })
    if (system.kind === 'SYSTEM') expect(system.vocabulary).toBeNull()
    const vocabulary = await base.t.query(
      read,
      base.request({ kind: 'SYSTEM', part: 'VOCABULARY' })
    )
    if (vocabulary.kind !== 'SYSTEM') throw new Error('Expected the System scope.')
    expect(vocabulary.system).toBeNull()
    expect(vocabulary.vocabulary).not.toBeNull()
  })

  it('serves the Campaign clock’s absolute minute fresh, and none before the clock exists (D151)', async () => {
    const base = await setup()
    const clock = () => base.t.query(read, base.request({ kind: 'CAMPAIGN_CLOCK' }))
    expect(await clock()).toEqual({ kind: 'CAMPAIGN_CLOCK', absoluteMinute: null })

    await base.owner.caller.mutation(api.campaigns.clock.initialize, {
      campaignId: base.campaign.id,
      expectedVersion: 0,
      commandId: crypto.randomUUID(),
      day: 2,
      minuteOfDay: 100,
      dawnMinute: 360,
      duskMinute: 1080
    })
    expect(await clock()).toEqual({
      kind: 'CAMPAIGN_CLOCK',
      absoluteMinute: absoluteMinute(2, 100)
    })
  })

  it('pages all platform and Campaign-owned definitions, including unpublished private roots', async () => {
    const base = await setup()
    const seeded = await base.t.run(async (ctx) => {
      const platformSourceId = crypto.randomUUID()
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: platformSourceId,
        code: 'room-definitions-unlisted'
      })
      const ownerSourceId = await requireDefaultUserContentSource(
        ctx,
        srdSystemRecord.id,
        base.owner.userId
      )
      const otherOwner = crypto.randomUUID()
      const otherSourceId = await requireDefaultUserContentSource(
        ctx,
        srdSystemRecord.id,
        otherOwner
      )
      const platformId = crypto.randomUUID()
      const ownedId = crypto.randomUUID()
      const platformDocument = { ...SRD_SENSE_DEFINITIONS[0].document, id: platformId }
      const ownedDocument = { ...SRD_SENSE_DEFINITIONS[0].document, id: ownedId }
      await ctx.db.insert('reusableDefinitions', {
        id: platformId,
        gameSystemId: srdSystemRecord.id,
        contentSourceId: platformSourceId,
        definitionFamilyKey: 'sense',
        label: 'Room platform sense',
        description: null,
        version: 1,
        contractVersion: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: srdSystemRecord.userId,
        documentJson: encodeDefinitionDocument(platformDocument),
        checksum: checksumRuleDocument(platformDocument)
      })
      await ctx.db.insert('reusableDefinitions', {
        id: ownedId,
        gameSystemId: srdSystemRecord.id,
        contentSourceId: ownerSourceId,
        ownerUserId: base.owner.userId,
        definitionFamilyKey: 'sense',
        label: 'Room private sense',
        description: null,
        version: 1,
        documentJson: encodeDefinitionDocument(ownedDocument),
        checksum: checksumRuleDocument(ownedDocument),
        contractVersion: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: base.owner.userId
      })
      const unpublishedIds: string[] = []
      for (let index = 0; index < 129; index += 1) {
        const id = crypto.randomUUID()
        unpublishedIds.push(id)
        await ctx.db.insert('reusableDefinitions', {
          id,
          gameSystemId: srdSystemRecord.id,
          contentSourceId: ownerSourceId,
          ownerUserId: base.owner.userId,
          definitionFamilyKey: 'sense',
          label: `Unpublished room sense ${index.toString().padStart(3, '0')}`,
          description: null,
          version: 0
        })
      }
      const otherId = crypto.randomUUID()
      await ctx.db.insert('reusableDefinitions', {
        id: otherId,
        gameSystemId: srdSystemRecord.id,
        contentSourceId: otherSourceId,
        ownerUserId: otherOwner,
        definitionFamilyKey: 'sense',
        label: 'Other owner',
        description: null,
        version: 0
      })
      const foreignSystemId = crypto.randomUUID()
      const foreignSourceId = await requireDefaultUserContentSource(
        ctx,
        foreignSystemId,
        base.owner.userId
      )
      const foreignId = crypto.randomUUID()
      await ctx.db.insert('reusableDefinitions', {
        id: foreignId,
        gameSystemId: foreignSystemId,
        contentSourceId: foreignSourceId,
        ownerUserId: base.owner.userId,
        definitionFamilyKey: 'sense',
        label: 'Other System',
        description: null,
        version: 0
      })
      return { platformId, ownedId, unpublishedIds, otherId, foreignId }
    })
    const pages: Extract<LiveRoomInputsResponse, { kind: 'DEFINITIONS' }>[] = []
    let cursor: Extract<LiveRoomInputsScope, { kind: 'DEFINITIONS' }>['cursor'] = null
    do {
      const page: LiveRoomInputsResponse = await base.t.query(
        read,
        base.request({ kind: 'DEFINITIONS', cursor })
      )
      if (page.kind !== 'DEFINITIONS') throw new Error('Expected definition inputs.')
      expect(page.definitions.length).toBeLessThanOrEqual(128)
      expect(page.revisions.map(({ scope }) => scope).sort()).toEqual(['CAMPAIGN', 'SYSTEM'])
      if (pages.length) expect(page.revisions).toEqual(pages[0].revisions)
      if (page.continueCursor) expect(page.continueCursor).not.toEqual(cursor)
      expect(
        page.definitions.every(
          ({ sourceKind }) => sourceKind === (cursor?.position === 1 ? 'USER' : 'PLATFORM')
        )
      ).toBe(true)
      pages.push(page)
      cursor = page.continueCursor
    } while (cursor)
    const definitions = pages.flatMap((page) => page.definitions)
    expect(new Set(definitions.map(({ id }) => id)).size).toBe(definitions.length)
    expect(definitions).toContainEqual({
      id: seeded.platformId,
      sourceKind: 'PLATFORM',
      definition: expect.objectContaining({
        id: seeded.platformId,
        publishedBy: srdSystemRecord.userId
      })
    })
    expect(definitions).toContainEqual({
      id: seeded.ownedId,
      sourceKind: 'USER',
      definition: expect.objectContaining({ id: seeded.ownedId, publishedBy: base.owner.userId })
    })
    expect(definitions.filter(({ id }) => seeded.unpublishedIds.includes(id))).toEqual(
      expect.arrayContaining(
        seeded.unpublishedIds.map((id) => ({ id, sourceKind: 'USER', definition: null }))
      )
    )
    expect(definitions.some(({ id }) => id === seeded.otherId || id === seeded.foreignId)).toBe(
      false
    )
    expect(pages.filter((page) => page.definitions.length === 128).length).toBeGreaterThan(0)
    expect(pages.at(-1)?.continueCursor).toBeNull()
  })

  it('pins definition pages to Campaign/System revisions and refuses invalid or stale scope', async () => {
    const base = await setup()
    const first = await base.t.query(read, base.request({ kind: 'DEFINITIONS', cursor: null }))
    if (first.kind !== 'DEFINITIONS') throw new Error('Expected definition inputs.')
    const changed = {
      SYSTEM: crypto.randomUUID(),
      CAMPAIGN: crypto.randomUUID(),
      PLAY: crypto.randomUUID()
    }
    await base.t.run(async (ctx) => {
      for (const scope of ['SYSTEM', 'CAMPAIGN', 'PLAY'] as const) {
        const id = scope === 'SYSTEM' ? srdSystemRecord.id : base.campaign.id
        const row = await ctx.db
          .query('sceneVisionRevisions')
          .withIndex('by_scope_id', (q) => q.eq('scope', scope).eq('id', id))
          .unique()
        if (row) await ctx.db.patch(row._id, { revision: changed[scope] })
        else await ctx.db.insert('sceneVisionRevisions', { scope, id, revision: changed[scope] })
      }
    })
    const next = await base.t.query(
      read,
      base.request({ kind: 'DEFINITIONS', cursor: { position: 1, paginationCursor: null } })
    )
    if (next.kind !== 'DEFINITIONS') throw new Error('Expected definition inputs.')
    expect(next.revisions).not.toEqual(first.revisions)
    expect(next.revisions).toEqual(
      expect.arrayContaining([
        { scope: 'SYSTEM', id: srdSystemRecord.id, revision: changed.SYSTEM },
        { scope: 'CAMPAIGN', id: base.campaign.id, revision: changed.CAMPAIGN }
      ])
    )
    expect(next.revisions).toHaveLength(2)
    await expect(
      base.t.query(
        read,
        base.request({ kind: 'DEFINITIONS', cursor: { position: 2, paginationCursor: null } })
      )
    ).rejects.toThrow('cursor is invalid')
    await expect(
      base.t.query(read, {
        ...base.request({ kind: 'DEFINITIONS', cursor: null }),
        epoch: crypto.randomUUID()
      })
    ).rejects.toThrow('stale')
    await expect(
      base.t.query(read, {
        ...base.request({ kind: 'DEFINITIONS', cursor: null }),
        campaignId: crypto.randomUUID()
      })
    ).rejects.toThrow()
  })

  it('refuses a wrong-System source and published definition checksum corruption', async () => {
    const base = await setup()
    const stored = await base.t.run(async (ctx) => {
      const sourceId = await requireDefaultUserContentSource(
        ctx,
        srdSystemRecord.id,
        base.owner.userId
      )
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', sourceId))
        .unique()
      if (!source) throw new Error('Expected an owned source.')
      const id = crypto.randomUUID()
      const document = { ...SRD_SENSE_DEFINITIONS[0].document, id }
      const rowId = await ctx.db.insert('reusableDefinitions', {
        id,
        gameSystemId: srdSystemRecord.id,
        contentSourceId: sourceId,
        ownerUserId: base.owner.userId,
        definitionFamilyKey: 'sense',
        label: 'Room integrity sense',
        description: null,
        version: 1,
        contractVersion: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: base.owner.userId,
        documentJson: encodeDefinitionDocument(document),
        checksum: checksumRuleDocument(document)
      })
      await ctx.db.patch(source._id, { gameSystemId: crypto.randomUUID() })
      return { sourceRowId: source._id, rowId }
    })
    const request = base.request({
      kind: 'DEFINITIONS',
      cursor: { position: 1, paginationCursor: null }
    })
    await expect(base.t.query(read, request)).rejects.toThrow('Reusable definition unavailable')
    await base.t.run(async (ctx) => {
      await ctx.db.patch(stored.sourceRowId, { gameSystemId: srdSystemRecord.id })
      await ctx.db.patch(stored.rowId, { checksum: checksumRuleDocument({ corrupted: true }) })
    })
    await expect(base.t.query(read, request)).rejects.toThrow('integrity mismatch')
  })

  describe('authorization', () => {
    it('refuses Campaign and Character content after Campaign deletion starts', async () => {
      const base = await setup()
      await base.owner.caller.mutation(api.campaigns.deletion.remove, {
        campaignId: base.campaign.id,
        expectedVersion: base.campaign.version,
        confirmation: 'DELETE'
      })
      await expect(base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))).rejects.toThrow()
      await expect(base.t.query(read, base.characters())).rejects.toThrow()
    })
    it('refuses a stale epoch and a released epoch', async () => {
      const base = await setup()
      await expect(
        base.t.query(read, {
          ...base.request({ kind: 'CAMPAIGN_PLAY' }),
          epoch: crypto.randomUUID()
        })
      ).rejects.toThrow('stale')
      await base.t.run(async (ctx) => {
        const authority = await ctx.db.query('campaignLiveAuthorities').first()
        if (authority) await ctx.db.patch(authority._id, { phase: 'DRAINING' })
      })
      await expect(base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))).rejects.toThrow(
        'not active'
      )
    })

    it('refuses data of another Campaign even under a valid epoch', async () => {
      const base = await setup()
      // The per-owner hosted-Campaign limit means the other Campaign belongs to the player.
      const other = await base.player.caller.mutation(createCampaign, {
        name: 'Another Campaign',
        format: 'ONGOING',
        toneTags: ['HEROIC'],
        contentMaturity: 'STANDARD',
        gameSystemId: srdSystemRecord.id,
        primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
      })
      const otherEpoch = crypto.randomUUID()
      await base.t.run((ctx) =>
        insertActiveLiveAuthority(ctx, {
          campaignId: other.id,
          epoch: otherEpoch,
          createdAt: new Date().toISOString()
        })
      )
      const asOther = (scope: LiveRoomInputsScope) => ({
        campaignId: other.id,
        epoch: otherEpoch,
        scope
      })
      await expect(
        base.t.query(read, asOther({ kind: 'RUN', encounterId: base.run.id, cursor: null }))
      ).rejects.toThrow('Encounter not found')
      // Another Campaign's Character is not assigned here, so it reads as UNASSIGNED, not as data.
      expect(
        await base.t.query(
          read,
          asOther({ kind: 'CHARACTERS', characterIds: [base.character.id], cursor: null })
        )
      ).toEqual({
        kind: 'CHARACTERS',
        parts: [{ status: 'UNASSIGNED', characterId: base.character.id }],
        continueCursor: null
      })
      // The first Campaign's epoch does not open the other Campaign.
      await expect(
        base.t.query(read, {
          campaignId: other.id,
          epoch: base.epoch,
          scope: { kind: 'CAMPAIGN_PLAY' }
        })
      ).rejects.toThrow()
    })

    it('refuses a Campaign that holds no live authority', async () => {
      const base = await setup()
      await base.t.run(async (ctx) => {
        const authority = await ctx.db.query('campaignLiveAuthorities').first()
        if (authority) await ctx.db.delete(authority._id)
      })
      await expect(base.t.query(read, base.request({ kind: 'CAMPAIGN_PLAY' }))).rejects.toThrow()
    })
  })
})
