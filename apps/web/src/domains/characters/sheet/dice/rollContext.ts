import { createContext, useContext } from 'react'
import type {
  CharacterSheetRollDestinations,
  CharacterSheetRollPresentation,
  CharacterSheetRolls
} from './dice.types'

export const CharacterSheetRollContext = createContext<CharacterSheetRolls | null>(null)

export const CharacterSheetRollDestinationContext =
  createContext<CharacterSheetRollDestinations | null>(null)

export const CharacterSheetRollPresentationContext =
  createContext<CharacterSheetRollPresentation | null>(null)

export function useCharacterSheetRoll() {
  return useContext(CharacterSheetRollContext)
}

export function useCharacterSheetRollDestination() {
  return useContext(CharacterSheetRollDestinationContext)
}

export function useCharacterSheetRollPresentation() {
  return useContext(CharacterSheetRollPresentationContext)
}
