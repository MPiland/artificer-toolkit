import type { CharacterSheetCurrencyOptionDto } from '../api/characterSheetData.js'
import { z } from '../zod.js'

/** Absent qualification preserves legacy holdings; new acquisition producers supply an explicit kind. */
export const characterCurrencyQualificationDtoSchema = z
  .object({
    kind: z.optional(z.enum(['RULESET', 'CAMPAIGN'])),
    campaignCurrencySystemId: z.optional(z.string().check(z.uuid()))
  })
  .check(
    z.refine(
      ({ kind, campaignCurrencySystemId }) =>
        kind === 'CAMPAIGN'
          ? campaignCurrencySystemId !== undefined
          : campaignCurrencySystemId === undefined,
      { message: 'Campaign currency requires its system; other currency cannot carry one.' }
    )
  )

export const characterCurrencyIdentityDtoSchema = z.extend(
  characterCurrencyQualificationDtoSchema,
  { currencyId: z.string() }
)
export const characterCurrencyAmountDtoSchema = z.extend(characterCurrencyIdentityDtoSchema, {
  amount: z.number().check(z.int()).check(z.nonnegative())
})
export type CharacterCurrencyIdentityDto = z.infer<typeof characterCurrencyIdentityDtoSchema>

type CharacterCurrencyIdentityInput = Pick<CharacterCurrencyIdentityDto, 'currencyId'> &
  Partial<Pick<CharacterCurrencyIdentityDto, 'kind' | 'campaignCurrencySystemId'>>

export function createCharacterCurrencyIdentityKey(
  identity: CharacterCurrencyIdentityInput
): string {
  return JSON.stringify([
    identity.currencyId,
    identity.kind ?? null,
    identity.campaignCurrencySystemId ?? null
  ])
}

function toCurrencyOptionIdentity(
  option: CharacterSheetCurrencyOptionDto
): CharacterCurrencyIdentityDto {
  const kind = option.kind ?? 'RULESET'
  if (kind === 'CAMPAIGN') {
    if (!option.campaignCurrencySystemId)
      throw new Error(`Campaign currency "${option.id}" is missing its currency system.`)
    return {
      currencyId: option.id,
      kind,
      campaignCurrencySystemId: option.campaignCurrencySystemId
    }
  }
  return { currencyId: option.id, kind }
}

export function resolveCharacterCurrencyIdentity(
  identity: CharacterCurrencyIdentityInput,
  options: readonly CharacterSheetCurrencyOptionDto[],
  ambiguityPolicy: 'REJECT' | 'PRESERVE' = 'REJECT'
): CharacterCurrencyIdentityDto {
  if (identity.kind === 'CAMPAIGN') {
    if (!identity.campaignCurrencySystemId)
      throw new Error(`Campaign currency "${identity.currencyId}" is missing its currency system.`)
    return {
      currencyId: identity.currencyId,
      kind: identity.kind,
      campaignCurrencySystemId: identity.campaignCurrencySystemId
    }
  }
  if (identity.kind === 'RULESET') return { currencyId: identity.currencyId, kind: identity.kind }

  const matches = new Map<string, CharacterCurrencyIdentityDto>()
  for (const option of options) {
    if (option.id !== identity.currencyId) continue
    const resolved = toCurrencyOptionIdentity(option)
    matches.set(createCharacterCurrencyIdentityKey(resolved), resolved)
  }
  if (matches.size > 1) {
    if (ambiguityPolicy === 'PRESERVE') return { currencyId: identity.currencyId }
    throw new Error(`Currency "${identity.currencyId}" has an ambiguous legacy identity.`)
  }
  return matches.values().next().value ?? { currencyId: identity.currencyId }
}
