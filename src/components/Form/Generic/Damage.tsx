import { useEffect, useMemo } from 'react'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'
import Table from '../../Table/Table'
import { sprinkles } from '../../../css/sprinkles.css'
import { useGetSystemsQuery } from '../../../features/systems/systemsApi'
import { useForm } from '../../../hooks/UseForm'
import { ReducerActionType, RowHeaderType, RowInputType } from '../../../utils/types'

const Damage = ({ state, setState }: { state: any; setState: (arg: ReducerActionType) => void }) => {
  const { context } = useForm()
  const { data: builders } = useGetSystemsQuery()

  // Set Damage types for spells, weapons, items
  const damageTypes = useMemo(() => {
    let types = ['primary'] // Create a copy of damageTypes array

    // Handle secondary
    if (state?.damage?.attribute?.some((attributeItem: any) => attributeItem?.name === 'secondaryDamage')) {
      if (!types.includes('secondary')) {
        types.push('secondary')
      }
    } else if (types.includes('secondary')) {
      types = types.filter((type) => type !== 'secondary')
    }

    // Handle bonus damage
    if (state?.damage?.attribute?.some((attributeItem: any) => attributeItem?.name === 'bonusDamage')) {
      if (!types.includes('bonus')) {
        types.push('bonus')
      }
    } else if (types.includes('bonus')) {
      types = types.filter((type) => type !== 'bonus')
    }

    if (state?.properties?.type?.some((propertyItem: any) => propertyItem.name === 'versatile')) {
      if (!types.includes('versatile')) {
        types.push('versatile')
      }
    } else if (types.includes('versatile')) {
      types = types.filter((type) => type !== 'versatile')
    }
    return types
  }, [state?.damage?.attribute, state?.properties?.type])

  // Add/remove Die Per Level table
  useEffect(() => {
    const diePerLevel =
      state?.damage?.primary?.attribute?.name === 'diePerLevel' ||
      state?.damage?.secondary?.attribute?.name === 'diePerLevel' ||
      state?.damage?.bonus?.attribute?.name === 'diePerLevel'

    if (diePerLevel && !state?.damage?.diePerLevel) {
      setState({
        type: 'added',
        target: {
          name: `damage.diePerLevel`,
        },
      })
    }
    if (!diePerLevel && state?.damage?.diePerLevel) {
      setState({
        type: 'removed',
        target: {
          name: `damage.diePerLevel`,
        },
      })
    }
  }, [setState, state?.attribute, state?.damage])

  // Add/remove Set Per Level table
  useEffect(() => {
    const setPerLevel =
      state?.damage?.primary?.attribute?.name === 'setPerLevel' ||
      state?.damage?.secondary?.attribute?.name === 'setPerLevel' ||
      state?.damage?.bonus?.attribute?.name === 'setPerLevel'

    if (setPerLevel && !state?.damage?.setPerLevel) {
      setState({
        type: 'added',
        target: {
          name: `damage.setPerLevel`,
        },
      })
    }
    if (!setPerLevel && state?.damage?.setPerLevel) {
      setState({
        type: 'removed',
        target: {
          name: `damage.setPerLevel`,
        },
      })
    }
  }, [setState, state?.attribute, state?.damage])

  // Remove Damage data
  useEffect(() => {
    if (
      ((!state?.attribute?.some((attributeItem: any) => attributeItem.name === 'doesDamage') &&
        state?.category?.name !== 'weapon') ||
        state?.properties?.type?.some((propertyItem: any) => propertyItem.name === 'special')) &&
      state?.damage
    ) {
      setState({
        type: 'removed',
        target: { name: 'damage' },
      })
    }
    if (
      state?.damage?.secondary &&
      !state?.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryDamage')
    ) {
      setState({ type: 'removed', target: { name: 'damage.secondary' } })
    }
    if (
      state?.damage?.bonus &&
      !state?.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'bonusDamage')
    ) {
      setState({ type: 'removed', target: { name: 'damage.bonus' } })
    }
    if (
      state?.damage?.versatile &&
      !state?.damage?.attribute?.some((attributeItem: any) => attributeItem.name === 'versatileDamage')
    ) {
      setState({ type: 'removed', target: { name: 'damage.versatile' } })
    }
  }, [setState, state?.damage, state?.properties, state?.category, state?.attribute])

  // Die Per Level table data
  const diePerLevelTableColumns = useMemo(() => {
    const inputArray: RowInputType[] = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must not be blank and contain only numbers',
        validation: 'num',
      },
    ]

    if (state?.damage?.primary?.attribute?.some((attributeItem: any) => attributeItem.name === 'diePerLevel')) {
      inputArray.push(
        {
          name: 'primary.diceCount',
          value: 'Main Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'primary.diceValue',
          value: 'Main Dice Value',
          type: 'select',
          options: builders.system.dice,
        }
      )
    }

    if (state?.damage?.secondary?.attribute?.some((attributeItem: any) => attributeItem.name === 'diePerLevel')) {
      inputArray.push(
        {
          name: 'secondary.diceCount',
          value: 'Sec. Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'secondary.diceValue',
          value: 'Sec. Dice Value',
          type: 'select',
          options: builders.system.dice,
        }
      )
    }

    if (state?.damage?.bonus?.attribute?.some((attributeItem: any) => attributeItem.name === 'diePerLevel')) {
      inputArray.push(
        {
          name: 'bonus.diceCount',
          value: 'Bonus Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'bonus.diceValue',
          value: 'Bonus Dice Value',
          type: 'select',
          options: builders.system.dice,
        }
      )
    }

    const headerArray: RowHeaderType[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }, [builders, state?.damage])

  // Set Per Level table data
  const setPerLevelTableColumns = useMemo(() => {
    const inputArray: RowInputType[] = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must not be blank and contain only numbers',
        validation: 'num',
      },
    ]

    if (state?.damage?.primary?.attribute?.some((attributeItem: any) => attributeItem.name === 'setPerLevel')) {
      inputArray.push({
        name: 'primary',
        value: 'Main Dmg. Value',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }

    if (state?.damage?.secondary?.attribute?.some((attributeItem: any) => attributeItem.name === 'setPerLevel')) {
      inputArray.push({
        name: 'secondary',
        value: 'Sec. Dmg. Value',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }

    if (state?.damage?.bonus?.attribute?.some((attributeItem: any) => attributeItem.name === 'setPerLevel')) {
      inputArray.push({
        name: 'bonus',
        value: 'Bonus Dmg. Value',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }

    const headerArray: RowHeaderType[] = inputArray.map((inputItem) => ({
      value: inputItem.value,
      required: true,
    }))

    return { inputs: inputArray, headers: headerArray }
  }, [state?.damage])

  return (
    (state?.category?.name === 'weapon' ||
      state?.attribute?.some((attributeItem: any) => attributeItem.name === 'doesDamage') ||
      state?.properties?.type?.some((propertyItem: any) => propertyItem.name === 'improvisedWeapon')) &&
    !state?.properties?.type?.some((propertyItem: any) => propertyItem.name === 'special') && (
      <>
        <Row className={sprinkles({ mb: 'space-3' })}>
          <Dropdown
            multiSelect={true}
            name={`damage.attribute`}
            label={`Damage Attribute`}
            value={state?.damage?.attribute}
            options={builders.damage.attribute.filter((attributeItem: any) =>
              context.title === 'items'
                ? attributeItem.name !== 'showAsAttack' &&
                  attributeItem.name !== 'addToWeaponAttack' &&
                  state?.category?.name === 'weapon' &&
                  attributeItem.name !== 'secondaryDamage'
                : attributeItem
            )}
            onChange={setState}
          />
        </Row>
        {damageTypes.map((type: string, index: number) => {
          return (
            <Row key={index}>
              {type !== 'versatile' && (
                <>
                  <Dropdown
                    name={`damage.${type}.attribute`}
                    label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dmg. Attribute`}
                    value={state?.damage?.[type]?.attribute}
                    options={[].concat(
                      builders.damage.main.attribute.filter((attributeItem: any) =>
                        context.title === 'spells' || context.title === 'items'
                          ? attributeItem.name !== 'diePerLevel' && attributeItem.name !== 'setPerLevel'
                          : attributeItem
                      ),
                      type === 'bonus' && builders.damage.bonus.attribute
                    )}
                    onChange={setState}
                  />
                  <Dropdown
                    name={`damage.${type}.type`}
                    label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dmg. Type`}
                    value={state?.damage?.[type]?.type}
                    options={[
                      ...builders.damage.type,
                      {
                        id: null,
                        _id: null,
                        name: 'matchWeapon',
                        value: 'Match Weapon',
                      },
                    ]}
                    required={true}
                    onChange={setState}
                  />
                </>
              )}
              {state?.damage?.[type]?.attribute?.name !== 'diePerLevel' &&
                state?.damage?.[type]?.attribute?.name !== 'setPerLevel' &&
                (state?.damage?.[type]?.attribute?.name === 'setValue' ? (
                  <Input
                    name={`damage.${type}.setValue`}
                    value={state?.damage?.[type]?.setValue}
                    label={`Set ${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Value`}
                    onChange={setState}
                    required={true}
                    validation='num'
                    errorMsg={'Must contain only numbers'}
                  />
                ) : state?.damage?.[type]?.attribute?.name === 'ability' ||
                  state?.damage?.[type]?.attribute?.name === 'spellcastingAbility' ||
                  state?.damage?.[type]?.attribute?.name === 'proficiency' ? (
                  <>
                    {state?.damage?.[type]?.attribute?.name === 'ability' && (
                      <Dropdown
                        name={`damage.${type}.ability.type`}
                        label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Ability`}
                        value={state?.damage?.[type]?.ability?.type}
                        options={builders.abilities.type}
                        required={true}
                        onChange={setState}
                      />
                    )}
                    <Input
                      name={`damage.${type}.minValue`}
                      value={state?.damage?.[type]?.minValue}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Min. Value`}
                      onChange={setState}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                    <Input
                      name={`damage.${type}.maxValue`}
                      value={state?.damage?.[type]?.maxValue}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Max Value`}
                      onChange={setState}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                    <Input
                      name={`damage.${type}.multiplier`}
                      value={state?.damage?.[type]?.multiplier}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dmg. Multiplier`}
                      onChange={setState}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                  </>
                ) : state?.damage?.[type]?.attribute?.name === 'damagePool' ? (
                  <>
                    <Dropdown
                      name={`damage.${type}.pool.attribute`}
                      label={`${
                        type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                      } Dmg. Pool Attribute`}
                      value={state?.damage?.[type]?.pool?.attribute}
                      options={[].concat(
                        builders.damage.pool.attribute,
                        type === 'bonus' && builders.damage.bonus.attribute
                      )}
                      required={true}
                      onChange={setState}
                    />
                    {state?.damage?.[type]?.pool?.attribute?.name === 'level' ||
                    state?.damage?.[type]?.pool?.attribute?.name === 'ability' ||
                    state?.damage?.[type]?.attribute?.name === 'spellcastingAbility' ||
                    state?.damage?.[type]?.attribute?.name === 'proficiency' ? (
                      <>
                        {(state?.damage?.[type]?.pool?.attribute?.name === 'ability' ||
                          state?.damage?.[type]?.attribute?.name === 'spellcastingAbility') && (
                          <>
                            {state?.damage?.[type]?.pool?.attribute?.name === 'ability' && (
                              <Dropdown
                                name={`damage.${type}.pool.ability.type`}
                                label='Pool Abilty'
                                value={state?.damage?.[type]?.pool?.ability?.type}
                                options={builders.abilities.type}
                                required={true}
                                onChange={setState}
                              />
                            )}
                            <Input
                              name={`damage.${type}.pool.minValue`}
                              value={state?.damage?.[type]?.pool?.minValue}
                              label={`${
                                type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                              } Dmg. Min. Value`}
                              onChange={setState}
                              validation='num'
                              errorMsg={'Must contain only numbers'}
                            />
                          </>
                        )}
                        <Input
                          name={`damage.${type}.pool.maxValue`}
                          value={state?.damage?.[type].pool?.maxValue}
                          label={`${
                            type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                          } Dmg. Max Value`}
                          onChange={setState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                        <Input
                          name={`damage.${type}.pool.multiplier`}
                          value={state?.damage?.[type]?.pool?.multiplier}
                          label={`${
                            type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'
                          } Dmg. Multiplier`}
                          onChange={setState}
                          validation='num'
                          errorMsg={'Must contain only numbers'}
                        />
                      </>
                    ) : (
                      state?.damage?.[type]?.pool?.attribute?.name === 'setValue' && (
                        <Input
                          name={`damage.${type}.pool.setValue`}
                          value={state?.damage?.[type]?.pool?.setValue}
                          label='Pool Total'
                          onChange={setState}
                          validation='num'
                          required={true}
                          errorMsg={'Must contain only numbers'}
                        />
                      )
                    )}
                  </>
                ) : (
                  <>
                    <Input
                      name={`damage.${type}.diceCount`}
                      value={state?.damage?.[type]?.diceCount}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dice Count`}
                      onChange={setState}
                      required={type === 'primary' ? true : false}
                      validation='num'
                      errorMsg={'Must contain only numbers'}
                    />
                    <Dropdown
                      name={`damage.${type}.diceValue`}
                      label={`${type === 'primary' ? 'Main' : type === 'secondary' ? 'Sec.' : 'Bonus'} Dice Value`}
                      value={state?.damage?.[type]?.diceValue}
                      options={builders.system.dice}
                      required={type === 'primary' ? true : false}
                      onChange={setState}
                    />
                  </>
                ))}
            </Row>
          )
        })}
        {(state?.damage?.primary?.attribute?.name === 'diePerLevel' ||
          state?.damage?.secondary?.attribute?.name === 'diePerLevel' ||
          state?.damage?.bonus?.attribute?.name === 'diePerLevel') && (
          <Collapse>
            <Collapse.Header title={`Damage Die By Level`} />
            <Collapse.Body>
              <Table
                name={`damage.diePerLevel`}
                rows={{
                  inputs: diePerLevelTableColumns.inputs,
                  headers: diePerLevelTableColumns.headers,
                }}
                value={state?.damage?.diePerLevel}
                addRow={true}
                onChange={setState}
              />
            </Collapse.Body>
          </Collapse>
        )}
        {(state?.damage?.primary?.attribute?.name === 'setPerLevel' ||
          state?.damage?.secondary?.attribute?.name === 'setPerLevel' ||
          state?.damage?.bonus?.attribute?.name === 'setPerLevel') && (
          <Collapse>
            <Collapse.Header title={`Set By Level`} />
            <Collapse.Body>
              <Table
                name={`damage.setPerLevel`}
                rows={{
                  inputs: setPerLevelTableColumns.inputs,
                  headers: setPerLevelTableColumns.headers,
                }}
                value={state?.damage?.setPerLevel}
                addRow={true}
                onChange={setState}
              />
            </Collapse.Body>
          </Collapse>
        )}
      </>
    )
  )
}

export default Damage
