import { snapshotCreatureEquipmentLoadout } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterOptionalCombatSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_ATHLETICS_SKILL_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, type ActionRoomConfig } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const SOURCE_ID = testUuid(0xa00)
const TARGET_ID = testUuid(0xa01)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * Two seeded SRD Ogres: the first Disarms the item the second holds, a one-handed Club unless
 * `heldItem` is the Ogre's own two-handed Greatclub.
 */
async function disarmRoom(options: {
  autoRoll?: 'GAME_MASTER'
  rolls?: readonly number[]
  heldItem?: 'GREATCLUB'
  seed?: ActionRoomConfig['seed']
}) {
  const ogre = seededSrdCreature('Ogre')
  const holder =
    options.heldItem === 'GREATCLUB'
      ? ogre
      : {
          ...ogre,
          equipmentLoadout: ogre.equipmentLoadout?.map((entry) =>
            entry.useState === 'HELD' ? { ...entry, equipmentId: club.id } : entry
          )
        }
  const [source, target] = [
    srdCreatureActor({ id: SOURCE_ID, creature: ogre }),
    srdCreatureActor({ id: TARGET_ID, creature: holder })
  ]
  const room = await actionRoom({
    ...options,
    actors: [source!, target!],
    ownerFeatureId: creatureFeature(ogre, 'Greatclub').id,
    optionalCombatKinds: ['DISARM']
  })
  const heldEntryId = snapshotCreatureEquipmentLoadout(target!).find(
    (entry) => entry.useState === 'HELD'
  )?.id
  if (!heldEntryId) throw new Error('The target Ogre holds no item.')
  return { room, heldEntryId }
}

type Disarming = Awaited<ReturnType<typeof disarmRoom>>

/** The public Disarm choice for the first Ogre's action at the second: its held item and Athletics. */
async function disarmIntent({ room, heldEntryId }: Disarming) {
  const [run] = (await readRoomHistory(room.room.base.stub)).runs
  const state = encounterRunStateSchema.parse(JSON.parse(run!.stateJson))
  const definition = encounterOptionalCombatSnapshotDtoSchema
    .parse(state.optionalCombatSnapshot)
    .definitions.find((entry) => entry.document.kind === 'DISARM')
  if (!definition) throw new Error('The Run offers no Disarm.')
  const descriptor = await room.optionalActionChoices(
    TARGET_ID,
    definition.definitionId,
    room.sceneContext()
  )
  return {
    definitionId: descriptor.definitionId,
    optionId: descriptor.optionId,
    selectionContract: descriptor.selectionContract,
    selections: descriptor.fields.map((field) => {
      const selected = field.options.find(
        (option) => option.id === heldEntryId || option.id === SRD_ATHLETICS_SKILL_ID
      )
      if (!selected) throw new Error('Disarm did not offer the expected selection.')
      return { fieldId: field.fieldId, value: { kind: 'ENTITY' as const, entityId: selected.id } }
    })
  }
}

async function startDisarm(disarming: Disarming) {
  const { room } = disarming
  const { answer } = await room.startAction(
    TARGET_ID,
    [],
    room.sceneContext(),
    await disarmIntent(disarming)
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The settled contest's stored output, as the room alone holds it (D85). */
async function contestedOutput(disarming: Disarming) {
  const { receipts } = await readRoomHistory(disarming.room.room.base.stub)
  // The root action's receipt owns the output; a prompted roll's evidence receipts echo it.
  const outputs = receipts
    .filter((receipt) => receipt.commandType === 'RESOLVE_ACTION')
    .flatMap((receipt) => {
      const execution = parseReceiptExecution(receipt)
      return execution.status === 'COMPLETE' &&
        execution.applicationOutputs.kind === 'CONTESTED_ACTION'
        ? [execution.applicationOutputs]
        : []
    })
  expect(outputs).toHaveLength(1)
  return outputs[0]!
}

describe('room Disarm contests', () => {
  it.each([
    { outcome: 'win', targetOffset: -1 },
    { outcome: 'tie', targetOffset: 0 },
    { outcome: 'loss', targetOffset: 1 }
  ] as const)(
    'settles an auto-rolled $outcome, spending one ACTION and taking the item only on a win',
    async ({ outcome, targetOffset }) => {
      // Both Creature dice are auto-rolled in order: the initiator's, then the defender's. The
      // Ogre's Greatclub attack (+6) ties the target's Athletics (+4) when the target rolls 2 more.
      const sourceFace = 10
      const targetFace = sourceFace + 2 + targetOffset
      const disarming = await disarmRoom({
        autoRoll: 'GAME_MASTER',
        rolls: [sourceFace - 1, targetFace - 1]
      })
      await startDisarm(disarming)
      expect(await readPendingActionDecision(disarming.room.room.base.stub)).toBeNull()
      expect(disarming.room.room.diceDrawn()).toBe(2)

      const output = await contestedOutput(disarming)
      expect(output).toMatchObject({
        sourceActorId: SOURCE_ID,
        targetActorId: TARGET_ID,
        sourceRoll: {
          actorId: SOURCE_ID,
          rawFaces: [sourceFace],
          selectedNatural: sourceFace,
          total: sourceFace + 6
        },
        targetRoll: {
          actorId: TARGET_ID,
          rawFaces: [targetFace],
          selectedNatural: targetFace,
          total: targetFace + 4
        },
        outcome: outcome === 'win' ? 'SOURCE_WIN' : 'TARGET_WIN_OR_TIE',
        actionEconomyTransition: {
          definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
          beforeUsed: 0,
          afterUsed: 1
        }
      })
      expect(output.stateTransition).toMatchObject(
        outcome === 'win'
          ? {
              kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
              actorId: TARGET_ID,
              loadoutEntryId: disarming.heldEntryId,
              fromState: 'HELD',
              toState: 'CARRIED'
            }
          : { kind: 'NONE' }
      )
    }
  )

  it('uses up the initiator’s one-roll grants', async () => {
    const disarming = await disarmRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [9, 9],
      seed: seedModifierGrant({
        sourceActorId: TARGET_ID,
        holderActorId: SOURCE_ID,
        lifecycle: { consumeOnFirstEvent: 'ON_ATTACK_ROLL' }
      })
    })
    expect((await readRoomHistory(disarming.room.room.base.stub)).activeEffects).toHaveLength(1)

    await startDisarm(disarming)

    expect((await readRoomHistory(disarming.room.room.base.stub)).activeEffects).toEqual([])
  })

  it('starts a Disarm of a two-handed holder', async () => {
    const disarming = await disarmRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [9, 9],
      heldItem: 'GREATCLUB'
    })
    await startDisarm(disarming)
  })

  it('asks the initiator, then the defender, and settles from the answered faces', async () => {
    const disarming = await disarmRoom({})
    const { room } = disarming
    await startDisarm(disarming)

    const initiator = await room.pendingDecision()
    if (initiator.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the initiator’s roll.')
    expect(initiator.pending.rollerActorId).toBe(SOURCE_ID)
    const first = await room.resolve(initiator, {
      kind: 'ENTER_DICE',
      requestId: initiator.pending.request.requestId,
      rawFaces: initiator.pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: initiator.pending.request.rollMode
    })
    expect(first.type).toBe('COMMAND_COMMITTED')

    const defender = await room.pendingDecision()
    if (defender.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the defender’s roll.')
    expect(defender.pending.rollerActorId).toBe(TARGET_ID)
    expect(defender.occurrence.id).toBe(initiator.occurrence.id)
    const second = await room.resolve(defender, {
      kind: 'ENTER_DICE',
      requestId: defender.pending.request.requestId,
      rawFaces: defender.pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: defender.pending.request.rollMode
    })
    expect(second.type).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    expect(await contestedOutput(disarming)).toMatchObject({
      outcome: 'SOURCE_WIN',
      sourceRoll: { actorId: SOURCE_ID, rawFaces: [20] },
      targetRoll: { actorId: TARGET_ID, rawFaces: [1] }
    })
  })
})
