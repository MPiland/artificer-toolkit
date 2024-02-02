import { useState, useEffect, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAddNewSpellMutation } from './spellsApiSlice'
import { useGetBuildersQuery } from '../builders/buildersApiSlice'
import {
  selectAllClasses,
  useGetClassesQuery,
} from '../classes/classesApiSlice'
import { handleValidation } from '../../utils/form'
import { startCase } from 'lodash'
import Spinner from '../../components/Spinner/Spinner'
import TextEditor from '../../components/RichTextEditor/TextEditor'
import formReducer from '../../hooks/useReducer'
import Table from '../../components/Table/Table'
import Dropdown from '../../components/Dropdown/Dropdown'
import Input from '../../components/Input/Input'
import DraggableTabs from '../../components/DraggableTabs'
import Divider from '../../components/Divider/Divider'
import CollapseContainer from '../../components/Collapse/Collapse'
import Grid from '../../components/Grid/Grid'

const NewSpellForm = () => {
  const navigate = useNavigate()

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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!classes || !builders) {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [classes, builders])

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
    }
  }, [addIsSuccess, setState])

  useEffect(() => {
    if (addIsError) {
      setErrorMessage(addError?.data.message)
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
    return () =>
      document.removeEventListener('keypress', () => {
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
    return () =>
      document.removeEventListener('mouseup', () => {
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
        errorMsg: 'Must contain only numbers',
        validation: 'num',
        size: 'col',
      },
    ]
    if (damage) {
      inputArray.push(
        {
          name: 'dice.diceCount',
          value: 'Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
        {
          name: 'dice.diceValue',
          value: 'Dice Value',
          errorMsg: 'Must contain only numbers',
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
          errorMsg: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        },
        {
          name: 'dice.secDiceValue',
          value: 'Secondary Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
          size: 'col',
        }
      )
    }
    if (bonus) {
      inputArray.push({
        name: 'bonusDamage',
        value: 'Bonus Damage',
        errorMsg: 'Must contain only numbers',
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
          errorMsg: 'Must contain only numbers',
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
          errorMsg: 'Must contain only numbers',
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
          errorMsg: 'Must contain only numbers',
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
          <Grid cols={{ lg: 6, md: 4, base: 2 }}>
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
              errorMsg='Must contain only numbers'
              label='Spell Level'
              required={true}
              value={state.level}
              onChange={setState}
            />
            <Dropdown
              name='school'
              id='school'
              label='Spell School'
              value={state?.school}
              options={builders.spell.school}
              required={true}
              onChange={setState}
            />
            <Dropdown
              name='requirement'
              multiSelect={true}
              label='Requirements'
              value={state.requirement}
              options={builders.spell.requirement}
              required={true}
              onChange={setState}
            />
            <Dropdown
              name='classes'
              multiSelect={true}
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
          </Grid>
          <TextEditor
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
          <Grid cols={{ lg: 6, md: 4, base: 2 }}>
            <Dropdown
              multiSelect={true}
              name='attribute'
              label='Spell Attributes'
              value={state.attribute}
              options={builders.spell.attribute}
              onChange={setState}
            />
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'canUpcast'
            ) && (
              <Dropdown
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
                      (attributeItem) => attributeItem.name === 'secondaryDice'
                    )
                      ? upcastItem.name !== 'secondaryDice'
                      : upcastItem
                  )}
                multiSelect={true}
                onChange={setState}
              />
            )}
            <Dropdown
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
            <Dropdown
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
                  errorMsg='Must contain only numbers'
                  label='Duration Increment'
                  autoComplete='off'
                  required={true}
                  value={state.duration.value}
                  onChange={setState}
                />
              )}
            <Dropdown
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
                    errorMsg='Must contain only numbers'
                    label='Distance'
                    autoComplete='off'
                    required={
                      state.range?.rangeType?.name === 'distance' ? true : false
                    }
                    value={state.range?.distance}
                    onChange={setState}
                  />
                  <Dropdown
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
            <Dropdown
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
                    errorMsg='Must contain only numbers'
                    label='Shape Size'
                    autoComplete='off'
                    required={true}
                    value={state.shape?.size}
                    onChange={setState}
                  />
                  <Dropdown
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
                <Dropdown
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
              <Dropdown
                name='saveAbility'
                label='DC Ability'
                value={state.saveAbility}
                options={builders.ability}
                multiSelect={true}
                required={true}
                onChange={setState}
              />
            )}
            {state.attribute?.some(
              (attributeItem) => attributeItem.name === 'appliesCondition'
            ) && (
              <Dropdown
                name='condition'
                label='Condition'
                value={state.condition}
                options={builders.condition}
                multiSelect={true}
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
              errorMsg='Must contain only numbers'
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
                errorMsg='Must contain only numbers'
                onChange={setState}
              />
            )}
          </Grid>
          {state.attribute?.some(
            (attributeItem) => attributeItem.name === 'doesDamage'
          ) && (
            <>
              <Divider label={'Damage'} />
              <Grid
                cols={{
                  lg:
                    upcastTableColumns.inputs.length +
                    (state.damage?.bonus?.bonusAttribute?.name ===
                    'abilityBonus'
                      ? 1
                      : 0) +
                    (state.damage?.damageAttribute?.some(
                      (attributeItem) => attributeItem.name === 'bonusDamage'
                    )
                      ? 1
                      : 0) +
                    2,
                  md: 3,
                  base: 2,
                }}
              >
                <Dropdown
                  multiSelect={true}
                  name='damage.damageAttribute'
                  label='Damage Attribute'
                  value={state.damage?.damageAttribute}
                  options={builders.spell.damageAttribute}
                  onChange={setState}
                />
                <Dropdown
                  name='damage.damageType'
                  multiSelect={true}
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
                  errorMsg='Must contain only numbers'
                  onChange={setState}
                />
                <Input
                  name='damage.dice.diceValue'
                  value={state.damage?.dice.diceValue}
                  label='Dice Value'
                  required={true}
                  validation='num'
                  errorMsg='Must contain only numbers'
                  onChange={setState}
                />
                {state.damage?.damageAttribute?.some(
                  (attributeItem) => attributeItem.name === 'secondaryDice'
                ) && (
                  <>
                    <Dropdown
                      name='damage.secondaryDamageType'
                      multiSelect={true}
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
                      errorMsg='Must contain only numbers'
                      onChange={setState}
                    />
                    <Input
                      name='damage.dice.secDiceValue'
                      value={state.damage?.dice?.secDiceValue}
                      label='Secondary Dice Value'
                      required={true}
                      validation='num'
                      errorMsg='Must contain only numbers'
                      onChange={setState}
                    />
                  </>
                )}
                {state.damage?.damageAttribute?.some(
                  (attributeItem) => attributeItem.name === 'bonusDamage'
                ) && (
                  <>
                    <Dropdown
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
                        errorMsg='Must contain only numbers'
                        onChange={setState}
                      />
                    )}
                    {state.damage?.bonus?.bonusAttribute?.name ===
                      'abilityBonus' && (
                      <Dropdown
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
              </Grid>
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
                <CollapseContainer title='Upcast Table'>
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
                      addRow={true}
                      scrollable={true}
                    />
                  </div>
                </CollapseContainer>
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
      <Flex
        direction={{ base: 'column', sm: 'row' }}
        justify={{ base: 'space-between' }}
      >
        <h3>Create a Spell</h3>
        <Group justify='space-between' gap='xs'>
          <Button type='button' onClick={onSubmit}>
            Add
          </Button>
          <Button type='button' color='yellow' onClick={onReset}>
            Reset Form
          </Button>
          <Button type='button' color='gray' onClick={() => navigate(-1)}>
            Back
          </Button>
        </Group>
      </Flex>
      {successMessage && <h5 className='success-message'>{successMessage}</h5>}
      {errorMessage && <h5 className='error-message'>{errorMessage}</h5>}
      <form>
        <DraggableTabs
          id='main'
          addRow={false}
          tabState={mainTabContent.map((content) => ({
            value: startCase(content.name),
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
