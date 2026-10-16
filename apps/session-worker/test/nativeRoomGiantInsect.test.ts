import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { CREATURE_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { applyCreatureAttackRolls } from '@artificer-toolkit/source-data/srd/creatures/attack-rolls.js'
import { giantCentipede } from '@artificer-toolkit/source-data/srd/creatures/giant-centipede.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { giantInsect } from '@artificer-toolkit/source-data/srd/spells/giant-insect.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const CHARACTER_ACTOR_ID = testUuid(0x8c0)
const CHARACTER_ID = testUuid(0x8c1)
const BEAST_IDS = [0x8c2, 0x8c3].map(testUuid)
const RANGE_UNCHECKED: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
const FORMS = (giantInsect.effects ?? []).flatMap((effect) =>
  effect.paths.flatMap((path) =>
    path.selectionKind === 'FIXED'
      ? path.resultBlock.outcomes.flatMap((outcome) =>
          outcome.effectKind === 'MANIFEST' && outcome.manifestKind === 'CREATURE'
            ? (outcome.forms ?? [])
            : []
        )
      : []
  )
)
const formOf = (creatureId: string) => FORMS.find((form) => form.creatureId === creatureId)!
const CENTIPEDES = formOf(CREATURE_IDS.GIANT_CENTIPEDE)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** Giant Insect the way an author could build it with a one-round duration: the form ends in one turn. */
function oneRoundInsect(): SpellAuthored {
  const spell = structuredClone(giantInsect)
  const path = spell.effects?.[0]?.paths[0]
  if (path?.selectionKind !== 'FIXED' || !path.resultBlock.duration)
    throw new Error('Giant Insect must author a fixed duration.')
  path.resultBlock.duration = {
    ...path.resultBlock.duration,
    durationKind: 'ROUND',
    amount: 1
  }
  return spell
}

const insectRoom = (
  config: { spell?: SpellAuthored; rolls?: readonly number[]; extraSpells?: SpellAuthored[] } = {}
) => {
  const spell = config.spell ?? giantInsect
  const spells = [spell, ...(config.extraSpells ?? [])]
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      ...BEAST_IDS.map((id) =>
        srdCreatureActor({ id, creature: plainWolf, disposition: 'FRIENDLY' })
      )
    ],
    characterSpellcasting: { spells, prepared: spells.map(({ id }) => id) },
    formCreatures: [applyCreatureAttackRolls(giantCentipede)],
    characterAction: (action) => action.label.startsWith(spell.label),
    rolls: config.rolls ?? [],
    fallbackRoll: 5
  })
}

/** What the room stores of each beast, as the form swap and its undo must restore it exactly. */
const beastRows = (history: RoomHistory) =>
  BEAST_IDS.map((id) => {
    const row = history.actors.find((actor) => actor.id === id)!
    return {
      id,
      stateJson: row.stateJson,
      stateChecksum: row.stateChecksum,
      snapshotChecksum: row.snapshotChecksum,
      formOriginSnapshotChecksum: row.formOriginSnapshotChecksum,
      sourceFactsChecksum: row.sourceFactsChecksum
    }
  })

const commit = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

describe('Giant Insect swaps the chosen creatures into the chosen form (SPELLS-28.1)', () => {
  it('turns each beast into a Giant Centipede for the duration, and undoes the cast byte for byte', async () => {
    const room = await insectRoom()
    const before = beastRows(await readRoomHistory(room.room.base.stub))

    commit(
      (await room.startActorsAction(BEAST_IDS, RANGE_UNCHECKED, false, null, CENTIPEDES.id)).answer
    )

    const cast = await readRoomHistory(room.room.base.stub)
    expect(cast.activeEffects.map((effect) => effect.targetActorId).sort()).toEqual(
      [...BEAST_IDS].sort()
    )
    for (const id of BEAST_IDS) {
      const row = cast.actors.find((actor) => actor.id === id)!
      const effect = cast.activeEffects.find((candidate) => candidate.targetActorId === id)!
      const state = JSON.parse(row.stateJson)
      expect(state).toMatchObject({
        sourceId: CREATURE_IDS.GIANT_CENTIPEDE,
        currentHitPoints: giantCentipede.hitPoints,
        form: { effectId: effect.id, excessDamageCarriesOver: false }
      })
      expect(row.formOriginSnapshotChecksum).not.toBeNull()
      expect(JSON.parse(effect.definitionJson).stateContributions).toEqual([
        expect.objectContaining({
          kind: 'CREATURE_FORM',
          creatureId: CREATURE_IDS.GIANT_CENTIPEDE,
          excessDamageCarriesOver: false
        })
      ])
    }

    commit(
      await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
    )
    const reverted = await readRoomHistory(room.room.base.stub)
    expect(reverted.activeEffects).toHaveLength(0)
    expect(beastRows(reverted)).toEqual(before)
  }, 120000)

  it('turns each beast back, whole, when the duration runs out', async () => {
    const room = await insectRoom({ spell: oneRoundInsect() })
    const before = beastRows(await readRoomHistory(room.room.base.stub))

    commit(
      (await room.startActorsAction(BEAST_IDS, RANGE_UNCHECKED, false, null, CENTIPEDES.id)).answer
    )
    expect(beastRows(await readRoomHistory(room.room.base.stub))).not.toEqual(before)

    // The form counts the beast's own turns: a round later each has ended one.
    for (let turn = 0; turn <= BEAST_IDS.length; turn++) await room.advanceTurn()
    const expired = await readRoomHistory(room.room.base.stub)
    expect(expired.activeEffects).toHaveLength(0)
    expect(beastRows(expired)).toEqual(before)
  }, 120000)

  it('ends a form at 0 hit points, loses the excess, and leaves the other beast in its form', async () => {
    // A dart is its raw die plus 2: 5 ends the 4 hit point centipede, then 2 and 2 follow.
    const room = await insectRoom({ rolls: [3, 0, 0], extraSpells: [magicMissile] })
    const [slain, bitten] = BEAST_IDS as [string, string]
    const before = beastRows(await readRoomHistory(room.room.base.stub))
    commit(
      (await room.startActorsAction(BEAST_IDS, RANGE_UNCHECKED, false, null, CENTIPEDES.id)).answer
    )

    // Giant Insect spent the caster's Action: a round later it is theirs again.
    for (let turn = 0; turn <= BEAST_IDS.length; turn++) await room.advanceTurn()
    const missiles = (await room.actionChoices()).actions.find(
      ({ label }) => label === 'Magic Missile (1st level)'
    )
    if (!missiles) throw new Error('The Character offers no Magic Missile.')
    commit(
      await room.send({
        type: 'RESOLVE_ACTION',
        acceptedWieldConflict: null,
        acknowledgedWarnings: RANGE_UNCHECKED,
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version(),
        actorId: CHARACTER_ACTOR_ID,
        target: { kind: 'ACTORS', actorIds: [slain, slain, bitten], scene: null },
        actionId: missiles.id,
        optionalCombatIntent: null,
        sceneContext: null
      })
    )

    const after = await readRoomHistory(room.room.base.stub)
    const stateOf = (id: string) =>
      JSON.parse(after.actors.find((actor) => actor.id === id)!.stateJson)
    const originalOf = (id: string) => JSON.parse(before.find((row) => row.id === id)!.stateJson)
    // The first dart's excess (1) is lost, so the second lands on the whole wolf: 11 - 2.
    expect(stateOf(slain)).toMatchObject({
      sourceId: originalOf(slain).sourceId,
      currentHitPoints: originalOf(slain).currentHitPoints - 2,
      form: null
    })
    expect(stateOf(bitten)).toMatchObject({
      sourceId: CREATURE_IDS.GIANT_CENTIPEDE,
      currentHitPoints: giantCentipede.hitPoints - 2
    })
    expect(after.activeEffects.map((effect) => effect.targetActorId)).toEqual([bitten])
  }, 120000)

  it('refuses more creatures than the chosen form allows, a Character, and a cast with no form', async () => {
    const room = await insectRoom()
    const refusedWith = async (actorIds: readonly string[], formId?: string) => {
      const { answer } = await room.startActorsAction(
        actorIds,
        RANGE_UNCHECKED,
        false,
        null,
        formId
      )
      expect(answer.type).toBe('COMMAND_REJECTED')
      return JSON.stringify(answer)
    }

    expect(await refusedWith(BEAST_IDS, formOf(CREATURE_IDS.GIANT_SCORPION).id)).toContain(
      'at most 1'
    )
    expect(await refusedWith([CHARACTER_ACTOR_ID], CENTIPEDES.id)).toContain(
      'cannot take a creature form'
    )
    expect(await refusedWith(BEAST_IDS)).toContain('needs one of its creature forms')
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toHaveLength(0)
  }, 120000)
})
