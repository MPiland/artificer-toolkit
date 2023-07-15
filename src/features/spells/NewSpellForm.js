import { useState, useEffect, useReducer } from 'react'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useAddNewSpellMutation } from './spellsApiSlice'
import TextEditor from '../../components/TextEditor'
import formReducer from '../../hooks/useReducer'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import useAuth from '../../hooks/useAuth'

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
    }
  }, [addIsSuccess, id, setState])

  function validateForm() {}

  let content

  if (isLoading) content = <p>Loading...</p>

  if (isSuccess) {
    console.log(state)
    // const categoryOptions = builders.spell.category.map((category) => ({
    //   label: category.name,
    //   value: { name: category.name, id: category._id },
    // }))

    // Submit to databases
    const onSubmit = async () => {
      await addNewSpell(state)
    }

    const effect =
      state?.effect &&
      state.effect.map((effect, effectIndex) => (
        <div className='accordion-item' key={effectIndex}>
          <div className='accordion-header'>
            <button
              className='accordion-button details-section'
              type='button'
              data-bs-toggle='collapse'
              data-bs-target={`#effect${effectIndex}AccordionBody`}
              aria-controls={`effect${effectIndex}AccordionBody`}
              aria-expanded='true'
            >
              <div className='col-4'>
                <Input
                  className='border-0'
                  type='text'
                  name={`effect.${effectIndex}.value`}
                  autoComplete='off'
                  placeholder='Effect Name'
                  required={true}
                  onChange={setState}
                />
              </div>
            </button>
          </div>
          <div
            className='accordion-collapse collapse show'
            id={`effect${effectIndex}AccordionBody`}
            data-bs-parent='#effectAccordion'
          >
            <div className='accordion-body'>
              <div className='pb-2'>
                <button
                  className='btn btn-outline-primary'
                  type='button'
                  name={`effect.${effectIndex}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  Remove effect
                </button>
              </div>
              <div className='pb-2'>
                <label
                  htmlFor={`effect.${effectIndex}.desc`}
                  className='form-label'
                >
                  Effect Description
                </label>
                <TextEditor
                  placeholder='Effect description'
                  id={`effect.${effectIndex}.desc`}
                  name={`effect.${effectIndex}.desc`}
                  onChange={setState}
                />
              </div>
              <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
                <div className='col-sm'>
                  <Select
                    multiple={true}
                    name={`effect.${effectIndex}.attribute`}
                    placeholder='Effect Attribute'
                    options={builders.spell.attribute}
                    onChange={setState}
                  />
                </div>
                {effect?.attribute?.some(
                  (attributeItem) => attributeItem.name === 'requireSave'
                ) && (
                  <div className='col-sm'>
                    <Select
                      name={`effect.${effectIndex}.saveAbility`}
                      placeholder='DC Ability'
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                )}
              </div>
              {effect?.attribute?.some(
                (attributeItem) => attributeItem.name === 'doesDamage'
              ) &&
                (!effect?.damage?.damageByLevel ? (
                  setState({
                    type: 'added',
                    payload: {
                      target: {
                        name: `effect.${effectIndex}.damage.damageByLevel`,
                        value: { level: state?.level },
                      },
                    },
                  })
                ) : (
                  <div className='row gx-2 align-items-end pb-2'>
                    <div className='col-sm'>
                      <Select
                        multiple={true}
                        name={`effect.${effectIndex}.damage.damageAttribute`}
                        placeholder='Damage Attribute'
                        options={builders.spell.damageAttribute}
                        onChange={setState}
                      />
                    </div>
                    <div className='col-sm'>
                      <Select
                        name={`effect.${effectIndex}.damage`}
                        placeholder='Damage Type'
                        options={builders.damage}
                        onChange={setState}
                      />
                    </div>
                    <div className='col-lg-6'>
                      <Table
                        className='table-sm table-responsive'
                        headers={[
                          { name: 'Level' },
                          { name: 'Dice Count' },
                          { name: 'Dice Value' },
                        ]}
                        name={`effect.${effectIndex}.damage.damageByLevel`}
                        state={effect.damage.damageByLevel}
                        onChange={setState}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ))

    content = (
      <div className='builder-form'>
        <h1>Create a Spell</h1>
        {successMessage && (
          <h3 className='add-success-message'>{successMessage}</h3>
        )}
        <form
          className='needs-validation'
          onSubmit={() => {
            validateForm()
            onSubmit()
          }}
          noValidate
        >
          <button
            className='accordion accordion-button form-details justify-content-between align-items-center'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#details'
            aria-expanded='true'
            aria-controls='details'
          >
            <span className='me-3'>Details</span>
            <hr className='flex-grow-1 me-3' />
          </button>
          <div className='accordion-collapse show' id='details'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 align-items-start'>
              <div className='col-sm'>
                <Input
                  type='text'
                  name='value'
                  id='name'
                  label={true}
                  placeholder='Spell Name'
                  autoComplete='off'
                  required={true}
                  onChange={setState}
                />
              </div>
              <div className='position-relative col-sm'>
                <Input
                  className={`${
                    state?.level &&
                    (NUM_REGEX.test(state.level) ? 'is-valid' : 'is-invalid')
                  }`}
                  type='text'
                  name='level'
                  id='level'
                  label={true}
                  placeholder='Spell Level'
                  required={true}
                  onChange={setState}
                />
                <div id='levelTooltip' className='invalid-tooltip'>
                  Must contain only numbers
                </div>
              </div>
              <div className='col-sm pb-2'>
                <Select
                  name='school'
                  id='school'
                  placeholder={'Spell School'}
                  options={builders.spell.school}
                  onChange={setState}
                />
              </div>
              <div className='col-sm pb-2'>
                <Select
                  name='requirement'
                  multiple={true}
                  placeholder={'Requirements'}
                  id='requirement'
                  options={builders.spell.requirement}
                  onChange={setState}
                />
              </div>
            </div>
          </div>
          <button
            className='accordion accordion-button form-details justify-content-between align-items-center'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#description'
            aria-expanded='true'
            aria-controls='description'
          >
            <span className='me-3'>Description</span>
            <hr className='flex-grow-1 me-3' />
          </button>
          <div className='accordion-collapse show pb-3' id='description'>
            <TextEditor id='desc' name={'desc'} onChange={setState} />
          </div>
          <button
            className='accordion accordion-button form-details justify-content-between align-items-center'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#attributes'
            aria-expanded='false'
            aria-controls='attributes'
          >
            <span className='me-3'>Attributes</span>
            <hr className='flex-grow-1 me-3' />
          </button>
          <div className='accordion-collapse show' id='attributes'>
            <div className='row row-cols-lg-3 row-cols-md-2 row-cols-sm-1 g-2 justify-content-left pb-2'>
              <div className='col-sm'>
                <Select
                  name='action'
                  placeholder='Casting Time'
                  id='action'
                  options={builders.spell.action}
                  onChange={setState}
                />
              </div>
              <div className='col-sm position-relative'>
                <Input
                  className={`${
                    state?.action?.num &&
                    (NUM_REGEX.test(state.action?.num)
                      ? 'is-valid'
                      : 'is-invalid')
                  }`}
                  type='text'
                  name='action.num'
                  id='action.num'
                  label={true}
                  placeholder='Casting Increment'
                  required={true}
                  disabled={!!state.action?.value ? false : true}
                  onChange={setState}
                />
                <div id='action.numTooltip' className='invalid-tooltip'>
                  Must contain only numbers
                </div>
              </div>
              <div className='col-sm'>
                <Select
                  name='duration'
                  id='duration'
                  placeholder='Duration'
                  options={builders.spell.duration}
                  onChange={setState}
                />
              </div>
              <div className='col-sm position-relative'>
                <Input
                  className={`${
                    state?.duration?.num &&
                    (NUM_REGEX.test(state.duration.num)
                      ? 'is-valid'
                      : 'is-invalid')
                  }`}
                  type='text'
                  name='duration.num'
                  id='duration.num'
                  label={true}
                  placeholder='Duration Increment'
                  autoComplete='off'
                  disabled={!!state.duration?.value ? false : true}
                  required={true}
                  onChange={setState}
                />
                <div id='duration.numTooltip' className='invalid-tooltip'>
                  Must contain only numbers
                </div>
              </div>
              <div className='col-sm'>
                <Select
                  name='origin'
                  id='origin'
                  placeholder='Origin Point'
                  options={builders.spell.origin}
                  onChange={setState}
                />
              </div>
              {state?.origin && state.origin?.value !== 'Touch' && (
                <>
                  {state.origin.value === 'Distance' && (
                    <div className='col-sm position-relative'>
                      <Input
                        className={`${
                          state.origin.distance &&
                          (NUM_REGEX.test(state.origin.distance)
                            ? 'is-valid'
                            : 'is-invalid')
                        }`}
                        type='text'
                        name='origin.distance'
                        id='origin.distance'
                        label={true}
                        placeholder='Distance'
                        autoComplete='off'
                        disabled={!!state.origin?.value ? false : true}
                        required={true}
                        onChange={setState}
                      />
                      <div
                        id='origin.distanceTooltip'
                        className='invalid-tooltip'
                      >
                        Must contain only numbers
                      </div>
                    </div>
                  )}
                  <div className='col-sm'>
                    <Select
                      name='area'
                      placeholder='Shape'
                      id='area'
                      options={builders.spell.area.filter((area) =>
                        state?.origin && state.origin.value === 'Distance'
                          ? area.value !== 'Cone'
                          : area
                      )}
                      onChange={setState}
                    />
                  </div>
                  <div className='col-sm position-relative'>
                    <Input
                      className={`form-control ${
                        state?.area?.size &&
                        (NUM_REGEX.test(state.area.size)
                          ? 'is-valid'
                          : 'is-invalid')
                      }`}
                      type='text'
                      name='area.size'
                      id='area.size'
                      label={true}
                      placeholder='Shape Size'
                      autoComplete='off'
                      disabled={!!state.area?.value ? false : true}
                      required={true}
                      onChange={setState}
                    />
                    <div id='area.sizeTooltip' className='invalid-tooltip'>
                      Must contain only numbers
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className='pb-2'>
            <button
              className='btn btn-secondary me-2'
              type='button'
              name='effect'
              onClick={(e) => setState({ type: 'added', payload: e })}
            >
              Add Effect
            </button>
            <button className='btn btn-primary' type='submit'>
              Add Spell
            </button>
          </div>
          <div className='accordion pb-3' id='effectAccordion'>
            {effect}
          </div>
        </form>
      </div>
    )
  }

  return content
}

export default NewSpellForm
