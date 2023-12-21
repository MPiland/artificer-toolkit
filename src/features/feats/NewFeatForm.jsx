import { useEffect, useReducer, useState, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAddNewFeatMutation,
  useGetFeatsQuery,
  selectAllFeats,
} from './featsApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../spells/spellsApiSlice'
import { useGetItemsQuery, selectAllItems } from '../items/itemsApiSlice'
import {
  selectAllClasses,
  useGetClassesQuery,
} from '../classes/classesApiSlice'
import { startCase } from 'lodash'
import { handleValidation } from '../../helpers/form'
import { useSelector } from 'react-redux'
import { selectLoadingStatus } from '../../app/loadingSlice'
import formReducer from '../../hooks/useReducer'
import Spinner from '../../components/Spinner'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import TabNavigation from '../../components/TabNavigation/TabNavigation'

const NewFeatForm = () => {
  const navigate = useNavigate()

  const isLoading = useSelector(selectLoadingStatus)

  const { data: builders } = useGetBuildersQuery('buildersList')

  const { classes } = useGetClassesQuery('classesList', {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  const { spells } = useGetSpellsQuery('spellList', {
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
    addNewFeat,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewFeatMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const textRefs = useRef([])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Feat added successfully!')
      setErrorMessage()
      const successElement = document.getElementById('error-message')
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
      await addNewFeat(state)
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
      (attributeItem) => attributeItem.name === 'secondaryDice'
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
      size: inputItem.size,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  const sectionTabContent = (stateName, sectionItem) => {
    const tabContent = [
      {
        name: 'feat',
        content() {
          return sectionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`${stateName}.${this.name}.${index}.attribute`}
                    options={builders.section.attribute}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`${stateName}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${stateName}.${this.name}.${index}.feat`}
                    multiple={true}
                    label='Feat'
                    value={item.feat}
                    options={feats}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`${stateName}.${this.name}.${index}.selectionCount`}
                      label='# of Selections'
                      autoComplete='off'
                      value={item.selectionCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
                </div>
              </Fragment>
            )
          })
        },
      },
      {
        name: 'modifier',
        content() {
          return sectionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`${stateName}.${this.name}.${index}.attribute`}
                    options={builders.section.attribute}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`${stateName}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${stateName}.${this.name}.${index}.module`}
                    label='Modifier Category'
                    value={item.module}
                    options={builders.modifier.module}
                    required={true}
                    onChange={setState}
                  />
                  {item.module?.name && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.modType`}
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
                          name={`${stateName}.${this.name}.${index}.limitUse.resetOption`}
                          label='Reset Option'
                          value={item.limitUse?.resetOption}
                          options={builders.feature.chargeReset}
                          required={true}
                          onChange={setState}
                        />
                        <Select
                          name={`${stateName}.${this.name}.${index}.limitUse.feature`}
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
                      name={`${stateName}.${this.name}.${index}.ability`}
                      multiple={true}
                      label='Ability'
                      value={item.ability}
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item.module?.name === 'saveAbility' && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.saveAbility`}
                      multiple={true}
                      label='Save Ability'
                      value={item.saveAbility}
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item.module?.name === 'skill' && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.skill`}
                      multiple={true}
                      label='Skill'
                      value={item.skill}
                      options={builders.skill}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item.module?.name === 'damageSave' && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.damageSave`}
                      multiple={true}
                      label='Damage'
                      value={item.damageSave}
                      options={builders.damage}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item.module?.name === 'conditionSave' && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.conditionSave`}
                      multiple={true}
                      label='Condition'
                      value={item.conditionSave}
                      options={builders.condition}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {(item.modType?.name === 'bonus' ||
                    item.modType?.name === 'penalty' ||
                    item.modType?.name === 'setDieValue' ||
                    item.modType?.name === 'setBonus') && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.method`}
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
                      name={`${stateName}.${this.name}.${index}.condition`}
                      multiple={true}
                      label='Condition Type'
                      value={item.condition}
                      options={builders.condition}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'speed' ? (
                    <Select
                      name={`${stateName}.${this.name}.${index}.speed`}
                      multiple={true}
                      value={item.speed}
                      label='Speed Type'
                      options={builders.speed}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'passive' ? (
                    <Select
                      name={`${stateName}.${this.name}.${index}.passive`}
                      multiple={true}
                      label='Passive Type'
                      value={item.passive}
                      options={builders.passive}
                      required={true}
                      onChange={setState}
                    />
                  ) : (
                    item.module?.name === 'damage' && (
                      <Select
                        name={`${stateName}.${this.name}.${index}.damage`}
                        multiple={true}
                        label='Damage Type'
                        value={item.damage}
                        options={builders.damage}
                        required={true}
                        onChange={setState}
                      />
                    )
                  )}
                  {(item.method?.name === 'setValue' &&
                    item.modType?.name !== 'setDieValue') ||
                  item.modType?.name === 'setValue' ? (
                    <>
                      <Input
                        validation='num'
                        name={`${stateName}.${this.name}.${index}.method.setValue`}
                        label='Set Value'
                        invalidText='Must contain only numbers'
                        autoComplete='off'
                        value={item.method?.setValue}
                        required={true}
                        onChange={setState}
                      />
                    </>
                  ) : item.method?.name === 'ability' ? (
                    <>
                      <Select
                        name={`${stateName}.${this.name}.${index}.method.ability`}
                        label='Method Ability'
                        value={item.method.ability}
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        validation='num'
                        name={`${stateName}.${this.name}.${index}.multiplier`}
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
                          name={`${stateName}.${this.name}.${index}.method.skill`}
                          label='Method Skill'
                          value={item.method.skill}
                          options={builders.skill}
                          required={true}
                          onChange={setState}
                        />
                        <Input
                          validation='num'
                          name={`${stateName}.${this.name}.${index}.multiplier`}
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
                        name={`${stateName}.${this.name}.${index}.maxValue`}
                        label='Max Value'
                        autoComplete='off'
                        value={item.maxValue}
                        invalidText='Must contain only numbers'
                        required={true}
                        onChange={setState}
                      />
                    )}
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`${stateName}.${this.name}.${index}.selectionCount`}
                      label='# of Selections'
                      autoComplete='off'
                      value={item.selectionCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
                </div>
                {item.modType?.name === 'setDieValue' &&
                item.method?.name === 'diePerLevel' ? (
                  !item.diePerLevel || !item.diePerLevel?.length > 0 ? (
                    setState({
                      type: 'added',
                      payload: {
                        target: {
                          name: `${stateName}.${this.name}.${index}.diePerLevel`,
                        },
                      },
                    })
                  ) : (
                    <Table
                      name={`${stateName}.${this.name}.${index}.diePerLevel`}
                      rows={{
                        inputs: [
                          {
                            name: 'level',
                            validation: 'num',
                            invalidText: 'Must be whole numbers only',
                            size: 'col',
                          },
                          {
                            name: 'dieCount',
                            validation: 'num',
                            invalidText: 'Must be whole numbers only',
                            size: 'col',
                          },
                          {
                            name: 'dieValue',
                            validation: 'num',
                            invalidText: 'Must be whole numbers only',
                            size: 'col',
                          },
                        ],
                        headers: [
                          {
                            value: 'Level',
                            readOnly: true,
                            size: 'col',
                          },
                          {
                            value: 'Die Count',
                            readOnly: true,
                            size: 'col',
                          },
                          {
                            value: 'Die Value',
                            readOnly: true,
                            size: 'col',
                          },
                        ],
                      }}
                      value={item.diePerLevel}
                      dynamic={true}
                      onChange={setState}
                    />
                  )
                ) : (
                  (!!item.diePerLevel || item.diePerLevel?.length > 0) &&
                  setState({
                    type: 'removed',
                    payload: {
                      target: {
                        name: `${stateName}.${this.name}.${index}.diePerLevel`,
                      },
                    },
                  })
                )}
                {item.method?.name === 'addPerLevel' ? (
                  !item.addPerLevel ? (
                    setState({
                      type: 'added',
                      payload: {
                        target: {
                          name: `${stateName}.${this.name}.${index}.addPerLevel`,
                        },
                      },
                    })
                  ) : (
                    <Table
                      name={`${stateName}.${this.name}.${index}.addPerLevel`}
                      inputs={[
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
                      ]}
                      headers={[
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
                      ]}
                      value={item.addPerLevel}
                      dynamic={true}
                      onChange={setState}
                    />
                  )
                ) : (
                  !!item.addPerLevel &&
                  setState({
                    type: 'removed',
                    payload: {
                      target: {
                        name: `${stateName}.${this.name}.${index}.addPerLevel`,
                      },
                    },
                  })
                )}
              </Fragment>
            )
          })
        },
      },
      {
        name: 'proficiency',
        content() {
          return sectionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`${stateName}.${this.name}.${index}.attribute`}
                    options={builders.section.attribute}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`${stateName}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${stateName}.${this.name}.${index}.area`}
                    label='Proficiency Area'
                    value={item.area}
                    options={builders.proficiency.area}
                    required={true}
                    onChange={setState}
                  />
                  {item?.area?.name === 'skill' && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.skill`}
                      multiple={true}
                      label='Skill'
                      value={item.skill}
                      options={builders.skill}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item?.area?.name === 'saveAbility' && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.saveAbility`}
                      multiple={true}
                      label='Save Ability'
                      value={item.saveAbility}
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item?.area?.name === 'language' && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.language`}
                      multiple={true}
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
                        name={`${stateName}.${this.name}.${index}.category`}
                        multiple={true}
                        label='Item Category'
                        value={item.category}
                        options={builders.item.category}
                        onChange={setState}
                      />
                      {item.area?.name === 'property' && (
                        <Select
                          name={`${stateName}.${this.name}.${index}.property`}
                          multiple={true}
                          label='Item Property'
                          value={item.property}
                          options={[].concat(
                            ...builders.item.category
                              .filter((bCategoryItem) =>
                                item.category?.length > 0
                                  ? item.category?.some(
                                      (categoryItem) =>
                                        categoryItem.name === bCategoryItem.name
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
                          name={`${stateName}.${this.name}.${index}.itemType`}
                          multiple={true}
                          label='Item Type'
                          value={item.itemTypeitem.itemType}
                          options={items.filter((itemType) =>
                            item.category?.length > 0
                              ? item.category?.some(
                                  (categoryItem) =>
                                    categoryItem.name === itemType.category.name
                                )
                              : itemType
                          )}
                          onChange={setState}
                        />
                      )}
                    </>
                  )}
                  <Select
                    name={`${stateName}.${this.name}.${index}.level`}
                    label='Proficiency Level'
                    value={item.level}
                    options={builders.proficiency.level}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`${stateName}.${this.name}.${index}.selectionCount`}
                      label='# of Selections'
                      autoComplete='off'
                      value={item.selectionCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
                </div>
              </Fragment>
            )
          })
        },
      },
      {
        name: 'sense',
        content() {
          return sectionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`${stateName}.${this.name}.${index}.attribute`}
                    options={builders.section.attribute}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`${stateName}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${stateName}.${this.name}.${index}.sense`}
                    multiple={true}
                    label='Sense'
                    value={item.sense}
                    options={builders.sense}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`${stateName}.${this.name}.${index}.selectionCount`}
                      label='# of Selections'
                      autoComplete='off'
                      value={item.selectionCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  )}
                </div>
              </Fragment>
            )
          })
        },
      },
      {
        name: 'spell',
        content() {
          return sectionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple='true'
                    name={`${stateName}.${this.name}.${index}.attribute`}
                    options={[].concat(
                      builders.section.spell.attribute,
                      builders.section.attribute
                    )}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    required={true}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'classLimit'
                  ) && (
                    <Select
                      name={`${stateName}.${this.name}.${index}.classLimit`}
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
                      name={`${stateName}.${this.name}.${index}.levelLimit`}
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
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`${stateName}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  {!item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'spellsByLevel'
                  ) && (
                    <>
                      <Select
                        name={`${stateName}.${this.name}.${index}.spell`}
                        multiple={true}
                        label='Spell'
                        value={item.spell}
                        options={spells.filter(
                          (spellItem) =>
                            (!item?.classLimit ||
                              item?.classLimit?.some((limitItem) =>
                                spellItem?.classes?.some(
                                  (classItem) =>
                                    limitItem.name === classItem.name
                                )
                              )) &&
                            (!item?.levelLimit ||
                              item?.levelLimit?.some(
                                (levelItem) =>
                                  levelItem.value === spellItem.level
                              ))
                        )}
                        required={true}
                        onChange={setState}
                      />
                      {item.attribute?.some(
                        (attributeItem) =>
                          attributeItem.name === 'optionalAbility'
                      ) && (
                        <Select
                          name={`${stateName}.${this.name}.${index}.ability`}
                          multiple={true}
                          label='Ability'
                          value={item.ability}
                          options={builders.ability}
                          required={true}
                          onChange={setState}
                        />
                      )}
                      {multipleOptions && (
                        <Input
                          validation='num'
                          name={`${stateName}.${this.name}.${index}.selectionCount`}
                          label='# of Selections'
                          autoComplete='off'
                          value={item.selectionCount}
                          invalidText='Must contain only numbers'
                          required={true}
                          onChange={setState}
                        />
                      )}
                    </>
                  )}
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'spellsByLevel'
                  ) ? (
                    (sectionItem.levelAvailable != null &&
                      sectionItem.levelAvailable !== '' &&
                      !item.spellsByLevel?.length > 0) ||
                    sectionItem?.levelAvailable?.split(', ')?.length !==
                      item.spellsByLevel?.length ? (
                      setState({
                        type: 'added',
                        payload: {
                          target: {
                            name: `${stateName}.${this.name}.${index}.spellsByLevel`,
                            value: sectionItem?.levelAvailable
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
                          name={`${stateName}.${this.name}.${index}.spellsByLevel`}
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
                          name: `${stateName}.${this.name}.${index}.spellsByLevel`,
                        },
                      },
                    })
                  )}
                </div>
              </Fragment>
            )
          })
        },
      },
      {
        name: 'style',
        content() {
          return sectionItem[this.name].option.map(
            (optionItem, optionIndex) => {
              const style = false
              const sectionStateName = `${stateName}.${this.name}.option.${optionIndex}`
              return featureTabContent(
                sectionStateName,
                optionItem,
                optionIndex,
                style
              )
            }
          )
        },
      },
    ]
    return tabContent
  }

  const featureTabContent = (stateName, featureItem, style) => (
    <>
      <div className='row justify-content-between g-2 pb-2'>
        <Input
          size='col-sm-3'
          name={`${stateName}.value`}
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
          {sectionTabContent(featureItem)
              .filter(
                (sectionItem) =>
                  (style === false
                    ? sectionItem.name !== 'style'
                    : sectionItem) &&
                  (featureItem['style']?.option?.length > 0
                    ? sectionItem.name === 'style'
                    : sectionItem)
              )
              .map((sectionItem, sectionIndex) => (
                <li key={sectionIndex} className='dropdown-item'>
                  <button
                    key={sectionIndex}
                    className='dropdown-item'
                    type='button'
                    name={`${stateName}.${sectionItem.name}${
                      sectionItem.name === 'style' ? '.option' : ''
                    }`}
                    onClick={(e) => setState({ type: 'added', payload: e })}
                  >
                    {`${startCase(sectionItem.name)}`}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
      <TextEditor
        ref={addToTextRefs}
        className='pb-2'
        label='Feature description'
        value={featureItem.desc}
        name={`${stateName}.desc`}
        onChange={setState}
      />
      <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3'>
        <Select
          multiple={true}
          name={`${stateName}.attribute`}
          value={featureItem.attribute}
          options={builders.feature.attribute}
          label='Feature Attributes'
          onChange={setState}
        />
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitUse'
        ) && (
          <>
            <Select
              name={`${stateName}.limitUse.limitBy`}
              label='Limit By Option'
              value={featureItem.limitUse?.limitBy}
              options={builders.feature.chargeLimit}
              required={true}
              onChange={setState}
            />
            {featureItem.limitUse?.limitBy?.name === 'ability' ? (
              <>
                <Select
                  name={`${stateName}.limitUse.ability`}
                  label='Ability'
                  value={featureItem.limitUse?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name={`${stateName}.limitUse.minValue`}
                  autoComplete='off'
                  label='Min. Value'
                  value={featureItem?.limitUse?.minValue}
                  onChange={setState}
                />
              </>
            ) : featureItem.limitUse?.limitBy?.name === 'skill' ? (
              <Select
                name={`${stateName}.limitUse.skill`}
                label='Skill'
                value={featureItem.limitUse?.skill}
                options={builders.skill}
                required={true}
                onChange={setState}
              />
            ) : (
              featureItem.limitUse?.limitBy?.name === 'setValue' && (
                <Input
                  validation='num'
                  name={`${stateName}.limitUse.setValue`}
                  invalidText='Must contain only numbers'
                  label='Use Amount'
                  required={true}
                  value={featureItem.limitUse.setValue}
                  onChange={setState}
                />
              )
            )}
            {featureItem.limitUse?.limitBy?.name !== 'level' && (
              <Input
                name={`${stateName}.limitUse.addValue`}
                autoComplete='off'
                label='Additional Amount'
                value={featureItem?.limitUse?.addValue}
                onChange={setState}
              />
            )}
            <Select
              name={`${stateName}.limitUse.resetOption`}
              label='Reset Option'
              value={featureItem.limitUse?.resetOption}
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
            <Select
              name={`${stateName}.action`}
              label='Action Type'
              value={featureItem.action}
              options={builders.feature.action}
              required={true}
              onChange={setState}
            />
          </>
        )}
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'hasRange'
        ) && (
          <>
            <Input
              validation='num'
              name={`${stateName}.range.minRange`}
              autoComplete='off'
              label='Min Range'
              required={true}
              value={featureItem.range.minRange}
              invalidText='Must contain only numbers'
              onChange={setState}
            />
            <Input
              validation={'num'}
              name={`${stateName}.range.maxRange`}
              autoComplete='off'
              label='Max Range'
              invalidText='Must contain only numbers'
              required={true}
              value={featureItem.range.maxRange}
              onChange={setState}
            />
            <Select
              name={`${stateName}.range.unit`}
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
              name={`${stateName}.saveAbility.attribute`}
              multiple={true}
              label='Save Attribute'
              value={featureItem.saveAbility?.attribute}
              options={builders.feature.saveAttribute}
              onChange={setState}
            />
            <Select
              name={`${stateName}.saveAbility.ability`}
              label='DC Ability'
              value={featureItem.saveAbility?.ability}
              options={builders.ability}
              required={true}
              onChange={setState}
            />
            <Input
              validation='num'
              name={`${stateName}.saveAbility.minValue`}
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
                name={`${stateName}.saveAbility.abilityModifier`}
                label='Modifier Ability'
                value={featureItem.saveAbility?.abilityModifier}
                options={builders.ability}
                required={true}
                onChange={setState}
              />
            )}
          </>
        )}
      </div>
      {featureItem.attribute?.some(
        (attributeItem) => attributeItem.name === 'hasRequirements'
      ) && (
        <>
          <div className='d-flex'>
            <hr className='flex-grow-1 me-3' />
            <span className='mx-auto'>Requirements</span>
            <hr className='flex-grow-1 ms-3' />
          </div>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
            <Select
              multiple={true}
              name={`${stateName}.requirement.option`}
              value={featureItem.requirement?.option}
              label='Requirement'
              options={builders.feature.requirement}
              required={true}
              onChange={setState}
            />
          </div>
          {featureItem.requirement?.option?.some(
            (featureItem) => featureItem.name === 'skillProficiency'
          ) && (
            <Select
              multiple={true}
              name={`${stateName}.requirement.skillProficiency.skill`}
              value={featureItem.requirement?.skillProficiency?.skill}
              label='Skill Proficiency'
              options={builders.skill}
              required={true}
              onChange={setState}
            />
          )}
          {featureItem.requirement?.option?.some(
            (featureItem) => featureItem.name === 'abilityScore'
          ) && (
            <>
              <Select
                multiple={true}
                name={`${stateName}.requirement.abilityScore.ability`}
                value={featureItem.requirement?.abilityScore?.ability}
                label='Ability'
                options={builders.ability}
                required={true}
                onChange={setState}
              />
              <Input
                name={`${stateName}.requirement.abilityScore.score`}
                value={featureItem.requirement?.abilityScore?.score}
                label='Score'
                required={true}
                validation='num'
                invalidText='Must contain only numbers'
                onChange={setState}
              />
            </>
          )}
        </>
      )}
      {featureItem.requirement?.option?.some(
        (featureItem) => featureItem.name === 'itemProficiency'
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
              name={`${stateName}.requirement.itemProficiency.category`}
              value={featureItem.requirement?.itemProficiency?.category}
              label='Item Category'
              options={builders.item.category}
              onChange={setState}
            />
            <Select
              name={`${stateName}.requirement.itemProficiency.property`}
              multiple={true}
              label='Item Property'
              value={featureItem.requirement?.itemProficiency?.property}
              options={[].concat(
                ...items
                  .filter((item) =>
                    featureItem.requirement?.itemProficiency?.category?.length >
                    0
                      ? featureItem.requirement?.itemProficiency?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )
                  .map((item) => item.property)
              )}
              onChange={setState}
            />
            <Select
              name={`${stateName}.requirement.itemProficiency.itemType`}
              multiple={true}
              label='Item type'
              value={featureItem.requirement?.itemProficiency?.itemType}
              options={items.filter((item) =>
                featureItem.requirement.itemProficiency?.category?.length > 0
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
        (featureItem) => featureItem.name === 'equipped'
      ) && (
        <>
          <div className='d-flex mx-3'>
            <hr className='flex-grow-1 me-3' />
            <span className='mx-auto'>Equipped</span>
            <hr className='flex-grow-1 ms-3' />
          </div>
          <div className='row g-2 pb-3 mx-3 justify-contents-center'>
            <Input
              name={`${stateName}.requirement.equipped.numberEquipped`}
              value={featureItem.requirement?.equipped?.numberEquipped}
              label='Number Equipped'
              onChange={setState}
              validation='num'
              invalidText={'Must contain only numbers'}
            />
            <Select
              multiple={true}
              name={`${stateName}.requirement.equipped.category`}
              value={featureItem.requirement?.equipped?.category}
              label='Item Category'
              options={builders.item.category}
              onChange={setState}
            />
            <Select
              multiple={true}
              name={`${stateName}.requirement.equipped.property`}
              label='Item Property'
              value={featureItem.requirement?.equipped?.property}
              options={[].concat(
                ...items
                  .filter((item) =>
                    featureItem.requirement?.equipped?.category?.length > 0
                      ? featureItem.requirement?.equipped?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )
                  .map((item) => item.property)
              )}
              onChange={setState}
            />
            <Select
              multiple={true}
              name={`${stateName}.requirement.equipped.itemType`}
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
        (featureItem) => featureItem.name === 'notEquipped'
      ) && (
        <>
          <div className='d-flex mx-3'>
            <hr className='flex-grow-1 me-3' />
            <span className='mx-auto'>Not Equipped</span>
            <hr className='flex-grow-1 ms-3' />
          </div>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3'>
            <Select
              multiple={true}
              name={`${stateName}.requirement.notEquipped.category`}
              value={featureItem.requirement?.notEquipped?.category}
              label='Item Category'
              options={builders.item.category}
              onChange={setState}
            />
            <Select
              multiple={true}
              name={`${stateName}.requirement.notEquipped.property`}
              value={featureItem.requirement?.notEquipped?.property}
              label='Item Property'
              options={[].concat(
                ...items
                  .filter((item) =>
                    featureItem.requirement.notEquipped?.category?.length > 0
                      ? featureItem.requirement.notEquipped?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )
                  .map((item) => item.property)
              )}
              onChange={setState}
            />
            <Select
              multiple={true}
              name={`${stateName}.requirement.notEquipped.itemType`}
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
      {featureItem.attribute?.some(
        (attributeItem) => attributeItem.name === 'limitUse'
      ) &&
        featureItem.limitUse?.limitBy?.name === 'level' &&
        (!featureItem.limitUse.level?.lenght > 0 ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: `${stateName}.limitUse.level`,
              },
            },
          })
        ) : (
          <>
            <div
              className='btn btn-section-collapse justify-content-between align-items-center'
              id='limitCollapseButton'
              type='button'
              role='button'
              data-bs-toggle='collapse'
              data-bs-target={`#${stateName.replace(
                  '.',
                  ''
                )}LimitUseCollapse`}
              aria-controls='collapseExample'
              aria-expanded='true'
            >
              <span className='me-3'>Limit Use Table</span>
              <i className='bi bi-arrow-down-up' />
            </div>
            <div
              className='section-container collapse show'
              id={`${stateName.replace(
                  '.',
                  ''
                )}LimitUseCollapse`}
            >
              <div className='section-content'>
                <Table
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
                  name={`${stateName}.limitUse.level`}
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
                name: `${stateName}.damage.damageByLevel`,
              },
            },
          })
        ) : (
          <>
            <div className='row g-2 align-items-end pb-2'>
              <Select
                multiple={true}
                name={`${stateName}.damage.damageAttribute`}
                label='Damage Attribute'
                value={featureItem.damage?.damageAttribute}
                options={builders.feature.damageAttribute}
                onChange={setState}
              />
              <Select
                name={`${stateName}.damage.damageType`}
                multiple={true}
                label='Damage Type'
                value={featureItem.damage?.damageType}
                options={builders.damage}
                required={true}
                onChange={setState}
              />
              {featureItem.damage?.damageAttribute?.some(
                (attributeItem) => attributeItem.name === 'bonusDamage'
              ) && (
                <Select
                  name={`${stateName}.damage.bonus.bonusAttribute`}
                  label='Bonus Type'
                  value={featureItem.damage?.bonus?.bonusAttribute}
                  options={builders.feature.bonusAttribute}
                  required={true}
                  onChange={setState}
                />
              )}
              {featureItem.damage?.bonus?.bonusAttribute?.name ===
                'abilityBonus' && (
                <Select
                  name={`${stateName}.damage.bonus.ability`}
                  label='Abilty'
                  value={featureItem.damage?.bonus?.ability}
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
              data-bs-target={`#${stateName.replace(
                  '.',
                  ''
                )}SectionCollapse`}
              aria-controls='collapseExample'
              aria-expanded='true'
            >
              <span className='me-3'>Damage Table</span>
              <i className='bi bi-arrow-down-up' />
            </div>
            <div
              className='section-container collapse show'
              id={`${stateName.replace(
                  '.',
                  ''
                )}SectionCollapse`}
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
                  name={`${stateName}.damage.damageByLevel`}
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
          payload: { target: { name: `${stateName}.damage` } },
        })
      )}
        {featureItem['style']?.option?.length > 0 && (
          <>
            <div className='d-flex'>
              <hr className='flex-grow-1 me-3' />
              <span className='mx-auto'>
                <strong>Style</strong>
              </span>
              <hr className='flex-grow-1 ms-3' />
            </div>
            <div className='row row-cols-lg-4 row-cols-sm-3 gx-2'>
              <Select
                name={`${stateName}.style.attribute`}
                label='Style Attribute'
                value={featureItem.style?.attribute}
                options={builders.feature.style.attribute}
                multiple={true}
                onChange={setState}
              />
              {featureItem.style?.attribute?.some(
                (attributeItem) => attributeItem.name === 'replaceAtLevel'
              ) && (
                <Input
                  name={`${stateName}.style.replaceCount`}
                  value={featureItem.style?.replaceCount}
                  label='Replacement at Level Count'
                  onChange={setState}
                  validation='num'
                  required={true}
                  invalidText={'Must contain only numbers'}
                />
              )}
            </div>
            {featureItem.style?.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            ) ? (
              !featureItem.style?.selectCountByLevel?.length > 0 ||
              featureItem.levelAvailable?.split(', ')?.length !==
                featureItem.style?.selectCountByLevel?.length ? (
                setState({
                  type: 'added',
                  payload: {
                    target: {
                      name: `${stateName}.style.selectCountByLevel`,
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
                          size: 'col',
                        },
                        {
                          name: 'selectionCount',
                          validation: 'num',
                          invalidText: 'Must enter whole numbers',
                          size: 'col',
                        },
                      ],
                      headers: [
                        {
                          value: 'Level',
                          size: 'col',
                          readOnly: true,
                        },
                        {
                          value: 'Selection Count',
                          size: 'col',
                          readOnly: true,
                        },
                      ],
                    }}
                    name={`${stateName}.style.selectCountByLevel`}
                    value={featureItem.style?.selectCountByLevel}
                    onChange={setState}
                    dynamic={true}
                    scrollable={true}
                  />
                </>
              )
            ) : (
              featureItem.style?.selectCountByLevel?.length > 0 &&
              setState({
                type: 'removed',
                payload: {
                  target: { name: `${stateName}.style.selectCountByLevel` },
                },
              })
            )}
          </>
        )}
        {Object.keys(featureItem)?.length !== 0 &&
          Object.keys(featureItem)?.some(
            (key) => featureItem[key]?.length !== 0
          ) && (
            <TabNavigation
              id={`${stateName}section`}
              tabState={[].concat(
                ...sectionTabContent(stateName, featureItem)
                  .filter(
                    (sectionGroupItem) => !!featureItem[sectionGroupItem.name]
                  )
                  ?.map((sectionGroupItem) => {
                    return sectionGroupItem
                      .content()
                      .map((sectionItem, sectionIndex) => {
                        return {
                          value:
                            featureItem[sectionGroupItem.name]?.option?.[
                              sectionIndex
                            ]?.value ??
                            startCase(
                              `${sectionGroupItem.name} ${sectionIndex + 1}`
                            ),
                          name: `${stateName}.${sectionGroupItem.name}.${sectionIndex}`,
                          content: sectionItem,
                        }
                      })
                  })
              )}
              dynamic={true}
              setState={setState}
            />
          )}
    </>
  )

  const mainTabContent = [
    {
      name: 'details',
      content: (
        <Fragment>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
            <Input
              name='value'
              autoComplete='off'
              label='Feat Name'
              value={state.value}
              required={true}
              onChange={setState}
              autoFocus={true}
            />
          </div>
          <div className='pb-2'>
            <TextEditor
              ref={addToTextRefs}
              name={'desc'}
              value={state.desc}
              label='Feat Description'
              onChange={setState}
            />
          </div>
        </Fragment>
      ),
    },
    {
      name: 'attributes',
      content: (
        <>
          <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3'>
            <Select
              multiple={true}
              name='attribute'
              value={state.attribute}
              options={[].concat(
                builders.feature.attribute,
                builders.feature.feat.attribute
              )}
              label='Feat Attributes'
              onChange={setState}
            />
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            ) && (
              <Input
                name='selectionCount'
                autoComplete='off'
                label='# of Selections'
                value={state.selectionCount}
                required={true}
                onChange={setState}
                autoFocus={true}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'limitUse'
            ) && (
              <>
                <Select
                  name='limitUse.limitBy'
                  label='Limit By Option'
                  value={state.limitUse?.limitBy}
                  options={builders.feature.chargeLimit}
                  required={true}
                  onChange={setState}
                />
                {state.limitUse?.limitBy?.name === 'ability' ? (
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
                ) : state.limitUse?.limitBy?.name === 'skill' ? (
                  <Select
                    name='limitUse.skill'
                    label='Skill'
                    value={state.limitUse?.skill}
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                ) : (
                  state.limitUse?.limitBy?.name === 'setValue' && (
                    <Input
                      validation='num'
                      name='limitUse.setValue'
                      invalidText='Must contain only numbers'
                      label='Use Amount'
                      required={true}
                      value={state.limitUse.setValue}
                      onChange={setState}
                    />
                  )
                )}
                <Select
                  name='limitUse.resetOption'
                  label='Reset Option'
                  value={state.limitUse?.resetOption}
                  options={builders.feature.chargeReset}
                  required={true}
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'isAction'
            ) && (
              <>
                <Select
                  name='action'
                  label='Action Type'
                  value={state.action}
                  options={builders.feature.action}
                  required={true}
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'hasRange'
            ) && (
              <>
                <Input
                  validation='num'
                  name='range.minRange'
                  autoComplete='off'
                  label='Min Range'
                  required={true}
                  value={state.range.minRange}
                  invalidText='Must contain only numbers'
                  onChange={setState}
                />
                <Input
                  validation={'num'}
                  name='range.maxRange'
                  autoComplete='off'
                  label='Max Range'
                  invalidText='Must contain only numbers'
                  required={true}
                  value={state.range.maxRange}
                  onChange={setState}
                />
                <Select
                  name='range.unit'
                  label='UoM'
                  value={state.range?.unit}
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
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'requireSave'
            ) && (
              <>
                <Select
                  name='saveAbility.attribute'
                  multiple={true}
                  label='Save Attribute'
                  value={state.saveAbility?.attribute}
                  options={builders.feature.saveAttribute}
                  onChange={setState}
                />
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
                {state.saveAbility?.attribute?.some(
                  (attributeItem) => attributeItem.name === 'addAbilityModifier'
                ) && (
                  <Select
                    name='saveAbility.abilityModifier'
                    label='Modifier Ability'
                    value={state.saveAbility?.abilityModifier}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
              </>
            )}
          </div>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'hasRequirements'
          ) && (
            <>
              <div className='d-flex'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>Requirements</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <Select
                multiple={true}
                name='requirement.option'
                value={state.requirement?.option}
                label='Requirement'
                options={builders.feature.requirement}
                required={true}
                onChange={setState}
              />
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
                    label='Score'
                    required={true}
                    validation='num'
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                </>
              )}
            </>
          )}
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
                  label='Item type'
                  value={state.requirement?.itemProficiency?.itemType}
                  options={items.filter((item) =>
                    state.requirement.itemProficiency?.category?.length > 0
                      ? state.requirement.itemProficiency?.category?.some(
                          (category) => category.name === item.category.name
                        )
                      : item
                  )}
                  onChange={setState}
                />
                <Select
                  name='requirement.itemProficiency.property'
                  label='Item Property'
                  value={state.requirement?.itemProficiency?.property}
                  options={[].concat(
                    ...items
                      .filter((item) =>
                        state.requirement.itemProficiency?.category?.length > 0
                          ? state.requirement.itemProficiency?.category?.some(
                              (category) => category.name === item.category.name
                            )
                          : item
                      )
                      .filter((item) =>
                        state.requirement.itemProficiency?.itemType?.length > 0
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
              <div className='d-flex'>
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
                          (category) => category.name === item.category.name
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
                        state.requirement.equipped?.category?.length > 0
                          ? state.requirement.equipped?.category?.some(
                              (category) => category.name === item.category.name
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
                <span className='mx-auto'>Not Equipped</span>
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
                          (category) => category.name === item.category.name
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
                        state.requirement.notEquipped?.category?.length > 0
                          ? state.requirement.notEquipped?.category?.some(
                              (category) => category.name === item.category.name
                            )
                          : item
                      )
                      .filter((item) =>
                        state.requirement.notEquipped?.itemType?.length > 0
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
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'limitUse'
          ) &&
            state.limitUse?.limitBy?.name === 'level' &&
            (!state.limitUse.level?.length > 0 ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: 'limitUse.level',
                  },
                },
              })
            ) : (
              <div>
                <Table
                  rows={{
                    inputs: [
                      {
                        name: 'value',
                        invalid: 'Must contain only numbers',
                        validation: 'num',
                      },
                      {
                        name: 'useNum',
                        invalid: 'Must contain only numbers',
                        validation: 'num',
                      },
                    ],
                    headers: [
                      {
                        value: 'Level',
                        readOnly: true,
                      },
                      {
                        value: 'Uses',
                        readOnly: true,
                      },
                    ],
                  }}
                  name='limitUse.level'
                  value={state.limitUse?.level}
                  onChange={setState}
                  dynamic={true}
                />
              </div>
            ))}
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'doesDamage'
          ) ? (
            !state.damage?.damageByLevel ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: 'damage.damageByLevel',
                  },
                },
              })
            ) : (
              <div className='row g-2 align-items-end pb-2'>
                <Select
                  multiple={true}
                  name='damage.damageAttribute'
                  value={state.damage?.damageAttribute}
                  label='Damage Attribute'
                  options={builders.feature.damageAttribute}
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
                {state.damage?.damageAttribute?.some(
                  (attributeItem) => attributeItem.name === 'bonusDamage'
                ) && (
                  <Select
                    name='damage.bonus.bonusAttribute'
                    label='Bonus Type'
                    value={state.bonus?.bonusAttribute}
                    options={builders.feature.bonusAttribute}
                    required={true}
                    onChange={setState}
                  />
                )}
                {state.damage?.bonus?.bonusAttribute?.name ===
                  'abilityBonus' && (
                  <Select
                    name='damage.bonus.ability'
                    label='Abilty'
                    value={state.damage?.bonus?.ability}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
              </div>
            )
          ) : (
            state.damage != null &&
            Object.keys(state.damage).length !== 0 &&
            setState({
              type: 'removed',
              payload: { target: { name: 'damage' } },
            })
          )}
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'doesDamage'
          ) &&
            Object.keys(state.damage).length !== 0 && (
              <>
                <div
                  className='btn btn-section-collapse justify-content-between align-items-center'
                  id='sectionCollapseButton'
                  type='button'
                  role='button'
                  data-bs-toggle='collapse'
                  data-bs-target='#sectionCollapse'
                  aria-controls='collapseExample'
                  aria-expanded='true'
                >
                  <span className='me-3'>Damage Table</span>
                  <i className='bi bi-arrow-down-up' />
                </div>
                <div
                  className='section-container collapse show'
                  id='sectionCollapse'
                >
                  <div className='section-content'>
                    <Table
                      rows={{
                        inputs: damageTableColumns(state.damage).inputs,
                        headers: damageTableColumns(state.damage).headers,
                      }}
                      className={`row-cols-lg-${
                        damageTableColumns(state.damage).inputs.length + 1
                      }`}
                      name='damage.damageByLevel'
                      value={state.damage?.damageByLevel}
                      onChange={setState}
                      dynamic={true}
                      scrollable={true}
                    />
                  </div>
                </div>
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
          {state.feature?.length > 0 && (
            <TabNavigation
              id='feature'
              tabState={state.feature?.map((featureItem, featureIndex) => {
                const stateName = `feature.${featureIndex}`
                return {
                  value:
                    featureItem.value == null || featureItem.value === ''
                      ? startCase(`feature ${featureIndex + 1}`)
                      : featureItem.value,
                  name: stateName,
                  content: featureTabContent(stateName, featureItem),
                }
              })}
              reorder={true}
              contentState={state.feature}
              setState={setState}
              dynamic={true}
            />
          )}
        </>
      ),
    },
  ]

  content = (
    <>
      <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
        <div className='col-auto'>
          <h3>Create a Feat</h3>
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
          tabState={mainTabContent.map((content) => ({
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
export default NewFeatForm
