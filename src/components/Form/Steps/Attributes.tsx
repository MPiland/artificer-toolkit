import { useEffect } from 'react'
import { sprinkles } from '@/css/sprinkles.css'
import Dropdown from '@/components/Dropdown'
import { startCase } from 'lodash'
import Input from '@/components/Input'
import Collapse from '@/components/Collapse'
import Divider from '@/components/Divider'
import { use } from 'react'
import { FormContext } from '../FormContext'
import Requirements from '../Substeps/Prerequisites'
import Damage from '../Substeps/Damage'
import Upcast from '../Substeps/Upcast'
import LevelAttributes from '../Substeps/Class/LevelAttributes'
import Spellcasting from '../Substeps/Class/Spellcasting'
import Resource from '../Substeps/Class/Resource'
import LimitUse from '../Substeps/LimitUse'
import Multiclass from '../Substeps/Class/Multiclass'
import {
  Attributes as AttributesEnum,
  Categories,
  Durations,
  Ranges,
  Shapes,
  Classes,
  Equipments,
  Feats,
  Spells,
} from '@/enums'
import { useEnumChecks, useSystemData } from '@/hooks'
import Grid from '@/components/Grid'
import Group from '@/components/Group'
import Button from '@/components/Button'
import { TbPlus, TbX } from 'react-icons/tb'
import { row_button } from '../Form.css'
import type { FormDataType, OnChange } from '@/types'
import type { FormStore } from '@/store'

const AttributesStep = () => {
  const { formStore } = use(FormContext)

  const {
    data,
    updateField,
    removeField,
    addField,
  }: {
    data: FormDataType
    updateField: OnChange<FormDataType>['updateField']
    removeField: OnChange<FormDataType>['removeField']
    addField: OnChange<FormDataType>['addField']
  } = formStore

  const {
    attributes,
    actions,
    rules,
    conditions,
    abilities,
    spells: { durations, shapes, ranges },
  } = useSystemData()

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
    data: data,
  })

  // Cleanup any unnecessary data arrays to ensure the data is correct and not filled with invalid data
  useEffect(() => {
    if (!data) return

    const cleanup = () => {
      switch (data.__typename) {
        case 'Equipment':
          return [
            {
              condition: !(isWeapon || !isSpecial || doesDamage) && data?.damage != null,
              cleanup: () => removeField({ path: 'damage' }),
            },
          ]
        case 'Spell':
          return [
            {
              condition: !doesDamage && data?.damage != null,
              cleanup: () => removeField({ path: 'damage' }),
            },
            {
              condition: !canUpcast && data.upcast != null,
              cleanup: () => removeField({ path: 'upcast' }),
            },
          ]
        case 'Class':
          return [
            {
              condition: !isSpellcaster && data.spellcasting != null,
              cleanup: () => {
                removeField({ path: 'spellcasting' })
                if (data.__typename === 'Class') {
                  data.levelAttributes?.map((_: any, index) => {
                    removeField({ path: `levelAttributes.${index}.spellSlots` })
                  })
                }
              },
            },
            {
              condition: data?.category !== Categories.SUBCLASS && data?.subtypes?.length,
              cleanup: () => {
                removeField({ path: 'subtypes' })
              },
            },
          ]
        case 'Feat':
          return [
            {
              condition: !hasPrerequisites && data.prerequisites != null,
              cleanup: () => removeField({ path: 'prerequisites' }),
            },
            {
              condition: !equipmentProficiency && data.prerequisites?.equipmentProficiencies?.length,
              cleanup: () => removeField({ path: 'prerequisites.equipmentProficiencies' }),
            },
            {
              condition: !equipped && data.prerequisites?.equipped?.length,
              cleanup: () => removeField({ path: 'prerequisites.equipped' }),
            },
            {
              condition: !notEquipped && data.prerequisites?.notEquipped?.length,
              cleanup: () => removeField({ path: 'prerequisites.notEquipped' }),
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
    removeField,
    canUpcast,
    isSpellcaster,
    isWeapon,
    doesDamage,
    hasPrerequisites,
    equipmentProficiency,
    equipped,
    notEquipped,
    isSpecial,
    data,
  ])

  // Add Subtypes to Class as necessary
  useEffect(() => {
    if (data?.__typename !== 'Class' || data.category !== Categories.SUBCLASS || data?.subtypes?.length) return

    addField({ path: 'subtypes' })
  }, [addField, data])

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
          {data.__typename !== 'Race' && data.__typename !== 'Background' && data.__typename !== 'Character' && (
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  multiSelect={true}
                  name='attributes'
                  label={`${startCase(data.__typename)} Attributes`}
                  value={data?.attributes}
                  options={attributes
                    .filter((attribute) => {
                      if (data.__typename === 'Equipment' && attribute?.equipment?.length) {
                        if (isArmor) {
                          return (
                            attribute.equipment.includes(Equipments.ARMOR) ||
                            attribute.equipment.includes(Equipments.ALL)
                          )
                        }
                        if (isAdventuringGear) {
                          return (
                            attribute.equipment.includes(Equipments.ADVENTURING_GEAR) ||
                            attribute.equipment.includes(Equipments.ALL)
                          )
                        }
                        if (isWeapon) {
                          return (
                            attribute.equipment.includes(Equipments.WEAPON) ||
                            attribute.equipment.includes(Equipments.ALL)
                          )
                        }
                        return attribute.equipment.includes(Equipments.ALL)
                      }
                      if (data.__typename === 'Class' && attribute?.classes?.length) {
                        return (
                          attribute.classes.includes(Classes.BASE) ||
                          (data?.category === Categories.SUBCLASS && attribute.classes.includes(Classes.SUBCLASS)) ||
                          attribute.classes.includes(Classes.ALL)
                        )
                      }
                      if (data.__typename === 'Feat' && attribute?.feats?.length) {
                        return attribute.feats.includes(Feats.ALL)
                      }
                      if (data.__typename === 'Spell' && attribute?.spells?.length) {
                        return attribute.spells.includes(Spells.ALL)
                      }
                      return false
                    })
                    .filter((attribute) =>
                      primaryAbility ? attribute : attribute.id !== AttributesEnum.OPTIONAL_ABILITY
                    )}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
              {data.__typename === 'Equipment' && stackable && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    validation={'num'}
                    type='text'
                    name='maxStack'
                    errorMsg='Must contain only numbers'
                    label='Max Stack Size'
                    autoComplete='off'
                    value={data?.maxStack}
                    onChange={{ updateField }}
                  />
                </Grid.Item>
              )}
            </>
          )}
          {(data.__typename === 'Spell' || data.__typename === 'Feat') && isAction && (
            <>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name={'actions.primary.id'}
                  label={data.__typename === 'Spell' ? 'Casting Time' : 'Action Type'}
                  value={data?.actions?.primary?.id}
                  options={actions.filter((action) => action[typeMap[data.__typename]])}
                  required={true}
                  onChange={{
                    updateField,
                    removeField,
                  }}
                />
              </Grid.Item>
              {!specialPrimaryAction && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    validation='num'
                    name='actions.primary.amount'
                    label='Casting Increment'
                    value={data?.actions?.primary?.amount}
                    required={true}
                    onChange={{ updateField }}
                  />
                </Grid.Item>
              )}
            </>
          )}
          {data.__typename === 'Spell' && (
            <>
              {secondaryAction && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name='actions.secondary.id'
                      label='Sec. Action'
                      value={data?.actions?.secondary?.id}
                      options={actions.filter((action) => action[typeMap[data.__typename]])}
                      required={true}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                  {!specialSecondaryAction && (
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        validation='num'
                        name='actions.secondary.amount'
                        label='Sec. Increment'
                        value={data?.actions?.secondary?.amount}
                        required={true}
                        onChange={{ updateField }}
                      />
                    </Grid.Item>
                  )}
                </>
              )}
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='duration'
                  label='Duration'
                  value={data?.duration?.id}
                  options={durations}
                  required={true}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
              {data?.duration &&
                data.duration?.id !== Durations.INSTANTANEOUS &&
                data.duration?.id !== Durations.UNTIL_DISPELLED &&
                data.duration?.id !== Durations.SPECIAL && (
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='num'
                      name='duration.amount'
                      errorMsg='Must contain only numbers'
                      label='Duration Increment'
                      autoComplete='off'
                      required={true}
                      value={data?.duration?.id}
                      onChange={{ updateField }}
                    />
                  </Grid.Item>
                )}
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='range.id'
                  label='Range'
                  value={data?.range?.id}
                  options={ranges}
                  required={true}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
              {data?.range?.id !== Ranges.TOUCH &&
                data.range?.id !== Ranges.SIGHT &&
                data.range?.id !== Ranges.UNLIMITED &&
                data.range?.id !== Ranges.SELF && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        validation='num'
                        name='range.minRange'
                        errorMsg='Please enter a valid number greater than 0'
                        label='Min. Range'
                        autoComplete='off'
                        required={data.range?.id === Ranges.DISTANCE ? true : false}
                        value={data?.range?.minRange}
                        onChange={{ updateField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Input
                        validation='num'
                        name='range.maxRange'
                        errorMsg='Please enter a valid number greater than 0'
                        label='Max Range'
                        autoComplete='off'
                        required={data.range?.id === Ranges.DISTANCE ? true : false}
                        value={data?.range?.maxRange}
                        onChange={{ updateField }}
                      />
                    </Grid.Item>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='range.unit'
                        label='UoM'
                        value={data?.range?.unit}
                        options={rules.measurements.imperial.length}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                  </>
                )}
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Dropdown
                  name='shape.id'
                  label='Shape'
                  options={shapes}
                  value={data?.shape?.id}
                  onChange={{ updateField, removeField }}
                />
              </Grid.Item>
              {data?.shape?.id && data.shape?.id !== Shapes.NONE && data.shape?.id !== Shapes.WEAPON && (
                <>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Input
                      validation='cur'
                      name='shape.size'
                      errorMsg='Please enter a valid number (can inlude decimals)'
                      label='Shape Size'
                      autoComplete='off'
                      required={true}
                      value={data?.shape?.size}
                      onChange={{ updateField }}
                    />
                  </Grid.Item>
                  <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                    <Dropdown
                      name='shape.unit'
                      label='UoM'
                      value={data?.shape?.unit}
                      options={rules.measurements.imperial.length}
                      required={true}
                      onChange={{ updateField, removeField }}
                    />
                  </Grid.Item>
                </>
              )}
              {data.__typename === 'Spell' && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='targets'
                    label='# of Targets'
                    validation='num'
                    value={data?.targets}
                    errorMsg='Enter a valid number greater than 0'
                    onChange={{ updateField }}
                    placeholder='1'
                  />
                </Grid.Item>
              )}
              {data?.attributes?.some((attribute) => attribute === AttributesEnum.APPLIES_CONDITION) && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='conditions'
                    label='Condition'
                    value={data?.conditions}
                    options={conditions}
                    multiSelect={true}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
              )}
            </>
          )}
          {data.__typename !== 'Race' &&
            data.__typename !== 'Background' &&
            data.__typename !== 'Character' &&
            requiresSave && (
              <>
                {data.__typename !== 'Class' && (
                  <>
                    <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                      <Dropdown
                        name='saveAbility'
                        label='DC Ability'
                        value={data?.saveAbility?.id}
                        options={abilities}
                        required={true}
                        onChange={{ updateField, removeField }}
                      />
                    </Grid.Item>
                    {data?.saveAbility?.attributes?.some(
                      (attribute) => attribute === AttributesEnum.ADD_ABILITY_MODIFIER
                    ) && (
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                        <Dropdown
                          name='saveAbility.abilityModifier'
                          label='Modifier Ability'
                          value={data?.saveAbility?.abilityModifier}
                          options={abilities}
                          required={true}
                          onChange={{ updateField, removeField }}
                        />
                      </Grid.Item>
                    )}
                    {data.__typename !== 'Spell' && (
                      <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                        <Input
                          validation='num'
                          name={`saveAbility.minAmount`}
                          autoComplete='off'
                          label='Base Value'
                          required={true}
                          errorMsg='Must contain only numbers'
                          value={data?.saveAbility?.minAmount}
                          onChange={{ updateField }}
                        />
                      </Grid.Item>
                    )}
                  </>
                )}
              </>
            )}
        </Grid>
      </Grid.Item>
      {data.__typename === 'Class' && (
        <>
          {primaryAbility && <Multiclass formStore={formStore as FormStore<typeof data>} />}
          {hasResourcePoints && <Resource formStore={formStore as FormStore<typeof data>} />}
          {isSpellcaster && <Spellcasting formStore={formStore as FormStore<typeof data>} />}
          {(isSpellcaster || (hasResourcePoints && resourceSetPerLevel)) && (
            <LevelAttributes formStore={formStore as FormStore<typeof data>} />
          )}
          {data?.subtypes?.length && (
            <Collapse>
              <Collapse.Header title={'Subtypes'} startOpened={data.id == null} />
              <Collapse.Body>
                <Grid>
                  <Grid.Item>Name</Grid.Item>
                  {data.subtypes?.map((subtype, index) => (
                    <>
                      <Grid.Item key={index} colSpan={6}>
                        <Input name={`subtypes.${index}.label`} value={subtype.label} onChange={{ updateField }} />
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
                            onClick={() => addField({ path: 'subtypes' })}
                          >
                            <TbPlus />
                          </Button>
                          {index !== 0 && (
                            <Button
                              style='unstyled'
                              className={row_button}
                              onClick={() => {
                                removeField({ path: `subtypes.${index}` })
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
      {((data.__typename === 'Spell' && doesDamage) ||
        (data.__typename === 'Equipment' && (isWeapon || isSpecial))) && (
        <Damage formStore={formStore as FormStore<typeof data>} />
      )}
      {data.__typename === 'Equipment' && (isArmor || isShield) && (
        <>
          <Divider label='Armor Stats' />
          <Grid.Item>
            <Grid>
              <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                <Input
                  validation='num'
                  name='armorClass'
                  errorMsg='Must contain only numbers'
                  label='Armor Value'
                  required={true}
                  value={data?.armorClass}
                  onChange={{ updateField }}
                />
              </Grid.Item>
              {isArmor && (
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='primaryAbility'
                    label='Primary Ability'
                    value={data?.primaryAbility}
                    options={abilities}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
              )}
            </Grid>
          </Grid.Item>
        </>
      )}
      {data.__typename === 'Spell' && canUpcast && <Upcast formStore={formStore as FormStore<typeof data>} />}
      {data.__typename === 'Feat' && limitUse && <LimitUse formStore={formStore as FormStore<typeof data>} />}
      {data.__typename === 'Feat' && hasPrerequisites && (
        <Requirements formStore={formStore as FormStore<typeof data>} />
      )}
    </Grid>
  )
}

export default AttributesStep
