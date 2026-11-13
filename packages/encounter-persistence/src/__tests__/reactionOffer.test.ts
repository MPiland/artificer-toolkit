import { describe, expect, it } from 'vitest'
import {
  reactionOfferCommandId,
  reactionOfferOccurrenceId,
  systemTriggerCommandId,
  systemTriggerReactionCommand
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  TIMESTAMP,
  characterActor,
  creatureActor,
  srdCondition,
  srdDefinitions,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  resolveRuleOccurrenceInputDtoSchema,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  encounterInitiativeParticipantDtoSchema,
  encounterInitiativeRoundDtoSchema
} from '@artificer-toolkit/schema/shared/initiativeState'
import { serverAggregateChoicePendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { reactionOfferOptionId } from '@artificer-toolkit/schema/shared/ruleExecutionReactionOffer'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { revertLastEncounterAction } from '../actionRevert.js'
import { revertGroupRoots } from '../actionRevertGroups.js'
import { deleteRunActor, insertRunActor, readRunState, writeRunActor } from '../documents.js'
import { removeFinishedRunRowsPage } from '../finishedRunRows.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { readNativeEncounterOccurrenceOwner } from '../occurrenceOwner.js'
import { classifyRuleOccurrenceVoid } from '../occurrenceVoid.js'
import { readPendingSnapshot, writePendingSnapshot } from '../pendingSnapshots.js'
import {
  readReactionOfferChild,
  releaseReactionChildParent,
  repinReactionChildParent,
  suspendReactionChildParent
} from '../reactionChildren.js'
import {
  projectReactionOfferPending,
  queueReactionOffer,
  raiseQueuedReactionOffer,
  voidQueuedReactionOffers
} from '../reactionOffer.js'
import { persistReactionOfferAnswer } from '../reactionOfferAnswer.js'
import type { EncounterDocument } from '../store.js'
import { requireSystemTriggerAdmission } from '../systemTriggerAdmission.js'

const ATTACKER_ID = testUuid(0x8e01)
const TARGET_ID = testUuid(0x8e02)
const REACTOR_ID = testUuid(0x8e03)
const GM_ID = testUuid(0x8e04)
const PLAYER_ID = testUuid(0x8e05)
const ATTACK_COMMAND_ID = testUuid(0x8e06)
const ATTACK_OCCURRENCE_ID = testUuid(0x8e07)
const ANSWER_COMMAND_ID = testUuid(0x8e08)
const UNCOMMITTED_COMMAND_ID = testUuid(0x8e09)
const CHOSEN_ACTION_ID = 'feature:giant-killer:longsword'
const OTHER_ACTION_ID = 'feature:giant-killer:handaxe'
const REACTION_DEFINITION_ID = testUuid(0x8e0e)
const LATER_ATTACK_COMMAND_ID = testUuid(0x8e0f)
const LATER_ATTACK_OCCURRENCE_ID = testUuid(0x8e10)
const LATER_TIMESTAMP = new Date(Date.parse(TIMESTAMP) + 1000).toISOString()
const OFFER_ID = reactionOfferOccurrenceId(ATTACK_COMMAND_ID, REACTOR_ID)
const TARGET_OFFER_ID = reactionOfferOccurrenceId(ATTACK_COMMAND_ID, TARGET_ID)
const actionLabel = (actionId: string) => `Label of ${actionId}`
/** The Run version the attack produced, which the offer is raised on. */
const ATTACK_VERSION = 4
/** The Run version the offer's answer produces, the only one its chosen reaction runs on. */
const ANSWER_VERSION = ATTACK_VERSION + 1
const checksum = (letter: string) => letter.repeat(64)

const attack = {
  type: 'RESOLVE_ACTION',
  acceptedWieldConflict: null,
  acknowledgedWarnings: [],
  encounterId: ENCOUNTER_ID,
  expectedVersion: ATTACK_VERSION - 1,
  commandId: ATTACK_COMMAND_ID,
  actorId: ATTACKER_ID,
  target: { kind: 'ACTOR', actorId: TARGET_ID },
  actionId: 'creature-ogre:greatclub',
  sceneContext: null
} satisfies ResolveEncounterActionInputDto

/** The offer a committed attack plans for one reactor: that reactor's own actions against the attacker. */
const offer = (
  input: {
    parentCommandId?: string
    parentOccurrenceId?: string
    reactorActorId?: string
    attackerActorId?: string
    actionIds?: string[]
  } = {}
) => {
  const parentCommandId = input.parentCommandId ?? ATTACK_COMMAND_ID
  const reactorActorId = input.reactorActorId ?? REACTOR_ID
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    snapshotKind: 'AGGREGATE_CHOICE',
    schemaVersion: 1,
    occurrenceId: reactionOfferOccurrenceId(parentCommandId, reactorActorId),
    applicationContext: {
      kind: 'ENCOUNTER_REACTION_OFFER',
      schemaVersion: 1,
      parentCommandId,
      parentOccurrenceId: input.parentOccurrenceId ?? ATTACK_OCCURRENCE_ID,
      reactorActorId,
      attackerActorId: input.attackerActorId ?? ATTACKER_ID,
      reactionAllowance: { definitionId: REACTION_DEFINITION_ID, beforeUsed: 0 },
      options: (input.actionIds ?? [CHOSEN_ACTION_ID, OTHER_ACTION_ID]).map((actionId) => ({
        optionId: reactionOfferOptionId({ parentCommandId, reactorActorId, actionId }),
        actionId,
        label: actionLabel(actionId)
      }))
    }
  })
}

const chosenOptionId = reactionOfferOptionId({
  parentCommandId: ATTACK_COMMAND_ID,
  reactorActorId: REACTOR_ID,
  actionId: CHOSEN_ACTION_ID
})

const answer = (
  resolution: ResolveRuleOccurrenceInputDto['resolution'],
  overrides: Partial<ResolveRuleOccurrenceInputDto> = {}
) =>
  resolveRuleOccurrenceInputDtoSchema.parse({
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: ENCOUNTER_ID,
    expectedVersion: ATTACK_VERSION,
    commandId: ANSWER_COMMAND_ID,
    occurrenceId: OFFER_ID,
    expectedOccurrenceVersion: 0,
    resolution,
    ...overrides
  })

const option = answer({ kind: 'OPTION', optionId: chosenOptionId })
const decline = answer({ kind: 'DECLINE' })

/** The chosen reaction's own action, as the room raises it once the offer has settled. */
const reactionChild = (
  input: {
    expectedVersion?: number
    holderActorId?: string
    actionId?: string
    targetActorId?: string
  } = {}
) =>
  systemTriggerReactionCommand({
    encounterId: ENCOUNTER_ID,
    expectedVersion: input.expectedVersion ?? ANSWER_VERSION,
    parentCommandId: ATTACK_COMMAND_ID,
    holderActorId: input.holderActorId ?? REACTOR_ID,
    actionId: input.actionId ?? CHOSEN_ACTION_ID,
    targetActorId: input.targetActorId ?? ATTACKER_ID,
    sceneContext: null
  })

const link = {
  campaignId: CAMPAIGN_ID,
  encounterId: ENCOUNTER_ID,
  parentCommandId: ATTACK_COMMAND_ID,
  childCommandId: reactionChild().commandId,
  reactorActorId: REACTOR_ID,
  actorUserId: GM_ID
}

/**
 * A Run whose attack on the target has committed at `ATTACK_VERSION`; nothing is pending. It is a
 * Manual Run, which tracks no action allowance, unless `automationMode` says otherwise.
 */
async function settledAttack(
  input: {
    reactor?: ReturnType<typeof creatureActor>
    automationMode?: 'ASSISTED' | 'MANUAL'
  } = {}
) {
  const memory = createMemoryEncounterStore()
  const actors = [
    creatureActor({ id: ATTACKER_ID, snapshot: {} }),
    creatureActor({ id: TARGET_ID, snapshot: {}, disposition: 'FRIENDLY' }),
    input.reactor ?? creatureActor({ id: REACTOR_ID, snapshot: {}, disposition: 'FRIENDLY' })
  ]
  const state = srdEncounterState({
    actors,
    currentActorId: ATTACKER_ID,
    version: ATTACK_VERSION,
    automationMode: input.automationMode ?? 'MANUAL'
  })
  const campaign = {
    id: CAMPAIGN_ID,
    ownerUserId: GM_ID,
    status: 'ACTIVE',
    gameSystemId: state.gameSystemId
  }
  let userId = GM_ID
  const readCtx = {
    db: memory.store,
    ports: {
      readCharacterPlay: (): never => {
        throw new Error('No Character is in this Run.')
      }
    }
  }
  // Only the platform is faked: who is signed in and their Campaign membership.
  const ctx = {
    db: memory.store,
    ports: {
      ...readCtx.ports,
      requireIdentity: async () => ({ userId }),
      requireCampaignAuthority: async (_campaignId: string, memberId: string) => ({
        campaign,
        membership: {
          campaignId: CAMPAIGN_ID,
          userId: memberId,
          role: memberId === GM_ID ? 'OWNER' : 'PLAYER',
          status: 'ACTIVE'
        }
      }),
      readAssignedCharacter: async () => null,
      readCurrentDefinition: (definitionId: string) => srdDefinitions.requireCurrent(definitionId)
    }
  } as unknown as Parameters<typeof persistReactionOfferAnswer>[0] &
    Parameters<typeof raiseQueuedReactionOffer>[0] &
    Parameters<typeof revertLastEncounterAction>[0]
  memory.load(
    'campaigns',
    [
      { _id: 'campaign', _creationTime: 1, ...campaign }
    ] as unknown as EncounterDocument<'campaigns'>[],
    { validate: false }
  )
  await memory.store.insert('encounterRuns', {
    id: state.id,
    campaignId: state.campaignId,
    gameSystemId: state.gameSystemId,
    status: state.status,
    version: state.version,
    stateJson: JSON.stringify(state),
    stateChecksum: checksumCanonicalJson(state),
    createCommandId: testUuid(0x8e0a),
    createCommandFingerprint: checksum('b'),
    concentrationCasterCharacterIds: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
  for (const actor of actors) await insertRunActor(ctx, actor)
  // A manual-order round, the attacker acting.
  await memory.store.insert(
    'encounterInitiativeRounds',
    encounterInitiativeRoundDtoSchema.parse({
      encounterId: ENCOUNTER_ID,
      round: 1,
      procedure: 'MANUAL',
      cadence: 'ENCOUNTER_START',
      status: 'ACTIVE',
      policySnapshotChecksum: null,
      nextTurnOrderOrdinal: actors.length,
      version: 0,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP
    })
  )
  for (const [index, actor] of actors.entries())
    await memory.store.insert(
      'encounterInitiativeParticipants',
      encounterInitiativeParticipantDtoSchema.parse({
        encounterId: ENCOUNTER_ID,
        round: 1,
        actorId: actor.id,
        sideId: actor.sideId,
        status: index === 0 ? 'ACTIVE' : 'READY',
        initiativeScore: null,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: index,
        version: 0,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP
      })
    )
  const insertSettledOccurrence = async (id: string, rootCommandId: string) =>
    memory.store.insert(
      'encounterRuleOccurrences',
      encounterStoredRuleOccurrenceSchema.parse({
        id,
        campaignId: CAMPAIGN_ID,
        encounterId: ENCOUNTER_ID,
        rootCommandId,
        state: 'COMPLETED',
        version: 1,
        expectedEncounterVersion: ATTACK_VERSION,
        pendingSnapshotChecksum: await writePendingSnapshot(
          ctx,
          { id, encounterId: ENCOUNTER_ID },
          null
        ),
        completedAt: TIMESTAMP,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP
      })
    )
  await insertSettledOccurrence(ATTACK_OCCURRENCE_ID, ATTACK_COMMAND_ID)
  const insertCommittedAction = (
    command: ResolveEncounterActionInputDto,
    version: number,
    ruleOccurrenceId: string
  ) =>
    memory.store.insert(
      'encounterRunCommands',
      encounterStoredRunCommandSchema.parse({
        id: crypto.randomUUID(),
        campaignId: CAMPAIGN_ID,
        encounterId: ENCOUNTER_ID,
        commandId: command.commandId,
        commandType: 'RESOLVE_ACTION',
        root: {
          kind: 'RULE_OCCURRENCE',
          ruleOccurrenceId,
          ruleResultChecksum: checksum('d'),
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        },
        label: null,
        ruleOverrides: [],
        consumedGrants: [],
        endedMaintainedStates: [],
        addedConcentrationCasterId: null,
        speedBonusTurn: null,
        commandFingerprint: checksumCanonicalJson(command),
        actorUserId: GM_ID,
        version,
        commandJson: JSON.stringify(command),
        replayReceiptJson: '{}',
        replayReceiptChecksum: checksum('e'),
        createdAt: TIMESTAMP
      })
    )
  await insertCommittedAction(attack, ATTACK_VERSION, ATTACK_OCCURRENCE_ID)
  const run = () => memory.documents('encounterRuns')[0]!
  const occurrence = (id = OFFER_ID) =>
    memory.documents('encounterRuleOccurrences').find((row) => row.id === id)!
  const queue = (snapshot = offer(), now = TIMESTAMP) =>
    queueReactionOffer(ctx, readRunState(run()), snapshot, now)
  const raiseNext = () => raiseQueuedReactionOffer(ctx, ENCOUNTER_ID, TIMESTAMP)
  const actorRow = (actorId: string) =>
    memory.documents('encounterRunActors').find((row) => row.id === actorId)!
  return {
    memory,
    ctx,
    run,
    occurrence,
    insertCommittedAction,
    insertSettledOccurrence,
    /** The attack's commit stores the offer it planned. */
    queue,
    /** The room raises the Run's next queued offer once the Run waits on nothing. */
    raiseNext,
    /** An attack's offer, queued by its commit and then raised by the room. */
    raise: async (snapshot = offer()) => {
      await queue(snapshot)
      await raiseNext()
    },
    /** A later command changes one actor's committed state. */
    changeActor: (
      actorId: string,
      change: (actor: (typeof actors)[number]) => (typeof actors)[number]
    ) =>
      writeRunActor(
        ctx,
        actorRow(actorId)._id,
        change(actors.find((actor) => actor.id === actorId)!)
      ),
    /** A later command removes one actor from the Run. */
    removeActor: async (actorId: string) => {
      await deleteRunActor(ctx, actorRow(actorId))
      const state = readRunState(run())
      const next = { ...state, actorIds: state.actorIds.filter((id) => id !== actorId) }
      await memory.store.patch(run()._id, {
        stateJson: JSON.stringify(next),
        stateChecksum: checksumCanonicalJson(next)
      })
    },
    respond: (response: ResolveRuleOccurrenceInputDto, as = GM_ID) => {
      userId = as
      return persistReactionOfferAnswer(ctx, { response, occurredAt: TIMESTAMP })
    },
    /** What the offer's one receipt recorded. */
    recorded: () => {
      const [receipt] = memory.documents('encounterRuleReceipts')
      const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt!.resultJson))
      return 'applicationOutputs' in result ? result.applicationOutputs : null
    },
    admit: (command: ReturnType<typeof reactionChild>, fresh = true) =>
      requireSystemTriggerAdmission(readCtx, {
        run: run(),
        state: readRunState(run()),
        command: { ...command, systemTrigger: command.systemTrigger! },
        fresh
      }),
    /** The Run's commands, latest first, as undo reads them. */
    recentCommands: () =>
      memory.store
        .query('encounterRunCommands')
        .withIndex('by_encounterId_version', (q) => q.eq('encounterId', ENCOUNTER_ID))
        .order('desc')
        .take(8),
    /** The GM undoes the Run's last action. */
    undo: () =>
      revertLastEncounterAction(
        ctx,
        {
          type: 'REVERT_LAST_ACTION',
          encounterId: ENCOUNTER_ID,
          commandId: testUuid(0x8e13),
          expectedVersion: run().version
        },
        GM_ID
      ),
    /** Another command moves the Run on by one version. */
    moveRun: async () => {
      const next = { ...readRunState(run()), version: run().version + 1 }
      await memory.store.patch(run()._id, {
        version: next.version,
        stateJson: JSON.stringify(next),
        stateChecksum: checksumCanonicalJson(next)
      })
    }
  }
}

describe('raising the reaction offer of a committed attack (D219)', () => {
  it('raises it as the Run’s pending decision, pinned to the Run the attack left', async () => {
    const { ctx, raise, run, occurrence } = await settledAttack()
    await raise()
    expect(occurrence()).toMatchObject({
      id: OFFER_ID,
      rootCommandId: reactionOfferCommandId(OFFER_ID),
      state: 'PENDING',
      version: 0,
      expectedEncounterVersion: ATTACK_VERSION
    })
    expect(await readNativeEncounterOccurrenceOwner(ctx, run(), OFFER_ID)).toBe('REACTION_OFFER')
    // The attack itself stays settled: the offer changes nothing it did.
    expect(occurrence(ATTACK_OCCURRENCE_ID).state).toBe('COMPLETED')
    expect(run().version).toBe(ATTACK_VERSION)
  })

  it('offers a reactor once per attack: the offer is the one derived from the two', async () => {
    const { raise } = await settledAttack()
    await raise()
    await expect(raise()).rejects.toThrow('The attack already offered this reaction.')
    await expect(raise({ ...offer(), occurrenceId: testUuid(0x8e0b) })).rejects.toThrow(
      'Reaction offer scope mismatch.'
    )
  })

  it('refuses an offer for a command that settled no attack in this Run', async () => {
    const { raise } = await settledAttack()
    await expect(raise(offer({ parentCommandId: UNCOMMITTED_COMMAND_ID }))).rejects.toThrow(
      'A reaction offer answers a committed attack.'
    )
  })

  it('offers one reactor at a time: nothing is raised while the Run waits on a decision', async () => {
    const { raise, queue, raiseNext, occurrence } = await settledAttack()
    await raise()
    await queue(offer({ reactorActorId: TARGET_ID }))
    expect(await raiseNext()).toBe(false)
    expect(occurrence(TARGET_OFFER_ID).state).toBe('QUEUED')
    expect(occurrence().state).toBe('PENDING')
  })

  it('is voided by the GM as a decline', async () => {
    expect(classifyRuleOccurrenceVoid(offer().applicationContext)).toEqual({
      kind: 'DECLINE',
      resolution: { kind: 'DECLINE' }
    })
  })
})

describe('queueing the reaction offers of a committed attack (D219)', () => {
  it('stores the offer as queued: it is no pending decision until the room raises it', async () => {
    const { ctx, queue, run, occurrence, memory } = await settledAttack()
    await queue()
    expect(occurrence()).toMatchObject({
      id: OFFER_ID,
      rootCommandId: reactionOfferCommandId(OFFER_ID),
      state: 'QUEUED',
      version: 0,
      expectedEncounterVersion: ATTACK_VERSION,
      completedAt: null
    })
    expect((await readPendingSnapshot(ctx, occurrence()))?.applicationContext).toEqual(
      offer().applicationContext
    )
    expect(
      await memory.store
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) =>
          q.eq('encounterId', ENCOUNTER_ID).eq('state', 'PENDING')
        )
        .first()
    ).toBeNull()
    // A queued offer is shown to no one and takes no answer.
    expect(
      projectReactionOfferPending(
        occurrence(),
        (await readPendingSnapshot(ctx, occurrence()))!,
        new Set([REACTOR_ID])
      )
    ).toBeNull()
    expect(run().version).toBe(ATTACK_VERSION)
  })

  it('raises the earliest attack’s offers first, its reactors in actor order, one at a time', async () => {
    const { queue, raiseNext, respond, occurrence, insertSettledOccurrence } = await settledAttack()
    await insertSettledOccurrence(LATER_ATTACK_OCCURRENCE_ID, LATER_ATTACK_COMMAND_ID)
    const later = offer({
      parentCommandId: LATER_ATTACK_COMMAND_ID,
      parentOccurrenceId: LATER_ATTACK_OCCURRENCE_ID,
      reactorActorId: TARGET_ID
    })
    await queue(later, LATER_TIMESTAMP)
    await queue()
    await queue(offer({ reactorActorId: TARGET_ID }))
    const states = () =>
      [TARGET_OFFER_ID, OFFER_ID, later.occurrenceId].map((id) => occurrence(id).state)

    expect(await raiseNext()).toBe(true)
    expect(states()).toEqual(['PENDING', 'QUEUED', 'QUEUED'])
    expect(await raiseNext()).toBe(false)

    await respond(answer({ kind: 'DECLINE' }, { occurrenceId: TARGET_OFFER_ID }))
    expect(await raiseNext()).toBe(true)
    expect(states()).toEqual(['COMPLETED', 'PENDING', 'QUEUED'])
    // The next offer is pinned to the Run the first answer left.
    expect(occurrence()).toMatchObject({ version: 0, expectedEncounterVersion: ANSWER_VERSION })

    await respond(
      answer({ kind: 'DECLINE' }, { commandId: testUuid(0x8e11), expectedVersion: ANSWER_VERSION })
    )
    expect(await raiseNext()).toBe(true)
    expect(states()).toEqual(['COMPLETED', 'COMPLETED', 'PENDING'])
    expect(await raiseNext()).toBe(false)
  })

  it('raises nothing in a Run with no queued offer, or one that is not active', async () => {
    const { queue, raiseNext, run, occurrence, memory } = await settledAttack()
    expect(await raiseNext()).toBe(false)
    await queue()
    await memory.store.patch(run()._id, { status: 'COMPLETED' })
    expect(await raiseNext()).toBe(false)
    expect(occurrence().state).toBe('QUEUED')
  })

  it('voids the offer of a reactor that has used its reaction since the attack', async () => {
    const { queue, raiseNext, changeActor, occurrence, ctx } = await settledAttack()
    await queue()
    await changeActor(REACTOR_ID, (actor) => ({
      ...actor,
      resources: { ruleUsage: { [REACTION_DEFINITION_ID]: 1 } }
    }))
    expect(await raiseNext()).toBe(false)
    expect(occurrence()).toMatchObject({ state: 'VOIDED', version: 1, completedAt: TIMESTAMP })
    expect(await readPendingSnapshot(ctx, occurrence())).toBeNull()
  })

  it('voids the offer of a reactor at 0 hit points', async () => {
    const { queue, raiseNext, changeActor, occurrence } = await settledAttack()
    await queue()
    await changeActor(REACTOR_ID, (actor) => ({ ...actor, currentHitPoints: 0 }))
    expect(await raiseNext()).toBe(false)
    expect(occurrence().state).toBe('VOIDED')
  })

  it('voids the offer of a Character that has left the Campaign', async () => {
    // The Character's Run actor remains, with no Campaign assignment behind it.
    const { queue, raiseNext, occurrence } = await settledAttack({
      reactor: characterActor({ id: REACTOR_ID, characterId: testUuid(0x8e12) })
    })
    await queue()
    expect(await raiseNext()).toBe(false)
    expect(occurrence()).toMatchObject({ state: 'VOIDED', version: 1, completedAt: TIMESTAMP })
  })

  it('voids the offer of a reactor whose condition leaves it no reaction to take', async () => {
    const incapacitated = await settledAttack({
      automationMode: 'ASSISTED',
      reactor: creatureActor({
        id: REACTOR_ID,
        snapshot: {},
        disposition: 'FRIENDLY',
        conditions: [srdCondition('Incapacitated')]
      })
    })
    await incapacitated.queue()
    expect(await incapacitated.raiseNext()).toBe(false)
    expect(incapacitated.occurrence()).toMatchObject({ state: 'VOIDED', version: 1 })

    // The same Run raises the offer of a reactor that holds no such condition.
    const able = await settledAttack({ automationMode: 'ASSISTED' })
    await able.queue()
    expect(await able.raiseNext()).toBe(true)
    expect(able.occurrence().state).toBe('PENDING')
  })

  it('actor removal: voids the offer whose reactor or attacker has left the Run', async () => {
    const reactorGone = await settledAttack()
    await reactorGone.queue()
    await reactorGone.removeActor(REACTOR_ID)
    expect(await reactorGone.raiseNext()).toBe(false)
    expect(reactorGone.occurrence().state).toBe('VOIDED')

    const attackerGone = await settledAttack()
    await attackerGone.queue()
    await attackerGone.removeActor(ATTACKER_ID)
    expect(await attackerGone.raiseNext()).toBe(false)
    expect(attackerGone.occurrence().state).toBe('VOIDED')
  })

  it('passes over a voided offer to raise the next live one in the same step', async () => {
    const { queue, raiseNext, changeActor, occurrence } = await settledAttack()
    await queue()
    await queue(offer({ reactorActorId: TARGET_ID }))
    await changeActor(TARGET_ID, (actor) => ({ ...actor, currentHitPoints: 0 }))
    expect(await raiseNext()).toBe(true)
    expect(occurrence(TARGET_OFFER_ID).state).toBe('VOIDED')
    expect(occurrence().state).toBe('PENDING')
  })

  it('undo: voids the queued offers of the attacks it takes back, and no other attack’s', async () => {
    const { ctx, queue, raiseNext, occurrence, insertSettledOccurrence } = await settledAttack()
    await insertSettledOccurrence(LATER_ATTACK_OCCURRENCE_ID, LATER_ATTACK_COMMAND_ID)
    const later = offer({
      parentCommandId: LATER_ATTACK_COMMAND_ID,
      parentOccurrenceId: LATER_ATTACK_OCCURRENCE_ID
    })
    await queue()
    await queue(later, LATER_TIMESTAMP)
    await voidQueuedReactionOffers(
      ctx,
      ENCOUNTER_ID,
      new Set([LATER_ATTACK_COMMAND_ID]),
      LATER_TIMESTAMP
    )
    expect(occurrence(later.occurrenceId)).toMatchObject({
      state: 'VOIDED',
      version: 1,
      completedAt: LATER_TIMESTAMP
    })
    expect(occurrence().state).toBe('QUEUED')
    expect(await raiseNext()).toBe(true)
    expect(occurrence().state).toBe('PENDING')
  })

  it('void cascade: a queued or voided offer admits no reaction', async () => {
    const { ctx, queue, admit } = await settledAttack()
    await queue()
    await expect(admit(reactionChild({ expectedVersion: ATTACK_VERSION }))).rejects.toThrow(
      'COMMAND_ID_REUSED'
    )
    await voidQueuedReactionOffers(ctx, ENCOUNTER_ID, new Set([ATTACK_COMMAND_ID]), TIMESTAMP)
    await expect(admit(reactionChild({ expectedVersion: ATTACK_VERSION }))).rejects.toThrow(
      'COMMAND_ID_REUSED'
    )
    await expect(admit(reactionChild({ expectedVersion: ATTACK_VERSION }), false)).rejects.toThrow(
      'COMMAND_ID_REUSED'
    )
  })

  it('Run finish: a finished Run keeps no queued offer or its snapshot', async () => {
    const { ctx, queue, memory } = await settledAttack()
    await queue()
    await queue(offer({ reactorActorId: TARGET_ID }))
    let removed = false
    while (!removed) removed = await removeFinishedRunRowsPage(ctx, ENCOUNTER_ID, 16)
    expect(memory.documents('encounterRuleOccurrences')).toEqual([])
    expect(memory.documents('encounterPendingSnapshotParts')).toEqual([])
  })

  it('chain: a reaction’s own attack offers its target under an id of its own', async () => {
    const { queue, raiseNext, respond, occurrence, insertSettledOccurrence } = await settledAttack()
    await queue()
    await raiseNext()
    await respond(option)
    // The chosen reaction is an attack on the first attacker, who holds a reaction to it.
    const child = reactionChild()
    await insertSettledOccurrence(LATER_ATTACK_OCCURRENCE_ID, child.commandId)
    const chained = offer({
      parentCommandId: child.commandId,
      parentOccurrenceId: LATER_ATTACK_OCCURRENCE_ID,
      reactorActorId: ATTACKER_ID,
      attackerActorId: REACTOR_ID
    })
    expect(chained.occurrenceId).not.toBe(OFFER_ID)
    await queue(chained)
    await expect(queue(chained)).rejects.toThrow('The attack already offered this reaction.')
    expect(await raiseNext()).toBe(true)
    expect(occurrence(chained.occurrenceId).state).toBe('PENDING')
    expect(occurrence().state).toBe('COMPLETED')
  })
})

describe('showing a reaction offer (D219)', () => {
  const project = async (controlledActorIds: ReadonlySet<string>) => {
    const { ctx, raise, occurrence } = await settledAttack()
    await raise()
    const snapshot = await readPendingSnapshot(ctx, occurrence())
    return projectReactionOfferPending(occurrence(), snapshot!, controlledActorIds)
  }

  it('shows the reactor’s controller the options, with no time to answer by', async () => {
    const summary = await project(new Set([REACTOR_ID]))
    expect(summary).toEqual({
      kind: 'REACTION_OFFER',
      occurrenceId: OFFER_ID,
      occurrenceVersion: 0,
      encounterVersion: ATTACK_VERSION,
      reactorActorId: REACTOR_ID,
      attackerActorId: ATTACKER_ID,
      options: [CHOSEN_ACTION_ID, OTHER_ACTION_ID].map((actionId) => ({
        optionId: reactionOfferOptionId({
          parentCommandId: ATTACK_COMMAND_ID,
          reactorActorId: REACTOR_ID,
          actionId
        }),
        actionId,
        label: actionLabel(actionId)
      })),
      allowedResponses: ['DECLINE', 'OPTION']
    })
    expect(summary).not.toHaveProperty('answerBy')
  })

  it('shows it to no one else, and to the reactor’s controller whatever they see of the attacker', async () => {
    expect(await project(new Set([TARGET_ID]))).toBeNull()
    // What the viewer sees of the attacker is no input: the authored trigger alone hides an offer.
    expect(await project(new Set([REACTOR_ID]))).toMatchObject({
      kind: 'REACTION_OFFER',
      reactorActorId: REACTOR_ID
    })
    expect(await project(new Set([ATTACKER_ID, TARGET_ID, REACTOR_ID]))).toMatchObject({
      kind: 'REACTION_OFFER',
      reactorActorId: REACTOR_ID
    })
  })
})

describe('answering a reaction offer (D219)', () => {
  it('closes on a decline and records no reaction', async () => {
    const { raise, respond, run, occurrence, recorded, memory } = await settledAttack()
    await raise()
    const result = await respond(decline)
    expect(result.occurrence).toEqual({
      occurrenceId: OFFER_ID,
      occurrenceVersion: 1,
      status: 'COMPLETE',
      pending: null
    })
    expect(run().version).toBe(ANSWER_VERSION)
    expect(occurrence()).toMatchObject({
      state: 'COMPLETED',
      version: 1,
      expectedEncounterVersion: ANSWER_VERSION,
      completedAt: TIMESTAMP
    })
    expect(recorded()).toMatchObject({
      kind: 'REACTION_OFFER_ANSWER',
      parentCommandId: ATTACK_COMMAND_ID,
      parentOccurrenceId: ATTACK_OCCURRENCE_ID,
      reactorActorId: REACTOR_ID,
      attackerActorId: ATTACKER_ID,
      selectedOptionId: null,
      child: null
    })
    expect(
      memory.documents('encounterRunCommands').find((row) => row.commandId === ANSWER_COMMAND_ID)
    ).toMatchObject({
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      ruleOccurrenceId: OFFER_ID,
      version: ANSWER_VERSION
    })
  })

  it('closes on an option and records the one command that runs the chosen action', async () => {
    const { raise, respond, run, occurrence, recorded, memory } = await settledAttack()
    await raise()
    await respond(option)
    expect(run().version).toBe(ANSWER_VERSION)
    expect(occurrence().state).toBe('COMPLETED')
    expect(recorded()).toMatchObject({
      selectedOptionId: chosenOptionId,
      child: {
        commandId: systemTriggerCommandId(ATTACK_COMMAND_ID, REACTOR_ID, CHOSEN_ACTION_ID),
        actionId: CHOSEN_ACTION_ID
      }
    })
    // The answer changes no creature and leaves nothing pending.
    expect(
      memory.documents('encounterRuleOccurrences').filter((row) => row.state !== 'COMPLETED')
    ).toEqual([])
  })

  it('takes the answer of the reactor’s controller or the GM, and of no other player', async () => {
    const { raise, respond, occurrence } = await settledAttack()
    await raise()
    await expect(respond(decline, PLAYER_ID)).rejects.toThrow('Reaction offer is unavailable.')
    expect(occurrence().state).toBe('PENDING')
  })

  it('refuses an option the offer does not hold, and an answer on a stale version', async () => {
    const { raise, respond, occurrence } = await settledAttack()
    await raise()
    const unknown = reactionOfferOptionId({
      parentCommandId: ATTACK_COMMAND_ID,
      reactorActorId: REACTOR_ID,
      actionId: 'feature:other'
    })
    await expect(respond(answer({ kind: 'OPTION', optionId: unknown }))).rejects.toThrow(
      'Reaction offer option is unavailable.'
    )
    await expect(
      respond(answer({ kind: 'DECLINE' }, { expectedVersion: ATTACK_VERSION - 1 }))
    ).rejects.toThrow('VERSION_STALE')
    await expect(
      respond(answer({ kind: 'DECLINE' }, { expectedOccurrenceVersion: 1 }))
    ).rejects.toThrow('VERSION_STALE')
    expect(occurrence().state).toBe('PENDING')
  })

  it('replays a stored answer, and refuses another answer under its command id', async () => {
    const { raise, respond, run, memory } = await settledAttack()
    await raise()
    const first = await respond(option)
    expect(await respond(option)).toEqual(first)
    expect(run().version).toBe(ANSWER_VERSION)
    expect(memory.documents('encounterRuleReceipts')).toHaveLength(1)
    await expect(respond(decline)).rejects.toThrow('Stored reaction offer answer receipt mismatch.')
  })
})

describe('admitting the reaction chosen from a settled offer (D219)', () => {
  it('admits the recorded command against the attacker on the Run version the answer produced', async () => {
    const { raise, respond, admit } = await settledAttack()
    await raise()
    await respond(option)
    await expect(admit(reactionChild())).resolves.toBeUndefined()
  })

  it('admits nothing while the offer is still open', async () => {
    const { raise, admit } = await settledAttack()
    await raise()
    await expect(admit(reactionChild({ expectedVersion: ATTACK_VERSION }))).rejects.toThrow(
      'COMMAND_ID_REUSED'
    )
  })

  it('admits only the action chosen, for the reactor, against the attacker', async () => {
    const { raise, respond, admit } = await settledAttack()
    await raise()
    await respond(option)
    await expect(admit(reactionChild({ actionId: OTHER_ACTION_ID }))).rejects.toThrow(
      'COMMAND_ID_REUSED'
    )
    await expect(admit(reactionChild({ holderActorId: TARGET_ID }))).rejects.toThrow(
      'COMMAND_ID_REUSED'
    )
    await expect(admit(reactionChild({ targetActorId: TARGET_ID }))).rejects.toThrow(
      'COMMAND_ID_REUSED'
    )
  })

  it('replay fence: the record admits one run, and none once the Run has moved', async () => {
    const used = await settledAttack()
    await used.raise()
    await used.respond(option)
    // The reaction ran: its commit moved the Run on.
    await used.insertCommittedAction(reactionChild(), ANSWER_VERSION + 1, testUuid(0x8e0c))
    await used.moveRun()
    await expect(used.admit(reactionChild())).rejects.toThrow('VERSION_STALE')
    await expect(
      used.admit(reactionChild({ expectedVersion: ANSWER_VERSION + 1 }))
    ).rejects.toThrow('VERSION_STALE')
    // Its own retry is not a fresh run.
    await expect(used.admit(reactionChild(), false)).resolves.toBeUndefined()

    const moved = await settledAttack()
    await moved.raise()
    await moved.respond(option)
    await moved.moveRun()
    await expect(
      moved.admit(reactionChild({ expectedVersion: ANSWER_VERSION + 1 }))
    ).rejects.toThrow('VERSION_STALE')
  })

  it('void cascade: a declined or voided offer proves no reaction', async () => {
    // The GM's void of an open offer settles it as a decline.
    const declined = await settledAttack()
    await declined.raise()
    await declined.respond(decline)
    await expect(declined.admit(reactionChild())).rejects.toThrow('COMMAND_ID_REUSED')
    await expect(declined.admit(reactionChild(), false)).rejects.toThrow('COMMAND_ID_REUSED')

    // An offer voided after it recorded a choice no longer proves that choice.
    const voided = await settledAttack()
    await voided.raise()
    await voided.respond(option)
    await voided.memory.store.patch(voided.occurrence()._id, { state: 'VOIDED' })
    await expect(voided.admit(reactionChild())).rejects.toThrow('COMMAND_ID_REUSED')
    await expect(voided.admit(reactionChild(), false)).rejects.toThrow('COMMAND_ID_REUSED')
  })
})

describe('committing the reaction chosen from a settled offer (D219)', () => {
  it('holds, re-pins and releases no pending action: its attack has committed', async () => {
    const { ctx, raise, respond, memory } = await settledAttack()
    await raise()
    await respond(option)
    expect(await readReactionOfferChild(ctx, link)).toMatchObject({
      answer: { encounterVersion: ANSWER_VERSION },
      output: { attackerActorId: ATTACKER_ID }
    })
    const before = memory.documents('encounterRuleOccurrences')
    await suspendReactionChildParent(ctx, link)
    await repinReactionChildParent(ctx, { ...link, version: ANSWER_VERSION + 1 })
    await releaseReactionChildParent(ctx, { ...link, version: ANSWER_VERSION + 1 })
    expect(memory.documents('encounterRuleOccurrences')).toEqual(before)
  })

  it('still requires the pending action of a reaction no offer recorded', async () => {
    const { ctx, raise, respond } = await settledAttack()
    await raise()
    await respond(decline)
    expect(await readReactionOfferChild(ctx, link)).toBeNull()
    await expect(suspendReactionChildParent(ctx, link)).rejects.toThrow(
      'The reaction’s pending action is gone.'
    )
  })
})

describe('undoing an attack with the reaction chosen from its offer (D219)', () => {
  it('groups the reaction, then the attack with the offer’s answer as its own', async () => {
    const { raise, respond, insertCommittedAction, recentCommands, moveRun, undo } =
      await settledAttack()
    await raise()
    await respond(option)
    await insertCommittedAction(reactionChild(), ANSWER_VERSION + 1, testUuid(0x8e0c))
    await moveRun()
    const recent = await recentCommands()
    const { groupRoots } = revertGroupRoots(recent, 0)
    expect(groupRoots.map(({ root }) => root.commandId)).toEqual([
      reactionChild().commandId,
      ATTACK_COMMAND_ID
    ])
    const [child, parent] = groupRoots
    expect(child!.laterEntries).toEqual([])
    expect(parent!.laterEntries.map(({ commandId }) => commandId)).toEqual([ANSWER_COMMAND_ID])

    // This fixture keeps no receipt of either action's own outcome, so the undo ends there: past
    // the answer, which it reads as the attack's own child and not as another decision. The room
    // proves the whole undo with real receipts (nativeRoomResolvedReactionOffer.test.ts).
    await expect(undo()).rejects.toThrow('Stored Encounter action receipt is missing.')
  })

  it('reads a declined offer’s answer as the attack’s own too', async () => {
    const { raise, respond, recentCommands, undo } = await settledAttack()
    await raise()
    await respond(decline)
    const recent = await recentCommands()
    const { groupRoots } = revertGroupRoots(recent, 1)
    expect(groupRoots).toHaveLength(1)
    await expect(undo()).rejects.toThrow('Stored Encounter action receipt is missing.')
  })

  it('still refuses an attack followed by a decision that is not its own', async () => {
    const {
      queue,
      raiseNext,
      respond,
      insertSettledOccurrence,
      insertCommittedAction,
      moveRun,
      undo
    } = await settledAttack()
    await queue()
    // Another action commits before the first attack's offer is raised and answered.
    await insertSettledOccurrence(LATER_ATTACK_OCCURRENCE_ID, LATER_ATTACK_COMMAND_ID)
    await insertCommittedAction(
      { ...attack, commandId: LATER_ATTACK_COMMAND_ID, expectedVersion: ATTACK_VERSION },
      ATTACK_VERSION + 1,
      LATER_ATTACK_OCCURRENCE_ID
    )
    await moveRun()
    expect(await raiseNext()).toBe(true)
    await respond(answer({ kind: 'DECLINE' }, { expectedVersion: ATTACK_VERSION + 1 }))
    // The answer settles the first attack's offer, so it is no child of the last action.
    await expect(undo()).rejects.toThrow('Another decision changed the Encounter after this action')
  })
})
