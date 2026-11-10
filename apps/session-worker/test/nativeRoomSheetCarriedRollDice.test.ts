import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { glibness } from '@artificer-toolkit/source-data/srd/spells/glibness.js'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/**
 * QUALITY-12.1: a Sheet roll made in the room is the roll Convex makes
 * (`apps/apis/convex/rollsCarriedCheckDice.test.ts`): a die the Character carries joins its next
 * ability check and that check spends it (D156), and a carried floor lifts the check's d20.
 */

const ACTOR_ID = testUuid(0x9c10)
const CHARACTER_ID = testUuid(0x9c11)
const WOLF_ID = testUuid(0x9c12)

afterEach(closeTrackedSockets)

/** A room whose Character carries the spell's one effect, and that Character's player with its Sheet. */
async function playerCarrying(spell: typeof guidance | typeof glibness) {
  const room = await movementRoom({
    actors: [
      characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    moverActorId: ACTOR_ID,
    positions: { [ACTOR_ID]: { x: 150, y: 150 }, [WOLF_ID]: { x: 250, y: 150 } },
    seed: async ({ effects, encounterId, occurredAt }) => {
      // An effect on the Character's actor is a row of the Character, loaded with it.
      await effects.create({
        id: crypto.randomUUID(),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: ACTOR_ID },
        definition: plannedModifierGrant({
          encounterId,
          sourceActorId: ACTOR_ID,
          holderActorId: ACTOR_ID,
          lifecycle: {},
          effect: spell.effects![0]!,
          sourceLabel: spell.label,
          rounds: 10,
          lifetimeScope: 'OWNER'
        }).definition,
        lifecycle: { schemaVersion: 1, remainingTicks: 10 },
        occurredAt
      })
    }
  })
  const player = await connectPlayer(room.base)
  player.socket.send(
    JSON.stringify({ type: 'SUBSCRIBE_CHARACTER_SHEET', characterId: CHARACTER_ID })
  )
  const sheet = await vi.waitFor(() => {
    const message = player.messages.find((each) => each.type === 'CHARACTER_SHEET')
    if (message?.type !== 'CHARACTER_SHEET') throw new Error('The room sent no Sheet.')
    return message.sheet
  })
  let sequence = 0
  /** Rolls the Sheet's check of `ability` to the table and returns the posted roll. */
  const abilityCheck = async (ability: 'STRENGTH' | 'CHARISMA') => {
    const { modifier, rollMode } = sheet.overview.abilities.find((row) => row.ability === ability)!
    const rollId = crypto.randomUUID()
    player.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: sequence,
        command: {
          scope: 'CAMPAIGN_CHAT',
          command: {
            type: 'EXECUTE_ROLL',
            commandId: rollId,
            input: {
              campaignId: room.base.capture.campaignId,
              destination: 'TABLE',
              clientNonce: rollId,
              roll: {
                characterId: CHARACTER_ID,
                rollMode,
                expression:
                  modifier === 0
                    ? '1d20'
                    : `1d20 ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`,
                source: {
                  kind: 'ABILITY_CHECK',
                  label: `${ability === 'STRENGTH' ? 'Strength' : 'Charisma'} check`
                }
              }
            }
          }
        }
      })
    )
    return vi.waitFor(() => {
      const reply = player.messages.find(
        (message) =>
          (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
          message.commandId === rollId
      )
      if (
        reply?.type !== 'COMMAND_COMMITTED' ||
        reply.delta?.scope !== 'CAMPAIGN_CHAT' ||
        !reply.delta.entry?.roll
      )
        throw new Error(JSON.stringify(reply ?? null))
      sequence = reply.sequence
      return reply.delta.entry.roll
    })
  }
  return { abilityCheck }
}

const d4Terms = (roll: { evidence: { terms: readonly { die: number }[] } }) =>
  roll.evidence.terms.filter(({ die }) => die === 4)

describe("a carried ability-check die on the room's Sheet roll (D156)", () => {
  it('adds the die to the first ability check and spends it', async () => {
    const { abilityCheck } = await playerCarrying(guidance)

    const first = await abilityCheck('STRENGTH')
    expect(d4Terms(first)).toHaveLength(1)
    expect(first.normalizedExpression).toMatch(/\+ 1d4$/)
    expect(first.evidence.total).toBe(
      first.evidence.terms.reduce((total, term) => total + term.subtotal, first.evidence.modifier)
    )

    expect(d4Terms(await abilityCheck('STRENGTH'))).toEqual([])
  })
})

describe("a carried d20 floor on the room's Sheet roll", () => {
  it('counts a Charisma check’s d20 as at least the floor, records the floor and keeps the effect', async () => {
    const { abilityCheck } = await playerCarrying(glibness)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const roll = await abilityCheck('CHARISMA')
      const d20 = roll.evidence.terms.find(({ die }) => die === 20)!
      expect(d20.subtotal).toBe(Math.max(d20.rolls[0]!, 15))
      expect(roll.ruleCheck).toEqual(
        d20.rolls[0]! < 15 ? { kind: 'D20_MINIMUM_ROLL', amount: 15, label: 'Glibness' } : undefined
      )
    }
  })
})
