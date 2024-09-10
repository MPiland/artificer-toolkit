import { useEffect } from 'react'
import { DropdownOptionType } from '../../../utils/types'
import Row from '../../Row/Row'
import { sprinkles } from '../../../css/sprinkles.css'
import Dropdown from '../../Dropdown/Dropdown'
import { startCase } from 'lodash'
import { useGetSystemsQuery } from '../../../features/systems/systemsApi'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'
import Divider from '../../Divider/Divider'
import Table from '../../Table/Table'
import Spinner from '../../Spinner/Spinner'
import { useForm } from '../../../hooks/UseForm'
import Requirements from './Requirements'
import Damage from './Damage'
import Upcast from '../Spells/Upcast'
import LevelAttributes from '../Classes/LevelAttributes'
import Spellcasting from '../Classes/Spellcasting'
import Resource from '../Classes/Resource'
import LimitUse from './LimitUse'
import Multiclass from '../Classes/Multiclass'
import { useIsFetching } from '@tanstack/react-query'

const AttributeForm = () => {
  const isLoading = useIsFetching() > 0

  const { context, formState, setFormState } = useForm()

  const { data: builders } = useGetSystemsQuery()

  // Add/Remove Subtypes table
  useEffect(() => {
    if (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypes') && !formState.subtype) {
      setFormState({
        type: 'added',
        target: { name: 'subtype' },
      })
    }
    if (
      !formState.attribute?.some((attributeItem: any) => attributeItem.name === 'subtypes') &&
      formState.subtype != null
    ) {
      setFormState({
        type: 'removed',
        target: { name: 'subtype' },
      })
    }
  }, [formState, setFormState])

  return isLoading || !builders ? (
    <Spinner />
  ) : (
    <>
      <Row className={sprinkles({ mb: 'space-3' })}>
        {context.title && (
          <Dropdown
            multiSelect={true}
            name='attribute'
            label={`${startCase(context.title)} Attributes`}
            value={formState?.attribute}
            options={builders[context.title].attribute
              .filter((attributeItem: any) =>
                formState.category?.name === 'armor' || formState.category?.name === 'weapon'
                  ? attributeItem.name !== 'doesDamage'
                  : attributeItem.name !== 'maxBonus'
              )
              .filter(
                (attributeItem: any) =>
                  (formState.category?.name === 'base'
                    ? attributeItem
                    : attributeItem.name !== 'primaryAbility' && attributeItem.name !== 'secondaryAbility') &&
                  (formState.attribute?.some((attributeItem: any) => attributeItem.name === 'primaryAbility')
                    ? attributeItem
                    : attributeItem.name !== 'optionalAbility')
              )}
            onChange={setFormState}
          />
        )}
        {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'stackable') && (
          <Input
            validation={'num'}
            type='text'
            name='maxStack'
            errorMsg='Must contain only numbers'
            label='Max Stack Size'
            autoComplete='off'
            value={formState?.maxStack}
            onChange={setFormState}
          />
        )}
        {formState.attribute?.some((attributeItem: any) => attributeItem.name === 'isAction') ||
          (context.title === 'spells' && (
            <Dropdown
              name={'action.type'}
              label={context.title === 'spells' ? 'Casting Time' : 'Action Type'}
              value={formState?.action?.type}
              options={[].concat(builders.action.type, builders[context.title].action.type)}
              required={true}
              onChange={setFormState}
            />
          ))}
        {context.title === 'spells' && (
          <>
            {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'secondaryAction') && (
              <>
                <Dropdown
                  name='secondaryAction.type'
                  label='Sec. Action'
                  value={formState?.secondaryAction?.type}
                  options={[].concat(builders.action.type, builders[context.title].action.type)}
                  required={true}
                  onChange={setFormState}
                />
                <Input
                  validation={'num'}
                  name='secondaryAction.value'
                  label='Sec. Increment'
                  value={formState?.secondaryAction?.value}
                  required={true}
                  onChange={setFormState}
                />
              </>
            )}
            {formState?.action && formState.action?.type?.name !== 'special' && (
              <Input
                validation='num'
                name='action.value'
                label='Casting Increment'
                value={formState?.action?.value}
                required={true}
                onChange={setFormState}
              />
            )}
            <Dropdown
              name='duration.type'
              label='Duration'
              value={formState?.duration?.type}
              options={builders.spells.duration.type}
              required={true}
              onChange={setFormState}
            />
            {formState?.duration &&
              formState.duration?.type?.name !== 'instantaneous' &&
              formState.duration?.type?.name !== 'untilDispelled' &&
              formState.duration?.type?.name !== 'special' && (
                <Input
                  validation={'num'}
                  name='duration.value'
                  errorMsg='Must contain only numbers'
                  label='Duration Increment'
                  autoComplete='off'
                  required={true}
                  value={formState?.duration?.value}
                  onChange={setFormState}
                />
              )}
            <Dropdown
              name='range.type'
              label='Range'
              value={formState?.range?.type}
              options={builders.spells.range.type}
              required={true}
              onChange={setFormState}
            />
            {formState?.range?.type?.name !== 'touch' &&
              formState.range?.type?.name !== 'sight' &&
              formState.range?.type?.name !== 'unlimited' &&
              formState.range?.type && (
                <>
                  <Input
                    validation={'num'}
                    name='range.minRange'
                    errorMsg='Please enter a valid number greater than 0'
                    label='Min. Range'
                    autoComplete='off'
                    required={formState.range?.type?.name === 'distance' ? true : false}
                    value={formState?.range?.minRange}
                    onChange={setFormState}
                  />
                  <Input
                    validation={'num'}
                    name='range.maxRange'
                    errorMsg='Please enter a valid number greater than 0'
                    label='Max Range'
                    autoComplete='off'
                    required={formState.range?.type?.name === 'distance' ? true : false}
                    value={formState?.range?.maxRange}
                    onChange={setFormState}
                  />
                  <Dropdown
                    name='range.unit'
                    label='UoM'
                    value={formState?.range?.unit}
                    options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOptionType[]}
                    required={formState.range?.type?.name === 'distance' ? true : false}
                    onChange={setFormState}
                  />
                </>
              )}
            <Dropdown
              name='shape.type'
              label='Shape'
              options={builders.spells.shape.type}
              value={formState?.shape?.type}
              onChange={setFormState}
            />
            {formState?.shape?.type?.name &&
              formState.shape?.type?.name !== 'none' &&
              formState.shape?.type?.name !== 'weapon' && (
                <>
                  <Input
                    validation={'cur'}
                    name='shape.size'
                    errorMsg='Please enter a valid number (can inlude decimals)'
                    label='Shape Size'
                    autoComplete='off'
                    required={true}
                    value={formState?.shape?.size}
                    onChange={setFormState}
                  />
                  <Dropdown
                    name='shape.unit'
                    label='UoM'
                    value={formState?.shape?.unit}
                    options={Object.values(builders.unit.imperial).flatMap((item) => item) as DropdownOptionType[]}
                    required={true}
                    onChange={setFormState}
                  />
                </>
              )}
            {context.title === 'spells' && (
              <Input
                name='targets'
                value={formState?.targets}
                label='# of Targets'
                validation='num'
                errorMsg='Enter a valid number greater than 0'
                onChange={setFormState}
                placeholder='1'
              />
            )}
            {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'appliesCondition') && (
              <Dropdown
                name='condition.type'
                label='Condition'
                value={formState?.condition?.type}
                options={builders.condition.type}
                multiSelect={true}
                required={true}
                onChange={setFormState}
              />
            )}
          </>
        )}
        {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'requireSave') && (
          <>
            {context.title !== 'spells' && (
              <Dropdown
                name={`saveAbility.attribute`}
                multiSelect={true}
                label='Save Attribute'
                value={formState?.saveAbility?.attribute}
                options={builders.features.saveAbility.attribute}
                onChange={setFormState}
              />
            )}
            <Dropdown
              name={'saveAbility.type'}
              label='DC Ability'
              value={formState?.saveAbility?.type}
              options={builders.abilities.type}
              required={true}
              onChange={setFormState}
            />
            {context.title !== 'spells' && (
              <>
                {formState?.saveAbility?.attribute?.some(
                  (attributeItem: any) => attributeItem.name === 'addAbilityModifier'
                ) && (
                  <Dropdown
                    name={`saveAbility.abilityModifier.type`}
                    label='Modifier Ability'
                    value={formState?.saveAbility?.abilityModifier?.type}
                    options={builders.abilities.type}
                    required={true}
                    onChange={setFormState}
                  />
                )}
                <Input
                  validation='num'
                  name={`saveAbility.minValue`}
                  autoComplete='off'
                  label='Base Value'
                  required={true}
                  errorMsg='Must contain only numbers'
                  value={formState?.saveAbility?.minValue}
                  onChange={setFormState}
                />
              </>
            )}
          </>
        )}
      </Row>
      <Multiclass />
      <Resource />
      <Spellcasting />
      <LevelAttributes />
      {formState?.subtype?.length > 0 && (
        <>
          <Collapse>
            <Collapse.Header title={'Subtypes'} startOpened={context.type === 'new'} />
            <Collapse.Body>
              <Table
                name='subtype'
                rows={{
                  inputs: [
                    {
                      name: 'value',
                    },
                  ],
                  headers: [
                    {
                      value: 'Name',
                    },
                  ],
                }}
                value={formState?.subtype}
                addRow={true}
                onChange={setFormState}
              />
            </Collapse.Body>
          </Collapse>
        </>
      )}
      <Damage state={formState} setState={setFormState} />
      {formState?.category?.name === 'armor' ||
        (formState?.category?.name === 'shield' && (
          <>
            <Divider label={'Armor Stats'} />
            <Row className={sprinkles({ mb: 'space-3' })}>
              <Input
                validation={'num'}
                name='armorClass'
                errorMsg='Must contain only numbers'
                label='Armor Value'
                required={true}
                value={formState?.armorClass}
                onChange={setFormState}
              />
              {formState?.category?.name === 'armor' && (
                <Dropdown
                  name='primaryAbility.type'
                  label='Primary Ability'
                  value={formState?.primaryAbility.type}
                  options={builders.abilities.type}
                  onChange={setFormState}
                />
              )}
              {formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'maxBonus') && (
                <Input
                  validation='num'
                  name='maxBonus'
                  errorMsg='Must contain only numbers'
                  label='Max Bonus'
                  required={true}
                  value={formState?.maxBonus}
                  onChange={setFormState}
                />
              )}
            </Row>
          </>
        ))}
      <Upcast />
      <LimitUse state={formState} setState={setFormState} />
      <Requirements state={formState} setState={setFormState} />
    </>
  )
}

export default AttributeForm
