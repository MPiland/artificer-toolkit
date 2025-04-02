import { Character, ClassStartingEquipment } from '../../../../../../amplify/gql/types'
import { useGetSystemQuery } from '../../../../../apis/systemsApi'
import { UpdateState } from '../../../../../types/form'
import Dropdown from '../../../../Dropdown/Dropdown'
import { use, useEffect, useState } from 'react'
import { FormContext } from '../../../FormContext'
import { StartingEquipmentOption } from '../../../../../types/enums'
import { parseDiceRoll } from '../../../../../utils/dice'
import { useListClassesQuery } from '../../../../../apis/classesApi'
import { RollConfig } from '../../../../../types/components'
import Button from '../../../../Button/Button'
import Group from '../../../../Group/Group'
import { sprinkles } from '../../../../../css/sprinkles.css'
import { option_dropdown } from '../../../Character.css'
import { DiceContext } from '../../../../Dice/DiceContext'
import Collapse from '../../../../Collapse/Collapse'
import { createPortal } from 'react-dom'
import Scene from '../../../../Dice/Scene'
import Grid from '../../../../Grid/Grid'
import CharacterEquipment from '../../../Subforms/Character/CharacterEquipment/CharacterEquipment'
import CharacterCurrency from '../../../Subforms/Character/CharacterEquipment/CharacterCurrency'

const Equipment = () => {
  const [random, setRandom] = useState<boolean>(false)

  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { setDice, rollDice } = use(DiceContext)

  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()

  const primaryClass = classes.find((uClass) => formData.classes?.[0]?.id === uClass.id)

  const goldDieConfig = primaryClass?.startingGold?.dieConfig as RollConfig

  const parsedRoll = parseDiceRoll(goldDieConfig)

  const multipler = primaryClass?.startingGold?.multiplier || 1

  const form: HTMLFormElement = document.getElementById('form-content') as HTMLFormElement

  // Set total gold based on gold option
  useEffect(() => {
    if (formData?.classEquipment?.goldOption != null && formData?.classEquipment?.goldOption === goldDieConfig) {
      setRandom(true)
    } else {
      if (String(formData?.classEquipment?.totalGold) !== formData?.classEquipment?.goldOption) {
        updateFormData({
          type: 'update',
          path: 'classEquipment.totalGold',
          value: Number(formData?.classEquipment?.goldOption) * multipler,
        })
      }
    }
  }, [formData?.classEquipment, goldDieConfig, updateFormData, multipler])

  // Remove stale starting equipment if classes are removed
  useEffect(() => {
    if (formData?.classEquipment?.option && (!formData?.classes || !formData?.classes?.length)) {
      updateFormData({
        type: 'update',
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
  }, [formData?.classes, formData?.classEquipment, updateFormData])

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
    setDice.isRolling(true)

    try {
      // Call rollDice function with the input string
      const rollResult = await rollDice(goldDieConfig)

      rollResult?.kept?.forEach((keptObj) => {
        dieScore += keptObj.value
      })

      const amount = dieScore * multipler

      updateFormData({
        type: 'update',
        path: `classEquipment.totalGold`,
        value: amount,
      })
    } catch (error: any) {
      // Handle invalid input format error
      console.error(error)
    }

    setDice.isRolling(false)
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
          const amount = total * multipler
          updateFormData({
            type: 'update',
            path: `classEquipment.totalGold`,
            value: amount,
          })
        }
        break
      case 'roll':
        handleDiceRoll()
        break
    }
  }

  const handleEquipmentOption = (e: UpdateState<Character>) => {
    const classEquipment: ClassStartingEquipment = {
      __typename: 'ClassStartingEquipment',
      equipmentGroups: formData?.classEquipment?.equipmentGroups || null,
      goldOption: formData?.classEquipment?.goldOption || null,
      option: null,
      totalGold: formData?.classEquipment?.totalGold || null,
    }
    if (e.type === 'update') {
      if (e.path === 'classEquipment.option') {
        if (e.value !== formData?.classEquipment?.option) {
          if (formData?.classEquipment?.equipmentGroups?.length) {
            classEquipment.equipmentGroups = null
          }
          if (formData?.classEquipment?.goldOption) {
            classEquipment.goldOption = null
            if (formData?.classEquipment?.totalGold) {
              classEquipment.totalGold = null
            }
          }
        }
        classEquipment.option = e.value
      }
      updateFormData({
        type: 'update',
        path: 'classEquipment',
        value: classEquipment,
      })
    }
    if (e.type === 'remove') {
      updateFormData({
        type: 'update',
        path: 'classEquipment',
        value: null,
      })
    }
  }

  return (
    <>
      {form && createPortal(<Scene />, form)}
      <Grid>
        {!formData?.classes?.length ?
          <Grid.Item className={sprinkles({ alignContent: 'center' })}>
            <div>Please select a class.</div>
          </Grid.Item>
        : <>
            <Grid.Item>
              <Collapse>
                <Collapse.Header title='Starting Equipment' />
                <Collapse.Body>
                  <Grid>
                    <Grid.Item justify='center'>
                      <Dropdown
                        name='classEquipment.option'
                        value={formData?.classEquipment?.option}
                        label='Equipment or Gold'
                        className={option_dropdown}
                        onChange={handleEquipmentOption}
                        options={system.characters.startingEquipmentOptions}
                      />
                    </Grid.Item>
                    {formData.classEquipment?.option === StartingEquipmentOption.gold ?
                      <>
                        <Grid.Item justify='center'>
                          <Dropdown
                            name='classEquipment.goldOption'
                            value={formData?.classEquipment?.goldOption}
                            className={option_dropdown}
                            label='Gold'
                            options={combinationOptions}
                            onChange={updateFormData}
                          />
                        </Grid.Item>
                        <Grid.Item>
                          <Grid>
                            <Grid.Item justify='center'>
                              <span>Multipler: {multipler}</span>
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
                            {formData?.classEquipment?.totalGold && (
                              <Grid.Item justify='center'>
                                <h3>Total Gold: {formData?.classEquipment?.totalGold}</h3>
                              </Grid.Item>
                            )}
                          </Grid>
                        </Grid.Item>
                      </>
                    : <CharacterEquipment dataSource={primaryClass} />}
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

export default Equipment
