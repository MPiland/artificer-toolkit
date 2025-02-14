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
  dice_group_divider,
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
import { Character, RollType } from '../../../../../amplify/gql/types'
import { parseDiceRoll } from '../../../../utils/dice'
import { UpdateState } from '../../../../types/form'
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
    () =>
      ({
        __typename: 'RollType',
        score: null,
        ability: null,
        rolling: false,
        rolled: [],
        kept: [],
        applied: false,
      } as RollType),
    []
  )

  const { rollDice, isRolling, setIsRolling } = use(DiceContext)
  const [rollConfiguration, setRollConfiguration] = useState<RollConfig>('4d6dl1r1')

  //Initialize manualRolled object in formData to create empty array for rolling Dice
  useEffect(() => {
    if (!(formData.abilities?.manualRolled?.rollGroups?.length > 0) && formData.abilities?.scores?.length > 0) {
      const rollGroups: RollType[][] = []
      const rolls: RollType[] = []
      for (let i = 0; i < formData.abilities?.scores?.length; i++) {
        rolls.push(rollGroupInit)
      }
      rollGroups.push(rolls)
      updateFormData({
        type: 'update',
        path: 'abilities.manualRolled.rollGroups',
        value: rollGroups,
      })
    }
  }, [formData, updateFormData, rollGroupInit])

  // Set which group and selection is currently rolling
  useEffect(() => {
    const rollGroups = formData.abilities?.manualRolled?.rollGroups

    if (rollGroups?.length > 0) {
      rollGroups.forEach((rollGroup, gIndex) =>
        rollGroup?.rolls?.forEach((roll, rIndex) => {
          if (
            roll.rolling &&
            !isRolling &&
            !formData.abilities?.manualRolled?.rollGroups[gIndex]?.rolls[rIndex].rolling
          ) {
            updateFormData({
              type: 'update',
              path: `abilities.manualRolled.rollGroups.${gIndex}.rolls.${rIndex}.rolling`,
              value: false,
            })
          }
        })
      )
    }
  }, [formData.abilities?.manualRolled?.rollGroups, isRolling, updateFormData])

  // Set the form formData for the roll configuration inputs
  useEffect(() => {
    if (!formData.abilities?.manualRolled?.configuration) {
      updateFormData({
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
  }, [formData.abilities?.manualRolled?.configuration, rollConfiguration, updateFormData])

  // Set the ability scores if manualRolled
  useEffect(() => {
    let applied = false
    if (formData.abilities?.manualRolled?.rollGroups?.length > 0) {
      formData.abilities?.manualRolled?.rollGroups?.forEach((rollGroup) => {
        if (rollGroup?.rolls?.length > 0) {
          rollGroup?.rolls?.forEach((roll) => {
            if (roll.ability) {
              const scoreIndex = formData.abilities?.scores?.findIndex((score) => score.ability === roll.ability)

              if (scoreIndex !== -1 && roll.applied) {
                if (!isEqual(formData.abilities?.scores[scoreIndex]?.baseScore, roll.score)) {
                  updateFormData({
                    type: 'update',
                    path: `abilities.scores.${scoreIndex}.baseScore`,
                    value: roll.score,
                  })
                }
                applied = true
              }
            }
          })
        }
      })
    }

    if (applied === false) {
      if (formData.abilities?.manualRolled?.manual?.length > 0) {
        formData.abilities?.manualRolled?.manual?.forEach((input) => {
          const scoreIndex = formData.abilities?.scores?.findIndex((score) => score.ability === input?.ability)

          if (scoreIndex !== -1) {
            if (!isEqual(formData.abilities?.scores[scoreIndex]?.baseScore, input.score)) {
              updateFormData({
                type: 'update',
                path: `abilities.scores.${scoreIndex}.baseScore`,
                value: input.score,
              })
            }
            applied = true
          }
        })
      }
    }
  }, [formData.abilities, formData.abilities?.scores, updateFormData, formData.abilities?.manualRolled?.manual])

  const handleRoll = async (gIndex: number, rIndex: number) => {
    let total: number = 0
    let results: DiceRolls = rollGroupInit
    const roll: DiceRolls = JSON.parse(JSON.stringify(formData.abilities.manualRolled.rollGroups[gIndex].rolls[rIndex]))

    roll.rolling = true

    updateFormData({
      type: 'update',
      path: `abilities.manualRolled.rollGroups.${gIndex}.rolls.${rIndex}`,
      value: roll,
    })
    setIsRolling(true)
    try {
      // Call rollDice function with the input string
      const { kept, rolled } = await rollDice(rollConfiguration) // Example input, replace it with the actual input
      results = { ...results, kept: kept, rolled: rolled }
      results.kept.forEach((result) => {
        total += result.value
      })
    } catch (error: any) {
      // Handle invalid input format error
      console.error(error)
    } finally {
      let roll: DiceRolls = JSON.parse(
        JSON.stringify(formData.abilities.manualRolled.rollGroups[gIndex]?.rolls[rIndex])
      )

      roll = { ...roll, rolling: false, score: total, rolled: results.rolled, kept: results.kept }

      updateFormData({
        type: 'update',
        path: `abilities.manualRolled.rollGroups.${gIndex}.rolls.${rIndex}`,
        value: roll,
      })

      setIsRolling(false)
    }
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

    const rolls = formData.abilities?.manualRolled?.rollGroups?.[gIndex].rolls

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
    const rollGroups: RollType[] = JSON.parse(JSON.stringify(formData.abilities.manualRolled.rollGroups[gIndex].rolls))
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
      const value = formData?.abilities?.manualRolled?.rollGroups?.[gIndex]?.rolls?.[rIndex]?.rolled?.[i]?.value
      const id = formData?.abilities?.manualRolled?.rollGroups?.[gIndex]?.rolls?.[rIndex]?.rolled?.[i]?.id
      const kept = formData?.abilities?.manualRolled?.rollGroups?.[gIndex]?.rolls?.[rIndex]?.kept?.some(
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

  const handleRollApply = (gIndex: number) => {
    const abilities = JSON.parse(JSON.stringify(formData.abilities)) as Character['abilities']
    const rollGroups = abilities.manualRolled.rollGroups

    if (rollGroups?.length > 1) {
      rollGroups?.forEach((rollGroup, groupIndex) => {
        if (groupIndex !== gIndex) {
          if (rollGroup?.rolls?.length > 0) {
            rollGroup?.rolls?.forEach((roll, rollIndex) => {
              if (roll.applied) {
                abilities.manualRolled.rollGroups[groupIndex].rolls[rollIndex].applied = false
              }
            })
          }
        }
      })
    }

    rollGroups[gIndex].rolls.forEach((roll, rollIndex) => {
      if (roll?.ability && roll.ability != null) {
        const ability = roll.ability
        const index = formData.abilities?.scores?.findIndex((score) => score.ability === ability)
        const rollObject = { ...roll }
        rollObject.applied = true
        abilities.scores[index].baseScore = roll.score
        abilities.manualRolled.rollGroups[gIndex].rolls[rollIndex] = rollObject

        if (index !== -1) {
          updateFormData({
            type: 'update',
            path: 'abilities',
            value: ability,
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
          if (rollGroup.rolls?.length > 0) {
            rollGroup?.rolls?.forEach((roll, rIndex) => {
              if (roll.applied) {
                abilities.manualRolled.rollGroups[gIndex].rolls[rIndex].applied = false
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
        {formData.abilities?.scores?.map((score, aIndex) => {
          const ability = system.abilities.find((ability) => ability.id === score.ability)
          return (
            <Input<Character>
              key={aIndex}
              name={`abilities.scores.${aIndex}.baseScore`}
              value={score.baseScore}
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
              value={formData.abilities.manualRolled.configuration}
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
                        disabled={isRolling}
                      >
                        Add Group
                      </Button>
                    )}
                    {formData.abilities?.manualRolled?.rollGroups.length !== 1 && (
                      <Button
                        color='danger'
                        style='outline'
                        onClick={() => handleDeleteGroup(gIndex)}
                        disabled={isRolling}
                      >
                        Delete Group
                      </Button>
                    )}
                  </Group>
                  <Row cols={{ base: 2, md: rollGroup.rolls?.length }} className={dice_group}>
                    {rollGroup?.rolls?.map((roll, rIndex) => {
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
                                {formData.abilities?.manualRolled?.rollGroups?.[gIndex]?.rolls?.[rIndex]?.rolled
                                  ?.length > 0 && (
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
                              disabled={isRolling || dieType == null}
                            >
                              {roll?.rolling ? 'Rolling' : 'Roll'}
                            </Button>
                          ) : (
                            <Dropdown<Character>
                              name={`abilities.manualRolled.rollGroups.${gIndex}.rolls.${rIndex}.ability`}
                              options={system.abilities}
                              className={dice_roll_dropdown}
                              value={formData.abilities?.manualRolled?.rollGroups?.[gIndex]?.rolls?.[rIndex]?.ability}
                              onChange={updateFormData}
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
                      disabled={!rollGroup?.rolls?.some((roll) => roll.score != null)}
                      onClick={() => handleResetGroup(gIndex)}
                    >
                      Reset Group
                    </Button>
                    <Button
                      color='update'
                      style='outline'
                      disabled={
                        rollGroup?.rolls?.some((roll) => roll.rolling) || !rollGroup?.rolls?.some((roll) => roll.score)
                      }
                      onClick={() => handleRollApply(gIndex)}
                    >
                      Apply Rolls
                    </Button>
                  </Group>
                </Group>
                {formData.abilities.scores?.length > 1 && gIndex !== formData.abilities.scores?.length - 1 && (
                  <hr className={dice_group_divider} />
                )}
              </Fragment>
            )
          })}
        </Collapse.Body>
      </Collapse>
    </>
  )
}
export default ManualArray
