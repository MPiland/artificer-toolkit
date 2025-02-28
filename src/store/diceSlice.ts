import { StateCreator } from 'zustand'
import { ReactElement } from 'react'
import { DiceConfig, DiceResult } from '../types/components'
import { DiceProps } from '../components/Dice/Dice'
import { CombinedSlice } from './useStore'

export interface DiceSlice {
  dice: {
    config: DiceConfig[]
    results: DiceResult[]
    instances: ReactElement<DiceProps>[]
    isRolling: boolean
    renderDice: boolean
    canvasWidth: number
    canvasHeight: number
    rerollCount: number
  }

  setDiceConfig: (config: DiceConfig[]) => void
  setDiceResults: (results: DiceResult[]) => void
  addDiceResult: (result: DiceResult) => void
  setDiceInstances: (instances: ReactElement<DiceProps>[]) => void
  setIsRolling: (isRolling: boolean) => void
  setRenderDice: (renderDice: boolean) => void
  setCanvasWidth: (width: number) => void
  setCanvasHeight: (height: number) => void
  setRerollCount: (count: number) => void
  resetDice: () => void
}

export const diceSlice: StateCreator<CombinedSlice, [], [], DiceSlice> = (set) => {
  const defaultState: Pick<DiceSlice, 'dice'> = {
    dice: {
      config: [],
      results: [],
      instances: [],
      isRolling: false,
      renderDice: false,
      canvasWidth: 0,
      canvasHeight: 0,
      rerollCount: 0,
    },
  }

  return {
    ...defaultState,

    setDiceConfig: (config) => set((state) => ({ dice: { ...state.dice, config } })),

    setDiceResults: (results) => set((state) => ({ dice: { ...state.dice, results } })),

    addDiceResult: (result) =>
      set((state) => ({
        dice: { ...state.dice, results: [...state.dice.results, result] },
      })),

    setDiceInstances: (instances) => set((state) => ({ dice: { ...state.dice, instances } })),

    setIsRolling: (isRolling) => set((state) => ({ dice: { ...state.dice, isRolling } })),

    setRenderDice: (renderDice) => set((state) => ({ dice: { ...state.dice, renderDice } })),

    setCanvasWidth: (canvasWidth) => set((state) => ({ dice: { ...state.dice, canvasWidth } })),

    setCanvasHeight: (canvasHeight) => set((state) => ({ dice: { ...state.dice, canvasHeight } })),

    setRerollCount: (rerollCount) => set((state) => ({ dice: { ...state.dice, rerollCount } })),

    resetDice: () =>
      set((state) => ({
        ...state,
        dice: { ...defaultState.dice, canvasHeight: state.dice.canvasHeight, canvasWidth: state.dice.canvasWidth },
      })),
  }
}
