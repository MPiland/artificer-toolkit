import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { antipathySympathy } from '@artificer-toolkit/source-data/srd/spells/antipathy-sympathy.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3ab (D148): a cast whose caster picks at cast what its area does to the creatures it
 * catches (Antipathy/Sympathy). The room offers the pick with the area's aim, refuses a cast that
 * names none, and lands the picked option alone on each creature the area catches.
 */

const CHARACTER_ACTOR_ID = testUuid(0x8d0)
const CHARACTER_ID = testUuid(0x8d1)
const WOLF_IDS = [testUuid(0x8d2), testUuid(0x8d3)]
/** Inside the 60-foot range, and close enough that the 200-foot cube catches both Wolves. */
const POINT = { x: 800, y: 150 }

afterEach(closeTrackedSockets)

function castRoom() {
  return actionRoom({
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      ...WOLF_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    positions: { [WOLF_IDS[0]!]: { x: 700, y: 150 }, [WOLF_IDS[1]!]: { x: 900, y: 150 } },
    characterSpellcasting: { spells: [antipathySympathy], prepared: [antipathySympathy.id] },
    characterPlay: { classLevel: 15 },
    characterAction: (action) => action.label.startsWith(antipathySympathy.label),
    fallbackRoll: 10
  })
}

/** The authored option `label` of the spell's pick, with the ruling its outcome lands. */
function authoredOption(label: string) {
  const path = antipathySympathy.effects?.[0]?.paths[0]
  if (path?.selectionKind !== 'CHOICE') throw new Error('The spell offers a pick.')
  const option = path.options.find((each) => each.label === label)
  const outcome = option?.resultBlock.outcomes[0]
  if (!option || outcome?.effectKind !== 'MANUAL_ADJUDICATION')
    throw new Error(`The ${label} option lands a GM ruling.`)
  return {
    id: option.id,
    ruling: {
      rulingOutcomeId: outcome.id,
      label: outcome.label,
      instructions: outcome.instructions
    }
  }
}

describe('room cast of an area pick (QUALITY-15.T3ab)', () => {
  it('offers the pick with the area aim and lands the picked ruling on each creature caught', async () => {
    const room = await castRoom()
    const choices = await room.actionChoicesAsPlayer(CHARACTER_ACTOR_ID)
    expect(choices.actions.find(({ id }) => id === room.actionId)?.target).toMatchObject({
      kind: 'POINT',
      choiceOptions: [{ label: 'Antipathy' }, { label: 'Sympathy' }]
    })

    const sympathy = authoredOption('Sympathy')
    const { answer } = await room.startAreaCommand({
      kind: 'POINT',
      point: POINT,
      choiceOptionId: sympathy.id
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const stored = await readRoomHistory(room.room.base.stub)
    const caught = areaReceipts(stored).children.map(({ outputs }) => outputs.targetActorId)
    expect([...caught].sort()).toEqual([CHARACTER_ACTOR_ID, ...WOLF_IDS].sort())
    // The 200-foot cube also catches its caster, whose effect the Character holds (by its id).
    const held = [
      ...stored.activeEffects,
      ...stored.characterEffects.map(({ characterId, definitionJson }) => ({
        targetActorId: characterId === CHARACTER_ID ? CHARACTER_ACTOR_ID : characterId,
        definitionJson
      }))
    ].map(({ targetActorId, definitionJson }) => ({
      targetActorId,
      rulings: activeRuleEffectDefinitionDtoSchema
        .parse(JSON.parse(definitionJson))
        .stateContributions.flatMap((contribution) =>
          contribution.kind === 'GM_RULING'
            ? [
                {
                  rulingOutcomeId: contribution.rulingOutcomeId,
                  label: contribution.label,
                  instructions: contribution.instructions
                }
              ]
            : []
        )
    }))
    expect(held.map(({ targetActorId }) => targetActorId).sort()).toEqual([...caught].sort())
    for (const { rulings } of held) expect(rulings).toEqual([sympathy.ruling])
  }, 120000)

  it('refuses a cast that names no pick before anything lands', async () => {
    const room = await castRoom()
    const before = await readRoomHistory(room.room.base.stub)

    const { answer } = await room.startAreaCommand({ kind: 'POINT', point: POINT })
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    const after = await readRoomHistory(room.room.base.stub)
    expect(after.receipts).toEqual(before.receipts)
    expect(after.activeEffects).toEqual([])
    expect(after.characterEffects).toEqual([])
  }, 120000)
})
