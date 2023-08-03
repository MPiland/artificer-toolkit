import { useState, useEffect, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useAddNewSpellMutation } from './spellsApiSlice'
import TextEditor from '../../components/TextEditor'
import formReducer from '../../hooks/useReducer'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'
import AccordionButton from '../../components/AccordionButton'

const NUM_REGEX = /^[0-9\b]+$/

const NewSpellForm = () => {
  const { id } = useAuth()
  const navigate = useNavigate()

  const { data: builders, isSuccess, isLoading } = useGetBuilderQuery(id)

  const [
    addNewSpell,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewSpellMutation()

  const [state, setState] = useReducer(formReducer, { userId: id })
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()

  useEffect(() => {
    const forms = document.querySelectorAll('.needs-validation')
    Array.from(forms).forEach(function (form) {
      form.addEventListener(
        'submit',
        function (event) {
          if (!form.checkValidity()) {
            event.preventDefault()
            event.stopPropagation()
          }
          form.classList.add('was-validated')
        },
        false
      )
    })
  })

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
      setErrorMessage(addError.data.message)
    }
  }, [addIsError, addError])

  useEffect(() => {
    document.addEventListener('keypress', () => {
      if (!!successMessage) {
        setSuccessMessage()
      }
      if (!!errorMessage) {
        setErrorMessage()
      }
    })
    return document.removeEventListener('keypress', () => {
      if (!!successMessage) {
        setSuccessMessage()
      }
      if (!!errorMessage) {
        setErrorMessage()
      }
    })
  })

  function validateForm() {}

  const onSubmit = async () => {
    await addNewSpell(state)
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
        <div className='d-flex justify-content-between pb-2'>
          <h3>Create a Spell</h3>
          <button
            className='btn btn-secondary btn-small'
            onClick={() => navigate(-1)}
          >
            Back
          </button>
        </div>
        {successMessage && (
          <h3 className='success-message'>{successMessage}</h3>
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
                name='school'
                id='school'
                placeholder={'Spell School'}
                state={state.school}
                options={builders.spell.school}
                onChange={(option) => setState({ payload: { target: option } })}
              />
              <Select
                name='requirement'
                multiple={true}
                placeholder={'Requirements'}
                state={state.requirement}
                options={builders.spell.requirement}
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
              state={state.desc}
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
                state={state.attribute}
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
                name='action.actionType'
                placeholder='Casting Time'
                state={state.action?.actionType}
                options={builders.spell.action}
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
                name='duration.durationType'
                placeholder='Duration'
                state={state.duration?.durationType}
                options={builders.spell.duration}
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
                name='range.rangeType'
                placeholder='Range'
                state={state.range?.rangeType}
                options={builders.spell.range}
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
                      name='shape.shapeType'
                      placeholder='Shape'
                      options={builders.spell.shape}
                      state={state.shape?.shapeType}
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
                  name='saveAbility'
                  placeholder='DC Ability'
                  state={state.saveAbility}
                  options={builders.ability}
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
                    multiple={true}
                    name='damage.damageAttribute'
                    placeholder='Damage Attribute'
                    state={state.damage?.damageAttribute}
                    options={builders.spell.damageAttribute}
                    onChange={(option) =>
                      setState({ payload: { target: option } })
                    }
                  />
                  <Select
                    name='damage.damageType'
                    multiple={true}
                    placeholder='Damage Type'
                    state={state.damage?.damageType}
                    options={builders.damage}
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
                  state={state.damage?.damageByLevel}
                  onChange={setState}
                  dynamic={true}
                />
              </div>
            </>
          )}
          <div className='pb-2'>
            <button
              className='btn btn-primary'
              type='button'
              onClick={() => {
                validateForm()
                onSubmit()
              }}
            >
              Add Spell
            </button>
          </div>
        </form>
      </div>
    )
  }

  return content
}

export default NewSpellForm
