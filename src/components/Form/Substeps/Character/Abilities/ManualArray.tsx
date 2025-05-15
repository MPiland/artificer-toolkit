import { useEffect, useMemo, useState, use, Fragment } from 'react'
import Button from '@/components/Button'
import Spinner from '@/components/Spinner'
import Input from '@/components/Input'
import { sprinkles } from '@/css/sprinkles.css'
import {
  dice_roll_value,
  dice_spinner,
  roll_score_box,
  roll_score,
  dice_roll_dropdown,
  dice_roll_value_group,
} from '../../../Character.css'
import Dropdown from '@/components/Dropdown'
import { type DiceRolls, type RollConfig, parseDiceRoll, DiceContext } from '@/components/Dice'
import Collapsible from '@/components/Collapsible'
import { isEqual, set } from 'lodash'
import clsx from 'clsx'
import type { Character, Manual, DeepKeyOf, OnChange, RollType } from '@/types'
import { useSystemData } from '@/hooks'
import { Grid, Group } from '@mantine/core'

const ManualArray = ({
  formStore: { data, updateField },
}: {
  formStore: {
    data: Character
    updateField: OnChange<Character>['updateField']
    removeField: OnChange<Character>['removeField']
    addField: OnChange<Character>['addField']
  }
}) => {
  const { abilities } = useSystemData()

  const rollGroupInit = useMemo(
    (): RollType => ({
      __typename: 'RollType',
      score: 0,
      ability: '',
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

  const { rollDice, dice, setIsRolling } = use(DiceContext)

  const [rollConfiguration, setRollConfiguration] = useState<RollConfig>('4d6dl1r1')

  // Initialize manualRolled object in data to create empty array for rolling Dice or manually setting scores
  useEffect(() => {
    if (data.abilities?.scores?.length) {
      const updates: { path: DeepKeyOf<Character>; value: any }[] = []
      if (!data.abilities?.manualRolled?.rollGroups?.length) {
        const rollGroups: RollType[][] = [
          Array(data.abilities.scores.length)
            .fill(null)
            .map(() => rollGroupInit),
        ]
        updates.push({
          path: 'abilities.manualRolled.rollGroups',
          value: rollGroups,
        })
      }

      if (!data.abilities?.manualRolled?.manual?.length) {
        const rolls: Manual[] = []
        for (let i = 0; i < data.abilities?.scores?.length; i++) {
          rolls.push({ ...manualGroupInit, ability: data.abilities?.scores[i].ability })
        }

        updates.push({
          path: 'abilities.manualRolled.manual',
          value: rolls,
        })
      }

      if (data.abilities?.manualRolled?.configuration == null) {
        updates.push({
          path: 'abilities.manualRolled.configuration',
          value: rollConfiguration,
        })
      }

      if (
        data.abilities?.manualRolled?.configuration &&
        !isEqual(rollConfiguration, data.abilities?.manualRolled?.configuration)
      ) {
        setRollConfiguration(data.abilities?.manualRolled?.configuration as RollConfig)
      }

      // Apply all updates at once
      if (updates.length) {
        updates.forEach((update) => updateField(update))
      }
    }
  }, [
    data.abilities?.manualRolled?.configuration,
    data.abilities?.scores,
    data.abilities?.manualRolled?.rollGroups,
    data.abilities?.manualRolled?.manual,
    updateField,
    manualGroupInit,
    rollConfiguration,
    rollGroupInit,
  ])

  // Set the form data for the roll configuration inputs
  useEffect(() => {}, [data.abilities?.manualRolled?.configuration, rollConfiguration])

  // Set the ability scores if manualRolled
  useEffect(() => {
    if (
      data.abilities?.manualRolled?.rollGroups?.length &&
      data.abilities?.manualRolled?.rollGroups?.some((rollGroup) => rollGroup?.some((roll) => roll.applied))
    ) {
      data.abilities?.manualRolled?.rollGroups?.forEach((rollGroup) => {
        data.abilities?.scores?.forEach((score, index) => {
          const rollIndex = rollGroup?.findIndex((roll) => roll.ability === score.ability)
          if (rollIndex && rollIndex !== -1) {
            const roll = rollGroup?.[rollIndex]
            if (!isEqual(data.abilities?.scores?.[index]?.baseScore, roll?.score)) {
              updateField({
                path: `abilities.scores.${index}.baseScore`,
                value: roll?.score,
              })
            }
          } else {
            updateField({
              path: `abilities.scores.${index}.baseScore`,
              value: 0,
            })
          }
        })
      })
    } else if (data.abilities?.manualRolled?.manual?.length) {
      data.abilities?.scores?.forEach((score, index) => {
        const manualIndex = data.abilities?.manualRolled?.manual?.findIndex(
          (manual) => manual.ability === score.ability
        )
        if (manualIndex && manualIndex !== -1) {
          const manual = data.abilities?.manualRolled?.manual?.[manualIndex]
          if (!isEqual(data.abilities?.scores?.[index]?.baseScore, manual?.score)) {
            updateField({
              path: `abilities.scores.${index}.baseScore`,
              value: manual?.score,
            })
          }
        } else {
          updateField({
            path: `abilities.scores.${index}.baseScore`,
            value: 0,
          })
        }
      })
    }
  }, [data.abilities, updateField])

  const handleRoll = async (gIndex: number, rIndex: number) => {
    let total: number = 0
    const roll: DiceRolls = JSON.parse(JSON.stringify(data?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]))

    roll.rolling = true

    updateField({
      path: `abilities.manualRolled.rollGroups.${gIndex}.${rIndex}`,
      value: roll,
    })

    setIsRolling(true)

    try {
      // Call rollDice function with the input string
      const rollResult = await rollDice(rollConfiguration)

      const results = { ...rollResult }
      results.kept.forEach((result) => {
        total += result.value
      })
      let roll: DiceRolls = JSON.parse(JSON.stringify(data?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]))

      roll = { ...roll, rolling: false, score: total, rolled: results.rolled, kept: results.kept }

      updateField({
        path: `abilities.manualRolled.rollGroups.${gIndex}.${rIndex}`,
        value: roll,
      })
    } catch (error: any) {
      // Handle invalid input format error
      console.error(error)
    }

    setIsRolling(false)
  }

  const handleAddGroup = () => {
    const rollGroups: DiceRolls[][] = JSON.parse(JSON.stringify(data?.abilities?.manualRolled?.rollGroups))
    const rolls: DiceRolls[] = []
    data.abilities?.scores?.forEach((_, aIndex) => {
      rolls[aIndex] = rollGroupInit
    })
    rollGroups.push(rolls)

    updateField({
      path: 'abilities.manualRolled.rollGroups',
      value: rollGroups,
    })
  }

  const handleDeleteGroup = (gIndex: number) => {
    if (data?.abilities) {
      const rollGroups = data?.abilities?.manualRolled?.rollGroups?.filter((_, groupIndex) => gIndex !== groupIndex)

      const abilities: Character['abilities'] = JSON.parse(JSON.stringify(data.abilities))

      const rolls = data.abilities?.manualRolled?.rollGroups?.[gIndex]

      if (abilities && rolls?.length) {
        const scores = abilities.scores
        const manualRolled = abilities.manualRolled
        if (scores?.length) {
          rolls.forEach((roll) => {
            if (roll?.ability) {
              const scoreIndex = scores.findIndex((scores) => scores.ability === roll.ability)

              if (scoreIndex && scoreIndex !== -1) {
                scores[scoreIndex].baseScore = 0
              }
            }
          })
        }

        if (manualRolled) {
          manualRolled.rollGroups = rollGroups
          updateField({
            path: 'abilities',
            value: abilities,
          })
        }
      }
    }
  }

  const handleResetGroup = (gIndex: number) => {
    const rollGroups: RollType[] = JSON.parse(JSON.stringify(data.abilities?.manualRolled?.rollGroups?.[gIndex]))
    for (let i = 0; i < rollGroups.length; i++) {
      rollGroups[i] = rollGroupInit
    }

    updateField({
      path: `abilities.manualRolled.rollGroups.${gIndex}`,
      value: rollGroups,
    })
  }

  const rollResult = (gIndex: number, rIndex: number) => {
    const diceResults = []
    const { quantity } = parseDiceRoll(rollConfiguration)
    for (let i = 0; i < Number(quantity); i++) {
      const value = data?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.rolled?.[i]?.value
      const id = data?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.rolled?.[i]?.id
      const kept = data?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.kept?.some(
        (keptRoll) => keptRoll?.id === id
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
    const abilities: Character['abilities'] = JSON.parse(JSON.stringify(data.abilities))

    const manualRolled = abilities?.manualRolled
    const scores = abilities?.scores

    if (manualRolled?.rollGroups?.length && scores?.length) {
      const rollGroups = manualRolled?.rollGroups
      if (rollGroups?.length > 1) {
        rollGroups?.forEach((rollGroup, groupIndex) => {
          if (groupIndex !== gIndex) {
            if (rollGroup?.length) {
              rollGroup?.forEach((roll, rollIndex) => {
                if (roll.applied) {
                  rollGroups[groupIndex][rollIndex].applied = false
                }
              })
            }
          }
        })
      }

      rollGroups?.[gIndex]?.forEach((roll, rollIndex) => {
        if (roll?.ability && roll.ability != null) {
          let index: number = scores?.findIndex((score) => score.ability === roll.ability)
          if (index === -1) {
            index = 0
          }
          const rollObject = { ...roll }
          rollObject.applied = true
          scores[index].baseScore = roll.score
          rollGroups[gIndex][rollIndex] = rollObject

          if (index !== -1) {
            updateField({
              path: 'abilities',
              value: abilities,
            })
          }
        }
      })
    }
  }

  return (
    <>
      {data.abilities?.manualRolled?.manual?.map((score, aIndex) => {
        const ability = abilities.findAbility(score.ability)
        return (
          <Grid.Col key={aIndex} span={{ sm: 6, md: 4, lg: 2 }}>
            <Input<Character>
              key={aIndex}
              name={`abilities.scores.${aIndex}.baseScore`}
              value={score.score}
              label={ability?.label}
              type='num'
              onChange={{
                updateField: ({ value }) => {
                  const abilities: Character['abilities'] = JSON.parse(JSON.stringify(data.abilities))

                  const score = abilities?.scores?.[aIndex]
                  const ability = score?.ability
                  const rollGroups = abilities?.manualRolled?.rollGroups

                  if (rollGroups?.length) {
                    rollGroups.forEach((rollGroup, gIndex) => {
                      if (rollGroup.length) {
                        rollGroup?.forEach((roll, rIndex) => {
                          if (roll.applied) {
                            rollGroups[gIndex][rIndex].applied = false
                          }
                        })
                      }
                    })
                  }

                  if (score && abilities?.manualRolled?.manual) {
                    score.baseScore = Number(value)
                    abilities.manualRolled.manual[aIndex] = {
                      __typename: 'Manual',
                      ability: ability,
                      score: Number(value),
                    }
                    return {
                      path: 'abilities',
                      value: abilities,
                    }
                  }
                },
              }}
            />
          </Grid.Col>
        )
      })}
      <Grid.Col>
        <Collapsible>
          <Collapsible.Trigger title='Dice Roll Groups' />
          <Collapsible.Content>
            <Grid>
              {data.abilities?.manualRolled?.rollGroups?.map((rollGroup, gIndex) => {
                return (
                  <Fragment key={gIndex}>
                    <Grid.Col>
                      <Grid>
                        {gIndex === 0 && (
                          <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                            <Button color='update' onClick={handleAddGroup} disabled={dice.isRolling}>
                              Add Group
                            </Button>
                          </Grid.Col>
                        )}
                        {data.abilities?.manualRolled?.rollGroups?.length &&
                          data.abilities?.manualRolled?.rollGroups?.length !== 1 && (
                            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                              <Button
                                color='danger'
                                style='outline'
                                onClick={() => handleDeleteGroup(gIndex)}
                                disabled={dice.isRolling}
                              >
                                Delete Group
                              </Button>
                            </Grid.Col>
                          )}
                      </Grid>
                      <Grid>
                        {rollGroup?.map((roll, rIndex) => {
                          const { quantity, die } = parseDiceRoll(rollConfiguration)
                          return (
                            <Grid.Col key={rIndex} span={{ sm: 6, md: 4, lg: 2 }}>
                              <Group justify='flex-start' key={rIndex}>
                                <Group justify='center' wrap='nowrap' className={dice_roll_value_group}>
                                  {roll?.rolling ?
                                    <Spinner className={dice_spinner} />
                                  : <>
                                      <div className={dice_roll_value}>{roll.score || '---'}</div>
                                      {data.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.rolled?.length && (
                                        <div key={`${gIndex}${rIndex}${roll.score}`} className={roll_score_box}>
                                          {rollResult(gIndex, rIndex)}
                                        </div>
                                      )}
                                    </>
                                  }
                                </Group>
                                {roll.score == null ?
                                  <Button
                                    name='setRolling'
                                    color='primary'
                                    onClick={() => {
                                      setTimeout(() => {
                                        handleRoll(gIndex, rIndex)
                                      }, 10)
                                    }}
                                    className={sprinkles({ width: 'size-full' })}
                                    disabled={
                                      dice.isRolling ||
                                      die == null ||
                                      quantity == null ||
                                      data?.abilities?.manualRolled?.configuration === ''
                                    }
                                  >
                                    {dice.isRolling ? 'Rolling' : 'Roll'}
                                  </Button>
                                : <Dropdown<Character>
                                    name={`abilities.manualRolled.rollGroups.${gIndex}.${rIndex}.ability`}
                                    options={abilities.filter(
                                      (ability) =>
                                        !data.abilities?.manualRolled?.rollGroups?.[gIndex]?.some(
                                          (roll, index) => roll.ability === ability.id && index !== rIndex
                                        )
                                    )}
                                    className={dice_roll_dropdown}
                                    value={data.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.ability}
                                    onChange={{
                                      updateField: ({ path, value }) => ({ path, value }),
                                      removeField: () => {
                                        const abilities = { ...data.abilities }
                                        set(
                                          abilities,
                                          `manualRolled.rollGroups.${gIndex}`,
                                          abilities.manualRolled?.rollGroups?.[gIndex].map((roll, index) => ({
                                            ...roll,
                                            applied: false,
                                            ability: index === rIndex ? null : roll.ability,
                                          }))
                                        )
                                        return updateField({
                                          path: `abilities.manualRolled.rollGroups.${gIndex}`,
                                          value: abilities.manualRolled?.rollGroups?.[gIndex],
                                        })
                                      },
                                    }}
                                  />
                                }
                              </Group>
                            </Grid.Col>
                          )
                        })}
                      </Grid>
                    </Grid.Col>
                    <Grid.Col >
                      <Button
                        color='danger'
                        style='outline'
                        disabled={dice.isRolling}
                        onClick={() => handleResetGroup(gIndex)}
                      >
                        Reset Group
                      </Button>
                    </Grid.Col>
                    <Grid.Col >
                      <Group justify='flex-end'>
                        <Button
                          color='update'
                          style='outline'
                          disabled={dice.isRolling || !rollGroup.every((roll) => roll.ability != null)}
                          onClick={() => handleApplyRolls(gIndex)}
                        >
                          Apply Rolls
                        </Button>
                      </Group>
                    </Grid.Col>
                    {data.abilities?.manualRolled?.rollGroups?.length &&
                      data.abilities?.manualRolled?.rollGroups?.length > 1 &&
                      gIndex !== data.abilities.manualRolled.rollGroups.length - 1 && <hr />}
                  </Fragment>
                )
              })}
            </Grid>
          </Collapsible.Content>
        </Collapsible>
      </Grid.Col>
    </>
  )
}
export default ManualArray
