import {
  createConvexEncounterStoreReader,
  createConvexEncounterStore
} from '../lib/convexEncounterStore'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type CreateEncounterInputDto,
  type EncounterGmProjectionDto,
  type EncounterExecuteInput,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { runActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { automaticChargedBiteFeatureId } from '../../tests/fixtures/encounterAction'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import {
  seedTurnSaveEffect,
  turnActiveEffectFixture,
  turnCharacterEffectFixture
} from '../../tests/fixtures/turnActiveEffectFixtures'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  queueRoomRolls,
  RoomCommandRefusal,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')

/** The turn-effect fixture with the real room attached. */
async function roomFixture(...args: Parameters<typeof turnActiveEffectFixture>) {
  const base = await turnActiveEffectFixture(...args)
  await attachFixtureRoom(base.t, base.campaign.id)
  return base
}

/** Seeds the effect straight in Convex, so the room lets go of the Run and re-hydrates it next. */
async function seedEffect(
  base: Awaited<ReturnType<typeof turnActiveEffectFixture>>,
  input: Parameters<typeof seedTurnSaveEffect>[1]
) {
  await closeRoom(base.campaign.id)
  return seedTurnSaveEffect(base, input)
}

/**
 * Convex's rows after the room checkpoints. The Run's command rows and receipts stay in the room
 * until the Run ends (D85, D88), so they are not part of this snapshot.
 */
async function stored(base: Awaited<ReturnType<typeof turnActiveEffectFixture>>) {
  await checkpointLiveRoom(base.campaign.id)
  const characterIds = base.run.actors.flatMap((actor) =>
    actor.kind === 'CHARACTER' && actor.sourceId ? [actor.sourceId] : []
  )
  return base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    characters: await Promise.all(characterIds.map((id) => readCharacterRow(ctx, id))),
    characterEffects: (
      await Promise.all(
        characterIds.map((id) =>
          ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', id))
            .collect()
        )
      )
    ).flat(),
    characterReceipts: (
      await Promise.all(
        characterIds.map((id) =>
          ctx.db
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) => q.eq('characterId', id))
            .collect()
        )
      )
    ).flat(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    rounds: await ctx.db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    participants: await ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    effects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
        q.eq('encounterId', base.run.id)
      )
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', base.run.id))
      .collect()
  }))
}

function unchangedMechanics(
  before: Awaited<ReturnType<typeof stored>>,
  after: Awaited<ReturnType<typeof stored>>
) {
  const { occurrences: _beforeOccurrences, ...beforeMechanics } = before
  const { occurrences: _afterOccurrences, ...afterMechanics } = after
  expect(afterMechanics).toEqual(beforeMechanics)
}

function response(
  encounterId: string,
  input: unknown,
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  const result = encounterCommandResultDtoSchema.parse(input)
  if (!result.occurrence) throw new Error('Expected a pending turn occurrence.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      occurrenceId: result.occurrence.occurrenceId,
      expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
      correlationId: null,
      resolution
    }
  } satisfies EncounterExecuteInput
}

function d20Pending(input: unknown) {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected turn-effect d20 evidence.')
  return { result, pending }
}

function diceResponse(encounterId: string, input: unknown) {
  const { result, pending } = d20Pending(input)
  return response(encounterId, result, {
    kind: 'ENTER_DICE',
    requestId: pending.request.requestId,
    rawFaces: [1],
    rollMode: pending.request.rollMode
  })
}

/** "Roll dice" as the GM, then answer with that app roll. */
async function appRollResponse(
  base: Awaited<ReturnType<typeof turnActiveEffectFixture>>,
  input: unknown
) {
  const { result, pending } = d20Pending(input)
  // App rolls post to the table chat, which needs a username.
  await base.owner.caller.mutation(api.account.updateProfile, { username: 'TurnGm', bio: null })
  const rolled = await executeInRoom(base.owner.caller, {
    command: {
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      requestId: pending.request.requestId,
      rollMode: pending.request.rollMode
    }
  })
  if (!rolled.evidenceRoll) throw new Error('Expected a recorded app roll.')
  return response(base.run.id, result, {
    kind: 'SYSTEM_ROLL',
    requestId: pending.request.requestId,
    rollId: rolled.evidenceRoll.rollId
  })
}

async function resolveInitiative(
  base: Awaited<ReturnType<typeof turnActiveEffectFixture>>,
  input: unknown
) {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'INITIATIVE_EVIDENCE')
    throw new Error('Expected initiative before incoming turn effects.')
  return executeInRoom(
    base.owner.caller,
    response(base.run.id, result, {
      kind: 'ENTER_INTEGER',
      requestId: pending.request.requestId,
      value: 10
    })
  )
}

async function pendingEffect(
  base: Awaited<ReturnType<typeof turnActiveEffectFixture>>,
  effectId: string,
  stage: 'START_OF_TURN' | 'END_OF_TURN'
) {
  const snapshot = await stored(base)
  const occurrence = snapshot.occurrences.find((row) => row.state === 'PENDING')
  if (!occurrence) throw new Error('Expected a retained turn-effect continuation.')
  const pending = await base.t.run((ctx) =>
    readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, occurrence)
  )
  expect(pending?.applicationContext).toMatchObject({
    kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
    currentCandidate: { activeEffectId: effectId, stage }
  })
  return snapshot
}

describe('native public turn active-effect journeys', () => {
  it('uses staged Character damage facts for EACH_ROUND initiative while the turn remains pending', async () => {
    const fixture = await turnCharacterEffectFixture()
    for (const userId of [fixture.owner.userId, fixture.player.userId])
      await setAutoRollDice(fixture.t, userId, false)
    const initiative = createEncounterInitiativeDefinitions([
      { procedure: 'ACTOR_ROLL', cadence: 'EACH_ROUND' }
    ])
    await fixture.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: initiative.definitions
    })
    const settings = await fixture.owner.caller.query(getSettings, {
      campaignId: fixture.campaign.id
    })
    const { version, updatedAt: _updatedAt, ...fields } = settings
    await fixture.owner.caller.mutation(saveSettings, {
      ...fields,
      expectedVersion: version,
      initiativePolicyDefinitionId: initiative.policyIds[0]!,
      initiativeTieDefinitionId: null
    })
    // The room already ran a command in the fixture; it re-reads these Convex-side edits on its next admission.
    await closeRoom(fixture.campaign.id)
    const created = await fixture.owner.caller.mutation(createRun, {
      campaignId: fixture.campaign.id,
      blueprintId: fixture.run.blueprintId,
      commandId: crypto.randomUUID()
    })
    const opponent = created.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!opponent) throw new Error('Expected the fixture opponent.')
    const removed = await executeInRoom(fixture.owner.caller, {
      command: {
        type: 'REMOVE_ACTOR',
        encounterId: created.id,
        commandId: crypto.randomUUID(),
        expectedVersion: created.version,
        actorId: opponent.id
      }
    })
    const base = { ...fixture, run: encounterGmProjectionDtoSchema.parse(removed.projection) }
    const actor = base.run.actors[0]!
    if (actor.kind !== 'CHARACTER') throw new Error('Expected a Character turn owner.')
    const starting = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const started = await resolveInitiative(base, starting)
    expect(started.occurrence?.status).toBe('COMPLETE')
    const effect = await seedEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const before = await stored(base)
    const advance: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    }
    const pendingOutgoing = await executeInRoom(base.owner.caller, advance)
    unchangedMechanics(before, await pendingEffect(base, effect.id, 'END_OF_TURN'))
    const pendingInitiative = await executeInRoom(
      base.owner.caller,
      diceResponse(base.run.id, pendingOutgoing)
    )
    expect(pendingInitiative.occurrence?.pending?.kind).toBe('INITIATIVE_EVIDENCE')
    unchangedMechanics(before, await stored(base))
    const completed = await resolveInitiative(base, pendingInitiative)
    expect(completed.occurrence?.status).toBe('COMPLETE')
    const terminal = await stored(base)
    const characterBefore = before.characters[0]
    const characterAfter = terminal.characters[0]
    if (!characterBefore || !characterAfter) throw new Error('Expected the Character rows.')
    expect(characterAfter.play.streamVersion).toBe(characterBefore.play.streamVersion + 1)
    expect(
      characterAuthoredDtoSchema.parse(readCharacterRecord(characterAfter)).state.hitpoints.current
    ).toBe(actor.currentHitPoints - 1)
    expect(terminal.characterEffects).toEqual([])
    expect(terminal.characterReceipts).toHaveLength(before.characterReceipts.length)
    await expect(executeInRoom(base.owner.caller, advance)).resolves.toEqual({
      ...pendingOutgoing,
      projection: completed.projection
    })
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('redacts accepted Character declaration replay while its controller sees the incoming turn-effect save', async () => {
    const base = await turnCharacterEffectFixture()
    for (const userId of [base.owner.userId, base.player.userId])
      await setAutoRollDice(base.t, userId, false)
    expect(base.run.actors).toHaveLength(1)
    const actor = base.run.actors[0]!
    expect(actor.kind).toBe('CHARACTER')
    const effect = await seedEffect(base, { stage: 'START_OF_TURN', ticks: 1, damage: 1 })
    const before = await stored(base)
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    const issued = await executeInRoom(base.owner.caller, start)
    const declaration = await base.player.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (!declaration || declaration.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected the controller-owned Character declaration.')
    expect(declaration.actorId).toBe(actor.id)
    const option = declaration.primaryOptions.find((entry) => entry.kind === 'CHARACTER_ACTION')
    if (!option) throw new Error('Expected the equipped Character action declaration.')
    const declarationCommand = response(base.run.id, issued, {
      kind: 'INITIATIVE_DECLARATION',
      requestId: declaration.requestId,
      primary: { kind: 'CHARACTER_ACTION', optionId: option.optionId },
      bonus: null
    })
    const accepted = await executeInRoom(base.player.caller, declarationCommand)
    expect(encounterPlayerProjectionDtoSchema.safeParse(accepted.projection).success).toBe(true)
    expect(accepted.occurrence?.pending).toBeNull()
    // The GM's initiative prompt is hidden from the player's result, so read it as the owner.
    await checkpointLiveRoom(base.campaign.id)
    const gmInitiative = {
      ...accepted,
      occurrence: accepted.occurrence && {
        ...accepted.occurrence,
        pending: await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      }
    }
    const pendingIncoming = await resolveInitiative(base, gmInitiative)
    const paused = await pendingEffect(base, effect.id, 'START_OF_TURN')
    unchangedMechanics(before, paused)
    // The save belongs to the player's Character, so its controller sees and may answer it.
    const playerPending = await base.player.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    expect(playerPending).toMatchObject({
      kind: 'D20_EVIDENCE',
      rollerActorId: actor.id,
      occurrenceId: pendingIncoming.occurrence?.occurrenceId
    })
    expect(
      await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
        campaignId: base.campaign.id
      })
    ).toEqual([])
    const playerProjection = encounterPlayerProjectionDtoSchema.parse(
      await base.player.caller.query(api.encounters.projectionReads.get, {
        encounterId: base.run.id
      })
    )
    const expectedReplay = { ...accepted, projection: playerProjection }
    const replay = await executeInRoom(base.player.caller, declarationCommand)
    expect(replay).toEqual(expectedReplay)
    expect(replay.projection.actors.every((entry) => !('currentHitPoints' in entry))).toBe(true)
    await expect(executeInRoom(base.player.caller, declarationCommand)).resolves.toEqual(
      expectedReplay
    )
    const dice = diceResponse(base.run.id, pendingIncoming)
    expect(await stored(base)).toEqual(paused)
    // The GM may answer any prompt, including the player's save.
    const settled = await executeInRoom(base.owner.caller, dice)
    expect(settled.occurrence?.status).toBe('COMPLETE')
    const terminal = await stored(base)
    const characterBefore = before.characters[0]
    const characterAfter = terminal.characters[0]
    if (!characterBefore || !characterAfter)
      throw new Error('Expected the authoritative Character rows.')
    expect(characterAfter.play.streamVersion).toBe(characterBefore.play.streamVersion + 1)
    expect(
      characterAuthoredDtoSchema.parse(readCharacterRecord(characterAfter)).state.hitpoints.current
    ).toBe(actor.currentHitPoints - 1)
    expect(
      encounterGmProjectionDtoSchema.parse(settled.projection).actors[0]!.currentHitPoints
    ).toBe(actor.currentHitPoints - 1)
    expect(terminal.characterEffects).toEqual([])
    expect(terminal.characterReceipts).toHaveLength(before.characterReceipts.length)
    const terminalReplay = await executeInRoom(base.player.caller, declarationCommand)
    expect(terminalReplay.occurrence?.pending).toBeNull()
    expect(encounterPlayerProjectionDtoSchema.safeParse(terminalReplay.projection).success).toBe(
      true
    )
    await expect(executeInRoom(base.player.caller, declarationCommand)).resolves.toEqual(
      terminalReplay
    )
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('replays an accepted initiative declaration while START awaits incoming effect dice', async () => {
    const base = await roomFixture('PROMPT', 'DECLARED_ACTION_ROLL')
    const effect = await seedEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const before = await stored(base)
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    const pendingDeclaration = await executeInRoom(base.owner.caller, start)
    const declaration = pendingDeclaration.occurrence?.pending
    if (!declaration || declaration.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected a Creature initiative declaration.')
    const option = declaration.primaryOptions.find(
      (entry) => entry.kind === 'CREATURE_FEATURE_ACTION'
    )
    if (!option) throw new Error('Expected the issued Creature Feature option.')
    const acceptedDeclaration = response(base.run.id, pendingDeclaration, {
      kind: 'INITIATIVE_DECLARATION',
      requestId: declaration.requestId,
      primary: { kind: 'CREATURE_FEATURE_ACTION', optionId: option.optionId },
      bonus: null
    })
    const pendingInitiative = await executeInRoom(base.owner.caller, acceptedDeclaration)
    const pendingIncoming = await resolveInitiative(base, pendingInitiative)
    const paused = await pendingEffect(base, effect.id, 'START_OF_TURN')
    unchangedMechanics(before, paused)
    await expect(executeInRoom(base.owner.caller, acceptedDeclaration)).resolves.toEqual({
      ...pendingInitiative,
      projection: pendingIncoming.projection
    })
    await expect(executeInRoom(base.owner.caller, start)).resolves.toEqual({
      ...pendingDeclaration,
      projection: pendingIncoming.projection
    })
    expect(await stored(base)).toEqual(paused)
    await expect(
      base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).rejects.toThrow('Encounter is unavailable.')
    const settled = await executeInRoom(
      base.owner.caller,
      diceResponse(base.run.id, pendingIncoming)
    )
    expect(settled.occurrence?.status).toBe('COMPLETE')
    expect(
      encounterGmProjectionDtoSchema.parse(settled.projection).actors[0]!.currentHitPoints
    ).toBe(base.run.actors[0]!.currentHitPoints - 1)
    const terminal = await stored(base)
    expect(terminal.effects).toEqual([])
    await expect(executeInRoom(base.owner.caller, acceptedDeclaration)).resolves.toEqual({
      ...pendingInitiative,
      projection: settled.projection
    })
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('START rolls incoming effects, updates and expires their lifecycles, and exactly replays without writes or dice', async () => {
    const base = await roomFixture('AUTO_ROLL')
    const tick = await seedEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 2,
      damage: 1
    })
    const expire = await seedEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 2
    })
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    // Every d20 lands on 1, so both saves fail. The START batch receipt's executions (lifecycle
    // UPDATE/EXPIRE, raw faces, stage, createdOrdinal order) stay in the room (D85): the effect
    // rows and hit points below show the outcome (execution shape: encounterTurnEffects.test.ts).
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 1 })
    const result = await executeInRoom(base.owner.caller, start)
    expect(result).toMatchObject({
      projection: {
        status: 'ACTIVE',
        round: 1,
        version: base.run.version + 1,
        currentActorId: base.run.actors[0]!.id
      },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    expect(
      encounterGmProjectionDtoSchema.parse(result.projection).actors[0]!.currentHitPoints
    ).toBe(base.run.actors[0]!.currentHitPoints - 3)
    const terminal = await stored(base)
    expect(terminal.effects).toEqual([
      expect.objectContaining({
        id: tick.id,
        version: 2,
        lifecycle: { schemaVersion: 1, remainingTicks: 1 }
      })
    ])
    expect(terminal.effects.map((row) => row.id)).not.toContain(expire.id)
    expect(terminal.occurrences).toHaveLength(1)
    // A retry returns the applied result without rolling or writing again (D88).
    await expect(executeInRoom(base.owner.caller, start)).resolves.toEqual(result)
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('ADVANCE_TURN applies outgoing then incoming effects to the same actor across the round boundary', async () => {
    const base = await roomFixture('AUTO_ROLL')
    const started = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const outgoing = await seedEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 2
    })
    const incoming = await seedEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 2,
      damage: 1
    })
    const advance: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    }
    const result = await executeInRoom(base.owner.caller, advance)
    const hp = encounterGmProjectionDtoSchema.parse(started.projection).actors[0]!.currentHitPoints
    expect(result).toMatchObject({
      projection: {
        round: 2,
        version: started.projection.version + 1,
        currentActorId: base.run.actors[0]!.id
      },
      occurrence: { status: 'COMPLETE' }
    })
    expect(
      encounterGmProjectionDtoSchema.parse(result.projection).actors[0]!.currentHitPoints
    ).toBe(hp - 3)
    const terminal = await stored(base)
    // The TURN_LIFECYCLE_COMPLETE receipt's outgoing and incoming executions (stage order and each
    // target transition, hp to hp - 2 to hp - 3) stay in the room (D85); the effect rows and the
    // final hit points show the outcome (execution shape: encounterTurnEffects.test.ts).
    expect(terminal.effects.map((row) => row.id)).not.toContain(outgoing.id)
    expect(terminal.effects).toEqual([
      expect.objectContaining({
        id: incoming.id,
        version: 2,
        lifecycle: { schemaVersion: 1, remainingTicks: 1 }
      })
    ])
    expect(terminal.rounds.map((round) => round.round)).toEqual([1, 2])
    await expect(executeInRoom(base.owner.caller, advance)).resolves.toEqual(result)
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('retains outgoing effects through initiative, Recharge, and incoming dice; only terminal completion publishes the whole turn', async () => {
    const base = await roomFixture('PROMPT')
    const starting = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const started = await resolveInitiative(base, starting)
    expect(started.occurrence?.status).toBe('COMPLETE')
    const spent = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADJUST_FEATURE_RESOURCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version,
        actorId: base.run.actors[0]!.id,
        featureId: automaticChargedBiteFeatureId,
        direction: 'USE',
        amount: 1
      }
    })
    const outgoing = await seedEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 2
    })
    const incoming = await seedEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const advance: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: spent.projection.version
      }
    }
    const before = await stored(base)
    const pendingOutgoing = await executeInRoom(base.owner.caller, advance)
    unchangedMechanics(before, await pendingEffect(base, outgoing.id, 'END_OF_TURN'))
    const outgoingResponse = diceResponse(base.run.id, pendingOutgoing)
    const pendingInitiative = await executeInRoom(base.owner.caller, outgoingResponse)
    expect(pendingInitiative.occurrence?.pending?.kind).toBe('INITIATIVE_EVIDENCE')
    unchangedMechanics(before, await stored(base))
    await expect(executeInRoom(base.owner.caller, outgoingResponse)).resolves.toEqual(
      pendingInitiative
    )
    const retainedInitiative = await stored(base)
    await expect(
      executeInRoom(base.owner.caller, {
        command: { ...outgoingResponse.command, correlationId: crypto.randomUUID() }
      })
    ).rejects.toThrow(RoomCommandRefusal)
    expect(await stored(base)).toEqual(retainedInitiative)
    const pendingRecharge = await resolveInitiative(base, pendingInitiative)
    const recharge = pendingRecharge.occurrence?.pending
    if (!recharge || recharge.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected Recharge between initiative and incoming effects.')
    unchangedMechanics(before, await stored(base))
    const rechargeResponse = response(base.run.id, pendingRecharge, {
      kind: 'ENTER_INTEGER',
      requestId: recharge.request.requestId,
      value: 5
    })
    const pendingIncoming = await executeInRoom(base.owner.caller, rechargeResponse)
    unchangedMechanics(before, await pendingEffect(base, incoming.id, 'START_OF_TURN'))
    expect(
      await base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toBeNull()
    expect(
      await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toEqual(pendingIncoming.occurrence!.pending)
    // The app roll lands on 1, so the incoming save fails. The terminal receipt's executions (stage
    // order, raw faces) and rechargeExecutions (rawDie 5, recharged) stay in the room (D85): the
    // effect rows and the published Feature charges show the outcome (execution shape:
    // encounterTurnEffects.test.ts and encounterRecharge.test.ts).
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 1 })
    const terminalResponse = await appRollResponse(base, pendingIncoming)
    const result = await executeInRoom(base.owner.caller, terminalResponse)
    expect(result).toMatchObject({
      projection: { round: 2, version: spent.projection.version + 1 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    const terminal = await stored(base)
    const actor = readStoredRunActor(terminal.actors[0]!)
    if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character fixture actor.')
    expect(actor.currentHitPoints).toBe(
      encounterGmProjectionDtoSchema.parse(spent.projection).actors[0]!.currentHitPoints - 3
    )
    expect(actor.resources).toMatchObject({
      featureCharges: { [automaticChargedBiteFeatureId]: 0 }
    })
    expect(terminal.effects).toEqual([])
    expect(terminal.rounds.map((round) => round.round)).toEqual([1, 2])
    // A retry of either command returns the applied result without writing again (D88).
    await expect(executeInRoom(base.owner.caller, terminalResponse)).resolves.toEqual(result)
    await expect(executeInRoom(base.owner.caller, advance)).resolves.toEqual({
      ...pendingOutgoing,
      projection: result.projection
    })
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('START retains the first effect while the second awaits dice and rejects stale retained lifecycle without writes', async () => {
    const base = await roomFixture('PROMPT')
    const first = await seedEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 2,
      damage: 1
    })
    const second = await seedEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const before = await stored(base)
    const start = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const pendingFirst = await resolveInitiative(base, start)
    const firstResponse = diceResponse(base.run.id, pendingFirst)
    const pendingSecond = await executeInRoom(base.owner.caller, firstResponse)
    const paused = await pendingEffect(base, second.id, 'START_OF_TURN')
    unchangedMechanics(before, paused)
    await expect(executeInRoom(base.owner.caller, firstResponse)).resolves.toEqual(pendingSecond)
    expect(await stored(base)).toEqual(paused)
    await closeRoom(base.campaign.id)
    await base.t.run((ctx) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).updateLifecycleCas({
        id: first.id,
        owner: first.owner,
        expectedVersion: first.version,
        lifecycle: { schemaVersion: 1, remainingTicks: 1 }
      })
    )
    // The app roll commits through the room's checkpoint ledger, so capture after it.
    const final = await appRollResponse(base, pendingSecond)
    const stale = await stored(base)
    await expect(executeInRoom(base.owner.caller, final)).rejects.toThrow()
    expect(await stored(base)).toEqual(stale)
  }, 30000)

  it('rejects player evidence, wrong requests, stale target/source and rolls back an induced terminal failure', async () => {
    const base = await roomFixture('PROMPT')
    const effect = await seedEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const start = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const pending = await resolveInitiative(base, start)
    const final = diceResponse(base.run.id, pending)
    const before = await stored(base)
    await expect(
      base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).rejects.toThrow('Encounter is unavailable.')
    await expect(executeInRoom(base.other.caller, final)).rejects.toThrow()
    const wrongRequest: EncounterExecuteInput = {
      command: {
        ...final.command,
        commandId: crypto.randomUUID(),
        resolution: {
          kind: 'ENTER_DICE',
          requestId: crypto.randomUUID(),
          rawFaces: [1],
          rollMode: 'NORMAL'
        }
      }
    }
    await expect(executeInRoom(base.owner.caller, wrongRequest)).rejects.toThrow()
    expect(await stored(base)).toEqual(before)
    const actorRow = before.actors[0]!
    const actor = readStoredRunActor(actorRow)
    if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character fixture actor.')
    await closeRoom(base.campaign.id)
    const alteredActor = {
      ...actor,
      currentHitPoints: actor.currentHitPoints - 1
    }
    await base.t.run((ctx) =>
      ctx.db.patch(actorRow._id, {
        stateJson: JSON.stringify(alteredActor),
        stateChecksum: checksumCanonicalJson(runActorPlayState(alteredActor))
      })
    )
    const staleTarget = await stored(base)
    await expect(executeInRoom(base.owner.caller, final)).rejects.toThrow()
    expect(await stored(base)).toEqual(staleTarget)
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      await ctx.db.patch(actorRow._id, {
        stateJson: actorRow.stateJson,
        stateChecksum: actorRow.stateChecksum
      })
      const row = await ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_publicId', (q) => q.eq('id', effect.id))
        .unique()
      if (!row) throw new Error('Missing source effect.')
      const definition = activeRuleEffectDefinitionDtoSchema.parse(JSON.parse(row.definitionJson))
      const changed = {
        ...definition,
        frozenGraph: {
          ...definition.frozenGraph,
          source: {
            ...definition.frozenGraph.source,
            checksum: 'f'.repeat(64)
          }
        }
      }
      await ctx.db.patch(row._id, {
        definitionJson: JSON.stringify(changed),
        definitionChecksum: checksumCanonicalJson(changed)
      })
    })
    const staleSource = await stored(base)
    await expect(executeInRoom(base.owner.caller, final)).rejects.toThrow()
    expect(await stored(base)).toEqual(staleSource)
  }, 30000)
})
