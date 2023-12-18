import { useState, useEffect, useReducer, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  selectAllRaces,
  useAddNewRaceMutation,
  useGetRacesQuery,
} from './racesApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../spells/spellsApiSlice'
import { selectAllFeats, useGetFeatsQuery } from '../feats/featsApiSlice'
import { selectAllItems, useGetItemsQuery } from '../items/itemsApiSlice'
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
import TabNavigation from '../../components/TabNavigation/TabNavigation'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'

const NewRaceForm = () => {
  const navigate = useNavigate()

  const isLoading = useSelector(selectLoadingStatus)

  const { data: builders } = useGetBuildersQuery('buildersList')

  const { classes } = useGetClassesQuery('classesList', {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  const { races } = useGetRacesQuery('racesList', {
    selectFromResult: ({ data }) => ({ races: data && selectAllRaces(data) }),
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
    addNewRace,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewRaceMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const textRefs = useRef([])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Race added successfully!')
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
      await addNewRace(state)
    } else {
      setErrorMessage('Please fill out all required fields')
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }

  const onSubrace = () => {
    if (state.category?.name === 'subrace' && state.lineage && !state.feature) {
      setState({
        payload: {
          target: {
            name: 'feature',
            value: races.find((race) => race._id === state.lineage?.id).feature,
          },
        },
      })
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
      size: inputItem.size,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  const sectionTabContent = (name, sectionItem, sectionIndex) => {
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
                    name={`${name}.${sectionIndex}.${this.name}.${index}.attribute`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${name}.${sectionIndex}.${this.name}.${index}.feat`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.selectionCount`}
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
                    name={`${name}.${sectionIndex}.${this.name}.${index}.attribute`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${name}.${sectionIndex}.${this.name}.${index}.module`}
                    label='Modifier Category'
                    value={item.module}
                    options={builders.modifier.module}
                    required={true}
                    onChange={setState}
                  />
                  {item.module?.name && (
                    <Select
                      name={`${name}.${sectionIndex}.${this.name}.${index}.modType`}
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
                          name={`${name}.${sectionIndex}.${this.name}.${index}.limitUse.resetOption`}
                          label='Reset Option'
                          value={item.limitUse?.resetOption}
                          options={builders.feature.chargeReset}
                          required={true}
                          onChange={setState}
                        />
                        <Select
                          name={`${name}.${sectionIndex}.${this.name}.${index}.limitUse.feature`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.ability`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.saveAbility`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.skill`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.damageSave`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.conditionSave`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.method`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.condition`}
                      multiple={true}
                      label='Condition Type'
                      value={item.condition}
                      options={builders.condition}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'speed' ? (
                    <Select
                      name={`${name}.${sectionIndex}.${this.name}.${index}.speed`}
                      multiple={true}
                      value={item.speed}
                      label='Speed Type'
                      options={builders.speed}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'passive' ? (
                    <Select
                      name={`${name}.${sectionIndex}.${this.name}.${index}.passive`}
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
                        name={`${name}.${sectionIndex}.${this.name}.${index}.damage`}
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
                        name={`${name}.${sectionIndex}.${this.name}.${index}.method.setValue`}
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
                        name={`${name}.${sectionIndex}.${this.name}.${index}.method.ability`}
                        label='Method Ability'
                        value={item.method.ability}
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        validation='num'
                        name={`${name}.${sectionIndex}.${this.name}.${index}.multiplier`}
                        label='Multiplier'
                        invalidText='Must contain only whole numbers'
                        autoComplete='off'
                        value={item.multiplier}
                        onChange={setState}
                      />
                    </>
                  ) : item.method?.name === 'setValue' &&
                    item.modType?.name === 'setDieValue' ? (
                    <>
                      <Input
                        validation='num'
                        name={`${name}.${sectionIndex}.${this.name}.${index}.dieCount`}
                        label='Die Count'
                        invalidText='Must contain only whole numbers'
                        autoComplete='off'
                        value={item.dieCount}
                        onChange={setState}
                      />
                      <Input
                        validation='num'
                        name={`${name}.${sectionIndex}.${this.name}.${index}.dieValue`}
                        label='Die Value'
                        invalidText='Must contain only whole numbers'
                        autoComplete='off'
                        value={item.dieValue}
                        onChange={setState}
                      />
                    </>
                  ) : (
                    item.method?.name === 'skill' && (
                      <>
                        <Select
                          name={`${name}.${sectionIndex}.${this.name}.${index}.method.skill`}
                          label='Method Skill'
                          value={item.method.skill}
                          options={builders.skill}
                          required={true}
                          onChange={setState}
                        />
                        <Input
                          validation='num'
                          name={`${name}.${sectionIndex}.${this.name}.${index}.multiplier`}
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
                        name={`${name}.${sectionIndex}.${this.name}.${index}.maxValue`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.selectionCount`}
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
                          name: `${name}.${sectionIndex}.${this.name}.${index}.diePerLevel`,
                        },
                      },
                    })
                  ) : (
                    <Table
                      name={`${name}.${sectionIndex}.${this.name}.${index}.diePerLevel`}
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
                        name: `${name}.${sectionIndex}.${this.name}.${index}.diePerLevel`,
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
                          name: `${name}.${sectionIndex}.${this.name}.${index}.addPerLevel`,
                        },
                      },
                    })
                  ) : (
                    <Table
                      name={`${name}.${sectionIndex}.${this.name}.${index}.addPerLevel`}
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
                        name: `${name}.${sectionIndex}.${this.name}.${index}.addPerLevel`,
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
                    name={`${name}.${sectionIndex}.${this.name}.${index}.attribute`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${name}.${sectionIndex}.${this.name}.${index}.area`}
                    label='Proficiency Area'
                    value={item.area}
                    options={builders.proficiency.area}
                    required={true}
                    onChange={setState}
                  />
                  {item?.area?.name === 'skill' && (
                    <Select
                      name={`${name}.${sectionIndex}.${this.name}.${index}.skill`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.saveAbility`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.language`}
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
                        name={`${name}.${sectionIndex}.${this.name}.${index}.category`}
                        multiple={true}
                        label='Item Category'
                        value={item.category}
                        options={builders.item.category}
                        onChange={setState}
                      />
                      {item.area?.name === 'property' && (
                        <Select
                          name={`${name}.${sectionIndex}.${this.name}.${index}.property`}
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
                          name={`${name}.${sectionIndex}.${this.name}.${index}.itemType`}
                          multiple={true}
                          label='Item Type'
                          value={item.itemType}
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
                    name={`${name}.${sectionIndex}.${this.name}.${index}.level`}
                    label='Proficiency Level'
                    value={item.level}
                    options={builders.proficiency.level}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`${name}.${sectionIndex}.${this.name}.${index}.selectionCount`}
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
                    multiple='true'
                    name={`${name}.${sectionIndex}.${this.name}.${index}.attribute`}
                    options={builders.section.attribute}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    required={true}
                    onChange={setState}
                  />
                  {sectionItem.attribute?.some(
                    (item) => item.name === 'optionGroups'
                  ) && (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`${name}.${sectionIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${name}.${sectionIndex}.${this.name}.${index}.sense`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.selectionCount`}
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
                    name={`${name}.${sectionIndex}.${this.name}.${index}.attribute`}
                    options={[].concat(
                      builders.section.spell.attribute,
                      builders.section.attribute
                    )}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'classLimit'
                  ) && (
                    <Select
                      name={`${name}.${sectionIndex}.${this.name}.${index}.classLimit`}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.levelLimit`}
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
                    (attributeItem) => attributeItem.name === 'subtypeSpecific'
                  ) && (
                    <Select
                      name={`${name}.${sectionIndex}.${this.name}.${index}.subtype`}
                      label='Subtype'
                      value={item.subtype}
                      options={state.subtype}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
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
                            name: `${name}.${sectionIndex}.${this.name}.${index}.spellsByLevel`,
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
                          name={`${name}.${sectionIndex}.${this.name}.${index}.spellsByLevel`}
                          value={item.spellsByLevel}
                          onChange={setState}
                        />
                      </>
                    )
                  ) : (
                    <>
                      {!!item.spellsByLevel &&
                        setState({
                          type: 'removed',
                          payload: {
                            target: {
                              name: `${name}.${sectionIndex}.${this.name}.${index}.spellsByLevel`,
                            },
                          },
                        })}
                      <Select
                        name={`${name}.${sectionIndex}.${this.name}.${index}.spell`}
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
                          name={`${name}.${sectionIndex}.${this.name}.${index}.ability`}
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
                          name={`${name}.${sectionIndex}.${this.name}.${index}.selectionCount`}
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
                </div>
              </Fragment>
            )
          })
        },
      },
    ]
    return tabContent
  }

  const featureTabContent = (name, optionItem, optionIndex) => (
    <Fragment key={optionIndex}>
      <div className='row justify-content-between g-2 pb-2'>
        <Input
          size='col-sm-3'
          name={`${name}.${optionIndex}.value`}
          autoComplete='off'
          label='Feature Name'
          value={optionItem.value}
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
            {sectionTabContent(optionItem, optionIndex).map(
              (sectionItem, sectionIndex) => (
                <li key={sectionIndex} className='dropdown-item'>
                  <button
                    key={sectionIndex}
                    className='dropdown-item'
                    type='button'
                    name={`${name}.${optionIndex}.${sectionItem.name}`}
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
        value={optionItem.desc}
        name={`${name}.${optionIndex}.desc`}
        onChange={setState}
      />
      <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-3'>
        <Select
          multiple={true}
          name={`${name}.${optionIndex}.attribute`}
          options={[].concat(
            builders.feature.attribute,
            builders.feature.race.attribute
          )}
          label='Feature Attributes'
          value={optionItem.attribute}
          onChange={setState}
        />
        {optionItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'ancestrySpecific'
        ) && (
          <Select
            multiple={true}
            name={`${name}.${optionIndex}.ancestry`}
            options={state.ancestry}
            label='Ancestry'
            value={optionItem.ancestry}
            required={true}
            onChange={setState}
          />
        )}
        {optionItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitUse'
          ) && (
          <>
            <Select
              name={`${name}.${optionIndex}.limitUse.limitBy`}
              label='Limit By Option'
              value={optionItem.limitUse?.limitBy}
              options={builders.feature.chargeLimit}
              required={true}
              onChange={setState}
            />
            {optionItem.limitUse?.limitBy?.name === 'ability' ? (
              <>
                <Select
                  name={`${name}.${optionIndex}.limitUse.ability`}
                  label='Ability'
                  value={optionItem.limitUse?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name={`${name}.${optionIndex}.limitUse.minValue`}
                  autoComplete='off'
                  label='Minimal Value'
                  value={optionItem?.limitUse?.minValue}
                  onChange={setState}
                />
              </>
            ) : optionItem.limitUse?.limitBy?.name === 'skill' ? (
              <Select
                name={`${name}.${optionIndex}.limitUse.skill`}
                label='Skill'
                value={optionItem.limitUse?.skill}
                options={builders.skill}
                required={true}
                onChange={setState}
              />
            ) : (
              optionItem.limitUse?.limitBy?.name === 'setValue' && (
                <Input
                  validation='num'
                  type='text'
                  name={`${name}.${optionIndex}.limitUse.setValue`}
                  invalidText='Must contain only numbers'
                  label='Use Amount'
                  value={optionItem.limitUse?.setValue}
                  required={true}
                  onChange={setState}
                />
              )
            )}
            {optionItem.limitUse?.limitBy?.name !== 'level' && (
              <Input
                name={`${name}.${optionIndex}.limitUse.addValue`}
                autoComplete='off'
                label='Additional Amount'
                value={optionItem?.limitUse?.addValue}
                onChange={setState}
              />
            )}
            <Select
              name={`${name}.${optionIndex}.limitUse.resetOption`}
              label='Reset Option'
              value={optionItem.limitUse?.resetOption}
              options={builders.feature.chargeReset}
              required={true}
              onChange={setState}
            />
          </>
        )}
        {optionItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'isAction'
        ) && (
          <>
            <Select
              name={`${name}.${optionIndex}.action`}
              label='Action Type'
              value={optionItem.action}
              options={builders.feature.action}
              required={true}
              onChange={setState}
            />
          </>
        )}
        {optionItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'hasRange'
        ) && (
          <>
            <Input
              validation='num'
              name={`${name}.${optionIndex}.range.minRange`}
              autoComplete='off'
              label='Min Range'
              required={true}
              value={optionItem.range?.minRange}
              invalidText='Must contain only numbers'
              onChange={setState}
            />
            <Input
              validation='num'
              name={`${name}.${optionIndex}.range.maxRange`}
              autoComplete='off'
              label='Max Range'
              required={true}
              invalidText='Must contain only numbers'
              value={optionItem.range?.maxRange}
              onChange={setState}
            />
            <Select
              name={`${name}.${optionIndex}.range.unit`}
              label='UoM'
              value={optionItem.range?.unit}
              options={[].concat(
                Object.values(builders.unit.imperial).flatMap((item) => item)
              )}
              optionalKey='short'
              onChange={setState}
            />
          </>
        )}
        {optionItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'requireSave'
        ) && (
          <>
            <Select
              name={`${name}.${optionIndex}.saveAbility.attribute`}
              multiple={true}
              label='Save Attribute'
              value={optionItem.saveAbility?.attribute}
              options={builders.feature.saveAttribute}
              onChange={setState}
            />
            <Select
              name={`${name}.${optionIndex}.saveAbility.ability`}
              label='DC Ability'
              value={optionItem.saveAbility?.ability}
              options={builders.ability}
              required={true}
              onChange={setState}
            />
            <Input
              validation='num'
              name={`${name}.${optionIndex}.saveAbility.minValue`}
              autoComplete='off'
              label='Min. Value'
              required={true}
              invalidText='Must contain only numbers'
              value={optionItem.saveAbility?.minValue}
              onChange={setState}
            />
            {optionItem.saveAbility?.attribute?.some(
              (attributeItem) => attributeItem.name === 'addAbilityModifier'
            ) && (
              <Select
                name={`${name}.${optionIndex}.saveAbility.abilityModifier`}
                label='Modifier Ability'
                value={optionItem.saveAbility?.abilityModifier}
                options={builders.ability}
                required={true}
                onChange={setState}
              />
            )}
          </>
        )}
        {optionItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'hasRequirements'
        ) && (
          <Select
            multiple={true}
            name={`${name}.${optionIndex}.requirement.option`}
            label='Requirement'
            options={builders.feature.requirement}
            value={optionItem.requirement?.option}
            required={true}
            onChange={setState}
          />
        )}
      </div>
      {optionItem.attribute?.some(
        (attributeItem) => attributeItem.name === 'hasRequirements'
      ) &&
        !optionItem.requirement?.option?.every(
          (optionItem) => optionItem.name === 'notProficient'
        ) && (
          <>
            <div className='d-flex'>
              <hr className='flex-grow-1 me-3' />
              <span className='mx-auto'>Requirements</span>
              <hr className='flex-grow-1 ms-3' />
            </div>
            <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
              {optionItem.requirement?.option?.some(
                (optionItem) => optionItem.name === 'skillProficiency'
              ) && (
                <Select
                  multiple={true}
                  name={`${name}.${optionIndex}.requirement.skillProficiency.skill`}
                  value={optionItem.requirement?.skillProficiency?.skill}
                  label='Skill Proficiency'
                  options={builders.skill}
                  required={true}
                  onChange={setState}
                />
              )}
              {optionItem.requirement?.option?.some(
                (optionItem) => optionItem.name === 'abilityScore'
              ) && (
                <>
                  <Select
                    multiple={true}
                    name={`${name}.${optionIndex}.requirement.abilityScore.ability`}
                    value={optionItem.requirement?.abilityScore?.ability}
                    label='Ability'
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                  <Input
                    name={`${name}.${optionIndex}.requirement.abilityScore.score`}
                    value={optionItem.requirement?.abilityScore?.score}
                    label='Ability Score'
                    required={true}
                    validation='num'
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                </>
              )}
              {optionItem.requirement?.option?.some(
                (optionItem) => optionItem.name === 'size'
              ) && (
                <>
                  <Select
                    multiple={true}
                    name={`${name}.${optionIndex}.requirement.size`}
                    value={optionItem.requirement?.size}
                    label='Size'
                    options={builders.race.size}
                    required={true}
                    onChange={setState}
                  />
                </>
              )}
            </div>
            {optionItem.requirement?.option?.some(
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
                    name={`${name}.${optionIndex}.requirement.itemProficiency.category`}
                    value={optionItem.requirement?.itemProficiency?.category}
                    label='Item Category'
                    options={builders.item.category}
                    onChange={setState}
                  />
                  <Select
                    name={`${name}.${optionIndex}.requirement.itemProficiency.property`}
                    multiple={true}
                    label='Item Property'
                    value={optionItem.requirement?.itemProficiency?.property}
                    options={[].concat(
                      ...items
                        .filter((item) =>
                          optionItem.requirement?.itemProficiency?.category
                            ?.length > 0
                            ? optionItem.requirement?.itemProficiency?.category?.some(
                                (category) =>
                                  category.name === item.category.name
                              )
                            : item
                        )
                        .filter((item) =>
                          optionItem.requirement?.itemProficiency?.itemType
                            ?.length > 0
                            ? optionItem.requirement?.itemProficiency?.itemType?.some(
                                (type) => type.name === item.name
                              )
                            : item
                        )
                        .map((item) => item.property)
                    )}
                    onChange={setState}
                  />
                  <Select
                    name={`${name}.${optionIndex}.requirement.itemProficiency.itemType`}
                    multiple={true}
                    label='Item type'
                    value={optionItem.requirement?.itemProficiency?.itemType}
                    options={items.filter((item) =>
                      optionItem.requirement.itemProficiency?.category
                        ?.length > 0
                        ? optionItem.requirement.itemProficiency?.category?.some(
                            (category) => category.name === item.category.name
                          )
                        : item
                    )}
                    onChange={setState}
                  />
                </div>
              </>
            )}
            {optionItem.requirement?.option?.some(
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
                    name={`${name}.${optionIndex}.requirement.equipped.numberEquipped`}
                    value={optionItem.requirement?.equipped?.numberEquipped}
                    label='Number Equipped'
                    onChange={setState}
                    validation='num'
                    invalidText={'Must contain only numbers'}
                  />
                  <Select
                    multiple={true}
                    name={`${name}.${optionIndex}.requirement.equipped.category`}
                    value={optionItem.requirement?.equipped?.category}
                    label='Item Category'
                    options={builders.item.category}
                    onChange={setState}
                  />
                  <Select
                    multiple={true}
                    name={`${name}.${optionIndex}.requirement.equipped.property`}
                    label='Item Property'
                    value={optionItem.requirement?.equipped?.property}
                    options={[].concat(
                      ...items
                        .filter((item) =>
                          optionItem.requirement?.equipped?.category?.length >
                          0
                            ? optionItem.requirement?.equipped?.category?.some(
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
                    name={`${name}.${optionIndex}.requirement.equipped.itemType`}
                    label='Item type'
                    value={optionItem.requirement?.equipped?.itemType}
                    options={items.filter((item) =>
                      optionItem.requirement.equipped?.category?.length > 0
                        ? optionItem.requirement.equipped?.category?.some(
                            (category) => category.name === item.category.name
                          )
                        : item
                    )}
                    onChange={setState}
                  />
                </div>
              </>
            )}
            {optionItem.requirement?.option?.some(
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
                    name={`${name}.${optionIndex}.requirement.notEquipped.category`}
                    value={optionItem.requirement?.notEquipped?.category}
                    label='Item Category'
                    options={builders.item.category}
                    onChange={setState}
                  />
                  <Select
                    multiple={true}
                    name={`${name}.${optionIndex}.requirement.notEquipped.property`}
                    value={optionItem.requirement?.notEquipped?.property}
                    label='Item Property'
                    options={[].concat(
                      ...items
                        .filter((item) =>
                          optionItem.requirement.notEquipped?.category
                            ?.length > 0
                            ? optionItem.requirement.notEquipped?.category?.some(
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
                    name={`${name}.${optionIndex}.requirement.notEquipped.itemType`}
                    label='Item type'
                    value={optionItem.requirement?.notEquipped?.itemType}
                    options={items.filter((item) =>
                      optionItem.requirement.notEquipped?.category?.length > 0
                        ? optionItem.requirement.notEquipped?.category?.some(
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
      {optionItem.limitUse?.limitBy?.name === 'level' &&
        optionItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitUse'
        ) &&
        (!optionItem.limitUse.level ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: `${name}.${optionIndex}.limitUse.level`,
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
              data-bs-target={`#limitUse${optionIndex}Collapse`}
              aria-controls='collapseExample'
              aria-expanded='true'
            >
              <span className='me-3'>Limit Use Table</span>
              <i className='bi bi-arrow-down-up' />
            </div>
            <div
              className='section-container collapse show'
              id={`limitUse${optionIndex}Collapse`}
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
                  name={`${name}.${optionIndex}.limitUse.level`}
                  value={optionItem.limitUse?.level}
                  onChange={setState}
                  dynamic={true}
                />
              </div>
            </div>
          </>
        ))}
      {optionItem.attribute?.some(
        (attributeItem) => attributeItem.name === 'doesDamage'
      ) ? (
        !optionItem.damage?.damageByLevel ? (
          setState({
            type: 'added',
            payload: {
              target: {
                name: `${name}.${optionIndex}.damage.damageByLevel`,
              },
            },
          })
        ) : (
          <>
            <div className='row g-2 align-items-end pb-2'>
              <Select
                multiple={true}
                name={`${name}.${optionIndex}.damage.damageAttribute`}
                label='Damage Attribute'
                value={optionItem.damage?.damageAttribute}
                options={builders.feature.damageAttribute}
                onChange={setState}
              />
              <Select
                name={`${name}.${optionIndex}.damage.damageType`}
                multiple={true}
                label='Damage Type'
                value={optionItem.damage?.damageType}
                options={builders.damage}
                required={true}
                onChange={setState}
              />
              {optionItem.damage?.damageAttribute?.some(
                (attributeItem) => attributeItem.name === 'bonusDamage'
              ) && (
                <Select
                  name={`${name}.${optionIndex}.damage.bonus.bonusAttribute`}
                  label='Bonus Type'
                  value={optionItem.damage?.bonus?.bonusAttribute}
                  options={builders.feature.bonusAttribute}
                  required={true}
                  onChange={setState}
                />
              )}
              {optionItem.damage?.bonus?.bonusAttribute?.name ===
                'abilityBonus' && (
                <Select
                  name={`${name}.${optionIndex}.damage.bonus.ability`}
                  label='Abilty'
                  value={optionItem.damage?.bonus?.ability}
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
              data-bs-target={`#section${optionIndex}Collapse`}
              aria-controls='collapseExample'
              aria-expanded='true'
            >
              <span className='me-3'>Damage Table</span>
              <i className='bi bi-arrow-down-up' />
            </div>
            <div
              className='section-container collapse show'
              id={`section${optionIndex}Collapse`}
            >
              <div className='section-content'>
                <Table
                  rows={{
                    inputs: damageTableColumns(optionItem.damage).inputs,
                    headers: damageTableColumns(optionItem.damage).headers,
                  }}
                  className={`row-cols-lg-${
                    damageTableColumns(optionItem.damage).inputs.length + 1
                  }`}
                  name={`${name}.${optionIndex}.damage.damageByLevel`}
                  value={optionItem.damage?.damageByLevel}
                  onChange={setState}
                  dynamic={true}
                  scrollable={true}
                />
              </div>
            </div>
          </>
        )
      ) : (
        optionItem.damage != null &&
        Object.keys(optionItem.damage).length !== 0 &&
        setState({
          type: 'removed',
          payload: { target: { name: `${name}.${optionIndex}.damage` } },
        })
      )}
      {Object.keys(optionItem)?.length !== 0 &&
        Object.keys(optionItem)?.some(
          (key) => optionItem[key]?.length !== 0
        ) && (
          <TabNavigation
            id={`section${optionIndex}`}
            tabState={[].concat(
              ...sectionTabContent(optionItem, optionIndex)
                .filter(
                  (sectionItem) => optionItem[sectionItem.name]?.length > 0
                )
                ?.map((sectionItem) =>
                  sectionItem.content().map((contentItem, contentIndex) => ({
                    value: startCase(`${sectionItem.name} ${contentIndex + 1}`),
                    name: `${name}.${optionIndex}.${sectionItem.name}.${contentIndex}`,
                    content: contentItem,
                  }))
                )
            )}
            dynamic={true}
            setState={setState}
          />
        )}
    </Fragment>
  )

  const mainTabContent = [
    {
      name: 'details',
      content: (
        <>
          <div className='row g-2 pb-2'>
            <Input
              name='value'
              autoComplete='off'
              label='Race Name'
              required={true}
              value={state.value}
              onChange={setState}
              autoFocus={true}
            />
            <Select
              name='category'
              label='Race Category'
              value={state?.category}
              options={builders.race?.category}
              required={true}
              onChange={setState}
            />
            {state.category?.name && state.category?.name !== 'base' && (
              <Select
                multiple={state.category.name === 'variant' && true}
                name='lineage'
                label='Race Lineage'
                value={state?.lineage}
                options={races}
                required={true}
                onChange={setState}
              />
            )}
            {state.category?.name === 'subrace' &&
              state?.lineage &&
              onSubrace()}
          </div>
          <TextEditor
            ref={addToTextRefs}
            name={'quote'}
            value={state?.quote}
            label={'Opening Quote'}
            onChange={setState}
          />
          <button
            className='btn btn-secondary'
            type='button'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'details' } },
              })
            }
          >
            Add Detail
          </button>
          <TabNavigation
            id='details'
            tabState={state.details?.map((detailItem, detailIndex) => ({
              value:
                detailItem.name == null || detailItem.name === ''
                  ? startCase(`detail ${detailIndex + 1}`)
                  : detailItem.name,
              name: `details.${detailIndex}`,
              content: (
                <div key={detailIndex}>
                  <div className='col-auto pb-3'>
                    <Input
                      size='col-sm-3'
                      name={`details.${detailIndex}.value`}
                      autoComplete='off'
                      label='Detail Name'
                      value={detailItem.value}
                      onChange={setState}
                    />
                  </div>
                  <TextEditor
                    ref={addToTextRefs}
                    name={`details.${detailIndex}.desc`}
                    value={detailItem.desc}
                    label={'Section Description'}
                    onChange={setState}
                  />
                </div>
              ),
            }))}
            setState={setState}
            dynamic={true}
          />
        </>
      ),
    },
    {
      name: 'traits',
      content: (
        <>
          <TextEditor
            ref={addToTextRefs}
            name='traits.desc'
            value={state.traits?.desc}
            label={'Traits Description'}
            onChange={setState}
          />
          <div className='row g-2 pb-2 row-cols-lg-4 row-cols-md-3 row-cols-2'>
            <Select
              multiple={true}
              name='attribute'
              label='Attributes'
              value={state.attribute}
              options={builders.race.attribute}
              required={true}
              onChange={setState}
            />
            <Select
              name='traits.size'
              label='Size'
              value={state.traits?.size}
              options={builders.race.size}
              required={true}
              onChange={setState}
            />
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'walking'
            ) && (
              <Input
                validation='num'
                name='traits.speed.walking'
                label='Walking Speed'
                invalidText='Must contain only numbers'
                value={state.traits?.speed?.walking}
                required={true}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'climbing'
            ) && (
              <Input
                validation='num'
                name='traits.speed.climbing'
                label='Climbing Speed'
                invalidText='Must contain only numbers'
                required={true}
                value={state.traits?.speed?.climbing}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'swimming'
            ) && (
              <Input
                validation='num'
                name='traits.speed.swimming'
                label='Swimming Speed'
                invalidText='Must contain only numbers'
                required={true}
                value={state.traits?.speed?.swimming}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'flying'
            ) && (
              <Input
                validation='num'
                name='traits.speed.flying'
                label='Flying Speed'
                invalidText='Must contain only numbers'
                required={true}
                value={state.traits?.speed?.flying}
                onChange={setState}
              />
            )}
          </div>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'ancestryOptions'
          ) ? (
            !state.ancestry ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: 'ancestry',
                  },
                },
              })
            ) : (
              <>
                <Table
                  rows={{
                    inputs: [
                      {
                        name: 'ancestry',
                        value: 'Ancestry',
                        size: 'col-lg-3 col-md-4 col-sm-12',
                      },
                      {
                        name: 'description',
                        value: 'Description',
                        size: 'col-sm',
                      },
                    ],
                    headers: [
                      {
                        value: 'Ancestry',
                        readOnly: true,
                        size: 'col-lg-3 col-md-4 col-sm-12',
                      },
                      { value: 'Description', readOnly: true, size: 'col-sm' },
                    ],
                  }}
                  name='ancestry'
                  value={state?.ancestry}
                  onChange={setState}
                  dynamic={true}
                />
              </>
            )
          ) : (
            state.ancestry &&
            setState({
              type: 'removed',
              payload: { target: { name: 'ancestry' } },
            })
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
                const name = 'feature'
                return {
                  value:
                    featureItem.value == null || featureItem.value === ''
                      ? startCase(`${name} ${featureIndex + 1}`)
                      : featureItem.value,
                  name: `${name}.${featureIndex}`,
                  content: featureTabContent(name, featureItem, featureIndex),
                }
              })}
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
          <h3>Create a Race</h3>
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
export default NewRaceForm
