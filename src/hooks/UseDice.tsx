import { useContext } from 'react'
import { DiceContext, DiceContextProps } from '../components/Dice/DiceContext'

export const useDice = (): DiceContextProps => {
  const context = useContext(DiceContext)
  if (!context) {
    throw new Error('useDice must be used within a DiceProvider')
  }

  return context
}
