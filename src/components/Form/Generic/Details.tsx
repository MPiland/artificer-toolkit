import { DropdownOptionType } from '../../../utils/types'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import Row from '../../Row/Row'
import RichTextEditor from '../../RichTextEditor/RichTextEditor'
import { useGetBuildersQuery } from '../../../features/systems/systemsApi'
import { useGetClassesQuery } from '../../../features/classes/classesApi'
import { useGetRacesQuery } from '../../../features/races/racesApi'
import { startCase } from 'lodash'
import Button from '../../Button/Button'
import Accordion from '../../Accordion/Accordion'
import { sprinkles } from '../../../css/sprinkles.css'
import Spinner from '../../Spinner/Spinner'
import { useForm } from '../../../hooks/UseForm'
import Divider from '../../Divider/Divider'
import { useIsFetching } from '@tanstack/react-query'

const Details = () => {
  const { context, formState, setFormState } = useForm()

  const { data: builders } = useGetBuildersQuery()
  const { data: classes } = useGetClassesQuery() as { data: any[]; isPending: boolean }
  const { data: races } = useGetRacesQuery() as { data: any[]; isPending: boolean }

  const isLoading = useIsFetching() > 0

  return isLoading || !builders || !formState ? (
    <Spinner />
  ) : (
    <>
      <Row cols={{ lg: 6, md: 4, base: 2 }} className={sprinkles({ mb: 'space-3' })}>
        <Input
          name='value'
          label='Name'
          autoComplete='off'
          value={formState?.value}
          required={true}
          onChange={setFormState}
          autoFocus={true}
          errorMsg='Name must not be blank'
        />
        {context.title === 'characters' && (
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
        {context.title && (context.title === 'races' || context.title === 'classes' || context.title === 'items') && (
          <>
            <Dropdown
              name='category'
              label={`${startCase(context.title)} Category`}
              value={formState?.category}
              options={builders[context.title]?.category}
              required={true}
              onChange={setFormState}
            />
            {context.title === 'races' && formState?.category?.name === 'base' && (
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
            {context.title === 'items' && (
              <>
                <Dropdown
                  name='properties.type'
                  multiSelect={true}
                  label='Properties'
                  value={formState?.properties?.type}
                  options={
                    builders.items.category.find((category: any) => category._id === formState.category?._id)
                      ?.properties.type
                  }
                  onChange={setFormState}
                />
                <Dropdown
                  name='rarity'
                  label='Rarity'
                  value={formState?.rarity}
                  options={builders.items.rarity}
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
                  name='cost.currency'
                  label='Currency'
                  value={formState?.cost?.currency}
                  options={builders.currency.type}
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
                  options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOptionType[]}
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
                  classes
                    ?.filter((uClass: any) => uClass.category?.name !== 'subclass')
                    .map((uClass: any) => ({
                      name: uClass.name,
                      _id: uClass._id,
                      value: uClass.value,
                    })) as DropdownOptionType[]
                }
                required={true}
                onChange={setFormState}
              />
            ) : (
              formState.category?.name !== 'subclass' &&
              context.title === 'classes' && (
                <>
                  <Input
                    name='hitpoint.diceCount'
                    autoComplete='off'
                    label='HP Dice Count'
                    required={true}
                    value={formState?.hitpoint?.diceCount}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={setFormState}
                  />
                  <Dropdown
                    name='hitpoint.diceValue'
                    label='HP Dice Value'
                    value={formState?.hitpoint?.diceValue}
                    options={builders.system.dice}
                    required={true}
                    onChange={setFormState}
                  />
                  <Dropdown
                    name='hitpoint.ability'
                    label='HP Modifier Ability'
                    value={formState?.hitpoint?.ability}
                    options={builders.abilities.type}
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
                options={races?.filter((raceItem: any) => raceItem.category.name === 'base') as DropdownOptionType[]}
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
                  options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOptionType[]}
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
            {(formState.properties?.type?.some((propertyItem: any) => propertyItem.name === 'container') ||
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
                  options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOptionType[]}
                  onChange={setFormState}
                />
              </>
            )}
            {formState?.properties?.type?.some(
              (property: any) => property.name === 'thrown' || property.name === 'ranged'
            ) && (
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
        {context.title === 'items' && (
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
        {context.title === 'spells' && (
          <>
            <Input
              validation={'num'}
              name='level'
              errorMsg='Must contain only numbers'
              label='Level'
              required={true}
              value={formState?.level}
              onChange={setFormState}
            />
            <Dropdown
              name='school'
              label='School'
              value={formState?.school}
              options={builders.spells.school}
              required={true}
              onChange={setFormState}
            />
            <Dropdown
              name='requirements'
              multiSelect={true}
              label='Requirements'
              value={formState?.requirements}
              options={builders.spells.requirements}
              required={true}
              onChange={setFormState}
            />
            <Dropdown
              name='classes'
              multiSelect={true}
              label='Class(es)'
              value={formState?.classes}
              options={
                classes.map((uClass: any) => ({
                  name: uClass.name,
                  _id: uClass._id,
                  value: uClass.value,
                })) as DropdownOptionType[]
              }
              required={true}
              onChange={setFormState}
            />
            {formState?.requirements?.some((requirement: any) => requirement.name === 'material') && (
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
      </Row>
      {context.title === 'classes' && formState?.category?.name === 'base' && (
        <>
          <Divider label='Starting Gold' />
          <Row className={sprinkles({ mb: 'space-3' })}>
            <Input
              name='startingGold.diceCount'
              label='Dice Count'
              required={true}
              validation='num'
              errorMsg='Please enter a whole number'
              value={formState?.startingGold?.diceCount}
              onChange={setFormState}
            />
            <Dropdown
              name='startingGold.diceValue'
              label='Dice Value'
              value={formState?.startingGold?.diceValue}
              options={builders.system.dice}
              required={true}
              onChange={setFormState}
            />
            <Input
              name='startingGold.multiplier'
              label='Multiplier'
              required={true}
              validation='num'
              errorMsg='Please enter a whole number'
              value={formState?.startingGold?.multiplier ?? 1}
              onChange={setFormState}
            />
            <Dropdown
              name='startingGold.currency'
              label='Currency'
              value={formState?.startingGold?.currency}
              options={builders.currency.type}
              required={true}
              onChange={setFormState}
            />
          </Row>
        </>
      )}
      {context.title === 'items' && (
        <div>
          <RichTextEditor
            name={'quote'}
            className={sprinkles({ mb: 'space-3' })}
            value={formState?.quote}
            label={'Quote'}
            onChange={setFormState}
          />
        </div>
      )}
      {context.title !== 'characters' && (
        <RichTextEditor
          name='desc'
          className={sprinkles({ mb: 'space-3' })}
          value={formState?.desc}
          label='Description'
          onChange={setFormState}
        />
      )}
      {(context.title === 'races' || context.title === 'classes' || context.title === 'backgrounds') && (
        <Button
          type='button'
          className={sprinkles({ mb: 'space-3' })}
          color='default'
          onClick={() => {
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
              <Accordion.Wrapper key={detailIndex} itemId={String(detailIndex)}>
                <Accordion.Header
                  handleRemove={() =>
                    setFormState({
                      type: 'removed',
                      target: { name: `detail.${detailIndex}` },
                    })
                  }
                >
                  {detailItem.value != null && detailItem.value !== '' ? detailItem.value : `Detail ${detailIndex + 1}`}
                </Accordion.Header>
                <Accordion.Content>
                  <Row className={sprinkles({ mb: 'space-3' })}>
                    <Input
                      name={`detail.${detailIndex}.value`}
                      autoComplete='off'
                      label='Detail Name'
                      value={detailItem.value}
                      onChange={setFormState}
                    />
                  </Row>
                  <RichTextEditor
                    name={`detail.${detailIndex}.desc`}
                    value={detailItem.desc}
                    label={'Section Description'}
                    onChange={setFormState}
                  />
                </Accordion.Content>
              </Accordion.Wrapper>
            )
          })}
        </Accordion>
      )}
    </>
  )
}

export default Details
