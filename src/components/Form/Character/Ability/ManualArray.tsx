import { Fragment, useEffect, useMemo, useState, use } from 'react'
import Button from '../../../Button/Button'
import Spinner from '../../../Spinner/Spinner'
import Input from '../../../Input/Input'
import Group from '../../../Group/Group'
import { sprinkles } from '../../../../css/sprinkles.css'
import {
  ability_group,
  ability_label,
  dice_section,
  dice_group,
  dice_group_footer,
  dice_group_header,
  dice_roll_group,
  dice_roll_value,
  dice_spinner,
  roll_score_group,
  roll_score_box,
  roll_score,
  dice_roll_dropdown,
  dice_roll_value_group,
} from '../Character.css'
import Dropdown from '../../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../../features/systems/systemsApi'
import { DiceRolls, RollConfig } from '../../../../types/components'
import Collapse from '../../../Collapse/Collapse'
import { isEqual } from 'lodash'
import Row from '../../../Row/Row'
import clsx from 'clsx'
import { Character, Manual, RollType } from '../../../../../amplify/gql/types'
import { parseDiceRoll } from '../../../../utils/dice'
import { DeepKeyOf, UpdateState } from '../../../../types/form'
import { DiceContext } from '../../../Dice/DiceContext'

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
      const { kept, rolled } = await rollDice(rollConfiguration) // Example input, replace it with the actual input
      results = { ...results, kept: kept, rolled: rolled }
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
    const { numDice } = parseDiceRoll(rollConfiguration)
    for (let i = 0; i < Number(numDice); i++) {
      const value = formData?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.rolled?.[i]?.value
      const id = formData?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.rolled?.[i]?.id
      const kept = formData?.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.kept?.some(
        (keptRoll) => keptRoll.id === id
      )
      diceResults.push(
        <div key={`${gIndex}${rIndex}${i}`} className={roll_score_box}>
          <div className={clsx(roll_score, { ['kept']: kept })}>{value}</div>
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
      <Row cols={{ base: 2, md: formData.abilities?.scores?.length }} className={ability_group}>
        {formData.abilities?.manualRolled?.manual?.map((score, aIndex) => {
          const ability = system.abilities.find((ability) => ability.id === score.ability)
          return (
            <Input<Character>
              key={aIndex}
              name={`abilities.scores.${aIndex}.baseScore`}
              value={score.score}
              label={`${ability.label}`}
              className={ability_label}
              type='num'
              onChange={(e) => handleInputScore(e, aIndex)}
            />
          )
        })}
      </Row>
      <Collapse>
        <Collapse.Header title='Roll Configuration' startOpened={true} />
        <Collapse.Body>
          <Row cols={{ base: 2, md: 3, lg: 7 }} cellSize='auto'>
            <Input
              name='abilities.manualRolled.configuration'
              value={formData?.abilities?.manualRolled?.configuration}
              label='Dice Count'
              type='roll'
              onChange={updateFormData}
            />
          </Row>
        </Collapse.Body>
      </Collapse>
      <Collapse>
        <Collapse.Header title='Dice Roll Groups' startOpened={true} />
        <Collapse.Body>
          {formData.abilities?.manualRolled?.rollGroups?.map((rollGroup, gIndex) => {
            return (
              <Fragment key={gIndex}>
                <Group directionVariant='column' className={dice_section}>
                  <Group
                    directionVariant='row'
                    justifyContentVariant={gIndex !== 0 ? 'end' : 'spaceBetween'}
                    className={dice_group_header}
                  >
                    {gIndex === 0 && (
                      <Button
                        color='update'
                        onClick={handleAddGroup}
                        className={sprinkles({ mb: 'space-3' })}
                        disabled={dice.isRolling}
                      >
                        Add Group
                      </Button>
                    )}
                    {formData.abilities?.manualRolled?.rollGroups.length !== 1 && (
                      <Button
                        color='danger'
                        style='outline'
                        onClick={() => handleDeleteGroup(gIndex)}
                        disabled={dice.isRolling}
                      >
                        Delete Group
                      </Button>
                    )}
                  </Group>
                  <Row cols={{ base: 2, md: rollGroup?.length }} className={dice_group}>
                    {rollGroup?.map((roll, rIndex) => {
                      const { numDice, dieType } = parseDiceRoll(rollConfiguration)
                      return (
                        <Group
                          directionVariant='column'
                          justifyContentVariant='start'
                          key={rIndex}
                          className={dice_roll_group}
                        >
                          <Group directionVariant='column' alignItemsVariant='center' className={dice_roll_value_group}>
                            {roll?.rolling ? (
                              <Spinner className={dice_spinner} />
                            ) : (
                              <>
                                <Input<RollType>
                                  name={`score`}
                                  value={roll?.score || '---'}
                                  readOnly
                                  className={dice_roll_value}
                                  textAlign='center'
                                  disabled={!roll.score}
                                  border='none'
                                  height='full'
                                />
                                {formData.abilities?.manualRolled?.rollGroups?.[gIndex]?.[rIndex]?.rolled?.length >
                                  0 && (
                                  <Row cols={{ base: numDice }} className={roll_score_group} cellSize='auto'>
                                    {rollResult(gIndex, rIndex)}
                                  </Row>
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
                      )
                    })}
                  </Row>
                  <Group justifyContentVariant='spaceBetween' className={dice_group_footer}>
                    <Button
                      color='danger'
                      style='outline'
                      disabled={dice.isRolling}
                      onClick={() => handleResetGroup(gIndex)}
                    >
                      Reset Group
                    </Button>
                    <Button
                      color='update'
                      style='outline'
                      disabled={dice.isRolling || !rollGroup.every((roll) => roll.ability != null)}
                      onClick={() => handleApplyRolls(gIndex)}
                    >
                      Apply Rolls
                    </Button>
                  </Group>
                </Group>
                {formData.abilities.manualRolled?.rollGroups?.length > 1 &&
                  gIndex !== formData.abilities.manualRolled.rollGroups.length - 1 && <hr />}
              </Fragment>
            )
          })}
        </Collapse.Body>
      </Collapse>
    </>
  )
}
export default ManualArray
