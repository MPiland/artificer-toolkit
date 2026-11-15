import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedTimedCondition } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { ancientRedDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-red-dragon.js'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { chainLightning } from '@artificer-toolkit/source-data/srd/spells/chain-lightning.js'
import { cloudkill } from '@artificer-toolkit/source-data/srd/spells/cloudkill.js'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import { spiritGuardians } from '@artificer-toolkit/source-data/srd/spells/spirit-guardians.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { takeDamagedRaises } from './damagedRaiseRecorder.js'
import { readLegendaryChoice, respondToLegendaryChoice } from './legendaryRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { choiceOptionIdOf, readZones } from './placedZoneRoomReads.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'
import { seedTurnSaveEffect } from './turnEvidenceFixture.js'

vi.mock('@artificer-toolkit/rules-runtime/events/encounterEventHooks', async (importOriginal) =>
  (await import('./damagedRaiseRecorder.js')).recordingDamagedRaises(importOriginal)
)
// The rooms load their modules again, so they meet the recording discovery (damagedRaiseRecorder.ts).
vi.resetModules()

/**
 * QUALITY-14.T2e2f2 (D220, D132 amendment): a turn raises DAMAGED(AFTER) once per turn-effect or
 * turn-zone execution and holder, and once per Legendary Action and holder, since a Legendary Action
 * is its own command. The turn root carries that discovery to the saves its damage owes, so the
 * room never raises a holder's damage again to find them.
 */

const FIRST_ID = testUuid(0xf20)
const SECOND_ID = testUuid(0xf21)
const LAUGHTER_EFFECT_ID = testUuid(0xf22)
const FIRST_DRAGON_ID = testUuid(0xf23)
const SECOND_DRAGON_ID = testUuid(0xf24)
const CASTER_ACTOR_ID = testUuid(0xf25)
const CASTER_ID = testUuid(0xf26)
const SECOND_CASTER_ACTOR_ID = testUuid(0xf2a)
const SECOND_CASTER_ID = testUuid(0xf2b)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** Hideous Laughter, cast by `sourceActorId`, held by `holderActorId`: it repeats its save on damage. */
function laughterSeed(sourceActorId: string, holderActorId: string) {
  return async ({
    effects,
    encounterId,
    occurredAt
  }: Parameters<NonNullable<Parameters<typeof movementRoom>[0]['seed']>>[0]) => {
    const planned = plannedTimedCondition({
      encounterId,
      sourceActorId,
      holderActorId,
      spell: hideousLaughter,
      lifetimeScope: 'ENCOUNTER'
    })
    await effects.create({
      id: LAUGHTER_EFFECT_ID,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: holderActorId },
      definition: planned.definition,
      lifecycle: planned.lifecycle,
      occurredAt
    })
  }
}

/** The effect repeat saves the room's receipts hold. */
async function repeatSavesOf(stub: Parameters<typeof readRoomHistory>[0]) {
  return (await readRoomHistory(stub)).receipts.flatMap((receipt) => {
    const result = parseReceiptExecution(receipt)
    return result.status === 'COMPLETE' &&
      result.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      result.applicationOutputs.source === 'EFFECT_REPEAT_SAVE'
      ? [result.applicationOutputs]
      : []
  })
}

describe('a turn effect that damages a Hideous Laughter holder (QUALITY-14.T2e2f2)', () => {
  it('raises the holder’s damage once, and owes its one repeat save', async () => {
    const first = srdCreatureActor({ id: FIRST_ID, creature: plainWolf })
    const second = srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
    const room = await movementRoom({
      actors: [first, second],
      moverActorId: FIRST_ID,
      positions: { [FIRST_ID]: { x: 150, y: 150 }, [SECOND_ID]: { x: 250, y: 150 } },
      autoRoll: 'GAME_MASTER',
      // A natural 1 fails the DC 30 turn save (1 damage); the repeat save rolls 1s with Advantage.
      rolls: [0, 0, 0],
      definitions: [],
      seed: async (input) => {
        await seedTurnSaveEffect({
          effects: input.effects,
          encounterId: input.encounterId,
          actor: second,
          stage: 'START_OF_TURN',
          ticks: 1,
          damage: 1,
          occurredAt: input.occurredAt
        })
        await laughterSeed(FIRST_ID, SECOND_ID)(input)
      }
    })
    const before = await readRoomHistory(room.base.stub)

    takeDamagedRaises()
    const commandId = crypto.randomUUID()
    const answer = await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: before.runs[0]!.version
      }
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    expect(takeDamagedRaises().room).toEqual([SECOND_ID])
    expect(await repeatSavesOf(room.base.stub)).toMatchObject([
      { outcome: 'SAVE_FAILURE', activeEffect: { id: LAUGHTER_EFFECT_ID } }
    ])
  }, 120000)
})

/** A Medium Creature with the SRD Ancient Red Dragon's Tail and its Legendary Tail Attack. */
const tailDragon: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0xf27),
  features: [
    ...(plainWolf.features ?? []),
    (() => {
      const tail = creatureFeature(ancientRedDragon, 'Tail')
      return {
        ...tail,
        rollDefinitions: [
          {
            id: testUuid(0xf29),
            label: 'Tail attack',
            kind: 'ATTACK' as const,
            expression: { count: 1, die: 20, modifier: 17 },
            rollMode: 'NORMAL' as const,
            chargeCost: null,
            order: 1
          }
        ]
      }
    })(),
    (() => {
      const legendary = creatureFeature(ancientRedDragon, 'Legendary Actions')
      return {
        ...legendary,
        options: legendary.options?.filter((option) => option.actionReference)
      }
    })()
  ]
}

/** A Wolf with the hit points to take two Tail hits. */
const sturdyWolf: CreatureAuthored = { ...plainWolf, id: testUuid(0xf28), hitPoints: 100 }

describe('Legendary Actions that damage a Hideous Laughter holder (QUALITY-14.T2e2f2)', () => {
  it('raise the holder’s damage once per Legendary Action, each its own command', async () => {
    // The Wolf whose turn ends is not the holder, so the holder's own turn-end save stays out.
    const room = await movementRoom({
      actors: [
        srdCreatureActor({ id: SECOND_ID, creature: plainWolf, disposition: 'FRIENDLY' }),
        srdCreatureActor({ id: FIRST_ID, creature: sturdyWolf, disposition: 'FRIENDLY' }),
        srdCreatureActor({ id: FIRST_DRAGON_ID, creature: tailDragon, disposition: 'HOSTILE' }),
        srdCreatureActor({ id: SECOND_DRAGON_ID, creature: tailDragon, disposition: 'HOSTILE' })
      ],
      moverActorId: SECOND_ID,
      positions: {
        [SECOND_ID]: { x: 150, y: 150 },
        [FIRST_ID]: { x: 250, y: 150 },
        [FIRST_DRAGON_ID]: { x: 350, y: 150 },
        [SECOND_DRAGON_ID]: { x: 250, y: 250 }
      },
      autoRoll: 'GAME_MASTER',
      // Every die shows a 19: each Tail hits.
      rolls: [],
      fallbackRoll: 18,
      seed: laughterSeed(FIRST_DRAGON_ID, FIRST_ID)
    })
    const before = await readRoomHistory(room.base.stub)

    takeDamagedRaises()
    const commandId = crypto.randomUUID()
    const advanced = await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: before.runs[0]!.version
      }
    })
    expect(advanced.type, JSON.stringify(advanced)).toBe('COMMAND_COMMITTED')
    expect(takeDamagedRaises().room).toEqual([])
    // Each answer is its own command and raises once per Legendary Action it runs. The second, which
    // commits the turn, runs the first window again from its retained dice before its own.
    for (const [ownerActorId, raised] of [
      [FIRST_DRAGON_ID, [FIRST_ID]],
      [SECOND_DRAGON_ID, [FIRST_ID, FIRST_ID]]
    ] as const) {
      const choice = await readLegendaryChoice(room.base.stub)
      const option = choice?.options[0]
      if (choice?.ownerActorId !== ownerActorId || !option)
        throw new Error(`Expected ${ownerActorId}’s Legendary option.`)
      const { answer } = await respondToLegendaryChoice(room, {
        kind: 'LEGENDARY_OPTION',
        optionId: option.optionId,
        targetActorId: FIRST_ID
      })
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      expect(takeDamagedRaises().room).toEqual(raised)
    }

    const receipt = (await readRoomHistory(room.base.stub)).receipts.find(
      (candidate) => candidate.commandId === commandId
    )
    if (!receipt) throw new Error('The room holds no ADVANCE_TURN receipt.')
    const result = parseReceiptExecution(receipt)
    expect('legendaryActions' in result ? result.legendaryActions : undefined).toMatchObject([
      { resolution: { kind: 'EXECUTED', targetActorId: FIRST_ID } },
      { resolution: { kind: 'EXECUTED', targetActorId: FIRST_ID } }
    ])
  }, 120000)
})

describe('a turn zone that damages a Hideous Laughter holder at its turn start (QUALITY-14.T2e2f2)', () => {
  it('raises the holder’s damage once, and owes its one repeat save', async () => {
    const zoneCenter = { x: 600, y: 600 }
    const room = await actionRoom({
      actors: [
        {
          ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
          snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
        },
        srdCreatureActor({ id: SECOND_ID, creature: brownBear })
      ],
      positions: { [SECOND_ID]: zoneCenter },
      characterSpellcasting: { spells: [cloudkill, chainLightning], prepared: [cloudkill.id] },
      characterAction: (action) => action.label === 'Cloudkill (5th level)',
      autoRoll: 'EVERYONE',
      // Every die shows a 1: each save fails and each damage die is a 1.
      fallbackRoll: 0,
      seed: laughterSeed(CASTER_ACTOR_ID, SECOND_ID)
    })
    const { answer: cast } = await room.startAreaAction(zoneCenter)
    expect(cast.type, JSON.stringify(cast)).toBe('COMMAND_COMMITTED')
    expect(await readZones(room)).toHaveLength(1)
    const savesBefore = (await repeatSavesOf(room.room.base.stub)).length

    // The caster's turn ends outside the area; the Brown Bear's turn starts in it.
    takeDamagedRaises()
    await room.advanceTurn()

    expect(takeDamagedRaises().room).toEqual([SECOND_ID])
    expect((await repeatSavesOf(room.room.base.stub)).slice(savesBefore)).toMatchObject([
      { outcome: 'SAVE_FAILURE', activeEffect: { id: LAUGHTER_EFFECT_ID } }
    ])
  }, 120000)
})

describe('overlapping turn zones that damage a Hideous Laughter holder at its turn start (QUALITY-14.T2e2f4)', () => {
  it('raise the holder’s damage once per zone, in the room and its commit, and owe a repeat save per zone', async () => {
    // The Brown Bear stands in the Cloudkill (centered 15 feet east) and in the second caster's
    // Spirit Guardians (15 feet west); the second caster stands 30 feet from the Cloudkill's center.
    const holderAt = { x: 600, y: 600 }
    const room = await actionRoom({
      actors: [
        {
          ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
          snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
        },
        {
          ...characterActor({ id: SECOND_CASTER_ACTOR_ID, characterId: SECOND_CASTER_ID }),
          snapshot: {
            kind: 'CHARACTER' as const,
            id: SECOND_CASTER_ID,
            systemId: srdSystemRecord.id
          }
        },
        srdCreatureActor({ id: SECOND_ID, creature: brownBear })
      ],
      positions: { [SECOND_CASTER_ACTOR_ID]: { x: 300, y: 600 }, [SECOND_ID]: holderAt },
      characterSpellcasting: { spells: [cloudkill], prepared: [cloudkill.id] },
      characterAction: (action) => action.label === 'Cloudkill (5th level)',
      secondCharacter: {
        characterId: SECOND_CASTER_ID,
        spellcasting: { spells: [spiritGuardians], prepared: [spiritGuardians.id] }
      },
      autoRoll: 'EVERYONE',
      // Every die shows a 1: each save fails and each damage die is a 1.
      fallbackRoll: 0,
      seed: laughterSeed(CASTER_ACTOR_ID, SECOND_ID)
    })
    const { answer: cloud } = await room.startAreaAction({ x: 900, y: 600 })
    expect(cloud.type, JSON.stringify(cloud)).toBe('COMMAND_COMMITTED')
    await room.advanceTurn()
    const guardians = (await room.actionChoices(SECOND_CASTER_ACTOR_ID)).actions.find(
      (action) => action.label === 'Spirit Guardians (3rd level)'
    )
    if (!guardians) throw new Error('The second caster offers no Spirit Guardians.')
    await room.commit({
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: SECOND_CASTER_ACTOR_ID,
      target: {
        kind: 'CASTER_CENTERED',
        unaffectedActorIds: [CASTER_ACTOR_ID],
        choiceOptionId: choiceOptionIdOf(spiritGuardians, 'Radiant'),
        sceneId: room.room.scene.id,
        expectedSceneVersion: room.room.scene.version
      },
      actionId: guardians.id,
      optionalCombatIntent: null,
      sceneContext: null
    })
    expect(await readZones(room)).toHaveLength(2)
    const savesBefore = (await repeatSavesOf(room.room.base.stub)).length

    // The second caster's turn ends outside the Cloudkill; the Brown Bear's turn starts in both zones.
    takeDamagedRaises()
    await room.advanceTurn()

    // The commit re-runs each zone's raise and checks the save chain against those raises (D220
    // amendment), so it derives no discovery of its own.
    expect(takeDamagedRaises()).toEqual({
      room: [SECOND_ID, SECOND_ID],
      commit: [SECOND_ID, SECOND_ID]
    })
    expect((await repeatSavesOf(room.room.base.stub)).slice(savesBefore)).toMatchObject([
      { outcome: 'SAVE_FAILURE', activeEffect: { id: LAUGHTER_EFFECT_ID } },
      { outcome: 'SAVE_FAILURE', activeEffect: { id: LAUGHTER_EFFECT_ID } }
    ])
  }, 120000)
})
