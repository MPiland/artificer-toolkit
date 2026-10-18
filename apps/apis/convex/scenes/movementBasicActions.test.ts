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
import type {
  EncounterActionChoicesResponseDto,
  GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { sourceImportBatches } from '../content/importBatches'
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

const actionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')
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
  for (const definitions of sourceImportBatches(SRD_BASIC_ACTION_DEFINITIONS))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
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

/** RESOLVE_ACTION for one of the actor's authored basic actions, aimed at itself unless a target is given. */
async function resolveBasicAction(
  base: MoverTurn,
  actorId: string,
  label: string,
  targetActorId = actorId
) {
  const expectedVersion = await runVersion(base)
  const choices = await base.owner.caller.query(actionChoices, {
    encounterId: base.run.id,
    expectedVersion,
    actorId
  })
  const choice = choices?.basicActionChoices.find((entry) => entry.label === label)
  if (!choice) throw new Error(`The actor is not offered the ${label} basic action.`)
  return gm(base, {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion,
    actorId,
    target: { kind: 'ACTOR', actorId: targetActorId },
    actionId: choice.id,
    optionalCombatIntent: null,
    sceneContext: null
  })
}

/** The Active Effects the actor holds, as Convex stores them once the room checkpoints. */
async function activeEffectCount(base: MoverTurn, actorId: string) {
  await checkpointLiveRoom(base.campaign.id)
  return (
    await base.t.run((ctx) =>
      ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
          q.eq('encounterId', base.run.id).eq('targetActorId', actorId)
        )
        .collect()
    )
  ).length
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

/** Ends the current actor's turn through the real room. */
async function advanceTurn(base: MoverTurn) {
  return gm(base, {
    type: 'ADVANCE_TURN',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await runVersion(base)
  })
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
  await resolveBasicAction(base, base.mover.id, 'Disengage')
  expect((await moveAwayFromReactor(base)).occurrence?.status).not.toBe('PENDING')
})

it("another actor's Disengage leaves the mover's move provoking as before (Q11)", async () => {
  const base = await moverTurn()
  await setCurrentActor(base, base.reactor.id)
  await resolveBasicAction(base, base.reactor.id, 'Disengage')
  await setCurrentActor(base, base.mover.id)
  expect(await activeEffectCount(base, base.reactor.id)).toBe(1)
  expect((await moveAwayFromReactor(base)).occurrence?.status).toBe('PENDING')
})

it('a Disengage survives a GM cursor correction and ends only when its turn really ends (Q11)', async () => {
  const base = await moverTurn()
  await resolveBasicAction(base, base.mover.id, 'Disengage')
  expect(await activeEffectCount(base, base.mover.id)).toBe(1)
  // A GM correction is not the end of the turn: the grant stays and the move still provokes nothing.
  await setCurrentActor(base, base.reactor.id)
  await setCurrentActor(base, base.mover.id)
  expect(await activeEffectCount(base, base.mover.id)).toBe(1)
  expect((await moveAwayFromReactor(base)).occurrence?.status).not.toBe('PENDING')
})

it("a Disengage ends with the mover's real turn end, so a later turn is not covered (Q11)", async () => {
  const base = await moverTurn()
  await resolveBasicAction(base, base.mover.id, 'Disengage')
  expect(await activeEffectCount(base, base.mover.id)).toBe(1)
  // The mover's turn really ends, the reactor's turn runs, and the mover is current again.
  await advanceTurn(base)
  expect((await advanceTurn(base)).projection.currentActorId).toBe(base.mover.id)
  expect(await activeEffectCount(base, base.mover.id)).toBe(0)
  expect((await moveAwayFromReactor(base)).occurrence?.status).toBe('PENDING')
})

it("an ally's Help gives the reactor's opportunity attack advantage, used once (Q11)", async () => {
  const base = await moverTurn(true)
  const helper = base.additionalReactorActor
  if (!helper) throw new Error('Missing the reactor ally.')
  await setAutoRollDice(base.t, base.owner.userId, false)
  await invalidateRoomInputs(base.campaign.id, ['PREFERENCES'])
  await resolveBasicAction(base, helper.id, 'Help', base.reactor.id)
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
  expect(await activeEffectCount(base, base.reactor.id)).toBe(1)

  await answer(base, attack, {
    kind: 'ENTER_DICE',
    requestId: attack.request.requestId,
    rawFaces: [1, 1],
    rollMode: 'ADVANTAGE'
  })
  expect(await activeEffectCount(base, base.reactor.id)).toBe(0)
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
