import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import {
  SRD_CREATURE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xf00)
const FIGHTER_ID = testUuid(0xf01)
const BITER_ID = testUuid(0xf02)
const TARGET_ID = testUuid(0xf03)

/** No Scene measures the vial's touch range (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
// SRD "Targeting Yourself" (D99): a non-attack, non-hostile action may target its own user.
const SELF: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
const EXCLUDED: EncounterRuleWarningCodeDto = 'TARGET_CREATURE_TYPE_EXCLUDED'

const creatureTypeId = (code: string) => {
  const type = SRD_CREATURE_TYPES.find((candidate) => candidate.code === code)
  if (!type) throw new Error(`The SRD has no ${code} creature type.`)
  return type.id
}

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The Fighter (who acts first) holds the real SRD Antitoxin; the biter acts second and its Bite
 * makes the Constitution save the Antitoxin is about. No roller auto-rolls, so each save waits
 * as a prompt that shows its derived mode.
 */
function antitoxinRoom(
  biteDamageType: 'POISON' | undefined,
  target: { creature: typeof plainWolf } | 'FIGHTER' = { creature: plainWolf }
) {
  const biter = biteWolf('SAVE', {
    save: { ability: 'CONSTITUTION', damageTypeCode: biteDamageType }
  })
  const biterActor = srdCreatureActor({ id: BITER_ID, creature: biter })
  const targetActor =
    target === 'FIGHTER' ? null : srdCreatureActor({ id: TARGET_ID, creature: target.creature })
  return actionRoom({
    rolls: [],
    actors: [
      {
        ...characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: FIGHTER_ID, systemId: srdSystemRecord.id }
      },
      biterActor,
      ...(targetActor ? [targetActor] : [])
    ],
    characterEquipment: [antitoxinVial],
    characterAction: (action) => action.label === antitoxinVial.label
  }).then((room) => ({
    room,
    biteActionId: room.featureActionId(biterActor, creatureFeature(biter, 'Bite').id)
  }))
}

type Fixture = Awaited<ReturnType<typeof antitoxinRoom>>

/** The biter's Bite at `targetId`, left waiting on the target's saving throw. */
async function biteAndReadSave(fixture: Fixture, targetId: string) {
  const { answer } = await fixture.room.startAction(
    targetId,
    [],
    null,
    null,
    fixture.biteActionId,
    BITER_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await fixture.room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the saving throw.')
  return decision.pending
}

async function useAntitoxin(fixture: Fixture, targetId: string, warnings = RANGE) {
  const used = await fixture.room.startAction(targetId, warnings)
  expect(used.answer.type, JSON.stringify(used.answer)).toBe('COMMAND_COMMITTED')
  return used.command
}

describe('an Antitoxin used in an Assisted Run (SPELLS-5.1)', () => {
  it('gives a creature advantage on saves against poison for an hour, and only those', async () => {
    const poison = await antitoxinRoom('POISON')
    await useAntitoxin(poison, TARGET_ID)
    const { activeEffects } = await readRoomHistory(poison.room.room.base.stub)
    expect(activeEffects).toHaveLength(1)
    expect(activeEffects[0]).toMatchObject({ targetActorId: TARGET_ID })
    await poison.room.advanceTurn()
    expect(await biteAndReadSave(poison, TARGET_ID)).toMatchObject({
      rollerActorId: TARGET_ID,
      request: { rollMode: 'ADVANTAGE' }
    })

    const other = await antitoxinRoom(undefined)
    await useAntitoxin(other, TARGET_ID)
    await other.room.advanceTurn()
    expect(await biteAndReadSave(other, TARGET_ID)).toMatchObject({
      rollerActorId: TARGET_ID,
      request: { rollMode: 'NORMAL' }
    })
  })

  it('gives a Character the same advantage', async () => {
    const fixture = await antitoxinRoom('POISON', 'FIGHTER')
    await useAntitoxin(fixture, FIGHTER_ACTOR_ID, SELF)
    const { characterEffects } = await readRoomHistory(fixture.room.room.base.stub)
    expect(characterEffects).toHaveLength(1)
    await fixture.room.advanceTurn()
    expect(await biteAndReadSave(fixture, FIGHTER_ACTOR_ID)).toMatchObject({
      rollerActorId: FIGHTER_ACTOR_ID,
      request: { rollMode: 'ADVANTAGE' }
    })
  })

  it('warns, overridably, for an undead target and applies nothing until it is overridden', async () => {
    const fixture = await antitoxinRoom('POISON', {
      creature: { ...plainWolf, creatureTypeId: creatureTypeId('UNDEAD') }
    })
    const refused = await fixture.room.startAction(TARGET_ID, RANGE)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain(EXCLUDED)
    const untouched = await readRoomHistory(fixture.room.room.base.stub)
    expect(untouched.activeEffects).toEqual([])

    await useAntitoxin(fixture, TARGET_ID, [...RANGE, EXCLUDED])
    const applied = await readRoomHistory(fixture.room.room.base.stub)
    expect(applied.activeEffects).toHaveLength(1)
  })
})

describe('a GM undo of an Antitoxin use (SPELLS-5.2)', () => {
  it('removes the grant, returns the Action and leaves the use on the record', async () => {
    const fixture = await antitoxinRoom('POISON')
    const used = await useAntitoxin(fixture, TARGET_ID)
    const undone = await fixture.room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: fixture.room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await fixture.room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(fixture.room.room.base.stub)
    expect(history.activeEffects).toEqual([])
    expect(history.commands.map(({ commandType }) => commandType)).toEqual(
      expect.arrayContaining(['RESOLVE_ACTION', 'REVERT_LAST_ACTION'])
    )
    expect(history.receipts.some(({ commandId }) => commandId === used.commandId)).toBe(true)

    // The Action is back: the same use needs no allowance override, and the grant returns.
    await useAntitoxin(fixture, TARGET_ID)
    expect((await readRoomHistory(fixture.room.room.base.stub)).activeEffects).toHaveLength(1)
    await fixture.room.advanceTurn()
    expect(await biteAndReadSave(fixture, TARGET_ID)).toMatchObject({
      request: { rollMode: 'ADVANTAGE' }
    })
  })
})
