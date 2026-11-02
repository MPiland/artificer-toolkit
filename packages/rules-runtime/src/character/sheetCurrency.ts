import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSheetCurrencyOptionDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characters'
import {
  characterCurrencyIdentity,
  createCharacterCurrencyIdentityKey,
  currencyOptionIdentity,
  type CharacterCurrencyIdentityDto
} from '@artificer-toolkit/schema/shared/characterCurrency'
import { CharacterSheetCommandError } from './sheetCommandError.js'

type CharacterCurrencyGroup = CharacterAuthored['state']['currency'][number]
type CharacterCurrencyBalance = CharacterCurrencyGroup['currencies'][number]
export type CurrencyBalanceLocation = {
  balance: CharacterCurrencyBalance
  identity: CharacterCurrencyIdentityDto
}

function assertCurrencyAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new CharacterSheetCommandError('Currency balances must be nonnegative safe integers.')
}

export function toCurrencyAmount(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CharacterSheetCommandError(
      'Currency balance exceeds the supported safe integer range.'
    )
  return Number(value)
}

export function normalizeCharacterCurrencyGroups(
  groups: readonly CharacterCurrencyGroup[]
): CharacterCurrencyGroup[] {
  return groups.map((group) => {
    const identities = new Set<string>()
    return {
      ...group,
      currencies: group.currencies.map((balance) => {
        assertCurrencyAmount(balance.amount)
        const identity = characterCurrencyIdentity(balance)
        const key = createCharacterCurrencyIdentityKey(identity)
        if (identities.has(key))
          throw new CharacterSheetCommandError(
            `Currency "${balance.currencyId}" has duplicate identities in one currency group.`
          )
        identities.add(key)
        return { ...balance, ...identity }
      })
    }
  })
}

export function findCurrencyBalanceLocations(
  groups: readonly CharacterCurrencyGroup[],
  containerId: string | undefined,
  currencyId: string,
  identity: CharacterCurrencyIdentityDto
): CurrencyBalanceLocation[] {
  const identityKey = createCharacterCurrencyIdentityKey(identity)
  return groups.flatMap((group) => {
    if (group.containerId !== containerId) return []
    return group.currencies.flatMap((balance) => {
      const balanceIdentity = characterCurrencyIdentity(balance)
      if (
        balance.currencyId !== currencyId ||
        createCharacterCurrencyIdentityKey(balanceIdentity) !== identityKey
      ) {
        return []
      }
      return [{ balance, identity: balanceIdentity }]
    })
  })
}

export function sumCurrencyBalances(locations: readonly CurrencyBalanceLocation[]): bigint {
  return locations.reduce((total, location) => total + BigInt(location.balance.amount), 0n)
}

export function replaceCurrencyAtPlacement(input: {
  groups: readonly CharacterCurrencyGroup[]
  containerId: string | undefined
  identity: CharacterCurrencyIdentityDto
  amount: number
  retainZero?: boolean
  createId: () => string
}): CharacterCurrencyGroup[] {
  const identityKey = createCharacterCurrencyIdentityKey(input.identity)
  let replaced = false
  const keepBalance = input.amount !== 0 || input.retainZero === true
  const groups = input.groups.map((group) => {
    if (group.containerId !== input.containerId) return group
    return {
      ...group,
      currencies: group.currencies.flatMap((balance) => {
        if (createCharacterCurrencyIdentityKey(characterCurrencyIdentity(balance)) !== identityKey)
          return [balance]
        if (replaced || !keepBalance) return []
        replaced = true
        return [{ ...balance, ...input.identity, amount: input.amount }]
      })
    }
  })

  if (replaced || !keepBalance) return groups
  const groupIndex = groups.findIndex((group) => group.containerId === input.containerId)
  if (groupIndex >= 0) {
    const group = groups[groupIndex]!
    groups[groupIndex] = {
      ...group,
      currencies: [...group.currencies, { ...input.identity, amount: input.amount }]
    }
    return groups
  }
  return [
    ...groups,
    {
      id: input.createId(),
      containerId: input.containerId,
      currencies: [{ ...input.identity, amount: input.amount }]
    }
  ]
}

export function requireAcquirableCurrencyIdentity(
  command: Omit<Extract<CharacterSheetCommandInputDto, { type: 'ADJUST_CURRENCY' }>, 'commandId'>,
  options: readonly CharacterSheetCurrencyOptionDto[]
): CharacterCurrencyIdentityDto {
  const requestedKey = createCharacterCurrencyIdentityKey(characterCurrencyIdentity(command))
  for (const option of options) {
    const identity = currencyOptionIdentity(option)
    if (createCharacterCurrencyIdentityKey(identity) === requestedKey) return identity
  }
  throw new CharacterSheetCommandError(
    `Currency "${command.currencyId}" is not available for this system.`
  )
}
