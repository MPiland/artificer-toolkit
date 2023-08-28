import { useState, useEffect, useReducer, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  useGetRaceQuery,
  useAddNewRaceMutation,
  useUpdateRaceMutation,
} from './racesApiSlice'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useGetSpellQuery } from '../spells/spellsApiSlice'
import { useGetFeatQuery } from '../feats/featsApiSlice'
import { useGetItemQuery } from '../items/itemsApiSlice'
import { startCase, isEqual } from 'lodash'
import formReducer from '../../hooks/useReducer'
import AccordionButton from '../../components/AccordionButton'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'

const EditRaceForm = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const {
    data: builders,
    isSuccess: builderIsSuccess,
    isLoading: builderIsLoading,
  } = useGetBuilderQuery(id)

  const {
    data: spells,
    isSuccess: spellIsSuccess,
    isLoading: spellIsLoading,
  } = useGetSpellQuery(id)

  const {
    data: feats,
    isSuccess: featIsSuccess,
    isLoading: featIsLoading,
  } = useGetFeatQuery(id)

  const {
    data: races,
    isSuccess: raceIsSuccess,
    isLoading: raceIsLoading,
  } = useGetRaceQuery(id)

  const {
    data: items,
    isSuccess: ItemIsSuccess,
    isLoading: ItemIsLoading,
  } = useGetItemQuery(id)

  const [
    addNewRace,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewRaceMutation()

  const [
    updateRace,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateRaceMutation()

  const [oldState, setOldState] = useState(location.state.data)
  const [state, setState] = useReducer(formReducer, location.state.data)
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [match, setMatch] = useState()
  const selectRefs = useRef([])
  const inputRefs = useRef([])
  const textRefs = useRef([])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Race added successfully!')
      handleValidation(true)
    }
    if (updateIsSuccess) {
      setSuccessMessage('Race updated successfully!')
    }
  }, [addIsSuccess, id, navigate, updateIsSuccess])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.data.message)
    }
    if (updateIsError) {
      setErrorMessage(updateError.data.message)
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

  const addToSelectRefs = (ref) => {
    if (ref && !selectRefs.current.includes(ref)) {
      selectRefs.current.push(ref)
    }
  }

  const addToInputRefs = (ref) => {
    if (ref && !inputRefs.current.includes(ref)) {
      inputRefs.current.push(ref)
    }
  }

  const addToTextRefs = (ref) => {
    if (ref && !textRefs.current.includes(ref)) {
      textRefs.current.push(ref)
    }
  }

  const handleValidation = (resetValidation) => {
    let isValid = true
    selectRefs.current.forEach((selectRef) => {
      if (selectRef) {
        if (resetValidation === true) {
          selectRef.setClass('')
        } else {
          const selectValue = selectRef.getValue()
          const isEmpty =
            selectValue === null ||
            (Array.isArray(selectValue) && selectValue.length === 0)
          if (isEmpty) {
            selectRef.setClass('is-invalid')
            isValid = false
          } else {
            selectRef.setClass('is-valid')
          }
        }
      }
    })

    // Validate other elements with the required attribute
    const requiredElements = document.querySelectorAll('[required]')
    requiredElements.forEach((element) => {
      if (resetValidation) {
        element.classList.remove('is-valid')
        element.classList.remove('is-invalid')
      } else {
        const value = element.value
        const isEmpty =
          value === null ||
          value === undefined ||
          (typeof value === 'string' && value.trim() === '')

        if (isEmpty) {
          element.classList.add('is-invalid')
          element.classList.remove('is-valid')
          isValid = false
        } else {
          element.classList.add('is-valid')
          element.classList.remove('is-invalid')
        }
      }
    })
    if (resetValidation) {
      setErrorMessage()
    }
    return isValid
  }

  const onReset = () => {
    setState({
      type: 'reset',
      payload: { target: { userId: id } },
    })
    setSuccessMessage()
    setErrorMessage()
    handleValidation(true)
  }

  const onSubmit = async () => {
    const isValid = handleValidation()
    if (isValid) {
      await addNewRace(state)
    } else {
      setErrorMessage('Please fill out all required fields')
    }
  }

  const onUpdate = async () => {
    const isValid = handleValidation()
    if (isValid) {
      if (match) {
        setErrorMessage('No changes made')
      } else {
        await updateRace(state)
        setOldState(state)
      }
    } else {
      setErrorMessage('Please fill out all required fields')
    }
  }

  const onBackClick = () => {
    if (location.state.previous.state.background.pathname === '/races') {
      navigate(`/races/${state.name}`, {
        state: {
          data: match ? state : oldState,
          background: location.state.previous.state.background,
          context: match ? state.value : oldState.value,
          size: 'xl',
        },
      })
    } else {
      navigate(-1)
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
    if (state.lineage && !state.traits) {
      textRefs.current.forEach((textRef) => {
        const textName = textRef.getName()
        if (textName === 'traits.desc') {
          textRef.updateState(
            races.find((race) => race._id === state.lineage?.id)?.traits.desc
          )
          setState({
            payload: {
              target: {
                name: 'traits',
                value: races.find((race) => race._id === state.lineage?.id)
                  ?.traits,
              },
            },
          })
        }
      })
      selectRefs.current.forEach((selectRef) => {
        const selectName = selectRef.getName()
        if (selectName === 'attribute') {
          selectRef.setValue(
            races.find((race) => race._id === state.lineage?.id)?.attribute
          )
          setState({
            payload: {
              target: {
                name: 'attribute',
                value: races.find((race) => race._id === state.lineage?.id)
                  ?.attribute,
              },
            },
          })
        }
      })
    }
  }

  let content

  if (
    builderIsLoading ||
    spellIsLoading ||
    featIsLoading ||
    raceIsLoading ||
    ItemIsLoading
  ) {
    content = <p>Loading...</p>
  }

  if (
    builderIsSuccess &&
    spellIsSuccess &&
    featIsSuccess &&
    raceIsSuccess &&
    ItemIsSuccess
  ) {
    const damageTableInputs = (secondary) => {
      const inputArray = [
        {
          name: 'level',
          value: 'Level',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'damage-col',
        },
        {
          name: 'diceCount',
          value: 'Dice Count',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'damage-col',
        },
        {
          name: 'diceValue',
          value: 'Dice Value',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'damage-col',
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
            size: 'damage-col',
          },
          {
            name: 'secDiceValue',
            value: 'Sec. Dice Value',
            invalid: 'Must contain only numbers',
            validation: 'num',
            label: true,
            size: 'damage-col',
          }
        )
      }

      return inputArray
    }

    const sections = [
      {
        name: 'feat',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (item) => item.name === 'optionGroups'
                ) && (
                  <Input
                    ref={addToInputRefs}
                    size='col-sm-2'
                    validate='num'
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}.feat${
                    multipleOptions ? '.options' : ''
                  }`}
                  multiple={multipleOptions}
                  placeholder='Feat'
                  value={multipleOptions ? item.feat.options : item.feat}
                  options={feats}
                  required={true}
                  onChange={setState}
                />
              </div>
            </>
          )
        },
      },
      {
        name: 'modifier',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (item) => item.name === 'optionGroups'
                ) && (
                  <Input
                    ref={addToInputRefs}
                    size='col-sm-2'
                    validate='num'
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}.modType`}
                  placeholder='Modifier Type'
                  value={item.modType}
                  options={builders.modifier.modType}
                  required={true}
                  onChange={setState}
                />
                {item.modType?.name && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.module`}
                    placeholder='Modifier Category'
                    value={item.module}
                    options={builders.modifier.module?.filter((moduleItem) =>
                      builders.modifier.modType
                        .find(
                          (typeItem) => typeItem.name === item.modType?.name
                        )
                        ?.module.map((m) => m.id)
                        ?.some((moduleID) => moduleID === moduleItem._id)
                    )}
                    required={true}
                    onChange={setState}
                  />
                )}
                {(item.modType?.name === 'bonus' ||
                  item.modType?.name === 'penalty' ||
                  item.modType?.name === 'advantage' ||
                  item.modType?.name === 'disadvantage' ||
                  item.modType?.name === 'setValue') && (
                  <>
                    {item.module?.name === 'ability' && (
                      <Select
                        ref={addToSelectRefs}
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.ability${multipleOptions ? '.options' : ''}`}
                        multiple={multipleOptions}
                        placeholder='Ability'
                        value={
                          multipleOptions ? item.abilty?.options : item.ability
                        }
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                    )}
                    {item.module?.name === 'saveAbility' && (
                      <Select
                        ref={addToSelectRefs}
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.saveAbility${
                          multipleOptions ? '.options' : ''
                        }`}
                        multiple={multipleOptions}
                        placeholder='Save Ability'
                        value={
                          multipleOptions
                            ? item.saveAbility?.options
                            : item.saveAbility
                        }
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                    )}
                    {item.module?.name === 'skill' && (
                      <Select
                        ref={addToSelectRefs}
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.skill${multipleOptions ? '.options' : ''}`}
                        multiple={multipleOptions}
                        placeholder='Skill'
                        value={
                          multipleOptions ? item.skill?.options : item.skill
                        }
                        options={builders.skill}
                        require={true}
                        onChange={setState}
                      />
                    )}
                    {item.module?.name === 'damageSave' && (
                      <Select
                        ref={addToSelectRefs}
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.damageSave${
                          multipleOptions ? '.options' : ''
                        }`}
                        multiple={multipleOptions}
                        placeholder='Damage'
                        value={
                          multipleOptions
                            ? item.damageSave?.options
                            : item.damageSave
                        }
                        options={builders.damage}
                        require={true}
                        onChange={setState}
                      />
                    )}
                    {item.module?.name === 'conditionSave' && (
                      <Select
                        ref={addToSelectRefs}
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.conditionSave${
                          multipleOptions ? '.options' : ''
                        }`}
                        multiple={multipleOptions}
                        placeholder='Condition'
                        value={
                          multipleOptions
                            ? item.conditionSave?.options
                            : item.conditionSave
                        }
                        options={builders.condition}
                        required={true}
                        onChange={setState}
                      />
                    )}
                  </>
                )}
                {(item.modType?.name === 'bonus' ||
                  item.modType?.name === 'penalty') &&
                  item.modType?.name !== 'setValue' && (
                    <Select
                      ref={addToSelectRefs}
                      name={`feature.${featureIndex}.${this.name}.${index}.method`}
                      placeholder='Method'
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
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.condition${multipleOptions ? '.options' : ''}`}
                    multiple={multipleOptions}
                    placeholder='Condition Type'
                    value={
                      multipleOptions ? item.condition?.options : item.condition
                    }
                    options={builders.condition}
                    require={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'speed' ? (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.speed${
                      multipleOptions ? '.options' : ''
                    }`}
                    multiple={multipleOptions}
                    value={multipleOptions ? item.speed?.options : item.speed}
                    placeholder='Speed Type'
                    options={builders.speed}
                    require={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'passive' ? (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.passive${multipleOptions ? '.options' : ''}`}
                    multiple={multipleOptions}
                    placeholder='Passive Type'
                    value={
                      multipleOptions ? item.passive?.options : item.passive
                    }
                    options={builders.passive}
                    require={true}
                    onChange={setState}
                  />
                ) : (
                  item.module?.name === 'damage' && (
                    <Select
                      ref={addToSelectRefs}
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.damage${multipleOptions ? '.options' : ''}`}
                      multiple={multipleOptions}
                      placeholder='Damage Type'
                      value={
                        multipleOptions ? item.damage?.options : item.damage
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
                      ref={addToInputRefs}
                      validate='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.method.setValue`}
                      placeholder='Set Value'
                      label={true}
                      invalidText='Must contain only numbers'
                      autoComplete='off'
                      value={item.method?.setValue}
                      require={true}
                      onChange={setState}
                    />
                    <Input
                      ref={addToInputRefs}
                      validate='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.multiplier`}
                      placeholder='Multiplier'
                      label={true}
                      invalidText='Must contain only whole numbers'
                      autoComplete='off'
                      value={item.multiplier}
                      onChange={setState}
                    />
                  </>
                ) : item.method?.name === 'ability' ? (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.method.ability`}
                    placeholder='Method Ability'
                    value={item.method.ability}
                    options={builders.ability}
                    require={true}
                    onChange={setState}
                  />
                ) : (
                  item.method?.name === 'skill' && (
                    <Select
                      ref={addToSelectRefs}
                      name={`feature.${featureIndex}.${this.name}.${index}.method.skill`}
                      placeholder='Method Skill'
                      value={item.method.skill}
                      options={builders.skill}
                      require={true}
                      onChange={setState}
                    />
                  )
                )}
                {((item.modType?.name === 'bonus' &&
                  item.module?.name !== 'hitPoints') ||
                  item.modType?.name === 'setValue') &&
                  item.module?.name === 'ability' && (
                    <Select
                      ref={addToSelectRefs}
                      name={`feature.${featureIndex}.${this.name}.${index}.exceedMax`}
                      placeholder='Exceeds Max'
                      value={item.exceedMax}
                      options={[
                        { name: true, value: 'Yes' },
                        { name: false, value: 'No' },
                      ]}
                      require={true}
                      onChange={setState}
                    />
                  )}
                {item.method?.name === 'perLevel' && (
                  <Input
                    name={`feature.${featureIndex}.${this.name}.${index}.addPerLevel`}
                    label={true}
                    placeholder='Per Level Amt.'
                    validate='num'
                    invalidText='Must contain whole numbers only'
                    autoComplete='off'
                    value={item.addPerLevel}
                    onChange={setState}
                  />
                )}
              </div>
            </>
          )
        },
      },
      {
        name: 'proficiency',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (item) => item.name === 'optionGroups'
                ) && (
                  <Input
                    ref={addToInputRefs}
                    size='col-sm-2'
                    validate='num'
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}.area`}
                  placeholder='Proficiency Area'
                  value={item.area}
                  options={builders.proficiency.area}
                  require={true}
                  onChange={setState}
                />
                {item?.area?.name === 'skill' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.skill${
                      multipleOptions ? '.options' : ''
                    }`}
                    multiple={multipleOptions}
                    placeholder='Skill'
                    value={multipleOptions ? item.skill?.options : item.skill}
                    options={builders.skill}
                    require={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'saveAbility' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.saveAbility${multipleOptions ? '.options' : ''}`}
                    multiple={multipleOptions}
                    placeholder='Save Ability'
                    value={
                      multipleOptions
                        ? item.saveAbility?.options
                        : item.saveAbility
                    }
                    options={builders.ability}
                    require={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'tool' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.tool${
                      multipleOptions ? '.options' : ''
                    }`}
                    multiple={multipleOptions}
                    placeholder='Tool'
                    value={multipleOptions ? item.tool?.options : item.tool}
                    options={builders.tool}
                    require={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'language' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.language${multipleOptions ? '.options' : ''}`}
                    multiple={multipleOptions}
                    placeholder='Language'
                    value={
                      multipleOptions ? item.language?.options : item.language
                    }
                    options={builders.language}
                    require={true}
                    onChange={setState}
                  />
                )}
                {item.area?.name === 'itemType' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.itemType${multipleOptions ? '.options' : ''}`}
                    multiple={multipleOptions}
                    placeholder='Item Type'
                    value={
                      multipleOptions ? item.itemType?.options : item.itemType
                    }
                    require={true}
                    options={items}
                    onChange={setState}
                  />
                )}
                {item.area?.name === 'itemProperty' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.itemProperty${
                      multipleOptions ? '.options' : ''
                    }`}
                    multiple={multipleOptions}
                    placeholder='Item Property'
                    value={
                      multipleOptions
                        ? item.itemProperty?.options
                        : item.itemProperty
                    }
                    require={true}
                    options={[].concat(
                      ...builders.item.itemCategory.map(
                        (categoryItem) => categoryItem.itemProperty
                      )
                    )}
                    onChange={setState}
                  />
                )}
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}.level`}
                  placeholder='Proficiency Level'
                  value={item.level}
                  options={builders.proficiency.level}
                  require={true}
                  onChange={setState}
                />
              </div>
            </>
          )
        },
      },
      {
        name: 'sense',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (attributeItem) => attributeItem.name === 'optionGroups'
                ) && (
                  <Input
                    ref={addToInputRefs}
                    size='col-sm-2'
                    validate='num'
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}.sense${
                    multipleOptions ? '.options' : ''
                  }`}
                  multiple={multipleOptions}
                  placeholder='Sense'
                  value={multipleOptions ? item.sense?.options : item.sense}
                  options={builders.sense}
                  require={true}
                  onChange={setState}
                />
              </div>
            </>
          )
        },
      },
      {
        name: 'spell',
        content(feature, featureIndex, item, index) {
          const multipleOptions = feature.attribute?.some(
            (attributeItem) => attributeItem.name === 'providesOptions'
          )
          return (
            <>
              <div className='pb-3 row justify-content-between'>
                <div className='col'>
                  <button
                    className='btn btn-outline-primary col-auto'
                    type='button'
                    name={`feature.${featureIndex}.${this.name}.${index}`}
                    onClick={(e) => setState({ type: 'removed', payload: e })}
                  >
                    {`Remove ${startCase(this.name)}`}
                  </button>
                </div>
                {feature.attribute?.some(
                  (attributeItem) => attributeItem.name === 'optionGroups'
                ) && (
                  <Input
                    ref={addToInputRefs}
                    size='col-sm-2'
                    validate='num'
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <Select
                  ref={addToSelectRefs}
                  multiple='true'
                  name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                  options={builders.feat.feature.spell.attribute}
                  placeholder='Spell Attributes'
                  value={item.attribute}
                  require={true}
                  onChange={setState}
                />
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}${
                    multipleOptions ? '.options' : ''
                  }`}
                  multiple={multipleOptions}
                  placeholder='Spell'
                  value={multipleOptions ? item?.options : item}
                  options={spells}
                  require={true}
                  onChange={setState}
                />
                {item.attribute?.some(
                  (attributeItem) => attributeItem.name === 'optionalAbility'
                ) && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.ability${multipleOptions && 'options'}`}
                    multiple={multipleOptions}
                    placeholder='Ability'
                    value={
                      multipleOptions ? item.ability?.options : item.ability
                    }
                    options={builders.ability}
                    require={true}
                    onChange={setState}
                  />
                )}
              </div>
            </>
          )
        },
      },
    ]

    const featureContent =
      state.feature?.length !== 0 &&
      state.feature?.map((featureItem, featureIndex) => {
        return (
          <div key={featureIndex} className='accordion' id='featureAccordion'>
            <div className='accordion-item'>
              <div className='accordion-header'>
                <AccordionButton
                  id={`feature${featureIndex}AccordionButton`}
                  target={`feature${featureIndex}AccordionBody`}
                  expanded='false'
                >
                  <Input
                    ref={addToInputRefs}
                    size='col-sm-4'
                    name={`feature.${featureIndex}.value`}
                    border={false}
                    autoComplete='off'
                    placeholder='Feature Name'
                    value={featureItem.value}
                    onChange={setState}
                    clickable={false}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  />
                </AccordionButton>
              </div>
              <div
                className='accordion-collapse collapse show'
                id={`feature${featureIndex}AccordionBody`}
                data-bs-parent='#featureAccordion'
              >
                <div className='accordion-body'>
                  <div className='row justify-content-start g-2 pb-3'>
                    <div className='col-auto'>
                      <button
                        className='btn btn-outline-primary overflow-hidden text-nowrap'
                        type='button'
                        name={`feature.${featureIndex}`}
                        onClick={(e) =>
                          setState({ type: 'removed', payload: e })
                        }
                      >
                        Remove Feature
                      </button>
                    </div>
                    {sections.map((sectionItem, sectionIndex) => (
                      <div key={sectionIndex} className='col-auto'>
                        <button
                          key={sectionIndex}
                          className='btn btn-secondary'
                          type='button'
                          name={`feature.${featureIndex}.${sectionItem.name}`}
                          onClick={(e) =>
                            setState({ type: 'added', payload: e })
                          }
                        >
                          {`Add ${startCase(sectionItem.name)}`}
                        </button>
                      </div>
                    ))}
                  </div>
                  <TextEditor
                    ref={addToTextRefs}
                    className='pb-2'
                    placeholder='Feature description'
                    value={featureItem.desc}
                    name={`feature.${featureIndex}.desc`}
                    onChange={setState}
                  />
                  <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
                    <Select
                      multiple={true}
                      name={`feature.${featureIndex}.attribute`}
                      options={builders.race.feature.attribute.filter(
                        (attributeItem) =>
                          !featureItem.attribute?.some(
                            (item) => item.name === 'doesDamage'
                          )
                            ? attributeItem.name !== 'secondaryDamage'
                            : attributeItem
                      )}
                      placeholder='Feature Attributes'
                      value={featureItem.attribute}
                      onChange={setState}
                    />
                    {featureItem.attribute?.some(
                      (attributeItem) =>
                        attributeItem.name === 'ancestrySpecific'
                    ) && (
                      <Select
                        ref={addToSelectRefs}
                        multiple={true}
                        name={`feature.${featureIndex}.ancestry`}
                        options={state.ancestry}
                        placeholder='Ancestry'
                        value={featureItem.ancestry}
                        required={true}
                        onChange={setState}
                      />
                    )}
                    {featureItem.attribute?.some(
                      (attributeItem) =>
                        attributeItem.name === 'hasRequirements'
                    ) ? (
                      <Select
                        ref={addToSelectRefs}
                        multiple={true}
                        name={`feature.${featureIndex}.requirement.option`}
                        placeholder='Requirement'
                        options={builders.race.feature.requirements}
                        value={featureItem.requirement?.option}
                        required={true}
                        onChange={setState}
                      />
                    ) : (
                      !!featureItem?.requirement &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.requirement`,
                          },
                        },
                      })
                    )}
                    {featureItem.requirement?.option?.some(
                      (optionItem) => optionItem.name === 'skillProficiency'
                    ) ? (
                      <Select
                        ref={addToSelectRefs}
                        multiple={true}
                        name={`feature.${featureIndex}.requirement.skillProficiency.skill`}
                        placeholder='Skill Proficiency'
                        value={featureItem.requirement?.skillProficiency}
                        options={builders.skill}
                        required={true}
                        onChange={setState}
                      />
                    ) : (
                      !!featureItem.requirement?.skillProficiency &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.requirement.skillProficiency`,
                          },
                        },
                      })
                    )}
                    {featureItem.requirement?.option?.some(
                      (optionItem) => optionItem.name === 'itemProficiency'
                    ) ? (
                      <>
                        <Select
                          ref={addToSelectRefs}
                          multiple={true}
                          name={`feature.${featureIndex}.requirement.itemProficiency.itemCategory`}
                          placeholder='Item Category'
                          value={
                            featureItem.requirement?.itemProficiency
                              ?.itemCategory
                          }
                          options={builders.item.itemCategory}
                          required={true}
                          onChange={setState}
                        />
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.requirement.itemProficiency.itemType`}
                          placeholder='Item type'
                          value={
                            featureItem.requirement?.itemProficiency?.itemType
                          }
                          options={items.filter(
                            (item) =>
                              item.itemCategory.value !==
                              featureItem.requirement?.itemCategory?.value
                          )}
                          required={true}
                          onChange={setState}
                        />
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.requirement.itemProficiency.itemProperty`}
                          placeholder='Item Property'
                          value={
                            featureItem.requirement?.itemProficiency
                              ?.itemProperty
                          }
                          options={[].concat(
                            ...builders.item.itemCategory
                              .filter((itemCategory) =>
                                featureItem.requirement?.itemCategory?.some(
                                  (categoryItem) =>
                                    itemCategory._id.includes(categoryItem.id)
                                )
                              )
                              .map((filteredItem) => filteredItem.itemProperty)
                          )}
                          required={true}
                          onChange={setState}
                        />
                      </>
                    ) : (
                      !!featureItem.requirement?.itemProficiency &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.requirement.itemProficiency`,
                          },
                        },
                      })
                    )}
                    {featureItem.requirement?.option?.some(
                      (optionItem) => optionItem.name === 'abilityScore'
                    ) ? (
                      <>
                        <Select
                          ref={addToSelectRefs}
                          multiple={true}
                          name={`feature.${featureIndex}.requirement.abilityScore.ability`}
                          value={featureItem.requirement?.abilityScore?.ability}
                          placeholder='Ability'
                          options={builders.ability}
                          required={true}
                          onChange={setState}
                        />
                        <Input
                          ref={addToInputRefs}
                          name={`feature.${featureIndex}.requirement.abilityScore.score`}
                          value={featureItem.requirement?.abilityScore?.score}
                          placeholder='Score'
                          required={true}
                          label={true}
                          validation='num'
                          invalidText='Must contain only numbers'
                          onChange={setState}
                        />
                      </>
                    ) : (
                      !!featureItem.requirement?.abilityScore &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.requirement.abilityScore`,
                          },
                        },
                      })
                    )}
                    {featureItem.requirement?.option?.some(
                      (optionItem) => optionItem.name === 'size'
                    ) ? (
                      <>
                        <Select
                          ref={addToSelectRefs}
                          multiple={true}
                          name={`feature.${featureIndex}.requirement.size`}
                          value={featureItem.requirement?.size}
                          placeholder='Size'
                          options={builders.race.size}
                          required={true}
                          onChange={setState}
                        />
                      </>
                    ) : (
                      !!featureItem.requirement?.abilityScore &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.requirement.size`,
                          },
                        },
                      })
                    )}
                    {featureItem.attribute?.some(
                      (attributeItem) => attributeItem.name === 'limitUse'
                    ) ? (
                      <>
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.limitUse.limitBy`}
                          placeholder='Limit By Option'
                          value={featureItem.limitUse?.limitBy}
                          options={builders.race.feature.chargeLimit}
                          required={true}
                          onChange={setState}
                        />
                        {featureItem.limitUse?.limitBy?.name === 'ability' ? (
                          <Select
                            ref={addToSelectRefs}
                            name={`feature.${featureIndex}.limitUse.ability`}
                            placeholder='Ability'
                            value={featureItem.limitUse?.ability}
                            options={builders.ability}
                            required={true}
                            onChange={setState}
                          />
                        ) : featureItem.limitUse?.limitBy?.name === 'skill' ? (
                          <Select
                            ref={addToSelectRefs}
                            name={`feature.${featureIndex}.limitUse.skill`}
                            placeholder='Skill'
                            value={featureItem.limitUse?.skill}
                            options={builders.skill}
                            required={true}
                            onChange={setState}
                          />
                        ) : (
                          featureItem.limitUse?.limitBy?.name ===
                            'setNumber' && (
                            <Input
                              ref={addToInputRefs}
                              validate='num'
                              type='text'
                              name={`feature.${featureIndex}.limitUse.setAmount`}
                              label={true}
                              invalidText='Must contain only numbers'
                              placeholder='Use Amount'
                              value={featureItem.limitUse?.setAmount}
                              required={true}
                              onChange={setState}
                            />
                          )
                        )}
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.limitUse.resetsOn`}
                          placeholder='Reset Option'
                          value={featureItem.limitUse?.resetsOn}
                          options={builders.race.feature.chargeReset}
                          required={true}
                          onChange={setState}
                        />
                      </>
                    ) : (
                      !!featureItem.limitUse &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.limitUse`,
                          },
                        },
                      })
                    )}
                    {featureItem.attribute?.some(
                      (attributeItem) => attributeItem.name === 'isAction'
                    ) ? (
                      <>
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.action`}
                          placeholder='Action Type'
                          value={featureItem.action}
                          options={builders.race.feature.action}
                          required={true}
                          onChange={setState}
                        />
                      </>
                    ) : (
                      !!featureItem.action &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.action`,
                          },
                        },
                      })
                    )}
                    {featureItem.attribute?.some(
                      (attributeItem) => attributeItem.name === 'hasRange'
                    ) ? (
                      <>
                        <Input
                          ref={addToInputRefs}
                          validate='num'
                          name={`feature.${featureIndex}.range.minRange`}
                          autoComplete='off'
                          label={true}
                          placeholder='Min Range'
                          required={true}
                          value={featureItem.range?.minRange}
                          invalidText='Must contain only numbers'
                          onChange={setState}
                        />
                        <Input
                          ref={addToInputRefs}
                          validate='num'
                          name={`feature.${featureIndex}.range.maxRange`}
                          label={true}
                          autoComplete='off'
                          placeholder='Max Range'
                          required={true}
                          invalidText='Must contain only numbers'
                          value={featureItem.range?.maxRange}
                          onChange={setState}
                        />
                      </>
                    ) : (
                      !!featureItem.saveAbility &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.range`,
                          },
                        },
                      })
                    )}
                    {featureItem.attribute?.some(
                      (attributeItem) => attributeItem.name === 'requireSave'
                    ) ? (
                      <Select
                        ref={addToSelectRefs}
                        name={`feature.${featureIndex}.saveAbility`}
                        placeholder='DC Ability'
                        value={featureItem.saveAbility}
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                    ) : (
                      !!featureItem.saveAbility &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.saveAbility`,
                          },
                        },
                      })
                    )}
                  </div>
                  {featureItem.requirement?.option?.some(
                    (optionItem) => optionItem.name === 'equipped'
                  ) ? (
                    <>
                      <AccordionButton
                        className='accordion feature-attribute-divider justify-content-between align-items-center'
                        id='featureEquippedButton'
                        target='featureEquipped'
                      >
                        <span className='me-3'>Equipped</span>
                        <hr className='flex-grow-1 me-3' />
                      </AccordionButton>
                      <div
                        className='accordion-collapse collapse show'
                        id='featureEquipped'
                      >
                        <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
                          <Select
                            ref={addToSelectRefs}
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.equipped.itemCategory`}
                            placeholder='Item Category'
                            value={
                              featureItem.requirement?.equipped?.itemCategory
                            }
                            options={builders.item.itemCategory}
                            required={true}
                            onChange={setState}
                          />
                          <Select
                            ref={addToSelectRefs}
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.equipped.itemType`}
                            placeholder='Item type'
                            value={featureItem.requirement?.equipped?.itemType}
                            options={items.filter(
                              (item) =>
                                item.itemCategory.value !==
                                featureItem.requirement?.equipped?.itemCategory
                                  ?.value
                            )}
                            required={true}
                            onChange={setState}
                          />
                          <Select
                            ref={addToSelectRefs}
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.equipped.itemProperty`}
                            placeholder='Item Property'
                            value={
                              featureItem.requirement?.equipped?.itemProperty
                            }
                            options={[].concat(
                              ...builders.item.itemCategory
                                .filter((itemCategory) =>
                                  featureItem.requirement?.equipped?.itemCategory?.some(
                                    (categoryItem) =>
                                      itemCategory._id.includes(categoryItem.id)
                                  )
                                )
                                .map(
                                  (filteredItem) => filteredItem.itemProperty
                                )
                            )}
                            required={true}
                            onChange={setState}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    !!featureItem.requirement?.equipped &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.requirement.equipped`,
                        },
                      },
                    })
                  )}
                  {featureItem.requirement?.option?.some(
                    (optionItem) => optionItem.name === 'notEquipped'
                  ) ? (
                    <>
                      <AccordionButton
                        className='accordion feature-attribute-divider justify-content-between align-items-center'
                        id='featureNotEquippedButton'
                        target='featureNotEquipped'
                        expanded='false'
                      >
                        <span className='me-3'>Not Equipped</span>
                        <hr className='flex-grow-1 me-3' />
                      </AccordionButton>
                      <div
                        className='accordion-collapse collapse show'
                        id='featureNotEquipped'
                      >
                        <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
                          <Select
                            ref={addToSelectRefs}
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.notEquipped.itemCategory`}
                            placeholder='Item Category'
                            value={
                              featureItem.requirement?.notEquipped?.itemCategory
                            }
                            options={builders.item.itemCategory}
                            required={true}
                            onChange={setState}
                          />
                          <Select
                            ref={addToSelectRefs}
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.notEquipped.itemType`}
                            placeholder='Item type'
                            value={
                              featureItem.requirement?.notEquipped?.itemType
                            }
                            options={items.filter(
                              (item) =>
                                item.itemCategory.value !==
                                featureItem.requirement?.notEquipped
                                  ?.itemCategory?.value
                            )}
                            required={true}
                            onChange={setState}
                          />
                          <Select
                            ref={addToSelectRefs}
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.notEquipped.itemProperty`}
                            placeholder='Item Property'
                            value={
                              featureItem.requirement?.notEquipped?.itemProperty
                            }
                            options={[].concat(
                              ...builders.item.itemCategory
                                .filter((itemCategory) =>
                                  featureItem.requirement?.notEquipped?.itemCategory?.some(
                                    (categoryItem) =>
                                      itemCategory._id.includes(categoryItem.id)
                                  )
                                )
                                .map(
                                  (filteredItem) => filteredItem.itemProperty
                                )
                            )}
                            required={true}
                            onChange={setState}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    !!featureItem.requirement?.notEquipped &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.requirement.notEquipped`,
                        },
                      },
                    })
                  )}
                  {featureItem.limitUse?.limitBy?.name === 'level' &&
                    featureItem.attribute?.some(
                      (attributeItem) => attributeItem.name === 'limitUse'
                    ) &&
                    (featureItem.limitUse.level ??
                      setState({
                        type: 'added',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.limitUse.level`,
                          },
                        },
                      })) && (
                      <div>
                        <Table
                          headers={[
                            {
                              name: 'level',
                              value: 'Level',
                              invalid: 'Must contain only numbers',
                              validation: 'num',
                              label: true,
                            },
                            {
                              name: 'uses',
                              value: 'Uses',
                              invalid: 'Must contain only numbers',
                              validation: 'num',
                              label: true,
                            },
                          ]}
                          name={`feature.${featureIndex}.limitUse.level`}
                          value={featureItem.limitUse?.level}
                          onChange={setState}
                          dynamic={true}
                        />
                      </div>
                    )}
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
                      <div className='row g-2 align-items-end pb-2'>
                        <Select
                          ref={addToSelectRefs}
                          multiple={true}
                          name={`feature.${featureIndex}.damage.damageAttribute`}
                          placeholder='Damage Attribute'
                          value={featureItem.damage?.damageAttribute}
                          options={builders.race.feature.damageAttribute}
                          required={true}
                          onChange={setState}
                        />
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.damage.damageType`}
                          multiple={true}
                          placeholder='Damage Type'
                          value={featureItem.damage?.damageType}
                          options={builders.damage}
                          required={true}
                          onChange={setState}
                        />
                      </div>
                    )
                  ) : (
                    !!featureItem.damage &&
                    setState({
                      action: 'removed',
                      payload: {
                        target: {
                          name: `feature.${featureIndex}.damage`,
                        },
                      },
                    })
                  )}
                  {featureItem.attribute?.some(
                    (attributeItem) => attributeItem.name === 'doesDamage'
                  ) && (
                    <>
                      <AccordionButton
                        className='accordion form-details justify-content-between align-items-center'
                        id='damageTableButton'
                        target='damageTable'
                        expanded='false'
                      >
                        <span className='me-3'>Damage Table</span>
                        <hr className='flex-grow-1 me-3' />
                      </AccordionButton>
                      <div
                        className='accordion-collapse collapse show pb-2'
                        id='damageTable'
                      >
                        <Table
                          inputs={damageTableInputs(
                            featureItem.attribute?.some(
                              (attributeItem) =>
                                attributeItem.name === 'secondaryDamage'
                            )
                          )}
                          name={`feature.${featureIndex}.damage.damageByLevel`}
                          value={featureItem.damage?.damageByLevel}
                          onChange={setState}
                          dynamic={true}
                          scrollable={true}
                        />
                      </div>
                    </>
                  )}
                  <div className='accordion' id='sectionAccordion'>
                    {sections.map(
                      (sectionItem, sectionIndex) =>
                        !!featureItem[sectionItem.name] &&
                        featureItem[sectionItem.name].map((item, itemIndex) => (
                          <div key={itemIndex} className='accordion-item'>
                            <div className='accordion-header'>
                              <AccordionButton
                                id={`${featureIndex}${sectionItem.name}${sectionIndex}${itemIndex}AccordionButton`}
                                target={`${featureIndex}${sectionItem.name}${sectionIndex}${itemIndex}AccordionBody`}
                                expanded='false'
                              >
                                <h6>{`${startCase(sectionItem.name)} ${
                                  itemIndex + 1
                                }`}</h6>
                              </AccordionButton>
                            </div>
                            <div
                              className='accordion-collapse collapse show'
                              id={`${featureIndex}${sectionItem.name}${sectionIndex}${itemIndex}AccordionBody`}
                              data-bs-parent='#sectionAccordion'
                            >
                              <div className='accordion-body'>
                                {sectionItem.content(
                                  featureItem,
                                  featureIndex,
                                  item,
                                  itemIndex
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })

    content = (
      <div className='main-container'>
        <div className='d-flex justify-content-between pb-2'>
          <h3>Create a Race</h3>
          <div>
            <button
              className='btn btn-secondary btn-small me-2'
              onClick={onReset}
            >
              Reset Form
            </button>
            <button
              className='btn btn-secondary btn-small'
              onClick={onBackClick}
            >
              Back
            </button>
          </div>
        </div>
        {successMessage && (
          <h5 className='success-message'>{successMessage}</h5>
        )}
        {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
        <form className='needs-validation' noValidate>
          <div className='row g-2 pb-2'>
            <Input
              ref={addToInputRefs}
              name='value'
              label={true}
              autoComplete='off'
              placeholder='Race Name'
              required={true}
              value={state.value}
              onChange={setState}
            />
            <Select
              ref={addToSelectRefs}
              name='category'
              placeholder='Race Category'
              value={state?.category}
              options={builders.race.category}
              required={true}
              onChange={setState}
            />
            {state.category?.name && state.category?.name !== 'base' && (
              <Select
                ref={addToSelectRefs}
                multiple={true}
                name='lineage'
                placeholder='Race Lineage'
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
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='detailsButton'
            target='details'
          >
            <span className='me-3'>Details</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show' id='details'>
            <TextEditor
              ref={addToTextRefs}
              name={'quote'}
              value={state?.quote}
              placeholder={'Opening Quote'}
              onChange={setState}
            />
            <div className='pb-2'>
              <button
                className='btn btn-secondary'
                type='button'
                name='details'
                onClick={(e) => setState({ type: 'added', payload: e })}
              >
                Add Details Section
              </button>
            </div>
            <div className='accordion' id='detailsSectionAccordion'>
              {state.details?.map((detailItem, detailIndex) => (
                <div key={detailIndex}>
                  <div className='accordion-item'>
                    <div className='accordion-header'>
                      <AccordionButton
                        id={`details.${detailIndex}AccordionButton`}
                        target={`details.${detailIndex}AccordionBody`}
                        key={detailIndex}
                      >
                        <Input
                          ref={addToInputRefs}
                          size='col-sm-4'
                          name={`details.${detailIndex}.title`}
                          border={false}
                          autoComplete='off'
                          placeholder='Section Title'
                          value={detailItem.title}
                          onChange={setState}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </AccordionButton>
                    </div>
                    <div
                      className='accordion-collapse collapse show'
                      id={`details.${detailIndex}AccordionBody`}
                      data-bs-parent='#detailsSectionAccordion'
                    >
                      <div className='accordion-body'>
                        <div className='col-auto pb-3'>
                          <button
                            className='btn btn-outline-primary overflow-hidden text-nowrap'
                            type='button'
                            name={`details.${detailIndex}`}
                            onClick={(e) =>
                              setState({ type: 'removed', payload: e })
                            }
                          >
                            Remove Section
                          </button>
                        </div>
                        <TextEditor
                          ref={addToTextRefs}
                          name={`details.${detailIndex}.desc`}
                          value={detailItem.desc}
                          placeholder={'Section Description'}
                          onChange={setState}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='traitButton'
            target='trait'
          >
            <span className='me-3'>Traits</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show pb-2' id='trait'>
            <TextEditor
              ref={addToTextRefs}
              name='traits.desc'
              value={state.traits?.desc}
              placeholder={'Traits Description'}
              onChange={setState}
            />
            <div className='row g-2 pb-2 row-cols-lg-4 row-cols-md-3 row-cols-sm-1'>
              <Select
                ref={addToSelectRefs}
                multiple={true}
                name='attribute'
                placeholder='Attributes'
                value={state.attribute}
                options={builders.race.attribute}
                required={true}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name='traits.size'
                placeholder='Size'
                value={state.traits?.size}
                options={builders.race.size}
                required={true}
                onChange={setState}
              />
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'walking'
              ) && (
                <Input
                  ref={addToInputRefs}
                  validate='num'
                  name='traits.speed.walking'
                  placeholder='Walking Speed'
                  label={true}
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
                  ref={addToInputRefs}
                  validate='num'
                  name='traits.speed.climbing'
                  placeholder='Climbing Speed'
                  label={true}
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
                  ref={addToInputRefs}
                  validate='num'
                  name='traits.speed.swimming'
                  placeholder='Swimming Speed'
                  label={true}
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
                  ref={addToInputRefs}
                  validate='num'
                  name='traits.speed.flying'
                  placeholder='Flying Speed'
                  label={true}
                  invalidText='Must contain only numbers'
                  required={true}
                  value={state.traits?.speed?.flying}
                  onChange={setState}
                />
              )}
            </div>
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
                <AccordionButton
                  className='accordion form-details justify-content-between align-items-center'
                  id='ancestryButton'
                  target='ancestry'
                >
                  <span className='me-3'>Ancestry</span>
                  <hr className='flex-grow-1 me-3' />
                </AccordionButton>
                <div
                  className='accordion-collapse collapse show pb-2 row'
                  id='ancestry'
                >
                  <Table
                    inputs={[
                      {
                        name: 'ancestry',
                        value: 'Ancestry',
                        size: 'col-lg-3 col-md-4 col-sm-12',
                        label: true,
                      },
                      {
                        name: 'description',
                        value: 'Description',
                        label: true,
                        size: 'col-sm',
                      },
                    ]}
                    name='ancestry'
                    value={state?.ancestry}
                    onChange={setState}
                    dynamic={true}
                  />
                </div>
              </>
            )
          ) : (
            !!state?.ancestry &&
            setState({
              action: 'removed',
              payload: {
                target: {
                  name: `ancestry`,
                },
              },
            })
          )}
          <div className='d-flex pb-3 justify-content-between'>
            <button
              className='btn btn-secondary me-2'
              name='feature'
              type='button'
              onClick={(e) => setState({ type: 'added', payload: e })}
            >
              Add Feature
            </button>
            <div className='d-flex'>
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
                className='btn btn-primary'
                type='button'
                onClick={() => {
                  onSubmit()
                }}
              >
                Add New
              </button>
            </div>
          </div>
          {featureContent}
        </form>
      </div>
    )
    return content
  }
}
export default EditRaceForm
