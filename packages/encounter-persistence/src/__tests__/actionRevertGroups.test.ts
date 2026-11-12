import { describe, expect, it } from 'vitest'
import {
  systemTriggerReactionCommand,
  systemTriggerSelfCommand
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import {
  CAMPAIGN_ID,
  ENCOUNTER_ID,
  TIMESTAMP,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { revertGroupRoots } from '../actionRevertGroups.js'

const ATTACKER_ID = testUuid(0x8c01)
const TARGET_ID = testUuid(0x8c02)
const REACTOR_ID = testUuid(0x8c03)
const USER_ID = testUuid(0x8c04)
const ATTACK_COMMAND_ID = testUuid(0x8c05)
const EARLIER_COMMAND_ID = testUuid(0x8c06)
const checksum = (letter: string) => letter.repeat(64)

const attack = (commandId: string) =>
  ({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: ENCOUNTER_ID,
    expectedVersion: 1,
    commandId,
    actorId: ATTACKER_ID,
    target: { kind: 'ACTOR', actorId: TARGET_ID },
    actionId: 'creature-ogre:greatclub',
    sceneContext: null
  }) satisfies ResolveEncounterActionInputDto

/** The action of a reaction chosen against a command, as the room raises it. */
const reaction = (actionId: string, parentCommandId = ATTACK_COMMAND_ID) =>
  systemTriggerReactionCommand({
    encounterId: ENCOUNTER_ID,
    expectedVersion: 1,
    parentCommandId,
    holderActorId: REACTOR_ID,
    actionId,
    targetActorId: ATTACKER_ID,
    sceneContext: null
  })

const stored = {
  id: testUuid(0x8c07),
  campaignId: CAMPAIGN_ID,
  encounterId: ENCOUNTER_ID,
  actorUserId: USER_ID,
  replayReceiptJson: '{}',
  replayReceiptChecksum: checksum('e'),
  createdAt: TIMESTAMP
}

/** A committed action as the Run stores it. */
const committed = (command: ResolveEncounterActionInputDto, version: number) =>
  encounterStoredRunCommandSchema.parse({
    ...stored,
    commandId: command.commandId,
    commandType: 'RESOLVE_ACTION',
    root: {
      kind: 'RULE_OCCURRENCE',
      ruleOccurrenceId: testUuid(0x8d00 + version),
      ruleResultChecksum: checksum('d'),
      optionalCombatSnapshotChecksum: checksum('c')
    },
    label: null,
    ruleOverrides: [],
    consumedGrants: [],
    endedMaintainedStates: [],
    addedConcentrationCasterId: null,
    speedBonusTurn: null,
    commandFingerprint: checksumCanonicalJson(command),
    version,
    commandJson: JSON.stringify(command)
  })

/** The commands of the group, latest first. */
const grouped = (recent: Parameters<typeof revertGroupRoots>[0]) =>
  revertGroupRoots(recent, 0).groupRoots.map(({ root }) => root.commandId)

const earlier = committed(attack(EARLIER_COMMAND_ID), 2)
const parent = (version: number) => committed(attack(ATTACK_COMMAND_ID), version)

describe('the actions one undo takes back (D219)', () => {
  it('takes an action back with the reactions that committed before it', () => {
    const held = reaction('feature:protection')
    expect(grouped([parent(4), committed(held, 3), earlier])).toEqual([
      ATTACK_COMMAND_ID,
      held.commandId
    ])
  })

  it('takes a reaction that followed its committed action back with that action', () => {
    const after = reaction('feature:giant-killer')
    const { groupRoots, raisedByCommandId } = revertGroupRoots(
      [committed(after, 4), parent(3), earlier],
      0
    )
    expect(groupRoots.map(({ root }) => root.commandId)).toEqual([
      after.commandId,
      ATTACK_COMMAND_ID
    ])
    expect(raisedByCommandId).toBeNull()
  })

  it('takes the reactions on both sides of the action back with it', () => {
    const held = reaction('feature:protection')
    const after = reaction('feature:giant-killer')
    expect(grouped([committed(after, 5), parent(4), committed(held, 3), earlier])).toEqual([
      after.commandId,
      ATTACK_COMMAND_ID,
      held.commandId
    ])
  })

  it('takes the reactions to an action the GM voided back alone', () => {
    const first = reaction('feature:protection')
    const second = reaction('feature:other')
    expect(grouped([committed(second, 4), committed(first, 3), earlier])).toEqual([
      second.commandId,
      first.commandId
    ])
  })

  it('leaves out a reaction chosen against another action', () => {
    const other = reaction('feature:protection', EARLIER_COMMAND_ID)
    expect(grouped([parent(4), committed(other, 3), earlier])).toEqual([ATTACK_COMMAND_ID])
  })

  it('takes any other rule-raised action back with the action that raised it', () => {
    const raised = systemTriggerSelfCommand({
      encounterId: ENCOUNTER_ID,
      expectedVersion: 3,
      parentCommandId: ATTACK_COMMAND_ID,
      holderActorId: TARGET_ID,
      actionId: 'rule:system-shock',
      trigger: 'RULE'
    })
    const { groupRoots, raisedByCommandId } = revertGroupRoots(
      [committed(raised, 4), parent(3), earlier],
      0
    )
    expect(groupRoots.map(({ root }) => root.commandId)).toEqual([
      raised.commandId,
      ATTACK_COMMAND_ID
    ])
    expect(raisedByCommandId).toBe(ATTACK_COMMAND_ID)
  })
})
