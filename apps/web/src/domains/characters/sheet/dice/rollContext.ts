import { createContext, useContext } from 'react'
import type { CharacterSheetRollController } from './dice.types'

export const CharacterSheetRollContext = createContext<CharacterSheetRollController | null>(null)

export function useCharacterSheetRoll() {
  return useContext(CharacterSheetRollContext)
}
