import { describe, expect, it } from 'vitest'
import { buildEncounterCounteredCastStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { systemTriggerReactionCommand } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  TIMESTAMP,
  creatureActor,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readNativeActionPending } from '../actionPending.js'
import { insertRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { readPendingSnapshot, writePendingSnapshot } from '../pendingSnapshots.js'
import {
  awaitsReactionChild,
  countRunVoidVersions,
  reactionChildrenKept,
  readCommittedReactionChildren,
  readCommittedReactionDescendants,
  readReactionChildAncestors,
  readReactionChildCastLevel,
  readReactionChildParent,
  readTrailingReactionDescendants,
  releaseReactionChildParent,
  repinReactionChildParent,
  suspendReactionChildParent
} from '../reactionChildren.js'
import { readNativeEncounterActionResumeAdmission } from '../actionResumeAdmission.js'
import type { LiveSessionEncounterActionResume } from '@artificer-toolkit/schema/api/liveSessionCommandScopes'
import { requireSystemTriggerAdmission } from '../systemTriggerAdmission.js'

const ATTACKER_ID = testUuid(0x8a01)
const ALLY_ID = testUuid(0x8a02)
const PROTECTOR_ID = testUuid(0x8a03)
const USER_ID = testUuid(0x8a04)
const PARENT_COMMAND_ID = testUuid(0x8a05)
const OCCURRENCE_ID = testUuid(0x8a06)
const OTHER_ROOT_COMMAND_ID = testUuid(0x8a07)
const OTHER_ENCOUNTER_ID = testUuid(0x8a08)
const REACTION_ACTION_ID = 'feature:protection'
/** The Run version the attack was submitted on and paused at. */
const ROOT_VERSION = 4
const checksum = (letter: string) => letter.repeat(64)

const action = (
  input: Pick<ResolveEncounterActionInputDto, 'commandId' | 'actorId' | 'expectedVersion'>
) =>
  ({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: ENCOUNTER_ID,
    target: { kind: 'ACTOR', actorId: ALLY_ID },
    actionId: 'creature-bandit:scimitar',
    sceneContext: null,
    ...input
  }) satisfies ResolveEncounterActionInputDto

const parentCommand = action({
  commandId: PARENT_COMMAND_ID,
  actorId: ATTACKER_ID,
  expectedVersion: ROOT_VERSION
})

/** The reaction's own action, as the room raises it against the paused attack. */
const reactionChild = (expectedVersion = ROOT_VERSION, parentCommandId = PARENT_COMMAND_ID) =>
  systemTriggerReactionCommand({
    encounterId: ENCOUNTER_ID,
    expectedVersion,
    parentCommandId,
    holderActorId: PROTECTOR_ID,
    actionId: REACTION_ACTION_ID,
    targetActorId: ATTACKER_ID,
    sceneContext: null
  })

const link = {
  campaignId: CAMPAIGN_ID,
  encounterId: ENCOUNTER_ID,
  parentCommandId: PARENT_COMMAND_ID,
  childCommandId: reactionChild().commandId,
  reactorActorId: PROTECTOR_ID
}

/**
 * A Run at `ROOT_VERSION` whose attack on the ally is paused, its pending context recording
 * `reactionChildren`, the command ids of the reactions chosen against it.
 */
async function pausedAttack(
  input: {
    reactionChildren?: { commandId: string; rollMode?: 'DISADVANTAGE' }[]
    /** The level the paused action casts its spell at, when it casts one. */
    castLevel?: number
    /** The spell slot that cast spends, when it spends one. */
    castSlotKey?: string
    protectorDefeated?: boolean
  } = {}
) {
  const memory = createMemoryEncounterStore()
  const ctx = {
    db: memory.store,
    ports: {
      readCharacterPlay: (): never => {
        throw new Error('No Character is in this Run.')
      }
    }
  }
  const actors = [
    creatureActor({ id: ATTACKER_ID, snapshot: {} }),
    creatureActor({ id: ALLY_ID, snapshot: {}, disposition: 'FRIENDLY' }),
    creatureActor({
      id: PROTECTOR_ID,
      snapshot: {},
      disposition: 'FRIENDLY',
      ...(input.protectorDefeated && { currentHitPoints: 0, defeated: true })
    })
  ]
  const state = srdEncounterState({ actors, currentActorId: ATTACKER_ID, version: ROOT_VERSION })
  await memory.store.insert('encounterRuns', {
    id: state.id,
    campaignId: state.campaignId,
    gameSystemId: state.gameSystemId,
    status: state.status,
    version: state.version,
    stateJson: JSON.stringify(state),
    stateChecksum: checksumCanonicalJson(state),
    createCommandId: testUuid(0x8a09),
    createCommandFingerprint: checksum('b'),
    concentrationCasterCharacterIds: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
  for (const actor of actors) await insertRunActor(ctx, actor)
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    schemaVersion: 1,
    occurrenceId: OCCURRENCE_ID,
    graph: {
      schemaVersion: 1,
      source: {
        definitionId: testUuid(0x8a0a),
        gameSystemId: state.gameSystemId,
        definitionFamilyKey: 'effect.action',
        checksum: checksum('a')
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [
        {
          id: 'd20',
          operation: { key: 'evidence.integer-range', contractVersion: 1 },
          inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
        }
      ],
      outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' } }
    },
    facts: {},
    nextNodeIndex: 0,
    nodeOutputs: {},
    trace: [],
    request: {
      requestId: 'd20',
      kind: 'INTEGER_RANGE',
      nodeId: 'd20',
      ordinal: 0,
      min: 1,
      max: 20
    },
    authority: 'APPLICATION_SERVICE',
    redaction: 'SERVER_ONLY',
    applicationContext: {
      kind: 'ENCOUNTER_ACTION',
      schemaVersion: 1,
      commandJson: JSON.stringify(parentCommand),
      commandFingerprint: checksumCanonicalJson(parentCommand),
      initiatorUserId: USER_ID,
      rollerActorId: ATTACKER_ID,
      currentnessChecksum: checksum('c'),
      d20Policy: {
        requestNodeId: 'd20',
        rollMode: 'NORMAL',
        keep: 'FIRST',
        contributors: [],
        contributorChecksum: checksumRuleDocument([]),
        modifier: 0,
        dc: 10
      },
      twoPhase: null,
      ...(input.reactionChildren && { reactionChildren: input.reactionChildren }),
      ...(input.castLevel !== undefined && { castLevel: input.castLevel }),
      ...(input.castSlotKey !== undefined && { castSlotKey: input.castSlotKey })
    }
  })
  await memory.store.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      id: OCCURRENCE_ID,
      campaignId: CAMPAIGN_ID,
      encounterId: ENCOUNTER_ID,
      rootCommandId: PARENT_COMMAND_ID,
      state: 'PENDING',
      version: 1,
      expectedEncounterVersion: ROOT_VERSION,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: OCCURRENCE_ID, encounterId: ENCOUNTER_ID },
        snapshot
      ),
      completedAt: null,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP
    })
  )
  const occurrence = () => memory.documents('encounterRuleOccurrences')[0]!
  const admit = (command: ReturnType<typeof reactionChild>, fresh = true) =>
    requireSystemTriggerAdmission(ctx, {
      run: memory.documents('encounterRuns')[0]!,
      state,
      command: { ...command, systemTrigger: command.systemTrigger! },
      fresh
    })
  return { memory, ctx, state, occurrence, admit }
}

const recorded = { reactionChildren: [{ commandId: reactionChild().commandId }] }

const CHILD_OCCURRENCE_ID = testUuid(0x8a14)

/** The reaction the attacker chose against the protector's held reaction: a child of that child. */
const nestedChild = (expectedVersion = ROOT_VERSION) =>
  systemTriggerReactionCommand({
    encounterId: ENCOUNTER_ID,
    expectedVersion,
    parentCommandId: reactionChild().commandId,
    holderActorId: ATTACKER_ID,
    actionId: REACTION_ACTION_ID,
    targetActorId: PROTECTOR_ID,
    sceneContext: null
  })

const nestedLink = {
  campaignId: CAMPAIGN_ID,
  encounterId: ENCOUNTER_ID,
  parentCommandId: reactionChild().commandId,
  childCommandId: nestedChild().commandId,
  reactorActorId: ATTACKER_ID
}

const nested = { reactionChildren: [{ commandId: nestedChild().commandId }] }

/**
 * Holds the attack's recorded reaction child as the Run's pending decision, its own context
 * recording `reactionChildren`, and suspends the attack it answers. Returns the child's occurrence.
 */
async function holdReactionChild(
  paused: Awaited<ReturnType<typeof pausedAttack>>,
  reactionChildren?: { commandId: string }[]
) {
  const { ctx, memory, occurrence } = paused
  const { _id, _creationTime, ...root } = occurrence()
  const snapshot = await readPendingSnapshot(ctx, root)
  if (
    snapshot?.snapshotKind !== 'KERNEL_EVIDENCE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION'
  )
    throw new Error('The attack is not paused.')
  const command = reactionChild()
  const {
    reactionChildren: _recorded,
    castLevel: _castLevel,
    castSlotKey: _castSlotKey,
    ...context
  } = snapshot.applicationContext
  await memory.store.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      ...root,
      id: CHILD_OCCURRENCE_ID,
      rootCommandId: command.commandId,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: CHILD_OCCURRENCE_ID, encounterId: ENCOUNTER_ID },
        serverRuleExecutionPendingSnapshotDtoSchema.parse({
          ...snapshot,
          occurrenceId: CHILD_OCCURRENCE_ID,
          applicationContext: {
            ...context,
            commandJson: JSON.stringify(command),
            commandFingerprint: checksumCanonicalJson(command),
            rollerActorId: PROTECTOR_ID,
            ...(reactionChildren && { reactionChildren })
          }
        })
      )
    })
  )
  await suspendReactionChildParent(ctx, link)
  return () =>
    memory.documents('encounterRuleOccurrences').find(({ id }) => id === CHILD_OCCURRENCE_ID)!
}

/** A GM command the Run recorded at `version`. */
const insertGmCommand = (
  memory: ReturnType<typeof createMemoryEncounterStore>,
  version: number,
  command:
    | { commandType: 'VOID_RULE_OCCURRENCE'; ruleOccurrenceId: string }
    | { commandType: 'REVERT_LAST_ACTION'; revertedCommandId: string }
) =>
  memory.store.insert(
    'encounterRunCommands',
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: CAMPAIGN_ID,
      encounterId: ENCOUNTER_ID,
      commandId: crypto.randomUUID(),
      commandFingerprint: checksum('f'),
      actorUserId: USER_ID,
      version,
      commandJson: '{}',
      replayReceiptJson: '{}',
      replayReceiptChecksum: checksum('e'),
      createdAt: TIMESTAMP,
      ...(command.commandType === 'REVERT_LAST_ACTION'
        ? {
            ...command,
            ruleOccurrenceId: null,
            initiativeStateJson: null,
            initiativeStateChecksum: null
          }
        : command)
    })
  )

/** The GM's void of a paused action, recorded on the Run at `version`. */
const insertVoid = (
  memory: ReturnType<typeof createMemoryEncounterStore>,
  version: number,
  ruleOccurrenceId: string = crypto.randomUUID()
) => insertGmCommand(memory, version, { commandType: 'VOID_RULE_OCCURRENCE', ruleOccurrenceId })

async function insertCommittedAction(
  memory: ReturnType<typeof createMemoryEncounterStore>,
  state: ReturnType<typeof srdEncounterState>,
  command: ResolveEncounterActionInputDto,
  version: number
) {
  await memory.store.insert(
    'encounterRunCommands',
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: CAMPAIGN_ID,
      encounterId: ENCOUNTER_ID,
      commandId: command.commandId,
      commandType: 'RESOLVE_ACTION',
      root: {
        kind: 'RULE_OCCURRENCE',
        ruleOccurrenceId: crypto.randomUUID(),
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
      actorUserId: USER_ID,
      version,
      commandJson: JSON.stringify(command),
      replayReceiptJson: '{}',
      replayReceiptChecksum: checksum('e'),
      createdAt: TIMESTAMP
    })
  )
}

describe('the pending action a reaction child answers (D219)', () => {
  it('is the pending action whose context records the child command', async () => {
    const { ctx, occurrence } = await pausedAttack(recorded)
    expect(await readReactionChildParent(ctx, link)).toEqual(occurrence())
  })

  it('is none while the pending action records no child, or another one', async () => {
    const open = await pausedAttack()
    expect(await readReactionChildParent(open.ctx, link)).toBeNull()
    const other = await pausedAttack({ reactionChildren: [{ commandId: testUuid(0x8a0b) }] })
    expect(await readReactionChildParent(other.ctx, link)).toBeNull()
  })

  it('is none once the action is no longer pending, and none for another Run', async () => {
    const { ctx, memory, occurrence } = await pausedAttack(recorded)
    expect(
      await readReactionChildParent(ctx, { ...link, encounterId: OTHER_ENCOUNTER_ID })
    ).toBeNull()
    await memory.store.patch(occurrence()._id, {
      state: 'COMPLETED',
      completedAt: TIMESTAMP,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: OCCURRENCE_ID, encounterId: ENCOUNTER_ID },
        null
      )
    })
    expect(await readReactionChildParent(ctx, link)).toBeNull()
  })
})

describe('the cast a reaction child answers (QUALITY-9.T1b1, D219)', () => {
  it('is read at the level the pending action recorded beside the child', async () => {
    const { ctx } = await pausedAttack({ ...recorded, castLevel: 4 })
    expect(await readReactionChildCastLevel(ctx, link)).toBe(4)
    const cantrip = await pausedAttack({ ...recorded, castLevel: 0 })
    expect(await readReactionChildCastLevel(cantrip.ctx, link)).toBe(0)
  })

  it('still reads while the action is suspended for the child’s own evidence', async () => {
    const { ctx } = await pausedAttack({ ...recorded, castLevel: 4 })
    await suspendReactionChildParent(ctx, link)
    expect(await readReactionChildCastLevel(ctx, link)).toBe(4)
  })

  it('is none for an action that casts no spell, and for a child the action does not record', async () => {
    const attack = await pausedAttack(recorded)
    expect(await readReactionChildCastLevel(attack.ctx, link)).toBeNull()
    const other = await pausedAttack({
      reactionChildren: [{ commandId: testUuid(0x8a0b) }],
      castLevel: 4
    })
    expect(await readReactionChildCastLevel(other.ctx, link)).toBeNull()
  })

  it('refuses a cast level on a pending action that records no reaction child', async () => {
    await expect(pausedAttack({ castLevel: 4 })).rejects.toThrow(
      'Only an action that records a reaction child records its cast level.'
    )
  })

  it('never rewrites the level from one context to the next', () => {
    const child = { commandId: testUuid(0x8a10) }
    const waiting = { reactionChildren: [child], castLevel: 4 }
    const resumed = { reactionChildren: [{ ...child, rollMode: null }] }
    expect(reactionChildrenKept(waiting, { ...resumed, castLevel: 4 })).toBe(true)
    expect(reactionChildrenKept(waiting, { ...resumed, castLevel: 5 })).toBe(false)
    expect(reactionChildrenKept(waiting, resumed)).toBe(false)
    // The first child is recorded with the level; nothing was recorded before it.
    expect(reactionChildrenKept({}, waiting)).toBe(true)
  })
})

describe('admitting a reaction child (D219)', () => {
  it('admits the recorded child on the Run version the pending action is pinned to', async () => {
    const { admit } = await pausedAttack(recorded)
    await expect(admit(reactionChild())).resolves.toBeUndefined()
  })

  it('refuses a child the pending action does not record: an open offer admits nothing', async () => {
    const { admit } = await pausedAttack()
    await expect(admit(reactionChild())).rejects.toThrow('COMMAND_ID_REUSED')
  })

  it('refuses a recorded id that is not the one derived from the parent, holder and action', async () => {
    const commandId = testUuid(0x8a0c)
    const { admit } = await pausedAttack({ reactionChildren: [{ commandId }] })
    await expect(admit({ ...reactionChild(), commandId })).rejects.toThrow('COMMAND_ID_REUSED')
  })

  it('refuses a child raised by another root', async () => {
    const { admit } = await pausedAttack(recorded)
    await expect(admit(reactionChild(ROOT_VERSION, OTHER_ROOT_COMMAND_ID))).rejects.toThrow(
      'COMMAND_ID_REUSED'
    )
  })

  it('refuses a fresh child on any version but the pending action’s pin', async () => {
    const stale = await pausedAttack(recorded)
    await expect(stale.admit(reactionChild(ROOT_VERSION - 1))).rejects.toThrow('VERSION_STALE')
    const moved = await pausedAttack(recorded)
    await moved.memory.store.patch(moved.occurrence()._id, {
      expectedEncounterVersion: ROOT_VERSION + 1
    })
    await expect(moved.admit(reactionChild())).rejects.toThrow('VERSION_STALE')
  })

  it('refuses a fresh child of a holder that no longer stands', async () => {
    const { admit } = await pausedAttack({ ...recorded, protectorDefeated: true })
    await expect(admit(reactionChild())).rejects.toThrow('ACTOR_DEFEATED')
  })

  it('skips the version and holder tests for a child that is not fresh', async () => {
    const { admit } = await pausedAttack({ ...recorded, protectorDefeated: true })
    await expect(admit(reactionChild(ROOT_VERSION - 1), false)).resolves.toBeUndefined()
  })
})

describe('re-pinning the pending action to the Run its reaction child left (D219)', () => {
  it('moves the pin, and the pending action still reads as the same root', async () => {
    const { ctx, occurrence } = await pausedAttack(recorded)
    await repinReactionChildParent(ctx, { ...link, version: ROOT_VERSION + 1 })
    expect(occurrence().expectedEncounterVersion).toBe(ROOT_VERSION + 1)
    const pending = await readNativeActionPending(ctx, occurrence())
    expect(pending.command).toEqual(parentCommand)
    expect(pending.context.reactionChildren).toEqual(recorded.reactionChildren)
  })

  it('refuses to move a pending action that does not record the child', async () => {
    const { ctx, occurrence } = await pausedAttack()
    await expect(
      repinReactionChildParent(ctx, { ...link, version: ROOT_VERSION + 1 })
    ).rejects.toThrow('The reaction’s pending action is gone.')
    expect(occurrence().expectedEncounterVersion).toBe(ROOT_VERSION)
  })

  it('reads no pending action pinned further past its root than its recorded children', async () => {
    const one = await pausedAttack(recorded)
    await one.memory.store.patch(one.occurrence()._id, {
      expectedEncounterVersion: ROOT_VERSION + 2
    })
    await expect(readNativeActionPending(one.ctx, one.occurrence())).rejects.toThrow(
      'Stored Encounter action root mismatch.'
    )
    const none = await pausedAttack()
    await none.memory.store.patch(none.occurrence()._id, {
      expectedEncounterVersion: ROOT_VERSION + 1
    })
    await expect(readNativeActionPending(none.ctx, none.occurrence())).rejects.toThrow(
      'Stored Encounter action root mismatch.'
    )
    const behind = await pausedAttack(recorded)
    await behind.memory.store.patch(behind.occurrence()._id, {
      expectedEncounterVersion: ROOT_VERSION - 1
    })
    await expect(readNativeActionPending(behind.ctx, behind.occurrence())).rejects.toThrow(
      'Stored Encounter action root mismatch.'
    )
  })
})

describe('the reaction children a pending action keeps from one context to the next (D219)', () => {
  const first = { commandId: testUuid(0x8a10) }
  const second = { commandId: testUuid(0x8a11) }
  const resolved = (child: { commandId: string }, rollMode: string | null = 'DISADVANTAGE') => ({
    ...child,
    rollMode
  })

  it('waits on a child only while one is recorded without its resolved mode', () => {
    expect(awaitsReactionChild({})).toBe(false)
    expect(awaitsReactionChild({ reactionChildren: [first] })).toBe(true)
    expect(awaitsReactionChild({ reactionChildren: [resolved(first, null)] })).toBe(false)
    expect(awaitsReactionChild({ reactionChildren: [resolved(first), second] })).toBe(true)
  })

  it('adds at most one unresolved child after the recorded ones', () => {
    expect(reactionChildrenKept({}, {})).toBe(true)
    expect(reactionChildrenKept({}, { reactionChildren: [first] })).toBe(true)
    expect(reactionChildrenKept({}, { reactionChildren: [first, second] })).toBe(false)
    expect(reactionChildrenKept({}, { reactionChildren: [resolved(first)] })).toBe(false)
  })

  it('keeps every recorded child, in order and resolved, and never rewrites a resolved mode', () => {
    const waiting = { reactionChildren: [first] }
    expect(reactionChildrenKept(waiting, { reactionChildren: [resolved(first)] })).toBe(true)
    expect(reactionChildrenKept(waiting, { reactionChildren: [resolved(first, null)] })).toBe(true)
    expect(reactionChildrenKept(waiting, { reactionChildren: [resolved(first), second] })).toBe(
      true
    )
    // Dropped, still unresolved, or replaced by another command.
    expect(reactionChildrenKept(waiting, {})).toBe(false)
    expect(reactionChildrenKept(waiting, waiting)).toBe(false)
    expect(reactionChildrenKept(waiting, { reactionChildren: [resolved(second)] })).toBe(false)

    const settled = { reactionChildren: [resolved(first), resolved(second, null)] }
    expect(reactionChildrenKept(settled, settled)).toBe(true)
    expect(
      reactionChildrenKept(settled, {
        reactionChildren: [resolved(first, 'ADVANTAGE'), resolved(second, null)]
      })
    ).toBe(false)
    expect(
      reactionChildrenKept(settled, {
        reactionChildren: [resolved(second, null), resolved(first)]
      })
    ).toBe(false)
  })
})

describe('admitting the room’s resume of a pending action (D219)', () => {
  const resumeOf = async (
    paused: Awaited<ReturnType<typeof pausedAttack>>,
    overrides: Partial<LiveSessionEncounterActionResume> = {}
  ) =>
    readNativeEncounterActionResumeAdmission(
      // The refusals under test are decided from the store alone, before any port is read.
      paused.ctx as unknown as Parameters<typeof readNativeEncounterActionResumeAdmission>[0],
      {
        type: 'RESUME_ACTION',
        encounterId: ENCOUNTER_ID,
        expectedVersion: ROOT_VERSION,
        occurrenceId: OCCURRENCE_ID,
        expectedOccurrenceVersion: paused.occurrence().version,
        ...overrides
      },
      paused.memory.documents('encounterRuns')[0]!,
      USER_ID
    )

  it('refuses a resume of an action that records no reaction child: an open offer resumes nothing', async () => {
    await expect(resumeOf(await pausedAttack())).rejects.toThrow('DECISION_NOT_PENDING')
  })

  it('refuses a second resume from a child the action already resumed from', async () => {
    const paused = await pausedAttack({
      reactionChildren: [{ commandId: reactionChild().commandId, rollMode: 'DISADVANTAGE' }]
    })
    await expect(resumeOf(paused)).rejects.toThrow('DECISION_NOT_PENDING')
  })

  it('refuses a resume of no pending action, or on a stale version', async () => {
    const paused = await pausedAttack(recorded)
    await expect(resumeOf(paused, { occurrenceId: testUuid(0x8a12) })).rejects.toThrow(
      'DECISION_NOT_PENDING'
    )
    await expect(resumeOf(paused, { expectedOccurrenceVersion: 9 })).rejects.toThrow(
      'VERSION_STALE'
    )
    await expect(resumeOf(paused, { expectedVersion: ROOT_VERSION + 1 })).rejects.toThrow(
      'VERSION_STALE'
    )
  })
})

describe('suspending the pending action while its reaction child is the pending decision (D219)', () => {
  it('suspends the action that records the child, which still reads as the child’s parent', async () => {
    const { ctx, occurrence } = await pausedAttack(recorded)
    await suspendReactionChildParent(ctx, link)
    expect(occurrence().state).toBe('SUSPENDED')
    expect(occurrence().expectedEncounterVersion).toBe(ROOT_VERSION)
    expect(await readReactionChildParent(ctx, link)).toEqual(occurrence())
  })

  it('refuses to suspend an action that does not record the child, or is already suspended', async () => {
    const open = await pausedAttack()
    await expect(suspendReactionChildParent(open.ctx, link)).rejects.toThrow(
      'The reaction’s pending action is gone.'
    )
    expect(open.occurrence().state).toBe('PENDING')
    const { ctx } = await pausedAttack(recorded)
    await suspendReactionChildParent(ctx, link)
    await expect(suspendReactionChildParent(ctx, link)).rejects.toThrow(
      'The reaction’s pending action is gone.'
    )
  })

  it('returns the suspended action to pending when the child commits and re-pins it', async () => {
    const { ctx, occurrence } = await pausedAttack(recorded)
    await suspendReactionChildParent(ctx, link)
    await repinReactionChildParent(ctx, { ...link, version: ROOT_VERSION + 1 })
    expect(occurrence().state).toBe('PENDING')
    expect(occurrence().expectedEncounterVersion).toBe(ROOT_VERSION + 1)
    expect((await readNativeActionPending(ctx, occurrence())).context.reactionChildren).toEqual(
      recorded.reactionChildren
    )
  })

  it('releases the suspended action when its paused child is voided: pending, the child dropped', async () => {
    const { ctx, memory, occurrence } = await pausedAttack(recorded)
    await suspendReactionChildParent(ctx, link)
    const suspended = occurrence()
    await insertVoid(memory, ROOT_VERSION + 1)
    await releaseReactionChildParent(ctx, { ...link, version: ROOT_VERSION + 1 })
    expect(occurrence().state).toBe('PENDING')
    expect(occurrence().version).toBe(suspended.version + 1)
    expect(occurrence().expectedEncounterVersion).toBe(ROOT_VERSION + 1)
    expect(occurrence().pendingSnapshotChecksum).not.toBe(suspended.pendingSnapshotChecksum)
    // The Run version the void produced is accounted for by the void itself, not a recorded child.
    const pending = await readNativeActionPending(ctx, occurrence())
    expect(pending.command).toEqual(parentCommand)
    expect(pending.context.reactionChildren).toBeUndefined()
    expect(await readReactionChildParent(ctx, link)).toBeNull()
  })

  it('drops the cast level with the last recorded child, and keeps it while one remains', async () => {
    const only = await pausedAttack({ ...recorded, castLevel: 4 })
    await suspendReactionChildParent(only.ctx, link)
    await insertVoid(only.memory, ROOT_VERSION + 1)
    await releaseReactionChildParent(only.ctx, { ...link, version: ROOT_VERSION + 1 })
    const reopened = await readNativeActionPending(only.ctx, only.occurrence())
    expect(reopened.context.reactionChildren).toBeUndefined()
    expect(reopened.context.castLevel).toBeUndefined()

    const earlier = { commandId: testUuid(0x8a13), rollMode: 'DISADVANTAGE' as const }
    const later = await pausedAttack({
      reactionChildren: [earlier, ...recorded.reactionChildren],
      castLevel: 4
    })
    await later.memory.store.patch(later.occurrence()._id, {
      expectedEncounterVersion: ROOT_VERSION + 1
    })
    await suspendReactionChildParent(later.ctx, link)
    await insertVoid(later.memory, ROOT_VERSION + 2)
    await releaseReactionChildParent(later.ctx, { ...link, version: ROOT_VERSION + 2 })
    const kept = await readNativeActionPending(later.ctx, later.occurrence())
    expect(kept.context.reactionChildren).toEqual([earlier])
    expect(kept.context.castLevel).toBe(4)
  })

  it('keeps the children the action already resumed from when a later one is voided', async () => {
    const earlier = testUuid(0x8a13)
    const { ctx, memory, occurrence } = await pausedAttack({
      reactionChildren: [
        { commandId: earlier, rollMode: 'DISADVANTAGE' },
        ...recorded.reactionChildren
      ]
    })
    await memory.store.patch(occurrence()._id, { expectedEncounterVersion: ROOT_VERSION + 1 })
    await suspendReactionChildParent(ctx, link)
    await insertVoid(memory, ROOT_VERSION + 2)
    await releaseReactionChildParent(ctx, { ...link, version: ROOT_VERSION + 2 })
    expect((await readNativeActionPending(ctx, occurrence())).context.reactionChildren).toEqual([
      { commandId: earlier, rollMode: 'DISADVANTAGE' }
    ])
  })

  it('refuses to release an action that is not suspended', async () => {
    const { ctx, occurrence } = await pausedAttack(recorded)
    await expect(
      releaseReactionChildParent(ctx, { ...link, version: ROOT_VERSION + 1 })
    ).rejects.toThrow('The reaction’s pending action is gone.')
    expect(occurrence().state).toBe('PENDING')
    expect(occurrence().expectedEncounterVersion).toBe(ROOT_VERSION)
  })

  it('counts the Run’s voids after one version, through another', async () => {
    const { ctx, memory, state } = await pausedAttack(recorded)
    await insertVoid(memory, ROOT_VERSION + 1)
    await insertCommittedAction(memory, state, reactionChild(ROOT_VERSION + 1), ROOT_VERSION + 2)
    await insertVoid(memory, ROOT_VERSION + 3)
    const count = (afterVersion: number, throughVersion: number) =>
      countRunVoidVersions(ctx, { encounterId: ENCOUNTER_ID, afterVersion, throughVersion })
    expect(await count(ROOT_VERSION, ROOT_VERSION + 3)).toBe(2)
    // The lower bound is exclusive and the upper inclusive.
    expect(await count(ROOT_VERSION + 1, ROOT_VERSION + 3)).toBe(1)
    expect(await count(ROOT_VERSION, ROOT_VERSION + 2)).toBe(1)
    expect(await count(ROOT_VERSION + 3, ROOT_VERSION + 4)).toBe(0)
  })
})

describe('counting a root’s committed reaction children from the Run’s commands (D219)', () => {
  it('counts only this root’s reaction children between the two versions', async () => {
    const { ctx, memory, state } = await pausedAttack(recorded)
    await insertCommittedAction(memory, state, reactionChild(), ROOT_VERSION + 1)
    await insertCommittedAction(
      memory,
      state,
      reactionChild(ROOT_VERSION + 1, OTHER_ROOT_COMMAND_ID),
      ROOT_VERSION + 2
    )
    await insertCommittedAction(
      memory,
      state,
      action({
        commandId: testUuid(0x8a0d),
        actorId: ALLY_ID,
        expectedVersion: ROOT_VERSION + 2
      }),
      ROOT_VERSION + 3
    )
    const count = async (afterVersion: number, beforeVersion: number) =>
      (
        await readCommittedReactionDescendants(ctx, {
          encounterId: ENCOUNTER_ID,
          rootCommandId: PARENT_COMMAND_ID,
          afterVersion,
          beforeVersion
        })
      ).length
    expect(await count(ROOT_VERSION, ROOT_VERSION + 4)).toBe(1)
    // Both bounds are exclusive: the child at the edge is outside.
    expect(await count(ROOT_VERSION + 1, ROOT_VERSION + 4)).toBe(0)
    expect(await count(ROOT_VERSION, ROOT_VERSION + 1)).toBe(0)
  })

  it('reads the reactions chosen against a root’s reactions with them, in Run order (QUALITY-9.T1c1)', async () => {
    const { ctx, memory, state } = await pausedAttack(recorded)
    // A reaction to a held reaction commits before the reaction it answers.
    await insertCommittedAction(memory, state, nestedChild(), ROOT_VERSION + 1)
    await insertCommittedAction(memory, state, reactionChild(ROOT_VERSION + 1), ROOT_VERSION + 2)
    expect(
      await readCommittedReactionDescendants(ctx, {
        encounterId: ENCOUNTER_ID,
        rootCommandId: PARENT_COMMAND_ID,
        afterVersion: ROOT_VERSION,
        beforeVersion: ROOT_VERSION + 3
      })
    ).toEqual([
      {
        commandId: nestedChild().commandId,
        parentCommandId: reactionChild().commandId,
        reactorActorId: ATTACKER_ID
      },
      {
        commandId: reactionChild().commandId,
        parentCommandId: PARENT_COMMAND_ID,
        reactorActorId: PROTECTOR_ID
      }
    ])
  })

  it('reads the reactions under a held child the GM voided, and counts the undo its void made (QUALITY-9.T1c1)', async () => {
    const paused = await pausedAttack(recorded)
    const { ctx, memory, state } = paused
    await holdReactionChild(paused, nested.reactionChildren)
    await insertCommittedAction(memory, state, nestedChild(), ROOT_VERSION + 1)
    // The void of the held child takes the reaction under it back as one undo, then records itself.
    await insertGmCommand(memory, ROOT_VERSION + 2, {
      commandType: 'REVERT_LAST_ACTION',
      revertedCommandId: nestedChild().commandId
    })
    await insertVoid(memory, ROOT_VERSION + 3, CHILD_OCCURRENCE_ID)
    expect(
      await readCommittedReactionDescendants(ctx, {
        encounterId: ENCOUNTER_ID,
        rootCommandId: PARENT_COMMAND_ID,
        afterVersion: ROOT_VERSION,
        beforeVersion: ROOT_VERSION + 4
      })
    ).toEqual([
      {
        commandId: nestedChild().commandId,
        parentCommandId: reactionChild().commandId,
        reactorActorId: ATTACKER_ID
      }
    ])
    expect(
      await countRunVoidVersions(ctx, {
        encounterId: ENCOUNTER_ID,
        afterVersion: ROOT_VERSION,
        throughVersion: ROOT_VERSION + 3
      })
    ).toBe(2)
  })
})

describe('a reaction chosen against a held reaction child (QUALITY-9.T1c1, D219)', () => {
  /** Commits the held child on the Run at `version`, as its own commit records it. */
  async function commitHeldChild(
    paused: Awaited<ReturnType<typeof pausedAttack>>,
    child: Awaited<ReturnType<typeof holdReactionChild>>,
    version: number
  ) {
    const { ctx, memory, state } = paused
    await insertCommittedAction(memory, state, reactionChild(), version)
    await memory.store.patch(child()._id, {
      state: 'COMPLETED',
      completedAt: TIMESTAMP,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: CHILD_OCCURRENCE_ID, encounterId: ENCOUNTER_ID },
        null
      )
    })
    await repinReactionChildParent(ctx, { ...link, version })
  }

  it('admits the nested child against the held child that records it, the attack still suspended', async () => {
    const paused = await pausedAttack(recorded)
    await holdReactionChild(paused, nested.reactionChildren)
    await expect(paused.admit(nestedChild())).resolves.toBeUndefined()
    expect(paused.occurrence().state).toBe('SUSPENDED')
    const open = await pausedAttack(recorded)
    await holdReactionChild(open)
    await expect(open.admit(nestedChild())).rejects.toThrow('COMMAND_ID_REUSED')
  })

  it('suspends the held child when the nested one pauses, so the Run keeps one pending decision', async () => {
    const paused = await pausedAttack(recorded)
    const child = await holdReactionChild(paused, nested.reactionChildren)
    await suspendReactionChildParent(paused.ctx, nestedLink)
    expect(child().state).toBe('SUSPENDED')
    expect(paused.occurrence().state).toBe('SUSPENDED')
    expect(paused.memory.documents('encounterRuleOccurrences')).toHaveLength(2)
  })

  it('re-pins the held child and every suspended action above it to the Run the nested child left', async () => {
    const paused = await pausedAttack(recorded)
    const child = await holdReactionChild(paused, nested.reactionChildren)
    await repinReactionChildParent(paused.ctx, { ...nestedLink, version: ROOT_VERSION + 1 })
    expect(child()).toMatchObject({
      state: 'PENDING',
      expectedEncounterVersion: ROOT_VERSION + 1
    })
    expect(paused.occurrence()).toMatchObject({
      state: 'SUSPENDED',
      expectedEncounterVersion: ROOT_VERSION + 1
    })
  })

  it('reads the attack past its own child and the reaction under that child', async () => {
    const paused = await pausedAttack(recorded)
    const { ctx, memory, state, occurrence } = paused
    const child = await holdReactionChild(paused, nested.reactionChildren)
    await insertCommittedAction(memory, state, nestedChild(), ROOT_VERSION + 1)
    await repinReactionChildParent(ctx, { ...nestedLink, version: ROOT_VERSION + 1 })
    expect((await readNativeActionPending(ctx, child())).command).toEqual(reactionChild())

    await commitHeldChild(paused, child, ROOT_VERSION + 2)
    expect(occurrence()).toMatchObject({
      state: 'PENDING',
      expectedEncounterVersion: ROOT_VERSION + 2
    })
    const pending = await readNativeActionPending(ctx, occurrence())
    expect(pending.command).toEqual(parentCommand)
    expect(pending.context.reactionChildren).toEqual(recorded.reactionChildren)
    // One version further is no reaction of the attack's tree.
    await memory.store.patch(occurrence()._id, { expectedEncounterVersion: ROOT_VERSION + 3 })
    await expect(readNativeActionPending(ctx, occurrence())).rejects.toThrow(
      'Stored Encounter action root mismatch.'
    )
  })

  it('releases the held child when the GM voids the paused nested one, the attack’s pin moving with it', async () => {
    const paused = await pausedAttack(recorded)
    const { ctx, memory, occurrence } = paused
    const child = await holdReactionChild(paused, nested.reactionChildren)
    await suspendReactionChildParent(ctx, nestedLink)
    await insertVoid(memory, ROOT_VERSION + 1)
    await releaseReactionChildParent(ctx, { ...nestedLink, version: ROOT_VERSION + 1 })
    expect(child()).toMatchObject({
      state: 'PENDING',
      expectedEncounterVersion: ROOT_VERSION + 1
    })
    expect((await readNativeActionPending(ctx, child())).context.reactionChildren).toBeUndefined()
    expect(occurrence()).toMatchObject({
      state: 'SUSPENDED',
      expectedEncounterVersion: ROOT_VERSION + 1
    })

    // The child then commits, and the attack reads past the void and its child.
    await commitHeldChild(paused, child, ROOT_VERSION + 2)
    expect((await readNativeActionPending(ctx, occurrence())).command).toEqual(parentCommand)
  })

  it('reads the attack a void released from a held child whose own reaction had committed', async () => {
    const paused = await pausedAttack(recorded)
    const { ctx, memory, state, occurrence } = paused
    const child = await holdReactionChild(paused, nested.reactionChildren)
    await insertCommittedAction(memory, state, nestedChild(), ROOT_VERSION + 1)
    await repinReactionChildParent(ctx, { ...nestedLink, version: ROOT_VERSION + 1 })
    // The void takes the committed nested reaction back as one undo, then records itself.
    await insertGmCommand(memory, ROOT_VERSION + 2, {
      commandType: 'REVERT_LAST_ACTION',
      revertedCommandId: nestedChild().commandId
    })
    await memory.store.patch(child()._id, {
      state: 'VOIDED',
      completedAt: TIMESTAMP,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: CHILD_OCCURRENCE_ID, encounterId: ENCOUNTER_ID },
        null
      )
    })
    await insertVoid(memory, ROOT_VERSION + 3, CHILD_OCCURRENCE_ID)
    await releaseReactionChildParent(ctx, { ...link, version: ROOT_VERSION + 3 })
    expect(occurrence()).toMatchObject({
      state: 'PENDING',
      expectedEncounterVersion: ROOT_VERSION + 3
    })
    const pending = await readNativeActionPending(ctx, occurrence())
    expect(pending.command).toEqual(parentCommand)
    expect(pending.context.reactionChildren).toBeUndefined()
    await memory.store.patch(occurrence()._id, { expectedEncounterVersion: ROOT_VERSION + 4 })
    await expect(readNativeActionPending(ctx, occurrence())).rejects.toThrow(
      'Stored Encounter action root mismatch.'
    )
  })
})

describe('the reactions a GM void of a held action takes back (QUALITY-9.T1c1, D219)', () => {
  const trailing = (ctx: Awaited<ReturnType<typeof pausedAttack>>['ctx']) =>
    readTrailingReactionDescendants(ctx, {
      encounterId: ENCOUNTER_ID,
      rootCommandId: PARENT_COMMAND_ID
    })
  const unrelated = action({
    commandId: testUuid(0x8a0d),
    actorId: ALLY_ID,
    expectedVersion: ROOT_VERSION - 1
  })

  it('are the Run’s last commands that are its reactions and the reactions chosen against them', async () => {
    const { ctx, memory, state } = await pausedAttack(recorded)
    await insertCommittedAction(memory, state, unrelated, ROOT_VERSION)
    await insertCommittedAction(memory, state, nestedChild(), ROOT_VERSION + 1)
    await insertCommittedAction(memory, state, reactionChild(ROOT_VERSION + 1), ROOT_VERSION + 2)
    expect(await trailing(ctx)).toEqual(
      new Set([reactionChild().commandId, nestedChild().commandId])
    )
  })

  it('are none once anything else followed them, and none of another action’s', async () => {
    const voided = await pausedAttack(recorded)
    await insertCommittedAction(voided.memory, voided.state, reactionChild(), ROOT_VERSION + 1)
    await insertVoid(voided.memory, ROOT_VERSION + 2)
    expect(await trailing(voided.ctx)).toEqual(new Set())

    const other = await pausedAttack(recorded)
    await insertCommittedAction(
      other.memory,
      other.state,
      reactionChild(ROOT_VERSION, OTHER_ROOT_COMMAND_ID),
      ROOT_VERSION + 1
    )
    expect(await trailing(other.ctx)).toEqual(new Set())
  })
})

describe('a committed child whose own cast a nested reaction countered (QUALITY-9.T1c1, D219)', () => {
  it('reads as a child that did not cancel the action it answered', async () => {
    const { ctx, memory, state } = await pausedAttack(recorded)
    const command = reactionChild()
    await insertCommittedAction(memory, state, nestedChild(), ROOT_VERSION + 1)
    await insertCommittedAction(memory, state, command, ROOT_VERSION + 2)
    // The countered child commits as the cast it lost: its slot and reaction, nothing of the spell.
    const execution = buildEncounterCounteredCastStoredExecution({
      occurrenceId: CHILD_OCCURRENCE_ID,
      occurrenceVersion: 1,
      actorId: PROTECTOR_ID,
      sourceCharacterId: null,
      spend: {
        sourceCharacterStreamVersion: null,
        resourceReceipt: null,
        featureResourceReceipt: null,
        sourceItemUseStateTransition: null,
        itemConsumptionReceipt: null,
        spellConsumptionReceipt: null,
        sourceApplications: []
      },
      actionEconomy: null,
      counter: null
    })
    await memory.store.insert(
      'encounterRuleReceipts',
      encounterStoredRuleReceiptSchema.parse({
        id: crypto.randomUUID(),
        campaignId: CAMPAIGN_ID,
        encounterId: ENCOUNTER_ID,
        occurrenceId: CHILD_OCCURRENCE_ID,
        commandId: command.commandId,
        commandType: 'RESOLVE_ACTION',
        commandFingerprint: checksumCanonicalJson(command),
        encounterVersion: ROOT_VERSION + 2,
        commandMetadataJson: '{}',
        resultJson: JSON.stringify(execution),
        resultChecksum: checksumRuleDocument(execution),
        actorUserId: USER_ID,
        correlationId: null,
        createdAt: TIMESTAMP
      })
    )
    expect(
      await readCommittedReactionChildren(ctx, {
        campaignId: CAMPAIGN_ID,
        gameSystemId: state.gameSystemId,
        recorded: recorded.reactionChildren
      })
    ).toEqual([
      {
        commandId: command.commandId,
        reactorActorId: PROTECTOR_ID,
        actionId: REACTION_ACTION_ID,
        imposesRollMode: false,
        cancelsTriggeringEvent: false,
        // The reaction that countered it committed under it, so its creature reacted in the child's tree.
        descendantReactorActorIds: [ATTACKER_ID]
      }
    ])
  })
})

describe('the held actions above a reaction child (QUALITY-9.T1c2, D219)', () => {
  const SLOT_KEY = 'STANDARD:3'
  const ancestors = (
    ctx: Awaited<ReturnType<typeof pausedAttack>>['ctx'],
    child: typeof link = link
  ) => readReactionChildAncestors(ctx, child)

  it('is the action that records the child: its creature, not a reaction, with the slot its cast spends', async () => {
    const { ctx } = await pausedAttack({ ...recorded, castLevel: 3, castSlotKey: SLOT_KEY })
    expect(await ancestors(ctx)).toEqual([
      { actorId: ATTACKER_ID, reaction: false, castSlotKey: SLOT_KEY }
    ])
    // A held action whose cast spends no slot, or that casts nothing, names none.
    const attack = await pausedAttack(recorded)
    expect(await ancestors(attack.ctx)).toEqual([
      { actorId: ATTACKER_ID, reaction: false, castSlotKey: null }
    ])
  })

  it('reads every held action above a nested child, nearest first, a held reaction marked as one', async () => {
    const paused = await pausedAttack({ ...recorded, castLevel: 3, castSlotKey: SLOT_KEY })
    await holdReactionChild(paused, nested.reactionChildren)
    expect(await ancestors(paused.ctx, nestedLink)).toEqual([
      { actorId: PROTECTOR_ID, reaction: true, castSlotKey: null },
      { actorId: ATTACKER_ID, reaction: false, castSlotKey: SLOT_KEY }
    ])
    // The suspended attack is still read from its own child.
    expect(await ancestors(paused.ctx)).toEqual([
      { actorId: ATTACKER_ID, reaction: false, castSlotKey: SLOT_KEY }
    ])
  })

  it('is none for a child no held action records', async () => {
    const open = await pausedAttack()
    expect(await ancestors(open.ctx)).toEqual([])
    const held = await pausedAttack(recorded)
    await holdReactionChild(held)
    expect(await ancestors(held.ctx, nestedLink)).toEqual([])
  })

  it('records the slot only beside a reaction child, and never rewrites it', async () => {
    await expect(pausedAttack({ castSlotKey: SLOT_KEY })).rejects.toThrow(
      'Only an action that records a reaction child records its cast slot.'
    )
    const child = { commandId: testUuid(0x8a10) }
    const waiting = { reactionChildren: [child], castLevel: 3, castSlotKey: SLOT_KEY }
    const resumed = { reactionChildren: [{ ...child, rollMode: null }], castLevel: 3 }
    expect(reactionChildrenKept(waiting, { ...resumed, castSlotKey: SLOT_KEY })).toBe(true)
    expect(reactionChildrenKept(waiting, { ...resumed, castSlotKey: 'STANDARD:4' })).toBe(false)
    expect(reactionChildrenKept(waiting, resumed)).toBe(false)
    expect(reactionChildrenKept({}, waiting)).toBe(true)
  })

  it('drops the slot with the last recorded child, and keeps it while one remains', async () => {
    const only = await pausedAttack({ ...recorded, castLevel: 3, castSlotKey: SLOT_KEY })
    await suspendReactionChildParent(only.ctx, link)
    await insertVoid(only.memory, ROOT_VERSION + 1)
    await releaseReactionChildParent(only.ctx, { ...link, version: ROOT_VERSION + 1 })
    expect(
      (await readNativeActionPending(only.ctx, only.occurrence())).context.castSlotKey
    ).toBeUndefined()

    const later = await pausedAttack({
      reactionChildren: [
        { commandId: testUuid(0x8a13), rollMode: 'DISADVANTAGE' },
        ...recorded.reactionChildren
      ],
      castLevel: 3,
      castSlotKey: SLOT_KEY
    })
    await later.memory.store.patch(later.occurrence()._id, {
      expectedEncounterVersion: ROOT_VERSION + 1
    })
    await suspendReactionChildParent(later.ctx, link)
    await insertVoid(later.memory, ROOT_VERSION + 2)
    await releaseReactionChildParent(later.ctx, { ...link, version: ROOT_VERSION + 2 })
    expect((await readNativeActionPending(later.ctx, later.occurrence())).context.castSlotKey).toBe(
      SLOT_KEY
    )
  })
})
