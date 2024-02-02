import { FC, useEffect, useState } from 'react'
import { Action, Option, RowHeader, RowInput } from '../../utils/types'
import Grid from '../Grid/Grid'
import { sprinkles } from '../../css/sprinkles.css'
import useMediaQuery from '../../hooks/useMediaQuery'
import Dropdown from '../Dropdown/Dropdown'
import { startCase } from 'lodash'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import Spinner from '../Spinner/Spinner'
import Input from '../Input/Input'
import Collapse from '../Collapse/Collapse'
import Divider from '../Divider/Divider'
import Table from '../Table/Table'

interface AttributeFormProps {
  state: any
  setState: (arg: Action) => void
  context: {
    type: string
    title: string
  }
}

const AttributeForm: FC<AttributeFormProps> = ({
  state,
  setState,
  context,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [damageTableColumns, setDamageTableColumns] = useState<{
    inputs: RowInput[]
    headers: RowHeader[]
  }>({ inputs: [], headers: [] })

  const { data: builders, isFetching: isBuildersFetching } =
    useGetBuildersQuery(undefined)

  const lg = useMediaQuery('(min-width: 1024px)')
  const md = useMediaQuery('(min-width: 568px) and (max-width: 1023px)')

  useEffect(() => {
    if (isBuildersFetching) {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [isBuildersFetching])

  useEffect(() => {
    const upcastState = state.upcast
    const damageState = state.damage
    const damage =
      (upcastState?.upcastAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'damage'
      ) ||
        upcastState?.upcastAttribute?.some(
          (attributeItem: any) => attributeItem.name === 'all'
        )) &&
      state.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'doesDamage'
      )
    console.log('damage', damage)
    const secondary =
      upcastState?.upcastAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'secondaryDice'
      ) ||
      upcastState?.upcastAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'all'
      )
    const bonus =
      damage &&
      damageState?.damageAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'bonusDamage'
      ) &&
      damageState?.bonus?.bonusAttribute?.name === 'setValue'
    const range =
      upcastState?.upcastAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'range'
      ) ||
      upcastState?.upcastAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'all'
      )
    const shape =
      upcastState?.upcastAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'shape'
      ) ||
      upcastState?.upcastAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'all'
      )
    const duration =
      upcastState?.upcastAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'duration'
      ) ||
      upcastState?.upcastAttribute?.some(
        (attributeItem: any) => attributeItem.name === 'all'
      )
    const inputArray: Array<RowInput> = [
      {
        name: 'level',
        value: 'Level',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      },
    ]
    if (damage) {
      console.log('damage', true)
      inputArray.push(
        {
          name: 'dice.diceCount',
          value: 'Dice Count',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        },
        {
          name: 'dice.diceValue',
          value: 'Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
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
        },
        {
          name: 'dice.secDiceValue',
          value: 'Secondary Dice Value',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
        }
      )
    }
    if (bonus) {
      inputArray.push({
        name: 'bonusDamage',
        value: 'Bonus Damage',
        errorMsg: 'Must contain only numbers',
        validation: 'num',
      })
    }
    if (duration) {
      inputArray.push(
        {
          name: 'duration.durationType',
          value: 'Duration',
          type: 'select',
          options: builders.spell.duration,
        },
        {
          name: 'duration.value',
          value: 'Duration Increment',
          errorMsg: 'Must contain only numbers',
          validation: 'num',
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
        },
        {
          name: 'range.unit',
          value: 'UoM',
          type: 'select',
          options: Object.values(builders.unit.imperial).flatMap(
            (item) => item
          ),
          optionalKey: 'short',
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
        },
        {
          name: 'shape.unit',
          value: 'UoM',
          type: 'select',
          options: Object.values(builders.unit.imperial).flatMap(
            (item) => item
          ),
          optionalKey: 'short',
        }
      )
    }

    const headerArray: Array<RowHeader> = inputArray.map((inputItem) => ({
      value: inputItem.value,
    }))

    setDamageTableColumns({ inputs: inputArray, headers: headerArray })
  }, [builders, state])

  console.log('tableColumns', damageTableColumns.inputs.length)
  console.log('tableColumnsData', damageTableColumns.inputs)

  return isLoading ? (
    <Spinner />
  ) : (
    <>
      <Grid
        cols={{ lg: 6, md: 4, base: 2 }}
        mediaSize={lg ? 'lg' : md ? 'md' : ''}
        className={sprinkles({ mb: 'size-3' })}
      >
        <Dropdown
          multiSelect={true}
          name='attribute'
          label={`${startCase(context.title)} Attributes`}
          value={state.attribute}
          options={builders[context.title].attribute}
          onChange={setState}
        />
        {state.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'canUpcast'
        ) && (
          <Dropdown
            name='upcast.upcastAttribute'
            label='Upcast Attribute'
            value={state.upcast?.upcastAttribute}
            options={builders.spell.upcastAttribute
              .filter((upcastItem: any) =>
                !state.attribute?.some(
                  (attributeItem: any) => attributeItem.name === 'doesDamage'
                )
                  ? upcastItem.name !== 'damage'
                  : upcastItem
              )
              .filter((upcastItem: any) =>
                !state.damage?.damageAttribute?.some(
                  (attributeItem: any) => attributeItem.name === 'secondaryDice'
                )
                  ? upcastItem.name !== 'secondaryDice'
                  : upcastItem
              )}
            multiSelect={true}
            onChange={setState}
          />
        )}
        {(context.title === 'spell' ||
          state.attribute?.some(
            (attributeItem: any) => attributeItem.name === 'isAction'
          )) && (
          <Dropdown
            name='action.actionType'
            label='Casting Time'
            value={state.action?.actionType}
            options={builders[context.title].action}
            required={true}
            onChange={setState}
          />
        )}
        {context.title === 'spell' && (
          <>
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
                    options={
                      Object.values(builders.unit.imperial).flatMap(
                        (item) => item
                      ) as Option[]
                    }
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
                    options={
                      Object.values(builders.unit.imperial).flatMap(
                        (item) => item
                      ) as Option[]
                    }
                    required={true}
                    optionalKey='short'
                    onChange={setState}
                  />
                </>
              )}
          </>
        )}
        {state.attribute?.some(
          (attributeItem: any) => attributeItem.name === 'secondaryAction'
        ) && (
          <>
            <Dropdown
              name='secondaryAction.actionType'
              label='Sec. Action'
              value={state.secondaryAction?.actionType}
              options={builders[context.title].action}
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
          (attributeItem: any) => attributeItem.name === 'requireSave'
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
          (attributeItem: any) => attributeItem.name === 'appliesCondition'
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
        {context.title === 'spell' && (
          <>
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
              (attributeItem: any) => attributeItem.name === 'targets'
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
          </>
        )}
      </Grid>
      {state.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'doesDamage'
      ) && (
        <>
          <Divider label={'Damage'} />
          <Grid
            cols={{ start: 0, end: 0 }}
            className={sprinkles({ alignItems: 'flex-end' })}
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
              (attributeItem: any) => attributeItem.name === 'secondaryDice'
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
              (attributeItem: any) => attributeItem.name === 'bonusDamage'
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
                {state.damage?.bonus?.bonusAttribute?.name === 'setValue' && (
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
        (attributeItem: any) => attributeItem.name === 'canUpcast'
      ) &&
      state.upcast?.upcastAttribute?.length > 0 &&
      !state.upcast?.upcastAttribute?.every(
        (attributeItem: any) => attributeItem.name === 'targets'
      ) ? (
        !state.upcast?.upcastStats ? (
          setState({
            type: 'added',
            payload: { target: { name: 'upcast.upcastStats' } },
          })
        ) : (
          <>
            <Collapse
              title='Upcast Table'
              startOpened={context.type === 'create' ? true : false}
            >
              <Table
                rows={{
                  inputs: damageTableColumns.inputs,
                  headers: damageTableColumns.headers,
                }}
                name='upcast.upcastStats'
                value={state.upcast?.upcastStats}
                onChange={setState}
                addRow={true}
                scrollable={true}
              />
            </Collapse>
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
  )
}

export default AttributeForm
