import { useState, useEffect, useReducer } from 'react'
import { Button, SimpleGrid, Flex, Group } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import {
  useAddNewItemMutation,
  useGetItemsQuery,
  selectAllItems,
} from './itemsApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { startCase } from 'lodash'
import { handleValidation } from '../../utils/form'
import DraggableTabs from '../../components/DraggableTabs'
import Spinner from '../../components/Spinner/Spinner'
import formReducer from '../../hooks/useReducer'
import TextEditor from '../../components/RichTextEditor/TextEditor'
import Table from '../../components/Table/Table'
import Dropdown from '../../components/Dropdown/Dropdown'
import Input from '../../components/Input/Input'
import FeatureContent from '../../components/Form/FeatureForm'
import Divider from '../../components/Divider/Divider'

const NewItemForm = () => {
  const navigate = useNavigate()

  const { data: builders } = useGetBuildersQuery('buildersList')

  const { items } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({ items: data && selectAllItems(data) }),
  })

  const [
    addNewItem,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewItemMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!builders || !items) {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [builders, items])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Item added successfully!')
      setErrorMessage()
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
      setState({
        type: 'reset',
        payload: { target: {} },
      })
    }
  }, [addIsSuccess, setState])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.message)
    }
  }, [addIsError, addError])

  useEffect(() => {
    document.addEventListener('keypress', () => {
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () =>
      document.removeEventListener('keypress', () => {
        if (successMessage != null) {
          setSuccessMessage()
          handleValidation(true)
        }
        if (errorMessage != null) {
          setErrorMessage()
        }
      })
  })

  useEffect(() => {
    document.addEventListener('mouseup', () => {
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () =>
      document.removeEventListener('mouseup', () => {
        if (successMessage != null) {
          setSuccessMessage()
          handleValidation(true)
        }
        if (errorMessage != null) {
          setErrorMessage()
        }
      })
  })

  const onReset = () => {
    setState({
      type: 'reset',
      payload: { target: {} },
    })
    setSuccessMessage()
    setErrorMessage()
    handleValidation(true)
  }

  const onSubmit = async () => {
    const isValid = handleValidation()
    if (isValid) {
      await addNewItem(state)
    } else {
      setErrorMessage('Please fill out all required fields')
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }

  let content

  if (isLoading) {
    return (content = <Spinner />)
  }

  const mainTabContent = [
    {
      name: 'details',
      content: (
        <>
          <SimpleGrid>
            <Input
              name='value'
              autoComplete='off'
              label='Item Name'
              required={true}
              value={state.value}
              onChange={setState}
              autoFocus={true}
            />
            <Dropdown
              name='category'
              label='Item Category'
              value={state.category}
              options={builders.item.category}
              required={true}
              onChange={setState}
            />
            <Dropdown
              name='property'
              multiSelect={true}
              label='Properties'
              value={state.property}
              options={
                builders.item.category.find(
                  (category) => category._id === state.category?.id
                )?.property
              }
              onChange={setState}
            />
            <Dropdown
              name='rarity'
              label='Rarity'
              value={state.rarity}
              options={builders.item.rarity}
              required={true}
              onChange={setState}
            />
            <Input
              validation={'cur'}
              name='cost.amount'
              autoComplete='off'
              label='Cost'
              required={true}
              invalidText='Must contain only decimal amounts'
              value={state.cost?.amount}
              onChange={setState}
            />
            <Dropdown
              name='cost.currency'
              label='Currency'
              value={state.cost?.currency}
              options={builders.currency}
              optionalKey='short'
              required={true}
              onChange={setState}
            />
            <Input
              validation={'cur'}
              name='weight.amount'
              invalidText='Must contain only numbers'
              label='Item Weight'
              autoComplete='off'
              value={state.weight?.amount}
              onChange={setState}
            />
            <Dropdown
              name='weight.unit'
              label='UoM'
              value={state.weight?.unit}
              options={[].concat(
                Object.values(builders.unit.imperial).flatMap((item) => item)
              )}
              optionalKey='short'
              onChange={setState}
            />
            {state.category &&
              (state.category?.name === 'waterVehicle' ||
                state.category?.name === 'mount') && (
                <>
                  <Input
                    validation={'cur'}
                    name='speed.amount'
                    invalidText='Must contain only numbers'
                    label='Item Speed'
                    autoComplete='off'
                    required={true}
                    value={state.speed?.amount}
                    onChange={setState}
                  />
                  <Dropdown
                    name='speed.unit'
                    label='UoM'
                    value={state.speed?.unit}
                    options={[].concat(
                      Object.values(builders.unit.imperial).flatMap(
                        (item) => item
                      )
                    )}
                    optionalKey='short'
                    onChange={setState}
                  />
                </>
              )}
            {state.category &&
              (state.category?.name === 'weapon' ||
                state.category?.name === 'armor') && (
                <Input
                  validation={'num'}
                  name='itemRank'
                  invalidText='Must contain only numbers'
                  label='Item Rank'
                  autoComplete='off'
                  value={state.itemRank}
                  onChange={setState}
                />
              )}
            {state.category &&
              (state.property?.some(
                (propertyItem) => propertyItem.name === 'container'
              ) ||
                state.category?.name === 'mount') && (
                <>
                  <Input
                    validation={'cur'}
                    name='capacity.amount'
                    invalidText='Must contain only numbers'
                    label='Capacity Amount'
                    autoComplete='off'
                    value={state.capacity?.amount}
                    onChange={setState}
                  />
                  <Dropdown
                    name='capacity.unit'
                    label='UoM'
                    value={state.capacity?.unit}
                    options={[].concat(
                      Object.values(builders.unit.imperial).flatMap(
                        (item) => item
                      )
                    )}
                    optionalKey='short'
                    onChange={setState}
                  />
                </>
              )}
            {state.property?.some(
              (property) =>
                property.name === 'thrown' || property.name === 'ranged'
            ) && (
              <>
                <Input
                  validation='num'
                  name='minRange'
                  invalidText='Must contain only numbers'
                  label='Min Range'
                  value={state?.minRange}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='maxRange'
                  invalidText='Must contain only numbers'
                  label='Max Range'
                  value={state?.maxRange}
                  required={true}
                  onChange={setState}
                />
              </>
            )}
            <Input
              validation={'num'}
              name='quantity'
              invalidText='Must contain only numbers'
              label='Quantity'
              autoComplete='off'
              value={state.quantity}
              onChange={setState}
            />
          </SimpleGrid>
          <TextEditor
            onChange={setState}
            value={state.desc}
            label={'Item Description'}
            name={'desc'}
          />
          <TextEditor
            onChange={setState}
            value={state.quote}
            label={'Item Quote'}
            name={'quote'}
          />
        </>
      ),
    },
    {
      name: 'attributes',
      content: (
        <>
          <SimpleGrid>
            <Dropdown
              name='attribute'
              multiSelect={true}
              label='Attributes'
              value={state.attribute}
              options={builders.item.attribute.filter((attributeItem) =>
                state.category?.name === 'armor' ||
                state.category?.name === 'weapon'
                  ? attributeItem
                  : attributeItem.name !== 'maxBonus'
              )}
              size='col-6 col-sm-3'
              required={true}
              onChange={setState}
            />
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'stackable'
            ) && (
              <Input
                validation={'num'}
                type='text'
                name='maxStack'
                invalidText='Must contain only numbers'
                label='Max Stack Size'
                autoComplete='off'
                value={state.maxStack}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'requireSave'
            ) && (
              <>
                <Dropdown
                  name='saveAbility.ability'
                  label='DC Ability'
                  value={state.saveAbility?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='saveAbility.minValue'
                  autoComplete='off'
                  label='Min. Value'
                  required={true}
                  invalidText='Must contain only numbers'
                  value={state.saveAbility?.minValue}
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'hasRequirements'
            ) && (
              <Dropdown
                multiSelect={true}
                name='requirement.option'
                label='Requirement'
                value={state.requirement?.option}
                options={[].concat(
                  builders.feature.requirement,
                  builders.feature.item.requirement
                )}
                required={true}
                onChange={setState}
              />
            )}
          </SimpleGrid>
          {(state.category?.name === 'weapon' ||
            state.attribute?.some(
              (attributeItem) => attributeItem.name === 'doesDamage'
            ) ||
            state.property?.some(
              (propertyItem) => propertyItem.name === 'improvisedWeapon'
            )) &&
          (!state.property ||
            state.property?.some(
              (propertyItem) => propertyItem !== 'special'
            )) ? (
            <>
<Divider label={`${
                  state.category?.name === 'weapon' ? 'Weapon ' : ''
                }Damage Dice`} />
                <SimpleGrid>
                <Dropdown
                  name='damage.damageAttribute'
                  multiSelect={true}
                  label='Damage Attribute'
                  value={state.damage?.damageAttribute}
                  options={builders.feature.item.damageAttribute}
                  required={true}
                  onChange={setState}
                />
                <Dropdown
                  name='damage.damageType'
                  multiSelect={true}
                  label='Damage Type'
                  value={state.damage?.damageType}
                  options={builders.damage}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='damageprimaryDice.diceCount'
                  invalidText='Must contain only numbers'
                  label='Damage Dice Count'
                  value={state.damage?.dice?.diceCount}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='damageprimaryDice.diceValue'
                  invalidText='Must contain only numbers'
                  label='Damage Dice Value'
                  value={state.damage?.dice?.diceValue}
                  required={true}
                  onChange={setState}
                />
                {state?.damage?.damageAttribute?.some(
                  (attributeItem) => attributeItem.name === 'secondaryDamage'
                ) && (
                  <>
                    <Input
                      validation='num'
                      name='damageprimaryDice.secDiceCount'
                      invalidText='Must contain only numbers'
                      label='Sec. Dice Count'
                      value={state.damage?.dice?.secDiceCount}
                      required={true}
                      onChange={setState}
                    />
                    <Input
                      validation='num'
                      name='damageprimaryDice.secDiceValue'
                      invalidText='Must contain only numbers'
                      label='Sec. Dice Value'
                      value={state.damage?.dice?.secDiceValue}
                      required={true}
                      onChange={setState}
                    />
                  </>
                )}
                {state.property?.some(
                  (property) => property.name === 'versatile'
                ) && (
                  <>
                    <Input
                      validation={'num'}
                      name='damageprimaryDice.versatileDiceCount'
                      invalidText='Must contain only numbers'
                      label='Alt. Dmg. Dice Count'
                      value={state.damage?.dice?.versatileDiceCount}
                      required={true}
                      onChange={setState}
                    />
                    <Input
                      validation={'num'}
                      name='damageprimaryDice.versatileDiceValue'
                      invalidText='Must contain only numbers'
                      label='Alt. Dmg. Dice Value'
                      value={state.damage?.dice?.versatileDiceValue}
                      required={true}
                      onChange={setState}
                    />
                  </>
                )}
                {state.damage?.damageAttribute?.some(
                  (attributeItem) => attributeItem.name === 'bonusDamage'
                ) && (
                  <Dropdown
                    name='damage.bonus.bonusAttribute'
                    label='Bonus Attribute'
                    value={state.damage?.bonus?.bonusAttribute}
                    options={builders.feature.bonusAttribute}
                    required={true}
                    onChange={setState}
                  />
                )}
                {state.damage?.bonus?.bonusAttribute?.name === 'setValue' && (
                  <Input
                    validation={'num'}
                    name='damage.bonusDamage'
                    invalidText='Must contain only numbers'
                    label='Bonus Damage'
                    value={state.damage?.bonusDamage}
                    required={true}
                    onChange={setState}
                  />
                )}
                {state.damage?.bonus?.bonusAttribute?.name ===
                  'abilityBonus' && (
                  <Dropdown
                    name='damage.bonus.ability'
                    label='Ability'
                    value={state.damage?.bonus?.ability}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {(state.category?.name === 'weapon' ||
                  state.property?.some(
                    (propertyItem) => propertyItem.name === 'improvisedWeapon'
                  )) && (
                  <Dropdown
                    name='primaryAbility'
                    label='Primary Ability'
                    value={state.primaryAbility}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {state.attribute?.some(
                  (attributeItem) => attributeItem.name === 'maxBonus'
                ) && (
                  <Input
                    validation='num'
                    name='maxBonus'
                    invalidText='Must contain only numbers'
                    label='Max Bonus'
                    required={true}
                    value={state.maxBonus}
                    onChange={setState}
                  />
                )}
                {state?.property?.some(
                  (property) => property.name === 'finesse'
                ) && (
                  <Dropdown
                    name={'secondaryAbility'}
                    label='Secondary Ability'
                    value={state.secondaryAbility}
                    required={true}
                    options={builders.ability?.filter(
                      (abilityItem) =>
                        abilityItem?.name !== state?.primaryAbility?.name
                    )}
                    onChange={setState}
                  />
                )}
              </SimpleGrid>
            </>
          ) : (
            state.damage != null &&
            Object.keys(state.damage).length !== 0 &&
            setState({
              type: 'removed',
              payload: { target: { name: 'damage' } },
            })
          )}
          {state.category?.name === 'armor' && (
            <>
            <Divider label={'Armor Stats'} />
              <SimpleGrid>
                <Input
                  validation={'num'}
                  name='armorClass'
                  invalidText='Must contain only numbers'
                  label='Armor Value'
                  required={true}
                  value={state.armorClass}
                  onChange={setState}
                />
                <Dropdown
                  name='primaryAbility'
                  label='Primary Ability'
                  value={state.primaryAbility}
                  options={builders.ability}
                  onChange={setState}
                />
                {state.attribute?.some(
                  (attributeItem) => attributeItem.name === 'maxBonus'
                ) && (
                  <Input
                    validation='num'
                    name='maxBonus'
                    invalidText='Must contain only numbers'
                    label='Max Bonus'
                    required={true}
                    value={state.maxBonus}
                    onChange={setState}
                  />
                )}
                {state.attribute?.some(
                  (attributeItem) => attributeItem.name === 'hasRequirements'
                ) && (
                  <Dropdown
                    multiSelect={true}
                    name='requirement.option'
                    label='Requirement'
                    value={state.requirement?.option}
                    options={builders.item.requirement}
                    required={true}
                    onChange={setState}
                  />
                )}
              </SimpleGrid>
            </>
          )}
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'hasRequirements'
          ) &&
            !state.requirement?.option?.every(
              (optionItem) => optionItem.name === 'notProficient'
            ) && (
              <>
              <Divider label={'Requirements'} />
                <SimpleGrid>
                  {state.requirement?.option?.some(
                    (optionItem) => optionItem.name === 'skillProficiency'
                  ) && (
                    <Dropdown
                      multiSelect={true}
                      name='requirement.skillProficiency.skill'
                      value={state.requirement?.skillProficiency?.skill}
                      label='Skill Proficiency'
                      options={builders.skill}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {state.requirement?.option?.some(
                    (optionItem) => optionItem.name === 'abilityScore'
                  ) && (
                    <>
                      <Dropdown
                        multiSelect={true}
                        name='requirement.abilityScore.ability'
                        value={state.requirement?.abilityScore?.ability}
                        label='Ability'
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        name='requirement.abilityScore.score'
                        value={state.requirement?.abilityScore?.score}
                        label='Ability Score'
                        required={true}
                        validation='num'
                        invalidText='Must contain only numbers'
                        onChange={setState}
                      />
                    </>
                  )}
                  {state.requirement?.option?.some(
                    (optionItem) => optionItem.name === 'size'
                  ) && (
                    <>
                      <Dropdown
                        multiSelect={true}
                        name='requirement.size'
                        value={state.requirement?.size}
                        label='Size'
                        options={builders.race.size}
                        required={true}
                        onChange={setState}
                      />
                    </>
                  )}
                </SimpleGrid>
                {state.requirement?.option?.some(
                  (optionItem) => optionItem.name === 'itemProficiency'
                ) && (
                  <>
                    <Divider label={'Item Proficiency'} />
                    <SimpleGrid>
                      <Dropdown
                        multiSelect={true}
                        name='requirement.itemProficiency.category'
                        value={state.requirement?.itemProficiency?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Dropdown
                        name='requirement.itemProficiency.itemType'
                        multiSelect={true}
                        label='Item type'
                        value={state.requirement?.itemProficiency?.itemType}
                        options={items.filter((item) =>
                          state.requirement.itemProficiency?.category?.length >
                          0
                            ? state.requirement.itemProficiency?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )}
                        onChange={setState}
                      />
                      <Dropdown
                        name='requirement.itemProficiency.property'
                        multiSelect={true}
                        label='Item Property'
                        value={state.requirement?.itemProficiency?.property}
                        options={[].concat(
                          ...items
                            .filter((item) =>
                              state.requirement.itemProficiency?.category
                                ?.length > 0
                                ? state.requirement.itemProficiency?.category?.some(
                                    (category) =>
                                      category.name === item.category.name
                                  )
                                : item
                            )
                            .filter((item) =>
                              state.requirement.itemProficiency?.itemType
                                ?.length > 0
                                ? state.requirement.itemProficiency?.itemType?.some(
                                    (type) => type.name === item.name
                                  )
                                : item
                            )
                            .map((item) => item.property)
                        )}
                        onChange={setState}
                      />
                    </SimpleGrid>
                  </>
                )}
                {state.requirement?.option?.some(
                  (optionItem) => optionItem.name === 'equipped'
                ) && (
                  <>
                    <Divider label={'Equipped'} />
                    <SimpleGrid>
                      <Input
                        name='requirement.equipped.numberEquipped'
                        value={state.requirement?.equipped?.numberEquipped}
                        label='Number Equipped'
                        onChange={setState}
                        validation='num'
                        invalidText={'Must contain only numbers'}
                      />
                      <Dropdown
                        multiSelect={true}
                        name='requirement.equipped.category'
                        value={state.requirement?.equipped?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name='requirement.equipped.itemType'
                        label='Item type'
                        value={state.requirement?.equipped?.itemType}
                        options={items.filter((item) =>
                          state.requirement.equipped?.category?.length > 0
                            ? state.requirement.equipped?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )}
                        onChange={setState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name='requirement.equipped.property'
                        label='Item Property'
                        value={state.requirement?.equipped?.property}
                        options={[].concat(
                          ...items
                            .filter((item) =>
                              state.requirement.equipped?.category?.length
                                ? state.requirement.equipped?.category?.some(
                                    (category) =>
                                      category.name === item.category.name
                                  )
                                : item
                            )
                            .filter((item) =>
                              state.requirement.equipped?.itemType?.length > 0
                                ? state.requirement.equipped?.itemType?.some(
                                    (type) => type.name === item.name
                                  )
                                : item
                            )
                            .map((item) => item.property)
                        )}
                        onChange={setState}
                      />
                    </SimpleGrid>
                  </>
                )}
                {state.requirement?.option?.some(
                  (optionItem) => optionItem.name === 'notEquipped'
                ) && (
                  <>
                    <Divider label={'Not Equipped'} />
                    <SimpleGrid>
                      <Dropdown
                        multiSelect={true}
                        name='requirement.notEquipped.category'
                        value={state.requirement?.notEquipped?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name='requirement.notEquipped.itemType'
                        label='Item type'
                        value={state.requirement?.notEquipped?.itemType}
                        options={items.filter((item) =>
                          state.requirement.notEquipped?.category?.length > 0
                            ? state.requirement.notEquipped?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )}
                        onChange={setState}
                      />
                      <Dropdown
                        multiSelect={true}
                        name='requirement.notEquipped.property'
                        label='Item Property'
                        value={state.requirement?.notEquipped?.property}
                        options={[].concat(
                          ...items
                            .filter((item) =>
                              state.requirement.notEquipped?.category?.length >
                              0
                                ? state.requirement.notEquipped?.category?.some(
                                    (category) =>
                                      category.name === item.category.name
                                  )
                                : item
                            )
                            .filter((item) =>
                              state.requirement.notEquipped?.itemType?.length >
                              0
                                ? state.requirement.notEquipped?.itemType?.some(
                                    (type) => type.name === item.name
                                  )
                                : item
                            )
                            .map((item) => item.property)
                        )}
                        onChange={setState}
                      />
                    </SimpleGrid>
                  </>
                )}
              </>
            )}
        </>
      ),
    },
    {
      name: 'features',
      content: (
        <>
          {state.feature?.length > 0 && (
            <DraggableTabs
              name='feature'
              tabState={state.feature?.map((featureItem, featureIndex) => {
                const level = true
                const stateName = `feature.${featureIndex}`
                return {
                  value:
                    featureItem.value == null || featureItem.value === ''
                      ? `Feature ${featureIndex + 1}`
                      : featureItem.value,
                  content: (
                    <FeatureContent
                      stateName={stateName}
                      featureItem={featureItem}
                      level={level}
                      setState={setState}
                      state={state}
                      context={'item'}
                    />
                  ),
                }
              })}
              state={state.feature}
              addRow={true}
              reorder={true}
              addButtonOptions={[{ name: 'feature', label: 'feature' }]}
              setState={setState}
            />
          )}
        </>
      ),
    },
    {
      name: 'contains',
      content: (
        <>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'containsItems'
          ) &&
            (!state?.contains ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: 'contains',
                  },
                },
              })
            ) : (
              <>
                <div className='section-content'>
                  <Table
                    name='contains'
                    rows={{
                      inputs: [
                        {
                          name: 'item',
                          size: 'col-5',
                          type: 'select',
                          options: items.filter((item) =>
                            state.containsFilter?.length > 0
                              ? state.containsFilter?.some(
                                  (category) =>
                                    category.name === item.category.name
                                )
                              : item
                          ),
                        },
                        {
                          name: 'quantity',
                          validation: 'num',
                          invalidText: 'Must be whole numbers only',
                          size: 'col-5',
                        },
                      ],
                      headers: [
                        {
                          value: 'Item',
                          readOnly: true,
                          size: 'col-5',
                        },
                        {
                          value: 'Quantity',
                          readOnly: true,
                          size: 'col-5',
                        },
                      ],
                    }}
                    value={state.contains}
                    addRow={true}
                    onChange={setState}
                  />
                </div>
              </>
            ))}
        </>
      ),
    },
  ]

  content = (
    <>
      <Flex
        direction={{ base: 'column', sm: 'row' }}
        justify={{ base: 'space-between' }}
      >
        <h3>Create a Class</h3>
        <Group justify='space-between' gap='xs'>
          <Button type='button' onClick={onSubmit}>
            Add
          </Button>
          <Button type='button' color='yellow' onClick={onReset}>
            Reset Form
          </Button>
          <Button type='button' color='gray' onClick={() => navigate(-1)}>
            Back
          </Button>
        </Group>
      </Flex>
      {successMessage && <h5 className='success-message'>{successMessage}</h5>}
      {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
      <form>
        <DraggableTabs
          id='main'
          addRow={false}
          tabState={mainTabContent
            .filter((contentItem) =>
              !state.attribute?.some(
                (attributeItem) => attributeItem.name === 'containsItems'
              )
                ? contentItem.name !== 'contains'
                : contentItem
            )
            .map((content) => ({
              value: startCase(content.name),
              name: content.name,
              content: content.content,
            }))}
        />
      </form>
    </>
  )
  return (
    <div className='main-container' id='main-container'>
      {content}
    </div>
  )
}
export default NewItemForm
