import { useState, useEffect, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAddNewSpellMutation } from './spellsApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import {
  selectAllClasses,
  useGetClassesQuery,
} from '../classes/classesApiSlice'
import { handleValidation } from '../../helpers/form'
import { useSelector } from 'react-redux'
import { selectLoadingStatus } from '../../app/loadingSlice'
import { startCase } from 'lodash'
import Spinner from '../../components/Spinner'
import TextEditor from '../../components/TextEditor'
import formReducer from '../../hooks/useReducer'
import Table from '../../components/Table'
import Select from '../../components/Select'
import Input from '../../components/Input'
import TabNavigation from '../../components/TabNavigation/TabNavigation'

const NewSpellForm = () => {
  const navigate = useNavigate()

  const isLoading = useSelector(selectLoadingStatus)

  const { data: builders } = useGetBuildersQuery('buildersList')

  const { classes } = useGetClassesQuery('classesList', {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  const [
    addNewSpell,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewSpellMutation()

  const [state, setState] = useReducer(formReducer, {})
  const [successMessage, setSuccessMessage] = useState()
  const [errorMessage, setErrorMessage] = useState()
  const [upcastTableColumns, setUpcastTableColumns] = useState()
  const textRefs = useRef([])

  useEffect(() => {
    if (addIsSuccess) {
      setSuccessMessage('Spell added successfully!')
      setErrorMessage()
      const successElement = document.getElementById('success-message')
      if (successElement) {
        successElement.scrollIntoView()
      }
      handleValidation(true)
      setState({
        type: 'reset',
        payload: { target: {} },
      })
      textRefs.current.forEach((textRef) => {
        textRef.resetState('')
      })
    }
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
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () => document.removeEventListener('keypress', () => {
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
  })

  useEffect(() => {
    document.addEventListener('mouseup', () => {
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
    return () => document.removeEventListener('mouseup', () => {
      if (successMessage != null) {
        setSuccessMessage()
        handleValidation(true)
      }
      if (errorMessage != null) {
        setErrorMessage()
      }
    })
  }, [successMessage, errorMessage])

  useEffect(() => {
    const upcastState = state.upcast
    const damageState = state.damage
    const damage =
      (upcastState?.upcastAttribute?.some(
        (attributeItem) => attributeItem.name === 'damage'
      ) ||
        upcastState?.upcastAttribute?.some(
          (attributeItem) => attributeItem.name === 'all'
        )) &&
      state.attribute?.some(
        (attributeItem) => attributeItem.name === 'doesDamage'
      )
    const secondary =
      upcastState?.upcastAttribute?.some(
        (attributeItem) => attributeItem.name === 'secondaryDice'
      ) ||
      upcastState?.upcastAttribute?.some(
        (attributeItem) => attributeItem.name === 'all'
      )
    const bonus =
      damage &&
      damageState?.damageAttribute?.some(
        (attributeItem) => attributeItem.name === 'bonusDamage'
      ) &&
      damageState?.bonus?.bonusAttribute?.name === 'setValue'
    const range =
      upcastState?.upcastAttribute?.some(
        (attributeItem) => attributeItem.name === 'range'
      ) ||
      upcastState?.upcastAttribute?.some(
        (attributeItem) => attributeItem.name === 'all'
      )
    const shape =
      upcastState?.upcastAttribute?.some(
        (attributeItem) => attributeItem.name === 'shape'
      ) ||
      upcastState?.upcastAttribute?.some(
        (attributeItem) => attributeItem.name === 'all'
      )
    const duration =
      upcastState?.upcastAttribute?.some(
        (attributeItem) => attributeItem.name === 'duration'
      ) ||
      upcastState?.upcastAttribute?.some(
        (attributeItem) => attributeItem.name === 'all'
      )
    const inputArray = [
      {
        name: 'level',
        value: 'Level',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: 'col',
      },
    ]
    if (damage) {
      inputArray.push(
        {
          name: 'dice.diceCount',
          value: 'Dice Count',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
        {
          name: 'dice.diceValue',
          value: 'Dice Value',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        }
      )
    }
    if (secondary) {
      inputArray.splice(
        3,
        0,
        {
          name: 'dice.secDiceCount',
          value: 'Secondary Dice Count',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
        {
          name: 'dice.secDiceValue',
          value: 'Secondary Dice Value',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        }
      )
    }
    if (bonus) {
      inputArray.push({
        name: 'bonusDamage',
        value: 'Bonus Damage',
        invalid: 'Must contain only numbers',
        validation: 'num',
        size: 'col',
      })
    }
    if (duration) {
      inputArray.push(
        {
          name: 'duration.durationType',
          value: 'Duration',
          type: 'select',
          options: builders.spell.duration,
          size: 'col',
        },
        {
          name: 'duration.value',
          value: 'Duration Increment',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        }
      )
    }
    if (range) {
      inputArray.push(
        {
          name: 'range.distance',
          value: 'Distance',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
        {
          name: 'range.unit',
          value: 'UoM',
          type: 'select',
          options: [].concat(
            Object.values(builders.unit.imperial).flatMap((item) => item)
          ),
          optionalKey: 'short',
          size: 'col',
        }
      )
    }
    if (shape) {
      inputArray.push(
        {
          name: 'shape.size',
          value: 'Shape Size',
          invalid: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
        {
          name: 'shape.unit',
          value: 'UoM',
          type: 'select',
          options: [].concat(
            Object.values(builders.unit.imperial).flatMap((item) => item)
          ),
          optionalKey: 'short',
          size: 'col',
        }
      )
    }

    const headerArray = inputArray.map((inputItem) => ({
      value: inputItem.value,
      readOnly: true,
      size: inputItem.size,
    }))

    setUpcastTableColumns({ inputs: inputArray, headers: headerArray })
  }, [builders, state])

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

  if (isLoading) {
    return (content = <Spinner />)
  }

  const mainTabContent = [
    {
      name: 'details',
      content: (
        <>
          <div className='row row-cols-lg-6 row-cols-md-4 row-cols-2 g-2 align-items-start pb-2'>
            <Input
              name='value'
              label='Spell Name'
              autoComplete='off'
              value={state.value}
              required={true}
              onChange={setState}
              autoFocus={true}
            />
            <Input
              validation={'num'}
              name='level'
              invalidText='Must contain only numbers'
              label='Spell Level'
              required={true}
              value={state.level}
              onChange={setState}
            />
            <Select
              name='school'
              id='school'
              label='Spell School'
              value={state?.school}
              options={builders.spell.school}
              required={true}
              onChange={setState}
            />
            <Select
              name='requirement'
              multiple={true}
              label='Requirements'
              value={state.requirement}
              options={builders.spell.requirement}
              required={true}
              onChange={setState}
            />
            <Select
              name='classes'
              multiple={true}
              label='Classes'
              value={state.classes}
              options={classes.filter(
                (classItem) => classItem.category.name !== 'subclass'
              )}
              required={true}
              onChange={setState}
            />
            {state.requirement?.some(
              (requirementItem) => requirementItem.name === 'material'
            ) && (
              <Input
                name='materialDesc'
                label='Material Desc.'
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
            label='Spell Description'
            onChange={setState}
          />
        </>
      ),
    },
    {
      name: 'attributes',
      content: (
        <>
          <div className='row row-cols-lg-5 row-cols-md-4 row-cols-2 g-2 justify-content-left pb-2'>
            <Select
              multiple={true}
              name='attribute'
              label='Spell Attributes'
              value={state.attribute}
              options={builders.spell.attribute}
              onChange={setState}
            />
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'canUpcast'
            ) && (
              <Select
                name='upcast.upcastAttribute'
                label='Upcast Attribute'
                value={state.upcast?.upcastAttribute}
                options={builders.spell.upcastAttribute
                  .filter((upcastItem) =>
                    !state.attribute?.some(
                      (attributeItem) => attributeItem.name === 'doesDamage'
                    )
                      ? upcastItem.name !== 'damage'
                      : upcastItem
                  )
                  .filter((upcastItem) =>
                    !state.damage?.damageAttribute?.some(
                      (attributeItem) =>
                        attributeItem.name === 'secondaryDice'
                    )
                      ? upcastItem.name !== 'secondaryDice'
                      : upcastItem
                  )}
                multiple={true}
                onChange={setState}
              />
            )}
            <Select
              name='action.actionType'
              label='Casting Time'
              value={state.action?.actionType}
              options={builders.spell.action}
              required={true}
              onChange={setState}
            />
            {state.action && state.action?.actionType?.name !== 'special' && (
              <Input
                validation='num'
                name='action.value'
                label='Casting Increment'
                value={state.action?.value}
                required={true}
                onChange={setState}
              />
            )}
            <Select
              name='duration.durationType'
              label='Duration'
              value={state.duration?.durationType}
              options={builders.spell.duration}
              required={true}
              onChange={setState}
            />
            {state.duration &&
              state.duration?.durationType.name !== 'instantaneous' &&
              state.duration?.durationType.name !== 'untilDispelled' &&
              state.duration?.durationType.name !== 'special' && (
                <Input
                  validation={'num'}
                  name='duration.value'
                  invalidText='Must contain only numbers'
                  label='Duration Increment'
                  autoComplete='off'
                  required={true}
                  value={state.duration.value}
                  onChange={setState}
                />
              )}
            <Select
              name='range.rangeType'
              label='Range'
              value={state.range?.rangeType}
              options={builders.spell.range}
              required={true}
              onChange={setState}
            />
            {state.range?.rangeType?.name !== 'touch' &&
              state.range?.rangeType?.name !== 'sight' &&
              state.range?.rangeType?.name !== 'unlimited' &&
              state.range?.rangeType && (
                <>
                  <Input
                    validation={'num'}
                    name='range.distance'
                    invalidText='Must contain only numbers'
                    label='Distance'
                    autoComplete='off'
                    required={
                      state.range?.rangeType?.name === 'distance' ? true : false
                    }
                    value={state.range?.distance}
                    onChange={setState}
                  />
                  <Select
                    name='range.unit'
                    label='UoM'
                    value={state.range?.unit}
                    options={[].concat(
                      Object.values(builders.unit.imperial).flatMap(
                        (item) => item
                      )
                    )}
                    required={
                      state.range?.rangeType?.name === 'distance' ? true : false
                    }
                    optionalKey='short'
                    onChange={setState}
                  />
                </>
              )}
            <Select
              name='shape.shapeType'
              label='Shape'
              options={builders.spell.shape}
              value={state.shape?.shapeType}
              onChange={setState}
            />
            {state.shape?.shapeType?.name &&
              state.shape?.shapeType?.name !== 'none' &&
              state.shape?.shapeType?.name !== 'weapon' && (
                <>
                  <Input
                    validation={'cur'}
                    name='shape.size'
                    invalidText='Must contain only numbers'
                    label='Shape Size'
                    autoComplete='off'
                    required={true}
                    value={state.shape?.size}
                    onChange={setState}
                  />
                  <Select
                    name='shape.unit'
                    label='UoM'
                    value={state.shape?.unit}
                    options={[].concat(
                      Object.values(builders.unit.imperial).flatMap(
                        (item) => item
                      )
                    )}
                    required={true}
                    optionalKey='short'
                    onChange={setState}
                  />
                </>
              )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'secondaryAction'
            ) && (
              <>
                <Select
                  name='secondaryAction.actionType'
                  label='Sec. Action'
                  value={state.secondaryAction?.actionType}
                  options={builders.spell.action}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation={'num'}
                  name='secondaryAction.value'
                  label='Sec. Increment'
                  value={state.secondaryAction?.value}
                  required={true}
                  onChange={setState}
                />
              </>
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'requireSave'
            ) && (
              <Select
                name='saveAbility'
                label='DC Ability'
                value={state.saveAbility}
                options={builders.ability}
                multiple={true}
                required={true}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'appliesCondition'
            ) && (
              <Select
                name='condition'
                label='Condition'
                value={state.condition}
                options={builders.condition}
                multiple={true}
                required={true}
                onChange={setState}
              />
            )}
            <Input
              name='targets'
              value={state.targets ?? 1}
              label='No. of Targets'
              required={true}
              validation='num'
              invalidText='Must contain only numbers'
              onChange={setState}
            />
            {state.upcast?.upcastAttribute?.some(
              (attributeItem) => attributeItem.name === 'targets'
            ) && (
              <Input
                name='upcast.targets'
                value={state.upcast?.targets}
                label={`Add'l. Targets Per Level`}
                required={true}
                validation='num'
                invalidText='Must contain only numbers'
                onChange={setState}
              />
            )}
          </div>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'doesDamage'
          ) && (
            <>
              <div className='d-flex'>
                <hr className='flex-grow-1 me-3' />
                <span className='mx-auto'>Damage</span>
                <hr className='flex-grow-1 ms-3' />
              </div>
              <div
                className={`row row-cols-lg-${
                  upcastTableColumns.inputs.length +
                  (state.damage?.bonus?.bonusAttribute?.name === 'abilityBonus'
                    ? 1
                    : 0) +
                  (state.damage?.damageAttribute?.some(
                    (attributeItem) => attributeItem.name === 'bonusDamage'
                  )
                    ? 1
                    : 0) +
                  2
                } row-cols-md-3 row-cols-2 g-2 pb-2`}
              >
                <Select
                  multiple={true}
                  name='damage.damageAttribute'
                  label='Damage Attribute'
                  value={state.damage?.damageAttribute}
                  options={builders.spell.damageAttribute}
                  onChange={setState}
                />
                <Select
                  name='damage.damageType'
                  multiple={true}
                  label='Damage Type'
                  value={state.damage?.damageType}
                  options={builders.damage}
                  required={true}
                  onChange={setState}
                />
                <Input
                  name='damage.dice.diceCount'
                  value={state.damage?.dice.diceCount}
                  label='Dice Count'
                  required={true}
                  validation='num'
                  invalidText='Must contain only numbers'
                  onChange={setState}
                />
                <Input
                  name='damage.dice.diceValue'
                  value={state.damage?.dice.diceValue}
                  label='Dice Value'
                  required={true}
                  validation='num'
                  invalidText='Must contain only numbers'
                  onChange={setState}
                />
                {state.damage?.damageAttribute?.some(
                  (attributeItem) => attributeItem.name === 'secondaryDice'
                ) && (
                  <>
                    <Select
                      name='damage.secondaryDamageType'
                      multiple={true}
                      label='Secondary Damage Type'
                      value={state.damage?.secondaryDamageType}
                      options={builders.damage}
                      required={true}
                      onChange={setState}
                    />
                    <Input
                      name='damage.dice.secDiceCount'
                      value={state.damage?.dice?.secDiceCount}
                      label='Secondary Dice Count'
                      required={true}
                      validation='num'
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                    <Input
                      name='damage.dice.secDiceValue'
                      value={state.damage?.dice?.secDiceValue}
                      label='Secondary Dice Value'
                      required={true}
                      validation='num'
                      invalidText='Must contain only numbers'
                      onChange={setState}
                    />
                  </>
                )}
                {state.damage?.damageAttribute?.some(
                  (attributeItem) => attributeItem.name === 'bonusDamage'
                ) && (
                  <>
                    <Select
                      name='damage.bonus.bonusAttribute'
                      label='Bonus Type'
                      value={state.damage?.bonus?.bonusAttribute}
                      options={builders.spell.bonusAttribute}
                      required={true}
                      onChange={setState}
                    />
                    {state.damage?.bonus?.bonusAttribute?.name ===
                      'setValue' && (
                      <Input
                        name='damage.damage.bonusDamage'
                        value={state.damage?.damage?.bonusDamage}
                        label='Bonus Damage'
                        required={true}
                        validation='num'
                        invalidText='Must contain only numbers'
                        onChange={setState}
                      />
                    )}
                    {state.damage?.bonus?.bonusAttribute?.name ===
                      'abilityBonus' && (
                      <Select
                        name='damage.bonus.ability'
                        label='Abilty'
                        value={state.bonus?.ability}
                        options={builders.ability}
                        required={true}
                        onChange={setState}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'canUpcast'
          ) &&
          state.upcast?.upcastAttribute?.length > 0 &&
          !state.upcast?.upcastAttribute?.every(
            (attributeItem) => attributeItem.name === 'targets'
          ) ? (
            !state.upcast?.upcastStats ? (
              setState({
                type: 'added',
                payload: { target: { name: 'upcast.upcastStats' } },
              })
            ) : (
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
                  <span className='me-3'>Upcast Table</span>
                  <i className='bi bi-arrow-down-up' />
                </div>
                <div
                  className='section-container collapse show'
                  id='sectionCollapse'
                >
                  <div className='section-content'>
                    <Table
                      rows={{
                        inputs: upcastTableColumns.inputs,
                        headers: upcastTableColumns.headers,
                      }}
                      className={`row-cols-${
                        upcastTableColumns.inputs.length + 1
                      }`}
                      name='upcast.upcastStats'
                      value={state.upcast?.upcastStats}
                      onChange={setState}
                      dynamic={true}
                      scrollable={true}
                    />
                  </div>
                </div>
              </>
            )
          ) : (
            state.upcast?.upcastStats &&
            setState({
              type: 'removed',
              payload: { target: { name: 'upcast.upcastStats' } },
            })
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
            onClick={onSubmit}
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
            value: startCase(content.name),
            name: content.name,
            content: content.content,
          }))}
        />
      </form>
    </>
  )

  return (
    <div className='main-container' id='main-container'>
      {content}
    </div>
  )
}

export default NewSpellForm
