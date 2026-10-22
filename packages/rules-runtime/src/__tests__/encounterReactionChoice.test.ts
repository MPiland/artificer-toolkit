import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { beforeAll, describe, expect, it } from 'vitest'

import { ASSISTED_REACTION_CHOICE_DEFINITION_ID } from '../encounterMovementReactionDecision.js'
import {
  chosenEncounterReaction,
  encounterReactionPin,
  openEncounterReactionChoice,
  settleEncounterCastReactionUse,
  settleEncounterReactionChoice,
  type EncounterAttackReactionCandidate,
  type EncounterCastReactionCandidate
} from '../encounterReactionChoice.js'
import { createReactionChoiceDefinition } from '../reactionChoiceDefinition.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import { createSrdRulesRuntime, SRD_SYSTEM_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'

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

describe('the reaction a decision answers (REACTION-4.5)', () => {
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

describe('settling the chosen reaction (REACTION-4.5)', () => {
  let runtime: RulesRuntimeService
  beforeAll(async () => {
    runtime = createSrdRulesRuntime()
  })

  /** A hit the offer was sealed against, and the offer stacking two reactions on it. */
  async function sealedOffer() {
    const opened = await openEncounterReactionChoice({
      runtime,
      occurrenceId: testUuid(0x7d0),
      candidate: candidate(1)
    })
    const settled = await runtime.resume({
      continuation: opened,
      response: { requestId: opened.request.requestId, value: 0 }
    })
    if (settled.status !== 'COMPLETE') throw new Error('The hit fixture must complete.')
    const execution = { ...settled, outputs: { ...settled.outputs, resultPath: 'ON_HIT' } }
    const d20Policy = {
      requestNodeId: 'attack',
      rollMode: 'NORMAL' as const,
      keep: 'FIRST' as const,
      contributors: [],
      contributorChecksum: checksumRuleDocument([]),
      modifier: 5,
      dc: 15
    }
    const targetStateChecksum = checksumRuleDocument('target')
    return {
      boundary: { execution, d20Policy },
      offer: {
        reactions: [encounterReactionPin(candidate(1)), encounterReactionPin(candidate(2))],
        targetStateChecksum,
        originalExecutionChecksum: checksumRuleDocument(execution),
        d20: d20Policy
      },
      targetStateChecksum
    }
  }

  it('uses the second offered reaction when its option is chosen', async () => {
    const { boundary, offer, targetStateChecksum } = await sealedOffer()
    const settled = await settleEncounterReactionChoice({
      runtime,
      occurrenceId: testUuid(0x7d1),
      boundary,
      offer,
      candidate: candidate(2),
      targetStateChecksum,
      selection: { kind: 'OPTION', optionId: offer.reactions[1]!.useOptionId }
    })
    expect(settled).toMatchObject({ use: true, reaction: { actionId: 'reaction-2' } })
  })

  it('refuses a chosen reaction answered against another reaction’s candidate', async () => {
    const { boundary, offer, targetStateChecksum } = await sealedOffer()
    await expect(
      settleEncounterReactionChoice({
        runtime,
        occurrenceId: testUuid(0x7d2),
        boundary,
        offer,
        candidate: candidate(1),
        targetStateChecksum,
        selection: { kind: 'OPTION', optionId: offer.reactions[1]!.useOptionId }
      })
    ).rejects.toThrow('Reaction evidence is stale.')
  })

  it('declines the innermost reaction', async () => {
    const { boundary, offer, targetStateChecksum } = await sealedOffer()
    const settled = await settleEncounterReactionChoice({
      runtime,
      occurrenceId: testUuid(0x7d3),
      boundary,
      offer,
      candidate: candidate(1),
      targetStateChecksum,
      selection: { kind: 'DECLINE' }
    })
    expect(settled).toMatchObject({ use: false, reaction: { actionId: 'reaction-1' } })
  })
})

describe('settling a used reaction to a cast (REACTION-4.3)', () => {
  let runtime: RulesRuntimeService
  beforeAll(async () => {
    runtime = createSrdRulesRuntime()
  })

  const counter = (seed: number): EncounterCastReactionCandidate => ({
    ...candidate(seed),
    trigger: 'SPELL_CAST'
  })
  const offer = { reactions: [encounterReactionPin(counter(1)), encounterReactionPin(counter(2))] }

  it('uses the reaction whose option was chosen', async () => {
    const settled = await settleEncounterCastReactionUse({
      runtime,
      occurrenceId: testUuid(0x7d4),
      offer,
      candidate: counter(2),
      optionId: offer.reactions[1]!.useOptionId
    })
    expect(settled.reaction.actionId).toBe('reaction-2')
    expect(settled.choice.outputs.selectedIndex).toBe(1)
  })

  it('refuses a chosen reaction answered against another reaction’s candidate', async () => {
    await expect(
      settleEncounterCastReactionUse({
        runtime,
        occurrenceId: testUuid(0x7d5),
        offer,
        candidate: counter(1),
        optionId: offer.reactions[1]!.useOptionId
      })
    ).rejects.toThrow('Reaction evidence is stale.')
  })

  it('refuses an option the offer never issued', async () => {
    await expect(
      settleEncounterCastReactionUse({
        runtime,
        occurrenceId: testUuid(0x7d6),
        offer,
        candidate: counter(1),
        optionId: 'c'.repeat(64)
      })
    ).rejects.toThrow('Reaction selection was not issued.')
  })

  it('refuses a reaction whose allowance changed since it was offered', async () => {
    await expect(
      settleEncounterCastReactionUse({
        runtime,
        occurrenceId: testUuid(0x7d7),
        offer,
        candidate: {
          ...counter(1),
          allowance: { definitionId: testUuid(0x7f0), beforeUsed: 1, maximum: 1 }
        },
        optionId: offer.reactions[0]!.useOptionId
      })
    ).rejects.toThrow('Reaction evidence is stale.')
  })
})
