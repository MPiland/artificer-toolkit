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

  const sectionTabContent = (featureItem, featureIndex) => {
    const tableContent = [
      {
        name: 'feat',
        content() {
          return featureItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.subtype`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    label='Feat'
                    value={multipleOptions ? item?.options : item.setSelection}
                    options={feats}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectionCount`}
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
          return featureItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.subtype`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
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
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.ability${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Ability'
                      value={
                        multipleOptions
                          ? item.ability?.options
                          : item.ability?.setSelection
                      }
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item.module?.name === 'saveAbility' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.saveAbility${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Save Ability'
                      value={
                        multipleOptions
                          ? item.saveAbility?.options
                          : item.saveAbility?.setSelection
                      }
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item.module?.name === 'skill' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.skill${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Skill'
                      value={
                        multipleOptions
                          ? item.skill?.options
                          : item.skill?.setSelection
                      }
                      options={builders.skill}
                      require={true}
                      onChange={setState}
                    />
                  )}
                  {item.module?.name === 'damageSave' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.damageSave${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Damage'
                      value={
                        multipleOptions
                          ? item.damageSave?.options
                          : item.damageSave?.setSelection
                      }
                      options={builders.damage}
                      require={true}
                      onChange={setState}
                    />
                  )}
                  {item.module?.name === 'conditionSave' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.conditionSave${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Condition'
                      value={
                        multipleOptions
                          ? item.conditionSave?.options
                          : item.conditionSave?.setSelection
                      }
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
                        require={true}
                        onChange={setState}
                      />
                    )}
                  {item.module?.name === 'condition' ? (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.condition${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Condition Type'
                      value={
                        multipleOptions
                          ? item.condition?.options
                          : item.condition?.setSelection
                      }
                      options={builders.condition}
                      require={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'speed' ? (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.speed${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      value={
                        multipleOptions
                          ? item.speed?.options
                          : item.speed?.setSelection
                      }
                      label='Speed Type'
                      options={builders.speed}
                      require={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'passive' ? (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.passive${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Passive Type'
                      value={
                        multipleOptions
                          ? item.passive?.options
                          : item.passive?.setSelection
                      }
                      options={builders.passive}
                      require={true}
                      onChange={setState}
                    />
                  ) : (
                    (item.module?.name === 'damage' ||
                      item.module?.name === 'spellDamage') && (
                      <Select
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.damage${
                          multipleOptions ? '.options' : '.setSelection'
                        }`}
                        multiple={true}
                        label='Damage Type'
                        value={
                          multipleOptions
                            ? item.damage?.options
                            : item.damage?.setSelection
                        }
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
                        name={`feature.${featureIndex}.${this.name}.${index}.method.setValue`}
                        label='Set Value'
                        invalidText='Must contain only numbers'
                        autoComplete='off'
                        value={item.method?.setValue}
                        require={true}
                        onChange={setState}
                      />
                    </>
                  ) : item.method?.name === 'ability' ? (
                    <>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.method.ability`}
                        label='Method Ability'
                        value={item.method.ability}
                        options={builders.ability}
                        require={true}
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
                          require={true}
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
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectionCount`}
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
            )
          })
        },
      },
      {
        name: 'proficiency',
        content() {
          return featureItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.subtype`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.area`}
                    label='Proficiency Area'
                    value={item.area}
                    options={builders.proficiency.area}
                    require={true}
                    onChange={setState}
                  />
                  {item?.area?.name === 'skill' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.skill${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Skill'
                      value={
                        multipleOptions
                          ? item.skill?.options
                          : item.skill?.setSelection
                      }
                      options={builders.skill}
                      require={true}
                      onChange={setState}
                    />
                  )}
                  {item?.area?.name === 'saveAbility' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.saveAbility${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Save Ability'
                      value={
                        multipleOptions
                          ? item.saveAbility?.options
                          : item.saveAbility?.setSelection
                      }
                      options={builders.ability}
                      require={true}
                      onChange={setState}
                    />
                  )}
                  {item?.area?.name === 'language' && (
                    <Select
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.language${
                        multipleOptions ? '.options' : '.setSelection'
                      }`}
                      multiple={true}
                      label='Language'
                      value={
                        multipleOptions
                          ? item.language?.options
                          : item.language?.setSelection
                      }
                      options={builders.language}
                      onChange={setState}
                    />
                  )}
                  {(item.area?.name === 'property' ||
                    item.area?.name === 'itemType') && (
                    <>
                      <Select
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.category${
                          multipleOptions ? '.options' : '.setSelection'
                        }`}
                        multiple={true}
                        label='Item Category'
                        value={
                          multipleOptions
                            ? item.category?.options
                            : item.category?.setSelection
                        }
                        options={builders.item.category}
                        onChange={setState}
                      />
                      {item.area?.name === 'property' && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.property${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          label='Item Property'
                          value={
                            multipleOptions
                              ? item.property?.options
                              : item.property?.setSelection
                          }
                          options={[].concat(
                            ...builders.item.category
                              .filter((bCategoryItem) =>
                                multipleOptions
                                  ? item.category?.options?.length > 0
                                    ? item.category?.options?.some(
                                        (categoryItem) =>
                                          categoryItem.name ===
                                          bCategoryItem.name
                                      )
                                    : bCategoryItem
                                  : item.category?.setSelection?.length > 0
                                  ? item.category?.setSelection?.some(
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
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.itemType${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          label='Item Type'
                          value={
                            multipleOptions
                              ? item.itemType?.options
                              : item.itemType?.setSelection
                          }
                          options={items.filter((itemType) =>
                            multipleOptions
                              ? item.category?.options?.length > 0
                                ? item.category?.options?.some(
                                    (category) =>
                                      category.name === itemType.category.name
                                  )
                                : itemType
                              : item.category?.setSelection?.length > 0
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
                    label='Proficiency Level'
                    value={item.level}
                    options={builders.proficiency.level}
                    require={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectionCount`}
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
          return featureItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.subtype`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    label='Sense'
                    value={multipleOptions ? item?.options : item?.setSelection}
                    options={builders.sense}
                    require={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectionCount`}
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
          return featureItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple='true'
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={[].concat(
                      builders.section.spell.attribute,
                      builders.section.attribute,
                      state.category?.name === 'subclass' &&
                        builders.section.subclass.attribute
                    )}
                    label={`${startCase(this.name)} Attributes`}
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
                  {item.attribute?.some(
                    (attributeItem) => attributeItem.name === 'subtypeSpecific'
                  ) && (
                    <Select
                      name={`feature.${featureIndex}.${this.name}.${index}.subtype`}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
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
                        name={`feature.${featureIndex}.${this.name}.${index}${
                          multipleOptions ? '.options' : '.setSelection'
                        }`}
                        multiple={true}
                        label='Spell'
                        value={
                          multipleOptions ? item?.options : item?.setSelection
                        }
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
                        require={true}
                        onChange={setState}
                      />
                      {item.attribute?.some(
                        (attributeItem) =>
                          attributeItem.name === 'optionalAbility'
                      ) && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.ability${
                            multipleOptions ? '.options' : '.setSelection'
                          }`}
                          multiple={true}
                          label='Ability'
                          value={
                            multipleOptions
                              ? item.ability?.options
                              : item.ability?.setSelection
                          }
                          options={builders.ability}
                          require={true}
                          onChange={setState}
                        />
                      )}
                      {multipleOptions && (
                        <Input
                          validation='num'
                          name={`feature.${featureIndex}.${this.name}.${index}.selectionCount`}
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
                </div>
              </Fragment>
            )
          })
        },
      },
      {
        name: 'equipment',
        content() {
          return featureItem[this.name].map((item, index) => {
            const multipleOptions = item.attribute?.some(
              (attributeItem) => attributeItem.name === 'providesOptions'
            )
            return (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={[].concat(
                      builders.section.attribute,
                      builders.section.item.attribute,
                      builders.section.subclass.attribute
                    )}
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
                      name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                      label='Opt. Grp. #'
                      autoComplete='off'
                      value={item.optionGroup}
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  )}
                  <Select
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.category${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    label='Item Category'
                    value={
                      multipleOptions
                        ? item.category?.options
                        : item.category?.setSelection
                    }
                    options={builders.item.category}
                    onChange={setState}
                  />

                  <Select
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.property${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    label='Item Property'
                    value={
                      multipleOptions
                        ? item.property?.options
                        : item.property?.setSelection
                    }
                    options={[].concat(
                      ...builders.item.category
                        .filter((bCategoryItem) =>
                          multipleOptions
                            ? item.category?.options?.length > 0
                              ? item.category?.options?.some(
                                  (categoryItem) =>
                                    categoryItem.name === bCategoryItem.name
                                )
                              : bCategoryItem
                            : item.category?.setSelection?.length > 0
                            ? item.category?.setSelection?.some(
                                (categoryItem) =>
                                  categoryItem.name === bCategoryItem.name
                              )
                            : bCategoryItem
                        )
                        .map((category) => category.property)
                    )}
                    onChange={setState}
                  />
                  <Select
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.itemType${
                      multipleOptions ? '.options' : '.setSelection'
                    }`}
                    multiple={true}
                    label='Item Type'
                    value={
                      multipleOptions
                        ? item.itemType?.options
                        : item.itemType?.setSelection
                    }
                    options={items.filter((itemType) =>
                      multipleOptions
                        ? item.category?.options?.length > 0
                          ? item.category?.options?.some(
                              (category) =>
                                category.name === itemType.category.name
                            )
                          : itemType
                        : item.category?.setSelection?.length > 0
                        ? item.category?.setSelection?.some(
                            (category) =>
                              category.name === itemType.category.name
                          )
                        : itemType
                    )}
                    onChange={setState}
                  />
                  {multipleOptions ? (
                    <Input
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectionCount`}
                      label='# of Selections'
                      autoComplete='off'
                      value={item.selectionCount}
                      invalidText='Must contain only numbers'
                      required={true}
                      onChange={setState}
                    />
                  ) : (
                    <Input
                      size='col-sm-2'
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.quantity`}
                      label='Quantity'
                      autoComplete='off'
                      value={item.quantity}
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
    ]
    return tableContent
  }

  const featureTabContent = (featureItem, featureIndex) => (
    <Fragment key={featureIndex}>
      <div className='row justify-content-between pb-2 gy-2'>
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
        <Input
          name={`feature.${featureIndex}.levelAvailable`}
          autoComplete='off'
          label='Level Available'
          required={true}
          value={featureItem?.levelAvailable}
          onChange={setState}
        />
        <Select
          multiple={true}
          name={`feature.${featureIndex}.attribute`}
          options={builders.feature.attribute}
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
                  name={`feature.${featureIndex}.limitUse.ability`}
                  label='Ability'
                  value={featureItem.limitUse?.ability}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name={`feature.${featureIndex}.limitUse.minValue`}
                  autoComplete='off'
                  label='Min. Value'
                  value={featureItem?.limitUse?.minValue}
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
                  validation='num'
                  type='text'
                  name={`feature.${featureIndex}.limitUse.setSelectionAmount`}
                  invalidText='Must contain only numbers'
                  label='Use Amount'
                  value={featureItem.limitUse?.setSelectionAmount}
                  required={true}
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
            <Select
              name={`feature.${featureIndex}.action`}
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
              name={`feature.${featureIndex}.range.minRange`}
              autoComplete='off'
              label='Min Range'
              required={true}
              value={featureItem.range?.minRange}
              invalidText='Must contain only numbers'
              onChange={setState}
            />
            <Input
              validation='num'
              name={`feature.${featureIndex}.range.maxRange`}
              autoComplete='off'
              label='Max Range'
              required={true}
              invalidText='Must contain only numbers'
              value={featureItem.range?.maxRange}
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
              required={true}
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
            options={builders.feature.requirement}
            value={featureItem.requirement?.option}
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
                  label='Skill Proficiency'
                  value={featureItem.requirement?.skillProficiency?.skill}
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
                    label='Score'
                    required={true}
                    validation='num'
                    invalidText='Must contain only numbers'
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
                <div className='row row-cols-3 g-2 pb-3 mx-3 justify-contents-center'>
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
                <div className='row row-cols-3 g-2 pb-3 mx-3 justify-contents-center'>
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
                <div className='row row-cols-3 g-2 pb-3 mx-3 justify-contents-center'>
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
            <div className='row row-cols-4 g-2 align-items-end pb-2'>
              <Select
                multiple={true}
                name={`feature.${featureIndex}.damage.damageAttribute`}
                label='Damage Attribute'
                value={featureItem.damage?.damageAttribute}
                options={builders.feature.damageAttribute}
                onChange={setState}
              />
              <Select
                name={`feature.${featureIndex}.damage.damageType`}
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
                  name={`feature.${featureIndex}.damage.bonus.bonusAttribute`}
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
                  name={`feature.${featureIndex}.damage.bonus.ability`}
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
                    value: startCase(`${sectionItem.name} ${contentIndex + 1}`),
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
            onClick={() => {
              onSubmit()
            }}
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
            .filter((tabItem) =>
              state.category?.name === 'subclass'
                ? tabItem.name !== 'subclassDetails'
                : tabItem
            )
            .map((content) => ({
              value: startCase(content.name),
              name: content.name,
              content: content.content,
            }))}
        />
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
            tabState={
              state.feature?.length > 0 &&
              state.feature?.map((featureItem, featureIndex) => ({
                value:
                  featureItem.value == null || featureItem.value === ''
                    ? startCase(`feature ${featureIndex + 1}`)
                    : featureItem.value,
                name: `feature.${featureIndex}`,
                content: featureTabContent(featureItem, featureIndex),
              }))
            }
            onDelete={setState}
            dynamic={true}
          />
        )}
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
