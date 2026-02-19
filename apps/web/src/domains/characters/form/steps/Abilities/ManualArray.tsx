import { z } from 'zod/v4'
import { useEffect, useMemo, useState, use, Fragment, type ReactNode } from 'react'
import Spinner from '@components/Spinner'
import { sprinkles } from '@css/sprinkles.css'
import { parseDiceRoll, DiceContext } from '@components/Dice'
import Collapsible from '@components/Collapse'
import { isEqual } from 'lodash-es'
import clsx from 'clsx'
import type { ManualInput, CharacterInput } from '@types'
import { useSystemData, useFieldUpdates, useFormField } from '@hooks'
import { Grid, Group, Button } from '@mantine/core'
import {
  dice_roll_value,
  dice_spinner,
  roll_score_box,
  roll_score,
  dice_roll_dropdown,
  dice_roll_value_group,
  ROLL_CONFIG_REGEX
} from '@components/Form'
import { ManualInputSchema, RollTypeInputSchema } from '@artificer-toolkit/shared/schemas'
import { useOptimizedSelector, useTypedFormStore } from '@store'

const ManualArray = () => {
  const store = useTypedFormStore<CharacterInput>()

  const { AppField } = useFormField({ store })

  // Use optimized selector to batch all ability-related data with shallow comparison
  const { updateField, manualRolled, scores, rollGroups, manual, configuration } = useOptimizedSelector(
    store,
    (state) => ({
      updateField: state.updateField,
      manualRolled: state.current?.abilities?.manualRolled,
      scores: state.current?.abilities?.scores,
      rollGroups: state.current?.abilities?.manualRolled?.rollGroups,
      manual: state.current?.abilities?.manualRolled?.manual,
      configuration: state.current?.abilities?.manualRolled?.configuration
    })
  )

  const { fieldListeners } = useFieldUpdates()

  const { abilities } = useSystemData()

  const rollGroupInit = useMemo(
    (): z.input<typeof RollTypeInputSchema> => RollTypeInputSchema.parse({
      __kind: 'RollTypeInput',
      score: 0,
      ability: '',
      rolling: false,
      rolled: [],
      kept: [],
      applied: false
    }),
    []
  )

  const manualGroupInit = useMemo(
    (): ManualInput => ({
      __kind: 'ManualInput',
      ability: null,
      score: null
    }),
    []
  )

  const { rollDice, dice, setIsRolling } = use(DiceContext)

  const [rollConfiguration, setRollConfiguration] = useState<string>('4d6dl1r1')

  // Initialize manualRolled object in data to create empty array for rolling Dice or manually setting scores
  useEffect(() => {
    if (scores?.length) {
      const updates: (() => void)[] = []
      if (!rollGroups?.length) {
        const rollGroups: z.input<typeof RollTypeInputSchema>[][] = [
          Array(scores.length)
            .fill(null)
            .map(() => rollGroupInit)
        ]
        updates.push(() => {
          updateField({ path: 'abilities.manualRolled.rollGroups', value: rollGroups })
        })
      }

      if (!manual?.length) {
        const rolls: z.input<typeof ManualInputSchema>[] = []
        for (let i = 0; i < scores?.length; i++) {
          rolls.push(ManualInputSchema.parse({ ...manualGroupInit, ability: scores[i].ability }))
        }
        updates.push(() => {
          updateField({ path: 'abilities.manualRolled.manual', value: rolls })
        })
      }

      if (configuration == null) {
        updates.push(() => {
          updateField({ path: 'abilities.manualRolled.configuration', value: rollConfiguration })
        })
      }

      if (configuration && !isEqual(rollConfiguration, configuration)) {
        if (z.string(configuration).regex(ROLL_CONFIG_REGEX)) {
          setRollConfiguration(configuration)
        }
      }

      // Apply all updates at once
      if (updates.length) {
        updates.forEach((update) => update())
      }
    }
  }, [
    configuration, scores, rollGroups, manual, manualGroupInit, rollConfiguration, rollGroupInit, updateField
  ])

  // Set the ability scores if manualRolled
  useEffect(() => {
    if (rollGroups?.length && rollGroups?.some((rollGroup) => rollGroup?.some((roll) => roll.applied))) {
      rollGroups?.forEach((rollGroup) => {
        scores?.forEach((score, i) => {
          const rollIndex = rollGroup?.findIndex((roll) => roll.ability === score.ability)
          if (rollIndex && rollIndex !== -1) {
            const roll = RollTypeInputSchema.parse(rollGroup?.[rollIndex])
            if (!isEqual(scores?.[i]?.baseScore, roll?.score)) {
              updateField({
                path: `abilities.scores[${i}].baseScore`,
                value: roll?.score
              })
            }
          } else {
            updateField({
              path: `abilities.scores[${i}].baseScore`,
              value: 0
            })
          }
        })
      })
    }
  }, [rollGroups, scores, updateField])

  useEffect(() => {
    if (manual?.length) {
      scores?.forEach((score, i) => {
        const manualIndex = manual?.findIndex((manual) => manual.ability === score.ability)
        if (manualIndex && manualIndex !== -1) {
          const manualObject = manual?.[manualIndex]
          if (!isEqual(scores?.[i]?.baseScore, manualObject?.score)) {
            updateField({
              path: `abilities.scores[${i}].baseScore`,
              value: manualObject?.score
            })
          }
        } else {
          updateField({
            path: `abilities.scores[${i}].baseScore`,
            value: 0
          })
        }
      })
    }
  }, [manual, scores, updateField])

  const handleRoll = async (gI: number, rI: number) => {
    let total: number = 0
    let roll: z.input<typeof RollTypeInputSchema> = RollTypeInputSchema.parse(rollGroups?.[gI]?.[rI])
    roll.rolling = true
    setIsRolling(true)
    updateField({ path: `abilities.manualRolled.rollGroups[${gI}][${rI}]`, value: roll })

    try {
      // Call rollDice function with the input string
      const rollResult = RollTypeInputSchema.parse(await rollDice(rollConfiguration))

      const results = { ...rollResult }
      results.kept?.forEach((result) => {
        total += result.value
      })

      roll = { ...roll, rolling: false, score: total, rolled: results.rolled, kept: results.kept }

      updateField({ path: `abilities.manualRolled.rollGroups[${gI}][${rI}]`, value: roll })
    } catch (error: unknown) {
      // Handle invalid input format error
      console.log(error)
    }

    setIsRolling(false)
  }

  // TODO: Delete function if call in button works as expected
  // const handleAddGroup = () => {
  //   const rollGroups: z.input<typeof RollTypeInputSchema>[][] = JSON.parse(JSON.stringify(manualRolled?.rollGroups))
  //   const rolls: z.input<typeof RollTypeInputSchema>[] = []
  //   scores?.forEach((_, aIndex) => {
  //     rolls[aIndex] = rollGroupInit
  //   })
  //   rollGroups.push(rolls)

  //   group.setFieldValue('manualRolled.rollGroups', rollGroups)
  // }

  // TODO: Delete function if call in button works as expected
  // const handleDeleteGroup = (gIndex: number) => {
  //   const rollGroups = manualRolled?.rollGroups?.filter((_, groupIndex) => gIndex !== groupIndex)

  //   const rolls = manualRolled?.rollGroups?.[gIndex]

  //   if (rolls?.length) {
  //     if (scores?.length) {
  //       rolls.forEach((roll) => {
  //         if (roll?.ability) {
  //           const scoreIndex = scores.findIndex((scores) => scores.ability === roll.ability)

  //           if (scoreIndex && scoreIndex !== -1) {
  //             scores[scoreIndex].baseScore = 0
  //           }
  //         }
  //       })
  //     }

  //     if (manualRolled) {
  //       group.setFieldValue('manualRolled.rollGroups', rollGroups)
  //     }
  //   }
  // }

  const handleResetGroup = (i: number) => {
    const rollGroup = [RollTypeInputSchema.parse(rollGroups?.[i])]
    for (let i = 0; i < rollGroup.length; i++) {
      rollGroup[i] = rollGroupInit
    }

    updateField({ path: `abilities.manualRolled.rollGroups[${i}]`, value: rollGroup })
  }

  const rollResult = (gI: number, rI: number) => {
    const diceResults: ReactNode[] = []
    const diceRoll = parseDiceRoll(rollConfiguration)
    if (!diceRoll) return
    const { quantity } = diceRoll
    for (let i = 0; i < Number(quantity); i++) {
      const value = rollGroups?.[gI]?.[rI]?.rolled?.[i]?.value
      const id = rollGroups?.[gI]?.[rI]?.rolled?.[i]?.id
      const kept = rollGroups?.[gI]?.[rI]?.kept?.some((keptRoll) => keptRoll?.id === id)
      diceResults.push(
        <div key={`${gI}${rI}${i}`} className={clsx(roll_score, { ['kept']: kept })}>
          {value}
        </div>
      )
    }
    return diceResults
  }

  const handleApplyRolls = (gI: number) => {
    if (rollGroups?.length && scores?.length) {
      if (rollGroups?.length > 1) {
        rollGroups?.forEach((rollGroup, groupIndex) => {
          if (groupIndex !== gI) {
            if (rollGroup?.length) {
              rollGroup?.forEach((roll, rollIndex) => {
                if (roll.applied) {
                  updateField({
                    path: `abilities.manualRolled.rollGroups[${groupIndex}][${rollIndex}].applied`,
                    value: false
                  })
                }
              })
            }
          }
        })
      }

      rollGroups?.[gI]?.forEach((roll, rI) => {
        if (roll?.ability && roll.ability != null) {
          let index: number = scores?.findIndex((score) => score.ability === roll.ability)
          if (index === -1) {
            index = 0
          }
          const rollObject = { ...roll }
          rollObject.applied = true
          updateField({
            path: `abilities.scores[${index}].baseScore`,
            value: roll.score
          })
          updateField({
            path: `abilities.manualRolled.rollGroups[${gI}][${rI}]`,
            value: rollObject
          })
        }
      })
    }
  }

  return (
    <>
      <AppField name="abilities.manualRolled.manual" mode="array">
        {(manualField) => manualField.state.value?.map((mObject, i) => {
          const ability = abilities.findAbility(mObject.ability)
          return (
            <AppField name={`abilities.manualRolled.manual[${i}]`}>
              {(manualSubfield) => (
                <AppField
                  name={`abilities.scores[${i}].baseScore`}
                  listeners={{
                    ...fieldListeners.onBlur,
                    onChange: ({ value }) => {
                      const score = scores?.[i]
                      const ability = score?.ability
                      const rollGroups = manualRolled?.rollGroups

                      if (rollGroups?.length) {
                        rollGroups.forEach((rGroup, gI) => {
                          if (rGroup.length) {
                            rGroup?.forEach((roll, rI) => {
                              if (roll.applied) {
                                updateField({
                                  path: `abilities.manualRolled.rollGroups[${gI}][${rI}].applied`,
                                  value: false
                                })
                              }
                            })
                          }
                        })
                      }

                      if (score && manualRolled?.manual) {
                        score.baseScore = Number(value)
                        manualSubfield.setValue(
                          ManualInputSchema.parse({
                            ability: ability,
                            score: Number(value)
                          })
                        )
                      }
                    }
                  }}
                >
                  {({ TextField }) => (
                    <Grid.Col key={`score-baseScore-${i}`} span={{ sm: 6, md: 4, lg: 2 }}>
                      <TextField label={ability?.label} />
                    </Grid.Col>
                  )}
                </AppField>
              )}
            </AppField>
          )
        })}
      </AppField>
      <Grid.Col>
        <Collapsible
          props={{
            trigger: {
              title: 'Dice Roll Groups'
            }
          }}
        >
          <Grid>
            <AppField name="abilities.manualRolled.rollGroups" mode="array">
              {(rollGroupsField) => {
                const rollGroups = rollGroupsField.state.value
                return rollGroups?.map((rGroup, gI) => {
                  return (
                    <Fragment key={gI}>
                      <Grid.Col>
                        <Grid>
                          {gI === 0 && (
                            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                              <Button
                                color="update"
                                onClick={() => {
                                  const rolls: z.input<typeof RollTypeInputSchema>[] = []
                                  scores?.forEach((_, aIndex) => {
                                    rolls[aIndex] = rollGroupInit
                                  })
                                  rollGroupsField.pushValue(rolls)
                                }}
                                disabled={dice.isRolling}
                              >
                                Add Group
                              </Button>
                            </Grid.Col>
                          )}
                          {rollGroups?.length && rollGroups?.length !== 1 && (
                            <Grid.Col span={{ sm: 6, md: 4, lg: 2 }}>
                              <Button
                                color="danger"
                                variant="outline"
                                onClick={() => {
                                  if (scores?.length) {
                                    rGroup.forEach((roll) => {
                                      if (roll?.ability) {
                                        const scoreIndex = scores.findIndex((scores) => scores.ability === roll.ability)

                                        if (scoreIndex && scoreIndex !== -1) {
                                          updateField({ path: `abilities.scores[${scoreIndex}].baseScore`, value: 0 })
                                        }
                                      }
                                    })
                                  }

                                  rollGroupsField.removeValue(gI)
                                }}
                                disabled={dice.isRolling}
                              >
                                Delete Group
                              </Button>
                            </Grid.Col>
                          )}
                        </Grid>
                        <Grid>
                          <AppField name={`abilities.manualRolled.rollGroups[${gI}]`} mode="array">
                            {(rollsField) => {
                              const rolls = rollsField.state.value
                              return rolls?.map((roll, rI) => {
                                const { quantity, die } = parseDiceRoll(rollConfiguration)
                                return (
                                  <Grid.Col key={rI} span={{ sm: 6, md: 4, lg: 2 }}>
                                    <Group justify="flex-start" key={rI}>
                                      <Group justify="center" wrap="nowrap" className={dice_roll_value_group}>
                                        {roll?.rolling
                                          ? <Spinner className={dice_spinner} />
                                          : (
                                              <>
                                                <div className={dice_roll_value}>{roll.score || '---'}</div>
                                                {rollGroups?.[gI]?.[rI]?.rolled?.length && (
                                                  <div
                                                    key={`${gI}${rI}${roll.score}-roll-score`}
                                                    className={roll_score_box}
                                                  >
                                                    {rollResult(gI, rI)}
                                                  </div>
                                                )}
                                              </>
                                            )}
                                      </Group>
                                      {roll.score == null
                                        ? (
                                            <Button
                                              name="setRolling"
                                              color="primary"
                                              onClick={() => {
                                                setTimeout(() => {
                                                  handleRoll(gI, rI)
                                                }, 10)
                                              }}
                                              className={sprinkles({ width: 'size-full' })}
                                              disabled={
                                                dice.isRolling
                                                || die == null
                                                || quantity == null
                                                || manualRolled?.configuration === ''
                                              }
                                            >
                                              {dice.isRolling ? 'Rolling' : 'Roll'}
                                            </Button>
                                          )
                                        : (
                                            <AppField
                                              name={`abilities.manualRolled.rollGroups[${gI}][${rI}].ability`}
                                              listeners={{
                                                ...fieldListeners.onBlur,
                                                onChange: ({ value }) => {
                                                  if (value == null) {
                                                    const rollGroupsUpdated = rollGroups?.[gI].map((roll, index) => RollTypeInputSchema.parse({
                                                      ...roll,
                                                      applied: false,
                                                      ability: index === rI ? null : roll.ability
                                                    }))
                                                    rollsField.setValue(rollGroupsUpdated)
                                                  }
                                                }
                                              }}
                                            >
                                              {({ DropdownField }) => (
                                                <DropdownField
                                                  options={abilities.filter(
                                                    (ability) => !rollGroups?.[gI]?.some(
                                                      (roll, index) => roll.ability === ability.id && index !== rI
                                                    )
                                                  )}
                                                  className={dice_roll_dropdown}
                                                />
                                              )}
                                            </AppField>
                                          )}
                                    </Group>
                                  </Grid.Col>
                                )
                              })
                            }}
                          </AppField>
                        </Grid>
                      </Grid.Col>
                      <Grid.Col>
                        <Button
                          color="danger"
                          variant="outline"
                          disabled={dice.isRolling}
                          onClick={() => handleResetGroup(gI)}
                        >
                          Reset Group
                        </Button>
                      </Grid.Col>
                      <Grid.Col>
                        <Group justify="flex-end">
                          <Button
                            color="update"
                            variant="outline"
                            disabled={dice.isRolling || !rollGroups[gI].every((roll) => roll.ability != null)}
                            onClick={() => handleApplyRolls(gI)}
                          >
                            Apply Rolls
                          </Button>
                        </Group>
                      </Grid.Col>
                      {rollGroups?.length && rollGroups?.length > 1 && gI !== rollGroups.length - 1 && <hr />}
                    </Fragment>
                  )
                })
              }}
            </AppField>
          </Grid>
        </Collapsible>
      </Grid.Col>
    </>
  )
}
export default ManualArray
