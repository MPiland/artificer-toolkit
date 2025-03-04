import { useEffect } from 'react'
import { sprinkles } from '../../../css/sprinkles.css'
import Dropdown from '../../Dropdown/Dropdown'
import { startCase } from 'lodash'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Input from '../../Input/Input'
import Collapse from '../../Collapse/Collapse'
import Divider from '../../Divider/Divider'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Requirements from '../Subforms/Requirements'
import Damage from '../Subforms/Damage'
import Upcast from '../Subforms/Upcast'
import LevelAttributes from '../Subforms/LevelAttributes'
import Spellcasting from '../Subforms/Spellcasting'
import Resource from '../Subforms/Resource'
import LimitUse from '../Subforms/LimitUse'
import Multiclass from '../Subforms/Multiclass'
import { Attributes, Categories, Durations, Ranges, Shapes } from '../../../types/enums'
import { AllEnum, ClassesEnum, Equipment, EquipmentEnum, Feat, Spell, SpellEnum } from '../../../../amplify/gql/types'
import { UpdateState } from '../../../types/form'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import Grid from '../../Grid/Grid'
import Group from '../../Group/Group'
import Button from '../../Button/Button'
import { TbPlus, TbX } from 'react-icons/tb'
import { row_button } from '../Form.css'

const AttributeForm = () => {
  const { formData, updateFormData } = use(FormContext)

  const { data: system } = useGetSystemQuery()

  const {
    isSpecial,
    doesDamage,
    isWeapon,
    hasPrerequisites,
    isSpellcaster,
    canUpcast,
    equipmentProficiency,
    equipped,
    notEquipped,
    stackable,
    isAction,
    secondaryAction,
    requiresSave,
    primaryAbility,
    hasResourcePoints,
    resourceSetPerLevel,
    isArmor,
    isAdventuringGear,
    isShield,
    limitUse,
    specialPrimaryAction,
    specialSecondaryAction,
  } = useEnumChecks({
    data: formData,
  })

  // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
  useEffect(() => {
    if (!formData) return

    const cleanup = () => {
      switch (formData.__typename) {
        case 'Equipment':
          return [
            {
              condition: !(isWeapon || !isSpecial || doesDamage) && formData?.damage != null,
              cleanup: () =>
                updateFormData<typeof formData>({
                  type: 'remove',
                  path: 'damage',
                }),
            },
          ]
        case 'Spell':
          return [
            {
              condition: !doesDamage && formData?.damage != null,
              cleanup: () =>
                updateFormData<typeof formData>({
                  type: 'remove',
                  path: 'damage',
                }),
            },
            {
              condition: !canUpcast && formData.upcast != null,
              cleanup: () =>
                updateFormData<typeof formData>({
                  type: 'remove',
                  path: 'upcast',
                }),
            },
          ]
        case 'Class':
          return [
            {
              condition: !isSpellcaster && formData.spellcasting != null,
              cleanup: () => {
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
              },
            },
            {
              condition: formData?.category !== Categories.subclass && formData?.subtypes?.length > 0,
              cleanup: () => {
                updateFormData<typeof formData>({
                  type: 'remove',
                  path: 'subtypes',
                })
              },
            },
          ]
        case 'Feat':
          return [
            {
              condition: !hasPrerequisites && formData.prerequisites != null,
              cleanup: () =>
                updateFormData<typeof formData>({
                  type: 'remove',
                  path: 'prerequisites',
                }),
            },
            {
              condition: !equipmentProficiency && formData.prerequisites?.equipmentProficiencies?.length > 0,
              cleanup: () =>
                updateFormData<typeof formData>({
                  type: 'remove',
                  path: 'prerequisites.equipmentProficiencies',
                }),
            },
            {
              condition: !equipped && formData.prerequisites?.equipped?.length > 0,
              cleanup: () =>
                updateFormData<typeof formData>({
                  type: 'remove',
                  path: 'prerequisites.equipped',
                }),
            },
            {
              condition: !notEquipped && formData.prerequisites?.notEquipped?.length > 0,
              cleanup: () =>
                updateFormData<typeof formData>({
                  type: 'remove',
                  path: 'prerequisites.notEquipped',
                }),
            },
          ]
      }
    }

    const cleanupRules = cleanup()
    if (cleanupRules) {
      cleanupRules.forEach(({ condition, cleanup }) => {
        if (condition) cleanup()
      })
    }
  }, [
    formData,
    updateFormData,
    canUpcast,
    isSpellcaster,
    isWeapon,
    doesDamage,
    hasPrerequisites,
    equipmentProficiency,
    equipped,
    notEquipped,
    isSpecial,
  ])

  // Add Subtypes to Class as necessary
  useEffect(() => {
    if (formData?.__typename !== 'Class' || formData.category !== Categories.subclass || formData?.subtypes?.length > 0)
      return

    updateFormData<typeof formData>({
      type: 'add',
      path: 'subtypes',
    })
  }, [formData, updateFormData])

  const typeMap = {
    Equipment: 'equipment',
    Race: 'races',
    Class: 'classes',
    Background: 'backgrounds',
    Spell: 'spells',
    Feat: 'feats',
    Character: 'characters',
  } as const

  return (
    <Grid>
      <Grid.Item>
        <Grid>
          {formData.__typename !== 'Race' &&
            formData.__typename !== 'Background' &&
            formData.__typename !== 'Character' && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown<typeof formData>
                    multiSelect={true}
                    name='attributes'
                    label={`${startCase(formData.__typename)} Attributes`}
                    value={formData?.attributes}
                    options={system.attributes
                      .filter((attribute) => {
                        if (formData.__typename === 'Equipment' && attribute?.equipment?.length > 0) {
                          if (isArmor) {
                            return (
                              attribute.equipment.includes(EquipmentEnum.armors) ||
                              attribute.equipment.includes(EquipmentEnum.all)
                            )
                          }
                          if (isAdventuringGear) {
                            return (
                              attribute.equipment.includes(EquipmentEnum.adventuringGear) ||
                              attribute.equipment.includes(EquipmentEnum.all)
                            )
                          }
                          if (isWeapon) {
                            return (
                              attribute.equipment.includes(EquipmentEnum.weapons) ||
                              attribute.equipment.includes(EquipmentEnum.all)
                            )
                          }
                          return attribute.equipment.includes(EquipmentEnum.all)
                        }
                        if (formData.__typename === 'Class' && attribute?.classes?.length > 0) {
                          return (
                            attribute.classes.includes(ClassesEnum.base) ||
                            (formData?.category === Categories.subclass &&
                              attribute.classes.includes(ClassesEnum.subclass)) ||
                            attribute.classes.includes(ClassesEnum.all)
                          )
                        }
                        if (formData.__typename === 'Feat' && attribute?.feats?.length > 0) {
                          return attribute.feats.includes(AllEnum.all)
                        }
                        if (formData.__typename === 'Spell' && attribute?.spells?.length > 0) {
                          return attribute.spells.includes(SpellEnum.all)
                        }
                        return false
                      })
                      .filter((attribute) =>
                        primaryAbility ? attribute : attribute.id !== Attributes.optionalAbility
                      )}
                    onChange={updateFormData}
                  />
                </Grid.Item>
                {formData.__typename === 'Equipment' && stackable && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                  </Grid.Item>
                )}
              </>
            )}
          {(formData.__typename === 'Spell' || formData.__typename === 'Feat') && isAction && (
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name={'actions.primary.id'}
                  label={formData.__typename === 'Spell' ? 'Casting Time' : 'Action Type'}
                  value={formData?.actions.primary.id}
                  options={system.actions.filter((action) => action[typeMap[formData.__typename]])}
                  required={true}
                  onChange={updateFormData}
                />
              </Grid.Item>
              {!specialPrimaryAction && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input<typeof formData>
                    validation='num'
                    name='actions.primary.amount'
                    label='Casting Increment'
                    value={formData?.actions.primary.amount}
                    required={true}
                    onChange={updateFormData}
                  />
                </Grid.Item>
              )}
            </>
          )}
          {formData.__typename === 'Spell' && (
            <>
              {secondaryAction && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown<typeof formData>
                      name='actions.secondary.id'
                      label='Sec. Action'
                      value={formData?.actions.secondary?.id}
                      options={system.actions.filter((action) => action[typeMap[formData.__typename]])}
                      required={true}
                      onChange={updateFormData}
                    />
                  </Grid.Item>
                  {!specialSecondaryAction && (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input<typeof formData>
                        validation='num'
                        name='actions.secondary.amount'
                        label='Sec. Increment'
                        value={formData?.actions.secondary.amount}
                        required={true}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                  )}
                </>
              )}
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name='duration'
                  label='Duration'
                  value={formData?.duration?.id}
                  options={system.spells.durations}
                  required={true}
                  onChange={updateFormData}
                />
              </Grid.Item>
              {formData?.duration &&
                formData.duration?.id !== Durations.instantaneous &&
                formData.duration?.id !== Durations.untilDispelled &&
                formData.duration?.id !== Durations.special && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                  </Grid.Item>
                )}
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name='range.id'
                  label='Range'
                  value={formData?.range?.id}
                  options={system.spells.ranges}
                  required={true}
                  onChange={updateFormData}
                />
              </Grid.Item>
              {formData?.range?.id !== Ranges.touch &&
                formData.range?.id !== Ranges.sight &&
                formData.range?.id !== Ranges.unlimited &&
                formData.range?.id !== Ranges.self && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown<typeof formData>
                        name='range.unit'
                        label='UoM'
                        value={formData?.range?.unit}
                        options={Object.values(system.rules.measurements.imperial).flatMap(
                          (rule) => Array.isArray(rule) && rule
                        )}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                  </>
                )}
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown<typeof formData>
                  name='shape.id'
                  label='Shape'
                  options={system.spells.shapes}
                  value={formData?.shape?.id}
                  onChange={updateFormData}
                />
              </Grid.Item>
              {formData?.shape?.id && formData.shape?.id !== Shapes.none && formData.shape?.id !== Shapes.weapon && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                  </Grid.Item>
                </>
              )}
              {formData.__typename === 'Spell' && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input<typeof formData>
                    name='targets'
                    label='# of Targets'
                    validation='num'
                    value={formData?.targets}
                    errorMsg='Enter a valid number greater than 0'
                    onChange={updateFormData}
                    placeholder='1'
                  />
                </Grid.Item>
              )}
              {formData?.attributes?.some((attribute) => attribute === Attributes.appliesCondition) && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown<typeof formData>
                    name='conditions'
                    label='Condition'
                    value={formData?.conditions}
                    options={system.conditions}
                    multiSelect={true}
                    required={true}
                    onChange={updateFormData}
                  />
                </Grid.Item>
              )}
            </>
          )}
          {formData.__typename !== 'Race' &&
            formData.__typename !== 'Background' &&
            formData.__typename !== 'Character' &&
            requiresSave && (
              <>
                {formData.__typename !== 'Class' && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown<typeof formData>
                        name='saveAbility'
                        label='DC Ability'
                        value={formData?.saveAbility.id}
                        options={system.abilities}
                        required={true}
                        onChange={updateFormData}
                      />
                    </Grid.Item>
                    {formData?.saveAbility?.attributes?.some(
                      (attribute) => attribute === Attributes.addAbilityModifier
                    ) && (
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                        <Dropdown<typeof formData>
                          name='saveAbility.abilityModifier'
                          label='Modifier Ability'
                          value={formData?.saveAbility?.abilityModifier}
                          options={system.abilities}
                          required={true}
                          onChange={updateFormData}
                        />
                      </Grid.Item>
                    )}
                    {formData.__typename !== 'Spell' && (
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
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
                      </Grid.Item>
                    )}
                  </>
                )}
              </>
            )}
        </Grid>
      </Grid.Item>
      {formData.__typename === 'Class' && (
        <>
          {primaryAbility && <Multiclass formData={formData} updateFormData={updateFormData} />}
          {hasResourcePoints && <Resource formData={formData} updateFormData={updateFormData} />}
          {isSpellcaster && <Spellcasting formData={formData} updateFormData={updateFormData} />}
          {(isSpellcaster || (hasResourcePoints && resourceSetPerLevel)) && (
            <LevelAttributes formData={formData} updateFormData={updateFormData} />
          )}
          {formData?.subtypes?.length > 0 && (
            <Collapse>
              <Collapse.Header title={'Subtypes'} startOpened={formData.id == null} />
              <Collapse.Body>
                <Grid>
                  <Grid.Item>Name</Grid.Item>
                  {formData.subtypes?.map((subtype, index) => (
                    <>
                      <Grid.Item key={index} colSpan={6}>
                        <Input<typeof formData>
                          name={`subtypes.${index}.label`}
                          value={subtype.label}
                          onChange={updateFormData}
                        />
                      </Grid.Item>
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }} className={sprinkles({ alignContent: 'center' })}>
                        <Group
                          className={sprinkles({ height: 'size-full' })}
                          alignItemsVariant='center'
                          justifyContentVariant='start'
                        >
                          <Button
                            style='unstyled'
                            className={row_button}
                            onClick={() =>
                              updateFormData({
                                type: 'add',
                                path: 'subtypes',
                              })
                            }
                          >
                            <TbPlus />
                          </Button>
                          {index !== 0 && (
                            <Button
                              style='unstyled'
                              className={row_button}
                              onClick={() => {
                                updateFormData({
                                  type: 'remove',
                                  path: `subtypes.${index}`,
                                })
                              }}
                            >
                              <TbX />
                            </Button>
                          )}
                        </Group>
                      </Grid.Item>
                    </>
                  ))}
                </Grid>
              </Collapse.Body>
            </Collapse>
          )}
        </>
      )}
      {((formData.__typename === 'Spell' && doesDamage) ||
        (formData.__typename === 'Equipment' && (isWeapon || isSpecial))) && (
        <Damage
          formData={formData}
          updateFormData={updateFormData as (state: UpdateState<Spell | Equipment>) => void}
        />
      )}
      {formData.__typename === 'Equipment' && (isArmor || isShield) && (
        <>
          <Divider label='Armor Stats' />
          <Grid.Item>
            <Grid>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input<typeof formData>
                  validation='num'
                  name='armorClass'
                  errorMsg='Must contain only numbers'
                  label='Armor Value'
                  required={true}
                  value={formData?.armorClass}
                  onChange={updateFormData}
                />
              </Grid.Item>
              {isArmor && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown<typeof formData>
                    name='primaryAbility'
                    label='Primary Ability'
                    value={formData?.primaryAbility}
                    options={system.abilities}
                    onChange={updateFormData}
                  />
                </Grid.Item>
              )}
            </Grid>
          </Grid.Item>
        </>
      )}
      {formData.__typename === 'Spell' && canUpcast && <Upcast formData={formData} updateFormData={updateFormData} />}
      {formData.__typename === 'Feat' && limitUse && <LimitUse formData={formData} updateFormData={updateFormData} />}
      {formData.__typename === 'Feat' && hasPrerequisites && (
        <Requirements formData={formData} updateFormData={updateFormData as (state: UpdateState<Feat>) => void} />
      )}
    </Grid>
  )
}

export default AttributeForm
