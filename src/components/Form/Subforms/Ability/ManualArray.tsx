import { useEffect, useMemo, useState, use, Fragment } from 'react'
import Button from '../../../Button/Button'
import Spinner from '../../../Spinner/Spinner'
import Input from '../../../Input/Input'
import Group from '../../../Group/Group'
import { sprinkles } from '../../../../css/sprinkles.css'
import {
  dice_roll_value,
  dice_spinner,
  roll_score_box,
  roll_score,
  dice_roll_dropdown,
  dice_roll_value_group,
} from '../../Character.css'
import Dropdown from '../../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { DiceRolls, RollConfig } from '../../../../types/components'
import Collapse from '../../../Collapse/Collapse'
import { isEqual } from 'lodash'
import clsx from 'clsx'
import { Character, Manual, RollType } from '../../../../../amplify/gql/types'
import { parseDiceRoll } from '../../../../utils/dice'
import { DeepKeyOf, UpdateState } from '../../../../types/form'
import { DiceContext } from '../../../Dice/DiceContext'
import Grid from '../../../Grid/Grid'

const ManualArray = ({
  formData,
  updateFormData,
}: {
  formData: Character
  updateFormData: (arg: UpdateState<Character>) => void
}) => {
  const { data: system } = useGetSystemQuery()

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

  const manualGroupInit = useMemo(
    (): Manual => ({
      __typename: 'Manual',
      ability: null,
      score: null,
    }),
    []
  )

  const { rollDice, dice, setDice } = use(DiceContext)

  const [rollConfiguration, setRollConfiguration] = useState<RollConfig>('4d6dl1r1')

  // Initialize manualRolled object in formData to create empty array for rolling Dice or manually setting scores
  useEffect(() => {
    if (formData.abilities?.scores?.length > 0) {
      const updates: { type: 'update'; path: DeepKeyOf<Character>; value: any }[] = []
      if (!(formData.abilities?.manualRolled?.rollGroups?.length > 0)) {
        const rollGroups: RollType[][] = [
          Array(formData.abilities.scores.length)
            .fill(null)
            .map(() => rollGroupInit),
        ]
        updates.push({
          type: 'update',
          path: 'abilities.manualRolled.rollGroups',
          value: rollGroups,
        })
      }

      if (!(formData.abilities?.manualRolled?.manual?.length > 0)) {
        const rolls: Manual[] = []
        for (let i = 0; i < formData.abilities?.scores?.length; i++) {
          rolls.push({ ...manualGroupInit, ability: formData.abilities?.scores[i].ability })
        }

        updates.push({
          type: 'update',
          path: 'abilities.manualRolled.manual',
          value: rolls,
        })
      }

      if (!formData.abilities?.manualRolled?.configuration) {
        updates.push({
          type: 'update',
          path: 'abilities.manualRolled.configuration',
          value: rollConfiguration,
        })
      }

      if (
        formData.abilities?.manualRolled?.configuration &&
        !isEqual(rollConfiguration, formData.abilities?.manualRolled?.configuration)
      ) {
        setRollConfiguration(formData.abilities?.manualRolled?.configuration as RollConfig)
      }

      // Apply all updates at once
      if (updates.length > 0) {
        updates.forEach((update) => updateFormData(update))
      }
    }
  }, [formData, updateFormData, rollGroupInit, manualGroupInit, dice, rollConfiguration])

  // Set the form formData for the roll configuration inputs
  useEffect(() => {}, [formData.abilities?.manualRolled?.configuration, rollConfiguration, updateFormData])

  // Set the ability scores if manualRolled
  useEffect(() => {
    if (
      formData.abilities?.manualRolled?.rollGroups?.length > 0 &&
      formData.abilities?.manualRolled?.rollGroups?.some((rollGroup) => rollGroup?.some((roll) => roll.applied))
    ) {
      formData.abilities?.manualRolled?.rollGroups?.forEach((rollGroup) => {
        formData.abilities?.scores?.forEach((score, index) => {
          const rollIndex = rollGroup?.findIndex((roll) => roll.ability === score.ability)
          if (rollIndex !== -1) {
            const roll = rollGroup[rollIndex]
            if (!isEqual(formData.abilities?.scores[index]?.baseScore, roll.score)) {
              updateFormData({
                type: 'update',
                path: `abilities.scores.${index}.baseScore`,
                value: roll.score,
              })
            }
          } else {
            updateFormData({
              type: 'update',
              path: `abilities.scores.${index}.baseScore`,
              value: 0,
            })
          }
        })
      })
    } else if (formData.abilities?.manualRolled?.manual?.length > 0) {
      formData.abilities?.scores?.forEach((score, index) => {
        const manualIndex = formData.abilities?.manualRolled?.manual?.findIndex(
          (manual) => manual.ability === score.ability
        )
        if (manualIndex !== -1) {
          const manual = formData.abilities?.manualRolled?.manual?.[manualIndex]
          if (!isEqual(formData.abilities?.scores[index]?.baseScore, manual?.score)) {
            updateFormData({
              type: 'update',
              path: `abilities.scores.${index}.baseScore`,
              value: manual?.score,
            })
          }
        } else {
          updateFormData({
            type: 'update',
            path: `abilities.scores.${index}.baseScore`,
            value: 0,
          })
        }
      })
    }
  }, [
    formData.abilities,
    formData.abilities?.scores,
    updateFormData,
    formData.abilities?.manualRolled?.manual,
    formData?.abilities?.manualRolled?.rollGroups,
  ])

  const handleRoll = async (gIndex: number, rIndex: number) => {
    let total: number = 0
    let results: DiceRolls = rollGroupInit
    const roll: DiceRolls = JSON.parse(JSON.stringify(formData.abilities.manualRolled.rollGroups[gIndex]?.[rIndex]))

    roll.rolling = true

    updateFormData({
      type: 'update',
      path: `abilities.manualRolled.rollGroups.${gIndex}.${rIndex}`,
      value: roll,
    })

    setDice.isRolling(true)

    try {
      // Call rollDice function with the input string
      const rollResult = await rollDice(rollConfiguration)

      results = { ...results, ...rollResult }
      results.kept.forEach((result) => {
        total += result.value
      })
      let roll: DiceRolls = JSON.parse(JSON.stringify(formData.abilities?.manualRolled?.rollGroups[gIndex]?.[rIndex]))

      roll = { ...roll, rolling: false, score: total, rolled: results.rolled, kept: results.kept }

      updateFormData({
        type: 'update',
        path: `abilities.manualRolled.rollGroups.${gIndex}.${rIndex}`,
        value: roll,
      })
    } catch (error: any) {
      // Handle invalid input format error
      console.error(error)
    }

    setDice.isRolling(false)
  }

  const handleAddGroup = () => {
    const rollGroups: DiceRolls[][] = JSON.parse(JSON.stringify(formData.abilities.manualRolled.rollGroups))
    const rolls: DiceRolls[] = []
    formData.abilities?.scores?.forEach((_, aIndex) => {
      rolls[aIndex] = rollGroupInit
    })
    rollGroups.push(rolls)

    updateFormData({
      type: 'update',
      path: 'abilities.manualRolled.rollGroups',
      value: rollGroups,
    })
  }

  const handleDeleteGroup = (gIndex: number) => {
    const rollGroups = formData.abilities.manualRolled?.rollGroups?.filter((_, groupIndex) => gIndex !== groupIndex)

    const abilities = JSON.parse(JSON.stringify(formData.abilities)) as Character['abilities']

    const rolls = formData.abilities?.manualRolled?.rollGroups?.[gIndex]

    rolls.forEach((roll) => {
      if (roll?.ability) {
        const scoreIndex = abilities?.scores?.findIndex((scores) => scores.ability === roll.ability)

        if (scoreIndex !== -1) {
          abilities.scores[scoreIndex].baseScore = 0
        }
      }
    })

    abilities.manualRolled.rollGroups = rollGroups
    updateFormData({
      type: 'update',
      path: 'abilities',
      value: abilities,
    })
  }

  const handleResetGroup = (gIndex: number) => {
    const rollGroups: RollType[] = JSON.parse(JSON.stringify(formData.abilities?.manualRolled?.rollGroups?.[gIndex]))
    for (let i = 0; i < rollGroups.length; i++) {
      rollGroups[i] = rollGroupInit
    }

    updateFormData({
      type: 'update',
      path: `abilities.manualRolled.rollGroups.${gIndex}`,
      value: rollGroups,
    })
  }

  const rollResult = (gIndex: number, rIndex: number) => {
    const diceResults = []
    const { numDie } = parseDiceRoll(rollConfiguration)
    for (let i = 0; i < Number(numDie); i++) {
      const value = formData?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.rolled?.[i]?.value
      const id = formData?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.rolled?.[i]?.id
      const kept = formData?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.kept?.some(
        (keptRoll) => keptRoll.id === id
      )
      diceResults.push(
        <div key={`${gIndex}${rIndex}${i}`} className={clsx(roll_score, { ['kept']: kept })}>
          {value}
        </div>
      )
    }
    return diceResults
  }

  const handleApplyRolls = (gIndex: number) => {
    const abilities = JSON.parse(JSON.stringify(formData.abilities)) as Character['abilities']
    const rollGroups = abilities.manualRolled.rollGroups

    if (rollGroups?.length > 1) {
      rollGroups?.forEach((rollGroup, groupIndex) => {
        if (groupIndex !== gIndex) {
          if (rollGroup?.length > 0) {
            rollGroup?.forEach((roll, rollIndex) => {
              if (roll.applied) {
                abilities.manualRolled.rollGroups[groupIndex][rollIndex].applied = false
              }
            })
          }
        }
      })
    }

    rollGroups[gIndex].forEach((roll, rollIndex) => {
      if (roll?.ability && roll.ability != null) {
        const index = formData.abilities?.scores?.findIndex((score) => score.ability === roll.ability)
        const rollObject = { ...roll }
        rollObject.applied = true
        abilities.scores[index].baseScore = roll.score
        abilities.manualRolled.rollGroups[gIndex][rollIndex] = rollObject

        if (index !== -1) {
          updateFormData({
            type: 'update',
            path: 'abilities',
            value: abilities,
          })
        }
      }
    })
  }

  const handleInputScore = (e: UpdateState<Character>, aIndex: number) => {
    if (e.type === 'update') {
      const abilities: Character['abilities'] = JSON.parse(JSON.stringify(formData.abilities))

      const ability = abilities.scores[aIndex].ability
      const rollGroups = abilities.manualRolled.rollGroups

      if (rollGroups?.length > 0) {
        rollGroups.forEach((rollGroup, gIndex) => {
          if (rollGroup.length > 0) {
            rollGroup?.forEach((roll, rIndex) => {
              if (roll.applied) {
                abilities.manualRolled.rollGroups[gIndex][rIndex].applied = false
              }
            })
          }
        })
      }

      abilities.scores[aIndex].baseScore = Number(e.value)
      abilities.manualRolled.manual[aIndex] = {
        __typename: 'Manual',
        ability: ability,
        score: Number(e.value),
      }
      updateFormData({
        type: 'update',
        path: 'abilities',
        value: abilities,
      })
    }
  }

  return (
    <>
      {formData.abilities?.manualRolled?.manual?.map((score, aIndex) => {
        const ability = system.abilities.find((ability) => ability.id === score.ability)
        return (
          <Grid.Item key={aIndex} colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Input<Character>
              key={aIndex}
              name={`abilities.scores.${aIndex}.baseScore`}
              value={score.score}
              label={`${ability.label}`}
              type='num'
              onChange={(e) => handleInputScore(e, aIndex)}
            />
          </Grid.Item>
        )
      })}
      <Grid.Item>
        <Collapse>
          <Collapse.Header title='Dice Roll Groups' startOpened={true} />
          <Collapse.Body>
            <Grid>
              {formData.abilities?.manualRolled?.rollGroups?.map((rollGroup, gIndex) => {
                return (
                  <Fragment key={gIndex}>
                    <Grid.Item>
                      <Grid>
                        {gIndex === 0 && (
                          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                            <Button color='update' onClick={handleAddGroup} disabled={dice.isRolling}>
                              Add Group
                            </Button>
                          </Grid.Item>
                        )}
                        {formData.abilities?.manualRolled?.rollGroups.length !== 1 && (
                          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                            <Button
                              color='danger'
                              style='outline'
                              onClick={() => handleDeleteGroup(gIndex)}
                              disabled={dice.isRolling}
                            >
                              Delete Group
                            </Button>
                          </Grid.Item>
                        )}
                      </Grid>
                      <Grid>
                        {rollGroup?.map((roll, rIndex) => {
                          const { dieType } = parseDiceRoll(rollConfiguration)
                          return (
                            <Grid.Item key={rIndex} colSpan={{ sm: 6, md: 4, lg: 2 }}>
                              <Group directionVariant='column' justifyContentVariant='start' key={rIndex}>
                                <Group
                                  directionVariant='column'
                                  alignItemsVariant='center'
                                  flexWrapVariant='noWrap'
                                  className={dice_roll_value_group}
                                >
                                  {roll?.rolling ? (
                                    <Spinner className={dice_spinner} />
                                  ) : (
                                    <>
                                      <div className={dice_roll_value}>{roll.score || '---'}</div>
                                      {formData.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.rolled
                                        ?.length > 0 && (
                                        <div key={`${gIndex}${rIndex}${roll.score}`} className={roll_score_box}>
                                          {rollResult(gIndex, rIndex)}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </Group>
                                {roll.score == null ? (
                                  <Button
                                    name='setRolling'
                                    color='primary'
                                    onClick={() => {
                                      setTimeout(() => {
                                        handleRoll(gIndex, rIndex)
                                      }, 10)
                                    }}
                                    className={sprinkles({ width: 'size-full' })}
                                    disabled={dice.isRolling || dieType == null}
                                  >
                                    {dice.isRolling ? 'Rolling' : 'Roll'}
                                  </Button>
                                ) : (
                                  <Dropdown<Character>
                                    name={`abilities.manualRolled.rollGroups.${gIndex}.${rIndex}.ability`}
                                    options={system.abilities.filter(
                                      (ability) =>
                                        !formData.abilities?.manualRolled?.rollGroups?.[gIndex]?.some(
                                          (roll, index) => roll.ability === ability.id && index !== rIndex
                                        )
                                    )}
                                    className={dice_roll_dropdown}
                                    value={formData.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.ability}
                                    onChange={(e) => {
                                      if (e.type === 'update') {
                                        updateFormData({
                                          type: 'update',
                                          path: e.path,
                                          value: e.value,
                                        })
                                      } else if (e.type === 'remove') {
                                        const abilities = JSON.parse(
                                          JSON.stringify(formData.abilities)
                                        ) as Character['abilities']

                                        // Set all abilities to false applied if removing ability option
                                        abilities.manualRolled.rollGroups[gIndex] = abilities.manualRolled.rollGroups[
                                          gIndex
                                        ].map((roll, index) => ({
                                          ...roll,
                                          applied: false,
                                          ability: index === rIndex ? null : roll.ability,
                                        }))

                                        updateFormData({
                                          type: 'update',
                                          path: `abilities.manualRolled.rollGroups.${gIndex}`,
                                          value: abilities.manualRolled.rollGroups[gIndex],
                                        })
                                      }
                                    }}
                                  />
                                )}
                              </Group>
                            </Grid.Item>
                          )
                        })}
                      </Grid>
                    </Grid.Item>
                    <Grid.Item colSpan={'auto'}>
                      <Button
                        color='danger'
                        style='outline'
                        disabled={dice.isRolling}
                        onClick={() => handleResetGroup(gIndex)}
                      >
                        Reset Group
                      </Button>
                    </Grid.Item>
                    <Grid.Item colSpan={'auto'} justify='end'>
                      <Button
                        color='update'
                        style='outline'
                        disabled={dice.isRolling || !rollGroup.every((roll) => roll.ability != null)}
                        onClick={() => handleApplyRolls(gIndex)}
                      >
                        Apply Rolls
                      </Button>
                    </Grid.Item>
                    {formData.abilities.manualRolled?.rollGroups?.length > 1 &&
                      gIndex !== formData.abilities.manualRolled.rollGroups.length - 1 && <hr />}
                  </Fragment>
                )
              })}
            </Grid>
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
    </>
  )
}
export default ManualArray
