import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { encounterAttackActionState } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { applyCreatureAttackRolls } from '@artificer-toolkit/source-data/srd/creatures/attack-rolls.js'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { CREATURE_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { findFamiliar } from '@artificer-toolkit/source-data/srd/spells/find-familiar.js'
import { creatureTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-31.T4v2a (D156): Pact of the Chain is a DELEGATED_ATTACK grant. On its Warlock's turn, the
 * familiar Find Familiar conjured attacks in place of one attack of the Warlock's Attack action: the
 * familiar spends its reaction, the Warlock its Action and that attack, and undo restores both.
 */

const CHARACTER_ACTOR_ID = testUuid(0xb60)
const CHARACTER_ID = testUuid(0xb61)
const WOLF_ID = testUuid(0xb62)

const WOLF = srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK') })

/** No Scene measures the reach (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const PACT_OF_THE_CHAIN = srdByLabel(
  srdByLabel(warlock.features ?? [], 'Pact Boon').options ?? [],
  'Pact of the Chain'
)

/** Pact of the Chain's grants, carried as a Feature gained at 1st level. */
const pactFeature = (grants = PACT_OF_THE_CHAIN.grants): ClassFeature => ({
  id: PACT_OF_THE_CHAIN.id,
  label: PACT_OF_THE_CHAIN.label,
  description: PACT_OF_THE_CHAIN.description,
  availableAtLevel: 1,
  order: 90,
  grants: { modifiers: grants?.modifiers ?? [] }
})

const summonForm = () => {
  const outcome = findFamiliar.effects
    ?.flatMap((effect) => effect.paths)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
    .find((candidate) => candidate.effectKind === 'MANIFEST' && candidate.manifestKind === 'SUMMON')
  const form =
    outcome?.effectKind === 'MANIFEST'
      ? outcome.forms?.find((candidate) => candidate.creatureId === CREATURE_IDS.CAT)
      : undefined
  if (!form) throw new Error('Find Familiar must offer the Cat form.')
  return form
}

/**
 * A 5th-level Warlock (first in the order) who prepares Find Familiar, then a Wolf. Every d20 shows
 * 19 and every damage die 1.
 */
function chainRoom(feature: ClassFeature = pactFeature()) {
  return actionRoom({
    rolls: [18],
    fallbackRoll: 0,
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      WOLF
    ],
    characterClassFeatures: [feature],
    characterPlay: { characterClass: warlock, classLevel: 5 },
    characterSpellcasting: { spells: [findFamiliar], prepared: [findFamiliar.id] },
    characterAction: (action) => action.label.startsWith(findFamiliar.label),
    formCreatures: [applyCreatureAttackRolls(cat)]
  })
}
type ChainRoom = Awaited<ReturnType<typeof chainRoom>>

async function storedActor(room: ChainRoom, actorId: string) {
  const row = (await readRoomHistory(room.room.base.stub)).actors.find(
    (candidate) => readStoredRunActor(candidate).id === actorId
  )
  if (!row) throw new Error('The actor is not stored.')
  return readStoredRunActor(row)
}

async function currentActorId(room: ChainRoom) {
  const [run] = (await readRoomHistory(room.room.base.stub)).runs
  return run ? readRunState(run).currentActorId : undefined
}

/**
 * The Warlock casts Find Familiar one square below itself, then the turns go round to the Warlock
 * again with its Action back. Returns the familiar and its Claws attack.
 */
async function summonFamiliar(room: ChainRoom) {
  const cast = await room.startAreaCommand({
    kind: 'POINT',
    point: { x: 150, y: 250 },
    formId: summonForm().id,
    creatureTypeId: creatureTypeId('FEY')
  })
  expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
  const actors = (await readRoomHistory(room.room.base.stub)).actors.map((row) =>
    readStoredRunActor(row)
  )
  const familiar = actors.find((actor) => actor.owner?.ownerActorId === CHARACTER_ACTOR_ID)
  if (!familiar) throw new Error('The cast conjured no familiar.')
  for (let turn = 0; turn < 4; turn += 1) {
    await room.advanceTurn()
    if ((await currentActorId(room)) === CHARACTER_ACTOR_ID) break
  }
  expect(await currentActorId(room)).toBe(CHARACTER_ACTOR_ID)
  // The action's identity names the actor, its feature and its effect, so the Cat's stat block
  // under the familiar's id discovers it.
  const form = srdCreatureActor({ id: familiar.id, creature: applyCreatureAttackRolls(cat) })
  return { familiar, clawsId: room.featureActionId(form, creatureFeature(cat, 'Claws').id) }
}

/** The familiar's attack at the Wolf, commanded by the Warlock; the room's answer, not yet checked. */
async function delegatedAttack(
  room: ChainRoom,
  familiarId: string,
  actionId: string,
  optionalCombatIntent: ResolveEncounterActionInputDto['optionalCombatIntent'] = null
) {
  const command: ResolveEncounterActionInputDto = {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: RANGE,
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: familiarId,
    delegatingActorId: CHARACTER_ACTOR_ID,
    target: { kind: 'ACTOR', actorId: WOLF_ID },
    actionId,
    optionalCombatIntent,
    sceneContext: null
  }
  return { command, answer: await room.send(command) }
}

/** Rolls and settles every roll the pending action asks for. */
async function settlePendingAction(room: ChainRoom) {
  const { stub } = room.room.base
  for (
    let decision = await readPendingActionDecision(stub);
    decision;
    decision = await readPendingActionDecision(stub)
  ) {
    expect((await room.rollDice(decision)).type).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(stub)).evidenceRolls.at(-1)
    if (!held || !('request' in decision.pending)) throw new Error('The roll was not held.')
    const settled = await room.resolve(decision, {
      kind: 'SYSTEM_ROLL',
      requestId: decision.pending.request.requestId,
      rollId: held.id
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
  }
}

async function settledBatch(room: ChainRoom, commandId: string) {
  const receipt = (await readRoomHistory(room.room.base.stub)).receipts.find(
    (row) => row.commandId === commandId && row.commandType === 'RESOLVE_ACTION'
  )
  if (!receipt) throw new Error('The action receipt is missing.')
  const result = parseReceiptExecution(receipt)
  if (result.status !== 'COMPLETE') throw new Error('Expected a settled action.')
  const outputs = result.applicationOutputs
  if (outputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
    throw new Error(`Expected a Creature batch, not ${outputs.kind}.`)
  return outputs
}

describe('room Pact of the Chain delegated attack (SPELLS-31.T4v2a)', () => {
  it('lets the familiar attack with its reaction in place of one of the Warlock’s attacks, and undoes both charges as one', async () => {
    const room = await chainRoom()
    const { familiar, clawsId } = await summonFamiliar(room)
    const before = {
      caster: await storedActor(room, CHARACTER_ACTOR_ID),
      familiar: await storedActor(room, familiar.id)
    }

    const attack = await delegatedAttack(room, familiar.id, clawsId)
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)

    const batch = await settledBatch(room, attack.command.commandId)
    // The familiar makes the attack and spends one allowance: its reaction.
    expect(batch).toMatchObject({
      sourceActorId: familiar.id,
      targetActorId: WOLF_ID,
      actionEconomyTransition: { beforeUsed: 0, afterUsed: 1 }
    })
    expect(batch.attackActionTransition).toBeUndefined()
    expect(batch.applications.some((application) => application.kind === 'DAMAGE')).toBe(true)
    // The Warlock spends its Action on the Attack action and forgoes its one attack.
    expect(batch.delegatingActorSpend).toMatchObject({
      actorId: CHARACTER_ACTOR_ID,
      actionEconomyTransition: { beforeUsed: 0, afterUsed: 1 }
    })
    expect(batch.delegatingActorSpend?.actionEconomyTransition?.definitionId).not.toBe(
      batch.actionEconomyTransition?.definitionId
    )
    const caster = await storedActor(room, CHARACTER_ACTOR_ID)
    expect(encounterAttackActionState(caster)?.attacks).toHaveLength(1)
    expect(await storedActor(room, familiar.id)).not.toEqual(before.familiar)

    // Its one attack is gone, so the Warlock has none left to forgo.
    const again = await delegatedAttack(room, familiar.id, clawsId)
    expect(again.answer.type).toBe('COMMAND_REJECTED')

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const restored = {
      caster: await storedActor(room, CHARACTER_ACTOR_ID),
      familiar: await storedActor(room, familiar.id)
    }
    expect(restored.caster.resources).toEqual(before.caster.resources)
    expect(restored.familiar.resources).toEqual(before.familiar.resources)
  }, 180000)

  it('lists the familiar’s attack among the Warlock’s choices until its one attack is forgone (T4v2b)', async () => {
    const room = await chainRoom()
    expect(
      (await room.actionChoices(CHARACTER_ACTOR_ID)).actions.filter(
        ({ delegateActorId }) => delegateActorId
      )
    ).toEqual([])
    const { familiar, clawsId } = await summonFamiliar(room)

    const offered = await room.actionChoices(CHARACTER_ACTOR_ID)
    const claws = offered.actions.find(({ id }) => id === clawsId)
    expect(claws).toMatchObject({
      delegateActorId: familiar.id,
      label: 'Claws',
      sourceLabel: familiar.label,
      target: { kind: 'ACTOR' },
      attackSlot: { number: 1, total: 1 },
      warnings: []
    })
    // Only attacks are delegated, and the drawer never preselects one over the Warlock's own.
    expect(
      offered.actions.filter(({ delegateActorId }) => delegateActorId).map(({ id }) => id)
    ).toEqual([clawsId])
    expect(offered.defaultActionId).not.toBe(clawsId)

    const attack = await delegatedAttack(room, familiar.id, clawsId)
    expect(attack.answer.type, JSON.stringify(attack.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)

    // Its one attack is forgone, so nothing is left to replace, as the room would refuse.
    expect(
      (await room.actionChoices(CHARACTER_ACTOR_ID)).actions.some(({ id }) => id === clawsId)
    ).toBe(false)
  }, 180000)

  it('offers no delegated attack to a Warlock without the grant', async () => {
    const ungranted = await chainRoom(pactFeature({ modifiers: [] }))
    const { clawsId } = await summonFamiliar(ungranted)
    expect(
      (await ungranted.actionChoices(CHARACTER_ACTOR_ID)).actions.some(({ id }) => id === clawsId)
    ).toBe(false)
  }, 180000)

  it('refuses a delegated attack from a Warlock without the grant, by a creature it did not summon, or off its turn', async () => {
    const ungranted = await chainRoom(pactFeature({ modifiers: [] }))
    const { familiar, clawsId } = await summonFamiliar(ungranted)
    const refused = await delegatedAttack(ungranted, familiar.id, clawsId)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain('SOURCE_REQUIREMENTS_NOT_MET')

    const room = await chainRoom()
    const summoned = await summonFamiliar(room)
    const wolfBite = await delegatedAttack(
      room,
      WOLF_ID,
      room.featureActionId(WOLF, creatureFeature(biteWolf('ATTACK'), 'Bite').id)
    )
    expect(wolfBite.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(wolfBite.answer)).toContain('SOURCE_REQUIREMENTS_NOT_MET')

    // An optional combat action (Disarm) is not an attack the Warlock forgoes.
    const disarm = await delegatedAttack(room, summoned.familiar.id, summoned.clawsId, {
      optionId: 'a'.repeat(64),
      definitionId: testUuid(0xb63),
      selectionContract: 'b'.repeat(64),
      selections: []
    })
    expect(disarm.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(disarm.answer)).toContain('one ordinary attack at one creature')

    // Off the Warlock's turn the familiar attacks for no one.
    await room.advanceTurn()
    const offTurn = await delegatedAttack(room, summoned.familiar.id, summoned.clawsId)
    expect(offTurn.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(offTurn.answer)).toContain('NOT_CURRENT_ACTOR')
  }, 180000)
})
