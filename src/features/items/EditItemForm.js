import { useState, useEffect, useReducer, useRef, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { startCase, isEqual } from 'lodash'
import {
  useAddNewItemMutation,
  useUpdateItemMutation,
  useGetItemsQuery,
  selectAllItems,
  selectItemById,
} from './itemsApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../spells/spellsApiSlice'
import { selectAllFeats, useGetFeatsQuery } from '../feats/featsApiSlice'
import { handleValidation } from '../../helpers/form'
import formReducer from '../../hooks/useReducer'
import Spinner from '../../components/Spinner'
import TabNavigation from '../../components/TabNavigation'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'

const EditItemForm = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const id = location.state.data
  const { data: builders, isFetching: isBuildersFetching } =
    useGetBuildersQuery('buildersList')

  const { spells, isFetching: isSpellsFetching } = useGetSpellsQuery(
    'spellsList',
    {
      selectFromResult: ({ data }) => ({
        spells: data && selectAllSpells(data),
      }),
    }
  )

  const { feats, isFetching: isFeatsFetching } = useGetFeatsQuery('featsList', {
    selectFromResult: ({ data }) => ({ feats: data && selectAllFeats(data) }),
  })

  const {
    items,
    item,
    isFetching: isItemsFetching,
  } = useGetItemsQuery('itemsList', {
    selectFromResult: ({ data }) => ({
      items: data && selectAllItems(data),
      item: data && selectItemById(data, id),
    }),
  })

  const [
    addNewItem,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewItemMutation()

  const [
    updateItem,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateItemMutation()

  const [oldState, setOldState] = useState(item)
  const [state, setState] = useReducer(formReducer, item)
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [match, setMatch] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const textRefs = useRef([])

  useEffect(() => {
    if (
      isSpellsFetching ||
      isBuildersFetching ||
      isFeatsFetching ||
      isItemsFetching
    ) {
      setIsLoadingData(true)
    } else {
      setIsLoadingData(false)
    }
  }, [isSpellsFetching, isBuildersFetching, isFeatsFetching, isItemsFetching])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Item added successfully!')
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
    }
    if (updateIsSuccess) {
      setSuccessMessage('Item updated successfully!')
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
    }
  }, [addIsSuccess, id, navigate, updateIsSuccess])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.data.message)
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
    if (updateIsError) {
      setErrorMessage(updateError.data.message)
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }, [addIsError, id, updateIsError, addError, updateError])

  useEffect(() => {
    document.addEventListener('keypress', () => {
      if (!!successMessage || !!errorMessage) {
        setSuccessMessage()
        setErrorMessage()
        handleValidation(true)
      }
    })
    return document.removeEventListener('keypress', () => {
      if (!!successMessage || !!errorMessage) {
        setSuccessMessage()
        setErrorMessage()
        handleValidation(true)
      }
    })
  })

  useEffect(() => {
    if (isEqual(oldState, state)) {
      setMatch(true)
    } else {
      setMatch(false)
    }
  }, [state, oldState])

  const addToTextRefs = (ref) => {
    if (ref && !textRefs.current.includes(ref)) {
      textRefs.current.push(ref)
    }
  }

  const onReset = () => {
    setState({
      type: 'reset',
      payload: { target: oldState },
    })
    setSuccessMessage()
    setErrorMessage()
    handleValidation(true)
    textRefs.current.forEach((textRef) => {
      textRef.revertState()
    })
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

  const onUpdate = async () => {
    const isValid = handleValidation()
    if (isValid) {
      if (match) {
        setErrorMessage('No changes made')
      } else {
        await updateItem(state)
        setOldState(state)
      }
    } else {
      setErrorMessage('Please fill out all required fields')
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }

  const onBackClick = () => {
    navigate(-1, {
      state: {
        data: id,
        background: location.state.previous.state.background,
        title: match ? state.value : oldState.value,
        context: 'itemCard',
        size: 'lg',
      },
    })
  }

  let content

  if (isLoadingData) {
    return (content = <Spinner />)
  }

  const damageTableInputs = (secondary) => {
    const inputArray = [
      {
        name: 'level',
        value: 'Level',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'col-md col-sm-2 col-3',
      },
      {
        name: 'diceCount',
        value: 'Dice Count',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'col-md col-sm-3 col-4',
      },
      {
        name: 'diceValue',
        value: 'Dice Value',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'col-md col-sm-3 col-4',
      },
      {
        name: 'bonusDamage',
        value: 'Bonus Damage',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'col-md col-sm-3 col-4',
      },
    ]
    if (secondary) {
      inputArray.push(
        {
          name: 'secDiceCount',
          value: 'Sec. Dice Count',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'col-md col-sm-3 col-4',
        },
        {
          name: 'secDiceValue',
          value: 'Sec. Dice Value',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'col-md col-sm-3 col-4',
        }
      )
    }
    return inputArray
  }

  const sectionTabContent = (feature, featureIndex) => {
    const tabContent = [
      {
        name: 'feat',
        content() {
          return feature[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                <Select
                  multiple={true}
                  name={`feature.${featureIndex}.${this.name}.${index}.setSelection`}
                  placeholder='Feat'
                  value={item?.setSelection}
                  options={feats}
                  required={true}
                  onChange={setState}
                />
              </div>
            </Fragment>
          ))
        },
      },
      {
        name: 'modifier',
        content() {
          return feature[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
                <Select
                  name={`feature.${featureIndex}.${this.name}.${index}.module`}
                  placeholder='Modifier Category'
                  value={item.module}
                  options={builders.modifier.module}
                  required={true}
                  onChange={setState}
                />
                {item.module?.name && (
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.modType`}
                    placeholder='Modifier Type'
                    value={item.modType}
                    options={builders.modifier.modType?.filter((modItem) =>
                      modItem.module.some(
                        (moduleItem) => moduleItem.id === item.module?.id
                      )
                    )}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.module?.name === 'limitUse' &&
                  item.modType?.name === 'useReset' && (
                    <>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.limitUse.resetsOn`}
                        placeholder='Reset Option'
                        value={item.limitUse?.resetsOn}
                        options={builders.feature.chargeReset}
                        required={true}
                        onChange={setState}
                      />
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.limitUse.feature`}
                        placeholder='Feature'
                        value={item.limitUse?.feature}
                        options={state?.feature}
                        required={true}
                        onChange={setState}
                      />
                    </>
                  )}
                {item.module?.name === 'ability' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.ability.setSelection`}
                    placeholder='Ability'
                    value={item.ability?.setSelection}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.module?.name === 'saveAbility' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.saveAbility.setSelection`}
                    placeholder='Save Ability'
                    value={item.saveAbility?.setSelection}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.module?.name === 'skill' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.skill.setSelection`}
                    placeholder='Skill'
                    value={item.skill?.setSelection}
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.module?.name === 'damageSave' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.damageSave.setSelection`}
                    placeholder='Damage'
                    value={item.damageSave?.setSelection}
                    options={builders.damage}
                    require={true}
                    onChange={setState}
                  />
                )}
                {item.module?.name === 'conditionSave' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.conditionSave.setSelection`}
                    placeholder='Condition'
                    value={item.conditionSave?.setSelection}
                    options={builders.condition}
                    required={true}
                    onChange={setState}
                  />
                )}
                {(item.modType?.name === 'bonus' ||
                  item.modType?.name === 'penalty') &&
                  item.modType?.name !== 'setValue' && (
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.method`}
                      placeholder='Method'
                      value={item.method}
                      options={builders.modifier.method.filter((methodItem) =>
                        methodItem.module?.some(
                          (moduleItem) => moduleItem.id === item.module?.id
                        )
                      )}
                      required={true}
                      onChange={setState}
                    />
                  )}
                {item.module?.name === 'condition' ? (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.condition.setSelection`}
                    placeholder='Condition Type'
                    value={item.condition?.setSelection}
                    options={builders.condition}
                    required={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'speed' ? (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.speed.setSelection`}
                    placeholder='Speed Type'
                    value={item.speed?.setSelection}
                    options={builders.speed}
                    required={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'passive' ? (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.speed.setSelection`}
                    value={item.passive?.setSelection}
                    placeholder='Passive Type'
                    options={builders.passive}
                    required={true}
                    onChange={setState}
                  />
                ) : (
                  item.module?.name === 'damage' && (
                    <Select
                      multiple={true}
                      name={`feature.${featureIndex}.${this.name}.${index}.damage.setSelection`}
                      placeholder='Damage Type'
                      options={builders.damage}
                      value={item.damage?.setSelection}
                      required={true}
                      onChange={setState}
                    />
                  )
                )}
                {item.method?.name === 'setValue' ||
                item.modType?.name === 'setValue' ? (
                  <>
                    <Input
                      validation={'num'}
                      name={`feature.${featureIndex}.${this.name}.${index}.method.setValue`}
                      placeholder='Set Value'
                      label={true}
                      invalidText='Must contain only numbers'
                      autoComplete='off'
                      required={true}
                      value={item.method?.setValue}
                      onChange={setState}
                    />
                  </>
                ) : item.method?.name === 'ability' ? (
                  <>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.method.ability`}
                      placeholder='Method Ability'
                      value={item.method.ability}
                      options={[].concat(builders.ability, [
                        {
                          name: 'spellAbility',
                          value: 'Spell Ability',
                        },
                      ])}
                      required={true}
                      onChange={setState}
                    />
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.multiplier`}
                      placeholder='Multiplier'
                      label={true}
                      invalidText='Must contain only whole numbers'
                      autoComplete='off'
                      value={item.multiplier}
                      onChange={setState}
                    />
                  </>
                ) : (
                  item.method?.name === 'skill' && (
                    <>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.method.skill`}
                        placeholder='Method Skill'
                        value={item.method.skill}
                        options={builders.skill}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        validation='num'
                        name={`feature.${featureIndex}.${this.name}.${index}.multiplier`}
                        placeholder='Multiplier'
                        label={true}
                        invalidText='Must contain only whole numbers'
                        autoComplete='off'
                        value={item.multiplier}
                        onChange={setState}
                      />
                    </>
                  )
                )}
                {(item.modType?.name === 'bonus' ||
                  item.modType?.name === 'setValue') &&
                  item.module?.name === 'ability' && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.maxValue`}
                      label={true}
                      placeholder='Max Value'
                      autoComplete='off'
                      value={item.maxValue}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
              </div>
              <div className='row'>
                {item.method?.name === 'addPerLevel' &&
                  (!item?.addPerLevel ? (
                    setState({
                      type: 'added',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.${this.name}.${index}.addPerLevel`,
                        },
                      },
                    })
                  ) : (
                    <Table
                      name={`feature.${featureIndex}.${this.name}.${index}.addPerLevel`}
                      inputs={[
                        {
                          name: 'level',
                          value: 'Level',
                          validation: 'num',
                          invalidText: 'Must be whole numbers only',
                          label: true,
                          size: 'col-5',
                        },
                        {
                          name: 'amount',
                          value: 'Level',
                          validation: 'num',
                          invalidText: 'Must be whole numbers only',
                          label: true,
                          size: 'col-5',
                        },
                      ]}
                      value={item.addPerLevel}
                      dynamic={true}
                      onChange={setState}
                    />
                  ))}
              </div>
            </Fragment>
          ))
        },
      },
      {
        name: 'proficiency',
        content() {
          return feature[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                <Select
                  name={`feature.${featureIndex}.${this.name}.${index}.area`}
                  placeholder='Proficiency Area'
                  value={item.area}
                  options={builders.proficiency.area}
                  required={true}
                  onChange={setState}
                />
                {item.area?.name === 'skill' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.skill.setSelection`}
                    value={item.skill?.setSelection}
                    placeholder='Skill'
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.area?.name === 'saveAbility' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.saveAbility.setSelection`}
                    value={item.saveAbility?.setSelection}
                    placeholder='Save Ability'
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'language' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.language.setSelection`}
                    placeholder='Language'
                    value={item.language?.setSelection}
                    options={builders.language}
                    required={true}
                    onChange={setState}
                  />
                )}
                {(item.area?.name === 'property' ||
                  item.area?.name === 'itemType') && (
                  <>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.category.setSelection`}
                      multiple={true}
                      placeholder='Item Category'
                      value={item.category?.setSelection}
                      options={builders.item.category}
                      onChange={setState}
                    />
                    {item.area?.name === 'property' && (
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.property`}
                        multiple={true}
                        placeholder='Item Property'
                        value={item.property?.setSelection}
                        options={[].concat(
                          ...builders.item.category
                            .filter((bCategoryItem) =>
                              item.category?.setSelection?.length > 0
                                ? item.category?.setSelection?.some(
                                    (categoryItem) =>
                                      bCategoryItem.name === categoryItem.name
                                  )
                                : bCategoryItem
                            )
                            .map((category) => category.property)
                        )}
                        onChange={setState}
                      />
                    )}
                    {item.area?.name === 'itemType' && (
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.itemType.setSelection`}
                        multiple={true}
                        placeholder='Item Type'
                        value={item.itemType?.setSelection}
                        options={items.filter((itemType) =>
                          item.category?.setSelection?.length > 0
                            ? item.category?.setSelection?.some(
                                (category) =>
                                  category.name === itemType.category.name
                              )
                            : itemType
                        )}
                        onChange={setState}
                      />
                    )}
                  </>
                )}
                <Select
                  name={`feature.${featureIndex}.${this.name}.${index}.level`}
                  placeholder='Proficiency Level'
                  value={item.level}
                  options={builders.proficiency.level}
                  required={true}
                  onChange={setState}
                />
              </div>
            </Fragment>
          ))
        },
      },
      {
        name: 'sense',
        content() {
          return feature[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                <Select
                  multiple={true}
                  name={`feature.${featureIndex}.${this.name}.${index}.setSelection`}
                  placeholder='Sense'
                  value={item?.setSelection}
                  options={builders.sense}
                  required={true}
                  onChange={setState}
                />
              </div>
            </Fragment>
          ))
        },
      },
      {
        name: 'spell',
        content() {
          return feature[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                <Select
                  multiple='true'
                  name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                  options={[].concat(
                    builders.feature.spell.attribute,
                    builders.feature.sectionAttribute
                  )}
                  placeholder='Spell Attributes'
                  value={item.attribute}
                  require={true}
                  onChange={setState}
                />
                <Select
                  multiple={true}
                  name={`feature.${featureIndex}.${this.name}.${index}.setSelection`}
                  placeholder='Spell'
                  value={item?.setSelection}
                  options={spells}
                  required={true}
                  onChange={setState}
                />
                {item.attribute?.some(
                  (attributeItem) => attributeItem.name === 'optionalAbility'
                ) && (
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.ability`}
                    placeholder='Ability'
                    value={item.ability}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
              </div>
            </Fragment>
          ))
        },
      },
      {
        name: 'equipment',
        content() {
          return feature[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                <Select
                  name={`feature.${featureIndex}.${this.name}.${index}.category.setSelection`}
                  multiple={true}
                  placeholder='Item Category'
                  value={item.category?.setSelection}
                  options={builders.item.category}
                  onChange={setState}
                />

                <Select
                  name={`feature.${featureIndex}.${this.name}.${index}.property.setSelection`}
                  multiple={true}
                  placeholder='Item Property'
                  value={item.property?.setSelection}
                  options={[].concat(
                    ...builders.item.category
                      .filter((bCategoryItem) =>
                        item.category?.setSelection?.length > 0
                          ? item.category?.setSelection?.some(
                              (categoryItem) =>
                                bCategoryItem.name === categoryItem.name
                            )
                          : bCategoryItem
                      )
                      .map((category) => category.property)
                  )}
                  onChange={setState}
                />
                <Select
                  name={`feature.${featureIndex}.${this.name}.${index}.itemType.setSelection`}
                  multiple={true}
                  placeholder='Item Type'
                  value={item.itemType?.setSelection}
                  options={items.filter((itemType) =>
                    item.category?.setSelection?.length > 0
                      ? item.category?.setSelection?.some(
                          (category) => category.name === itemType.category.name
                        )
                      : itemType
                  )}
                  onChange={setState}
                />
              </div>
            </Fragment>
          ))
        },
      },
    ]

    return tabContent
  }

  const featureTabContent = (featureItem, featureIndex) => (
    <Fragment key={featureIndex}>
      <div className='row justify-content-between pb-2'>
        <Input
          size='col-sm-3'
          name={`feature.${featureIndex}.value`}
          label={true}
          autoComplete='off'
          placeholder='Feature Name'
          value={featureItem.value}
          onChange={setState}
          clickable={false}
        />
        <div className='dropdown col-auto'>
          <button
            className='btn btn-secondary dropdown-toggle btn'
            type='button'
            data-bs-toggle='dropdown'
            aria-expanded='false'
          >
            Add...
          </button>
          <ul className='dropdown-menu'>
            {sectionTabContent(featureItem, featureIndex).map(
              (sectionItem, sectionIndex) => (
                <li key={sectionIndex} className='dropdown-item'>
                  <button
                    key={sectionIndex}
                    className='dropdown-item'
                    type='button'
                    name={`feature.${featureIndex}.${sectionItem.name}`}
                    onClick={(e) => setState({ type: 'added', payload: e })}
                  >
                    {`${startCase(sectionItem.name)}`}
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
      <TextEditor
        ref={addToTextRefs}
        className='pb-2'
        placeholder='Feature description'
        value={featureItem.desc}
        name={`feature.${featureIndex}.desc`}
        onChange={setState}
      />
      <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3'>
        <Select
          multiple={true}
          name={`feature.${featureIndex}.attribute`}
          options={builders.feature.attribute
            .filter(
              (attributeItem) =>
                attributeItem.name !== 'providesOptions' &&
                attributeItem.name !== 'optionGroups'
            )
            .filter((attributeItem) =>
              !featureItem.attribute?.some((item) => item.name === 'doesDamage')
                ? attributeItem.name !== 'secondaryDamage'
                : attributeItem
            )}
          placeholder='Feature Attributes'
          value={featureItem.attribute}
          onChange={setState}
        />
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitUse'
        ) && (
          <>
            <Select
              name={`feature.${featureIndex}.limitUse.limitBy`}
              placeholder='Limit By Option'
              value={featureItem.limitUse?.limitBy}
              options={builders.feature.chargeLimit}
              required={true}
              onChange={setState}
            />
            {featureItem.limitUse?.limitBy?.name === 'ability' ? (
              <>
                <Select
                  name='limitUse.ability'
                  placeholder='Ability'
                  value={state.limitUse?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name='limitUse.minValue'
                  autoComplete='off'
                  placeholder='Min. Value'
                  label={true}
                  value={state.limitUse?.minValue}
                  onChange={setState}
                />
              </>
            ) : featureItem.limitUse?.limitBy?.name === 'skill' ? (
              <Select
                name={`feature.${featureIndex}.limitUse.skill`}
                placeholder='Skill'
                value={featureItem.limitUse?.skill}
                options={builders.skill}
                required={true}
                onChange={setState}
              />
            ) : (
              featureItem.limitUse?.limitBy?.name === 'setNumber' && (
                <Input
                  validation={'num'}
                  name={`feature.${featureIndex}.limitUse.setSelectionAmount`}
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Use Amount'
                  required={true}
                  value={featureItem.limitUse?.setSelectionAmount}
                  onChange={setState}
                />
              )
            )}
            <Select
              name={`feature.${featureIndex}.limitUse.resetsOn`}
              placeholder='Reset Option'
              value={featureItem.limitUse?.resetsOn}
              options={builders.feature.chargeReset}
              required={true}
              onChange={setState}
            />
          </>
        )}
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'isAction'
        ) && (
          <>
            <div className='col-sm'>
              <Select
                name={`feature.${featureIndex}.action`}
                placeholder='Action Type'
                value={featureItem.action}
                options={builders.feature.action}
                required={true}
                onChange={setState}
              />
            </div>
          </>
        )}
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'hasRange'
        ) && (
          <>
            <Input
              validation={'num'}
              name={`feature.${featureIndex}.range.minRange`}
              autoComplete='off'
              label={true}
              placeholder='Min Range'
              required={true}
              invalidText='Must contain only numbers'
              value={featureItem.range.minRange}
              onChange={setState}
            />
            <Input
              validation={'num'}
              name={`feature.${featureIndex}.range.maxRange`}
              label={true}
              autoComplete='off'
              placeholder='Max Range'
              required={true}
              invalidText='Must contain only numbers'
              value={featureItem.range.maxRange}
              onChange={setState}
            />
          </>
        )}
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'requireSave'
        ) && (
          <>
            <Select
              name={`feature.${featureIndex}.saveAbility.attribute`}
              multiple={true}
              placeholder='Save Attribute'
              value={featureItem.saveAbility?.attribute}
              options={builders.feature.saveAttribute}
              onChange={setState}
            />
            <Select
              name={`feature.${featureIndex}.saveAbility.ability`}
              placeholder='DC Ability'
              value={featureItem.saveAbility?.ability}
              options={builders.ability}
              required={true}
              onChange={setState}
            />
            <Input
              validation='num'
              name={`feature.${featureIndex}.saveAbility.minValue`}
              label={true}
              autoComplete='off'
              placeholder='Min. Value'
              required={true}
              invalidText='Must contain only numbers'
              value={featureItem.saveAbility?.minValue}
              onChange={setState}
            />
            {featureItem.saveAbility?.attribute?.some(
              (attributeItem) => attributeItem.name === 'addAbilityModifier'
            ) && (
              <Select
                name={`feature.${featureIndex}.saveAbility.abilityModifier`}
                placeholder='Modifier Ability'
                value={featureItem.saveAbility?.abilityModifier}
                options={builders.ability}
                required={true}
                onChange={setState}
              />
            )}
          </>
        )}
        {featureItem.attribute?.some(
          (attributItem) => attributItem.name === 'hasRequirements'
        ) && (
          <Select
            multiple={true}
            name={`feature.${featureIndex}.requirement.option`}
            placeholder='Requirement'
            value={featureItem.requirement?.option}
            options={[].concat(
              builders.feature.requirement,
              builders.feature.item.requirement
            )}
            required={true}
            onChange={setState}
          />
        )}
      </div>
      {featureItem.attribute?.some(
        (attributItem) => attributItem.name === 'hasRequirements'
      ) &&
        !featureItem.requirement?.option?.every(
          (optionItem) => optionItem.name === 'notProficient'
        ) && (
          <>
            <div className='d-flex'>
              <hr className='flex-grow-1 me-3' />
              <span className='mx-auto'>Requirements</span>
              <hr className='flex-grow-1 ms-3' />
            </div>
            <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
              {featureItem.requirement?.option?.some(
                (optionItem) => optionItem.name === 'skillProficiency'
              ) && (
                <Select
                  multiple={true}
                  name={`feature.${featureIndex}.requirement.skillProficiency.skill`}
                  value={featureItem.requirement?.skillProficiency?.skill}
                  placeholder='Skill Proficiency'
                  options={builders.skill}
                  required={true}
                  onChange={setState}
                />
              )}
              {featureItem.requirement?.option?.some(
                (optionItem) => optionItem.name === 'abilityScore'
              ) && (
                <>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.abilityScore.ability`}
                    value={featureItem.requirement?.abilityScore?.ability}
                    placeholder='Ability'
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                  <Input
                    name={`feature.${featureIndex}.requirement.abilityScore.score`}
                    value={featureItem.requirement?.abilityScore?.score}
                    placeholder='Ability Score'
                    required={true}
                    label={true}
                    validation='num'
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                </>
              )}
              {featureItem.requirement?.option?.some(
                (optionItem) => optionItem.name === 'size'
              ) && (
                <>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.size`}
                    value={featureItem.requirement?.size}
                    placeholder='Size'
                    options={builders.race.size}
                    required={true}
                    onChange={setState}
                  />
                </>
              )}
            </div>
            {featureItem.requirement?.option?.some(
              (optionItem) => optionItem.name === 'itemProficiency'
            ) && (
              <>
                <div className='d-flex mx-3'>
                  <hr className='flex-grow-1 me-3' />
                  <span className='mx-auto'>Item Proficiency</span>
                  <hr className='flex-grow-1 ms-3' />
                </div>
                <div className='row g-2 pb-3 mx-3 justify-contents-center'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.itemProficiency.category`}
                    value={featureItem.requirement?.itemProficiency?.category}
                    placeholder='Item Category'
                    options={builders.item.category}
                    onChange={setState}
                  />
                  <Select
                    name={`feature.${featureIndex}.requirement.itemProficiency.property`}
                    multiple={true}
                    placeholder='Item Property'
                    value={featureItem.requirement?.itemProficiency?.property}
                    options={[].concat(
                      ...items
                        .filter((item) =>
                          featureItem.requirement?.itemProficiency?.category
                            ?.length > 0
                            ? featureItem.requirement?.itemProficiency?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .filter((item) =>
                          featureItem.requirement?.itemProficiency?.itemType
                            ?.length > 0
                            ? featureItem.requirement?.itemProficiency?.itemType?.some(
                                (type) => type.name === item.name
                              )
                            : item
                        )
                        .map((item) => item.property)
                    )}
                    onChange={setState}
                  />
                  <Select
                    name={`feature.${featureIndex}.requirement.itemProficiency.itemType`}
                    multiple={true}
                    placeholder='Item type'
                    value={featureItem.requirement?.itemProficiency?.itemType}
                    options={items.filter((item) =>
                      featureItem.requirement.itemProficiency?.category
                        ?.length > 0
                        ? featureItem.requirement.itemProficiency?.category?.some(
                            (category) => category.name === item.category.name
                          )
                        : item
                    )}
                    onChange={setState}
                  />
                </div>
              </>
            )}
            {featureItem.requirement?.option?.some(
              (optionItem) => optionItem.name === 'equipped'
            ) && (
              <>
                <div className='d-flex mx-3'>
                  <hr className='flex-grow-1 me-3' />
                  <span className='mx-auto'>Equipped</span>
                  <hr className='flex-grow-1 ms-3' />
                </div>
                <div className='row g-2 pb-3 mx-3 justify-contents-center'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.equipped.category`}
                    value={featureItem.requirement?.equipped?.category}
                    placeholder='Item Category'
                    options={builders.item.category}
                    onChange={setState}
                  />
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.equipped.property`}
                    placeholder='Item Property'
                    value={featureItem.requirement?.equipped?.property}
                    options={[].concat(
                      ...items
                        .filter((item) =>
                          featureItem.requirement?.equipped?.category?.length >
                          0
                            ? featureItem.requirement?.equipped?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .map((item) => item.property)
                    )}
                    onChange={setState}
                  />
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.equipped.itemType`}
                    placeholder='Item type'
                    value={featureItem.requirement?.equipped?.itemType}
                    options={items.filter((item) =>
                      featureItem.requirement.equipped?.category?.length > 0
                        ? featureItem.requirement.equipped?.category?.some(
                            (category) => category.name === item.category.name
                          )
                        : item
                    )}
                    onChange={setState}
                  />
                </div>
              </>
            )}
            {featureItem.requirement?.option?.some(
              (optionItem) => optionItem.name === 'notEquipped'
            ) && (
              <>
                <div className='d-flex mx-3'>
                  <hr className='flex-grow-1 me-3' />
                  <span className='mx-auto'>Not Equipped</span>
                  <hr className='flex-grow-1 ms-3' />
                </div>
                <div className='row g-2 pb-3 mx-3 justify-contents-center'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.notEquipped.category`}
                    value={featureItem.requirement?.notEquipped?.category}
                    placeholder='Item Category'
                    options={builders.item.category}
                    onChange={setState}
                  />
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.notEquipped.property`}
                    value={featureItem.requirement?.notEquipped?.property}
                    placeholder='Item Property'
                    options={[].concat(
                      ...items
                        .filter((item) =>
                          featureItem.requirement.notEquipped?.category
                            ?.length > 0
                            ? featureItem.requirement.notEquipped?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .map((item) => item.property)
                    )}
                    onChange={setState}
                  />
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.notEquipped.itemType`}
                    placeholder='Item type'
                    value={featureItem.requirement?.notEquipped?.itemType}
                    options={items.filter((item) =>
                      featureItem.requirement.notEquipped?.category?.length > 0
                        ? featureItem.requirement.notEquipped?.category?.some(
                            (category) => category.name === item.category.name
                          )
                        : item
                    )}
                    onChange={setState}
                  />
                </div>
              </>
            )}
          </>
        )}
      {featureItem.limitUse?.limitBy?.name === 'level' &&
        featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitUse'
        ) &&
        (!featureItem.limitUse.level ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: `feature.${featureIndex}.limitUse.level`,
              },
            },
          })
        ) : (
          <>
            <div
              className='btn btn-section-collapse justify-content-between align-items-center'
              id='sectionCollapseButton'
              type='button'
              role='button'
              data-bs-toggle='collapse'
              data-bs-target={`#limitUse${featureIndex}Collapse`}
              aria-controls='collapseExample'
              aria-expanded='true'
            >
              <span className='me-3'>Limit Use Table</span>
              <i className='bi bi-arrow-down-up' />
            </div>
            <div
              className='section-container collapse show'
              id={`limitUse${featureIndex}Collapse`}
            >
              <div className='section-content'>
                <Table
                  className='pb-2'
                  inputs={[
                    {
                      name: 'value',
                      value: 'Level',
                      invalid: 'Must contain only numbers',
                      validation: 'num',
                      label: true,
                      size: 'col-5',
                    },
                    {
                      name: 'useNum',
                      value: 'Uses',
                      invalid: 'Must contain only numbers',
                      validation: 'num',
                      label: true,
                      size: 'col-5',
                    },
                  ]}
                  name={`feature.${featureIndex}.limitUse.level`}
                  value={featureItem.limitUse?.level}
                  onChange={setState}
                  dynamic={true}
                />
              </div>
            </div>
          </>
        ))}
      {featureItem.attribute?.some(
        (attributeItem) => attributeItem.name === 'doesDamage'
      ) ? (
        !featureItem.damage?.diceByLevel ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: `feature.${featureIndex}.damage.diceByLevel`,
              },
            },
          })
        ) : (
          <>
            <div className='row g-2 align-items-end pb-2'>
              <Select
                multiple={true}
                name={`feature.${featureIndex}.damage.damageAttribute`}
                value={featureItem.damage.damageAttribute}
                placeholder='Damage Attribute'
                options={builders.feature.damageAttribute}
                required={true}
                onChange={setState}
              />
              <Select
                name={`feature.${featureIndex}.damage.damageType`}
                placeholder='Damage Type'
                value={featureItem.damage.damageType}
                options={builders.damage}
                required={true}
                onChange={setState}
              />
            </div>
            <div
              className='btn btn-section-collapse justify-content-between align-items-center'
              id='sectionCollapseButton'
              type='button'
              role='button'
              data-bs-toggle='collapse'
              data-bs-target={`#section${featureIndex}Collapse`}
              aria-controls='collapseExample'
              aria-expanded='true'
            >
              <span className='me-3'>Damage Table</span>
              <i className='bi bi-arrow-down-up' />
            </div>
            <div
              className='section-container collapse show'
              id={`section${featureIndex}Collapse`}
            >
              <div className='section-content'>
                <Table
                  inputs={damageTableInputs(
                    featureItem.attribute?.some(
                      (attributeItem) =>
                        attributeItem.name === 'secondaryDamage'
                    )
                  )}
                  className={`row-cols-sm-${
                    damageTableInputs(
                      featureItem.attribute?.some(
                        (attributeItem) =>
                          attributeItem.name === 'secondaryDamage'
                      )
                    ).length + 1
                  }`}
                  name={`feature.${featureIndex}.damage.diceByLevel`}
                  value={featureItem.damage?.diceByLevel}
                  onChange={setState}
                  dynamic={true}
                  scrollable={true}
                />
              </div>
            </div>
          </>
        )
      ) : (
        featureItem.damage != null &&
        Object.keys(featureItem.damage).length !== 0 &&
        setState({
          type: 'removed',
          payload: { target: { name: `feature.${featureIndex}.damage` } },
        })
      )}
      {Object.keys(featureItem)?.length !== 0 &&
        Object.keys(featureItem)?.some(
          (key) => featureItem[key]?.length !== 0
        ) && (
          <TabNavigation
            id={`section${featureIndex}`}
            tabState={[].concat(
              ...sectionTabContent(featureItem, featureIndex)
                .filter(
                  (sectionItem) => featureItem[sectionItem.name]?.length > 0
                )
                ?.map((sectionItem) =>
                  sectionItem.content().map((contentItem, contentIndex) => ({
                    value: `${sectionItem.name} ${contentIndex + 1}`,
                    name: `feature.${featureIndex}.${sectionItem.name}.${contentIndex}`,
                    content: contentItem,
                  }))
                )
            )}
            dynamic={true}
            onDelete={setState}
          />
        )}
    </Fragment>
  )

  const mainTabContent = [
    {
      name: 'details',
      content: (
        <>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
            <Input
              name='value'
              autoComplete='off'
              label={true}
              placeholder='Item Name'
              required={true}
              value={state.value}
              onChange={setState}
            />
            <Select
              name='category'
              placeholder='Item Category'
              value={state.category}
              options={builders.item.category}
              required={true}
              onChange={setState}
            />
            <Select
              name='property'
              multiple={true}
              placeholder='Properties'
              value={state.property}
              options={
                builders.item.category.find(
                  (category) => category._id === state.category?.id
                )?.property
              }
              onChange={setState}
            />
            <Select
              name='rarity'
              placeholder='Rarity'
              value={state.rarity}
              options={builders.item.rarity}
              required={true}
              onChange={setState}
            />
            <Input
              validation={'cur'}
              name='cost.amount'
              autoComplete='off'
              label={true}
              placeholder='Cost'
              required={true}
              invalidText='Must contain only decimal amounts'
              value={state.cost?.amount}
              onChange={setState}
            />
            <Select
              name='cost.currency'
              placeholder='Currency'
              value={state.cost?.currency}
              options={builders.currency}
              optionalKey='short'
              required={true}
              onChange={setState}
            />
            <Input
              validation={'cur'}
              name='weight.amount'
              label={true}
              invalidText='Must contain only numbers'
              placeholder='Item Weight'
              autoComplete='off'
              required={true}
              value={state.weight?.amount}
              onChange={setState}
            />
            <Select
              name='weight.unit'
              placeholder='UoM'
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
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Item Speed'
                    autoComplete='off'
                    required={true}
                    value={state.speed?.amount}
                    onChange={setState}
                  />
                  <Select
                    name='speed.unit'
                    placeholder='UoM'
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
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Item Rank'
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
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Capacity Amount'
                    autoComplete='off'
                    value={state.capacity?.amount}
                    onChange={setState}
                  />
                  <Select
                    name='capacity.unit'
                    placeholder='UoM'
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
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Min Range'
                  value={state?.minRange}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='maxRange'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Max Range'
                  value={state?.maxRange}
                  required={true}
                  onChange={setState}
                />
              </>
            )}
            <Input
              validation={'num'}
              name='quantity'
              label={true}
              invalidText='Must contain only numbers'
              placeholder='Quantity'
              autoComplete='off'
              value={state.quantity}
              onChange={setState}
            />
          </div>
          <TextEditor
            ref={addToTextRefs}
            onChange={setState}
            value={state.desc}
            placeholder={'Item Description'}
            name={'desc'}
          />
          <TextEditor
            ref={addToTextRefs}
            onChange={setState}
            value={state.quote}
            placeholder={'Item Quote'}
            name={'quote'}
          />
        </>
      ),
    },
    {
      name: 'attributes',
      content: (
        <>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
            <div className='col-sm'>
              <Select
                name='attribute'
                multiple={true}
                placeholder='Attributes'
                value={state.attribute}
                options={builders.item.attribute.filter((attributeItem) =>
                  state.category?.name === 'armor' ||
                  state.category?.name === 'weapon'
                    ? attributeItem
                    : attributeItem.name !== 'maxBonus'
                )}
                required={true}
                onChange={setState}
              />
            </div>
            {state?.attribute?.some(
              (attributeItem) => attributeItem.name === 'stackable'
            ) && (
              <Input
                validation={'num'}
                type='text'
                name='maxStack'
                label={true}
                invalidText='Must contain only numbers'
                placeholder='Max Stack Size'
                autoComplete='off'
                value={state.maxStack}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'requireSave'
            ) && (
              <>
                <Select
                  name='saveAbility.ability'
                  placeholder='DC Ability'
                  value={state.saveAbility?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='saveAbility.minValue'
                  label={true}
                  autoComplete='off'
                  placeholder='Min. Value'
                  required={true}
                  invalidText='Must contain only numbers'
                  value={state.saveAbility?.minValue}
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributItem) => attributItem.name === 'hasRequirements'
            ) && (
              <Select
                multiple={true}
                name='requirement.option'
                placeholder='Requirement'
                value={state.requirement?.option}
                options={[].concat(
                  builders.feature.requirement,
                  builders.feature.item.requirement
                )}
                required={true}
                onChange={setState}
              />
            )}
          </div>
          {(state.category?.name === 'weapon' ||
            state.attribute?.some(
              (attributeItem) => attributeItem.name === 'doesDamage'
            ) ||
            state.property?.some(
              (propertyItem) => propertyItem.name === 'improvisedWeapon'
            )) &&
          state.property.some((propertyItem) => propertyItem !== 'special') ? (
            <>
              <div className='d-flex'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>{`${
                  state.category?.name === 'weapon' ? 'Weapon ' : ''
                }Damage Dice`}</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <div className='row g-2 pb-3 mx-3 justify-contents-center'>
                <Input
                  validation={'num'}
                  name='damage.dice.diceCount'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Damage Dice Count'
                  value={state.damage?.dice?.diceCount}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation={'num'}
                  name='damage.dice.diceValue'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Damage Dice Value'
                  value={state.damage?.dice?.diceValue}
                  required={true}
                  onChange={setState}
                />
                {state.property?.some(
                  (property) => property.name === 'versatile'
                ) && (
                  <>
                    <Input
                      validation={'num'}
                      name='damage.dice.versatileDiceCount'
                      label={true}
                      invalidText='Must contain only numbers'
                      placeholder='Alt. Dmg. Dice Count'
                      value={state.damage?.dice?.versatileDiceCount}
                      required={true}
                      onChange={setState}
                    />
                    <Input
                      validation={'num'}
                      name='damage.dice.versatileDiceValue'
                      label={true}
                      invalidText='Must contain only numbers'
                      placeholder='Alt. Dmg. Dice Value'
                      value={state.damage?.dice?.versatileDiceValue}
                      required={true}
                      onChange={setState}
                    />
                  </>
                )}
                {state.category?.name !== 'weapon' && (
                  <Input
                    validation={'num'}
                    name='damage.bonusDamage'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Bonus Damage'
                    value={state.damage?.bonusDamage}
                    required={true}
                    onChange={setState}
                  />
                )}
                <Select
                  name='damage.damageType'
                  multiple={true}
                  placeholder='Damage Type'
                  value={state.damage?.damageType}
                  options={builders.damage}
                  required={true}
                  onChange={setState}
                />
                {(state.category?.name === 'weapon' ||
                  state.property?.some(
                    (propertyItem) => propertyItem.name === 'improvisedWeapon'
                  )) && (
                  <Select
                    name='primaryAbility'
                    placeholder='Primary Ability'
                    value={state.primaryAbility}
                    options={[].concat(builders.ability, [
                      {
                        name: 'spellAbility',
                        value: 'Spell Ability',
                      },
                    ])}
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
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Max Bonus'
                    required={true}
                    value={state.maxBonus}
                    onChange={setState}
                  />
                )}
                {state?.property?.some(
                  (property) => property.name === 'finesse'
                ) && (
                  <Select
                    name={'secondaryAbility'}
                    placeholder='Secondary Ability'
                    value={state.secondaryAbility}
                    required={true}
                    options={[]
                      .concat(builders.ability, [
                        {
                          name: 'spellAbility',
                          value: 'Spell Ability',
                        },
                      ])
                      ?.filter(
                        (abilityItem) =>
                          abilityItem?.name !== state?.primaryAbility?.name
                      )}
                    onChange={setState}
                  />
                )}
              </div>
            </>
          ) : (
            state.damage != null &&
            Object.keys(state.damage).length !== 0 &&
            setState({
              type: 'removed',
              payload: { target: { name: 'damage' } },
            })
          )}
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
                <div
                  className='btn btn-section-collapse justify-content-between align-items-center'
                  id='sectionCollapseButton'
                  type='button'
                  role='button'
                  data-bs-toggle='collapse'
                  data-bs-target={`#containsCollapse`}
                  aria-controls='collapseExample'
                  aria-expanded='true'
                >
                  <span className='me-3'>Container's Items</span>
                  <i className='bi bi-arrow-down-up' />
                </div>
                <div
                  className='section-container collapse show'
                  id='containsCollapse'
                >
                  <div className='section-content'>
                    <Table
                      name='contains'
                      inputs={[
                        {
                          name: 'item',
                          value: 'Item',
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
                          value: 'Quantity',
                          validation: 'num',
                          invalidText: 'Must be whole numbers only',
                          label: true,
                          size: 'col-5',
                        },
                      ]}
                      value={state.contains}
                      dynamic={true}
                      onChange={setState}
                    />
                  </div>
                </div>
              </>
            ))}
          {state.category?.name === 'armor' && (
            <>
              <div className='d-flex'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>Armor Stats</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <div className='row g-2 pb-3 mx-3 justify-contents-center'>
                <Input
                  validation={'num'}
                  name='armorClass'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Armor Value'
                  required={true}
                  value={state.armorClass}
                  onChange={setState}
                />
                <Select
                  name='primaryAbility'
                  placeholder='Primary Ability'
                  value={state.primaryAbility}
                  options={[].concat(builders.ability, [
                    {
                      name: 'spellAbility',
                      value: 'Spell Ability',
                    },
                  ])}
                  onChange={setState}
                />
                {state.attribute?.some(
                  (attributeItem) => attributeItem.name === 'maxBonus'
                ) && (
                  <Input
                    validation='num'
                    name='maxBonus'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Max Bonus'
                    required={true}
                    value={state.maxBonus}
                    onChange={setState}
                  />
                )}
                {state.attribute?.some(
                  (attributeItem) => attributeItem.name === 'hasRequirements'
                ) && (
                  <Select
                    multiple={true}
                    name='requirement.option'
                    placeholder='Requirement'
                    value={state.requirement?.option}
                    options={builders.item.requirement}
                    required={true}
                    onChange={setState}
                  />
                )}
              </div>
            </>
          )}
          {state.attribute?.some(
            (attributItem) => attributItem.name === 'hasRequirements'
          ) &&
            !state.requirement?.option?.every(
              (optionItem) => optionItem.name === 'notProficient'
            ) && (
              <>
                <div className='d-flex'>
                  <hr className='flex-grow-1 me-3' />
                  <span className='mx-auto'>Requirements</span>
                  <hr className='flex-grow-1 ms-3' />
                </div>
                <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
                  {state.requirement?.option?.some(
                    (optionItem) => optionItem.name === 'skillProficiency'
                  ) && (
                    <Select
                      multiple={true}
                      name='requirement.skillProficiency.skill'
                      value={state.requirement?.skillProficiency?.skill}
                      placeholder='Skill Proficiency'
                      options={builders.skill}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {state.requirement?.option?.some(
                    (optionItem) => optionItem.name === 'abilityScore'
                  ) && (
                    <>
                      <Select
                        multiple={true}
                        name='requirement.abilityScore.ability'
                        value={state.requirement?.abilityScore?.ability}
                        placeholder='Ability'
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        name='requirement.abilityScore.score'
                        value={state.requirement?.abilityScore?.score}
                        placeholder='Ability Score'
                        required={true}
                        label={true}
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
                      <Select
                        multiple={true}
                        name='requirement.size'
                        value={state.requirement?.size}
                        placeholder='Size'
                        options={builders.race.size}
                        required={true}
                        onChange={setState}
                      />
                    </>
                  )}
                </div>
                {state.requirement?.option?.some(
                  (optionItem) => optionItem.name === 'itemProficiency'
                ) && (
                  <>
                    <div className='d-flex mx-3'>
                      <hr className='flex-grow-1 me-3' />
                      <span className='mx-auto'>Item Proficiency</span>
                      <hr className='flex-grow-1 ms-3' />
                    </div>
                    <div className='row g-2 pb-3 mx-3 justify-contents-center'>
                      <Select
                        multiple={true}
                        name='requirement.itemProficiency.category'
                        value={state.requirement?.itemProficiency?.category}
                        placeholder='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Select
                        name='requirement.itemProficiency.itemType'
                        multiple={true}
                        placeholder='Item type'
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
                      <Select
                        name='requirement.itemProficiency.property'
                        multiple={true}
                        placeholder='Item Property'
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
                    </div>
                  </>
                )}
                {state.requirement?.option?.some(
                  (optionItem) => optionItem.name === 'equipped'
                ) && (
                  <>
                    <div className='d-flex mx-3'>
                      <hr className='flex-grow-1 me-3' />
                      <span className='mx-auto'>Equipped</span>
                      <hr className='flex-grow-1 ms-3' />
                    </div>
                    <div className='row g-2 pb-3 mx-3 justify-contents-center'>
                      <Select
                        multiple={true}
                        name='requirement.equipped.category'
                        value={state.requirement?.equipped?.category}
                        placeholder='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Select
                        multiple={true}
                        name='requirement.equipped.itemType'
                        placeholder='Item type'
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
                      <Select
                        multiple={true}
                        name='requirement.equipped.property'
                        placeholder='Item Property'
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
                    </div>
                  </>
                )}
                {state.requirement?.option?.some(
                  (optionItem) => optionItem.name === 'notEquipped'
                ) && (
                  <>
                    <div className='d-flex mx-3'>
                      <hr className='flex-grow-1 me-3' />
                      <span className='mx-auto'>Equipped</span>
                      <hr className='flex-grow-1 ms-3' />
                    </div>
                    <div className='row g-2 pb-3 mx-3 justify-contents-center'>
                      <Select
                        multiple={true}
                        name='requirement.notEquipped.category'
                        value={state.requirement?.notEquipped?.category}
                        placeholder='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Select
                        multiple={true}
                        name='requirement.notEquipped.itemType'
                        placeholder='Item type'
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
                      <Select
                        multiple={true}
                        name='requirement.notEquipped.property'
                        placeholder='Item Property'
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
                    </div>
                  </>
                )}
              </>
            )}
        </>
      ),
    },
  ]

  content = (
    <>
      <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
        <div className='col-auto'>
          <h3>Edit an Item</h3>
        </div>
        <div className='col-auto d-flex justify-content-end'>
          <button
            className='btn btn-success me-2'
            type='button'
            onClick={() => {
              onUpdate()
            }}
          >
            Update
          </button>
          <button
            className='btn btn-primary me-2'
            type='button'
            onClick={() => {
              onSubmit()
            }}
          >
            Add
          </button>
          <button className='btn btn-warning me-2' onClick={onReset}>
            Reset Form
          </button>
          <button className='btn btn-secondary' onClick={onBackClick}>
            Back
          </button>
        </div>
      </div>
      {successMessage && <h5 className='success-message'>{successMessage}</h5>}
      {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
      <form>
        <TabNavigation
          id='main'
          dynamic={false}
          tabState={mainTabContent.map((content) => ({
            value: content.name,
            name: content.name,
            content: content.content,
          }))}
        />
        <TabNavigation
          id='feature'
          tabState={
            state.feature?.length > 0 &&
            state.feature?.map((featureItem, featureIndex) => ({
              value:
                featureItem.name == null || featureItem.name === ''
                  ? `feature ${featureIndex + 1}`
                  : featureItem.name,
              name: `feature.${featureIndex}`,
              content: featureTabContent(featureItem, featureIndex),
            }))
          }
          onDelete={setState}
          onAdd={setState}
          dynamic={true}
        />
      </form>
    </>
  )
  return <div className='main-container'>{content}</div>
}
export default EditItemForm
