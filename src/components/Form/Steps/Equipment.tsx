import Dropdown from '@/components/Dropdown'
import { use, useEffect, useState } from 'react'
import { FormContext } from '../FormContext'
import { StartingEquipOptions } from '@/enums'
import { parseDiceRoll, type RollConfig, DiceContext, Scene } from '@/components/Dice'
import Button from '@/components/Button'
import Group from '@/components/Group'
import { sprinkles } from '@/css/sprinkles.css'
import { option_dropdown } from '../Character.css'
import Collapse from '@/components/Collapse'
import { createPortal } from 'react-dom'
import Grid from '@/components/Grid'
import CharacterEquipment from '../Substeps/Character/Equipment/CharacterEquipment'
import CharacterCurrency from '../Substeps/Character/Equipment/CharacterCurrency'
import { useSystemData, useClassData } from '@/hooks'
import type { OnChange, Character, ClassStartingEquipment } from '@/types'

const EquipmentStep = () => {
  const [random, setRandom] = useState<boolean>(false)

  const {
    formStore: { data, updateField, removeField },
  } = use(FormContext) as {
    formStore: {
      data: Character
      updateField: OnChange<Character>['updateField']
      removeField: OnChange<Character>['removeField']
    }
  }

  const { rollDice, setIsRolling } = use(DiceContext)

  const { characters } = useSystemData()
  const {
    classes: { findClass },
  } = useClassData()

  const primaryClass = findClass(data.classes?.[0]?.id)

  const goldDieConfig = primaryClass?.startingGold?.dieConfig as RollConfig

  const parsedRoll = parseDiceRoll(goldDieConfig)

  const multiplier = primaryClass?.startingGold?.multiplier || 1

  const form: HTMLFormElement = document.getElementById('form-content') as HTMLFormElement

  // Set total gold based on gold option
  useEffect(() => {
    if (data?.classEquipment?.goldOption) {
      if (data?.classEquipment?.goldOption === goldDieConfig) {
        setRandom(true)
      } else {
        if (data?.classEquipment?.totalGold !== Number(data?.classEquipment?.goldOption)) {
          updateField({
            path: 'classEquipment.totalGold',
            value: Number(data?.classEquipment?.goldOption) * multiplier,
          })
        }
      }
    }
  }, [data?.classEquipment?.goldOption, data?.classEquipment?.totalGold, goldDieConfig, multiplier, updateField])

  // Remove stale starting equipment if classes are removed
  useEffect(() => {
    if (data?.classEquipment?.option && (!data?.classes || !data?.classes?.length)) {
      updateField({
        path: 'classEquipment',
        value: {
          __typename: 'ClassStartingEquipment',
          equipmentGroups: null,
          goldOption: null,
          totalGold: null,
          option: null,
          addedToCharacter: false,
        },
      })
    }
  }, [data, updateField])

  // Generate all possible combinations for the dice
  const generateCombinations = (quantity: number, die: number): string[] => {
    if (quantity === 0) return ['']
    if (quantity === 1) return Array.from({ length: die }, (_, i) => `${i + 1}`)

    const result: string[] = []
    const prevCombinations = generateCombinations(quantity - 1, die)

    if (result?.length === 0) {
      result.push(goldDieConfig)
    }

    for (let i = 1; i <= die; i++) {
      for (const combo of prevCombinations) {
        result.push(combo ? `${i}+${combo}` : `${i}`)
      }
    }

    return result
  }

  // Get all combinations and create options
  const combinations = generateCombinations(parsedRoll?.quantity, parsedRoll?.die)
  const combinationOptions = combinations.map((combo, index) => {
    if (index === 0) {
      return {
        id: goldDieConfig,
        label: goldDieConfig,
        value: goldDieConfig,
      }
    }
    const sum = combo.split('+').reduce((sum, val) => sum + parseInt(val), 0)
    return {
      id: `${sum}`,
      label: `${sum}`,
      value: `${sum}`,
    }
  })

  const handleDiceRoll = async () => {
    let dieScore: number = 0
    setIsRolling(true)

    try {
      // Call rollDice function with the input string
      const rollResult = await rollDice(goldDieConfig)

      rollResult?.kept?.forEach((keptObj) => {
        dieScore += keptObj.value
      })

      const amount = dieScore * multiplier

      updateField({ path: `classEquipment.totalGold`, value: amount })
    } catch (error: any) {
      // Handle invalid input format error
      console.error(error)
    }

    setIsRolling(false)
  }

  const handleRandom = (type: 'random' | 'roll') => {
    switch (type) {
      case 'random':
        {
          let total = 0
          for (let i = 0; i < parsedRoll?.quantity; i++) {
            // Generate a random number between 1 and dieType (inclusive)
            const roll = Math.floor(Math.random() * parsedRoll?.die) + 1
            total += roll
          }
          const amount = total * multiplier
          updateField({ path: `classEquipment.totalGold`, value: amount })
        }
        break
      case 'roll':
        handleDiceRoll()
        break
    }
  }

  return (
    <>
      {form && createPortal(<Scene />, form)}
      <Grid>
        {!data?.classes?.length ?
          <Grid.Item className={sprinkles({ alignContent: 'center' })}>
            <div>Please select a class.</div>
          </Grid.Item>
        : <>
            <Grid.Item>
              <Collapse>
                <Collapse.Header title='Starting EquipmentStep' />
                <Collapse.Body>
                  <Grid>
                    <Grid.Item justify='center'>
                      <Dropdown<Character>
                        name='classEquipment.option'
                        value={data?.classEquipment?.option}
                        label='Equipment or Gold'
                        className={option_dropdown}
                        onChange={{
                          updateField: ({ path, value }) => {
                            const classEquipment: ClassStartingEquipment = {
                              __typename: 'ClassStartingEquipment',
                              equipmentGroups: data?.classEquipment?.equipmentGroups || null,
                              goldOption: data?.classEquipment?.goldOption || null,
                              option: '',
                              totalGold: data?.classEquipment?.totalGold || null,
                            }

                            if (path === 'classEquipment.option') {
                              if (value !== data?.classEquipment?.option) {
                                if (data?.classEquipment?.equipmentGroups?.length) {
                                  classEquipment.equipmentGroups = null
                                }
                                if (data?.classEquipment?.goldOption) {
                                  classEquipment.goldOption = null
                                  if (data?.classEquipment?.totalGold) {
                                    classEquipment.totalGold = null
                                  }
                                }
                              }
                              classEquipment.option = value
                            }

                            return { path: 'classEquipment', value: classEquipment }
                          },
                          removeField: () => ({
                            path: 'classEquipment',
                          }),
                        }}
                        options={characters.startingEquipmentOptions}
                      />
                    </Grid.Item>
                    {data.classEquipment?.option === StartingEquipOptions.GOLD ?
                      <>
                        <Grid.Item justify='center'>
                          <Dropdown
                            name='classEquipment.goldOption'
                            value={data?.classEquipment?.goldOption}
                            className={option_dropdown}
                            label='Gold'
                            options={combinationOptions}
                            onChange={{ updateField, removeField }}
                          />
                        </Grid.Item>
                        <Grid.Item>
                          <Grid>
                            <Grid.Item justify='center'>
                              <span>Multipler: {multiplier}</span>
                            </Grid.Item>
                            <Grid.Item>
                              <Group justifyContentVariant='center'>
                                {random && (
                                  <>
                                    <Button
                                      className={sprinkles({ me: 'space-2' })}
                                      onClick={() => handleRandom('random')}
                                    >
                                      Randomize
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRandom('roll')
                                      }}
                                    >
                                      Roll Dice
                                    </Button>
                                  </>
                                )}
                              </Group>
                            </Grid.Item>
                            {data?.classEquipment?.totalGold && (
                              <Grid.Item justify='center'>
                                <h3>Total Gold: {data?.classEquipment?.totalGold}</h3>
                              </Grid.Item>
                            )}
                          </Grid>
                        </Grid.Item>
                      </>
                    : primaryClass && <CharacterEquipment dataSource={primaryClass} />}
                  </Grid>
                </Collapse.Body>
              </Collapse>
            </Grid.Item>
            <CharacterCurrency />
          </>
        }
      </Grid>
    </>
  )
}

export default EquipmentStep
