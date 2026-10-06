import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  BindEncounterToPresentedSceneInputDto,
  EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { components } from '../_generated/api'
import {
  createEncounterSceneFixture,
  publishSceneSource
} from '../../tests/fixtures/encounterScene'

type RollbackTarget = { ownerUserId: string; campaignId: string; encounterId: string }
type RollbackOperation =
  | { kind: 'SCENE_BINDING'; input: BindEncounterToPresentedSceneInputDto }
  | { kind: 'TOKEN_BINDING'; input: EncounterActorTokenBindingCommandInputDto }
type RollbackInput = RollbackTarget & { operation: RollbackOperation }

const inspect = makeFunctionReference<'query', RollbackTarget, string>(
  'encounters/developmentLifecycle:inspect'
)
const verifyRollback = makeFunctionReference<'action', RollbackInput, { rolledBack: true }>(
  'encounters/developmentLifecycle:verifyRollback'
)
const bindScene = makeFunctionReference<'mutation', BindEncounterToPresentedSceneInputDto, unknown>(
  'encounters/sceneBindings:bind'
)

async function setup() {
  const base = await createEncounterSceneFixture()
  await publishSceneSource(base)
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.other.userId, base.owner.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing fixture Campaign.')
    await ctx.db.patch(campaign._id, { name: 'Encounter execution fixture' })
  })
  return {
    ...base,
    target: {
      ownerUserId: base.other.userId,
      campaignId: base.campaign.id,
      encounterId: base.run.id
    }
  }
}

async function read(base: Awaited<ReturnType<typeof setup>>) {
  return base.other.caller.run((ctx) => ctx.runQuery(inspect, base.target))
}

async function verify(base: Awaited<ReturnType<typeof setup>>, operation: RollbackOperation) {
  return base.other.caller.action(verifyRollback, { ...base.target, operation })
}

function sceneBindingOperation(base: Awaited<ReturnType<typeof setup>>) {
  return {
    kind: 'SCENE_BINDING',
    input: {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    }
  } satisfies RollbackOperation
}

describe('development lifecycle rollback proof', () => {
  it('rolls back a real Scene binding and preserves every inspected row', async () => {
    const base = await setup()
    const before = await read(base)
    await expect(
      verify(base, {
        kind: 'SCENE_BINDING',
        input: {
          type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
          commandId: crypto.randomUUID(),
          encounterId: base.run.id
        }
      })
    ).resolves.toEqual({ rolledBack: true })
    expect(await read(base)).toBe(before)
  }, 30_000)

  it('rolls back a real actor-token binding and preserves every inspected row', async () => {
    const base = await setup()
    await base.other.caller.mutation(bindScene, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    })
    const actor = base.run.actors[0]
    const token = base.tokens[0]
    if (!actor || !token) throw new Error('Missing fixture actor or token.')
    const before = await read(base)
    await expect(
      verify(base, {
        kind: 'TOKEN_BINDING',
        input: {
          type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
          commandId: crypto.randomUUID(),
          encounterId: base.run.id,
          actorId: actor.id,
          sceneId: base.sceneId,
          tokenId: token.id,
          expectedEncounterVersion: base.run.version
        }
      })
    ).resolves.toEqual({ rolledBack: true })
    expect(await read(base)).toBe(before)
  }, 30_000)

  it('rejects anonymous, player, and nonfixture callers', async () => {
    const base = await setup()
    const input: RollbackInput = { ...base.target, operation: sceneBindingOperation(base) }
    await expect(base.t.action(verifyRollback, input)).rejects.toThrow('Unauthenticated')
    await expect(base.owner.caller.action(verifyRollback, input)).rejects.toThrow(
      'Fixture owner does not match the caller.'
    )
    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: 'owner@example.invalid' }
        }
      })
    })
    await expect(verify(base, sceneBindingOperation(base))).rejects.toThrow(
      'Fixture account is required.'
    )
  }, 30_000)

  it('rejects an origin outside personal development without writes', async () => {
    const base = await setup()
    const before = await read(base)
    const originalOrigin = process.env.SITE_URL
    try {
      process.env.SITE_URL = 'https://example.com'
      await expect(verify(base, sceneBindingOperation(base))).rejects.toThrow(
        'Fixture cleanup requires the development application origin.'
      )
    } finally {
      if (originalOrigin === undefined) delete process.env.SITE_URL
      else process.env.SITE_URL = originalOrigin
    }
    expect(await read(base)).toBe(before)
  }, 30_000)

  it('refuses a replay no-op and an operation targeting another Run without writes', async () => {
    const base = await setup()
    const operation = sceneBindingOperation(base)
    await base.other.caller.mutation(bindScene, operation.input)
    const replayBefore = await read(base)
    await expect(verify(base, operation)).rejects.toThrow(
      'Fixture lifecycle operation did not change persisted state.'
    )
    expect(await read(base)).toBe(replayBefore)

    const mismatched: RollbackOperation = {
      kind: 'SCENE_BINDING',
      input: {
        type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
        commandId: crypto.randomUUID(),
        encounterId: crypto.randomUUID()
      }
    }
    const mismatchBefore = await read(base)
    await expect(verify(base, mismatched)).rejects.toThrow(
      'Fixture lifecycle operation targets another Encounter Run.'
    )
    expect(await read(base)).toBe(mismatchBefore)
  }, 30_000)

  it('refuses a snapshot that exceeds its bounded actor read', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const actors = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
        .take(2)
      const actor = actors[0]
      if (!actor) throw new Error('Missing fixture actor.')
      const { _id, _creationTime, ...stored } = actor
      for (let index = 0; index < 10; index++)
        await ctx.db.insert('encounterRunActors', { ...stored, id: crypto.randomUUID() })
    })
    await expect(read(base)).rejects.toThrow('Fixture lifecycle inspection exceeds its bounds.')
  }, 30_000)
})
