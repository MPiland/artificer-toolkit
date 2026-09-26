import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { executeInRoom, planStagedMovementInRoom } from '../../tests/fixtures/liveSessionWorker'
import { internal } from '../_generated/api'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')

/** An Assisted Run on the mover's turn: a Creature next to a reactor with an opportunity attack. */
async function moverTurn() {
  const base = await setupCreatureReactionRun(null, true)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_BASIC_ACTION_DEFINITIONS
  })
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing reaction Run.')
    const state = encounterRunStateSchema.parse({
      ...JSON.parse(row.stateJson),
      currentActorId: base.mover.id
    })
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
    await seedActiveInitiative(ctx, state, [base.mover.id, base.reactor.id])
  })
  return base
}

async function runVersion(base: Awaited<ReturnType<typeof moverTurn>>) {
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
  )
  if (!row) throw new Error('Missing reaction Run.')
  return row.version
}

async function moveAwayFromReactor(base: Awaited<ReturnType<typeof moverTurn>>) {
  const version = await runVersion(base)
  const value = await setupReactionMovementScene(
    { ...base, run: { ...base.run, version } },
    [base.reactor, base.mover],
    [50]
  )
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  return (await planStagedMovementInRoom(value.owner.caller, value.saveId)).outcome.kind
}

it('offers the reactor its opportunity attack when the mover leaves its reach', async () => {
  expect(await moveAwayFromReactor(await moverTurn())).toBe('PENDING')
})

it('a Disengaged mover provokes no opportunity attack prompt in Assisted mode (Q11)', async () => {
  const base = await moverTurn()
  await executeInRoom(base.owner.caller, {
    command: {
      type: 'USE_BASIC_ACTION',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await runVersion(base),
      actorId: base.mover.id,
      definitionId: SRD_BASIC_ACTION_DEFINITIONS[1]!.id,
      allyActorId: null
    }
  })
  expect(await moveAwayFromReactor(base)).not.toBe('PENDING')
})
