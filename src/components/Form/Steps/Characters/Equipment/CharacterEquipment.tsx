import { use, useEffect, useState } from 'react'
import { StartingEquipOptions } from '@/enums'
import { parseDiceRoll, DiceContext, Scene } from '@/components/Dice'
import { sprinkles } from '@/css/sprinkles.css'
import Collapsible from '@/components/Collapse'
import { createPortal } from 'react-dom'
import { useSystemData, useClassData, useFieldUpdates } from '@/hooks'
import type { ClassStartingEquipmentInput, CharacterInput } from '@/types'
import { Grid, Group, Button } from '@mantine/core'
import { withForm, option_dropdown, CharacterEquipmentOptions, CharacterCurrency } from '@/components/Form'
import { CharacterInputSchema, ClassStartingEquipmentInputSchema } from '@/schemas'
import { useTypedFormStore } from '@/store'
import type { z } from 'zod/v4'

const CharacterEquipmentStep = withForm({
  defaultValues: {} as z.input<typeof CharacterInputSchema>,
  render: function Render({ form }) {
    const { AppField } = form

    const store = useTypedFormStore<CharacterInput>()
    const updateField = store((state) => state.updateField)
    const classes = store((state) => state.current?.classes)
    const classEquipment = store((state) => state.current?.classEquipment)

    const { fieldListeners } = useFieldUpdates({ data: 'form' })

    const [random, setRandom] = useState<boolean>(false)

    const { rollDice, setIsRolling } = use(DiceContext)

    const { characters } = useSystemData()

    const {
      classes: { findClass },
    } = useClassData()

    const primaryClass = findClass(classes?.[0]?.id)

    const goldDieConfig = primaryClass?.startingGold?.dieConfig

    const parsedRoll = parseDiceRoll(goldDieConfig)

    const multiplier = primaryClass?.startingGold?.multiplier || 1

    const formType: HTMLFormElement = document.getElementById('form-content') as HTMLFormElement

    // Set total gold based on gold option
    useEffect(() => {
      if (classEquipment?.goldOption) {
        if (classEquipment?.goldOption === goldDieConfig) {
          setRandom(true)
        } else {
          if (classEquipment?.totalGold !== Number(classEquipment?.goldOption)) {
            form.setFieldValue('classEquipment.totalGold', Number(classEquipment?.goldOption) * multiplier)
            updateField({
              path: 'classEquipment.totalGold',
              value: Number(classEquipment?.goldOption) * multiplier,
            })
          }
        }
      }
    }, [classEquipment?.goldOption, classEquipment?.totalGold, goldDieConfig, multiplier, form, updateField])

    // Remove stale starting equipment if classes are removed
    useEffect(() => {
      if (classEquipment?.option && (!classes || !classes?.length)) {
        form.setFieldValue(
          'classEquipment',
          ClassStartingEquipmentInputSchema.parse({
            equipmentGroups: null,
            goldOption: null,
            totalGold: null,
            option: null,
            addedToCharacter: false,
          })
        )
        updateField({
          path: 'classEquipment',
          value: ClassStartingEquipmentInputSchema.parse({
            equipmentGroups: null,
            goldOption: null,
            totalGold: null,
            option: null,
            addedToCharacter: false,
          }),
        })
      }
    }, [form, classes, classEquipment?.option, updateField])

    // Generate all possible combinations for the dice
    const generateCombinations = (quantity: number, die: number): string[] => {
      if (quantity === 0) return ['']
      if (quantity === 1) return Array.from({ length: die }, (_, i) => `${i + 1}`)

      const result: string[] = []
      const prevCombinations = generateCombinations(quantity - 1, die)

      if (result?.length === 0 && goldDieConfig) {
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
    const combinations = generateCombinations(parsedRoll?.quantity || 0, parsedRoll?.die || 0)
    const combinationOptions = combinations.map((combo, index) => {
      if (index === 0 && goldDieConfig) {
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
        if (!goldDieConfig) return
        // Call rollDice function with the input string
        const rollResult = await rollDice(goldDieConfig)

        rollResult?.kept?.forEach((keptObj) => {
          dieScore += keptObj.value
        })

        const amount = dieScore * multiplier
        form.setFieldValue('classEquipment.totalGold', amount)
        updateField({ path: 'classEquipment.totalGold', value: amount })
      } catch (error: unknown) {
        // Handle invalid input format error
        console.log(error)
      }

      setIsRolling(false)
    }

    const handleRandom = (type: 'random' | 'roll') => {
      switch (type) {
        case 'random':
          {
            let total = 0
            for (let i = 0; i < (parsedRoll?.quantity || 0); i++) {
              // Generate a random number between 1 and dieType (inclusive)
              const roll = Math.floor(Math.random() * (parsedRoll?.die || 0)) + 1
              total += roll
            }
            const amount = total * multiplier
            form.setFieldValue('classEquipment.totalGold', amount)
            updateField({ path: 'classEquipment.totalGold', value: amount })
          }
          break
        case 'roll':
          handleDiceRoll()
          break
      }
    }

    return (
      <>
        {formType && createPortal(<Scene />, formType)}
        <Grid>
          {!classes?.length ?
            <Grid.Col className={sprinkles({ alignContent: 'center' })}>
              <div>Please select a class.</div>
            </Grid.Col>
          : <>
              <Grid.Col>
                <Collapsible
                  props={{
                    trigger: {
                      title: 'Starting Equipment',
                    },
                  }}
                >
                  <Grid>
                    <AppField
                      name='classEquipment.option'
                      listeners={{
                        ...fieldListeners,
                        onChange: ({ value }) => {
                          if (value != null) {
                            const classEquipmentObj: ClassStartingEquipmentInput =
                              ClassStartingEquipmentInputSchema.parse({
                                equipmentGroups: classEquipment?.equipmentGroups || null,
                                goldOption: classEquipment?.goldOption || null,
                                option: '',
                                totalGold: classEquipment?.totalGold || null,
                              })

                            if (value !== classEquipment?.option) {
                              if (classEquipment?.equipmentGroups?.length) {
                                classEquipmentObj.equipmentGroups = null
                              }
                              if (classEquipment?.goldOption) {
                                classEquipmentObj.goldOption = null
                                if (classEquipment?.totalGold) {
                                  classEquipmentObj.totalGold = null
                                }
                              }
                            }
                            classEquipmentObj.option = value as string

                            return { ...classEquipmentObj, id: value }
                          }
                        },
                      }}
                    >
                      {({ DropdownField }) => (
                        <Grid.Col>
                          <DropdownField
                            className={option_dropdown}
                            label='Gold'
                            options={characters.startingEquipmentOptions}
                          />
                        </Grid.Col>
                      )}
                    </AppField>
                    {classEquipment?.option === StartingEquipOptions.GOLD ?
                      <>
                        <AppField name='classEquipment.goldOption' listeners={fieldListeners}>
                          {({ DropdownField }) => (
                            <Grid.Col>
                              <DropdownField className={option_dropdown} label='Gold' options={combinationOptions} />
                            </Grid.Col>
                          )}
                        </AppField>
                        <Grid.Col>
                          <Grid>
                            <Grid.Col>
                              <span>Multipler: {multiplier}</span>
                            </Grid.Col>
                            <Grid.Col>
                              <Group justify='center'>
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
                            </Grid.Col>
                            {classEquipment?.totalGold && (
                              <Grid.Col>
                                <h3>Total Gold: {classEquipment?.totalGold}</h3>
                              </Grid.Col>
                            )}
                          </Grid>
                        </Grid.Col>
                      </>
                    : primaryClass && (
                        <CharacterEquipmentOptions
                          form={form}
                          fields={{
                            equipment: 'classEquipment',
                            currencyGroups: 'currencyGroups',
                            characterInventory: 'equipment.inventory',
                          }}
                          dataSource={primaryClass}
                        />
                      )
                    }
                  </Grid>
                </Collapsible>
              </Grid.Col>
              <CharacterCurrency form={form} fields='currencyGroups' />
            </>
          }
        </Grid>
      </>
    )
  },
})

export default CharacterEquipmentStep
