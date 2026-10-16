import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { ASSISTED_REACTION_CHOICE_DEFINITION_ID } from '../encounterMovementReactionDecision.js'
import {
  encounterReactionEffectId,
  encounterReactionPin,
  type EncounterAttackReactionCandidate
} from '../encounterReactionChoice.js'
import { createReactionChoiceDefinition } from '../reactionChoiceDefinition.js'
import { dnd5eCharacterRuleActionSystemAdapter as adapter } from '../systems/dnd5e/effectActionCompiler.js'
import { absorbElementsSpell } from '../testing/absorbElementsSpell.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { SRD_SYSTEM_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'

/**
 * REACTION-4.5: a reaction's plan is rebuilt from the stored command and occurrence ids when its answer
 * is replayed or its action resumes, so rebuilding must derive the same ids every time.
 */

const ENCOUNTER_ID = testUuid(0x7c0)
const REACTOR_ID = testUuid(0x7c1)
const COMMAND_ID = testUuid(0x7c2)
const OCCURRENCE_ID = testUuid(0x7c3)

const action = (() => {
  const [effect] = absorbElementsSpell(['FIRE']).effects ?? []
  if (!effect) throw new Error('The reaction fixture has no authored effect.')
  return characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }))
})()

const executionPlan = adapter.compileExecutionPlan?.({
  action,
  compilerSource: buildCompiledActionCompilerSource(action)
})

/** The effect plan the room builds for the reaction, from the ids the command and occurrence store. */
function planReaction(ids: { commandId: string; occurrenceId: string }) {
  if (executionPlan?.kind !== 'SINGLE_GRAPH') throw new Error('The reaction is one graph.')
  const { published } = executionPlan
  const execution = {
    status: 'COMPLETE',
    outputs: {},
    evidence: {
      source: {
        definitionId: published.id,
        gameSystemId: SRD_SYSTEM_ID,
        definitionFamilyKey: published.definitionFamilyKey,
        checksum: published.checksum
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: {}
    }
  } satisfies ServerCompletedRuleExecutionDto
  const { recurringEffect } = prepareEncounterActionEffectPlans({
    encounterId: ENCOUNTER_ID,
    ...ids,
    sourceActorId: REACTOR_ID,
    sourceLabel: 'Absorb Elements',
    sourceHidden: false,
    currentActorId: REACTOR_ID,
    target: {
      actorId: REACTOR_ID,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan: adapter.activeEffectPlans?.({ action, published })[0] ?? null,
    published,
    execution,
    d20: null,
    applications: []
  })
  if (!recurringEffect) throw new Error('The reaction planned no effect.')
  return recurringEffect
}

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
