import { describe, expect, it } from 'vitest'

import { ASSISTED_REACTION_CHOICE_DEFINITION_ID } from '../encounterMovementReactionDecision.js'
import {
  encounterReactionEffectId,
  encounterReactionPin,
  type EncounterAttackReactionCandidate
} from '../encounterReactionChoice.js'
import { createReactionChoiceDefinition } from '../reactionChoiceDefinition.js'
import { ACTION_EFFECT_ID } from '../testing/characterActionDescriptor.js'
import { SRD_SYSTEM_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedAbsorbElements } from '../testing/plannedAbsorbElements.js'

/**
 * REACTION-4.5: a reaction's plan is rebuilt from the stored command and occurrence ids when its answer
 * is replayed or its action resumes, so rebuilding must derive the same ids every time.
 */

const ENCOUNTER_ID = testUuid(0x7c0)
const REACTOR_ID = testUuid(0x7c1)
const COMMAND_ID = testUuid(0x7c2)
const OCCURRENCE_ID = testUuid(0x7c3)

const planReaction = plannedAbsorbElements

/** The reaction the reactor holds, discovered afresh each time. */
const candidate = (): EncounterAttackReactionCandidate => ({
  trigger: 'DAMAGE_TAKEN',
  reactorActorId: REACTOR_ID,
  characterId: testUuid(0x7c4),
  characterStreamVersion: 3,
  actionId: 'absorb-elements',
  effectId: ACTION_EFFECT_ID,
  allowance: { definitionId: testUuid(0x7c5), beforeUsed: 0, maximum: 1 },
  choiceGraph: createReactionChoiceDefinition({
    definitionId: ASSISTED_REACTION_CHOICE_DEFINITION_ID,
    gameSystemId: SRD_SYSTEM_ID
  })
})

describe('rebuilding a reaction from its stored ids (REACTION-4.5)', () => {
  const stored = { commandId: COMMAND_ID, occurrenceId: OCCURRENCE_ID }

  it('plans the same effect on the answer and on its replay', () => {
    const answered = planReaction(stored)
    const replayed = planReaction({ ...stored })

    expect(replayed).toEqual(answered)
    expect(answered.definition.origin).toMatchObject({
      sourceAggregateId: ENCOUNTER_ID,
      sourceOccurrenceId: OCCURRENCE_ID,
      rootCommandId: COMMAND_ID
    })
  })

  it('names the effect it leaves on the reactor by the same id', () => {
    expect(encounterReactionEffectId({ ...stored })).toBe(encounterReactionEffectId(stored))
  })

  it('ties both to the occurrence, so another pause derives other ids', () => {
    const other = { ...stored, occurrenceId: testUuid(0x7c6) }

    expect(planReaction(other).definition.origin).not.toEqual(
      planReaction(stored).definition.origin
    )
    expect(encounterReactionEffectId(other)).not.toBe(encounterReactionEffectId(stored))
  })

  it('pins the offered reaction to the same decision receipt every time it is discovered', () => {
    expect(encounterReactionPin(candidate())).toEqual(encounterReactionPin(candidate()))
  })
})
