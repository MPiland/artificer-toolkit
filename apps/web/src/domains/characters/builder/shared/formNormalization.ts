import {
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import {
  characterAuthoredDtoSchema,
  type CharacterAuthoredDto
} from '@artificer-toolkit/schema/subjects/character'
import { z } from 'zod/mini'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characterBuilder'
import type { CharacterDraftSaveInput } from '@artificer-toolkit/schema/api/characterDrafts'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import {
  mergeActiveAbilityIntentCache,
  normalizeAbilityIntent,
  normalizeBuilderIntent,
  toAbilityFormValues
} from '../steps/abilities/abilityGeneration'

const characterDraftSchema = z.omit(characterAuthoredDtoSchema, { primaryRulesCatalogueId: true })

export function createFallbackCharacterFormValues(systemId: string): CharacterFormValues {
  return {
    id: 'pending-character',
    label: '',
    status: AUTHORED_RECORD_STATUS.DRAFT,
    profile: {},
    intent: {
      advancement: { method: ADVANCEMENT_METHOD_CODE.MILESTONE },
      race: { raceId: '' },
      background: { backgroundId: '' },
      classes: [],
      abilities: {
        method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
        assignments: []
      },
      hitpoints: {
        method: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
        levels: []
      },
      featureAcquisitions: []
    },
    state: {
      equipment: {
        inventory: [],
        equipped: [],
        attuned: []
      },
      currency: [],
      hitpoints: {
        current: 1,
        temp: 0,
        hitDice: [],
        deathSaves: NO_DEATH_SAVES
      }
    },
    systemId,
    userId: 'server-owned'
  }
}

/**
 * Type carrier for `withForm({ defaultValues })` in the step components. The live form is always
 * built from a server draft via `toCharacterFormValues`, so no step ever renders these values; the
 * empty `systemId` is the same explicit "no System" state the other authored forms use.
 */
export const EMPTY_CHARACTER_FORM_VALUES = createFallbackCharacterFormValues('')

/** Form values from a Builder payload or a stored draft payload. */
export function toCharacterFormValues(
  payload: Pick<CharacterBuilderPayloadDto, 'character' | 'builderIntent'>
): CharacterFormValues {
  const abilities = payload.character.intent.abilities
  const formAbilities = toAbilityFormValues(abilities)

  return {
    ...payload.character,
    intent: {
      ...payload.character.intent,
      abilities: formAbilities
    },
    builderIntent: mergeActiveAbilityIntentCache(payload.builderIntent, formAbilities)
  }
}

export function normalizeCharacterForDraft(character: CharacterFormValues): CharacterAuthoredDto {
  return characterDraftSchema.parse({
    ...character,
    intent: {
      ...character.intent,
      abilities: normalizeAbilityIntent(character.intent.abilities)
    },
    status: AUTHORED_RECORD_STATUS.DRAFT
  })
}

export function buildCharacterDraftSaveInput(
  character: CharacterFormValues,
  mode: CharacterDraftSaveInput['mode'],
  expectedDraftId: string
): CharacterDraftSaveInput {
  return {
    characterId: character.id,
    expectedDraftId,
    character: normalizeCharacterForDraft(character),
    builderIntent: normalizeBuilderIntent(character),
    mode
  }
}
