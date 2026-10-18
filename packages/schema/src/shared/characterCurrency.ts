import type { CharacterSheetCurrencyOptionDto } from '../api/characterSheetData.js'
import { z, lazySchema } from '../zod.js'

/** Every currency holding names its kind; a Campaign currency also names its currency system. */
export const characterCurrencyQualificationDtoSchema = lazySchema(() =>
  z
    .object({
      kind: z.enum(['RULESET', 'CAMPAIGN']),
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
)

export const characterCurrencyIdentityDtoSchema = lazySchema(() =>
  z.extend(characterCurrencyQualificationDtoSchema, { currencyId: z.string() })
)
export const characterCurrencyAmountDtoSchema = lazySchema(() =>
  z.extend(characterCurrencyIdentityDtoSchema, {
    amount: z.number().check(z.int()).check(z.nonnegative())
  })
)
export type CharacterCurrencyIdentityDto = z.infer<typeof characterCurrencyIdentityDtoSchema>

export function createCharacterCurrencyIdentityKey(identity: CharacterCurrencyIdentityDto): string {
  return JSON.stringify([
    identity.currencyId,
    identity.kind,
    identity.campaignCurrencySystemId ?? null
  ])
}

/** The currency identity a balance, command or row names, without its other fields. */
export function characterCurrencyIdentity(
  record: CharacterCurrencyIdentityDto
): CharacterCurrencyIdentityDto {
  if (record.kind === 'RULESET') return { currencyId: record.currencyId, kind: record.kind }
  if (!record.campaignCurrencySystemId)
    throw new Error(`Campaign currency "${record.currencyId}" is missing its currency system.`)
  return {
    currencyId: record.currencyId,
    kind: record.kind,
    campaignCurrencySystemId: record.campaignCurrencySystemId
  }
}

/** The holding identity of a currency option: its id, kind and Campaign currency system. */
export function currencyOptionIdentity(
  option: CharacterSheetCurrencyOptionDto
): CharacterCurrencyIdentityDto {
  if (option.kind === 'RULESET') return { currencyId: option.id, kind: option.kind }
  if (!option.campaignCurrencySystemId)
    throw new Error(`Campaign currency "${option.id}" is missing its currency system.`)
  return {
    currencyId: option.id,
    kind: option.kind,
    campaignCurrencySystemId: option.campaignCurrencySystemId
  }
}
