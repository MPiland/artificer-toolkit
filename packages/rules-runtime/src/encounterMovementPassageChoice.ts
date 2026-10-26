import type { OptionalCombatPassageChoicePendingContextDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { EncounterConflictError } from './encounterErrors.js'

type PassageOptionInput = Omit<
  OptionalCombatPassageChoicePendingContextDto['options'][number],
  'optionId'
>

/** Creates a sealed, deterministic choice before any passage economy is consumed. */
export function createEncounterMovementPassageChoice(input: {
  readonly movement: OptionalCombatPassageChoicePendingContextDto['movement']
  readonly sourceActorId: string
  readonly sourceControllerCharacterId: string | null
  readonly options: readonly PassageOptionInput[]
}): OptionalCombatPassageChoicePendingContextDto {
  const options = input.options
    .map((option) => ({
      ...option,
      optionId: checksumRuleDocument({
        kind: 'ENCOUNTER_MOVEMENT_PASSAGE_OPTION',
        rootCommandId: input.movement.root.commandId,
        sourceActorId: input.sourceActorId,
        blockerActorId: input.movement.blockerActorId,
        ruleKind: option.ruleKind,
        economy: option.economy,
        initiatorCheckDefinitionId: option.initiatorCheckDefinitionId,
        definitionId: option.definitionId,
        definitionVersion: option.definitionVersion,
        definitionChecksum: option.definitionChecksum
      })
    }))
    .sort((left, right) => left.optionId.localeCompare(right.optionId))
  return {
    kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE',
    schemaVersion: 1,
    movement: input.movement,
    sourceActorId: input.sourceActorId,
    sourceTokenId: input.movement.root.tokenId,
    sourceControllerCharacterId: input.sourceControllerCharacterId,
    options,
    optionsChecksum: checksumRuleDocument(options)
  }
}

/** Resolves only one issued option; geometry and policy are revalidated by the coordinator. */
export function resolveEncounterMovementPassageChoice(input: {
  readonly context: OptionalCombatPassageChoicePendingContextDto
  readonly selection:
    | { readonly kind: 'DECLINE' }
    | { readonly kind: 'OPTION'; readonly optionId: string }
}):
  | { readonly kind: 'DECLINED' }
  | { readonly kind: 'SELECTED'; readonly option: PassageOptionInput & { optionId: string } } {
  const selection = input.selection
  if (!('optionId' in selection)) return { kind: 'DECLINED' }
  const option = input.context.options.find(
    (candidate) => candidate.optionId === selection.optionId
  )
  if (!option) throw new EncounterConflictError('Movement passage option is unavailable.')
  return { kind: 'SELECTED', option }
}
