import { useState, useEffect, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import {
  useAddNewSpellMutation,
  useUpdateSpellMutation,
} from './spellsApiSlice'
import { useLocation } from 'react-router-dom'
import { isEqual } from 'lodash'
import TextEditor from '../../components/TextEditor'
import formReducer from '../../hooks/useReducer'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'
import AccordionButton from '../../components/AccordionButton'

const EditSpellForm = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const { data: builders, isSuccess, isLoading } = useGetBuilderQuery(id)

  const [
    addNewSpell,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewSpellMutation()

  const [
    updateSpell,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateSpellMutation()

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
      setSuccessMessage('Spell added successfully!')
      navigate('..')
    }
    if (updateIsSuccess) {
      setSuccessMessage('Spell updated successfully!')
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
        const resetValidation = true
        handleValidation(resetValidation)
      }
    })
    return document.removeEventListener('keypress', () => {
      if (!!successMessage || !!errorMessage) {
        setSuccessMessage()
        setErrorMessage()
        const resetValidation = true
        handleValidation(resetValidation)
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
    console.log(isValid)
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
  }

  const onSubmit = async () => {
    const isValid = handleValidation()
    if (isValid) {
      await addNewSpell(state)
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
        await updateSpell(state)
        setOldState(state)
      }
    } else {
      setErrorMessage('Please fill out all required fields')
    }
  }

  const onBackClick = () => {
    if (location.state.previous.state.background.pathname === '/spells') {
      navigate(`/spells/${state.name}`, {
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

  let content

  if (isLoading) content = <p>Loading...</p>

  if (isSuccess) {
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
        state.attribute?.some(
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

    content = (
      <div className='builder-form'>
        <div className='d-flex justify-content-between'>
          <h1>Edit Spell</h1>
          <button
            className='btn btn-secondary btn-small'
            onClick={() => onBackClick()}
          >
            Back
          </button>
        </div>
        {successMessage && (
          <h5 className='success-message'>{successMessage}</h5>
        )}
        {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
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
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 align-items-start pb-2'>
              <Input
                ref={addToInputRefs}
                name='value'
                label={true}
                placeholder='Spell Name'
                autoComplete='off'
                value={state.value}
                required={true}
                clickable={false}
                onChange={setState}
              />
              <Input
                ref={addToInputRefs}
                validation={'num'}
                name='level'
                label={true}
                invalidText='Must contain only numbers'
                placeholder='Spell Level'
                required={true}
                value={state.level}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name='school'
                id='school'
                placeholder={'Spell School'}
                value={state.school}
                options={builders.spell.school}
                required={true}
                onChange={setState}
              />
              <Select
                name='requirement'
                ref={addToSelectRefs}
                multiple={true}
                placeholder={'Requirements'}
                value={state.requirement}
                options={builders.spell.requirement}
                required={true}
                onChange={setState}
              />
              {state.requirement?.some(
                (requirementItem) => requirementItem.name === 'material'
              ) && (
                <Input
                  ref={addToInputRefs}
                  name='materialDesc'
                  label={true}
                  placeholder='Material Description'
                  required={true}
                  value={state.materialDesc ?? ''}
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
          <div
            className='accordion-collapse collapse show pb-3'
            id='description'
          >
            <TextEditor
              ref={addToTextRefs}
              name='desc'
              value={state.desc}
              placeholder='Spell Description'
              onChange={setState}
            />
          </div>
          <AccordionButton
            className='accordion form-details justify-content-between align-items-center'
            id='attributesButton'
            target='attributes'
          >
            <span className='me-3'>Attributes</span>
            <hr className='flex-grow-1 me-3' />
          </AccordionButton>
          <div className='accordion-collapse collapse show' id='attributes'>
            <div className='row row-cols-lg-3 row-cols-md-2 row-cols-sm-1 g-2 justify-content-left pb-2'>
              <Select
                multiple={true}
                name='attribute'
                placeholder='Spell Attributes'
                value={state.attribute}
                options={builders.spell.attribute.filter((attributeItem) =>
                  !!state.attribute?.some(
                    (stateItem) => stateItem.name === 'doesDamage'
                  )
                    ? attributeItem
                    : attributeItem.name !== 'secondaryDamage'
                )}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name='action.actionType'
                placeholder='Casting Time'
                value={state.action?.actionType}
                options={builders.spell.action}
                required={true}
                onChange={setState}
              />
              <Input
                ref={addToInputRefs}
                validation={'num'}
                name='action.value'
                label={true}
                placeholder='Casting Increment'
                value={state.action?.value ?? ''}
                required={true}
                onChange={setState}
              />
              <Select
                ref={addToSelectRefs}
                name='duration.durationType'
                placeholder='Duration'
                value={state.duration?.durationType}
                options={builders.spell.duration}
                required={true}
                onChange={setState}
              />
              {state.duration &&
                state.duration?.durationType.name !== 'instantaneous' && (
                  <Input
                    ref={addToInputRefs}
                    validation={'num'}
                    name='duration.value'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Duration Increment'
                    autoComplete='off'
                    required={true}
                    value={state.duration?.value ?? ''}
                    onChange={setState}
                  />
                )}
              <Select
                ref={addToSelectRefs}
                name='range.rangeType'
                placeholder='Range'
                value={state.range?.rangeType}
                options={builders.spell.range}
                required={true}
                onChange={setState}
              />
              {state.range?.rangeType &&
                state.range?.rangeType?.name !== 'touch' && (
                  <>
                    {state.range.rangeType.name === 'distance' && (
                      <Input
                        ref={addToInputRefs}
                        validation={'num'}
                        name='range.distance'
                        label={true}
                        invalidText='Must contain only numbers'
                        placeholder='Distance (ft)'
                        autoComplete='off'
                        required={true}
                        value={state.range?.distance ?? ''}
                        onChange={setState}
                      />
                    )}
                    <Select
                      ref={addToSelectRefs}
                      name='shape.shapeType'
                      placeholder='Shape'
                      options={builders.spell.shape}
                      value={state.shape?.shapeType}
                      required={true}
                      onChange={setState}
                    />
                    {state.shape?.shapeType.name &&
                      state.shape?.shapeType.name !== 'none' &&
                      state.shape?.shapeType.name !== 'weapon' && (
                        <Input
                          ref={addToInputRefs}
                          validation={'num'}
                          name='shape.size'
                          label={true}
                          invalidText='Must contain only numbers'
                          placeholder='Shape Size (ft)'
                          autoComplete='off'
                          required={true}
                          value={state.shape?.size ?? ''}
                          onChange={setState}
                        />
                      )}
                  </>
                )}
            </div>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'requireSave'
              ) && (
                <Select
                  ref={addToSelectRefs}
                  name='saveAbility'
                  placeholder='DC Ability'
                  value={state.saveAbility}
                  options={builders.ability}
                  required={true}
                  onChange={setState}
                />
              )}
            </div>
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'doesDamage'
            ) &&
              (!state?.damage?.damageByLevel ? (
                setState({
                  type: 'added',
                  payload: {
                    target: {
                      name: 'damage.damageByLevel',
                      value: { level: state?.level },
                    },
                  },
                })
              ) : (
                <div className='row gx-2 align-items-end pb-2'>
                  <Select
                    multiple={true}
                    name='damage.damageAttribute'
                    placeholder='Damage Attribute'
                    value={state.damage?.damageAttribute}
                    options={builders.spell.damageAttribute}
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
                  <div className='col-lg-6 col-md-12'></div>
                </div>
              ))}
          </div>
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
                  inputs={damageTableInputs()}
                  name='damage.damageByLevel'
                  value={state.damage?.damageByLevel}
                  onChange={setState}
                  dynamic={true}
                />
              </div>
            </>
          )}
          <div className='pb-2'>
            <button
              className='btn btn-success me-2'
              type='button'
              onClick={() => {
                onUpdate()
              }}
            >
              Update Spell
            </button>
            <button
              className='btn btn-primary'
              type='button'
              onClick={() => {
                onSubmit()
              }}
            >
              Add As New
            </button>
          </div>
        </form>
      </div>
    )
  }

  return content
}

export default EditSpellForm
