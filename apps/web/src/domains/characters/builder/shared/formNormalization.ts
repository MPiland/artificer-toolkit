import {
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import {
  characterAuthoredDtoSchema,
  type CharacterAuthoredDto
} from '@artificer-toolkit/schema/subjects/character'
import type {
  CharacterBuilderDraftSaveRequestDto,
  CharacterBuilderPayloadDto
} from '@artificer-toolkit/schema/api/characters'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import {
  mergeActiveAbilityIntentCache,
  normalizeAbilityIntent,
  normalizeBuilderIntent,
  toAbilityFormValues
} from '../steps/abilities/abilityGeneration'

export function createFallbackCharacterFormValues(
  systemId = 'pending-system',
  primaryRulesCatalogueId = '00000000-0000-4000-8000-000000000301'
): CharacterFormValues {
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
        hitDice: []
      }
    },
    primaryRulesCatalogueId,
    systemId,
    userId: 'server-owned'
  }
}

export function toCharacterFormValues(payload: CharacterBuilderPayloadDto): CharacterFormValues {
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
  return characterAuthoredDtoSchema.parse({
    ...character,
    intent: {
      ...character.intent,
      abilities: normalizeAbilityIntent(character.intent.abilities)
    },
    status: AUTHORED_RECORD_STATUS.DRAFT
  })
}

export function normalizeCharacterForCommit(character: CharacterFormValues): CharacterAuthoredDto {
  return characterAuthoredDtoSchema.parse({
    ...character,
    intent: {
      ...character.intent,
      abilities: normalizeAbilityIntent(character.intent.abilities)
    },
    status: AUTHORED_RECORD_STATUS.ACTIVE
  })
}

export function buildCharacterDraftSaveInput(
  character: CharacterFormValues,
  mode: CharacterBuilderDraftSaveRequestDto['mode'],
  options: {
    baseActiveUpdatedAt?: string | null
  } = {}
): CharacterBuilderDraftSaveRequestDto {
  return {
    character: normalizeCharacterForDraft(character),
    builderIntent: normalizeBuilderIntent(character),
    mode,
    baseActiveUpdatedAt: mode === 'edit' ? (options.baseActiveUpdatedAt ?? null) : null
  }
}
