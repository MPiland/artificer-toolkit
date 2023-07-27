import { useState, useEffect, useReducer } from 'react'
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

  const { data: builders, isSuccess, isLoading } = useGetBuilderQuery(id)

  const [addNewSpell, { isSuccess: addIsSuccess }] = useAddNewSpellMutation()

  const [state, setState] = useReducer(formReducer, { userId: id })
  const [successMessage, setSuccessMessage] = useState()

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

  function validateForm() {}

  const onSubmit = async () => {
    await addNewSpell(state)
  }

  console.log(state)

  let content

  if (isLoading) content = <p>Loading...</p>

  if (isSuccess) {
    // Submit to databases

    content = (
      <div className='builder-form'>
        <h1>Create a Spell</h1>
        {successMessage && (
          <h3 className='add-success-message'>{successMessage}</h3>
        )}
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
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 align-items-start'>
              <Input
                name='value'
                label={true}
                placeholder='Spell Name'
                autoComplete='off'
                value={state.value ?? ''}
                required={true}
                onChange={setState}
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
                onChange={setState}
              />
              <div className='col-sm pb-2'>
                <Select
                  name='school'
                  id='school'
                  placeholder={'Spell School'}
                  state={state.school}
                  options={builders.spell.school}
                  onChange={setState}
                />
              </div>
              <div className='col-sm pb-2'>
                <Select
                  name='requirement'
                  multiple={true}
                  placeholder={'Requirements'}
                  state={state.requirement}
                  options={builders.spell.requirement}
                  onChange={setState}
                />
              </div>
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
            <TextEditor id='desc' name={'desc'} onChange={setState} />
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
              <div className='col-sm'>
                <Select
                  multiple={true}
                  name='attribute'
                  placeholder='Spell Attributes'
                  state={state.attribute}
                  options={builders.spell.attribute}
                  onChange={setState}
                />
              </div>
              <div className='col-sm'>
                <Select
                  name='action.actionType'
                  placeholder='Casting Time'
                  state={state.action?.actionType}
                  options={builders.spell.action}
                  onChange={setState}
                />
              </div>
              <Input
                className={`${
                  state?.action?.num &&
                  (NUM_REGEX.test(state.action?.num)
                    ? 'is-valid'
                    : 'is-invalid')
                }`}
                name='action.num'
                label={true}
                placeholder='Casting Increment'
                value={state.action?.num ?? ''}
                required={true}
                onChange={setState}
              />
              <div className='col-sm'>
                <Select
                  name='duration.durationType'
                  placeholder='Duration'
                  state={state.duration?.durationType}
                  options={builders.spell.duration}
                  onChange={setState}
                />
              </div>
              <Input
                className={`${
                  state?.duration?.num &&
                  (NUM_REGEX.test(state.duration.num)
                    ? 'is-valid'
                    : 'is-invalid')
                }`}
                name='duration.num'
                label={true}
                invalidText='Must contain only numbers'
                placeholder='Duration Increment'
                autoComplete='off'
                required={true}
                value={state.duration?.num ?? ''}
                onChange={setState}
              />
              <div className='col-sm'>
                <Select
                  name='origin.originType'
                  placeholder='Origin Point'
                  state={state.origin?.originType}
                  options={builders.spell.origin}
                  onChange={setState}
                />
              </div>
              {state?.origin && state.origin?.value !== 'Touch' && (
                <>
                  {state.origin.value === 'Distance' && (
                    <Input
                      className={`${
                        state.origin?.distance &&
                        (NUM_REGEX.test(state.origin?.distance)
                          ? 'is-valid'
                          : 'is-invalid')
                      }`}
                      name='origin.distance'
                      label={true}
                      invalidText='Must contain only numbers'
                      placeholder='Distance'
                      autoComplete='off'
                      required={true}
                      value={state.origin?.distance ?? ''}
                      onChange={setState}
                    />
                  )}

                  <div className='col-sm'>
                    <Select
                      name='shape.shapeType'
                      placeholder='Shape'
                      options={builders.spell.shape.filter((shape) =>
                        state?.origin && state.origin.value === 'Distance'
                          ? shape.value !== 'Cone' &&
                            shape.value !== 'Weapon' &&
                            shape.value !== 'Beam'
                          : shape
                      )}
                      state={state.shape?.shapeType}
                      onChange={setState}
                    />
                  </div>
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
                    placeholder='Shape Size'
                    autoComplete='off'
                    required={true}
                    value={state.shape?.size ?? ''}
                    onChange={setState}
                  />
                </>
              )}
              {state.origin?.value === 'Self' &&
                state.shape?.value !== 'Weapon' &&
                (state.shape?.value === 'Beam' ||
                  state.shape?.value === 'Cube' ||
                  state.shape?.value === 'Sphere') && (
                  <Input
                    className={`${
                      state?.range &&
                      (NUM_REGEX.test(state.range) ? 'is-valid' : 'is-invalid')
                    }`}
                    name='range'
                    placeholder='Range'
                    invalidText='Must contain only numbers'
                    label={true}
                    value={state.range ?? ''}
                    onChange={setState}
                  />
                )}
            </div>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              {state?.attribute?.some(
                (attributeItem) => attributeItem.name === 'requireSave'
              ) && (
                <div className='col-sm'>
                  <Select
                    name='saveAbility'
                    placeholder='DC Ability'
                    state={state.saveAbility}
                    options={builders.ability}
                    onChange={setState}
                  />
                </div>
              )}
            </div>
            {state?.attribute?.some(
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
                  <div className='col-sm'>
                    <Select
                      multiple={true}
                      name='damage.damageAttribute'
                      placeholder='Damage Attribute'
                      state={state.damage?.damageAttribute}
                      options={builders.spell.damageAttribute}
                      onChange={setState}
                    />
                  </div>
                  <div className='col-sm'>
                    <Select
                      name='damage.damageType'
                      multiple={true}
                      placeholder='Damage Type'
                      state={state.damage?.damageType}
                      options={builders.damage}
                      onChange={setState}
                    />
                  </div>
                  <div className='col-lg-6  col-md-12'>
                    <Table
                      headers={[
                        {
                          name: 'level',
                          value: 'Level',
                          invalid: 'Must contain only numbers',
                          label: true,
                        },
                        {
                          name: 'diceCount',
                          value: 'Dice Count',
                          size: 3,
                          invalid: 'Must contain only numbers',
                          label: true,
                        },
                        {
                          name: 'diceValue',
                          value: 'Dice Value',
                          size: 3,
                          invalid: 'Must contain only numbers',
                          label: true,
                        },
                      ]}
                      name='damage.damageByLevel'
                      state={state.damage.damageByLevel}
                      onChange={setState}
                    />
                  </div>
                </div>
              ))}
          </div>
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
