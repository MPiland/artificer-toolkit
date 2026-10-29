import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { insertActiveCharacterRecord } from '../../tests/fixtures/characterRows'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readCharacterSheetState } from './sheetStateDocuments'
import type { TableNames } from '../_generated/dataModel'
import { api, internal } from '../_generated/api'
import { runAccountDeletionStep } from '../../tests/fixtures/accountDeletion'
import * as deletionJobs from '../accountDeletionJobs'
import schema from '../schema'
import { ensureAuthoredRouteId } from '../content/routeIds'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import {
  seedTurnSaveEffect,
  turnCharacterEffectFixture
} from '../../tests/fixtures/turnActiveEffectFixtures'
import { readCharacterRecord, readCharacterRow } from './stateDocuments'
import { closeRoom, useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'

const tableNames = Object.keys(schema.tables) as TableNames[]
const encounterTables = tableNames.filter((name) => name.startsWith('encounter'))

// Registered before the timer hook below: hooks after each test run in reverse, so the room closes
// on real timers.
useLocalRoomWorker()
afterEach(() => vi.useRealTimers())

async function fullSnapshot(t: Awaited<ReturnType<typeof turnCharacterEffectFixture>>['t']) {
  return t.run(async (ctx) => ({
    app: Object.fromEntries(
      await Promise.all(tableNames.map(async (name) => [name, await ctx.db.query(name).collect()]))
    ),
    schedules: await ctx.db.system.query('_scheduled_functions').collect()
  }))
}

type Step = Parameters<typeof runAccountDeletionStep>[2]

/** Runs a job step until the job moves to another step, as the scheduler would. */
async function runStepToCompletion(
  t: Awaited<ReturnType<typeof turnCharacterEffectFixture>>['t'],
  userId: string,
  name: 'CAMPAIGNS' | 'CHARACTERS',
  step: Step
) {
  for (;;) {
    await runAccountDeletionStep(t, userId, step)
    const job = await t.run((ctx) =>
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
    )
    if (job?.step !== name) return
  }
}

async function prepare() {
  const base = await turnCharacterEffectFixture()
  // The fixture's command ran in the real room, which holds the Run until it closes (D85). Closing
  // it checkpoints the Run, so the account cleanup below runs against Convex alone. The room's
  // sockets and its timers need real time, so the pending-schedule baseline starts after this.
  await closeRoom(base.campaign.id)
  vi.useFakeTimers()
  const deletingEffect = await seedTurnSaveEffect(base, {
    stage: 'START_OF_TURN',
    ticks: 2,
    damage: 1
  })
  if (deletingEffect.owner.kind !== 'CHARACTER')
    throw new Error('Expected a Character-owned active effect fixture.')

  const jobId = await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.player.userId))
      .unique()
    if (!profile) throw new Error('Missing deleting account profile.')
    await deletionJobs.startAccountDeletion(ctx, profile.authUserId, base.player.userId)
    const job = await ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_userId', (q) => q.eq('userId', base.player.userId))
      .unique()
    if (!job) throw new Error('Missing account deletion job.')
    return job._id
  })
  await runStepToCompletion(
    base.t,
    base.player.userId,
    'CAMPAIGNS',
    internal.campaigns.accountDeparture.step
  )
  // The job is held at CHARACTERS so this suite exercises that step alone, without the account
  // commit the intervening steps would run.
  await base.t.run((ctx) => ctx.db.patch(jobId, { step: 'CHARACTERS' }))

  const active = await base.t.run((ctx) => readCharacterRow(ctx, base.character.id))
  if (!active) throw new Error('Missing deleting Character.')
  await base.player.caller.mutation(api.characters.drafts.create, {
    id: base.character.id,
    systemId: base.character.systemId
  })
  const draftOnly = await base.player.caller.mutation(api.characters.drafts.create, {
    id: crypto.randomUUID(),
    systemId: base.character.systemId
  })
  const receiptCommandId = crypto.randomUUID()
  await base.player.caller.mutation(api.characters.sheetCommands.execute, {
    id: base.character.id,
    command: {
      type: 'SET_INSPIRATION',
      commandId: receiptCommandId,
      expectedVersion: active.play.streamVersion,
      inspired: true
    }
  })
  const roll = await base.player.caller.mutation(api.rolls.execute, {
    characterId: base.character.id,
    expression: '1d6',
    source: { kind: 'MANUAL', label: 'Account deletion roll' }
  })

  const foreignCharacterId = crypto.randomUUID()
  const foreignEffectId = crypto.randomUUID()
  const foreignRollId = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    const current = await readCharacterRow(ctx, base.character.id)
    if (!current) throw new Error('Missing current deleting Character.')
    await insertActiveCharacterRecord(
      ctx,
      {
        ...readCharacterRecord(current),
        status: current.status,
        id: foreignCharacterId,
        userId: base.owner.userId,
        label: 'Unrelated Character'
      },
      {
        createdAt: current.createdAt,
        updatedAt: current.updatedAt,
        streamVersion: current.play.streamVersion,
        maximumHitPoints: current.play.maximumHitPoints,
        speeds: current.play.speeds
      }
    )
    const clone = await readCharacterRow(ctx, foreignCharacterId)
    if (!clone) throw new Error('Missing unrelated Character fixture.')
    await writeCharacterRecord(ctx, clone, {
      document: readCharacterRecord(clone),
      sheetState: readCharacterSheetState(current),
      portraitAssetId: current.portraitAssetId,
      portraitRevision: current.portraitRevision
    })
    await ctx.db.patch(clone.play._id, { updatedAt: current.play.updatedAt })
    await ensureAuthoredRouteId(ctx, 'CHARACTER', foreignCharacterId, false, base.owner.userId)
    await createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
      id: foreignEffectId,
      owner: { kind: 'CHARACTER', characterId: foreignCharacterId },
      definition: deletingEffect.definition,
      lifecycle: deletingEffect.lifecycle
    })
    await ctx.db.insert('userRollHistory', {
      ...roll,
      id: foreignRollId,
      userId: base.owner.userId,
      characterId: null,
      consumedAt: null,
      gmCampaignRoll: null
    })
  })

  const history = await base.t.run(async (ctx) =>
    Object.fromEntries(
      await Promise.all(
        encounterTables.map(async (name) => [name, await ctx.db.query(name).collect()])
      )
    )
  )
  return {
    base,
    draftOnly,
    receiptCommandId,
    roll,
    deletingEffect,
    foreignCharacterId,
    foreignEffectId,
    foreignRollId,
    history
  }
}

describe('trusted private Character account cleanup', () => {
  it.each(['SUCCESS', 'LATE_ROLLBACK', 'MALFORMED_RECEIPT'] as const)(
    'removes complete private Character state and leaves every Encounter row untouched: %s',
    async (outcome) => {
      const fixture = await prepare()
      const { base } = fixture
      if (outcome === 'MALFORMED_RECEIPT')
        await base.t.run(async (ctx) => {
          const stored = await ctx.db
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) =>
              q.eq('characterId', base.character.id).eq('commandId', fixture.receiptCommandId)
            )
            .unique()
          if (!stored) throw new Error('Missing Character receipt fixture.')
          await ctx.db.patch(stored._id, { actorId: 'malformed-actor-uuid' })
        })

      const before = await fullSnapshot(base.t)
      const remove = () =>
        runStepToCompletion(
          base.t,
          base.player.userId,
          'CHARACTERS',
          internal.characters.accountDeletion.step
        )

      if (outcome === 'LATE_ROLLBACK') {
        const abort = vi
          .spyOn(deletionJobs, 'continueAccountDeletion')
          .mockRejectedValueOnce(new Error('Abort after private Character cleanup.'))
        try {
          await expect(remove()).rejects.toThrow('Abort after private Character cleanup.')
        } finally {
          abort.mockRestore()
        }
        expect(await fullSnapshot(base.t)).toEqual(before)
        return
      }
      if (outcome === 'MALFORMED_RECEIPT') {
        await expect(remove()).rejects.toThrow('actorId')
        expect(await fullSnapshot(base.t)).toEqual(before)
        return
      }

      await remove()
      expect(
        await base.t.run((ctx) =>
          ctx.db
            .query('characterReceiptPurgeJobs')
            .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
            .unique()
        )
      ).not.toBeNull()
      await expect(
        base.player.caller.mutation(api.characters.drafts.create, {
          id: base.character.id,
          systemId: base.character.systemId
        })
      ).rejects.toThrow('This Character identity is still being deleted.')
      const after = await fullSnapshot(base.t)
      expect(Object.fromEntries(encounterTables.map((name) => [name, after.app[name]]))).toEqual(
        fixture.history
      )
      const remaining = await base.t.run(async (ctx) => ({
        characters: await ctx.db.query('characters').collect(),
        playStates: await ctx.db.query('characterPlayStates').collect(),
        drafts: await ctx.db.query('characterDrafts').collect(),
        payloads: await ctx.db.query('characterDraftPayloads').collect(),
        routes: await ctx.db.query('authoredRouteIds').collect(),
        receipts: await ctx.db.query('characterCommandReceipts').collect(),
        effects: await ctx.db.query('characterActiveRuleEffects').collect(),
        rolls: await ctx.db.query('userRollHistory').collect(),
        usage: await ctx.db
          .query('accountUsageEntries')
          .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', base.player.userId))
          .collect(),
        profile: await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.player.userId))
          .unique()
      }))
      expect(remaining.characters.some((row) => row.id === base.character.id)).toBe(false)
      expect(remaining.playStates.some((row) => row.characterId === base.character.id)).toBe(false)
      expect(
        remaining.drafts.some(
          (row) =>
            row.characterId === base.character.id ||
            row.characterId === fixture.draftOnly.characterId
        )
      ).toBe(false)
      expect(
        remaining.payloads.some(
          (row) =>
            row.characterId === base.character.id ||
            row.characterId === fixture.draftOnly.characterId
        )
      ).toBe(false)
      expect(
        remaining.routes.some(
          (row) =>
            row.subjectId === base.character.id || row.subjectId === fixture.draftOnly.characterId
        )
      ).toBe(false)
      expect(remaining.receipts.some((row) => row.characterId === base.character.id)).toBe(false)
      expect(remaining.effects.some((row) => row.id === fixture.deletingEffect.id)).toBe(false)
      expect(remaining.rolls.some((row) => row.userId === base.player.userId)).toBe(false)
      expect(remaining.usage.some((row) => row.resource === 'personalCharacters')).toBe(false)
      expect(remaining.profile?.entitlementUsage.personalCharacters).toBe(0)
      expect(remaining.characters).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: fixture.foreignCharacterId })])
      )
      expect(remaining.playStates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ characterId: fixture.foreignCharacterId })
        ])
      )
      expect(remaining.effects).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: fixture.foreignEffectId })])
      )
      expect(remaining.rolls).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: fixture.foreignRollId })])
      )
    },
    30_000
  )
})
