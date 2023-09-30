import { useState, useEffect, useReducer, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useGetBuilderQuery } from '../builders/builderApiSlice'
import { useAddNewSpellMutation, useUpdateSpellMutation } from './spellApiSlice'
import { isEqual } from 'lodash'
import TextEditor from '../../components/TextEditor'
import formReducer from '../../hooks/useReducer'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'
import AccordionButton from '../../components/AccordionButton'
import TabNavigation from '../../components/TabNavigation'

const EditSpellForm = () => {
  const { id } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const {
    data: builders,
    isSuccess: builderIsSuccess,
    isLoading: builderIsLoading,
  } = useGetBuilderQuery(id)

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
      setSuccessMessage('Item added successfully!')
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
    }
    if (updateIsSuccess) {
      setSuccessMessage('Item updated successfully!')
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
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
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
      payload: { target: oldState },
    })
    setSuccessMessage()
    setErrorMessage()
    handleValidation(true)
  }

  const onSubmit = async () => {
    const isValid = handleValidation()
    if (isValid) {
      await addNewSpell(state)
    } else {
      setErrorMessage('Please fill out all required fields')
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
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
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
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

  if (builderIsLoading) content = <p>Loading...</p>

  if (builderIsSuccess) {
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

    const mainTabContent = [
      {
        name: 'details',
        content: (
          <>
            <div className='row row-cols-lg-4 row-cols-md-3 row-cols-2 g-2 align-items-start pb-2'>
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
                value={state?.school}
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
                  value={state.materialDesc}
                  onChange={setState}
                />
              )}
            </div>
            <TextEditor
              ref={addToTextRefs}
              name='desc'
              value={state.desc}
              placeholder='Spell Description'
              onChange={setState}
            />
          </>
        ),
      },
      {
        name: 'attributes',
        content: (
          <>
            <div className='row row-cols-lg-3 row-cols-md-3 row-cols-2 g-2 justify-content-left pb-2'>
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
                value={state.action?.value}
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
                    value={state.duration.value}
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
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'secondaryAction'
            ) && (
              <div className='row row-cols-lg-3 row-cols-md-3 row-cols-2 g-2 justify-content-left pb-2'>
                <Select
                  ref={addToSelectRefs}
                  name='secondaryAction.actionType'
                  placeholder='Secondary Action'
                  value={state.secondaryAction?.actionType}
                  options={builders.spell.action}
                  required={true}
                  onChange={setState}
                />
                <Input
                  ref={addToInputRefs}
                  validation={'num'}
                  name='secondaryAction.value'
                  label={true}
                  placeholder='Action Increment'
                  value={state.seccondaryAction?.value}
                  required={true}
                  onChange={setState}
                />
              </div>
            )}
            <div className='row row-cols-lg-3 row-cols-md-3 row-cols-2 g-2 pb-2'>
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
              {state.attribute?.some(
                (attributeItem) => attributeItem.name === 'doesDamage'
              ) &&
                (!state?.damage?.damageByLevel ? (
                  setState({
                    type: 'added',
                    payload: {
                      target: {
                        name: 'damage.damageByLevel',
                      },
                    },
                  })
                ) : (
                  <>
                    <div className='row g-2 align-items-end pb-2'>
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
                    </div>
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
                ))}
            </div>
          </>
        ),
      },
    ]

    console.log(state)

    content = (
      <div className='main-container'>
        <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
          <div className='col-auto'>
            <h3>Edit a Spell</h3>
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
            <button
              className='btn btn-warning me-2'
              type='button'
              onClick={() => {
                onUpdate()
              }}
            >
              Update
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
        </form>
      </div>
    )
  }

  return content
}

export default EditSpellForm
