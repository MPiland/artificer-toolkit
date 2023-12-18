import { useState, useEffect, useReducer, useRef, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  useAddNewClassMutation,
  useUpdateClassMutation,
  useGetClassesQuery,
  selectClassById,
  selectAllClasses,
} from './classesApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { selectAllSpells, useGetSpellsQuery } from '../spells/spellsApiSlice'
import { selectAllFeats, useGetFeatsQuery } from '../feats/featsApiSlice'
import { selectAllItems, useGetItemsQuery } from '../items/itemsApiSlice'
import { startCase, isEqual } from 'lodash'
import { useSelector } from 'react-redux'
import { selectLoadingStatus } from '../../app/loadingSlice'
import { handleValidation } from '../../helpers/form'
import useMediaQuery from '../../hooks/useMediaQuery'
import formReducer from '../../hooks/useReducer'
import Spinner from '../../components/Spinner'
import TabNavigation from '../../components/TabNavigation/TabNavigation'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'

const EditClassForm = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const id = location.state.data

  const isLoading = useSelector(selectLoadingStatus)

  const is1000 = useMediaQuery('(min-width: 576px) and (max-width: 992px)')
  const is600 = useMediaQuery('(max-width: 576px)')

  const { data: builders } = useGetBuildersQuery('buildersList')

  const { classes, userClass } = useGetClassesQuery('classesList', {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
      userClass: data && selectClassById(data, id),
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
    addNewClass,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewClassMutation()

  const [
    updateClass,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateClassMutation()

  const [oldState, setOldState] = useState(userClass)
  const [state, setState] = useReducer(formReducer, userClass)
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [levelTableColumns, setLevelTableColumns] = useState()
  const [match, setMatch] = useState()
  const textRefs = useRef([])

  useEffect(() => {
    if (!state && userClass) {
      setState({
        type: 'reset',
        payload: { target: userClass },
      })
    }
  })

  useEffect(() => {
    if (addIsSuccess || updateIsSuccess) {
      setSuccessMessage('Class added successfully!')
      setErrorMessage()
      const successElement = document.getElementById('error-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
    }
  }, [addIsSuccess, id, navigate, updateIsSuccess])

  useEffect(() => {
    if (addIsError || updateIsError) {
      setErrorMessage(addError.data.message)
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }, [addIsError, id, updateIsError, addError, updateError])

  useEffect(() => {
    document.addEventListener('keypress', () => {
      if (successMessage != null && !match) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () =>
      document.removeEventListener('keypress', () => {
        if (successMessage != null && !match) {
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
      if (successMessage != null && !match) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () =>
      document.removeEventListener('mouseup', () => {
        if (successMessage != null && !match) {
          setSuccessMessage()
          handleValidation(true)
        }
        if (errorMessage != null) {
          setErrorMessage()
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

  useEffect(() => {
    if (!isLoading && state) {
      const spellCaster = state.attribute?.some(
        (attributeItem) => attributeItem.name === 'spellCaster'
      )
      const resource = state.attribute?.some(
        (attributeItem) => attributeItem.name === 'resourceFeature'
      )
      !state.levelAttribute &&
        setState({
          type: 'added',
          payload: { target: { name: 'levelAttribute' } },
        })
      spellCaster &&
        state.levelAttribute?.map(
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
      if (state.category?.name === 'base') {
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
      if (resource) {
        inputArray.push({
          name: 'resourcePoints',
          value: 'Resource Points',
          validation: 'num',
          invalid: 'Must contain only numbers',
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
          state.spellcasting?.attribute?.some(
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
        if (state.spellcasting?.maxSpellLevel) {
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
    }
  }, [is1000, is600, state, isLoading])

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
      await addNewClass(state)
    } else {
      setErrorMessage('Please fill out all required fields')
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
    }
  }

  const onUpdate = async () => {
    setErrorMessage()
    setSuccessMessage()
    const isValid = handleValidation()
    if (isValid) {
      if (match) {
        setErrorMessage('No changes made')
        const errorrElement = document.getElementById('error-message')
        if (errorrElement) {
          errorrElement.scrollIntoView()
        }
      } else {
        await updateClass(state)
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
    if (location.state.previous.state.background.pathname === '/classes') {
      navigate(`/classes/${state.name}`, {
        state: {
          data: id,
          background: location.state.previous.state.background,
          title: match ? state.value : oldState?.value,
          context: 'itemCard',
          size: 'xl',
        },
      })
    } else {
      navigate(-1)
    }
  }

  let content

  if (isLoading || !state) {
    return (content = <Spinner />)
  }

  const damageTableColumns = (featureItem) => {
    const secondary = featureItem?.damageAttribute?.some(
      (attributeItem) => attributeItem.name === 'secondaryDamage'
    )
    const bonus =
      featureItem?.damageAttribute?.some(
        (attributeItem) => attributeItem.name === 'bonusDamage'
      ) && featureItem?.bonus?.bonusAttribute?.name === 'setValue'
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
    const tableContent = [
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
                          options={state.feature}
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
                      name={`${name}.${sectionIndex}.${this.name}.${index}.method.methodType`}
                      label='Method'
                      value={item.method?.methodType}
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
                      value={item.passive?.options}
                      options={builders.passive}
                      required={true}
                      onChange={setState}
                    />
                  ) : (
                    (item.module?.name === 'damage' ||
                      item.module?.name === 'spellDamage') && (
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
                  {(item.method?.methodType?.name === 'setValue' &&
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
                  ) : item.method?.methodType?.name === 'ability' ? (
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
                  ) : item.method?.methodType?.name === 'setValue' &&
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
                    item.method?.methodType?.name === 'skill' && (
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
                item.method?.methodType?.name === 'diePerLevel' ? (
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
                            name: 'diceCount',
                            validation: 'num',
                            invalidText: 'Must be whole numbers only',
                            size: 'col',
                          },
                          {
                            name: 'diceValue',
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
                {item.method?.methodType?.name === 'addPerLevel' ? (
                  !item.addPerLevel || !item.addPerLevel?.length > 0 ? (
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
                      rows={{
                        inputs: [
                          {
                            name: 'level',
                            validation: 'num',
                            invalidText:
                              'Must be whole numbers, commas, and spaces only',
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
                  <Select
                    name={`${name}.${sectionIndex}.${this.name}.${index}.area`}
                    label='Proficiency Area'
                    value={item.area}
                    options={builders.proficiency.area}
                    required={true}
                    onChange={setState}
                  />
                  {item?.area?.name === 'ability' && (
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
                    multiple={true}
                    name={`${name}.${sectionIndex}.${this.name}.${index}.attribute`}
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
                      builders.section.attribute,
                      state.category?.name === 'subclass' &&
                        builders.section.subclass.attribute
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
                      options={classes.filter(
                        (classItem) => classItem.category.name !== 'subclass'
                      )}
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
                            (item?.classLimit?.length > 0
                              ? item?.classLimit?.some((limitItem) =>
                                  spellItem?.classes?.some(
                                    (classItem) =>
                                      limitItem.name === classItem.name
                                  )
                                )
                              : spellItem) &&
                            (item?.levelLimit?.length > 0
                              ? item?.levelLimit?.some(
                                  (levelItem) =>
                                    levelItem.value === spellItem.level
                                )
                              : spellItem)
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
              {optionItem.damage?.damageAttribute?.some(
                (attributeItem) => attributeItem.name === 'damagePool'
              ) && (
                <>
                  <Select
                    name={`${name}.${optionIndex}.damage.pool.option`}
                    label='Pool Option'
                    value={optionItem.damage?.pool?.option}
                    options={builders.feature.poolOptions}
                    required={true}
                    onChange={setState}
                  />
                  {optionItem.damage?.pool?.option.name === 'level' ? (
                    <>
                      <Input
                        name={`${name}.${optionIndex}.damage.pool.multiplier`}
                        value={optionItem.damage?.pool?.multiplier}
                        label='Multiplier'
                        onChange={setState}
                        validation='num'
                        invalidText={'Must contain only numbers'}
                      />
                      <Input
                        name={`${name}.${optionIndex}.damage.pool.minValue`}
                        value={optionItem.damage?.pool?.minValue}
                        label='Minimum Value'
                        onChange={setState}
                        validation='num'
                        invalidText={'Must contain only numbers'}
                      />
                    </>
                  ) : optionItem.damage?.pool?.option?.name === 'ability' ? (
                    <Select
                      name={`${name}.${optionIndex}.damage.pool.ability`}
                      label='Pool Abilty'
                      value={optionItem.damage?.pool?.ability}
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  ) : (
                    optionItem.damage?.pool?.option?.name === 'setValue' && (
                      <Input
                        name={`${name}.${optionIndex}.damage.pool.setValue`}
                        value={optionItem.damage?.pool?.setValue}
                        label='Pool Total'
                        onChange={setState}
                        validation='num'
                        required={true}
                        invalidText={'Must contain only numbers'}
                      />
                    )
                  )}
                  {optionItem.damage?.damageAttribute.some(
                    (attributeItem) => attributeItem.name === 'secondaryDamage'
                  ) && (
                    <>
                      <Select
                        name={`${name}.${optionIndex}.damage.secondaryPool.option`}
                        label='Secondary Pool Option'
                        value={optionItem.damage?.secondaryPool?.option}
                        options={builders.feature.poolOptions}
                        required={true}
                        onChange={setState}
                      />
                      {optionItem.damage?.secondaryPool?.option.name ===
                      'classLevel' ? (
                        <>
                          <Input
                            name={`${name}.${optionIndex}.damage.secondaryPool.multiplier`}
                            value={optionItem.damage?.secondaryPool?.multiplier}
                            label='Multiplier'
                            onChange={setState}
                            validation='num'
                            invalidText={'Must contain only numbers'}
                          />
                          <Input
                            name={`${name}.${optionIndex}.damage.secondaryPool.minValue`}
                            value={optionItem.damage?.secondaryPool?.minValue}
                            label='Minimum Value'
                            onChange={setState}
                            validation='num'
                            invalidText={'Must contain only numbers'}
                          />
                        </>
                      ) : optionItem.damage?.secondaryPool?.option?.name ===
                        'ability' ? (
                        <Select
                          name={`${name}.${optionIndex}.damage.secondaryPool.ability`}
                          label='Pool Abilty'
                          value={optionItem.damage?.secondaryPool?.ability}
                          options={builders.ability}
                          required={true}
                          onChange={setState}
                        />
                      ) : (
                        optionItem.damage?.secondaryPool?.option?.name ===
                          'setValue' && (
                          <Input
                            name={`${name}.${optionIndex}.damage.secondaryPool.setValue`}
                            value={optionItem.damage?.secondaryPool?.setValue}
                            label='Pool Total'
                            onChange={setState}
                            validation='num'
                            required={true}
                            invalidText={'Must contain only numbers'}
                          />
                        )
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            {!optionItem.damage?.damageAttribute?.some(
              (attributeItem) => attributeItem.name === 'damagePool'
            ) && (
              <>
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
            )}
          </>
        )
      ) : (
        optionItem.damage?.damageAttribute?.some(
          (attributeItem) => attributeItem.name === 'damagePool'
        ) &&
        optionItem.damage?.damageByLevel?.length > 0 &&
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
            id={`${name}${optionIndex}section`}
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
              value={state.category}
              options={builders.class.category}
              required={true}
              onChange={setState}
            />
            {state.category?.name === 'subclass' && (
              <Select
                name='parentClass'
                label='Parent Class'
                value={state.parentClass}
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
            value={state.desc}
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
            setState={setState}
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
                options={builders.class.attribute.filter(
                  (attributeItem) =>
                    (state.category?.name === 'base'
                      ? attributeItem
                      : attributeItem.name !== 'primaryAbility' &&
                        attributeItem.name !== 'secondaryAbility') &&
                    (state.attribute?.some(
                      (item) => item.name === 'primaryAbility'
                    )
                      ? attributeItem
                      : attributeItem.name !== 'optionalAbility')
                )}
                onChange={setState}
              />
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'resourceFeature'
              ) && (
                <Select
                  name='resourceFeature.resetOption'
                  label='Resource Feature Reset Option'
                  value={state.resourceFeature?.resetOption}
                  options={builders.feature.chargeReset}
                  required={true}
                  onChange={setState}
                />
              )}
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
                      options={builders.ability}
                      onChange={setState}
                    />
                  )}
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
                  <Select
                    name='spellcasting.resetOption'
                    label='Spellslot Reset Option'
                    value={state.spellcasting?.resetOption}
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
                  value={state.multiclass?.primaryAbility}
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
                  value={state.multiclass?.secondaryAbility}
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
                  value={state.multiclass?.optionalAbility}
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
                    value={state.levelAttribute}
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
              setState={setState}
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
          <button
            className='btn btn-secondary'
            type='button'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'startingEquipment' } },
              })
            }
          >
            Add Equipment Group
          </button>
          <TabNavigation
            id='startingEquipment'
            tabState={state.startingEquipment?.map((groupItem, groupIndex) => {
              return {
                value: `Group ${groupIndex + 1}`,
                name: `startingEquipment.${groupIndex}`,
                content: (
                  <>
                    {groupItem.option?.length > 0 &&
                      groupItem.option?.map((optionItem, optionIndex) => (
                        <div
                          className='equipment-option mt-2'
                          key={optionIndex}
                        >
                          <button
                            className='btn btn-primary'
                            type='button'
                            onClick={() =>
                              setState({
                                type: 'added',
                                payload: {
                                  target: {
                                    name: `startingEquipment.${groupIndex}.option.${optionIndex}.equipment`,
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
                                id={`startingEquipment${groupIndex}Option${optionIndex}Equipment`}
                                dynamic={true}
                                tabState={optionItem.equipment?.map(
                                  (equipmentItem, equipmentIndex) => {
                                    const multipleOptions =
                                      equipmentItem.attribute?.some(
                                        (attributeItem) =>
                                          attributeItem.name ===
                                          'providesOptions'
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
                                            name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.attribute`}
                                            multiple={true}
                                            options={
                                              builders.section.item.attribute
                                            }
                                            label='Option Attributes'
                                            value={equipmentItem.attribute}
                                            onChange={setState}
                                          />
                                          <Select
                                            name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.category`}
                                            multiple={true}
                                            label='Item Category'
                                            value={equipmentItem.category}
                                            options={builders.item.category}
                                            onChange={setState}
                                          />

                                          <Select
                                            name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.property`}
                                            multiple={true}
                                            label='Item Property'
                                            value={equipmentItem.property}
                                            options={[].concat(
                                              ...builders.item.category
                                                .filter((bCategoryItem) =>
                                                  equipmentItem.category
                                                    ?.length > 0
                                                    ? equipmentItem.category?.some(
                                                        (categoryItem) =>
                                                          categoryItem.name ===
                                                          bCategoryItem.name
                                                      )
                                                    : bCategoryItem
                                                )
                                                .map(
                                                  (category) =>
                                                    category.property
                                                )
                                            )}
                                            onChange={setState}
                                          />
                                          <Select
                                            name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.itemType`}
                                            multiple={true}
                                            label='Item Type'
                                            value={equipmentItem.itemType}
                                            options={items.filter(
                                              (itemType) =>
                                                (!equipmentItem.category ||
                                                  equipmentItem.category
                                                    .length === 0 ||
                                                  (equipmentItem.category
                                                    ?.length > 0 &&
                                                    equipmentItem.category.some(
                                                      (categoryItem) =>
                                                        categoryItem.name ===
                                                        itemType.category?.name
                                                    ))) &&
                                                (!equipmentItem.property ||
                                                  equipmentItem.property
                                                    .length === 0 ||
                                                  (equipmentItem.property
                                                    ?.length > 0 &&
                                                    itemType.property?.length >
                                                      0 &&
                                                    itemType.property.some(
                                                      (propertyItem) =>
                                                        equipmentItem.property.some(
                                                          (equipmentProperty) =>
                                                            equipmentProperty.name ===
                                                            propertyItem.name
                                                        )
                                                    )))
                                            )}
                                            onChange={setState}
                                          />
                                          {multipleOptions ? (
                                            <Input
                                              validation='num'
                                              name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.selectionCount`}
                                              label='# of Selections'
                                              autoComplete='off'
                                              value={
                                                equipmentItem.selectionCount
                                              }
                                              invalidText='Must contain only numbers'
                                              required={true}
                                              onChange={setState}
                                            />
                                          ) : (
                                            <Input
                                              size='col-sm-2'
                                              validation='num'
                                              name={`startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}.quantity`}
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
                                      name: `startingEquipment.${groupIndex}.option.${optionIndex}.equipment.${equipmentIndex}`,
                                    }
                                  }
                                )}
                                setState={setState}
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
                  </>
                ),
              }
            })}
            setState={setState}
            dynamic={true}
          />
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
              contentState={state.feature}
              reorder={true}
              setState={setState}
              dynamic={true}
            />
          )}
        </>
      ),
    },
    {
      name: 'style',
      content: (
        <>
          <div className='row gx-2'>
            <Select
              name='style'
              className={'col-2 mb-2'}
              options={builders.class.style}
              value={state.style}
              optionalKey={['option', 'desc']}
              onChange={setState}
            />
          </div>
          {state.style?.option?.length > 0 && (
            <>
              {!state.style?.choicesByLevel?.length > 0 &&
                setState({
                  type: 'added',
                  payload: { target: { name: 'style.choicesByLevel' } },
                })}
              <Table
                rows={{
                  inputs: [
                    {
                      name: 'level',
                      validation: 'num',
                      invalidText: 'Must contain whole numbers only',
                      size: 'col-2',
                    },
                    {
                      name: 'count',
                      validation: 'num',
                      invalidText: 'Must contain whole numbers only',
                      size: 'col-2',
                    },
                  ],
                  headers: [
                    {
                      value: 'Level',
                      size: 'col-2',
                      readOnly: true,
                    },
                    {
                      value: 'Choices Per Level',
                      size: 'col-4',
                      readOnly: true,
                    },
                  ],
                }}
                name='style.choicesByLevel'
                dynamic={true}
                value={state.style?.choicesByLevel}
                onChange={setState}
              />
              <TextEditor
                ref={addToTextRefs}
                name={'style.desc'}
                value={state.style?.desc}
                label={'Description'}
                onChange={setState}
              />
              <button
                className='btn btn-secondary my-1'
                type='button'
                onClick={() =>
                  setState({
                    type: 'added',
                    payload: { target: { name: 'style.option' } },
                  })
                }
              >
                Add Option
              </button>
              <TabNavigation
                id='style'
                tabState={state.style?.option?.map(
                  (optionItem, optionIndex) => {
                    const level = false
                    const name = 'style.option'
                    return {
                      value:
                        optionItem.value == null || optionItem.value === ''
                          ? startCase(`Style ${optionIndex + 1}`)
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
                setState={setState}
                dynamic={true}
              />
            </>
          )}
          {!state.attribute?.some(
            (attributeItem) => attributeItem.name === 'classStyle'
          ) &&
            !!state.style &&
            setState({
              type: 'removed',
              payload: { target: { name: 'style' } },
            })}
        </>
      ),
    },
    {
      name: 'resourceFeature',
      content: (
        <>
          <div className='row gx-2'>
            <Input
              name='resourceFeature.value'
              label='Resource Name'
              autoComplete='off'
              value={state.resourceFeature?.value}
              required={true}
              onChange={setState}
            />
            <Input
              name='resourceFeature.levelAvailable'
              label='Level Available'
              autoComplete='off'
              value={state.resourceFeature?.levelAvailable}
              required={true}
              validation='num'
              invalidText='Must contain whole numbers only'
              onChange={setState}
            />
            <TextEditor
              ref={addToTextRefs}
              name={'resourceFeature.desc'}
              value={state.resourceFeature?.desc}
              label={'Description'}
              onChange={setState}
            />
          </div>
          <button
            className='btn btn-secondary'
            type='button'
            onClick={() =>
              setState({
                type: 'added',
                payload: { target: { name: 'resourceFeature.feature' } },
              })
            }
          >
            Add Feature
          </button>
          {state.resourceFeature?.feature?.length > 0 && (
            <TabNavigation
              id='resourceFeature'
              tabState={state.resourceFeature?.feature?.map(
                (optionItem, optionIndex) => {
                  const level = true
                  const name = 'resourceFeature.feature'
                  return {
                    value:
                      optionItem.value == null || optionItem.value === ''
                        ? startCase(`Feature ${optionIndex + 1}`)
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
              setState={setState}
              dynamic={true}
            />
          )}
          {!state.attribute?.some(
            (attributeItem) => attributeItem.name === 'resourceFeature'
          ) &&
            !!state.resourceFeature &&
            setState({
              type: 'removed',
              payload: { target: { name: 'resourceFeature' } },
            })}
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
            value={state.subclass?.desc}
            label={'Description'}
            onChange={setState}
          />
        </>
      ),
    },
  ]

  content = (
    <>
      <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
        <div className='col-auto'>
          <h3>Edit a Class</h3>
        </div>
        <div className='col-auto d-flex justify-content-end'>
          <button
            className='btn btn-success me-2'
            type='button'
            onClick={onUpdate}
          >
            Update
          </button>
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
          <button className='btn btn-secondary' onClick={onBackClick}>
            Back
          </button>
        </div>
      </div>
      {successMessage && (
        <h5 className='success-message' id='success-message'>
          {successMessage}
        </h5>
      )}
      {errorMessage && (
        <h5 className='error-message' id='error-message'>
          {errorMessage}
        </h5>
      )}
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
                  (attributeItem) => attributeItem.name === 'classStyle'
                )
                  ? tabItem
                  : tabItem.name !== 'style') &&
                (state.attribute?.some(
                  (attributeItem) => attributeItem.name === 'resourceFeature'
                )
                  ? tabItem
                  : tabItem.name !== 'resourceFeature')
            )
            .map((content) => ({
              value: state[content.name]?.value ?? startCase(content.name),
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
export default EditClassForm
