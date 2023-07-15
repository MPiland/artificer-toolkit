import { useState, useEffect, useReducer } from 'react'
import { useAddNewRaceMutation } from './racesApiSlice'
import TextEditor from '../../components/TextEditor'
import { useGetBuilderQuery } from '../builders/buildersApiSlice'
import { useGetSpellQuery } from '../spells/spellsApiSlice'
import formReducer from '../../hooks/useReducer'
import useAuth from '../../hooks/useAuth'

const NUM_REGEX = /^[0-9\b]+$/

const NewRaceForm = () => {
  const { id } = useAuth()

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

  const [addNewRace, { isSuccess: addSuccess }] = useAddNewRaceMutation()

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
    if (addSuccess) {
      setState({
        userId: id,
      })
      setSuccessMessage('Item added successfully!')
    }
  }, [addSuccess, id])

  function validateForm() {}

  let content

  if (builderLoading || spellLoading) {
    content = <p>Loading...</p>
  }

  if (builderSuccess || spellSuccess) {

    // Submit to databases
    const onSubmit = async () => {
      await addNewRace(state)
    }

    content = (
      <div className='builder-form'>
        <h1>Create a Race</h1>
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
          <div className='row g-2 pb-2'>
            <div className='col-lg-4 col-md-6 col-sm-12'>
              <div className='form-floating'>
                <input
                  className='form-control'
                  type='text'
                  name='name'
                  autoComplete='off'
                  placeholder='Race Name'
                  required
                  onChange={(e) => setState({ payload: e })}
                />
                <label htmlFor='name'>Race Name</label>
              </div>
            </div>
          </div>
          <button
            className='accordion accordion-button form-details justify-content-between align-items-center'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#details'
            aria-expanded='false'
            aria-controls='details'
          >
            <span className='me-3'>Details</span>
            <hr className='flex-grow-1 me-3' />
          </button>
          <div className='accordion-collapse show' id='details'>
            <div className='pb-2'>
              <TextEditor
                onChange={setState}
                placeholder={'Opening Quote'}
                name={'quote'}
              />
            </div>
            <div className='pb-2'>
              <button
                className='btn btn-secondary'
                type='button'
                name='details.section'
                onClick={(e) => setState({ type: 'added', payload: e })}
              >
                Add Details Section
              </button>
            </div>
            <div className='accordion' id='detailsSectionAccordion'>
              {state?.details?.section?.map((section, index) => (
                <div key={index}>
                  <div className='accordion-item'>
                    <div className='accordion-header'>
                      <button
                        className='accordion-button details-section'
                        type='button'
                        data-bs-toggle='collapse'
                        data-bs-target={`#details.section.${index}AccordionBody`}
                        aria-expanded='false'
                        aria-controls={`details.section.${index}AccordionBody`}
                      >
                        <div className='col-4'>
                          <input
                            className='form-control border-0'
                            type='text'
                            name={`details.section.${index}.title`}
                            autoComplete='off'
                            placeholder='Section Title'
                            required
                            onChange={(e) => setState({ payload: e })}
                          />
                        </div>
                      </button>
                    </div>
                    <div
                      className='accordion-collapse show'
                      id={`details.section.${index}AccordionBody`}
                      data-bs-parent='#detailsSectionAccordion'
                    >
                      <div className='accordion-body'>
                        <div className='col-auto pb-3'>
                          <button
                            className='btn btn-outline-primary overflow-hidden text-nowrap'
                            type='button'
                            name={`details.section.${index}`}
                            onClick={(e) =>
                              setState({ type: 'removed', payload: e })
                            }
                          >
                            Remove Section
                          </button>
                        </div>
                        <div className='pb-2'>
                          <TextEditor
                            onChange={setState}
                            placeholder={'Section Text'}
                            name={`details.section.${index}.text`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            className='accordion accordion-button form-details justify-content-between align-items-center'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#trait'
            aria-expanded='true'
            aria-controls='trait'
          >
            <span className='me-3'>Traits</span>
            <hr className='flex-grow-1 me-3' />
          </button>
          <div className='accordion-collapse show pb-2' id='trait'>
            <div className='row row-cols-lg-4 row-cols-md-2 row-cols-sm-1 g-2 pb-2'>
              <div className='col'></div>
            </div>
          </div>
          <div className='pb-3'>
            <button className='btn btn-primary' type='submit'>
              Add Item
            </button>
          </div>
        </form>
      </div>
    )
    return content
  }
}
export default NewRaceForm
