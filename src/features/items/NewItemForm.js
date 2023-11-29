import { useState, useEffect, useReducer, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAddNewItemMutation,
  useGetItemsQuery,
  selectAllItems,
} from './itemsApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../spells/spellsApiSlice'
import { selectAllFeats, useGetFeatsQuery } from '../feats/featsApiSlice'
import {
  selectAllClasses,
  useGetClassesQuery,
} from '../classes/classesApiSlice'
import { startCase } from 'lodash'
import { handleValidation } from '../../helpers/form'
import { useSelector } from 'react-redux'
import { selectLoadingStatus } from '../../app/loadingSlice'
import formReducer from '../../hooks/useReducer'
import TabNavigation from '../../components/TabNavigation'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import Spinner from '../../components/Spinner'

const NewItemForm = () => {
  const navigate = useNavigate()

  const isLoading = useSelector(selectLoadingStatus)

  const { data: builders } = useGetBuildersQuery('buildersList')

  const { classes } = useGetClassesQuery('classesList', {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  const { spells } = useGetSpellsQuery('spellsList', {
    selectFromResult: ({ data }) => ({
      spells: data && selectAllSpells(data),
    }),
  })

  const { feats } = useGetFeatsQuery('featsList', {
    selectFromResult: ({ data }) => ({ feats: data && selectAllFeats(data) }),
  })

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
  const textRefs = useRef([])

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
    textRefs.current.forEach((textRef) => {
      textRef.resetState('')
    })
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

  const addToTextRefs = (ref) => {
    if (ref && !textRefs.current.includes(ref)) {
      textRefs.current.push(ref)
    }
  }

  const onReset = () => {
    setState({
      type: 'reset',
      payload: { target: {} },
    })
    setSuccessMessage()
    setErrorMessage()
    handleValidation(true)
    textRefs.current.forEach((textRef) => {
      textRef.resetState('')
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

  let content

  if (isLoading) {
    return (content = <Spinner />)
  }

  const damageTableColumns = (state) => {
    const secondary = state?.damageAttribute?.some(
      (attributeItem) => attributeItem.name === 'secondaryDamage'
    )
    const bonus =
      state?.damageAttribute?.some(
        (attributeItem) => attributeItem.name === 'bonusDamage'
      ) && state?.bonus?.bonusAttribute?.name === 'setValue'
    const inputArray = [
      {
        name: 'level',
        value: 'Level',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: 'col',
      },
      {
        name: 'diceCount',
        value: 'Dice Count',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: 'col',
      },
      {
        name: 'diceValue',
        value: 'Dice Value',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: 'col',
      },
    ]
    if (secondary) {
      inputArray.splice(
        3,
        0,
        {
          name: 'secDiceCount',
          value: 'Sec. Dice Count',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
        {
          name: 'secDiceValue',
          value: 'Sec. Dice Value',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        }
      )
    }
    if (bonus) {
      inputArray.push({
        name: 'bonusDamage',
        value: 'Bonus Damage',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: 'col',
      })
    }

    const headerArray = inputArray.map((inputItem) => ({
      value: inputItem.value,
      readOnly: true,
      size: inputItem.value.size,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  const sectionTabContent = (featureItem, featureIndex) => {
    const tabContent = [
      {
        name: 'feat',
        content() {
          return featureItem[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                <Select
                  multiple={true}
                  name={`feature.${featureIndex}.${this.name}.${index}.feat`}
                  label='Feat'
                  value={item?.feat}
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
          return featureItem[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
                <Select
                  name={`feature.${featureIndex}.${this.name}.${index}.module`}
                  label='Modifier Category'
                  value={item.module}
                  options={builders.modifier.module}
                  required={true}
                  onChange={setState}
                />
                {item.module?.name && (
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.modType`}
                    label='Modifier Type'
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
                        label='Reset Option'
                        value={item.limitUse?.resetsOn}
                        options={builders.feature.chargeReset}
                        required={true}
                        onChange={setState}
                      />
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.limitUse.feature`}
                        label='Feature'
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
                    name={`feature.${featureIndex}.${this.name}.${index}.ability`}
                    label='Ability'
                    value={item.ability}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.module?.name === 'saveAbility' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.saveAbility`}
                    label='Save Ability'
                    value={item.saveAbility}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.module?.name === 'skill' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.skill`}
                    label='Skill'
                    value={item.skill}
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.module?.name === 'damageSave' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.damageSave`}
                    label='Damage'
                    value={item.damageSave}
                    options={builders.damage}
                    require={true}
                    onChange={setState}
                  />
                )}
                {item.module?.name === 'conditionSave' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.conditionSave`}
                    label='Condition'
                    value={item.conditionSave}
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
                      label='Method'
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
                    name={`feature.${featureIndex}.${this.name}.${index}.condition`}
                    label='Condition Type'
                    value={item.condition}
                    options={builders.condition}
                    required={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'speed' ? (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                    label='Speed Type'
                    value={item.speed}
                    options={builders.speed}
                    required={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'passive' ? (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                    value={item.passive}
                    label='Passive Type'
                    options={builders.passive}
                    required={true}
                    onChange={setState}
                  />
                ) : (
                  item.module?.name === 'damage' && (
                    <Select
                      multiple={true}
                      name={`feature.${featureIndex}.${this.name}.${index}.damage`}
                      label='Damage Type'
                      options={builders.damage}
                      value={item.damage}
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
                      label='Set Value'
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
                      label='Method Ability'
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
                      label='Multiplier'
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
                        label='Method Skill'
                        value={item.method.skill}
                        options={builders.skill}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        validation='num'
                        name={`feature.${featureIndex}.${this.name}.${index}.multiplier`}
                        label='Multiplier'
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
                      label='Max Value'
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
                      rows={{
                        inputs: [
                          {
                            name: 'level',
                            validation: 'num',
                            invalidText: 'Must be whole numbers only',
                            size: 'col-5',
                          },
                          {
                            name: 'amount',
                            validation: 'num',
                            invalidText: 'Must be whole numbers only',
                            size: 'col-5',
                          },
                        ],
                        headers: [
                          {
                            value: 'Level',
                            readOnly: true,
                            size: 'col-5',
                          },
                          {
                            value: 'Amount',
                            readOnly: true,
                            size: 'col-5',
                          },
                        ],
                      }}
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
          return featureItem[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                <Select
                  name={`feature.${featureIndex}.${this.name}.${index}.area`}
                  label='Proficiency Area'
                  value={item.area}
                  options={builders.proficiency.area}
                  required={true}
                  onChange={setState}
                />
                {item.area?.name === 'skill' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.skill`}
                    value={item.skill}
                    label='Skill'
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.area?.name === 'saveAbility' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.saveAbility`}
                    value={item.saveAbility}
                    label='Save Ability'
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'language' && (
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.language`}
                    label='Language'
                    value={item.language}
                    options={builders.language}
                    required={true}
                    onChange={setState}
                  />
                )}
                {(item.area?.name === 'property' ||
                  item.area?.name === 'itemType') && (
                  <>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.category`}
                      multiple={true}
                      label='Item Category'
                      value={item.category}
                      options={builders.item.category}
                      onChange={setState}
                    />
                    {item.area?.name === 'property' && (
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.property`}
                        multiple={true}
                        label='Item Property'
                        value={item.property}
                        options={[].concat(
                          ...builders.item.category
                            .filter((bCategoryItem) =>
                              item.category?.length > 0
                                ? item.category?.some(
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
                        name={`feature.${featureIndex}.${this.name}.${index}.itemType`}
                        multiple={true}
                        label='Item Type'
                        value={item.itemType}
                        options={items.filter((itemType) =>
                          item.category?.length > 0
                            ? item.category?.some(
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
                  label='Proficiency Level'
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
          return featureItem[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                <Select
                  multiple={true}
                  name={`feature.${featureIndex}.${this.name}.${index}.sense`}
                  label='Sense'
                  value={item?.sense}
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
          return featureItem[this.name].map((item, index) => (
            <Fragment key={index}>
              <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                <Select
                  multiple='true'
                  name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                  options={[].concat(
                    builders.feature.spell.attribute,
                    builders.section.attribute
                  )}
                  label='Spell Attributes'
                  value={item.attribute}
                  require={true}
                  onChange={setState}
                />
                {item.attribute?.some(
                  (attributeItem) => attributeItem.name === 'classLimit'
                ) && (
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.classLimit`}
                    multiple={true}
                    label='Class Limit'
                    value={item.classLimit}
                    options={classes}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.attribute?.some(
                  (attributeItem) => attributeItem.name === 'levelLimit'
                ) && (
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.levelLimit`}
                    multiple={true}
                    label='Level Limit'
                    value={item.levelLimit}
                    options={spells.map((spellItem) => ({
                      value: spellItem.level,
                    }))}
                    required={true}
                    onChange={setState}
                  />
                )}
                {!item.attribute?.some(
                  (attributeItem) => attributeItem.name === 'spellsByLevel'
                ) && (
                  <>
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.spell`}
                      multiple={true}
                      label='Spell'
                      value={item?.spell}
                      options={spells.filter(
                        (spellItem) =>
                          (!item?.classLimit ||
                            item?.classLimit?.some((limitItem) =>
                              spellItem?.classes?.some(
                                (classItem) => limitItem.name === classItem.name
                              )
                            )) &&
                          (!item?.levelLimit ||
                            item?.levelLimit?.some(
                              (levelItem) => levelItem.value === spellItem.level
                            ))
                      )}
                      require={true}
                      onChange={setState}
                    />
                    {item.attribute?.some(
                      (attributeItem) =>
                        attributeItem.name === 'optionalAbility'
                    ) && (
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.ability`}
                        multiple={true}
                        label='Ability'
                        value={item.ability}
                        options={builders.ability}
                        require={true}
                        onChange={setState}
                      />
                    )}
                  </>
                )}
                {item.attribute?.some(
                  (attributeItem) => attributeItem.name === 'spellsByLevel'
                ) ? (
                  (featureItem.levelAvailable != null &&
                    featureItem.levelAvailable !== '' &&
                    !item.spellsByLevel?.length > 0) ||
                  featureItem?.levelAvailable?.split(', ')?.length !==
                    item.spellsByLevel?.length ? (
                    setState({
                      type: 'added',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.${this.name}.${index}.spellsByLevel`,
                          value: featureItem?.levelAvailable
                            ?.split(', ')
                            .map((levelItem) => ({
                              level: Number(levelItem),
                            })),
                        },
                      },
                    })
                  ) : (
                    <>
                      <Table
                        rows={{
                          inputs: [
                            {
                              name: 'level',
                              readOnly: true,
                              size: 'col-2',
                            },
                            {
                              name: 'spell',
                              type: 'select',
                              size: 'col-4',
                              options: spells,
                              multiple: true,
                            },
                          ],
                          headers: [
                            {
                              value: 'Level',
                              size: 'col-2',
                              readOnly: true,
                            },
                            {
                              value: 'Spells',
                              size: 'col-4',
                              readOnly: true,
                            },
                          ],
                        }}
                        name={`feature.${featureIndex}.${this.name}.${index}.spellsByLevel`}
                        value={item.spellsByLevel}
                        onChange={setState}
                      />
                    </>
                  )
                ) : (
                  !!item.spellsByLevel &&
                  setState({
                    type: 'removed',
                    payload: {
                      target: {
                        name: `feature.${featureIndex}.${this.name}.${index}.spellsByLevel`,
                      },
                    },
                  })
                )}
                <Select
                  multiple={true}
                  name={`feature.${featureIndex}.${this.name}.${index}`}
                  label='Spell'
                  value={item}
                  options={spells}
                  required={true}
                  onChange={setState}
                />
                {item.attribute?.some(
                  (attributeItem) => attributeItem.name === 'optionalAbility'
                ) && (
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.ability`}
                    label='Ability'
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
    ]

    return tabContent
  }

  const featureTabContent = (featureItem, featureIndex) => (
    <Fragment key={featureIndex}>
      <div className='row justify-content-between pb-2'>
        <Input
          size='col-sm-3'
          name={`feature.${featureIndex}.value`}
          autoComplete='off'
          label='Feature Name'
          value={featureItem.value}
          onChange={setState}
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
        label='Feature description'
        value={featureItem.desc}
        name={`feature.${featureIndex}.desc`}
        onChange={setState}
      />
      <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3'>
        <Select
          multiple={true}
          name={`feature.${featureIndex}.attribute`}
          options={[]
            .concat(builders.feature.attribute, builders.feature.item.attribute)
            .filter(
              (attributeItem) =>
                attributeItem.name !== 'providesOptions' &&
                attributeItem.name !== 'optionGroups'
            )}
          label='Feature Attributes'
          value={featureItem.attribute}
          onChange={setState}
        />
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitUse'
        ) && (
          <>
            <Select
              name={`feature.${featureIndex}.limitUse.limitBy`}
              label='Limit By Option'
              value={featureItem.limitUse?.limitBy}
              options={builders.feature.chargeLimit}
              required={true}
              onChange={setState}
            />
            {featureItem.limitUse?.limitBy?.name === 'ability' ? (
              <>
                <Select
                  name='limitUse.ability'
                  label='Ability'
                  value={state.limitUse?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name='limitUse.minValue'
                  autoComplete='off'
                  label='Min. Value'
                  value={state.limitUse?.minValue}
                  onChange={setState}
                />
              </>
            ) : featureItem.limitUse?.limitBy?.name === 'skill' ? (
              <Select
                name={`feature.${featureIndex}.limitUse.skill`}
                label='Skill'
                value={featureItem.limitUse?.skill}
                options={builders.skill}
                required={true}
                onChange={setState}
              />
            ) : (
              featureItem.limitUse?.limitBy?.name === 'setNumber' && (
                <Input
                  validation={'num'}
                  name={`feature.${featureIndex}.limitUse.setAmount`}
                  invalidText='Must contain only numbers'
                  label='Use Amount'
                  required={true}
                  value={featureItem.limitUse?.setAmount}
                  onChange={setState}
                />
              )
            )}
            <Select
              name={`feature.${featureIndex}.limitUse.resetsOn`}
              label='Reset Option'
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
                label='Action Type'
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
              label='Min Range'
              required={true}
              invalidText='Must contain only numbers'
              value={featureItem.range.minRange}
              onChange={setState}
            />
            <Input
              validation={'num'}
              name={`feature.${featureIndex}.range.maxRange`}
              autoComplete='off'
              label='Max Range'
              required={true}
              invalidText='Must contain only numbers'
              value={featureItem.range.maxRange}
              onChange={setState}
            />
            <Select
              name={`feature.${featureIndex}.range.unit`}
              label='UoM'
              value={featureItem.range?.unit}
              options={[].concat(
                Object.values(builders.unit.imperial).flatMap((item) => item)
              )}
              optionalKey='short'
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
              label='Save Attribute'
              value={featureItem.saveAbility?.attribute}
              options={builders.feature.saveAttribute}
              onChange={setState}
            />
            <Select
              name={`feature.${featureIndex}.saveAbility.ability`}
              label='DC Ability'
              value={featureItem.saveAbility?.ability}
              options={builders.ability}
              required={true}
              onChange={setState}
            />
            <Input
              validation='num'
              name={`feature.${featureIndex}.saveAbility.minValue`}
              autoComplete='off'
              label='Min. Value'
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
                label='Modifier Ability'
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
            label='Requirement'
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
                  label='Skill Proficiency'
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
                    label='Ability'
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                  <Input
                    name={`feature.${featureIndex}.requirement.abilityScore.score`}
                    value={featureItem.requirement?.abilityScore?.score}
                    label='Ability Score'
                    required={true}
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
                    label='Size'
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
                    label='Item Category'
                    options={builders.item.category}
                    onChange={setState}
                  />
                  <Select
                    name={`feature.${featureIndex}.requirement.itemProficiency.property`}
                    multiple={true}
                    label='Item Property'
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
                    label='Item type'
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
                  <Input
                    name={`feature.${featureIndex}.requirement.equipped.numberEquipped`}
                    value={featureItem.requirement?.equipped?.numberEquipped}
                    label='Number Equipped'
                    onChange={setState}
                    validation='num'
                    invalidText={'Must contain only numbers'}
                  />
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.equipped.category`}
                    value={featureItem.requirement?.equipped?.category}
                    label='Item Category'
                    options={builders.item.category}
                    onChange={setState}
                  />
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.equipped.property`}
                    label='Item Property'
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
                    label='Item type'
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
                    label='Item Category'
                    options={builders.item.category}
                    onChange={setState}
                  />
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.requirement.notEquipped.property`}
                    value={featureItem.requirement?.notEquipped?.property}
                    label='Item Property'
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
                    label='Item type'
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
                  rows={{
                    inputs: [
                      {
                        name: 'value',
                        invalid: 'Must contain only numbers',
                        validation: 'num',
                        size: 'col-5',
                      },
                      {
                        name: 'useNum',
                        invalid: 'Must contain only numbers',
                        validation: 'num',
                        size: 'col-5',
                      },
                    ],
                    headers: [
                      {
                        value: 'Level',
                        readOnly: true,
                        size: 'col-5',
                      },
                      {
                        value: 'Uses',
                        readOnly: true,
                        size: 'col-5',
                      },
                    ],
                  }}
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
        !featureItem.damage?.damageByLevel ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: `feature.${featureIndex}.damage.damageByLevel`,
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
                label='Damage Attribute'
                options={builders.feature.damageAttribute}
                onChange={setState}
              />
              <Select
                name={`feature.${featureIndex}.damage.damageType`}
                label='Damage Type'
                value={featureItem.damage.damageType}
                options={builders.damage}
                required={true}
                onChange={setState}
              />
              {featureItem.damage?.damageAttribute?.some(
                (attributeItem) => attributeItem.name === 'bonusDamage'
              ) && (
                <Select
                  name={`feature.${featureIndex}.bonus.bonusAttribute`}
                  label='Bonus Type'
                  value={featureItem.bonus?.bonusAttribute}
                  options={builders.feature.bonusAttribute}
                  required={true}
                  onChange={setState}
                />
              )}
              {featureItem.bonus?.bonusAttribute?.name === 'abilityBonus' && (
                <Select
                  name={`feature.${featureIndex}.bonus.ability`}
                  label='Abilty'
                  value={featureItem.bonus?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
              )}
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
                  rows={{
                    inputs: damageTableColumns(featureItem.damage).inputs,
                    headers: damageTableColumns(featureItem.damage).headers,
                  }}
                  className={`row-cols-lg-${
                    damageTableColumns(featureItem.damage).inputs.length + 1
                  }`}
                  name={`feature.${featureIndex}.damage.damageByLevel`}
                  value={featureItem.damage?.damageByLevel}
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
              label='Item Name'
              required={true}
              value={state.value}
              onChange={setState}
              autoFocus={true}
            />
            <Select
              name='category'
              label='Item Category'
              value={state.category}
              options={builders.item.category}
              required={true}
              onChange={setState}
            />
            <Select
              name='property'
              multiple={true}
              label='Properties'
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
            <Select
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
              required={true}
              value={state.weight?.amount}
              onChange={setState}
            />
            <Select
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
                  <Select
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
                  <Select
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
          </div>
          <TextEditor
            ref={addToTextRefs}
            onChange={setState}
            value={state.desc}
            label={'Item Description'}
            name={'desc'}
          />
          <TextEditor
            ref={addToTextRefs}
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
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
            <Select
              name='attribute'
              multiple={true}
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
                <Select
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
              (attributItem) => attributItem.name === 'hasRequirements'
            ) && (
              <Select
                multiple={true}
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
          </div>
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
              <div className='d-flex'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>{`${
                  state.category?.name === 'weapon' ? 'Weapon ' : ''
                }Damage Dice`}</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3 mx-3 justify-contents-center'>
                <Select
                  name='damage.damageAttribute'
                  multiple={true}
                  label='Damage Attribute'
                  value={state.damage?.damageAttribute}
                  options={builders.feature.item.damageAttribute}
                  required={true}
                  onChange={setState}
                />
                <Select
                  name='damage.damageType'
                  multiple={true}
                  label='Damage Type'
                  value={state.damage?.damageType}
                  options={builders.damage}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='damage.dice.diceCount'
                  invalidText='Must contain only numbers'
                  label='Damage Dice Count'
                  value={state.damage?.dice?.diceCount}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='damage.dice.diceValue'
                  invalidText='Must contain only numbers'
                  label='Damage Dice Value'
                  value={state.damage?.dice?.diceValue}
                  required={true}
                  onChange={setState}
                />
                {state?.damage?.damageAttribute?.some(
                  (attributItem) => attributItem.name === 'secondaryDamage'
                ) && (
                  <>
                    <Input
                      validation='num'
                      name='damage.dice.secDiceCount'
                      invalidText='Must contain only numbers'
                      label='Sec. Dice Count'
                      value={state.damage?.dice?.secDiceCount}
                      required={true}
                      onChange={setState}
                    />
                    <Input
                      validation='num'
                      name='damage.dice.secDiceValue'
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
                      name='damage.dice.versatileDiceCount'
                      invalidText='Must contain only numbers'
                      label='Alt. Dmg. Dice Count'
                      value={state.damage?.dice?.versatileDiceCount}
                      required={true}
                      onChange={setState}
                    />
                    <Input
                      validation={'num'}
                      name='damage.dice.versatileDiceValue'
                      invalidText='Must contain only numbers'
                      label='Alt. Dmg. Dice Value'
                      value={state.damage?.dice?.versatileDiceValue}
                      required={true}
                      onChange={setState}
                    />
                  </>
                )}
                {state.damage?.damageAttribute?.some(
                  (attributItem) => attributItem.name === 'bonusDamage'
                ) && (
                  <Select
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
                  <Select
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
                  <Select
                    name='primaryAbility'
                    label='Primary Ability'
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
                  <Select
                    name={'secondaryAbility'}
                    label='Secondary Ability'
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
                  invalidText='Must contain only numbers'
                  label='Armor Value'
                  required={true}
                  value={state.armorClass}
                  onChange={setState}
                />
                <Select
                  name='primaryAbility'
                  label='Primary Ability'
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
                  <Select
                    multiple={true}
                    name='requirement.option'
                    label='Requirement'
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
                      <Select
                        multiple={true}
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
                      <Select
                        multiple={true}
                        name='requirement.size'
                        value={state.requirement?.size}
                        label='Size'
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
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Select
                        name='requirement.itemProficiency.itemType'
                        multiple={true}
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
                      <Select
                        name='requirement.itemProficiency.property'
                        multiple={true}
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
                      <Input
                        name='requirement.equipped.numberEquipped'
                        value={state.requirement?.equipped?.numberEquipped}
                        label='Number Equipped'
                        onChange={setState}
                        validation='num'
                        invalidText={'Must contain only numbers'}
                      />
                      <Select
                        multiple={true}
                        name='requirement.equipped.category'
                        value={state.requirement?.equipped?.category}
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Select
                        multiple={true}
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
                      <Select
                        multiple={true}
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
                        label='Item Category'
                        options={builders.item.category}
                        onChange={setState}
                      />
                      <Select
                        multiple={true}
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
                      <Select
                        multiple={true}
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
                    </div>
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
          <button
            className='btn btn-secondary'
            type='button'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'feature' } },
              })
            }
          >
            Add Feature
          </button>
          <TabNavigation
            id='feature'
            tabState={
              state.feature?.length > 0 &&
              state.feature?.map((featureItem, featureIndex) => ({
                value:
                  featureItem.name == null || featureItem.name === ''
                    ? startCase(`feature ${featureIndex + 1}`)
                    : featureItem.name,
                name: `feature.${featureIndex}`,
                content: featureTabContent(featureItem, featureIndex),
              }))
            }
            onDelete={setState}
            dynamic={true}
          />
        </>
      ),
    },
    {
      name: 'contains',
      content: (
        <>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'containsItems'
          ) ? (
            !state?.contains ? (
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
                    dynamic={true}
                    onChange={setState}
                  />
                </div>
              </>
            )
          ) : (
            !!state.contains &&
            setState({
              type: 'removed',
              payload: { target: { name: 'contains' } },
            })
          )}
        </>
      ),
    },
  ]

  content = (
    <>
      <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
        <div className='col-auto'>
          <h3>Create an Item</h3>
        </div>
        <div className='col-auto d-flex justify-content-end'>
          <button
            className='btn btn-primary me-2'
            type='button'
            onClick={onSubmit}
          >
            Add
          </button>
          <button className='btn btn-warning me-2' onClick={onReset}>
            Reset Form
          </button>
          <button className='btn btn-secondary' onClick={() => navigate(-1)}>
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
