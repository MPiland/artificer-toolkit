import { useState, useEffect, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAddNewSpellMutation } from './spellsApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import { handleValidation } from '../../helpers/form'
import Spinner from '../../components/Spinner'
import TextEditor from '../../components/TextEditor'
import formReducer from '../../hooks/useReducer'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import TabNavigation from '../../components/TabNavigation'

const NewSpellForm = () => {
  const navigate = useNavigate()

  const { data: builders, isFetching: isBuildersFetching } =
    useGetBuildersQuery('buildersList')

  const [
    addNewSpell,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewSpellMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [isLoadingData, setIsLoadingData] = useState(true)
  const textRefs = useRef([])

  useEffect(() => {
    if (isBuildersFetching) {
      setIsLoadingData(true)
    } else {
      setIsLoadingData(false)
    }
  }, [isBuildersFetching])

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
        payload: { target: {} },
      })
    }
    textRefs.current.forEach((textRef) => {
      textRef.resetState('')
    })
  }, [addIsSuccess, setState])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError.message)
      const errorrElement = document.getElementById('error-message')
      if (errorrElement) {
        errorrElement.scrollIntoView()
      }
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

  const addToTextRefs = (ref) => {
    if (ref && !textRefs.current.includes(ref)) {
      textRefs.current.push(ref)
    }
  }

  const onReset = () => {
    setState({
      type: 'reset',
      payload: { target: {} },
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

  let content

  if (isLoadingData) {
    return (content = <Spinner />)
  }

  const damageTableInputs = (secondary) => {
    const inputArray = [
      {
        name: 'level',
        value: 'Level',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'col-md col-sm-2 col-3',
      },
      {
        name: 'diceCount',
        value: 'Dice Count',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'col-md col-sm-3 col-4',
      },
      {
        name: 'diceValue',
        value: 'Dice Value',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'col-md col-sm-3 col-4',
      },
      {
        name: 'bonusDamage',
        value: 'Bonus Damage',
        invalid: 'Must contain only numbers',
        validation: 'num',
        label: true,
        size: 'col-md col-sm-3 col-4',
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
          size: 'col-md col-sm-3 col-4',
        },
        {
          name: 'secDiceValue',
          value: 'Sec. Dice Value',
          invalid: 'Must contain only numbers',
          validation: 'num',
          label: true,
          size: 'col-md col-sm-3 col-4',
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
                state.attribute?.some(
                  (stateItem) => stateItem.name === 'doesDamage'
                )
                  ? attributeItem
                  : attributeItem.name !== 'secondaryDamage'
              )}
              onChange={setState}
            />
            <Select
              name='action.actionType'
              placeholder='Casting Time'
              value={state.action?.actionType}
              options={builders.spell.action}
              required={true}
              onChange={setState}
            />
            <Input
              validation={'num'}
              name='action.value'
              label={true}
              placeholder='Casting Increment'
              value={state.action?.value}
              required={true}
              onChange={setState}
            />
            <Select
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
                name='secondaryAction.actionType'
                placeholder='Secondary Action'
                value={state.secondaryAction?.actionType}
                options={builders.spell.action}
                required={true}
                onChange={setState}
              />
              <Input
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
            ) && !state?.damage?.diceByLevel ? (
              setState({
                type: 'added',
                payload: {
                  target: {
                    name: 'damage.diceByLevel',
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
                    name='damage.damageType'
                    multiple={true}
                    placeholder='Damage Type'
                    value={state.damage?.damageType}
                    options={builders.damage}
                    required={true}
                    onChange={setState}
                  />
                </div>
              </>
            )}
          </div>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'doesDamage'
          ) && (
            <>
              <div
                className='btn btn-section-collapse justify-content-between align-items-center'
                id='sectionCollapseButton'
                type='button'
                role='button'
                data-bs-toggle='collapse'
                data-bs-target='#sectionCollapse'
                aria-controls='collapseExample'
                aria-expanded='true'
              >
                <span className='me-3'>Damage Table</span>
                <i className='bi bi-arrow-down-up' />
              </div>
              <div
                className='section-container collapse show'
                id='sectionCollapse'
              >
                <div className='section-content'>
                  <Table
                    inputs={damageTableInputs(
                      state.attribute?.some(
                        (attributeItem) =>
                          attributeItem.name === 'secondaryDamage'
                      )
                    )}
                    className={`row-cols-lg-${
                      damageTableInputs(
                        state.attribute?.some(
                          (attributeItem) =>
                            attributeItem.name === 'secondaryDamage'
                        )
                      ).length + 1
                    }`}
                    name='damage.diceByLevel'
                    value={state.damage?.diceByLevel}
                    onChange={setState}
                    dynamic={true}
                    scrollable={true}
                  />
                </div>
              </div>
            </>
          )}
        </>
      ),
    },
  ]

  content = (
    <>
      <div className='row row-cols-1 row-cols-md-3 justify-content-between pb-2'>
        <div className='col-auto'>
          <h3>Create a Spell</h3>
        </div>
        <div className='col-auto d-flex justify-content-end'>
          <button
            className='btn btn-primary me-2'
            type='button'
            onClick={() => {
              onSubmit()
            }}
          >
            Add
          </button>
          <button className='btn btn-warning me-2' onClick={onReset}>
            Reset Form
          </button>
          <button className='btn btn-secondary' onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>
      {successMessage && <h5 className='success-message'>{successMessage}</h5>}
      {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
      <form>
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
    </>
  )

  return <div className='main-container'>{content}</div>
}

export default NewSpellForm
