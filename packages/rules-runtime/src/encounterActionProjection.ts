import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import {
  encodeCharacterRecord,
  type StoredCharacter
} from '@artificer-toolkit/schema/projections/characterStoredState'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { NativeCharacterSpellConsumption } from './character/characterNativeActionResources.js'
import { applyEncounterConditionMechanics } from './encounterConditionMechanics.js'
import { evaluateCharacterRules } from './character/characterRuleEvaluation.js'
import { updateSpellSlotUsage } from './character/sheetCommandReducer.js'
import type { prepareCharacterSheetFromContext } from './character/sheetPreparation.js'
import type { EncounterMechanicsBatchPlan } from './encounterMechanicsBatchPlan.js'
import {
  buildMovementTarget,
  type CharacterMovementFacts,
  type MovementTarget
} from './encounterMovementTargets.js'

export type ProjectableCharacterFacts = CharacterMovementFacts & {
  /** The Character's stored row and play record, which a projected plan re-encodes. */
  active: StoredCharacter
  character: CharacterAuthored
  prepared: Awaited<ReturnType<typeof prepareCharacterSheetFromContext>>['prepared']
  sheetState: CharacterSheetState
  evaluationInput: Parameters<typeof evaluateCharacterRules>[0]
}

/**
 * The target with a spell slot spent, still on the Character version it was read at: a counter to a
 * Counterspell against the target's own cast is planned against the slots the cast leaves, and both
 * spends commit in one batch on that version.
 */
export function projectSpellSlotSpend<TCharacterFacts extends ProjectableCharacterFacts>(input: {
  target: MovementTarget<TCharacterFacts>
  consumption: Pick<NativeCharacterSpellConsumption, 'slotKey' | 'afterUsed'>
  campaignId: string
  gameSystemId: string
  occurredAt: string
}): MovementTarget<TCharacterFacts> {
  const characterFacts = input.target.characterFacts
  if (!characterFacts) throw new Error('Projected movement Character state is unavailable.')
  return projectEncounterActionTarget({
    target: input.target,
    actor: input.target.actor,
    plan: {
      characterUpdate: {
        character: updateSpellSlotUsage(
          characterFacts.character,
          input.consumption.slotKey,
          () => input.consumption.afterUsed
        ),
        sheetState: null
      },
      characterStreamVersion: characterFacts.active.play.streamVersion
    },
    campaignId: input.campaignId,
    gameSystemId: input.gameSystemId,
    occurredAt: input.occurredAt
  })
}

/** Rebuilds current rule facts after a planned outcome, within this movement preparation only. */
export function projectEncounterActionTarget<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  target: MovementTarget<TCharacterFacts>
  actor: MovementTarget<TCharacterFacts>['actor']
  plan: Pick<EncounterMechanicsBatchPlan, 'characterUpdate' | 'characterStreamVersion'> | null
  campaignId: string
  gameSystemId: string
  occurredAt: string
}): MovementTarget<TCharacterFacts> {
  const characterFacts = input.target.characterFacts
  const update = input.plan?.characterUpdate
  // A rebuilt target carries the original's pinned condition definitions over and re-applies them.
  const withHeldConditions = (target: MovementTarget<TCharacterFacts>) =>
    applyEncounterConditionMechanics({
      target: { ...target, conditionDefinitions: input.target.conditionDefinitions },
      gameSystemId: input.gameSystemId
    })
  if (!update)
    return withHeldConditions(
      buildMovementTarget<TCharacterFacts>({
        actor: input.actor,
        activeEffects: input.target.activeEffects,
        characterFacts,
        campaignId: input.campaignId,
        gameSystemId: input.gameSystemId,
        includeReactionSources: true
      })
    )
  const streamVersion = input.plan?.characterStreamVersion
  if (!characterFacts || streamVersion === null || streamVersion === undefined)
    throw new Error('Projected movement Character state is unavailable.')
  const sheetState = update.sheetState ?? characterFacts.sheetState
  const character = {
    ...characterFacts.prepared.character,
    state: update.character.state
  }
  const evaluationInput = {
    ...characterFacts.evaluationInput,
    character,
    resourceUsage: sheetState.resourceUsage
  }
  const projectedFacts = Object.assign({}, characterFacts, {
    active: encodeCharacterRecord(characterFacts.active, {
      document: update.character,
      ...(update.sheetState ? { sheetState: update.sheetState } : {}),
      streamVersion,
      updatedAt: input.occurredAt
    }),
    character: update.character,
    prepared: Object.assign({}, characterFacts.prepared, {
      candidate: update.character,
      character
    }),
    sheetState,
    evaluationInput,
    ruleEvaluation: evaluateCharacterRules(evaluationInput)
  })
  return withHeldConditions(
    buildMovementTarget<TCharacterFacts>({
      actor: input.actor,
      activeEffects: input.target.activeEffects,
      characterFacts: projectedFacts,
      campaignId: input.campaignId,
      gameSystemId: input.gameSystemId,
      includeReactionSources: true
    })
  )
}
