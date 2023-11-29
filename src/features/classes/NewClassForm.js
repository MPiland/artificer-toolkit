import { useState, useEffect, useReducer, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAddNewClassMutation,
  useGetClassesQuery,
  selectAllClasses,
} from './classesApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../spells/spellsApiSlice'
import { selectAllFeats, useGetFeatsQuery } from '../feats/featsApiSlice'
import { selectAllItems, useGetItemsQuery } from '../items/itemsApiSlice'
import { startCase } from 'lodash'
import { handleValidation } from '../../helpers/form'
import { useSelector } from 'react-redux'
import { selectLoadingStatus } from '../../app/loadingSlice'
import useMediaQuery from '../../hooks/useMediaQuery'
import formReducer from '../../hooks/useReducer'
import Spinner from '../../components/Spinner'
import TabNavigation from '../../components/TabNavigation'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'

const NewClassForm = () => {
  const navigate = useNavigate()

  const isLoading = useSelector(selectLoadingStatus)

  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

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
    addNewClass,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewClassMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [levelTableColumns, setLevelTableColumns] = useState()
  const textRefs = useRef([])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Class added successfully!')
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
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
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

  useEffect(() => {
    const spellCaster = state?.attribute?.some(
      (attributeItem) => attributeItem.name === 'spellCaster'
    )

    !state?.levelAttribute &&
      setState({
        type: 'added',
        payload: { target: { name: 'levelAttribute' } },
      })
    spellCaster &&
      state?.levelAttribute?.map(
        (levelAttributeItem, levelAttributeIndex) =>
          !levelAttributeItem?.spellSlots &&
          setState({
            type: 'added',
            payload: {
              target: {
                name: `levelAttribute.${levelAttributeIndex}.spellSlots`,
              },
            },
          })
      )

    const inputArray = [
      {
        name: 'level',
        value: 'Level',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: spellCaster
          ? is1000
            ? 'col-1'
            : is600
            ? 'col-2'
            : 'col'
          : 'col',
        required: true,
      },
    ]
    if (state?.category?.name === 'base') {
      inputArray.push({
        name: 'proficiencyBonus',
        value: 'Prof. Bonus',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: spellCaster
          ? is1000
            ? 'col-1'
            : is600
            ? 'col-2'
            : 'col'
          : 'col',
      })
    }
    if (spellCaster) {
      if (
        state?.spellcasting?.attribute?.some(
          (attributeItem) => attributeItem.name === 'limitKnownSpells'
        )
      ) {
        inputArray.push({
          name: 'spellsKnown',
          value: 'Spells Known',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: spellCaster
            ? is1000
              ? 'col-1'
              : is600
              ? 'col-2'
              : 'col'
            : 'col',
        })
      }
      if (state?.spellcasting?.maxSpellLevel) {
        for (let i = 0; i <= state.spellcasting?.maxSpellLevel; i++) {
          inputArray.push({
            name: `spellSlots.${i}.slotCount`,
            value: `${i}`,
            invalid: 'Must contain only numbers',
            validation: 'num',
            size: spellCaster
              ? is1000
                ? 'col-1'
                : is600
                ? 'col-2'
                : 'col'
              : 'col',
          })
        }
      }
    }

    const headerArray = inputArray.map((inputItem) => ({
      value: inputItem.value,
      readOnly: true,
      size: inputItem.size,
    }))

    setLevelTableColumns({ inputs: inputArray, headers: headerArray })
  }, [is1000, is600, state])

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
      await addNewClass(state)
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
      size: inputItem.size,
    }))

    return { inputs: inputArray, headers: headerArray }
  }

  const sectionTabContent = (name, optionItem, optionIndex) => {
    const tableContent = [
      {
        name: 'feat',
        content() {
          return optionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`${name}.${optionIndex}.${this.name}.${index}.attribute`}
                    options={[].concat(
                      builders.section.attribute,
                      state.category?.name === 'subclass' &&
                        builders.section.subclass.attribute
                    )}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'subtypeSpecific'
                  ) && (
                    <Select
                      name={`${name}.${optionIndex}.${this.name}.${index}.subtype`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${name}.${optionIndex}.${this.name}.${index}.feat`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.selectionCount`}
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
          return optionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`${name}.${optionIndex}.${this.name}.${index}.attribute`}
                    options={[].concat(
                      builders.section.attribute,
                      state.category?.name === 'subclass' &&
                        builders.section.subclass.attribute
                    )}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'subtypeSpecific'
                  ) && (
                    <Select
                      name={`${name}.${optionIndex}.${this.name}.${index}.subtype`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${name}.${optionIndex}.${this.name}.${index}.module`}
                    label='Modifier Category'
                    value={item.module}
                    options={builders.modifier.module}
                    required={true}
                    onChange={setState}
                  />
                  {item.module?.name && (
                    <Select
                      name={`${name}.${optionIndex}.${this.name}.${index}.modType`}
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
                          name={`${name}.${optionIndex}.${this.name}.${index}.limitUse.resetsOn`}
                          label='Reset Option'
                          value={item.limitUse?.resetsOn}
                          options={builders.feature.chargeReset}
                          required={true}
                          onChange={setState}
                        />
                        <Select
                          name={`${name}.${optionIndex}.${this.name}.${index}.limitUse.feature`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.ability`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.saveAbility`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.skill`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.damageSave`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.conditionSave`}
                      multiple={true}
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
                        name={`${name}.${optionIndex}.${this.name}.${index}.method`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.condition`}
                      multiple={true}
                      label='Condition Type'
                      value={item.condition}
                      options={builders.condition}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'speed' ? (
                    <Select
                      name={`${name}.${optionIndex}.${this.name}.${index}.speed`}
                      multiple={true}
                      value={item.speed}
                      label='Speed Type'
                      options={builders.speed}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'passive' ? (
                    <Select
                      name={`${name}.${optionIndex}.${this.name}.${index}.passive`}
                      multiple={true}
                      label='Passive Type'
                      value={item.passive?.options}
                      options={builders.passive}
                      required={true}
                      onChange={setState}
                    />
                  ) : (
                    (item.module?.name === 'damage' ||
                      item.module?.name === 'spellDamage') && (
                      <Select
                        name={`${name}.${optionIndex}.${this.name}.${index}.damage`}
                        multiple={true}
                        label='Damage Type'
                        value={item.damage}
                        options={builders.damage}
                        required={true}
                        onChange={setState}
                      />
                    )
                  )}
                  {item.method?.name === 'setValue' ||
                  item.modType?.name === 'setValue' ? (
                    <>
                      <Input
                        validation='num'
                        name={`${name}.${optionIndex}.${this.name}.${index}.method.setValue`}
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
                        name={`${name}.${optionIndex}.${this.name}.${index}.method.ability`}
                        label='Method Ability'
                        value={item.method.ability}
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        validation='num'
                        name={`${name}.${optionIndex}.${this.name}.${index}.multiplier`}
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
                          name={`${name}.${optionIndex}.${this.name}.${index}.method.skill`}
                          label='Method Skill'
                          value={item.method.skill}
                          options={builders.skill}
                          required={true}
                          onChange={setState}
                        />
                        <Input
                          validation='num'
                          name={`${name}.${optionIndex}.${this.name}.${index}.multiplier`}
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
                        name={`${name}.${optionIndex}.${this.name}.${index}.maxValue`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.selectionCount`}
                      label='# of Selections'
                      autoComplete='off'
                      value={item.selectionCount}
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
                            name: `${name}.${optionIndex}.${this.name}.${index}.addPerLevel`,
                          },
                        },
                      })
                    ) : (
                      <Table
                        name={`${name}.${optionIndex}.${this.name}.${index}.addPerLevel`}
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
            )
          })
        },
      },
      {
        name: 'proficiency',
        content() {
          return optionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`${name}.${optionIndex}.${this.name}.${index}.attribute`}
                    options={[].concat(
                      builders.section.attribute,
                      state.category?.name === 'subclass' &&
                        builders.section.subclass.attribute
                    )}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'subtypeSpecific'
                  ) && (
                    <Select
                      name={`${name}.${optionIndex}.${this.name}.${index}.subtype`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${name}.${optionIndex}.${this.name}.${index}.area`}
                    label='Proficiency Area'
                    value={item.area}
                    options={builders.proficiency.area}
                    required={true}
                    onChange={setState}
                  />
                  {item?.area?.name === 'ability' && (
                    <Select
                      name={`${name}.${optionIndex}.${this.name}.${index}.ability`}
                      multiple={true}
                      label='Ability'
                      value={item.ability}
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item?.area?.name === 'skill' && (
                    <Select
                      name={`${name}.${optionIndex}.${this.name}.${index}.skill`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.saveAbility`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.language`}
                      multiple={true}
                      label='Language'
                      value={item.language}
                      options={builders.language}
                      onChange={setState}
                    />
                  )}
                  {(item.area?.name === 'property' ||
                    item.area?.name === 'itemType') && (
                    <>
                      <Select
                        name={`${name}.${optionIndex}.${this.name}.${index}.category`}
                        multiple={true}
                        label='Item Category'
                        value={item.category}
                        options={builders.item.category}
                        onChange={setState}
                      />
                      {item.area?.name === 'property' && (
                        <Select
                          name={`${name}.${optionIndex}.${this.name}.${index}.property`}
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
                          name={`${name}.${optionIndex}.${this.name}.${index}.itemType`}
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
                    name={`${name}.${optionIndex}.${this.name}.${index}.level`}
                    label='Proficiency Level'
                    value={item.level}
                    options={builders.proficiency.level}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`${name}.${optionIndex}.${this.name}.${index}.selectionCount`}
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
          return optionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`${name}.${optionIndex}.${this.name}.${index}.attribute`}
                    options={[].concat(
                      builders.section.attribute,
                      state.category?.name === 'subclass' &&
                        builders.section.subclass.attribute
                    )}
                    label={`${startCase(this.name)} Attributes`}
                    value={item.attribute}
                    onChange={setState}
                  />
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'subtypeSpecific'
                  ) && (
                    <Select
                      name={`${name}.${optionIndex}.${this.name}.${index}.subtype`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`${name}.${optionIndex}.${this.name}.${index}.sense`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.selectionCount`}
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
          return optionItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple='true'
                    name={`${name}.${optionIndex}.${this.name}.${index}.attribute`}
                    options={[].concat(
                      builders.section.spell.attribute,
                      builders.section.attribute,
                      state.category?.name === 'subclass' &&
                        builders.section.subclass.attribute
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.classLimit`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.levelLimit`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.subtype`}
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
                      name={`${name}.${optionIndex}.${this.name}.${index}.optionGroup`}
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
                        name={`${name}.${optionIndex}.${this.name}.${index}.spell`}
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
                          name={`${name}.${optionIndex}.${this.name}.${index}.ability`}
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
                          name={`${name}.${optionIndex}.${this.name}.${index}.selectionCount`}
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
                    (optionItem.levelAvailable != null &&
                      optionItem.levelAvailable !== '' &&
                      !item.spellsByLevel?.length > 0) ||
                    optionItem?.levelAvailable?.split(', ')?.length !==
                      item.spellsByLevel?.length ? (
                      setState({
                        type: 'added',
                        payload: {
                          target: {
                            name: `${name}.${optionIndex}.${this.name}.${index}.spellsByLevel`,
                            value: optionItem?.levelAvailable
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
                          name={`${name}.${optionIndex}.${this.name}.${index}.spellsByLevel`}
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
                          name: `${name}.${optionIndex}.${this.name}.${index}.spellsByLevel`,
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
    ]
    return tableContent
  }

  const featureTabContent = (name, optionItem, optionIndex, level) => (
    <Fragment key={optionIndex}>
      <div className='row justify-content-between pb-2 gy-2'>
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
        {level !== false && (
          <Input
            name={`${name}.${optionIndex}.levelAvailable`}
            autoComplete='off'
            label='Level(s) Available'
            required={true}
            value={optionItem?.levelAvailable}
            validation={'num'}
            invalidText='Must contain whole numbers and commas only'
            onChange={setState}
          />
        )}
        <Select
          multiple={true}
          name={`${name}.${optionIndex}.attribute`}
          options={[].concat(
            builders.feature.attribute,
            builders.feature.class.attribute
          )}
          label='Feature Attributes'
          value={optionItem.attribute}
          onChange={setState}
        />
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
                  label='Min. Value'
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
              optionItem.limitUse?.limitBy?.name === 'setNumber' && (
                <Input
                  validation='num'
                  type='text'
                  name={`${name}.${optionIndex}.limitUse.setAmount`}
                  invalidText='Must contain only numbers'
                  label='Use Amount'
                  value={optionItem.limitUse?.setAmount}
                  required={true}
                  onChange={setState}
                />
              )
            )}
            <Select
              name={`${name}.${optionIndex}.limitUse.resetsOn`}
              label='Reset Option'
              value={optionItem.limitUse?.resetsOn}
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
              required={true}
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
          (attributItem) => attributItem.name === 'hasRequirements'
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
        (attributItem) => attributItem.name === 'hasRequirements'
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
                  label='Skill Proficiency'
                  value={optionItem.requirement?.skillProficiency?.skill}
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
                    label='Score'
                    required={true}
                    validation='num'
                    invalidText='Must contain only numbers'
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
                <div className='row row-cols-3 g-2 pb-3 mx-3 justify-contents-center'>
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
                      optionItem.requirement.itemProficiency?.category?.length >
                      0
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
                <div className='row row-cols-3 g-2 pb-3 mx-3 justify-contents-center'>
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
                          optionItem.requirement?.equipped?.category?.length > 0
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
                <div className='row row-cols-3 g-2 pb-3 mx-3 justify-contents-center'>
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
                          optionItem.requirement.notEquipped?.category?.length >
                          0
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
      ) ? (
        !optionItem.limitUse.level ? (
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
        )
      ) : (
        optionItem.limitUse?.level?.length > 0 &&
        setState({
          type: 'removed',
          payload: {
            target: { name: `${name}.${optionIndex}.limitUse.level` },
          },
        })
      )}
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
            <div className='row row-cols-4 g-2 align-items-end pb-2'>
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
              ...sectionTabContent(name, optionItem, optionIndex)
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
          <div className='row g-2 pb-2 row-cols-lg-4 row-cols-md-3 row-cols-2'>
            <Input
              name='value'
              autoComplete='off'
              label='Class Name'
              required={true}
              value={state.value}
              onChange={setState}
              autoFocus={true}
            />
            <Select
              name='category'
              label='Class Category'
              value={state?.category}
              options={builders.class.category}
              required={true}
              onChange={setState}
            />
            {state.category?.name === 'subclass' && (
              <Select
                name='parentClass'
                label='Parent Class'
                value={state?.parentClass}
                options={classes.filter(
                  (classItem) => classItem.category.name !== 'subclass'
                )}
                required={true}
                onChange={setState}
              />
            )}
            {state.category?.name !== 'subclass' && (
              <>
                <Input
                  name='hitPoint.diceCount'
                  autoComplete='off'
                  label='HP Dice Count'
                  required={true}
                  value={state.hitPoint?.diceCount}
                  validation='num'
                  invalidText='Must contain whole numbers only'
                  onChange={setState}
                />
                <Input
                  name='hitPoint.diceValue'
                  autoComplete='off'
                  label='HP Dice Value'
                  required={true}
                  value={state.hitPoint?.diceValue}
                  validation='num'
                  invalidText='Must contain whole numbers only'
                  onChange={setState}
                />
              </>
            )}
          </div>
          <TextEditor
            ref={addToTextRefs}
            name={'desc'}
            value={state?.desc}
            label={'Description'}
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
                detailItem.value == null || detailItem.value === ''
                  ? startCase(`detail ${detailIndex + 1}`)
                  : detailItem.value,
              name: `details.${detailIndex}`,
              content: (
                <div key={detailIndex}>
                  <div className='col-auto pb-3'>
                    <Input
                      size='col-sm-3'
                      name={`details.${detailIndex}.value`}
                      label={true}
                      autoComplete='off'
                      placeholder='Detail Name'
                      value={detailItem.value}
                      onChange={setState}
                    />
                  </div>
                  <TextEditor
                    ref={addToTextRefs}
                    name={`details.${detailIndex}.desc`}
                    value={detailItem.desc}
                    placeholder={'Section Description'}
                    onChange={setState}
                  />
                </div>
              ),
            }))}
            onDelete={setState}
            dynamic={true}
          />
        </>
      ),
    },
    {
      name: 'attributes',
      content: (
        <>
          <div className='row g-2 pb-2 row-cols-lg-4 row-cols-md-3 row-cols-2'>
            <>
              <Select
                name='attribute'
                label='Attributes'
                multiple={true}
                value={state.attribute}
                options={builders.class.attribute
                  .filter((attributeItem) =>
                    state.category?.name === 'base'
                      ? attributeItem
                      : attributeItem.name !== 'primaryAbility' &&
                        attributeItem.name !== 'secondaryAbility'
                  )
                  .filter((attributeItem) =>
                    state?.attribute?.some(
                      (item) => item.name === 'primaryAbility'
                    )
                      ? attributeItem
                      : attributeItem.name !== 'optionalAbility'
                  )}
                onChange={setState}
              />
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'spellCaster'
              ) ? (
                <>
                  <Select
                    name='spellcasting.ability'
                    label='Spellcasting Ability'
                    required={true}
                    value={state.spellcasting?.ability}
                    options={builders.ability}
                    onChange={setState}
                  />
                  <Select
                    name='spellcasting.attribute'
                    label='Spell Casting Attributes'
                    multiple={true}
                    value={state.spellcasting?.attribute}
                    options={builders.class.spell.attribute}
                    onChange={setState}
                  />
                  {state.spellcasting?.attribute?.some(
                    (attributeItem) => attributeItem.name === 'preparesSpells'
                  ) && (
                    <Select
                      name='spellcasting.prepareLimit.method'
                      label='Limit Prepared Method'
                      multiple={true}
                      value={state.spellcasting?.prepareLimit?.method}
                      options={builders.class.spell.prepareLimitAttribute}
                      onChange={setState}
                    />
                  )}
                  {state.spellcasting?.prepareLimit?.method?.some(
                    (methodItem) => methodItem.name === 'ability'
                  ) && (
                    <Select
                      name='spellcasting.prepareLimit.ability'
                      label='Limit Prepared Method'
                      value={state.spellcasting?.prepareLimit?.ability}
                      options={[].concat(builders.ability, [
                        {
                          name: 'spellAbility',
                          value: 'Spell Ability',
                        },
                      ])}
                      onChange={setState}
                    />
                  )}
                  {!state.spellcasting?.attribute?.some(
                    (attributeItem) =>
                      attributeItem.name === 'levellessSpellSlots'
                  ) && (
                    <Input
                      name='spellcasting.maxSpellLevel'
                      autoComplete='off'
                      label='Max Spell Level'
                      required={true}
                      value={state.spellcasting?.maxSpellLevel}
                      validation='num'
                      invalidText='Must contain whole numbers only'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name='spellcasting.resetsOn'
                    label='Reset Option'
                    value={state.spellcasting?.resetsOn}
                    options={builders.feature.chargeReset}
                    required={true}
                    onChange={setState}
                  />
                </>
              ) : (
                !!state.spellcasting &&
                setState({
                  type: 'removed',
                  payload: { target: { name: 'spellcasting' } },
                })
              )}
            </>
          </div>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'primaryAbility'
          ) && <h6 className='pb-2'>Multiclass Ability Requirements</h6>}
          <div className='row g-2 pb-2 row-cols-lg-4 row-cols-md-3 row-cols-2'>
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'primaryAbility'
            ) && (
              <>
                <Select
                  name='multiclass.primaryAbility'
                  label='Primary Ability'
                  value={state?.multiclass?.primaryAbility}
                  options={builders.ability
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.secondaryAbility?.name
                    )
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.optionalAbility?.name
                    )}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name='multiclass.primaryAbility.minValue'
                  autoComplete='off'
                  label='Primary Score'
                  required={true}
                  value={state.multiclass?.primaryAbility?.minValue}
                  validation='num'
                  invalidText='Must contain whole numbers only'
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'secondaryAbility'
            ) && (
              <>
                <Select
                  name='multiclass.secondaryAbility'
                  label='Secondary Ability'
                  value={state?.multiclass?.secondaryAbility}
                  options={builders.ability
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.primaryAbility?.name
                    )
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.optionalAbility?.name
                    )}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name='multiclass.secondaryAbility.minValue'
                  autoComplete='off'
                  label='Secondary Score'
                  required={true}
                  value={state.multiclass?.secondaryAbility?.minValue}
                  validation='num'
                  invalidText='Must contain whole numbers only'
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'optionalAbility'
            ) && (
              <>
                <Select
                  name='multiclass.optionalAbility'
                  label='Optional Ability'
                  value={state?.multiclass?.optionalAbility}
                  options={builders.ability
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.primaryAbility?.name
                    )
                    .filter(
                      (abilityItem) =>
                        abilityItem.name !==
                        state.multiclass?.secondaryAbility?.name
                    )}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name='multiclass.optionalAbility.minValue'
                  autoComplete='off'
                  label='Optional Score'
                  required={true}
                  value={state.multiclass?.optionalAbility?.minValue}
                  validation='num'
                  invalidText='Must contain whole numbers only'
                  onChange={setState}
                />
              </>
            )}
          </div>
          {(state.category?.name === 'base' ||
            state.attribute?.some(
              (attributeItem) => attributeItem.name === 'spellCaster'
            )) && (
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
                <span className='me-3'>Attribute Table</span>
                <i className='bi bi-arrow-down-up' />
              </div>
              <div
                className='section-container collapse show mb-2'
                id='sectionCollapse'
              >
                <div className='section-content'>
                  <Table
                    name='levelAttribute'
                    rows={{
                      inputs: levelTableColumns?.inputs,
                      headers: levelTableColumns?.headers,
                    }}
                    value={state?.levelAttribute}
                    onChange={setState}
                    dynamic={true}
                    scrollable={true}
                  />
                </div>
              </div>
            </>
          )}
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'subtypes'
          ) ? (
            !state.subtype ? (
              setState({
                type: 'added',
                payload: { target: { name: 'subtype' } },
              })
            ) : (
              <>
                <div
                  className='btn btn-section-collapse justify-content-between align-items-center'
                  id='sectionCollapseButton'
                  type='button'
                  role='button'
                  data-bs-toggle='collapse'
                  data-bs-target='#subtypeCollapse'
                  aria-controls='collapseExample'
                  aria-expanded='true'
                >
                  <span className='me-3'>Subtypes</span>
                  <i className='bi bi-arrow-down-up' />
                </div>
                <div
                  className='section-container collapse show mb-2'
                  id='subtypeCollapse'
                >
                  <div className='section-content'>
                    <>
                      <Table
                        name='subtype'
                        rows={{
                          inputs: [
                            {
                              name: 'value',
                            },
                          ],
                          headers: [
                            {
                              value: 'Name',
                              readOnly: true,
                            },
                          ],
                        }}
                        value={state.subtype}
                        dynamic={true}
                        onChange={setState}
                      />
                    </>
                  </div>
                </div>
              </>
            )
          ) : (
            !!state.subtype &&
            setState({
              type: 'removed',
              payload: { target: { name: 'subtype' } },
            })
          )}
        </>
      ),
    },
    {
      name: 'proficiencies',
      content: (
        <>
          <button
            className='btn btn-secondary'
            type='button'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'proficiency' } },
              })
            }
          >
            Add Proficiency
          </button>
          {state.proficiency?.length > 0 && (
            <TabNavigation
              id='proficiency'
              tabState={state.proficiency?.map(
                (proficiencyItem, proficiencyIndex) => {
                  const multipleOptions = proficiencyItem.attribute?.some(
                    (attributeItem) => attributeItem.name === 'providesOptions'
                  )
                  return {
                    value:
                      proficiencyItem.value == null ||
                      proficiencyItem.value === ''
                        ? startCase(`proficiency ${proficiencyIndex + 1}`)
                        : proficiencyItem.value,
                    name: `proficiency.${proficiencyIndex}`,
                    content: (
                      <Fragment key={proficiencyIndex}>
                        <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                          <Select
                            multiple={true}
                            name={`proficiency.${proficiencyIndex}.attribute`}
                            options={[].concat(
                              builders.section.attribute,
                              state.category?.name === 'subclass' &&
                                builders.section.subclass.attribute
                            )}
                            label='Proficiency Attribute'
                            value={proficiencyItem.attribute}
                            onChange={setState}
                          />
                          {proficiencyItem.attribute?.some(
                            (attributeItem) =>
                              attributeItem.name === 'subtypeSpecific'
                          ) && (
                            <Select
                              name={`proficiency.${proficiencyIndex}.subtype`}
                              label='Subtype'
                              value={proficiencyItem.subtype}
                              options={state.subtype}
                              required={true}
                              onChange={setState}
                            />
                          )}
                          {proficiencyItem.attribute?.some(
                            (attributeItem) =>
                              attributeItem.name === 'optionGroups'
                          ) && (
                            <Input
                              size='col-sm-2'
                              validation='num'
                              name={`proficiency.${proficiencyIndex}.optionGroup`}
                              label='Opt. Grp. #'
                              autoComplete='off'
                              value={proficiencyItem.optionGroup}
                              invalidText='Must contain only numbers'
                              onChange={setState}
                            />
                          )}
                          <Select
                            name={`proficiency.${proficiencyIndex}.area`}
                            label='Proficiency Area'
                            value={proficiencyItem.area}
                            options={builders.proficiency.area}
                            required={true}
                            onChange={setState}
                          />
                          {proficiencyItem.area?.name === 'skill' && (
                            <Select
                              name={`proficiency.${proficiencyIndex}.skill`}
                              multiple={true}
                              label='Skill'
                              value={proficiencyItem.skill}
                              options={builders.skill}
                              required={true}
                              onChange={setState}
                            />
                          )}
                          {proficiencyItem.area?.name === 'saveAbility' && (
                            <Select
                              name={`proficiency.${proficiencyIndex}.saveAbility`}
                              multiple={true}
                              label='Save Ability'
                              value={proficiencyItem.saveAbility}
                              options={builders.ability}
                              required={true}
                              onChange={setState}
                            />
                          )}
                          {proficiencyItem.area?.name === 'language' && (
                            <Select
                              name={`proficiency.${proficiencyIndex}.language`}
                              multiple={true}
                              label='Language'
                              value={proficiencyItem.language}
                              options={builders.language}
                              onChange={setState}
                            />
                          )}
                          {(proficiencyItem.area?.name === 'property' ||
                            proficiencyItem.area?.name === 'itemType') && (
                            <>
                              <Select
                                name={`proficiency.${proficiencyIndex}.category`}
                                multiple={true}
                                label='Item Category'
                                value={proficiencyItem.category}
                                options={builders.item.category}
                                onChange={setState}
                              />
                              {proficiencyItem.area?.name === 'property' && (
                                <Select
                                  name={`proficiency.${proficiencyIndex}.property`}
                                  multiple={true}
                                  label='Item Property'
                                  value={proficiencyItem.property}
                                  options={[].concat(
                                    ...builders.item.category
                                      .filter((bCategoryItem) =>
                                        proficiencyItem.category?.length > 0
                                          ? proficiencyItem.category?.some(
                                              (categoryItem) =>
                                                categoryItem.name ===
                                                bCategoryItem.name
                                            )
                                          : bCategoryItem
                                      )
                                      .map((category) => category.property)
                                  )}
                                  onChange={setState}
                                />
                              )}
                              {proficiencyItem.area?.name === 'itemType' && (
                                <Select
                                  name={`proficiency.${proficiencyIndex}.itemType`}
                                  multiple={true}
                                  label='Item Type'
                                  value={proficiencyItem.itemType}
                                  options={items.filter((itemType) =>
                                    proficiencyItem.category?.length > 0
                                      ? proficiencyItem.category?.some(
                                          (categoryItem) =>
                                            categoryItem.name ===
                                            itemType.category.name
                                        )
                                      : itemType
                                  )}
                                  onChange={setState}
                                />
                              )}
                            </>
                          )}
                          <Select
                            name={`proficiency.${proficiencyIndex}.level`}
                            label='Proficiency Level'
                            value={proficiencyItem.level}
                            options={builders.proficiency.level}
                            required={true}
                            onChange={setState}
                          />
                          {multipleOptions && (
                            <Input
                              validation='num'
                              name={`proficiency.${proficiencyIndex}.selectionCount`}
                              label='# of Selections'
                              autoComplete='off'
                              value={proficiencyItem.selectionCount}
                              invalidText='Must contain only numbers'
                              required={true}
                              onChange={setState}
                            />
                          )}
                        </div>
                      </Fragment>
                    ),
                  }
                }
              )}
              onDelete={setState}
              dynamic={true}
            />
          )}
        </>
      ),
    },
    {
      name: 'startingEquipment',
      content: (
        <>
          <TextEditor
            ref={addToTextRefs}
            name={'startingEquipment.desc'}
            value={state?.startingEquipment?.desc}
            label={'Description'}
            onChange={setState}
          />
          <button
            className='btn btn-secondary'
            type='button'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'startingEquipment.group' } },
              })
            }
          >
            Add Equipment Group
          </button>
          {state.startingEquipment?.group?.map((groupItem, groupIndex) => (
            <div className='equipment-option-group-container' key={groupIndex}>
              <div
                className='equipment-option-group-header'
                id='sectionCollapseButton'
                type='button'
                role='button'
                data-bs-toggle='collapse'
                data-bs-target={`#equipmentGroup${groupIndex}Collapse`}
                aria-controls='collapseExample'
                aria-expanded='true'
              >
                <div className='d-flex align-items-center'>
                  <h5 className='equipment-option-group-header-title'>
                    <strong>Group {groupIndex + 1}</strong>
                  </h5>
                  <button
                    className='btn btn-danger ms-2'
                    type='button'
                    onClick={() => {
                      setState({
                        type: 'removed',
                        payload: {
                          target: {
                            name: `startingEquipment.group.${groupIndex}`,
                          },
                        },
                      })
                    }}
                  >
                    X
                  </button>
                </div>
              </div>
              <div
                className='equipment-option-group-wrapper collapse show'
                id={`equipmentGroup${groupIndex}Collapse`}
              >
                <div className='equipment-option-group'>
                  <button
                    className='btn btn-primary'
                    type='button'
                    onClick={() =>
                      setState({
                        type: 'added',
                        payload: {
                          target: {
                            name: `startingEquipment.group.${groupIndex}.option`,
                          },
                        },
                      })
                    }
                  >
                    Add Option
                  </button>
                  {groupItem.option?.length > 0 &&
                    groupItem.option?.map((optionItem, optionIndex) => (
                      <div className='equipment-option mt-2' key={optionIndex}>
                        {optionIndex !== 0 && (
                          <div className='d-flex justify-content-end'>
                            <button
                              className='btn btn-danger'
                              type='button'
                              onClick={() =>
                                setState({
                                  type: 'removed',
                                  payload: {
                                    target: {
                                      name: `startingEquipment.group.${groupIndex}.option.${optionIndex}`,
                                    },
                                  },
                                })
                              }
                            >
                              Remove Option
                            </button>
                          </div>
                        )}
                        <button
                          className='btn btn-primary'
                          type='button'
                          onClick={() =>
                            setState({
                              type: 'added',
                              payload: {
                                target: {
                                  name: `startingEquipment.group.${groupIndex}.option.${optionIndex}.equipment`,
                                },
                              },
                            })
                          }
                        >
                          Add Equipment
                        </button>
                        {optionItem.equipment?.length > 0 && (
                          <Fragment key={optionIndex}>
                            <TabNavigation
                              id={`startingEquipmentGroup${groupIndex}Option${optionIndex}Equipment`}
                              dynamic={true}
                              tabState={optionItem.equipment?.map(
                                (equipmentItem, equipmentIndex) => {
                                  const multipleOptions =
                                    equipmentItem.attribute?.some(
                                      (attributeItem) =>
                                        attributeItem.name === 'providesOptions'
                                    )
                                  return {
                                    value: startCase(
                                      `equipment ${equipmentIndex + 1}`
                                    ),
                                    content: (
                                      <div
                                        className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'
                                        key={equipmentIndex}
                                      >
                                        <Select
                                          name={`startingEquipment.group.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.attribute`}
                                          multiple={true}
                                          options={
                                            builders.section.item.attribute
                                          }
                                          label='Option Attributes'
                                          value={equipmentItem.attribute}
                                          onChange={setState}
                                        />
                                        <Select
                                          name={`startingEquipment.group.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.category`}
                                          multiple={true}
                                          label='Item Category'
                                          value={equipmentItem.category}
                                          options={builders.item.category}
                                          onChange={setState}
                                        />

                                        <Select
                                          name={`startingEquipment.group.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.property`}
                                          multiple={true}
                                          label='Item Property'
                                          value={equipmentItem.property}
                                          options={[].concat(
                                            ...builders.item.category
                                              .filter((bCategoryItem) =>
                                                equipmentItem.category?.length >
                                                0
                                                  ? equipmentItem.category?.some(
                                                      (categoryItem) =>
                                                        categoryItem.name ===
                                                        bCategoryItem.name
                                                    )
                                                  : bCategoryItem
                                              )
                                              .map(
                                                (category) => category.property
                                              )
                                          )}
                                          onChange={setState}
                                        />
                                        <Select
                                          name={`startingEquipment.group.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.itemType`}
                                          multiple={true}
                                          label='Item Type'
                                          value={equipmentItem.itemType}
                                          options={items.filter(
                                            (itemType) =>
                                              (equipmentItem.category?.length >
                                              0
                                                ? equipmentItem.category?.some(
                                                    (categoryItem) =>
                                                      categoryItem.name ===
                                                      itemType.category.name
                                                  )
                                                : itemType) &&
                                              (equipmentItem.property?.length >
                                                0 &&
                                              itemType?.property?.length > 0
                                                ? equipmentItem.property?.every(
                                                    (property) =>
                                                      itemType.property.some(
                                                        (propertyItem) =>
                                                          propertyItem.name ===
                                                          property.name
                                                      )
                                                  )
                                                : itemType)
                                          )}
                                          onChange={setState}
                                        />
                                        {multipleOptions ? (
                                          <Input
                                            validation='num'
                                            name={`startingEquipment.group.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.selectionCount`}
                                            label='# of Selections'
                                            autoComplete='off'
                                            value={equipmentItem.selectionCount}
                                            invalidText='Must contain only numbers'
                                            required={true}
                                            onChange={setState}
                                          />
                                        ) : (
                                          <Input
                                            size='col-sm-2'
                                            validation='num'
                                            name={`startingEquipment.group.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.quantity`}
                                            label='Quantity'
                                            autoComplete='off'
                                            value={equipmentItem.quantity}
                                            invalidText='Must contain only numbers'
                                            required={true}
                                            onChange={setState}
                                          />
                                        )}
                                      </div>
                                    ),
                                    name: `startingEquipment.group.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}`,
                                  }
                                }
                              )}
                              onDelete={setState}
                            />
                          </Fragment>
                        )}
                        {optionIndex !== groupItem.option?.length - 1 && (
                          <div className='d-flex align-items-center'>
                            <hr className='flex-grow-1 mx-3' />
                            <span className='mx-auto'>
                              <strong>OR</strong>
                            </span>
                            <hr className='flex-grow-1 mx-3' />
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))}
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
                const level = true
                const name = 'feature'
                return {
                  value:
                    featureItem.value == null || featureItem.value === ''
                      ? startCase(`${name} ${featureIndex + 1}`)
                      : featureItem.value,
                  name: `${name}.${featureIndex}`,
                  content: featureTabContent(
                    name,
                    featureItem,
                    featureIndex,
                    level
                  ),
                }
              })}
              onDelete={setState}
              dynamic={true}
            />
          )}
        </>
      ),
    },
    {
      name: 'specialization',
      content: (
        <>
          <button
            className='btn btn-secondary'
            type='button'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'specialization.option' } },
              })
            }
          >
            Add Specialization
          </button>
          {state.specialization?.option?.length > 0 && (
            <>
              <div className='row row-cols-2 gx-2'>
                <Input
                  name='specialization.name'
                  autoComplete='off'
                  label='Specialization Name'
                  required={true}
                  value={state.specialization?.name}
                  onChange={setState}
                />
                <Input
                  name='specialization.levelAvailable'
                  autoComplete='off'
                  label='Level(s) Available'
                  required={true}
                  value={state.specialization?.levelAvailable}
                  validation={'num'}
                  invalidText='Must contain whole numbers and commas only'
                  onChange={setState}
                />
              </div>
              <TextEditor
                ref={addToTextRefs}
                name={'specialization.desc'}
                value={state?.specialization?.desc}
                label={'Description'}
                onChange={setState}
              />
              <TabNavigation
                id='specialization'
                tabState={state.specialization?.option?.map(
                  (optionItem, optionIndex) => {
                    const level = false
                    const name = 'specialization.option'
                    return {
                      value:
                        optionItem.value == null || optionItem.value === ''
                          ? startCase(`${name} ${optionIndex + 1}`)
                          : optionItem.value,
                      name: `${name}.${optionIndex}`,
                      content: featureTabContent(
                        name,
                        optionItem,
                        optionIndex,
                        level
                      ),
                    }
                  }
                )}
                onDelete={setState}
                dynamic={true}
              />
            </>
          )}
        </>
      ),
    },
    {
      name: 'subclassDetails',
      content: (
        <>
          <div className='row g-2 row-cols-4 pb-2'>
            <Input
              name='subclass.value'
              autoComplete='off'
              label='Subclass Feature Name'
              required={true}
              value={state.subclass?.value}
              onChange={setState}
            />
            <Input
              name='subclass.levelAcquired'
              autoComplete='off'
              label='Level Acquired'
              required={true}
              value={state.subclass?.levelAcquired}
              validation='num'
              invalidText='Must contain whole numbers only'
              onChange={setState}
            />
          </div>
          <TextEditor
            ref={addToTextRefs}
            name={'subclass.desc'}
            value={state?.subclass?.desc}
            label={'Description'}
            onChange={setState}
          />
        </>
      ),
    },
  ]

  content = (
    <>
      <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2 mx-1'>
        <div className='col-auto'>
          <h3>Create a Class</h3>
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
            .filter(
              (tabItem) =>
                (state.category?.name === 'subclass'
                  ? tabItem.name !== 'subclassDetails' &&
                    tabItem.name !== 'startingEquipment'
                  : tabItem) &&
                (state.attribute?.some(
                  (attributeItem) => attributeItem.name === 'hasSpecialization'
                )
                  ? tabItem
                  : tabItem.name !== 'specialization')
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
export default NewClassForm
