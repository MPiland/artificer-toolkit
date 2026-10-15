import { describe, expect, it } from 'vitest'

import { ASSISTED_REACTION_CHOICE_DEFINITION_ID } from '../encounterMovementReactionDecision.js'
import {
  chosenEncounterReaction,
  encounterReactionPin,
  type EncounterAttackReactionCandidate
} from '../encounterReactionChoice.js'
import { createReactionChoiceDefinition } from '../reactionChoiceDefinition.js'
import { SRD_SYSTEM_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'

const choiceGraph = createReactionChoiceDefinition({
  definitionId: ASSISTED_REACTION_CHOICE_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID
})

/** A reaction the Character holds, as discovery would hand it to the pin. */
const candidate = (seed: number): EncounterAttackReactionCandidate => ({
  trigger: 'ATTACKED_SELF',
  reactorActorId: testUuid(0x7e0),
  characterId: testUuid(0x7e1),
  characterStreamVersion: 3,
  actionId: `reaction-${seed}`,
  effectId: testUuid(0x7e2 + seed),
  allowance: { definitionId: testUuid(0x7f0), beforeUsed: 0, maximum: 1 },
  choiceGraph
})

describe('the reaction a decision answers (REACTION-4.6)', () => {
  const inner = encounterReactionPin(candidate(1))
  const outer = encounterReactionPin(candidate(2))
  const offer = { reactions: [inner, outer] }

  it('gives each offered reaction its own use option', () => {
    expect(inner.useOptionId).not.toBe(outer.useOptionId)
  })

  it('settles the reaction whose use option was chosen, not the first offered', () => {
    expect(chosenEncounterReaction(offer, { kind: 'OPTION', optionId: outer.useOptionId })).toBe(
      outer
    )
    expect(chosenEncounterReaction(offer, { kind: 'OPTION', optionId: inner.useOptionId })).toBe(
      inner
    )
  })

  it('answers a decline for the innermost reaction, the one decided first', () => {
    expect(chosenEncounterReaction(offer, { kind: 'DECLINE' })).toBe(inner)
  })

  it('refuses an option the offer never issued', () => {
    expect(() =>
      chosenEncounterReaction(offer, { kind: 'OPTION', optionId: 'c'.repeat(64) })
    ).toThrow('Reaction selection was not issued.')
  })
})
