import { snapshotCreatureEquipmentLoadout } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterOptionalCombatSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import { giantApe } from '@artificer-toolkit/source-data/srd/creatures/giant-ape.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { mace } from '@artificer-toolkit/source-data/srd/equipment/mace.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_ATHLETICS_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, type ActionRoomConfig } from './actionRoomFixture.js'
import { characterInForm } from './characterFormFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorConditionIds,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const SOURCE_ID = testUuid(0xa00)
const TARGET_ID = testUuid(0xa01)
const FIGHTER_ID = testUuid(0xa02)
const BLINDED_ID = srdSystemRecord.conditionTypes.find(({ code }) => code === 'BLINDED')?.id
const INVISIBLE_ID = srdSystemRecord.conditionTypes.find(({ code }) => code === 'INVISIBLE')!.id

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The first actor Disarms the item a seeded SRD Ogre holds, a one-handed Club unless `heldItem` is
 * the Ogre's own two-handed Greatclub. The initiator is another Ogre, or with `initiator` a player's
 * Fighter wielding a Longsword the room's R2 content publishes.
 */
async function disarmRoom(options: {
  initiator?: 'CHARACTER'
  autoRoll?: 'GAME_MASTER'
  rolls?: readonly number[]
  heldItem?: 'GREATCLUB'
  targetBlinded?: true
  sourceInvisible?: true
  seed?: ActionRoomConfig['seed']
}) {
  const ogre = seededSrdCreature('Ogre')
  const holder =
    options.heldItem === 'GREATCLUB'
      ? ogre
      : {
          ...ogre,
          equipmentLoadout: ogre.equipmentLoadout?.map((entry) =>
            entry.useState === 'MAIN_HAND' ? { ...entry, equipmentId: club.id } : entry
          )
        }
  const [source, target] = [
    options.initiator === 'CHARACTER'
      ? characterActor({ id: SOURCE_ID, characterId: FIGHTER_ID })
      : srdCreatureActor({
          id: SOURCE_ID,
          creature: ogre,
          conditionIds: options.sourceInvisible ? [INVISIBLE_ID] : []
        }),
    srdCreatureActor({
      id: TARGET_ID,
      creature: holder,
      conditionIds: options.targetBlinded && BLINDED_ID ? [BLINDED_ID] : []
    })
  ]
  const initiatorSource: Partial<ActionRoomConfig> =
    options.initiator === 'CHARACTER'
      ? {
          playerControlledActorIds: [SOURCE_ID],
          characterEquipment: [longsword],
          characterAction: (action) => action.label.includes('Longsword')
        }
      : { ownerFeatureId: creatureFeature(ogre, 'Greatclub').id }
  const room = await actionRoom({
    ...options,
    actors: [source!, target!],
    ...initiatorSource,
    optionalCombatKinds: ['DISARM']
  })
  const heldEntryId = snapshotCreatureEquipmentLoadout(target!).find(
    (entry) => entry.useState === 'MAIN_HAND'
  )?.id
  if (!heldEntryId) throw new Error('The target Ogre holds no item.')
  return { room, heldEntryId }
}

/** A Disarm room and the item its defender holds; null takes the first item the defender holds. */
type Disarming = { room: Awaited<ReturnType<typeof actionRoom>>; heldEntryId: string | null }

/** The public Disarm choice for the source's action at the target: its held item and Athletics. */
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
      const selected =
        field.options.find((option) => option.id === SRD_ATHLETICS_SKILL_ID) ??
        field.options.find((option) => heldEntryId === null || option.id === heldEntryId)
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
              fromState: 'MAIN_HAND',
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
        lifecycle: { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] }
      })
    })
    expect((await readRoomHistory(disarming.room.room.base.stub)).activeEffects).toHaveLength(1)

    await startDisarm(disarming)

    expect((await readRoomHistory(disarming.room.room.base.stub)).activeEffects).toEqual([])
  })

  it('releases the condition an initiator’s ended grant owned, in the same settlement', async () => {
    const disarming = await disarmRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [9, 9],
      sourceInvisible: true,
      seed: seedModifierGrant({
        sourceActorId: TARGET_ID,
        holderActorId: SOURCE_ID,
        lifecycle: { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] },
        ownedConditionId: INVISIBLE_ID
      })
    })
    const stub = disarming.room.room.base.stub
    expect(readActorConditionIds(await readRoomHistory(stub), SOURCE_ID)).toContain(INVISIBLE_ID)

    await startDisarm(disarming)

    const settled = await readRoomHistory(stub)
    expect(settled.activeEffects).toEqual([])
    expect(readActorConditionIds(settled, SOURCE_ID)).not.toContain(INVISIBLE_ID)
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
    // A Disarm grants no speed bonus, so its action root records none for undo.
    const { commands } = await readRoomHistory(room.room.base.stub)
    expect(commands.filter((command) => command.commandType === 'RESOLVE_ACTION')).toEqual([
      expect.objectContaining({ label: 'Disarm', speedBonusTurn: null })
    ])
  })
})

describe('a Character’s room Disarm with a Longsword (ROOM-6.7, ROOM-6.8)', () => {
  it('asks the controlling player for the initiator’s roll and the GM for the Creature defender’s', async () => {
    const disarming = await disarmRoom({ initiator: 'CHARACTER' })
    const { room } = disarming
    const stub = room.room.base.stub
    await startDisarm(disarming)

    const initiator = await room.pendingDecision()
    if (initiator.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the initiator’s roll.')
    expect(initiator.pending.rollerActorId).toBe(SOURCE_ID)
    const first = await room.sendAsPlayer(
      room.resolveCommand(initiator, {
        kind: 'ENTER_DICE',
        requestId: initiator.pending.request.requestId,
        rawFaces: initiator.pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
        rollMode: initiator.pending.request.rollMode
      })
    )
    expect(first.type, JSON.stringify(first)).toBe('COMMAND_COMMITTED')

    const defender = await room.pendingDecision()
    if (defender.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the defender’s roll.')
    expect(defender.pending.rollerActorId).toBe(TARGET_ID)
    // The Large Ogre defends against a Medium Fighter with advantage (the size relation).
    expect(defender.pending.request.rollMode).toBe('ADVANTAGE')
    const defenderRoll = {
      kind: 'ENTER_DICE',
      requestId: defender.pending.request.requestId,
      rawFaces: [1, 1],
      rollMode: 'ADVANTAGE'
    }
    // The player holds only the Fighter: the Ogre's roll is the GM's.
    const refused = await room.sendAsPlayer(room.resolveCommand(defender, defenderRoll))
    expect(refused).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'NOT_ACTOR_CONTROLLER'
    })
    expect(await readPendingActionDecision(stub)).not.toBeNull()
    const second = await room.resolve(defender, defenderRoll)
    expect(second.type, JSON.stringify(second)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(stub)).toBeNull()

    const output = await contestedOutput(disarming)
    expect(output).toMatchObject({
      sourceActorId: SOURCE_ID,
      targetActorId: TARGET_ID,
      sourceRoll: { actorId: SOURCE_ID, rawFaces: [20] },
      targetRoll: { actorId: TARGET_ID, rawFaces: [1, 1], selectedNatural: 1 },
      outcome: 'SOURCE_WIN',
      actionEconomyTransition: {
        definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
        beforeUsed: 0,
        afterUsed: 1
      }
    })
    expect(output.stateTransition).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
      actorId: TARGET_ID,
      loadoutEntryId: disarming.heldEntryId,
      fromState: 'MAIN_HAND',
      toState: 'CARRIED'
    })
  })
})

describe('room Disarm against a target that cannot see (ATTACK-10.4, D100)', () => {
  it('auto-rolls the initiator in the true mode: advantage against a Blinded target', async () => {
    // The initiator's two d20s (1 then 15), then the defender's one.
    const disarming = await disarmRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [0, 14, 5],
      targetBlinded: true
    })
    await startDisarm(disarming)
    expect(disarming.room.room.diceDrawn()).toBe(3)
    expect(await contestedOutput(disarming)).toMatchObject({
      sourceRoll: { rawFaces: [1, 15], selectedNatural: 15 },
      targetRoll: { rawFaces: [6], selectedNatural: 6 }
    })
  })

  it('shows the player a normal roll, holds one die and settles in the true mode', async () => {
    const disarming = await disarmRoom({ targetBlinded: true })
    const { room } = disarming
    await startDisarm(disarming)

    const stub = room.room.base.stub
    const gmView = await room.pendingDecision()
    const playerView = await readPendingActionDecision(stub, false)
    if (gmView.pending.kind !== 'D20_EVIDENCE' || playerView?.pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the initiator’s roll.')
    expect(gmView.pending.request.rollMode).toBe('ADVANTAGE')
    expect(playerView.pending.request).toMatchObject({
      requestId: gmView.pending.request.requestId,
      rollMode: 'NORMAL',
      derivedRollModeReasons: []
    })

    // The player enters the one die their prompt asked for; the true mode needs a second.
    const held = await room.resolve(playerView, {
      kind: 'ENTER_DICE',
      requestId: playerView.pending.request.requestId,
      rawFaces: [9],
      rollMode: 'NORMAL'
    })
    expect(held.type).toBe('COMMAND_COMMITTED')
    const gmHeld = await room.pendingDecision()
    const playerHeld = await readPendingActionDecision(stub, false)
    if (gmHeld.pending.kind !== 'D20_EVIDENCE' || playerHeld?.pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected the held initiator roll.')
    const gmCaption = gmHeld.pending.request.heldD20?.caption
    const playerCaption = playerHeld.pending.request.heldD20?.caption
    expect(gmHeld.pending.request.heldD20?.faces).toEqual([9])
    expect(gmCaption).toBeTruthy()
    expect(playerCaption).toBeTruthy()
    expect(playerCaption).not.toBe(gmCaption)

    await room.resolve(gmHeld, {
      kind: 'ENTER_DICE',
      requestId: gmHeld.pending.request.requestId,
      rawFaces: [15],
      rollMode: 'NORMAL'
    })
    const defender = await room.pendingDecision()
    if (defender.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the defender’s roll.')
    expect(defender.pending.rollerActorId).toBe(TARGET_ID)
    expect(defender.pending.request.heldD20).toBeUndefined()
    await room.resolve(defender, {
      kind: 'ENTER_DICE',
      requestId: defender.pending.request.requestId,
      rawFaces: [1],
      rollMode: 'NORMAL'
    })

    expect(await contestedOutput(disarming)).toMatchObject({
      outcome: 'SOURCE_WIN',
      sourceRoll: { rawFaces: [9, 15], selectedNatural: 15 },
      targetRoll: { rawFaces: [1] }
    })
  })
})

// SPELLS-4.T2s2 (D191): Polymorph replaces the Character's proficiencies with the form's stat block.
describe('room Disarm of a Character in a form that replaces its proficiencies', () => {
  it("rolls the Character defender's contest with the form's Athletics", async () => {
    const ogre = seededSrdCreature('Ogre')
    const { actor, seed } = characterInForm({
      actorId: TARGET_ID,
      characterId: FIGHTER_ID,
      effectId: testUuid(0xa03),
      creature: giantApe,
      retainsProficiencies: false
    })
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: [9, 9, 9, 9],
      actors: [srdCreatureActor({ id: SOURCE_ID, creature: ogre }), actor],
      ownerFeatureId: creatureFeature(ogre, 'Greatclub').id,
      // A one-handed Mace: a Versatile weapon's grip would need the GM's judgment.
      characterEquipment: [mace],
      optionalCombatKinds: ['DISARM'],
      seed
    })
    const disarming = { room, heldEntryId: null }
    await startDisarm(disarming)

    const { targetRoll } = await contestedOutput(disarming)
    expect(targetRoll.actorId).toBe(TARGET_ID)
    // The Giant Ape's Athletics is +9 (Strength 23 and its CR 7 proficiency); the Fighter's is lower.
    expect(targetRoll.total - targetRoll.selectedNatural).toBe(9)
  })
})
