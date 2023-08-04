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

const NUM_REGEX = /^[0-9\b]+$/

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
  const [isValid, setIsValid] = useState(true)
  const selectRefs = useRef([])

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
      if (!!successMessage) {
        setSuccessMessage()
      }
      if (!!errorMessage) {
        setErrorMessage()
      }
      const resetValidation = true
      handleValidation(resetValidation)
    })
    return document.removeEventListener('keypress', () => {
      if (!!successMessage) {
        setSuccessMessage()
      }
      if (!!errorMessage) {
        setErrorMessage()
      }
      const resetValidation = true
      handleValidation(resetValidation)
    })
  })

  const addToSelectRefs = (ref) => {
    if (ref && !selectRefs.current.includes(ref)) {
      selectRefs.current.push(ref)
    }
  }

  const handleValidation = (resetValidation) => {
    selectRefs.current.forEach((selectRef) => {
      if (selectRef) {
        const selectValue = selectRef.getValue()
        const isEmpty =
          selectValue === null ||
          (Array.isArray(selectValue) && selectValue.length === 0)

        if (isEmpty) {
          selectRef.setClass('is-invalid')
          setIsValid(false)
        } else {
          selectRef.setClass('is-valid')
        }
      }
      if (resetValidation === true) {
        selectRef.setClass('')
        setIsValid(true)
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
        setIsValid(false)
      } else {
        element.classList.add('is-valid')
        element.classList.remove('is-invalid')
      }
      if (resetValidation === true) {
        element.classList.remove('is-valid')
        element.classList.remove('is-invalid')
        setIsValid(true)
      }
    })
  }

  useEffect(() => {
    if (isEqual(oldState, state)) {
      setMatch(true)
    } else {
      setMatch(false)
    }
  }, [state, oldState])

  const onSubmit = async () => {
    handleValidation()
    if (isValid) {
      await addNewSpell(state)
    } else {
      setErrorMessage('Please fill out all required fields')
    }
  }

  const onUpdate = async () => {
    handleValidation()
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
      console.log('button clicked', match)
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

  console.log(isValid)

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
                name='value'
                label={true}
                placeholder='Spell Name'
                autoComplete='off'
                value={state.value ?? ''}
                required={true}
                clickable={false}
                onChange={(input) => setState({ payload: { target: input } })}
                onClick={(e) => e.stopPropagation()}
              />
              <Input
                className={`${
                  state.level &&
                  (NUM_REGEX.test(state.level) ? 'is-valid' : 'is-invalid')
                }`}
                name='level'
                label={true}
                invalidText='Must contain only numbers'
                placeholder='Spell Level'
                required={true}
                value={state.level ?? ''}
                onChange={(input) => setState({ payload: { target: input } })}
              />
              <Select
                ref={addToSelectRefs}
                name='school'
                id='school'
                placeholder={'Spell School'}
                value={state.school}
                options={builders.spell.school}
                required={true}
                onChange={(option) => setState({ payload: { target: option } })}
              />
              <Select
                name='requirement'
                ref={addToSelectRefs}
                multiple={true}
                placeholder={'Requirements'}
                value={state.requirement}
                options={builders.spell.requirement}
                required={true}
                onChange={(option) => setState({ payload: { target: option } })}
              />
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
                onChange={(option) => setState({ payload: { target: option } })}
              />
              <Select
                ref={addToSelectRefs}
                name='action.actionType'
                placeholder='Casting Time'
                value={state.action?.actionType}
                options={builders.spell.action}
                required={true}
                onChange={(option) => setState({ payload: { target: option } })}
              />
              <Input
                className={`${
                  state?.action?.value &&
                  (NUM_REGEX.test(state.action?.value)
                    ? 'is-valid'
                    : 'is-invalid')
                }`}
                name='action.value'
                label={true}
                placeholder='Casting Increment'
                value={state.action?.value ?? ''}
                required={true}
                onChange={(input) => setState({ payload: { target: input } })}
              />
              <Select
                ref={addToSelectRefs}
                name='duration.durationType'
                placeholder='Duration'
                value={state.duration?.durationType}
                options={builders.spell.duration}
                required={true}
                onChange={(option) => setState({ payload: { target: option } })}
              />
              {state.duration &&
                state.duration?.durationType.name !== 'instantaneous' && (
                  <Input
                    className={`${
                      state?.duration?.value &&
                      (NUM_REGEX.test(state.duration.value)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    name='duration.value'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Duration Increment'
                    autoComplete='off'
                    required={true}
                    value={state.duration?.value ?? ''}
                    onChange={(input) =>
                      setState({ payload: { target: input } })
                    }
                  />
                )}
              <Select
                ref={addToSelectRefs}
                name='range.rangeType'
                placeholder='Range'
                value={state.range?.rangeType}
                options={builders.spell.range}
                required={true}
                onChange={(option) => setState({ payload: { target: option } })}
              />
              {state.range?.rangeType &&
                state.range?.rangeType?.name !== 'touch' && (
                  <>
                    {state.range.rangeType.name === 'distance' && (
                      <Input
                        className={`${
                          state.range?.distance &&
                          (NUM_REGEX.test(state.range?.distance)
                            ? 'is-valid'
                            : 'is-invalid')
                        }`}
                        name='range.distance'
                        label={true}
                        invalidText='Must contain only numbers'
                        placeholder='Distance (ft)'
                        autoComplete='off'
                        required={true}
                        value={state.range?.distance ?? ''}
                        onChange={(input) =>
                          setState({ payload: { target: input } })
                        }
                      />
                    )}
                    <Select
                      ref={addToSelectRefs}
                      name='shape.shapeType'
                      placeholder='Shape'
                      options={builders.spell.shape}
                      value={state.shape?.shapeType}
                      required={true}
                      onChange={(option) =>
                        setState({ payload: { target: option } })
                      }
                    />
                    {state.shape?.shapeType.name &&
                      state.shape?.shapeType.name !== 'none' && (
                        <Input
                          className={`${
                            state?.shape?.size &&
                            (NUM_REGEX.test(state.shape.size)
                              ? 'is-valid'
                              : 'is-invalid')
                          }`}
                          name='shape.size'
                          label={true}
                          invalidText='Must contain only numbers'
                          placeholder='Shape Size (ft)'
                          autoComplete='off'
                          required={true}
                          value={state.shape?.size ?? ''}
                          onChange={(input) =>
                            setState({ payload: { target: input } })
                          }
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
                  onChange={(option) =>
                    setState({ payload: { target: option } })
                  }
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
                    ref={addToSelectRefs}
                    multiple={true}
                    name='damage.damageAttribute'
                    placeholder='Damage Attribute'
                    value={state.damage?.damageAttribute}
                    options={builders.spell.damageAttribute}
                    required={true}
                    onChange={(option) =>
                      setState({ payload: { target: option } })
                    }
                  />
                  <Select
                    ref={addToSelectRefs}
                    name='damage.damageType'
                    multiple={true}
                    placeholder='Damage Type'
                    value={state.damage?.damageType}
                    options={builders.damage}
                    required={true}
                    onChange={(option) =>
                      setState({ payload: { target: option } })
                    }
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
