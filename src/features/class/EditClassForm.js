import { useState, useEffect, useReducer, useRef, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  useGetClassQuery,
  useAddNewClassMutation,
  useUpdateClassMutation,
} from './classApiSlice'
import { useGetBuilderQuery } from '../builders/builderApiSlice'
import { useGetSpellQuery } from '../spells/spellApiSlice'
import { useGetFeatQuery } from '../feats/featApiSlice'
import { useGetItemQuery } from '../items/itemApiSlice'
import { startCase, isEqual } from 'lodash'
import formReducer from '../../hooks/useReducer'
import AccordionButton from '../../components/AccordionButton'
import TabNavigation from '../../components/TabNavigation'
import TextEditor from '../../components/TextEditor'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'

const EditClassForm = () => {
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
    data: classes,
    isSuccess: classIsSuccess,
    isLoading: classIsLoading,
  } = useGetClassQuery(id)

  const {
    data: items,
    isSuccess: itemIsSuccess,
    isLoading: itemIsLoading,
  } = useGetItemQuery(id)

  const [
    addNewClass,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewClassMutation()

  const [
    updateClass,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateClassMutation()

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
      setSuccessMessage('Class added successfully!')
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
    }
    if (updateIsSuccess) {
      setSuccessMessage('Class updated successfully!')
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
    }
  }, [addIsSuccess, id, navigate, updateIsSuccess])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.data.message)
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
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
            selectRef.getElement().focus()
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
      payload: { target: oldState },
    })
    setSuccessMessage()
    setErrorMessage()
    handleValidation(true)
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
          data: match ? state : oldState,
          background: location.state.previous.state.background,
          title: match ? state.value : oldState.value,
          context: 'itemCard',
          size: 'xl',
        },
      })
    } else {
      navigate(-1)
    }
  }
  let content

  if (
    builderIsLoading ||
    spellIsLoading ||
    featIsLoading ||
    classIsLoading ||
    itemIsLoading
  ) {
    content = <p>Loading...</p>
  }

  if (
    builderIsSuccess &&
    spellIsSuccess &&
    featIsSuccess &&
    classIsSuccess &&
    itemIsSuccess
  ) {
    const spellCaster = state.attribute?.some(
      (attributeItem) => attributeItem.name === 'spellCaster'
    )

    const addArray = (name) => {
      setState({ type: 'added', payload: { target: { name: name } } })
    }

    !state?.levelAttribute && addArray('levelAttribute')
    spellCaster &&
      state?.levelAttribute.map(
        (levelAttributeItem, levelAttributeIndex) =>
          !levelAttributeItem?.spellSlots &&
          addArray(`levelAttribute.${levelAttributeIndex}.spellSlots`)
      )

    const damageTableInputs = (secondary) => {
      const inputArray = [
        {
          name: 'level',
          value: 'Level',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'col-3',
        },
        {
          name: 'diceCount',
          value: 'Dice Count',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'col-3',
        },
        {
          name: 'diceValue',
          value: 'Dice Value',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'col-3',
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

    const levelAttributeHeaders = () => {
      const headerArray = [
        {
          name: 'level',
          value: 'Level',
          border: false,
          className: 'fw-bold',
          readOnly: true,
          size: spellCaster ? 'col-1' : 'col',
        },
        {
          name: 'proficiencyBonus',
          value: 'Prof. Bonus',
          border: false,
          className: 'fw-bold',
          readOnly: true,
          size: spellCaster ? 'col-1 text-wrap' : 'col',
          wordwrap: true,
        },
      ]
      if (spellCaster) {
        if (
          state.spellcasting?.attribute?.some(
            (attributeItem) => attributeItem.name === 'limitKnownSpells'
          )
        ) {
          headerArray.push({
            name: 'spellsKnown',
            value: 'Spells Known',
            border: false,
            className: 'fw-bold',
            readOnly: true,
            size: 'col-1 text-wrap',
            wordwrap: true,
          })
        }
        if (state?.spellcasting?.maxSpellLevel) {
          for (let i = 0; i <= state.spellcasting?.maxSpellLevel; i++) {
            headerArray.push({
              name: i,
              value: i,
              border: false,
              className: 'fw-bold',
              readOnly: true,
              size: 'col-1',
            })
          }
        }
      }

      return headerArray
    }

    const levelAttributeInputs = () => {
      const inputArray = [
        {
          name: 'level',
          value: 'Level',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: spellCaster ? 'col-1' : 'col',
          required: true,
        },
        {
          name: 'proficiencyBonus',
          value: 'Prof. Bonus',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: spellCaster ? 'col-1' : 'col',
        },
      ]
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
            size: 'col-1',
          })
        }
        if (state.spellcasting?.maxSpellLevel) {
          for (let i = 0; i <= state.spellcasting?.maxSpellLevel; i++) {
            inputArray.push({
              name: `spellSlots.${i}.slotCount`,
              value: 'Num. Slots',
              invalid: 'Must contain only numbers',
              validation: 'num',
              size: 'col-1',
            })
          }
        }
      }
      return inputArray
    }

    const sectionTabContent = (feature, featureIndex) => {
      const multipleOptions = feature.attribute?.some(
        (attributeItem) => attributeItem.name === 'providesOptions'
      )
      const tableContent = [
        {
          name: 'feat',
          content() {
            return feature[this.name].map((item, index) => (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
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
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions ? '.options' : '.set'
                    }`}
                    multiple={true}
                    placeholder='Feat'
                    value={multipleOptions ? item?.options : item.set}
                    options={feats}
                    required={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      ref={addToInputRefs}
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
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
          name: 'modifier',
          content() {
            return feature[this.name].map((item, index) => (
              <Fragment key={index}>
                <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 pb-2'>
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
                          }.${index}.ability${
                            multipleOptions ? '.options' : '.set'
                          }`}
                          multiple={true}
                          placeholder='Ability'
                          value={
                            multipleOptions
                              ? item.ability?.options
                              : item.ability?.set
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
                            multipleOptions ? '.options' : '.set'
                          }`}
                          multiple={true}
                          placeholder='Save Ability'
                          value={
                            multipleOptions
                              ? item.saveAbility?.options
                              : item.saveAbility?.set
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
                          }.${index}.skill${
                            multipleOptions ? '.options' : '.set'
                          }`}
                          multiple={true}
                          placeholder='Skill'
                          value={
                            multipleOptions
                              ? item.skill?.options
                              : item.skill?.set
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
                            multipleOptions ? '.options' : '.set'
                          }`}
                          multiple={true}
                          placeholder='Damage'
                          value={
                            multipleOptions
                              ? item.damageSave?.options
                              : item.damageSave?.set
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
                            multipleOptions ? '.options' : '.set'
                          }`}
                          multiple={true}
                          placeholder='Condition'
                          value={
                            multipleOptions
                              ? item.conditionSave?.options
                              : item.conditionSave?.set
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
                      }.${index}.condition${
                        multipleOptions ? '.options' : '.set'
                      }`}
                      multiple={true}
                      placeholder='Condition Type'
                      value={
                        multipleOptions
                          ? item.condition?.options
                          : item.condition?.set
                      }
                      options={builders.condition}
                      require={true}
                      onChange={setState}
                    />
                  ) : item.module?.name === 'speed' ? (
                    <Select
                      ref={addToSelectRefs}
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.speed${multipleOptions ? '.options' : '.set'}`}
                      multiple={true}
                      value={
                        multipleOptions ? item.speed?.options : item.speed?.set
                      }
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
                      }.${index}.passive${
                        multipleOptions ? '.options' : '.set'
                      }`}
                      multiple={true}
                      placeholder='Passive Type'
                      value={
                        multipleOptions
                          ? item.passive?.options
                          : item.passive?.set
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
                        }.${index}.damage${
                          multipleOptions ? '.options' : '.set'
                        }`}
                        multiple={true}
                        placeholder='Damage Type'
                        value={
                          multipleOptions
                            ? item.damage?.options
                            : item.damage?.set
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
                  {multipleOptions && (
                    <Input
                      ref={addToInputRefs}
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
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
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.skill${multipleOptions ? '.options' : '.set'}`}
                      multiple={true}
                      placeholder='Skill'
                      value={
                        multipleOptions ? item.skill?.options : item.skill?.set
                      }
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
                      }.${index}.saveAbility${
                        multipleOptions ? '.options' : '.set'
                      }`}
                      multiple={true}
                      placeholder='Save Ability'
                      value={
                        multipleOptions
                          ? item.saveAbility?.options
                          : item.saveAbility?.set
                      }
                      options={builders.ability}
                      require={true}
                      onChange={setState}
                    />
                  )}
                  {item?.area?.name === 'language' && (
                    <Select
                      ref={addToSelectRefs}
                      name={`feature.${featureIndex}.${
                        this.name
                      }.${index}.language${
                        multipleOptions ? '.options' : '.set'
                      }`}
                      multiple={true}
                      placeholder='Language'
                      value={
                        multipleOptions
                          ? item.language?.options
                          : item.language?.set
                      }
                      options={builders.language}
                      onChange={setState}
                    />
                  )}
                  {(item.area?.name === 'itemProperty' ||
                    item.area?.name === 'itemType') && (
                    <>
                      <Select
                        name={`feature.${featureIndex}.${
                          this.name
                        }.${index}.itemCategory${
                          multipleOptions ? '.options' : '.set'
                        }`}
                        multiple={true}
                        placeholder='Item Category'
                        value={
                          multipleOptions
                            ? item.itemCategory?.options
                            : item.itemCategory?.set
                        }
                        options={builders.item.itemCategory}
                        onChange={setState}
                      />
                      {item.area?.name === 'itemProperty' && (
                        <Select
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.itemProperty${
                            multipleOptions ? '.options' : '.set'
                          }`}
                          multiple={true}
                          placeholder='Item Property'
                          value={
                            multipleOptions
                              ? item.itemProperty?.options
                              : item.itemProperty?.set
                          }
                          options={[].concat(
                            ...builders.item.itemCategory
                              .filter((category) =>
                                multipleOptions
                                  ? item.itemCategory?.options?.length > 0
                                    ? item.itemCategory?.options?.some(
                                        (itemCategory) =>
                                          itemCategory.name === category.name
                                      )
                                    : category
                                  : item.itemCategory?.set?.length > 0
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
                          name={`feature.${featureIndex}.${
                            this.name
                          }.${index}.itemType${
                            multipleOptions ? '.options' : '.set'
                          }`}
                          multiple={true}
                          placeholder='Item Type'
                          value={
                            multipleOptions
                              ? item.itemType?.options
                              : item.itemType?.set
                          }
                          options={items.filter((itemType) =>
                            multipleOptions
                              ? item.itemCategory?.options?.length > 0
                                ? item.itemCategory?.options?.some(
                                    (itemCategory) =>
                                      itemCategory.name ===
                                      itemType.itemCategory.name
                                  )
                                : itemType
                              : item.itemCategory?.set?.length > 0
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
                    require={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      ref={addToInputRefs}
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
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
          name: 'sense',
          content() {
            return feature[this.name].map((item, index) => (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
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
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions ? '.options' : '.set'
                    }`}
                    multiple={true}
                    placeholder='Sense'
                    value={multipleOptions ? item?.options : item?.set}
                    options={builders.sense}
                    require={true}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      ref={addToInputRefs}
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
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
          name: 'spell',
          content() {
            return feature[this.name].map((item, index) => (
              <Fragment key={index}>
                <div className='row g-2 row-cols-lg-4 row-cols-md-3 row-cols-2 pb-2'>
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
                  <Select
                    ref={addToSelectRefs}
                    multiple='true'
                    name={`feature.${featureIndex}.${this.name}.${index}.attribute`}
                    options={builders.feature.spell.attribute}
                    placeholder='Spell Attributes'
                    value={item.attribute}
                    require={true}
                    onChange={setState}
                  />
                  <Select
                    ref={addToSelectRefs}
                    name={`feature.${featureIndex}.${this.name}.${index}${
                      multipleOptions ? '.options' : '.set'
                    }`}
                    multiple={true}
                    placeholder='Spell'
                    value={multipleOptions ? item?.options : item?.set}
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
                      }.${index}.ability${
                        multipleOptions ? '.options' : '.set'
                      }`}
                      multiple={true}
                      placeholder='Ability'
                      value={
                        multipleOptions
                          ? item.ability?.options
                          : item.ability?.set
                      }
                      options={builders.ability}
                      require={true}
                      onChange={setState}
                    />
                  )}
                  {multipleOptions && (
                    <Input
                      ref={addToInputRefs}
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
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
                  <Select
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.itemCategory${
                      multipleOptions ? '.options' : '.set'
                    }`}
                    multiple={true}
                    placeholder='Item Category'
                    value={
                      multipleOptions
                        ? item.itemCategory?.options
                        : item.itemCategory?.set
                    }
                    options={builders.item.itemCategory}
                    onChange={setState}
                  />

                  <Select
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.itemProperty${
                      multipleOptions ? '.options' : '.set'
                    }`}
                    multiple={true}
                    placeholder='Item Property'
                    value={
                      multipleOptions
                        ? item.itemProperty?.options
                        : item.itemProperty?.set
                    }
                    options={[].concat(
                      ...builders.item.itemCategory
                        .filter((category) =>
                          multipleOptions
                            ? item.itemCategory?.options?.length > 0
                              ? item.itemCategory?.options?.some(
                                  (itemCategory) =>
                                    itemCategory.name === category.name
                                )
                              : category
                            : item.itemCategory?.set?.length > 0
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
                    name={`feature.${featureIndex}.${
                      this.name
                    }.${index}.itemType${
                      multipleOptions ? '.options' : '.set'
                    }`}
                    multiple={true}
                    placeholder='Item Type'
                    value={
                      multipleOptions
                        ? item.itemType?.options
                        : item.itemType?.set
                    }
                    options={items.filter((itemType) =>
                      multipleOptions
                        ? item.itemCategory?.options?.length > 0
                          ? item.itemCategory?.options?.some(
                              (itemCategory) =>
                                itemCategory.name === itemType.itemCategory.name
                            )
                          : itemType
                        : item.itemCategory?.set?.length > 0
                        ? item.itemCategory?.set?.some(
                            (itemCategory) =>
                              itemCategory.name === itemType.itemCategory.name
                          )
                        : itemType
                    )}
                    onChange={setState}
                  />
                  {multipleOptions && (
                    <Input
                      ref={addToInputRefs}
                      validation='num'
                      name={`feature.${featureIndex}.${this.name}.${index}.selectCount`}
                      label={true}
                      placeholder='# of Selections'
                      autoComplete='off'
                      value={item.selectCount}
                      invalidText='Must contain only numbers'
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

      return tableContent
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
          <Input
            ref={addToInputRefs}
            size='col-md-2'
            name={`feature.${featureIndex}.levelAvailable`}
            autoComplete='off'
            placeholder='Level Avail.'
            label={true}
            required={true}
            value={featureItem?.levelAvailable}
            onChange={setState}
          />
          <Select
            multiple={true}
            name={`feature.${featureIndex}.attribute`}
            options={builders.feature.attribute.filter((attributeItem) =>
              !featureItem.attribute?.some((item) => item.name === 'doesDamage')
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
                ref={addToSelectRefs}
                name={`feature.${featureIndex}.action`}
                placeholder='Action Type'
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
            <Select
              ref={addToSelectRefs}
              multiple={true}
              name={`feature.${featureIndex}.requirement.option`}
              placeholder='Requirement'
              options={builders.feature.requirement}
              value={featureItem.requirement?.option}
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
                placeholder='Skill Proficiency'
                value={featureItem.requirement?.skillProficiency}
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
                  placeholder='Score'
                  required={true}
                  label={true}
                  validation='num'
                  invalidText='Must contain only numbers'
                  onChange={setState}
                />
              </>
            )}
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
                  placeholder='Damage Attribute'
                  value={featureItem.damage?.damageAttribute}
                  options={builders.feature.damageAttribute}
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
            <div className='row g-2 pb-2 pb-2 row-cols-lg-4 row-cols-md-3 row-cols-2'>
              <Input
                ref={addToInputRefs}
                name='value'
                label={true}
                autoComplete='off'
                placeholder='Class Name'
                required={true}
                value={state.value}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name='category'
                placeholder='Class Category'
                value={state?.category}
                options={builders.class.category}
                required={true}
                onChange={setState}
              />
              {state.category?.name === 'subclass' && (
                <Select
                  ref={addToSelectRefs}
                  name='parentClass'
                  placeholder='Parent Class'
                  value={state?.parentClass}
                  options={classes}
                  required={true}
                  onChange={setState}
                />
              )}
              {state.category?.name !== 'subclass' && (
                <>
                  <Input
                    ref={addToInputRefs}
                    name='hitPoint.diceCount'
                    label={true}
                    autoComplete='off'
                    placeholder='HP Dice Count'
                    required={true}
                    value={state.hitPoint?.diceCount}
                    validation='num'
                    invalidText='Must contain whole numbers only'
                    onChange={setState}
                  />
                  <Input
                    ref={addToInputRefs}
                    name='hitPoint.diceValue'
                    label={true}
                    autoComplete='off'
                    placeholder='HP Dice Value'
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
              placeholder={'Description'}
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
                        expanded='true'
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
                  ref={addToSelectRefs}
                  name='attribute'
                  placeholder='Attributes'
                  multiple={true}
                  value={state.attribute}
                  options={builders.class.attribute
                    .filter((attributeItem) =>
                      state?.attribute?.some(
                        (item) => item.name === 'primaryAbility'
                      )
                        ? attributeItem
                        : attributeItem.name !== 'optionalAbility'
                    )
                    .filter(
                      (attributeItem) =>
                        attributeItem.name !== 'ritualCaster' &&
                        attributeItem.name !== 'limitKnownSpells'
                    )}
                  onChange={setState}
                />
                {state.attribute?.some(
                  (attributeItem) => attributeItem.name === 'spellCaster'
                ) && (
                  <>
                    <Select
                      ref={addToSelectRefs}
                      name='spellcasting.attribute'
                      placeholder='Spell Casting Attributes'
                      multiple={true}
                      value={state.spellcasting?.attribute}
                      options={builders.class.attribute.filter(
                        (attributeItem) =>
                          attributeItem.name === 'ritualCaster' ||
                          attributeItem.name === 'limitKnownSpells'
                      )}
                      onChange={setState}
                    />
                    <Select
                      ref={addToSelectRefs}
                      name='spellcasting.Ability'
                      placeholder='Spellcasting Ability'
                      required={true}
                      value={state.spellcasting?.Ability}
                      options={builders.ability}
                      onChange={setState}
                    />
                    <Input
                      ref={addToInputRefs}
                      name='spellcasting.maxSpellLevel'
                      label={true}
                      autoComplete='off'
                      placeholder='Max Spell Level'
                      required={true}
                      value={state.spellcasting?.maxSpellLevel}
                      validation='num'
                      invalidText='Must contain whole numbers only'
                      onChange={setState}
                    />
                  </>
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
                    ref={addToSelectRefs}
                    name='multiclass.primaryAbility'
                    placeholder='Primary Ability'
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
                    ref={addToInputRefs}
                    name='multiclass.primaryAbility.minValue'
                    label={true}
                    autoComplete='off'
                    placeholder='Primary Score'
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
                    ref={addToSelectRefs}
                    name='multiclass.secondaryAbility'
                    placeholder='Secondary Ability'
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
                    ref={addToInputRefs}
                    name='multiclass.secondaryAbility.minValue'
                    label={true}
                    autoComplete='off'
                    placeholder='Secondary Score'
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
                    ref={addToSelectRefs}
                    name='multiclass.optionalAbility'
                    placeholder='Optional Ability'
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
                    ref={addToInputRefs}
                    name='multiclass.optionalAbility.minValue'
                    label={true}
                    autoComplete='off'
                    placeholder='Optional Score'
                    required={true}
                    value={state.multiclass?.optionalAbility?.minValue}
                    validation='num'
                    invalidText='Must contain whole numbers only'
                    onChange={setState}
                  />
                </>
              )}
            </div>
            <div className='row g-2 px-4'>
              <AccordionButton
                className='accordion form-details justify-content-between align-items-center'
                id='attributeTableButton'
                target='attributeTable'
              >
                <h6 className='me-3'>Attribute Table</h6>
                <hr className='flex-grow-1 me-3' />
              </AccordionButton>
              <div
                className='accordion-collapse collapse show'
                id='attributeTable'
              >
                <Table
                  name='levelAttribute'
                  headers={levelAttributeHeaders()}
                  inputs={levelAttributeInputs()}
                  value={state?.levelAttribute}
                  indentedName='spellSlots'
                  onChange={setState}
                  scrollable={true}
                  dynamic={true}
                />
              </div>
            </div>
          </>
        ),
      },
      {
        name: 'subclassDetails',
        content: (
          <>
            <div className='row g-2 row-cols-sm-4 pb-2'>
              <Input
                ref={addToInputRefs}
                name='subclass.value'
                label={true}
                autoComplete='off'
                placeholder='Subclass Feature Name'
                required={true}
                value={state.subclass?.value}
                onChange={setState}
              />
              <Input
                ref={addToInputRefs}
                name='subclass.levelAcquired'
                label={true}
                autoComplete='off'
                placeholder='Level Acquired'
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
              value={state?.desc}
              placeholder={'Description'}
              onChange={setState}
            />
          </>
        ),
      },
    ]

    content = (
      <div className='main-container'>
        <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
          <div className='col-auto'>
            <h3>Edit a Class</h3>
          </div>
          <div className='col-auto d-flex justify-content-end'>
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
        <form className='needs-validation' noValidate>
          <TabNavigation
            id='main'
            dynamic={false}
            tabState={mainTabContent
              .filter((content) =>
                state.category?.name === 'base'
                  ? content
                  : content.name !== 'subclassDetails'
              )
              .map((content) => ({
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
export default EditClassForm
