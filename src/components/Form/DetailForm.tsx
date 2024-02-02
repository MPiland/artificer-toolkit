import { FC, useEffect, useState } from 'react'
import { Action, Option } from '../../utils/types'
import Dropdown from '../Dropdown/Dropdown'
import Input from '../Input/Input'
import Grid from '../Grid/Grid'
import TextEditor from '../RichTextEditor/TextEditor'
import { useGetBuildersQuery } from '../../features/builders/buildersApiSlice'
import {
  selectAllClasses,
  useGetClassesQuery,
} from '../../features/classes/classesApiSlice'
import {
  selectAllRaces,
  useGetRacesQuery,
} from '../../features/races/racesApiSlice'
import { startCase } from 'lodash'
import useMediaQuery from '../../hooks/useMediaQuery'
import Button from '../Button/Button'
import Accordion from '../Accordion/Accordion'
import Spinner from '../Spinner/Spinner'
import { sprinkles } from '../../css/sprinkles.css'

interface DetailFormProps {
  state: any
  setState: (arg: Action) => void
  context: {
    type: string
    title: string
  }
}

const DetailForm: FC<DetailFormProps> = ({ state, setState, context }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const lg = useMediaQuery('(min-width: 1024px)')
  const md = useMediaQuery('(min-width: 568px) and (max-width: 1023px)')

  const toggle = (index: number) => {
    console.log('toggleIndex', index)
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  const { data: builders, isFetching: isBuildersFetching } =
    useGetBuildersQuery(undefined)

  const { classes, isFetching: isClassesFetching } = useGetClassesQuery(
    undefined,
    {
      selectFromResult: ({ data, isFetching }) => ({
        classes: data && selectAllClasses(data),
        isFetching,
      }),
    }
  )

  const { races, isFetching: isRacesFetching } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data, isFetching }) => ({
      races: data && selectAllRaces(data),
      isFetching,
    }),
  })

  useEffect(() => {
    if (isBuildersFetching || isRacesFetching || isClassesFetching) {
      setIsLoading(true)
    } else {
      setIsLoading(false)
    }
  }, [isBuildersFetching, isRacesFetching, isClassesFetching])

  return isLoading ? (
    <Spinner />
  ) : (
    <>
      <Grid
        cols={{ lg: 6, md: 4, base: 2 }}
        mediaSize={lg ? 'lg' : md ? 'md' : ''}
        className={sprinkles({ mb: 'size-3' })}
      >
        <Input
          name='value'
          label={`${startCase(context.title)} Name`}
          autoComplete='off'
          value={state.value}
          required={true}
          onChange={setState}
          autoFocus={true}
        />
        {context.title !== 'spell' && context.title !== 'feat' && (
          <>
            <Dropdown
              name='category'
              label={`${startCase(context.title)} Category`}
              value={state?.category}
              options={builders[context.title]?.category}
              required={true}
              onChange={setState}
            />
            {context.title === 'item' && (
              <>
                <Dropdown
                  name='property'
                  multiSelect={true}
                  label='Properties'
                  value={state.property}
                  options={
                    builders.item.category.find(
                      (category: any) => category._id === state.category?.id
                    )?.property
                  }
                  onChange={setState}
                />
                <Dropdown
                  name='rarity'
                  label='Rarity'
                  value={state.rarity}
                  options={builders.item.rarity}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation={'cur'}
                  name='cost.amount'
                  autoComplete='off'
                  label='Cost'
                  required={true}
                  errorMsg='Must contain only decimal amounts'
                  value={state.cost?.amount}
                  onChange={setState}
                />
                <Dropdown
                  name='cost.currency'
                  label='Currency'
                  value={state.cost?.currency}
                  options={builders.currency}
                  optionalKey='short'
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation={'cur'}
                  name='weight.amount'
                  errorMsg='Must contain only numbers'
                  label='Item Weight'
                  autoComplete='off'
                  value={state.weight?.amount}
                  onChange={setState}
                />
                <Dropdown
                  name='weight.unit'
                  label='UoM'
                  value={state.weight?.unit}
                  options={
                    Object.values(builders.unit.imperial).flatMap(
                      (item) => item
                    ) as Option[]
                  }
                  optionalKey='short'
                  onChange={setState}
                />
              </>
            )}
          </>
        )}
        {state.category?.name && (
          <>
            {state.category?.name === 'subclass' ? (
              <Dropdown
                name='parentClass'
                label='Parent Class'
                value={state.parentClass}
                options={
                  classes?.filter(
                    (classItem: any) => classItem.category.name !== 'subclass'
                  ) as unknown as Option[]
                }
                required={true}
                onChange={setState}
              />
            ) : (
              state.category?.name !== 'subclass' &&
              context.title === 'class' && (
                <>
                  <Input
                    name='hitPoint.diceCount'
                    autoComplete='off'
                    label='HP Dice Count'
                    required={true}
                    value={state.hitPoint?.diceCount}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setState}
                  />
                  <Input
                    name='hitPoint.diceValue'
                    autoComplete='off'
                    label='HP Dice Value'
                    required={true}
                    value={state.hitPoint?.diceValue}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setState}
                  />
                </>
              )
            )}
            {(state.category?.name === 'subrace' ||
              state.category?.name === 'variant') && (
              <Dropdown
                multiSelect={state.category.name === 'variant' && true}
                name='lineage'
                label='Race Lineage'
                value={state?.lineage}
                options={races as unknown as Option[]}
                required={true}
                onChange={setState}
              />
            )}
            {(state.category?.name === 'waterVehicle' ||
              state.category?.name === 'mount') && (
              <>
                <Input
                  validation={'cur'}
                  name='speed.amount'
                  errorMsg='Must contain only numbers'
                  label='Item Speed'
                  autoComplete='off'
                  required={true}
                  value={state.speed?.amount}
                  onChange={setState}
                />
                <Dropdown
                  name='speed.unit'
                  label='UoM'
                  value={state.speed?.unit}
                  options={
                    Object.values(builders.unit.imperial).flatMap(
                      (item) => item
                    ) as Option[]
                  }
                  optionalKey='short'
                  onChange={setState}
                />
              </>
            )}
            {(state.category?.name === 'weapon' ||
              state.category?.name === 'armor') && (
              <Input
                validation={'num'}
                name='itemRank'
                errorMsg='Must contain only numbers'
                label='Item Rank'
                autoComplete='off'
                value={state.itemRank}
                onChange={setState}
              />
            )}
            {(state.property?.some(
              (propertyItem: any) => propertyItem.name === 'container'
            ) ||
              state.category?.name === 'mount') && (
              <>
                <Input
                  validation={'cur'}
                  name='capacity.amount'
                  errorMsg='Must contain only numbers'
                  label='Capacity Amount'
                  autoComplete='off'
                  value={state.capacity?.amount}
                  onChange={setState}
                />
                <Dropdown
                  name='capacity.unit'
                  label='UoM'
                  value={state.capacity?.unit}
                  options={
                    Object.values(builders.unit.imperial).flatMap(
                      (item) => item
                    ) as Option[]
                  }
                  optionalKey='short'
                  onChange={setState}
                />
              </>
            )}
            {state.property?.some(
              (property: any) =>
                property.name === 'thrown' || property.name === 'ranged'
            ) && (
              <>
                <Input
                  validation='num'
                  name='minRange'
                  errorMsg='Must contain only numbers'
                  label='Min Range'
                  value={state?.minRange}
                  required={true}
                  onChange={setState}
                />
                <Input
                  validation='num'
                  name='maxRange'
                  errorMsg='Must contain only numbers'
                  label='Max Range'
                  value={state?.maxRange}
                  required={true}
                  onChange={setState}
                />
              </>
            )}
          </>
        )}
        {context.title === 'item' && (
          <Input
            validation={'num'}
            name='quantity'
            errorMsg='Must contain only numbers'
            label='Quantity'
            autoComplete='off'
            value={state.quantity}
            onChange={setState}
          />
        )}
        {context.title === 'spell' && (
          <>
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
          </>
        )}
        {context.title === 'spell' && (
          <>
            <Dropdown
              name='classes'
              multiSelect={true}
              label='Classes'
              value={state.classes}
              options={
                classes?.filter(
                  (classItem: any) => classItem.category.name !== 'subclass'
                ) as unknown as Option[]
              }
              required={true}
              onChange={setState}
            />
            {state.requirement?.some(
              (requirementItem: any) => requirementItem.name === 'material'
            ) && (
              <Input
                name='materialDesc'
                label='Material Desc.'
                required={true}
                value={state.materialDesc}
                onChange={setState}
              />
            )}
          </>
        )}
      </Grid>
      {(context.title === 'race' ||
        context.title === 'class' ||
        context.title === 'item') && (
        <div>
          <TextEditor
            name={'quote'}
            className={sprinkles({ mb: 'size-3' })}
            value={state?.quote}
            label={'Quote'}
            onChange={setState}
          />
        </div>
      )}
      <TextEditor
        name='desc'
        className={sprinkles({ mb: 'size-3' })}
        value={state.desc}
        label={`${startCase(context.title)} Description`}
        onChange={setState}
      />
      {(context.title === 'race' || context.title === 'class') && (
        <Button
          type='button'
          className={sprinkles({ mb: 'size-3' })}
          variant='default'
          onClick={() =>
            setState({
              type: 'added',
              payload: { target: { name: 'details' } },
            })
          }
        >
          Add Detail
        </Button>
      )}
      {state?.details && (
        <Accordion>
          {state.details.map((detailItem: any, detailIndex: number) => {
            if (detailIndex === 0) {
              console.log('active', activeIndex === detailIndex)
            }
            return (
              <Accordion.Container key={detailIndex}>
                <Accordion.Header
                  onClick={() => toggle(detailIndex)}
                  active={activeIndex === detailIndex}
                >
                  {detailItem.value ?? `Detail ${detailIndex + 1}`}
                </Accordion.Header>
                <Accordion.Content active={activeIndex === detailIndex}>
                  <Grid
                    mediaSize={lg ? 'lg' : md ? 'md' : ''}
                    className={sprinkles({ mb: 'size-3' })}
                  >
                    <Input
                      name={`details.${detailIndex}.value`}
                      autoComplete='off'
                      label='Detail Name'
                      value={detailItem.value}
                      onChange={setState}
                    />
                  </Grid>
                  <TextEditor
                    name={`details.${detailIndex}.desc`}
                    value={detailItem.desc}
                    label={'Section Description'}
                    onChange={setState}
                  />
                </Accordion.Content>
              </Accordion.Container>
            )
          })}
        </Accordion>
      )}
    </>
  )
}

export default DetailForm
