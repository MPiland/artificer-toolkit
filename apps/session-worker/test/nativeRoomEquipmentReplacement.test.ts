import { readStoredActorSnapshot } from '@artificer-toolkit/encounter-persistence/actorSnapshots'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { requireSnapshotIdentity } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { composeRunActorState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import {
  snapshotCreatureEquipmentLoadout,
  snapshotCreatureEquipmentSources
} from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { greatclub } from '@artificer-toolkit/source-data/srd/equipment/greatclub.js'
import { greatclubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/greatclub-plus-1.js'
import { mace } from '@artificer-toolkit/source-data/srd/equipment/mace.js'
import { shortsword } from '@artificer-toolkit/source-data/srd/equipment/shortsword.js'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readCharacterHitPoints,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const FIGHTER_ACTOR_ID = testUuid(0xd00)
const FIGHTER_ID = testUuid(0xd01)
const OGRE_ID = testUuid(0xd02)

/** The Ogre's Greatclub with a new identity: a current Equipment its Feature actions still fit. */
const compatibleGreatclub = {
  ...greatclub,
  id: testUuid(0xd10),
  label: 'Encounter Greatclub'
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** Zero-based d20 face of a hit that is not a critical. */
const HIT_FACE = 18
const RANGE = ['TARGET_RANGE_UNCHECKED' as const]

/**
 * A seeded SRD Ogre on its turn beside a Fighter. The Fighter carries `compatibleGreatclub`, which
 * publishes it and a Dagger (with the Club every room publishes) into the room's R2 content: the
 * sources a replacement reads. With `autoRoll` the GM's rolls are made for them, so the Ogre's
 * attack with its held weapon resolves in one command; `rolls` follow its hit's d20 as raw dice.
 * `publishedEquipment` is published beside them, carried by no one.
 */
async function equipmentRoom(
  creatureName = 'Ogre',
  autoRoll?: 'GAME_MASTER',
  publishedEquipment: readonly EquipmentAuthored[] = [],
  rolls: readonly number[] = []
) {
  const creature = seededSrdCreature(creatureName)
  const ogre = srdCreatureActor({ id: OGRE_ID, creature })
  const heldEntry = snapshotCreatureEquipmentLoadout(ogre).find(
    (entry) => entry.useState === 'MAIN_HAND'
  )
  const attackFeatureId = heldEntry?.actionFeatureIds[0]
  if (!heldEntry || !attackFeatureId) throw new Error('The Ogre holds no main-hand weapon.')
  const heldEntryId = heldEntry.id
  const acting = await actionRoom({
    actors: [ogre, characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })],
    ownerFeatureId: attackFeatureId,
    characterEquipment:
      creatureName === 'Ogre' ? [compatibleGreatclub, dagger] : [shortsword, mace],
    publishedEquipment,
    ...(autoRoll && { autoRoll, rolls: [HIT_FACE, ...rolls] })
  })
  const room = acting.room
  const stub = room.base.stub

  /** The Ogre as the room stores it, with the snapshot its record names. */
  async function storedOgre() {
    const { actors } = await readRoomHistory(stub)
    const row = actors.find(({ id }) => id === OGRE_ID)
    if (!row) throw new Error('The stored Run holds no Ogre.')
    const actor = readStoredRunActor(row)
    if (actor.kind !== 'CREATURE') throw new Error('Expected a Creature actor.')
    const snapshotRow = await runInDurableObject(stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage)
        .documents('encounterActorSnapshots')
        .find(({ checksum }) => checksum === actor.snapshotChecksum)
    )
    if (!snapshotRow) throw new Error('The Ogre’s snapshot is not stored.')
    return { ...actor, snapshot: readStoredActorSnapshot(snapshotRow) }
  }
  const runVersion = async () => (await readRoomHistory(stub)).runs[0]!.version

  async function replace(input: {
    equipmentId: string
    actorId?: string
    commandId?: string
    expectedVersion?: number
    /** The socket's commands that send it: the GM's unless a player's. */
    via?: Pick<typeof room, 'send'>
  }) {
    const commandId = input.commandId ?? crypto.randomUUID()
    return (input.via ?? room).send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'REPLACE_CREATURE_EQUIPMENT',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: input.expectedVersion ?? (await runVersion()),
        actorId: input.actorId ?? OGRE_ID,
        loadoutEntryId: heldEntryId,
        equipmentId: input.equipmentId
      }
    })
  }

  /** The Ogre's attack on the Fighter with the weapon it holds, sent as soon as it is called. */
  function attack(expectedVersion: number, commandId = crypto.randomUUID()) {
    const command: ResolveEncounterActionInputDto = {
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: RANGE,
      encounterId: room.encounterId,
      commandId,
      expectedVersion,
      actorId: OGRE_ID,
      target: { kind: 'ACTOR', actorId: FIGHTER_ACTOR_ID },
      actionId: acting.actionId,
      optionalCombatIntent: null,
      sceneContext: null
    }
    return room.send(commandId, { scope: 'ENCOUNTER', command })
  }

  return {
    room,
    heldEntryId,
    storedOgre,
    runVersion,
    attack,
    /**
     * A replacement the rules refuse: the member is told only that the command could not be
     * completed, so the cause is read off what the room logged.
     */
    async refusedReplace(input: { equipmentId: string; actorId?: string }) {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const answer = await replace(input)
      return {
        answer,
        causes: logged.mock.calls
          .filter(([message]) => message === 'Live Session Encounter command failed in the room.')
          .map(([, error]) => (error instanceof Error ? error.message : error))
      }
    },
    replace
  }
}

describe('REPLACE_CREATURE_EQUIPMENT in the room with R2-seeded Equipment (ROOM-6.10)', () => {
  it('pins the published replacement, advances the Run once, and replays without a second write', async () => {
    const room = await equipmentRoom()
    const before = await room.storedOgre()
    const versionBefore = await room.runVersion()
    const commandId = crypto.randomUUID()

    const answer = await room.replace({
      equipmentId: compatibleGreatclub.id,
      commandId,
      expectedVersion: versionBefore
    })

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await room.runVersion()).toBe(versionBefore + 1)
    const after = await room.storedOgre()
    const loadoutBefore = snapshotCreatureEquipmentLoadout(before)
    expect(snapshotCreatureEquipmentLoadout(after)).toEqual(
      loadoutBefore.map((entry) =>
        entry.id === room.heldEntryId ? { ...entry, equipmentId: compatibleGreatclub.id } : entry
      )
    )
    const source = snapshotCreatureEquipmentSources(after).find(
      ({ loadoutEntryId }) => loadoutEntryId === room.heldEntryId
    )
    expect(source).toMatchObject({
      loadoutEntryId: room.heldEntryId,
      equipmentId: compatibleGreatclub.id,
      compiled: { id: compatibleGreatclub.id, label: compatibleGreatclub.label }
    })
    expect(source!.sourceChecksum).toBe(checksumRuleDocument(compatibleGreatclub))
    expect(source!.compilation.authoredChecksum).toBe(source!.sourceChecksum)
    expect(after.currentHitPoints).toBe(before.currentHitPoints)
    // The source evidence the command records is the closed pin the snapshot now holds.
    const { commands } = await readRoomHistory(room.room.base.stub)
    expect(commands.find((command) => command.commandId === commandId)).toMatchObject({
      commandType: 'REPLACE_CREATURE_EQUIPMENT',
      creatureEquipmentReplacement: {
        actorId: OGRE_ID,
        loadoutEntryId: room.heldEntryId,
        equipmentId: compatibleGreatclub.id,
        sourceRevision: source!.sourceRevision,
        sourceVersionId: source!.sourceVersionId,
        sourceChecksum: source!.sourceChecksum
      }
    })
    const payloadOf = (actor: typeof before) =>
      requireSnapshotIdentity(composeRunActorState(actor, actor.snapshot)).payload
    expect(payloadOf(after)).toEqual(payloadOf(before))

    const replay = await room.replace({
      equipmentId: compatibleGreatclub.id,
      commandId,
      expectedVersion: versionBefore
    })
    expect(replay.type, JSON.stringify(replay)).toBe('COMMAND_COMMITTED')
    expect(await room.runVersion()).toBe(versionBefore + 1)
    expect(await room.storedOgre()).toEqual(after)
  })

  it.each([
    {
      label: 'an Equipment the content does not publish',
      equipmentId: testUuid(0xd99),
      cause: 'Encounter source is unavailable in the selected Game System.'
    },
    {
      label: 'a published Equipment the Feature action does not fit',
      equipmentId: dagger.id,
      cause: 'Replacement Equipment is incompatible with the Creature Feature actions.'
    }
  ])('refuses $label without a write', async ({ equipmentId, cause }) => {
    const room = await equipmentRoom()
    const before = await room.storedOgre()
    const versionBefore = await room.runVersion()

    const { answer, causes } = await room.refusedReplace({ equipmentId })

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    expect(causes).toEqual([cause])
    expect(await room.runVersion()).toBe(versionBefore)
    expect(await room.storedOgre()).toEqual(before)
  })

  it.each([
    { label: 'another piercing melee weapon', equipment: shortsword, accepted: true },
    { label: 'a bludgeoning melee weapon', equipment: mace, accepted: false }
  ])(
    'the Ogre Zombie’s printed Morningstar attack: $label is accepted=$accepted',
    async ({ equipment, accepted }) => {
      const room = await equipmentRoom('Ogre Zombie')
      const before = await room.storedOgre()

      const { answer, causes } = await room.refusedReplace({ equipmentId: equipment.id })

      if (accepted) {
        expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
        expect(causes).toEqual([])
        expect(
          snapshotCreatureEquipmentSources(await room.storedOgre()).find(
            ({ loadoutEntryId }) => loadoutEntryId === room.heldEntryId
          )?.equipmentId
        ).toBe(equipment.id)
      } else {
        expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
        expect(causes).toEqual([
          'Replacement Equipment is incompatible with the Creature Feature actions.'
        ])
        expect(await room.storedOgre()).toEqual(before)
      }
    }
  )

  it('refuses a Character actor', async () => {
    const room = await equipmentRoom()
    const versionBefore = await room.runVersion()

    const { answer, causes } = await room.refusedReplace({
      actorId: FIGHTER_ACTOR_ID,
      equipmentId: compatibleGreatclub.id
    })

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    expect(causes).toEqual(['Only a Creature with a frozen source can replace Equipment.'])
    expect(await room.runVersion()).toBe(versionBefore)
  })
})

describe('who may replace a loadout, and when (ATTACK-6.4)', () => {
  it('refuses a player: replacing an actor’s loadout is the GM’s', async () => {
    const room = await equipmentRoom()
    const before = await room.storedOgre()
    const versionBefore = await room.runVersion()

    const answer = await room.replace({
      equipmentId: compatibleGreatclub.id,
      via: await room.room.asPlayer()
    })

    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'GM_ONLY' })
    expect(await room.runVersion()).toBe(versionBefore)
    expect(await room.storedOgre()).toEqual(before)
  })

  it('refuses a replacement while the Ogre’s attack waits on a roll', async () => {
    const room = await equipmentRoom()
    const attacked = await room.attack(await room.runVersion())
    expect(attacked.type, JSON.stringify(attacked)).toBe('COMMAND_COMMITTED')
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (!decision) throw new Error('The attack is not waiting on a roll.')
    const before = await room.storedOgre()

    const answer = await room.replace({
      equipmentId: compatibleGreatclub.id,
      expectedVersion: decision.encounterVersion
    })

    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'PENDING_DECISION' })
    expect(await room.runVersion()).toBe(decision.encounterVersion)
    expect(await room.storedOgre()).toEqual(before)
  })

  it('refuses a replacement once the Run is completed', async () => {
    const room = await equipmentRoom()
    const commandId = crypto.randomUUID()
    const completed = await room.room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'COMPLETE',
        encounterId: room.room.encounterId,
        commandId,
        expectedVersion: await room.runVersion()
      }
    })
    expect(completed.type, JSON.stringify(completed)).toBe('COMMAND_COMMITTED')
    // A completed Run clears its actors' snapshots, so its stored rows are what must not change.
    const before = await readRoomHistory(room.room.base.stub)

    const answer = await room.replace({ equipmentId: compatibleGreatclub.id })

    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'ENCOUNTER_NOT_ACTIVE' })
    expect(await readRoomHistory(room.room.base.stub)).toEqual(before)
  })
})

/**
 * The GM replaces the Ogre's held weapon while the Ogre's attack is in flight: both are sent at the
 * same Run version before either is answered. The room runs one, refuses the other as stale, and
 * the loser, sent again at the version it now reads, runs against the winner's state.
 */
describe('a loadout replacement racing the Ogre’s attack (ATTACK-6.5, ATTACK-6.6)', () => {
  /** The room's Run history after the race: its version and the commands it committed. */
  async function settled(room: Awaited<ReturnType<typeof equipmentRoom>>) {
    const { runs, commands } = await readRoomHistory(room.room.base.stub)
    return { version: runs[0]!.version, commandIds: commands.map(({ commandId }) => commandId) }
  }

  it('replacement first: the attack is refused as stale, and its retry uses the new weapon', async () => {
    const room = await equipmentRoom('Ogre', 'GAME_MASTER')
    const start = await settled(room)
    const replacementId = crypto.randomUUID()
    const attackId = crypto.randomUUID()

    const [replaced, attacked] = await Promise.all([
      room.replace({
        equipmentId: compatibleGreatclub.id,
        commandId: replacementId,
        expectedVersion: start.version
      }),
      room.attack(start.version, attackId)
    ])

    expect(replaced.type, JSON.stringify(replaced)).toBe('COMMAND_COMMITTED')
    expect(attacked).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'VERSION_STALE' })
    const afterRace = await settled(room)
    expect(afterRace).toEqual({
      version: start.version + 1,
      commandIds: [...start.commandIds, replacementId]
    })
    const replacedOgre = await room.storedOgre()
    expect(
      snapshotCreatureEquipmentSources(replacedOgre).find(
        ({ loadoutEntryId }) => loadoutEntryId === room.heldEntryId
      )?.equipmentId
    ).toBe(compatibleGreatclub.id)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const retryId = crypto.randomUUID()
    const retried = await room.attack(afterRace.version, retryId)

    expect(retried.type, JSON.stringify(retried)).toBe('COMMAND_COMMITTED')
    expect((await settled(room)).commandIds).toEqual([...afterRace.commandIds, retryId])
    expect(snapshotCreatureEquipmentLoadout(await room.storedOgre())).toEqual(
      snapshotCreatureEquipmentLoadout(replacedOgre)
    )
  })

  it('attack first: the replacement is refused as stale, and its retry replaces the weapon', async () => {
    const room = await equipmentRoom('Ogre', 'GAME_MASTER')
    const start = await settled(room)
    const before = await room.storedOgre()
    const attackId = crypto.randomUUID()
    const replacementId = crypto.randomUUID()

    const [attacked, replaced] = await Promise.all([
      room.attack(start.version, attackId),
      room.replace({
        equipmentId: compatibleGreatclub.id,
        commandId: replacementId,
        expectedVersion: start.version
      })
    ])

    expect(attacked.type, JSON.stringify(attacked)).toBe('COMMAND_COMMITTED')
    expect(replaced).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'VERSION_STALE' })
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const afterRace = await settled(room)
    expect(afterRace.commandIds).toEqual([...start.commandIds, attackId])
    expect(afterRace.version).toBeGreaterThan(start.version)
    expect(snapshotCreatureEquipmentLoadout(await room.storedOgre())).toEqual(
      snapshotCreatureEquipmentLoadout(before)
    )

    const retryId = crypto.randomUUID()
    const retried = await room.replace({
      equipmentId: compatibleGreatclub.id,
      commandId: retryId,
      expectedVersion: afterRace.version
    })

    expect(retried.type, JSON.stringify(retried)).toBe('COMMAND_COMMITTED')
    expect(await settled(room)).toEqual({
      version: afterRace.version + 1,
      commandIds: [...afterRace.commandIds, retryId]
    })
    expect(
      snapshotCreatureEquipmentSources(await room.storedOgre()).find(
        ({ loadoutEntryId }) => loadoutEntryId === room.heldEntryId
      )?.equipmentId
    ).toBe(compatibleGreatclub.id)
  })
})

/**
 * The GM hands the Ogre a magic Greatclub +1 in place of its Greatclub, and its printed Greatclub
 * attack then hits and damages with the weapon's +1, as a Character's attack with it does.
 */
describe('a replaced magic weapon’s bonuses in the Ogre’s attack (ATTACK-6.3)', () => {
  /** The d20 modifier and the Fighter's hit points lost when the Ogre hits, each d8 showing 1. */
  async function ogreHit(replacement: EquipmentAuthored | null) {
    const room = await equipmentRoom('Ogre', 'GAME_MASTER', [greatclub, greatclubPlus1], [0, 0])
    if (replacement) {
      const replaced = await room.replace({ equipmentId: replacement.id })
      expect(replaced.type, JSON.stringify(replaced)).toBe('COMMAND_COMMITTED')
    }
    const before = await readCharacterHitPoints(room.room.base.stub, FIGHTER_ID)
    const commandId = crypto.randomUUID()
    const attacked = await room.attack(await room.runVersion(), commandId)
    expect(attacked.type, JSON.stringify(attacked)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.room.base.stub)
    const receipt = history.receipts.find(
      (candidate) => candidate.commandId === commandId && candidate.commandType === 'RESOLVE_ACTION'
    )
    if (!receipt) throw new Error('The attack receipt is missing.')
    const execution = parseReceiptExecution(receipt)
    if (execution.status !== 'COMPLETE') throw new Error('The attack did not complete.')
    const outputs = execution.applicationOutputs as { d20?: { modifier: number } | null }
    return {
      modifier: outputs.d20?.modifier,
      lost: before - (await readCharacterHitPoints(room.room.base.stub, FIGHTER_ID))
    }
  }

  it('adds the Greatclub +1’s attack and damage bonus to the printed +6 and 2d8 + 4', async () => {
    // The print governs a mundane Greatclub: its ability bonus is the stat block's alone.
    expect(await ogreHit(null)).toEqual({ modifier: 6, lost: 1 + 1 + 4 })
    expect(await ogreHit(greatclubPlus1)).toEqual({ modifier: 7, lost: 1 + 1 + 4 + 1 })
  })
})
