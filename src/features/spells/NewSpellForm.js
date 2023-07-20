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
    }
  }, [addIsSuccess, id, setState])

  function validateForm() {}

  let content

  if (isLoading) content = <p>Loading...</p>

  if (isSuccess) {
    // Submit to databases
    const onSubmit = async () => {
      await addNewSpell(state)
    }

    const feature =
      state?.feature &&
      state.feature.map((feature, featureIndex) => (
        <div className='accordion-item' key={featureIndex}>
          <div className='accordion-header'>
            <AccordionButton
              id={`feature${featureIndex}AccordionButton`}
              target={`feature${featureIndex}AccordionBody`}
            >
              <Input
                className='col-4 border-0'
                type='text'
                name={`feature.${featureIndex}.value`}
                autoComplete='off'
                placeholder='Feature Name'
                required={true}
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
              <div className='pb-2'>
                <button
                  className='btn btn-outline-primary'
                  type='button'
                  name={`feature.${featureIndex}`}
                  onClick={(e) => setState({ type: 'removed', payload: e })}
                >
                  Remove feature
                </button>
              </div>
              <div className='pb-2'>
                <label
                  htmlFor={`feature.${featureIndex}.desc`}
                  className='form-label'
                >
                  Feature Description
                </label>
                <TextEditor
                  placeholder='Feature description'
                  id={`feature.${featureIndex}.desc`}
                  name={`feature.${featureIndex}.desc`}
                  onChange={setState}
                />
              </div>
              <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
                <div className='col-sm'>
                  <Select
                    multiple={true}
                    name={`feature.${featureIndex}.attribute`}
                    placeholder='Feature Attribute'
                    options={builders.spell.attribute}
                    onChange={setState}
                  />
                </div>
                {feature?.attribute?.some(
                  (attributeItem) => attributeItem.name === 'requireSave'
                ) && (
                  <div className='col-sm'>
                    <Select
                      name={`feature.${featureIndex}.saveAbility`}
                      placeholder='DC Ability'
                      options={builders.ability}
                      onChange={setState}
                    />
                  </div>
                )}
              </div>
              {feature?.attribute?.some(
                (attributeItem) => attributeItem.name === 'doesDamage'
              ) &&
                (!feature?.damage?.damageByLevel ? (
                  setState({
                    type: 'added',
                    payload: {
                      target: {
                        name: `feature.${featureIndex}.damage.damageByLevel`,
                        value: { level: state?.level },
                      },
                    },
                  })
                ) : (
                  <div className='row gx-2 align-items-end pb-2'>
                    <div className='col-sm'>
                      <Select
                        multiple={true}
                        name={`feature.${featureIndex}.damage.damageAttribute`}
                        placeholder='Damage Attribute'
                        options={builders.spell.damageAttribute}
                        onChange={setState}
                      />
                    </div>
                    <div className='col-sm'>
                      <Select
                        name={`feature.${featureIndex}.damage`}
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
                        name={`feature.${featureIndex}.damage.damageByLevel`}
                        state={feature.damage.damageByLevel}
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
              <Input
                className={`col-sm ${
                  state?.level &&
                  (NUM_REGEX.test(state.level) ? 'is-valid' : 'is-invalid')
                }`}
                type='text'
                name='level'
                id='level'
                label={true}
                invalidText='Must contain only numbers'
                placeholder='Spell Level'
                required={true}
                onChange={setState}
              />
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
                  name='action'
                  placeholder='Casting Time'
                  id='action'
                  options={builders.spell.action}
                  onChange={setState}
                />
              </div>
              <Input
                className={`col-sm ${
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
              <div className='col-sm'>
                <Select
                  name='duration'
                  id='duration'
                  placeholder='Duration'
                  options={builders.spell.duration}
                  onChange={setState}
                />
              </div>
              <Input
                className={`col-sm ${
                  state?.duration?.num &&
                  (NUM_REGEX.test(state.duration.num)
                    ? 'is-valid'
                    : 'is-invalid')
                }`}
                type='text'
                name='duration.num'
                id='duration.num'
                label={true}
                invalidText='Must contain only numbers'
                placeholder='Duration Increment'
                autoComplete='off'
                disabled={!!state.duration?.value ? false : true}
                required={true}
                onChange={setState}
              />
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
                    <Input
                      className={`col-sm ${
                        state.origin.distance &&
                        (NUM_REGEX.test(state.origin.distance)
                          ? 'is-valid'
                          : 'is-invalid')
                      }`}
                      type='text'
                      name='origin.distance'
                      id='origin.distance'
                      label={true}
                      invalidText='Must contain only numbers'
                      placeholder='Distance'
                      autoComplete='off'
                      disabled={!!state.origin?.value ? false : true}
                      required={true}
                      onChange={setState}
                    />
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
                  <Input
                    className={`col-sm ${
                      state?.area?.size &&
                      (NUM_REGEX.test(state.area.size)
                        ? 'is-valid'
                        : 'is-invalid')
                    }`}
                    type='text'
                    name='area.size'
                    id='area.size'
                    label={true}
                    invalidText='Must contain only numbers'
                    placeholder='Shape Size'
                    autoComplete='off'
                    disabled={!!state.area?.value ? false : true}
                    required={true}
                    onChange={setState}
                  />
                </>
              )}
            </div>
          </div>
          <div className='pb-2'>
            <button
              className='btn btn-secondary me-2'
              type='button'
              name='feature'
              onClick={(e) => setState({ type: 'added', payload: e })}
            >
              Add Feature
            </button>
            <button className='btn btn-primary' type='submit'>
              Add Spell
            </button>
          </div>
          <div className='accordion pb-3' id='featureAccordion'>
            {feature}
          </div>
        </form>
      </div>
    )
  }

  return content
}

export default NewSpellForm
