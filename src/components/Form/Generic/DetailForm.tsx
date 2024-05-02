import { useState, useEffect, useContext } from 'react'
import { DropdownOption } from '../../../utils/types'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Grid from '../../Grid/Grid'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { useGetBuildersQuery } from '../../../features/builder/builderApiSlice'
import { selectAllClasses, useGetClassesQuery } from '../../../features/class/classApiSlice'
import { selectAllRaces, useGetRacesQuery } from '../../../features/race/raceApiSlice'
import { get, set, startCase } from 'lodash'
import Button from '../../Button/Button'
import Accordion from '../../Accordion/Accordion'
import { sprinkles } from '../../../css/sprinkles.css'
import { form_content } from '../Form.css'
import ScrollArea from '../../ScrollArea/ScrollArea'
import useIsLoading from '../../../hooks/useIsLoading'
import Spinner from '../../Spinner/Spinner'
import { useLocation } from 'react-router-dom'
import { FormStepsContext } from '../FormStepsContext'

const DetailFormTest = () => {
  const location = useLocation()
  const isLoading = useIsLoading()

  const { context, formState, setFormState, setOldFormState } = useContext(FormStepsContext)

  const [activeIndex, setActiveIndex] = useState<number | null>(context.type !== 'new' ? null : 0)

  const { data: builders } = useGetBuildersQuery(undefined)

  const { classes } = useGetClassesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      classes: data && selectAllClasses(data),
    }),
  })

  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      races: data && selectAllRaces(data),
    }),
  })

  const defaultCategory = location.state?.defaultCategory

  // Set character defaults
  useEffect(() => {
    if (builders && context?.title === 'character') {
      const formClone = JSON.parse(JSON.stringify(formState))
      if (!formClone.ability || !(formClone.ability.length > 0)) {
        const abilityArray: any[] = []
        builders.ability.type
          .filter((ability: any) => ability.name !== 'spellAbility')
          .forEach((ability: any) => abilityArray.push({ name: ability.name, value: ability.value, _id: ability._id }))

        set(formClone, 'ability', abilityArray)

        setFormState({
          type: 'reset',
          target: { value: formClone },
        })
      }
      if (!formClone.skill || !(formClone.skill.length > 0)) {
        const formClone = JSON.parse(JSON.stringify(formState))
        const skillArray: any[] = []
        if (formClone.skill) {
          builders.skill.type.forEach((skill: any) =>
            skillArray.push({
              name: skill.name,
              value: skill.value,
              _id: skill._id,
              ability: skill.ability,
            })
          )
        }
        set(formClone, 'skill', skillArray)

        setFormState({
          type: 'reset',
          target: { value: formClone },
        })
      }
    }
  }, [builders, context, formState, setFormState])

  // Set base category dropdown value
  useEffect(() => {
    if (context.title === 'class' && !formState.category && defaultCategory != null && formState) {
      const formClone = JSON.parse(JSON.stringify(formState))
      const category = builders?.class.category.find((category: any) => category.name === defaultCategory)
      set(formClone, 'category', category)
      setFormState({
        target: { name: 'category', value: get(formClone, 'category') },
      })
      setOldFormState(formClone)
    }
    if (context.title === 'race' && !formState.category && defaultCategory != null && formState) {
      const formClone = JSON.parse(JSON.stringify(formState))
      const category = {
        ...builders?.race.category.find((categoryItem: any) => categoryItem.name === defaultCategory),
      }
      set(formClone, 'category', category)
      setFormState({
        target: { name: 'category', value: get(formClone, 'category') },
      })
      setOldFormState(formClone)
    }
  }, [
    builders?.class.category,
    builders?.race.category,
    context,
    formState.category?.name,
    formState.category?.value,
    setFormState,
    defaultCategory,
    formState,
    setOldFormState,
  ])

  const toggle = (index: number) => {
    if (activeIndex === index) {
      return setActiveIndex(null)
    }
    setActiveIndex(index)
  }

  return isLoading || !builders || !formState ? (
    <Spinner />
  ) : (
    <ScrollArea scrollDirection='vertical' className={form_content}>
      <Grid cols={{ lg: 6, md: 4, base: 2 }} className={sprinkles({ mb: 'size-3' })}>
        <Input
          name='value'
          label={`${startCase(context.title)} Name`}
          autoComplete='off'
          value={formState?.value}
          required={true}
          onChange={setFormState}
          autoFocus={true}
          errorMsg='Name must not be blank'
        />
        {context.title === 'character' && (
          <>
            <Dropdown
              name='advancement'
              label='Advancement Type'
              value={formState?.advancement}
              options={builders[context.title]?.advancement}
              required={true}
              onChange={setFormState}
            />
            <Dropdown
              name='hitpoint'
              label='Hit Point Type'
              value={formState?.hitpoint}
              options={builders[context.title]?.hitpoint}
              required={true}
              onChange={setFormState}
            />
          </>
        )}
        {context.title && (context.title === 'race' || context.title === 'class' || context.title === 'item') && (
          <>
            <Dropdown
              name='category'
              label={`${startCase(context.title)} Category`}
              value={formState?.category}
              options={builders[context.title]?.category}
              required={true}
              onChange={setFormState}
            />
            {context.title === 'race' && formState?.category?.name === 'base' && (
              <Dropdown
                name='playable'
                label='Playable'
                value={formState?.playable}
                options={[
                  {
                    name: 'true',
                    value: 'Yes',
                    _id: null,
                  },
                  {
                    name: 'false',
                    value: 'No',
                    _id: null,
                  },
                ]}
                required={true}
                onChange={setFormState}
              />
            )}
            {context.title === 'item' && (
              <>
                <Dropdown
                  name='property.type'
                  multiSelect={true}
                  label='Properties'
                  value={formState?.property?.type}
                  options={
                    builders.item.category.find((category: any) => category._id === formState.category?._id)?.property
                  }
                  onChange={setFormState}
                />
                <Dropdown
                  name='rarity'
                  label='Rarity'
                  value={formState?.rarity}
                  options={builders.item.rarity}
                  required={true}
                  onChange={setFormState}
                />
                <Input
                  validation={'cur'}
                  name='cost.amount'
                  autoComplete='off'
                  label='Cost'
                  required={true}
                  errorMsg='Must contain only decimal amounts'
                  value={formState?.cost?.amount}
                  onChange={setFormState}
                />
                <Dropdown
                  name='cost.currency.type'
                  label='Currency'
                  value={formState?.cost?.currency?.type}
                  options={builders.currency.type}
                  optionalKey='short'
                  required={true}
                  onChange={setFormState}
                />
                <Input
                  validation={'cur'}
                  name='weight.amount'
                  errorMsg='Must contain only numbers'
                  label='Item Weight'
                  autoComplete='off'
                  value={formState?.weight?.amount}
                  onChange={setFormState}
                />
                <Dropdown
                  name='weight.unit'
                  label='UoM'
                  value={formState?.weight?.unit}
                  options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOption[]}
                  optionalKey='short'
                  onChange={setFormState}
                />
              </>
            )}
          </>
        )}
        {formState?.category?.name && (
          <>
            {formState?.category?.name === 'subclass' ? (
              <Dropdown
                name='parentClass'
                label='Parent Class'
                value={formState?.parentClass}
                options={
                  classes?.filter(
                    (classItem: any) => classItem.category?.name !== 'subclass'
                  ) as unknown as DropdownOption[]
                }
                required={true}
                onChange={setFormState}
              />
            ) : (
              formState.category?.name !== 'subclass' &&
              context.title === 'class' && (
                <>
                  <Input
                    name='hitPoint.diceCount'
                    autoComplete='off'
                    label='HP Dice Count'
                    required={true}
                    value={formState?.hitPoint?.diceCount}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setFormState}
                  />
                  <Input
                    name='hitPoint.diceValue'
                    autoComplete='off'
                    label='HP Dice Value'
                    required={true}
                    value={formState?.hitPoint?.diceValue}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setFormState}
                  />
                  <Dropdown
                    name='hitPoint.ability.type'
                    label='HP Modifier Ability'
                    value={formState?.hitPoint?.ability?.type}
                    options={builders.ability.type}
                    required={true}
                    onChange={setFormState}
                  />
                </>
              )
            )}
            {(formState.category?.name === 'subrace' || formState.category?.name === 'variant') && (
              <Dropdown
                multiSelect={true}
                name='lineage'
                label='Race Lineage'
                value={formState?.lineage}
                options={
                  races?.filter((raceItem: any) => raceItem.category.name === 'base') as unknown as DropdownOption[]
                }
                required={true}
                onChange={setFormState}
              />
            )}
            {(formState.category?.name === 'waterVehicle' || formState.category?.name === 'mount') && (
              <>
                <Input
                  validation={'cur'}
                  name='speed.amount'
                  errorMsg='Must contain only numbers'
                  label='Item Speed'
                  autoComplete='off'
                  required={true}
                  value={formState?.speed?.amount}
                  onChange={setFormState}
                />
                <Dropdown
                  name='speed.unit'
                  label='UoM'
                  value={formState?.speed?.unit}
                  options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOption[]}
                  optionalKey='short'
                  onChange={setFormState}
                />
              </>
            )}
            {(formState.category?.name === 'weapon' || formState.category?.name === 'armor') && (
              <Input
                validation={'num'}
                name='itemRank'
                errorMsg='Must contain only numbers'
                label='Item Rank'
                autoComplete='off'
                value={formState?.itemRank}
                onChange={setFormState}
              />
            )}
            {(formState.property?.some((propertyItem: any) => propertyItem.name === 'container') ||
              formState.category?.name === 'mount') && (
              <>
                <Input
                  validation={'cur'}
                  name='capacity.amount'
                  errorMsg='Must contain only numbers'
                  label='Capacity Amount'
                  autoComplete='off'
                  value={formState?.capacity?.amount}
                  onChange={setFormState}
                />
                <Dropdown
                  name='capacity.unit'
                  label='UoM'
                  value={formState?.capacity?.unit}
                  options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOption[]}
                  optionalKey='short'
                  onChange={setFormState}
                />
              </>
            )}
            {formState?.property?.some((property: any) => property.name === 'thrown' || property.name === 'ranged') && (
              <>
                <Input
                  validation='num'
                  name='range.minRange'
                  errorMsg='Must contain only numbers'
                  label='Min Range'
                  value={formState?.range?.minRange}
                  required={true}
                  onChange={setFormState}
                />
                <Input
                  validation='num'
                  name='range.maxRange'
                  errorMsg='Must contain only numbers'
                  label='Max Range'
                  value={formState?.range?.maxRange}
                  required={true}
                  onChange={setFormState}
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
            value={formState?.quantity}
            onChange={setFormState}
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
              value={formState?.level}
              onChange={setFormState}
            />
            <Dropdown
              name='school'
              label='Spell School'
              value={formState?.school}
              options={builders.spell.school}
              required={true}
              onChange={setFormState}
            />
            <Dropdown
              name='requirement'
              multiSelect={true}
              label='Requirements'
              value={formState?.requirement}
              options={builders.spell.requirement}
              required={true}
              onChange={setFormState}
            />
            <Dropdown
              name='classes'
              multiSelect={true}
              label='Classes'
              value={formState?.classes}
              options={(classes as unknown as DropdownOption[])?.filter((uClass) => uClass.category.name === 'base')}
              required={true}
              onChange={setFormState}
            />
            {formState?.requirement?.some((requirementItem: any) => requirementItem.name === 'material') && (
              <Input
                name='materialDesc'
                label='Material Desc.'
                required={true}
                value={formState?.materialDesc}
                onChange={setFormState}
              />
            )}
          </>
        )}
      </Grid>
      {context.title === 'item' && (
        <div>
          <RichTextEditor
            name={'quote'}
            className={sprinkles({ mb: 'size-3' })}
            value={formState?.quote}
            label={'Quote'}
            onChange={setFormState}
          />
        </div>
      )}
      {context.title !== 'character' && (
        <RichTextEditor
          name='desc'
          className={sprinkles({ mb: 'size-3' })}
          value={formState?.desc}
          label={`${startCase(context.title)} Description`}
          onChange={setFormState}
        />
      )}
      {(context.title === 'race' || context.title === 'class' || context.title === 'background') && (
        <Button
          type='button'
          className={sprinkles({ mb: 'size-3' })}
          variant='default'
          onClick={() => {
            if (formState?.detail?.length > 0) {
              setActiveIndex(formState?.detail?.length)
            } else {
              setActiveIndex(0)
            }
            setFormState({
              type: 'added',
              target: { name: 'detail' },
            })
          }}
        >
          Add Detail
        </Button>
      )}
      {formState?.detail && (
        <Accordion dataArray={formState.detail} setState={setFormState} name='detail'>
          {formState?.detail.map((detailItem: any, detailIndex: number) => {
            return (
              <Accordion.Container key={detailIndex} itemId={String(detailIndex)}>
                <Accordion.Header
                  handleClick={() => toggle(detailIndex)}
                  handleRemove={() =>
                    setFormState({
                      type: 'removed',
                      target: { name: `detail.${detailIndex}` },
                    })
                  }
                  active={activeIndex === detailIndex}
                >
                  {detailItem.value != null && detailItem.value !== '' ? detailItem.value : `Detail ${detailIndex + 1}`}
                </Accordion.Header>
                <Accordion.Content active={activeIndex === detailIndex}>
                  <Grid className={sprinkles({ mb: 'size-3' })}>
                    <Input
                      name={`detail.${detailIndex}.value`}
                      autoComplete='off'
                      label='Detail Name'
                      value={detailItem.value}
                      onChange={setFormState}
                    />
                  </Grid>
                  <RichTextEditor
                    name={`detail.${detailIndex}.desc`}
                    value={detailItem.desc}
                    label={'Section Description'}
                    onChange={setFormState}
                  />
                </Accordion.Content>
              </Accordion.Container>
            )
          })}
        </Accordion>
      )}
    </ScrollArea>
  )
}

export default DetailFormTest
