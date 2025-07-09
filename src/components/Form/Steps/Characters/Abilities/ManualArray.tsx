import { z } from 'zod/v4'
import { useEffect, useMemo, useState, use, Fragment } from 'react'
import Spinner from '@/components/Spinner'
import { sprinkles } from '@/css/sprinkles.css'
import { parseDiceRoll, DiceContext } from '@/components/Dice'
import Collapsible from '@/components/Collapsible'
import { isEqual, get } from 'lodash'
import clsx from 'clsx'
import type { CharacterAbilitiesInput, ManualInput } from '@/types'
import { useSystemData } from '@/hooks'
import { Grid, Group, Button } from '@mantine/core'
import {
  withFieldGroup,
  dice_roll_value,
  dice_spinner,
  roll_score_box,
  roll_score,
  dice_roll_dropdown,
  dice_roll_value_group,
  ROLL_CONFIG_REGEX,
} from '@/components/Form'
import { ManualInputSchema, RollTypeInputSchema } from '@/schemas'
import { useStore } from '@tanstack/react-form'
import { useFormStore } from '@/store'

const ManualArray = withFieldGroup({
  defaultValues: {} as CharacterAbilitiesInput,
  render: function Render({ group }) {
    const { AppField, Subscribe } = group

    const formStore = useFormStore()

    const { abilities } = useSystemData()

    const rollGroupInit = useMemo(
      (): z.input<typeof RollTypeInputSchema> =>
        RollTypeInputSchema.parse({
          __kind: 'RollTypeInput',
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
      (): ManualInput => ({
        __kind: 'ManualInput',
        ability: null,
        score: null,
      }),
      []
    )

    const { rollDice, dice, setIsRolling } = use(DiceContext)

    const [rollConfiguration, setRollConfiguration] = useState<string>('4d6dl1r1')

    const { scores, rollGroups, manual, configuration } = useStore(group.store, (state) => ({
      scores: state.values.scores,
      rollGroups: state.values.manualRolled?.rollGroups,
      manual: state.values.manualRolled?.manual,
      configuration: state.values.manualRolled?.configuration,
    }))

    // Initialize manualRolled object in data to create empty array for rolling Dice or manually setting scores
    useEffect(() => {
      if (scores?.length) {
        const updates: (() => void)[] = []
        if (!rollGroups?.length) {
          const rollGroups: z.input<typeof RollTypeInputSchema>[][] = [
            Array(scores.length)
              .fill(null)
              .map(() => rollGroupInit),
          ]
          updates.push(() => {
            group.setFieldValue('manualRolled.rollGroups', rollGroups)
            formStore.updateField({ path: 'abilities.manualRolled.rollGroups', value: rollGroups })
          })
        }

        if (!manual?.length) {
          const rolls: z.input<typeof ManualInputSchema>[] = []
          for (let i = 0; i < scores?.length; i++) {
            rolls.push(ManualInputSchema.parse({ ...manualGroupInit, ability: scores[i].ability }))
          }
          updates.push(() => {
            group.setFieldValue('manualRolled.manual', rolls)
            formStore.updateField({ path: 'abilities.manualRolled.manual', value: rolls })
          })
        }

        if (configuration == null) {
          updates.push(() => {
            group.setFieldValue('manualRolled.configuration', rollConfiguration)
            formStore.updateField({ path: 'abilities.manualRolled.configuration', value: rollConfiguration })
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
    }, [configuration, scores, rollGroups, manual, manualGroupInit, rollConfiguration, rollGroupInit, group, formStore])

    // Set the ability scores if manualRolled
    useEffect(() => {
      if (rollGroups?.length && rollGroups?.some((rollGroup) => rollGroup?.some((roll) => roll.applied))) {
        rollGroups?.forEach((rollGroup) => {
          scores?.forEach((score, i) => {
            const rollIndex = rollGroup?.findIndex((roll) => roll.ability === score.ability)
            if (rollIndex && rollIndex !== -1) {
              const roll = RollTypeInputSchema.parse(rollGroup?.[rollIndex])
              if (!isEqual(scores?.[i]?.baseScore, roll?.score)) {
                group.setFieldValue(`scores[${i}].baseScore`, roll?.score)
                formStore.updateField({
                  path: `abilities.scores[${i}].baseScore`,
                  value: roll?.score,
                })
              }
            } else {
              group.setFieldValue(`scores[${i}].baseScore`, 0)
              formStore.updateField({
                path: `abilities.scores[${i}].baseScore`,
                value: 0,
              })
            }
          })
        })
      }
    }, [formStore, group, rollGroups, scores])

    useEffect(() => {
      if (manual?.length) {
        scores?.forEach((score, i) => {
          const manualIndex = manual?.findIndex((manual) => manual.ability === score.ability)
          if (manualIndex && manualIndex !== -1) {
            const manualObject = manual?.[manualIndex]
            if (!isEqual(scores?.[i]?.baseScore, manualObject?.score)) {
              group.setFieldValue(`scores[${i}].baseScore`, manualObject?.score)
              formStore.updateField({
                path: `abilities.scores[${i}].baseScore`,
                value: manualObject?.score,
              })
            }
          } else {
            group.setFieldValue(`scores[${i}].baseScore`, 0)
            formStore.updateField({
              path: `abilities.scores[${i}].baseScore`,
              value: 0,
            })
          }
        })
      }
    }, [formStore, group, manual, scores])

    const handleRoll = async (gI: number, rI: number) => {
      let total: number = 0
      let roll: z.input<typeof RollTypeInputSchema> = RollTypeInputSchema.parse(rollGroups?.[gI]?.[rI])
      roll.rolling = true
      group.setFieldValue(`manualRolled.rollGroups[${gI}][${rI}]`, roll)
      setIsRolling(true)
      formStore.updateField({ path: `abilities.manualRolled.rollGroups[${gI}][${rI}]`, value: roll })

      try {
        // Call rollDice function with the input string
        const rollResult = RollTypeInputSchema.parse(await rollDice(rollConfiguration))

        const results = { ...rollResult }
        results.kept?.forEach((result) => {
          total += result.value
        })

        roll = { ...roll, rolling: false, score: total, rolled: results.rolled, kept: results.kept }

        group.setFieldValue(`manualRolled.rollGroups[${gI}][${rI}]`, roll)
        formStore.updateField({ path: `abilities.manualRolled.rollGroups[${gI}][${rI}]`, value: roll })
      } catch (error: unknown) {
        // Handle invalid input format error
        console.error(error)
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

      group.setFieldValue(`manualRolled.rollGroups[${i}]`, rollGroup)
      formStore.updateField({ path: `abilities.manualRolled.rollGroups[${i}]`, value: rollGroup })
    }

    const rollResult = (gI: number, rI: number) => {
      const diceResults = []
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
                    group.setFieldValue(`manualRolled.rollGroups[${groupIndex}][${rollIndex}].applied`, false)
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
            group.setFieldValue(`scores[${index}].baseScore`, roll.score)
            group.setFieldValue(`manualRolled.rollGroups[${gI}][${rI}]`, rollObject)
          }
        })
      }
    }

    const handleBlur = ({
      target: { name, value },
    }: {
      target: { name: string; value: string | string[] | number | null | undefined }
    }) => {
      const pathName = 'abilities' + (name.startsWith('[') ? '' : '.') + name
      const currentValue = get(formStore.current, pathName)
      if (value != null && !isEqual(currentValue, value)) {
        formStore.updateField({ path: pathName, value })
      } else if (currentValue && value == null) {
        formStore.removeField({ path: pathName })
      }
    }

    return (
      <Subscribe
        selector={(state) => ({
          manualRolled: state.values.manualRolled,
          scores: state.values.scores,
        })}
      >
        {({ manualRolled, scores }) => (
          <>
            <AppField name='manualRolled.manual' mode='array'>
              {(manualField) =>
                manualField.state.value?.map((mObject, i) => {
                  const ability = abilities.findAbility(mObject.ability)
                  return (
                    <AppField name={`manualRolled.manual[${i}]`}>
                      {(manualSubfield) => (
                        <AppField
                          name={`scores[${i}].baseScore`}
                          listeners={{
                            onBlur: ({ value, fieldApi }) =>
                              fieldApi.state.meta.isValid && handleBlur({ target: { name: fieldApi.name, value } }),
                            onChange: ({ value }) => {
                              const score = scores?.[i]
                              const ability = score?.ability
                              const rollGroups = manualRolled?.rollGroups

                              if (rollGroups?.length) {
                                rollGroups.forEach((rGroup, gI) => {
                                  if (rGroup.length) {
                                    rGroup?.forEach((roll, rI) => {
                                      if (roll.applied) {
                                        group.setFieldValue(`manualRolled.rollGroups[${gI}][${rI}].applied`, false)
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
                                    score: Number(value),
                                  })
                                )
                              }
                            },
                          }}
                        >
                          {({ TextField }) => (
                            <Grid.Col key={`${i}-score-baseScore`} span={{ sm: 6, md: 4, lg: 2 }}>
                              <TextField label={ability?.label} />
                            </Grid.Col>
                          )}
                        </AppField>
                      )}
                    </AppField>
                  )
                })
              }
            </AppField>
            <Grid.Col>
              <Collapsible>
                <Collapsible.Trigger title='Dice Roll Groups' />
                <Collapsible.Content>
                  <Grid>
                    <AppField name='manualRolled.rollGroups' mode='array'>
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
                                        color='update'
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
                                        color='danger'
                                        variant='outline'
                                        onClick={() => {
                                          if (scores?.length) {
                                            rGroup.forEach((roll) => {
                                              if (roll?.ability) {
                                                const scoreIndex = scores.findIndex(
                                                  (scores) => scores.ability === roll.ability
                                                )

                                                if (scoreIndex && scoreIndex !== -1) {
                                                  group.setFieldValue(`scores[${scoreIndex}].baseScore`, 0)
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
                                  <AppField name={`manualRolled.rollGroups[${gI}]`} mode='array'>
                                    {(rollsField) => {
                                      const rolls = rollsField.state.value
                                      return rolls?.map((roll, rI) => {
                                        const { quantity, die } = parseDiceRoll(rollConfiguration)
                                        return (
                                          <Grid.Col key={rI} span={{ sm: 6, md: 4, lg: 2 }}>
                                            <Group justify='flex-start' key={rI}>
                                              <Group justify='center' wrap='nowrap' className={dice_roll_value_group}>
                                                {roll?.rolling ?
                                                  <Spinner className={dice_spinner} />
                                                : <>
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
                                                }
                                              </Group>
                                              {roll.score == null ?
                                                <Button
                                                  name='setRolling'
                                                  color='primary'
                                                  onClick={() => {
                                                    setTimeout(() => {
                                                      handleRoll(gI, rI)
                                                    }, 10)
                                                  }}
                                                  className={sprinkles({ width: 'size-full' })}
                                                  disabled={
                                                    dice.isRolling ||
                                                    die == null ||
                                                    quantity == null ||
                                                    manualRolled?.configuration === ''
                                                  }
                                                >
                                                  {dice.isRolling ? 'Rolling' : 'Roll'}
                                                </Button>
                                              : <AppField
                                                  name={`manualRolled.rollGroups[${gI}][${rI}].ability`}
                                                  listeners={{
                                                    onBlur: ({ value, fieldApi }) =>
                                                      handleBlur({ target: { name: fieldApi.name, value } }),
                                                    onChange: ({ value }) => {
                                                      if (value == null) {
                                                        const rollGroupsUpdated = rollGroups?.[gI].map((roll, index) =>
                                                          RollTypeInputSchema.parse({
                                                            ...roll,
                                                            applied: false,
                                                            ability: index === rI ? null : roll.ability,
                                                          })
                                                        )
                                                        rollsField.setValue(rollGroupsUpdated)
                                                      }
                                                    },
                                                  }}
                                                >
                                                  {({ DropdownField }) => (
                                                    <DropdownField
                                                      options={abilities.filter(
                                                        (ability) =>
                                                          !rollGroups?.[gI]?.some(
                                                            (roll, index) => roll.ability === ability.id && index !== rI
                                                          )
                                                      )}
                                                      className={dice_roll_dropdown}
                                                    />
                                                  )}
                                                </AppField>
                                              }
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
                                  color='danger'
                                  variant='outline'
                                  disabled={dice.isRolling}
                                  onClick={() => handleResetGroup(gI)}
                                >
                                  Reset Group
                                </Button>
                              </Grid.Col>
                              <Grid.Col>
                                <Group justify='flex-end'>
                                  <Button
                                    color='update'
                                    variant='outline'
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
                </Collapsible.Content>
              </Collapsible>
            </Grid.Col>
          </>
        )}
      </Subscribe>
    )
  },
})
export default ManualArray
