import { create } from 'zustand'
import { ReactElement } from 'react'
import type { DiceConfig, DiceResult, DiceProps } from '~/components/Dice'
import { persist } from 'zustand/middleware'

export interface DiceStore {
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

  setConfig: (config: DiceConfig[]) => void
  setResults: (results: DiceResult[]) => void
  addResult: (result: DiceResult) => void
  setInstances: (instances: ReactElement<DiceProps>[]) => void
  setIsRolling: (isRolling: boolean) => void
  setRenderDice: (renderDice: boolean) => void
  setCanvasWidth: (width: number) => void
  setCanvasHeight: (height: number) => void
  setRerollCount: (count: number) => void
  resetState: () => void
}

export const useDiceStore = create<DiceStore>()(
  persist(
    (set) => {
      const defaultState: Pick<DiceStore, 'dice'> = {
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

        setConfig: (config) => set((state) => ({ dice: { ...state.dice, config } })),

        setResults: (results) => set((state) => ({ dice: { ...state.dice, results } })),

        addResult: (result) =>
          set((state) => ({
            dice: { ...state.dice, results: [...state.dice.results, result] },
          })),

        setInstances: (instances) => set((state) => ({ dice: { ...state.dice, instances } })),

        setIsRolling: (isRolling) => set((state) => ({ dice: { ...state.dice, isRolling } })),

        setRenderDice: (renderDice) => set((state) => ({ dice: { ...state.dice, renderDice } })),

        setCanvasWidth: (canvasWidth) => set((state) => ({ dice: { ...state.dice, canvasWidth } })),

        setCanvasHeight: (canvasHeight) => set((state) => ({ dice: { ...state.dice, canvasHeight } })),

        setRerollCount: (rerollCount) => set((state) => ({ dice: { ...state.dice, rerollCount } })),

        resetState: () =>
          set((state) => ({
            ...state,
            dice: { ...defaultState.dice, canvasHeight: state.dice.canvasHeight, canvasWidth: state.dice.canvasWidth },
          })),
      }
    },
    {
      name: 'atapp-dice-store',
    }
  )
)
