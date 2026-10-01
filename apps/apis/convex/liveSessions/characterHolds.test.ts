import { describe, expect, it } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import type { z } from 'zod'
import {
  characterSheetLiveAuthorityReadInputSchema,
  characterSheetLiveAuthorityDtoSchema,
  type CharacterSheetLiveAuthorityDto
} from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { liveSessionAuthorityDtoSchema } from '@artificer-toolkit/schema/api/liveSessionState'
import { deleteRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { liveCharacterHoldSchema } from '@artificer-toolkit/schema/projections/liveCharacterHold'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { input as draftInput } from '../../tests/fixtures/characters'
import { api } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { writeCharacterRecord } from '../characters/characterWrites'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { claimCampaignLiveAuthority } from './authority'
import {
  assertConvexOwnsCharacterPlay,
  readCampaignLiveAuthority,
  readCharacterLiveHold
} from './authorityGuard'
import { reconcileCharacterHolds, releaseCharacterHolds } from './characterHolds'

type Fixture = Awaited<ReturnType<typeof setupCharacterRun>>
const HELD = 'This Character is held by its live table; use the room for play commands.'
const liveAuthority = makeFunctionReference<
  'query',
  z.infer<typeof characterSheetLiveAuthorityReadInputSchema>,
  CharacterSheetLiveAuthorityDto | null
>('characters/sheetSlices:liveAuthority')

// Seed canonical Run lifecycle facts; the tests exercise real indexed records and transactions.
async function writeRunLifecycle(
  ctx: MutationCtx,
  encounterId: string,
  status: 'ACTIVE' | 'COMPLETED',
  removedActorId?: string
) {
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!row) throw new Error('Missing Character hold fixture Run.')
  const state = readRunState(row)
  if (removedActorId) {
    const actor = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', encounterId).eq('id', removedActorId)
      )
      .unique()
    if (!actor) throw new Error('Missing Character hold fixture actor.')
    await deleteRunActor({ db: createConvexEncounterStore(ctx) }, actor)
  }
  const next = encounterRunStateSchema.parse({
    ...state,
    status,
    version: state.version + 1,
    actorIds: state.actorIds.filter((id) => id !== removedActorId),
    currentActorId: status === 'COMPLETED' ? null : state.currentActorId,
    updatedAt: new Date(Date.parse(state.updatedAt) + 1).toISOString()
  })
  await ctx.db.patch(row._id, {
    status: next.status,
    version: next.version,
    stateJson: JSON.stringify(next),
    stateChecksum: checksumCanonicalJson(next),
    updatedAt: next.updatedAt
  })
}

const readHolds = (base: Fixture) =>
  base.t.run((ctx) =>
    ctx.db
      .query('liveCharacterHolds')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
  )

async function claim(base: Fixture) {
  return base.t.run((ctx) =>
    claimCampaignLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      userId: base.owner.userId,
      expiresAt: Date.now() + 60_000
    })
  )
}

describe('native Character live holds', () => {
  it('exposes current routing only to owner and GM and keeps checkpoint freshness separate from lifecycle time', async () => {
    const base = await setupCharacterRun()
    const party = await createPartyPlayer(base.t, base.campaign)
    const second = await base.owner.caller.mutation(api.encounters.runs.create, {
      campaignId: base.campaign.id,
      blueprintId: base.run.blueprintId,
      commandId: crypto.randomUUID()
    })
    const retired = await base.owner.caller.mutation(api.encounters.runs.create, {
      campaignId: base.campaign.id,
      blueprintId: base.run.blueprintId,
      commandId: crypto.randomUUID()
    })
    await base.t.run(async (ctx) => {
      await writeRunLifecycle(ctx, base.run.id, 'ACTIVE')
      await writeRunLifecycle(ctx, second.id, 'ACTIVE')
      await writeRunLifecycle(ctx, retired.id, 'COMPLETED')
    })
    const { authority } = await claim(base)
    const personal = characterSheetLiveAuthorityReadInputSchema.parse({ id: base.character.id })
    const campaign = { ...personal, campaignId: base.campaign.id }
    const lifecycleTime = new Date(Date.parse(authority.updatedAt) + 30_000).toISOString()
    await base.t.run(async (ctx) => {
      const { _id, _creationTime, ...fields } = authority
      await ctx.db.replace(
        _id,
        liveSessionAuthorityDtoSchema.parse({
          ...fields,
          phase: 'DO_ACTIVE',
          updatedAt: lifecycleTime
        })
      )
      const acquired = await ctx.db
        .query('liveCharacterHolds')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
      const { _id: _holdId, _creationTime: _holdTime, ...hold } = acquired[0]!
      await ctx.db.insert('liveCharacterHolds', liveCharacterHoldSchema.parse(hold))
      await ctx.db.insert(
        'liveCharacterHolds',
        liveCharacterHoldSchema.parse({
          ...hold,
          encounterId: retired.id,
          epoch: crypto.randomUUID()
        })
      )
    })
    const expected = characterSheetLiveAuthorityDtoSchema.parse({
      characterId: base.character.id,
      campaignId: base.campaign.id,
      epoch: authority.epoch,
      phase: 'DO_ACTIVE',
      encounterIds: [base.run.id, second.id].sort(),
      checkpointSequence: 0,
      checkpointedAt: null,
      checkpointStreamVersion: base.characterStreamVersion
    })
    expect(await base.player.caller.query(liveAuthority, personal)).toEqual(expected)
    expect(await base.player.caller.query(liveAuthority, campaign)).toEqual(expected)
    expect(await base.owner.caller.query(liveAuthority, campaign)).toEqual(expected)
    expect(await base.owner.caller.query(liveAuthority, personal)).toBeNull()
    expect(await party.caller.query(liveAuthority, personal)).toBeNull()
    await expect(party.caller.query(liveAuthority, campaign)).rejects.toThrow('Campaign not found.')
    await party.join()
    expect(await party.caller.query(liveAuthority, campaign)).toBeNull()
    await expect(
      base.player.caller.query(liveAuthority, {
        ...personal,
        campaignId: crypto.randomUUID()
      })
    ).rejects.toThrow('Campaign not found.')
    const checkpointedAt = new Date(Date.parse(authority.updatedAt) + 1_000).toISOString()
    await base.t.run(async (ctx) => {
      const current = await readCampaignLiveAuthority(ctx, base.campaign.id)
      if (!current) throw new Error('Missing live authority fixture.')
      const { _id, _creationTime, ...fields } = current
      await ctx.db.replace(
        _id,
        liveSessionAuthorityDtoSchema.parse({
          ...fields,
          persistedSequence: 7,
          checkpointedAt,
          phase: 'DRAINING',
          updatedAt: new Date(Date.parse(lifecycleTime) + 1_000).toISOString()
        })
      )
    })
    expect(await base.player.caller.query(liveAuthority, personal)).toEqual({
      ...expected,
      phase: 'DRAINING',
      checkpointSequence: 7,
      checkpointedAt
    })
    await base.t.run((ctx) => ctx.db.patch(authority._id, { epoch: crypto.randomUUID() }))
    expect(await base.player.caller.query(liveAuthority, personal)).toBeNull()
    expect(await base.owner.caller.query(liveAuthority, campaign)).toBeNull()
  })

  it('acquires active Run holds once and retains the other Run through removal and completion', async () => {
    const base = await setupCharacterRun()
    const second = await base.owner.caller.mutation(api.encounters.runs.create, {
      campaignId: base.campaign.id,
      blueprintId: base.run.blueprintId,
      commandId: crypto.randomUUID()
    })
    await base.t.run(async (ctx) => {
      await writeRunLifecycle(ctx, base.run.id, 'ACTIVE')
      await writeRunLifecycle(ctx, second.id, 'ACTIVE')
    })
    const { authority } = await claim(base)
    const acquired = await readHolds(base)
    expect(acquired).toHaveLength(2)
    expect(
      acquired.map(({ _id, _creationTime, ...fields }) => liveCharacterHoldSchema.parse(fields))
    ).toEqual(
      expect.arrayContaining(
        [base.run.id, second.id].map((encounterId) => ({
          campaignId: base.campaign.id,
          characterId: base.character.id,
          encounterId,
          epoch: authority.epoch
        }))
      )
    )
    await base.t.run(async (ctx) => {
      await reconcileCharacterHolds(ctx, base.campaign.id, authority.epoch)
      await reconcileCharacterHolds(ctx, base.campaign.id, authority.epoch)
    })
    expect(await readHolds(base)).toEqual(acquired)
    await base.t.run(async (ctx) => {
      await writeRunLifecycle(ctx, base.run.id, 'ACTIVE', base.actor.id)
      await reconcileCharacterHolds(ctx, base.campaign.id, authority.epoch, new Set([base.run.id]))
    })
    expect(await readHolds(base)).toEqual(acquired.filter((hold) => hold.encounterId === second.id))
    await expect(
      base.t.run((ctx) => assertConvexOwnsCharacterPlay(ctx, base.character.id))
    ).rejects.toThrow(HELD)
    await base.t.run(async (ctx) => {
      await writeRunLifecycle(ctx, second.id, 'COMPLETED')
      await reconcileCharacterHolds(ctx, base.campaign.id, authority.epoch, new Set([second.id]))
      await assertConvexOwnsCharacterPlay(ctx, base.character.id)
    })
    expect(await readHolds(base)).toEqual([])
  })

  it('ignores expired and retired epochs and releases only the matching replacement epoch', async () => {
    const base = await setupCharacterRun()
    await base.t.run((ctx) => writeRunLifecycle(ctx, base.run.id, 'ACTIVE'))
    const { authority } = await claim(base)
    const acquired = await readHolds(base)
    expect(await base.t.run((ctx) => readCharacterLiveHold(ctx, base.character.id))).toEqual(
      acquired[0]
    )
    for (const phase of ['ACTIVATING', 'DO_ACTIVE', 'DRAINING'] as const) {
      await base.t.run((ctx) => ctx.db.patch(authority._id, { phase }))
      await expect(
        base.t.run((ctx) => assertConvexOwnsCharacterPlay(ctx, base.character.id))
      ).rejects.toThrow(HELD)
    }
    await base.t.run(async (ctx) => {
      await ctx.db.patch(authority._id, { epoch: crypto.randomUUID() })
      expect(await readCharacterLiveHold(ctx, base.character.id)).toBeNull()
      await assertConvexOwnsCharacterPlay(ctx, base.character.id)
      await ctx.db.patch(authority._id, {
        epoch: authority.epoch,
        phase: 'ACTIVATING',
        activationExpiresAt: Date.now() - 1
      })
      expect(await readCharacterLiveHold(ctx, base.character.id)).toBeNull()
      await assertConvexOwnsCharacterPlay(ctx, base.character.id)
    })
    expect(await readHolds(base)).toEqual(acquired)
    const replacement = (await claim(base)).authority
    expect(replacement.epoch).not.toBe(authority.epoch)
    const replaced = await readHolds(base)
    expect(replaced).toHaveLength(1)
    expect(replaced[0]).toMatchObject({ epoch: replacement.epoch, characterId: base.character.id })
    await base.t.run((ctx) => releaseCharacterHolds(ctx, base.campaign.id, authority.epoch))
    expect(await readHolds(base)).toEqual(replaced)
    await expect(
      base.t.run((ctx) => assertConvexOwnsCharacterPlay(ctx, base.character.id))
    ).rejects.toThrow(HELD)
    await base.t.run((ctx) => releaseCharacterHolds(ctx, base.campaign.id, replacement.epoch))
    expect(await readHolds(base)).toEqual([])
  })

  it('rolls back a changed Run and hold reconciliation after a late transaction failure', async () => {
    const base = await setupCharacterRun()
    await base.t.run((ctx) => writeRunLifecycle(ctx, base.run.id, 'ACTIVE'))
    const { authority } = await claim(base)
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        runs: await ctx.db
          .query('encounterRuns')
          .withIndex('by_campaignId_status', (q) => q.eq('campaignId', base.campaign.id))
          .collect(),
        actors: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
          .collect(),
        holds: await ctx.db
          .query('liveCharacterHolds')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
          .collect(),
        authority: await readCampaignLiveAuthority(ctx, base.campaign.id)
      }))
    const before = await snapshot()
    await expect(
      base.t.run(async (ctx) => {
        await writeRunLifecycle(ctx, base.run.id, 'COMPLETED')
        await reconcileCharacterHolds(
          ctx,
          base.campaign.id,
          authority.epoch,
          new Set([base.run.id])
        )
        expect(await readCharacterLiveHold(ctx, base.character.id)).toBeNull()
        throw new Error('Injected Character hold transaction failure')
      })
    ).rejects.toThrow('Injected Character hold transaction failure')
    expect(await snapshot()).toEqual(before)
  })

  it('fences play before replay while Builder edits retain the actual play record and stream', async () => {
    const base = await setupCharacterRun()
    const input = {
      id: base.character.id,
      command: {
        type: 'SET_INSPIRATION' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: base.characterStreamVersion,
        inspired: true
      }
    }
    const first = await base.player.caller.mutation(api.characters.sheetCommands.execute, input)
    await base.t.run((ctx) => writeRunLifecycle(ctx, base.run.id, 'ACTIVE'))
    const { authority } = await claim(base)
    const before = await base.readReceiptStorage()
    await expect(
      base.player.caller.mutation(api.characters.sheetCommands.execute, input)
    ).rejects.toThrow(HELD)
    await expect(
      base.t.run(async (ctx) => {
        const current = await readCharacterRow(ctx, base.character.id)
        if (!current) throw new Error('Missing held Character fixture.')
        const document = readCharacterRecord(current)
        await writeCharacterRecord(ctx, {
          current,
          fields: {
            streamVersion: current.play.streamVersion + 1,
            updatedAt: new Date().toISOString()
          },
          document: { ...document, state: { ...document.state, inspiration: false } },
          stats: {
            maximumHitPoints: current.play.maximumHitPoints,
            walkingSpeed: current.play.walkingSpeed
          }
        })
      })
    ).rejects.toThrow(HELD)
    expect(await base.readReceiptStorage()).toEqual(before)
    const draft = await base.player.caller.mutation(api.characters.drafts.create, {
      ...draftInput(),
      id: base.character.id
    })
    const result = await base.player.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'edit',
      character: { ...base.character, label: 'Held Builder edit' }
    })
    const edited = await base.readReceiptStorage()
    expect(edited.character!.label).toBe('Held Builder edit')
    expect(edited.character!.checksum).not.toBe(before.character!.checksum)
    expect(edited.character!.play).toEqual(before.character!.play)
    expect(edited.headers).toEqual(before.headers)
    expect(edited.ledgers).toEqual(before.ledgers)
    expect(edited.parts).toEqual(before.parts)
    expect(result.streamVersion).toBe(edited.character!.play.streamVersion)
    expect(result.character).toEqual(readCharacterRecord(edited.character!))
    await base.t.run(async (ctx) => {
      await writeRunLifecycle(ctx, base.run.id, 'COMPLETED')
      await reconcileCharacterHolds(ctx, base.campaign.id, authority.epoch, new Set([base.run.id]))
    })
    const cleared = await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      ...input,
      command: {
        ...input.command,
        commandId: crypto.randomUUID(),
        expectedVersion: first.streamVersion,
        inspired: false
      }
    })
    const after = await base.readState()
    expect(cleared.streamVersion).toBe(first.streamVersion + 1)
    expect(after.character!.play.state).not.toHaveProperty('inspiration')
    expect(after.character!.play.checksum).not.toBe(edited.character!.play.checksum)
    expect(after.character!.play.maximumHitPoints).toBe(edited.character!.play.maximumHitPoints)
    expect(after.character!.play.walkingSpeed).toBe(edited.character!.play.walkingSpeed)
    expect(after.character!.checksum).toBe(edited.character!.checksum)
  })
})
