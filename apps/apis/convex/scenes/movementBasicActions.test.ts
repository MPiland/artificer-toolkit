import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type {
  EncounterCommandInputDto,
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterBasicActionEffects } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  executeInRoom,
  planMovementDecisionInRoom,
  planStagedMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'
import { internal } from '../_generated/api'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

const [, disengage, , help] = SRD_BASIC_ACTION_DEFINITIONS
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')

/**
 * An Assisted Run on the mover's turn: a Creature next to a reactor with an opportunity attack.
 * With `withHelper`, the reactor's ally (off the Scene) acts first instead.
 */
async function moverTurn(withHelper = false) {
  const base = await setupCreatureReactionRun(null, true, withHelper)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_BASIC_ACTION_DEFINITIONS
  })
  await setCurrentActor(base, base.additionalReactorActor?.id ?? base.mover.id)
  return base
}

type MoverTurn = Awaited<ReturnType<typeof moverTurn>>

async function gm(base: MoverTurn, command: EncounterCommandInputDto) {
  return executeInRoom(base.owner.caller, { command })
}

async function basicAction(
  base: MoverTurn,
  actorId: string,
  definitionId: string,
  allyActorId: string | null = null
) {
  return gm(base, {
    type: 'USE_BASIC_ACTION',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await runVersion(base),
    actorId,
    definitionId,
    allyActorId,
    acknowledgedWarnings: []
  })
}

async function setCurrentActor(base: MoverTurn, actorId: string) {
  return gm(base, {
    type: 'SET_CURRENT_ACTOR',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await runVersion(base),
    actorId
  })
}

async function effectsOf(base: MoverTurn, actorId: string) {
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', actorId))
      .unique()
  )
  if (!row) throw new Error('Missing reaction actor.')
  return encounterBasicActionEffects(encounterRunActorStateSchema.parse(JSON.parse(row.stateJson)))
}

/** Answers the room's pending movement decision as the GM and publishes the next plan. */
async function answer(
  base: MoverTurn,
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  const plan = await planMovementDecisionInRoom(base.owner.caller, {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: base.run.id,
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    correlationId: null,
    resolution
  })
  return plan.publish()
}

async function runVersion(base: MoverTurn) {
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
  )
  if (!row) throw new Error('Missing reaction Run.')
  return row.version
}

/** Plans the mover's move out of the reactor's reach in the room. */
async function moveAwayFromReactor(base: MoverTurn) {
  const version = await runVersion(base)
  const value = await setupReactionMovementScene(
    { ...base, run: { ...base.run, version } },
    [base.reactor, base.mover],
    [50]
  )
  await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
  return planStagedMovementInRoom(value.owner.caller, value.saveId)
}

it('offers the reactor its opportunity attack when the mover leaves its reach', async () => {
  expect((await moveAwayFromReactor(await moverTurn())).outcome.kind).toBe('PENDING')
})

it('a defeated reactor takes no opportunity attack (D63)', async () => {
  const base = await moverTurn()
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.reactor.id)
      )
      .unique()
    if (!row) throw new Error('Missing reaction actor.')
    const defeated = encounterRunActorStateSchema.parse({
      ...JSON.parse(row.stateJson),
      currentHitPoints: 0,
      defeated: true
    })
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(defeated),
      stateChecksum: checksumCanonicalJson(defeated)
    })
  })
  expect((await moveAwayFromReactor(base)).outcome.kind).not.toBe('PENDING')
})

it('a Disengaged mover provokes no opportunity attack prompt in Assisted mode (Q11)', async () => {
  const base = await moverTurn()
  await basicAction(base, base.mover.id, disengage!.id)
  expect((await moveAwayFromReactor(base)).outcome.kind).not.toBe('PENDING')
})

it("a Disengage ends with its turn: setting the mover current again doesn't revive it", async () => {
  const base = await moverTurn()
  await basicAction(base, base.mover.id, disengage!.id)
  await setCurrentActor(base, base.reactor.id)
  await setCurrentActor(base, base.mover.id)
  // The mover still holds the effect until its next turn starts, but that turn is over.
  expect((await effectsOf(base, base.mover.id)).map((effect) => effect.mechanic)).toEqual([
    'NO_OPPORTUNITY_ATTACKS'
  ])
  expect((await moveAwayFromReactor(base)).outcome.kind).toBe('PENDING')
})

it("an ally's Help gives the reactor's opportunity attack advantage, used once (Q11)", async () => {
  const base = await moverTurn(true)
  const helper = base.additionalReactorActor
  if (!helper) throw new Error('Missing the reactor ally.')
  await setAutoRollDice(base.t, base.owner.userId, false)
  await basicAction(base, helper.id, help!.id, base.reactor.id)
  await setCurrentActor(base, base.mover.id)

  const choice = (await (await moveAwayFromReactor(base)).publish()).occurrence?.pending
  if (choice?.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected the opportunity attack choice.')
  const attack = (
    await answer(base, choice, { kind: 'OPTION', optionId: choice.choice.options[0].optionId })
  ).occurrence?.pending
  if (attack?.kind !== 'D20_EVIDENCE') throw new Error('Expected the opportunity attack roll.')
  // The tabletop reads the prompt with its reasons.
  const prompt = await base.owner.caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
  expect(prompt).toMatchObject({
    kind: 'D20_EVIDENCE',
    request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Help'] }
  })
  expect(await effectsOf(base, helper.id)).toHaveLength(1)

  await answer(base, attack, {
    kind: 'ENTER_DICE',
    requestId: attack.request.requestId,
    rawFaces: [1, 1],
    rollMode: 'ADVANTAGE'
  })
  expect(await effectsOf(base, helper.id)).toEqual([])
})
