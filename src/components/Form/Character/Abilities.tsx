import { Fragment, useEffect, useMemo, useState } from 'react'
import Button from '../../Button/Button'
import { useDice } from '../../../hooks/UseDice'
import Spinner from '../../Spinner/Spinner'
import Input from '../../Input/Input'
import Group from '../../Group/Group'
import { sprinkles } from '../../../css/sprinkles.css'
import {
  ability_group,
  ability_value,
  dice_section,
  dice_group,
  dice_group_divider,
  dice_group_footer,
  dice_group_header,
  dice_roll_group,
  dice_roll_value,
  dice_spinner,
  ability_card_header,
  ability_card,
  ability_card_info_label,
  ability_card_info_value,
  ability_card_info,
  roll_score_group,
  roll_score_box,
  ability_card_group,
  system_select,
  roll_score,
  dice_roll_dropdown,
  point_counter,
  point_counter_label,
  dice_roll_value_group,
} from './Character.css'
import Dropdown from '../../Dropdown/Dropdown'
import { useGetBuildersQuery } from '../../../features/builders/buildersApi'
import { ReducerActionType, DiceRollsType, DiceConfigType } from '../../../utils/types'
import Collapse from '../../Collapse/Collapse'
import { get, isEqual, set } from 'lodash'
import Row from '../../Row/Row'
import { useForm } from '../../../hooks/UseForm'
import clsx from 'clsx'
import Scene from '../../Dice/Scene'
import { createPortal } from 'react-dom'

const AbilitiesForm = () => {
  const rollConfigurationInit: DiceConfigType = useMemo(
    () => ({
      quantity: 4,
      type: 6,
      reduceType: 'dl',
      reduceCount: 1,
      rerollType: 'r',
      rerollCondition: null,
      rerollValue: 1,
    }),
    []
  )

  const rollGroupInit = useMemo(
    () =>
      ({
        score: null,
        ability: null,
        rolling: false,
        rolled: [],
        kept: [],
        applied: false,
      }) as DiceRollsType,
    []
  )

  const form: HTMLFormElement = document.getElementById('form_content') as HTMLFormElement

  const { formState, setFormState } = useForm()
  const { rollDice, isRolling, setIsRolling } = useDice()
  const [rollConfigurationInputs, setRollConfigurationInputs] = useState<DiceConfigType>(rollConfigurationInit)
  const [pointsLeft, setPointsLeft] = useState<number>()
  const { data: builders } = useGetBuildersQuery()

  const pointSystem = useMemo(() => formState.abilities?.selectedSystem, [formState.abilities?.selectedSystem])

  // Set pointsLeft for pointBuy
  useEffect(() => {
    if (pointSystem?.name === 'pointBuy' && pointsLeft == null) {
      setPointsLeft(builders.system.rules.abilityGenerate.find((method: any) => method.name === 'pointBuy').total)
    }
  }, [builders?.system?.rules?.abilityGenerate, pointSystem?.name, pointsLeft])

  //Initialize manualRolled object in formState to create empty array for rolling Dice
  useEffect(() => {
    if (
      !(formState.abilities?.manualRolled?.rolls?.length > 0) &&
      formState.abilities?.scores?.length > 0 &&
      pointSystem?.name === 'manualRolled'
    ) {
      const rollArray: DiceRollsType[][] = []
      const rollGroup: DiceRollsType[] = []
      for (let i = 0; i < formState.abilities?.scores?.length; i++) {
        rollGroup.push(rollGroupInit)
      }
      rollArray.push(rollGroup)
      setFormState({
        target: {
          name: 'abilities.manualRolled.rolls',
          value: rollArray,
        },
      })
    }
  }, [formState, setFormState, rollGroupInit, pointSystem])

  const rollConfiguration = useMemo(() => {
    const { quantity, type, reduceType, reduceCount, rerollType, rerollCondition, rerollValue } =
      rollConfigurationInputs

    let rollConfigurationString: string = String(quantity) + 'd' + String(type)

    if (reduceType != null) {
      rollConfigurationString += reduceType + String(reduceCount)
    }

    if (rerollType != null) {
      rollConfigurationString += rerollType

      if (rerollCondition != null && rerollCondition !== '===') {
        rollConfigurationString += rerollCondition
      }

      if (rerollValue) {
        rollConfigurationString += rerollValue
      }
    }

    return rollConfigurationString
  }, [rollConfigurationInputs])

  // Set which group and selection is currently rolling
  useEffect(() => {
    const rollArray: DiceRollsType[][] = formState.abilities?.manualRolled?.rolls

    if (rollArray?.length > 0) {
      rollArray.forEach((rollGroup, gIndex) =>
        rollGroup.forEach((roll, rIndex) => {
          if (roll.rolling && !isRolling && !formState.abilities?.manualRolled?.rolls[gIndex][rIndex].rolling) {
            setFormState({
              target: {
                name: `abilities.manualRolled.rolls.${gIndex}.${rIndex}.rolling`,
                value: false,
              },
            })
          }
        })
      )
    }
  }, [formState.abilities?.manualRolled?.rolls, isRolling, setFormState])

  // Set the form state for the roll configuration inputs
  useEffect(() => {
    if (!formState.abilities?.manualRolled?.rollConfiguration) {
      setFormState({
        target: {
          name: 'abilities.manualRolled.rollConfiguration',
          value: rollConfigurationInputs,
        },
      })
    }
    if (
      formState.abilities?.manualRolled?.rollConfiguration &&
      isEqual(rollConfigurationInputs, rollConfigurationInit) &&
      !isEqual(rollConfigurationInputs, formState.abilities?.manualRolled?.rollConfiguration)
    ) {
      setRollConfigurationInputs(formState.abilities?.manualRolled?.rollConfiguration)
    }
  }, [
    formState.abilities?.manualRolled?.rollConfiguration,
    rollConfigurationInputs,
    setFormState,
    rollConfigurationInit,
  ])

  // Set the ability scores if pointBuy
  useEffect(() => {
    if (pointSystem?.name === 'pointBuy') {
      let emptyArray: boolean = true
      if (formState.abilities?.pointBuy?.distributed?.length > 0) {
        formState.abilities?.pointBuy?.distributed?.forEach((distribution: any) => {
          if (distribution?.ability) {
            const abilityIndex = formState.abilities?.scores?.findIndex(
              (ability: any) => ability._id === distribution.ability._id
            )
            if (abilityIndex !== -1) {
              emptyArray = false
              if (!isEqual(formState.abilities?.scores[abilityIndex]?.baseScore, distribution.pointBuy.name)) {
                setFormState({
                  target: {
                    name: `abilities.scores.${abilityIndex}.baseScore`,
                    value: distribution.pointBuy.name,
                  },
                })
              }
            }
          }
        })
      }
      if (emptyArray || !(formState.abilities?.pointBuy?.distributed?.length > 0)) {
        formState.abilities?.scores?.forEach((ability: any, aIndex: number) => {
          if (ability.baseScore !== 0) {
            setFormState({
              target: {
                name: `abilities.scores.${aIndex}.baseScore`,
                value: 0,
              },
            })
          }
        })
      }
    }
  }, [
    formState.abilities?.pointBuy?.distributed,
    pointSystem?.name,
    formState.abilities?.scores,
    formState.abilities?.manualRolled?.rolls,
    setFormState,
  ])

  // Set the ability scores if manualRolled
  useEffect(() => {
    if (pointSystem?.name === 'manualRolled') {
      let applied = false
      if (formState.abilities?.manualRolled?.rolls?.length > 0) {
        formState.abilities?.manualRolled?.rolls?.forEach((rollGroup: any[]) => {
          if (rollGroup.length > 0) {
            rollGroup.forEach((roll: any) => {
              if (roll.ability) {
                const abilityIndex = formState.abilities?.scores?.findIndex(
                  (ability: any) => ability._id === roll.ability._id
                )

                if (abilityIndex !== -1 && roll.applied) {
                  if (!isEqual(formState.abilities?.scores[abilityIndex]?.baseScore, roll.score)) {
                    setFormState({
                      target: {
                        name: `abilities.scores.${abilityIndex}.baseScore`,
                        value: roll.score,
                      },
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
        if (formState.abilities?.manualRolled?.manual?.length > 0) {
          formState.abilities?.manualRolled?.manual?.forEach((input: any) => {
            const abilityIndex = formState.abilities?.scores?.findIndex(
              (ability: any) => ability._id === input?.ability._id
            )

            if (abilityIndex !== -1) {
              if (!isEqual(formState.abilities?.scores[abilityIndex]?.baseScore, input.score)) {
                setFormState({
                  target: {
                    name: `abilities.scores.${abilityIndex}.baseScore`,
                    value: input.score,
                  },
                })
              }
              applied = true
            }
          })
        }
      }
    }
  }, [
    formState.abilities?.manualRolled?.rolls,
    pointSystem?.name,
    formState.abilities?.scores,
    setFormState,
    formState.abilities?.manualRolled?.manual,
  ])

  // Set ability scores for standardArray
  useEffect(() => {
    if (pointSystem?.name === 'standardArray') {
      if (formState.abilities?.standardArray?.length > 0) {
        formState.abilities?.scores?.forEach((ability: any, aIndex: number) => {
          const score = formState.abilities?.standardArray?.find(
            (arrayValue: any) => ability._id === arrayValue?.ability?._id
          )?.score

          if (score) {
            setFormState({
              target: {
                name: `abilities.scores.${aIndex}.baseScore`,
                value: score,
              },
            })
          } else {
            setFormState({
              target: {
                name: `abilities.scores.${aIndex}.baseScore`,
                value: 0,
              },
            })
          }
        })
      }
    }
  }, [formState.abilities, pointSystem?.name, setFormState])

  const calculateModifier = (score: number, type: 'bonus' | 'modifier') => {
    let scoreString: string = ''
    if (!score) {
      return '--'
    }
    if (type === 'bonus') {
      if (score > 0) {
        scoreString += '+'
      }
      if (score < 0) {
        scoreString += '-'
      }

      scoreString += `${score}`
    }
    if (type === 'modifier') {
      const subtracted = score - 10
      const modifier = Math.round(subtracted / 2)
      if (modifier > 0) {
        scoreString += '+'
      }
      if (modifier < 0) {
        scoreString += '-'
      }

      scoreString += `${Math.abs(modifier)}`
    }

    return scoreString
  }

  const handleRoll = async (gIndex: number, rIndex: number) => {
    let total: number = 0
    let results: DiceRollsType = rollGroupInit
    const roll: DiceRollsType = JSON.parse(JSON.stringify(formState.abilities.manualRolled.rolls[gIndex][rIndex]))

    roll.rolling = true

    setFormState({
      target: {
        name: `abilities.manualRolled.rolls.${gIndex}.${rIndex}`,
        value: roll,
      },
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
      let roll: DiceRollsType = JSON.parse(JSON.stringify(formState.abilities.manualRolled.rolls[gIndex][rIndex]))

      roll = { ...roll, rolling: false, score: total, rolled: results.rolled, kept: results.kept }

      setFormState({
        target: {
          name: `abilities.manualRolled.rolls.${gIndex}.${rIndex}`,
          value: roll,
        },
      })

      setIsRolling(false)
    }
  }

  const handleScoreSelect = (e: ReducerActionType, gIndex: number, rIndex: number) => {
    setFormState({
      target: {
        name: `abilities.manualRolled.rolls.${gIndex}.${rIndex}.ability`,
        value: e.target.value,
      },
    })
  }

  const handleAddGroup = () => {
    const rollArray: DiceRollsType[][] = JSON.parse(JSON.stringify(formState.abilities.manualRolled.rolls))
    const rollGroup: DiceRollsType[] = []
    formState.abilities?.scores?.forEach((_: any, aIndex: number) => {
      set(rollGroup, `${aIndex}`, rollGroupInit)
    })
    rollArray.push(rollGroup)

    setFormState({
      target: {
        name: 'abilities.manualRolled.rolls',
        value: rollArray,
      },
    })
  }

  const handleDeleteGroup = (gIndex: number) => {
    const rollArray = formState.abilities.manualRolled?.rolls?.filter(
      (_: any, groupIndex: number) => gIndex !== groupIndex
    )

    const abilities = JSON.parse(JSON.stringify(formState.abilities))

    const rollGroup: DiceRollsType[] = formState.abilities?.manualRolled?.rolls?.[gIndex]

    rollGroup.forEach((roll) => {
      if (roll?.ability?._id) {
        const abilityIndex = abilities?.scores?.findIndex((ability: any) => ability._id === roll.ability._id)

        if (abilityIndex !== -1) {
          set(abilities, `scores.${abilityIndex}.baseScore`, 0)
        }
      }
    })

    set(abilities, 'manualRolled.rolls', rollArray)

    setFormState({
      target: {
        name: 'abilities',
        value: abilities,
      },
    })
  }

  const handleResetGroup = (gIndex: number) => {
    const rollGroup: DiceRollsType[] = JSON.parse(JSON.stringify(formState.abilities.manualRolled.rolls[gIndex]))
    for (let i = 0; i < rollGroup.length; i++) {
      rollGroup[i] = rollGroupInit
    }

    setFormState({
      target: {
        name: `abilities.manualRolled.rolls.${gIndex}`,
        value: rollGroup,
      },
    })
  }

  const handleDiceConfiguration = (e: ReducerActionType) => {
    const name = e.target.name as string
    const value = e.target.value
    let inputs: any = {}
    if (value?.value) {
      inputs = { ...rollConfigurationInputs, [name]: e.target.value?.name }
    } else {
      inputs = { ...rollConfigurationInputs, [name]: e.target.value }
    }
    setRollConfigurationInputs(inputs)
    setFormState({
      target: {
        name: 'abilities.manualRolled.rollConfiguration',
        value: inputs,
      },
    })
  }

  const rollResult = (gIndex: number, rIndex: number) => {
    const diceResults = []
    for (let i = 0; i < Number(rollConfigurationInputs.quantity); i++) {
      const value = (formState?.abilities?.manualRolled?.rolls?.[gIndex]?.[rIndex] as DiceRollsType)?.rolled?.[i]?.value
      const id = (formState?.abilities?.manualRolled?.rolls?.[gIndex]?.[rIndex] as DiceRollsType)?.rolled?.[i]?.id
      const kept = (formState?.abilities?.manualRolled?.rolls?.[gIndex]?.[rIndex] as DiceRollsType)?.kept?.some(
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
    const ability = JSON.parse(JSON.stringify(formState.abilities))
    const rolls: DiceRollsType[][] = get(ability, `manualRolled.rolls`)

    if (rolls?.length > 1) {
      rolls?.forEach((rollGroup: any, groupIndex: number) => {
        if (groupIndex !== gIndex) {
          if (rollGroup?.length > 0) {
            rollGroup.forEach((roll: any, rollIndex: number) => {
              if (roll.applied) {
                set(ability, `manualRolled.rolls.${groupIndex}.${rollIndex}.applied`, false)
              }
            })
          }
        }
      })
    }

    rolls[gIndex].forEach((roll, rollIndex) => {
      if (roll?.ability && roll.ability._id != null) {
        const abilityId = roll.ability._id
        const index = formState.abilities?.scores?.findIndex((ability: any) => ability._id === abilityId)
        const rollObject = { ...roll }
        set(rollObject, 'applied', true)
        set(ability, `manualRolled.rolls.${gIndex}.${rollIndex}`, rollObject)
        set(ability, `scores.${index}.baseScore`, roll.score)

        if (index !== -1) {
          setFormState({
            target: {
              name: 'ability',
              value: ability,
            },
          })
        }
      }
    })
  }

  const handlePointApply = (e: ReducerActionType, ability: any, aIndex: number) => {
    const pointBuyObject = builders.system.rules.abilityGenerate
      .find((method: any) => method.name === 'pointBuy')
      .values.find((value: any) => value.name === e?.target?.value?.name)
    if (pointBuyObject != null) {
      const applyObject = { ability: ability, pointBuy: pointBuyObject }
      if (pointsLeft != null) {
        const newPointsLeft = pointsLeft - e.target.value.reduce
        setPointsLeft(newPointsLeft)
      }

      setFormState({
        target: {
          name: `abilities.pointBuy.distributed.${aIndex}`,
          value: applyObject,
        },
      })
    } else {
      const current = formState.abilities?.pointBuy?.distributed?.[aIndex]?.pointBuy
      const newPointsLeft = pointsLeft + current.reduce
      setPointsLeft(newPointsLeft)
      setFormState({
        target: {
          name: `abilities.pointBuy.distributed.${aIndex}`,
          value: {},
        },
      })
    }
  }

  const handleStandardArray = (e: ReducerActionType, ability: any, aIndex: number) => {
    const valueObject = e.target.value
    if (valueObject) {
      const standardArrayObject = { ability: ability, score: e.target.value.value }
      return setFormState({
        target: {
          name: `abilities.standardArray.${aIndex}`,
          value: standardArrayObject,
        },
      })
    }

    return setFormState({
      target: {
        name: `abilities.standardArray.${aIndex}`,
        value: undefined,
      },
    })
  }

  const handleInputScore = (e: ReducerActionType, aIndex: number) => {
    const abilityObject = JSON.parse(JSON.stringify(formState.abilities))
    const ability = get(abilityObject, `scores.${aIndex}`)

    const rollObject: DiceRollsType[][] = get(abilityObject, 'manualRolled.rolls')

    if (rollObject?.length > 0) {
      rollObject.forEach((rollGroup, gIndex) => {
        if (rollGroup.length > 0) {
          rollGroup.forEach((roll, rIndex) => {
            if (roll.applied) {
              set(abilityObject, `manualRolled.rolls.${gIndex}.${rIndex}.applied`, false)
            }
          })
        }
      })
    }
    set(abilityObject, `scores.${aIndex}.baseScore`, Number(e.target.value))
    set(abilityObject, `manualRolled.manual.${aIndex}`, {
      ability: { name: ability.name, value: ability.value, _id: ability._id },
      score: Number(e.target.value),
    })
    setFormState({
      target: {
        name: 'abilities',
        value: abilityObject,
      },
    })
  }

  return (
    <>
      {createPortal(<Scene />, form)}
      <Dropdown
        name='abilities.selectedSystem'
        options={builders.system.rules.abilityGenerate}
        className={system_select}
        label='Point System'
        value={formState.abilities?.selectedSystem}
        onChange={setFormState}
      />
      {pointSystem?.name === 'pointBuy' && (
        <>
          <div className={point_counter}>
            <span className={point_counter_label}>Points Remaining</span>
            <span>{`${pointsLeft} / ${
              builders.system.rules.abilityGenerate.find((method: any) => method.name === 'pointBuy').total
            }`}</span>
          </div>
          <Row cols={{ base: 2, md: formState.abilities?.scores?.length }} className={ability_group}>
            {formState.abilities?.scores?.map((ability: any, aIndex: number) => (
              <Dropdown
                name='pointBuy'
                label={`${ability.value}`}
                key={aIndex}
                value={formState.abilities?.pointBuy?.distributed[aIndex]?.pointBuy}
                options={builders.system.rules.abilityGenerate
                  .find((method: any) => method.name === 'pointBuy')
                  .values.filter((value: any) => {
                    const currentSelection = formState.abilities?.pointBuy?.distributed[aIndex]?.pointBuy
                    if (currentSelection) {
                      return value?.reduce - currentSelection?.reduce <= (pointsLeft as number)
                    }
                    return value?.reduce <= (pointsLeft as number)
                  })
                  .map((value: any) => {
                    if (formState.abilities?.pointBuy?.distributed[aIndex]?.pointBuy) {
                      const currentSelection = formState.abilities?.pointBuy?.distributed[aIndex]?.pointBuy
                      let newReduce: number = 0
                      if (value.name !== currentSelection.name) {
                        newReduce = value.reduce - currentSelection.reduce
                      }
                      let newValue: string = value.name
                      let newOperand: string = ''
                      let newPointString: string

                      if (newReduce >= 1) {
                        newOperand = '-'
                      } else if (newReduce <= -1) {
                        newOperand = '+'
                      }

                      if (Math.abs(newReduce) === 1) {
                        newPointString = 'Point'
                      } else {
                        newPointString = 'Points'
                      }

                      if (newReduce !== 0) {
                        newValue += ` (${newOperand}${Math.abs(newReduce)} ${newPointString})`
                      }

                      return {
                        value: newValue,
                        name: value.name,
                        reduce: newReduce,
                        _id: value._id,
                      }
                    }
                    return {
                      value: value.value,
                      name: value.name,
                      reduce: value.reduce,
                      _id: value._id,
                    }
                  })}
                onChange={(e) => handlePointApply(e, ability, aIndex)}
              />
            ))}
          </Row>
        </>
      )}
      {pointSystem?.name === 'manualRolled' && (
        <>
          <Row cols={{ base: 2, md: formState.abilities?.scores?.length }} className={ability_group}>
            {formState.abilities?.scores?.map((ability: any, aIndex: number) => (
              <Input
                key={aIndex}
                name={`abilities.scores.${aIndex}.baseScore`}
                value={ability.baseScore}
                label={`${ability.value}`}
                className={ability_value}
                type='num'
                onChange={(e) => handleInputScore(e, aIndex)}
              />
            ))}
          </Row>
          <Collapse>
            <Collapse.Header title='Roll Configuration' startOpened={true} />
            <Collapse.Body>
              <Row cols={{ base: 2, md: 3, lg: 7 }} cellSize='auto'>
                <Input
                  name='quantity'
                  value={rollConfigurationInputs.quantity}
                  label='Dice Count'
                  type='num'
                  onChange={(e) => handleDiceConfiguration(e)}
                />
                <Dropdown
                  name='type'
                  label='Dice Value'
                  value={builders.system.dice.find((dice: any) => dice.name === rollConfigurationInputs.type)}
                  options={builders.system.dice}
                  onChange={(e) => handleDiceConfiguration(e)}
                />
                <Dropdown
                  name='reduceType'
                  label='Reduce Type'
                  value={builders.system.rules.reduceType.find(
                    (reduceType: any) => reduceType.name === rollConfigurationInputs.reduceType
                  )}
                  options={builders.system.rules.reduceType}
                  onChange={(e) => handleDiceConfiguration(e)}
                />
                {rollConfigurationInputs.reduceType != null && (
                  <Input
                    name='reduceCount'
                    value={rollConfigurationInputs.reduceCount}
                    label='Count'
                    type='num'
                    onChange={(e) => handleDiceConfiguration(e)}
                  />
                )}
                <Dropdown
                  name='rerollType'
                  label='Reroll Type'
                  value={builders.system.rules.rerollType.find(
                    (rerollType: any) => rerollType.name === rollConfigurationInputs.rerollType
                  )}
                  options={builders.system.rules.rerollType}
                  onChange={(e) => handleDiceConfiguration(e)}
                />
                <Dropdown
                  name='rerollCondition'
                  label='Reroll Condition'
                  value={builders.system.rules.rollCondition.find(
                    (rollCondition: any) => rollCondition.name === rollConfigurationInputs.rerollCondition
                  )}
                  options={builders.system.rules.rollCondition}
                  onChange={(e) => handleDiceConfiguration(e)}
                />
                <Input
                  name='rerollValue'
                  value={rollConfigurationInputs.rerollValue}
                  label='Reroll Value'
                  type='num'
                  onChange={(e) => handleDiceConfiguration(e)}
                />
              </Row>
            </Collapse.Body>
          </Collapse>
          <Collapse>
            <Collapse.Header title='Dice Roll Groups' startOpened={true} />
            <Collapse.Body>
              {formState.abilities?.manualRolled?.rolls?.map((rollGroup: DiceRollsType[], gIndex: number) => {
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
                        {formState.abilities?.manualRolled?.rolls.length !== 1 && (
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
                      <Row cols={{ base: 2, md: rollGroup.length }} className={dice_group}>
                        {rollGroup.map((roll, rIndex) => {
                          return (
                            <Group
                              directionVariant='column'
                              justifyContentVariant='start'
                              key={rIndex}
                              className={dice_roll_group}
                            >
                              <Group
                                directionVariant='column'
                                alignItemsVariant='center'
                                className={dice_roll_value_group}
                              >
                                {roll?.rolling ? (
                                  <Spinner className={dice_spinner} />
                                ) : (
                                  <>
                                    <Input
                                      name={`score`}
                                      value={roll?.score || '---'}
                                      readOnly
                                      className={dice_roll_value}
                                      textAlign='center'
                                      disabled={!roll.score}
                                      border='none'
                                      height='full'
                                    />
                                    {formState.abilities?.manualRolled?.rolls?.[gIndex]?.[rIndex]?.rolled?.length >
                                      0 && (
                                      <Row
                                        cols={{ base: rollConfigurationInputs.quantity }}
                                        className={roll_score_group}
                                        cellSize='auto'
                                      >
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
                                  disabled={isRolling || rollConfigurationInputs.type == null}
                                >
                                  {roll?.rolling ? 'Rolling' : 'Roll'}
                                </Button>
                              ) : (
                                <Dropdown
                                  name='test'
                                  options={builders.abilities.type}
                                  className={dice_roll_dropdown}
                                  value={formState.abilities?.manualRolled?.rolls?.[gIndex]?.[rIndex]?.ability}
                                  onChange={(e) => handleScoreSelect(e, gIndex, rIndex)}
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
                          disabled={!rollGroup.some((roll) => roll.score != null)}
                          onClick={() => handleResetGroup(gIndex)}
                        >
                          Reset Group
                        </Button>
                        <Button
                          color='update'
                          style='outline'
                          disabled={rollGroup.some((roll) => roll.rolling) || !rollGroup.some((roll) => roll.score)}
                          onClick={() => handleRollApply(gIndex)}
                        >
                          Apply Rolls
                        </Button>
                      </Group>
                    </Group>
                    {formState.abilities.rolls?.length > 1 && gIndex !== formState.abilities.rolls?.length - 1 && (
                      <hr className={dice_group_divider} />
                    )}
                  </Fragment>
                )
              })}
            </Collapse.Body>
          </Collapse>
        </>
      )}
      {pointSystem?.name === 'standardArray' && (
        <>
          <Row cols={{ base: 2, md: formState.abilities?.scores?.length }} className={ability_group}>
            {formState.abilities?.scores?.map((ability: any, aIndex: number) => (
              <Dropdown
                key={aIndex}
                name='arrayAbility'
                label='Dice Value'
                value={builders.system.rules.abilityGenerate
                  .find((method: any) => method.name === 'standardArray')
                  .values.find((value: any) => value.value === formState.abilities?.standardArray?.[aIndex]?.score)}
                options={builders.system.rules.abilityGenerate
                  .find((method: any) => method.name === 'standardArray')
                  .values.filter(
                    (value: any) =>
                      !formState.abilities?.standardArray?.some(
                        (aValue: any, vIndex: number) => aValue?.score === value.value && vIndex !== aIndex
                      )
                  )}
                onChange={(e) => handleStandardArray(e, ability, aIndex)}
              />
            ))}
          </Row>
        </>
      )}
      <Row cols={{ md: 3, base: 2 }} spacing='spaceAround' className={ability_card_group}>
        {formState.abilities?.scores?.map((ability: any, aIndex: number) => (
          <div key={aIndex} className={ability_card}>
            <div className={ability_card_header}>
              <h3>{ability.value}</h3>
            </div>
            <div className={ability_card_info}>
              <div className={ability_card_info_label}>Total Score</div>
              <div className={ability_card_info_value}>
                {ability.calculatedScore > 0 ? ability.calculatedScore : '--'}
              </div>
            </div>
            <div className={ability_card_info}>
              <div className={ability_card_info_label}>Modifier</div>
              <div className={ability_card_info_value}>{calculateModifier(ability.calculatedScore, 'modifier')}</div>
            </div>
            <div className={ability_card_info}>
              <div className={ability_card_info_label}>Base Score</div>
              <div className={ability_card_info_value}>{ability.baseScore > 0 ? ability.baseScore : '--'}</div>
            </div>
            <div className={ability_card_info}>
              <div className={ability_card_info_label}>Racial Bonus</div>
              <div className={ability_card_info_value}>{calculateModifier(ability.raceScore, 'bonus')}</div>
            </div>
            <div className={ability_card_info}>
              <div className={ability_card_info_label}>Ability Improvements</div>
              <div className={ability_card_info_value}>{calculateModifier(ability.classScore, 'bonus')}</div>
            </div>
          </div>
        ))}
      </Row>
    </>
  )
}

export default AbilitiesForm
