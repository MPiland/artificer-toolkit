import { useEffect, useReducer, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAddNewFeatMutation } from './featsApiSlice'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useGetSpellQuery } from '../spells/spellsApiSlice'
import { useGetFeatQuery } from './featsApiSlice'
import { startCase } from 'lodash'
import formReducer from '../../hooks/useReducer'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'
import AccordionButton from '../../components/AccordionButton'

const NewFeatForm = () => {
  const { id } = useAuth()
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

  const [
    addNewFeat,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewFeatMutation()

  const [state, setState] = useReducer(formReducer, { userId: id })
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const selectRefs = useRef([])
  const inputRefs = useRef([])
  const textRefs = useRef([])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Feat added successfully!')
      handleValidation(true)
    }
  }, [addIsSuccess, id, setState])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.message)
    }
  }, [addIsError, addError])

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
      if (resetValidation === true) {
        selectRef.setClass('')
      }
    })

    // Validate other elements with the required attribute
    const requiredElements = document.querySelectorAll('[required]')
    requiredElements.forEach((element) => {
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
      if (resetValidation === true) {
        element.classList.remove('is-valid')
        element.classList.remove('is-invalid')
      }
    })
    return isValid
  }

  const onReset = () => {
    inputRefs.current.forEach((inputRef) => {
      inputRef.resetState()
    })
    textRefs.current.forEach((textRef) => {
      textRef.resetState()
    })
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
      await addNewFeat(state)
    } else {
      setErrorMessage('Please fill out all required fields')
    }
  }

  let content

  if (builderIsLoading || spellIsLoading || featIsLoading) {
    content = <p>Loading...</p>
  }

  if (builderIsSuccess && spellIsSuccess && featIsSuccess) {
    const damageTableInputs = (secondary) => {
      const inputArray = [
        {
          name: 'level',
          value: 'Level',
          invalid: 'Must contain only numbers',
          validation: true,
          label: true,
          size: 'damage-col',
        },
        {
          name: 'diceCount',
          value: 'Dice Count',
          invalid: 'Must contain only numbers',
          validation: true,
          label: true,
          size: 'damage-col',
        },
        {
          name: 'diceValue',
          value: 'Dice Value',
          invalid: 'Must contain only numbers',
          validation: true,
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
            validation: true,
            label: true,
            size: 'damage-col',
          },
          {
            name: 'secDiceValue',
            value: 'Sec. Dice Value',
            invalid: 'Must contain only numbers',
            validation: true,
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
                    validation='num'
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
                    multipleOptions && '.options'
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
                    validation='num'
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
                        }.${index}.ability${multipleOptions && '.options'}`}
                        multiple={multipleOptions}
                        placeholder='Ability'
                        value={
                          multipleOptions ? item.ability.options : item.ability
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
                        }.${index}.saveAbility${multipleOptions && '.options'}`}
                        multiple={multipleOptions}
                        placeholder='Save Ability'
                        value={
                          multipleOptions
                            ? item.saveAbility.options
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
                        }.${index}.skill${multipleOptions && '.options'}`}
                        multiple={multipleOptions}
                        placeholder='Skill'
                        value={
                          multipleOptions ? item.skill.options : item.skill
                        }
                        options={builders.skill}
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
                      required={true}
                      onChange={setState}
                    />
                  )}
                {item.module?.name === 'condition' ? (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.condition${multipleOptions && '.options'}`}
                    multiple={multipleOptions}
                    placeholder='Condition Type'
                    value={
                      multipleOptions ? item.condition.options : item.condition
                    }
                    options={builders.condition}
                    required={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'speed' ? (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.speed${
                      multipleOptions && '.options'
                    }`}
                    multiple={multipleOptions}
                    value={multipleOptions ? item.speed.options : item.speed}
                    placeholder='Speed Type'
                    options={builders.speed}
                    required={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'passive' ? (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.passive${multipleOptions && '.options'}`}
                    multiple={multipleOptions}
                    placeholder='Passive Type'
                    value={
                      multipleOptions ? item.passive.options : item.passive
                    }
                    options={builders.passive}
                    required={true}
                    onChange={setState}
                  />
                ) : (
                  item.module?.name === 'damage' && (
                    <Select
                      ref={addToSelectRefs}
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.damage${multipleOptions && '.options'}`}
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
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.method.setValue`}
                      placeholder='Set Value'
                      label={true}
                      invalidText='Must contain only numbers'
                      autoComplete='off'
                      value={item.method?.setValue}
                      required={true}
                      onChange={setState}
                    />
                    <Select
                      ref={addToSelectRefs}
                      name={`feature.${featureIndex}.${this.name}.${index}.multiplier`}
                      placeholder='Multiplier'
                      value={item.multiplier}
                      options={builders.modifier.multiplier}
                      required={true}
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
                    required={true}
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
                      required={true}
                      onChange={setState}
                    />
                  )
                )}
                {(item.modType?.name === 'bonus' ||
                  item.modType?.name === 'setValue') && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.exceedMax`}
                    placeholder='Exceeds Max'
                    value={item.exceedMax}
                    options={[
                      { name: true, value: 'Yes' },
                      { name: false, value: 'No' },
                    ]}
                    required={true}
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
                    validation='num'
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup}
                    invalidText='Must contain only numbers'
                    required={true}
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
                  required={true}
                  onChange={setState}
                />
                {item?.area?.name === 'skill' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.skill${
                      multipleOptions && '.options'
                    }`}
                    multiple={multipleOptions}
                    placeholder='Skill'
                    value={multipleOptions ? item.skill.options : item.skill}
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'saveAbility' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.saveAbility${multipleOptions && '.options'}`}
                    multiple={multipleOptions}
                    placeholder='Save Ability'
                    value={
                      multipleOptions
                        ? item.saveAbility.options
                        : item.saveAbility
                    }
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'tool' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.tool${
                      multipleOptions && '.options'
                    }`}
                    multiple={multipleOptions}
                    placeholder='Tool'
                    value={multipleOptions ? item.tool.options : item.tool}
                    options={builders.tool}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'language' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.language${multipleOptions && '.options'}`}
                    multiple={multipleOptions}
                    placeholder='Language'
                    value={
                      multipleOptions ? item.language.options : item.language
                    }
                    options={builders.language}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.area?.name === 'itemType' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.itemType${multipleOptions && '.options'}`}
                    multiple={multipleOptions}
                    placeholder='Item Type'
                    value={
                      multipleOptions ? item.itemType.options : item.itemType
                    }
                    options={[].concat(
                      ...builders.item.itemCategory.map(
                        (categoryItem) => categoryItem.itemType
                      )
                    )}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.area?.name === 'itemProperty' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.itemProperty${multipleOptions && '.options'}`}
                    multiple={multipleOptions}
                    placeholder='Item Property'
                    value={
                      multipleOptions
                        ? item.itemProperty.options
                        : item.itemProperty
                    }
                    options={[].concat(
                      ...builders.item.itemCategory.map(
                        (categoryItem) => categoryItem.itemProperty
                      )
                    )}
                    required={true}
                    onChange={setState}
                  />
                )}
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}.level`}
                  placeholder='Proficiency Level'
                  value={item.level}
                  options={builders.proficiency.level}
                  required={true}
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
                    validation='num'
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup}
                    invalidText='Must contain only numbers'
                    required={true}
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}.sense${
                    multipleOptions && '.options'
                  }`}
                  multiple={multipleOptions}
                  placeholder='Sense'
                  value={multipleOptions ? item.sense.options : item.sense}
                  options={builders.sense}
                  required={true}
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
                    validation='num'
                    name={`feature.${featureIndex}.${this.name}.${index}.optionGroup`}
                    label={true}
                    placeholder='Opt. Grp. #'
                    autoComplete='off'
                    value={item.optionGroup}
                    invalidText='Must contain only numbers'
                    required={true}
                    onChange={setState}
                  />
                )}
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <Select
                  ref={addToSelectRefs}
                  multiple={true}
                  name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                  options={builders.feat.feature.spell.attribute}
                  placeholder='Spell Attributes'
                  value={item.attribute}
                  required={true}
                  onChange={setState}
                />
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}${
                    multipleOptions && '.options'
                  }`}
                  multiple={multipleOptions}
                  placeholder='Spell'
                  value={
                    multipleOptions ? item.saveAbility.options : item.options
                  }
                  options={spells}
                  required={true}
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
                      multipleOptions ? item.ability.options : item.ability
                    }
                    options={builders.ability}
                    required={true}
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
                >
                  <Input
                    ref={addToInputRefs}
                    size='col-sm-4'
                    name={`feature.${featureIndex}.value`}
                    border={false}
                    autoComplete='off'
                    placeholder='Feature Name'
                    value={featureItem.value}
                    clickable={false}
                    onChange={setState}
                    onClick={(e) => e.stopPropagation()}
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
                      value={featureItem.attribute}
                      options={builders.feat.feature.attribute.filter(
                        (attributeItem) =>
                          !featureItem.attribute?.some(
                            (item) => item.name === 'doesDamage'
                          )
                            ? attributeItem.name !== 'secondaryDamage'
                            : attributeItem
                      )}
                      placeholder='Feature Attributes'
                      onChange={setState}
                    />
                    {featureItem.attribute?.some(
                      (attributeItem) =>
                        attributeItem.name === 'hasRequirements'
                    ) ? (
                      <Select
                        ref={addToSelectRefs}
                        multiple={true}
                        name={`feature.${featureIndex}.requirement.option`}
                        value={featureItem.requirement?.option}
                        placeholder='Requirement'
                        options={builders.feat.feature.requirements}
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
                        value={featureItem.requirement?.skillProficiency?.skill}
                        placeholder='Skill Proficiency'
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
                          value={
                            featureItem.requirement?.itemProficiency
                              ?.itemCategory
                          }
                          placeholder='Item Category'
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
                          options={[].concat(
                            ...builders.item.itemCategory
                              .filter((itemCategory) =>
                                featureItem.requirement?.itemCategory?.some(
                                  (categoryItem) =>
                                    itemCategory._id.includes(categoryItem.id)
                                )
                              )
                              .map((filteredItem) => filteredItem.itemType)
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
                    {featureItem.attribute?.some(
                      (attributeItem) => attributeItem.name === 'limitUse'
                    ) ? (
                      <>
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.limitUse.limitBy`}
                          placeholder='Limit By Option'
                          value={featureItem.limitUse?.limitBy}
                          options={builders.feat.feature.chargeLimit}
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
                              validation='num'
                              name={`feature.${featureIndex}.limitUse.setAmount`}
                              label={true}
                              invalidText='Must contain only numbers'
                              placeholder='Use Amount'
                              required={true}
                              value={featureItem.limitUse.setAmount}
                              onChange={setState}
                            />
                          )
                        )}
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.limitUse.resetsOn`}
                          placeholder='Reset Option'
                          value={featureItem.limitUse?.resetsOn}
                          options={builders.feat.feature.chargeReset}
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
                          options={builders.feat.feature.action}
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
                          validation='num'
                          name={`feature.${featureIndex}.range.minRange`}
                          autoComplete='off'
                          label={true}
                          placeholder='Min Range'
                          required={true}
                          value={featureItem.range.minRange}
                          invalidText='Must contain only numbers'
                          onChange={setState}
                        />
                        <Input
                          ref={addToInputRefs}
                          validation={'num'}
                          name={`feature.${featureIndex}.range.maxRange`}
                          label={true}
                          autoComplete='off'
                          placeholder='Max Range'
                          invalidText='Must contain only numbers'
                          required={true}
                          value={featureItem.range.maxRange}
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
                            value={
                              featureItem.requirement?.equipped?.itemCategory
                            }
                            placeholder='Item Category'
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
                            options={[].concat(
                              ...builders.item.itemCategory
                                .filter((itemCategory) =>
                                  featureItem.requirement?.equipped?.itemCategory?.some(
                                    (categoryItem) =>
                                      itemCategory._id.includes(categoryItem.id)
                                  )
                                )
                                .map((filteredItem) => filteredItem.itemType)
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
                            value={
                              featureItem.requirement?.notEquipped?.itemCategory
                            }
                            placeholder='Item Category'
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
                            options={[].concat(
                              ...builders.item.itemCategory
                                .filter((itemCategory) =>
                                  featureItem.requirement?.notEquipped?.itemCategory?.some(
                                    (categoryItem) =>
                                      itemCategory._id.includes(categoryItem.id)
                                  )
                                )
                                .map((filteredItem) => filteredItem.itemType)
                            )}
                            required={true}
                            onChange={setState}
                          />
                          <Select
                            ref={addToSelectRefs}
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.notEquipped.itemProperty`}
                            value={
                              featureItem.requirement?.notEquipped?.itemProperty
                            }
                            placeholder='Item Property'
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
                          inputs={[
                            {
                              name: 'level',
                              value: 'Level',
                              invalid: 'Must contain only numbers',
                              label: true,
                            },
                            {
                              name: 'uses',
                              value: 'Uses',
                              invalid: 'Must contain only numbers',
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
                          value={featureItem.damage?.damageAttribute}
                          placeholder='Damage Attribute'
                          options={builders.feat.feature.damageAttribute}
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
                                id={`${sectionItem.name}${itemIndex}AccordionButton`}
                                target={`${sectionItem.name}${itemIndex}AccordionBody`}
                              >
                                <h6>{`${startCase(sectionItem.name)} ${
                                  itemIndex + 1
                                }`}</h6>
                              </AccordionButton>
                            </div>
                            <div
                              className='accordion-collapse collapse show'
                              id={`${sectionItem.name}${itemIndex}AccordionBody`}
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
      <div className='builder-form'>
        <div className='d-flex justify-content-between pb-2'>
          <h3>Create a Feat</h3>
          <div>
            <button
              className='btn btn-secondary btn-small me-2'
              onClick={onReset}
            >
              Reset Form
            </button>
            <button
              className='btn btn-secondary btn-small'
              onClick={() => navigate(-1)}
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
          <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
            <Input
              ref={addToInputRefs}
              name='value'
              autoComplete='off'
              placeholder='Feat Name'
              label={true}
              value={state.value}
              required={true}
              onChange={setState}
            />
          </div>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='descriptionButton'
            target='description'
          >
            <span className='me-3'>Description</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show' id='description'>
            <div className='pb-2'>
              <TextEditor
                ref={addToTextRefs}
                name={'desc'}
                value={state.desc}
                placeholder={'Feat Description'}
                onChange={setState}
              />
            </div>
          </div>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='descriptionButton'
            target='description'
          >
            <span className='me-3'>Attributes</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show' id='attributes'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-3'>
              <Select
                multiple={true}
                name='attribute'
                value={state.attribute}
                options={builders.feat.feature.attribute.filter(
                  (attributeItem) =>
                    !state.attribute?.some((item) => item.name === 'doesDamage')
                      ? attributeItem.name !== 'secondaryDamage'
                      : attributeItem
                )}
                placeholder='Feat Attributes'
                onChange={setState}
              />
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'hasRequirements'
              ) ? (
                <Select
                  ref={addToSelectRefs}
                  multiple={true}
                  name='requirement.option'
                  value={state.requirement?.option}
                  placeholder='Requirement'
                  options={builders.feat.feature.requirements}
                  required={true}
                  onChange={setState}
                />
              ) : (
                !!state.requirement &&
                setState({
                  action: 'removed',
                  payload: {
                    target: {
                      name: 'requirement',
                    },
                  },
                })
              )}
              {state.requirement?.option?.some(
                (optionItem) => optionItem.name === 'skillProficiency'
              ) ? (
                <Select
                  ref={addToSelectRefs}
                  multiple={true}
                  name='requirement.skillProficiency.skill'
                  value={state.requirement?.skillProficiency?.skill}
                  placeholder='Skill Proficiency'
                  options={builders.skill}
                  required={true}
                  onChange={setState}
                />
              ) : (
                !!state.requirement?.skillProficiency &&
                setState({
                  action: 'removed',
                  payload: {
                    target: {
                      name: 'requirement.skillProficiency',
                    },
                  },
                })
              )}
              {state.requirement?.option?.some(
                (optionItem) => optionItem.name === 'itemProficiency'
              ) ? (
                <>
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.itemProficiency.itemCategory'
                    value={state.requirement?.itemProficiency?.itemCategory}
                    placeholder='Item Category'
                    options={builders.item.itemCategory}
                    required={true}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    name='requirement.itemProficiency.itemType'
                    placeholder='Item type'
                    value={state.requirement?.itemProficiency?.itemType}
                    options={[].concat(
                      ...builders.item.itemCategory
                        .filter((itemCategory) =>
                          state.requirement?.itemCategory?.some(
                            (categoryItem) =>
                              itemCategory._id.includes(categoryItem.id)
                          )
                        )
                        .map((filteredItem) => filteredItem.itemType)
                    )}
                    required={true}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    name='requirement.itemProficiency.itemProperty'
                    placeholder='Item Property'
                    value={state.requirement?.itemProficiency?.itemProperty}
                    options={[].concat(
                      ...builders.item.itemCategory
                        .filter((itemCategory) =>
                          state.requirement?.itemCategory?.some(
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
                !!state.requirement?.itemProficiency &&
                setState({
                  action: 'removed',
                  payload: {
                    target: {
                      name: 'requirement.itemProficiency',
                    },
                  },
                })
              )}
              {state.requirement?.option?.some(
                (optionItem) => optionItem.name === 'abilityScore'
              ) ? (
                <>
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.abilityScore.ability'
                    value={state.requirement?.abilityScore?.ability}
                    placeholder='Ability'
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                  <Input
                    ref={addToInputRefs}
                    name='requirement.abilityScore.score'
                    value={state.requirement?.abilityScore?.score}
                    placeholder='Score'
                    required={true}
                    label={true}
                    validation='num'
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                </>
              ) : (
                !!state.requirement?.abilityScore &&
                setState({
                  action: 'removed',
                  payload: {
                    target: {
                      name: 'requirement.abilityScore',
                    },
                  },
                })
              )}
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'limitUse'
              ) ? (
                <>
                  <Select
                    ref={addToSelectRefs}
                    name='limitUse.limitBy'
                    placeholder='Limit By Option'
                    value={state.limitUse?.limitBy}
                    options={builders.feat.feature.chargeLimit}
                    required={true}
                    onChange={setState}
                  />
                  {state.limitUse?.limitBy?.name === 'ability' ? (
                    <Select
                      ref={addToSelectRefs}
                      name='limitUse.ability'
                      placeholder='Ability'
                      value={state.limitUse?.ability}
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  ) : state.limitUse?.limitBy?.name === 'skill' ? (
                    <Select
                      ref={addToSelectRefs}
                      name='limitUse.skill'
                      placeholder='Skill'
                      value={state.limitUse?.skill}
                      options={builders.skill}
                      required={true}
                      onChange={setState}
                    />
                  ) : (
                    state.limitUse?.limitBy?.name === 'setNumber' && (
                      <Input
                        ref={addToInputRefs}
                        validation='num'
                        name='limitUse.setAmount'
                        label={true}
                        invalidText='Must contain only numbers'
                        placeholder='Use Amount'
                        required={true}
                        value={state.limitUse.setAmount}
                        onChange={setState}
                      />
                    )
                  )}
                  <Select
                    ref={addToSelectRefs}
                    name='limitUse.resetsOn'
                    placeholder='Reset Option'
                    value={state.limitUse?.resetsOn}
                    options={builders.feat.feature.chargeReset}
                    required={true}
                    onChange={setState}
                  />
                </>
              ) : (
                !!state.limitUse &&
                setState({
                  action: 'removed',
                  payload: {
                    target: {
                      name: 'limitUse',
                    },
                  },
                })
              )}
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'isAction'
              ) ? (
                <>
                  <Select
                    ref={addToSelectRefs}
                    name='action'
                    placeholder='Action Type'
                    value={state.action}
                    options={builders.feat.feature.action}
                    required={true}
                    onChange={setState}
                  />
                </>
              ) : (
                !!state.action &&
                setState({
                  action: 'removed',
                  payload: {
                    target: {
                      name: 'action',
                    },
                  },
                })
              )}
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'hasRange'
              ) ? (
                <>
                  <Input
                    ref={addToInputRefs}
                    validation='num'
                    name='range.minRange'
                    autoComplete='off'
                    label={true}
                    placeholder='Min Range'
                    required={true}
                    value={state.range.minRange}
                    invalidText='Must contain only numbers'
                    onChange={setState}
                  />
                  <Input
                    ref={addToInputRefs}
                    validation={'num'}
                    name='range.maxRange'
                    label={true}
                    autoComplete='off'
                    placeholder='Max Range'
                    invalidText='Must contain only numbers'
                    required={true}
                    value={state.range.maxRange}
                    onChange={setState}
                  />
                </>
              ) : (
                !!state.saveAbility &&
                setState({
                  action: 'removed',
                  payload: {
                    target: {
                      name: 'range',
                    },
                  },
                })
              )}
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'requireSave'
              ) ? (
                <Select
                  ref={addToSelectRefs}
                  name='saveAbility'
                  placeholder='DC Ability'
                  value={state.saveAbility}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
              ) : (
                !!state.saveAbility &&
                setState({
                  action: 'removed',
                  payload: {
                    target: {
                      name: 'saveAbility',
                    },
                  },
                })
              )}
            </div>
            {state.requirement?.option?.some(
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
                      name='requirement.equipped.itemCategory'
                      value={state.requirement?.equipped?.itemCategory}
                      placeholder='Item Category'
                      options={builders.item.itemCategory}
                      required={true}
                      onChange={setState}
                    />
                    <Select
                      ref={addToSelectRefs}
                      multiple={true}
                      name='requirement.equipped.itemType'
                      placeholder='Item type'
                      value={state.requirement?.equipped?.itemType}
                      options={[].concat(
                        ...builders.item.itemCategory
                          .filter((itemCategory) =>
                            state.requirement?.equipped?.itemCategory?.some(
                              (categoryItem) =>
                                itemCategory._id.includes(categoryItem.id)
                            )
                          )
                          .map((filteredItem) => filteredItem.itemType)
                      )}
                      required={true}
                      onChange={setState}
                    />
                    <Select
                      ref={addToSelectRefs}
                      multiple={true}
                      name='requirement.equipped.itemProperty'
                      placeholder='Item Property'
                      value={state.requirement?.equipped?.itemProperty}
                      options={[].concat(
                        ...builders.item.itemCategory
                          .filter((itemCategory) =>
                            state.requirement?.equipped?.itemCategory?.some(
                              (categoryItem) =>
                                itemCategory._id.includes(categoryItem.id)
                            )
                          )
                          .map((filteredItem) => filteredItem.itemProperty)
                      )}
                      required={true}
                      onChange={setState}
                    />
                  </div>
                </div>
              </>
            ) : (
              !!state.requirement?.equipped &&
              setState({
                action: 'removed',
                payload: {
                  target: {
                    name: 'requirement.equipped',
                  },
                },
              })
            )}
            {state.requirement?.option?.some(
              (optionItem) => optionItem.name === 'notEquipped'
            ) ? (
              <>
                <AccordionButton
                  className='accordion feature-attribute-divider justify-content-between align-items-center'
                  id='featureNotEquippedButton'
                  target='featureNotEquipped'
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
                      name='requirement.notEquipped.itemCategory'
                      value={state.requirement?.notEquipped?.itemCategory}
                      placeholder='Item Category'
                      options={builders.item.itemCategory}
                      required={true}
                      onChange={setState}
                    />
                    <Select
                      ref={addToSelectRefs}
                      multiple={true}
                      name='requirement.notEquipped.itemType'
                      placeholder='Item type'
                      value={state.requirement?.notEquipped?.itemType}
                      options={[].concat(
                        ...builders.item.itemCategory
                          .filter((itemCategory) =>
                            state.requirement?.notEquipped?.itemCategory?.some(
                              (categoryItem) =>
                                itemCategory._id.includes(categoryItem.id)
                            )
                          )
                          .map((filteredItem) => filteredItem.itemType)
                      )}
                      required={true}
                      onChange={setState}
                    />
                    <Select
                      ref={addToSelectRefs}
                      multiple={true}
                      name='requirement.notEquipped.itemProperty'
                      value={state.requirement?.notEquipped?.itemProperty}
                      placeholder='Item Property'
                      options={[].concat(
                        ...builders.item.itemCategory
                          .filter((itemCategory) =>
                            state.requirement?.notEquipped?.itemCategory?.some(
                              (categoryItem) =>
                                itemCategory._id.includes(categoryItem.id)
                            )
                          )
                          .map((filteredItem) => filteredItem.itemProperty)
                      )}
                      required={true}
                      onChange={setState}
                    />
                  </div>
                </div>
              </>
            ) : (
              !!state.requirement?.notEquipped &&
              setState({
                action: 'removed',
                payload: {
                  target: {
                    name: 'requirement.notEquipped',
                  },
                },
              })
            )}
            {state.limitUse?.limitBy?.name === 'level' &&
              state.attribute?.some(
                (attributeItem) => attributeItem.name === 'limitUse'
              ) &&
              (state.limitUse.level ??
                setState({
                  type: 'added',
                  payload: {
                    target: {
                      name: 'limitUse.level',
                    },
                  },
                })) && (
                <div>
                  <Table
                    inputs={[
                      {
                        name: 'level',
                        value: 'Level',
                        invalid: 'Must contain only numbers',
                        label: true,
                      },
                      {
                        name: 'uses',
                        value: 'Uses',
                        invalid: 'Must contain only numbers',
                        label: true,
                      },
                    ]}
                    name='limitUse.level'
                    value={state.limitUse?.level}
                    onChange={setState}
                    dynamic={true}
                  />
                </div>
              )}
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
                    ref={addToSelectRefs}
                    multiple={true}
                    name='damage.damageAttribute'
                    value={state.damage?.damageAttribute}
                    placeholder='Damage Attribute'
                    options={builders.feat.feature.damageAttribute}
                    required={true}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    name='damage.damageType'
                    multiple={true}
                    placeholder='Damage Type'
                    value={state.damage?.damageType}
                    options={builders.damage}
                    required={true}
                    onChange={setState}
                  />
                </div>
              )
            ) : (
              !!state.damage &&
              setState({
                action: 'removed',
                payload: {
                  target: {
                    name: 'damage',
                  },
                },
              })
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'doesDamage'
            ) && (
              <>
                <AccordionButton
                  className='accordion form-details justify-content-between align-items-center'
                  id='damageTableButton'
                  target='damageTable'
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
                      state.attribute?.some(
                        (attributeItem) =>
                          attributeItem.name === 'secondaryDamage'
                      )
                    )}
                    name='damage.damageByLevel'
                    value={state.damage?.damageByLevel}
                    onChange={setState}
                    dynamic={true}
                    scrollable={true}
                  />
                </div>
              </>
            )}
          </div>
          <div className='d-flex justify-content-between pb-3'>
            <button
              className='btn btn-secondary me-2'
              name='feature'
              type='button'
              onClick={(e) => setState({ type: 'added', payload: e })}
            >
              Add Feature
            </button>
            <button
              className='btn btn-primary'
              type='button'
              onClick={() => {
                onSubmit()
              }}
            >
              Add
            </button>
          </div>
          {featureContent}
        </form>
      </div>
    )
    return content
  }
}
export default NewFeatForm
