import { useState, useEffect, useReducer, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAddNewItemMutation, useGetItemQuery } from './itemApiSlice'
import { useGetBuilderQuery } from '../builders/builderApiSlice'
import { useGetSpellQuery } from '../spells/spellApiSlice'
import { useGetFeatQuery } from '../feats/featApiSlice'
import { startCase } from 'lodash'
import formReducer from '../../hooks/useReducer'
import AccordionButton from '../../components/AccordionButton'
import TabNavigation from '../../components/TabNavigation'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'

const NewItemForm = () => {
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

  const {
    data: items,
    isSuccess: ItemIsSuccess,
    isLoading: ItemIsLoading,
  } = useGetItemQuery(id)

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
      setSuccessMessage('Item added successfully!')
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
      setState({
        type: 'reset',
        payload: { target: { userId: id } },
      })
    }
    textRefs.current.forEach((textRef) => {
      textRef.updateState('')
    })
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
    textRefs.current.forEach((textRef) => {
      textRef.updateState('')
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

  if (builderIsLoading || spellIsLoading || featIsLoading || ItemIsLoading) {
    content = <p>Loading...</p>
  }

  if ((builderIsSuccess && spellIsSuccess && featIsSuccess) || ItemIsSuccess) {
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

    const sectionTabContent = (feature, featureIndex) => {
      const tabContent = [
        {
          name: 'feat',
          content() {
            return feature[this.name].map((item, index) => (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.set`}
                    placeholder='Feat'
                    value={item?.set}
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
                          multiple={true}
                          name={`feature.${featureIndex}.${this.name}.${index}.ability.set`}
                          placeholder='Ability'
                          value={item.ability?.set}
                          options={builders.ability}
                          required={true}
                          onChange={setState}
                        />
                      )}
                      {item.module?.name === 'saveAbility' && (
                        <Select
                          ref={addToSelectRefs}
                          multiple={true}
                          name={`feature.${featureIndex}.${this.name}.${index}.saveAbility.set`}
                          placeholder='Save Ability'
                          value={item.saveAbility?.set}
                          options={builders.ability}
                          required={true}
                          onChange={setState}
                        />
                      )}
                      {item.module?.name === 'skill' && (
                        <Select
                          ref={addToSelectRefs}
                          multiple={true}
                          name={`feature.${featureIndex}.${this.name}.${index}.skill.set`}
                          placeholder='Skill'
                          value={item.skill?.set}
                          options={builders.skill}
                          required={true}
                          onChange={setState}
                        />
                      )}
                      {item.module?.name === 'damageSave' && (
                        <Select
                          ref={addToSelectRefs}
                          multiple={true}
                          name={`feature.${featureIndex}.${this.name}.${index}.damageSave.set`}
                          placeholder='Damage'
                          value={item.damageSave?.set}
                          options={builders.damage}
                          require={true}
                          onChange={setState}
                        />
                      )}
                      {item.module?.name === 'conditionSave' && (
                        <Select
                          ref={addToSelectRefs}
                          multiple={true}
                          name={`feature.${featureIndex}.${this.name}.${index}.conditionSave.set`}
                          placeholder='Condition'
                          value={item.conditionSave?.set}
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
                        required={true}
                        onChange={setState}
                      />
                    )}
                  {item.module?.name === 'condition' ? (
                    <Select
                      ref={addToSelectRefs}
                      multiple={true}
                      name={`feature.${featureIndex}.${this.name}.${index}.condition.set`}
                      placeholder='Condition Type'
                      value={item.condition?.set}
                      options={builders.condition}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'speed' ? (
                    <Select
                      ref={addToSelectRefs}
                      multiple={true}
                      name={`feature.${featureIndex}.${this.name}.${index}.speed.set`}
                      placeholder='Speed Type'
                      value={item.speed?.set}
                      options={builders.speed}
                      required={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'passive' ? (
                    <Select
                      ref={addToSelectRefs}
                      multiple={true}
                      name={`feature.${featureIndex}.${this.name}.${index}.speed.set`}
                      value={item.passive?.set}
                      placeholder='Passive Type'
                      options={builders.passive}
                      required={true}
                      onChange={setState}
                    />
                  ) : (
                    item.module?.name === 'damage' && (
                      <Select
                        ref={addToSelectRefs}
                        multiple={true}
                        name={`feature.${featureIndex}.${this.name}.${index}.damage.set`}
                        placeholder='Damage Type'
                        options={builders.damage}
                        value={item.damage?.set}
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
                      options={[].concat(builders.ability, [
                        {
                          name: 'spellAbility',
                          value: 'Spell Ability',
                        },
                      ])}
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
                  {((item.modType?.name === 'bonus' &&
                    item.module?.name !== 'hitPoints') ||
                    item.modType?.name === 'setValue') &&
                    item.module?.name === 'ability' && (
                      <Input
                        ref={addToInputRefs}
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
                      multiple={true}
                      name={`feature.${featureIndex}.${this.name}.${index}.skill.set`}
                      value={item.skill?.set}
                      placeholder='Skill'
                      options={builders.skill}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item.area?.name === 'saveAbility' && (
                    <Select
                      ref={addToSelectRefs}
                      multiple={true}
                      name={`feature.${featureIndex}.${this.name}.${index}.saveAbility.set`}
                      value={item.saveAbility?.set}
                      placeholder='Save Ability'
                      options={builders.ability}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {item?.area?.name === 'language' && (
                    <Select
                      ref={addToSelectRefs}
                      multiple={true}
                      name={`feature.${featureIndex}.${this.name}.${index}.language.set`}
                      placeholder='Language'
                      value={item.language?.set}
                      options={builders.language}
                      required={true}
                      onChange={setState}
                    />
                  )}
                  {(item.area?.name === 'itemProperty' ||
                    item.area?.name === 'itemType') && (
                    <>
                      <Select
                        name={`feature.${featureIndex}.${this.name}.${index}.itemCategory.set`}
                        multiple={true}
                        placeholder='Item Category'
                        value={item.itemCategory?.set}
                        options={builders.item.itemCategory}
                        onChange={setState}
                      />
                      {item.area?.name === 'itemProperty' && (
                        <Select
                          name={`feature.${featureIndex}.${this.name}.${index}.itemProperty`}
                          multiple={true}
                          placeholder='Item Property'
                          value={item.itemProperty?.set}
                          options={[].concat(
                            ...builders.item.itemCategory
                              .filter((category) =>
                                item.itemCategory?.set?.length > 0
                                  ? item.itemCategory?.set?.some(
                                      (itemCategory) =>
                                        itemCategory.name === category.name
                                    )
                                  : category
                              )
                              .map((category) => category.itemProperty)
                          )}
                          onChange={setState}
                        />
                      )}
                      {item.area?.name === 'itemType' && (
                        <Select
                          name={`feature.${featureIndex}.${this.name}.${index}.itemType.set`}
                          multiple={true}
                          placeholder='Item Type'
                          value={item.itemType?.set}
                          options={items.filter((itemType) =>
                            item.itemCategory?.set?.length > 0
                              ? item.itemCategory?.set?.some(
                                  (itemCategory) =>
                                    itemCategory.name ===
                                    itemType.itemCategory.name
                                )
                              : itemType
                          )}
                          onChange={setState}
                        />
                      )}
                    </>
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
                    ref={addToSelectRefs}
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.set`}
                    placeholder='Sense'
                    value={item?.set}
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
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    value={item.attribute}
                    options={builders.feature.spell.attribute}
                    placeholder='Spell Attributes'
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name={`feature.${featureIndex}.${this.name}.${index}.set`}
                    placeholder='Spell'
                    value={item?.set}
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
                    name={`feature.${featureIndex}.${this.name}.${index}.itemCategory.set`}
                    multiple={true}
                    placeholder='Item Category'
                    value={item.itemCategory?.set}
                    options={builders.item.itemCategory}
                    onChange={setState}
                  />

                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.itemProperty.set`}
                    multiple={true}
                    placeholder='Item Property'
                    value={item.itemProperty?.set}
                    options={[].concat(
                      ...builders.item.itemCategory
                        .filter((category) =>
                          item.itemCategory?.set?.length > 0
                            ? item.itemCategory?.set?.some(
                                (itemCategory) =>
                                  itemCategory.name === category.name
                              )
                            : category
                        )
                        .map((category) => category.itemProperty)
                    )}
                    onChange={setState}
                  />
                  <Select
                    name={`feature.${featureIndex}.${this.name}.${index}.itemType.set`}
                    multiple={true}
                    placeholder='Item Type'
                    value={item.itemType?.set}
                    options={items.filter((itemType) =>
                      item.itemCategory?.set?.length > 0
                        ? item.itemCategory?.set?.some(
                            (itemCategory) =>
                              itemCategory.name === itemType.itemCategory.name
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
            ref={addToInputRefs}
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
            (attributeItem) => attributeItem.name === 'limitUse'
          ) && (
            <>
              <Select
                ref={addToSelectRefs}
                name={`feature.${featureIndex}.limitUse.limitBy`}
                placeholder='Limit By Option'
                value={featureItem.limitUse?.limitBy}
                options={builders.feature.chargeLimit}
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
                featureItem.limitUse?.limitBy?.name === 'setNumber' && (
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
                  ref={addToSelectRefs}
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
          )}
          {featureItem.attribute?.some(
            (attributeItem) => attributeItem.name === 'requireSave'
          ) && (
            <>
              <Select
                ref={addToSelectRefs}
                name={`feature.${featureIndex}.saveAbility.attribute`}
                multiple={true}
                placeholder='Save Attribute'
                value={featureItem.saveAbility?.attribute}
                options={builders.feature.saveAttribute}
                required={true}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name={`feature.${featureIndex}.saveAbility.ability`}
                placeholder='DC Ability'
                value={featureItem.saveAbility?.ability}
                options={builders.ability}
                required={true}
                onChange={setState}
              />
              <Input
                ref={addToInputRefs}
                validate='num'
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
                  ref={addToSelectRefs}
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
                ref={addToSelectRefs}
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
              {featureItem.requirement?.option?.some(
                (optionItem) => optionItem.name === 'skillProficiency'
              ) && (
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
              )}
              {featureItem.requirement?.option?.some(
                (optionItem) => optionItem.name === 'abilityScore'
              ) && (
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
              )}
            </div>
          </>
        )}
        {featureItem.requirement?.option?.some(
          (optionItem) => optionItem.name === 'itemProficiency'
        ) && (
          <>
            <div className='d-flex mx-5'>
              <hr className='flex-grow-1 me-3' />
              <span className='mx-auto'>Item Proficiency</span>
              <hr className='flex-grow-1 ms-3' />
            </div>
            <div className='row g-2 pb-3 mx-5 justify-contents-center'>
              <Select
                ref={addToSelectRefs}
                multiple={true}
                name={`feature.${featureIndex}.requirement.itemProficiency.itemCategory`}
                value={featureItem.requirement?.itemProficiency?.itemCategory}
                placeholder='Item Category'
                options={builders.item.itemCategory}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name={`feature.${featureIndex}.requirement.itemProficiency.itemProperty`}
                multiple={true}
                placeholder='Item Property'
                value={featureItem.requirement?.itemProficiency?.itemProperty}
                options={[].concat(
                  ...items
                    .filter((item) =>
                      featureItem.requirement?.itemProficiency?.itemCategory
                        ?.length > 0
                        ? featureItem.requirement?.itemProficiency?.itemCategory?.some(
                            (category) =>
                              category.name === item.itemCategory.name
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
                    .map((item) => item.itemProperty)
                )}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name={`feature.${featureIndex}.requirement.itemProficiency.itemType`}
                multiple={true}
                placeholder='Item type'
                value={featureItem.requirement?.itemProficiency?.itemType}
                options={items.filter((item) =>
                  featureItem.requirement.itemProficiency?.itemCategory
                    ?.length > 0
                    ? featureItem.requirement.itemProficiency?.itemCategory?.some(
                        (category) => category.name === item.itemCategory.name
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
            <div className='d-flex mx-5'>
              <hr className='flex-grow-1 me-3' />
              <span className='mx-auto'>Equipped</span>
              <hr className='flex-grow-1 ms-3' />
            </div>
            <div className='row g-2 pb-3 mx-5 justify-contents-center'>
              <Select
                ref={addToSelectRefs}
                multiple={true}
                name={`feature.${featureIndex}.requirement.equipped.itemCategory`}
                value={featureItem.requirement?.equipped?.itemCategory}
                placeholder='Item Category'
                options={builders.item.itemCategory}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                multiple={true}
                name={`feature.${featureIndex}.requirement.equipped.itemProperty`}
                placeholder='Item Property'
                value={featureItem.requirement?.equipped?.itemProperty}
                options={[].concat(
                  ...items
                    .filter((item) =>
                      featureItem.requirement?.equipped?.itemCategory?.length >
                      0
                        ? featureItem.requirement?.equipped?.itemCategory?.some(
                            (category) =>
                              category.name === item.itemCategory.name
                          )
                        : item
                    )
                    .map((item) => item.itemProperty)
                )}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                multiple={true}
                name={`feature.${featureIndex}.requirement.equipped.itemType`}
                placeholder='Item type'
                value={featureItem.requirement?.equipped?.itemType}
                options={items.filter((item) =>
                  featureItem.requirement.equipped?.itemCategory?.length > 0
                    ? featureItem.requirement.equipped?.itemCategory?.some(
                        (category) => category.name === item.itemCategory.name
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
            <div className='d-flex mx-5'>
              <hr className='flex-grow-1 me-3' />
              <span className='mx-auto'>Not Equipped</span>
              <hr className='flex-grow-1 ms-3' />
            </div>
            <div className='row g-2 pb-3 mx-5 justify-contents-center'>
              <Select
                ref={addToSelectRefs}
                multiple={true}
                name={`feature.${featureIndex}.requirement.notEquipped.itemCategory`}
                value={featureItem.requirement?.notEquipped?.itemCategory}
                placeholder='Item Category'
                options={builders.item.itemCategory}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                multiple={true}
                name={`feature.${featureIndex}.requirement.notEquipped.itemProperty`}
                value={featureItem.requirement?.notEquipped?.itemProperty}
                placeholder='Item Property'
                options={[].concat(
                  ...items
                    .filter((item) =>
                      featureItem.requirement.notEquipped?.itemCategory
                        ?.length > 0
                        ? featureItem.requirement.notEquipped?.itemCategory?.some(
                            (category) =>
                              category.name === item.itemCategory.name
                          )
                        : item
                    )
                    .map((item) => item.itemProperty)
                )}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                multiple={true}
                name={`feature.${featureIndex}.requirement.notEquipped.itemType`}
                placeholder='Item type'
                value={featureItem.requirement?.notEquipped?.itemType}
                options={items.filter((item) =>
                  featureItem.requirement.notEquipped?.itemCategory?.length > 0
                    ? featureItem.requirement.notEquipped?.itemCategory?.some(
                        (category) => category.name === item.itemCategory.name
                      )
                    : item
                )}
                onChange={setState}
              />
            </div>
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
            <div>
              <h6>Limit Use Table</h6>
              <Table
                className='pb-2'
                inputs={[
                  {
                    name: 'level',
                    value: 'Level',
                    invalid: 'Must contain only numbers',
                    validation: 'num',
                    label: true,
                    size: 'col-5',
                  },
                  {
                    name: 'uses',
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
          ))}
        {featureItem.attribute?.some(
          (attributeItem) => attributeItem.name === 'doesDamage'
        ) &&
          (!featureItem.damage?.damageByLevel ? (
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
                  ref={addToSelectRefs}
                  multiple={true}
                  name={`feature.${featureIndex}.damage.damageAttribute`}
                  value={featureItem.damage.damageAttribute}
                  placeholder='Damage Attribute'
                  options={builders.feature.damageAttribute}
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
              <AccordionButton
                className='accordion form-details justify-content-between align-items-center'
                id='damageTableButton'
                target='damageTable'
                expanded='true'
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
          ))}
        <TabNavigation
          id='section'
          tabState={
            Object.keys(featureItem)?.length !== 0 &&
            Object.keys(featureItem)?.some(
              (key) => featureItem[key]?.length !== 0
            ) &&
            [].concat(
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
            )
          }
          dynamic={true}
          onDelete={setState}
        />
      </Fragment>
    )

    const mainTabContent = [
      {
        name: 'details',
        content: (
          <>
            <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
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
                placeholder='Item Category'
                value={state.itemCategory}
                options={builders.item.itemCategory}
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
                optionalKey='short'
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
                  ref={addToSelectRefs}
                  name='attribute'
                  multiple={true}
                  placeholder='Attributes'
                  value={state.attribute}
                  options={builders.item.attribute.filter((attributeItem) =>
                    state.itemCategory?.name === 'armor' ||
                    state.itemCategory?.name === 'weapon'
                      ? attributeItem
                      : attributeItem.name !== 'maxBonus'
                  )}
                  required={true}
                  onChange={setState}
                />
              </div>
              {state.itemProperty?.some(
                (property) =>
                  property.name === 'thrown' || property.name === 'ranged'
              ) && (
                <>
                  <Input
                    ref={addToInputRefs}
                    validation={'num'}
                    name='minRange'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Min Range'
                    value={state?.minRange}
                    required={true}
                    onChange={setState}
                  />
                  <Input
                    ref={addToInputRefs}
                    validation={'num'}
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
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'containsItems'
              ) && (
                <>
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='containsFilter'
                    placeholder='Item Category Filter'
                    value={state.containsFilter}
                    options={builders.item.itemCategory}
                    required={true}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='contains'
                    placeholder='Contains...'
                    value={state.contains}
                    options={items.filter((item) =>
                      state.containsFilter?.length > 0
                        ? state.containsFilter?.some(
                            (category) =>
                              category.name === item.itemCategory.name
                          )
                        : item
                    )}
                    required={true}
                    onChange={setState}
                  />
                </>
              )}
            </div>
            {state.itemCategory?.name === 'weapon' && (
              <>
                <div className='d-flex'>
                  <hr className='flex-grow-1 me-3' />
                  <span className='mx-auto'>Weapon Damage Dice</span>
                  <hr className='flex-grow-1 ms-3' />
                </div>
                <div className='row g-2 pb-3 mx-5 justify-contents-center'>
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
                  {state.itemProperty?.some(
                    (property) => property.name === 'versatile'
                  ) && (
                    <>
                      <Input
                        ref={addToInputRefs}
                        validation={'num'}
                        name='damage.versatileDiceCount'
                        label={true}
                        invalidText='Must contain only numbers'
                        placeholder='Alt. Dmg. Dice Count'
                        value={state.damage?.versatileDiceCount}
                        required={true}
                        onChange={setState}
                      />
                      <Input
                        ref={addToInputRefs}
                        validation={'num'}
                        name='damage.versatileDiceValue'
                        label={true}
                        invalidText='Must contain only numbers'
                        placeholder='Alt. Dmg. Dice Value'
                        value={state.damage?.versatileDiceValue}
                        required={true}
                        onChange={setState}
                      />
                    </>
                  )}
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
                    options={[].concat(builders.ability, [
                      {
                        name: 'spellAbility',
                        value: 'Spell Ability',
                      },
                    ])}
                    required={true}
                    onChange={setState}
                  />
                  {state.attribute?.some(
                    (attributeItem) => attributeItem.name === 'maxBonus'
                  ) && (
                    <Input
                      ref={addToInputRefs}
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
                  {state?.itemProperty?.some(
                    (property) => property.name === 'finesse'
                  ) && (
                    <Select
                      ref={addToSelectRefs}
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
            )}
            {state.itemCategory?.name === 'armor' && (
              <>
                <div className='d-flex'>
                  <hr className='flex-grow-1 me-3' />
                  <span className='mx-auto'>Armor Stats</span>
                  <hr className='flex-grow-1 ms-3' />
                </div>
                <div className='row g-2 pb-3 mx-5 justify-contents-center'>
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
                      ref={addToInputRefs}
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
                </div>
              </>
            )}
            {state.attribute?.some(
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
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.option'
                    placeholder='Requirement'
                    value={state.requirement?.option}
                    options={builders.item.requirement}
                    required={true}
                    onChange={setState}
                  />
                  {state.requirement?.option?.some(
                    (optionItem) => optionItem.name === 'skillProficiency'
                  ) && (
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
                  )}
                  {state.requirement?.option?.some(
                    (optionItem) => optionItem.name === 'abilityScore'
                  ) && (
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
                        ref={addToSelectRefs}
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
              </>
            )}
            {state.requirement?.option?.some(
              (optionItem) => optionItem.name === 'itemProficiency'
            ) && (
              <>
                <div className='d-flex mx-5'>
                  <hr className='flex-grow-1 me-3' />
                  <span className='mx-auto'>Item Proficiency</span>
                  <hr className='flex-grow-1 ms-3' />
                </div>
                <div className='row g-2 pb-3 mx-5 justify-contents-center'>
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.itemProficiency.itemCategory'
                    value={state.requirement?.itemProficiency?.itemCategory}
                    placeholder='Item Category'
                    options={builders.item.itemCategory}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    name='requirement.itemProficiency.itemType'
                    multiple={true}
                    placeholder='Item type'
                    value={state.requirement?.itemProficiency?.itemType}
                    options={items.filter((item) =>
                      state.requirement.itemProficiency?.itemCategory?.length >
                      0
                        ? state.requirement.itemProficiency?.itemCategory?.some(
                            (category) =>
                              category.name === item.itemCategory.name
                          )
                        : item
                    )}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    name='requirement.itemProficiency.itemProperty'
                    multiple={true}
                    placeholder='Item Property'
                    value={state.requirement?.itemProficiency?.itemProperty}
                    options={[].concat(
                      ...items
                        .filter((item) =>
                          state.requirement.itemProficiency?.itemCategory
                            ?.length > 0
                            ? state.requirement.itemProficiency?.itemCategory?.some(
                                (category) =>
                                  category.name === item.itemCategory.name
                              )
                            : item
                        )
                        .filter((item) =>
                          state.requirement.itemProficiency?.itemType?.length >
                          0
                            ? state.requirement.itemProficiency?.itemType?.some(
                                (type) => type.name === item.name
                              )
                            : item
                        )
                        .map((item) => item.itemProperty)
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
                <div className='d-flex mx-5'>
                  <hr className='flex-grow-1 me-3' />
                  <span className='mx-auto'>Equipped</span>
                  <hr className='flex-grow-1 ms-3' />
                </div>
                <div className='row g-2 pb-3 mx-5 justify-contents-center'>
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.equipped.itemCategory'
                    value={state.requirement?.equipped?.itemCategory}
                    placeholder='Item Category'
                    options={builders.item.itemCategory}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.equipped.itemType'
                    placeholder='Item type'
                    value={state.requirement?.equipped?.itemType}
                    options={items.filter((item) =>
                      state.requirement.equipped?.itemCategory?.length > 0
                        ? state.requirement.equipped?.itemCategory?.some(
                            (category) =>
                              category.name === item.itemCategory.name
                          )
                        : item
                    )}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.equipped.itemProperty'
                    placeholder='Item Property'
                    value={state.requirement?.equipped?.itemProperty}
                    options={[].concat(
                      ...items
                        .filter((item) =>
                          state.requirement.equipped?.itemCategory?.length
                            ? state.requirement.equipped?.itemCategory?.some(
                                (category) =>
                                  category.name === item.itemCategory.name
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
                        .map((item) => item.itemProperty)
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
                <div className='d-flex mx-5'>
                  <hr className='flex-grow-1 me-3' />
                  <span className='mx-auto'>Equipped</span>
                  <hr className='flex-grow-1 ms-3' />
                </div>
                <div className='row g-2 pb-3 mx-5 justify-contents-center'>
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.notEquipped.itemCategory'
                    value={state.requirement?.notEquipped?.itemCategory}
                    placeholder='Item Category'
                    options={builders.item.itemCategory}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.notEquipped.itemType'
                    placeholder='Item type'
                    value={state.requirement?.notEquipped?.itemType}
                    options={items.filter((item) =>
                      state.requirement.notEquipped?.itemCategory?.length > 0
                        ? state.requirement.notEquipped?.itemCategory?.some(
                            (category) =>
                              category.name === item.itemCategory.name
                          )
                        : item
                    )}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    multiple={true}
                    name='requirement.notEquipped.itemProperty'
                    placeholder='Item Property'
                    value={state.requirement?.notEquipped?.itemProperty}
                    options={[].concat(
                      ...items
                        .filter((item) =>
                          state.requirement.notEquipped?.itemCategory?.length >
                          0
                            ? state.requirement.notEquipped?.itemCategory?.some(
                                (category) =>
                                  category.name === item.itemCategory.name
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
                        .map((item) => item.itemProperty)
                    )}
                    onChange={setState}
                  />
                </div>
              </>
            )}
          </>
        ),
      },
    ]

    content = (
      <div className='main-container'>
        <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
          <div className='col-auto'>
            <h3>Create an Item</h3>
          </div>
          <div className='col-auto d-flex justify-content-end'>
            <button
              className='btn btn-success me-2'
              type='button'
              onClick={() => {
                onSubmit()
              }}
            >
              Add
            </button>
            <button className='btn btn-secondary me-2' onClick={onReset}>
              Reset Form
            </button>
            <button className='btn btn-secondary' onClick={() => navigate(-1)}>
              Back
            </button>
          </div>
        </div>
        {successMessage && (
          <h5 className='success-message'>{successMessage}</h5>
        )}
        {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
        <form className='needs-validation' noValidate>
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
                value: featureItem.name ?? `feature ${featureIndex + 1}`,
                name: `feature.${featureIndex}`,
                content: featureTabContent(featureItem, featureIndex),
              }))
            }
            onDelete={setState}
            onAdd={setState}
            dynamic={true}
          />
        </form>
      </div>
    )
    return content
  }
}
export default NewItemForm
