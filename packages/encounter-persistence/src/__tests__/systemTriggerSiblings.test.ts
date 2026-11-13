import { describe, expect, it } from 'vitest'
import { systemTriggerSelfCommand } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  TIMESTAMP,
  creatureActor,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { insertRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { requireSystemTriggerAdmission } from '../systemTriggerAdmission.js'

/**
 * QUALITY-11.T2: a command's system-trigger children each move the Run, so a child is admitted at
 * its parent's version plus the committed siblings before it, and at no other version.
 */

const HOLDER_ID = testUuid(0x9b01)
const PARENT_COMMAND_ID = testUuid(0x9b02)
const USER_ID = testUuid(0x9b03)
const PARENT_VERSION = 4
const checksum = (letter: string) => letter.repeat(64)

const child = (actionId: string, expectedVersion: number) =>
  systemTriggerSelfCommand({
    encounterId: ENCOUNTER_ID,
    expectedVersion,
    parentCommandId: PARENT_COMMAND_ID,
    holderActorId: HOLDER_ID,
    actionId,
    trigger: 'START_OF_TURN'
  })

const insertCommand = (
  memory: ReturnType<typeof createMemoryEncounterStore>,
  version: number,
  command: Record<string, unknown>
) =>
  memory.store.insert(
    'encounterRunCommands',
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: CAMPAIGN_ID,
      encounterId: ENCOUNTER_ID,
      commandFingerprint: checksum('f'),
      actorUserId: USER_ID,
      version,
      commandJson: '{}',
      replayReceiptJson: '{}',
      replayReceiptChecksum: checksum('e'),
      createdAt: TIMESTAMP,
      ...command
    })
  )

/** A Run on its holder's turn, begun by an ADVANCE_TURN at `PARENT_VERSION`, now at `version`. */
async function runAfterTurnStart(version: number) {
  const memory = createMemoryEncounterStore()
  const ctx = {
    db: memory.store,
    ports: {
      readCharacterPlay: (): never => {
        throw new Error('No Character is in this Run.')
      }
    }
  }
  const actors = [creatureActor({ id: HOLDER_ID, snapshot: {} })]
  const state = srdEncounterState({ actors, currentActorId: HOLDER_ID, version })
  await memory.store.insert('encounterRuns', {
    id: state.id,
    campaignId: state.campaignId,
    gameSystemId: state.gameSystemId,
    status: state.status,
    version: state.version,
    stateJson: JSON.stringify(state),
    stateChecksum: checksumCanonicalJson(state),
    createCommandId: testUuid(0x9b04),
    createCommandFingerprint: checksum('b'),
    concentrationCasterCharacterIds: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
  for (const actor of actors) await insertRunActor(ctx, actor)
  await insertCommand(memory, PARENT_VERSION, {
    commandId: PARENT_COMMAND_ID,
    commandType: 'ADVANCE_TURN',
    ruleOccurrenceId: testUuid(0x9b05),
    ruleResultChecksum: checksum('d'),
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
  })
  const commitSibling = (committed: ResolveEncounterActionInputDto, at: number) =>
    insertCommand(memory, at, {
      commandId: committed.commandId,
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
      commandFingerprint: checksumCanonicalJson(committed),
      commandJson: JSON.stringify(committed)
    })
  const admit = (command: ResolveEncounterActionInputDto) =>
    requireSystemTriggerAdmission(ctx, {
      run: memory.documents('encounterRuns')[0]!,
      state,
      command: { ...command, systemTrigger: command.systemTrigger! },
      fresh: true
    })
  return { memory, commitSibling, admit }
}

describe('system-trigger siblings of one command (QUALITY-11.T2)', () => {
  it('admits the first child at its parent’s version', async () => {
    const { admit } = await runAfterTurnStart(PARENT_VERSION)
    await expect(admit(child('feature:first', PARENT_VERSION))).resolves.toBeUndefined()
  })

  it('admits a later child at the version the committed siblings before it produced', async () => {
    const { admit, commitSibling } = await runAfterTurnStart(PARENT_VERSION + 2)
    await commitSibling(child('feature:first', PARENT_VERSION), PARENT_VERSION + 1)
    await commitSibling(child('feature:second', PARENT_VERSION + 1), PARENT_VERSION + 2)
    await expect(admit(child('feature:third', PARENT_VERSION + 2))).resolves.toBeUndefined()
  })

  it('rejects a later child that still names its parent’s version', async () => {
    const { admit, commitSibling } = await runAfterTurnStart(PARENT_VERSION + 1)
    await commitSibling(child('feature:first', PARENT_VERSION), PARENT_VERSION + 1)
    await expect(admit(child('feature:second', PARENT_VERSION))).rejects.toThrow('VERSION_STALE')
  })

  it('rejects a child when a command that is not its sibling moved the Run', async () => {
    const { admit, memory } = await runAfterTurnStart(PARENT_VERSION + 1)
    await insertCommand(memory, PARENT_VERSION + 1, {
      commandId: crypto.randomUUID(),
      commandType: 'VOID_RULE_OCCURRENCE',
      ruleOccurrenceId: crypto.randomUUID()
    })
    await expect(admit(child('feature:first', PARENT_VERSION + 1))).rejects.toThrow('VERSION_STALE')
  })

  it('rejects a child on a Run that moved past its committed siblings', async () => {
    const { admit, commitSibling } = await runAfterTurnStart(PARENT_VERSION + 2)
    await commitSibling(child('feature:first', PARENT_VERSION), PARENT_VERSION + 1)
    await expect(admit(child('feature:second', PARENT_VERSION + 1))).rejects.toThrow(
      'VERSION_STALE'
    )
  })
})
