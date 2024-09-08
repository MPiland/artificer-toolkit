import { ReactElement, createContext } from 'react'
import { DiceConfigType, DiceResultType } from '../../utils/types'

export interface DiceContextProps {
  diceConfig: DiceConfigType[]
  setDiceConfig: (arg: DiceConfigType[]) => void
  diceResults: DiceResultType[]
  setDiceResults: (arg: any[]) => void
  rollDice: (input: string) => Promise<{ rolled: DiceResultType[]; kept: DiceResultType[] }>
  updateDiceResult: (type: number, value: number, id: string) => void
  renderDice: boolean
  setRenderDice: (arg: boolean) => void
  isRolling: boolean
  setIsRolling: (arg: boolean) => void
  diceInstances: ReactElement[]
  setDiceInstances: (arg: ReactElement[]) => void
  canvasHeight: number
  setCanvasHeight: (arg: number) => void
  canvasWidth: number
  setCanvasWidth: (arg: number) => void
  resetState: () => void
}

export const DiceContext = createContext<DiceContextProps | undefined>(undefined)
