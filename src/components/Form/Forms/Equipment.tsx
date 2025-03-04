import { Character, EquipmentCurrency, RollType } from '../../../../amplify/gql/types'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import { UpdateState } from '../../../types/form'
import Dropdown from '../../Dropdown/Dropdown'
import { Fragment, use, useEffect, useMemo, useState } from 'react'
import { FormContext } from '../FormContext'
import { StartingEquipmentOption } from '../../../types/enums'
import { parseDiceRoll } from '../../../utils/dice'
import { useListClassesQuery } from '../../../features/classes/classesApi'
import { DiceRolls, RollConfig } from '../../../types/components'
import Button from '../../Button/Button'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import { option_dropdown } from '../Character.css'
import { DiceContext } from '../../Dice/DiceContext'
import Collapse from '../../Collapse/Collapse'
import { createPortal } from 'react-dom'
import Scene from '../../Dice/Scene'
import Input from '../../Input/Input'
import { useMediaQuery } from 'usehooks-ts'
import Grid from '../../Grid/Grid'

const Equipment = () => {
  const [random, setRandom] = useState<boolean>(false)

  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (state: UpdateState<Character>) => void
  }

  const { setDice, rollDice } = use(DiceContext)

  const { data: system } = useGetSystemQuery()
  const { data: classes } = useListClassesQuery()

  const sm = useMediaQuery('(max-width: 567px)')

  const primaryClass = classes.find((uClass) => formData.classes?.[0]?.id === uClass.id)
  const goldDieConfig = primaryClass?.startingGold?.dieConfig as RollConfig

  const { numDie, dieType } = parseDiceRoll(goldDieConfig)

  const multipler = primaryClass?.startingGold?.multiplier

  const form: HTMLFormElement = document.getElementById('form_content') as HTMLFormElement

  const rollGroupInit = useMemo(
    (): RollType => ({
      __typename: 'RollType',
      score: null,
      ability: null,
      rolling: false,
      rolled: [],
      kept: [],
      applied: false,
    }),
    []
  )

  // Initialize currencies into data
  useEffect(() => {
    const characterCurrencies: EquipmentCurrency[] = JSON.parse(JSON.stringify(formData.equipment?.currencies))
    system.currencies?.forEach((currency) => {
      const charCurrencyIndex = characterCurrencies?.findIndex((eCurrency) => eCurrency.id === currency.id)
      if (charCurrencyIndex === -1) {
        characterCurrencies.push({
          __typename: 'EquipmentCurrency',
          id: currency.id,
          amount: 0,
        })
      }
    })
    if (formData.equipment?.currencies?.length === 0) {
      updateFormData({
        type: 'update',
        path: 'equipment.currencies',
        value: characterCurrencies,
      })
    }
  }, [formData.equipment?.currencies, system.currencies, updateFormData])

  useEffect(() => {
    if (formData?.startingEquipment?.goldOption != null && formData?.startingEquipment?.goldOption === goldDieConfig) {
      setRandom(true)
    } else {
      if (String(formData?.startingEquipment?.totalGold) !== formData?.startingEquipment?.goldOption) {
        updateFormData({
          type: 'update',
          path: 'startingEquipment.totalGold',
          value: Number(formData?.startingEquipment?.goldOption) * multipler,
        })
      }
    }
  }, [formData?.startingEquipment, goldDieConfig, updateFormData, multipler])

  // Generate all possible combinations for the dice
  const generateCombinations = (numDie: number, sides: number): string[] => {
    if (numDie === 0) return ['']
    if (numDie === 1) return Array.from({ length: sides }, (_, i) => `${i + 1}`)

    const result: string[] = []
    const prevCombinations = generateCombinations(numDie - 1, sides)

    if (result?.length === 0) {
      result.push(goldDieConfig)
    }

    for (let i = 1; i <= sides; i++) {
      for (const combo of prevCombinations) {
        result.push(combo ? `${i}+${combo}` : `${i}`)
      }
    }

    return result
  }

  // Get all combinations and create options
  const combinations = generateCombinations(numDie, dieType)
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
    let results: DiceRolls = rollGroupInit

    setDice.isRolling(true)

    try {
      // Call rollDice function with the input string
      const rollResult = await rollDice(goldDieConfig) // Example input, replace it with the actual input
      results = { ...results, ...rollResult }
      const amount = results.score * multipler

      updateFormData({
        type: 'update',
        path: `startingEquipment.totalGold`,
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
          for (let i = 0; i < numDie; i++) {
            // Generate a random number between 1 and dieType (inclusive)
            const roll = Math.floor(Math.random() * dieType) + 1
            total += roll
          }
          const amount = total * multipler
          updateFormData({
            type: 'update',
            path: `startingEquipment.totalGold`,
            value: amount,
          })
        }
        break
      case 'roll':
        handleDiceRoll()
        break
    }
  }

  const goldTotal = (
    <div>
      <span>{'Totals - '}</span>
      {formData?.equipment?.currencies?.map((currency, index) => {
        const currencyLabel = system.currencies?.find((eCurrency) => eCurrency.id === currency.id)?.label
        return (
          <span key={index}>
            <span className={sprinkles({ ws: 'nowrap' })}>{`${currencyLabel}: ${currency.amount}`}</span>
            {index !== formData?.equipment?.currencies?.length - 1 && ' / '}
          </span>
        )
      })}
    </div>
  )

  return (
    <Grid>
      {form && createPortal(<Scene />, form)}
      {!(formData?.classes?.length > 0) ? (
        <Grid.Item className={sprinkles({ alignContent: 'center' })}>
          <div>Please select a class.</div>
        </Grid.Item>
      ) : (
        <>
          <Grid.Item>
            <Collapse>
              <Collapse.Header title='Starting Equipment' />
              <Collapse.Body>
                <Grid>
                  <Grid.Item justify='center'>
                    <Dropdown
                      name='startingEquipment.option'
                      value={formData?.startingEquipment?.option}
                      label='Equipment or Gold'
                      className={option_dropdown}
                      onChange={updateFormData}
                      options={system.characters.startingEquipmentOptions}
                    />
                  </Grid.Item>
                  {formData.startingEquipment?.option === StartingEquipmentOption.gold && (
                    <>
                      <Grid.Item justify='center'>
                        <Dropdown
                          name='startingEquipment.goldOption'
                          value={formData?.startingEquipment?.goldOption}
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
                                  <Button onClick={() => handleRandom('roll')}>Roll Dice</Button>
                                </>
                              )}
                            </Group>
                          </Grid.Item>
                          {formData?.startingEquipment?.totalGold > 0 && (
                            <Grid.Item justify='center'>
                              <h3>Total Gold: {formData?.startingEquipment?.totalGold}</h3>
                            </Grid.Item>
                          )}
                        </Grid>
                      </Grid.Item>
                    </>
                  )}
                </Grid>
              </Collapse.Body>
            </Collapse>
          </Grid.Item>
          <Grid.Item>
            <Collapse>
              <Collapse.Header title='Currency' rightSide={!sm && goldTotal} />
              <Collapse.Body>
                <Grid>
                  <Grid.Item colSpan={6}><h3><u>Currency</u></h3></Grid.Item>
                  <Grid.Item colSpan={6}><h3><u>Total</u></h3></Grid.Item>
                  {formData?.equipment?.currencies?.map((currency, index) => {
                    const currencyLabel = system.currencies.find((sCurrency) => sCurrency.id === currency.id).label
                    return (
                      <Fragment key={index}>
                        <Grid.Item colSpan={6}>{currencyLabel}</Grid.Item>
                        <Grid.Item colSpan={6}>
                          <Input
                            name={`equipment.currencies.${index}.amount`}
                            value={currency.amount}
                            onChange={updateFormData}
                            type='cur'
                          />
                        </Grid.Item>
                      </Fragment>
                    )
                  })}
                </Grid>
              </Collapse.Body>
            </Collapse>
          </Grid.Item>
        </>
      )}
    </Grid>
  )
}

export default Equipment
