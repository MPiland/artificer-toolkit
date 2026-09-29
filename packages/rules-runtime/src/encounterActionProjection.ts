import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import {
  encodeCharacterRecord,
  type StoredCharacter
} from '@artificer-toolkit/schema/projections/characterStoredState'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { evaluateCharacterRules } from './character/characterRuleEvaluation.js'
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
  if (!update)
    return buildMovementTarget<TCharacterFacts>({
      actor: input.actor,
      activeEffects: input.target.activeEffects,
      characterFacts,
      campaignId: input.campaignId,
      gameSystemId: input.gameSystemId,
      includeReactionSources: true
    })
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
  return buildMovementTarget<TCharacterFacts>({
    actor: input.actor,
    activeEffects: input.target.activeEffects,
    characterFacts: projectedFacts,
    campaignId: input.campaignId,
    gameSystemId: input.gameSystemId,
    includeReactionSources: true
  })
}
