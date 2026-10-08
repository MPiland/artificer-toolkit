import { makeFunctionReference } from 'convex/server'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { expect, it } from 'vitest'
import type {
  EncounterCommandInputDto,
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { encounterBasicActionEffects } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  executeSceneInRoom,
  invalidateRoomInputs,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { internal } from '../_generated/api'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

useLocalRoomWorker()

const [, disengage, , help] = SRD_BASIC_ACTION_DEFINITIONS
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

/**
 * An Assisted Run on the mover's turn: a Creature next to a reactor with an opportunity attack,
 * with the move's Scene bound. With `withHelper`, the reactor's ally (off the Scene) acts first.
 */
async function moverTurn(
  withHelper = false,
  qualifiedDamageDefenses?: CreatureAuthored['qualifiedDamageDefenses']
) {
  const base = await setupCreatureReactionRun(null, true, withHelper, 'CHOICE', 'CHOICE', false, {
    qualifiedDamageDefenses
  })
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_BASIC_ACTION_DEFINITIONS
  })
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
  await setCurrentActor(base, base.additionalReactorActor?.id ?? base.mover.id)
  return { ...base, value }
}

type MoverTurn = Awaited<ReturnType<typeof moverTurn>>

async function gm(base: Pick<MoverTurn, 'owner'>, command: EncounterCommandInputDto) {
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

async function setCurrentActor(
  base: Pick<MoverTurn, 'owner' | 'run' | 't' | 'campaign'>,
  actorId: string
) {
  return gm(base, {
    type: 'SET_CURRENT_ACTOR',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await runVersion(base),
    actorId
  })
}

async function effectsOf(base: MoverTurn, actorId: string) {
  await checkpointLiveRoom(base.campaign.id)
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', actorId))
      .unique()
  )
  if (!row) throw new Error('Missing reaction actor.')
  return encounterBasicActionEffects(readStoredRunActor(row))
}

/** Answers the room's pending movement decision as the GM. */
async function answer(
  base: MoverTurn,
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  return gm(base, {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: base.run.id,
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    correlationId: null,
    resolution
  })
}

/** The Run's version as Convex holds it once the room checkpoints. */
async function runVersion(base: Pick<MoverTurn, 'run' | 't' | 'campaign'>) {
  await checkpointLiveRoom(base.campaign.id)
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
  )
  if (!row) throw new Error('Missing reaction Run.')
  return row.version
}

/** Commits the mover's move out of the reactor's reach through the real room. */
async function moveAwayFromReactor(base: MoverTurn) {
  const { result } = await executeSceneInRoom(base.owner.caller, {
    ...base.value.rootInput,
    expectedEncounterVersion: await runVersion(base)
  })
  if (!result) throw new Error('Expected a committed Scene command result.')
  return result
}

it('offers the reactor its opportunity attack when the mover leaves its reach', async () => {
  expect((await moveAwayFromReactor(await moverTurn())).occurrence?.status).toBe('PENDING')
})

it('a defeated reactor takes no opportunity attack (D63)', async () => {
  const base = await moverTurn()
  // The Run is the room's until it closes; the direct write below hydrates into its next command.
  await closeRoom(base.campaign.id)
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.reactor.id)
      )
      .unique()
    if (!row) throw new Error('Missing reaction actor.')
    const defeated = encounterRunActorStateSchema.parse({
      ...(await readTestActor(ctx, row)),
      currentHitPoints: 0,
      defeated: true
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, defeated)
  })
  expect((await moveAwayFromReactor(base)).occurrence?.status).not.toBe('PENDING')
})

it('a Disengaged mover provokes no opportunity attack prompt in Assisted mode (Q11)', async () => {
  const base = await moverTurn()
  await basicAction(base, base.mover.id, disengage!.id)
  expect((await moveAwayFromReactor(base)).occurrence?.status).not.toBe('PENDING')
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
  expect((await moveAwayFromReactor(base)).occurrence?.status).toBe('PENDING')
})

it("an ally's Help gives the reactor's opportunity attack advantage, used once (Q11)", async () => {
  const base = await moverTurn(true)
  const helper = base.additionalReactorActor
  if (!helper) throw new Error('Missing the reactor ally.')
  await setAutoRollDice(base.t, base.owner.userId, false)
  await invalidateRoomInputs(base.campaign.id, ['PREFERENCES'])
  await basicAction(base, helper.id, help!.id, base.reactor.id)
  await setCurrentActor(base, base.mover.id)

  const choice = (await moveAwayFromReactor(base)).occurrence?.pending
  if (choice?.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected the opportunity attack choice.')
  const attack = (
    await answer(base, choice, { kind: 'OPTION', optionId: choice.choice.options[0].optionId })
  ).occurrence?.pending
  if (attack?.kind !== 'D20_EVIDENCE') throw new Error('Expected the opportunity attack roll.')
  // The tabletop reads the prompt with its reasons.
  await checkpointLiveRoom(base.campaign.id)
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

/** The mover's Hit Points after the reactor's opportunity attack (natural 20, minimal damage dice). */
async function moverHitPointsAfterOpportunityAttack(
  qualifiedDamageDefenses?: CreatureAuthored['qualifiedDamageDefenses']
) {
  const base = await moverTurn(false, qualifiedDamageDefenses)
  await queueRoomRolls(base.campaign.id, { rolls: [19], repeat: 0 })
  const choice = (await moveAwayFromReactor(base)).occurrence?.pending
  if (choice?.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected the opportunity attack choice.')
  const settled = await answer(base, choice, {
    kind: 'OPTION',
    optionId: choice.choice.options[0].optionId
  })
  expect(settled.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  await checkpointLiveRoom(base.campaign.id)
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', base.run.id).eq('id', base.mover.id)
      )
      .unique()
  )
  if (!row) throw new Error('Missing the mover.')
  const actor = readStoredRunActor(row)
  if (actor.kind === 'CHARACTER') throw new Error('The mover owns its hit points in the Run.')
  return actor.currentHitPoints
}

it('an opportunity attack is a nonmagical attack: qualified immunity stops it, plain damage lands', async () => {
  const piercing = SRD_DAMAGE_TYPES.find((type) => type.code === 'PIERCING')
  if (!piercing) throw new Error('Missing the SRD piercing damage type.')
  const unprotected = await moverHitPointsAfterOpportunityAttack()
  expect(unprotected).toBeLessThan(11)
  expect(
    await moverHitPointsAfterOpportunityAttack([
      { kind: 'IMMUNITY', damageTypeIds: [piercing.id], bypassedBy: ['MAGICAL', 'SILVERED'] }
    ])
  ).toBe(11)
})
