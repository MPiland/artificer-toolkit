import { createContext, useContext } from 'react'
import type { CharacterSheetRollDestinations, CharacterSheetRolls } from './dice.types'

export const CharacterSheetRollContext = createContext<CharacterSheetRolls | null>(null)

export const CharacterSheetRollDestinationContext =
  createContext<CharacterSheetRollDestinations | null>(null)

export function useCharacterSheetRoll() {
  return useContext(CharacterSheetRollContext)
}

export function useCharacterSheetRollDestination() {
  return useContext(CharacterSheetRollDestinationContext)
}
