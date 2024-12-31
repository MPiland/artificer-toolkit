import { useEffect } from 'react'
import Row from '../../Row/Row'
import { sprinkles } from '../../../css/sprinkles.css'
import Dropdown from '../../Dropdown/Dropdown'
import { startCase } from 'lodash'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'
import Divider from '../../Divider/Divider'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Requirements from './Requirements'
import Damage from './Damage'
import Upcast from '../Spells/Upcast'
import LevelAttributes from '../Classes/LevelAttributes'
import Spellcasting from '../Classes/Spellcasting'
import Resource from '../Classes/Resource'
import LimitUse from './LimitUse'
import Multiclass from '../Classes/Multiclass'
import {
  Actions,
  Attributes,
  Durations,
  EquipmentCategories,
  EquipmentProperties,
  Prerequisites,
  Ranges,
  Shapes,
} from '../../../types/enums'
import {
  AllEnum,
  ClassesEnum,
  Equipment,
  EquipmentEnum,
  Feat,
  FeatureEnum,
  Spell,
} from '../../../../amplify/API'
import { UpdateState } from '../../../types/form'

const AttributeForm = () => {
  const { context, formData, updateFormData } = use(FormContext)

  const { data: system } = useGetSystemQuery()

  useEffect(() => {
    if (
      ((formData.__typename === 'Equipment' &&
        (formData?.category !== EquipmentCategories.weapon ||
          formData?.properties?.some((property: any) => property === EquipmentProperties.special))) ||
        formData.__typename === 'Spell') &&
      !formData?.attributes?.some((attribute) => attribute === Attributes.doesDamage) &&
      formData?.damage
    ) {
      updateFormData<typeof formData>({
        type: 'remove',
        path: 'damage',
      })
    }
  }, [formData, updateFormData])

  useEffect(() => {
    if (
      formData.__typename === 'Spell' &&
      !formData.attributes?.some((attribute) => attribute === Attributes.canUpcast) &&
      formData.upcast
    ) {
      updateFormData<typeof formData>({
        type: 'remove',
        path: 'upcast',
      })
    }
  })

  useEffect(() => {
    if (formData.__typename === 'Class') {
      if (
        !formData.attributes?.some((attribute) => attribute === Attributes.spellcaster) &&
        formData.spellcasting != null
      ) {
        updateFormData<typeof formData>({
          type: 'remove',
          path: 'spellcasting',
        })
        formData.levelAttributes?.map((_, index) => {
          updateFormData<typeof formData>({
            type: 'remove',
            path: `levelAttributes.${index}.spellSlots`,
          })
        })
      }
      if (
        formData.levelAttributes &&
        !formData.attributes?.some((attribute) => attribute === Attributes.spellcaster) &&
        (!formData.attributes?.some((attribute) => attribute === Attributes.hasResourcePoints) ||
          formData.resource?.method !== Attributes.setPerLevel)
      ) {
        updateFormData<typeof formData>({
          type: 'remove',
          path: 'levelAttributes',
        })
      }

      if (!formData.attributes?.some((attribute) => attribute === Attributes.hasResourcePoints) && formData.resource) {
        updateFormData<typeof formData>({ type: 'remove', path: 'resource' })
      }
    }
  }, [formData, updateFormData])

  useEffect(() => {
    if (formData.__typename === 'Feat') {
      if (
        !formData.prerequisites?.options?.some((option) => option === Prerequisites.equipmentProficiency) &&
        formData.prerequisites?.equipmentProficiencies?.length > 0
      ) {
        updateFormData<typeof formData>({
          type: 'remove',
          path: 'prerequisites.equipmentProficiencies',
        })
      }

      if (
        !formData.prerequisites?.options?.some((option) => option === Prerequisites.equipped) &&
        formData.prerequisites?.equipped?.length > 0
      ) {
        updateFormData<typeof formData>({
          type: 'remove',
          path: 'prerequisites.equipped',
        })
      }

      if (
        !formData.prerequisites?.options?.some((option) => option === Prerequisites.notEquipped) &&
        formData.prerequisites?.notEquipped?.length > 0
      ) {
        updateFormData<typeof formData>({
          type: 'remove',
          path: 'prerequisites.notEquipped',
        })
      }

      if (
        !formData.attributes?.some((attribute: any) => attribute === Attributes.prerequisites) &&
        formData.prerequisites
      ) {
        updateFormData<typeof formData>({
          type: 'remove',
          path: 'prerequisites',
        })
      }
    }
  }, [formData, updateFormData])

  const formType = () => {
    switch (formData.__typename) {
      case 'Equipment':
        return 'equipment'
      case 'Race':
        return 'races'
      case 'Class':
        return 'classes'
      case 'Background':
        return 'backgrounds'
      case 'Spell':
        return 'spells'
      case 'Feat':
        return 'feats'
      case 'Character':
        return 'characters'
    }
  }

  return (
    <>
      <Row className={sprinkles({ mb: 'space-3' })}>
        {formData.__typename !== 'Race' &&
          formData.__typename !== 'Background' &&
          formData.__typename !== 'Character' && (
            <>
              <Dropdown<typeof formData>
                multiSelect={true}
                name='attributes'
                label={`${startCase(formData.__typename)} Attributes`}
                value={formData?.attributes}
                options={system.attributes.filter((attribute) =>
                  ((formData.__typename === 'Equipment' &&
                    (attribute.equipment.includes(EquipmentEnum.armors) ||
                      attribute.equipment.includes(EquipmentEnum.adventuringGear) ||
                      attribute.equipment.includes(EquipmentEnum.weapons) ||
                      attribute.equipment.includes(EquipmentEnum.all))) ||
                    (formData.__typename === 'Class' &&
                      (attribute.classes.includes(ClassesEnum.base) ||
                        attribute.classes.includes(ClassesEnum.subclass) ||
                        attribute.classes.includes(ClassesEnum.all))) ||
                    (formData.__typename === 'Feat' && attribute.feats.includes(AllEnum.all))) &&
                  formData.attributes?.some((attribute) => attribute === Attributes.primaryAbility)
                    ? attribute
                    : attribute.id !== Attributes.optionalAbility
                )}
                onChange={updateFormData}
              />
              {formData.__typename === 'Equipment' &&
                formData.attributes?.some((attribute) => attribute === Attributes.stackable) && (
                  <Input<typeof formData>
                    validation={'num'}
                    type='text'
                    name='maxStack'
                    errorMsg='Must contain only numbers'
                    label='Max Stack Size'
                    autoComplete='off'
                    value={formData?.maxStack}
                    onChange={updateFormData}
                  />
                )}
            </>
          )}
        {(formData.__typename === 'Spell' || formData.__typename === 'Feat') &&
          formData.attributes?.some((attribute) => attribute === Attributes.isAction) && (
            <>
              <Dropdown<typeof formData>
                name={'actions.primary.id'}
                label={formData.__typename === 'Spell' ? 'Casting Time' : 'Action Type'}
                value={formData?.actions.primary.id}
                options={system.actions.filter((action) => action[formType() as 'classes' | 'equipment' | 'feats'])}
                required={true}
                onChange={updateFormData}
              />
              {formData.actions.primary.id !== Actions.special && (
                <Input<typeof formData>
                  validation='num'
                  name='actions.primary.amount'
                  label='Casting Increment'
                  value={formData?.actions.primary.amount}
                  required={true}
                  onChange={updateFormData}
                />
              )}
            </>
          )}
        {formData.__typename === 'Spell' && (
          <>
            {formData?.attributes?.some((attribute) => attribute === Attributes.secondaryAction) && (
              <>
                <Dropdown<typeof formData>
                  name='actions.secondary.id'
                  label='Sec. Action'
                  value={formData?.actions.secondary?.id}
                  options={system.actions.filter((action) => action[formType() as 'classes' | 'equipment' | 'feats'])}
                  required={true}
                  onChange={updateFormData}
                />
                {formData.actions.secondary.id !== Actions.special && (
                  <Input<typeof formData>
                    validation='num'
                    name='actions.secondary.amount'
                    label='Sec. Increment'
                    value={formData?.actions.secondary.amount}
                    required={true}
                    onChange={updateFormData}
                  />
                )}
              </>
            )}
            <Dropdown<typeof formData>
              name='duration'
              label='Duration'
              value={formData?.duration.id}
              options={system.spells.durations}
              required={true}
              onChange={updateFormData}
            />
            {formData?.duration &&
              formData.duration?.id !== Durations.instantaneous &&
              formData.duration?.id !== Durations.untilDispelled &&
              formData.duration?.id !== Durations.special && (
                <Input<typeof formData>
                  validation='num'
                  name='duration.amount'
                  errorMsg='Must contain only numbers'
                  label='Duration Increment'
                  autoComplete='off'
                  required={true}
                  value={formData?.duration?.id}
                  onChange={updateFormData}
                />
              )}
            <Dropdown<typeof formData>
              name='range.id'
              label='Range'
              value={formData?.range?.id}
              options={system.spells.ranges}
              required={true}
              onChange={updateFormData}
            />
            {formData?.range?.id !== Ranges.touch &&
              formData.range?.id !== Ranges.sight &&
              formData.range?.id !== Ranges.unlimited && (
                <>
                  <Input<typeof formData>
                    validation='num'
                    name='range.minRange'
                    errorMsg='Please enter a valid number greater than 0'
                    label='Min. Range'
                    autoComplete='off'
                    required={formData.range?.id === Ranges.distance ? true : false}
                    value={formData?.range?.minRange}
                    onChange={updateFormData}
                  />
                  <Input<typeof formData>
                    validation='num'
                    name='range.maxRange'
                    errorMsg='Please enter a valid number greater than 0'
                    label='Max Range'
                    autoComplete='off'
                    required={formData.range?.id === Ranges.distance ? true : false}
                    value={formData?.range?.maxRange}
                    onChange={updateFormData}
                  />
                  <Dropdown<typeof formData>
                    name='range.unit'
                    label='UoM'
                    value={formData?.range?.unit}
                    options={Object.values(system.rules.measurements.imperial).flatMap(
                      (rule) => Array.isArray(rule) && rule
                    )}
                    onChange={updateFormData}
                  />
                </>
              )}
            <Dropdown<typeof formData>
              name='shape.id'
              label='Shape'
              options={system.spells.shapes}
              value={formData?.shape?.id}
              onChange={updateFormData}
            />
            {formData?.shape?.id && formData.shape?.id !== Shapes.none && formData.shape?.id !== Shapes.weapon && (
              <>
                <Input<typeof formData>
                  validation='cur'
                  name='shape.size'
                  errorMsg='Please enter a valid number (can inlude decimals)'
                  label='Shape Size'
                  autoComplete='off'
                  required={true}
                  value={formData?.shape?.size}
                  onChange={updateFormData}
                />
                <Dropdown<typeof formData>
                  name='shape.unit'
                  label='UoM'
                  value={formData?.shape?.unit}
                  options={Object.values(system.rules.measurements.imperial).flatMap(
                    (rule) => Array.isArray(rule) && rule
                  )}
                  required={true}
                  onChange={updateFormData}
                />
              </>
            )}
            {formData.__typename === 'Spell' && (
              <Input<typeof formData>
                name='targets'
                label='# of Targets'
                validation='num'
                value={formData?.targets}
                errorMsg='Enter a valid number greater than 0'
                onChange={updateFormData}
                placeholder='1'
              />
            )}
            {formData?.attributes?.some((attribute) => attribute === Attributes.appliesCondition) && (
              <Dropdown<typeof formData>
                name='conditions'
                label='Condition'
                value={formData?.conditions}
                options={system.conditions}
                multiSelect={true}
                required={true}
                onChange={updateFormData}
              />
            )}
          </>
        )}
        {formData.__typename !== 'Race' &&
          formData.__typename !== 'Background' &&
          formData.__typename !== 'Character' &&
          formData?.attributes?.some((attribute) => attribute === Attributes.requiresSave) && (
            <>
              {formData.__typename === 'Spell' && (
                <Dropdown<typeof formData>
                  name='saveAbility.attributes'
                  multiSelect={true}
                  label='Save Attribute'
                  value={formData?.saveAbility?.attributes}
                  options={system.attributes.filter((attribute) =>
                    attribute.features.includes(FeatureEnum.saveAbilities)
                  )}
                  onChange={updateFormData}
                />
              )}
              {formData.__typename !== 'Class' && (
                <>
                  <Dropdown<typeof formData>
                    name='saveAbility'
                    label='DC Ability'
                    value={formData?.saveAbility.id}
                    options={system.abilities}
                    required={true}
                    onChange={updateFormData}
                  />
                  {formData?.saveAbility?.attributes.some(
                    (attribute) => attribute === Attributes.addAbilityModifier
                  ) && (
                    <Dropdown<typeof formData>
                      name='saveAbility.abilityModifier'
                      label='Modifier Ability'
                      value={formData?.saveAbility?.abilityModifier}
                      options={system.abilities}
                      required={true}
                      onChange={updateFormData}
                    />
                  )}
                  <Input<typeof formData>
                    validation='num'
                    name={`saveAbility.minAmount`}
                    autoComplete='off'
                    label='Base Value'
                    required={true}
                    errorMsg='Must contain only numbers'
                    value={formData?.saveAbility?.minAmount}
                    onChange={updateFormData}
                  />
                </>
              )}
            </>
          )}
      </Row>
      {formData.__typename === 'Class' && (
        <>
          {formData?.attributes?.some((attribute) => attribute === Attributes.primaryAbility) && (
            <Multiclass formData={formData} updateFormData={updateFormData} />
          )}
          {formData.attributes?.some((attribute) => attribute === Attributes.hasResourcePoints) && (
            <Resource formData={formData} updateFormData={updateFormData} />
          )}
          {formData.attributes?.some((attribute) => attribute === Attributes.spellcaster) && (
            <Spellcasting formData={formData} updateFormData={updateFormData} />
          )}
          {(formData.attributes?.some((attribute) => attribute === Attributes.spellcaster) ||
            (formData.attributes?.some((attribute) => attribute === Attributes.hasResourcePoints) &&
              formData.resource?.method === Attributes.setPerLevel)) && (
            <LevelAttributes formData={formData} updateFormData={updateFormData} />
          )}
        </>
      )}
      {formData.__typename === 'Class' && formData?.subtypes?.length > 0 && (
        <>
          <Collapse>
            <Collapse.Header title={'Subtypes'} startOpened={context.type === 'new'} />
            <Collapse.Body>
              <Row cellSize='auto'>
                <span>Name</span>
              </Row>
              {formData.subtypes?.map((subtype, index) => (
                <Row key={index} cellSize='auto'>
                  <Input<typeof formData>
                    name={`subtypes.${index}.value`}
                    value={subtype.value}
                    onChange={updateFormData}
                  />
                </Row>
              ))}
            </Collapse.Body>
          </Collapse>
        </>
      )}
      {(formData.__typename === 'Spell' || formData.__typename === 'Equipment') &&
        formData?.attributes?.some((attribute) => attribute === Attributes.doesDamage) && (
          <Damage
            formData={formData}
            updateFormData={updateFormData as (state: UpdateState<Spell | Equipment>) => void}
          />
        )}
      {formData.__typename === 'Equipment' &&
        (formData?.category === EquipmentCategories.armor || formData?.category === EquipmentCategories.shield) && (
          <>
            <Divider label='Armor Stats' />
            <Row className={sprinkles({ mb: 'space-3' })}>
              <Input<typeof formData>
                validation='num'
                name='armorClass'
                errorMsg='Must contain only numbers'
                label='Armor Value'
                required={true}
                value={formData?.armorClass}
                onChange={updateFormData}
              />
              {formData?.category === EquipmentCategories.armor && (
                <Dropdown<typeof formData>
                  name='primaryAbility'
                  label='Primary Ability'
                  value={formData?.primaryAbility}
                  options={system.abilities}
                  onChange={updateFormData}
                />
              )}
            </Row>
          </>
        )}
      {formData.__typename === 'Spell' && <Upcast formData={formData} updateFormData={updateFormData} />}
      {formData.__typename === 'Feat' && formData.attributes.map((attribute) => attribute === Attributes.limitUse) && (
        <LimitUse formData={formData} updateFormData={updateFormData} />
      )}
      {formData.__typename === 'Feat' &&
        formData.attributes?.some((attribute) => attribute === Attributes.prerequisites) && (
          <Requirements formData={formData} updateFormData={updateFormData as (state: UpdateState<Feat>) => void} />
        )}
    </>
  )
}

export default AttributeForm
