import type { ServerRuleExecutionD20PolicyDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { describe, expect, it } from 'vitest'

import { nextActionWindowDice, targetSaveWindow } from '../encounterActionSaveWindow.js'
import { damageSaveRolledD20 } from '../encounterConcentration.js'
import {
  encounterD20WindowOptions,
  spendEncounterD20WindowDie,
  windowSpentReactions
} from '../encounterD20Window.js'
import { ASSISTED_REACTION_CHOICE_DEFINITION_ID } from '../encounterMovementReactionDecision.js'
import { encounterReactionPin } from '../encounterReactionChoice.js'
import { createReactionChoiceDefinition } from '../reactionChoiceDefinition.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE } from '../systems/dnd5e/identity.js'
import { SRD_SYSTEM_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'

/**
 * SPELLS-31.T4c3b1: an attack roll's d20 window chain (D207). The roller decides first on its held
 * dice, then each reactor in turn on the dice its reactions roll against the roll, one window each.
 */

const CHECKSUM = 'a'.repeat(64)
const choiceGraph = createReactionChoiceDefinition({
  definitionId: ASSISTED_REACTION_CHOICE_DEFINITION_ID,
  gameSystemId: SRD_SYSTEM_ID
})

/** A reactor's die against the roll, pinned as discovery pins it. */
const reactionDie = (reactor: number) => ({
  reaction: encounterReactionPin({
    trigger: 'ATTACK_ROLL_BY_OTHER',
    reactorActorId: testUuid(0x7a0 + reactor),
    characterId: testUuid(0x7b0 + reactor),
    characterStreamVersion: 1,
    actionId: `reaction-${reactor}`,
    effectId: testUuid(0x7c0 + reactor),
    allowance: { definitionId: testUuid(0x7f0), beforeUsed: 0, maximum: 1 },
    choiceGraph
  }),
  label: `Reaction ${reactor}`,
  count: 1,
  faces: 6 as const,
  sign: 'SUBTRACT' as const
})
const heldDie = {
  effectId: testUuid(0x7e0),
  grantId: testUuid(0x7e1),
  label: 'Held',
  count: 1,
  faces: 4 as const,
  sign: 'ADD' as const
}

const attackPolicy: ServerRuleExecutionD20PolicyDto = {
  requestNodeId: 'attack',
  rollMode: 'NORMAL',
  keep: 'FIRST',
  contributors: [],
  contributorChecksum: CHECKSUM,
  modifier: 4,
  dc: 13
}
const savePolicy = {
  ...attackPolicy,
  savingThrowAbilityDefinitionId: DND5E_ABILITY_DEFINITION_ID_BY_CODE.DEXTERITY
}

describe('the deciders of an attack roll’s d20 windows (D207)', () => {
  const reactors = [reactionDie(1), reactionDie(2)]
  /** Offers the first reactor by id that has not answered, as the Worker's discovery orders them. */
  const window = (attackDice: readonly (typeof heldDie)[]) =>
    targetSaveWindow(SRD_SYSTEM_ID, [], attackDice, async (answered) => {
      const next = reactors.find(({ reaction }) => !answered.includes(reaction.reactorActorId))
      return next ? [next] : []
    })
  /** The window a decider just answered, offering `dice` to it. */
  const answered = (dice: readonly ReturnType<typeof reactionDie>[], before: string[] = []) => ({
    answeredReactorActorIds: before,
    offer: { executionChecksum: CHECKSUM, options: encounterD20WindowOptions(CHECKSUM, dice) }
  })

  it('asks the roller about its held dice first', async () => {
    expect(
      await nextActionWindowDice({
        saveWindow: window([heldDie]),
        policy: attackPolicy,
        previous: null
      })
    ).toEqual({ dice: [heldDie], answeredReactorActorIds: [] })
  })

  it('asks the first reactor right after the roll when the roller holds nothing', async () => {
    expect(
      await nextActionWindowDice({ saveWindow: window([]), policy: attackPolicy, previous: null })
    ).toEqual({ dice: [reactors[0]], answeredReactorActorIds: [] })
  })

  it('asks the first reactor once the roller has answered, recording no reactor for it', async () => {
    const roller = {
      answeredReactorActorIds: [],
      offer: {
        executionChecksum: CHECKSUM,
        options: encounterD20WindowOptions(CHECKSUM, [heldDie])
      }
    }
    expect(
      await nextActionWindowDice({
        saveWindow: window([heldDie]),
        policy: attackPolicy,
        previous: roller
      })
    ).toEqual({ dice: [reactors[0]], answeredReactorActorIds: [] })
  })

  it('asks each reactor once, in turn, then nobody', async () => {
    const [first, second] = reactors
    if (!first || !second) throw new Error('Two reactors expected.')
    const afterFirst = await nextActionWindowDice({
      saveWindow: window([]),
      policy: attackPolicy,
      previous: answered([first])
    })
    expect(afterFirst).toEqual({
      dice: [second],
      answeredReactorActorIds: [first.reaction.reactorActorId]
    })
    expect(
      await nextActionWindowDice({
        saveWindow: window([]),
        policy: attackPolicy,
        previous: answered([second], [...afterFirst.answeredReactorActorIds])
      })
    ).toEqual({
      dice: [],
      answeredReactorActorIds: [first.reaction.reactorActorId, second.reaction.reactorActorId]
    })
  })

  it('asks no reactor about a saving throw', async () => {
    expect(
      await nextActionWindowDice({ saveWindow: window([]), policy: savePolicy, previous: null })
    ).toEqual({ dice: [], answeredReactorActorIds: [] })
  })

  it('asks nobody where no window was offered', async () => {
    expect(
      await nextActionWindowDice({ saveWindow: undefined, policy: attackPolicy, previous: null })
    ).toEqual({ dice: [], answeredReactorActorIds: [] })
  })
})

describe('a reactor’s die spent on the roll (D207)', () => {
  const die = reactionDie(1)
  const [option] = encounterD20WindowOptions(CHECKSUM, [die])
  if (!option) throw new Error('The die was not offered.')
  const frozen = damageSaveRolledD20({
    requestId: 'request',
    save: { rollMode: 'NORMAL', modifier: 4, contributors: [], contributorChecksum: CHECKSUM },
    roll: { rawFaces: [10], rollMode: 'NORMAL', keep: 'FIRST', natural: 10, addedDice: [] }
  })

  it('is its own option, sealed to the roll and keyed by the reaction', () => {
    const [held] = encounterD20WindowOptions(CHECKSUM, [heldDie])
    expect(option.optionId).not.toBe(held?.optionId)
    expect(encounterD20WindowOptions('b'.repeat(64), [die])[0]?.optionId).not.toBe(option.optionId)
  })

  it('takes the rolled face off the total and names the reaction that rolled it', () => {
    const spent = spendEncounterD20WindowDie(frozen, option, [3])
    expect(spent.total).toBe(frozen.total - 3)
    const pin = {
      reactorActorId: die.reaction.reactorActorId,
      selectionChecksum: die.reaction.selectionChecksum
    }
    expect(spent.addedDice?.map(({ spentReaction }) => spentReaction)).toEqual([pin])
    expect(windowSpentReactions({ d20: spent, nestedD20: null })).toEqual([pin])
    expect(windowSpentReactions({ d20: null, nestedD20: spent })).toEqual([pin])
  })

  it('spends no reaction for a held die', () => {
    const [held] = encounterD20WindowOptions(CHECKSUM, [heldDie])
    if (!held) throw new Error('The held die was not offered.')
    expect(
      windowSpentReactions({ d20: spendEncounterD20WindowDie(frozen, held, [2]), nestedD20: null })
    ).toEqual([])
  })
})
