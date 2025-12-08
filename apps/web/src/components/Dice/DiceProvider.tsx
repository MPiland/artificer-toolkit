import { z } from 'zod/v4'
import { ReactElement, useCallback, ReactNode, useEffect, useRef } from 'react'
import type { DiceConfig, DiceResult, Point, DiceProps } from './Dice.types'
import { generateRandomLinearVelocity, generateRandomRotation, generateRandomPoints, parseDiceRoll } from './Dice.utils'
import Dice from './Dice'
import { Vector3Tuple } from '@react-three/rapier'
import { DiceContext } from './DiceContext'
import { useDiceStore } from '~store'
import { ROLL_CONFIG_REGEX } from '../Form'

const useDiceOptions = () => {
  const rollPromiseResolver = useRef<((result: { rolled: DiceResult[]; kept: DiceResult[] }) => void) | null>(null)

  const {
    dice,
    setConfig,
    setInstances,
    setResults,
    setCanvasHeight,
    setCanvasWidth,
    setIsRolling,
    setRenderDice,
    setRerollCount,
    resetState,
  } = useDiceStore((state) => state)

  // Create instances of dice using random positioning based on center point and then creating the velocity based on the position of each instance
  const generateDiceInstances = useCallback(
    (configArray: DiceConfig[], positions: Point[]) => {
      let positionIndex = 0
      const linearVelocity = generateRandomLinearVelocity(dice.canvasWidth, dice.canvasHeight)

      return configArray.flatMap(({ quantity, die }) => {
        const instances: ReactElement<DiceProps>[] = []
        for (let i = 0; i < quantity; i++) {
          const { x, y, z } = positions[positionIndex]
          const adjustedPosition: Vector3Tuple = [x, y, z]
          const rotation = generateRandomRotation()
          instances.push(
            <Dice
              die={die}
              position={adjustedPosition}
              linearVelocity={linearVelocity}
              rotation={rotation}
              friction={1}
              gravityScale={8.7}
              restitution={0}
              key={generateUniqueId()}
              id={generateUniqueId()}
            />
          )
          positionIndex++
        }
        return instances
      })
    },
    [dice.canvasHeight, dice.canvasWidth]
  )

  const diceInstancesGeneration = useCallback(
    (configArray: DiceConfig[]) => {
      const startPosition: Point = { x: 0, y: 0, z: 12 }
      const totalQuantity = configArray.reduce((total, { quantity }) => total + quantity, 0)
      const positions = generateRandomPoints(totalQuantity, 3, startPosition)
      return generateDiceInstances(configArray, positions)
    },
    [generateDiceInstances]
  )

  const reroll = useCallback(async () => {
    const rollTracker = dice.config.map((configObject) => ({ die: configObject.die, rollCount: 0 }))

    const diceInstancesClone = [...dice.instances]
    const diceResultsClone = [...dice.results]
    const rerollConfig: DiceConfig[] = []

    dice.config.forEach((config) => {
      const tracker = rollTracker.find((tracker) => tracker.die === config.die)

      if (config.rerollType && config.rerollValue && tracker) {
        const rerollType = config.rerollType
        if (rerollType === 'r' || (rerollType === 'ro' && tracker.rollCount === 0)) {
          const rerollValue = config.rerollValue
          const rerollCondition = config.rerollCondition || '==='
          let rerollCount: number = 0

          for (let i = diceResultsClone.length - 1; i >= 0; i--) {
            if (eval(`${diceResultsClone[i].value} ${rerollCondition} ${rerollValue}`)) {
              const rerollIndex = diceInstancesClone.findIndex((instance) => {
                return instance.props.id === diceResultsClone[i].id
              })
              if (rerollIndex !== -1) {
                diceInstancesClone.splice(rerollIndex, 1)
                diceResultsClone.splice(i, 1)
                rerollCount += 1
              }
            }
          }

          if (rerollCount > 0) {
            tracker.rollCount += 1
            rerollConfig.push({
              ...config,
              quantity: rerollCount,
              rerollType: config.rerollType,
              rerollCondition: config.rerollCondition,
              rerollValue: config.rerollValue,
            })
          }
        }
      }
    })

    if (rerollConfig.length > 0) {
      setResults(diceResultsClone)
      const rerollInstances = diceInstancesGeneration(rerollConfig)
      diceInstancesClone.push(...rerollInstances)
      setInstances(diceInstancesClone)
    }
  }, [dice.config, dice.instances, dice.results, setInstances, setResults, diceInstancesGeneration])

  const diceResultObject = useCallback(() => {
    const rolled = [...dice.results]
    let kept = [...rolled]

    dice.config.forEach((config) => {
      const { keepType, keepCount, dropType, dropCount, die } = config
      if (keepType || dropType) {
        let diceOfType = rolled.filter((result) => result.die === die)

        if (dropType && dropCount) {
          diceOfType.sort((a, b) => a.value! - b.value!)
          if (dropType === 'dl') {
            diceOfType = diceOfType.slice(dropCount)
          } else {
            diceOfType = diceOfType.slice(0, diceOfType.length - dropCount)
          }
        }

        if (keepType && keepCount) {
          diceOfType.sort((a, b) => b.value! - a.value!)
          if (keepType === 'kl') {
            diceOfType = diceOfType.slice(keepCount)
          } else {
            diceOfType = diceOfType.slice(0, keepCount)
          }
        }

        kept = kept.filter((result) => result.die !== die).concat(diceOfType)
      }
    })
    setResults([])
    return { rolled, kept }
  }, [dice.results, setResults, dice.config])

  useEffect(() => {
    const rollCount = dice.config.reduce((acc, roll) => acc + roll.quantity, 0)
    if (dice.results.length === rollCount && rollCount > 0) {
      dice.config.forEach((config) => {
        if (config.rerollType === 'r' || config.rerollType === 'ro') {
          const dieReroll = dice.results.some(
            (result) => result.die === config.die && result.value === config.rerollValue
          )
          // if (dieReroll) {
          if (dieReroll && (config.rerollType === 'r' || (config.rerollType === 'ro' && dice.rerollCount < 1))) {
            setRerollCount(dice.rerollCount + 1)
            reroll()
          }
        }
      })
    }
  }, [dice.config, dice.results, reroll, setRerollCount, dice.rerollCount])

  useEffect(() => {
    // Only proceed if we're rolling and have a resolver
    if (!dice.isRolling || !rollPromiseResolver.current) return

    const rollCount = dice.config.reduce((acc, roll) => acc + roll.quantity, 0)

    // Check if all dice have reported results
    if (dice.results.length === rollCount && rollCount > 0) {
      // Check if any need rerolling
      const needsReroll = dice.config.some(
        (config) =>
          (config.rerollType === 'r' || (config.rerollType === 'ro' && dice.rerollCount < 1)) &&
          dice.results.some((result) => result.die === config.die && result.value === config.rerollValue)
      )

      if (!needsReroll) {
        // All done! Calculate results and resolve
        const result = diceResultObject()
        rollPromiseResolver.current(result)
        rollPromiseResolver.current = null
      }
    }
  }, [dice.results, dice.config, dice.isRolling, diceResultObject, dice.rerollCount])

  useEffect(() => {
    return () => {
      // Clear resolver if component unmounts during a roll
      if (rollPromiseResolver.current) {
        rollPromiseResolver.current = null
      }
    }
  }, [])

  const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36)
  }

  const updateDiceResult = async (die: number, value: number, id: string) => {
    const results = [...dice.results, { die, value, id }]
    setResults(results)
  }

  const rollDice = async (input: string) => {
    return new Promise<{ rolled: DiceResult[]; kept: DiceResult[] }>((resolve) => {
      rollPromiseResolver.current = resolve

      setRenderDice(true)
      setIsRolling(true)
      setResults([])

      const diceRolls: DiceConfig[] = []
      const rollStrings = input.split(' ')

      for (let i = 0; i < rollStrings.length; i++) {
        if (!z.string(rollStrings[i]).regex(ROLL_CONFIG_REGEX)) return
        const parsedRoll = parseDiceRoll(rollStrings[i])
        diceRolls.push({
          quantity: parsedRoll?.quantity || 1,
          die: parsedRoll?.die || 4,
          rerollType: parsedRoll?.rerollType,
          rerollCondition: parsedRoll?.rerollCondition,
          rerollValue: parsedRoll?.rerollValue,
          keepType: parsedRoll?.keepType,
          keepCount: parsedRoll?.keepCount,
          dropType: parsedRoll?.dropType,
          dropCount: parsedRoll?.dropCount,
        })
      }

      setConfig(diceRolls)

      const generatedDice = diceInstancesGeneration(diceRolls)
      setInstances(generatedDice)
    })
  }

  const value = {
    dice,
    setConfig,
    setInstances,
    setRenderDice,
    setIsRolling,
    setResults,
    rollDice,
    updateDiceResult,
    setCanvasHeight,
    setCanvasWidth,
    resetState,
  }

  return value
}

export type DiceOptionsType = ReturnType<typeof useDiceOptions>

const DiceProvider = ({ children }: { children: ReactNode }) => {
  const diceOptions = useDiceOptions()
  return <DiceContext value={diceOptions}>{children}</DiceContext>
}

export default DiceProvider
