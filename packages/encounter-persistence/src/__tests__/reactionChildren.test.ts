import { describe, expect, it } from 'vitest'
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
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readNativeActionPending } from '../actionPending.js'
import { insertRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { writePendingSnapshot } from '../pendingSnapshots.js'
import {
  awaitsReactionChild,
  countCommittedReactionChildren,
  countRunVoids,
  reactionChildrenKept,
  readReactionChildParent,
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
      ...(input.reactionChildren && { reactionChildren: input.reactionChildren })
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
  /** The GM's void of a paused child, recorded on the Run at `version`. */
  const insertVoid = (memory: ReturnType<typeof createMemoryEncounterStore>, version: number) =>
    memory.store.insert(
      'encounterRunCommands',
      encounterStoredRunCommandSchema.parse({
        id: crypto.randomUUID(),
        campaignId: CAMPAIGN_ID,
        encounterId: ENCOUNTER_ID,
        commandId: crypto.randomUUID(),
        commandType: 'VOID_RULE_OCCURRENCE',
        ruleOccurrenceId: crypto.randomUUID(),
        commandFingerprint: checksum('f'),
        actorUserId: USER_ID,
        version,
        commandJson: '{}',
        replayReceiptJson: '{}',
        replayReceiptChecksum: checksum('e'),
        createdAt: TIMESTAMP
      })
    )

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
      countRunVoids(ctx, { encounterId: ENCOUNTER_ID, afterVersion, throughVersion })
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
    const count = (afterVersion: number, beforeVersion: number) =>
      countCommittedReactionChildren(ctx, {
        encounterId: ENCOUNTER_ID,
        rootCommandId: PARENT_COMMAND_ID,
        afterVersion,
        beforeVersion
      })
    expect(await count(ROOT_VERSION, ROOT_VERSION + 4)).toBe(1)
    // Both bounds are exclusive: the child at the edge is outside.
    expect(await count(ROOT_VERSION + 1, ROOT_VERSION + 4)).toBe(0)
    expect(await count(ROOT_VERSION, ROOT_VERSION + 1)).toBe(0)
  })
})
