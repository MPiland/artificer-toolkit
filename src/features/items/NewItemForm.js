import { useState, useEffect, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAddNewItemMutation } from './itemsApiSlice'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useGetSpellQuery } from '../spells/spellsApiSlice'
import { useGetFeatQuery } from '../feats/featsApiSlice'
import { startCase } from 'lodash'
import formReducer from '../../hooks/useReducer'
import AccordionButton from '../../components/AccordionButton'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'
import { textPasteRule } from '@tiptap/react'

const NewItemForm = () => {
  const { id } = useAuth()
  const navigate = useNavigate()

  const {
    data: builders,
    isSuccess: builderSuccess,
    isLoading: builderLoading,
  } = useGetBuilderQuery(id)

  const {
    data: spells,
    isSuccess: spellSuccess,
    isLoading: spellLoading,
  } = useGetSpellQuery(id)

  const {
    data: feats,
    isSuccess: featSuccess,
    isLoading: featLoading,
  } = useGetFeatQuery(id)

  const [
    addNewItem,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewItemMutation()

  const [state, setState] = useReducer(formReducer, { userId: id })
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const selectRefs = useRef([])
  const inputRefs = useRef([])
  const textRefs = useRef([])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Spell added successfully!')
      setState({
        type: 'reset',
        payload: { target: { userId: id } },
      })
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
    setSuccessMessage(true)
    setErrorMessage(true)
    handleValidation(true)
  }

  const onSubmit = async () => {
    const isValid = handleValidation()
    if (isValid) {
      await addNewItem(state)
    } else {
      setErrorMessage('Please fill out all required fields')
    }
  }

  let content

  if (builderLoading || spellLoading || featLoading) {
    content = <p>Loading...</p>
  }

  if (builderSuccess && spellSuccess && featSuccess) {
    const sections = [
      {
        name: 'feat',
        content(feature, featureIndex, item, index) {
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
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}.sense`}
                  placeholder='Feat'
                  value={item.sense}
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
                        .some((moduleID) => moduleID === moduleItem._id)
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
                        name={`feature.${featureIndex}.${this.name}.${index}.ability`}
                        placeholder='Ability'
                        value={item.ability}
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                    )}
                    {item.module?.name === 'saveAbility' && (
                      <Select
                        ref={addToSelectRefs}
                        name={`feature.${featureIndex}.${this.name}.${index}.saveAbility`}
                        placeholder='Save Ability'
                        value={item.saveAbility}
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                    )}
                    {item.module?.name === 'skill' && (
                      <Select
                        ref={addToSelectRefs}
                        name={`feature.${featureIndex}.${this.name}.${index}.skill`}
                        placeholder='Skill'
                        value={item.skill}
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
                        methodItem.module.some(
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
                    name={`feature.${featureIndex}.${this.name}.${index}.condition`}
                    placeholder='Condition Type'
                    value={item.condition}
                    options={builders.condition}
                    required={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'speed' ? (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                    placeholder='Speed Type'
                    value={item.speed}
                    options={builders.speed}
                    required={true}
                    onChange={setState}
                  />
                ) : item.module?.name === 'passive' ? (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.speed`}
                    value={item.passive}
                    placeholder='Passive Type'
                    options={builders.passive}
                    required={true}
                    onChange={setState}
                  />
                ) : (
                  item.module?.name === 'damage' && (
                    <Select
                      ref={addToSelectRefs}
                      name={`feature.${featureIndex}.${this.name}.${index}.damage.damageType`}
                      placeholder='Damage Type'
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
                {item.area?.name === 'skill' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.skill`}
                    value={item.skill}
                    placeholder='Skill'
                    options={builders.skill}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.area?.name === 'saveAbility' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.saveAbility`}
                    value={item.saveAbility}
                    placeholder='Save Ability'
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'tool' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.tool`}
                    placeholder='Tool'
                    value={item.tool}
                    options={builders.tool}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item?.area?.name === 'language' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.language`}
                    placeholder='Language'
                    value={item.language}
                    options={builders.language}
                    required={true}
                    onChange={setState}
                  />
                )}
                {item.area?.name === 'itemType' && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.itemType`}
                    placeholder='Item Type'
                    value={item.itemType}
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
                    name={`feature.${featureIndex}.${this.name}.${index}.itemProperty`}
                    placeholder='Item Property'
                    value={item.itemProperty}
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
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}.sense`}
                  placeholder='Sense'
                  value={item.sense}
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
              </div>
              <div className='row g-2 row-cols-lg-4 row-cols-md-2 row-cols-sm-1 pb-2'>
                <Select
                  multiple={true}
                  name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                  value={item.attribute}
                  options={builders.feat.feature.spell.attribute}
                  placeholder='Spell Attributes'
                  onChange={setState}
                />
                <Select
                  ref={addToSelectRefs}
                  name={`feature.${featureIndex}.${this.name}.${index}`}
                  placeholder='Spell'
                  value={item}
                  options={spells}
                  required={true}
                  onChange={setState}
                />
                {item.attribute?.some(
                  (attributeItem) => attributeItem.name === 'optionalAbility'
                ) && (
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}.ability`}
                    placeholder='Ability'
                    value={item.ability}
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
        const damageTableInputs = () => {
          const inputArray = [
            {
              name: 'level',
              value: 'Level',
              invalid: 'Must contain only numbers',
              validation: true,
              label: true,
            },
            {
              name: 'diceCount',
              value: 'Dice Count',
              invalid: 'Must contain only numbers',
              validation: true,
              label: true,
            },
            {
              name: 'diceValue',
              value: 'Dice Value',
              invalid: 'Must contain only numbers',
              validation: true,
              label: true,
            },
          ]
          if (
            featureItem.attribute?.some(
              (attributeItem) => attributeItem.name === 'secondaryDamage'
            )
          ) {
            inputArray.push(
              {
                name: 'secDiceCount',
                value: 'Sec. Dice Count',
                invalid: 'Must contain only numbers',
                validation: true,
                label: true,
              },
              {
                name: 'secDiceValue',
                value: 'Sec. Dice Value',
                invalid: 'Must contain only numbers',
                validation: true,
                label: true,
              }
            )
          }

          return inputArray
        }
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
                      options={builders.item.feature.attribute}
                      placeholder='Feature Attributes'
                      value={featureItem.attribute}
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
                        placeholder='Requirement'
                        value={featureItem.requirement?.option}
                        options={builders.item.feature.requirements}
                        required={true}
                        onChange={setState}
                      />
                    ) : (
                      !!featureItem.requirement &&
                      setState({
                        action: 'removed',
                        payload: {
                          target: {
                            name: `feature.${featureIndex}.requirement`,
                          },
                        },
                      })
                    )}
                    {featureItem.requirement?.option.some(
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
                    {featureItem.requirement?.option.some(
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
                    {featureItem.attribute?.some(
                      (attributeItem) => attributeItem.name === 'limitUse'
                    ) ? (
                      <>
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.limitUse.limitBy`}
                          placeholder='Limit By Option'
                          value={featureItem.limitUse?.limitBy}
                          options={builders.item.feature.chargeLimit}
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
                              validation={'num'}
                              name={`feature.${featureIndex}.limitUse.setAmount`}
                              label={true}
                              invalidText='Must contain only numbers'
                              placeholder='Use Amount'
                              required={true}
                              value={featureItem.limitUse?.setAmount}
                              onChange={setState}
                            />
                          )
                        )}
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.limitUse.resetsOn`}
                          placeholder='Reset Option'
                          value={featureItem.limitUse?.resetsOn}
                          options={builders.item.feature.chargeReset}
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
                        <div className='col-sm'>
                          <Select
                            ref={addToSelectRefs}
                            name={`feature.${featureIndex}.action`}
                            placeholder='Action Type'
                            value={featureItem.action}
                            options={builders.item.feature.action}
                            required={true}
                            onChange={setState}
                          />
                        </div>
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
                          ref={addToInputRefs}
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
                  {featureItem.requirement?.option.some(
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
                              featureItem.requirement.equipped.itemCategory
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
                            value={featureItem.requirement.equipped.itemType}
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
                              featureItem.requirement.equipped.itemProperty
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
                  {featureItem.requirement?.option.some(
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
                              featureItem.requirement.notEquipped.itemCategory
                            }
                            placeholder='Item Category'
                            options={builders.item.itemCategory}
                            required={textPasteRule}
                            onChange={setState}
                          />
                          <Select
                            ref={addToSelectRefs}
                            multiple={true}
                            name={`feature.${featureIndex}.requirement.notEquipped.itemType`}
                            placeholder='Item type'
                            value={featureItem.requirement.notEquipped.itemType}
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
                            placeholder='Item Property'
                            value={
                              featureItem.requirement.notEquipped.itemProperty
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
                          className='pb-2'
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
                          value={featureItem.damage.damageAttribute}
                          placeholder='Damage Attribute'
                          options={builders.item.feature.damageAttribute}
                          required={true}
                          onChange={setState}
                        />
                        <Select
                          ref={addToSelectRefs}
                          name={`feature.${featureIndex}.damage.damageType`}
                          placeholder='Damage Type'
                          value={featureItem.damage.damageType}
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
                          inputs={damageTableInputs()}
                          name={`feature.${featureIndex}.damage.damageByLevel`}
                          value={featureItem.damage?.damageByLevel}
                          onChange={setState}
                          dynamic={true}
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
          <h3>Create an Item</h3>
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
          <h3 className='add-success-message'>{successMessage}</h3>
        )}
        {errorMessage && <h3 className='error-message'>{errorMessage}</h3>}
        <form className='needs-validation' noValidate>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='detailsButton'
            target='details'
          >
            <span className='me-3'>Details</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show' id='details'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              <Input
                ref={addToInputRefs}
                name='value'
                autoComplete='off'
                label={true}
                placeholder='Item Name'
                required={true}
                value={state.value}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name='itemCategory'
                placeholder='Item category'
                value={state.itemCategory}
                options={builders.item.itemCategory}
                required={true}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name='itemType'
                placeholder='Item type'
                value={state.itemType}
                options={
                  builders.item.itemCategory.find(
                    (itemCategory) =>
                      itemCategory._id === state.itemCategory?.id
                  )?.itemType
                }
                required={true}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name='itemProperty'
                multiple={true}
                placeholder='Properties'
                value={state.itemProperty}
                options={
                  builders.item.itemCategory.find(
                    (itemCategory) =>
                      itemCategory._id === state.itemCategory?.id
                  )?.itemProperty
                }
                required={true}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name='rarity'
                placeholder='Rarity'
                value={state.rarity}
                options={builders.item.rarity}
                required={true}
                onChange={setState}
              />
              <Input
                ref={addToInputRefs}
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
                ref={addToSelectRefs}
                name='cost.currency'
                placeholder='Currency'
                value={state.cost?.currency}
                options={builders.currency}
                required={true}
                onChange={setState}
              />
              {state.itemCategory && state.itemCategory?.name !== 'item' && (
                <Input
                  ref={addToInputRefs}
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
            </div>
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
            <TextEditor
              ref={addToTextRefs}
              onChange={setState}
              value={state.desc}
              placeholder={'Item description'}
              name={'desc'}
            />
            <TextEditor
              ref={addToTextRefs}
              onChange={setState}
              value={state.quote}
              placeholder={'Item quote'}
              name={'quote'}
            />
          </div>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='attributeButton'
            target='attribute'
          >
            <span className='me-3'>Attributes</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show pb-2' id='attribute'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              <div className='col-sm'>
                <Select
                  ref={addToSelectRefs}
                  name='attribute'
                  multiple={true}
                  placeholder='Attributes'
                  value={state.attribute}
                  options={builders?.item.attribute}
                  required={true}
                  onChange={setState}
                />
              </div>
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'weight'
              ) && (
                <Input
                  ref={addToInputRefs}
                  validation={'num'}
                  name='itemWeight'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Item Weight'
                  autoComplete='off'
                  required={true}
                  value={state.itemWeight}
                  onChange={setState}
                />
              )}
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'container'
              ) && (
                <Input
                  ref={addToInputRefs}
                  validation={'num'}
                  name='capacityWeight'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Capacity Weight'
                  autoComplete='off'
                  required={true}
                  value={state.capacityWeight}
                  onChange={setState}
                />
              )}
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'stackable'
              ) && (
                <Input
                  ref={addToInputRefs}
                  validation={'num'}
                  type='text'
                  name='maxStack'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Max Stack Size'
                  autoComplete='off'
                  required={true}
                  value={state.maxStack}
                  onChange={setState}
                />
              )}
              {state.itemCategory?.name === 'weapon' && (
                <>
                  <Input
                    ref={addToInputRefs}
                    validation={'num'}
                    name='damage.diceCount'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Damage Dice Count'
                    value={state.damage?.diceCount}
                    required={true}
                    onChange={setState}
                  />
                  <Input
                    ref={addToInputRefs}
                    validation={'num'}
                    name='damage.diceValue'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Damage Dice Value'
                    value={state.damage?.diceValue}
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
                  <Select
                    ref={addToSelectRefs}
                    name='primaryAbility'
                    placeholder='Primary Ability'
                    value={state.primaryAbility}
                    options={builders.ability}
                    required={true}
                    onChange={setState}
                  />
                  {state?.itemProperty?.find((property) => {
                    return property.name === 'versatile'
                  }) && (
                    <Select
                      ref={addToSelectRefs}
                      name={'secondaryAbility'}
                      placeholder='Secondary Ability'
                      value={state.secondaryAbility}
                      required={true}
                      options={builders.ability?.filter(
                        (abilityItem) =>
                          abilityItem?._id !== state?.primaryAbility?.id
                      )}
                      onChange={setState}
                    />
                  )}
                </>
              )}
              {state.itemCategory?.name === 'armor' && (
                <Input
                  ref={addToInputRefs}
                  validation={'num'}
                  name='armorValue'
                  label={true}
                  invalidText='Must contain only numbers'
                  placeholder='Armor Value'
                  required={true}
                  value={state.armorValue}
                  onChange={setState}
                />
              )}
              {state.itemProperty?.find(
                (property) =>
                  property.name === 'thrown' || property.name === 'ranged'
              ) && (
                <>
                  <Input
                    ref={addToInputRefs}
                    validation={'num'}
                    name='thrown.minRange'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Thrown Min Range'
                    value={state.thrown?.minRange}
                    required={true}
                    onChange={setState}
                  />
                  <Input
                    ref={addToInputRefs}
                    validation={'num'}
                    name='thrown.maxRange'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Thrown Max Range'
                    value={state.thrown?.maxRange}
                    required={true}
                    onChange={setState}
                  />
                </>
              )}
            </div>
          </div>
          <div className='pb-3'>
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
              Add Item
            </button>
          </div>
          {featureContent}
        </form>
      </div>
    )
    return content
  }
}
export default NewItemForm
