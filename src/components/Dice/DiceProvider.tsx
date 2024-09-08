import { ReactElement, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { DiceConfigType, DiceResultType, Point } from '../../utils/types'
import { DiceContext, DiceContextProps } from './DiceContext'
import { generateRandomLinearVelocity, generateRandomRotation, generateRandomPoints } from '../../utils/dice'
import Dice from './Dice'
import { Vector3Tuple } from '@react-three/rapier'

interface DiceProviderProps {
  children: ReactNode
}

export const DiceProvider = ({ children }: DiceProviderProps) => {
  const [diceConfig, setDiceConfig] = useState<DiceConfigType[]>([])
  const [diceResults, setDiceResults] = useState<DiceResultType[]>([])
  const [renderDice, setRenderDice] = useState(true)
  const [isRolling, setIsRolling] = useState<boolean>(false)
  const [diceInstances, setDiceInstances] = useState<ReactElement[]>([])
  const [canvasWidth, setCanvasWidth] = useState<number>(0)
  const [canvasHeight, setCanvasHeight] = useState<number>(0)

  const diceResultsRef = useRef<DiceResultType[]>([])
  const diceConfigRef = useRef<DiceConfigType[]>([])
  const diceInstancesRef = useRef<ReactElement[]>([])
  const canvasHeightRef = useRef<number>(0)
  const canvasWidthRef = useRef<number>(0)

  const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36)
  }

  useEffect(() => {
    diceResultsRef.current = diceResults
  }, [diceResults])

  useEffect(() => {
    diceConfigRef.current = diceConfig
  }, [diceConfig])

  useEffect(() => {
    diceInstancesRef.current = diceInstances
  }, [diceInstances])

  useEffect(() => {
    canvasHeightRef.current = canvasHeight
  }, [canvasHeight])

  useEffect(() => {
    canvasWidthRef.current = canvasWidth
  }, [canvasWidth])

  const parseDiceRoll = (rollString: string) => {
    const rollRegex =
      /(?<numDice>\d*)d(?<diceType>\d+)?(?<keep>(?<keepType>(?:kl|kh))?(?<keepCount>\d+))?(?<drop>(?<dropType>(?:dl|dh))?(?<dropCount>\d+))?(?<reroll>(?<rerollType>(?:ro|r))?(?<rerollCondition>[<>])?(?<rerollValue>\d+)?)?/
    const match = rollString.match(rollRegex)
    if (!match) {
      console.log('No dice match')
    }

    const { numDice, diceType, keepType, keepCount, dropType, dropCount, rerollType, rerollCondition, rerollValue } =
      match?.groups as any

    return {
      numDice,
      diceType,
      keepType,
      keepCount,
      dropType,
      dropCount,
      rerollType,
      rerollCondition,
      rerollValue,
    }
  }

  // Create instances of dice using random positioning based on center point and then creating the velocity based on the position of each instance
  const generateDiceInstances = (configArray: DiceConfigType[], positions: Point[]): ReactElement[] => {
    let positionIndex = 0
    const linearVelocity = generateRandomLinearVelocity(canvasWidthRef.current, canvasHeightRef.current)

    return configArray.flatMap(({ quantity, type }) => {
      const instances: ReactElement[] = []
      for (let i = 0; i < quantity; i++) {
        const { x, y, z } = positions[positionIndex]
        const adjustedPosition: Vector3Tuple = [x, y, z]
        const rotation = generateRandomRotation()
        instances.push(
          <Dice
            type={type}
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
  }

  const diceInstancesGeneration = (configArray: DiceConfigType[]): ReactElement[] => {
    const startPosition: Point = { x: 0, y: 0, z: 12 }
    const totalQuantity = configArray.reduce((total, { quantity }) => total + quantity, 0)
    const positions = generateRandomPoints(totalQuantity, 3, startPosition)
    return generateDiceInstances(configArray, positions)
  }

  const updateDiceResult = async (type: number, value: number, id: string) => {
    setDiceResults((prevResults) => {
      const newResults = [...prevResults, { type, value, id }]
      diceResultsRef.current = newResults
      return newResults
    })
  }

  const diceResultObject = useCallback((input: string) => {
    const rolled = [...diceResultsRef.current]
    const rollStrings = input.split(' ')
    let kept = [...rolled]

    rollStrings.forEach((rollString) => {
      const { keepType, keepCount, dropType, dropCount, diceType } = parseDiceRoll(rollString)
      if (keepType || dropType) {
        let diceOfType = rolled.filter((result) => result.type === parseInt(diceType))

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

        kept = kept.filter((result) => result.type !== parseInt(diceType)).concat(diceOfType)
      }
    })
    setDiceResults([])
    return { rolled, kept }
  }, [])

  const checkResults = async (diceRolls: DiceConfigType[]) => {
    const expectedResultsCount = diceRolls.reduce((acc, roll) => acc + roll.quantity, 0)

    while (diceResultsRef.current.length !== expectedResultsCount || expectedResultsCount === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return true
  }

  const checkReroll = async (diceRolls: DiceConfigType[]) => {
    let rerollNeeded = false
    const rollTracker = diceConfigRef.current.map((configObject) => ({ type: configObject.type, rollCount: 0 }))

    do {
      rerollNeeded = false
      const diceConfigClone = [...diceConfigRef.current]
      const diceInstancesClone = [...diceInstancesRef.current]
      const diceResultsClone = [...diceResultsRef.current]
      const rerollConfig: DiceConfigType[] = []

      diceConfigClone.forEach((configObject) => {
        const tracker = rollTracker.find((tracker) => tracker.type === configObject.type)

        if (configObject.rerollType && configObject.rerollValue && tracker) {
          const rerollType = configObject.rerollType
          if (rerollType === 'r' || (rerollType === 'ro' && tracker.rollCount === 0)) {
            const rerollValue = configObject.rerollValue
            const rerollCondition = configObject.rerollCondition ?? '==='
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
                  rerollNeeded = true
                }
              }
            }

            if (rerollCount > 0) {
              tracker.rollCount += 1
              rerollConfig.push({
                ...configObject,
                quantity: rerollCount,
                rerollType: configObject.rerollType,
                rerollCondition: configObject.rerollCondition,
                rerollValue: configObject.rerollValue,
              })
            }
          }
        }
      })

      // If rerolls were performed, update state and continue checking
      if (rerollNeeded) {
        setDiceResults(diceResultsClone)
        diceResultsRef.current = diceResultsClone
        const rerollInstances: ReactElement[] = diceInstancesGeneration(rerollConfig)
        diceInstancesClone.push(...rerollInstances)
        setDiceInstances(diceInstancesClone)
      } else {
        return
      }

      await checkResults(diceRolls)
    } while (rerollNeeded)
  }

  const rollDice = async (input: string) => {
    return new Promise<{ rolled: DiceResultType[]; kept: DiceResultType[] }>((resolve) => {
      setRenderDice(true)
      setIsRolling(true)
      setDiceResults([])
      const diceRolls: any[] = []
      const rollStrings = input.split(' ')

      for (let i = 0; i < rollStrings.length; i++) {
        const { numDice, diceType, rerollType, rerollCondition, rerollValue } = parseDiceRoll(rollStrings[i])
        diceRolls.push({
          quantity: numDice ? parseInt(numDice) : 1,
          type: diceType ? parseInt(diceType) : 4,
          rerollType: rerollType,
          rerollCondition: rerollCondition,
          rerollValue: parseInt(rerollValue),
        })
      }
      setDiceConfig(diceRolls)
      const generatedDice = diceInstancesGeneration(diceRolls)
      setDiceInstances(generatedDice)
      checkResults(diceRolls).then(() =>
        checkReroll(diceRolls).then(() => {
          const result = diceResultObject(input)
          resolve(result)
        })
      )
    })
  }

  const resetState = () => {
    setDiceInstances([])
    setDiceConfig([])
    setDiceResults([])
    setRenderDice(false)
    setIsRolling(false)
  }

  const value: DiceContextProps = {
    diceConfig,
    setDiceConfig,
    diceResults,
    setDiceResults,
    rollDice,
    updateDiceResult,
    renderDice,
    setRenderDice,
    isRolling,
    setIsRolling,
    diceInstances,
    setDiceInstances,
    canvasHeight,
    setCanvasHeight,
    canvasWidth,
    setCanvasWidth,
    resetState,
  }

  return <DiceContext.Provider value={value}>{children}</DiceContext.Provider>
}
